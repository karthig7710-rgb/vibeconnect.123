// Funny face filters, drawn with the canvas. Everything is vector shapes: no image files to download.
// Local coordinates: origin between the eyes, x to the right, y down, 1 unit = the distance between the eyes.

function local(ctx, f, fn) {
  ctx.save();
  ctx.translate(f.mid.x, f.mid.y);
  ctx.rotate(f.roll);
  ctx.scale(f.eyeDist, f.eyeDist);
  fn();
  ctx.restore();
}
const toLocal = (f, p) => {
  const dx = p.x - f.mid.x, dy = p.y - f.mid.y, c = Math.cos(-f.roll), s = Math.sin(-f.roll);
  return { x: (dx * c - dy * s) / f.eyeDist, y: (dx * s + dy * c) / f.eyeDist };
};
const ellipse = (ctx, x, y, rx, ry, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); };

// Magnify a circular area (used for the big-eyes effect).
function magnify(ctx, src, p, radius, zoom) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.clip();
  const r = radius / zoom;
  ctx.drawImage(src, p.x - r, p.y - r, r * 2, r * 2, p.x - radius, p.y - radius, radius * 2, radius * 2);
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.18)';
  ctx.lineWidth = Math.max(1, radius * 0.05);
  ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

const tint = (ctx, w, h, color, mode, alpha = 1) => {
  ctx.save(); ctx.globalCompositeOperation = mode; ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.fillRect(0, 0, w, h); ctx.restore();
};

let small; // reusable low-res canvas for the cartoon look
function cartoon(ctx, src, w, h) {
  const sw = 160, sh = Math.round((h / w) * sw);
  small ||= document.createElement('canvas');
  small.width = sw; small.height = sh;
  const sctx = small.getContext('2d', { willReadFrequently: true });
  sctx.drawImage(src, 0, 0, sw, sh);
  const img = sctx.getImageData(0, 0, sw, sh);
  const d = img.data, lum = new Float32Array(sw * sh);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) lum[j] = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
  for (let y = 1; y < sh - 1; y++) {
    for (let x = 1; x < sw - 1; x++) {
      const j = y * sw + x, i = j * 4;
      const edge = Math.abs(lum[j + 1] - lum[j - 1]) + Math.abs(lum[j + sw] - lum[j - sw]);
      for (let c = 0; c < 3; c++) d[i + c] = Math.min(255, Math.round(d[i + c] / 51) * 51 * 1.12); // 6 colour levels, a bit brighter
      if (edge > 38) { d[i] *= 0.25; d[i + 1] *= 0.25; d[i + 2] *= 0.25; } // ink outline
    }
  }
  sctx.putImageData(img, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.filter = 'saturate(1.5) contrast(1.1)';
  ctx.drawImage(small, 0, 0, w, h);
  ctx.restore();
}

const DRAW = {
  dog(ctx, f, { src }) {
    local(ctx, f, () => {
      for (const s of [-1, 1]) { // floppy ears
        ctx.save(); ctx.translate(s * 1.15, -1.0); ctx.rotate(s * 0.35);
        ctx.fillStyle = '#7a4b2a'; ellipse(ctx, 0, 0.25, 0.42, 0.78); ctx.fill();
        ctx.fillStyle = '#a8703f'; ellipse(ctx, 0, 0.3, 0.26, 0.58); ctx.fill();
        ctx.restore();
      }
      const n = toLocal(f, f.nose);
      ctx.fillStyle = '#1b1b1f'; ellipse(ctx, 0, n.y - 0.02, 0.28, 0.2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ellipse(ctx, -0.08, n.y - 0.09, 0.07, 0.04); ctx.fill();
      if (f.mouthOpen > 0.035) { // tongue
        const m = toLocal(f, f.mouth);
        ctx.fillStyle = '#ff6b8b'; ctx.beginPath(); ctx.roundRect(-0.2, m.y, 0.4, 0.5 + f.mouthOpen * 2, 0.2); ctx.fill();
        ctx.strokeStyle = '#d94468'; ctx.lineWidth = 0.025; ctx.beginPath(); ctx.moveTo(0, m.y + 0.05); ctx.lineTo(0, m.y + 0.4); ctx.stroke();
      }
    });
  },

  cat(ctx, f) {
    local(ctx, f, () => {
      for (const s of [-1, 1]) { // pointy ears
        ctx.fillStyle = '#3b3b45';
        ctx.beginPath(); ctx.moveTo(s * 0.55, -0.95); ctx.lineTo(s * 1.25, -2.0); ctx.lineTo(s * 1.45, -0.7); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ff9fbd';
        ctx.beginPath(); ctx.moveTo(s * 0.75, -1.0); ctx.lineTo(s * 1.2, -1.7); ctx.lineTo(s * 1.32, -0.85); ctx.closePath(); ctx.fill();
      }
      const n = toLocal(f, f.nose);
      ctx.fillStyle = '#ff7aa2';
      ctx.beginPath(); ctx.moveTo(-0.16, n.y - 0.12); ctx.lineTo(0.16, n.y - 0.12); ctx.lineTo(0, n.y + 0.05); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 0.03; ctx.lineCap = 'round';
      for (const s of [-1, 1]) for (const dy of [-0.12, 0, 0.12]) {
        ctx.beginPath(); ctx.moveTo(s * 0.35, n.y + 0.05 + dy * 0.4); ctx.lineTo(s * 1.35, n.y + 0.05 + dy * 2); ctx.stroke();
      }
    });
  },

  bigeyes(ctx, f, { src }) {
    for (const e of [f.leftEye, f.rightEye]) magnify(ctx, src, e, f.eyeDist * 0.5, 1.9);
  },

  baby(ctx, f, { src, w, h }) {
    ctx.save(); ctx.globalAlpha = 0.55; ctx.filter = 'blur(2px) brightness(1.12) saturate(1.1)'; ctx.drawImage(src, 0, 0, w, h); ctx.restore(); // soft skin
    for (const e of [f.leftEye, f.rightEye]) magnify(ctx, src, e, f.eyeDist * 0.42, 1.5);
    local(ctx, f, () => {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.45);
      g.addColorStop(0, 'rgba(255,105,140,.55)'); g.addColorStop(1, 'rgba(255,105,140,0)');
      for (const s of [-1, 1]) { ctx.save(); ctx.translate(s * 0.78, 0.95); ctx.fillStyle = g; ctx.fillRect(-0.5, -0.5, 1, 1); ctx.restore(); } // rosy cheeks
      ctx.fillStyle = '#ffd7e8'; // bonnet
      ctx.beginPath(); ctx.ellipse(0, -0.95, 1.55, 0.95, 0, Math.PI, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffa6cb'; ctx.lineWidth = 0.07; ctx.stroke();
      ctx.fillStyle = '#fff'; ellipse(ctx, 0, -1.95, 0.2, 0.2); ctx.fill();
      const m = toLocal(f, f.mouth); // pacifier
      ctx.fillStyle = '#7fd8ff'; ellipse(ctx, 0, m.y + 0.05, 0.3, 0.2); ctx.fill();
      ctx.fillStyle = '#ffd24a'; ellipse(ctx, 0, m.y + 0.05, 0.12, 0.12); ctx.fill();
    });
  },

  cartoon(ctx, f, { src, w, h }) {
    cartoon(ctx, src, w, h);
    if (f) for (const e of [f.leftEye, f.rightEye]) magnify(ctx, src, e, f.eyeDist * 0.4, 1.35);
  },

  robot(ctx, f, { w, h, t }) {
    tint(ctx, w, h, 'rgb(120,170,215)', 'multiply', 0.75);
    tint(ctx, w, h, 'rgb(90,120,160)', 'overlay', 0.35);
    local(ctx, f, () => {
      ctx.fillStyle = 'rgba(15,22,40,.92)'; ctx.beginPath(); ctx.roundRect(-1.0, -0.34, 2.0, 0.68, 0.22); ctx.fill(); // visor
      ctx.strokeStyle = '#8fb4d8'; ctx.lineWidth = 0.05; ctx.stroke();
      for (const s of [-0.5, 0.5]) {
        const g = ctx.createRadialGradient(s, 0, 0, s, 0, 0.3);
        g.addColorStop(0, '#d9ffff'); g.addColorStop(0.4, '#22d3ee'); g.addColorStop(1, 'rgba(34,211,238,0)');
        ctx.fillStyle = g; ellipse(ctx, s, 0, 0.3, 0.3); ctx.fill();
      }
      ctx.strokeStyle = '#8fb4d8'; ctx.lineWidth = 0.06; ctx.beginPath(); ctx.moveTo(0, -1.05); ctx.lineTo(0, -1.7); ctx.stroke(); // antenna
      ctx.fillStyle = Math.sin(t / 250) > 0 ? '#ff3d5a' : '#7a1f2c'; ellipse(ctx, 0, -1.78, 0.13, 0.13); ctx.fill();
      const m = toLocal(f, f.mouth); // mouth grille
      ctx.fillStyle = 'rgba(20,28,46,.9)'; ctx.beginPath(); ctx.roundRect(-0.45, m.y - 0.1, 0.9, 0.3 + f.mouthOpen * 2, 0.08); ctx.fill();
      ctx.strokeStyle = '#8fb4d8'; ctx.lineWidth = 0.025;
      for (let x = -0.3; x <= 0.31; x += 0.15) { ctx.beginPath(); ctx.moveTo(x, m.y - 0.1); ctx.lineTo(x, m.y + 0.2 + f.mouthOpen * 2); ctx.stroke(); }
      for (const s of [-1, 1]) { ctx.fillStyle = '#b6cde3'; ellipse(ctx, s * 1.3, 0.2, 0.09, 0.09); ctx.fill(); } // bolts
    });
  },

  alien(ctx, f, { w, h, t }) {
    tint(ctx, w, h, 'rgb(130,255,150)', 'multiply', 0.65);
    tint(ctx, w, h, 'rgb(40,160,80)', 'overlay', 0.25);
    local(ctx, f, () => {
      for (const s of [-1, 1]) { // antennae
        ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(s * 0.4, -1.1); ctx.quadraticCurveTo(s * 0.9, -1.8, s * 0.9 + Math.sin(t / 400) * 0.1, -2.2); ctx.stroke();
        ctx.fillStyle = '#d9f99d'; ellipse(ctx, s * 0.9 + Math.sin(t / 400) * 0.1, -2.25, 0.13, 0.13); ctx.fill();
      }
      for (const s of [-0.5, 0.5]) { // big black eyes
        ctx.save(); ctx.translate(s, 0); ctx.rotate(s * -0.5);
        ctx.fillStyle = '#05080a'; ellipse(ctx, 0, 0.02, 0.5, 0.3); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.8)'; ellipse(ctx, -0.14, -0.1, 0.1, 0.06); ctx.fill();
        ctx.restore();
      }
    });
  },
};

export const needsFace = (id) => id !== 'cartoon' && id !== 'none';

// Draw one processed frame. `face` may be null (cartoon works without one).
export function drawFilter(id, ctx, src, w, h, face, t) {
  ctx.drawImage(src, 0, 0, w, h);
  const fn = DRAW[id];
  if (!fn) return;
  if (!face && needsFace(id)) return;
  fn(ctx, face, { src, w, h, t });
}
