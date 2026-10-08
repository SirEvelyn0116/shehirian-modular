// Public site in a browser: the home page sections are rendered client-side
// by sections/*/render.js, so these can only be checked with JavaScript on.
const { test, expect } = require('./fixtures');

for (const lang of ['en', 'fr', 'ar', 'hy']) {
  test(`${lang} home page renders all five sections without errors`, async ({ page }) => {
    const loaded = page.waitForEvent('console', (msg) => msg.text().startsWith('✓ Loaded'));
    await page.goto(`/${lang}/index.html`);
    expect((await loaded).text()).toBe(`✓ Loaded 5/5 sections for language: ${lang}`);
    await expect(page.locator('#preview > *')).toHaveCount(5);
    await expect(page.locator('html')).toHaveAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  });
}

// Waits for preview.js to finish rendering. Navigating away earlier cancels
// its section fetches, which it reports as console errors.
async function gotoAndWaitForSections(page, action) {
  const loaded = page.waitForEvent('console', (msg) => msg.text().startsWith('✓ Loaded'));
  await action();
  await loaded;
}

test('the language switcher moves between language versions of the home page', async ({ page }) => {
  await gotoAndWaitForSections(page, () => page.goto('/en/index.html'));
  await gotoAndWaitForSections(page, () => page.locator('#language-switcher a[data-lang="fr"]').click());
  await expect(page).toHaveURL(/\/fr\/index\.html$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await gotoAndWaitForSections(page, () => page.locator('#language-switcher a[data-lang="ar"]').click());
  await expect(page).toHaveURL(/\/ar\/index\.html$/);
  await expect(page.locator('body')).toHaveAttribute('dir', 'rtl');
});

test('a recipe card on the English recipe index opens the recipe page', async ({ page }) => {
  await page.goto('/en/recipes/index.html');
  const card = page.locator('a.recipe-card:not(.recipe-card-coming-soon)').first();
  const href = await card.getAttribute('href');
  await card.click();
  await expect.poll(() => new URL(page.url()).pathname).toBe(href);
  await expect(page.locator('h1')).not.toBeEmpty();
  expect(await page.locator('ul li, ol li').count()).toBeGreaterThan(2);
});
