function renderCertifications(lang = 'en') {
  return fetch(`sections/certifications/certifications.${lang}.json`)
    .then(res => res.ok ? res.json() : {})
    .catch(() => ({}))
    .then(data => {
      const section = document.createElement('section');
      section.id = 'certifications';
      section.className = 'certifications-section';
      
      // Add title
      const title = document.createElement('h2');
      title.textContent = data.title || 'Our Certifications';
      section.appendChild(title);
      
      // Add intro paragraph
      const intro = document.createElement('p');
      intro.className = 'certifications-intro';
      intro.textContent = data.intro || 'GFSI-Recognized Food Safety Standards';
      section.appendChild(intro);
      
      // Create certifications container
      const container = document.createElement('div');
      container.className = 'certifications-container';
      
      const certs = data.certifications || [];
      
      if (!Array.isArray(certs) || certs.length === 0) {
        const placeholder = document.createElement('p');
        placeholder.textContent = 'No certifications available.';
        container.appendChild(placeholder);
      } else {
        certs.forEach(cert => {
          const badge = document.createElement('a');
          badge.href = 'certifications.html';
          badge.className = 'cert-badge';
          badge.title = cert.fullName || cert.name;
          
          const img = document.createElement('img');
          img.src = cert.logo || 'assets/img/cert-placeholder.svg';
          img.alt = `${cert.name} Certification`;
          
          const span = document.createElement('span');
          span.textContent = cert.name || 'Certification';
          
          badge.appendChild(img);
          badge.appendChild(span);
          container.appendChild(badge);
        });
      }
      
      section.appendChild(container);
      return section;
    });
}