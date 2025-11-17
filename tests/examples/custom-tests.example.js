// Example: Running a single focused test during development
// tests/e2e/multilingual.spec.js

const { test, expect } = require('@playwright/test');

// Quick smoke test - runs fast for rapid development
test.describe('Smoke Tests', () => {
  
  test('quick health check - EN page loads', async ({ page }) => {
    const response = await page.goto('https://sirevelyn0116.github.io/shehirian-modular/index.en.html');
    expect(response.status()).toBe(200);
    
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('#preview')).toBeVisible();
  });
});

// Example: Custom test for specific feature
test.describe('Custom Feature Tests', () => {
  
  test('verify recipe images load', async ({ page }) => {
    await page.goto('https://sirevelyn0116.github.io/shehirian-modular/index.en.html');
    await page.waitForLoadState('networkidle');
    
    const recipeSection = page.locator('section.recipes, .recipes');
    await expect(recipeSection).toBeVisible();
    
    // Check for images within recipe section
    const images = recipeSection.locator('img');
    const count = await images.count();
    
    // Should have at least one recipe image
    expect(count).toBeGreaterThan(0);
    
    // Verify first image loaded
    if (count > 0) {
      const firstImg = images.first();
      const naturalWidth = await firstImg.evaluate(img => img.naturalWidth);
      expect(naturalWidth).toBeGreaterThan(0);
    }
  });
  
  test('verify contact form fields', async ({ page }) => {
    await page.goto('https://sirevelyn0116.github.io/shehirian-modular/index.en.html');
    await page.waitForLoadState('networkidle');
    
    const contactForm = page.locator('form.contact-form, .contact-form');
    await expect(contactForm).toBeVisible();
    
    // Check required fields exist
    await expect(contactForm.locator('input[name="name"]')).toBeVisible();
    await expect(contactForm.locator('input[name="email"]')).toBeVisible();
    await expect(contactForm.locator('textarea[name="message"]')).toBeVisible();
    await expect(contactForm.locator('button[type="submit"]')).toBeVisible();
  });
  
  test('verify certification badges render', async ({ page }) => {
    await page.goto('https://sirevelyn0116.github.io/shehirian-modular/index.en.html');
    await page.waitForLoadState('networkidle');
    
    const certSection = page.locator('section.certifications, .certifications');
    await expect(certSection).toBeVisible();
    
    // Should have certification items
    const certItems = certSection.locator('.cert-item, .cert-badge, .certification-item');
    const count = await certItems.count();
    expect(count).toBeGreaterThan(0);
  });
});

// Example: Visual regression testing (requires @playwright/test with screenshots)
test.describe('Visual Regression', () => {
  
  test('homepage screenshot comparison', async ({ page }) => {
    await page.goto('https://sirevelyn0116.github.io/shehirian-modular/index.en.html');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot and compare with baseline
    await expect(page).toHaveScreenshot('homepage-en.png', {
      fullPage: true,
      maxDiffPixels: 100  // Allow minor differences
    });
  });
});

// Example: API/Data testing
test.describe('Data Integrity', () => {
  
  test('JSON files are accessible', async ({ request }) => {
    const files = [
      'sections/hero/hero.en.json',
      'sections/aboutUs/aboutUs.en.json',
      'sections/recipes/recipes.en.json'
    ];
    
    for (const file of files) {
      const response = await request.get(`https://sirevelyn0116.github.io/shehirian-modular/${file}`);
      expect(response.status()).toBe(200);
      
      const json = await response.json();
      expect(json).toBeTruthy();
    }
  });
});
