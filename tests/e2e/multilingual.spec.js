const { test, expect } = require('@playwright/test');

// Configuration
const BASE_URL = process.env.BASE_URL || 'https://sirevelyn0116.github.io/shehirian-modular';

// Expected localized content
const LOCALIZED_CONTENT = {
  en: {
    lang: 'en',
    title: 'Shehirian Family Kitchen',
    dir: 'ltr',
    sections: {
      hero: { selector: 'section.hero, .hero', textIncludes: '' },
      aboutUs: { selector: 'section#about-us, section.about-us, .about-us', textIncludes: 'Family owned' },
      ourCompanies: { selector: 'section.our-companies, .our-companies', textIncludes: '' },
      recipes: { selector: 'section.recipes, .recipes', textIncludes: '' },
      certifications: { selector: 'section.certifications, .certifications', textIncludes: '' },
      contactUs: { selector: 'section#contact, section.contact-section, .contact-section', textIncludes: '' }
    }
  },
  fr: {
    lang: 'fr',
    title: 'Cuisine familiale Shehirian',
    dir: 'ltr',
    sections: {
      hero: { selector: 'section.hero, .hero', textIncludes: '' },
      aboutUs: { selector: 'section#about-us, section.about-us, .about-us', textIncludes: 'familiale depuis 1958' },
      ourCompanies: { selector: 'section.our-companies, .our-companies', textIncludes: '' },
      recipes: { selector: 'section.recipes, .recipes', textIncludes: '' },
      certifications: { selector: 'section.certifications, .certifications', textIncludes: '' },
      contactUs: { selector: 'section#contact, section.contact-section, .contact-section', textIncludes: '' }
    }
  },
  ar: {
    lang: 'ar',
    title: 'مطبخ عائلة شيهريان',
    dir: 'rtl',
    sections: {
      hero: { selector: 'section.hero, .hero', textIncludes: '' },
      aboutUs: { selector: 'section#about-us, section.about-us, .about-us', textIncludes: 'عائلياً منذ 1958' },
      ourCompanies: { selector: 'section.our-companies, .our-companies', textIncludes: '' },
      recipes: { selector: 'section.recipes, .recipes', textIncludes: '' },
      certifications: { selector: 'section.certifications, .certifications', textIncludes: '' },
      contactUs: { selector: 'section#contact, section.contact-section, .contact-section', textIncludes: '' }
    }
  }
};

const LANGUAGES = ['en', 'fr', 'ar'];

test.describe('Multilingual Static Site - E2E Tests', () => {
  
  test.describe.configure({ mode: 'parallel' });

  // Test each language page
  LANGUAGES.forEach(lang => {
    test.describe(`Language: ${lang.toUpperCase()}`, () => {
      
      test(`should load index.${lang}.html successfully`, async ({ page }) => {
        const response = await page.goto(`${BASE_URL}/index.${lang}.html`);
        expect(response.status()).toBe(200);
      });

      test(`should have correct HTML lang attribute (${lang})`, async ({ page }) => {
        await page.goto(`${BASE_URL}/index.${lang}.html`);
        const htmlLang = await page.locator('html').getAttribute('lang');
        expect(htmlLang).toBe(lang);
      });

      test(`should have correct title (${lang})`, async ({ page }) => {
        await page.goto(`${BASE_URL}/index.${lang}.html`);
        const title = await page.title();
        expect(title).toBe(LOCALIZED_CONTENT[lang].title);
      });

      test(`should have correct dir attribute (${lang})`, async ({ page }) => {
        await page.goto(`${BASE_URL}/index.${lang}.html`);
        const bodyDir = await page.locator('body').getAttribute('dir');
        expect(bodyDir).toBe(LOCALIZED_CONTENT[lang].dir);
      });

      test(`should have JSON-LD scripts present and parseable (${lang})`, async ({ page }) => {
        await page.goto(`${BASE_URL}/index.${lang}.html`);
        
        // Wait for page to fully load
        await page.waitForLoadState('networkidle');
        
        const jsonLdScripts = await page.locator('script[type="application/ld+json"]').all();
        
        // Should have at least one JSON-LD script
        expect(jsonLdScripts.length).toBeGreaterThan(0);
        
        // Verify each JSON-LD script is valid JSON
        for (const script of jsonLdScripts) {
          const content = await script.textContent();
          expect(() => JSON.parse(content)).not.toThrow();
          
          const jsonData = JSON.parse(content);
          expect(jsonData['@context']).toBe('https://schema.org');
          expect(jsonData['@type']).toBeDefined();
        }
      });

      test(`should have language switcher links (${lang})`, async ({ page }) => {
        await page.goto(`${BASE_URL}/index.${lang}.html`);
        
        const enLink = page.locator('a[href*="index.en.html"]').first();
        const frLink = page.locator('a[href*="index.fr.html"]').first();
        const arLink = page.locator('a[href*="index.ar.html"]').first();
        
        await expect(enLink).toBeVisible();
        await expect(frLink).toBeVisible();
        await expect(arLink).toBeVisible();
      });

      test(`should set localStorage.lang correctly (${lang})`, async ({ page }) => {
        await page.goto(`${BASE_URL}/index.${lang}.html`);
        
        // Wait for page to load and execute scripts
        await page.waitForLoadState('networkidle');
        
        const storedLang = await page.evaluate(() => localStorage.getItem('lang'));
        expect(storedLang).toBe(lang);
      });

      test(`should have all required sections rendered (${lang})`, async ({ page }) => {
        await page.goto(`${BASE_URL}/index.${lang}.html`);
        
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
        
        await page.goto(`${BASE_URL}/index.${lang}.html`);
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
      await page.goto(`${BASE_URL}/index.en.html`);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      
      // Click French link
      await page.click('a[href*="index.fr.html"]');
      await page.waitForURL(/index\.fr\.html/);
      await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
      
      // Click Arabic link
      await page.click('a[href*="index.ar.html"]');
      await page.waitForURL(/index\.ar\.html/);
      await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
      await expect(page.locator('body')).toHaveAttribute('dir', 'rtl');
      
      // Click English link to return
      await page.click('a[href*="index.en.html"]');
      await page.waitForURL(/index\.en\.html/);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.locator('body')).toHaveAttribute('dir', 'ltr');
    });

    test('should switch between all languages from EN page', async ({ page }) => {
      await page.goto(`${BASE_URL}/index.en.html`);
      
      for (const targetLang of LANGUAGES) {
        // Click language switcher
        await page.click(`a[href*="index.${targetLang}.html"]`);
        await page.waitForURL(new RegExp(`index\\.${targetLang}\\.html`));
        
        // Verify navigation
        await expect(page.locator('html')).toHaveAttribute('lang', targetLang);
        const title = await page.title();
        expect(title).toBe(LOCALIZED_CONTENT[targetLang].title);
        
        // Verify localStorage updated
        const storedLang = await page.evaluate(() => localStorage.getItem('lang'));
        expect(storedLang).toBe(targetLang);
        
        // Return to EN for next iteration
        if (targetLang !== 'en') {
          await page.click('a[href*="index.en.html"]');
          await page.waitForURL(/index\.en\.html/);
        }
      }
    });
  });

  test.describe('Content Verification', () => {
    
    test('should display different content for each language', async ({ page }) => {
      const contentByLang = {};
      
      for (const lang of LANGUAGES) {
        await page.goto(`${BASE_URL}/index.${lang}.html`);
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
      await page.goto(`${BASE_URL}/index.en.html`);
      
      const hreflangLinks = await page.locator('link[rel="alternate"][hreflang]').all();
      
      // Should have at least 4 hreflang links (en, fr, ar, x-default)
      expect(hreflangLinks.length).toBeGreaterThanOrEqual(4);
      
      // Verify x-default exists
      const xDefaultLink = await page.locator('link[hreflang="x-default"]').getAttribute('href');
      expect(xDefaultLink).toContain('index.en.html');
      
      // Verify all language links exist
      for (const lang of LANGUAGES) {
        const langLink = await page.locator(`link[hreflang="${lang}"]`).getAttribute('href');
        expect(langLink).toContain(`index.${lang}.html`);
      }
    });
  });

  test.describe('Responsive Design & Accessibility', () => {
    
    test('should be mobile-friendly (viewport test)', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(`${BASE_URL}/index.en.html`);
      await page.waitForLoadState('networkidle');
      
      // Verify language switcher is still accessible
      const languageSwitcher = page.locator('#language-switcher, .lang-switcher-nav').first();
      await expect(languageSwitcher).toBeVisible();
      
      // Verify sections render
      const preview = page.locator('#preview');
      await expect(preview).toBeVisible();
    });

    test('should have accessible language switcher', async ({ page }) => {
      await page.goto(`${BASE_URL}/index.en.html`);
      
      // Check that language links are keyboard accessible
      const enLink = page.locator('a[href*="index.en.html"]').first();
      await enLink.focus();
      
      const focused = await page.evaluate(() => document.activeElement.tagName);
      expect(focused).toBe('A');
    });
  });

  test.describe('Performance & Loading', () => {
    
    test('should load page within acceptable time', async ({ page }) => {
      const startTime = Date.now();
      await page.goto(`${BASE_URL}/index.en.html`);
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
      
      await page.goto(`${BASE_URL}/index.en.html`);
      await page.waitForLoadState('networkidle');
      
      // Check for the success message from preview.js
      const successLog = consoleLogs.find(log => log.includes('Loaded') && log.includes('sections'));
      expect(successLog).toBeTruthy();
      
      // Should show 6/6 sections loaded
      expect(successLog).toMatch(/6\/6/);
    });
  });
});
