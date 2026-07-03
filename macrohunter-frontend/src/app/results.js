import { useSearch } from '../context/SearchContext';
import { View, Text } from 'react-native';
// ─── ResultCard ───────────────────────────────────────────────────────────────
function ScoreTag({ score }) {
  const cls = score >= 90 ? "score-high" : score >= 75 ? "score-mid" : "score-low";
  return <Text className={`result-score ${cls}`}>{score}% Match</Text>;
}
function SkeletonCard() {
  return (
    <View className="skeleton-card">
      <View className="skel-line" style={{ height: 18, width: "55%" }} />
      <View className="skel-line" style={{ height: 12, width: "35%" }} />
      <View style={{ display: "flex", gap: 12, marginTop: 12 }}>
        {[60, 60, 60].map((w, i) => (
          <View key={i} className="skel-line" style={{ height: 36, width: w }} />
        ))}
      </View>
    </View>
  );
}
function ResultCard({ result, index, onClick }) {
    const { achieved_macros, gaps, status, total_cost, order, restaurant } = result;
    const { cal, p, c, f } = achieved_macros;
    const restaurantName = typeof restaurant === "string"
    ? restaurant
    : restaurant?.name ?? "Unknown";

    const totalGap = (gaps.p || 0) + (gaps.c || 0) + (gaps.f || 0);
    const score = Math.max(0, Math.round(100 - totalGap));
    const topPick = status === "Optimal";

    const dishSummary = order
    .filter(o => o.quantity > 0)
    .map(o => `${o.quantity}x ${o.item}`)
    .join(", ");

    return (
    <View
        className={`result-card ${topPick ? "top-pick" : ""}`}
        style={{ animationDelay: `${index * 0.07}s` }}
        onClick={() => onClick(result)}
    >
        {topPick && <View className="top-badge"><Text>⚡ Top Pick</Text></View>}
        <View>
        <View><Text className="result-name">{dishSummary || "Custom Order"}</Text></View>
        <View className="result-meta">
            <Text>{restaurantName}</Text>
            <Text className="result-meta-sep">·</Text>
            <Text>{status}</Text>
            <Text className="result-meta-sep">·</Text>
            <Text>💰 ${total_cost}</Text>
        </View>
        <View className="result-macros">
            <View className="rmacro"><Text className="rmacro-label">Protein</Text><Text className="rmacro-val p">{p}g</Text></View>
            <View className="rmacro"><Text className="rmacro-label">Carbs</Text><Text className="rmacro-val c">{c}g</Text></View>
            <View className="rmacro"><Text className="rmacro-label">Fats</Text><Text className="rmacro-val f">{f}g</Text></View>
        </View>
        </View>
        <View className="result-right">
        <View><View><Text className="result-cal">{cal}</Text></View><View><Text className="result-cal-unit">kcal</Text></View></View>
        <ScoreTag score={score} />
        </View>
    </View>
    );
    }

// ─── ResultTextel ─────────────────────────────────────────────────────────────
function ResultTextel({ loading, results, onCardClick }) {
  return (
    <View className="panel-right">
      <View className="results-header">
        <View>
          <Text className="results-title">{results ? "Nearby Matches" : loading ? "Optimizing..." : "Results"}</Text>
        </View>
        {results && <View><Text className="results-count">{results.length} locations found</Text></View>}
      </View>
      {loading && (
        <View className="results-list">{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</View>
      )}
      {!loading && results && (
        <View className="results-list" style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: 4 }}>
          {results.map((r, i) => (
            <ResultCard key={i} result={r} index={i} onClick={onCardClick} />
          ))}
        </View>
      )}
      {!loading && !results && (
        <View className="empty-state">
          <View className="empty-icon"><Text>⌖</Text></View>
          <View><Text className="empty-text">No Hunt Started</Text></View>
          <View><Text className="empty-sub">Set your macro targets and calories on the left, then hit the search button to find meals near you.</Text></View>
        </View>
      )}
    </View>
  );
}
export default function ResultsPage() {
    const { results } = useSearch();
  return (
    <ResultTextel loading={false} results={results} onCardClick={() => {}} />
  );
}