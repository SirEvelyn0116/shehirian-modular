function renderAboutUs(lang = 'en') {
  return fetch(`sections/aboutUs/aboutUs.${lang}.json`)
    .then(res => res.ok ? res.json() : {})
    .catch(() => ({}))
    .then(data => {
      const section = document.createElement('section');
      section.className = 'about-us';
      section.innerHTML = `
        <h2>${data.headline}</h2>
        <p>${data.paragraph}</p>
      `;
      return section;
    });
}