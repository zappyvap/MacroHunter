from mcp.server.fastmcp import FastMCP

mcp = FastMCP("Judge")

GAP_KEYS     = ("p", "c", "f")
TIEBREAK_KEY = "total_cost"

@mcp.tool()
def rank(restaurants: list[dict]) -> list[dict]:
    def sort_key(r):
        primary  = sum(r["gaps"][k] for k in GAP_KEYS)
        tiebreak = r[TIEBREAK_KEY]
        return (primary, tiebreak)

    return sorted(restaurants, key=sort_key)

if __name__ == "__main__":
    mcp.run()