import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function Scan() {
  const { imageUri} = useLocalSearchParams();
  return (
    <View style={styles.container}>
      <Image source={{ uri: imageUri }} style={styles.preview} />
    </View>
  );
}

