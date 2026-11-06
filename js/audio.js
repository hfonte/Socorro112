// MOTOR DE ÁUDIO, METRÓNOMO E VOZ (WEB AUDIO API + WAKE LOCK)
const AudioManager = {
  audioCtx: null,
  metroInterval: null,
  nextTick: 0,
  bpm: 110,
  voiceEnabled: true,
  wakeLock: null,

  initContext() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    // Desbloqueia hardware mobile
    try {
      const buffer = this.audioCtx.createBuffer(1, 1, 22050);
      const source = this.audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioCtx.destination);
      source.start(0);
    } catch (_) {}
  },

  async requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        this.wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch (_) {}
  },

  releaseWakeLock() {
    if (this.wakeLock) {
      this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
    }
  },

  playTick(time) {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    // Som agudo e penetrante para altifalantes de smartphone
    osc.type = 'square';
    osc.frequency.setValueAtTime(1080, time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(0.4, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.055);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(time);
    osc.stop(time + 0.065);

    // Feedback háptico (vibração no telemóvel para sentir o ritmo)
    if ('vibrate' in navigator) {
      try { navigator.vibrate(35); } catch (_) {}
    }
  },

  schedule() {
    if (!this.audioCtx) return;
    while (this.nextTick < this.audioCtx.currentTime + 0.1) {
      this.playTick(this.nextTick);
      if (typeof window.onBeatTick === 'function') {
        window.onBeatTick();
      }
      this.nextTick += 60 / this.bpm;
    }
  },

  startMetronome() {
    this.initContext();
    this.requestWakeLock();
    this.nextTick = this.audioCtx.currentTime + 0.05;
    this.schedule();
    if (this.metroInterval) clearInterval(this.metroInterval);
    this.metroInterval = setInterval(() => this.schedule(), 30);
  },

  stopMetronome() {
    if (this.metroInterval) {
      clearInterval(this.metroInterval);
      this.metroInterval = null;
    }
    this.releaseWakeLock();
  },

  speak(text) {
    if (!this.voiceEnabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-PT';
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
  },

  playChime() {
    this.initContext();
    if (!this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, idx) => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);
      gain.gain.setValueAtTime(0.001, now + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.3, now + idx * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.35);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.4);
    });
    if ('vibrate' in navigator) {
      try { navigator.vibrate([100, 50, 100]); } catch (_) {}
    }
  },

  playAlarmTone() {
    this.initContext();
    if (!this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.22;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.18);
    }
    if ('vibrate' in navigator) {
      try { navigator.vibrate([200, 100, 200]); } catch (_) {}
    }
  }
};

window.AudioManager = AudioManager;
