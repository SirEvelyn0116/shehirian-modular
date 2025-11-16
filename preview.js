// Get language from localStorage or default to English
const lang = localStorage.getItem('lang') || 'en';

// Root container for preview injection
const previewRoot = document.getElementById('preview') || document.body;

// Load and render all modular sections in order
Promise.all([
  renderHero(lang),
  renderAboutUs(lang),
  renderProducts(lang),
  renderRecipes(lang),
  renderCertifications(lang),
  renderContactUs(lang)
]).then(sections => {
  sections.forEach(section => {
    if (section) previewRoot.appendChild(section);
  });
});