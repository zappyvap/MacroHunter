import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// ─── All styles ───────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  
  :root {
    --bg: #f8fafc;
    --surface: #ffffff;
    --surface2: #f1f5f9;
    --border: #e2e8f0;
    --accent: #10b981;
    --accent-dim: #d1fae5;
    --accent-hover: #059669;
    --protein: #f97316;
    --carbs: #eab308;
    --fats: #3b82f6;
    --text: #0f172a;
    --muted: #64748b;
    --danger: #ef4444;
    --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }
  
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); font-family: 'Inter', system-ui, -apple-system, sans-serif; min-height: 100vh; overflow-x: hidden; -webkit-font-smoothing: antialiased; }
  .app { min-height: 100vh; display: flex; flex-direction: column; position: relative; }
  
  .radar-bg, .radar-ring, .radar-sweep { display: none; }
  
  header { padding: 24px 48px 0; display: flex; align-items: center; gap: 12px; }
  .logo-mark { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: var(--accent); color: white; box-shadow: var(--shadow-sm); flex-shrink: 0; }
  .logo-mark svg { width: 20px; height: 20px; color: white !important; }
  .logo-text { font-weight: 700; font-size: 20px; letter-spacing: -0.5px; color: var(--text); }
  .logo-sub { font-size: 13px; color: var(--muted); font-weight: 400; margin-top: 2px; }
  .header-right { margin-left: auto; display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); font-weight: 500; }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }
  .status-dot.denied { background: var(--danger); }
  
  main { flex: 1; padding: 40px 48px 48px; display: grid; grid-template-columns: 400px 1fr; gap: 40px; max-width: 1200px; width: 100%; margin: 0 auto; }
  .panel-left { display: flex; flex-direction: column; gap: 24px; }
  .section-label { font-weight: 600; font-size: 12px; letter-spacing: 0.5px; text-transform: uppercase; color: var(--muted); margin-bottom: 8px; }
  .hero-text { font-weight: 800; font-size: 36px; line-height: 1.1; letter-spacing: -1px; color: var(--text); }
  .hero-text span { color: var(--accent); }
  .hero-sub { font-size: 15px; color: var(--muted); line-height: 1.5; font-weight: 400; }
  
  .calories-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 24px; box-shadow: var(--shadow-sm); }
  .cal-display { display: flex; align-items: baseline; gap: 8px; margin-top: 4px; }
  .cal-input { background: transparent; border: none; outline: none; font-family: 'Inter', sans-serif; font-weight: 700; font-size: 48px; color: var(--text); width: 180px; letter-spacing: -1px; }
  .cal-input::placeholder { color: var(--border); }
  .cal-unit { font-weight: 500; font-size: 16px; color: var(--muted); }
  .cal-bar { margin-top: 16px; height: 6px; background: var(--surface2); border-radius: 3px; overflow: hidden; }
  .cal-bar-fill { height: 100%; background: var(--accent); border-radius: 3px; transition: width 0.4s ease; }
  
  .macros-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 24px; box-shadow: var(--shadow-sm); }
  .macros-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-top: 4px; }
  .macro-field { display: flex; flex-direction: column; gap: 8px; }
  .macro-label { display: flex; align-items: center; gap: 6px; font-weight: 500; font-size: 13px; color: var(--text); }
  .macro-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .macro-input-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; display: flex; align-items: baseline; gap: 4px; transition: all 0.2s; box-shadow: inset 0 1px 2px rgba(0,0,0,0.02); }
  .macro-input-wrap:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-dim); }
  .macro-num { background: transparent; border: none; outline: none; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 18px; color: var(--text); width: 100%; }
  .macro-num::placeholder { color: var(--border); }
  .macro-g { font-weight: 500; font-size: 14px; color: var(--muted); }
  .macro-bars { margin-top: 20px; display: flex; flex-direction: column; gap: 10px; }
  .mbar-row { display: flex; align-items: center; gap: 12px; font-size: 12px; font-weight: 500; color: var(--muted); }
  .mbar-label { width: 35px; }
  .mbar-track { flex: 1; height: 6px; background: var(--surface2); border-radius: 3px; overflow: hidden; }
  .mbar-fill { height: 100%; border-radius: 3px; transition: width 0.4s ease; }
  .mbar-val { width: 35px; text-align: right; }
  
  .location-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px 20px; display: flex; align-items: center; gap: 14px; box-shadow: var(--shadow-sm); transition: all 0.3s; }
  .location-card.acquiring { border-color: var(--accent); background: var(--accent-dim); }
  .location-card.denied { border-color: var(--danger); background: #fef2f2; }
  .loc-icon { width: 36px; height: 36px; background: var(--surface2); border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--muted); }
  .location-card.acquiring .loc-icon { background: var(--accent); color: white; }
  .loc-icon.denied { background: var(--danger); color: white; }
  .loc-text { flex: 1; }
  .loc-name { font-weight: 600; font-size: 14px; color: var(--text); }
  .loc-coords { font-size: 13px; color: var(--muted); margin-top: 2px; }
  
  .search-btn { width: 100%; padding: 16px; background: var(--accent); color: white; border: none; border-radius: 12px; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 16px; cursor: pointer; transition: all 0.2s; box-shadow: var(--shadow-sm); display: flex; align-items: center; justify-content: center; gap: 8px; }
  .search-btn:hover:not(:disabled) { background: var(--accent-hover); box-shadow: var(--shadow-md); transform: translateY(-1px); }
  .search-btn:active:not(:disabled) { transform: translateY(0); }
  .search-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
  .search-btn.loading { background: var(--surface); color: var(--text); border: 1px solid var(--border); box-shadow: none; }
  .btn-shimmer { display: none; }
  .spin { display: inline-block; animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  
  .panel-right { display: flex; flex-direction: column; gap: 20px; }
  .results-header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 4px; }
  .results-title { font-weight: 700; font-size: 24px; letter-spacing: -0.5px; color: var(--text); }
  .results-count { font-size: 14px; color: var(--muted); font-weight: 500; margin-bottom: 4px; }
  .filter-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .filter-pill { padding: 8px 16px; border-radius: 99px; border: 1px solid var(--border); background: var(--surface); font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 500; color: var(--muted); cursor: pointer; transition: all 0.2s; }
  .filter-pill:hover, .filter-pill.active { border-color: var(--accent); color: var(--accent); background: var(--accent-dim); }
  
  .results-list { display: flex; flex-direction: column; gap: 12px; }
  .result-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 20px 24px; display: grid; grid-template-columns: 1fr auto; gap: 20px; cursor: pointer; transition: all 0.2s; position: relative; box-shadow: var(--shadow-sm); animation: slideIn 0.3s ease both; }
  @keyframes slideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .result-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); border-color: #cbd5e1; }
  .result-card.top-pick { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent), var(--shadow-sm); }
  .top-badge { position: absolute; top: -10px; left: 24px; background: var(--accent); color: white; font-weight: 600; font-size: 11px; padding: 4px 10px; border-radius: 99px; box-shadow: var(--shadow-sm); }
  .result-name { font-weight: 600; font-size: 16px; color: var(--text); margin-bottom: 6px; }
  .result-meta { font-size: 13px; color: var(--muted); display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
  .result-meta-sep { color: var(--border); }
  .result-macros { display: flex; gap: 16px; }
  .rmacro { display: flex; flex-direction: column; gap: 2px; }
  .rmacro-label { font-size: 11px; font-weight: 500; color: var(--muted); }
  .rmacro-val { font-weight: 600; font-size: 15px; }
  .rmacro-val.p { color: var(--protein); } .rmacro-val.c { color: var(--carbs); } .rmacro-val.f { color: var(--fats); }
  .result-right { display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between; }
  .result-cal { font-weight: 700; font-size: 28px; line-height: 1; color: var(--text); }
  .result-cal-unit { font-size: 12px; color: var(--muted); font-weight: 500; margin-top: 4px; }
  .result-score { font-weight: 600; font-size: 12px; padding: 4px 10px; border-radius: 99px; }
  .score-high { color: #065f46; background: #d1fae5; }
  .score-mid { color: #854d0e; background: #fef08a; }
  .score-low { color: var(--muted); background: var(--surface2); }
  
  .empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 60px 0; }
  .empty-icon { width: 64px; height: 64px; background: var(--surface2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; color: var(--muted); margin-bottom: 8px; }
  .empty-text { font-weight: 600; font-size: 18px; color: var(--text); }
  .empty-sub { font-size: 14px; color: var(--muted); text-align: center; max-width: 280px; line-height: 1.5; }
  
  .skeleton-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 20px 24px; animation: skeletonPulse 1.5s ease-in-out infinite; }
  @keyframes skeletonPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
  .skel-line { background: var(--surface2); border-radius: 4px; margin-bottom: 10px; }
  
  @media (max-width: 900px) { main { grid-template-columns: 1fr; padding: 24px; } header { padding: 20px 24px 0; } .hero-text { font-size: 32px; } }
`;

// ─── Tiny components ──────────────────────────────────────────────────────────

function ScoreTag({ score }) {
  const cls = score >= 90 ? "score-high" : score >= 75 ? "score-mid" : "score-low";
  return <span className={`result-score ${cls}`}>{score}% Match</span>;
}

function MacroBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="mbar-row">
      <span className="mbar-label" style={{ color }}>{label}</span>
      <div className="mbar-track">
        <div className="mbar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="mbar-val">{value}g</span>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skel-line" style={{ height: 18, width: "55%" }} />
      <div className="skel-line" style={{ height: 12, width: "35%" }} />
      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        {[60, 60, 60].map((w, i) => (
          <div key={i} className="skel-line" style={{ height: 36, width: w }} />
        ))}
      </div>
    </div>
  );
}

// ─── CaloriesCard ─────────────────────────────────────────────────────────────
function CaloriesCard({ calories, setCalories }) {
  const pct = calories ? Math.min((+calories / 3000) * 100, 100) : 0;
  return (
    <div className="calories-card">
      <div className="section-label">Daily Calories</div>
      <div className="cal-display">
        <input className="cal-input" type="number" placeholder="2000"
          value={calories} onChange={e => setCalories(e.target.value)} min={0} max={9999} />
        <span className="cal-unit">kcal</span>
      </div>
      <div className="cal-bar">
        <div className="cal-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
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
    <div className="macros-card">
      <div className="section-label">Macro Targets</div>
      <div className="macros-grid">
        {MACRO_FIELDS.map(({ label, color, cls, key }) => (
          <div key={cls} className="macro-field">
            <div className="macro-label">
              <div className="macro-dot" style={{ background: color }} />
              <span style={{ color }}>{label}</span>
            </div>
            <div className={`macro-input-wrap ${cls}`}>
              <input className="macro-num" type="number" placeholder="0"
                value={vals[key]} onChange={e => setters[key](e.target.value)} min={0} />
              <span className="macro-g">g</span>
            </div>
          </div>
        ))}
      </div>
      {total > 0 && (
        <div className="macro-bars">
          <MacroBar label="PRO" value={+protein || 0} max={total} color="var(--protein)" />
          <MacroBar label="CHO" value={+carbs   || 0} max={total} color="var(--carbs)"   />
          <MacroBar label="FAT" value={+fats    || 0} max={total} color="var(--fats)"    />
        </div>
      )}
    </div>
  );
}

// ─── LocationCard ─────────────────────────────────────────────────────────────
function LocationCard({ locState, location }) {
  return (
    <div className={`location-card ${locState === "acquiring" ? "acquiring" : ""} ${locState === "denied" ? "denied" : ""}`}>
      <div className={`loc-icon ${locState === "denied" ? "denied" : ""}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      </div>
      <div className="loc-text">
        <div className="loc-name">{location.name}</div>
        <div className="loc-coords">
          {location.coords ?? (locState === "acquiring" ? "Waiting for browser prompt…" : "Will prompt when you search")}
        </div>
      </div>
    </div>
  );
}

// ─── ResultCard ───────────────────────────────────────────────────────────────
function ResultCard({ result, index }) {
  const { achieved_macros, gaps, status, total_cost, order, restaurant } = result;
  const { cal, p, c, f } = achieved_macros;
  const restaurantName = restaurant?.name ?? "Unknown";

  const totalGap = (gaps.p || 0) + (gaps.c || 0) + (gaps.f || 0);
  const score = Math.max(0, Math.round(100 - totalGap));
  const topPick = status === "Optimal";

  const dishSummary = order
    .filter(o => o.quantity > 0)
    .map(o => `${o.quantity}x ${o.item}`)
    .join(", ");

  return (
    <div className={`result-card ${topPick ? "top-pick" : ""}`} style={{ animationDelay: `${index * 0.07}s` }}>
      {topPick && <div className="top-badge">⚡ Top Pick</div>}
      <div>
        <div className="result-name">{dishSummary || "Custom Order"}</div>
        <div className="result-meta">
          <span>{restaurantName}</span>
          <span className="result-meta-sep">·</span>
          <span>{status}</span>
          <span className="result-meta-sep">·</span>
          <span>💰 ${total_cost}</span>
        </div>
        <div className="result-macros">
          <div className="rmacro"><span className="rmacro-label">Protein</span><span className="rmacro-val p">{p}g</span></div>
          <div className="rmacro"><span className="rmacro-label">Carbs</span><span className="rmacro-val c">{c}g</span></div>
          <div className="rmacro"><span className="rmacro-label">Fats</span><span className="rmacro-val f">{f}g</span></div>
        </div>
      </div>
      <div className="result-right">
        <div><div className="result-cal">{cal}</div><div className="result-cal-unit">kcal</div></div>
        <ScoreTag score={score} />
      </div>
    </div>
  );
}

// ─── ResultsPanel ─────────────────────────────────────────────────────────────
function ResultsPanel({ loading, results }) {
  return (
    <div className="panel-right">
      <div className="results-header">
        <div className="results-title">
          {results ? "Nearby Matches" : loading ? "Optimizing..." : "Results"}
        </div>
        {results && <div className="results-count">{results.length} locations found</div>}
      </div>
      {loading && (
        <div className="results-list">{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</div>
      )}
      {!loading && results && (
        <div className="results-list" style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: 4 }}>
          {results.map((r, i) => <ResultCard key={i} result={r} index={i} />)}
        </div>
      )}
      {!loading && !results && (
        <div className="empty-state">
          <div className="empty-icon">⌖</div>
          <div className="empty-text">No Hunt Started</div>
          <div className="empty-sub">Set your macro targets and calories on the left, then hit the search button to find meals near you.</div>
        </div>
      )}
    </div>
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
  const [results,  setResults]  = useState(null);

  const isFormReady = calories && protein && carbs && fats;

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
      const res  = await fetch("http://127.0.0.1:8000/api/optimize-meal", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      setResults(data.results); 
    } catch (err) {
      console.error("Search failed:", err);
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  const requestLocationThenSearch = () => {
    if (!navigator.geolocation) {
      setLocation({ name: "Geolocation not supported", coords: "Use a modern browser", lat: null, lng: null });
      setLocState("denied");
      return;
    }
    setLocState("acquiring");
    setLocation(prev => ({ ...prev, name: "Requesting location…", coords: "Waiting for permission" }));
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        setLocState("ready");
        setLocation({ name: "Current Location", coords: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, lat, lng });
        runSearch(lat, lng);
      },
      err => {
        console.warn("Geolocation denied:", err.message);
        setLocState("denied");
        setLocation({ name: "Location Denied", coords: "Enable GPS in browser settings", lat: null, lng: null });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSearch = () => {
    if (!isFormReady) return;
    locState === "ready" && location.lat !== null ? runSearch(location.lat, location.lng) : requestLocationThenSearch();
  };

  return (
    <main>
      <div className="panel-left">
        <div>
          <div className="section-label">Your Daily Target</div>
          <div className="hero-text">Hunt Your<br /><span>Macros</span></div>
          <div className="hero-sub" style={{ marginTop: 10 }}>
            Enter your nutrition goals and we'll find the best meals near you.
          </div>
        </div>
        <CaloriesCard calories={calories} setCalories={setCalories} />
        <MacrosCard protein={protein} setProtein={setProtein} carbs={carbs} setCarbs={setCarbs} fats={fats} setFats={setFats} />
        <LocationCard locState={locState} location={location} />
        <button className={`search-btn ${loading ? "loading" : ""}`} onClick={handleSearch} disabled={loading || !isFormReady}>
          {loading ? <><span className="spin">◈</span> &nbsp;Scanning Area…</>
            : locState === "acquiring" ? <><span className="spin">◈</span> &nbsp;Awaiting Permission…</>
            : <><div className="btn-shimmer" />⌖ &nbsp;Hunt Meals Nearby</>}
        </button>
      </div>
      <ResultsPanel loading={loading} results={results} />
    </main>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────
function AppLayout({ locState, children }) {
  return (
    <>
      <style>{styles}</style>
      <div className="app">
        <div className="radar-bg">
          {[300,240,180,120,60].map((s,i) => <div key={i} className="radar-ring" style={{ width: s, height: s }} />)}
          <div className="radar-sweep" />
        </div>
        <header>
          <div className="logo-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ color: "var(--accent)" }}>
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
            <div className={`status-dot ${locState === "denied" ? "denied" : ""}`} />
            {locState === "acquiring" ? "Acquiring GPS…" : locState === "ready" ? "GPS Active" : locState === "denied" ? "GPS Denied" : "GPS Standby"}
          </div>
        </header>
        {children}
      </div>
    </>
  );
}

// ─── Router ───────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/"  element={<HunterPage />} />
          <Route path="*"  element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}