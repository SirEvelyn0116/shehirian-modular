// Role routing. Self-detects whichever stub role is currently active (by
// reading the dashboard heading's role badge, added in the Phase 4 polish
// pass) and asserts the behavior appropriate to it — so this same file is
// runnable against any of the three `npm run dev:auth-stub*` variants.
// Run it three times, once per variant, for full coverage of all three
// behavioral-matrix rows; a single run only ever sees one configuration,
// since the stub can't present more than one role set at a time on the
// same port. See TESTING.md for the full matrix and which rows this
// covers.
//
// IMPORTANT — scope: this tests ROLE-BASED UI ROUTING against the STUBBED
// identity (scripts/stub-identity.js: a hand-built clientContext.user, no
// real Netlify Identity JWT involved at all). It does NOT test JWT
// signature/expiry validation, or whether a real Identity account's roles
// actually land where the app expects them — that boundary is untested
// here by design and stays a manual/post-deploy check (LOCAL_DEV.md §4).

const { test, expect } = require('@playwright/test');

test.describe('Recipes role routing', () => {
  test('routes correctly for whichever stub role is active', async ({ page }) => {
    await page.goto('/admin/');
    await page.waitForSelector('.recipe-picker-list, .recipe-approval-view, .recipes-loading', { timeout: 10000 });

    const heading = await page.locator('#dashboard-heading').textContent();
    const hasTranslateTab = await page.locator('.view-tab:has-text("Translate")').count() > 0;
    const hasReviewTab = await page.locator('.view-tab:has-text("Review")').count() > 0;

    if (heading.includes('Translator & Approver')) {
      // Dual role: mode toggle appears, both flows reachable.
      expect(hasTranslateTab).toBe(true);
      expect(hasReviewTab).toBe(true);
    } else if (heading.includes('Approver view')) {
      // Approver-only: since the published-flag admin toggle (recipes
      // stage 3), GET /api/recipes is shared by both roles (approvers need
      // it too, to see and flip per-language publish status) — so a mode
      // toggle now appears here too, same as the dual-role case, just
      // labeled "Publish" instead of "Translate" (there's nothing to
      // translate for this role) and defaulting to that list rather than
      // Review. GET /api/recipes/:slug (the full replica editor) still
      // requires the translator role — RecipeList only wires up row-click
      // navigation when isTranslator, so there's still no dead end, just
      // no navigation into a recipe from here.
      expect(hasTranslateTab).toBe(false);
      const hasPublishTab = await page.locator('.view-tab:has-text("Publish")').count() > 0;
      expect(hasPublishTab).toBe(true);
      expect(hasReviewTab).toBe(true);
      await expect(page.locator('.recipe-picker-list')).toBeVisible();
      await expect(page.locator('.recipes-error')).toHaveCount(0);
    } else if (heading.includes('Translator view')) {
      // Translator-only: byte-identical to pre-Phase-4 behavior — no
      // toggle, picker shown directly.
      expect(hasTranslateTab).toBe(false);
      expect(hasReviewTab).toBe(false);
      await expect(page.locator('.recipe-picker-list')).toBeVisible();
    } else {
      throw new Error(`Unexpected dashboard heading — role badge missing or unrecognized: "${heading}"`);
    }
  });
});
