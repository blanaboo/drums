import {
  buildPhases,
  countLabels,
  durationFor,
  loopsPerPhase,
  parseChar,
  parseExercise,
  phaseForLoop,
  upcomingLimb,
  usedLimbs,
  validateExercise,
  VELOCITY,
  voiceEvents,
} from '../js/pattern.js';
import { assert, assertEqual, test } from './harness.js';

const base = { id: 't', steps: 8, bars: 1, tempo: { start: 60, target: 90 } };

test('parseChar: rest, accent, ghost, unknown', () => {
  assertEqual(parseChar('.'), null);
  const accent = parseChar('S');
  assertEqual([accent.char, accent.accent, accent.velocity], ['s', true, VELOCITY.accent]);
  const ghost = parseChar('g');
  assertEqual([ghost.inst.ghost, ghost.velocity], [true, VELOCITY.ghost]);
  let threw = false;
  try {
    parseChar('x');
  } catch {
    threw = true;
  }
  assert(threw, 'unknown character must throw');
});

test('validateExercise: lane length, limb/instrument mismatch, empty build limb', () => {
  const errors = validateExercise({
    ...base,
    lanes: { RH: 'hhhh', RF: 's.......', LH: '........' },
    build: ['LH'],
  });
  assert(errors.some((e) => e.includes('4 Zeichen statt 8')), errors.join('|'));
  assert(errors.some((e) => e.includes('Snare passt nicht zu Rechter Fuß')), errors.join('|'));
  assert(errors.some((e) => e.includes('build enthält LH')), errors.join('|'));
});

test('parseExercise ignores bar separators and collects hits per step', () => {
  const p = parseExercise({ ...base, bars: 2, lanes: { RH: 'hhhhhhhh|hhhhhhhh', RF: 'k...k...|k...k...' } });
  assertEqual(p.totalSteps, 16);
  assertEqual(
    p.hits[8].map((h) => h.limb),
    ['RH', 'RF'],
  );
  assertEqual(p.used, ['RH', 'RF']);
});

test('usedLimbs keeps canonical order', () => {
  assertEqual(usedLimbs({ lanes: { RF: 'k.......', LH: '..s.....', LF: '........' } }), ['LH', 'RF']);
});

test('countLabels for eighths and sixteenths', () => {
  assertEqual(countLabels(8), ['1', '+', '2', '+', '3', '+', '4', '+']);
  assertEqual(countLabels(16).slice(0, 5), ['1', 'e', '+', 'a', '2']);
});

test('durationFor maps grid lengths to note values', () => {
  assertEqual(durationFor(1, 2), { duration: '8', dots: 0, beats: 0.5 });
  assertEqual(durationFor(2, 2), { duration: 'q', dots: 0, beats: 1 });
  assertEqual(durationFor(3, 4), { duration: '8', dots: 1, beats: 0.75 });
  assertEqual(durationFor(1, 4).duration, '16');
});

test('voiceEvents splits per beat with leading rests (16th grid)', () => {
  const p = parseExercise({ ...base, steps: 16, lanes: { RH: 'h.h.h.h.h.h.h.h.', RF: 'k......kk.......' } });
  const events = voiceEvents(p, ['RF', 'LF'], 0).map((e) => [e.step, e.len, e.hits.length]);
  assertEqual(events, [
    [0, 4, 1],
    [4, 2, 0],
    [6, 1, 0],
    [7, 1, 1],
    [8, 4, 1],
    [12, 4, 0],
  ]);
});

test('voiceEvents merges both hands into chords', () => {
  const p = parseExercise({ ...base, lanes: { RH: 'hhhhhhhh', LH: '..s...s.' } });
  const ev = voiceEvents(p, ['RH', 'LH'], 0).find((e) => e.step === 2);
  assertEqual(
    ev.hits.map((h) => h.char),
    ['h', 's'],
  );
});

test('buildPhases follows build order and appends missing limbs', () => {
  const phases = buildPhases({ ...base, lanes: { RH: 'h.......', LH: '..s.....', RF: 'k.......' }, build: ['RF'] });
  assertEqual(phases, [['RF'], ['RF', 'RH'], ['RF', 'RH', 'LH']]);
});

test('build phase timing and upcoming limb', () => {
  const p = parseExercise({ ...base, lanes: { RH: 'hhhhhhhh', LH: '..s...s.', RF: 'k...k...' }, build: ['RH', 'RF', 'LH'] });
  const phases = buildPhases(p.exercise);
  const lpp = loopsPerPhase(4, 1);
  assertEqual(lpp, 4);
  assertEqual([0, 3, 4, 8, 50].map((l) => phaseForLoop(l, lpp, phases.length)), [0, 0, 1, 2, 2]);
  assertEqual(upcomingLimb(phases, 2, 0, p, lpp), null);
  assertEqual(upcomingLimb(phases, 3, 5, p, lpp), 'RF');
  assertEqual(upcomingLimb(phases, 7, 0, p, lpp), 'LH');
  assertEqual(upcomingLimb(phases, 11, 0, p, lpp), null);
  // A 4-bar pattern: one loop per phase, warning in its last bar.
  assertEqual(loopsPerPhase(4, 4), 1);
  assertEqual(loopsPerPhase(2, 4), 1);
});
