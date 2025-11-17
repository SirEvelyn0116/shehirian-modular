# E2E Testing for Multilingual Static Site

## Overview

This directory contains end-to-end tests for the multilingual static site using **Playwright**. The tests verify correct functionality across all three languages (EN, FR, AR) and ensure proper SEO, accessibility, and navigation.

## Prerequisites

- Node.js 18+ installed
- Site deployed to GitHub Pages or running locally

## Installation

```bash
# Install Playwright and dependencies
npm install --save-dev @playwright/test

# Install browser binaries
npx playwright install
```

## Test Structure

```
tests/
└── e2e/
    └── multilingual.spec.js    # Main test suite
```

## Running Tests

### 1. Against Deployed Site (GitHub Pages)

```bash
# Set your GitHub Pages URL
export BASE_URL=https://sirevelyn0116.github.io/shehirian-modular

# Run all tests
npx playwright test

# Run tests in headed mode (see browser)
npx playwright test --headed

# Run specific test file
npx playwright test tests/e2e/multilingual.spec.js

# Run tests for specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### 2. Against Local Build

```bash
# Build the site
node generate-index.js

# Serve locally
npx http-server dist -p 8080

# In another terminal, run tests
BASE_URL=http://localhost:8080 npx playwright test
```

### 3. Run Specific Test Suites

```bash
# Run only language-specific tests
npx playwright test -g "Language: EN"

# Run only navigation tests
npx playwright test -g "Language Switcher Navigation"

# Run only content verification tests
npx playwright test -g "Content Verification"
```

## Test Coverage

### ✅ Core Functionality Tests

- **Page Loading**: Each language page loads successfully (200 status)
- **HTML Attributes**: Correct `lang` and `dir` attributes
- **Titles**: Localized titles match expected values
- **JSON-LD**: Structured data scripts are present and valid JSON
- **Language Switcher**: Links to all language variants exist
- **localStorage**: Correctly stores selected language

### ✅ Section Rendering Tests

Verifies all 6 sections render correctly:
- Hero
- About Us (with localized content verification)
- Our Companies
- Recipes
- Certifications
- Contact Us

### ✅ Navigation Tests

- **Cross-language navigation**: Click through EN → FR → AR → EN
- **localStorage persistence**: Language preference updates on switch
- **URL verification**: Correct URLs after navigation

### ✅ SEO & Accessibility Tests

- **hreflang tags**: Proper alternate language links
- **x-default**: Default language specified
- **Mobile responsive**: Works on mobile viewports
- **Keyboard navigation**: Language switcher is accessible

### ✅ Performance Tests

- **Load time**: Pages load within 5 seconds
- **Console errors**: No critical JavaScript errors
- **Section loading**: All 6 sections load successfully

## Test Reports

After running tests, view detailed reports:

```bash
# Open HTML report
npx playwright show-report test-results/html

# View JSON results
cat test-results/results.json
```

## CI/CD Integration

### GitHub Actions Example

Add to `.github/workflows/test.yml`:

```yaml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sunday

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright Browsers
        run: npx playwright install --with-deps
      
      - name: Run Playwright tests
        env:
          BASE_URL: https://sirevelyn0116.github.io/shehirian-modular
        run: npx playwright test
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: test-results/
          retention-days: 30
```

## Debugging Failed Tests

### 1. Debug Mode

```bash
# Run in debug mode (step through tests)
npx playwright test --debug

# Debug specific test
npx playwright test --debug -g "should have correct title"
```

### 2. Visual Debugging

```bash
# Run with headed browser
npx playwright test --headed

# Show browser and slow down actions
npx playwright test --headed --slow-mo=1000
```

### 3. Screenshots & Videos

Failed tests automatically capture:
- Screenshots (saved to `test-results/`)
- Videos (saved to `test-results/`)
- Traces (view with `npx playwright show-trace`)

### 4. Trace Viewer

```bash
# View trace of failed test
npx playwright show-trace test-results/.../trace.zip
```

## Customization

### Update Expected Content

Edit `LOCALIZED_CONTENT` in `multilingual.spec.js`:

```javascript
const LOCALIZED_CONTENT = {
  en: {
    lang: 'en',
    title: 'Your Custom Title',
    sections: {
      aboutUs: { 
        selector: 'section.about-us', 
        textIncludes: 'Expected text snippet' 
      }
    }
  }
};
```

### Add New Tests

```javascript
test('should have custom feature', async ({ page }) => {
  await page.goto(`${BASE_URL}/index.en.html`);
  
  // Your test logic
  const element = page.locator('.custom-selector');
  await expect(element).toBeVisible();
});
```

### Change Browsers

Edit `playwright.config.js` to add/remove browser projects.

## Troubleshooting

### Tests Timing Out

Increase timeout in `playwright.config.js`:

```javascript
timeout: 60 * 1000,  // 60 seconds
```

### Sections Not Found

Check selector patterns in `LOCALIZED_CONTENT`. The test uses multiple fallback selectors:

```javascript
selector: 'section#about-us, section.about-us, .about-us'
```

### Network Errors

Ensure `BASE_URL` is correct:

```bash
echo $BASE_URL  # Should match your GitHub Pages URL
```

### Browser Installation Issues

```bash
# Reinstall browsers
npx playwright install --force

# Install with system dependencies
npx playwright install --with-deps
```

## Best Practices

1. **Use specific selectors**: Prefer IDs and semantic class names
2. **Wait for network idle**: Use `waitForLoadState('networkidle')`
3. **Handle dynamic content**: Add appropriate `waitForTimeout()` for client-side rendering
4. **Filter console errors**: Ignore non-critical errors like favicon 404s
5. **Test across browsers**: Run on Chromium, Firefox, and WebKit
6. **Keep tests independent**: Each test should work in isolation
7. **Use soft assertions**: For non-critical checks, use `soft` assertions

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [CI/CD Examples](https://playwright.dev/docs/ci)

## Support

For issues or questions:
1. Check test output and error messages
2. Review screenshots/videos in `test-results/`
3. Run with `--debug` flag for step-by-step execution
4. Consult Playwright documentation
