// Soundscape: the song (streamed via YouTube, see music.js) plus a fully
// synthesised, deliberately soft ambience (no audio files). While the song
// plays, the ambience drops to a quiet bed of rain; if the song can't load,
// the full ambience below plays instead:
//  • portal  – a warm, slowly breathing chord pad with a faint shimmer
//  • city    – gentle rain (soft pink noise, no harsh hiss), a quiet pad,
//              and the occasional distant roll of thunder
//  • one-shots – thwip, whoosh and landing thud, kept quiet
// Everything runs through a master volume (the HUD slider) and a limiter,
// so nothing can ever get painfully loud.

export class AudioFX {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.volume = 0.25; // master level 0..1, set from the slider (squared curve)
    this.onStatus = null; // (status: 'on' | 'off') => void
    this._city = 0;
    this._warp = 0;
    this.music = null;
  }

  // Connect the YouTube song so the sound button and slider control it too.
  attachMusic(music) {
    this.music = music;
    music.onState = (state) => {
      // song unavailable or collapsed → bring the full ambience back (and vice versa)
      this._applyMix(false);
      this.onMusic?.(state);
    };
  }

  get songPlaying() {
    return !!this.music && this.music.active && this.enabled;
  }

  _init() {
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());

    // master → soft limiter → speakers
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -18;
    limiter.knee.value = 12;
    limiter.ratio.value = 6;
    limiter.attack.value = 0.01;
    limiter.release.value = 0.4;
    this.master.connect(limiter).connect(ctx.destination);

    const filt = (type, freq, q = 0.7) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      return f;
    };
    const gain = (v) => {
      const g = ctx.createGain();
      g.gain.value = v;
      return g;
    };
    const lfo = (rate, depth, target) => {
      const o = ctx.createOscillator();
      o.frequency.value = rate;
      const g = gain(depth);
      o.connect(g).connect(target);
      o.start();
    };

    // Pink noise (softer and more natural than white noise)
    const len = ctx.sampleRate * 4;
    this.pink = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.pink.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
    const noise = (offset = 0) => {
      const s = ctx.createBufferSource();
      s.buffer = this.pink;
      s.loop = true;
      s.start(0, offset);
      return s;
    };

    // ── Rain: a low "wash" plus a lighter patter layer that drifts in gusts ──
    this.rain = gain(0);
    this.rain.connect(this.master);
    noise(0).connect(filt('highpass', 250)).connect(filt('lowpass', 1600)).connect(gain(0.55)).connect(this.rain);
    const patterGain = gain(0.18);
    noise(1.7).connect(filt('bandpass', 3200, 0.6)).connect(patterGain).connect(this.rain);
    lfo(0.07, 0.07, patterGain.gain); // slow gusts

    // ── Warm pad: A-major add9 voicing, sine + soft triangle, breathing ──
    const pad = (freqs, cutoff) => {
      const out = gain(0);
      const lp = filt('lowpass', cutoff, 0.5);
      const breathe = gain(0.7);
      lp.connect(breathe).connect(out);
      lfo(0.08, 0.25, breathe.gain);
      freqs.forEach((f, i) => {
        for (const [type, detune, level] of [['sine', -4, 0.5], ['triangle', 5, 0.18]]) {
          const o = ctx.createOscillator();
          o.type = type;
          o.frequency.value = f;
          o.detune.value = detune + i;
          const g = gain(level / freqs.length);
          o.connect(g).connect(lp);
          o.start();
        }
      });
      out.connect(this.master);
      return { out, lp };
    };
    this.portalPad = pad([110, 164.81, 220, 246.94, 277.18, 329.63], 900);
    this.cityPad = pad([73.42, 110, 146.83, 185, 220], 500); // D-major, darker & lower
    // a faint high shimmer that only lives in the portal
    this.shimmer = gain(0);
    const sh = ctx.createOscillator();
    sh.frequency.value = 659.25;
    const shTrem = gain(0.5);
    sh.connect(shTrem).connect(this.shimmer).connect(this.master);
    lfo(0.3, 0.5, shTrem.gain);
    sh.start();

    this.sfx = gain(0.35);
    this.sfx.connect(this.master);

    this._applyMix(true);
    this._scheduleThunder();
  }

  toggle(force) {
    if (!this.ctx) this._init();
    this.enabled = force ?? !this.enabled;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    // gentle 1.5s fade in, quicker fade out
    this.master.gain.setTargetAtTime(this.enabled ? this.volume : 0, t, this.enabled ? 0.5 : 0.15);
    if (this.music) {
      if (this.enabled) this.music.show();
      else this.music.hide();
    }
    this._applyMix(false);
    this.onStatus?.(this.enabled ? 'on' : 'off');
    return this.enabled;
  }

  setVolume(v) {
    this.volume = v * v; // squared curve feels even to the ear
    if (this.ctx && this.enabled) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    this.music?.setVolume(v * 80); // YouTube volume 0..100; 100% slider = 80
  }

  // city: 0 = portal dimension, 1 = city. warp: 0..1 while diving through the portal.
  setMix(city, warp = 0) {
    this.music?.setDuck(1 - Math.min(1, warp * 1.3) * 0.55); // dip the song while diving through the portal
    if (city === this._city && Math.abs(warp - this._warp) < 0.02) return;
    this._city = city;
    this._warp = warp;
    this._applyMix(false);
  }

  _applyMix(immediate) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const k = immediate ? 0.01 : 0.6;
    const c = this._city, w = this._warp;
    // with the song playing, the pads step aside and the rain becomes a quiet bed
    const bed = this.songPlaying ? 0 : 1;
    const rain = this.songPlaying ? 0.35 : 1;
    this.portalPad.out.gain.setTargetAtTime(bed * (1 - c) * (0.85 + w * 0.35), t, k);
    this.portalPad.lp.frequency.setTargetAtTime(900 + w * 1800, t, 0.3); // the pad opens up as you dive in
    this.shimmer.gain.setTargetAtTime(bed * (1 - c) * (0.02 + w * 0.03), t, k);
    this.cityPad.out.gain.setTargetAtTime(bed * c * 0.45, t, k * 2);
    this.rain.gain.setTargetAtTime(rain * c * 1.3, t, k * 2);
  }

  // a soft, distant rumble every so often while in the city
  _scheduleThunder() {
    setTimeout(() => {
      if (this.enabled && this._city > 0.5) this._burst({ type: 'lowpass', from: 220, to: 50, dur: 3.5, gain: 0.25, q: 0.4, attack: 0.6 });
      this._scheduleThunder();
    }, 14000 + Math.random() * 16000);
  }

  _burst({ type = 'bandpass', from, to, dur, gain = 0.3, q = 4, attack = 0.01 }) {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.pink;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t, Math.random() * 2);
    src.stop(t + dur + 0.05);
  }

  thwip() {
    this._burst({ from: 3200, to: 800, dur: 0.14, gain: 0.35, q: 2 });
  }
  whoosh() {
    this._burst({ from: 250, to: 2200, dur: 1.0, gain: 0.3, q: 1, attack: 0.3 });
  }
  impact() {
    this._burst({ type: 'lowpass', from: 600, to: 60, dur: 0.6, gain: 0.5, q: 0.7 });
    if (!this.enabled) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    o.frequency.setValueAtTime(80, t);
    o.frequency.exponentialRampToValueAtTime(35, t + 0.4);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + 0.55);
  }
}
