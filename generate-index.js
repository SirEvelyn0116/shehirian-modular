const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || '';

const langs = {
  en: { title: "Shehirian Bulgor Inc", dir: "ltr", backHomeText: "Back / Home" },
  fr: { title: "Shehirian Bulgor Inc", dir: "ltr", backHomeText: "Retour / Accueil" },
  ar: { title: "Shehirian Bulgor Inc", dir: "rtl", backHomeText: "العودة / الرئيسية" },
  hy: { title: "Shehirian Bulgor Inc", dir: "ltr", backHomeText: "Վերադառնալ / Գլխավոր" }
};

const template = fs.readFileSync('template.html', 'utf8');

function withBaseUrl(sitePath) {
  const normalizedBaseUrl = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  return `${normalizedBaseUrl}${sitePath}`;
}

function homePagePath(lang) {
  return withBaseUrl(`/${lang}/index.html`);
}

function recipeIndexPath(lang) {
  return withBaseUrl(`/${lang}/recipes/index.html`);
}

function recipePagePath(lang, slug) {
  return withBaseUrl(`/${lang}/recipes/${slug}.html`);
}

function productPagePath(lang, slug) {
  return withBaseUrl(`/${lang}/products/${slug}.html`);
}

function certificationPagePath(lang, slug) {
  return withBaseUrl(`/${lang}/certifications/${slug}.html`);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function injectBaseUrlIntoRootLinks(html) {
  return html
    .replace(/href="index\.en\.html"/g, `href="${homePagePath('en')}"`)
    .replace(/href="index\.fr\.html"/g, `href="${homePagePath('fr')}"`)
    .replace(/href="index\.ar\.html"/g, `href="${homePagePath('ar')}"`)
    .replace(/href="index\.hy\.html"/g, `href="${homePagePath('hy')}"`);
}

function buildRecipeIndexLanguageSwitcher(currentLang) {
  const links = [
    { lang: 'en', title: 'English', flag: 'gb.svg', code: 'EN' },
    { lang: 'fr', title: 'Français', flag: 'fr.svg', code: 'FR' },
    { lang: 'ar', title: 'العربية', flag: 'lb.svg', code: 'AR' },
    { lang: 'hy', title: 'Հայերեն', flag: 'am.svg', code: 'HY' }
  ];

  const items = links.map(({ lang, title, flag, code }) => `
      <a href="${recipeIndexPath(lang)}" class="flag${lang === currentLang ? ' active-lang' : ''}" title="${title}" aria-label="${title}">
        <img src="../../assets/img/flags/${flag}" alt="${title}">
        <span class="code">${code}</span>
      </a>`).join('');

  return `<div id="language-switcher" class="lang-switcher-nav">${items}
    </div>`;
}

function rewriteRecipeIndexPaths(pageHtml, lang) {
  const languageSwitcher = buildRecipeIndexLanguageSwitcher(lang);
  const dirAttr = langs[lang] ? langs[lang].dir : 'ltr';

  let rewritten = pageHtml
    .replace(/<html([^>]*)lang="[^"]+"([^>]*)>/i, (match, before, after) => {
      const cleanBefore = before.replace(/\s*dir="[^"]*"/i, '');
      const cleanAfter = after.replace(/\s*dir="[^"]*"/i, '');
      return `<html${cleanBefore}lang="${lang}" dir="${dirAttr}"${cleanAfter}>`;
    })
    .replace(/href="\.\.\/assets\//g, 'href="../../assets/')
    .replace(/src="\.\.\/assets\//g, 'src="../../assets/')
    .replace(/href="\.\.\/sections\//g, 'href="../../sections/')
    .replace(/src="\.\.\/sections\//g, 'src="../../sections/')
    .replace(/href="\.\.\/index\.en\.html/gi, `href="${homePagePath('en')}`)
    .replace(/href="\.\.\/index\.fr\.html/gi, `href="${homePagePath('fr')}`)
    .replace(/href="\.\.\/index\.ar\.html/gi, `href="${homePagePath('ar')}`)
    .replace(/href="\.\.\/index\.hy\.html/gi, `href="${homePagePath('hy')}`)
    .replace(/<script src="\.\.\/assets\/js\/lang-switcher\.js"><\/script>\s*/i, '');

  if (rewritten.includes('id="language-switcher"')) {
    rewritten = rewritten.replace(/<div id="language-switcher"[\s\S]*?<\/div>/i, languageSwitcher);
  } else {
    rewritten = rewritten.replace(/<body([^>]*)>/i, `<body$1>\n    ${languageSwitcher}`);
  }

  return rewritten;
}

// Helper: format ISO 8601 durations (PT#H#M) to human-friendly localized strings
function formatDuration(iso, lang) {
  if (!iso) return '';
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return iso;
  const hrs = parseInt(m[1] || '0', 10);
  const mins = parseInt(m[2] || '0', 10);
  if (lang === 'fr') {
    if (hrs && mins) return `${hrs} h ${mins} min`;
    if (hrs) return `${hrs} h`;
    return `${mins} minutes`;
  }
  if (lang === 'ar') {
    if (hrs && mins) return `${hrs} ساعة ${mins} دقيقة`;
    if (hrs) return `${hrs} ساعة`;
    return `${mins} دقيقة`;
  }
  if (lang === 'hy') {
    if (hrs && mins) return `${hrs} ժամ ${mins} րոպե`;
    if (hrs) return `${hrs} ժամ`;
    return `${mins} րոպե`;
  }
  // default English
  if (hrs && mins) return `${hrs} hr ${mins} min`;
  if (hrs) return `${hrs} hr`;
  return `${mins} minutes`;
}

const localizedLabels = {
  en: { category: 'Category', cuisine: 'Cuisine', prep: 'Prep', cook: 'Cook', yield: 'Yield' },
  fr: { category: 'Catégorie', cuisine: 'Cuisine', prep: 'Préparation', cook: 'Cuisson', yield: 'Portions' },
  ar: { category: 'الفئة', cuisine: 'المطبخ', prep: 'وقت التحضير', cook: 'وقت الطهي', yield: 'الحصة' },
  hy: { category: 'Կատեգորիա', cuisine: 'Խոհանոց', prep: 'Պատրաստում', cook: 'Եփում', yield: 'Պորցիաներ' }
};

const productPageLabels = {
  en: {
    home: 'Home',
    products: 'Products',
    backToProducts: 'Back to Products',
    pageSuffix: 'Shehirian Bulgor Co.'
  },
  fr: {
    home: 'Accueil',
    products: 'Produits',
    backToProducts: 'Retour aux produits',
    pageSuffix: 'Shehirian Bulgor Co.'
  },
  ar: {
    home: 'الرئيسية',
    products: 'المنتجات',
    backToProducts: 'العودة إلى المنتجات',
    pageSuffix: 'شركة شهيريان للبرغل'
  },
  hy: {
    home: 'Գլխավոր',
    products: 'Արտադրանք',
    backToProducts: 'Վերադառնալ արտադրանքին',
    pageSuffix: 'Շեհիրյան Բուլղուր Քո.'
  }
};

const productTextTranslations = {
  'Mr. Falafel Products': { fr: 'Produits Mr. Falafel', ar: 'منتجات مستر فلافل', hy: 'Պարոն Ֆալաֆելի արտադրանք' },
  'Shirag Bulgor Products': { fr: 'Produits de boulgour Shirag', ar: 'منتجات برغل شيراغ', hy: 'Շիրագ բլղուրի արտադրանք' },
  'Falafel Mix - Small': { fr: 'Mélange à falafels - Petit', ar: 'خليط فلافل - صغير', hy: 'Ֆալաֆելի խառնուրդ - փոքր' },
  'Perfect for home cooking and small gatherings.': { fr: 'Parfait pour la cuisine maison et les petites réunions.', ar: 'مثالي للطبخ المنزلي والتجمعات الصغيرة.', hy: 'Հիանալի է տնային պատրաստման և փոքր հավաքների համար։' },
  '1 lb bag': { fr: 'Sac de 1 lb', ar: 'كيس 1 رطل', hy: '1 ֆունտ տոպրակ' },
  'Falafel Mix - Medium': { fr: 'Mélange à falafels - Moyen', ar: 'خليط فلافل - متوسط', hy: 'Ֆալաֆելի խառնուրդ - միջին' },
  'Ideal for family meals and casual entertaining.': { fr: 'Idéal pour les repas en famille et les réceptions décontractées.', ar: 'مثالي للوجبات العائلية والاستضافة غير الرسمية.', hy: 'Հարմար է ընտանեկան ճաշերի և ոչ պաշտոնական հյուրասիրությունների համար։' },
  '3 lb bag': { fr: 'Sac de 3 lb', ar: 'كيس 3 أرطال', hy: '3 ֆունտ տոպրակ' },
  'Falafel Mix - Large': { fr: 'Mélange à falafels - Grand', ar: 'خليط فلافل - كبير', hy: 'Ֆալաֆելի խառնուրդ - մեծ' },
  'Great for parties and larger gatherings.': { fr: 'Excellent pour les fêtes et les grands rassemblements.', ar: 'رائع للحفلات والتجمعات الكبيرة.', hy: 'Հիանալի է խնջույքների և մեծ հավաքների համար։' },
  '5 lb bag': { fr: 'Sac de 5 lb', ar: 'كيس 5 أرطال', hy: '5 ֆունտ տոպրակ' },
  'Falafel Mix - Bulk': { fr: 'Mélange à falafels - Vrac', ar: 'خليط فلافل - بالجملة', hy: 'Ֆալաֆելի խառնուրդ - մեծածախ' },
  'Perfect for restaurants and commercial use.': { fr: 'Parfait pour les restaurants et l’utilisation commerciale.', ar: 'مثالي للمطاعم والاستخدام التجاري.', hy: 'Հիանալի է ռեստորանների և առևտրային օգտագործման համար։' },
  '10 lb bag': { fr: 'Sac de 10 lb', ar: 'كيس 10 أرطال', hy: '10 ֆունտ տոպրակ' },
  'Premium Falafel Mix': { fr: 'Mélange à falafels premium', ar: 'خليط فلافل فاخر', hy: 'Պրեմիում ֆալաֆելի խառնուրդ' },
  'Our signature blend with authentic spices and herbs.': { fr: 'Notre mélange signature aux épices et herbes authentiques.', ar: 'خلطتنا المميزة بتوابل وأعشاب أصلية.', hy: 'Մեր բնորոշ խառնուրդը` իսկական համեմունքներով և խոտաբույսերով։' },
  '2 lb bag': { fr: 'Sac de 2 lb', ar: 'كيس 2 رطل', hy: '2 ֆունտ տոպրակ' },
  'Spicy Falafel Mix': { fr: 'Mélange à falafels épicé', ar: 'خليط فلافل حار', hy: 'Կծու ֆալաֆելի խառնուրդ' },
  'A zesty blend for those who love extra heat.': { fr: 'Un mélange relevé pour celles et ceux qui aiment les saveurs plus piquantes.', ar: 'خلطة منعشة لمن يحبون النكهة الحارة الإضافية.', hy: 'Համեմված խառնուրդ նրանց համար, ովքեր սիրում են ավելի կծու համ։' },
  'soft wheat fine': { fr: 'Blé tendre fin', ar: 'قمح طري ناعم', hy: 'Փափուկ ցորեն, նուրբ' },
  'Premium fine bulgur wheat, perfect for tabbouleh and delicate dishes.': { fr: 'Boulgour fin premium, parfait pour le taboulé et les plats délicats.', ar: 'برغل ناعم ممتاز، مثالي للتبولة والأطباق الخفيفة.', hy: 'Պրեմիում նուրբ բլղուր, կատարյալ թաբուլեի և նուրբ ուտեստների համար։' },
  'soft wheat medium': { fr: 'Blé tendre moyen', ar: 'قمح طري متوسط', hy: 'Փափուկ ցորեն, միջին' },
  'Versatile medium bulgur wheat, ideal for pilafs and salads.': { fr: 'Boulgour moyen polyvalent, idéal pour les pilafs et les salades.', ar: 'برغل متوسط متعدد الاستخدامات، مثالي للبلاو والسلطات.', hy: 'Բազմակողմանի միջին բլղուր, հարմար փլավների և աղցանների համար։' },
  'soft wheat coarse': { fr: 'Blé tendre gros', ar: 'قمح طري خشن', hy: 'Փափուկ ցորեն, կոպիտ' },
  'Hearty coarse bulgur wheat for traditional Middle Eastern recipes.': { fr: 'Boulgour gros nourrissant pour les recettes traditionnelles du Moyen-Orient.', ar: 'برغل خشن غني للوصفات الشرق أوسطية التقليدية.', hy: 'Հագեցնող կոպիտ բլղուր ավանդական Մերձավորարևելյան բաղադրատոմսերի համար։' },
  'soft wheat extra coarse': { fr: 'Blé tendre extra gros', ar: 'قمح طري خشن جداً', hy: 'Փափուկ ցորեն, շատ կոպիտ' },
  'Extra coarse bulgur wheat for soups and hearty main dishes.': { fr: 'Boulgour extra gros pour les soupes et les plats principaux généreux.', ar: 'برغل خشن جداً للشوربات والأطباق الرئيسية الغنية.', hy: 'Շատ կոպիտ բլղուր ապուրների և հագեցնող հիմնական ուտեստների համար։' },
  'red wheat fine': { fr: 'Blé rouge fin', ar: 'قمح أحمر ناعم', hy: 'Կարմիր ցորեն, նուրբ' },
  'Nutritious fine red bulgur wheat with a rich, nutty flavor.': { fr: 'Boulgour fin de blé rouge nutritif au goût riche et légèrement noisetté.', ar: 'برغل أحمر ناعم مغذٍ بطعم غني ومائل إلى الجوز.', hy: 'Սննդարար նուրբ կարմիր բլղուր` հարուստ և ընկուզային համով։' },
  'red wheat medium': { fr: 'Blé rouge moyen', ar: 'قمح أحمر متوسط', hy: 'Կարմիր ցորեն, միջին' },
  'Medium red bulgur wheat, excellent for robust salads and sides.': { fr: 'Boulgour moyen de blé rouge, excellent pour les salades généreuses et les accompagnements.', ar: 'برغل أحمر متوسط، ممتاز للسلطات الغنية والأطباق الجانبية.', hy: 'Միջին կարմիր բլղուր` հարմար առատ աղցանների և խավարտների համար։' },
  'red wheat coarse': { fr: 'Blé rouge gros', ar: 'قمح أحمر خشن', hy: 'Կարմիր ցորեն, կոպիտ' },
  'Coarse red bulgur wheat for traditional dishes with enhanced nutrition.': { fr: 'Boulgour gros de blé rouge pour des plats traditionnels à la valeur nutritive renforcée.', ar: 'برغل أحمر خشن للأطباق التقليدية مع قيمة غذائية أعلى.', hy: 'Կոպիտ կարմիր բլղուր ավանդական ուտեստների համար` ավելի բարձր սննդային արժեքով։' }
};

const productPageSources = [
  { slug: 'shirag', sourceFile: 'shirag-products.html', imageFallback: 'assets/img/Shirag-2.png' },
  { slug: 'mr-falafel', sourceFile: 'mr-falafel-products.html', imageFallback: 'assets/img/Mr-Falafel-3.png' }
];

function translateProductText(text, lang) {
  if (!text || lang === 'en') return text || '';
  return (productTextTranslations[text] && productTextTranslations[text][lang]) || text;
}

function decodeHtmlText(value) {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function normalizeProductImageSource(rawSource) {
  if (!rawSource) return '';
  return rawSource.replace(/^\.\//, '').replace(/^img\//, 'assets/img/').replace(/^assets\/img\//, 'assets/img/');
}

function extractLegacyProductCards(sourceFile) {
  const sourcePath = path.join(__dirname, sourceFile);
  const html = fs.readFileSync(sourcePath, 'utf8');
  const pageTitleMatch = html.match(/<h1>([^<]+)<\/h1>/i);
  const pageTitle = decodeHtmlText(pageTitleMatch ? pageTitleMatch[1] : sourceFile);

  const products = html
    .split('<div class="product-card">')
    .slice(1)
    .map(chunk => {
      const titleMatch = chunk.match(/<h3>([^<]+)<\/h3>/i);
      const descriptionMatch = chunk.match(/<p class="product-description">([^<]+)<\/p>/i);
      const sizeMatch = chunk.match(/<p class="product-size">([^<]+)<\/p>/i);
      const imageMatch = chunk.match(/<img src=['"]([^'"]+)['"][^>]*>/i);
      const imageContainerMatch = chunk.match(/<div class="product-image-container">([\s\S]*?)<\/div>/i);
      const emoji = imageMatch || !imageContainerMatch
        ? ''
        : decodeHtmlText(imageContainerMatch[1].replace(/<[^>]+>/g, ''));

      return {
        title: decodeHtmlText(titleMatch ? titleMatch[1] : ''),
        description: decodeHtmlText(descriptionMatch ? descriptionMatch[1] : ''),
        size: decodeHtmlText(sizeMatch ? sizeMatch[1] : ''),
        image: normalizeProductImageSource(imageMatch ? imageMatch[1] : ''),
        emoji
      };
    })
    .filter(product => product.title);

  return { pageTitle, products };
}

function buildProductLanguageSwitcher(currentLang, brandSlug) {
  const links = [
    { lang: 'en', title: 'English', flag: 'gb.svg', code: 'EN' },
    { lang: 'fr', title: 'Français', flag: 'fr.svg', code: 'FR' },
    { lang: 'ar', title: 'العربية', flag: 'lb.svg', code: 'AR' },
    { lang: 'hy', title: 'Հայերեն', flag: 'am.svg', code: 'HY' }
  ];

  const items = links.map(({ lang, title, flag, code }) => `
      <a href="${productPagePath(lang, brandSlug)}" class="flag${lang === currentLang ? ' active-lang' : ''}" title="${title}" aria-label="${title}">
        <img src="../../assets/img/flags/${flag}" alt="${title}">
        <span class="code">${code}</span>
      </a>`).join('');

  return `<div id="language-switcher" class="lang-switcher-nav">${items}
    </div>`;
}

function buildCertificationLanguageSwitcher(currentLang, certSlug) {
  const links = [
    { lang: 'en', title: 'English', flag: 'gb.svg', code: 'EN' },
    { lang: 'fr', title: 'Français', flag: 'fr.svg', code: 'FR' },
    { lang: 'ar', title: 'العربية', flag: 'lb.svg', code: 'AR' },
    { lang: 'hy', title: 'Հայերեն', flag: 'am.svg', code: 'HY' }
  ];

  const items = links.map(({ lang, title, flag, code }) => `
      <a href="${certificationPagePath(lang, certSlug)}" class="flag${lang === currentLang ? ' active-lang' : ''}" title="${title}" aria-label="${title}">
        <img src="../../assets/img/flags/${flag}" alt="${title}">
        <span class="code">${code}</span>
      </a>`).join('');

  return `<div id="language-switcher" class="lang-switcher-nav">${items}
    </div>`;
}

function rewriteCertificationPagePaths(pageHtml, lang, certSlug) {
  const sourceLang = (pageHtml.match(/<html[^>]*lang="([^"]+)"/i) || [])[1] || lang;
  const languageSwitcher = buildCertificationLanguageSwitcher(lang, certSlug);
  const dirAttr = langs[lang] ? langs[lang].dir : 'ltr';
  let rewritten = pageHtml
    .replace(/<html([^>]*)lang="[^"]+"([^>]*)>/i, (match, before, after) => {
      // Strip any existing dir attribute so we can set the correct one
      const cleanBefore = before.replace(/\s*dir="[^"]*"/i, '');
      const cleanAfter = after.replace(/\s*dir="[^"]*"/i, '');
      return `<html${cleanBefore}lang="${lang}" dir="${dirAttr}"${cleanAfter}>`;
    })
    .replace(/href="\.\.\/assets\//g, 'href="../../assets/')
    .replace(/src="\.\.\/assets\//g, 'src="../../assets/')
    .replace(new RegExp(`href="\.\.\/index\\.${sourceLang}\\.html#certifications"`, 'gi'), `href="${homePagePath(lang)}#certifications"`)
    .replace(new RegExp(`href="\.\.\/index\\.${sourceLang}\\.html"`, 'gi'), `href="${homePagePath(lang)}"`)
    .replace(/<script src="\.\.\/assets\/js\/lang-switcher\.js"><\/script>\s*/i, '');

  if (rewritten.includes('id="language-switcher"')) {
    rewritten = rewritten.replace(/<div id="language-switcher"[\s\S]*?<\/div>/i, languageSwitcher);
  } else if (rewritten.includes('<section class="cert-page">')) {
    rewritten = rewritten.replace(/<section class="cert-page">/i, `${languageSwitcher}\n\n    <section class="cert-page">`);
  } else {
    rewritten = rewritten.replace(/<body([^>]*)>/i, `<body$1>\n    ${languageSwitcher}`);
  }

  return rewritten;
}

function writeCertificationPages() {
  const certificationsDir = path.join(__dirname, 'certifications');
  if (!fs.existsSync(certificationsDir)) {
    console.warn('⚠ certifications source directory not found, skipping certification page generation');
    return;
  }

  const availablePages = fs.readdirSync(certificationsDir)
    .filter(fileName => /\.(en|fr|hy)\.html$/i.test(fileName));
  const certificationPageMap = new Map();

  availablePages.forEach(fileName => {
    const match = fileName.match(/^(.*)\.(en|fr|hy)\.html$/i);
    if (!match) return;
    const [, slug, fileLang] = match;
    if (!certificationPageMap.has(slug)) {
      certificationPageMap.set(slug, {});
    }
    certificationPageMap.get(slug)[fileLang] = path.join(certificationsDir, fileName);
  });

  certificationPageMap.forEach((sourcePaths, slug) => {
    Object.keys(langs).forEach(lang => {
      const sourcePath = sourcePaths[lang] || sourcePaths.en || sourcePaths.fr || sourcePaths.hy;
      if (!sourcePath) return;

      const pageHtml = fs.readFileSync(sourcePath, 'utf8');
      const rewritten = rewriteCertificationPagePaths(pageHtml, lang, slug);
      const outDir = path.join(distDir, lang, 'certifications');
      ensureDir(outDir);
      fs.writeFileSync(path.join(outDir, `${slug}.html`), rewritten, 'utf8');
    });

    console.log(`✓ Generated certification page set: ${slug}`);
  });
}

function buildProductCardsHtml(products, lang, imageFallback) {
  return products.map(product => {
    const title = escapeHtml(translateProductText(product.title, lang));
    const description = escapeHtml(translateProductText(product.description, lang));
    const size = escapeHtml(translateProductText(product.size, lang));
    const imagePath = product.image || imageFallback || '';
    const imageHtml = imagePath
      ? `<img src="../../${escapeHtml(imagePath)}" alt="${title}">`
      : escapeHtml(product.emoji || '•');
    const sizeHtml = size ? `<p class="product-size">${size}</p>` : '';

    return `
      <article class="product-card">
        <div class="product-image-container">
          ${imageHtml}
        </div>
        <div class="product-info">
          <h3>${title}</h3>
          <p class="product-description">${description}</p>
          ${sizeHtml}
        </div>
      </article>`;
  }).join('\n');
}

function buildProductPageHtml(brandSlug, englishPageTitle, products, lang, imageFallback) {
  const labels = productPageLabels[lang] || productPageLabels.en;
  const pageTitle = translateProductText(englishPageTitle, lang);
  const breadcrumbsTitle = escapeHtml(pageTitle);
  const switcher = buildProductLanguageSwitcher(lang, brandSlug);
  const cardsHtml = buildProductCardsHtml(products, lang, imageFallback);

  return `<!doctype html>
<html lang="${lang}" dir="${langs[lang].dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(pageTitle)} | ${escapeHtml(labels.pageSuffix)}</title>
  <link rel="stylesheet" href="../../assets/css/style.css">
  <style>
    body {
      margin: 0;
      font-family: 'PP Neue Montreal', 'Poppins', sans-serif;
      background: #f8f6f2;
      color: #2f2418;
    }

    .back-nav {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: center;
      flex-wrap: wrap;
      padding: 1rem 2rem;
      background: #5a6345;
    }

    .breadcrumb-nav {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      flex-wrap: wrap;
      color: #f8f6f2;
    }

    .breadcrumb-nav a {
      color: #f8f6f2;
      text-decoration: none;
    }

    .products-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2.5rem 2rem 4rem;
    }

    h1 {
      margin: 0 0 2rem;
      font-size: clamp(2rem, 4vw, 3rem);
      color: #55422c;
      text-align: center;
      letter-spacing: 0.03em;
    }

    .product-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1.5rem;
    }

    .product-card {
      overflow: hidden;
      border-radius: 30px;
      background: #5a6345;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.10);
    }

    .product-image-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 250px;
      background: linear-gradient(135deg, #a67b5b 0%, #8b6644 100%);
      color: rgba(255, 255, 255, 0.75);
      font-size: 4rem;
      text-align: center;
    }

    .product-image-container img {
      width: 100%;
      height: 250px;
      object-fit: cover;
      object-position: center;
      background: #f8f6f2;
    }

    .product-info {
      padding: 1.5rem 1.25rem;
      background: #f8f6f2;
    }

    .product-card h3 {
      margin: 0 0 0.5rem;
      font-size: 1.35rem;
      color: #7a4b2b;
    }

    .product-description {
      margin: 0;
      line-height: 1.6;
      color: #2a241b;
    }

    .product-size {
      margin: 0.75rem 0 0;
      font-weight: 600;
      color: #5a6345;
    }

    .products-footer {
      margin-top: 2rem;
      display: flex;
      justify-content: center;
    }

    @media (max-width: 768px) {
      .back-nav,
      .products-container {
        padding-inline: 1rem;
      }

      .product-image-container,
      .product-image-container img {
        min-height: 210px;
        height: 210px;
      }
    }
  </style>
</head>
<body>
  <nav class="back-nav">
    <div class="breadcrumb-nav">
      <a href="${homePagePath(lang)}">${escapeHtml(labels.home)}</a>
      <span>›</span>
      <a href="${homePagePath(lang)}#products-carousel">${escapeHtml(labels.products)}</a>
      <span>›</span>
      <span>${breadcrumbsTitle}</span>
    </div>
    ${switcher}
  </nav>

  <main class="products-container">
    <h1>${breadcrumbsTitle}</h1>
    <section class="product-grid">
      ${cardsHtml}
    </section>

    <footer class="products-footer">
      <a class="view-all-btn" href="${homePagePath(lang)}#products-carousel">← ${escapeHtml(labels.backToProducts)}</a>
    </footer>
  </main>
</body>
</html>`;
}

function writeProductPages() {
  productPageSources.forEach(({ slug, sourceFile, imageFallback }) => {
    const { pageTitle, products } = extractLegacyProductCards(sourceFile);

    Object.keys(langs).forEach(lang => {
      const outDir = path.join(distDir, lang, 'products');
      ensureDir(outDir);
      const outFile = path.join(outDir, `${slug}.html`);
      const page = buildProductPageHtml(slug, pageTitle, products, lang, imageFallback);
      fs.writeFileSync(outFile, page, 'utf8');
    });

    console.log(`✓ Generated products page set: ${slug}`);
  });
}

// Localized author strings to use for all recipes at build time
const AUTHOR_OVERRIDE = {
  en: 'Shehirian family',
  fr: 'Famille Shehirian',
  ar: 'عائلة شيهريان',
  hy: 'Շահիրյան ընտանիք'
};

// Canonical category definitions — try to load from `sections/categories.json`
const defaultCategoryDefs = {
  soup: { en: 'Soup', fr: 'Soupe', ar: 'شوربة', hy: 'Ապուր' },
  salad: { en: 'Salad', fr: 'Salade', ar: 'سلطة', hy: 'Աղցան' },
  main: { en: 'Main Dish', fr: 'Plat Principal', ar: 'طبق رئيسي', hy: 'Հիմնական ուտեստ' },
  starter: { en: 'Starter', fr: 'Entrée', ar: 'مقبلات', hy: 'Ախորժակ' },
  dessert: { en: 'Dessert', fr: 'Dessert', ar: 'حلوى', hy: 'Կրկեսային' },
  other: { en: 'Other', fr: 'Autre', ar: 'أخرى', hy: 'Այլ' }
};

let categoriesLookup = defaultCategoryDefs;
try {
  const categoriesPath = path.join(__dirname, 'sections', 'categories.json');
  if (fs.existsSync(categoriesPath)) {
    const raw = fs.readFileSync(categoriesPath, 'utf8');
    const parsed = JSON.parse(raw);
    // Merge parsed into defaults so missing locales fall back
    categoriesLookup = Object.assign({}, defaultCategoryDefs, parsed);
  }
} catch (e) {
  console.warn('⚠ Failed to load sections/categories.json — using built-in category definitions');
}

// Normalize category strings to avoid duplicated sections caused by
// small differences (whitespace, casing, synonyms across languages).
function normalizeCategory(cat, lang) {
  if (!cat) return 'Other';
  const s = String(cat).trim();
  if (!s) return 'Other';
  // language specific normalization with mapping tables
  if (lang === 'ar') {
    // map common Arabic synonyms to canonical forms
    const map = {
      'حساء': 'شوربة',
      'شوربة': 'شوربة',
      'حساءً': 'شوربة',
      'حساء ': 'شوربة'
    };
    const key = s.replace(/\s+/g, '');
    return map[key] || s;
  }

  if (lang === 'fr') {
    const key = s.replace(/\s+/g, ' ').toLowerCase();
    const map = {
      'soupe': 'Soupe',
      'soups': 'Soupe',
      'salade': 'Salade',
      'plat principal': 'Plat Principal',
      'plat': 'Plat Principal',
      'entrée': 'Entrée'
    };
    if (map[key]) return map[key];
    // fallback: normalize spacing and capitalize first letter
    const tidy = key.replace(/\s+/g, ' ').trim();
    return tidy.charAt(0).toUpperCase() + tidy.slice(1);
  }

  // English and default: unify common synonyms and capitalization
  const keyEn = s.replace(/\s+/g, ' ').toLowerCase();
  const mapEn = {
    'soup': 'Soup',
    'soups': 'Soup',
    'salad': 'Salad',
    'main dish': 'Main Dish',
    'main course': 'Main Dish',
    'main': 'Main Dish',
    'entree': 'Main Dish'
  };
  if (mapEn[keyEn]) return mapEn[keyEn];
  return keyEn.charAt(0).toUpperCase() + keyEn.slice(1);
}
// Load JSON-LD blocks if available
function loadJSONLD(lang) {
  const sectionsDir = path.join(__dirname, 'sections');
  const sections = fs.readdirSync(sectionsDir)
    .filter(item => fs.statSync(path.join(sectionsDir, item)).isDirectory());
  
  return sections
    .map(section => {
      const file = path.join(sectionsDir, section, `${section}.${lang}.jsonld`);
      return fs.existsSync(file)
        ? `<script type="application/ld+json">${fs.readFileSync(file, 'utf8')}</script>`
        : '';
    })
    .filter(Boolean)
    .join('\n  ');
}

// Copy assets to dist
function copyAssets() {
  const distDir = path.join(__dirname, 'dist');
  const assetsDir = path.join(__dirname, 'assets');
  const sectionsDir = path.join(__dirname, 'sections');
  const previewJsSource = path.join(__dirname, 'preview.js');
  
  // Copy assets folder
  if (fs.existsSync(assetsDir)) {
    const distAssets = path.join(distDir, 'assets');
    if (!fs.existsSync(distAssets)) {
      fs.mkdirSync(distAssets, { recursive: true });
    }
    copyRecursive(assetsDir, distAssets);
  }
  
  // Copy sections folder
  const distSections = path.join(distDir, 'sections');
  if (!fs.existsSync(distSections)) {
    fs.mkdirSync(distSections, { recursive: true });
  }
  copyRecursive(sectionsDir, distSections);
  
  // Copy preview.js
  fs.copyFileSync(previewJsSource, path.join(distDir, 'preview.js'));
  
  // Create .nojekyll
  fs.writeFileSync(path.join(distDir, '.nojekyll'), '');
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach(child => {
      copyRecursive(path.join(src, child), path.join(dest, child));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Build each language page
console.log('🔨 Building multilingual static site...\n');

const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
ensureDir(distDir);

Object.entries(langs).forEach(([lang, config]) => {
  const langDir = path.join(distDir, lang);
  ensureDir(langDir);

  const html = injectBaseUrlIntoRootLinks(template
    .replace(/{{lang}}/g, lang)
    .replace(/{{dir}}/g, config.dir)
    .replace(/{{title}}/g, config.title)
    .replace(/{{baseUrl}}/g, BASE_URL)
    .replace(/{{backHomeText}}/g, config.backHomeText)
    .replace(/{{jsonld}}/g, loadJSONLD(lang)))
    .replace(/<html lang="en" data-template-lang="([^"]+)"/i, `<html lang="$1" dir="${config.dir}"`);

  const outputFile = path.join(langDir, 'index.html');
  fs.writeFileSync(outputFile, html);
  console.log(`✓ Generated ${lang}: ${lang}/index.html`);
});

copyAssets();
console.log('✓ Copied assets, sections, and preview.js');
console.log('✓ Created .nojekyll file');

// Generate build-time all-recipes pages from sections/recipes/recipes.<lang>.json
function buildRecipeCardHTML(recipe, lang) {
  const slug = recipe.slug || recipe.id || recipe.name || 'recipe';
  const href = recipePagePath(lang, slug);
  const desc = recipe.description ? `<p class="recipe-description">${recipe.description}</p>` : '';
  const labels = localizedLabels[lang] || localizedLabels.en;
  const meta = [];
  if (recipe.category) meta.push(`<strong>${labels.category}:</strong> ${recipe.category}`);
  if (recipe.cuisine) meta.push(`<strong>${labels.cuisine}:</strong> ${recipe.cuisine}`);
  if (recipe.prepTime) meta.push(`<strong>${labels.prep}:</strong> ${formatDuration(recipe.prepTime, lang)}`);
  if (recipe.cookTime) meta.push(`<strong>${labels.cook}:</strong> ${formatDuration(recipe.cookTime, lang)}`);
  if (recipe.yield) meta.push(`<strong>${labels.yield}:</strong> ${recipe.yield}`);

  return `
    <a href="${href}" class="recipe-card">
      <div class="recipe-info">
        <h3>${recipe.title}</h3>
      </div>
      <div class="recipe-meta">
        ${desc}
        <div class="recipe-meta-info">${meta.join(' | ')}</div>
      </div>
    </a>`;
}

function buildAllRecipesHTML(allRecipes, lang) {
  // group by canonical categoryId; fall back to normalized category text
  const groups = {};
  allRecipes.forEach(r => {
    const cid = r.categoryId || (r.category && r.category.toString().toLowerCase().replace(/\s+/g,'-')) || 'other';
    if (!groups[cid]) groups[cid] = { id: cid, items: [] };
    groups[cid].items.push(r);
  });

    return Object.values(groups).map(group => {
    const items = group.items;
    const labelObj = categoriesLookup[group.id] || { en: group.id, fr: group.id, ar: group.id };
    const heading = (labelObj && labelObj[lang]) || labelObj.en || group.id;
    const cards = items.map(it => buildRecipeCardHTML(it, lang)).join('\n');
    
    // Localized expand button text
    const expandText = lang === 'fr' ? 'Voir plus' : 
                       lang === 'ar' ? 'عرض المزيد' : 
                       lang === 'hy' ? 'Ցույց տալ ավելին' : 
                       'Show more';
    const collapseText = lang === 'fr' ? 'Voir moins' : 
                         lang === 'ar' ? 'عرض أقل' : 
                         lang === 'hy' ? 'Ցույց տալ պակաս' : 
                         'Show less';
    
    return `<section class="recipes-category-section">
      <div class="category-header-wrapper">
        <h3 class="recipes-category-heading">${heading}</h3>
        <button class="category-expand-btn" aria-expanded="false" data-expand-text="${expandText}" data-collapse-text="${collapseText}">
          <span class="expand-icon">+</span>
          <span class="expand-text">${expandText}</span>
        </button>
      </div>
      <hr class="category-sep">
      <div class="recipe-grid-wrapper collapsed">
        <div class="recipe-grid">
          ${cards}
        </div>
      </div>
    </section>`;
  }).join('\n');
}

function writeAllRecipesPages() {
  // Read master all-recipes.json
  const masterPath = path.join(__dirname, 'sections', 'recipes', 'all-recipes.json');
  if (!fs.existsSync(masterPath)) {
    console.warn('⚠ master sections/recipes/all-recipes.json not found, skipping recipe generation');
    return;
  }

  let master;
  try {
    master = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
  } catch (e) {
    console.error('✖ Failed to parse master all-recipes.json:', e.message);
    return;
  }

  // Validate categoryId presence: push missing categoryId to 'other' and warn
  const missingCat = master.recipes.filter(r => !r.categoryId || !String(r.categoryId).trim());
  if (missingCat.length) {
    console.warn(`⚠ ${missingCat.length} recipe(s) missing categoryId — assigning to 'other' temporarily for build:`);
    missingCat.forEach(r => console.warn('  -', r.slug || r.title && r.title.en || '(unknown)'));
    // Assign in-memory so build groups them under 'other'
    missingCat.forEach(r => { r.categoryId = 'other'; });
  }

  // Normalize any categoryId values not present in categoriesLookup to 'other'
  master.recipes.forEach(r => {
    const cid = r.categoryId || '';
    if (!cid || !categoriesLookup[cid]) {
      if (cid && !categoriesLookup[cid]) {
        console.warn(`⚠ Unknown categoryId '${cid}' for recipe '${r.slug || (r.title && r.title.en) || ''}' — defaulting to 'other'`);
      }
      r.categoryId = 'other';
    }
  });

  // Note: 'author' is NOT stored in all-recipes.json — it's injected at build time
  // from AUTHOR_OVERRIDE to avoid redundancy and ensure consistency.

  const recipesDir = path.join(__dirname, 'recipes');
  // Ensure dist sections recipes folder exists so client-side fetches can find recipes.<lang>.json
  const distSectionsRecipes = path.join(distDir, 'sections', 'recipes');
  if (!fs.existsSync(distSectionsRecipes)) fs.mkdirSync(distSectionsRecipes, { recursive: true });

  // Iterate languages and build localized listing JSON + all-recipes pages
  Object.keys(langs).forEach(lang => {
    // Build localized summaries, dedupe by slug and normalize categories
    const seenSlugs = new Set();
    const localizedAll = master.recipes.reduce((acc, r) => {
      const slug = r.slug;
      if (!slug || seenSlugs.has(slug)) return acc; // skip duplicates
      seenSlugs.add(slug);
      const rawCategory = (r.recipeCategory && (r.recipeCategory[lang] || r.recipeCategory.en)) || '';
      const categoryText = normalizeCategory(rawCategory, lang);
      const categoryId = r.categoryId || (categoryText && categoryText.toString().toLowerCase().replace(/\s+/g,'-')) || 'other';
      acc.push({
        slug: slug,
        title: (r.title && r.title[lang]) || (r.title && r.title.en) || slug,
        description: (r.description && r.description[lang]) || '',
        category: categoryText,
        categoryId: categoryId,
        cuisine: (r.recipeCuisine && (r.recipeCuisine[lang] || r.recipeCuisine.en)) || '',
        prepTime: r.prepTime || '',
        cookTime: r.cookTime || '',
        yield: (r.recipeYield && (r.recipeYield[lang] || r.recipeYield.en)) || ''
      });
      return acc;
    }, []);

    // featured: full objects for those flagged
    // featured: keep order, dedupe and normalize category for display
    const seenFeatured = new Set();
    const featured = master.recipes.filter(r => r.featuredRecipe).reduce((acc, r) => {
      if (!r.slug || seenFeatured.has(r.slug)) return acc;
      seenFeatured.add(r.slug);
      const rawCategory = (r.recipeCategory && (r.recipeCategory[lang] || r.recipeCategory.en)) || '';
      acc.push({
        slug: r.slug,
        title: (r.title && r.title[lang]) || (r.title && r.title.en) || r.slug,
        description: (r.description && r.description[lang]) || '',
        ingredients: (r.ingredients && r.ingredients[lang]) || [],
        instructions: (r.instructions && r.instructions[lang]) || [],
        category: normalizeCategory(rawCategory, lang),
        cuisine: (r.recipeCuisine && (r.recipeCuisine[lang] || r.recipeCuisine.en)) || '',
        prepTime: r.prepTime || '',
        cookTime: r.cookTime || '',
        totalTime: r.totalTime || '',
        yield: (r.recipeYield && (r.recipeYield[lang] || r.recipeYield.en)) || ''
      });
      return acc;
    }, []);

    const recipesJson = {
      title: lang === 'fr' ? 'Recettes' : (lang === 'ar' ? 'وصفات مميزة' : (lang === 'hy' ? 'Առանձնահատուկ բաղադրատոմսեր' : 'Recipes')),
      viewAllLink: recipeIndexPath(lang),
      viewAllText: lang === 'fr' ? 'Voir toutes les recettes →' : (lang === 'ar' ? 'عرض جميع الوصفات →' : (lang === 'hy' ? 'Դիտել բոլոր բաղադրատոմսերը →' : 'View all recipes →')),
      featured: featured,
      allRecipes: localizedAll
    };

    // write localized recipes json to dist sections so client side can still fetch it
    fs.writeFileSync(path.join(distSectionsRecipes, `recipes.${lang}.json`), JSON.stringify(recipesJson, null, 2), 'utf8');

    // Build all-recipes HTML
    const gridHtml = buildAllRecipesHTML(recipesJson.allRecipes, lang);

    const srcPage = path.join(recipesDir, `all-recipes.${lang}.html`);
    let pageHtml = '';
    if (fs.existsSync(srcPage)) {
      pageHtml = fs.readFileSync(srcPage, 'utf8');
    } else {
      pageHtml = `<!doctype html><html lang="${lang}" dir="${langs[lang].dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>All Recipes</title><link rel="stylesheet" href="../../assets/css/style.css"></head><body><section class="all-recipes-page"><div class="all-recipes-header"><h1>All Recipes</h1></div><div class="all-recipes-grid"></div></section></body></html>`;
    }

    pageHtml = rewriteRecipeIndexPaths(pageHtml, lang);

    let out = pageHtml;
    const idContainerRegex = /<div[^>]*id="all-recipes-container"[^>]*>[\s\S]*?<\/div>/i;
    const classGridRegex = /<div[^>]*class="all-recipes-grid"[^>]*>[\s\S]*?<\/div>/i;

    const containerHtml = `<div class="all-recipes-container">${gridHtml}</div>`;
    if (idContainerRegex.test(pageHtml)) {
      // replace the entire placeholder div with the renderer-style container
      out = pageHtml.replace(idContainerRegex, containerHtml);
    } else if (classGridRegex.test(pageHtml)) {
      out = pageHtml.replace(classGridRegex, containerHtml);
    } else {
      const footerRegex = /<div class="all-recipes-footer">/i;
      if (footerRegex.test(pageHtml)) {
        out = pageHtml.replace(footerRegex, `${gridHtml}\n$&`);
      } else {
        out = pageHtml.replace(/<\/body>/i, `${gridHtml}\n</body>`);
      }
    }

    // Add expand/collapse script before closing body tag
    const expandScript = `
<script>
  document.addEventListener('DOMContentLoaded', function() {
    const expandButtons = document.querySelectorAll('.category-expand-btn');
    
    expandButtons.forEach(function(btn) {
      btn.addEventListener('click', function() {
        const section = this.closest('.recipes-category-section');
        const wrapper = section.querySelector('.recipe-grid-wrapper');
        const isExpanded = this.getAttribute('aria-expanded') === 'true';
        const expandText = this.getAttribute('data-expand-text');
        const collapseText = this.getAttribute('data-collapse-text');
        const textSpan = this.querySelector('.expand-text');
        
        if (isExpanded) {
          // Collapse
          wrapper.classList.remove('expanded');
          wrapper.classList.add('collapsed');
          this.setAttribute('aria-expanded', 'false');
          textSpan.textContent = expandText;
          
          // Smooth scroll to category heading
          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          // Expand
          wrapper.classList.remove('collapsed');
          wrapper.classList.add('expanded');
          this.setAttribute('aria-expanded', 'true');
          textSpan.textContent = collapseText;
        }
      });
    });
  });
</script>`;

    out = out.replace(/<\/body>/i, `${expandScript}\n</body>`);

    const langRecipesDir = path.join(distDir, lang, 'recipes');
    ensureDir(langRecipesDir);

    const outPath = path.join(langRecipesDir, 'index.html');
    fs.writeFileSync(outPath, out, 'utf8');
    console.log(`✓ Generated recipes page: ${lang}/recipes/index.html`);
  });

  // Generate individual recipe pages (localized) with JSON-LD

  master.recipes.forEach(recipe => {
    Object.keys(langs).forEach(lang => {
      const langRecipesDir = path.join(distDir, lang, 'recipes');
      ensureDir(langRecipesDir);

      const title = (recipe.title && recipe.title[lang]) || recipe.title && recipe.title.en || recipe.slug;
      const description = (recipe.description && recipe.description[lang]) || '';
      const ingredients = (recipe.ingredients && recipe.ingredients[lang]) || [];
      const instructions = (recipe.instructions && recipe.instructions[lang]) || [];

      const jsonld = {
        '@context': 'https://schema.org/',
        '@type': 'Recipe',
        name: title,
        // normalize author to canonical build-time name
        author: AUTHOR_OVERRIDE[lang] || 'Shehirian family',
        description: description,
        recipeCategory: (recipe.recipeCategory && recipe.recipeCategory[lang]) || '',
        recipeCuisine: (recipe.recipeCuisine && recipe.recipeCuisine[lang]) || '',
        recipeYield: (recipe.recipeYield && recipe.recipeYield[lang]) || '',
        prepTime: recipe.prepTime || '',
        cookTime: recipe.cookTime || '',
        totalTime: recipe.totalTime || '',
        recipeIngredient: ingredients,
        recipeInstructions: instructions.map(s => ({ '@type': 'HowToStep', text: s }))
      };

      // Write localized JSON-LD into `sections/recipes/` so source JSON-LD files
      // are updated to reflect the canonical author at build-time.
      try {
        const sectionsRecipesDir = path.join(__dirname, 'sections', 'recipes');
        if (!fs.existsSync(sectionsRecipesDir)) fs.mkdirSync(sectionsRecipesDir, { recursive: true });
        const jsonldPath = path.join(sectionsRecipesDir, `${recipe.slug}.${lang}.jsonld`);
        fs.writeFileSync(jsonldPath, JSON.stringify(jsonld, null, 2), 'utf8');
      } catch (e) {
        console.warn('⚠ Failed to write JSON-LD for', recipe.slug, e && e.message);
      }

      // Localized recipe page using the pre-refactor layout (nav + header)
      const page = `<!doctype html>
<html lang="${lang}" dir="${langs[lang].dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <link rel="stylesheet" href="../../assets/css/style.css">
  <script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>
<body>
    <nav class="back-nav">
    <div class="breadcrumb-nav">
  <a href="${homePagePath(lang)}">${lang === 'fr' ? 'Accueil' : (lang === 'ar' ? 'الرئيسية' : (lang === 'hy' ? 'Գլխավոր' : 'Home'))}</a>
      <span>›</span>
      <a href="${recipeIndexPath(lang)}">${lang === 'fr' ? 'Toutes les recettes' : (lang === 'ar' ? 'كل الوصفات' : (lang === 'hy' ? 'Բոլոր բաղադրատոմսերը' : 'All Recipes'))}</a>
      <span>›</span>
      <span>${title}</span>
    </div>
    <div id="language-switcher" class="lang-switcher-nav">
      <a href="${recipePagePath('en', recipe.slug)}" class="flag" title="English" aria-label="English">
        <img src="../../assets/img/flags/gb.svg" alt="English">
        <span class="code">EN</span>
      </a>
      <a href="${recipePagePath('fr', recipe.slug)}" class="flag" title="Français" aria-label="Français">
        <img src="../../assets/img/flags/fr.svg" alt="Français">
        <span class="code">FR</span>
      </a>
      <a href="${recipePagePath('ar', recipe.slug)}" class="flag" title="العربية" aria-label="العربية">
        <img src="../../assets/img/flags/lb.svg" alt="العربية">
        <span class="code">AR</span>
      </a>
      <a href="${recipePagePath('hy', recipe.slug)}" class="flag" title="Հայերեն" aria-label="Հայերեն">
        <img src="../../assets/img/flags/am.svg" alt="Հայերեն">
        <span class="code">HY</span>
      </a>
    </div>
  </nav>

  <main class="recipe-page">
    <header class="recipe-header">
      <h1>${title}</h1>
      <p class="recipe-description">${description}</p>
      <p>
        <strong>${lang === 'fr' ? 'Catégorie' : (lang === 'ar' ? 'الفئة' : (lang === 'hy' ? 'Կատեգորիա' : 'Category'))}:</strong> ${(recipe.recipeCategory && recipe.recipeCategory[lang]) || ''}
        &nbsp; | &nbsp;
        <strong>${lang === 'fr' ? 'Cuisine' : (lang === 'ar' ? 'المطبخ' : (lang === 'hy' ? 'Խոհանոց' : 'Cuisine'))}:</strong> ${(recipe.recipeCuisine && recipe.recipeCuisine[lang]) || ''}
      </p>
      <p>
        <strong>${lang === 'fr' ? 'Temps de préparation' : (lang === 'ar' ? 'وقت التحضير' : (lang === 'hy' ? 'Պատրաստման ժամանակ' : 'Prep Time'))}:</strong> ${formatDuration(recipe.prepTime, lang) || ''}
        &nbsp; | &nbsp;
        <strong>${lang === 'fr' ? 'Temps de cuisson' : (lang === 'ar' ? 'وقت الطهي' : (lang === 'hy' ? 'Եփման ժամանակ' : 'Cook Time'))}:</strong> ${formatDuration(recipe.cookTime, lang) || ''}
        &nbsp; | &nbsp;
        <strong>${lang === 'fr' ? 'Total' : (lang === 'ar' ? 'الإجمالي' : (lang === 'hy' ? 'Ընդհանուր' : 'Total'))}:</strong> ${formatDuration(recipe.totalTime, lang) || ''}
      </p>
    </header>

    <section class="recipe-section recipe-ingredients">
      <h2>${lang === 'fr' ? 'Ingrédients' : (lang === 'ar' ? 'المكونات' : (lang === 'hy' ? 'Բաղադրիչներ' : 'Ingredients'))}</h2>
      <ul>
        ${ingredients.map(i => `<li>${i}</li>`).join('\n')}
      </ul>
    </section>

    <section class="recipe-section recipe-steps recipe-instructions">
      <h2>${lang === 'fr' ? 'Instructions' : (lang === 'ar' ? 'التحضير' : (lang === 'hy' ? 'Հրահանգներ' : 'Instructions'))}</h2>
      <ol>
        ${instructions.map(s => `<li>${s}</li>`).join('\n')}
      </ol>
    </section>

    <footer class="recipe-footer">
      <a class="view-all-btn" href="${recipeIndexPath(lang)}">${lang === 'fr' ? '← Toutes les recettes' : (lang === 'ar' ? '← كل الوصفات' : (lang === 'hy' ? '← Բոլոր բաղադրատոմսերը' : '← All recipes'))}</a>
    </footer>
  </main>
</body>
</html>`;

      const outFile = path.join(langRecipesDir, `${recipe.slug}.html`);
      fs.writeFileSync(outFile, page, 'utf8');
    });
  });
}

writeAllRecipesPages();
writeCertificationPages();
writeProductPages();

// Copy redirect.html to dist/index.html (root redirect)
const redirectSource = path.join(__dirname, 'redirect.html');
const redirectTarget = path.join(distDir, 'index.html');
if (fs.existsSync(redirectSource)) {
  fs.copyFileSync(redirectSource, redirectTarget);
  console.log('✓ Copied redirect.html → dist/index.html');
} else {
  console.warn('⚠ Warning: redirect.html not found, skipping root redirect');
}

console.log('\n✅ Build complete! Output in dist/');
console.log(`   Pages: ${Object.keys(langs).map(l => `${l}/index.html`).join(', ')}`);
console.log('   Root:  index.html (redirect)');