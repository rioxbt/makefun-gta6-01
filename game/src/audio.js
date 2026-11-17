// Sound, made rather than loaded: every effect is a few oscillators and a noise buffer built on
// the fly, so the game ships no audio files and still reports itself. The engine hum follows the
// car, the siren follows the chase, and everything else is one short burst.

const NOTES = { mission: [523, 659, 784, 1046], fail: [392, 330, 262], pickup: [880, 1320], busted: [294, 262, 233] };

export class SoundBoard {
  constructor() {
    this.muted = false;
    this.ready = false;
    this.engine = null;
    this.siren = null;
    this.noise = null;
    this.context = null;
  }

  /** Open the audio device. Browsers want this from a gesture, so it is called on the first click. */
  start() {
    if (this.ready) return;
    try {
      const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContextClass) return;
      this.context = new AudioContextClass();
      const length = Math.floor(this.context.sampleRate * 0.6);
      const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;
      this.noise = buffer;
      this.ready = true;
    } catch (error) {
      this.ready = false;
      void error;
    }
  }

  /** A short tone with an envelope: the basis of most of the game's noise. */
  tone(frequency, duration, type = 'square', gain = 0.12, slideTo = null) {
    if (!this.ready || this.muted) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const volume = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), now + duration);
    volume.gain.setValueAtTime(0.0001, now);
    volume.gain.exponentialRampToValueAtTime(gain, now + 0.012);
    volume.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(volume).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  /** Filtered noise: shots, thuds, skids and explosions. */
  burst(duration, gain, filterHz, type = 'bandpass') {
    if (!this.ready || this.muted || !this.noise) return;
    const now = this.context.currentTime;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const volume = this.context.createGain();
    source.buffer = this.noise;
    filter.type = type;
    filter.frequency.setValueAtTime(filterHz, now);
    volume.gain.setValueAtTime(gain, now);
    volume.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter).connect(volume).connect(this.context.destination);
    source.start(now);
    source.stop(now + duration + 0.02);
  }

  /** Play one named effect at a volume set by how far off it happened. */
  play(name, distance = 0) {
    if (!this.ready || this.muted) return;
    const falloff = Math.max(0, 1 - distance / 1400);
    if (falloff <= 0.02) return;
    if (name === 'shot') this.burst(0.16, 0.24 * falloff, 1100);
    else if (name === 'cop_shot') this.burst(0.12, 0.14 * falloff, 900);
    else if (name === 'thud') this.burst(0.12, 0.18 * falloff, 180, 'lowpass');
    else if (name === 'sparks') this.burst(0.09, 0.12 * falloff, 3200, 'highpass');
    else if (name === 'explosion') {
      this.burst(0.8, 0.3 * falloff, 260, 'lowpass');
      this.tone(70, 0.7, 'sawtooth', 0.22 * falloff, 40);
    } else if (name === 'door') this.burst(0.08, 0.14 * falloff, 600);
    else if (name === 'horn') this.tone(320, 0.28, 'square', 0.09 * falloff);
    else if (name === 'pickup') {
      for (const [index, frequency] of NOTES.pickup.entries()) setTimeout(() => this.tone(frequency, 0.12, 'triangle', 0.1), index * 70);
    } else if (name === 'mission') {
      for (const [index, frequency] of NOTES.mission.entries()) setTimeout(() => this.tone(frequency, 0.22, 'triangle', 0.11), index * 110);
    } else if (name === 'fail') {
      for (const [index, frequency] of NOTES.fail.entries()) setTimeout(() => this.tone(frequency, 0.26, 'sawtooth', 0.09), index * 140);
    } else if (name === 'busted' || name === 'wasted') {
      for (const [index, frequency] of NOTES.busted.entries()) setTimeout(() => this.tone(frequency, 0.32, 'square', 0.1), index * 160);
    } else if (name === 'alarm') this.tone(880, 0.5, 'square', 0.07, 440);
  }

  /** The engine hum: a low saw whose pitch follows the car, or nothing when the player is walking. */
  setEngine(active, speed) {
    if (!this.ready) return;
    if (!active || this.muted) {
      if (this.engine) {
        this.engine.gain.gain.value = 0;
      }
      return;
    }
    if (!this.engine) {
      const now = this.context.currentTime;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      const filter = this.context.createBiquadFilter();
      oscillator.type = 'sawtooth';
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      gain.gain.value = 0;
      oscillator.connect(filter).connect(gain).connect(this.context.destination);
      oscillator.start(now);
      this.engine = { oscillator, gain, filter };
    }
    const target = 60 + Math.min(200, Math.abs(speed) * 0.7);
    this.engine.oscillator.frequency.value = 46 + Math.min(90, Math.abs(speed) * 0.3);
    this.engine.filter.frequency.value = 320 + Math.min(700, Math.abs(speed) * 2.4);
    this.engine.gain.gain.value = Math.min(0.06, 0.012 + Math.abs(speed) / 4000);
    void target;
  }

  /** The two-tone siren while a chase is on. */
  setSiren(active) {
    if (!this.ready) return;
    if (!active || this.muted) {
      if (this.siren) this.siren.gain.gain.value = 0;
      return;
    }
    if (!this.siren) {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = 'sine';
      gain.gain.value = 0.03;
      oscillator.connect(gain).connect(this.context.destination);
      oscillator.start();
      this.siren = { oscillator, gain };
    }
    this.siren.oscillator.frequency.value = 700 + Math.sin(this.context.currentTime * 6) * 260;
    this.siren.gain.gain.value = 0.028;
  }

  /** Drain what the world asked for this step, and follow the car and the chase. */
  update(world) {
    if (!this.ready) return;
    for (const sound of world.sounds) {
      const distance = Math.hypot((sound.x ?? 0) - world.camera.x, (sound.y ?? 0) - world.camera.y);
      this.play(sound.name, distance);
    }
    world.sounds.length = 0;
    this.setEngine(world.playerInVehicle && !!world.vehicle, world.vehicle ? world.vehicle.speed : 0);
    this.setSiren(world.stars > 0);
  }

  toggle() {
    this.muted = !this.muted;
    if (this.muted) {
      this.setEngine(false, 0);
      this.setSiren(false);
    }
    return this.muted;
  }
}
