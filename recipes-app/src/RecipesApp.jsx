import { useState } from 'react';
import RecipeList from './RecipeList.jsx';
import RecipeReplica from './RecipeReplica.jsx';
import RecipeApprovalView from './RecipeApprovalView.jsx';
import { getRoles } from './api.js';

export default function RecipesApp() {
  const [selectedSlug, setSelectedSlug] = useState(null);

  const roles = getRoles(window.netlifyIdentity && window.netlifyIdentity.currentUser());
  const isTranslator = roles.includes('translator');
  const isApprover = roles.includes('approver');
  // A mode toggle only makes sense — and only renders — when both roles are
  // present. Translator-only stays byte-identical to pre-Phase-4 behavior.
  // Approver-only skips the toggle and the translate flow entirely: GET
  // /api/recipes and /api/recipes/:slug both require the translator role,
  // so a pure approver landing there would just hit a 403 — going straight
  // to Review avoids that dead end.
  const showModeTabs = isTranslator && isApprover;
  const [mode, setMode] = useState(isTranslator ? 'translate' : 'review');
  const effectiveMode = showModeTabs ? mode : (isTranslator ? 'translate' : 'review');

  return (
    <>
      {showModeTabs && (
        <div className="view-tabs recipes-mode-tabs">
          <button className={`view-tab ${mode === 'translate' ? 'active' : ''}`} onClick={() => setMode('translate')}>Translate</button>
          <button className={`view-tab ${mode === 'review' ? 'active' : ''}`} onClick={() => setMode('review')}>Review</button>
        </div>
      )}
      {effectiveMode === 'review' ? (
        <RecipeApprovalView />
      ) : selectedSlug ? (
        <RecipeReplica slug={selectedSlug} onBack={() => setSelectedSlug(null)} />
      ) : (
        <RecipeList onSelect={setSelectedSlug} />
      )}
    </>
  );
}
