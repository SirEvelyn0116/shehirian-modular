import { useEffect, useState } from 'react';
import RecipeList from './RecipeList.jsx';
import RecipeReplica from './RecipeReplica.jsx';
import RecipeApprovalView from './RecipeApprovalView.jsx';
import { getRoles } from './api.js';

// Netlify Identity restores an existing session ASYNCHRONOUSLY — it has to
// validate/refresh the cached JWT, which takes real time. Reading
// currentUser() synchronously at mount can catch it mid-restoration: a fast
// render sees roles=[] even though the visitor IS logged in, defaults to
// the wrong view, and fires a request that gets rejected — surfacing as a
// confusing "couldn't load, try again" error that a reload then "fixes"
// (by then the async check has settled). admin.js already avoids this for
// the ui-strings view by only revealing UI on the widget's 'login' event;
// this hook does the equivalent for the Recipes view: don't trust roles
// until we have a definitive answer, either because currentUser() is
// already populated (true immediately for the local auth-stub, which sets
// it synchronously with no async gap — see scripts/dev-server.js) or
// because the widget's own 'init'/'login' events fired.
function useIdentityRoles() {
  const [state, setState] = useState(() => {
    const widget = window.netlifyIdentity;
    const user = widget && widget.currentUser && widget.currentUser();
    return user ? { ready: true, roles: getRoles(user) } : { ready: false, roles: [] };
  });

  useEffect(() => {
    const widget = window.netlifyIdentity;
    if (!widget || state.ready) return;

    function resolve(user) {
      setState({ ready: true, roles: getRoles(user) });
    }

    widget.on('init', resolve);
    widget.on('login', resolve);
    return () => {
      if (widget.off) {
        widget.off('init', resolve);
        widget.off('login', resolve);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}

export default function RecipesApp() {
  const [selectedSlug, setSelectedSlug] = useState(null);
  const { ready, roles } = useIdentityRoles();

  const isTranslator = roles.includes('translator');
  const isApprover = roles.includes('approver');
  // A mode toggle only makes sense — and only renders — when both roles are
  // present. Translator-only stays byte-identical to pre-Phase-4 behavior.
  // Approver-only skips the toggle and the translate flow entirely: GET
  // /api/recipes and /api/recipes/:slug both require the translator role,
  // so a pure approver landing there would just hit a 403 — going straight
  // to Review avoids that dead end.
  const showModeTabs = isTranslator && isApprover;
  const [mode, setMode] = useState('translate');
  const effectiveMode = showModeTabs ? mode : (isTranslator ? 'translate' : 'review');

  if (!ready) {
    return <div className="recipes-loading">Checking your access…</div>;
  }

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
