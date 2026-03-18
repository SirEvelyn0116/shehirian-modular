function renderOurCompanies(lang = 'en') {
  return fetch(`sections/ourCompanies/ourCompanies.${lang}.json`)
    .then(res => res.ok ? res.json() : [])
    .catch(() => [])
    .then(companies => {
      const section = document.createElement('section');
      section.className = 'our-companies';
      section.innerHTML = '<h2>Our Companies</h2>';

      companies.forEach(company => {
        const card = document.createElement('div');
        card.className = 'company-card';
        card.innerHTML = `
          <h3>${company.name}</h3>
          <p>${company.description}</p>
          <a href="${company.website}" target="_blank">Visit Site</a>
        `;
        section.appendChild(card);
      });

      return section;
    });
}