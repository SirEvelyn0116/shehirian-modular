import formatDuration from './formatDuration.js';

// Mirrors generate-index.js's individual recipe page template exactly —
// same structure, same class names — so the Preview view mode renders a
// faithful reproduction of the real deployed recipe page rather than a
// bespoke layout. See generate-index.js's writeAllRecipesPages() for the
// source of truth this is kept parallel to.
//
// Deliberately omits the real page's <nav class="back-nav"> (breadcrumb +
// language switcher): that's shared site chrome, not part of "the recipe,"
// and its links (home, language flags) have no sensible target inside an
// admin preview pane.
//
// Deliberately has no recipe photo: the real template has none either —
// there's no image field anywhere in all-recipes.json or in
// writeAllRecipesPages()'s output, so adding one here would be inventing
// layout the real page doesn't have.
//
// dir is set on <html>, matching the real template exactly — not <body>.
// This looks like it'd leave style.css's `body[dir="rtl"] ...` rules dead,
// and it does, but that's equally true on the real deployed page (dir is
// never set on <body> there either) — reproducing that faithfully, not
// "fixing" it, is the point.
function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default function buildRecipePageHtml(recipe, lang, dir, labels) {
  const title = (recipe.title && recipe.title[lang]) || (recipe.title && recipe.title.en) || recipe.slug;
  const description = (recipe.description && recipe.description[lang]) || '';
  const category = (recipe.recipeCategory && recipe.recipeCategory[lang]) || '';
  const cuisine = (recipe.recipeCuisine && recipe.recipeCuisine[lang]) || '';
  const ingredients = (recipe.ingredients && recipe.ingredients[lang]) || [];
  const instructions = (recipe.instructions && recipe.instructions[lang]) || [];

  const t = (key, fallback) => (labels && labels[key]) || fallback;

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(title)}</title>
  <link rel="stylesheet" href="/assets/css/style.css">
  <link rel="stylesheet" href="/assets/css/recipes.css">
</head>
<body>
  <main class="recipe-page">
    <header class="recipe-header">
      <h1>${esc(title)}</h1>
      <p class="recipe-description">${esc(description)}</p>
      <p>
        <strong>${esc(t('meta_category', 'Category'))}:</strong> ${esc(category)}
        &nbsp; | &nbsp;
        <strong>${esc(t('meta_cuisine', 'Cuisine'))}:</strong> ${esc(cuisine)}
      </p>
      <p>
        <strong>${esc(t('meta_prep_time', 'Prep Time'))}:</strong> ${esc(formatDuration(recipe.prepTime, lang))}
        &nbsp; | &nbsp;
        <strong>${esc(t('meta_cook_time', 'Cook Time'))}:</strong> ${esc(formatDuration(recipe.cookTime, lang))}
        &nbsp; | &nbsp;
        <strong>${esc(t('meta_total_time', 'Total'))}:</strong> ${esc(formatDuration(recipe.totalTime, lang))}
      </p>
    </header>

    <section class="recipe-section recipe-ingredients">
      <h2>${esc(t('section_ingredients', 'Ingredients'))}</h2>
      <ul>
        ${ingredients.map(i => `<li>${esc(i)}</li>`).join('\n')}
      </ul>
    </section>

    <section class="recipe-section recipe-steps recipe-instructions">
      <h2>${esc(t('section_instructions', 'Instructions'))}</h2>
      <ol>
        ${instructions.map(s => `<li>${esc(s)}</li>`).join('\n')}
      </ol>
    </section>

    <footer class="recipe-footer">
      <a class="view-all-btn" href="#" onclick="return false;">${esc(t('btn_back_to_all_recipes', '← All recipes'))}</a>
    </footer>
  </main>
</body>
</html>`;
}
