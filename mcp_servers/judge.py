GAP_KEYS     = ("p", "c", "f")
TIEBREAK_KEY = "total_cost"

def rank(restaurants: list[dict]) -> list[dict]:
    def sort_key(r):
        primary  = sum(r["gaps"][k] for k in GAP_KEYS)
        tiebreak = r[TIEBREAK_KEY]
        return (primary, tiebreak)

    return sorted(restaurants, key=sort_key)
