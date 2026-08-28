import React, { useRef, useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, Animated, Easing, Dimensions, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import EventSource from 'react-native-sse';
import { useSearch } from '../context/SearchContext';
import colors from '../constants/colors';

const { width: SCREEN_W } = Dimensions.get('window');
const IMAGE_W = SCREEN_W - 48;
const IMAGE_H = IMAGE_W * 1.2;

export default function Scan() {
  const params = useLocalSearchParams();
  const { imageUri } = params;
  const router = useRouter();
  const { setResults, scanPayload } = useSearch();

  const [streamedText, setStreamedText] = useState("");
  const [streamProgress, setStreamProgress] = useState(0);
  const streamStepRef = useRef(0);

  // Animated progress bar
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressGlow = useRef(new Animated.Value(0)).current;

  // Scan line sweeps top → bottom
  const scanY = useRef(new Animated.Value(0)).current;
  // Border glow pulse
  const glowPulse = useRef(new Animated.Value(0)).current;
  // Bouncing dots
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;


  // Animate progress bar smoothly whenever streamProgress changes
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: streamProgress,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [streamProgress]);

  // Glow pulse on progress bar
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(progressGlow, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(progressGlow, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    // Scan line loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanY, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(300),
        Animated.timing(scanY, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glowPulse, { toValue: 0, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Bouncing dots
    const makeDot = (anim, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: -7, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 280, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.delay(840),
        ])
      );
    makeDot(dot1, 0).start();
    makeDot(dot2, 140).start();
    makeDot(dot3, 280).start();

    // Network Stream
    if (scanPayload) {
      const payload = {
        image_b64: scanPayload.imageB64,
        target_calories: +scanPayload.calories,
        target_protein: +scanPayload.protein,
        target_carbs: +scanPayload.carbs,
        target_fats: +scanPayload.fats,
      };

      const hostIp = process.env.EXPO_PUBLIC_HOST_IP || '10.0.0.241';
      const es = new EventSource(`http://${hostIp}:8000/api/optimize-menu-image-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Expected steps: initial yield + image_translation + optimizer + judge = ~4
      const EXPECTED_STEPS = 4;

      es.addEventListener("agent_update", (e) => {
        try {
          const parsed = JSON.parse(e.data);
          setStreamedText(parsed.headline || "");
          streamStepRef.current += 1;
          setStreamProgress(Math.min(streamStepRef.current / EXPECTED_STEPS, 0.95));
        } catch { }
      });

      es.addEventListener("done", (e) => {
        try {
          const parsed = JSON.parse(e.data);
          setStreamProgress(1);
          setResults(parsed.results);
          es.close();
          setTimeout(() => {
            router.push('/results');
          }, 400);
        } catch (err) {
          es.close();
          Alert.alert("Error", "Failed to parse results.");
          router.back();
        }
      });

      es.addEventListener("error", (e) => {
        es.close();
        if (e.data) {
          try { Alert.alert("Error", JSON.parse(e.data).detail || "Stream error"); }
          catch { Alert.alert("Error", "Stream error"); }
        } else {
          Alert.alert("Error", "Connection error");
        }
        setStreamedText("Scan failed.");
        router.back();
      });

      return () => {
        es.close();
      };
    }
  }, [scanPayload]);

  const scanTranslateY = scanY.interpolate({
    inputRange: [0, 1],
    outputRange: [0, IMAGE_H],
  });

  const borderOpacity = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1],
  });

  const displayPct = Math.round(streamProgress * 100);

  const progressBarWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  const progressGlowOpacity = progressGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  if (!imageUri) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No image provided</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* Header */}
      <Text style={styles.title}>Scanning Menu</Text>

      {/* Image frame with scan-line overlay */}
      <View style={styles.frameOuter}>
        <Animated.View style={[styles.frameBorder, { opacity: borderOpacity }]} />

        {/* Corner accent marks */}
        {['tl', 'tr', 'bl', 'br'].map(c => (
          <View key={c} style={[styles.corner, styles[c]]} />
        ))}

        <View style={styles.imageWrapper}>
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            resizeMode="cover"
          />

          {/* Scan line */}
          <Animated.View
            style={[styles.scanLine, { transform: [{ translateY: scanTranslateY }] }]}
          />

          {/* Dark tint overlay */}
          <View style={styles.imageTint} />
        </View>
      </View>

      {/* Step text */}
      <Text style={styles.stepText}>
        {streamedText || "Initializing scanner..."}
      </Text>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <Animated.View style={[
            styles.progressFill,
            { width: progressBarWidth },
          ]}>
            <Animated.View style={[
              styles.progressGlowBar,
              { opacity: progressGlowOpacity },
            ]} />
          </Animated.View>
        </View>
        <Text style={styles.progressLabel}>{displayPct}%</Text>
      </View>

      {/* Bouncing dots */}
      <View style={styles.dotsRow}>
        {[dot1, dot2, dot3].map((d, i) => (
          <Animated.View key={i} style={[styles.dot, { transform: [{ translateY: d }] }]} />
        ))}
      </View>

      <Text style={styles.subText}>MacroHunter Vision is analyzing your menu…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 28,
  },

  // Frame
  frameOuter: {
    width: IMAGE_W,
    height: IMAGE_H,
    position: 'relative',
    marginBottom: 32,
  },
  frameBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.accent,
    zIndex: 3,
  },

  // Corner accents
  corner: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderColor: colors.accent,
    zIndex: 4,
  },
  tl: { top: -2, left: -2, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 6 },
  tr: { top: -2, right: -2, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 6 },
  bl: { bottom: -2, left: -2, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 6 },
  br: { bottom: -2, right: -2, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 6 },

  imageWrapper: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9,13,11,0.25)',
  },

  // Scan line
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    opacity: 0.85,
    zIndex: 2,
  },

  stepText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 0.2,
  },
  // ── Progress bar ──
  progressContainer: {
    width: '85%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surface2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.accent,
    overflow: 'hidden',
  },
  progressGlowBar: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 24,
    backgroundColor: colors.accentGlow,
  },
  progressLabel: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    minWidth: 38,
    textAlign: 'right',
  },
  // ── End progress bar ──
  dotsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  subText: {
    color: colors.muted,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  errorText: {
    color: colors.text,
    fontSize: 16,
  },
});