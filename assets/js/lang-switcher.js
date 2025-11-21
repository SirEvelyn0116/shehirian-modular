// Language switcher script for standalone pages (certifications and recipes)
(function() {
  // Get current page info
  const path = window.location.pathname;
  const fileName = path.split('/').pop();
  const match = fileName.match(/^(.+)\.(en|fr|ar)\.html$/);
  
  if (!match) return;
  
  const baseName = match[1];
  const currentLang = match[2];
  const pageType = path.includes('/certifications/') ? 'certifications' : 'recipes';
  
  // Create language switcher
  const langSwitcher = document.createElement('div');
  langSwitcher.className = 'lang-switcher-nav';
  
  const langs = ['en', 'fr', 'ar'];
  langs.forEach(lang => {
    const link = document.createElement('a');
    link.href = `${baseName}.${lang}.html`;
    link.textContent = lang.toUpperCase();
    link.className = lang === currentLang ? 'active-lang' : '';
    langSwitcher.appendChild(link);
  });
  
  document.body.appendChild(langSwitcher);
})();
