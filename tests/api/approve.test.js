// POST /api/recipes/approve: the one action that commits to the repo and
// triggers a production deploy. Here the commit goes to the fake GitHub and
// the deploy to the fake build hook, and both are inspected.
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { useApiServer } = require('./helpers');

const ctx = useApiServer();

const approve = (body, as = 'approver') => ctx.request('POST', '/api/recipes/approve', { as, body });
const committedRecipe = (slug) => JSON.parse(ctx.services.state.content).recipes.find((r) => r.slug === slug);

describe('POST /api/recipes/approve', () => {
  test('commits the approved values in one commit, marks the edits approved, logs them and fires one deploy', async () => {
    const a = await ctx.seedEdit({ lang: 'fr', fieldPath: 'title', newValue: 'Soupe aux lentilles' });
    const b = await ctx.seedEdit({ lang: 'ar', fieldPath: 'ingredients[0]', newValue: 'كوب من العدس' });

    const res = await approve({ editIds: [a.id, b.id], confirmed: true });

    assert.equal(res.status, 200, res.text);
    assert.equal(res.json.committed, true);
    assert.equal(res.json.totalApplied, 2);
    assert.equal(ctx.services.state.commits.length, 1);
    const commit = ctx.services.state.commits[0];
    assert.equal(commit.branch, 'ci-test-branch');
    assert.match(commit.message, /^i18n: approve batch — 2 field\(s\) across 1 recipe\(s\)$/);
    assert.equal(res.json.commitSha, ctx.services.state.headSha);

    const soup = committedRecipe('fixture-lentil-soup');
    assert.equal(soup.title.fr, 'Soupe aux lentilles');
    assert.equal(soup.ingredients.ar[0], 'كوب من العدس');
    assert.equal(soup.ingredients.ar[1], 'كوبان ماء', 'untouched values stay as they were');
    assert.equal(soup.title.en, 'Fixture Lentil Soup');
    assert.ok(!commit.content.endsWith('\n'), 'file written without a trailing newline, like the committed file');

    const edits = await ctx.sql`select status, resolved_by from edits order by field_path`;
    assert.deepEqual(
      edits.map((e) => [e.status, e.resolved_by]),
      [
        ['approved', 'approver@example.test'],
        ['approved', 'approver@example.test'],
      ],
    );
    const log = await ctx.rows('edit_log');
    assert.equal(log.length, 2);
    assert.ok(log.every((l) => l.action === 'approved' && l.commit_sha === res.json.commitSha));
    assert.ok(log.every((l) => l.editor_email === 'translator@example.test'));
    assert.equal(ctx.services.state.buildHooks, 1);
  });

  test('only the edits the approver selected are applied; the rest stay pending', async () => {
    const chosen = await ctx.seedEdit({ fieldPath: 'title', newValue: 'Choisi' });
    const left = await ctx.seedEdit({ fieldPath: 'description', newValue: 'Pas encore' });

    const res = await approve({ editIds: [chosen.id], confirmed: true });

    assert.equal(res.json.totalApplied, 1);
    assert.equal(committedRecipe('fixture-lentil-soup').description.fr, 'Une recette de test.');
    const [row] = await ctx.sql`select status from edits where id = ${left.id}`;
    assert.equal(row.status, 'pending');
  });

  test('a dry run reports what would happen and writes nothing', async () => {
    const ok = await ctx.seedEdit({ fieldPath: 'title' });
    const stale = await ctx.seedEdit({ fieldPath: 'description', oldValue: 'not the live value', newValue: 'x' });

    const res = await approve({ editIds: [ok.id, stale.id], dryRun: true });

    assert.equal(res.status, 200);
    assert.equal(res.json.dryRun, true);
    assert.equal(res.json.totalApplied, 1);
    assert.equal(res.json.totalConflicts, 1);
    assert.equal(res.json.conflicts[0].reason, 'stale');
    assert.equal(ctx.services.state.commits.length, 0);
    assert.equal(ctx.services.state.buildHooks, 0);
    const statuses = await ctx.sql`select status from edits`;
    assert.ok(statuses.every((s) => s.status === 'pending'));
    assert.equal((await ctx.rows('edit_log')).length, 0);
  });

  test('refuses to commit without confirmed: true', async () => {
    const edit = await ctx.seedEdit();
    const res = await approve({ editIds: [edit.id] });
    assert.equal(res.status, 400);
    assert.match(res.json.error, /confirmed must be true/);
    assert.equal(ctx.services.state.commits.length, 0);
  });

  test('an edit whose live value changed since it was staged is marked conflict and not committed', async () => {
    const edit = await ctx.seedEdit({ fieldPath: 'title', newValue: 'Ma version' });
    const data = ctx.services.currentRecipes();
    data.recipes[0].title.fr = 'Changé ailleurs entre-temps';
    ctx.services.setRecipes(data);

    const res = await approve({ editIds: [edit.id], confirmed: true });

    assert.equal(res.status, 200);
    assert.equal(res.json.committed, false);
    assert.equal(res.json.totalConflicts, 1);
    assert.equal(res.json.conflicts[0].currentValue, 'Changé ailleurs entre-temps');
    assert.equal(ctx.services.state.commits.length, 0);
    assert.equal(ctx.services.state.buildHooks, 0);
    const [row] = await ctx.sql`select status from edits where id = ${edit.id}`;
    assert.equal(row.status, 'conflict');
  });

  test('approving the same edits twice does not commit twice', async () => {
    const edit = await ctx.seedEdit();
    await approve({ editIds: [edit.id], confirmed: true });
    const second = await approve({ editIds: [edit.id], confirmed: true });
    assert.equal(second.status, 200);
    assert.equal(second.json.totalApplied, 0);
    assert.equal(ctx.services.state.commits.length, 1);
    assert.equal(ctx.services.state.buildHooks, 1);
  });

  test('if the GitHub commit fails, nothing is marked approved or logged and no deploy fires', async () => {
    const edit = await ctx.seedEdit();
    ctx.services.state.failNextPut = { status: 409, message: 'is at a different sha' };

    const res = await approve({ editIds: [edit.id], confirmed: true });

    assert.equal(res.status, 500);
    assert.match(res.json.error, /409/);
    const [row] = await ctx.sql`select status from edits where id = ${edit.id}`;
    assert.equal(row.status, 'pending');
    assert.equal((await ctx.rows('edit_log')).length, 0);
    assert.equal(ctx.services.state.buildHooks, 0);
  });

  test('recovers an edit that was committed by an earlier call that crashed before its bookkeeping', async () => {
    const edit = await ctx.seedEdit({ newValue: 'Déjà dans le fichier' });
    const data = ctx.services.currentRecipes();
    data.recipes[0].title.fr = 'Déjà dans le fichier';
    ctx.services.setRecipes(data);

    const res = await approve({ editIds: [edit.id], confirmed: true });

    assert.equal(res.json.committed, false, 'no new commit for content that is already there');
    const [row] = await ctx.sql`select status from edits where id = ${edit.id}`;
    assert.equal(row.status, 'approved');
    const [log] = await ctx.rows('edit_log');
    assert.equal(log.commit_sha, ctx.services.state.headSha, 'attributed to the current branch head');
    assert.equal(ctx.services.state.buildHooks, 0, 'no deploy when nothing new was committed');
  });

  test('applies a queued publish request in the same commit as translations', async () => {
    const text = await ctx.seedEdit({ slug: 'fixture-pilaf', fieldPath: 'title', newValue: 'Pilaf' });
    const pub = await ctx.seedEdit({
      slug: 'fixture-pilaf',
      fieldPath: 'published',
      oldValue: 'false',
      newValue: 'true',
      editor: 'approver@example.test',
    });

    const res = await approve({ editIds: [text.id, pub.id], confirmed: true });

    assert.equal(ctx.services.state.commits.length, 1);
    assert.match(ctx.services.state.commits[0].message, /1 field\(s\); publish fixture-pilaf \[fr\]/);
    const pilaf = committedRecipe('fixture-pilaf');
    assert.equal(pilaf.published.fr, true, 'stored as a real boolean');
    assert.equal(pilaf.title.fr, 'Pilaf');
    const log = await ctx.sql`select field_path, action from edit_log order by field_path`;
    assert.deepEqual(log, [
      { field_path: 'published', action: 'published' },
      { field_path: 'title', action: 'approved' },
    ]);
    assert.equal(res.json.totalApplied, 2);
  });

  for (const [name, body] of [
    ['an empty id list', { editIds: [], confirmed: true }],
    ['a missing id list', { confirmed: true }],
  ]) {
    test(`rejects ${name} with 400`, async () => {
      const res = await approve(body);
      assert.equal(res.status, 400);
    });
  }

  test('GET is not allowed', async () => {
    const res = await ctx.request('GET', '/api/recipes/approve', { as: 'approver' });
    assert.equal(res.status, 405);
  });
});
