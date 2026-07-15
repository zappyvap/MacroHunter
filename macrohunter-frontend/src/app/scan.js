import React from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function Scan() {
  const { imageUri } = useLocalSearchParams();

  if (!imageUri) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>No image provided</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.analyzingRow}>
          <Text style={styles.analyzingText}>Analyzing Menu</Text>
          <ActivityIndicator size="small" color="#333" style={styles.spinner} />
        </View>
        <View style={styles.imageWrapper}>
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            resizeMode="contain"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#fafafa',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  content: {
    width: '100%',
    height: '60%',
    alignItems: 'center',
  },
  analyzingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  imageWrapper: {
    width: '95%',
    flex: 1,
    borderRadius: 20,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  analyzingText: {
    fontSize: 30,
    fontWeight: '600',
    color: '#333',
    letterSpacing: 0.5,
  },
  spinner: {
    marginLeft: 10,
  },
  message: {
    color: '#000',
    fontSize: 16,
  },
});