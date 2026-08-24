import os
from mcp_servers.chain_reader import estimate_menu_via_ai
import json

menu_json = estimate_menu_via_ai("McDonald's")
menu = json.loads(menu_json)

for item in menu:
    print(f"Item: {item['name']}")
    print(f"  Calories: {item['calories']}")
    print(f"  Protein:  {item['protein']}")
    print(f"  Carbs:    {item['carbs']}")
    print(f"  Fats:     {item['fats']}")
    print("-" * 20)
