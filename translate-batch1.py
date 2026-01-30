#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Translate first batch of 11 recipes to Armenian
"""

import json

# Armenian translation dictionaries
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
    'salt': 'աղ',
    'pepper': 'պղպեղ',
    'butter': 'կարագ',
    'milk': 'կաթ',
    'sugar': 'շաքար',
    'egg': 'ձու',
    'eggs': 'ձու',
    'flour': 'ալյուր',
    'red': 'կարմիր',
    'green': 'կանաչ',
    'white': 'սպիտակ',
    'black': 'սև',
    'chopped': 'մանրացված',
    'diced': 'խորանարդիկներով',
    'minced': 'մանրացված',
    'sliced': 'կտրատված',
    'peeled': 'կլեպած',
    'cooked': 'եփած',
    'uncooked': 'չեփած',
    'fresh': 'թարմ',
    'dried': 'չորացված',
    'canned': 'պահածոյացված',
    'parsley': 'մաղադանոս',
    'mint': 'անանուխ',
    'lemon': 'կիտրոն',
    'garlic': 'սխտոր',
    'tomato': 'լոլիկ',
    'tomatoes': 'լոլիկ',
    'celery': 'նեխուր',
    'lettuce': 'աղցանի տերև',
    'cabbage': 'կաղամբ',
    'peas': 'սնկով',
    'beans': 'լոբի',
    'rice': 'բրինձ',
    'meat': 'միս',
    'chicken': 'հավի միս',
    'beef': 'տավարի միս',
    'lamb': 'գառան միս',
    'fish': 'ձուկ',
    'cheese': 'պանիր',
    'yogurt': 'մածուն',
    'cream': 'սերուցք',
    'vinegar': 'քացախ',
    'mustard': 'մանանեխ',
    'honey': 'մեղր',
    'raisins': 'չամիչ',
    'nuts': 'ընկույզներ',
    'almonds': 'նուշ',
    'walnuts': 'ընկույզ',
    
    # Cooking verbs
    'combine': 'խառնել',
    'mix': 'խառնել',
    'stir': 'խառնել',
    'add': 'ավելացնել',
    'heat': 'տաքացնել',
    'boil': 'եփել',
    'simmer': 'եփել դանդաղ կրակով',
    'cook': 'եփել',
    'bake': 'թխել',
    'fry': 'տապակել',
    'sauté': 'տապակել',
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
    
    # Time/measurements
    'minute': 'րոպե',
    'minutes': 'րոպե',
    'hour': 'ժամ',
    'hours': 'ժամ',
    'servings': 'պորցիա',
    'serving': 'պորցիա',
    'large': 'մեծ',
    'medium': 'միջին',
    'small': 'փոքր',
    
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
}

def translate_text(text):
    """Translate English text to Armenian"""
    if not text:
        return text
    
    result = text.lower()
    
    # Replace known terms
    for eng, arm in sorted(TRANSLATIONS.items(), key=lambda x: -len(x[0])):
        result = result.replace(eng, arm)
    
    # Capitalize first letter
    if result:
        result = result[0].upper() + result[1:]
    
    return result

# Load the JSON file
with open('sections/recipes/all-recipes.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# First batch of 11 recipes to translate
batch1_slugs = [
    'bulgur-wheat-salad',
    'hearty-bulgur-pilaf',
    'spiced-lentil-soup',
    'bulgur-carrot-pineapple-salad',
    'cole-slaw-bulgur',
    'bulgur-carrot-raisin-salad',
    'chefs-bulgur-salad',
    'bulgur-dutch-cucumber-salad',
    'bulgur-garden-salad',
    'scotch-broth',
    'bulgur-cherry-custard'
]

print("Translating batch 1 of 11 recipes...\n")

for recipe in data['recipes']:
    if recipe['slug'] in batch1_slugs:
        print(f"Translating: {recipe['slug']}")
        
        # Translate title if it has mixed content
        if 'hy' in recipe['title'] and recipe['title']['hy'] == recipe['title']['en']:
            recipe['title']['hy'] = translate_text(recipe['title']['en'])
            print(f"  Title: {recipe['title']['en']} → {recipe['title']['hy']}")
        
        # Translate description if it's in English
        if 'hy' in recipe['description'] and recipe['description']['hy'] == recipe['description']['en']:
            recipe['description']['hy'] = translate_text(recipe['description']['en'])
            print(f"  Description translated")
        
        # Translate ingredients if they're in English or mixed
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

print("✓ Batch 1 complete! Saved to all-recipes.json")
print(f"Translated {len(batch1_slugs)} recipes")
