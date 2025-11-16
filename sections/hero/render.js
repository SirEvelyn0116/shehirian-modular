// Modular section renderer for <sectionName>
// Loads multilingual JSON content and injects structured data (JSON-LD) if available
// Pattern source: sections/recipes/render.js
function renderHero(lang = 'en') {
  return fetch(`sections/hero/hero.${lang}.json`)
    .then(res => res.ok ? res.json() : {})
    .catch(() => ({}))
    .then(data => {
      const section = document.createElement('section');
      section.className = 'hero';
      section.innerHTML = `
        <h1>${data.headline}</h1>
        <p>${data.subheadline}</p>
        <a href="#recipes" class="cta">${data.cta}</a>
      `;

      // Optional JSON-LD for WebPage
      const schema = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": data.headline,
        "description": data.subheadline,
        "url": "https://shehirian-modular.github.io"
      };
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(schema);
      section.appendChild(script);

      return section;
    });
}