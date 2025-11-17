function renderAboutUs(lang = 'en') {
  return fetch(`sections/aboutUs/aboutUs.${lang}.json`)
    .then(res => res.ok ? res.json() : {})
    .catch(() => ({}))
    .then(data => {
      const section = document.createElement('section');
      section.id = 'about-us';
      section.className = 'page-section';
      section.innerHTML = `
        <h2>${data.title || 'About Us'}</h2>
        ${data.line1 ? `<p>${data.line1}</p>` : ''}
        ${data.line2 ? `<p>${data.line2}</p>` : ''}
      `;

      // Inject JSON-LD for SEO
      const schema = {
        "@context": "https://schema.org",
        "@type": "AboutPage",
        "name": data.title,
        "description": `${data.line1}. ${data.line2}`,
        "mainEntity": {
          "@type": "Organization",
          "name": "Shehirian Bulgor Inc.",
          "description": data.line1,
          "foundingDate": "1958",
          "url": "https://shehirian.com"
        }
      };

      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(schema);
      section.appendChild(script);

      return section;
    });
}