// Drum notation with VexFlow (global `Vex` from vendor/vexflow). Hands are written stems up, feet stems down.
// render() also returns the x position of every grid step so that a cursor can follow the playback.

import { durationFor, voiceEvents, voiceHasHits } from './pattern.js';

const HANDS = ['RH', 'LH'];
const FEET = ['RF', 'LF'];
const ROW_HEIGHT = 150;
const STAVE_TOP = 30;
const LEFT_PAD = 10;

/** Line position for sorting VexFlow keys from low to high. */
function keyLine(key) {
  const [letter, octave] = key.split('/');
  return Number(octave) * 7 + 'cdefgab'.indexOf(letter);
}

export function barsPerRow(width, pattern) {
  const minBar = pattern.stepsPerBar === 16 ? 430 : 300;
  return Math.max(1, Math.min(pattern.bars, 4, Math.floor((width - 2 * LEFT_PAD) / minBar)));
}

function makeNote(VF, event, pattern, stemUp, colors) {
  const { duration, dots } = durationFor(event.len, pattern.stepsPerBeat);
  const stem = stemUp ? VF.Stem.UP : VF.Stem.DOWN;
  if (event.hits.length === 0) {
    const note = new VF.StaveNote({
      keys: [stemUp ? 'e/5' : 'e/4'],
      duration: `${duration}${'d'.repeat(dots)}r`,
      clef: 'percussion',
      stem_direction: stem,
    });
    if (dots) VF.Dot.buildAndAttach([note], { all: true });
    return note;
  }
  // One entry per distinct key, sorted from low to high so modifier indices match VexFlow's order.
  const byKey = new Map();
  for (const hit of event.hits) if (!byKey.has(hit.inst.key)) byKey.set(hit.inst.key, hit);
  const entries = [...byKey.entries()].sort((a, b) => keyLine(a[0]) - keyLine(b[0]));
  const note = new VF.StaveNote({
    keys: entries.map(([key]) => key),
    duration: `${duration}${'d'.repeat(dots)}`,
    clef: 'percussion',
    stem_direction: stem,
  });
  if (dots) VF.Dot.buildAndAttach([note], { all: true });
  const position = stemUp ? VF.Modifier.Position.ABOVE : VF.Modifier.Position.BELOW;
  let accent = false;
  let open = false;
  entries.forEach(([, hit], index) => {
    if (colors) {
      const color = colors[hit.limb];
      note.setKeyStyle(index, { fillStyle: color, strokeStyle: color });
    }
    if (hit.inst.ghost) {
      note.addModifier(new VF.Parenthesis(VF.Modifier.Position.LEFT), index);
      note.addModifier(new VF.Parenthesis(VF.Modifier.Position.RIGHT), index);
    }
    accent ||= hit.accent;
    open ||= Boolean(hit.inst.open);
  });
  if (open) note.addModifier(new VF.Articulation('ah').setPosition(VF.Modifier.Position.ABOVE), 0);
  if (accent) note.addModifier(new VF.Articulation('a>').setPosition(position), 0);
  return note;
}

/**
 * Renders the pattern into `container` (replacing its content).
 * @returns {{stepX: number[], stepRow: number[], rowHeight: number, rows: number}} per global step its x position and
 *   row index
 */
export function renderNotation(container, pattern, { width, colors }) {
  const VF = globalThis.Vex?.Flow;
  container.innerHTML = '';
  if (!VF) {
    container.textContent = 'Notenbibliothek konnte nicht geladen werden.';
    return { stepX: [], stepRow: [], rowHeight: ROW_HEIGHT, rows: 0 };
  }
  const perRow = barsPerRow(width, pattern);
  const rows = Math.ceil(pattern.bars / perRow);
  const renderer = new VF.Renderer(container, VF.Renderer.Backends.SVG);
  renderer.resize(width, rows * ROW_HEIGHT);
  const ctx = renderer.getContext();
  const stepX = new Array(pattern.totalSteps).fill(null);
  const stepRow = new Array(pattern.totalSteps).fill(0);

  const usableWidth = width - 2 * LEFT_PAD;
  // The first bar of a row also holds clef (and time signature), so it gets extra room.
  const extra = 60;
  const maxBar = pattern.stepsPerBar === 16 ? 720 : 560;
  const barWidth = Math.min(maxBar, (usableWidth - extra) / perRow);
  const left = LEFT_PAD + Math.max(0, (usableWidth - extra - perRow * barWidth) / 2);
  for (let bar = 0; bar < pattern.bars; bar++) {
    const row = Math.floor(bar / perRow);
    const col = bar % perRow;
    const firstInRow = col === 0;
    const x = left + (firstInRow ? 0 : extra + col * barWidth);
    const w = barWidth + (firstInRow ? extra : 0);
    const stave = new VF.Stave(x, row * ROW_HEIGHT + STAVE_TOP, w);
    if (firstInRow) stave.addClef('percussion');
    if (bar === 0) stave.addTimeSignature('4/4');
    if (bar === pattern.bars - 1) stave.setEndBarType(VF.Barline.type.REPEAT_END);
    if (bar === 0) stave.setBegBarType(VF.Barline.type.REPEAT_BEGIN);
    stave.setContext(ctx).draw();

    const voices = [];
    const beams = [];
    const placed = [];
    for (const [limbs, stemUp] of [
      [HANDS, true],
      [FEET, false],
    ]) {
      if (!voiceHasHits(pattern, limbs, bar)) continue;
      const events = voiceEvents(pattern, limbs, bar);
      const notes = events.map((e) => makeNote(VF, e, pattern, stemUp, colors));
      const voice = new VF.Voice({ num_beats: 4, beat_value: 4 }).addTickables(notes);
      voices.push(voice);
      beams.push(
        ...VF.Beam.generateBeams(notes, {
          groups: [new VF.Fraction(1, 4)],
          stem_direction: stemUp ? VF.Stem.UP : VF.Stem.DOWN,
          beam_rests: false,
          maintain_stem_directions: true,
        }),
      );
      events.forEach((e, i) => placed.push({ step: e.step, note: notes[i] }));
    }
    if (voices.length === 0) continue;
    const formatter = new VF.Formatter().joinVoices(voices);
    formatter.format(voices, stave.getNoteEndX() - stave.getNoteStartX() - 20);
    for (const voice of voices) voice.draw(ctx, stave);
    for (const beam of beams) beam.setContext(ctx).draw();

    for (const { step, note } of placed) {
      if (stepX[step] === null) stepX[step] = note.getAbsoluteX() + 6;
    }
    // Fill steps inside longer notes by interpolating towards the next known position (or the bar end).
    const from = bar * pattern.stepsPerBar;
    const to = from + pattern.stepsPerBar;
    const endX = stave.getNoteEndX() - 8;
    for (let i = from; i < to; i++) {
      stepRow[i] = row;
      if (stepX[i] !== null) continue;
      let prev = i - 1;
      while (prev >= from && stepX[prev] === null) prev--;
      let next = i + 1;
      while (next < to && stepX[next] === null) next++;
      const x0 = prev >= from ? stepX[prev] : stave.getNoteStartX();
      const x1 = next < to ? stepX[next] : endX;
      const p0 = prev >= from ? prev : from - 1;
      const p1 = next < to ? next : to;
      stepX[i] = x0 + ((x1 - x0) * (i - p0)) / (p1 - p0);
    }
  }
  return { stepX, stepRow, rowHeight: ROW_HEIGHT, rows };
}
