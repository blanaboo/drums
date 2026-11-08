import { Sequencer } from '../js/audio/sequencer.js';
import { findExercise } from '../js/curriculum.js';
import { parseExercise } from '../js/pattern.js';
import { assertClose, assertEqual, test } from './harness.js';

function setup(exerciseId, options = {}) {
  const log = { hits: [], clicks: [], steps: [] };
  const seq = new Sequencer({
    onHit: (hit, time) => log.hits.push({ time, limb: hit.limb, char: hit.char }),
    onClick: (time, accent) => log.clicks.push({ time, accent }),
    onStep: (e) => log.steps.push(e),
  });
  seq.setPattern(parseExercise(findExercise(exerciseId)));
  seq.setOptions({ countIn: false, ...options });
  seq.start(0);
  return { seq, log };
}

const at = (log, time) =>
  log.hits
    .filter((h) => Math.abs(h.time - time) < 1e-9)
    .map((h) => h.char)
    .sort()
    .join('');

test('steps are spaced by the tempo (eighths at 60 BPM = 0.5 s)', () => {
  const { seq, log } = setup('2.2', { bpm: 60 });
  seq.tick(2.0);
  assertEqual(
    log.steps.map((s) => s.time),
    [0, 0.5, 1, 1.5],
  );
  assertEqual(at(log, 0), 'hk');
  assertEqual(at(log, 0.5), 'h');
  assertEqual(at(log, 1), 'hs');
});

test('sixteenth grid at 90 BPM', () => {
  const { seq, log } = setup('6.1', { bpm: 90 });
  seq.tick(0.95);
  assertClose(log.steps[1].time, 60 / 90 / 4, 1e-9);
  assertEqual(log.steps.length, 6);
});

test('count-in: one bar of clicks, accent on 1, pattern starts after it', () => {
  const { seq, log } = setup('2.2', { bpm: 60, countIn: true, click: false });
  seq.tick(4.6);
  assertEqual(
    log.clicks.map((c) => [c.time, c.accent]),
    [
      [0, true],
      [1, false],
      [2, false],
      [3, false],
    ],
  );
  assertEqual(log.hits[0].time, 4);
  assertEqual(log.steps.filter((s) => s.countIn).length, 8);
});

test('muted limbs are not played', () => {
  const { seq, log } = setup('2.2', { bpm: 120, muted: new Set(['RF']) });
  seq.tick(4);
  assertEqual(log.hits.filter((h) => h.limb === 'RF').length, 0);
  assertEqual(log.hits.filter((h) => h.limb === 'LH').length > 0, true);
});

test('build mode adds one limb every 4 bars and warns one bar ahead', () => {
  const { seq, log } = setup('2.2', { bpm: 240, build: true, barsPerPhase: 4 });
  const bar = 1; // one 4/4 bar at 240 BPM lasts 1 s
  seq.tick(12 * bar - 1e-6);
  const limbsInLoop = (loop) => [...new Set(log.hits.filter((h) => Math.floor(h.time / bar) === loop).map((h) => h.limb))].sort();
  assertEqual(limbsInLoop(0), ['RH']);
  assertEqual(limbsInLoop(3), ['RH']);
  assertEqual(limbsInLoop(4), ['RF', 'RH']);
  assertEqual(limbsInLoop(8), ['LH', 'RF', 'RH']);
  const upcomingByLoop = (loop) => log.steps.find((s) => s.loop === loop).upcoming;
  assertEqual([0, 3, 7, 8].map(upcomingByLoop), [null, 'RF', 'LH', null]);
});

test('tempo staircase raises the tempo every N loops up to the target', () => {
  const { seq, log } = setup('2.2', {
    bpm: 60,
    staircase: { enabled: true, everyLoops: 2, increment: 5, target: 70 },
  });
  seq.tick(40);
  const bpmAtLoop = (loop) => log.steps.find((s) => s.loop === loop && s.step === 0).bpm;
  assertEqual([0, 1, 2, 3, 4, 6, 8].map(bpmAtLoop), [60, 60, 65, 65, 70, 70, 70]);
});

test('staircase never lowers a tempo above the target', () => {
  const { seq, log } = setup('2.2', { bpm: 110, staircase: { enabled: true, everyLoops: 1, increment: 5, target: 100 } });
  seq.tick(10);
  assertEqual(new Set(log.steps.map((s) => s.bpm)).size, 1);
  assertEqual(log.steps[0].bpm, 110);
});

test('tempo change takes effect on the next step', () => {
  const { seq, log } = setup('2.2', { bpm: 60 });
  seq.tick(0.1);
  seq.setOptions({ bpm: 120 });
  seq.tick(1.0);
  assertEqual(
    log.steps.map((s) => s.time),
    [0, 0.5, 0.75],
  );
});
