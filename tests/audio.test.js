// Offline renders: every drum voice produces sound, and clicks land on the scheduled sample.

import { createDrumKit } from '../js/audio/drums.js';
import { Sequencer } from '../js/audio/sequencer.js';
import { findExercise } from '../js/curriculum.js';
import { parseExercise } from '../js/pattern.js';
import { assert, assertClose, test } from './harness.js';

const RATE = 44100;

async function render(seconds, schedule) {
  const ctx = new OfflineAudioContext(1, Math.ceil(seconds * RATE), RATE);
  const kit = createDrumKit(ctx);
  kit.out = ctx.destination;
  schedule(kit, ctx);
  const buffer = await ctx.startRendering();
  return buffer.getChannelData(0);
}

test('every drum voice renders finite, audible sound', async () => {
  const sounds = ['kick', 'snare', 'hh', 'hhOpen', 'hhPedal', 'ride', 'crash', 'tom1', 'tom2', 'floor'];
  const data = await render(sounds.length * 0.5 + 1.5, (kit) => {
    sounds.forEach((s, i) => kit.play(s, 0.05 + i * 0.5, 0.8));
  });
  sounds.forEach((s, i) => {
    let peak = 0;
    const from = Math.floor((0.05 + i * 0.5) * RATE);
    for (let j = from; j < from + 0.2 * RATE; j++) {
      assert(Number.isFinite(data[j]), `${s}: NaN at ${j}`);
      peak = Math.max(peak, Math.abs(data[j]));
    }
    assert(peak > 0.02, `${s}: too quiet (peak ${peak.toFixed(4)})`);
  });
});

test('open HiHat is choked by the next closed HiHat', async () => {
  const data = await render(1.0, (kit) => {
    kit.play('hhOpen', 0.1, 1);
    kit.play('hhPedal', 0.3, 0.0001);
  });
  let tail = 0;
  for (let j = Math.floor(0.4 * RATE); j < 0.5 * RATE; j++) tail = Math.max(tail, Math.abs(data[j]));
  assert(tail < 0.005, `open HiHat still ringing after choke (peak ${tail.toFixed(4)})`);
});

test('scheduled clicks start within 1 ms of their beat', async () => {
  const bpm = 120;
  const pattern = parseExercise(findExercise('1.1'));
  const times = [];
  const data = await render(2.3, (kit) => {
    const seq = new Sequencer({
      onHit: () => {},
      onClick: (t, accent) => {
        times.push(t);
        kit.click(t, accent);
      },
      onStep: () => {},
    });
    seq.setPattern(pattern);
    seq.setOptions({ bpm, countIn: false, click: true, muted: new Set(['RH']) });
    seq.start(0.1);
    seq.tick(2.05);
  });
  assert(times.length === 4, `expected 4 clicks, got ${times.length}`);
  for (const t of times) {
    const from = Math.floor((t - 0.005) * RATE);
    let onset = -1;
    for (let j = from; j < from + 0.02 * RATE; j++) {
      if (Math.abs(data[j]) > 0.01) {
        onset = j / RATE;
        break;
      }
    }
    assertClose(onset, t, 0.001, `click at ${t.toFixed(3)} s`);
  }
});
