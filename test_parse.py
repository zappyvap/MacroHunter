from mcp_servers.ingredient_analyzer import parse_ingredient_weight
print(parse_ingredient_weight("1.0 piece Bun, hamburger"))
print(parse_ingredient_weight("1.6 oz Beef, ground, raw"))
print(parse_ingredient_weight("2.0 slice Cheese, american"))
