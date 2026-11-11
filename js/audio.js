// GESTOR DE BLOQUEIO DE ECRÃ (WAKE LOCK API - RESILIENTE A MUDANÇAS DE ABA/APP)
const WakeLockManager = {
  lock: null,
  isActive: false,

  async acquire() {
    this.isActive = true;
    if (!('wakeLock' in navigator)) return false;
    try {
      if (!this.lock) {
        this.lock = await navigator.wakeLock.request('screen');
        this.lock.addEventListener('release', () => {
          this.lock = null;
        });
        this.updateBadge(true);
        return true;
      }
    } catch (_) {
      // Ignora falha em modo de poupança extrema de bateria
    }
    return false;
  },

  release() {
    this.isActive = false;
    if (this.lock) {
      this.lock.release().catch(() => {});
      this.lock = null;
    }
    this.updateBadge(false);
  },

  updateBadge(active) {
    document.querySelectorAll('.wake-lock-indicator').forEach(el => {
      if (active) {
        el.classList.remove('hidden');
        const label = (typeof window.t === 'function') ? window.t('Ecrã Sempre Ativo', 'Screen Always Active') : 'Ecrã Sempre Ativo';
        el.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block mr-1"></span> ${label}`;
        el.classList.add('text-emerald-400');
        el.classList.remove('text-slate-500');
      } else {
        el.classList.add('hidden');
      }
    });
  },

  init() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible' && this.isActive) {
          await this.acquire();
        }
      });
    }
  }
};

WakeLockManager.init();
window.WakeLockManager = WakeLockManager;

// MOTOR DE ÁUDIO, METRÓNOMO E VOZ (WEB AUDIO API + WAKE LOCK)
const AudioManager = {
  audioCtx: null,
  metroInterval: null,
  nextTick: 0,
  bpm: 110,
  voiceEnabled: true,
  isVentilating: false,
  ventilationTimerIds: [],

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
    return WakeLockManager.acquire();
  },

  releaseWakeLock() {
    WakeLockManager.release();
  },

  // 1. Clique penetrante de compressão torácica (110 bpm)
  playTick(time) {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(1080, time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(0.4, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.055);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(time);
    osc.stop(time + 0.065);
  },

  // 2. Tom distintivo da 30ª compressão (marca fim do ciclo)
  playBeatThirty(time) {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1450, time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(0.5, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(time);
    osc.stop(time + 0.13);
  },

  // 3. Som de insuflação de ar suave e contínuo durante 1 segundo
  playVentilationTone(time) {
    if (!this.audioCtx) return;
    const now = time || this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(450, now + 0.85);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.15);
    gain.gain.setValueAtTime(0.25, now + 0.75);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.98);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(now);
    osc.stop(now + 1.0);
  },

  // 4. Bip duplo enérgico para retomar compressões após as insuflações
  playResumeTone(time) {
    if (!this.audioCtx) return;
    const now = time || this.audioCtx.currentTime;
    [880, 1174].forEach((freq, idx) => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);

      gain.gain.setValueAtTime(0.001, now + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.4, now + idx * 0.12 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.09);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.1);
    });
  },

  // Sequência de Insuflações (máximo 4 a 5 segundos de pausa segundo o ERC 2025)
  triggerVentilation(onStep, onComplete) {
    this.cancelVentilation();
    this.isVentilating = true;
    this.initContext();

    // Insuflação 1: Inicia aos 300ms e dura 1 segundo
    const t1 = setTimeout(() => {
      if (!this.isVentilating) return;
      this.playVentilationTone();
      if (typeof onStep === 'function') onStep(1);
    }, 300);
    this.ventilationTimerIds.push(t1);

    // Insuflação 2: Inicia aos 2000ms e dura 1 segundo
    const t2 = setTimeout(() => {
      if (!this.isVentilating) return;
      this.playVentilationTone();
      if (typeof onStep === 'function') onStep(2);
    }, 2000);
    this.ventilationTimerIds.push(t2);

    // Aviso de retoma de compressões aos 3600ms
    const t3 = setTimeout(() => {
      if (!this.isVentilating) return;
      this.playResumeTone();
      if (typeof onStep === 'function') onStep(3);
    }, 3600);
    this.ventilationTimerIds.push(t3);

    // Fim da pausa e retoma imediata do metrónomo aos 4000ms
    const t4 = setTimeout(() => {
      if (!this.isVentilating) return;
      this.isVentilating = false;
      if (this.audioCtx) {
        this.nextTick = this.audioCtx.currentTime + 0.05;
      }
      if (typeof onComplete === 'function') onComplete();
    }, 4000);
    this.ventilationTimerIds.push(t4);
  },

  cancelVentilation() {
    this.isVentilating = false;
    this.ventilationTimerIds.forEach(id => clearTimeout(id));
    this.ventilationTimerIds = [];
  },

  schedule() {
    if (!this.audioCtx || this.isVentilating) return;

    // Resincroniza o relógio caso tenha ficado desfasado
    if (this.nextTick < this.audioCtx.currentTime - 0.2) {
      this.nextTick = this.audioCtx.currentTime + 0.05;
    }

    while (this.nextTick < this.audioCtx.currentTime + 0.1) {
      if (this.isVentilating) break;

      let isThirty = false;
      if (typeof window.onBeatTick === 'function') {
        const res = window.onBeatTick();
        if (res === 30 || (res && res.isThirty)) {
          isThirty = true;
        }
      }

      if (isThirty) {
        this.playBeatThirty(this.nextTick);
      } else {
        this.playTick(this.nextTick);
      }

      this.nextTick += 60 / this.bpm;
    }
  },

  startMetronome() {
    this.initContext();
    this.requestWakeLock();
    this.cancelVentilation();
    this.nextTick = this.audioCtx.currentTime + 0.05;
    this.schedule();
    if (this.metroInterval) clearInterval(this.metroInterval);
    this.metroInterval = setInterval(() => this.schedule(), 30);
  },

  stopMetronome() {
    this.cancelVentilation();
    if (this.metroInterval) {
      clearInterval(this.metroInterval);
      this.metroInterval = null;
    }
    this.releaseWakeLock();
  },

  speak(text) {
    if (!this.voiceEnabled || !('speechSynthesis' in window)) return;
    try {
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
      }
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = (typeof window !== 'undefined' && window.AppLang === 'en') ? 'en-GB' : 'pt-PT';
      utterance.rate = 1.05;
      utterance.onerror = () => {
        // Fallback silencioso para garantir que não bloqueia o fluxo em Safari / iOS
      };
      window.speechSynthesis.speak(utterance);
    } catch (_) {}
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
  }
};

// Desbloqueio pró-ativo do contexto de áudio em mobile no primeiro toque
if (typeof document !== 'undefined') {
  const unlockMobileAudio = () => {
    AudioManager.initContext();
    document.removeEventListener('touchstart', unlockMobileAudio);
    document.removeEventListener('click', unlockMobileAudio);
  };
  document.addEventListener('touchstart', unlockMobileAudio, { once: true, passive: true });
  document.addEventListener('click', unlockMobileAudio, { once: true });
}

window.AudioManager = AudioManager;
