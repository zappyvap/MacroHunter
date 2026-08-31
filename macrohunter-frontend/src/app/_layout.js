import { Slot } from 'expo-router';
import { SearchProvider } from '../context/SearchContext';

import { SafeAreaView, View, Text, TouchableOpacity, Alert } from 'react-native';

// root layout: wraps all pages in SearchProvider so search results persist across screen navigation
export default function RootLayout() {
  return (
    <SearchProvider>
      <SafeAreaView style={{ backgroundColor: '#f4f5f7' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 60, paddingHorizontal: 20 }}>
          {/* Centered Bigger Bolder Logo */}
          <Text style={{ fontFamily: 'Montserrat-ExtraBold', fontSize: 28, color: '#006d37', letterSpacing: -1 }}>MacroHunter</Text>
          
          {/* Absolute positioned Info Button on the right */}
          <TouchableOpacity 
            style={{ position: 'absolute', right: 20, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center' }}
            onPress={() => Alert.alert("About MacroHunter", "Project: MacroHunter\nCreated by: Peter Hart\nTimeline: May-September 2026")}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#64748b' }}>?</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      
      <View style={{ flex: 1, backgroundColor: '#f4f5f7' }}>
        <Slot />
      </View>
    </SearchProvider>
  )
}
