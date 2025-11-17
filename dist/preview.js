// Get language from localStorage or default to English
const lang = localStorage.getItem('lang') || 'en';

// Set text direction based on language
document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
if (document.body) document.body.dir = lang === 'ar' ? 'rtl' : 'ltr';

// Root container for preview injection
const previewRoot = document.getElementById('preview') || document.body;

// Load and render all modular sections in order
Promise.all([
  renderHero(lang).catch(err => { console.error('Failed to load hero:', err); return null; }),
  renderAboutUs(lang).catch(err => { console.error('Failed to load aboutUs:', err); return null; }),
  renderOurCompanies(lang).catch(err => { console.error('Failed to load ourCompanies:', err); return null; }),
  renderRecipes(lang).catch(err => { console.error('Failed to load recipes:', err); return null; }),
  renderCertifications(lang).catch(err => { console.error('Failed to load certifications:', err); return null; }),
  renderContactUs(lang).catch(err => { console.error('Failed to load contactUs:', err); return null; })
]).then(sections => {
  sections.forEach(section => {
    if (section) previewRoot.appendChild(section);
  });
  console.log(`✓ Loaded ${sections.filter(Boolean).length}/${sections.length} sections for language: ${lang}`);
}).catch(err => {
  console.error('Critical error loading sections:', err);
});