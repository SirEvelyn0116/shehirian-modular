# Armenian Translation Progress for all-recipes.json

## Status: IN PROGRESS

### Completed Recipes (3/40+):
1. ✅ **Royal Soup** (slug: royal-soup) - COMPLETE
2. ✅ **Armenian Style Lentil Soup** (slug: armenian-style-lentil-soup) - COMPLETE  
3. ✅ **Tabbouleh Salad** (slug: tabbouleh-salad) - COMPLETE

### Remaining Recipes to Translate:

All remaining recipes need Armenian ("hy") translations added for:
- title
- description
- recipeCategory
- recipeCuisine
- recipeYield
- ingredients (array)
- instructions (array)
- keywords (array)

### Armenian Translation Reference Guide:

#### Categories (recipeCategory):
- "Soup" → "Ապուր"
- "Salad" → "Աղցան"
- "Main Dish" / "Main Course" → "Հիմնական ուտեստ"
- "Dessert" → "Կրկեսային"
- "Side Dish" → "Կողային ուտեստ"
- "Casserole" → "Կասերոլ"
- "Starter" → "Նախուտեստ"
- "Pudding" → "Պուդինգ"
- "Other" → "Այլ"

#### Cuisines (recipeCuisine):
- "Armenian" → "Հայկական"
- "Middle Eastern" → "Մերձավոր Արևելյան"
- "American" → "Ամերիկյան"
- "International" → "Միջազգային"
- "Scottish" → "Շոտլանդական"
- "Dutch" → "Հոլանդական"
- "Mediterranean" → "Միջերկրածովյան"
- "Persian" → "Պարսկական"
- "Indian-Inspired" → "Հնդկական ոճի"
- "Chinese-Inspired" → "Չինական ոճի"
- "Spanish-inspired" → "Իսպանական ոճի"
- "Comfort Food" → "Հարմարավետ կերակուր"
- "Baked" → "Թխվածք"

#### Servings (recipeYield):
- "servings" → "պորցիա"
- Pattern: "N servings" → "N պորցիա"

#### Common Ingredients:
- bulgur/bulgur wheat → "ձավարի ցորեն" or "ձավար"
- water → "ջուր"
- salt → "աղ"
- pepper → "պղպեղ"
- onion → "սոխ"
- garlic → "սխտոր"
- lemon → "կիտրոն"
- lemon juice → "կիտրոնի հյուث"
- parsley → "մաղադանոս"
- mint → "անանուխ"
- cup → "բաժակ"
- tablespoon / tbsp → "ճաշի գդալ"
- teaspoon / tsp → "թեյի գդալ"
- chicken → "հավ"
- beef → "տավարի միս"
- lamb → "գառան միս"
- rice → "բրինձ"
- lentils → "ոսպ"
- butter → "կարագ"
- oil → "յուղ"
- olive oil → "ձիթենի յուղ"
- tomato → "լոլիկ"
- cucumber → "վարունգ"
- carrot → "գազար"
- celery → "նեխուր"
- milk → "կաթ"
- egg → "ձու"
- eggs → "ձու"
- cheese → "պանիր"
- sugar → "շաքար"
- flour → "ալյուր"
- chopped → "կտրտած"
- finely chopped → "մանր կտրտած"
- diced → "կտրտած"
- ground → "աղացած"

#### Common Cooking Instructions:
- "Boil" → "Եփել"
- "Simmer" → "Եփել"
- "Add" → "Ավելացնել"
- "Mix" / "Combine" → "Խառնել"
- "Stir" → "Խառնել"
- "Cook" → "Պատրաստել"
- "Bake" → "Թխել"
- "Pour" → "Լցնել"
- "Serve" → "Մատուցել"
- "Chill" → "Սառնարանում պահել"
- "Heat" → "Տաքացնել"
- "Sauté" → "Տապակել"
- "Cover" → "Ծածկել"
- "Remove" → "Հանել"

### Pattern Example for Each Recipe:

```json
{
  "title": {
    "en": "English Title",
    "fr": "French Title",
    "ar": "Arabic Title",
    "hy": "Հայերեն Անվանում"
  },
  "description": {
    "en": "English description",
    "fr": "French description",
    "ar": "Arabic description",
    "hy": "Հայերեն նկարագրություն"
  },
  "recipeCategory": {
    "en": "Category",
    "fr": "Catégorie",
    "ar": "فئة",
    "hy": "Կատեգորիա"
  },
  "recipeCuisine": {
    "en": "Cuisine",
    "fr": "Cuisine FR",
    "ar": "مطبخ",
    "hy": "Խոհանոց"
  },
  "recipeYield": {
    "en": "N servings",
    "fr": "N portions",
    "ar": "N حصص",
    "hy": "N պորցիա"
  },
  "ingredients": {
    "en": ["ingredient 1", "ingredient 2"],
    "fr": ["ingrédient 1", "ingrédient 2"],
    "ar": ["مكون 1", "مكون 2"],
    "hy": ["բաղադրիչ 1", "բաղադրիչ 2"]
  },
  "instructions": {
    "en": ["step 1", "step 2"],
    "fr": ["étape 1", "étape 2"],
    "ar": ["خطوة 1", "خطوة 2"],
    "hy": ["քայլ 1", "քայլ 2"]
  },
  "keywords": {
    "en": ["keyword1", "keyword2"],
    "fr": ["mot-clé1", "mot-clé2"],
    "ar": ["كلمة1", "كلمة2"],
    "hy": ["բառ1", "բառ2"]
  }
}
```

### Remaining Recipes List:

1. Bulgur Wheat Salad
2. Classic Tabbouleh  
3. Hearty Bulgur Pilaf
4. Spiced Lentil Soup
5. Bulgur Carrot Pineapple Salad
6. Cole Slaw with Bulgur
7. Bulgur Carrot Raisin Salad
8. Chef's Bulgur Salad
9. Bulgur Dutch Cucumber Salad
10. Bulgur Garden Salad
11. Scotch Broth with Bulgur Wheat
12. Bulgur Cherry Custard
13. Bulgur Indian Pudding
14. Old-Fashioned Bulgur-Raisin Pudding
15. Chocolate Bulgur Bavarian
16. Steamed Bulgur Fruit Pudding
17. Raw Meat Platter
18. Bulgur Stuffed Peppers
19. Bulgur Meat Loaf
20. Bulgur Salmon Loaf
21. Cabbage Rolls
22. Fish and Bulgur Pilaf
23. Bulgur Wheat Pizza
24. Persian Pilaf
25. India Lamb Pilaf
26. India Chicken Curry Pilaf
27. Bulgur Cheese Casserole
28. Scalloped Bulgur with Wieners
29. Scotch Haggis with Bulgur
30. Armenian Pilaf
31. Chinese Fried Bulgur
32. Boston Baked Bulgur
33. Pilaf Almondine
34. Pilaf Romanoff
35. Spanish Bulgor
36. Bulgor Wheat Shortcake
37. Bulgor Wheat Biscuits
38. White Bread with Bulgor
39. Baked Banana Bulgor Custard
40. Banana Bulgor Cake
41. Bulgor Apricot Delight with Eggnog Sauce

### Next Steps:

To complete all translations efficiently, you can:

1. **Continue manually** - Use the pattern shown in completed recipes to add translations one by one
2. **Use find-replace** - For simple category/cuisine translations
3. **Use the Python script** - The add_armenian_translations.py script can be enhanced with proper translations
4. **Hire a translator** - For more accurate, contextual Armenian translations

### Notes:

- The 3 completed recipes demonstrate the full pattern
- All ingredients and instructions should be translated, not just left in English
- Titles should be culturally appropriate translations, not literal word-for-word
- Some English recipe names may need creative Armenian equivalents
- Consider whether to transliterate certain terms (e.g., "Tabbouleh" → "Թաբուլե")

---

**Created:** 2026-01-30  
**Last Updated:** 2026-01-30  
**Completion:** 3/40+ recipes (7.5%)
