import { useEffect, useRef, useState } from 'react';
import buildRecipePageHtml from './recipePageHtml.js';

const LABEL_KEYS = [
  'meta_category', 'meta_cuisine', 'meta_prep_time', 'meta_cook_time', 'meta_total_time',
  'section_ingredients', 'section_instructions', 'btn_back_to_all_recipes',
];

// ui-strings.json is a static file served alongside the site (same source
// the real recipe pages' t() labels come from at build time) — no auth
// needed, same as admin.js's plain fetch('/metadata.json').
function useLabels(lang) {
  const [labels, setLabels] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/ui-strings.json')
      .then(r => r.json())
      .then(strings => {
        if (cancelled) return;
        const picked = {};
        LABEL_KEYS.forEach(key => { picked[key] = strings[key] && strings[key][lang]; });
        setLabels(picked);
      })
      .catch(() => { if (!cancelled) setLabels({}); }); // fall back to buildRecipePageHtml's English defaults
    return () => { cancelled = true; };
  }, [lang]);
  return labels;
}

// Renders in an <iframe srcDoc> — not inline in the React tree — so the
// real site stylesheet (/assets/css/style.css) governs a genuinely
// independent <html>/<body>, matching the real recipe page's actual DOM
// shape. Inlining this markup into the admin dashboard's shared body would
// mean fighting the admin shell's own body for any body-scoped CSS and
// would put dir="rtl" on the admin page itself if we tried to match the
// real template's placement of dir on <html>.
export default function RecipePagePreview({ recipe, lang, dir }) {
  const labels = useLabels(lang);
  const iframeRef = useRef(null);
  const [height, setHeight] = useState(600);

  const html = labels ? buildRecipePageHtml(recipe, lang, dir, labels) : null;

  function handleLoad() {
    const doc = iframeRef.current && iframeRef.current.contentDocument;
    if (doc && doc.documentElement) {
      setHeight(doc.documentElement.scrollHeight);
    }
  }

  if (!html) return <div className="recipes-loading">Loading preview…</div>;

  return (
    <iframe
      ref={iframeRef}
      className="recipe-page-preview-frame"
      title="Recipe page preview"
      srcDoc={html}
      onLoad={handleLoad}
      style={{ height }}
    />
  );
}
