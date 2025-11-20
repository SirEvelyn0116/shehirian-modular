function renderContactUs(lang = 'en') {
  return fetch(`sections/contactUs/contactUs.${lang}.json`)
    .then(res => res.ok ? res.json() : {})
    .catch(() => ({}))
    .then(data => {
      const section = document.createElement('section');
      section.id = 'contact';
      section.className = 'contact-section';
      section.innerHTML = `
        <h2>${data.title || 'Contact Us'}</h2>
        <div class="contact-container">
          <div class="contact-info">
            <h3>${data.getInTouch || 'Get in Touch'}</h3>
            <p><strong>Address:</strong> ${data.address || 'N/A'}</p>
            <p><strong>Phone:</strong> ${data.phone || 'N/A'}</p>
            <p><strong>Fax:</strong> ${data.fax || 'N/A'}</p>
            <p><strong>Email:</strong> <a href="mailto:${data.email || 'info@example.com'}">${data.email || 'N/A'}</a></p>
          </div>
          <form class="contact-form">
            <label for="name">${data.form.labelName}</label>
            <input type="text" id="name" name="name" required>
            <label for="email">${data.form.labelEmail}</label>
            <input type="email" id="email" name="email" required>
            <label for="message">${data.form.labelMessage}</label>
            <textarea id="message" name="message" rows="5" required></textarea>
            <button type="submit">${data.form.buttonSend}</button>
          </form>
        </div>
      `;
      return section;
    });
}