#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Translate batch 2 of 11 recipes to Armenian
"""

import json
import re

# Extended Armenian translation dictionaries
TRANSLATIONS = {
    # Common cooking terms
    'bulgur': 'ձավար',
    'wheat': 'ցորեն',
    'salad': 'աղցան',
    'hearty': 'հարուստ',
    'pilaf': 'փլավ',
    'spiced': 'համեմունքներով',
    'lentil': 'ոսպ',
    'soup': 'ապուր',
    'carrot': 'գազար',
    'pineapple': 'արքայախնձոր',
    'cole slaw': 'կաղամբի աղցան',
    'raisin': 'չամիչ',
    'chef': 'խոհարար',
    'chefs': 'խոհարարի',
    'dutch': 'հոլանդական',
    'cucumber': 'վարունգ',
    'garden': 'պարտեզային',
    'scotch broth': 'շոտլանդական ապուր',
    'cherry': 'բալ',
    'custard': 'քրեմ',
    'pudding': 'քաղցրավուկ',
    'indian': 'հնդկական',
    'chocolate': 'շոկոլադ',
    'bavarian': 'բավարական',
    'steamed': 'շոգեկեր',
    'fruit': 'մրգային',
    'stuffed': 'լցոնված',
    'peppers': 'պղպեղներ',
    'pepper': 'պղպեղ',
    'meat loaf': 'մսով պիրոգ',
    'salmon': 'սաղմոն',
    'loaf': 'պիրոգ',
    'fish': 'ձուկ',
    'pizza': 'պիցցա',
    'india': 'հնդկական',
    'lamb': 'գառան միս',
    'chicken': 'հավի միս',
    'curry': 'կարի',
    
    # Ingredients
    'cup': 'բաժակ',
    'cups': 'բաժակ',
    'tablespoon': 'ճաշի գդալ',
    'tablespoons': 'ճաշի գդալ',
    'tbsp': 'ճաշի գդալ',
    'teaspoon': 'թեյի գդալ',
    'teaspoons': 'թեյի գդալ',
    'tsp': 'թեյի գդալ',
    'onion': 'սոխ',
    'onions': 'սոխ',
    'water': 'ջուր',
    'boiling water': 'եռացող ջուր',
    'oil': 'ձեթ',
    'olive oil': 'ձիթապտղի ձեթ',
    'vegetable oil': 'բանջարեղենի ձեթ',
    'salt': 'աղ',
    'pepper': 'պղպեղ',
    'butter': 'կարագ',
    'milk': 'կաթ',
    'sugar': 'շաքար',
    'brown sugar': 'շագանակագույն շաքար',
    'egg': 'ձու',
    'eggs': 'ձու',
    'flour': 'ալյուր',
    'baking powder': 'հացի սոդա',
    'baking soda': 'սոդա',
    'vanilla': 'վանիլ',
    'cinnamon': 'դարչին',
    'nutmeg': 'մուշկ',
    'cloves': 'մեխակ',
    'red': 'կարմիր',
    'green': 'կանաչ',
    'white': 'սպիտակ',
    'black': 'սև',
    'chopped': 'մանրացված',
    'finely chopped': 'մանր մանրացված',
    'diced': 'խորանարդիկներով',
    'minced': 'մանրացված',
    'sliced': 'կտրատված',
    'thinly sliced': 'բարակ կտրատված',
    'peeled': 'կլեպած',
    'cooked': 'եփած',
    'uncooked': 'չեփած',
    'fresh': 'թարմ',
    'dried': 'չորացված',
    'canned': 'պահածոյացված',
    'frozen': 'սառեցված',
    'parsley': 'մաղադանոս',
    'mint': 'անանուխ',
    'lemon': 'կիտրոն',
    'lemon juice': 'կիտրոնի հյութ',
    'garlic': 'սխտոր',
    'garlic clove': 'սխտորի ատամ',
    'garlic cloves': 'սխտորի ատամներ',
    'tomato': 'լոլիկ',
    'tomatoes': 'լոլիկներ',
    'tomato sauce': 'լոլիկի սոուս',
    'tomato paste': 'լոլիկի մածուկ',
    'celery': 'նեխուր',
    'lettuce': 'աղցանի տերև',
    'cabbage': 'կաղամբ',
    'peas': 'սնկով',
    'beans': 'լոբի',
    'green beans': 'կանաչ լոբի',
    'rice': 'բրինձ',
    'meat': 'միս',
    'ground meat': 'աղացած միս',
    'ground beef': 'աղացած տավարի միս',
    'ground lamb': 'աղացած գառան միս',
    'beef': 'տավարի միս',
    'chicken breast': 'հավի կրծքամիս',
    'fish': 'ձուկ',
    'cheese': 'պանիր',
    'yogurt': 'մածուն',
    'sour cream': 'թթվեցրած սերուցք',
    'cream': 'սերուցք',
    'heavy cream': 'թանձր սերուցք',
    'vinegar': 'քացախ',
    'mustard': 'մանանեխ',
    'honey': 'մեղր',
    'raisins': 'չամիչ',
    'nuts': 'ընկույզներ',
    'almonds': 'նուշ',
    'walnuts': 'ընկույզ',
    'ginger': 'կծու',
    'turmeric': 'եղինջ',
    'cumin': 'քմոն',
    'paprika': 'պղպեղի փոշի',
    'bay leaf': 'դափնու տերև',
    'bay leaves': 'դափնու տերևներ',
    'thyme': 'ուրց',
    'oregano': 'մեխակաթունչ',
    'basil': 'խնձորաղի',
    'rosemary': 'ոսպնին',
    
    # Cooking verbs
    'combine': 'խառնել',
    'mix': 'խառնել',
    'mix well': 'լավ խառնել',
    'stir': 'խառնել',
    'add': 'ավելացնել',
    'heat': 'տաքացնել',
    'boil': 'եփել',
    'simmer': 'եփել դանդաղ կրակով',
    'cook': 'եփել',
    'bake': 'թխել',
    'fry': 'տապակել',
    'sauté': 'տապակել',
    'brown': 'շագանակագույն դարձնել',
    'chop': 'մանրացնել',
    'dice': 'խորանարդիկներ կտրել',
    'slice': 'կտրատել',
    'peel': 'կլեպել',
    'drain': 'հեղուկը թափել',
    'rinse': 'ողողել',
    'season': 'համեմել',
    'serve': 'մատուցել',
    'let stand': 'թողնել կանգնած',
    'let it stand': 'թողնել կանգնած',
    'bring to a boil': 'եռալու բերել',
    'reduce heat': 'կրակը նվազեցնել',
    'cover': 'ծածկել',
    'uncover': 'բացել',
    'pour': 'լցնել',
    'sprinkle': 'ցրել',
    'spread': 'քսել',
    'place': 'դնել',
    'remove': 'հանել',
    'set aside': 'մի կողմ դնել',
    'refrigerate': 'սառնարանում պահել',
    'freeze': 'սառեցնել',
    'thaw': 'հալեցնել',
    'preheat': 'նախատաքացնել',
    'grease': 'յուղել',
    
    # Time/measurements
    'minute': 'րոպե',
    'minutes': 'րոպե',
    'hour': 'ժամ',
    'hours': 'ժամ',
    'second': 'վայրկյան',
    'seconds': 'վայրկյան',
    'servings': 'պորցիա',
    'serving': 'պորցիա',
    'large': 'մեծ',
    'medium': 'միջին',
    'small': 'փոքր',
    'pound': 'ֆունտ',
    'pounds': 'ֆունտ',
    'ounce': 'ունցիա',
    'ounces': 'ունցիա',
    'quart': 'քվարտ',
    'quarts': 'քվարտ',
    'pint': 'փինթ',
    'pints': 'փինթ',
    'gallon': 'գալոն',
    
    # Descriptions
    'refreshing': 'ուշացուցիչ',
    'delicious': 'համեղ',
    'healthy': 'առողջարար',
    'nutritious': 'սնուցող',
    'comforting': 'հանգստացնող',
    'protein-rich': 'սպիտակուցով հարուստ',
    'perfect for fall': 'կատարյալ աշնանը համար',
    'perfect for': 'կատարյալ',
    'classic': 'դասական',
    'traditional': 'ավանդական',
    'easy': 'հեշտ',
    'quick': 'արագ',
    'simple': 'պարզ',
    'rich': 'հարուստ',
    'creamy': 'քրեմանման',
    'crispy': 'խրթխրթան',
    'soft': 'փափուկ',
    'tender': 'փափուկ',
    'juicy': 'հյութեղ',
    'sweet': 'քաղցր',
    'savory': 'համեղ',
    'spicy': 'սուր',
    'mild': 'մեղմ',
    'hot': 'տաք',
    'cold': 'սառը',
    'warm': 'տաք',
    'cool': 'զովացուցիչ',
    
    # Food/cooking equipment
    'bowl': 'կաթսա',
    'pot': 'կաթսա',
    'pan': 'տապակ',
    'skillet': 'տապակ',
    'baking dish': 'թխման աման',
    'baking sheet': 'թխման թերթ',
    'oven': 'վառարան',
    'stove': 'վառարան',
    'refrigerator': 'սառնարան',
    'freezer': 'սառնարան',
}

def translate_text(text):
    """Translate English text to Armenian"""
    if not text:
        return text
    
    result = text.lower()
    
    # Replace known terms (longer phrases first)
    for eng, arm in sorted(TRANSLATIONS.items(), key=lambda x: -len(x[0])):
        result = result.replace(eng, arm)
    
    # Capitalize first letter
    if result:
        result = result[0].upper() + result[1:]
    
    return result

# Load the JSON file
with open('sections/recipes/all-recipes.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Batch 2 recipes to translate
batch2_slugs = [
    'bulgur-indian-pudding',
    'bulgur-raisin-pudding',
    'chocolate-bulgur-bavarian',
    'steamed-bulgur-fruit-pudding',
    'bulgur-stuffed-peppers',
    'bulgur-meat-loaf',
    'bulgur-salmon-loaf',
    'fish-and-bulgur-pilaf',
    'bulgur-wheat-pizza',
    'india-lamb-pilaf',
    'india-chicken-curry-pilaf'
]

print("Translating batch 2 of 11 recipes...\n")

for recipe in data['recipes']:
    if recipe['slug'] in batch2_slugs:
        print(f"Translating: {recipe['slug']}")
        
        # Translate title if it's the same as English
        if 'hy' in recipe['title'] and recipe['title']['hy'] == recipe['title']['en']:
            recipe['title']['hy'] = translate_text(recipe['title']['en'])
            print(f"  Title: {recipe['title']['en']} → {recipe['title']['hy']}")
        
        # Translate description if it's in English
        if 'hy' in recipe['description'] and recipe['description']['hy'] == recipe['description']['en']:
            recipe['description']['hy'] = translate_text(recipe['description']['en'])
            print(f"  Description translated")
        
        # Translate ingredients
        if 'hy' in recipe['ingredients']:
            translated_ingredients = []
            for ing in recipe['ingredients']['en']:
                translated = translate_text(ing)
                translated_ingredients.append(translated)
            recipe['ingredients']['hy'] = translated_ingredients
            print(f"  Ingredients: {len(translated_ingredients)} items translated")
        
        # Translate instructions
        if 'hy' in recipe['instructions']:
            translated_instructions = []
            for inst in recipe['instructions']['en']:
                translated = translate_text(inst)
                translated_instructions.append(translated)
            recipe['instructions']['hy'] = translated_instructions
            print(f"  Instructions: {len(translated_instructions)} steps translated")
        
        # Translate keywords if they exist
        if 'keywords' in recipe and 'hy' in recipe['keywords']:
            translated_keywords = []
            for kw in recipe['keywords']['en']:
                translated = translate_text(kw)
                translated_keywords.append(translated)
            recipe['keywords']['hy'] = translated_keywords
        
        print()

# Save the updated JSON
with open('sections/recipes/all-recipes.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("✓ Batch 2 complete! Saved to all-recipes.json")
print(f"Translated {len(batch2_slugs)} recipes")
