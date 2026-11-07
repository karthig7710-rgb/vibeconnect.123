/* Real-time voice changer (AudioWorklet). Loaded from the same origin, so it works under the app's CSP.
   Pitch: two crossfading delay-line read heads. Robot/Monster: ring modulation. Cartoon: pitch + vibrato. */
class VoiceProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.N = 16384; // delay buffer (power of two)
    this.buf = new Float32Array(this.N);
    this.w = 0;
    this.phase = 0;
    this.win = Math.round(0.05 * sampleRate); // 50 ms window, about 25 ms latency
    this.ratio = 1;
    this.ring = 0; // ring-mod depth 0..1
    this.ringHz = 50;
    this.vib = 0; // vibrato depth (ratio units)
    this.drive = 0; // soft-clip amount
    this.t = 0;
    this.port.onmessage = (e) => {
      const m = e.data || {};
      for (const k of ['ratio', 'ring', 'ringHz', 'vib', 'drive']) if (typeof m[k] === 'number') this[k] = m[k];
    };
  }

  read(pos) {
    const N = this.N;
    const i = Math.floor(pos);
    const f = pos - i;
    const a = this.buf[((i % N) + N) % N];
    const b = this.buf[(((i + 1) % N) + N) % N];
    return a + (b - a) * f;
  }

  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    const out = outputs[0];
    if (!out?.length) return true;
    const o = out[0];
    const W = this.win;
    for (let n = 0; n < o.length; n++) {
      const x = input ? input[n] : 0;
      this.buf[this.w] = x;
      let ratio = this.ratio;
      if (this.vib) ratio += this.vib * Math.sin((2 * Math.PI * 6 * this.t) / sampleRate);
      this.phase += (1 - ratio) / W;
      this.phase -= Math.floor(this.phase);
      const p2 = (this.phase + 0.5) % 1;
      const g1 = 0.5 - 0.5 * Math.cos(2 * Math.PI * this.phase);
      const g2 = 0.5 - 0.5 * Math.cos(2 * Math.PI * p2);
      let y = this.read(this.w - this.phase * W) * g1 + this.read(this.w - p2 * W) * g2;
      if (this.ring) y *= 1 - this.ring + this.ring * Math.sin((2 * Math.PI * this.ringHz * this.t) / sampleRate);
      if (this.drive) y = Math.tanh(y * (1 + this.drive * 4)) / Math.tanh(1 + this.drive * 4);
      o[n] = y;
      this.w = (this.w + 1) % this.N;
      this.t++;
    }
    for (let c = 1; c < out.length; c++) out[c].set(o);
    return true;
  }
}
registerProcessor('voice-processor', VoiceProcessor);
