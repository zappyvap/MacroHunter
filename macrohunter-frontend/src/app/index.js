import { StatusBar } from 'expo-status-bar';
import { View, Text, TextInput, TouchableOpacity, Image, SafeAreaView } from '../constants/component-style';
import { useState, useEffect } from "react";
import React from 'react';
import { Alert, StyleSheet, View as RNView, Animated, Easing } from 'react-native';
import { Link } from 'expo-router';
import * as Location from 'expo-location';
import { useSearch } from '../context/SearchContext';
import {router, useLocalSearchParams} from "expo-router";
import styles from '../constants/styles';
import * as ImagePicker from 'expo-image-picker';
import EventSource from 'react-native-sse';
import colors from '../constants/colors';

// ─── Mock Data for Debug Mode ────────────────────────────────────────────────
const MOCK_RESULTS = [
  {
    status: "Optimal",
    total_cost: 12.49,
    achieved_macros: { cal: 520, p: 42, c: 35, f: 18 },
    gaps: { cal: 0, p: 0, c: 3, f: 2 },
    order: [
      { item: "Grilled Chicken Sandwich", quantity: 1, estimated: false },
      { item: "Side Salad", quantity: 1, estimated: false },
    ],
    restaurant: {
      name: "Mock Grill House",
      address: "123 Debug St",
      rating: 4.5,
      total_ratings: 312,
      photo_url: null,
      latitude: 40.7128,
      longitude: -74.0060,
    },
    estimated: false,
  },
  {
    status: "Best Effort",
    total_cost: 9.99,
    achieved_macros: { cal: 480, p: 35, c: 45, f: 15 },
    gaps: { cal: 0, p: 5, c: 0, f: 5 },
    order: [
      { item: "Turkey Wrap", quantity: 1, estimated: true },
      { item: "Protein Shake", quantity: 1, estimated: true },
    ],
    restaurant: {
      name: "Mock Deli",
      address: "456 Test Ave",
      rating: 4.2,
      total_ratings: 189,
      photo_url: null,
      latitude: 40.7580,
      longitude: -73.9855,
    },
    estimated: true,
  },
  {
    status: "Best Effort",
    total_cost: 15.75,
    achieved_macros: { cal: 610, p: 50, c: 40, f: 22 },
    gaps: { cal: 0, p: 0, c: 8, f: 0 },
    order: [
      { item: "Double Burger (no bun)", quantity: 1, estimated: false },
      { item: "Sweet Potato Fries", quantity: 1, estimated: false },
      { item: "Water", quantity: 1, estimated: false },
    ],
    restaurant: {
      name: "Mock Burger Joint",
      address: "789 Fake Blvd",
      rating: 4.7,
      total_ratings: 524,
      photo_url: null,
      latitude: 40.7484,
      longitude: -73.9857,
    },
    estimated: false,
  },
];


export default function App() {
  return (
    <>
      <StatusBar style="auto" />
      <HunterPage />
    </>
  );
}
// opens the device camera and captures a photo, then stores the URI in state
async function takePicture(setImageUri) {
  const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

  if (permissionResult.granted === false) {
    Alert.alert('Permission Denied', 'You need to allow camera access to use this feature.');
    return;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    aspect: [4, 3],
    quality: 0.8,
    base64: true,
  });

  if (!result.canceled) {
    const asset = result.assets[0];
    setImageUri({ uri: asset.uri, base64: asset.base64 });
  }
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



// ─── BasicLoadingScreen ────────────────────────────────────────────────────────

const STEPS = [
  "🔍 Scanning nearby restaurants...",
  "🧬 Analyzing macronutrient data...",
  "⚡ Calculating optimal meals...",
  "🏆 Ranking your best options...",
];

function BasicLoadingScreen({ headline }) {
  // Spinner rotation
  const spinAnim   = React.useRef(new Animated.Value(0)).current;
  // Radar ring pulses (3 rings, staggered)
  const pulse1     = React.useRef(new Animated.Value(0)).current;
  const pulse2     = React.useRef(new Animated.Value(0)).current;
  const pulse3     = React.useRef(new Animated.Value(0)).current;
  // Dot bounce
  const dot1       = React.useRef(new Animated.Value(0)).current;
  const dot2       = React.useRef(new Animated.Value(0)).current;
  const dot3       = React.useRef(new Animated.Value(0)).current;
  // Text fade
  const textOpacity = React.useRef(new Animated.Value(0)).current;
  const [displayedHeadline, setDisplayedHeadline] = React.useState(headline || STEPS[0]);

  // Fade-in text whenever headline changes
  React.useEffect(() => {
    textOpacity.setValue(0);
    setDisplayedHeadline(headline || STEPS[0]);
    Animated.timing(textOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [headline]);

  React.useEffect(() => {
    // Spinner
    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 1800, easing: Easing.linear, useNativeDriver: true })
    ).start();

    // Radar pulse rings (staggered)
    const makePulse = (anim, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
    makePulse(pulse1, 0).start();
    makePulse(pulse2, 600).start();
    makePulse(pulse3, 1200).start();

    // Dots bounce
    const makeDot = (anim, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: -8, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0,  duration: 300, easing: Easing.in(Easing.quad),  useNativeDriver: true }),
          Animated.delay(900),
        ])
      );
    makeDot(dot1, 0).start();
    makeDot(dot2, 150).start();
    makeDot(dot3, 300).start();
  }, []);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const makePulseStyle = (anim) => ({
    opacity:   anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.6, 0] }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.6] }) }],
  });

  return (
    <RNView style={loadingStyles.container}>
      {/* Radar pulse rings */}
      <RNView style={loadingStyles.radarWrap}>
        {[pulse1, pulse2, pulse3].map((p, i) => (
          <Animated.View key={i} style={[loadingStyles.radarRing, makePulseStyle(p)]} />
        ))}

        {/* Spinning arc border */}
        <Animated.View style={[loadingStyles.spinnerRing, { transform: [{ rotate: spin }] }]}>
          <RNView style={loadingStyles.spinnerArc} />
        </Animated.View>

        {/* Centre icon */}
        <RNView style={loadingStyles.centreDot}>
          <Text style={loadingStyles.centreEmoji}>🎯</Text>
        </RNView>
      </RNView>

      {/* Headline */}
      <Animated.Text style={[loadingStyles.headline, { opacity: textOpacity }]}>
        {displayedHeadline}
      </Animated.Text>

      {/* Bouncing dots */}
      <RNView style={loadingStyles.dotsRow}>
        {[dot1, dot2, dot3].map((d, i) => (
          <Animated.View key={i} style={[loadingStyles.dot, { transform: [{ translateY: d }] }]} />
        ))}
      </RNView>

      <Text style={loadingStyles.subText}>MacroHunter is on the hunt…</Text>
    </RNView>
  );
}

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
    padding: 32,
  },
  radarWrap: {
    width: 180,
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 48,
  },
  radarRing: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  spinnerRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerArc: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: 'transparent',
    borderTopColor: colors.accent,
    borderRightColor: colors.accentGlow,
  },
  centreDot: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centreEmoji: {
    fontSize: 28,
  },
  headline: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 26,
    letterSpacing: 0.3,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  subText: {
    color: colors.muted,
    fontSize: 13,
    letterSpacing: 0.5,
  },
});



// ─── HunterPage ───────────────────────────────────────────────────────────────
function HunterPage() {
  const [calories, setCalories] = useState("");
  const [protein,  setProtein]  = useState("");
  const [carbs,    setCarbs]    = useState("");
  const [fats,     setFats]     = useState("");
  const [locState, setLocState] = useState("idle");
  const [location, setLocation] = useState({ name: "Click search to detect location", coords: null, lat: null, lng: null });
  const [loading,  setLoading]  = useState(false);
  const {results, setResults, setScanPayload} = useSearch();
  const [selected, setSelected] = useState(null);
  const [imageUri, setImageUri] = useState(null); 
  const [streamedText, setStreamedText] = useState("")

  useEffect(() => {
    if(imageUri) {
      setScanPayload({
        imageB64: imageUri.base64,
        calories,
        protein,
        carbs,
        fats
      });
      router.push({
        pathname: '/scan',
        params: { 
          imageUri: imageUri.uri,
        }
      })
    }
  }, [imageUri]);

  const isFormReady = calories && protein && carbs && fats;

  const handleTakePicture = () => takePicture(setImageUri);
  

  // sends the user's macro targets + location to the backend via SSE streaming and navigates to results
  const runSearch = async (lat, lng) => {
    setLoading(true);
    setResults(null);
    setStreamedText("");
    const payload = {
      searching_for_restaurant: true,
      latitude: lat, longitude: lng,
      target_calories: +calories, target_protein: +protein,
      target_carbs: +carbs, target_fats: +fats,
    };
    try {
      const hostIp = process.env.EXPO_PUBLIC_HOST_IP || '10.0.0.241';
      await new Promise((resolve, reject) => {
        const es = new EventSource(`http://${hostIp}:8000/api/optimize-meal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        es.addEventListener("agent_update", (e) => {
          try {
            const parsed = JSON.parse(e.data);
            setStreamedText(parsed.headline || "");
          } catch {}
        });

        es.addEventListener("done", (e) => {
          try {
            const parsed = JSON.parse(e.data);
            setResults(parsed.results);
            es.close();
            resolve();
            router.push('/results');
          } catch (err) {
            es.close();
            reject(err);
          }
        });

        es.addEventListener("error", (e) => {
          es.close();
          // e.data is set on application-level error events from the server
          if (e.data) {
            try {
              const parsed = JSON.parse(e.data);
              reject(new Error(parsed.detail || "Stream error"));
            } catch {
              reject(new Error("Stream error"));
            }
          } else {
            reject(new Error("Connection error"));
          }
        });
      });
    } catch (err) {
      console.error("Search failed:", err);
      Alert.alert("Error", err.message);
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  // asks for GPS permission via expo-location, then kicks off the search once we have coords
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
  const handleSearch = () => {
    if (!isFormReady) return;
    locState === "ready" && location.lat !== null ? runSearch(location.lat, location.lng) : requestLocationThenSearch();
  };

  return (
    <>
      <SafeAreaView className="app-header" flex ="1" flexDirection="column" justifyContent="flex-end" alignItems="center">
        <View className="panel-left">
          <View style={{ alignItems: 'flex-start', marginBottom: 8 }}>
          </View>
          <View style={{ position: 'relative', width: '100%', paddingTop: 44 }}>
            <View style={{ alignItems: 'center' }}>
              <View justifyContent="center" alignItems="center" gap={2}>
                <Text className="hero-text">Hunt Your Macros</Text>
              </View>
              <View style={{ marginTop: 10 }}>
                <Text className="hero-sub">Enter your nutrition goals and we'll find the best meals near you.</Text>
              </View>
            </View>
          </View>
          <CaloriesCard calories={calories} setCalories={setCalories} />
          <MacrosCard protein={protein} setProtein={setProtein} carbs={carbs} setCarbs={setCarbs} fats={fats} setFats={setFats} />
          <LocationCard locState={locState} location={location} />
          <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
            <TouchableOpacity
              className={`search-btn ${loading ? "loading" : ""}`}
              onPress={handleSearch}
              disabled={loading || !isFormReady}
              activeOpacity={0.9}
              style={{ flex: 1.5, width: 'auto', opacity: (loading || !isFormReady) ? 0.4 : 1 }}
            >
              {loading ? (
                <>
                  <Text className="spin">◈</Text>
                  <Text style={{ color: '#64748b' }}>Scanning Area…</Text>
                </>
              ) : locState === "acquiring" ? (
                <>
                  <Text className="spin">◈</Text>
                  <Text style={{ color: '#64748b' }}>Awaiting Permission…</Text>
                </>
              ) : (
                <>
                  <View className="btn-shimmer" />
                  <Text style={{ color: '#ffffff', fontWeight: '600' }}>⌖ Hunt Meals Nearby</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleTakePicture}
              disabled={loading || !isFormReady}
              activeOpacity={0.8}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                paddingVertical: 16,
                paddingHorizontal: 12,
                borderRadius: 12,
                backgroundColor: 'rgba(20, 19, 19, 0.08)',
                borderWidth: 1,
                borderColor: 'rgba(102, 98, 98, 0.3)',
                opacity: (loading || !isFormReady) ? 0.4 : 1,
              }}
            >
              <Text style={{ color: '#0f172a', fontWeight: '600', fontSize: 14 }}>Scan Menu</Text>
              <Text style={{ fontSize: 16 }}>📷</Text>
            </TouchableOpacity>
          </View>
        </View>
        {/* results are shown on the /results page via ResultTextel */}
      </SafeAreaView>

      {/* ─── Debug Panel (dev only) ──────────────────────────────────── */}
      {__DEV__ && (
        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          paddingVertical: 10,
          paddingHorizontal: 16,
          flexDirection: 'row',
          justifyContent: 'space-around',
          alignItems: 'center',
          borderTopWidth: 1,
          borderTopColor: '#333',
        }}>
          <Text style={{ color: '#f97316', fontWeight: '700', fontSize: 11, letterSpacing: 1 }}>🛠 DEBUG</Text>
          <TouchableOpacity
            onPress={() => {
              setResults(MOCK_RESULTS);
              router.push('/results');
            }}
            activeOpacity={0.7}
            style={{
              backgroundColor: '#22c55e',
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>→ Results</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              router.push({
                pathname: '/scan',
                params: { imageUri: 'https://placehold.co/400x600/1e293b/white?text=Mock+Menu' }
              });
            }}
            activeOpacity={0.7}
            style={{
              backgroundColor: '#3b82f6',
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>→ Scan</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setLoading(true);
              // Auto-dismiss after 5 seconds so you don't get stuck!
              setTimeout(() => setLoading(false), 5000);
            }}
            activeOpacity={0.7}
            style={{
              backgroundColor: '#a855f7', // Purple for the loading debug button
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>→ Load</Text>
          </TouchableOpacity>
        </View>
      )}

      {selected && (
        <ResultLightbox result={selected} onClose={() => setSelected(null)} />
      )}
      {loading && (
        <RNView style={[StyleSheet.absoluteFillObject, { zIndex: 1000, backgroundColor: '#0a0a0a' }]}>
          <BasicLoadingScreen headline={streamedText} />
        </RNView>
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
