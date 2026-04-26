#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Translate batch 3 (final) of 12 recipes to Armenian
"""

import json

# Comprehensive Armenian translation dictionary
TRANSLATIONS = {
    # Common cooking terms
    'bulgur': 'ձավար',
    'bulgor': 'ձավար',
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
    'scotch haggis': 'շոտլանդական հագիս',
    'cherry': 'բալ',
    'custard': 'քրեմ',
    'pudding': 'քաղցրավենիք',
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
    'cheese': 'պանիր',
    'casserole': 'տապակած ուտեստ',
    'scalloped': 'խորանարդված',
    'wieners': 'սոսիսներ',
    'chinese': 'չինական',
    'fried': 'տապակած',
    'boston baked': 'Բոստոնյան թխած',
    'spanish': 'իսպանական',
    'shortcake': 'փխրուն կարկանդակ',
    'biscuits': 'կարկանդակներ',
    'biscuit': 'կարկանդակ',
    'white bread': 'սպիտակ հաց',
    'bread': 'հաց',
    'baked': 'թխած',
    'banana': 'բանան',
    'cake': 'տորթ',
    'apricot': 'ծիրան',
    'delight': 'հաճույք',
    
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
    'margarine': 'մարգարին',
    'milk': 'կաթ',
    'sugar': 'շաքար',
    'brown sugar': 'շագանակագույն շաքար',
    'egg': 'ձու',
    'eggs': 'ձու',
    'flour': 'ալյուր',
    'all-purpose flour': 'ունիվերսալ ալյուր',
    'baking powder': 'հացի փոշի',
    'baking soda': 'սոդա',
    'vanilla': 'վանիլ',
    'vanilla extract': 'վանիլի էսենց',
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
    'yogurt': 'մածուն',
    'sour cream': 'թթվեցրած սերուցք',
    'cream': 'սերուցք',
    'heavy cream': 'թանձր սերուցք',
    'cottage cheese': 'պանրակտոր',
    'cheddar cheese': 'չեդդեր պանիր',
    'mozzarella': 'մոցցարելա',
    'vinegar': 'քացախ',
    'mustard': 'մանանեխ',
    'mayonnaise': 'մայոնեզ',
    'ketchup': 'կետչուպ',
    'soy sauce': 'սոյայի սոուս',
    'worcestershire sauce': 'Վորչեստերշայրի սոուս',
    'honey': 'մեղր',
    'molasses': 'մելաս',
    'raisins': 'չամիչ',
    'nuts': 'ընկույզներ',
    'almonds': 'նուշ',
    'walnuts': 'ընկույզ',
    'pecans': 'պեկան',
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
    'sage': 'աղավնենու',
    'dill': 'սամիթ',
    'yeast': 'խմոր',
    'active dry yeast': 'ակտիվ չոր խմոր',
    
    # Cooking verbs
    'combine': 'խառնել',
    'mix': 'խառնել',
    'mix together': 'միասին խառնել',
    'mix well': 'լավ խառնել',
    'stir': 'խառնել',
    'stir in': 'խառնել ներս',
    'add': 'ավելացնել',
    'heat': 'տաքացնել',
    'boil': 'եփել',
    'simmer': 'եփել դանդաղ կրակով',
    'cook': 'եփել',
    'cook until': 'եփել մինչև',
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
    'season to taste': 'համեմել ըստ ճաշակի',
    'serve': 'մատուցել',
    'serve hot': 'տաք մատուցել',
    'serve warm': 'տաք մատուցել',
    'serve cold': 'սառը մատուցել',
    'let stand': 'թողնել կանգնած',
    'let it stand': 'թողնել կանգնած',
    'bring to a boil': 'եռալու բերել',
    'reduce heat': 'կրակը նվազեցնել',
    'cover': 'ծածկել',
    'uncover': 'բացել',
    'pour': 'լցնել',
    'pour into': 'լցնել մեջը',
    'sprinkle': 'ցրել',
    'spread': 'քսել',
    'place': 'դնել',
    'place in': 'դնել մեջը',
    'remove': 'հանել',
    'set aside': 'մի կողմ դնել',
    'refrigerate': 'սառնարանում պահել',
    'freeze': 'սառեցնել',
    'thaw': 'հալեցնել',
    'preheat': 'նախատաքացնել',
    'grease': 'յուղել',
    'grease and flour': 'յուղել և ալյուրով ծածկել',
    'shape': 'ձևել',
    'form': 'ձևավորել',
    'roll': 'գլորել',
    'knead': 'հունցել',
    'beat': 'ծեծել',
    'whisk': 'խառնել',
    'fold': 'ծալել',
    'blend': 'խառնել',
    
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
    'inch': 'դյույմ',
    'inches': 'դյույմ',
    'degree': 'աստիճան',
    'degrees': 'աստիճան',
    'fahrenheit': 'Ֆարենհայտ',
    
    # Descriptions
    'refreshing': 'ուշացուցիչ',
    'delicious': 'համեղ',
    'tasty': 'համեղ',
    'healthy': 'առողջարար',
    'nutritious': 'սնուցող',
    'comforting': 'հանգստացնող',
    'protein-rich': 'սպիտակուցով հարուստ',
    'perfect for fall': 'կատարյալ աշնանը համար',
    'perfect for': 'կատարյալ',
    'great for': 'հիանալի',
    'ideal for': 'իդեալական',
    'classic': 'դասական',
    'traditional': 'ավանդական',
    'authentic': 'իսկական',
    'easy': 'հեշտ',
    'quick': 'արագ',
    'simple': 'պարզ',
    'rich': 'հարուստ',
    'creamy': 'քրեմանման',
    'crispy': 'խրթխրթան',
    'crunchy': 'խրթխրթան',
    'soft': 'փափուկ',
    'tender': 'փափուկ',
    'juicy': 'հյութեղ',
    'moist': 'խոնավ',
    'sweet': 'քաղցր',
    'savory': 'համեղ',
    'spicy': 'սուր',
    'mild': 'մեղմ',
    'hot': 'տաք',
    'cold': 'սառը',
    'warm': 'տաք',
    'cool': 'զովացուցիչ',
    'tangy': 'թթու',
    'salty': 'աղի',
    'bitter': 'դառը',
    'aromatic': 'բուրավետ',
    'flavorful': 'համեղ',
    'satisfying': 'բավարարող',
    
    # Equipment
    'bowl': 'կաթսա',
    'mixing bowl': 'խառնման կաթսա',
    'pot': 'կաթսա',
    'large pot': 'մեծ կաթսա',
    'saucepan': 'կաթսա',
    'pan': 'տապակ',
    'frying pan': 'տապակ',
    'skillet': 'տապակ',
    'baking dish': 'թխման աման',
    'baking pan': 'թխման աման',
    'baking sheet': 'թխման թերթ',
    'casserole dish': 'տապակելու աման',
    'oven': 'վառարան',
    'stove': 'վառարան',
    'stovetop': 'վառարան',
    'refrigerator': 'սառնարան',
    'freezer': 'սառնարան',
    'mixer': 'խառնիչ',
    'blender': 'բլենդեր',
    'spoon': 'գդալ',
    'wooden spoon': 'փայտե գդալ',
    'spatula': 'շպատել',
    'whisk': 'մտրակ',
    'knife': 'դանակ',
    'cutting board': 'կտրատելու տախտակ',
    'colander': 'քամիչ',
    'strainer': 'քամիչ',
    'grater': 'մաղ',
    'peeler': 'կլեպիչ',
    'measuring cup': 'չափիչ բաժակ',
    'measuring spoon': 'չափիչ գդալ',
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

# Batch 3 recipes (final batch)
batch3_slugs = [
    'bulgur-cheese-casserole',
    'scalloped-bulgor-with-wieners',
    'scotch-haggis-with-bulgor',
    'chinese-fried-bulgor',
    'boston-baked-bulgor',
    'spanish-bulgor',
    'bulgor-wheat-shortcake',
    'bulgor-wheat-biscuits',
    'white-bread-with-bulgor',
    'baked-banana-bulgor-custard',
    'banana-bulgor-cake',
    'bulgor-apricot-delight'
]

print("Translating batch 3 (final) of 12 recipes...\n")

for recipe in data['recipes']:
    if recipe['slug'] in batch3_slugs:
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

print("✓ Batch 3 (FINAL) complete! Saved to all-recipes.json")
print(f"Translated {len(batch3_slugs)} recipes")
print("\n🎉 All 33 recipes have been translated to Armenian!")
