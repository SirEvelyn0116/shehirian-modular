# 🚀 Deployment Verification Checklist

Use this checklist to verify successful deployment to GitHub Pages.

## Pre-Deployment

- [ ] All files committed to git
- [ ] Changes pushed to `main` branch
- [ ] GitHub Actions enabled in repository settings

## Build Verification (Local)

```bash
# Run build
node generate-index.js

# Expected output:
# ✓ Generated en: index.en.html
# ✓ Generated fr: index.fr.html
# ✓ Generated ar: index.ar.html
# ✓ Copied assets, sections, and preview.js
# ✓ Created .nojekyll file
# ✓ Copied redirect.html → dist/index.html
# ✅ Build complete!
```

### Check dist/ folder contains:

- [ ] `index.html` (redirect)
- [ ] `index.en.html`
- [ ] `index.fr.html`
- [ ] `index.ar.html`
- [ ] `.nojekyll`
- [ ] `preview.js`
- [ ] `assets/css/style.css`
- [ ] `sections/` folder with all render.js files

## GitHub Actions Verification

1. **Go to:** `https://github.com/<username>/<repo>/actions`
2. **Check:** Latest workflow run shows green checkmark ✅
3. **Review logs:**
   - [ ] "Build site" step completed
   - [ ] Build artifacts listed (index.html, .nojekyll, etc.)
   - [ ] "Deploy to gh-pages" step succeeded

## GitHub Pages Configuration

1. **Go to:** `https://github.com/<username>/<repo>/settings/pages`
2. **Verify:**
   - [ ] Source: Deploy from a branch
   - [ ] Branch: `gh-pages` / `(root)`
   - [ ] Status shows: "Your site is live at..."

## Site Accessibility Tests

### Test Each Language Page

**English:** `https://<username>.github.io/<repo>/index.en.html`
- [ ] Page loads without errors
- [ ] HTML lang="en"
- [ ] Title: "Shehirian Family Kitchen"
- [ ] dir="ltr"
- [ ] Language switcher visible
- [ ] All 6 sections render

**French:** `https://<username>.github.io/<repo>/index.fr.html`
- [ ] Page loads without errors
- [ ] HTML lang="fr"
- [ ] Title: "Cuisine familiale Shehirian"
- [ ] dir="ltr"
- [ ] Language switcher visible
- [ ] All 6 sections render with French content

**Arabic:** `https://<username>.github.io/<repo>/index.ar.html`
- [ ] Page loads without errors
- [ ] HTML lang="ar"
- [ ] Title: "مطبخ عائلة شيهريان"
- [ ] dir="rtl" (right-to-left layout)
- [ ] Language switcher visible (positioned left)
- [ ] All 6 sections render with Arabic content

### Test Root Redirect

**Root:** `https://<username>.github.io/<repo>/`
- [ ] Automatically redirects to appropriate language
- [ ] Browser language detected correctly
- [ ] localStorage.lang set

### Test Language Switcher

From English page:
- [ ] Click "FR" → navigates to index.fr.html
- [ ] Click "AR" → navigates to index.ar.html
- [ ] Click "EN" → stays on index.en.html

## Browser Console Tests

**Open DevTools Console (F12) on each page:**

### English Page
- [ ] Console shows: `✓ Loaded 6/6 sections for language: en`
- [ ] No red errors
- [ ] localStorage.getItem('lang') === 'en'

### French Page
- [ ] Console shows: `✓ Loaded 6/6 sections for language: fr`
- [ ] No red errors
- [ ] localStorage.getItem('lang') === 'fr'

### Arabic Page
- [ ] Console shows: `✓ Loaded 6/6 sections for language: ar`
- [ ] No red errors
- [ ] localStorage.getItem('lang') === 'ar'
- [ ] document.body.dir === 'rtl'

## SEO Validation

### Meta Tags (View Page Source)

For each language page, verify:
- [ ] `<html lang="...">` matches page language
- [ ] `<title>` is localized
- [ ] `<meta charset="UTF-8">`
- [ ] `<meta name="viewport">`

### hreflang Tags (View Page Source)

- [ ] `<link rel="alternate" hreflang="x-default" href="index.en.html" />`
- [ ] `<link rel="alternate" hreflang="en" href="index.en.html" />`
- [ ] `<link rel="alternate" hreflang="fr" href="index.fr.html" />`
- [ ] `<link rel="alternate" hreflang="ar" href="index.ar.html" />`

### JSON-LD Structured Data

**Test with:** [Google Rich Results Test](https://search.google.com/test/rich-results)

- [ ] AboutPage schema detected
- [ ] Organization schema detected
- [ ] Recipe schemas detected (if recipes present)
- [ ] No errors in structured data

## Sections Validation

For each language page, verify all 6 sections are visible:

1. **Hero Section**
   - [ ] Headline displays
   - [ ] Subheadline displays
   - [ ] CTA button visible (if data present)

2. **About Us Section**
   - [ ] Title displays
   - [ ] Content lines display
   - [ ] Localized for each language

3. **Our Companies Section**
   - [ ] Company cards render
   - [ ] Company names visible
   - [ ] Links functional

4. **Recipes Section**
   - [ ] Recipe cards render
   - [ ] Ingredients expandable
   - [ ] Steps expandable

5. **Certifications Section**
   - [ ] Certification items display
   - [ ] All data fields present

6. **Contact Section**
   - [ ] Contact info displays
   - [ ] Form fields present
   - [ ] Email link works

## Mobile Responsiveness

**Test on mobile device or DevTools device emulation:**

- [ ] Language switcher accessible
- [ ] All sections readable
- [ ] No horizontal scroll
- [ ] Touch targets adequate size
- [ ] RTL works on mobile (Arabic)

## Performance Check

**Use:** [PageSpeed Insights](https://pagespeed.web.dev/)

Target scores:
- [ ] Performance: >80
- [ ] Accessibility: >90
- [ ] Best Practices: >90
- [ ] SEO: >90

## Cross-Browser Testing

Test on:
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (if available)
- [ ] Mobile browsers (iOS Safari, Chrome Android)

## Final Verification

- [ ] No 404 errors in browser console
- [ ] CSS loads correctly
- [ ] All JavaScript files load
- [ ] Sections directory accessible
- [ ] JSON files load without CORS errors
- [ ] .nojekyll prevents Jekyll processing

## Issue Resolution

If any check fails:

1. **Check GitHub Actions logs** for build errors
2. **Verify files in gh-pages branch** on GitHub
3. **Clear browser cache** and retry
4. **Check console errors** for specific issues
5. **Re-run build** locally: `node generate-index.js`
6. **Re-deploy** by pushing to main branch

## Success Criteria

✅ **Deployment is successful when:**
- All checkboxes above are checked ✓
- All 3 language pages load without errors
- Language detection and switching works
- All 6 sections render with localized content
- SEO meta tags and JSON-LD present
- Mobile responsive
- No console errors

---

**Status:** ___________________  
**Deployed URL:** https://<username>.github.io/<repo>/  
**Verified by:** ___________________  
**Date:** ___________________  

---

## Quick Test Commands

```bash
# Local test
node generate-index.js
npx http-server dist -p 8080

# Open in browser
http://localhost:8080/

# Run Playwright tests (if set up)
npm test
```

## Support

If you encounter issues:
1. Review `QA_VALIDATION_REPORT.md`
2. Check GitHub Actions logs
3. Verify build output locally
4. Review browser console errors
