// Synthesized drum kit (Web Audio). No samples: every voice is built from oscillators and a shared noise buffer.
// Voices connect to `kit.out`, which the engine swaps per run so that stopping can silence ringing sounds.

function createNoiseBuffer(ctx, seconds = 2) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 22222;
  for (let i = 0; i < length; i++) {
    // Deterministic pseudo-random noise (LCG) keeps offline renders reproducible.
    seed = (seed * 1664525 + 1013904223) >>> 0;
    data[i] = seed / 2147483648 - 1;
  }
  return buffer;
}

/** Ratios of the six square oscillators of a classic analog cymbal. */
const METAL_RATIOS = [2, 3, 4.16, 5.43, 6.79, 8.21];

export function createDrumKit(ctx) {
  const noiseBuffer = createNoiseBuffer(ctx);
  /** @type {AudioNode} */
  let out = ctx.destination;
  /** Choke gain of the currently ringing open HiHat. */
  let openHatChoke = null;
  let noiseOffset = 0;

  function envelope(t, peak, decay, attack = 0.001) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    return g;
  }

  function noise(t, duration) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    // Rotate through the buffer so consecutive hits do not sound identical.
    noiseOffset = (noiseOffset + 0.137) % Math.max(0.01, noiseBuffer.duration - duration - 0.01);
    src.start(t, noiseOffset, duration + 0.01);
    return src;
  }

  function filter(type, frequency, q = 0.7) {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = frequency;
    f.Q.value = q;
    return f;
  }

  function chain(...nodes) {
    for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
    return nodes[nodes.length - 1];
  }

  function chokeOpenHat(t) {
    if (!openHatChoke) return;
    openHatChoke.gain.setValueAtTime(1, t);
    openHatChoke.gain.linearRampToValueAtTime(0, t + 0.02);
    openHatChoke = null;
  }

  function pitchedDrum(t, v, from, to, decay, sweep) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + sweep);
    chain(osc, envelope(t, v, decay), out);
    osc.start(t);
    osc.stop(t + decay + 0.05);
  }

  function metal(t, v, base, decay, cutoff) {
    const hp = filter('highpass', cutoff);
    const env = envelope(t, v, decay);
    chain(hp, env, out);
    for (const ratio of METAL_RATIOS) {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = base * ratio;
      osc.connect(hp);
      osc.start(t);
      osc.stop(t + decay + 0.05);
    }
  }

  const voices = {
    kick(t, v) {
      pitchedDrum(t, v * 1.4, 160, 48, 0.42, 0.11);
      // Beater click so the kick cuts through on small speakers.
      chain(noise(t, 0.012), filter('lowpass', 2500), envelope(t, v * 0.5, 0.01), out);
    },
    snare(t, v) {
      chain(noise(t, 0.22), filter('highpass', 1200), envelope(t, v * 0.9, 0.18), out);
      const tone = ctx.createOscillator();
      tone.type = 'triangle';
      tone.frequency.setValueAtTime(220, t);
      tone.frequency.exponentialRampToValueAtTime(170, t + 0.05);
      chain(tone, envelope(t, v * 0.7, 0.08), out);
      tone.start(t);
      tone.stop(t + 0.15);
    },
    hh(t, v) {
      chokeOpenHat(t);
      chain(noise(t, 0.07), filter('highpass', 7000), envelope(t, v * 0.55, 0.05), out);
    },
    hhOpen(t, v) {
      chokeOpenHat(t);
      const choke = ctx.createGain();
      chain(noise(t, 0.6), filter('highpass', 6500), envelope(t, v * 0.5, 0.5), choke, out);
      openHatChoke = choke;
    },
    hhPedal(t, v) {
      chokeOpenHat(t);
      chain(noise(t, 0.05), filter('bandpass', 4500, 1.2), envelope(t, v * 0.7, 0.035), out);
    },
    ride(t, v) {
      metal(t, v * 0.18, 230, 0.9, 5000);
      chain(noise(t, 0.05), filter('highpass', 8000), envelope(t, v * 0.25, 0.04), out);
    },
    crash(t, v) {
      metal(t, v * 0.12, 300, 1.4, 6000);
      chain(noise(t, 1.6), filter('highpass', 5000), envelope(t, v * 0.6, 1.5), out);
    },
    tom1(t, v) {
      pitchedDrum(t, v, 240, 170, 0.32, 0.15);
    },
    tom2(t, v) {
      pitchedDrum(t, v, 180, 125, 0.38, 0.18);
    },
    floor(t, v) {
      pitchedDrum(t, v * 1.1, 120, 80, 0.5, 0.2);
    },
  };

  return {
    get out() {
      return out;
    },
    set out(node) {
      out = node;
      openHatChoke = null;
    },
    /** Plays a drum voice at audio time `t` with velocity `v` (0..1). */
    play(sound, t, v) {
      voices[sound](t, v);
    },
    /** Hard, bright metronome click; louder and higher on beat 1. */
    click(t, accent, volume = 1) {
      const freq = accent ? 2000 : 1400;
      const bp = filter('bandpass', freq, 6);
      const env = envelope(t, (accent ? 1.0 : 0.7) * volume, 0.035);
      chain(bp, env, out);
      for (const f of [freq, freq * 1.5]) {
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = f;
        osc.connect(bp);
        osc.start(t);
        osc.stop(t + 0.06);
      }
    },
  };
}
