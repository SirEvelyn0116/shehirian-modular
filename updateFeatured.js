// Build-time script to update featured recipes based on click counts
// Marks the top recipe in each category (Soup, Main, Dessert) as featured

const fs = require('fs');
const path = require('path');

// Configuration
const RECIPES_FILE = path.join(__dirname, 'sections', 'recipes', 'all-recipes.json');
const COUNTERS_FILE = path.join(__dirname, 'serverless', 'data', 'counters.json');
const BACKUP_DIR = path.join(__dirname, '.backups');

// Category mapping - maps categoryId to category group
const CATEGORY_GROUPS = {
  'soup': 'soup',
  'salad': 'other',
  'main': 'main',
  'starter': 'other',
  'dessert': 'dessert',
  'side': 'other',
  'other': 'other'
};

// Featured categories - only these get automatic featured selection
const FEATURED_CATEGORIES = ['soup', 'main', 'dessert'];

/**
 * Load JSON file with error handling
 */
function loadJSON(filePath, defaultValue = null) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT' && defaultValue !== null) {
      console.warn(`⚠ File not found: ${filePath}, using default value`);
      return defaultValue;
    }
    throw new Error(`Failed to load ${filePath}: ${err.message}`);
  }
}

/**
 * Save JSON file with backup
 */
function saveJSON(filePath, data) {
  // Create backup
  if (fs.existsSync(filePath)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `${path.basename(filePath)}.${timestamp}.backup`);
    
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    fs.copyFileSync(filePath, backupFile);
    console.log(`📦 Backup created: ${backupFile}`);
  }

  // Save updated file
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`✓ Saved: ${filePath}`);
}

/**
 * Get category group for a recipe
 */
function getCategoryGroup(recipe) {
  const categoryId = recipe.categoryId || 'other';
  return CATEGORY_GROUPS[categoryId] || 'other';
}

/**
 * Update featured recipes based on click counts
 */
function updateFeaturedRecipes() {
  console.log('🔨 Updating featured recipes based on click counts...\n');

  // Load data
  const recipesData = loadJSON(RECIPES_FILE);
  const counters = loadJSON(COUNTERS_FILE, {});
  
  if (!recipesData || !recipesData.recipes) {
    throw new Error('Invalid recipes file structure - missing "recipes" array');
  }

  const recipes = recipesData.recipes;
  console.log(`📊 Loaded ${recipes.length} recipes`);
  console.log(`📈 Loaded ${Object.keys(counters).length} click counters\n`);

  // Group recipes by category
  const recipesByCategory = {};
  recipes.forEach(recipe => {
    const group = getCategoryGroup(recipe);
    if (!recipesByCategory[group]) {
      recipesByCategory[group] = [];
    }
    recipesByCategory[group].push(recipe);
  });

  // Reset all featured flags first
  recipes.forEach(recipe => {
    recipe.featuredRecipe = false;
  });

  // For each featured category, find top recipe by clicks
  const updatedCategories = [];
  
  FEATURED_CATEGORIES.forEach(category => {
    const categoryRecipes = recipesByCategory[category] || [];
    
    if (categoryRecipes.length === 0) {
      console.warn(`⚠ No recipes found in category: ${category}`);
      return;
    }

    // Sort by click count (descending)
    const sorted = categoryRecipes
      .map(recipe => ({
        recipe,
        clicks: (counters[recipe.slug]?.count || 0)
      }))
      .sort((a, b) => b.clicks - a.clicks);

    // Mark top recipe as featured
    const topRecipe = sorted[0];
    topRecipe.recipe.featuredRecipe = true;
    
    updatedCategories.push({
      category,
      slug: topRecipe.recipe.slug,
      title: topRecipe.recipe.title?.en || topRecipe.recipe.slug,
      clicks: topRecipe.clicks
    });

    console.log(`✓ ${category.toUpperCase()}: "${topRecipe.recipe.title?.en || topRecipe.recipe.slug}" (${topRecipe.clicks} clicks)`);
  });

  // Save updated recipes
  console.log('\n💾 Saving updated recipes...');
  saveJSON(RECIPES_FILE, recipesData);

  // Summary
  console.log('\n✅ Featured recipe update complete!');
  console.log(`   Updated ${updatedCategories.length} categories: ${FEATURED_CATEGORIES.join(', ')}`);
  
  // Show stats
  const totalClicks = Object.values(counters).reduce((sum, c) => sum + c.count, 0);
  console.log(`\n📊 Click Statistics:`);
  console.log(`   Total clicks tracked: ${totalClicks}`);
  console.log(`   Unique recipes clicked: ${Object.keys(counters).length}`);
  
  // Show top 5 overall
  const topOverall = Object.entries(counters)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);
  
  if (topOverall.length > 0) {
    console.log(`\n🏆 Top 5 recipes overall:`);
    topOverall.forEach(([slug, data], i) => {
      const recipe = recipes.find(r => r.slug === slug);
      const title = recipe?.title?.en || slug;
      console.log(`   ${i + 1}. ${title} (${data.count} clicks)`);
    });
  }

  return {
    success: true,
    categoriesUpdated: updatedCategories,
    totalClicks,
    recipesTracked: Object.keys(counters).length
  };
}

// Main execution
if (require.main === module) {
  try {
    const result = updateFeaturedRecipes();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error updating featured recipes:', error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Export for use in other scripts
module.exports = { updateFeaturedRecipes };
