import { createContext, useContext, useState } from 'react';

// holds the search/scan results in global state so index.js can set them
// and results.js can read them without prop drilling across screens
const SearchContext = createContext(null);

export function SearchProvider({ children }) {
  const [results, setResults] = useState(null);

  return (
    <SearchContext.Provider value={{ results, setResults }}>
      {children}
    </SearchContext.Provider>
  );
}


export function useSearch() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
}