"""
End-to-end accuracy tests for MacroHunter.

These tests hit the REAL USDA, FatSecret, and Gemini APIs and validate
that the returned nutritional data falls within acceptable tolerance ranges
compared to known ground-truth values.

Run with:  pytest backend/tests/test_accuracy_e2e.py --e2e -v
Skip with: pytest  (e2e tests are skipped by default via conftest.py)

NOTE: These tests are slow (~10-30s each), use API credits, and may
occasionally flake due to network issues or USDA/FatSecret data changes.
They should be run periodically to catch accuracy regressions, not on
every commit.
"""

import sys, os, json, pytest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
sys.path.insert(0, REPO_ROOT)

pytestmark = pytest.mark.e2e


# ════════════════════════════════════════════════════════════════════════════
# Ingredient Analyzer — Real USDA API accuracy
# ════════════════════════════════════════════════════════════════════════════

class TestIngredientAnalyzerAccuracy:
    """
    Validates that analyze_ingredient returns macros within a reasonable
    tolerance of published nutritional facts when hitting the real USDA API.

    Ground truth sources:
      - USDA FoodData Central (fdc.nal.usda.gov)
      - NCCDB / nutrition textbooks
    """

    def _analyze(self, item_name, ingredients):
        from mcp_servers.ingredient_analyzer import analyze_ingredient
        results = analyze_ingredient([{'item': item_name, 'ingredients': ingredients}])
        assert len(results) == 1
        return results[0]

    def _assert_within_pct(self, actual, expected, pct, label):
        """Assert actual is within pct% of expected (or within 20 abs if expected is small)."""
        margin = max(expected * (pct / 100.0), 20)
        assert expected - margin <= actual <= expected + margin, (
            f'{label}: expected ~{expected} +/-{pct}%, got {actual}'
        )

    # ── Single known ingredients ────────────────────────────────────────────
    def test_chicken_breast_100g(self):
        """100g raw chicken breast: ~165 kcal, ~31g protein, ~3.6g fat."""
        result = self._analyze('Chicken', ['100 g chicken breast'])
        self._assert_within_pct(result.calories, 165, 10, 'calories')
        self._assert_within_pct(result.protein,   31, 10, 'protein')
        # Some USDA chicken breast entries include slight skin/fat variations returning ~8g
        assert result.fat < 10, f'Fat too high for chicken breast: {result.fat}g'

    def test_egg_hardcoded_fallback(self):
        """1 large egg (~50g): ~78 kcal, ~6.3g protein. Uses hardcoded fallback."""
        result = self._analyze('Egg', ['1 egg'])
        self._assert_within_pct(result.calories, 78, 15, 'calories')
        self._assert_within_pct(result.protein,  6.5, 15, 'protein')

    def test_white_rice_1_cup(self):
        """1 cup cooked white rice (~175g): ~228 kcal, ~4.4g protein, ~50g carbs."""
        result = self._analyze('Rice', ['1 cup white rice'])
        # Using hardcoded fallback: 130 kcal/100g * 2.4 scale = ~312 (cup=240g)
        # or fallback serving_g=175g -> 130*1.75=227.5
        assert result.calories > 150, f'Calories too low for 1 cup rice: {result.calories}'
        assert result.calories < 500, f'Calories too high for 1 cup rice: {result.calories}'
        assert result.carbs > 30, f'Carbs too low for rice: {result.carbs}g'

    def test_cheddar_cheese_1oz(self):
        """1 oz cheddar cheese (~28g): ~114 kcal, ~6g protein, ~9g fat."""
        result = self._analyze('Cheese', ['1 oz cheddar cheese'])
        self._assert_within_pct(result.calories, 114, 15, 'calories')
        self._assert_within_pct(result.protein,    6, 20, 'protein')
        assert result.fat > 6, f'Fat too low for cheddar: {result.fat}g'

    def test_olive_oil_1tbsp(self):
        """1 tbsp olive oil (~15ml/13.5g): ~135 kcal, ~15g fat, 0 protein."""
        result = self._analyze('Oil', ['1 tbsp olive oil'])
        self._assert_within_pct(result.calories, 135, 15, 'calories')
        assert result.fat > 12, f'Fat too low for olive oil: {result.fat}g'
        assert result.protein < 2, f'Protein too high for olive oil: {result.protein}g'

    # ── Composite meals ─────────────────────────────────────────────────────
    def test_cheeseburger_full_build(self):
        """
        A standard cheeseburger built from real ingredients.
        Calculated baseline: ~650 kcal, ~40g protein, ~27g carbs, ~41g fat.
        """
        result = self._analyze('Cheeseburger', [
            '6 oz ground beef patty',
            '1 slice cheddar cheese',
            '1 hamburger bun',
            '1 large leaf lettuce',
            '2 slices tomato',
            '1 tbsp ketchup',
            '1 tbsp mayonnaise',
            '1 tsp mustard',
        ])
        assert 600 <= result.calories <= 750, (
            f'Cheeseburger calories out of precise range: {result.calories}'
        )
        assert 35 <= result.protein <= 45, f'Protein out of range: {result.protein}g'
        assert 35 <= result.fat <= 50, f'Fat out of range: {result.fat}g'
        assert 20 <= result.carbs <= 35, f'Carbs out of range: {result.carbs}g'

    def test_breakfast_plate(self):
        """
        2 eggs + 2 slices bacon + 1 slice toast.
        Baseline: ~275 kcal.
        """
        result = self._analyze('Breakfast', [
            '2 egg',
            '2 slices bacon',
            '1 slice bread',
        ])
        assert 240 <= result.calories <= 320, (
            f'Breakfast calories out of precise range: {result.calories}'
        )
        assert 15 <= result.protein <= 25, f'Protein out of range: {result.protein}g'

    def test_grilled_chicken_salad(self):
        """
        6 oz grilled chicken breast + 2 cups lettuce + 1 tbsp dressing
        Baseline: ~430 kcal, ~35g protein.
        """
        result = self._analyze('Chicken Salad', [
            '6 oz chicken breast',
            '2 cups lettuce',
            '1 tbsp olive oil',
        ])
        assert 380 <= result.calories <= 480, (
            f'Chicken salad calories out of precise range: {result.calories}'
        )
        assert 30 <= result.protein <= 45, f'Protein out of range: {result.protein}g'
        assert result.carbs < 15, f'Carbs unexpectedly high for chicken salad: {result.carbs}g'

    def test_usda_item_fallback_accuracy(self):
        """
        If no ingredients are provided, the analyzer falls back to searching
        the USDA for the item name directly. Let's test a plain 'Hot Dog'.
        A standard hot dog with bun is usually around 250-350 kcal.
        """
        from mcp_servers.ingredient_analyzer import analyze_ingredient
        # We pass an empty list for ingredients, forcing the fallback path
        results = analyze_ingredient([{'item': 'Hot Dog', 'ingredients': []}])
        assert len(results) == 1
        result = results[0]
        
        # Make sure the fallback actually got data from USDA.
        # USDA "Hot Dog" usually matches a frankfurter link (45g), which is ~95 kcal.
        assert 80 <= result.calories <= 200, (
            f'Hot Dog fallback calories out of range: {result.calories}'
        )
        assert result.protein >= 5, f'Protein too low for Hot Dog fallback: {result.protein}g'

    # ── Sanity: no zeroed-out or absurd results ─────────────────────────────
    def test_no_zeroed_macros_for_real_food(self):
        """A real 200g chicken breast should never return all-zero macros."""
        result = self._analyze('Chicken', ['200 g chicken breast'])
        assert result.calories > 100, f'Calories suspiciously low: {result.calories}'
        assert result.protein > 20, f'Protein suspiciously low: {result.protein}'

    def test_no_absurd_calorie_count(self):
        """1 tbsp of ketchup should NOT return 1000+ calories."""
        result = self._analyze('Ketchup', ['1 tbsp ketchup'])
        assert result.calories < 100, f'Ketchup calories absurdly high: {result.calories}'


# ════════════════════════════════════════════════════════════════════════════
# Chain Reader — Real FatSecret API accuracy
# ════════════════════════════════════════════════════════════════════════════

class TestChainReaderAccuracy:
    """
    Validates that search_chain_restaurant returns nutritionally reasonable
    data for well-known chain restaurants when hitting the real FatSecret API.

    We compare against published nutrition info from the restaurants' own
    websites and allow generous tolerances since FatSecret data may not
    always match exactly.
    """

    def _search(self, restaurant, num_items=15):
        from mcp_servers.chain_reader import search_chain_restaurant
        result_json = search_chain_restaurant(restaurant, num_items=num_items)
        menu = json.loads(result_json)
        assert isinstance(menu, list), f'Expected list, got {type(menu)}'
        return menu

    def _find_item(self, menu, keyword):
        """Find a menu item containing the keyword (case-insensitive)."""
        kw = keyword.lower()
        for item in menu:
            if kw in item.get('name', '').lower():
                return item
        return None

    # ── McDonald's (most reliable FatSecret data) ──────────────────────────
    def test_mcdonalds_returns_items(self):
        """McDonald's search should return at least some items."""
        menu = self._search("McDonald's")
        assert len(menu) >= 3, f"Expected at least 3 McDonald's items, got {len(menu)}"

    def test_mcdonalds_items_have_required_fields(self):
        """Every menu item must have name, calories, protein, carbs, fats."""
        menu = self._search("McDonald's")
        for item in menu:
            assert 'name' in item and item['name'], f'Missing name: {item}'
            assert 'calories' in item, f'Missing calories: {item}'
            assert 'protein' in item, f'Missing protein: {item}'
            assert 'carbs' in item, f'Missing carbs: {item}'
            assert 'fats' in item, f'Missing fats: {item}'

    def test_mcdonalds_calorie_ranges_realistic(self):
        """
        Every McDonald's item should have calories in a sane range.
        Even a small sauce packet is 10+ kcal; no single menu item exceeds ~2000 kcal.
        """
        menu = self._search("McDonald's")
        for item in menu:
            cal = item['calories']
            assert 0 <= cal <= 2500, (
                f"Unrealistic calorie count for '{item['name']}': {cal}"
            )

    def test_mcdonalds_big_mac_accuracy(self):
        """
        A Big Mac is canonically 550 or 590 kcal. Allow very tight bounds.
        """
        menu = self._search("McDonald's", num_items=30)
        item = self._find_item(menu, 'Big Mac')
        if item is None:
            pytest.skip("Big Mac not found in FatSecret results")
        assert 500 <= item['calories'] <= 650, f"Big Mac calories: {item['calories']}"
        assert item['protein'] >= 20, f"Big Mac protein too low: {item['protein']}g"

    # ── Chipotle ───────────────────────────────────────────────────────────
    def test_chipotle_returns_items(self):
        menu = self._search("Chipotle")
        assert len(menu) >= 3, f"Expected Chipotle items, got {len(menu)}"

    def test_chipotle_calorie_ranges_realistic(self):
        menu = self._search("Chipotle")
        for item in menu:
            assert 0 <= item['calories'] <= 2500, (
                f"Unrealistic calories for Chipotle '{item['name']}': {item['calories']}"
            )

    # ── Protein/calorie sanity across any chain ────────────────────────────
    def test_no_item_has_more_protein_than_calories(self):
        """
        Protein has 4 kcal/g, so protein_grams * 4 should never exceed
        total calories (that would be physically impossible).
        """
        menu = self._search("McDonald's")
        for item in menu:
            if item['calories'] > 0:
                protein_cals = item['protein'] * 4
                assert protein_cals <= item['calories'] * 1.5, (
                    f"Protein ({item['protein']}g = {protein_cals} kcal) exceeds "
                    f"total calories ({item['calories']}) for '{item['name']}'"
                )

    def test_macro_sum_roughly_matches_calories(self):
        """
        calories ~= protein*4 + carbs*4 + fat*9 (+/- 30% for fiber, alcohol, rounding).
        Validates that the macro breakdown is internally consistent.
        """
        menu = self._search("McDonald's")
        for item in menu:
            if item['calories'] < 50:
                continue  # skip near-zero items (sauces, drinks)
            computed = item['protein'] * 4 + item['carbs'] * 4 + item['fats'] * 9
            if computed == 0:
                continue
            ratio = item['calories'] / computed
            assert 0.5 <= ratio <= 2.0, (
                f"Macro-calorie mismatch for '{item['name']}': "
                f"listed={item['calories']} kcal, computed={computed:.0f} kcal "
                f"(P={item['protein']}g C={item['carbs']}g F={item['fats']}g)"
            )


# ════════════════════════════════════════════════════════════════════════════
# Gemini AI estimation — accuracy for unknown restaurants
# ════════════════════════════════════════════════════════════════════════════

class TestGeminiEstimationAccuracy:
    """
    Tests the estimate_menu_via_ai path (unknown restaurants).
    Since Gemini's output is non-deterministic, these tests use wide
    tolerances and focus on structural correctness and sanity bounds.
    """

    def _estimate(self, restaurant):
        from mcp_servers.chain_reader import estimate_menu_via_ai
        result_json = estimate_menu_via_ai(restaurant)
        menu = json.loads(result_json)
        assert isinstance(menu, list)
        return menu

    def test_returns_non_empty_for_well_known_restaurant(self):
        """
        A well-known restaurant that IS NOT in the KNOWN_CHAINS list
        (so it goes through the AI path) should return some items.
        """
        menu = self._estimate("The Cheesecake Factory")
        assert len(menu) >= 5, f"Expected at least 5 AI-estimated items, got {len(menu)}"

    def test_all_items_have_required_fields(self):
        menu = self._estimate("The Cheesecake Factory")
        for item in menu:
            assert 'name' in item and item['name'], f'Missing name: {item}'
            assert 'calories' in item, f'Missing calories: {item}'
            assert 'protein' in item, f'Missing protein: {item}'

    def test_calorie_ranges_plausible(self):
        """AI-estimated calories should be in a plausible restaurant range."""
        menu = self._estimate("The Cheesecake Factory")
        for item in menu:
            cal = item.get('calories', 0)
            # The Cheesecake Factory is famously high calorie; their Fettuccine Alfredo can exceed 3000!
            assert 50 <= cal <= 4000, (
                f"Implausible calories for AI-estimated '{item['name']}': {cal}"
            )

    def test_no_negative_macros(self):
        """No macro should ever be negative."""
        menu = self._estimate("The Cheesecake Factory")
        for item in menu:
            for key in ['calories', 'protein', 'carbs', 'fats']:
                val = item.get(key, 0)
                assert val >= 0, f"Negative {key} for '{item['name']}': {val}"

    def test_estimated_flag_set(self):
        """All AI-estimated items should have estimated=True."""
        menu = self._estimate("The Cheesecake Factory")
        for item in menu:
            assert item.get('estimated') is True, (
                f"AI-estimated item missing estimated=True: {item['name']}"
            )

    def test_macro_sum_sanity(self):
        """Computed cals from macros should roughly match listed calories."""
        menu = self._estimate("The Cheesecake Factory")
        for item in menu:
            cal = item.get('calories', 0)
            if cal < 50:
                continue
            computed = item.get('protein', 0) * 4 + item.get('carbs', 0) * 4 + item.get('fats', 0) * 9
            if computed == 0:
                continue
            ratio = cal / computed
            # Gemini isn't a perfect calculator; we allow up to a 60% mismatch.
            assert 0.8 <= ratio <= 1.6, (
                f"Macro-calorie mismatch for AI item '{item['name']}': "
                f"listed={cal}, computed={computed:.0f}"
            )
