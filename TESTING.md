# Quick Start Guide: E2E Testing

## Installation

```bash
# Install Playwright
npm install --save-dev @playwright/test

# Install browser binaries
npx playwright install
```

## Running Tests

### Against GitHub Pages (Deployed Site)

```bash
# All tests, all browsers
npm test

# Single browser
npm run test:chromium
npm run test:firefox
npm run test:webkit

# Headed mode (see browser)
npm run test:headed

# Debug mode (step through)
npm run test:debug
```

### Against Local Build

```bash
# Build the site
npm run build

# Serve locally in one terminal
npm run preview

# Run tests in another terminal
BASE_URL=http://localhost:8080 npm test
```

## View Test Reports

```bash
# Open HTML report
npm run test:report
```

## What Gets Tested

✅ **All 3 Languages** (EN, FR, AR)
- Page loads successfully
- Correct HTML `lang` and `dir` attributes
- Localized titles
- JSON-LD structured data
- Language switcher functionality
- localStorage language preference

✅ **All 6 Sections**
- Hero
- About Us
- Our Companies
- Recipes
- Certifications
- Contact Us

✅ **Navigation**
- Cross-language switching
- URL updates
- Content changes

✅ **SEO**
- hreflang tags
- x-default language
- JSON-LD validation

✅ **Accessibility**
- RTL support for Arabic
- Keyboard navigation
- Mobile responsiveness

✅ **Performance**
- Load time < 5 seconds
- No console errors
- All sections render

## CI/CD

Tests run automatically on:
- Every push to main
- Every pull request
- Weekly (Sundays at midnight)
- Manual trigger via Actions tab

View test reports in GitHub Actions artifacts.

## Debugging Failed Tests

```bash
# See what's happening
npm run test:headed

# Step through test
npm run test:debug

# Run single test
npx playwright test -g "should have correct title"
```

## Configuration

- **Test file**: `tests/e2e/multilingual.spec.js`
- **Config**: `playwright.config.js`
- **Update BASE_URL**: Edit config or use environment variable

## Support

See `tests/README.md` for comprehensive documentation.
