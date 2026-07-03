import { StatusBar } from 'expo-status-bar';
import {
  Image as RNImage,
  SafeAreaView as RNSafeAreaView,
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  TouchableOpacity as RNTouchableOpacity,
  View as RNView,
} from 'react-native';
import { useState, useEffect } from "react";
import { Link } from 'expo-router';
import * as Location from 'expo-location';
import { useSearch } from '../context/SearchContext';
import {router, useLocalSearchParams} from "expo-router";

function getStyleFromClassName(className) {
  if (!className) return undefined;
  return className
    .split(/\s+/)
    .map((name) => styles[name])
    .filter(Boolean);
}

function View({ className, style, ...props }) {
  return <RNView {...props} style={[style, getStyleFromClassName(className)]} />;
}

function Text({ className, style, ...props }) {
  return <RNText {...props} style={[style, getStyleFromClassName(className)]} />;
}

function TextInput({ className, style, ...props }) {
  return <RNTextInput {...props} style={[style, getStyleFromClassName(className)]} />;
}

function TouchableOpacity({ className, style, ...props }) {
  return <RNTouchableOpacity {...props} style={[style, getStyleFromClassName(className)]} />;
}

function Image({ className, style, ...props }) {
  return <RNImage {...props} style={[style, getStyleFromClassName(className)]} />;
}

function SafeAreaView({ className, style, ...props }) {
  return <RNSafeAreaView {...props} style={[style, getStyleFromClassName(className)]} />;
}

export default function App() {
  return (
    <>
      <StatusBar style="auto" />
      <HunterPage />
    </>
  );
}
function ScoreTag({ score }) {
  const cls = score >= 90 ? "score-high" : score >= 75 ? "score-mid" : "score-low";
  return <Text className={`result-score ${cls}`}>{score}% Match</Text>;
}

function MacroBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <View className="mbar-row">
      <Text className="mbar-label" style={{ color }}>{label}</Text>
      <View className="mbar-track">
        <View className="mbar-fill" style={{ width: `${pct}%`, background: color }} />
      </View>
      <Text className="mbar-val">{value}g</Text>
    </View>
  );
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
// ─── Lightbox ─────────────────────────────────────────────────────────────────
function ResultLightbox({ result, onClose }) {
  const { achieved_macros, gaps, status, total_cost, order, restaurant } = result;
  const { cal, p, c, f } = achieved_macros;

  const restaurantName = typeof restaurant === "string"
    ? restaurant
    : restaurant?.name ?? "Unknown";
  const address = typeof restaurant === "object" ? restaurant?.address : null;
  const photoUrl = typeof restaurant === "object" ? restaurant?.photo_url : null;

  const totalGap = (gaps.p || 0) + (gaps.c || 0) + (gaps.f || 0);
  const score = Math.max(0, Math.round(100 - totalGap));
  const topPick = status === "Optimal";

  const dishSummary = order
    .filter(o => o.quantity > 0)
    .map(o => `${o.quantity}× ${o.item}`)
    .join(", ");

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Build Google Maps directions URL (NEED TO CHANGE)
  const directionsUrl = address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(restaurantName + " " + address)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurantName)}`;

  return (
    <View className="lb-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <View className="lb-card">
        {/* Close */}
        <TouchableOpacity className="lb-close" onClick={onClose} aria-label="Close">
        </TouchableOpacity>

        {/* Image */}
        <View className="lb-image-wrap">
          {photoUrl ? (
            <Image src={photoUrl} alt={restaurantName} />
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
            <Text className="lb-price-label">Estimated total</Text>
            <Text className="lb-price-val">${total_cost}</Text>
          </View>

          <View className="lb-actions">
            <Text>
              <Link href={directionsUrl}></Link>
              Get Directions
            </Text>
            <View className="lb-score-chip">
              <Text className="lb-score-num">{score}%</Text>
              <Text className="lb-score-label">Match</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
function CaloriesCard({ calories, setCalories }) {
  const pct = calories ? Math.min((+calories / 3000) * 100, 100) : 0;
  return (
    <View className="calories-card">
      <View><Text className="section-label">Daily Calories</Text></View>
      <View className="cal-display">
        <TextInput className="cal-input" type="number" placeholder="2000"
          value={calories} onChangeText={setCalories} min={0} max={9999} />
        <Text className="cal-unit">kcal</Text>
      </View>
      <View className="cal-bar">
        <View className="cal-bar-fill" style={{ width: `${pct}%` }} />
      </View>
    </View>
  );
}

// ─── MacrosCard ───────────────────────────────────────────────────────────────
const MACRO_FIELDS = [
  { label: "Protein", color: "var(--protein)", cls: "protein", key: "protein" },
  { label: "Carbs",   color: "var(--carbs)",   cls: "carbs",   key: "carbs"   },
  { label: "Fats",    color: "var(--fats)",     cls: "fats",    key: "fats"    },
];

function MacrosCard({ protein, setProtein, carbs, setCarbs, fats, setFats }) {
  const vals    = { protein, carbs, fats };
  const setters = { protein: setProtein, carbs: setCarbs, fats: setFats };
  const total   = (+protein || 0) + (+carbs || 0) + (+fats || 0);
  return (
    <View className="macros-card">
      <View><Text className="section-label">Macro Targets</Text></View>
      <View className="macros-grid">
        {MACRO_FIELDS.map(({ label, color, cls, key }) => (
          <View key={cls} className="macro-field">
            <View className="macro-label">
              <View className="macro-dot" style={{ background: color }} />
              <Text style={{ color }}>{label}</Text>
            </View>
            <View className={`macro-input-wrap ${cls}`}>
              <TextInput className="macro-num" type="number" placeholder="0"
                value={vals[key]} onChangeText={value => setters[key](value)} min={0} />
              <Text className="macro-g">g</Text>
            </View>
          </View>
        ))}
      </View>
      {total > 0 && (
        <View className="macro-bars">
          <MacroBar label="PRO" value={+protein || 0} max={total} color="var(--protein)" />
          <MacroBar label="CRB" value={+carbs   || 0} max={total} color="var(--carbs)"   />
          <MacroBar label="FAT" value={+fats    || 0} max={total} color="var(--fats)"    />
        </View>
      )}
    </View>
  );
}
// ─── LocationCard ─────────────────────────────────────────────────────────────
function LocationCard({ locState, location }) {
  return (
    <View className={`location-card ${locState === "acquiring" ? "acquiring" : ""} ${locState === "denied" ? "denied" : ""}`}>
      <View className={`loc-icon ${locState === "denied" ? "denied" : ""}`}>
      </View>
      <View className="loc-text">
        <View><Text className="loc-name">{location.name}</Text></View>
        <View>
          <Text className="loc-coords">{location.coords ?? (locState === "acquiring" ? "Waiting for browser prompt…" : "Will prompt when you search")}</Text>
        </View>
      </View>
    </View>
  );
}


// ─── HunterPage ───────────────────────────────────────────────────────────────
function HunterPage() {
  const [calories, setCalories] = useState("");
  const [protein,  setProtein]  = useState("");
  const [carbs,    setCarbs]    = useState("");
  const [fats,     setFats]     = useState("");
  const [locState, setLocState] = useState("idle");
  const [location, setLocation] = useState({ name: "Click search to detect location", coords: null, lat: null, lng: null });
  const [loading,  setLoading]  = useState(false);
  const {results,  setResults} = useSearch();
  const [selected, setSelected] = useState(null);

  const isFormReady = calories && protein && carbs && fats;

  const runSearch = async (lat, lng) => {
    setLoading(true);
    setResults(null);
    const payload = {
      searching_for_restaurant: true,
      latitude: lat, longitude: lng,
      target_calories: +calories, target_protein: +protein,
      target_carbs: +carbs, target_fats: +fats,
    };
    try {
      {/*NEED TO CHANGE*/}
      const res  = await fetch("http://10.0.0.233:8000/api/optimize-meal", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      setResults(data.results);
      router.push('/results')
    } catch (err) {
      console.error("Search failed:", err);
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  const requestLocationThenSearch = async () => {
    setLocState("acquiring");
    setLocation({ name: "Requesting location…", coords: "Waiting for permission" });

    let { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      setLocState("denied");
      setLocation({
        name: "Location Denied",
        coords: "Please enable location permissions in your browser settings",
      });
      return;
    }

    const currentLocation = await Location.getCurrentPositionAsync({});
    const { latitude, longitude } = currentLocation.coords;

    setLocState("ready");
    setLocation({
      name: "Ready",
      coords: `(${latitude}, ${longitude})`,
      lat: latitude,
      lng: longitude,
    });
    await runSearch(latitude, longitude);
  };
  // NEED TO CHANGE
  const handleSearch = () => {
    if (!isFormReady) return;
    locState === "ready" && location.lat !== null ? runSearch(location.lat, location.lng) : requestLocationThenSearch();
  };

  return (
    <>
      <SafeAreaView className="app-header" flex ="1" flexDirection="column" justifyContent="flex-end" alignItems="center">
        <View className="panel-left">
          <View>
            <View justifyContent="center" alignItems="center" gap={2}>
              <Text className="hero-text">Hunt Your Macros</Text>
            </View>
            <View style={{ marginTop: 10 }}>
              <Text className="hero-sub">Enter your nutrition goals and we'll find the best meals near you.</Text>
            </View>
          </View>
          <CaloriesCard calories={calories} setCalories={setCalories} />
          <MacrosCard protein={protein} setProtein={setProtein} carbs={carbs} setCarbs={setCarbs} fats={fats} setFats={setFats} />
          <LocationCard locState={locState} location={location} />
          <TouchableOpacity className={`search-btn ${loading ? "loading" : ""}`} onPress={handleSearch} disabled={loading || !isFormReady} activeOpacity={0.9}>
            {loading ? (
              <>
                <Text className="spin">◈</Text>
                <Text>Scanning Area…</Text>
              </>
            ) : locState === "acquiring" ? (
              <>
                <Text className="spin">◈</Text>
                <Text>Awaiting Permission…</Text>
              </>
            ) : (
              <>
                <View className="btn-shimmer" />
                <Text>⌖ Hunt Meals Nearby</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
        {/*//DID HAVE RESULTS CARD HERE USE RESULTSTEXTEL INSTEAD LATER*/}
      </SafeAreaView>

      {selected && (
        <ResultLightbox result={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
// ─── Layout ───────────────────────────────────────────────────────────────────
function AppLayout({ locState, children }) {
  return (
    <>
      <View className="app">
        <View className="radar-bg">
          {[300,240,180,120,60].map((s,i) => <View key={i} className="radar-ring" style={{ width: s, height: s }} />)}
          <View className="radar-sweep" />
        </View>
        <View className="app-overlay" />
          <View className="logo-mark">
          </View>
          <View>
            <View><Text className="logo-text">MacroHunter</Text></View>
            <View><Text className="logo-sub">Find your perfect meal</Text></View>
          </View>
          <View className="header-right">
            <View className={`status-dot ${locState === "denied" ? "denied" : ""}`} />
            <Text>{locState === "acquiring" ? "Acquiring GPS…" : locState === "ready" ? "GPS Active" : locState === "denied" ? "GPS Denied" : "GPS Standby"}</Text>
          </View>
        {children}
      </View>
    </>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  app: {
    flex: 1,
    backgroundColor: '#f8fafc',
    position: 'relative',
  },
  'app-header': {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    gap: 16,
    backgroundColor: '#f8fafc',
  },
  'panel-left': {
    flex: 1,
    maxWidth: 420,
    gap: 20,
  },
  'panel-right': {
    flex: 1,
    gap: 20,
    paddingLeft: 12,
  },
  'section-label': {
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#64748b',
    marginBottom: 8,
  },
  'hero-text': {
    fontWeight: '800',
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -1,
    color: '#0f172a',
    gap: 2,
  },
  'hero-sub': {
    fontSize: 15,
    color: '#64748b',
    lineHeight: 22,
    fontWeight: '400',
  },
  'calories-card': {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  'cal-display': {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 4,
  },
  'cal-input': {
    fontWeight: '700',
    fontSize: 48,
    color: '#0f172a',
    width: 180,
    letterSpacing: -1,
  },
  'cal-unit': {
    fontWeight: '500',
    fontSize: 16,
    color: '#64748b',
  },
  'cal-bar': {
    marginTop: 16,
    height: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  'cal-bar-fill': {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 3,
  },
  'macros-card': {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  'macros-grid': {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 4,
  },
  'macro-field': {
    flex: 1,
    gap: 8,
  },
  'macro-label': {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    fontWeight: '500',
    fontSize: 13,
    color: '#0f172a',
  },
  'macro-dot': {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  'macro-input-wrap': {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  'macro-num': {
    fontWeight: '600',
    fontSize: 18,
    color: '#0f172a',
    flex: 1,
  },
  'macro-g': {
    fontWeight: '500',
    fontSize: 14,
    color: '#64748b',
  },
  'macro-bars': {
    marginTop: 20,
    gap: 10,
  },
  'mbar-row': {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
  },
  'mbar-label': {
    width: 35,
  },
  'mbar-track': {
    flex: 1,
    height: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  'mbar-fill': {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 3,
  },
  'mbar-val': {
    width: 35,
    textAlign: 'right',
  },
  'location-card': {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  acquiring: {
    borderColor: '#10b981',
    backgroundColor: '#d1fae5',
  },
  denied: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  'loc-icon': {
    width: 36,
    height: 36,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  'loc-text': {
    flex: 1,
  },
  'loc-name': {
    fontWeight: '600',
    fontSize: 14,
    color: '#0f172a',
  },
  'loc-coords': {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  'search-btn': {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#10b981',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  loading: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowOpacity: 0,
    elevation: 0,
  },
  'btn-shimmer': {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ffffff',
  },
  spin: {
    fontSize: 16,
  },
  'results-header': {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  'results-title': {
    fontWeight: '700',
    fontSize: 24,
    letterSpacing: -0.5,
    color: '#0f172a',
  },
  'results-count': {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 4,
  },
  'results-list': {
    gap: 12,
  },
  'result-card': {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  'top-pick': {
    borderColor: '#10b981',
  },
  'top-badge': {
    alignSelf: 'flex-start',
    backgroundColor: '#10b981',
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 11,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  'result-name': {
    fontWeight: '600',
    fontSize: 16,
    color: '#0f172a',
    marginBottom: 6,
  },
  'result-meta': {
    fontSize: 13,
    color: '#64748b',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  'result-meta-sep': {
    color: '#cbd5e1',
  },
  'result-macros': {
    flexDirection: 'row',
    gap: 16,
  },
  rmacro: {
    gap: 2,
  },
  'rmacro-label': {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
  },
  'rmacro-val': {
    fontWeight: '600',
    fontSize: 15,
  },
  'result-right': {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  'result-cal': {
    fontWeight: '700',
    fontSize: 28,
    lineHeight: 28,
    color: '#0f172a',
  },
  'result-cal-unit': {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 4,
  },
  'result-score': {
    fontWeight: '600',
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  'score-high': {
    color: '#065f46',
    backgroundColor: '#d1fae5',
  },
  'score-mid': {
    color: '#854d0e',
    backgroundColor: '#fef08a',
  },
  'score-low': {
    color: '#64748b',
    backgroundColor: '#f1f5f9',
  },
  'empty-state': {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 60,
  },
  'empty-icon': {
    width: 64,
    height: 64,
    backgroundColor: '#f1f5f9',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  'empty-text': {
    fontWeight: '600',
    fontSize: 18,
    color: '#0f172a',
  },
  'empty-sub': {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
  'skeleton-card': {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  'skel-line': {
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    marginBottom: 10,
  },
  'lb-overlay': {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  'lb-card': {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    width: '90%',
    maxWidth: 560,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.18,
    shadowRadius: 30,
    elevation: 8,
  },
  'lb-close': {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  'lb-image-wrap': {
    width: '100%',
    height: 220,
    backgroundColor: '#f1f5f9',
    position: 'relative',
  },
  'lb-image-placeholder': {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#e8f0fe',
  },
  'lb-top-badge': {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: '#10b981',
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 11,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  'lb-body': {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
  },
  'lb-restaurant': {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  'lb-title': {
    fontWeight: '700',
    fontSize: 20,
    color: '#0f172a',
    lineHeight: 26,
    marginBottom: 4,
  },
  'lb-status-row': {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: '#64748b',
    marginBottom: 20,
  },
  'lb-cal-row': {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 20,
  },
  'lb-cal-num': {
    fontWeight: '800',
    fontSize: 40,
    letterSpacing: -1.5,
    color: '#0f172a',
    lineHeight: 40,
  },
  'lb-cal-unit': {
    fontWeight: '500',
    fontSize: 14,
    color: '#64748b',
  },
  'lb-macros': {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  'lb-macro': {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  'lb-macro-label': {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  'lb-macro-val': {
    fontWeight: '700',
    fontSize: 18,
  },
  'lb-divider': {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginBottom: 20,
  },
  'lb-Viewider': {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginBottom: 20,
  },
  'lb-price-row': {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  'lb-price-label': {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  'lb-price-val': {
    fontWeight: '700',
    fontSize: 22,
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  'lb-actions': {
    flexDirection: 'row',
    gap: 10,
  },
  'lb-directions-btn': {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#10b981',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  'lb-score-chip': {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minWidth: 80,
  },
  'lb-score-num': {
    fontWeight: '800',
    fontSize: 18,
    color: '#0f172a',
    lineHeight: 18,
  },
  'lb-score-label': {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
