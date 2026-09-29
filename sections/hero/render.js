// Hero/Home section renderer with title bar and nav
function renderHero(lang = 'en') {
  const prefix = window.__sitePathPrefix || '';
  return fetch(`${prefix}sections/hero/hero.${lang}.json`)
    .then(res => res.ok ? res.json() : {})
    .catch(() => ({}))
    .then(data => {
      const section = document.createElement('div');
      section.className = 'home';
      section.id = 'home';
      
      // Title
      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = data.title || 'shehirian bulgor inc.';
      section.appendChild(title);
      
      // Mid-spacer
      const midSpacer = document.createElement('div');
      midSpacer.className = 'mid-spacer';
      section.appendChild(midSpacer);
      
      // Navigation
      const nav = document.createElement('div');
      nav.className = 'nav';
      nav.id = 'main-nav';
      
      const navItems = data.navigation || [
        { label: 'Home', section: 'home' },
        { label: 'About', section: 'about-us' },
        { label: 'Products', section: 'products-carousel' },
        { label: 'Recipes', section: 'recipes' },
        { label: 'Contact us', section: 'contact' }
      ];
      
      navItems.forEach(item => {
        const navItem = document.createElement('h2');
        navItem.textContent = item.label;
        navItem.setAttribute('data-section', item.section);
        navItem.style.cursor = 'pointer';
        navItem.addEventListener('click', () => {
          const targetSection = document.getElementById(item.section);
          if (targetSection) {
            targetSection.scrollIntoView({ behavior: 'smooth' });
          }
        });
        nav.appendChild(navItem);
      });
      
      section.appendChild(nav);

      return section;
    });
}