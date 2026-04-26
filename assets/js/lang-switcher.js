// Language switcher script for standalone pages (certifications and recipes)
(function() {
  // Get current page info
  const path = window.location.pathname;
  const fileName = path.split('/').pop();
  const pathMatch = path.match(/\/(en|fr|ar|hy)(?:\/|$)/);
  const fileMatch = fileName.match(/^(.+)\.(en|fr|ar|hy)\.html$/);
  const currentLang = pathMatch ? pathMatch[1] : (fileMatch ? fileMatch[2] : null);
  const match = fileMatch;
  
  if (!match || !currentLang) return;
  
  const baseName = match[1];
  // Create language switcher
  const langSwitcher = document.createElement('div');
  langSwitcher.id = 'language-switcher';
  langSwitcher.className = 'lang-switcher-nav';

  const langConfig = [
    { lang: 'en', flag: 'gb.svg', title: 'English' },
    { lang: 'fr', flag: 'fr.svg', title: 'Français' },
    { lang: 'ar', flag: 'lb.svg', title: 'العربية' },
    { lang: 'hy', flag: 'am.svg', title: 'Հայերեն' }
  ];
  const flagPathPrefix = '../assets/img/flags/';

  langConfig.forEach(({ lang, flag, title }) => {
    const link = document.createElement('a');
    link.href = `${baseName}.${lang}.html`;
    link.title = title;
    link.setAttribute('aria-label', `Switch to ${title}`);
    link.setAttribute('data-lang', lang);
    link.className = 'flag';

    const img = document.createElement('img');
    img.src = `${flagPathPrefix}${flag}`;
    img.alt = `${title} flag`;

    link.appendChild(img);
    langSwitcher.appendChild(link);
  });

  // Sync active language from URL path/route and keep a single active item.
  const links = langSwitcher.querySelectorAll('.flag');
  links.forEach(link => {
    link.classList.remove('active-lang');
    link.removeAttribute('aria-current');
  });

  const activeLink = langSwitcher.querySelector(`.flag[data-lang="${currentLang}"]`);
  if (activeLink) {
    activeLink.classList.add('active-lang');
    activeLink.setAttribute('aria-current', 'page');
  }
  
  document.body.appendChild(langSwitcher);
})();
