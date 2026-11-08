// Exercise model: exercises are written per limb (one lane string per limb, one character per grid step).
// This module turns them into per-step hits, validates them, and derives notation durations and build phases.

/** @typedef {'RH'|'LH'|'RF'|'LF'} Limb */

/** @type {Limb[]} */
export const LIMBS = ['RH', 'LH', 'RF', 'LF'];

export const LIMB_INFO = {
  RH: { name: 'Rechte Hand', short: 'RH' },
  LH: { name: 'Linke Hand', short: 'LH' },
  RF: { name: 'Rechter Fuß', short: 'RF' },
  LF: { name: 'Linker Fuß', short: 'LF' },
};

/**
 * Instrument per lane character. `key` is the VexFlow key on the percussion staff, `sound` the synth voice.
 * Uppercase letters are accents of the lowercase instrument.
 */
export const INSTRUMENTS = {
  h: { sound: 'hh', name: 'HiHat', abbr: 'HH', key: 'g/5/x2', hand: true },
  o: { sound: 'hhOpen', name: 'HiHat offen', abbr: 'HH○', key: 'g/5/x2', hand: true, open: true },
  r: { sound: 'ride', name: 'Ride', abbr: 'Ri', key: 'f/5/x2', hand: true },
  c: { sound: 'crash', name: 'Crash', abbr: 'Cr', key: 'a/5/x2', hand: true },
  s: { sound: 'snare', name: 'Snare', abbr: 'SD', key: 'c/5', hand: true },
  g: { sound: 'snare', name: 'Snare leise', abbr: '(SD)', key: 'c/5', hand: true, ghost: true },
  1: { sound: 'tom1', name: 'Tom 1', abbr: 'T1', key: 'e/5', hand: true },
  2: { sound: 'tom2', name: 'Tom 2', abbr: 'T2', key: 'd/5', hand: true },
  3: { sound: 'floor', name: 'Standtom', abbr: 'ST', key: 'a/4', hand: true },
  k: { sound: 'kick', name: 'Bassdrum', abbr: 'BD', key: 'f/4', hand: false },
  f: { sound: 'hhPedal', name: 'HiHat-Pedal', abbr: 'Ped', key: 'd/4/x2', hand: false },
};

const ACCENTABLE = new Set(['h', 'o', 'r', 'c', 's', 'k', 'f']);

export const VELOCITY = { accent: 1.0, normal: 0.6, ghost: 0.22 };

/** Removes bar separators and whitespace from a lane string. */
export function cleanLane(lane) {
  return (lane ?? '').replace(/[|\s]/g, '');
}

/**
 * Parses a single lane character.
 * @returns {null | {char: string, inst: object, accent: boolean, velocity: number}}
 */
export function parseChar(ch) {
  if (ch === '.') return null;
  const lower = ch.toLowerCase();
  const inst = INSTRUMENTS[lower];
  if (!inst) throw new Error(`Unbekanntes Zeichen „${ch}"`);
  const accent = ch !== lower;
  if (accent && !ACCENTABLE.has(lower)) throw new Error(`„${ch}" kann nicht akzentuiert werden`);
  const velocity = inst.ghost ? VELOCITY.ghost : accent ? VELOCITY.accent : VELOCITY.normal;
  return { char: lower, inst, accent, velocity };
}

/** Limbs that have at least one hit, in canonical order. */
export function usedLimbs(exercise) {
  return LIMBS.filter((l) => /[^.]/.test(cleanLane(exercise.lanes[l])));
}

/**
 * Checks an exercise definition. Returns a list of German error messages (empty when valid).
 */
export function validateExercise(ex) {
  const errors = [];
  const where = `Übung ${ex.id}`;
  if (![8, 16].includes(ex.steps)) errors.push(`${where}: steps muss 8 oder 16 sein`);
  if (!Number.isInteger(ex.bars) || ex.bars < 1) errors.push(`${where}: bars muss ≥ 1 sein`);
  const total = ex.steps * ex.bars;
  for (const limb of Object.keys(ex.lanes)) {
    if (!LIMBS.includes(limb)) errors.push(`${where}: unbekannte Gliedmaße ${limb}`);
  }
  for (const limb of LIMBS) {
    const lane = ex.lanes[limb];
    if (lane === undefined) continue;
    const clean = cleanLane(lane);
    if (clean.length !== total) {
      errors.push(`${where}/${limb}: ${clean.length} Zeichen statt ${total}`);
    }
    for (const ch of clean) {
      let hit;
      try {
        hit = parseChar(ch);
      } catch (e) {
        errors.push(`${where}/${limb}: ${e.message}`);
        continue;
      }
      if (!hit) continue;
      const footLimb = limb === 'RF' || limb === 'LF';
      if (footLimb === hit.inst.hand) {
        errors.push(`${where}/${limb}: ${hit.inst.name} passt nicht zu ${LIMB_INFO[limb].name}`);
      }
    }
  }
  const used = usedLimbs(ex);
  if (used.length === 0) errors.push(`${where}: keine Schläge`);
  for (const limb of ex.build ?? []) {
    if (!used.includes(limb)) errors.push(`${where}: build enthält ${limb}, aber diese Spur ist leer`);
  }
  if (!ex.tempo || ex.tempo.start > ex.tempo.target) errors.push(`${where}: tempo.start muss ≤ tempo.target sein`);
  return errors;
}

/**
 * @typedef {{limb: Limb, char: string, inst: object, accent: boolean, velocity: number}} Hit
 * @typedef {{exercise: object, stepsPerBar: number, stepsPerBeat: number, bars: number, totalSteps: number,
 *   lanes: Record<Limb, (Hit|null)[]>, hits: Hit[][], used: Limb[]}} Pattern
 */

/** @returns {Pattern} */
export function parseExercise(ex) {
  const errors = validateExercise(ex);
  if (errors.length) throw new Error(errors.join('\n'));
  const totalSteps = ex.steps * ex.bars;
  const lanes = {};
  const hits = Array.from({ length: totalSteps }, () => []);
  for (const limb of LIMBS) {
    const clean = cleanLane(ex.lanes[limb] ?? '.'.repeat(totalSteps));
    lanes[limb] = [...clean].map((ch, i) => {
      const parsed = parseChar(ch);
      if (!parsed) return null;
      const hit = { limb, ...parsed };
      hits[i].push(hit);
      return hit;
    });
  }
  return {
    exercise: ex,
    stepsPerBar: ex.steps,
    stepsPerBeat: ex.steps / 4,
    bars: ex.bars,
    totalSteps,
    lanes,
    hits,
    used: usedLimbs(ex),
  };
}

/**
 * Build phases for the step-by-step mode: phase i contains the first i+1 limbs of the build order.
 * Used limbs missing from `build` are appended in canonical order.
 * @returns {Limb[][]}
 */
export function buildPhases(ex) {
  const used = usedLimbs(ex);
  const order = [...(ex.build ?? []).filter((l) => used.includes(l))];
  for (const l of used) if (!order.includes(l)) order.push(l);
  return order.map((_, i) => order.slice(0, i + 1));
}

/** Number of pattern loops per build phase so that a phase lasts at least `barsPerPhase` bars. */
export function loopsPerPhase(barsPerPhase, patternBars) {
  return Math.max(1, Math.ceil(barsPerPhase / patternBars));
}

/** Phase index for a loop (the last phase repeats forever). */
export function phaseForLoop(loop, loopsPerPh, phaseCount) {
  return Math.min(Math.floor(loop / loopsPerPh), phaseCount - 1);
}

/**
 * Limb that joins in the next bar, or null. Used to warn the player one bar ahead.
 */
export function upcomingLimb(phases, loop, stepInLoop, pattern, loopsPerPh) {
  const phase = phaseForLoop(loop, loopsPerPh, phases.length);
  if (phase >= phases.length - 1) return null;
  const absBar = loop * pattern.bars + Math.floor(stepInLoop / pattern.stepsPerBar);
  const nextPhaseBar = (phase + 1) * loopsPerPh * pattern.bars;
  return absBar === nextPhaseBar - 1 ? phases[phase + 1][phase + 1] : null;
}

/** Counting syllables for one bar. */
export function countLabels(stepsPerBar) {
  const sub = stepsPerBar === 16 ? ['', 'e', '+', 'a'] : ['', '+'];
  const labels = [];
  for (let beat = 1; beat <= 4; beat++) for (const s of sub) labels.push(s === '' ? String(beat) : s);
  return labels;
}

/**
 * Splits one bar of a voice (a group of limbs, e.g. both hands) into notation events. Each beat is handled
 * on its own, so no event crosses a beat: a leading rest, then every hit lasts until the next hit or the beat end.
 * @returns {{step: number, len: number, hits: Hit[]}[]} step = global step index, len in grid steps
 *   (hits empty = rest)
 */
export function voiceEvents(pattern, limbs, bar) {
  const spb = pattern.stepsPerBeat;
  const events = [];
  for (let beat = 0; beat < 4; beat++) {
    const start = bar * pattern.stepsPerBar + beat * spb;
    const onsets = [];
    for (let i = start; i < start + spb; i++) {
      const hs = pattern.hits[i].filter((h) => limbs.includes(h.limb));
      if (hs.length) onsets.push({ step: i, hits: hs });
    }
    if (onsets.length === 0) {
      events.push({ step: start, len: spb, hits: [] });
      continue;
    }
    if (onsets[0].step > start) {
      let restLen = onsets[0].step - start;
      let step = start;
      // A three-step rest in 16ths is written as an eighth rest plus a sixteenth rest.
      if (restLen === 3) {
        events.push({ step, len: 2, hits: [] });
        step += 2;
        restLen = 1;
      }
      events.push({ step, len: restLen, hits: [] });
    }
    onsets.forEach((o, idx) => {
      const end = idx + 1 < onsets.length ? onsets[idx + 1].step : start + spb;
      events.push({ step: o.step, len: end - o.step, hits: o.hits });
    });
  }
  return events;
}

/** True when a group of limbs has at least one hit in the given bar. */
export function voiceHasHits(pattern, limbs, bar) {
  const from = bar * pattern.stepsPerBar;
  for (let i = from; i < from + pattern.stepsPerBar; i++) {
    if (pattern.hits[i].some((h) => limbs.includes(h.limb))) return true;
  }
  return false;
}

/**
 * Notation duration for a length in grid steps.
 * @returns {{duration: string, dots: number, beats: number}} VexFlow duration code, number of dots, length in beats
 */
export function durationFor(lenSteps, stepsPerBeat) {
  const beats = lenSteps / stepsPerBeat;
  const table = { 0.25: ['16', 0], 0.5: ['8', 0], 0.75: ['8', 1], 1: ['q', 0] };
  const entry = table[beats];
  if (!entry) throw new Error(`Keine Notendauer für ${lenSteps} Schritte bei ${stepsPerBeat} pro Viertel`);
  return { duration: entry[0], dots: entry[1], beats };
}
