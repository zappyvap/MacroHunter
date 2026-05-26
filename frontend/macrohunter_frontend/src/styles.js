const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=Barlow:wght@300;400;500&display=swap');

  :root {
    --bg: #090d0b;
    --surface: #0f1710;
    --surface2: #152018;
    --border: #1e3326;
    --accent: #39ff7e;
    --accent-dim: rgba(57,255,126,0.12);
    --accent-glow: rgba(57,255,126,0.35);
    --protein: #ff6b35;
    --carbs: #ffd23f;
    --fats: #4ecdc4;
    --text: #e8f5ee;
    --muted: #5a7a65;
    --danger: #ff4545;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'Barlow', sans-serif;
    min-height: 100vh;
    overflow-x: hidden;
  }

  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .radar-bg {
    position: fixed;
    top: -20%;
    right: -15%;
    width: 700px;
    height: 700px;
    pointer-events: none;
    z-index: 0;
    opacity: 0.06;
  }

  .radar-ring {
    position: absolute;
    border-radius: 50%;
    border: 1px solid var(--accent);
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
  }

  .radar-sweep {
    position: absolute;
    width: 50%;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--accent));
    top: 50%; left: 50%;
    transform-origin: left center;
    animation: sweep 4s linear infinite;
  }

  @keyframes sweep {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  header {
    position: relative;
    z-index: 10;
    padding: 28px 48px 0;
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .logo-mark {
    width: 42px;
    height: 42px;
    border: 2px solid var(--accent);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--accent-dim);
    box-shadow: 0 0 16px var(--accent-glow);
    flex-shrink: 0;
  }

  .logo-mark svg { width: 22px; height: 22px; }

  .logo-text {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    font-size: 28px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: var(--accent);
    text-shadow: 0 0 20px var(--accent-glow);
  }

  .logo-sub {
    font-size: 10px;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: var(--muted);
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 600;
  }

  .header-right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--muted);
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 600;
  }

  .status-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 8px var(--accent);
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.8); }
  }

  .status-dot.denied { background: var(--danger); box-shadow: 0 0 8px var(--danger); }

  main {
    position: relative;
    z-index: 10;
    flex: 1;
    padding: 48px 48px 32px;
    display: grid;
    grid-template-columns: 440px 1fr;
    gap: 32px;
    max-width: 1400px;
    width: 100%;
    margin: 0 auto;
  }

  .panel-left {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .section-label {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 11px;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 4px;
  }

  .hero-text {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    font-size: 52px;
    line-height: 1;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .hero-text span {
    color: var(--accent);
    text-shadow: 0 0 30px var(--accent-glow);
  }

  .hero-sub {
    font-size: 14px;
    color: var(--muted);
    line-height: 1.6;
    font-weight: 300;
  }

  .calories-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 24px;
    position: relative;
    overflow: hidden;
  }

  .calories-card::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, var(--accent-dim) 0%, transparent 60%);
    pointer-events: none;
  }

  .cal-display {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-top: 12px;
  }

  .cal-input {
    background: transparent;
    border: none;
    outline: none;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    font-size: 64px;
    color: var(--accent);
    text-shadow: 0 0 20px var(--accent-glow);
    width: 220px;
    line-height: 1;
    caret-color: var(--accent);
  }

  .cal-unit {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 20px;
    color: var(--muted);
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  .cal-bar {
    margin-top: 16px;
    height: 3px;
    background: var(--border);
    border-radius: 2px;
    overflow: hidden;
  }

  .cal-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), #00ff88);
    border-radius: 2px;
    transition: width 0.4s cubic-bezier(.4,0,.2,1);
    box-shadow: 0 0 8px var(--accent-glow);
  }

  .macros-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 24px;
  }

  .macros-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 12px;
    margin-top: 16px;
  }

  .macro-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .macro-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 11px;
    letter-spacing: 3px;
    text-transform: uppercase;
  }

  .macro-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .macro-input-wrap {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px 14px;
    display: flex;
    align-items: baseline;
    gap: 4px;
    transition: border-color 0.2s, box-shadow 0.2s;
    position: relative;
  }

  .macro-input-wrap:focus-within {
    border-color: currentColor;
    box-shadow: 0 0 0 3px currentColor;
  }

  .macro-input-wrap.protein { color: var(--protein); }
  .macro-input-wrap.carbs { color: var(--carbs); }
  .macro-input-wrap.fats { color: var(--fats); }

  .macro-num {
    background: transparent;
    border: none;
    outline: none;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 28px;
    color: inherit;
    width: 100%;
    caret-color: currentColor;
  }

  .macro-g {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 600;
    font-size: 12px;
    color: var(--muted);
    letter-spacing: 1px;
  }

  .macro-bars {
    margin-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .mbar-row {
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 11px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--muted);
  }

  .mbar-label { width: 60px; }
  .mbar-track {
    flex: 1;
    height: 4px;
    background: var(--border);
    border-radius: 2px;
    overflow: hidden;
  }

  .mbar-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.4s cubic-bezier(.4,0,.2,1);
  }

  .mbar-val { width: 40px; text-align: right; font-size: 10px; }

  .location-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 20px 24px;
    display: flex;
    align-items: center;
    gap: 14px;
    transition: border-color 0.3s;
  }

  .location-card.acquiring {
    border-color: rgba(57,255,126,0.4);
    animation: locPulse 1.2s ease-in-out infinite;
  }

  .location-card.denied {
    border-color: rgba(255,69,69,0.4);
  }

  @keyframes locPulse {
    0%, 100% { box-shadow: 0 0 0 0 var(--accent-glow); }
    50% { box-shadow: 0 0 12px 4px var(--accent-glow); }
  }

  .loc-icon {
    width: 36px; height: 36px;
    background: var(--accent-dim);
    border: 1px solid var(--accent);
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    color: var(--accent);
    transition: background 0.3s, border-color 0.3s;
  }

  .loc-icon.denied {
    background: rgba(255,69,69,0.12);
    border-color: var(--danger);
    color: var(--danger);
  }

  .loc-text { flex: 1; }
  .loc-name {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 15px;
    letter-spacing: 1px;
  }
  .loc-coords {
    font-size: 11px;
    color: var(--muted);
    font-family: 'Barlow Condensed', sans-serif;
    letter-spacing: 1px;
  }

  .search-btn {
    width: 100%;
    padding: 18px;
    background: var(--accent);
    color: var(--bg);
    border: none;
    border-radius: 14px;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    font-size: 18px;
    letter-spacing: 5px;
    text-transform: uppercase;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition: all 0.25s;
    box-shadow: 0 0 30px var(--accent-glow);
  }

  .search-btn:hover:not(:disabled) {
    background: #55ffaa;
    box-shadow: 0 0 50px var(--accent-glow);
    transform: translateY(-1px);
  }

  .search-btn:active:not(:disabled) { transform: translateY(0); }

  .search-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    box-shadow: none;
  }

  .search-btn.loading {
    background: var(--surface2);
    color: var(--accent);
    border: 1px solid var(--accent);
    box-shadow: 0 0 20px var(--accent-glow);
  }

  .btn-shimmer {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%);
    transform: translateX(-100%);
    animation: shimmer 2s infinite;
  }

  @keyframes shimmer {
    to { transform: translateX(200%); }
  }

  .spin {
    display: inline-block;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .panel-right {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .results-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .results-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    font-size: 28px;
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  .results-count {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 13px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: var(--muted);
  }

  .filter-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .filter-pill {
    padding: 6px 14px;
    border-radius: 20px;
    border: 1px solid var(--border);
    background: var(--surface);
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 12px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--muted);
    cursor: pointer;
    transition: all 0.2s;
  }

  .filter-pill:hover,
  .filter-pill.active {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-dim);
  }

  .results-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .result-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 20px 24px;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 16px;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
    overflow: hidden;
    animation: slideIn 0.35s ease both;
  }

  @keyframes slideIn {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .result-card::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 3px;
    background: var(--accent);
    opacity: 0;
    transition: opacity 0.2s;
  }

  .result-card:hover {
    border-color: rgba(57,255,126,0.3);
    background: var(--surface2);
    transform: translateX(2px);
  }

  .result-card:hover::before { opacity: 1; }

  .result-card.top-pick {
    border-color: rgba(57,255,126,0.4);
    background: linear-gradient(135deg, rgba(57,255,126,0.05) 0%, var(--surface) 50%);
  }

  .result-card.top-pick::before { opacity: 1; }

  .top-badge {
    position: absolute;
    top: 16px; right: 16px;
    background: var(--accent);
    color: var(--bg);
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    font-size: 9px;
    letter-spacing: 3px;
    text-transform: uppercase;
    padding: 3px 8px;
    border-radius: 4px;
  }

  .result-name {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 18px;
    letter-spacing: 1px;
    margin-bottom: 4px;
  }

  .result-meta {
    font-size: 12px;
    color: var(--muted);
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
  }

  .result-meta-sep { color: var(--border); }

  .result-macros {
    display: flex;
    gap: 12px;
  }

  .rmacro {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .rmacro-label {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 9px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--muted);
  }

  .rmacro-val {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 16px;
    line-height: 1;
  }

  .rmacro-val.p { color: var(--protein); }
  .rmacro-val.c { color: var(--carbs); }
  .rmacro-val.f { color: var(--fats); }

  .result-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    justify-content: space-between;
  }

  .result-cal {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    font-size: 32px;
    line-height: 1;
    color: var(--text);
  }

  .result-cal-unit {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 11px;
    color: var(--muted);
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  .result-score {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 2px;
    text-transform: uppercase;
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid;
  }

  .score-high { color: var(--accent); border-color: var(--accent); background: var(--accent-dim); }
  .score-mid { color: var(--carbs); border-color: var(--carbs); background: rgba(255,210,63,0.1); }
  .score-low { color: var(--muted); border-color: var(--border); }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 60px 0;
    opacity: 0.5;
  }

  .empty-icon {
    width: 80px; height: 80px;
    border: 2px dashed var(--border);
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 32px;
  }

  .empty-text {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 18px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: var(--muted);
  }

  .empty-sub {
    font-size: 12px;
    color: var(--muted);
    opacity: 0.6;
    text-align: center;
    max-width: 260px;
    line-height: 1.6;
  }

  .skeleton-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 20px 24px;
    animation: skeletonFade 1.5s ease-in-out infinite;
  }

  @keyframes skeletonFade {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .skel-line {
    background: var(--border);
    border-radius: 4px;
    margin-bottom: 10px;
  }

  @media (max-width: 900px) {
    main { grid-template-columns: 1fr; padding: 24px; }
    header { padding: 20px 24px 0; }
    .hero-text { font-size: 38px; }
  }
`;

export default styles;