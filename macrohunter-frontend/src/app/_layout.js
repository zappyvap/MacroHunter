import { Slot } from 'expo-router';
import { SearchProvider } from '../context/SearchContext';

export default function RootLayout() {
  return (
    <SearchProvider>
      <Slot />
    </SearchProvider>
  )
}
