const { test, expect } = require('@playwright/test');

// Configuration
const BASE_URL = process.env.BASE_URL || 'https://sirevelyn0116.github.io/shehirian-modular';
const homePageUrl = lang => `${BASE_URL}/${lang}/index.html`;
const recipeIndexUrl = lang => `${BASE_URL}/${lang}/recipes/index.html`;
const productPageUrl = (lang, brand) => `${BASE_URL}/${lang}/products/${brand}.html`;
const certificationPageUrl = (lang, certification) => `${BASE_URL}/${lang}/certifications/${certification}.html`;

// Expected localized content
const LOCALIZED_CONTENT = {
  en: {
    lang: 'en',
    title: 'Shehirian Bulgor Inc',
    dir: 'ltr',
    sections: {
      hero: { selector: '#home, .home', textIncludes: '' },
      aboutUs: { selector: 'section#about-us', textIncludes: 'Family owned' },
      ourCompanies: { selector: '#products-carousel, .companies-section', textIncludes: '' },
      recipes: { selector: '#recipes, .section-recipes', textIncludes: '' },
      certifications: { selector: '#certifications, .certifications-section', textIncludes: '' },
      contactUs: { selector: 'section#contact, section.contact-section, .contact-section', textIncludes: '' }
    }
  },
  fr: {
    lang: 'fr',
    title: 'Shehirian Bulgor Inc',
    dir: 'ltr',
    sections: {
      hero: { selector: '#home, .home', textIncludes: '' },
      aboutUs: { selector: 'section#about-us', textIncludes: 'familiale depuis 1958' },
      ourCompanies: { selector: '#products-carousel, .companies-section', textIncludes: '' },
      recipes: { selector: '#recipes, .section-recipes', textIncludes: '' },
      certifications: { selector: '#certifications, .certifications-section', textIncludes: '' },
      contactUs: { selector: 'section#contact, section.contact-section, .contact-section', textIncludes: '' }
    }
  },
  ar: {
    lang: 'ar',
    title: 'Shehirian Bulgor Inc',
    dir: 'rtl',
    sections: {
      hero: { selector: '#home, .home', textIncludes: '' },
      aboutUs: { selector: 'section#about-us', textIncludes: 'عائلياً منذ 1958' },
      ourCompanies: { selector: '#products-carousel, .companies-section', textIncludes: '' },
      recipes: { selector: '#recipes, .section-recipes', textIncludes: '' },
      certifications: { selector: '#certifications, .certifications-section', textIncludes: '' },
      contactUs: { selector: 'section#contact, section.contact-section, .contact-section', textIncludes: '' }
    }
  },
  hy: {
    lang: 'hy',
    title: 'Shehirian Bulgor Inc',
    dir: 'ltr',
    sections: {
      hero: { selector: '#home, .home', textIncludes: '' },
      aboutUs: { selector: 'section#about-us', textIncludes: '' },
      ourCompanies: { selector: '#products-carousel, .companies-section', textIncludes: '' },
      recipes: { selector: '#recipes, .section-recipes', textIncludes: '' },
      certifications: { selector: '#certifications, .certifications-section', textIncludes: '' },
      contactUs: { selector: 'section#contact, section.contact-section, .contact-section', textIncludes: '' }
    }
  }
};

function assertJsonLdPayloads(content) {
  const payload = JSON.parse(content);
  const entries = Array.isArray(payload) ? payload : [payload];

  for (const entry of entries) {
    expect(entry['@context']).toBe('https://schema.org');
    expect(entry['@type']).toBeDefined();
  }
}

const LANGUAGES = ['en', 'fr', 'ar', 'hy'];

/**
 * Wait for both localStorage 'lang' key and html[lang] attribute to match
 * the expected language code before proceeding. Uses polling with a
 * 10-second timeout to handle async client-side hydration.
 */
async function expectLanguageApplied(page, lang) {
  await expect(async () => {
    const htmlLang = await page.getAttribute('html', 'lang');
    expect(htmlLang).toBe(lang);
    const storedLang = await page.evaluate(() => localStorage.getItem('lang'));
    expect(storedLang).toBe(lang);
  }).toPass({ timeout: 10_000 });
}

test.describe('Multilingual Static Site - E2E Tests', () => {
  
  test.describe.configure({ mode: 'parallel' });

  // Test each language page
  LANGUAGES.forEach(lang => {
    test.describe(`Language: ${lang.toUpperCase()}`, () => {
      
      test(`should load index.${lang}.html successfully`, async ({ page }) => {
        const response = await page.goto(homePageUrl(lang));
        expect(response.status()).toBe(200);
      });

      test(`should have correct HTML lang attribute (${lang})`, async ({ page }) => {
        await page.goto(homePageUrl(lang));
        const htmlLang = await page.locator('html').getAttribute('lang');
        expect(htmlLang).toBe(lang);
      });

      test(`should have correct title (${lang})`, async ({ page }) => {
        await page.goto(homePageUrl(lang));
        const title = await page.title();
        expect(title).toBe(LOCALIZED_CONTENT[lang].title);
      });

      test(`should have correct dir attribute (${lang})`, async ({ page }) => {
        await page.goto(homePageUrl(lang));
        const bodyDir = await page.locator('body').getAttribute('dir');
        expect(bodyDir).toBe(LOCALIZED_CONTENT[lang].dir);
      });

      test(`should have JSON-LD scripts present and parseable (${lang})`, async ({ page }) => {
        await page.goto(homePageUrl(lang));
        
        // Wait for page to fully load
        await page.waitForLoadState('networkidle');
        
        const jsonLdScripts = await page.locator('script[type="application/ld+json"]').all();
        
        // Should have at least one JSON-LD script
        expect(jsonLdScripts.length).toBeGreaterThan(0);
        
        // Verify each JSON-LD script is valid JSON
        for (const script of jsonLdScripts) {
          const content = await script.textContent();
          expect(() => JSON.parse(content)).not.toThrow();

          assertJsonLdPayloads(content);
        }
      });

      test(`should have language switcher links (${lang})`, async ({ page }) => {
        await page.goto(homePageUrl(lang));
        
        const enLink = page.locator('a[href$="/en/index.html"]').first();
        const frLink = page.locator('a[href$="/fr/index.html"]').first();
        const arLink = page.locator('a[href$="/ar/index.html"]').first();
        
        await expect(enLink).toBeVisible();
        await expect(frLink).toBeVisible();
        await expect(arLink).toBeVisible();
      });

      test(`should set localStorage.lang correctly (${lang})`, async ({ page }) => {
        await page.goto(homePageUrl(lang));
        
        // Wait for page to load and execute scripts
        await page.waitForLoadState('networkidle');
        
        const storedLang = await page.evaluate(() => localStorage.getItem('lang'));
        expect(storedLang).toBe(lang);
      });

      test(`should have all required sections rendered (${lang})`, async ({ page }) => {
        await page.goto(homePageUrl(lang));
        
        // Wait for preview container to be populated
        await page.waitForSelector('#preview', { state: 'attached' });
        await page.waitForLoadState('networkidle');
        
        // Small delay to allow dynamic content to render
        await page.waitForTimeout(1000);
        
        const config = LOCALIZED_CONTENT[lang].sections;
        
        for (const [sectionName, sectionConfig] of Object.entries(config)) {
          const section = page.locator(sectionConfig.selector).first();
          
          // Check if section exists
          await expect(section).toBeVisible({
            timeout: 5000
          }).catch(() => {
            throw new Error(`Section "${sectionName}" not found with selector: ${sectionConfig.selector}`);
          });
          
          // Check for localized content if specified
          if (sectionConfig.textIncludes) {
            const text = await section.textContent();
            expect(text).toContain(sectionConfig.textIncludes);
          }
        }
      });

      test(`should load without console errors (${lang})`, async ({ page }) => {
        const consoleErrors = [];
        
        page.on('console', msg => {
          if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
          }
        });
        
        page.on('pageerror', error => {
          consoleErrors.push(error.message);
        });
        
        await page.goto(homePageUrl(lang));
        await page.waitForLoadState('networkidle');
        
        // Filter out known acceptable errors (e.g., favicon 404s)
        const criticalErrors = consoleErrors.filter(err => 
          !err.includes('favicon') && 
          !err.includes('Failed to load resource')
        );
        
        expect(criticalErrors).toHaveLength(0);
      });
    });
  });

  test.describe('Language Switcher Navigation', () => {
    
    test('should navigate from EN to FR to AR and back', async ({ page }) => {
      // Start on English page
      await page.goto(homePageUrl('en'));
      await expectLanguageApplied(page, 'en');
      
      // Click French link
      await page.click('a[href$="/fr/index.html"]');
      await page.waitForURL(/\/fr\/index\.html/);
      await page.waitForLoadState('domcontentloaded');
      await expectLanguageApplied(page, 'fr');
      
      // Click Arabic link
      await page.click('a[href$="/ar/index.html"]');
      await page.waitForURL(/\/ar\/index\.html/);
      await page.waitForLoadState('domcontentloaded');
      await expectLanguageApplied(page, 'ar');
      await expect(page.locator('body')).toHaveAttribute('dir', 'rtl');
      
      // Click English link to return
      await page.click('a[href$="/en/index.html"]');
      await page.waitForURL(/\/en\/index\.html/);
      await page.waitForLoadState('domcontentloaded');
      await expectLanguageApplied(page, 'en');
      await expect(page.locator('body')).toHaveAttribute('dir', 'ltr');
    });

    test('should switch between all languages from EN page', async ({ page }) => {
      await page.goto(homePageUrl('en'));
      
      for (const targetLang of LANGUAGES) {
        // Click language switcher
        await page.click(`a[href$="/${targetLang}/index.html"]`);
        await page.waitForURL(new RegExp(`/${targetLang}/index\\.html`));
        await page.waitForLoadState('domcontentloaded');
        
        // Verify navigation and localStorage
        await expectLanguageApplied(page, targetLang);
        const title = await page.title();
        expect(title).toBe(LOCALIZED_CONTENT[targetLang].title);
        
        // Return to EN for next iteration
        if (targetLang !== 'en') {
          await page.click('a[href$="/en/index.html"]');
          await page.waitForURL(/\/en\/index\.html/);
          await page.waitForLoadState('domcontentloaded');
          await expectLanguageApplied(page, 'en');
        }
      }
    });
  });

  test.describe('Content Verification', () => {
    
    test('should display different content for each language', async ({ page }) => {
      const contentByLang = {};
      
      for (const lang of LANGUAGES) {
        await page.goto(homePageUrl(lang));
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);
        
        // Get aboutUs section content
        const aboutUsSelector = LOCALIZED_CONTENT[lang].sections.aboutUs.selector;
        const aboutUsContent = await page.locator(aboutUsSelector).first().textContent();
        contentByLang[lang] = aboutUsContent;
      }
      
      // Verify each language has unique content
      expect(contentByLang.en).not.toBe(contentByLang.fr);
      expect(contentByLang.en).not.toBe(contentByLang.ar);
      expect(contentByLang.fr).not.toBe(contentByLang.ar);
    });

    test('should have hreflang links for SEO', async ({ page }) => {
      await page.goto(homePageUrl('en'));
      
      const hreflangLinks = await page.locator('link[rel="alternate"][hreflang]').all();
      
      // Should have at least 4 hreflang links (en, fr, ar, x-default)
      expect(hreflangLinks.length).toBeGreaterThanOrEqual(4);
      
      // Verify x-default exists
      const xDefaultLink = await page.locator('link[hreflang="x-default"]').getAttribute('href');
      expect(xDefaultLink).toContain('/en/index.html');
      
      // Verify all language links exist (including Armenian)
      for (const lang of LANGUAGES) {
        const langLink = await page.locator(`link[hreflang="${lang}"]`).getAttribute('href');
        expect(langLink).toContain(`/${lang}/index.html`);
      }
    });
  });

  test.describe('Recipe Pages', () => {
    
    test('should load all-recipes page for each language', async ({ page }) => {
      for (const lang of LANGUAGES) {
        const response = await page.goto(recipeIndexUrl(lang));
        expect(response.status()).toBe(200);
        
        const htmlLang = await page.locator('html').getAttribute('lang');
        expect(htmlLang).toBe(lang);
      }
    });

    test('should have translated category headings on all-recipes pages', async ({ page }) => {
      // English
      await page.goto(recipeIndexUrl('en'));
      await page.waitForLoadState('networkidle');
      const enHeading = await page.locator('.recipes-category-heading').first().textContent();
      
      // French
      await page.goto(recipeIndexUrl('fr'));
      await page.waitForLoadState('networkidle');
      const frHeading = await page.locator('.recipes-category-heading').first().textContent();
      
      // Armenian
      await page.goto(recipeIndexUrl('hy'));
      await page.waitForLoadState('networkidle');
      const hyHeading = await page.locator('.recipes-category-heading').first().textContent();
      
      // Verify different translations
      expect(enHeading).not.toBe(frHeading);
      expect(enHeading).not.toBe(hyHeading);
      expect(frHeading).not.toBe(hyHeading);
    });

    test('should have recipe cards with all metadata', async ({ page }) => {
      await page.goto(recipeIndexUrl('en'));
      await page.waitForLoadState('networkidle');
      
      const firstCard = page.locator('.recipe-card').first();
      await expect(firstCard).toBeVisible();
      
      // Check for recipe title
      const title = firstCard.locator('h3');
      await expect(title).toBeVisible();
      
      // Check for metadata (category, cuisine, prep time, etc.)
      const meta = firstCard.locator('.recipe-meta-info');
      await expect(meta).toBeVisible();
    });

    test('should have clickable recipe cards linking to individual pages', async ({ page }) => {
      await page.goto(recipeIndexUrl('en'));
      await page.waitForLoadState('networkidle');
      
      const firstCard = page.locator('.recipe-card').first();
      const href = await firstCard.getAttribute('href');
      
      expect(href).toBeTruthy();
      expect(href).toMatch(/\/en\/recipes\/.+\.html$/);
    });

    test('should have language switcher on recipe pages', async ({ page }) => {
      await page.goto(recipeIndexUrl('en'));
      await page.waitForLoadState('networkidle');
      
      // Should have links to all languages including Armenian
      for (const lang of LANGUAGES) {
        const langLink = page.locator(`a[href$="/${lang}/recipes/index.html"]`);
        await expect(langLink).toBeVisible();
      }
    });
  });

  test.describe('Product Pages', () => {

    ['shirag', 'mr-falafel'].forEach(brand => {
      test(`should load ${brand} product pages for all languages`, async ({ page }) => {
        for (const lang of LANGUAGES) {
          const response = await page.goto(productPageUrl(lang, brand));
          expect(response.status()).toBe(200);

          await expect(page.locator('.product-card').first()).toBeVisible();
          await expect(page.locator('#language-switcher')).toBeVisible();
        }
      });
    });

    test('should link from home page product cards to language-scoped product pages', async ({ page }) => {
      await page.goto(homePageUrl('en'));
      await page.waitForLoadState('networkidle');

      const firstCompanyCard = page.locator('.company-card').first();
      await expect(firstCompanyCard).toHaveAttribute('href', /\/en\/products\/.+\.html$/);
    });
  });

  test.describe('Certification Pages', () => {

    ['brc', 'sqf', 'fssc-22000', 'ifs'].forEach(certification => {
      test(`should load ${certification} certification pages for all languages`, async ({ page }) => {
        for (const lang of LANGUAGES) {
          const response = await page.goto(certificationPageUrl(lang, certification));
          expect(response.status()).toBe(200);

          await expect(page.locator('.cert-page').first()).toBeVisible();
          await expect(page.locator('#language-switcher')).toBeVisible();
        }
      });
    });

    test('should link from home page certification cards to language-scoped certification pages', async ({ page }) => {
      await page.goto(homePageUrl('en'));
      await page.waitForLoadState('networkidle');

      const firstCertificationCard = page.locator('.cert-badge').first();
      await expect(firstCertificationCard).toHaveAttribute('href', /\/en\/certifications\/.+\.html$/);
    });
  });

  test.describe('Armenian Language Specific Tests', () => {
    
    test('should have Armenian (HY) in language switcher on index page', async ({ page }) => {
      await page.goto(homePageUrl('en'));
      const hyLink = page.locator('a[href$="/hy/index.html"]').first();
      await expect(hyLink).toBeVisible();
    });

    test('should display Armenian content correctly', async ({ page }) => {
      await page.goto(homePageUrl('hy'));
      await page.waitForLoadState('networkidle');
      
      // Verify Armenian characters are rendered (Unicode range for Armenian is U+0530-U+058F)
      const bodyText = await page.locator('body').textContent();
      const hasArmenian = /[\u0530-\u058F]/.test(bodyText);
      expect(hasArmenian).toBeTruthy();
    });

    test('should have Armenian recipes with proper translations', async ({ page }) => {
      await page.goto(recipeIndexUrl('hy'));
      await page.waitForLoadState('networkidle');
      
      const recipeCard = page.locator('.recipe-card').first();
      const cardText = await recipeCard.textContent();
      
      // Should contain Armenian characters
      const hasArmenian = /[\u0530-\u058F]/.test(cardText);
      expect(hasArmenian).toBeTruthy();
      
      // Should NOT contain untranslated English words mixed in (basic check)
      // Note: Some English words like brand names are acceptable
      const title = await recipeCard.locator('h3').textContent();
      const hasArmenianTitle = /[\u0530-\u058F]/.test(title);
      expect(hasArmenianTitle).toBeTruthy();
    });

    test('should have Armenian category translations', async ({ page }) => {
      await page.goto(recipeIndexUrl('hy'));
      await page.waitForLoadState('networkidle');
      
      const categoryHeading = await page.locator('.recipes-category-heading').first().textContent();
      
      // Should be in Armenian (contains Armenian characters)
      const hasArmenian = /[\u0530-\u058F]/.test(categoryHeading);
      expect(hasArmenian).toBeTruthy();
      
      // Should NOT be English category names
      expect(categoryHeading).not.toBe('Soup');
      expect(categoryHeading).not.toBe('Salad');
      expect(categoryHeading).not.toBe('Dessert');
    });

    test('should navigate between languages including Armenian', async ({ page }) => {
      // Start from English
      await page.goto(homePageUrl('en'));
      await expectLanguageApplied(page, 'en');
      
      // Navigate to Armenian
      await page.click('a[href$="/hy/index.html"]');
      await page.waitForURL(/\/hy\/index\.html/);
      await page.waitForLoadState('domcontentloaded');
      await expectLanguageApplied(page, 'hy');
      
      // Navigate back to English
      await page.click('a[href$="/en/index.html"]');
      await page.waitForURL(/\/en\/index\.html/);
      await page.waitForLoadState('domcontentloaded');
      await expectLanguageApplied(page, 'en');
    });
      await expectLanguageApplied(page, 'en');
    });

    test('should have Armenian locale for time formatting', async ({ page }) => {
      await page.goto(recipeIndexUrl('hy'));
      await page.waitForLoadState('networkidle');
      
      const metaInfo = await page.locator('.recipe-meta-info').first().textContent();
      
      // Check for Armenian time unit (րոպե = minutes, ժամ = hour)
      const hasArmenianTime = /րոպե|ժամ/.test(metaInfo);
      expect(hasArmenianTime).toBeTruthy();
    });
  });

  test.describe('Content Integrity', () => {
    
    test('should not have mixed language content in recipes', async ({ page }) => {
      for (const lang of LANGUAGES) {
        await page.goto(recipeIndexUrl(lang));
        await page.waitForLoadState('networkidle');
        
        const firstRecipeCard = page.locator('.recipe-card').first();
        const title = await firstRecipeCard.locator('h3').textContent();
        const description = await firstRecipeCard.locator('.recipe-description').textContent();
        
        // Basic validation: titles and descriptions should not be empty
        expect(title.trim().length).toBeGreaterThan(0);
        expect(description.trim().length).toBeGreaterThan(0);
        
        // For Armenian, verify Armenian characters are present
        if (lang === 'hy') {
          const hasArmenianInTitle = /[\u0530-\u058F]/.test(title);
          const hasArmenianInDesc = /[\u0530-\u058F]/.test(description);
          expect(hasArmenianInTitle || hasArmenianInDesc).toBeTruthy();
        }
      }
    });

    test('should have consistent recipe counts across languages', async ({ page }) => {
      const recipeCounts = {};
      
      for (const lang of LANGUAGES) {
        await page.goto(recipeIndexUrl(lang));
        await page.waitForLoadState('networkidle');
        
        const cards = await page.locator('.recipe-card').count();
        recipeCounts[lang] = cards;
      }
      
      // All languages should have the same number of recipes
      const counts = Object.values(recipeCounts);
      const firstCount = counts[0];
      
      for (const count of counts) {
        expect(count).toBe(firstCount);
      }
      
      // Should have at least 40 recipes (we know there are 44)
      expect(firstCount).toBeGreaterThanOrEqual(40);
    });

    test('should have valid JSON-LD in all languages', async ({ page }) => {
      for (const lang of LANGUAGES) {
        await page.goto(homePageUrl(lang));
        await page.waitForLoadState('networkidle');
        
        const jsonLdScripts = await page.locator('script[type="application/ld+json"]').all();
        expect(jsonLdScripts.length).toBeGreaterThan(0);
        
        for (const script of jsonLdScripts) {
          const content = await script.textContent();
          assertJsonLdPayloads(content);
        }
      }
    });
  });

  test.describe('Responsive Design & Accessibility', () => {
    
    test('should be mobile-friendly (viewport test)', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(homePageUrl('en'));
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      
      // Verify language switcher is accessible (either visible or in DOM)
      const languageSwitcher = page.locator('#language-switcher').first();
      const switcherExists = await languageSwitcher.count() > 0;
      expect(switcherExists).toBeTruthy();
      
      // Verify sections render
      const preview = page.locator('#preview');
      await expect(preview).toBeVisible();
    });

    test('should have accessible language switcher', async ({ page }) => {
      await page.goto(homePageUrl('en'));
      await page.waitForLoadState('networkidle');
      
      // Check that language switcher exists in DOM
      const switcher = page.locator('#language-switcher');
      await expect(switcher).toBeAttached();
      
      // Check that language links are keyboard accessible
      const enLink = page.locator('#language-switcher a[href$="/en/index.html"]').first();
      await expect(enLink).toBeAttached();
      await enLink.focus();
      
      const focused = await page.evaluate(() => document.activeElement.tagName);
      expect(focused).toBe('A');
    });
  });

  test.describe('Performance & Loading', () => {
    
    test('should load page within acceptable time', async ({ page }) => {
      const startTime = Date.now();
      await page.goto(homePageUrl('en'));
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      // Page should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test('should have all sections load (no missing render functions)', async ({ page }) => {
      const consoleLogs = [];
      
      page.on('console', msg => {
        if (msg.type() === 'log') {
          consoleLogs.push(msg.text());
        }
      });
      
      await page.goto(homePageUrl('en'));
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500); // Give time for sections to render and log
      
      // Check for the success message from preview.js
      const successLog = consoleLogs.find(log => log.includes('Loaded') && log.includes('sections'));
      
      // If console log not found, verify sections are actually rendered instead
      if (!successLog) {
        const sections = await page.locator('#preview > section').count();
        expect(sections).toBeGreaterThanOrEqual(6);
      } else {
        // Should show 6/6 sections loaded
        expect(successLog).toMatch(/6\/6/);
      }
    });
  });
});
