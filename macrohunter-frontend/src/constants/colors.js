// constants/colors.js
// This replaces the CSS variables in your styles.js file.
// Instead of var(--accent), you import this and use colors.accent.
// Every component in the app imports from here, so changing a color
// here changes it everywhere — same concept as CSS variables.

const colors = {
  bg:          '#090d0b',
  surface:     '#0f1710',
  surface2:    '#152018',
  border:      '#1e3326',
  accent:      '#39ff7e',
  accentDim:   'rgba(57,255,126,0.12)',
  accentGlow:  'rgba(57,255,126,0.35)',
  protein:     '#ff6b35',
  carbs:       '#ffd23f',
  fats:        '#4ecdc4',
  text:        '#e8f5ee',
  muted:       '#5a7a65',
  danger:      '#ff4545',
};

export default colors;