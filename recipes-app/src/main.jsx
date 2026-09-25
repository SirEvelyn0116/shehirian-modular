import { createRoot } from 'react-dom/client';
import RecipesApp, { useIdentityRoles } from './RecipesApp.jsx';
import OpsBanner from './OpsBanner.jsx';

const container = document.getElementById('recipes-root');
if (container) {
  createRoot(container).render(<RecipesApp />);
}

// Demo operations pulse — its own mount point above the dashboard's top-level
// UI Strings / Recipes tabs (admin/index.html), so an approver sees it first
// whichever tab is open. Approver role only; renders nothing for others.
function ApproverOpsBanner() {
  const { ready, roles } = useIdentityRoles();
  return ready && roles.includes('approver') ? <OpsBanner /> : null;
}

const bannerRoot = document.getElementById('ops-banner-root');
if (bannerRoot) {
  createRoot(bannerRoot).render(<ApproverOpsBanner />);
}
