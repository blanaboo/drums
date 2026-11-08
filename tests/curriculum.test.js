import { EXERCISES, findExercise, neighbours, STAGES } from '../js/curriculum.js';
import { durationFor, parseExercise, validateExercise, voiceEvents } from '../js/pattern.js';
import { assert, assertEqual, test } from './harness.js';

test('every exercise is valid', () => {
  const errors = EXERCISES.flatMap(validateExercise);
  assertEqual(errors, []);
});

test('exercise ids are unique and ordered by stage', () => {
  const ids = EXERCISES.map((e) => e.id);
  assertEqual(new Set(ids).size, ids.length, 'duplicate ids');
  for (const ex of EXERCISES) assert(ex.id.startsWith(`${ex.stage}.`), `${ex.id} in stage ${ex.stage}`);
  assert(STAGES.length >= 6, 'six stages');
});

test('every exercise has a tip and its build order covers all used limbs', () => {
  for (const ex of EXERCISES) {
    assert(ex.tip && ex.tip.length > 20, `${ex.id}: tip`);
    const p = parseExercise(ex);
    for (const limb of p.used) assert(ex.build.includes(limb), `${ex.id}: build misses ${limb}`);
  }
});

test('notation durations add up to four beats per bar and voice', () => {
  for (const ex of EXERCISES) {
    const p = parseExercise(ex);
    for (let bar = 0; bar < p.bars; bar++) {
      for (const limbs of [
        ['RH', 'LH'],
        ['RF', 'LF'],
      ]) {
        const beats = voiceEvents(p, limbs, bar).reduce((sum, e) => sum + durationFor(e.len, p.stepsPerBeat).beats, 0);
        assertEqual(beats, 4, `${ex.id} bar ${bar + 1} ${limbs}`);
      }
    }
  }
});

test('neighbours and lookup', () => {
  assertEqual(findExercise('2.2').title, 'Rock-Grundbeat');
  assertEqual(findExercise('9.9'), null);
  const { prev, next } = neighbours('1.1');
  assertEqual([prev, next.id], [null, '1.2']);
});
