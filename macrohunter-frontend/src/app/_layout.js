import { Slot } from 'expo-router';
import { SearchProvider } from '../context/SearchContext';

// root layout: wraps all pages in SearchProvider so search results persist across screen navigation
export default function RootLayout() {
  return (
    <SearchProvider>
      <Slot />
    </SearchProvider>
  )
}
