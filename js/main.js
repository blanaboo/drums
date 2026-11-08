// Entry point: hash routing between the overview and the exercise screen, service worker registration.

import { AudioEngine } from './audio/engine.js';
import { renderExercise } from './views/exercise.js';
import { renderList } from './views/list.js';

const root = document.getElementById('app');
const engine = new AudioEngine();
let cleanup = () => {};

function route() {
  cleanup();
  cleanup = () => {};
  const match = location.hash.match(/^#\/uebung\/([\w.]+)$/);
  if (match) {
    cleanup = renderExercise(root, match[1], engine);
  } else {
    renderList(root);
  }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
route();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {
    // Offline support is optional.
  });
}
