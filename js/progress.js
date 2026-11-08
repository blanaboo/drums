// Per-viewer persistence in localStorage: best tempo per exercise, last used tempo, settings.
// Storage can be unavailable (private mode) or wiped by Safari, so every access is guarded.

const PROGRESS_KEY = 'drums.progress.v1';
const SETTINGS_KEY = 'drums.settings.v1';

export const DEFAULT_SETTINGS = {
  click: true,
  countIn: true,
  build: false,
  barsPerPhase: 4,
  staircase: false,
  staircaseEvery: 4,
  staircaseIncrement: 5,
  colors: true,
  volume: 0.9,
  clickVolume: 0.8,
  visualOffsetMs: 0,
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : { ...fallback };
  } catch {
    return { ...fallback };
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: the app keeps working for this session.
  }
}

export function loadSettings() {
  return read(SETTINGS_KEY, DEFAULT_SETTINGS);
}

export function saveSettings(settings) {
  write(SETTINGS_KEY, settings);
}

/** @returns {Record<string, {best?: number, last?: number, at?: string}>} */
export function loadProgress() {
  return read(PROGRESS_KEY, {});
}

/** Remembers the tempo the player last used for an exercise. */
export function rememberTempo(id, bpm) {
  const all = loadProgress();
  all[id] = { ...all[id], last: bpm };
  write(PROGRESS_KEY, all);
}

/** Records a successful run; keeps the highest tempo. */
export function recordSuccess(id, bpm) {
  const all = loadProgress();
  const entry = all[id] ?? {};
  all[id] = { ...entry, best: Math.max(entry.best ?? 0, bpm), at: new Date().toISOString() };
  write(PROGRESS_KEY, all);
  return all[id];
}

export function isDone(exercise, progress) {
  return (progress[exercise.id]?.best ?? 0) >= exercise.tempo.target;
}
