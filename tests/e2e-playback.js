// End-to-end smoke test for real playback, run with:
//   powershell -File tools\headless.ps1 -Url 'http://127.0.0.1:8080/#/uebung/2.2' -ExprFile tests\e2e-playback.js
// Checks count-in, playhead, stop, and the step-by-step mode. Prints a JSON report with "ok": true/false.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (s) => document.querySelector(s);
  const checks = {};
  // Settings persist in localStorage, so set every toggle explicitly.
  const setToggle = (name, on) => {
    const btn = q(`[data-setting="${name}"]`);
    if (btn.classList.contains('on') !== on) btn.click();
  };
  setToggle('click', true);
  setToggle('countIn', true);
  setToggle('build', false);
  setToggle('staircase', false);

  q('.play').click();
  await sleep(1200);
  checks.countInShown = !q('.countin').hidden && /^[1-4]$/.test(q('.countin').textContent);
  await sleep(4200);
  checks.playheadMoves = document.querySelectorAll('.grid-count.now').length === 1;
  checks.cursorVisible = !q('.cursor').hidden;
  checks.countInGone = q('.countin').hidden;
  q('.play').click();
  await sleep(300);
  checks.stopClears = document.querySelectorAll('.now').length === 0 && q('.play').textContent === '▶';

  // Step-by-step mode at 160 BPM without count-in: RH only first, hint for the right foot in bar 4.
  setToggle('build', true);
  setToggle('countIn', false);
  const slider = q('.tempo-slider');
  slider.value = '160';
  slider.dispatchEvent(new Event('input'));
  q('.play').click();
  await sleep(600);
  const state = (limb) => q(`.grid-label.limb-${limb}`).classList.contains('inactive');
  checks.phase1OnlyRightHand = !state('RH') && state('LH') && state('RF');
  const bar = (4 * 60000) / 160;
  await sleep(3.5 * bar - 600);
  checks.hintForRightFoot = !q('.hint').hidden && q('.hint').textContent.includes('Rechter Fuß');
  await sleep(1.0 * bar);
  checks.phase2AddsRightFoot = !state('RH') && !state('RF') && state('LH');
  q('.play').click();

  // Restore defaults for the next run.
  setToggle('build', false);
  setToggle('countIn', true);
  slider.value = '60';
  slider.dispatchEvent(new Event('input'));
  return JSON.stringify({ ok: Object.values(checks).every(Boolean), checks });
})();
