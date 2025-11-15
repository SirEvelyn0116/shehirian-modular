Promise.all([
  renderHero(lang),
  renderOurCompanies(lang),
  renderCertifications(lang),
  renderAboutUs(lang),
  renderRecipes(lang),
  renderContactUs(lang)
]).then(sections => {
  sections.forEach(section => previewRoot.appendChild(section));
});