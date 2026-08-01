import { useState } from 'react';
import RecipeList from './RecipeList.jsx';
import RecipeReplica from './RecipeReplica.jsx';

export default function RecipesApp() {
  const [selectedSlug, setSelectedSlug] = useState(null);

  return selectedSlug
    ? <RecipeReplica slug={selectedSlug} onBack={() => setSelectedSlug(null)} />
    : <RecipeList onSelect={setSelectedSlug} />;
}
