// WebAudio synth: no audio files, everything is oscillators + filtered noise.
// Created lazily on the first user gesture; muted with M. Engine pitch follows speed,
// the radio plays a quiet synthwave loop, the siren is a two-tone wail.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null; let engineOsc2 = null; let engineGain = null;
  let radioGain = null; let radioTimer = null; let sirenOsc = null; let sirenGain = null;
  let muted = false;
  let radioStep = 0;
  // A minor-key synthwave line: A minor pentatonic-ish, 8th notes at 112 BPM.
  const RADIO_NOTES = [110, 130.81, 164.81, 196, 220, 164.81, 130.81, 98];
  const BASS_NOTES = [55, 55, 65.41, 49];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
      engineOsc2 = ctx.createOscillator(); engineOsc2.type = 'square'; engineOsc2.frequency.value = 27.5;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 700;
      engineOsc.connect(engineFilter); engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain); engineGain.connect(master);
      engineOsc.start(); engineOsc2.start();
      radioGain = ctx.createGain(); radioGain.gain.value = 0.0; radioGain.connect(master);
      sirenOsc = ctx.createOscillator(); sirenOsc.type = 'sine'; sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain); sirenGain.connect(master);
      sirenOsc.start();
      radioTimer = setInterval(() => {
        if (!ctx || ctx.state !== 'running' || muted) return;
        const t = ctx.currentTime;
        const note = RADIO_NOTES[radioStep % RADIO_NOTES.length];
        const bass = BASS_NOTES[Math.floor(radioStep / 2) % BASS_NOTES.length];
        blip(note, t, 0.22, 'triangle', 0.05);
        if (radioStep % 2 === 0) blip(bass, t, 0.4, 'sine', 0.06);
        radioStep += 1;
      }, 268);
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, when, dur, type, vol) {
    if (!ctx) return;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g); g.connect(master);
    o.start(when); o.stop(when + dur + 0.05);
  }

  function noiseBurst(dur, vol, freq) {
    if (!ctx) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
  }

  return {
    unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); },
    setEngine(speedKmh, driving) {
      if (!ctx) return;
      const target = driving ? 0.05 + Math.min(0.12, speedKmh / 900) : 0.0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(45 + speedKmh * 1.6, ctx.currentTime, 0.1);
      engineOsc2.frequency.setTargetAtTime(22 + speedKmh * 0.8, ctx.currentTime, 0.1);
    },
    setSiren(on, near) {
      if (!ctx) return;
      sirenGain.gain.setTargetAtTime(on && !muted ? 0.03 + near * 0.05 : 0, ctx.currentTime, 0.2);
      if (on) sirenOsc.frequency.setTargetAtTime(650 + Math.sin(ctx.currentTime * 4) * 220, ctx.currentTime, 0.05);
    },
    setRadio(on) { if (radioGain) radioGain.gain.setTargetAtTime(on && !muted ? 0.05 : 0, ctx.currentTime, 0.3); },
    gunshot() { noiseBurst(0.14, 0.5, 1800); },
    punch() { noiseBurst(0.08, 0.35, 700); },
    pickup() { if (ctx) blip(880, ctx.currentTime, 0.15, 'sine', 0.12); blip(1320, ctx.currentTime + 0.08, 0.2, 'sine', 0.1); },
    crash() { noiseBurst(0.3, 0.6, 500); },
    mission() { if (!ctx) return; const t = ctx.currentTime; blip(523, t, 0.2, 'triangle', 0.12); blip(659, t + 0.12, 0.2, 'triangle', 0.12); blip(784, t + 0.24, 0.35, 'triangle', 0.14); },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; },
    get muted() { return muted; },
  };
}
