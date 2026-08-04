import { useSearch } from '../context/SearchContext';
import styles from '../constants/styles'
import { View, Text, TextInput, TouchableOpacity, Image, SafeAreaView } from '../constants/component-style';
import { ScrollView } from 'react-native';
import { useState, useEffect } from 'react';
import {Link} from 'expo-router';
import { Platform, Linking, Alert } from 'react-native';
import Svg, {Circle, Line} from 'react-native-svg';

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
function ResultCard({ result, index, onPress }) {
    const isScannedItem = !result.achieved_macros;

    const achieved_macros = result.achieved_macros || {
        cal: result.calories ?? result.Calories ?? result.cal ?? result.Cal ?? 0,
        p: result.protein ?? result.Protein ?? result.p ?? result.P ?? 0,
        c: result.carbs ?? result.Carbs ?? result.carb ?? result.Carb ?? result.c ?? result.C ?? 0,
        f: result.fats ?? result.Fats ?? result.fat ?? result.Fat ?? result.f ?? result.F ?? 0
    };
    const { cal, p, c, f } = achieved_macros;
    console.log("ResultCard debug details:", { name: result.name, p, c, f, cal, raw: result });

    const restaurant = isScannedItem ? "Scanned Menu" : result.restaurant;
    const restaurantName = typeof restaurant === "string"
        ? restaurant
        : restaurant?.name ?? "Unknown";

    const totalGap = isScannedItem ? 0 : ((result.gaps?.p || 0) + (result.gaps?.c || 0) + (result.gaps?.f || 0));
    const score = Math.max(0, Math.round(100 - totalGap));
    const topPick = isScannedItem ? false : (result.status === "Optimal" && index === 0);

    const total_cost = isScannedItem ? result.price : result.total_cost;
    const status = isScannedItem ? "Scanned Item" : result.status;

    const dishSummary = isScannedItem 
        ? result.name 
        : (result.order || [])
            .filter(o => o.quantity > 0)
            .map(o => `${o.quantity}x ${o.item}`)
            .join(", ") || "Custom Order";

    return (
    <TouchableOpacity
        className={`result-card ${topPick ? "top-pick" : ""}`}
        style={{ animationDelay: `${index * 0.07}s` }}
        onPress={() => onPress(result)}
    >
        {topPick && <View className="top-badge"><Text>⚡ Top Pick</Text></View>}
        <View>
        <View><Text className="result-name">{dishSummary || "Custom Order"}</Text></View>
        <View className="result-meta">
            <Text>{restaurantName}</Text>
            <Text className="result-meta-sep">·</Text>
            <Text style={{ color: result.estimated ? '#eab308' : '#22c55e', fontWeight: '500' }}>{result.estimated ? "Estimated" : "Verified"}</Text>
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
            <View><View><Text className="result-cal">{cal}</Text><Text className="result-cal-unit">kcal</Text></View></View>
            {!isScannedItem && <ScoreTag score={score} />}
        </View>
        
    </TouchableOpacity>
    );
}

// ─── ResultTextel ─────────────────────────────────────────────────────────────
function ResultTextel({ loading, results, onCardPress }) {
  return (
    <View className="panel-right">
      <View className="results-header">
        <View>
          <Text className="results-title">
            {results 
              ? (results[0] && !results[0].achieved_macros ? "Scanned Menu" : "Nearby Matches")
              : (loading ? "Optimizing..." : "Results")}
          </Text>
        </View>
        {results && (
          <View>
            <Text className="results-count">
              {results[0] && !results[0].achieved_macros 
                ? `${results.length} items found` 
                : `${results.length} locations found`}
            </Text>
          </View>
        )}
      </View>
      {loading && (
        <View className="results-list">{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</View>
      )}
      {!loading && results && (
        <ScrollView style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: 4 }}>
        <View className="results-list" style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: 4 }}>
          {results.map((r, i) => (
            <ResultCard key={i} result={r} index={i} onPress={onCardPress} />
          ))}
        </View>
        </ScrollView>
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
const openNavigation = (latitude, longitude, label = 'Destination') => {
  const scheme = Platform.select({
    ios: 'maps:0,0?q=',
    android: 'geo:0,0?q=',
  });

  const latLng = `${latitude},${longitude}`;
  const url = Platform.select({
    ios: `${scheme}${label}@${latLng}`,
    android: `${scheme}${latLng}(${label})`,
  });

  Linking.openURL(url).catch(() => {
    Alert.alert('Error', 'Unable to open maps');
  });
};

// ─── Lightbox ─────────────────────────────────────────────────────────────────
function ResultLightbox({ result, onClose, topPick = false }) {
  const isScannedItem = !result.achieved_macros;

   const achieved_macros = result.achieved_macros || {
    cal: result.calories ?? result.Calories ?? result.cal ?? result.Cal ?? 0,
    p: result.protein ?? result.Protein ?? result.p ?? result.P ?? 0,
    c: result.carbs ?? result.Carbs ?? result.carb ?? result.Carb ?? result.c ?? result.C ?? 0,
    f: result.fats ?? result.Fats ?? result.fat ?? result.Fat ?? result.f ?? result.F ?? 0
  };
  const { cal, p, c, f } = achieved_macros;
  console.log("ResultLightbox debug details:", { name: result.name, p, c, f, cal, raw: result });

  const restaurant = isScannedItem ? "Scanned Menu" : result.restaurant;
  const restaurantName = typeof restaurant === "string"
    ? restaurant
    : restaurant?.name ?? "Unknown";
  const isPhysicalRestaurant = typeof restaurant === "object" && restaurant !== null;
  const address = typeof restaurant === "object" ? restaurant?.address : null;
  const photoUrl = typeof restaurant === "object" ? restaurant?.photo_url : null;

  const totalGap = isScannedItem ? 0 : ((result.gaps?.p || 0) + (result.gaps?.c || 0) + (result.gaps?.f || 0));
  const score = Math.max(0, Math.round(100 - totalGap));

  const total_cost = isScannedItem ? result.price : result.total_cost;
  const status = isScannedItem ? "Scanned Item" : result.status;

  const dishSummary = isScannedItem 
    ? result.name 
    : (result.order || [])
        .filter(o => o.quantity > 0)
        .map(o => `${o.quantity}× ${o.item}`)
        .join(", ") || "Custom Order";

  return (
    <View className="lb-overlay" onPress={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <View className="lb-card">
        {/* Close */}
        <TouchableOpacity className="lb-close" onPress={onClose} aria-label="Close">
        <Svg width={20} height={20} viewBox="0 0 32 32">
        <Circle cx="16" cy="16" r="16" fill="black" />
        <Line x1="10" y1="10" x2="22" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <Line x1="22" y1="10" x2="10" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </Svg>
        </TouchableOpacity>

        {/* Image */}
        <View className="lb-image-wrap">
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} 
              style={{ width: '100%', height: '100%' }}  />
          ) : (
            <View className="lb-image-placeholder">
              <Text>No photo available</Text>
            </View>
          )}
          {topPick && <View className="lb-top-badge"><Text>⚡ Top Pick</Text></View>}
        </View>

        {/* Body */}
        <View className="lb-body">
          <View>
            <Text className="lb-restaurant">{restaurantName}</Text>
          </View>

          <View><Text className="lb-title">{dishSummary || "Custom Order"}</Text></View>
          <View className="lb-status-row">
            <Text>{status}</Text>
            {address && <><Text>·</Text><Text style={{ fontSize: 12 }}>{address}</Text></>}
          </View>

          <View className="lb-cal-row">
            <Text className="lb-cal-num">{cal}</Text>
            <Text className="lb-cal-unit">kcal</Text>
          </View>

          <View className="lb-macros">
            <View className="lb-macro">
              <Text className="lb-macro-label">Protein</Text>
              <Text className="lb-macro-val p">{p}g</Text>
            </View>
            <View className="lb-macro">
              <Text className="lb-macro-label">Carbs</Text>
              <Text className="lb-macro-val c">{c}g</Text>
            </View>
            <View className="lb-macro">
              <Text className="lb-macro-label">Fats</Text>
              <Text className="lb-macro-val f">{f}g</Text>
            </View>
          </View>

          <View className="lb-Viewider" />

          <View className="lb-price-row">
            <Text className="lb-price-label">{isScannedItem ? "Price" : "Estimated total"}</Text>
            <Text className="lb-price-val">${total_cost}</Text>
          </View>

          <View className="lb-actions">
            {!isScannedItem && isPhysicalRestaurant && (
              <TouchableOpacity onPress={() => openNavigation(restaurant?.latitude, restaurant?.longitude, restaurantName)} className="lb-directions-btn">
              <Text>
                Get Directions
              </Text>
              </TouchableOpacity>
            )}
            {!isScannedItem && (
              <View className="lb-score-chip">
                <Text className="lb-score-num">{score}%</Text>
                <Text className="lb-score-label">Match</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}


export default function ResultsPage() {
    const { results } = useSearch();
    const [selectedResult, setSelectedResult] = useState(null);

  return (
    <SafeAreaView className="container">
      <ResultTextel
        loading={false}
        results={results}
        onCardPress={(r) => setSelectedResult(r)}
      />
      {selectedResult && (
        <ResultLightbox
          result={selectedResult}
          onClose={() => setSelectedResult(null)}
          topPick={selectedResult === results?.[0] && selectedResult.status === "Optimal"}
        />
      )}
    </SafeAreaView>
  );
}