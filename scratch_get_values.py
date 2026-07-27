import sys, os, json
sys.path.insert(0, os.path.abspath('.'))

from mcp_servers.ingredient_analyzer import analyze_ingredient

def print_res(name, ingredients):
    res = analyze_ingredient([{'item': name, 'ingredients': ingredients}])[0]
    print(f"{name}: Cals={res.calories}, P={res.protein}, C={res.carbs}, F={res.fat}")

print_res('Chicken', ['100 g chicken breast'])
print_res('Egg', ['1 egg'])
print_res('Rice', ['1 cup white rice'])
print_res('Cheese', ['1 oz cheddar cheese'])
print_res('Oil', ['1 tbsp olive oil'])
print_res('Cheeseburger', [
    '6 oz ground beef patty', '1 slice cheddar cheese', '1 hamburger bun', 
    '1 large leaf lettuce', '2 slices tomato', '1 tbsp ketchup', 
    '1 tbsp mayonnaise', '1 tsp mustard'
])
print_res('Breakfast', ['2 egg', '2 slices bacon', '1 slice bread'])
print_res('Chicken Salad', ['6 oz chicken breast', '2 cups lettuce', '1 tbsp olive oil'])
