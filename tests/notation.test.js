import { EXERCISES } from '../js/curriculum.js';
import { renderNotation } from '../js/notation.js';
import { parseExercise } from '../js/pattern.js';
import { assert, test } from './harness.js';

const COLORS = { RH: '#00f', LH: '#0a0', RF: '#f80', LF: '#80f' };

for (const width of [1334, 992, 360]) {
  test(`every exercise renders at ${width}px with a cursor position per step`, () => {
    const scratch = document.getElementById('scratch');
    for (const ex of EXERCISES) {
      const pattern = parseExercise(ex);
      const result = renderNotation(scratch, pattern, { width, colors: COLORS });
      assert(scratch.querySelector('svg'), `${ex.id}: no svg`);
      assert(result.stepX.length === pattern.totalSteps, `${ex.id}: stepX length`);
      for (let i = 0; i < pattern.totalSteps; i++) {
        const x = result.stepX[i];
        assert(Number.isFinite(x), `${ex.id}: step ${i} has no x`);
        assert(x >= 0 && x <= width, `${ex.id}: step ${i} x=${x} outside 0..${width}`);
        if (i > 0 && result.stepRow[i] === result.stepRow[i - 1]) {
          assert(x > result.stepX[i - 1], `${ex.id}: step ${i} not right of step ${i - 1}`);
        }
      }
    }
  });
}
