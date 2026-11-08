# CLAUDE.md – Drums

Web app (iPad-first) for learning drums with a focus on limb independence: exercises add one limb at a time over an
ostinato, with notation (VexFlow), a coloured limb grid and a synthesized play-along track. Hosted on GitHub Pages:
https://blanaboo.github.io/drums/

## Language

- The owner communicates in **German**: UI strings, README, docs (`docs/`), issues and PRs in German.
- Code, identifiers, code comments and commit messages in English (Conventional Commits).

## Commands

```powershell
jwebserver -b 127.0.0.1 -p 8080 -d C:\Users\rober\dev\drums      # local server (JDK 21), no build step
powershell -File tools\headless.ps1                              # all browser tests in headless Edge (needs the server)
powershell -File tools\headless.ps1 -Url 'http://127.0.0.1:8080/#/uebung/2.2' -ExprFile tests\e2e-playback.js
powershell -File tools\make-icons.ps1                            # regenerate icons/
```

Node and Python are not installed on the dev machine; keep the project build-free (vanilla ES modules + JSDoc).

## Architecture

- `js/pattern.js` – exercise model: per-limb lane strings → hits per step, validation, notation durations, build phases.
- `js/curriculum.js` – stages and exercises (German titles/tips). Every exercise must pass `tests/curriculum.test.js`.
- `js/audio/sequencer.js` – pure step scheduler (count-in, mutes, build mode, tempo staircase); unit-tested with a fake clock.
- `js/audio/engine.js` – AudioContext, master compressor, lookahead timer, latency-compensated UI step events.
- `js/audio/drums.js` – synthesized drum voices and click (no samples).
- `js/notation.js` – VexFlow rendering (hands stems up, feet stems down) + step→x map for the cursor.
- `js/grid.js`, `js/views/*` – limb grid, overview, exercise screen. `js/progress.js` – localStorage (guarded).
- `sw.js` – offline cache. Add new app files to `ASSETS`; bump `CACHE` for deployments that must not mix with old files.

## Rules

- Relative URLs only (the app lives under `/drums/` on Pages).
- Run the browser tests before pushing; the app must work offline and without any network requests at runtime.
- Never commit secrets. Do not add analytics or third-party requests.
