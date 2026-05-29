import pulp
from mcp.server.fastmcp import FastMCP
from typing import List, Dict, Any

mcp = FastMCP("Calorie Optimizer")

@mcp.tool()
def optimizer(
    menu_items: List[Dict[str, Any]], 
    target_calories: float, 
    target_protein: float, 
    target_carbs: float, 
    target_fats: float
) -> dict:
    """
     This tool takes in a menu with macros and prices, along with a target macro goal,
     and uses linear programming to find the optimal combination of menu items that meets the macro goals at the lowest cost.
     The menu_items input should be a list of dictionaries, each with the following structure:
     {
        "restaurant": "Restaurant Name",
        "name": "Food Item Name",
        "protein": grams of protein,
        "carbs": grams of carbs,
        "fats": grams of fats,
        "calories": total calories,
        "price": cost of the item
     }
     
     """
    # makes the model
    prob = pulp.LpProblem("Best_Effort_Macro_Optimization", pulp.LpMinimize)
    
    # this makes the decision variables, which is just the amount of each food
    # basically it can only change the amount of items we buy not changing the actual menu
    item_vars = pulp.LpVariable.dicts("Qty", [i["name"] for i in menu_items], lowBound=0, cat='Integer')
    
    # this makes the varibles that measures the gap in the goal
    slack_p = pulp.LpVariable("Slack_Protein", lowBound=0)
    slack_c = pulp.LpVariable("Slack_Carbs", lowBound=0)
    slack_f = pulp.LpVariable("Slack_Fats", lowBound=0)
    slack_cal = pulp.LpVariable("Slack_Calories", lowBound=0)

    # the higher the penalty, the harder the solver tries to hit that specific target.
    # this is just prioitizing protein and carbs more than fats
    penalty_p = 10000  
    penalty_c = 8000   
    penalty_f = 5000    
    penalty_cal = 10000

    # this is the objective function
    # it justs compares all the different combinations and sees which is the best
    prob += (
        pulp.lpSum([item["price"] * item_vars[item["name"]] for item in menu_items]) +
        (penalty_p * slack_p) + 
        (penalty_c * slack_c) + 
        (penalty_f * slack_f) +
        (penalty_cal * slack_cal)
    )

    # this makes the constraints
    # "each macro must equal the total amount from our food plus the slack or greater"
    # the calories have a strict less than restraint so you can't go over your calorie goal to hit you macros
    prob += pulp.lpSum([i["protein"] * item_vars[i["name"]] for i in menu_items]) + slack_p >= target_protein
    prob += pulp.lpSum([i["carbs"] * item_vars[i["name"]] for i in menu_items]) + slack_c >= target_carbs
    prob += pulp.lpSum([i["fats"] * item_vars[i["name"]] for i in menu_items]) + slack_f >= target_fats
    prob += pulp.lpSum([i["calories"] * item_vars[i["name"]] for i in menu_items]) - slack_cal <= target_calories



    # solves it
    prob.solve(pulp.PULP_CBC_CMD(msg=False))

    # Parse results
    final_order = []
    for item in menu_items:
        qty = item_vars[item["name"]].varValue
        if qty and qty > 0:
            final_order.append({"item": item["name"], "quantity": int(qty)})

    # Calculate what we actually achieved
    actual_p = sum(i["protein"] * item_vars[i["name"]].varValue for i in menu_items)
    actual_c = sum(i["carbs"] * item_vars[i["name"]].varValue for i in menu_items)
    actual_f = sum(i["fats"] * item_vars[i["name"]].varValue for i in menu_items)
    actual_cal = sum(i["calories"] * item_vars[i["name"]].varValue for i in menu_items)

    # returns readable json for the AI to parse.
    return {
        "status": "Optimal" if (slack_p.varValue + slack_c.varValue + slack_f.varValue) == 0 else "Best Effort",
        "total_cost": round(pulp.value(pulp.lpSum([item["price"] * item_vars[item["name"]] for item in menu_items])), 2),
        "achieved_macros": {"cal" : actual_cal, "p": actual_p, "c": actual_c, "f": actual_f},
        "gaps": {"cal" : slack_cal.varValue, "p": slack_p.varValue, "c": slack_c.varValue, "f": slack_f.varValue},
        "order": final_order,
        "restaurant": menu_items[0]["restaurant"]
        
    }

if __name__ == "__main__":
    # This runs the server so LangGraph can connect to it
    mcp.run()

