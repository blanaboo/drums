// Exercise screen: notation, limb grid, transport controls, step-by-step mode and tempo staircase.

import { findExercise, neighbours, STAGES } from '../curriculum.js';
import { renderGrid } from '../grid.js';
import { renderNotation } from '../notation.js';
import { buildPhases, countLabels, LIMB_INFO, parseExercise } from '../pattern.js';
import { isDone, loadProgress, loadSettings, recordSuccess, rememberTempo, saveSettings } from '../progress.js';

const MIN_BPM = 30;
const MAX_BPM = 180;

function esc(text) {
  return String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

function limbColors() {
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(
    ['RH', 'LH', 'RF', 'LF'].map((l) => [l, style.getPropertyValue(`--limb-${l}-note`).trim() || '#000']),
  );
}

function soundNames(pattern, limb) {
  const names = new Set(pattern.lanes[limb].filter(Boolean).map((h) => h.inst.name.replace(' leise', '')));
  return [...names].join(', ');
}

/**
 * @param {HTMLElement} root
 * @param {string} id
 * @param {import('../audio/engine.js').AudioEngine} engine
 * @returns {() => void} cleanup
 */
export function renderExercise(root, id, engine) {
  const exercise = findExercise(id);
  if (!exercise) {
    root.innerHTML = `<div class="page"><p>Übung ${esc(id)} gibt es nicht.</p><a href="#/">Zur Übersicht</a></div>`;
    return () => {};
  }
  const stage = STAGES.find((s) => s.id === exercise.stage);
  const pattern = parseExercise(exercise);
  const phases = buildPhases(exercise);
  const { prev, next } = neighbours(id);
  const settings = loadSettings();
  const progress = loadProgress();
  let bpm = progress[id]?.last ?? exercise.tempo.start;
  const muted = new Set();
  let wakeLock = null;
  let grid = null;
  let notation = null;
  let lastStep = null;

  const counts = countLabels(pattern.stepsPerBar).join(' ');
  root.innerHTML = `
    <div class="page exercise-page">
      <header class="ex-header">
        <a class="back" href="#/" aria-label="Zur Übersicht">←</a>
        <div class="ex-heading">
          <div class="ex-stage">Stufe ${stage.id} · ${esc(stage.title)} · Übung ${exercise.id}</div>
          <h1>${esc(exercise.title)}</h1>
        </div>
        <nav class="ex-nav">
          ${prev ? `<a class="nav-btn" href="#/uebung/${prev.id}" aria-label="Vorige Übung">‹ ${prev.id}</a>` : ''}
          ${next ? `<a class="nav-btn" href="#/uebung/${next.id}" aria-label="Nächste Übung">${next.id} ›</a>` : ''}
        </nav>
      </header>

      <section class="card notation-card">
        <div class="notation-wrap">
          <div class="notation"></div>
          <div class="cursor" hidden></div>
        </div>
        <div class="overlay countin" hidden></div>
        <div class="hint" hidden></div>
      </section>

      <section class="card grid-card">
        <div class="grid"></div>
      </section>

      <section class="card tip-card">
        <h2>Worauf achten</h2>
        <p>${esc(exercise.tip)}</p>
        <p class="count-line">Zählen: <span>${counts}</span></p>
        <p class="best-line"></p>
      </section>

      <section class="controls">
        <button class="play" type="button" aria-label="Start">▶</button>
        <div class="tempo">
          <button class="tempo-step" data-delta="-5" type="button" aria-label="Langsamer">−</button>
          <div class="tempo-display"><span class="bpm"></span><small>BPM</small></div>
          <button class="tempo-step" data-delta="5" type="button" aria-label="Schneller">+</button>
          <input class="tempo-slider" type="range" min="${MIN_BPM}" max="${MAX_BPM}" step="1" aria-label="Tempo">
          <div class="tempo-target">Ziel ${exercise.tempo.target}</div>
        </div>
        <div class="toggles">
          <button class="toggle" data-setting="click" type="button">Klick</button>
          <button class="toggle" data-setting="countIn" type="button">Einzählen</button>
          <button class="toggle" data-setting="build" type="button">Aufbau</button>
          <button class="toggle" data-setting="staircase" type="button">Tempo-Treppe</button>
        </div>
        <button class="success" type="button"></button>
      </section>

      <details class="card settings">
        <summary>Einstellungen</summary>
        <div class="settings-grid">
          <label>Lautstärke <input data-num="volume" type="range" min="0" max="1.5" step="0.05"></label>
          <label>Klick-Lautstärke <input data-num="clickVolume" type="range" min="0" max="1.5" step="0.05"></label>
          <label>Takte pro Aufbau-Stufe
            <select data-num="barsPerPhase"><option>2</option><option>4</option><option>8</option></select></label>
          <label>Tempo-Treppe: Schritt
            <select data-num="staircaseIncrement"><option value="2">+2 BPM</option><option value="5">+5 BPM</option><option value="10">+10 BPM</option></select></label>
          <label>Tempo-Treppe: alle
            <select data-num="staircaseEvery"><option value="2">2 Durchläufe</option><option value="4">4 Durchläufe</option><option value="8">8 Durchläufe</option></select></label>
          <label>Bild-Versatz (Bluetooth) <input data-num="visualOffsetMs" type="range" min="0" max="400" step="10"><output></output></label>
          <label class="check"><input data-bool="colors" type="checkbox"> Noten in Gliedmaßen-Farben</label>
        </div>
        <p class="settings-note">Kopfhörer mit Kabel sind am genauesten. Bei Bluetooth hinkt der Ton etwas hinterher – dann den Bild-Versatz erhöhen, bis Marke und Ton zusammenpassen.</p>
      </details>
    </div>`;

  const $ = (sel) => root.querySelector(sel);
  const playBtn = $('.play');
  const bpmEl = $('.bpm');
  const slider = $('.tempo-slider');
  const successBtn = $('.success');
  const hintEl = $('.hint');
  const countinEl = $('.countin');
  const cursor = $('.cursor');
  const notationEl = $('.notation');

  // --- rendering -------------------------------------------------------------------------------------------

  function render() {
    const width = notationEl.parentElement.clientWidth;
    notation = renderNotation(notationEl, pattern, { width, colors: settings.colors ? limbColors() : null });
    const gridWidth = $('.grid').clientWidth;
    const gridBars = Math.max(1, Math.min(pattern.bars, Math.floor((gridWidth - 150) / (pattern.stepsPerBar * 34))));
    grid = renderGrid($('.grid'), pattern, { barsPerRow: gridBars, muted, onToggleMute: toggleMute });
    for (const limb of pattern.used) {
      for (const label of root.querySelectorAll(`.grid-label.limb-${limb} .limb-name`)) {
        label.title = soundNames(pattern, limb);
      }
    }
    if (lastStep) applyStep(lastStep);
    else grid.setBuildState(settings.build ? phases[phases.length - 1] : null, null);
  }

  function moveCursor(step) {
    if (step < 0 || !notation?.stepX.length) {
      cursor.hidden = true;
      return;
    }
    cursor.hidden = false;
    cursor.style.transform = `translate(${notation.stepX[step] - 2}px, ${notation.stepRow[step] * notation.rowHeight}px)`;
    cursor.style.height = `${notation.rowHeight}px`;
  }

  function updateTempo() {
    bpmEl.textContent = String(bpm);
    slider.value = String(bpm);
    successBtn.textContent = `✓ Geschafft bei ${bpm} BPM`;
  }

  function updateBest() {
    const p = loadProgress()[id];
    const done = isDone(exercise, loadProgress());
    $('.best-line').textContent = p?.best
      ? `Bestes Tempo: ${p.best} BPM${done ? ' – Ziel erreicht ✓' : ` – Ziel: ${exercise.tempo.target} BPM`}`
      : `Ziel: ${exercise.tempo.target} BPM, sauber und entspannt.`;
  }

  function updateToggles() {
    for (const btn of root.querySelectorAll('.toggle')) {
      const on = Boolean(settings[btn.dataset.setting]);
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', String(on));
    }
    for (const input of root.querySelectorAll('[data-num]')) input.value = String(settings[input.dataset.num]);
    for (const input of root.querySelectorAll('[data-bool]')) input.checked = Boolean(settings[input.dataset.bool]);
    $('output').textContent = `${settings.visualOffsetMs} ms`;
  }

  // --- engine ----------------------------------------------------------------------------------------------

  function sequencerOptions() {
    return {
      bpm,
      click: settings.click,
      countIn: settings.countIn,
      muted,
      build: settings.build,
      barsPerPhase: settings.barsPerPhase,
      staircase: {
        enabled: settings.staircase,
        everyLoops: settings.staircaseEvery,
        increment: settings.staircaseIncrement,
        target: exercise.tempo.target,
      },
    };
  }

  function applyStep(e) {
    lastStep = e;
    if (e.countIn) {
      const beat = Math.floor(e.step / pattern.stepsPerBeat) + 1;
      countinEl.hidden = false;
      countinEl.textContent = String(beat);
      grid.highlight(-1);
      moveCursor(-1);
    } else {
      countinEl.hidden = true;
      grid.highlight(e.step);
      moveCursor(e.step);
    }
    grid.setBuildState(e.active ?? (e.countIn && settings.build ? [] : null), e.upcoming);
    if (e.upcoming) {
      hintEl.hidden = false;
      const limb = LIMB_INFO[e.upcoming];
      hintEl.innerHTML = `${e.countIn ? 'Los geht’s mit' : 'Gleich dazu'}: <strong class="limb-text-${e.upcoming}">${limb.name}</strong> – ${esc(soundNames(pattern, e.upcoming))}`;
    } else if (e.active && e.phase === phases.length - 1 && phases.length > 1) {
      hintEl.hidden = false;
      hintEl.textContent = 'Alles zusammen!';
    } else {
      hintEl.hidden = true;
    }
    if (e.bpm !== bpm) {
      bpm = e.bpm;
      updateTempo();
      rememberTempo(id, bpm);
    }
  }

  engine.onStep = applyStep;
  engine.onStop = () => setStopped();

  function setStopped() {
    playBtn.textContent = '▶';
    playBtn.setAttribute('aria-label', 'Start');
    playBtn.classList.remove('playing');
    grid.highlight(-1);
    moveCursor(-1);
    countinEl.hidden = true;
    hintEl.hidden = true;
    lastStep = null;
    grid.setBuildState(null, null);
    releaseWakeLock();
  }

  async function start() {
    engine.volume = settings.volume;
    engine.clickVolume = settings.clickVolume;
    engine.visualOffsetMs = settings.visualOffsetMs;
    engine.sequencer.setPattern(pattern);
    engine.sequencer.setOptions(sequencerOptions());
    await engine.start();
    engine.setVolume(settings.volume);
    playBtn.textContent = '■';
    playBtn.setAttribute('aria-label', 'Stopp');
    playBtn.classList.add('playing');
    requestWakeLock();
  }

  function stop() {
    engine.stop(false);
    setStopped();
  }

  async function requestWakeLock() {
    try {
      wakeLock = (await navigator.wakeLock?.request('screen')) ?? null;
    } catch {
      wakeLock = null; // Needs HTTPS and a visible page; the app works without it.
    }
  }

  function releaseWakeLock() {
    wakeLock?.release().catch(() => {});
    wakeLock = null;
  }

  // --- controls --------------------------------------------------------------------------------------------

  function setBpm(value) {
    bpm = Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(value)));
    engine.sequencer.setOptions({ bpm });
    updateTempo();
    rememberTempo(id, bpm);
  }

  function toggleMute(limb) {
    if (muted.has(limb)) muted.delete(limb);
    else muted.add(limb);
    engine.sequencer.setOptions({ muted });
    grid.updateMutes();
  }

  function changeSettings(patch) {
    Object.assign(settings, patch);
    saveSettings(settings);
    updateToggles();
    engine.clickVolume = settings.clickVolume;
    engine.visualOffsetMs = settings.visualOffsetMs;
    engine.setVolume(settings.volume);
    if (engine.running) {
      // The build mode counts loops from the start, so switching it restarts playback.
      if ('build' in patch || 'barsPerPhase' in patch || 'countIn' in patch) start();
      else engine.sequencer.setOptions(sequencerOptions());
    }
  }

  playBtn.addEventListener('click', () => (engine.running ? stop() : start()));
  for (const btn of root.querySelectorAll('.tempo-step')) {
    btn.addEventListener('click', () => setBpm(bpm + Number(btn.dataset.delta)));
  }
  slider.addEventListener('input', () => setBpm(Number(slider.value)));
  for (const btn of root.querySelectorAll('.toggle')) {
    btn.addEventListener('click', () => changeSettings({ [btn.dataset.setting]: !settings[btn.dataset.setting] }));
  }
  for (const input of root.querySelectorAll('[data-num]')) {
    input.addEventListener('input', () => changeSettings({ [input.dataset.num]: Number(input.value) }));
  }
  for (const input of root.querySelectorAll('[data-bool]')) {
    input.addEventListener('change', () => {
      changeSettings({ [input.dataset.bool]: input.checked });
      render();
    });
  }
  successBtn.addEventListener('click', () => {
    const entry = recordSuccess(id, bpm);
    updateBest();
    successBtn.classList.add('saved');
    const reached = entry.best >= exercise.tempo.target;
    successBtn.textContent = reached ? `✓ Gespeichert – Ziel erreicht!` : `✓ Gespeichert: ${bpm} BPM`;
    setTimeout(() => {
      successBtn.classList.remove('saved');
      updateTempo();
    }, 1800);
  });

  function onKey(event) {
    if (event.code === 'Space' && !(event.target instanceof HTMLInputElement)) {
      event.preventDefault();
      playBtn.click();
    }
  }
  function onVisibility() {
    if (document.hidden && engine.running) stop();
  }
  let resizeTimer = 0;
  let lastWidth = root.clientWidth;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (root.clientWidth !== lastWidth) {
        lastWidth = root.clientWidth;
        render();
      }
    }, 150);
  }
  document.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('resize', onResize);

  updateTempo();
  updateToggles();
  updateBest();
  render();

  return () => {
    stop();
    engine.onStep = () => {};
    engine.onStop = () => {};
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('resize', onResize);
  };
}
