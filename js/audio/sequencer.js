// Pure step sequencer: decides what happens at which audio time. No Web Audio here, so it can be unit-tested
// with a fake clock. The engine calls tick() with a lookahead horizon ("A Tale of Two Clocks").

import { buildPhases, loopsPerPhase, phaseForLoop, upcomingLimb } from '../pattern.js';

/**
 * @typedef {object} SequencerOptions
 * @property {number} bpm
 * @property {boolean} click
 * @property {boolean} countIn      one bar of clicks before the pattern starts
 * @property {Set<string>} muted    limbs that are not played back
 * @property {boolean} build        step-by-step mode
 * @property {number} barsPerPhase
 * @property {{enabled: boolean, everyLoops: number, increment: number, target: number}} staircase
 */

/**
 * @typedef {object} StepEvent
 * @property {number} time        audio time of the step
 * @property {boolean} countIn
 * @property {number} step        step within the loop (count-in: step within the count-in bar)
 * @property {number} loop
 * @property {number|null} phase  build phase, null when the build mode is off
 * @property {string[]|null} active  limbs played in this loop (build mode), null = all
 * @property {string|null} upcoming  limb joining in the next bar
 * @property {number} bpm
 */

export class Sequencer {
  /**
   * @param {{onHit: (hit: object, time: number) => void, onClick: (time: number, accent: boolean) => void,
   *   onStep: (e: StepEvent) => void}} callbacks
   */
  constructor(callbacks) {
    this.callbacks = callbacks;
    this.pattern = null;
    /** @type {SequencerOptions} */
    this.options = {
      bpm: 60,
      click: true,
      countIn: true,
      muted: new Set(),
      build: false,
      barsPerPhase: 4,
      staircase: { enabled: false, everyLoops: 4, increment: 5, target: 100 },
    };
    this.n = 0;
    this.nextTime = 0;
    this.running = false;
  }

  setPattern(pattern) {
    this.pattern = pattern;
    this.phases = buildPhases(pattern.exercise);
  }

  /** @param {Partial<SequencerOptions>} options */
  setOptions(options) {
    this.options = { ...this.options, ...options };
  }

  get countInSteps() {
    return this.options.countIn ? this.pattern.stepsPerBar : 0;
  }

  stepDuration() {
    return 60 / this.options.bpm / this.pattern.stepsPerBeat;
  }

  start(time) {
    this.n = -this.countInSteps;
    this.nextTime = time;
    this.running = true;
  }

  stop() {
    this.running = false;
  }

  /** Schedules every step whose time lies before `horizon`. */
  tick(horizon) {
    if (!this.running) return;
    while (this.nextTime < horizon) {
      this.scheduleStep(this.n, this.nextTime);
      this.nextTime += this.stepDuration();
      this.n++;
    }
  }

  scheduleStep(n, time) {
    const p = this.pattern;
    const o = this.options;
    const { onHit, onClick, onStep } = this.callbacks;
    if (n < 0) {
      const step = n + this.countInSteps;
      if (step % p.stepsPerBeat === 0) onClick(time, step === 0);
      const upcoming = o.build ? this.phases[0][0] : null;
      onStep({ time, countIn: true, step, loop: -1, phase: null, active: null, upcoming, bpm: o.bpm });
      return;
    }
    const loop = Math.floor(n / p.totalSteps);
    const step = n % p.totalSteps;
    const s = o.staircase;
    if (s.enabled && step === 0 && loop > 0 && loop % s.everyLoops === 0 && o.bpm < s.target) {
      o.bpm = Math.min(s.target, o.bpm + s.increment);
    }
    let phase = null;
    let active = null;
    let upcoming = null;
    if (o.build) {
      const lpp = loopsPerPhase(o.barsPerPhase, p.bars);
      phase = phaseForLoop(loop, lpp, this.phases.length);
      active = this.phases[phase];
      upcoming = upcomingLimb(this.phases, loop, step, p, lpp);
    }
    for (const hit of p.hits[step]) {
      if (o.muted.has(hit.limb)) continue;
      if (active && !active.includes(hit.limb)) continue;
      onHit(hit, time);
    }
    if (o.click && step % p.stepsPerBeat === 0) onClick(time, step % p.stepsPerBar === 0);
    onStep({ time, countIn: false, step, loop, phase, active, upcoming, bpm: o.bpm });
  }
}
