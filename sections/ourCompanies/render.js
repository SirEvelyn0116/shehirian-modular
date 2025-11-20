function renderOurCompanies(lang = 'en') {
  return fetch(`sections/ourCompanies/ourCompanies.${lang}.json`)
    .then(res => res.ok ? res.json() : {})
    .catch(() => ({}))
    .then(data => {
      const section = document.createElement('section');
      section.id = 'products-carousel';
      section.className = 'page-section section companies-section';
      
      // Add title
      const title = document.createElement('h2');
      title.textContent = data.title || 'Our Companies';
      section.appendChild(title);
      
      // Create companies grid
      const grid = document.createElement('div');
      grid.className = 'companies-grid';
      
      const companies = data.companies || [];
      
      companies.forEach(company => {
        const card = document.createElement('a');
        card.href = company.link || '#';
        card.className = 'company-card';
        
        // Image container
        const imageContainer = document.createElement('div');
        imageContainer.className = 'company-image-container';
        
        const img = document.createElement('img');
        img.src = company.image || 'img/placeholder.png';
        img.alt = company.name || 'Company';
        
        imageContainer.appendChild(img);
        card.appendChild(imageContainer);
        
        // Company info
        const info = document.createElement('div');
        info.className = 'company-info';
        
        const name = document.createElement('h3');
        name.textContent = company.name || 'Company Name';
        
        const description = document.createElement('p');
        description.textContent = company.description || '';
        
        info.appendChild(name);
        info.appendChild(description);
        card.appendChild(info);
        
        grid.appendChild(card);
      });
      
      section.appendChild(grid);
      return section;
    });
}