import { StatusBar } from 'expo-status-bar';
import { View, Text, TextInput, TouchableOpacity, Image, SafeAreaView } from '../constants/component-style';
import { useState, useEffect } from "react";
import { Alert } from 'react-native';
import { Link } from 'expo-router';
import * as Location from 'expo-location';
import { useSearch } from '../context/SearchContext';
import {router, useLocalSearchParams} from "expo-router";
import styles from '../constants/styles';
import * as ImagePicker from 'expo-image-picker';


export default function App() {
  return (
    <>
      <StatusBar style="auto" />
      <HunterPage />
    </>
  );
}
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
  });

  if (!result.canceled) {
    const capturedUri = result.assets[0].uri;
    setImageUri(capturedUri);
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
  const [imageUri, setImageUri] = useState(null); 

  useEffect(() => {
    if(imageUri) {
      scanMenu(imageUri);
      router.push({
        pathname: '/scan',
        params: { imageUri }
      })
    }
  }, [imageUri]);

  const isFormReady = calories && protein && carbs && fats;

  const handleTakePicture = () => takePicture(setImageUri);
  
  const scanMenu = async () => {
    // React Native's FormData understands this { uri, name, type } shape
    // and will stream the actual image bytes from that local file URI.
    const formData = new FormData();
    formData.append("file", {
      uri: imageUri,
      name: "menu.jpg",
      type: "image/jpeg",
    });
    setLoading(true);
    setResults(null);
    try {
      const res  = await fetch("http://10.0.0.233:8001/translate-menu", {
        method: "POST", body: formData,
      });
      const data = await res.json();
      setResults(data);
      router.push('/results')
    } catch (err) {
      console.error("Search failed:", err);
      setResults(null);
    } finally {
      setLoading(false);
    }
  };
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
            <TouchableOpacity
              onPress={handleTakePicture}
              activeOpacity={0.8}
              style={{
                position: 'absolute',
                top: -80,
                right: 0,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 999,
                backgroundColor: 'rgba(20, 19, 19, 0.16)',
                borderWidth: 1,
                borderColor: 'rgba(102, 98, 98, 0.3)',
                zIndex: 2,
              }}
            >
              <Text style={{ color: '#000000', fontWeight: '600', fontSize: 14 }}>Scan menu</Text>
              <Text style={{ fontSize: 16 }}>📷</Text>
            </TouchableOpacity>
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
