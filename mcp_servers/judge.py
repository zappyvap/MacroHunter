from mcp.server.fastmcp import FastMCP

mcp = FastMCP("Judge")

# the keys we check to calculate how far off each order is from the user's macro targets
GAP_KEYS     = ("p", "c", "f")
TIEBREAK_KEY = "total_cost"

# this tool takes all the optimized orders from every restaurant and ranks them.
# it sorts by total macro gap first (lower = closer to targets), then by cost as a tiebreaker.
@mcp.tool()
def rank(restaurants: list[dict]) -> list[dict]:
    def sort_key(r):
        primary  = sum(r["gaps"][k] for k in GAP_KEYS)  # total shortfall across protein, carbs, fats
        tiebreak = r[TIEBREAK_KEY]  # if two orders have the same gap, pick the cheaper one
        return (primary, tiebreak)

    return sorted(restaurants, key=sort_key)

if __name__ == "__main__":
    mcp.run()