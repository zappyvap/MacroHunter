import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import styles from "./styles";
import HunterPage from "./pages/HunterPage";

// ─── Shared layout: radar background + header ────────────────────────────────
function AppLayout({ children }) {
  return (
    <>
      <style>{styles}</style>
      <div className="app">
        {/* Radar background decoration */}
        <div className="radar-bg">
          {[300, 240, 180, 120, 60].map((s, i) => (
            <div key={i} className="radar-ring" style={{ width: s, height: s }} />
          ))}
          <div className="radar-sweep" />
        </div>

        <AppHeader />

        {/* Routed page renders here */}
        {children}
      </div>
    </>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────
function AppHeader() {
  return (
    <header>
      <div className="logo-mark">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{ color: "var(--accent)" }}
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          <circle cx="12" cy="12" r="9" strokeDasharray="4 3" />
        </svg>
      </div>
      <div>
        <div className="logo-text">MacroHunter</div>
        <div className="logo-sub">Find your perfect meal</div>
      </div>
      <div className="header-right">
        <div className="status-dot" />
        GPS Standby
      </div>
    </header>
  );
}

// ─── Router ───────────────────────────────────────────────────────────────────
//
//  /      → HunterPage  (main search UI)
//  *      → redirect to /  (catch-all)
//
//  To add more pages, import them above and add a <Route> inside <Routes>.
//  Example:
//    import HistoryPage from "./pages/HistoryPage";
//    <Route path="/history" element={<HistoryPage />} />
//
export default function AppRouter() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/"  element={<HunterPage />} />
          {/* <Route path="/history"  element={<HistoryPage />} /> */}
          {/* <Route path="/settings" element={<SettingsPage />} /> */}
          <Route path="*"  element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}