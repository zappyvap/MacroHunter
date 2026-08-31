import { useSearch } from '../context/SearchContext';
import styles from '../constants/styles'
import colors from '../constants/colors';
import { View, Text, TextInput, TouchableOpacity, Image, SafeAreaView } from '../constants/component-style';
import { ScrollView } from 'react-native';
import { useState, useEffect } from 'react';
import { Link } from 'expo-router';
import { Platform, Linking, Alert } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { router, useLocalSearchParams } from "expo-router";
import React, { useRef } from 'react';
import { StyleSheet, Dimensions, Animated, PanResponder } from 'react-native';

const AnimatedCard = Animated.createAnimatedComponent(View);

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

function StarRating({ rating }) {
  const numRating = parseFloat(rating);
  if (isNaN(numRating)) return null;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {[1, 2, 3, 4, 5].map((i) => {
          const fillAmount = Math.max(0, Math.min(1, numRating - (i - 1)));
          return (
            <View key={i} style={{ width: 14, height: 14, position: 'relative', marginHorizontal: 0.5 }}>
              <Text style={{ position: 'absolute', top: -1, left: 0, color: colors.surface2, fontSize: 13, lineHeight: 14, width: 14, textAlign: 'center' }}>★</Text>
              <View style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${fillAmount * 100}%`, overflow: 'hidden' }}>
                <Text style={{ position: 'absolute', top: -1, left: 0, color: '#f59e0b', fontSize: 13, lineHeight: 14, width: 14, textAlign: 'center' }}>★</Text>
              </View>
            </View>
          );
        })}
      </View>
      <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '600', marginLeft: 2 }}>{numRating.toFixed(1)}</Text>
    </View>
  );
}
function ResultCard({ result, index, onPress }) {
  // scanned menu items don't go through the optimizer, so they have raw macro fields
  // instead of the achieved_macros/gaps/order structure that optimized results have
  const isScannedItem = !result.achieved_macros;

  const achieved_macros = result.achieved_macros || {
    cal: result.calories ?? result.Calories ?? result.cal ?? result.Cal ?? 0,
    p: result.protein ?? result.Protein ?? result.p ?? result.P ?? 0,
    c: result.carbs ?? result.Carbs ?? result.carb ?? result.Carb ?? result.c ?? result.C ?? 0,
    f: result.fats ?? result.Fats ?? result.fat ?? result.Fat ?? result.f ?? result.F ?? 0
  };
  const { cal, p, c, f } = achieved_macros;
  console.log("ResultCard debug details:", { name: result.name, p, c, f, cal, raw: result });

  const rating = result.restaurant?.rating || result.rating
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
      {topPick && <View className="top-badge"><Text style={{ color: colors.bg, fontFamily: 'Inter-Bold' }}>⚡ Top Pick</Text></View>}
      <View style={{ flex: 1, paddingRight: 8 }}>
        <View><Text className="result-name">{dishSummary || "Custom Order"}</Text></View>
        <View className="result-meta" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
          <Text numberOfLines={1} style={{ flexShrink: 1, marginRight: 4 }}>{restaurantName}</Text>
          {rating ? (
            <>
              <Text className="result-meta-sep">·</Text>
              <StarRating rating={rating} />
            </>
          ) : null}
          <Text className="result-meta-sep">·</Text>
          <Text style={{ color: result.estimated ? '#eab308' : '#22c55e', fontWeight: '500', marginRight: 4 }}>{result.estimated ? "Estimated" : "Verified"}</Text>
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
function ResultTextel({ loading, results, onCardPress, onBack, onOpenFilter }) {
  return (
    <View className="panel-right">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <TouchableOpacity
          onPress={onBack}
          activeOpacity={0.7}
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
            width: 48,
            height: 48,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            marginTop: 12,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <Text style={{ fontFamily: 'Inter-Bold', color: colors.text, fontSize: 24, marginTop: -2 }}>←</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onOpenFilter}
          activeOpacity={0.7}
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
            width: 48,
            height: 48,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            marginTop: 12,
            marginRight: 10,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <Line x1="4" y1="6" x2="20" y2="6" />
            <Line x1="4" y1="12" x2="20" y2="12" />
            <Line x1="4" y1="18" x2="20" y2="18" />
          </Svg>
        </TouchableOpacity>
      </View>
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
      {!loading && results && results.length > 0 && (
        <ScrollView style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: 4 }}>
          <View className="results-list" style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: 4 }}>
            {results.map((r, i) => (
              <ResultCard key={i} result={r} index={i} onPress={onCardPress} />
            ))}
          </View>
        </ScrollView>
      )}
      {!loading && results && results.length === 0 && (
        <View className="empty-state">
          <View className="empty-icon"><Text>🍽️</Text></View>
          <View><Text className="empty-text">No Matches Found</Text></View>
          <View><Text className="empty-sub">We couldn't find any menu items that fit your macro targets. Try relaxing your goals or scanning a different menu.</Text></View>
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
// opens the native maps app with directions to the restaurant's coordinates
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
  console.log(url)
  console.log(latLng)
  console.log(latitude)
  console.log(longitude)
  Linking.openURL(url).catch(() => {
    Alert.alert('Error', 'Unable to open maps');
  });
};

// ─── Lightbox ─────────────────────────────────────────────────────────────────
function ResultLightbox({ result, onClose, topPick = false, onNext, onPrev, hasNext, hasPrev }) {
  const translateY = useRef(new Animated.Value(0)).current;

  const panResponder = React.useMemo(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (e, gestureState) => Math.abs(gestureState.dy) > 10,
      onPanResponderMove: (e, gestureState) => {
        let ty = gestureState.dy;
        // Add resistance if pulling past the first/last item
        if (!hasNext && ty < 0) ty = ty * 0.2;
        if (!hasPrev && ty > 0) ty = ty * 0.2;
        translateY.setValue(ty);
      },
      onPanResponderRelease: (e, gestureState) => {
        const windowHeight = Dimensions.get('window').height;

        if (hasNext && (gestureState.dy < -100 || gestureState.vy < -1)) {
          // Swipe Up -> Next (Card flies off top)
          Animated.timing(translateY, {
            toValue: -windowHeight,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            onNext();
            // Teleport to bottom, then spring in
            translateY.setValue(windowHeight);
            Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
          });
        } else if (hasPrev && (gestureState.dy > 100 || gestureState.vy > 1)) {
          // Swipe Down -> Prev (Card flies off bottom)
          Animated.timing(translateY, {
            toValue: windowHeight,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            onPrev();
            // Teleport to top, then spring in
            translateY.setValue(-windowHeight);
            Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
          });
        } else {
          // Snap back to center
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        }
      }
    }), [hasNext, hasPrev, onNext, onPrev]
  );

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
  const rating = result.restaurant?.rating || result.rating;
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
      <AnimatedCard {...panResponder.panHandlers} className="lb-card" style={{ transform: [{ translateY }] }}>
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
              style={{ width: '100%', height: '100%' }} />
          ) : (
            <View className="lb-image-placeholder">
              <Text>No photo available</Text>
            </View>
          )}
          {topPick && <View className="lb-top-badge"><Text style={{ color: colors.bg, fontFamily: 'Inter-Bold' }}>⚡ Top Pick</Text></View>}
        </View>

        {/* Body */}
        <View className="lb-body">
          <View>
            <Text className="lb-restaurant">{restaurantName}</Text>
          </View>

          <View><Text className="lb-title">{dishSummary || "Custom Order"}</Text></View>
          <View className="lb-status-row" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', rowGap: 4 }}>
            <Text>{status}</Text>
            {rating ? (
              <>
                <Text style={{ marginHorizontal: 4 }}>·</Text>
                <StarRating rating={rating} />
              </>
            ) : null}
            {address && (
              <>
                <Text style={{ marginHorizontal: 4 }}>·</Text>
                <Text style={{ fontSize: 12, flexShrink: 1 }} numberOfLines={1}>{address}</Text>
              </>
            )}
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
                <Text style={{ color: colors.bg, fontFamily: 'Inter-Bold' }}>
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
      </AnimatedCard>
    </View>
  );
}


// ─── ResultsPage ─────────────────────────────────────────────────────────────
function FilterLightbox({ filters, setFilters, onClose }) {
  const [localFilters, setLocalFilters] = useState(filters);

  const applyFilters = () => {
    setFilters(localFilters);
    onClose();
  };

  return (
    <View className="lb-overlay" onPress={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <View className="lb-card" style={{ padding: 24 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Text style={{ fontFamily: 'Inter-Bold', fontSize: 20, color: colors.text }}>Filters</Text>
          <TouchableOpacity onPress={onClose} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2" strokeLinecap="round">
              <Line x1="18" y1="6" x2="6" y2="18" />
              <Line x1="6" y1="6" x2="18" y2="18" />
            </Svg>
          </TouchableOpacity>
        </View>

        <Text style={{ fontFamily: 'Inter-SemiBold', color: colors.muted, marginBottom: 12 }}>Sort By</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
          {['match', 'protein', 'carbs', 'fats'].map(sortOpt => (
            <TouchableOpacity key={sortOpt} onPress={() => setLocalFilters({ ...localFilters, sortBy: sortOpt })}
              style={{
                paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8,
                backgroundColor: localFilters.sortBy === sortOpt ? colors.accent : colors.surface2,
              }}
            >
              <Text style={{ color: localFilters.sortBy === sortOpt ? colors.bg : colors.text, fontFamily: 'Inter-Medium', textTransform: 'capitalize' }}>
                {sortOpt === 'match' ? 'Best Match' : `Highest ${sortOpt}`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={{ fontFamily: 'Inter-SemiBold', color: colors.muted, marginBottom: 12 }}>Max Price</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
          {[null, 10, 20, 30].map(price => (
            <TouchableOpacity key={price || 'any'} onPress={() => setLocalFilters({ ...localFilters, maxPrice: price })}
              style={{
                paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8,
                backgroundColor: localFilters.maxPrice === price ? colors.accent : colors.surface2,
              }}
            >
              <Text style={{ color: localFilters.maxPrice === price ? colors.bg : colors.text, fontFamily: 'Inter-Medium' }}>
                {price ? `$${price}` : 'Any'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <Text style={{ fontFamily: 'Inter-SemiBold', color: colors.text, fontSize: 16 }}>Verified Sources Only</Text>
          <TouchableOpacity
            onPress={() => setLocalFilters({ ...localFilters, onlyVerified: !localFilters.onlyVerified })}
            style={{ width: 50, height: 28, borderRadius: 14, backgroundColor: localFilters.onlyVerified ? colors.accent : colors.surface2, padding: 2, justifyContent: 'center' }}
          >
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.bg, transform: [{ translateX: localFilters.onlyVerified ? 22 : 0 }] }} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={applyFilters} style={{ backgroundColor: colors.accent, paddingVertical: 16, borderRadius: 12, alignItems: 'center' }}>
          <Text style={{ color: colors.bg, fontFamily: 'Inter-Bold', fontSize: 16 }}>Apply Filters</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── ResultsPage ─────────────────────────────────────────────────────────────
// reads the search results from context and displays them as cards with a lightbox detail view
export default function ResultsPage() {
  const { results, setResults } = useSearch();
  const [selectedResult, setSelectedResult] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState({ maxPrice: null, onlyVerified: false, sortBy: 'match' });

  const filteredResults = React.useMemo(() => {
    if (!results) return null;
    let res = [...results];

    if (filters.maxPrice) {
      res = res.filter(r => (r.total_cost || r.price || 0) <= filters.maxPrice);
    }
    if (filters.onlyVerified) {
      res = res.filter(r => !r.estimated);
    }

    if (filters.sortBy === 'protein') {
      res.sort((a, b) => ((b.achieved_macros?.p ?? b.protein ?? 0) - (a.achieved_macros?.p ?? a.protein ?? 0)));
    } else if (filters.sortBy === 'carbs') {
      res.sort((a, b) => ((b.achieved_macros?.c ?? b.carbs ?? 0) - (a.achieved_macros?.c ?? a.carbs ?? 0)));
    } else if (filters.sortBy === 'fats') {
      res.sort((a, b) => ((b.achieved_macros?.f ?? b.fats ?? 0) - (a.achieved_macros?.f ?? a.fats ?? 0)));
    } else if (filters.sortBy === 'match') {
      res.sort((a, b) => {
        const scoreA = a.status === "Optimal" ? 100 : Math.max(0, 100 - ((a.gaps?.p || 0) + (a.gaps?.c || 0) + (a.gaps?.f || 0)));
        const scoreB = b.status === "Optimal" ? 100 : Math.max(0, 100 - ((b.gaps?.p || 0) + (b.gaps?.c || 0) + (b.gaps?.f || 0)));
        return scoreB - scoreA;
      });
    }

    return res;
  }, [results, filters]);

  const currentIndex = filteredResults ? filteredResults.findIndex(r => r === selectedResult) : -1;
  const hasNext = filteredResults && currentIndex !== -1 && currentIndex < filteredResults.length - 1;
  const hasPrev = filteredResults && currentIndex > 0;

  const handleNext = () => {
    if (hasNext) setSelectedResult(filteredResults[currentIndex + 1]);
  };

  const handlePrev = () => {
    if (hasPrev) setSelectedResult(filteredResults[currentIndex - 1]);
  };

  return (
    <SafeAreaView className="container">
      <ResultTextel
        loading={false}
        results={filteredResults}
        onCardPress={(r) => setSelectedResult(r)}
        onBack={() => {
          setResults(null);
          router.push('/');
        }}
        onOpenFilter={() => setFilterOpen(true)}
      />
      {selectedResult && (
        <ResultLightbox
          result={selectedResult}
          onClose={() => setSelectedResult(null)}
          topPick={selectedResult === filteredResults?.[0] && selectedResult.status === "Optimal" && filters.sortBy === 'match'}
          onNext={handleNext}
          onPrev={handlePrev}
          hasNext={hasNext}
          hasPrev={hasPrev}
        />
      )}
      {filterOpen && (
        <FilterLightbox
          filters={filters}
          setFilters={setFilters}
          onClose={() => setFilterOpen(false)}
        />
      )}
    </SafeAreaView>
  );
}