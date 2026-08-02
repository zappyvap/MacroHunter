import sys, os, pytest
from unittest.mock import MagicMock, patch

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
sys.path.insert(0, REPO_ROOT)

from mcp_servers.ingredient_analyzer import (
    parse_ingredient_weight, _lookup_ingredient_weight, _core_noun,
    _score_usda_match, _extract_words, _try_common_fallback, _best_usda_match,
    SLICE_WEIGHTS, PIECE_WEIGHTS, CUP_WEIGHTS, NO_UNIT_WEIGHTS,
)


# ── _extract_words ──────────────────────────────────────────────────────────
class TestExtractWords:
    def test_basic_extraction(self):
        result = _extract_words('cheddar cheese')
        assert 'cheddar' in result and 'cheese' in result

    def test_stopwords_removed(self):
        result = _extract_words('slice of fresh tomato')
        assert 'of' not in result and 'fresh' not in result and 'tomato' in result

    def test_punctuation_stripped(self):
        result = _extract_words('chicken, breast!')
        assert 'chicken' in result and 'breast' in result

    def test_empty_string(self):
        assert _extract_words('') == set()

    def test_all_stopwords(self):
        assert _extract_words('raw cooked whole') == set()


# ── _core_noun ──────────────────────────────────────────────────────────────
class TestCoreNoun:
    def test_simple_noun(self):
        assert _core_noun('chicken') == 'chicken'

    def test_adjective_stripped(self):
        assert _core_noun('diced red onion') == 'onion'

    def test_unit_word_stripped(self):
        assert _core_noun('dill pickle slices') == 'pickle'

    def test_leading_stopword(self):
        assert _core_noun('fresh spinach') == 'spinach'

    def test_multi_word(self):
        assert _core_noun('shredded mozzarella cheese') == 'cheese'

    def test_single_word(self):
        assert _core_noun('avocado') == 'avocado'


# ── _score_usda_match ───────────────────────────────────────────────────────
class TestScoreUsdaMatch:
    def test_perfect_match(self):
        assert _score_usda_match('cheddar cheese', 'cheddar cheese') == pytest.approx(1.0)

    def test_partial_match(self):
        score = _score_usda_match('chicken breast', 'chicken breast, cooked, roasted')
        assert 0.0 < score <= 1.0

    def test_no_overlap(self):
        assert _score_usda_match('beef patty', 'banana split dessert') == 0.0

    def test_empty_query(self):
        assert _score_usda_match('', 'chicken breast') == 0.0

    def test_empty_description(self):
        assert _score_usda_match('chicken breast', '') == 0.0

    def test_stopwords_filtered(self):
        assert _score_usda_match('piece of the chicken', 'chicken') > 0.0

    def test_good_beats_bad(self):
        good = _score_usda_match('grilled chicken breast', 'grilled chicken breast')
        bad  = _score_usda_match('grilled chicken breast', 'tuna fish sandwich')
        assert good > bad


# ── _lookup_ingredient_weight ───────────────────────────────────────────────
class TestLookupIngredientWeight:
    def test_exact_slice_keyword(self):
        assert _lookup_ingredient_weight('cheddar cheese', SLICE_WEIGHTS, 28.0) == 21.0

    def test_longer_key_wins(self):
        assert _lookup_ingredient_weight('green bell pepper', SLICE_WEIGHTS, 28.0) == 10.0

    def test_default_returned(self):
        assert _lookup_ingredient_weight('dragon fruit', SLICE_WEIGHTS, 28.0) == 28.0

    def test_case_insensitive(self):
        assert _lookup_ingredient_weight('BACON', SLICE_WEIGHTS, 28.0) == 8.0

    def test_piece_weights_bun(self):
        assert _lookup_ingredient_weight('hamburger bun', PIECE_WEIGHTS, 50.0) == 45.0

    def test_cup_weights_spinach(self):
        assert _lookup_ingredient_weight('baby spinach', CUP_WEIGHTS, 240.0) == 30.0


# ── _try_common_fallback ────────────────────────────────────────────────────
class TestTryCommonFallback:
    def test_egg_returns_values(self):
        result = _try_common_fallback('egg', 50.0)
        assert result is not None
        cal, p, c, f = result
        assert cal == pytest.approx(155.0 * 0.5)
        assert p  == pytest.approx(13.0  * 0.5)

    def test_no_match_returns_none(self):
        assert _try_common_fallback('artichoke hearts', 100.0) is None

    def test_partial_name_matches(self):
        assert _try_common_fallback('fried egg', 50.0) is not None

    def test_longer_key_wins(self):
        white = _try_common_fallback('egg white', 33.0)
        whole = _try_common_fallback('egg', 33.0)
        assert white is not None and whole is not None
        assert white[0] < whole[0]

    def test_scaling_by_weight(self):
        r100 = _try_common_fallback('white rice', 100.0)
        r200 = _try_common_fallback('white rice', 200.0)
        assert r200[0] == pytest.approx(r100[0] * 2.0)

    def test_flour_tortilla(self):
        result = _try_common_fallback('flour tortilla', 45.0)
        assert result is not None
        assert result[0] == pytest.approx(312.0 * 0.45)


# ── parse_ingredient_weight ─────────────────────────────────────────────────
class TestParseIngredientWeight:
    def test_grams_full_word(self):
        name, w = parse_ingredient_weight('100 grams chicken breast')
        assert w == pytest.approx(100.0) and 'chicken' in name.lower()

    def test_g_abbreviation(self):
        _, w = parse_ingredient_weight('250 g oatmeal')
        assert w == pytest.approx(250.0)

    def test_ml(self):
        _, w = parse_ingredient_weight('200 ml whole milk')
        assert w == pytest.approx(200.0)

    def test_oz(self):
        _, w = parse_ingredient_weight('4 oz cheddar cheese')
        assert w == pytest.approx(4 * 28.35)

    def test_ounce_singular(self):
        _, w = parse_ingredient_weight('1 ounce butter')
        assert w == pytest.approx(28.35)

    def test_lb(self):
        _, w = parse_ingredient_weight('1 lb ground beef')
        assert w == pytest.approx(453.59)

    def test_lb_decimal(self):
        _, w = parse_ingredient_weight('0.5 lb salmon')
        assert w == pytest.approx(0.5 * 453.59)

    def test_tbsp(self):
        _, w = parse_ingredient_weight('2 tbsp olive oil')
        assert w == pytest.approx(2 * 15.0)

    def test_tablespoon(self):
        _, w = parse_ingredient_weight('1 tablespoon ketchup')
        assert w == pytest.approx(15.0)

    def test_tsp(self):
        _, w = parse_ingredient_weight('1 tsp salt')
        assert w == pytest.approx(5.0)

    def test_teaspoons(self):
        _, w = parse_ingredient_weight('2 teaspoons vanilla extract')
        assert w == pytest.approx(10.0)

    def test_cup_generic_default(self):
        _, w = parse_ingredient_weight('1 cup flour')
        assert w == pytest.approx(240.0)

    def test_cup_spinach_override(self):
        _, w = parse_ingredient_weight('2 cups spinach')
        assert w == pytest.approx(2 * 30.0)

    def test_cup_cheddar_override(self):
        _, w = parse_ingredient_weight('1 cup cheddar')
        assert w == pytest.approx(113.0)

    def test_slices_bread(self):
        _, w = parse_ingredient_weight('2 slices bread')
        assert w == pytest.approx(2 * 30.0)

    def test_slice_cheddar(self):
        _, w = parse_ingredient_weight('1 slice cheddar cheese')
        assert w == pytest.approx(21.0)

    def test_slices_tomato(self):
        _, w = parse_ingredient_weight('3 slices tomato')
        assert w == pytest.approx(3 * 15.0)

    def test_slices_bacon(self):
        _, w = parse_ingredient_weight('2 slices bacon')
        assert w == pytest.approx(2 * 8.0)

    def test_piece_bun(self):
        _, w = parse_ingredient_weight('1 piece hamburger bun')
        assert w == pytest.approx(45.0)

    def test_piece_breast(self):
        _, w = parse_ingredient_weight('1 piece chicken breast')
        assert w == pytest.approx(170.0)

    def test_pieces_nuggets(self):
        _, w = parse_ingredient_weight('6 pieces chicken nugget')
        assert w == pytest.approx(6 * 18.0)

    def test_no_unit_bun(self):
        _, w = parse_ingredient_weight('1 hamburger bun')
        assert w == pytest.approx(45.0)

    def test_no_unit_egg(self):
        _, w = parse_ingredient_weight('2 egg')
        assert w == pytest.approx(2 * 50.0)

    def test_simple_fraction(self):
        _, w = parse_ingredient_weight('1/2 cup oats')
        assert w == pytest.approx(0.5 * 240.0)

    def test_mixed_fraction(self):
        _, w = parse_ingredient_weight('1 1/2 tbsp honey')
        assert w == pytest.approx(1.5 * 15.0)

    def test_fl_oz(self):
        _, w = parse_ingredient_weight('8 fl oz orange juice')
        assert w == pytest.approx(8 * 29.57)

    def test_name_stripped(self):
        name, _ = parse_ingredient_weight('3 oz shredded mozzarella')
        assert 'mozzarella' in name.lower()
        # The quantity digit '3' and the unit 'oz' should not appear as
        # standalone leading tokens in the parsed name.
        assert not name.strip().startswith('3')
        assert not name.strip().lower().startswith('oz')

    def test_no_leading_of(self):
        name, _ = parse_ingredient_weight('1 cup of milk')
        assert not name.lower().startswith('of ')

    def test_bare_name_fallback(self):
        name, w = parse_ingredient_weight('hamburger bun')
        assert 'bun' in name.lower() and w > 0


# ── _best_usda_match ────────────────────────────────────────────────────────
def _mf(desc, fdc_id=1):
    f = MagicMock(); f.description = desc; f.fdc_id = fdc_id; return f

def _mr(foods):
    r = MagicMock(); r.foods = foods; return r

class TestBestUsdaMatch:
    def test_empty_foods_returns_none(self):
        r = MagicMock(); r.foods = []
        assert _best_usda_match(r, 'chicken breast') is None

    def test_none_results_returns_none(self):
        assert _best_usda_match(None, 'chicken breast') is None

    def test_picks_best_scoring_result(self):
        foods = [_mf('Bread, whole wheat', 1), _mf('Cheddar cheese', 2), _mf('Cheese, cheddar', 3)]
        result = _best_usda_match(_mr(foods), 'cheddar cheese')
        assert result.description in ('Cheddar cheese', 'Cheese, cheddar')

    def test_rejects_missing_core_noun(self):
        foods = [_mf('Bread, white enriched', 1), _mf('Dill pickle, slices', 2)]
        result = _best_usda_match(_mr(foods), 'pickle')
        assert 'pickle' in result.description.lower()

    def test_fallback_to_first_when_all_rejected(self):
        foods = [_mf('Apple, raw', 1), _mf('Banana, ripe', 2)]
        result = _best_usda_match(_mr(foods), 'mango')
        assert result.description == 'Apple, raw'


# ── analyze_ingredient (mocked USDA) ───────────────────────────────────────
def _mn(name, unit, amount):
    n = MagicMock(); n.name = name; n.unit_name = unit; n.amount = amount; return n

@pytest.fixture()
def mock_usda():
    food_result = MagicMock()
    food_result.description = 'Chicken, breast, raw'
    food_result.fdc_id = 999

    sr = MagicMock()
    sr.foods = [food_result]

    detail = MagicMock()
    detail.food_portions = []
    detail.nutrients = [
        _mn('Energy',                      'kcal', 165.0),
        _mn('Protein',                     'g',     31.0),
        _mn('Carbohydrate, by difference', 'g',      0.0),
        _mn('Total lipid (fat)',           'g',      3.6),
    ]

    with patch('mcp_servers.ingredient_analyzer.client') as mc:
        mc.search.return_value = sr
        mc.get_food.return_value = detail
        yield mc


class TestAnalyzeIngredient:
    def test_returns_list_with_item_name(self, mock_usda):
        from mcp_servers.ingredient_analyzer import analyze_ingredient
        result = analyze_ingredient([{'item': 'Grilled Chicken', 'ingredients': ['100 g chicken breast']}])
        assert len(result) == 1 and result[0].item == 'Grilled Chicken'

    def test_calories_scaled_by_portion(self, mock_usda):
        from mcp_servers.ingredient_analyzer import analyze_ingredient
        result = analyze_ingredient([{'item': 'X', 'ingredients': ['200 g chicken breast']}])
        assert result[0].calories == pytest.approx(330.0, abs=5)

    def test_protein_scaled_by_portion(self, mock_usda):
        from mcp_servers.ingredient_analyzer import analyze_ingredient
        result = analyze_ingredient([{'item': 'X', 'ingredients': ['200 g chicken breast']}])
        assert result[0].protein == pytest.approx(62.0, abs=2)

    def test_egg_uses_hardcoded_fallback(self):
        from mcp_servers.ingredient_analyzer import analyze_ingredient
        with patch('mcp_servers.ingredient_analyzer.client') as mc:
            mc.search.side_effect = Exception('USDA should not be called for egg')
            result = analyze_ingredient([{'item': 'Breakfast', 'ingredients': ['2 egg']}])
        assert result[0].calories > 0 and result[0].protein > 0

    def test_two_ingredients_summed(self, mock_usda):
        from mcp_servers.ingredient_analyzer import analyze_ingredient
        one = analyze_ingredient([{'item': 'A', 'ingredients': ['100 g chicken breast']}])
        two = analyze_ingredient([{'item': 'B', 'ingredients': ['100 g chicken breast', '100 g chicken breast']}])
        assert two[0].calories == pytest.approx(one[0].calories * 2, abs=10)

    def test_empty_ingredients_list(self, mock_usda):
        from mcp_servers.ingredient_analyzer import analyze_ingredient
        result = analyze_ingredient([{'item': 'Empty', 'ingredients': []}])
        assert len(result) == 1 and result[0].item == 'Empty'

    def test_multiple_food_items(self, mock_usda):
        from mcp_servers.ingredient_analyzer import analyze_ingredient
        result = analyze_ingredient([
            {'item': 'A', 'ingredients': ['100 g chicken breast']},
            {'item': 'B', 'ingredients': ['100 g chicken breast']},
        ])
        assert len(result) == 2 and result[0].item == 'A' and result[1].item == 'B'

    def test_macros_non_negative(self, mock_usda):
        from mcp_servers.ingredient_analyzer import analyze_ingredient
        item = analyze_ingredient([{'item': 'X', 'ingredients': ['100 g chicken breast']}])[0]
        assert item.calories >= 0 and item.protein >= 0 and item.carbs >= 0 and item.fat >= 0

    def test_ingredients_as_comma_string(self, mock_usda):
        from mcp_servers.ingredient_analyzer import analyze_ingredient
        result = analyze_ingredient([{'item': 'X', 'ingredients': '100 g chicken breast'}])
        assert len(result) == 1 and result[0].calories > 0
