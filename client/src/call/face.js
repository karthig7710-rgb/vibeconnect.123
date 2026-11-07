// Face tracking for the filters, using MediaPipe Face Landmarker. It is downloaded only when someone
// picks a filter (about 4 MB) and runs in the browser: video never leaves the device for this.
const VERSION = '0.10.14';
const BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

let loading = null;
export function loadFaceLandmarker() {
  if (!loading) {
    loading = (async () => {
      const mod = await import(/* @vite-ignore */ `${BASE}/vision_bundle.mjs`);
      const files = await mod.FilesetResolver.forVisionTasks(`${BASE}/wasm`);
      const make = (delegate) =>
        mod.FaceLandmarker.createFromOptions(files, {
          baseOptions: { modelAssetPath: MODEL, delegate },
          runningMode: 'VIDEO',
          numFaces: 1,
        });
      try { return await make('GPU'); } catch { return make('CPU'); }
    })().catch((e) => { loading = null; throw e; });
  }
  return loading;
}

const avg = (pts) => ({ x: pts.reduce((a, p) => a + p.x, 0) / pts.length, y: pts.reduce((a, p) => a + p.y, 0) / pts.length });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Turn the 468 landmarks into the few points the filters need (pixel coordinates).
export function faceFromLandmarks(lm, w, h) {
  const p = (i) => ({ x: lm[i].x * w, y: lm[i].y * h });
  const leftEye = avg([p(33), p(133), p(159), p(145)]);
  const rightEye = avg([p(263), p(362), p(386), p(374)]);
  const eyeDist = dist(leftEye, rightEye);
  const top = p(10), chin = p(152), nose = p(1);
  const mouth = avg([p(13), p(14)]);
  return {
    leftEye, rightEye, eyeDist, top, chin, nose, mouth,
    mid: avg([leftEye, rightEye]),
    roll: Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x),
    mouthOpen: dist(p(13), p(14)) / Math.max(dist(top, chin), 1),
    cheekL: p(50), cheekR: p(280),
  };
}

// Used when tracking is unavailable: a sensible face in the middle of the frame.
export function guessFace(w, h) {
  const eyeDist = h * 0.2;
  const mid = { x: w / 2, y: h * 0.42 };
  return {
    leftEye: { x: mid.x - eyeDist / 2, y: mid.y }, rightEye: { x: mid.x + eyeDist / 2, y: mid.y }, eyeDist, mid,
    top: { x: mid.x, y: mid.y - eyeDist * 1.3 }, chin: { x: mid.x, y: mid.y + eyeDist * 2 },
    nose: { x: mid.x, y: mid.y + eyeDist * 0.8 }, mouth: { x: mid.x, y: mid.y + eyeDist * 1.35 },
    roll: 0, mouthOpen: 0, cheekL: { x: mid.x - eyeDist * 0.9, y: mid.y + eyeDist }, cheekR: { x: mid.x + eyeDist * 0.9, y: mid.y + eyeDist },
  };
}
