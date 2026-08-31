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
// ─── ScoreTag ─────────────────────────────────────────────────────────────────
// displays a colored match percentage badge (green ≥90%, yellow ≥75%, gray below)
function ScoreTag({ score }) {
  const cls = score >= 90 ? "score-high" : score >= 75 ? "score-mid" : "score-low";
  return <Text className={`result-score ${cls}`}>{score}% Match</Text>;
}

// ─── MacroBar ─────────────────────────────────────────────────────────────────
// a single horizontal progress bar showing one macro's value relative to the total
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
// ─── SkeletonCard ─────────────────────────────────────────────────────────────
// placeholder loading card shown while results are being fetched
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
          {/**NEED TO CHANGE */}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
        </TouchableOpacity>

        {/* Image */}
        <View className="lb-image-wrap">
          {photoUrl ? (
            <Image src={photoUrl} alt={restaurantName} />
          ) : (
            <View className="lb-image-placeholder">
              {/* NEED TO CHANGE */}
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
              <Text>No photo available</Text>
            </View>
          )}
          {topPick && <View className="lb-top-badge"><Text>⚡ Top Pick</Text></View>}
        </View>

        {/* Body */}
        <View className="lb-body">
          <View className="lb-restaurant">
            {/* NEED TO CHANGE */}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
            <Text>{restaurantName}</Text>
          </View>

          <View className="lb-title"><Text>{dishSummary || "Custom Order"}</Text></View>
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
            {/* NEED TO CHANGE */}
            <Text
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="lb-directions-btn"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                <circle cx="12" cy="9" r="2.5" fill="white" stroke="white" />
              </svg>
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
// ─── CaloriesCard ─────────────────────────────────────────────────────────────
// input card for daily calorie target with a fill bar showing progress toward 3000kcal
function CaloriesCard({ calories, setCalories }) {
  const pct = calories ? Math.min((+calories / 3000) * 100, 100) : 0;
  return (
    <View className="calories-card">
      <View className="section-label"><Text>Daily Calories</Text></View>
      <View className="cal-display">
        <TextInput className="cal-input" type="number" placeholder="2000"
          value={calories} onChange={e => setCalories(e.target.value)} min={0} max={9999} />
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
  { label: "Carbs", color: "var(--carbs)", cls: "carbs", key: "carbs" },
  { label: "Fats", color: "var(--fats)", cls: "fats", key: "fats" },
];

function MacrosCard({ protein, setProtein, carbs, setCarbs, fats, setFats }) {
  const vals = { protein, carbs, fats };
  const setters = { protein: setProtein, carbs: setCarbs, fats: setFats };
  const total = (+protein || 0) + (+carbs || 0) + (+fats || 0);
  return (
    <View className="macros-card">
      <View className="section-label"><Text>Macro Targets</Text></View>
      <View className="macros-grid">
        {MACRO_FIELDS.map(({ label, color, cls, key }) => (
          <View key={cls} className="macro-field">
            <View className="macro-label">
              <View className="macro-dot" style={{ background: color }} />
              <Text style={{ color }}>{label}</Text>
            </View>
            <View className={`macro-input-wrap ${cls}`}>
              <TextInput className="macro-num" type="number" placeholder="0"
                value={vals[key]} onChange={e => setters[key](e.target.value)} min={0} />
              <Text className="macro-g">g</Text>
            </View>
          </View>
        ))}
      </View>
      {total > 0 && (
        <View className="macro-bars">
          <MacroBar label="PRO" value={+protein || 0} max={total} color="var(--protein)" />
          <MacroBar label="CHO" value={+carbs || 0} max={total} color="var(--carbs)" />
          <MacroBar label="FAT" value={+fats || 0} max={total} color="var(--fats)" />
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
        {/* NEED TO CHANGE */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      </View>
      <View className="loc-text">
        <View className="loc-name"><Text>{location.name}</Text></View>
        <View className="loc-coords">
          <Text>{location.coords ?? (locState === "acquiring" ? "Waiting for browser prompt…" : "Will prompt when you search")}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── ResultCard ───────────────────────────────────────────────────────────────
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
        <View className="result-name"><Text>{dishSummary || "Custom Order"}</Text></View>
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
        <View><View className="result-cal"><Text>{cal}</Text></View><View className="result-cal-unit"><Text>kcal</Text></View></View>
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
        <View className="results-title">
          <Text>{results ? "Nearby Matches" : loading ? "Optimizing..." : "Results"}</Text>
        </View>
        {results && <View className="results-count"><Text>{results.length} locations found</Text></View>}
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
          <View className="empty-text"><Text>No Hunt Started</Text></View>
          <View className="empty-sub"><Text>Set your macro targets and calories on the left, then hit the search button to find meals near you.</Text></View>
        </View>
      )}
    </View>
  );
}
// ─── HunterPage ───────────────────────────────────────────────────────────────
function HunterPage() {
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fats, setFats] = useState("");
  const [locState, setLocState] = useState("idle");
  const [location, setLocation] = useState({ name: "Click search to detect location", coords: null, lat: null, lng: null });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
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
      {/*NEED TO CHANGE*/ }
      const res = await fetch("http://127.0.0.1:8000/api/optimize-meal", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      setResults(data.results);
    } catch (err) {
      console.error("Search failed:", err);
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  const requestLocationThenSearch = () => {
    if (!navigator.geolocation) {
      setLocation({ name: "Geolocation not supported", coords: "Use a modern browser", lat: null, lng: null });
      setLocState("denied");
      return;
    }
    setLocState("acquiring");
    setLocation(prev => ({ ...prev, name: "Requesting location…", coords: "Waiting for permission" }));
    {/*NEED TO CHANGE*/ }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        setLocState("ready");
        setLocation({ name: "Current Location", coords: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, lat, lng });
        runSearch(lat, lng);
      },
      err => {
        console.warn("Geolocation denied:", err.message);
        setLocState("denied");
        setLocation({ name: "Location Denied", coords: "Enable GPS in browser settings", lat: null, lng: null });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };
  // NEED TO CHANGE
  const handleSearch = () => {
    if (!isFormReady) return;
    locState === "ready" && location.lat !== null ? runSearch(location.lat, location.lng) : requestLocationThenSearch();
  };

  return (
    <>
      <SafeAreaView className="app-header">
        <View className="panel-left">
          <View>
            <View className="section-label"><Text>Your Daily Target</Text></View>
            <View className="hero-text">
              <Text>Enter Your</Text>
              <Text>Macros</Text>
            </View>
            <View className="hero-sub" style={{ marginTop: 10 }}>
              <Text>We will find you the best meals that match your wanted macronutrients.</Text>
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
        <ResultTextel loading={loading} results={results} onCardClick={setSelected} />
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
          {[300, 240, 180, 120, 60].map((s, i) => <View key={i} className="radar-ring" style={{ width: s, height: s }} />)}
          <View className="radar-sweep" />
        </View>
        <View className="app-overlay" />
        <View className="logo-mark">
          {/* NEED TO CHANGE */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ color: "var(--accent)" }}>
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
            <circle cx="12" cy="12" r="9" strokeDasharray="4 3" />
          </svg>
        </View>
        <View>
          <View className="logo-text"><Text>MacroHunter</Text></View>
          <View className="logo-sub"><Text>Find your perfect meal</Text></View>
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
