import { createRoot } from 'react-dom/client';
import RecipesApp from './RecipesApp.jsx';

const container = document.getElementById('recipes-root');
if (container) {
  createRoot(container).render(<RecipesApp />);
}
