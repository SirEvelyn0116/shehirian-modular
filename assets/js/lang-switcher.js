// Language switcher script for standalone pages (certifications and recipes)
(function() {
  // Get current page info
  const path = window.location.pathname;
  const fileName = path.split('/').pop();
  const match = fileName.match(/^(.+)\.(en|fr|ar|hy)\.html$/);
  
  if (!match) return;
  
  const baseName = match[1];
  const currentLang = match[2];
  // Create language switcher
  const langSwitcher = document.createElement('div');
  langSwitcher.id = 'language-switcher';
  langSwitcher.className = 'lang-switcher-nav';

  const langConfig = [
    { lang: 'en', code: 'EN', flag: 'gb.svg', title: 'English' },
    { lang: 'fr', code: 'FR', flag: 'fr.svg', title: 'Français' },
    { lang: 'ar', code: 'AR', flag: 'lb.svg', title: 'العربية' },
    { lang: 'hy', code: 'HY', flag: 'am.svg', title: 'Հայերեն' }
  ];
  const flagPathPrefix = '../assets/img/flags/';

  langConfig.forEach(({ lang, code, flag, title }) => {
    const link = document.createElement('a');
    link.href = `${baseName}.${lang}.html`;
    link.title = title;
    link.setAttribute('aria-label', title);
    link.className = `flag${lang === currentLang ? ' active-lang' : ''}`;

    const img = document.createElement('img');
    img.src = `${flagPathPrefix}${flag}`;
    img.alt = title;

    const codeLabel = document.createElement('span');
    codeLabel.className = 'code';
    codeLabel.textContent = code;

    link.appendChild(img);
    link.appendChild(codeLabel);
    langSwitcher.appendChild(link);
  });
  
  document.body.appendChild(langSwitcher);
})();
