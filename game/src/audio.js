// Port Aurora — sound, synthesized live with WebAudio: no audio files at all.
// One job: every beep, shot, siren and bass note the game plays.
export function createAudio() {
  let ctx = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenTimer = 0;
  let musicTimer = 0;
  let musicStep = 0;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, gainValue, slideTo) {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + dur);
    gain.gain.setValueAtTime(gainValue || 0.08, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + dur + 0.02);
  }

  function noise(dur, gainValue, lowpass) {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    const len = Math.floor(ac.sampleRate * dur);
    const buffer = ac.createBuffer(1, len, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass || 1200;
    const gain = ac.createGain();
    gain.gain.value = gainValue || 0.15;
    src.connect(filter).connect(gain).connect(ac.destination);
    src.start();
  }

  // A two-note police siren that wails while the player is wanted.
  function updateSiren(dt, wanted) {
    if (muted || wanted <= 0) {
      if (engineOsc) { try { engineOsc.stop(); } catch { /* already stopped */ } engineOsc = null; }
      return;
    }
    sirenTimer -= dt;
    if (sirenTimer <= 0) {
      sirenTimer = 0.42;
      const ac = ensure();
      if (!ac) return;
      tone(880, 0.4, 'sine', 0.035, 660);
      tone(660, 0.4, 'sine', 0.035, 880);
    }
  }

  // A low engine hum whose pitch follows the car's speed.
  function updateEngine(dt, speedRatio, driving) {
    if (muted || !driving) {
      if (engineOsc) { try { engineOsc.stop(); } catch { /* already stopped */ } engineOsc = null; }
      return;
    }
    const ac = ensure();
    if (!ac) return;
    if (!engineOsc) {
      engineOsc = ac.createOscillator();
      engineGain = ac.createGain();
      engineOsc.type = 'sawtooth';
      engineGain.gain.value = 0.025;
      engineOsc.connect(engineGain).connect(ac.destination);
      engineOsc.start();
    }
    engineOsc.frequency.setValueAtTime(55 + speedRatio * 130, ac.currentTime);
  }

  // A tiny bassline loop: A minor, four bars, one note a beat.
  const BASSLINE = [55, 0, 55, 65.41, 55, 0, 49, 55, 55, 0, 55, 65.41, 82.41, 73.42, 65.41, 49];
  function updateMusic(dt, playing) {
    if (muted || !playing) return;
    musicTimer -= dt;
    if (musicTimer <= 0) {
      musicTimer = 0.31;
      const note = BASSLINE[musicStep % BASSLINE.length];
      musicStep++;
      if (note > 0) tone(note, 0.28, 'triangle', 0.05);
      if (musicStep % 4 === 1) tone(220, 0.12, 'sine', 0.02);
    }
  }

  return {
    unlock() { ensure(); },
    setMuted(m) {
      muted = m;
      if (muted && engineOsc) { try { engineOsc.stop(); } catch { /* already stopped */ } engineOsc = null; }
    },
    isMuted() { return muted; },
    click() { tone(660, 0.06, 'square', 0.05); },
    pickup() { tone(523, 0.09, 'sine', 0.09); tone(784, 0.14, 'sine', 0.09); },
    cash() { tone(880, 0.1, 'sine', 0.09); tone(1174, 0.18, 'sine', 0.09); },
    missionDone() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.09), i * 110)); },
    missionFail() { tone(220, 0.35, 'sawtooth', 0.08, 110); },
    gunshot() { noise(0.12, 0.22, 2400); tone(180, 0.08, 'square', 0.06, 60); },
    crash() { noise(0.25, 0.2, 700); tone(90, 0.2, 'sawtooth', 0.1, 40); },
    horn() { tone(370, 0.22, 'square', 0.05); tone(466, 0.22, 'square', 0.04); },
    sirenBlip() { tone(990, 0.12, 'sine', 0.05, 740); },
    busted() { tone(440, 0.5, 'sawtooth', 0.09, 110); },
    wasted() { tone(330, 0.7, 'sawtooth', 0.09, 55); },
    update(dt, state) {
      updateSiren(dt, state.wanted);
      updateEngine(dt, state.speedRatio || 0, state.driving);
      updateMusic(dt, state.playing);
    },
  };
}
