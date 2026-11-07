import { VOICE_LIST } from '../catalog.js';
import { drawFilter, needsFace } from './filters.js';
import { loadFaceLandmarker, faceFromLandmarks, guessFace } from './face.js';

const VOICE_PARAMS = Object.fromEntries(VOICE_LIST.map((v) => [v.id, v.params]));

// Everything this device sends in a call: microphone (optionally voice-changed) and camera (optionally filtered).
// With no effect chosen the raw camera/mic tracks are sent untouched (cheapest, best quality).
export class LocalMedia {
  constructor({ video, onAudioTrack, onVideoTrack, onFaceStatus }) {
    this.wantVideo = video;
    this.onAudioTrack = onAudioTrack || (() => {});
    this.onVideoTrack = onVideoTrack || (() => {});
    this.onFaceStatus = onFaceStatus || (() => {});
    this.facing = 'user';
    this.voice = 'normal';
    this.filter = 'none';
    this.muted = false;
    this.camOff = false;
    this.rawAudio = null;
    this.rawVideo = null;
    this.audioTrack = null; // what is currently sent
    this.videoTrack = null;
    this.stopped = false;
  }

  async start() {
    const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    const video = { facingMode: this.facing, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } };
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio, video: this.wantVideo ? video : false });
    } catch (e) {
      // Camera missing or used by another app/window (common when testing on one PC): carry on with voice only.
      if (!this.wantVideo || e?.name === 'NotAllowedError' || e?.name === 'SecurityError') throw e;
      stream = await navigator.mediaDevices.getUserMedia({ audio });
      this.cameraError = e?.name || 'Error';
    }
    this.rawAudio = stream.getAudioTracks()[0];
    this.rawVideo = stream.getVideoTracks()[0] || null;
    this.audioTrack = this.rawAudio;
    this.videoTrack = this.rawVideo;
    return this;
  }

  // ---------- audio ----------
  async setVoice(id) {
    if (this.stopped || !this.rawAudio) return false;
    this.voice = id;
    if (id === 'normal') {
      this._swapAudio(this.rawAudio);
      return true;
    }
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        const ctx = new AC({ latencyHint: 'interactive' });
        await ctx.audioWorklet.addModule('/voice-worklet.js');
        this.ctx = ctx;
        this.src = ctx.createMediaStreamSource(new MediaStream([this.rawAudio]));
        this.node = new AudioWorkletNode(ctx, 'voice-processor', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
        this.dest = ctx.createMediaStreamDestination();
        this.src.connect(this.node);
        this.node.connect(this.dest);
      }
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      this.node.port.postMessage({ ratio: 1, ring: 0, ringHz: 50, vib: 0, drive: 0, ...VOICE_PARAMS[id] });
      this._swapAudio(this.dest.stream.getAudioTracks()[0]);
      return true;
    } catch {
      this.voice = 'normal';
      this._swapAudio(this.rawAudio);
      return false; // browser has no AudioWorklet
    }
  }
  _swapAudio(track) {
    track.enabled = !this.muted;
    if (track !== this.audioTrack) { this.audioTrack = track; this.onAudioTrack(track); }
  }
  setMuted(m) {
    this.muted = m;
    if (this.audioTrack) this.audioTrack.enabled = !m;
  }

  // ---------- video ----------
  setCamOff(off) {
    this.camOff = off;
    if (this.videoTrack) this.videoTrack.enabled = !off;
  }
  async setFilter(id) {
    if (this.stopped || !this.rawVideo) return false;
    this.filter = id;
    if (id === 'none') {
      this._stopLoop();
      this._swapVideo(this.rawVideo);
      return true;
    }
    this._startLoop();
    if (needsFace(id) && !this.landmarker && !this.faceFailed) {
      this.onFaceStatus('loading');
      loadFaceLandmarker()
        .then((l) => { this.landmarker = l; this.onFaceStatus('ready'); })
        .catch(() => { this.faceFailed = true; this.onFaceStatus('failed'); });
    }
    return true;
  }
  _swapVideo(track) {
    track.enabled = !this.camOff;
    if (track !== this.videoTrack) { this.videoTrack = track; this.onVideoTrack(track); }
  }

  _startLoop() {
    if (this.looping) return;
    this.looping = true;
    const v = (this.hidden = document.createElement('video'));
    v.muted = true; v.playsInline = true; v.srcObject = new MediaStream([this.rawVideo]);
    v.play().catch(() => {});
    const canvas = (this.canvas = document.createElement('canvas'));
    const ctx = canvas.getContext('2d');
    this.canvasTrack = null;
    let frame = 0, face = null, faceAt = 0, lastTs = 0;

    const tick = (now) => {
      if (!this.looping) return;
      this.raf = requestAnimationFrame(tick);
      if (v.readyState < 2 || !v.videoWidth) return;
      const scale = Math.min(1, 640 / v.videoWidth);
      const w = Math.round(v.videoWidth * scale), h = Math.round(v.videoHeight * scale);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      if (!this.canvasTrack) {
        this.canvasTrack = canvas.captureStream(24).getVideoTracks()[0];
        this._swapVideo(this.canvasTrack);
      }
      // track the face about 12 times a second; keep the last result in between
      if (needsFace(this.filter) && frame++ % 2 === 0) {
        if (this.landmarker) {
          const ts = Math.max(now, lastTs + 1);
          lastTs = ts;
          try {
            const r = this.landmarker.detectForVideo(v, ts);
            if (r.faceLandmarks?.[0]) { face = faceFromLandmarks(r.faceLandmarks[0], w, h); faceAt = now; }
          } catch { /* skip this frame */ }
        } else if (this.faceFailed) {
          face = guessFace(w, h); faceAt = now;
        }
      }
      const fresh = face && now - faceAt < 600 ? face : null;
      drawFilter(this.filter, ctx, v, w, h, fresh, now);
    };
    this.raf = requestAnimationFrame(tick);
  }
  _stopLoop() {
    this.looping = false;
    cancelAnimationFrame(this.raf);
    this.canvasTrack?.stop();
    this.canvasTrack = null;
    if (this.hidden) { this.hidden.srcObject = null; this.hidden = null; }
  }

  async switchCamera() {
    if (!this.rawVideo) return;
    const next = this.facing === 'user' ? 'environment' : 'user';
    const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: next, width: { ideal: 640 }, height: { ideal: 480 } } });
    const track = s.getVideoTracks()[0];
    this.facing = next;
    const old = this.rawVideo;
    this.rawVideo = track;
    if (this.looping) this.hidden.srcObject = new MediaStream([track]);
    else this._swapVideo(track);
    old.stop();
  }

  stop() {
    this.stopped = true;
    this._stopLoop();
    this.rawAudio?.stop();
    this.rawVideo?.stop();
    this.dest?.stream.getTracks().forEach((t) => t.stop());
    this.ctx?.close().catch(() => {});
  }
}
