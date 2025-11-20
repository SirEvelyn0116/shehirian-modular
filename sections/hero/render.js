// Hero/Home section renderer with title bar, nav, and certifications preview
function renderHero(lang = 'en') {
  return fetch(`sections/hero/hero.${lang}.json`)
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
      
      // Certifications Preview - Bottom Left
      const certPreview = document.createElement('div');
      certPreview.className = 'certifications-preview';
      certPreview.innerHTML = `
        <a href="#certifications" class="cert-badge-small" title="BRC Global Standard">
          <img src="assets/img/cert-brc.svg" alt="BRC Certification">
        </a>
        <a href="#certifications" class="cert-badge-small" title="Safe Quality Food">
          <img src="assets/img/cert-sqf.svg" alt="SQF Certification">
        </a>
        <a href="#certifications" class="cert-badge-small" title="FSSC 22000">
          <img src="assets/img/cert-fssc.svg" alt="FSSC 22000">
        </a>
        <a href="#certifications" class="cert-badge-small" title="IFS Food Standard">
          <img src="assets/img/cert-ifs.svg" alt="IFS Certification">
        </a>
      `;
      section.appendChild(certPreview);
      
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
        { label: 'Certifications', section: 'certifications' },
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