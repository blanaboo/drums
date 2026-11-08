// Audio engine: owns the AudioContext, the master chain and the lookahead timer, and feeds step events to the UI
// in sync with what is audible.

import { createDrumKit } from './drums.js';
import { Sequencer } from './sequencer.js';

const LOOKAHEAD_S = 0.1;
const TIMER_MS = 25;
const START_DELAY_S = 0.15;

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.kit = null;
    this.master = null;
    this.runBus = null;
    this.timer = null;
    this.raf = 0;
    this.queue = [];
    this.volume = 0.9;
    this.clickVolume = 0.8;
    this.visualOffsetMs = 0;
    /** @type {(e: object) => void} */
    this.onStep = () => {};
    /** @type {() => void} */
    this.onStop = () => {};
    this.sequencer = new Sequencer({
      onHit: (hit, time) => this.kit.play(hit.inst.sound, time, hit.velocity),
      onClick: (time, accent) => this.kit.click(time, accent, this.clickVolume),
      onStep: (e) => this.queue.push(e),
    });
  }

  get running() {
    return this.sequencer.running;
  }

  /** Creates or resumes the AudioContext. Must be called from a user gesture on iOS. */
  async unlock() {
    if (!this.ctx) {
      // Play through the iOS silent mode like a media app (Safari 16.4+).
      if (navigator.audioSession) {
        try {
          navigator.audioSession.type = 'playback';
        } catch {
          // Not supported: Web Audio still works, just respects the silent mode.
        }
      }
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx({ latencyHint: 'interactive' });
      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.knee.value = 8;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.002;
      compressor.release.value = 0.12;
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      compressor.connect(this.master).connect(this.ctx.destination);
      this.compressor = compressor;
      this.kit = createDrumKit(this.ctx);
    }
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }

  setVolume(volume) {
    this.volume = volume;
    if (this.master) this.master.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.02);
  }

  async start() {
    await this.unlock();
    this.stop(false);
    this.runBus = this.ctx.createGain();
    this.runBus.connect(this.compressor);
    this.kit.out = this.runBus;
    this.queue = [];
    this.sequencer.start(this.ctx.currentTime + START_DELAY_S);
    const tick = () => this.sequencer.tick(this.ctx.currentTime + LOOKAHEAD_S);
    tick();
    this.timer = setInterval(tick, TIMER_MS);
    this.raf = requestAnimationFrame(() => this.frame());
  }

  /** Stops playback; ringing sounds fade out quickly. */
  stop(notify = true) {
    const wasRunning = this.sequencer.running;
    this.sequencer.stop();
    clearInterval(this.timer);
    this.timer = null;
    cancelAnimationFrame(this.raf);
    this.queue = [];
    if (this.runBus) {
      const bus = this.runBus;
      const t = this.ctx.currentTime;
      bus.gain.setValueAtTime(bus.gain.value, t);
      bus.gain.linearRampToValueAtTime(0, t + 0.05);
      setTimeout(() => bus.disconnect(), 200);
      this.runBus = null;
    }
    if (notify && wasRunning) this.onStop();
  }

  /** Latency between scheduling time and what the player hears. */
  outputLatency() {
    const ctx = this.ctx;
    return (ctx.outputLatency || 0) + (ctx.baseLatency || 0) + this.visualOffsetMs / 1000;
  }

  frame() {
    if (!this.sequencer.running) return;
    const audible = this.ctx.currentTime - this.outputLatency();
    let latest = null;
    while (this.queue.length && this.queue[0].time <= audible) latest = this.queue.shift();
    if (latest) this.onStep(latest);
    this.raf = requestAnimationFrame(() => this.frame());
  }
}
