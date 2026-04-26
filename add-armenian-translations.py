import json
import copy

# Translation dictionaries
categories = {
    "Soup": "Ապուր",
    "Salad": "Աղցան",
    "Main Course": "Հիմնական ուտեստ",
    "Main Dish": "Հիմնական ուտեստ",
    "Dessert": "Կրկեսային",
    "Side Dish": "Կողային ուտեստ",
    "Appetizer": "Ախորժակ",
    "Bread": "Հաց"
}

cuisines = {
    "Armenian": "Հայկական",
    "Middle Eastern": "Մերձավոր Արևելյան",
    "American": "Ամերիկյան",
    "International": "Միջազգային",
    "Scottish": "Շոտլանդական",
    "Dutch": "Հոլանդական",
    "Persian": "Պարսկական",
    "Indian": "Հնդկական",
    "Chinese": "Չինական",
    "Spanish": "Իսպանական"
}

# Common ingredient translations
ingredient_translations = {
    "bulgur": "ձավարի ցորեն",
    "bulgor": "ձավարի ցորեն",
    "water": "ջուր",
    "salt": "աղ",
    "pepper": "պղպեղ",
    "onion": "սոխ",
    "garlic": "սխտոր",
    "lemon": "կիտրոն",
    "parsley": "մաղադանոս",
    "mint": "անանուխ",
    "cup": "բաժակ",
    "tablespoon": "ճաշի գդալ",
    "teaspoon": "թեյի գդալ",
    "chicken": "հավ",
    "beef": "տավարի միս",
    "lamb": "գառի միս",
    "carrot": "գազար",
    "celery": "ծելի",
    "tomato": "լոլիկ",
    "cucumber": "վարունգ",
    "lettuce": "աղցան",
    "egg": "ձու",
    "milk": "կաթ",
    "butter": "կարագ",
    "oil": "ձեթ",
    "sugar": "շաքար",
    "flour": "ալյուր",
    "rice": "բրինձ",
    "lentil": "ոսպ",
    "broth": "թանձրացրած ապուր",
    "cheese": "պանիր"
}

def translate_text_basic(text):
    """Basic translation by replacing common words"""
    if not isinstance(text, str):
        return text
    
    translated = text
    for en, hy in ingredient_translations.items():
        # Case insensitive replacement
        translated = translated.replace(en, hy)
        translated = translated.replace(en.capitalize(), hy)
    
    return translated

def add_armenian_to_recipe(recipe):
    """Add Armenian translations to a recipe"""
    modified = False
    
    # Title
    if "title" in recipe and isinstance(recipe["title"], dict):
        if "hy" not in recipe["title"] and "en" in recipe["title"]:
            recipe["title"]["hy"] = translate_text_basic(recipe["title"]["en"])
            modified = True
    
    # Description  
    if "description" in recipe and isinstance(recipe["description"], dict):
        if "hy" not in recipe["description"] and "en" in recipe["description"]:
            recipe["description"]["hy"] = translate_text_basic(recipe["description"]["en"])
            modified = True
    
    # Category
    if "recipeCategory" in recipe and isinstance(recipe["recipeCategory"], dict):
        if "hy" not in recipe["recipeCategory"] and "en" in recipe["recipeCategory"]:
            en_cat = recipe["recipeCategory"]["en"]
            recipe["recipeCategory"]["hy"] = categories.get(en_cat, en_cat)
            modified = True
    
    # Cuisine
    if "recipeCuisine" in recipe and isinstance(recipe["recipeCuisine"], dict):
        if "hy" not in recipe["recipeCuisine"] and "en" in recipe["recipeCuisine"]:
            en_cuisine = recipe["recipeCuisine"]["en"]
            recipe["recipeCuisine"]["hy"] = cuisines.get(en_cuisine, en_cuisine)
            modified = True
    
    # Yield
    if "recipeYield" in recipe and isinstance(recipe["recipeYield"], dict):
        if "hy" not in recipe["recipeYield"] and "en" in recipe["recipeYield"]:
            yield_text = recipe["recipeYield"]["en"]
            # Replace "servings" with "պորցիա"
            yield_hy = yield_text.replace("servings", "պորցիա").replace("serving", "պորցիա")
            recipe["recipeYield"]["hy"] = yield_hy
            modified = True
    
    # Ingredients
    if "ingredients" in recipe and isinstance(recipe["ingredients"], dict):
        if "hy" not in recipe["ingredients"] and "en" in recipe["ingredients"]:
            recipe["ingredients"]["hy"] = [translate_text_basic(ing) for ing in recipe["ingredients"]["en"]]
            modified = True
    
    # Instructions
    if "instructions" in recipe and isinstance(recipe["instructions"], dict):
        if "hy" not in recipe["instructions"] and "en" in recipe["instructions"]:
            recipe["instructions"]["hy"] = [translate_text_basic(inst) for inst in recipe["instructions"]["en"]]
            modified = True
    
    # Keywords
    if "keywords" in recipe and isinstance(recipe["keywords"], dict):
        if "hy" not in recipe["keywords"] and "en" in recipe["keywords"]:
            recipe["keywords"]["hy"] = [translate_text_basic(kw) for kw in recipe["keywords"]["en"]]
            modified = True
    
    return modified

# Read the JSON file
with open("sections/recipes/all-recipes.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# Process each recipe
count = 0
for recipe in data["recipes"]:
    if add_armenian_to_recipe(recipe):
        count += 1

print(f"Added Armenian translations to {count} recipes")

# Write back to file
with open("sections/recipes/all-recipes.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("File updated successfully!")
