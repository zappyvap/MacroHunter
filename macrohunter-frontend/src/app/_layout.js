import { Slot } from 'expo-router';
import { SearchProvider } from '../context/SearchContext';
import { SafeAreaView, View, Text, TouchableOpacity, Alert } from 'react-native';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Montserrat_700Bold, Montserrat_800ExtraBold } from '@expo-google-fonts/montserrat';
import colors from '../constants/colors';

// root layout: wraps all pages in SearchProvider so search results persist across screen navigation
export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
    'Montserrat-Bold': Montserrat_700Bold,
    'Montserrat-ExtraBold': Montserrat_800ExtraBold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SearchProvider>
      <SafeAreaView style={{ backgroundColor: colors.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 60, paddingHorizontal: 20 }}>
          {/* Centered Bigger Bolder Logo */}
          <Text style={{ fontFamily: 'Montserrat-ExtraBold', fontSize: 28, color: colors.accent, letterSpacing: -1 }}>MacroHunter</Text>
          
          {/* Absolute positioned Info Button on the right */}
          <TouchableOpacity 
            style={{ position: 'absolute', right: 20, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' }}
            onPress={() => Alert.alert("About MacroHunter", "Project: MacroHunter\nCreated by: Peter Hart\nTimeline: May-September 2026")}
          >
            <Text style={{ fontSize: 16, fontFamily: 'Inter-Bold', color: colors.muted }}>?</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Slot />
      </View>
    </SearchProvider>
  )
}
