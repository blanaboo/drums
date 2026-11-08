// Limb lane grid: one row per used limb, one column per grid step, wrapped into rows of bars.
// The label of every lane is a mute toggle. highlight() moves the playhead, setBuildState() greys out limbs
// that have not joined yet in the step-by-step mode.

import { LIMB_INFO, countLabels } from './pattern.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * @param {HTMLElement} container
 * @param {import('./pattern.js').Pattern} pattern
 * @param {{barsPerRow: number, muted: Set<string>, onToggleMute: (limb: string) => void}} options
 */
export function renderGrid(container, pattern, { barsPerRow, muted, onToggleMute }) {
  container.innerHTML = '';
  const cellsByStep = Array.from({ length: pattern.totalSteps }, () => []);
  const rowsByLimb = Object.fromEntries(pattern.used.map((l) => [l, []]));
  const labels = countLabels(pattern.stepsPerBar);
  const muteButtons = {};

  for (let firstBar = 0; firstBar < pattern.bars; firstBar += barsPerRow) {
    const bars = Math.min(barsPerRow, pattern.bars - firstBar);
    const columns = bars * pattern.stepsPerBar;
    const block = el('div', 'grid-block');
    block.style.setProperty('--cols', columns);

    block.append(el('div', 'grid-corner', firstBar === 0 ? '' : `Takt ${firstBar + 1}`));
    for (let c = 0; c < columns; c++) {
      const stepInBar = c % pattern.stepsPerBar;
      const head = el('div', 'grid-count', labels[stepInBar]);
      if (stepInBar % pattern.stepsPerBeat === 0) head.classList.add('beat');
      if (stepInBar === 0) head.classList.add('bar');
      block.append(head);
      cellsByStep[firstBar * pattern.stepsPerBar + c].push(head);
    }

    for (const limb of pattern.used) {
      const label = el('button', `grid-label limb-${limb}`);
      label.type = 'button';
      label.append(el('span', 'limb-dot'), el('span', 'limb-name', LIMB_INFO[limb].name), el('span', 'limb-sound'));
      label.addEventListener('click', () => onToggleMute(limb));
      (muteButtons[limb] ??= []).push(label);
      block.append(label);
      rowsByLimb[limb].push(label);
      for (let c = 0; c < columns; c++) {
        const step = firstBar * pattern.stepsPerBar + c;
        const stepInBar = c % pattern.stepsPerBar;
        const hit = pattern.lanes[limb][step];
        const cell = el('div', `grid-cell limb-${limb}`);
        if (stepInBar % pattern.stepsPerBeat === 0) cell.classList.add('beat');
        if (stepInBar === 0) cell.classList.add('bar');
        if (hit) {
          cell.classList.add('hit');
          if (hit.accent) cell.classList.add('accent');
          if (hit.inst.ghost) cell.classList.add('ghost');
          cell.textContent = hit.inst.abbr;
          cell.title = hit.inst.name;
        }
        block.append(cell);
        cellsByStep[step].push(cell);
        rowsByLimb[limb].push(cell);
      }
    }
    container.append(block);
  }

  function updateMutes() {
    for (const [limb, buttons] of Object.entries(muteButtons)) {
      for (const b of buttons) {
        const isMuted = muted.has(limb);
        b.classList.toggle('muted', isMuted);
        b.querySelector('.limb-sound').textContent = isMuted ? 'stumm' : '';
        b.setAttribute('aria-pressed', String(isMuted));
        b.title = isMuted ? 'Stummgeschaltet – tippen zum Einschalten' : 'Tippen zum Stummschalten';
      }
    }
  }
  updateMutes();

  let current = -1;
  return {
    updateMutes,
    /** Moves the playhead to a step (-1 clears it). */
    highlight(step) {
      if (step === current) return;
      if (current >= 0) for (const c of cellsByStep[current]) c.classList.remove('now');
      current = step;
      if (step >= 0) for (const c of cellsByStep[step]) c.classList.add('now');
    },
    /** Greys out limbs that are not active yet; marks the limb that joins next. */
    setBuildState(active, upcoming) {
      for (const [limb, nodes] of Object.entries(rowsByLimb)) {
        const inactive = active !== null && !active.includes(limb);
        for (const n of nodes) {
          n.classList.toggle('inactive', inactive);
          n.classList.toggle('upcoming', limb === upcoming);
        }
      }
    },
  };
}
