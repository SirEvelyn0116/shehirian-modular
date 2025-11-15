function renderContactUs(lang = 'en') {
  return fetch(`sections/contactUs/contactUs.${lang}.json`)
    .then(res => res.ok ? res.json() : {})
    .catch(() => ({}))
    .then(data => {
      const section = document.createElement('section');
      section.className = 'contact-us';
      section.innerHTML = `
        <h2>Contact Us</h2>
        <p><strong>Email:</strong> <a href="mailto:${data.email}">${data.email}</a></p>
        <p><strong>Phone:</strong> ${data.phone}</p>
        <p><strong>Address:</strong> ${data.address}</p>
        <p><strong>Hours:</strong> ${data.hours}</p>
      `;
      return section;
    });
}