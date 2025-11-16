function renderCertifications(lang = 'en') {
  return fetch(`sections/certifications/certifications.${lang}.json`)
    .then(res => res.ok ? res.json() : [])
    .catch(() => [])
    .then(certs => {
      const section = document.createElement('section');
      section.className = 'certifications';
      section.innerHTML = '<h2>Certifications</h2>';

      certs.forEach(cert => {
        const item = document.createElement('div');
        item.className = 'cert-item';
        item.innerHTML = `<strong>${cert.title}</strong> — ${cert.issuer} (${cert.year})`;
        section.appendChild(item);
      });

      return section;
    });
}