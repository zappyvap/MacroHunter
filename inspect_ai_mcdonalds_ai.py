import json
from mcp_servers.chain_reader import estimate_menu_via_ai

menu_json = estimate_menu_via_ai("McDonald's (AI)")
menu = json.loads(menu_json)

for item in menu:
    print(f"Item: {item['name']}")
    print(f"  Calories: {item['calories']}")
    print(f"  Protein:  {item['protein']}")
    print(f"  Carbs:    {item['carbs']}")
    print(f"  Fats:     {item['fats']}")
