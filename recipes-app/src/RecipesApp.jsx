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
  // The recipe list is now reachable by either role (published-flag stage
  // 3): translators use it to pick a recipe to edit, approvers use it to
  // see and toggle publish status per language. GET /api/recipes/:slug (the
  // full replica editor) stays translator-only, so an approver-only account
  // clicking into a recipe would still just 403 — RecipeList below only
  // wires up row-click navigation when isTranslator, avoiding that dead end
  // exactly like the old approver-only-skips-translate-entirely behavior
  // did, just one level more precise now that the list itself isn't gated.
  const canSeeList = isTranslator || isApprover;
  const canSeeReview = isApprover;
  // A mode toggle only makes sense — and only renders — when there's more
  // than one destination to switch between.
  const showModeTabs = canSeeList && canSeeReview;
  const [mode, setMode] = useState('list');
  const effectiveMode = showModeTabs ? mode : (canSeeList ? 'list' : 'review');
  // Translator-only sees "Translate" (unchanged label/behavior from before
  // stage 3). Approver-only sees "Publish" instead — same underlying list,
  // but there's nothing to "translate" for that role, just publish status
  // to review and toggle.
  const listTabLabel = isTranslator ? 'Translate' : 'Publish';

  if (!ready) {
    return <div className="recipes-loading">Checking your access…</div>;
  }

  return (
    <>
      {showModeTabs && (
        <div className="view-tabs recipes-mode-tabs">
          <button className={`view-tab ${mode === 'list' ? 'active' : ''}`} onClick={() => setMode('list')}>{listTabLabel}</button>
          <button className={`view-tab ${mode === 'review' ? 'active' : ''}`} onClick={() => setMode('review')}>Review</button>
        </div>
      )}
      {effectiveMode === 'review' ? (
        <RecipeApprovalView />
      ) : selectedSlug ? (
        <RecipeReplica slug={selectedSlug} onBack={() => setSelectedSlug(null)} />
      ) : (
        <RecipeList onSelect={isTranslator ? setSelectedSlug : undefined} showPublishControls={isApprover} />
      )}
    </>
  );
}
