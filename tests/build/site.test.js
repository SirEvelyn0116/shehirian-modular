// Checks on the generated site in dist/ (run `npm run build` first). These
// read the files exactly as Netlify would publish them; no browser needed.
const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const LANGS = ['en', 'fr', 'ar', 'hy'];

let files = [];
let pages = [];
let master;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}
const rel = (p) => path.relative(DIST, p).split(path.sep).join('/');
const read = (p) => fs.readFileSync(p, 'utf8');
const distPath = (urlPath) => path.join(DIST, decodeURIComponent(urlPath.replace(/^\//, '')));

// Text a visitor can read: the <body> without scripts, styles or tags.
function visibleText(html) {
  return html
    .replace(/<head\b[\s\S]*?<\/head[^>]*>/i, ' ')
    .replace(/<script\b[\s\S]*?<\/script[^>]*>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[#a-z0-9]+;/gi, ' ');
}

const isPublished = (recipe, lang) => !!(recipe.published && recipe.published[lang] === true);

before(() => {
  assert.ok(fs.existsSync(path.join(DIST, 'en', 'index.html')), 'dist/ is missing — run `npm run build` first');
  files = walk(DIST);
  // Public pages only: the admin tool is not part of the published site's content.
  pages = files.filter((f) => f.endsWith('.html') && !rel(f).startsWith('admin/'));
  master = JSON.parse(read(path.join(ROOT, 'sections', 'recipes', 'all-recipes.json')));
});

describe('pages and language attributes', () => {
  for (const lang of LANGS) {
    test(`${lang}: home, recipe index and both product pages exist with lang="${lang}"`, () => {
      for (const p of ['index.html', 'recipes/index.html', 'products/shirag.html', 'products/mr-falafel.html']) {
        const file = path.join(DIST, lang, p);
        assert.ok(fs.existsSync(file), `missing ${lang}/${p}`);
        const html = read(file);
        assert.match(html, new RegExp(`<html[^>]*\\blang="${lang}"`), `${lang}/${p} lang attribute`);
        const dir = lang === 'ar' ? 'rtl' : 'ltr';
        assert.match(html, new RegExp(`<html[^>]*\\bdir="${dir}"`), `${lang}/${p} dir attribute`);
      }
    });
  }

  test('every recipe has a page in every language', () => {
    for (const recipe of master.recipes) {
      for (const lang of LANGS) {
        assert.ok(
          fs.existsSync(path.join(DIST, lang, 'recipes', `${recipe.slug}.html`)),
          `${lang}/recipes/${recipe.slug}.html`,
        );
      }
    }
  });

  test('the admin bundle was built into dist/admin', () => {
    assert.ok(fs.existsSync(path.join(DIST, 'admin', 'index.html')));
    assert.ok(fs.statSync(path.join(DIST, 'admin', 'recipes-dist', 'recipes.js')).size > 10000);
  });
});

describe('links and structured data', () => {
  test('every internal href/src on every public page resolves to a file in dist/', () => {
    const broken = [];
    for (const page of pages) {
      for (const m of read(page).matchAll(/\b(?:href|src)="([^"#?]*)/g)) {
        const url = m[1];
        if (!url || /^(https?:|mailto:|tel:|data:|javascript:|\/\/)/.test(url)) continue;
        let target = url.startsWith('/') ? distPath(url) : path.join(path.dirname(page), url);
        if (url.endsWith('/')) target = path.join(target, 'index.html');
        if (!fs.existsSync(target)) broken.push(`${rel(page)} -> ${url}`);
      }
    }
    assert.deepEqual(broken, []);
  });

  test('every JSON-LD block on every page, and every generated data file, is valid JSON', () => {
    let count = 0;
    for (const page of pages) {
      for (const m of read(page).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
        assert.doesNotThrow(() => JSON.parse(m[1]), `bad JSON-LD in ${rel(page)}`);
        count++;
      }
    }
    assert.ok(count > 0, 'no JSON-LD found at all');
    const generated = [
      'ui-strings.json',
      'metadata.json',
      'sections/categories.json',
      ...LANGS.map((l) => `sections/recipes/recipes.${l}.json`),
      ...master.recipes.flatMap((r) => LANGS.map((l) => `sections/recipes/${r.slug}.${l}.jsonld`)),
    ];
    for (const f of generated) {
      assert.doesNotThrow(() => JSON.parse(read(path.join(DIST, f))), `bad JSON in ${f}`);
    }
  });

  test('home pages carry hreflang alternates for all four languages plus x-default', () => {
    for (const lang of LANGS) {
      const html = read(path.join(DIST, lang, 'index.html'));
      for (const target of [...LANGS, 'x-default']) {
        assert.match(html, new RegExp(`hreflang="${target}" href="[^"]+"`), `${lang} home: hreflang ${target}`);
      }
    }
  });
});

describe('recipe publish gate', () => {
  test('an unpublished language version is noindex, left out of the sitemap and of every hreflang list', () => {
    const sitemap = read(path.join(DIST, 'sitemap.xml'));
    const problems = [];
    for (const recipe of master.recipes) {
      for (const lang of LANGS) {
        const url = `/${lang}/recipes/${recipe.slug}.html`;
        const html = read(distPath(url));
        const noindex = /<meta name="robots" content="noindex">/.test(html);
        const inSitemap = sitemap.includes(`>${url}<`) || sitemap.includes(`href="${url}"`);
        if (isPublished(recipe, lang)) {
          if (noindex) problems.push(`${url} is published but noindex`);
          if (!sitemap.includes(`<loc>${url}</loc>`)) problems.push(`${url} is published but not in the sitemap`);
        } else {
          if (!noindex) problems.push(`${url} is unpublished but indexable`);
          if (inSitemap) problems.push(`${url} is unpublished but in the sitemap`);
          for (const other of LANGS) {
            const page = read(distPath(`/${other}/recipes/${recipe.slug}.html`));
            if (page.includes(`hreflang="${lang}" href="${url}"`))
              problems.push(`${other} page lists unpublished ${url} as an alternate`);
          }
        }
      }
    }
    assert.deepEqual(problems, []);
  });

  test('a published recipe page has Recipe structured data in its language; an unpublished one has none', () => {
    const problems = [];
    for (const recipe of master.recipes) {
      for (const lang of LANGS) {
        const html = read(distPath(`/${lang}/recipes/${recipe.slug}.html`));
        const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) =>
          JSON.parse(m[1]),
        );
        const recipes = blocks.filter((b) => b['@type'] === 'Recipe');
        if (isPublished(recipe, lang)) {
          if (recipes.length !== 1) problems.push(`${lang}/${recipe.slug}: ${recipes.length} Recipe blocks`);
          else if (recipes[0].name !== recipe.title[lang])
            problems.push(`${lang}/${recipe.slug}: name "${recipes[0].name}"`);
        } else if (blocks.length > 0) {
          problems.push(`${lang}/${recipe.slug}: unpublished but has structured data`);
        }
      }
    }
    assert.deepEqual(problems, []);
  });

  test("an unpublished language version does not show that language's unreviewed ingredients or steps", () => {
    const leaks = [];
    for (const recipe of master.recipes) {
      for (const lang of LANGS) {
        if (isPublished(recipe, lang)) continue;
        const html = read(distPath(`/${lang}/recipes/${recipe.slug}.html`));
        const texts = [...((recipe.ingredients || {})[lang] || []), ...((recipe.instructions || {})[lang] || [])];
        for (const t of texts) {
          if (t && t.length > 12 && html.includes(t)) leaks.push(`${lang}/${recipe.slug}: "${t.slice(0, 40)}"`);
        }
      }
    }
    assert.deepEqual(leaks, []);
  });

  test('recipes.<lang>.json marks unpublished recipes coming-soon and strips their content', () => {
    for (const lang of LANGS) {
      const data = JSON.parse(read(path.join(DIST, 'sections', 'recipes', `recipes.${lang}.json`)));
      for (const card of [...data.allRecipes, ...data.featured]) {
        const recipe = master.recipes.find((r) => r.slug === card.slug);
        assert.ok(recipe, `unknown slug ${card.slug}`);
        assert.equal(card.comingSoon, !isPublished(recipe, lang), `${lang}/${card.slug} comingSoon`);
        if (card.comingSoon) {
          assert.equal(card.cuisine, '', `${lang}/${card.slug} cuisine`);
          assert.equal(card.prepTime, '', `${lang}/${card.slug} prepTime`);
          assert.deepEqual(card.ingredients || [], [], `${lang}/${card.slug} ingredients`);
          assert.deepEqual(card.instructions || [], [], `${lang}/${card.slug} instructions`);
        }
      }
    }
  });

  test('every sitemap entry exists and is indexable', () => {
    const locs = [...read(path.join(DIST, 'sitemap.xml')).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    assert.ok(locs.length > 0);
    for (const loc of locs) {
      const file = distPath(new URL(loc, 'https://x.invalid').pathname);
      assert.ok(fs.existsSync(file), `sitemap -> missing ${loc}`);
      assert.doesNotMatch(read(file), /<meta name="robots" content="noindex">/, `sitemap lists noindex page ${loc}`);
    }
  });
});

describe('content rules from the client', () => {
  // The four certification badges were demo content and are not held. Until
  // SHOW_CERTIFICATIONS is turned on for a real, confirmed certificate, the
  // built site must not claim any certification.
  test('no certification claims on any page, in the sitemap or in the generated recipe data', () => {
    if (process.env.SHOW_CERTIFICATIONS === 'true') return;
    const claim = /\b(BRC|SQF|IFS|FSSC(?: 22000)?|HACCP|CFIA|halal|organic|biologique)\b/i;
    const targets = [
      ...pages,
      path.join(DIST, 'sitemap.xml'),
      ...LANGS.map((l) => path.join(DIST, 'sections', 'recipes', `recipes.${l}.json`)),
      ...master.recipes.flatMap((r) =>
        LANGS.map((l) => path.join(DIST, 'sections', 'recipes', `${r.slug}.${l}.jsonld`)),
      ),
    ];
    const hits = [];
    for (const f of targets) {
      const m = read(f).match(claim);
      if (m) hits.push(`${rel(f)}: ${m[0]}`);
    }
    assert.deepEqual(hits, []);
    assert.ok(!fs.existsSync(path.join(DIST, 'en', 'certifications')), 'certification pages were generated');
  });

  // Known issue, left failing on purpose: the build copies the whole
  // sections/ source folder into dist/, so files no page uses are still
  // publicly downloadable -- the old certification data (including a JSON-LD
  // file claiming "Organic"), unparseable scan-extraction files and internal
  // notes. Fixing it changes what production publishes, so it is a separate
  // decision. Marked todo so it is reported on every run without failing CI.
  test(
    'nothing under /sections is published unless the site uses it',
    { todo: 'build copies all of sections/ into dist/' },
    () => {
      const stray = files
        .map(rel)
        .filter((f) => f.startsWith('sections/'))
        .filter((f) => {
          if (f.startsWith('sections/certifications/')) return true;
          if (f.endsWith('.md')) return true;
          if (/\.(json|jsonld)$/.test(f)) {
            try {
              JSON.parse(read(path.join(DIST, f)));
            } catch {
              return true;
            }
          }
          return false;
        });
      assert.deepEqual(stray, []);
    },
  );

  test('English pages spell the product "Bulgor" in visible text ("bulgur" only in URLs and metadata)', () => {
    const hits = [];
    for (const page of pages.filter((p) => rel(p).startsWith('en/'))) {
      const m = visibleText(read(page)).match(/.{0,25}\bbulgur\b.{0,25}/i);
      if (m) hits.push(`${rel(page)}: ${m[0].trim()}`);
    }
    assert.deepEqual(hits, []);
  });

  test('Arabic and Armenian pages use Western digits (0-9), not Eastern Arabic-Indic digits', () => {
    const hits = [];
    for (const page of pages.filter((p) => /^(ar|hy)\//.test(rel(p)))) {
      if (/[٠-٩۰-۹]/.test(visibleText(read(page)))) hits.push(rel(page));
    }
    assert.deepEqual(hits, []);
  });

  test('every UI string has a non-empty value in all four languages', () => {
    const strings = JSON.parse(read(path.join(DIST, 'ui-strings.json')));
    const missing = [];
    for (const [key, values] of Object.entries(strings)) {
      for (const lang of LANGS)
        if (!values || typeof values[lang] !== 'string' || !values[lang].trim()) missing.push(`${key}.${lang}`);
    }
    assert.deepEqual(missing, []);
  });
});
