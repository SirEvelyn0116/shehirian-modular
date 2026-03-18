function renderCertifications(lang = 'en') {
  return fetch(`sections/certifications/certifications.${lang}.json`)
    .then(res => res.ok ? res.json() : [])
    .catch(() => [])
    .then(certs => {
      const section = document.createElement('section');
      section.className = 'certifications';
      section.innerHTML = '<h2>Certifications</h2>';

      if (!Array.isArray(certs) || certs.length === 0) {
        const placeholder = document.createElement('p');
        placeholder.textContent = 'No certifications available.';
        section.appendChild(placeholder);
        return section;
      }

      certs.forEach(cert => {
        const item = document.createElement('div');
        item.className = 'cert-item';
        item.innerHTML = `<strong>${cert.title || 'Untitled'}</strong> — ${cert.issuer || 'Unknown'} (${cert.year || 'N/A'})`;
        section.appendChild(item);
      });

      return section;
    });
}