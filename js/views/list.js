// Overview: stages with their exercises, progress and a "continue" shortcut.

import { EXERCISES, STAGES } from '../curriculum.js';
import { LIMB_INFO, usedLimbs } from '../pattern.js';
import { isDone, loadProgress } from '../progress.js';

function esc(text) {
  return String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

function limbDots(ex) {
  return usedLimbs(ex)
    .map((l) => `<span class="limb-chip limb-${l}" title="${LIMB_INFO[l].name}">${l}</span>`)
    .join('');
}

export function renderList(root) {
  const progress = loadProgress();
  const next = EXERCISES.find((ex) => !isDone(ex, progress)) ?? EXERCISES[EXERCISES.length - 1];
  const doneCount = EXERCISES.filter((ex) => isDone(ex, progress)).length;

  const stages = STAGES.map((stage) => {
    const cards = stage.exercises
      .map((ex) => {
        const p = progress[ex.id];
        const done = isDone(ex, progress);
        const status = done
          ? `<span class="status done">✓ ${p.best} BPM</span>`
          : p?.best
            ? `<span class="status partial">${p.best} / ${ex.tempo.target} BPM</span>`
            : `<span class="status">Ziel ${ex.tempo.target} BPM</span>`;
        return `
          <a class="exercise-card${done ? ' is-done' : ''}${ex.id === next.id ? ' is-next' : ''}" href="#/uebung/${ex.id}">
            <span class="ex-id">${ex.id}</span>
            <span class="ex-title">${esc(ex.title)}</span>
            <span class="ex-limbs">${limbDots(ex)}</span>
            ${status}
          </a>`;
      })
      .join('');
    return `
      <section class="stage">
        <h2><span class="stage-no">Stufe ${stage.id}</span> ${esc(stage.title)}</h2>
        <p class="stage-intro">${esc(stage.intro)}</p>
        <div class="exercise-list">${cards}</div>
      </section>`;
  }).join('');

  root.innerHTML = `
    <div class="page list-page">
      <header class="list-header">
        <div>
          <h1>Drums</h1>
          <p class="subtitle">Schritt für Schritt zur Unabhängigkeit von Händen und Füßen</p>
        </div>
        <div class="overall">${doneCount} von ${EXERCISES.length} Übungen geschafft</div>
      </header>
      <a class="continue" href="#/uebung/${next.id}">
        <span class="continue-label">${doneCount === 0 ? 'Los geht’s mit' : 'Weiter mit'}</span>
        <span class="continue-title">${next.id} · ${esc(next.title)}</span>
        <span class="continue-arrow" aria-hidden="true">→</span>
      </a>
      <details class="howto">
        <summary>So übst du</summary>
        <ol>
          <li><strong>Langsam anfangen.</strong> Jede Übung startet bei einem ruhigen Tempo. Sauber vor schnell.</li>
          <li><strong>Aufbau-Modus nutzen.</strong> Die App nimmt alle 4 Takte eine Gliedmaße dazu, erst dann spielst du alles zusammen.</li>
          <li><strong>Laut zählen.</strong> „1 und 2 und …“ – das verbindet Kopf und Gliedmaßen.</li>
          <li><strong>Stummschalten, was du spielst.</strong> Tippe im Raster auf eine Gliedmaße, um sie aus der Begleitspur zu nehmen.</li>
          <li><strong>Geschafft?</strong> Wenn es 4 Durchläufe fehlerfrei klappt, tippe „Geschafft bei … BPM“ und erhöhe das Tempo um 5.</li>
          <li><strong>Kopfhörer.</strong> Gegen ein akustisches Set kommen iPad-Lautsprecher kaum an. Kabel-Kopfhörer sind am genauesten.</li>
        </ol>
      </details>
      ${stages}
      <footer class="list-footer">Fortschritt wird nur auf diesem Gerät gespeichert.</footer>
    </div>`;
}
