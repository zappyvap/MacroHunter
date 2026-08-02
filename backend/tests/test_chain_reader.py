import sys, os, json, pytest
from unittest.mock import MagicMock, patch

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
sys.path.insert(0, REPO_ROOT)

# ─── Pure helpers (no network / Supabase needed) ───────────────────────────
from mcp_servers.chain_reader import _cache_key, _normalize_menu


# ── _cache_key ──────────────────────────────────────────────────────────────
class TestCacheKey:
    def test_lowercases(self):
        assert _cache_key("McDonald's") == "mcdonald's"

    def test_strips_whitespace(self):
        assert _cache_key("  Burger King  ") == "burger king"

    def test_already_lowercase(self):
        assert _cache_key("subway") == "subway"

    def test_mixed_case(self):
        assert _cache_key("Taco Bell") == "taco bell"

    def test_empty_string(self):
        assert _cache_key("") == ""


# ── _normalize_menu ─────────────────────────────────────────────────────────
class TestNormalizeMenu:
    def _basic_item(self, **kwargs):
        base = {
            "name": "Classic Burger", "calories": 540.0,
            "protein": 28.0, "carbs": 42.0, "fats": 27.0, "price": 8.99,
        }
        base.update(kwargs)
        return base

    def test_basic_item_preserved(self):
        result = _normalize_menu([self._basic_item()], "Test Restaurant")
        assert len(result) == 1
        r = result[0]
        assert r["name"] == "Classic Burger"
        assert r["calories"] == 540.0
        assert r["protein"] == 28.0
        assert r["carbs"] == 42.0
        assert r["fats"] == 27.0
        assert r["price"] == 8.99

    def test_restaurant_field_added(self):
        result = _normalize_menu([self._basic_item()], "MyRestaurant")
        assert result[0]["restaurant"] == "MyRestaurant"

    def test_restaurant_from_item_overrides(self):
        item = self._basic_item()
        item["restaurant"] = "OriginalPlace"
        result = _normalize_menu([item], "FallbackName")
        assert result[0]["restaurant"] == "OriginalPlace"

    def test_non_dict_items_skipped(self):
        result = _normalize_menu(["not a dict", None, 42, self._basic_item()], "R")
        assert len(result) == 1

    def test_empty_list(self):
        assert _normalize_menu([], "R") == []

    def test_alternate_field_names_calories(self):
        item = {"item": "Salad", "cal": 200, "p": 10, "c": 15, "f": 8}
        result = _normalize_menu([item], "R")
        assert result[0]["calories"] == 200.0
        assert result[0]["protein"] == 10.0
        assert result[0]["carbs"] == 15.0
        assert result[0]["fats"] == 8.0

    def test_alternate_field_names_capitalized(self):
        item = {"name": "Wrap", "Calories": 350, "Protein": 25, "Carbs": 30, "Fat": 12}
        result = _normalize_menu([item], "R")
        assert result[0]["calories"] == 350.0
        assert result[0]["protein"] == 25.0

    def test_missing_macros_default_to_zero(self):
        item = {"name": "Mystery Item"}
        result = _normalize_menu([item], "R")
        assert result[0]["calories"] == 0.0
        assert result[0]["protein"] == 0.0

    def test_default_price_when_missing(self):
        item = {"name": "Fries"}
        result = _normalize_menu([item], "R")
        assert result[0]["price"] == 10.0

    def test_invalid_price_uses_default(self):
        item = self._basic_item()
        item["price"] = "not_a_number"  # type: ignore[assignment]
        result = _normalize_menu([item], "R")
        assert result[0]["price"] == 10.0

    def test_estimated_false_by_default(self):
        result = _normalize_menu([self._basic_item()], "R")
        assert result[0]["estimated"] is False

    def test_estimated_true_preserved(self):
        item = self._basic_item()
        item["estimated"] = True
        result = _normalize_menu([item], "R")
        assert result[0]["estimated"] is True

    def test_multiple_items(self):
        items = [self._basic_item(name="Item A"), self._basic_item(name="Item B")]
        result = _normalize_menu(items, "R")
        assert len(result) == 2
        assert result[0]["name"] == "Item A"
        assert result[1]["name"] == "Item B"

    def test_calories_as_string_converted(self):
        item = {"name": "Pasta", "calories": "780", "protein": "32", "carbs": "90", "fats": "22"}
        result = _normalize_menu([item], "R")
        assert result[0]["calories"] == 780.0


# ── search_chain_restaurant (mocked external calls) ─────────────────────────
@pytest.fixture()
def mock_fatsecret_env(monkeypatch):
    monkeypatch.setenv("FATSECRET_CLIENT_ID", "fake-id")
    monkeypatch.setenv("FATSECRET_CLIENT_SECRET", "fake-secret")


def _make_fatsecret_item(name, brand, desc):
    return {"food_name": name, "brand_name": brand, "food_description": desc, "food_id": "1"}


class TestSearchChainRestaurant:
    """Integration tests that mock FatSecret HTTP calls, Gemini, and Supabase."""

    def _run(self, restaurant_name, foods_data, token="tok", prices=None):
        from mcp_servers.chain_reader import search_chain_restaurant
        if prices is None:
            prices = {}

        with patch("mcp_servers.chain_reader._get_cached_menu", return_value=None), \
             patch("mcp_servers.chain_reader._save_menu_to_cache"), \
             patch("mcp_servers.chain_reader.get_fatsecret_token", return_value=token), \
             patch("mcp_servers.chain_reader.requests.get") as mock_get, \
             patch("mcp_servers.chain_reader.client") as mock_gemini:

            # Build a fake FatSecret search response
            response = MagicMock()
            response.raise_for_status = MagicMock()
            response.json.return_value = {"foods": {"food": foods_data}}
            mock_get.return_value = response

            # Gemini price estimation mock
            price_resp = MagicMock()
            price_resp.text = json.dumps(prices)
            mock_gemini.models.generate_content.return_value = price_resp

            return search_chain_restaurant(restaurant_name)

    def test_returns_json_string(self, mock_fatsecret_env):
        foods = [_make_fatsecret_item(
            "McDonald's Big Mac", "McDonald's",
            "Per 1 serving | Calories: 550kcal | Fat: 30g | Carbs: 45g | Protein: 25g"
        )]
        result = self._run("McDonald's", foods, prices={"McDonald's Big Mac": 5.99})
        parsed = json.loads(result)
        assert isinstance(parsed, list)

    def test_item_name_preserved(self, mock_fatsecret_env):
        foods = [_make_fatsecret_item(
            "McDonald's Big Mac", "McDonald's",
            "Per 1 serving | Calories: 550kcal | Fat: 30g | Carbs: 45g | Protein: 25g"
        )]
        result = self._run("McDonald's", foods, prices={"McDonald's Big Mac": 5.99})
        parsed = json.loads(result)
        assert any("Big Mac" in item["name"] for item in parsed)

    def test_macros_parsed_from_description(self, mock_fatsecret_env):
        foods = [_make_fatsecret_item(
            "McDonald's Big Mac", "McDonald's",
            "Per 1 serving | Calories: 550kcal | Fat: 30g | Carbs: 45g | Protein: 25g"
        )]
        result = self._run("McDonald's", foods, prices={})
        parsed = json.loads(result)
        item = next(i for i in parsed if "Big Mac" in i["name"])
        assert item["calories"] == 550
        assert item["protein"] == 25
        assert item["carbs"] == 45
        assert item["fats"] == 30

    def test_price_attached_from_gemini(self, mock_fatsecret_env):
        foods = [_make_fatsecret_item(
            "McDonald's Fries", "McDonald's",
            "Per 1 serving | Calories: 320kcal | Fat: 15g | Carbs: 43g | Protein: 4g"
        )]
        result = self._run("McDonald's", foods, prices={"McDonald's Fries": 3.49})
        parsed = json.loads(result)
        item = next(i for i in parsed if "Fries" in i["name"])
        assert item["price"] == pytest.approx(3.49)

    def test_restaurant_field_set(self, mock_fatsecret_env):
        foods = [_make_fatsecret_item(
            "McDonald's McFlurry", "McDonald's",
            "Per 1 serving | Calories: 410kcal | Fat: 14g | Carbs: 63g | Protein: 10g"
        )]
        result = self._run("McDonald's", foods)
        parsed = json.loads(result)
        assert all(i["restaurant"] == "McDonald's" for i in parsed)

    def test_empty_foods_returns_empty_list(self, mock_fatsecret_env):
        result = self._run("McDonald's", [])
        assert result == "[]"

    def test_filters_out_unrelated_brands(self, mock_fatsecret_env):
        foods = [
            _make_fatsecret_item(
                "Generic Burger", "Generic Brand",
                "Per 1 serving | Calories: 400kcal | Fat: 20g | Carbs: 35g | Protein: 22g"
            ),
            _make_fatsecret_item(
                "McDonald's Cheeseburger", "McDonald's",
                "Per 1 serving | Calories: 300kcal | Fat: 12g | Carbs: 33g | Protein: 15g"
            ),
        ]
        result = self._run("McDonald's", foods, prices={})
        parsed = json.loads(result)
        assert all("mcdonald" in i["name"].lower() or "mcdonald" in i.get("restaurant", "").lower()
                   for i in parsed)

    def test_cache_hit_returns_immediately(self):
        cached = [{"name": "Cached Burger", "calories": 500, "protein": 25,
                   "carbs": 40, "fats": 25, "price": 6.0,
                   "restaurant": "McDonald's", "estimated": False}]
        from mcp_servers.chain_reader import search_chain_restaurant
        with patch("mcp_servers.chain_reader._get_cached_menu", return_value=cached), \
             patch("mcp_servers.chain_reader.get_fatsecret_token") as mock_token:
            result = search_chain_restaurant("McDonald's")
            mock_token.assert_not_called()
        parsed = json.loads(result)
        assert len(parsed) == 1 and parsed[0]["name"] == "Cached Burger"

    def test_unknown_restaurant_calls_ai_fallback(self):
        from mcp_servers.chain_reader import search_chain_restaurant
        ai_menu = json.dumps([{
            "name": "Artisan Pizza", "calories": 700, "protein": 28,
            "carbs": 75, "fats": 30, "price": 14.0,
            "restaurant": "Mama Mia Pizzeria", "estimated": True
        }])
        with patch("mcp_servers.chain_reader._get_cached_menu", return_value=None), \
             patch("mcp_servers.chain_reader._save_menu_to_cache"), \
             patch("mcp_servers.chain_reader.estimate_menu_via_ai", return_value=ai_menu) as mock_ai:
            result = search_chain_restaurant("Mama Mia Pizzeria")
            mock_ai.assert_called_once_with("Mama Mia Pizzeria")
        parsed = json.loads(result)
        assert len(parsed) == 1 and parsed[0]["name"] == "Artisan Pizza"

    def test_estimated_false_for_fatsecret_items(self, mock_fatsecret_env):
        foods = [_make_fatsecret_item(
            "McDonald's Apple Pie", "McDonald's",
            "Per 1 serving | Calories: 240kcal | Fat: 11g | Carbs: 34g | Protein: 3g"
        )]
        result = self._run("McDonald's", foods, prices={})
        parsed = json.loads(result)
        assert all(i.get("estimated") is False for i in parsed)


# ── Per-100g / oz portion-size branch ──────────────────────────────────────
# When FatSecret returns a description that contains "per 100g" or "oz",
# search_chain_restaurant must fire a *second* food.get.v2 API call to fetch
# the real serving size and pull macros from that serving — NOT from the
# generic-weight description. These tests verify that whole branch.

class TestPer100gPortionSizeBranch:
    """
    Covers lines 299-328 of chain_reader.py:
    the 'if per 100g / oz' branch that makes a secondary food.get.v2 call.
    """

    def _run_with_detail(self, restaurant_name, search_foods, detail_response, prices=None):
        """
        Helper that fakes both the search response AND the food.get.v2 detail
        response so we can test the per-100g branch end-to-end.
        """
        from mcp_servers.chain_reader import search_chain_restaurant
        if prices is None:
            prices = {}

        call_count = {"n": 0}

        def fake_get(url, headers, params):
            resp = MagicMock()
            resp.raise_for_status = MagicMock()
            if params.get("method") == "foods.search":
                resp.json.return_value = {"foods": {"food": search_foods}}
            else:  # food.get.v2 detail call
                call_count["n"] += 1
                resp.json.return_value = detail_response
            return resp

        with patch("mcp_servers.chain_reader._get_cached_menu", return_value=None), \
             patch("mcp_servers.chain_reader._save_menu_to_cache"), \
             patch("mcp_servers.chain_reader.get_fatsecret_token", return_value="tok"), \
             patch("mcp_servers.chain_reader.requests.get", side_effect=fake_get), \
             patch("mcp_servers.chain_reader.client") as mock_gemini:

            price_resp = MagicMock()
            price_resp.text = json.dumps(prices)
            mock_gemini.models.generate_content.return_value = price_resp

            result = search_chain_restaurant(restaurant_name)
            return json.loads(result), call_count["n"]

    def _serving(self, measurement="serving", calories=550, protein=28,
                 carbohydrate=45, fat=27):
        return {
            "measurement_description": measurement,
            "calories": str(calories),
            "protein": str(protein),
            "carbohydrate": str(carbohydrate),
            "fat": str(fat),
        }

    # ── Triggers the branch ─────────────────────────────────────────────────
    def test_per_100g_description_triggers_detail_call(self):
        """A 'per 100g' description must cause a second food.get.v2 request."""
        search_item = {
            "food_name": "McDonald's Beef Patty",
            "brand_name": "McDonald's",
            "food_description": "Per 100g | Calories: 290kcal | Fat: 22g | Carbs: 0g | Protein: 21g",
            "food_id": "42",
        }
        detail = {"food": {"servings": {"serving": [self._serving()]}}}
        _, detail_calls = self._run_with_detail("McDonald's", [search_item], detail)
        assert detail_calls == 1, "Expected exactly one food.get.v2 call for a per-100g item"

    def test_oz_description_triggers_detail_call(self):
        """A description containing 'oz' must also trigger the detail call."""
        search_item = {
            "food_name": "McDonald's Grilled Chicken",
            "brand_name": "McDonald's",
            "food_description": "Per 4 oz | Calories: 140kcal | Fat: 3g | Carbs: 1g | Protein: 27g",
            "food_id": "99",
        }
        detail = {"food": {"servings": {"serving": [self._serving()]}}}
        _, detail_calls = self._run_with_detail("McDonald's", [search_item], detail)
        assert detail_calls == 1

    # ── Macros come from the detail endpoint, not the 100g description ──────
    def test_macros_come_from_serving_not_100g_description(self):
        """
        The 100g description shows 290 kcal/100g for a beef patty, but the
        actual serving (113g patty) should give ~327 kcal. The detail endpoint
        returns the real per-serving macro, which should be used instead.
        """
        search_item = {
            "food_name": "McDonald's Beef Patty",
            "brand_name": "McDonald's",
            "food_description": "Per 100g | Calories: 290kcal | Fat: 22g | Carbs: 0g | Protein: 21g",
            "food_id": "42",
        }
        # Real serving: one 4 oz patty = 263 kcal, 19g fat, 0g carbs, 24g protein
        detail = {"food": {"servings": {"serving": [
            self._serving(measurement="1 patty (4 oz)",
                          calories=263, protein=24, carbohydrate=0, fat=19)
        ]}}}
        parsed, _ = self._run_with_detail("McDonald's", [search_item], detail)
        assert len(parsed) == 1
        item = parsed[0]
        # Macros should match the serving data, NOT the naive 100g numbers
        assert item["calories"] == 263
        assert item["protein"] == 24
        assert item["fats"] == 19

    # ── Serving selection: prefers named serving over weight-only servings ──
    def test_prefers_named_serving_over_weight_only(self):
        """
        When multiple servings exist, the code should skip 'g', 'oz', and 'ml'
        measurement descriptions and pick the first named serving.
        """
        search_item = {
            "food_name": "McDonald's McDouble",
            "brand_name": "McDonald's",
            "food_description": "Per 100g | Calories: 250kcal | Fat: 12g | Carbs: 20g | Protein: 14g",
            "food_id": "7",
        }
        detail = {"food": {"servings": {"serving": [
            # First two are weight-only — should be skipped
            self._serving(measurement="g",  calories=250, protein=14, carbohydrate=20, fat=12),
            self._serving(measurement="oz", calories=71,  protein=4,  carbohydrate=6,  fat=3),
            # This is the real named serving — should be chosen
            self._serving(measurement="1 burger", calories=390, protein=22, carbohydrate=31, fat=19),
        ]}}}
        parsed, _ = self._run_with_detail("McDonald's", [search_item], detail)
        assert len(parsed) == 1
        item = parsed[0]
        # Must use the "1 burger" serving, not the 100g or oz values
        assert item["calories"] == 390
        assert item["protein"] == 22
        assert item["carbs"] == 31
        assert item["fats"] == 19

    def test_uses_first_serving_when_only_weight_servings_exist(self):
        """
        If every serving description is a weight unit ('g', 'oz', 'ml'),
        the code falls back to the very first serving rather than crashing.
        """
        search_item = {
            "food_name": "McDonald's Sauce",
            "brand_name": "McDonald's",
            "food_description": "Per 100g | Calories: 320kcal | Fat: 30g | Carbs: 15g | Protein: 1g",
            "food_id": "55",
        }
        detail = {"food": {"servings": {"serving": [
            self._serving(measurement="g",  calories=320, protein=1, carbohydrate=15, fat=30),
            self._serving(measurement="oz", calories=91,  protein=0, carbohydrate=4,  fat=9),
        ]}}}
        parsed, _ = self._run_with_detail("McDonald's", [search_item], detail)
        # Should still include the item (using the first serving)
        assert len(parsed) == 1
        # Calories should be the first serving's value (320), not the oz one (91)
        assert parsed[0]["calories"] == 320

    def test_single_serving_dict_normalised_to_list(self):
        """
        FatSecret sometimes returns a single serving as a dict rather than a
        list. The code wraps it in a list — verify that path still works.
        """
        search_item = {
            "food_name": "McDonald's Hash Brown",
            "brand_name": "McDonald's",
            "food_description": "Per 100g | Calories: 300kcal | Fat: 16g | Carbs: 36g | Protein: 3g",
            "food_id": "11",
        }
        # Serving is a plain dict, not a list
        detail = {"food": {"servings": {"serving":
            self._serving(measurement="1 piece", calories=150, protein=2, carbohydrate=18, fat=9)
        }}}
        parsed, _ = self._run_with_detail("McDonald's", [search_item], detail)
        assert len(parsed) == 1
        assert parsed[0]["calories"] == 150

    def test_item_dropped_when_detail_call_fails(self):
        """
        If the food.get.v2 call raises an exception, the item should be silently
        dropped (the except block does `continue`), so the final menu is empty.
        """
        from mcp_servers.chain_reader import search_chain_restaurant

        search_item = {
            "food_name": "McDonald's Mystery Item",
            "brand_name": "McDonald's",
            "food_description": "Per 100g | Calories: 200kcal | Fat: 10g | Carbs: 20g | Protein: 8g",
            "food_id": "404",
        }

        call_n = {"n": 0}

        def fake_get(url, headers, params):
            resp = MagicMock()
            resp.raise_for_status = MagicMock()
            if params.get("method") == "foods.search":
                resp.json.return_value = {"foods": {"food": [search_item]}}
            else:
                call_n["n"] += 1
                resp.raise_for_status.side_effect = Exception("404 Not Found")
            return resp

        with patch("mcp_servers.chain_reader._get_cached_menu", return_value=None), \
             patch("mcp_servers.chain_reader._save_menu_to_cache"), \
             patch("mcp_servers.chain_reader.get_fatsecret_token", return_value="tok"), \
             patch("mcp_servers.chain_reader.requests.get", side_effect=fake_get), \
             patch("mcp_servers.chain_reader.client") as mock_gemini:

            price_resp = MagicMock()
            price_resp.text = json.dumps({})
            mock_gemini.models.generate_content.return_value = price_resp

            result = search_chain_restaurant("McDonald's")

        parsed = json.loads(result)
        assert parsed == [], f"Expected empty menu when detail call fails, got {parsed}"

    def test_item_dropped_when_no_food_id(self):
        """Items without a food_id in the per-100g branch must be skipped."""
        from mcp_servers.chain_reader import search_chain_restaurant

        search_item = {
            "food_name": "McDonald's No-ID Item",
            "brand_name": "McDonald's",
            "food_description": "Per 100g | Calories: 250kcal | Fat: 10g | Carbs: 30g | Protein: 12g",
            # food_id intentionally absent
        }

        def fake_get(url, headers, params):
            resp = MagicMock()
            resp.raise_for_status = MagicMock()
            resp.json.return_value = {"foods": {"food": [search_item]}}
            return resp

        with patch("mcp_servers.chain_reader._get_cached_menu", return_value=None), \
             patch("mcp_servers.chain_reader._save_menu_to_cache"), \
             patch("mcp_servers.chain_reader.get_fatsecret_token", return_value="tok"), \
             patch("mcp_servers.chain_reader.requests.get", side_effect=fake_get), \
             patch("mcp_servers.chain_reader.client") as mock_gemini:

            price_resp = MagicMock()
            price_resp.text = json.dumps({})
            mock_gemini.models.generate_content.return_value = price_resp

            result = search_chain_restaurant("McDonald's")

        assert json.loads(result) == []

    def test_standard_serving_path_makes_no_detail_call(self):
        """
        Items with a 'Per 1 serving' description must NOT trigger the second
        API call — they use the fast string-parsing path instead.
        """
        search_item = {
            "food_name": "McDonald's Fries",
            "brand_name": "McDonald's",
            "food_description": "Per 1 serving | Calories: 320kcal | Fat: 15g | Carbs: 43g | Protein: 4g",
            "food_id": "77",
        }
        detail = {"food": {"servings": {"serving": []}}}
        _, detail_calls = self._run_with_detail("McDonald's", [search_item], detail)
        assert detail_calls == 0, "Standard 'Per 1 serving' items must not call food.get.v2"
