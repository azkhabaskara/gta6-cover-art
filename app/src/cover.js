// Neon Shore Cover Studio — the cover renderer.
//
// Two photos and a caption become a multi-panel GTA-style poster cover:
// bold Anton title, Pacifico script subtitle, a badge ribbon, a Vice City
// sunset / neon gradient-map grade, and print effects (grain, vignette,
// halftone, sun rays, frame). Pure canvas 2D — no network, no libraries.
//
// Everything is drawn from `state` + `photos`, so the editor, the PNG
// export and the screenshots all render through this one function.

export const SIZES = {
  square: { w: 1080, h: 1080, label: '1080 × 1080' },
  portrait: { w: 1080, h: 1350, label: '1080 × 1350' },
  wide: { w: 1920, h: 1080, label: '1920 × 1080' },
};

// A layout is a list of panels in normalised coordinates (fractions of the
// canvas width / height). `tilt` rotates a panel around its own centre;
// panels listed later are drawn on top of the ones before them.
export const LAYOUTS = {
  heroRight: {
    label: 'Hero + three',
    panels: [
      { x: 0.38, y: 0, w: 0.62, h: 1 },
      { x: 0, y: 0, w: 0.38, h: 0.34 },
      { x: 0, y: 0.34, w: 0.38, h: 0.33 },
      { x: 0, y: 0.67, w: 0.38, h: 0.33 },
    ],
  },
  heroLeft: {
    label: 'Three + hero',
    panels: [
      { x: 0, y: 0, w: 0.62, h: 1 },
      { x: 0.62, y: 0, w: 0.38, h: 0.34 },
      { x: 0.62, y: 0.34, w: 0.38, h: 0.33 },
      { x: 0.62, y: 0.67, w: 0.38, h: 0.33 },
    ],
  },
  fourGrid: {
    label: 'Four grid',
    panels: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  nineGrid: {
    label: 'Nine grid',
    panels: [
      { x: 0, y: 0, w: 1 / 3, h: 1 / 3 },
      { x: 1 / 3, y: 0, w: 1 / 3, h: 1 / 3 },
      { x: 2 / 3, y: 0, w: 1 / 3, h: 1 / 3 },
      { x: 0, y: 1 / 3, w: 1 / 3, h: 1 / 3 },
      { x: 1 / 3, y: 1 / 3, w: 1 / 3, h: 1 / 3 },
      { x: 2 / 3, y: 1 / 3, w: 1 / 3, h: 1 / 3 },
      { x: 0, y: 2 / 3, w: 1 / 3, h: 1 / 3 },
      { x: 1 / 3, y: 2 / 3, w: 1 / 3, h: 1 / 3 },
      { x: 2 / 3, y: 2 / 3, w: 1 / 3, h: 1 / 3 },
    ],
  },
  fullBleed: {
    label: 'Full bleed',
    panels: [{ x: 0, y: 0, w: 1, h: 1 }],
  },
  tilted: {
    label: 'Tilted snapshots',
    panels: [
      { x: 0, y: 0, w: 1, h: 1 },
      { x: 0.05, y: 0.58, w: 0.42, h: 0.34, tilt: -5 },
      { x: 0.53, y: 0.62, w: 0.42, h: 0.34, tilt: 4 },
    ],
  },
};

// A grade is a three-stop gradient map (shadow / midtone / highlight) plus
// a translucent wash tint over the photo. Luminance picks the stop.
export const GRADES = {
  viceSunset: {
    label: 'Vice Sunset',
    shadow: [38, 16, 66], mid: [255, 110, 70], high: [255, 214, 130],
    tint: [255, 90, 60, 0.10],
  },
  neonNights: {
    label: 'Neon Nights',
    shadow: [10, 8, 44], mid: [150, 60, 220], high: [90, 240, 255],
    tint: [120, 40, 255, 0.12],
  },
  goldenHour: {
    label: 'Golden Hour',
    shadow: [52, 30, 12], mid: [235, 150, 50], high: [255, 236, 170],
    tint: [255, 170, 60, 0.10],
  },
  hotPink: {
    label: 'Hot Pink',
    shadow: [46, 8, 52], mid: [235, 40, 140], high: [255, 170, 210],
    tint: [255, 40, 150, 0.10],
  },
  tealDusk: {
    label: 'Teal Dusk',
    shadow: [8, 32, 40], mid: [40, 150, 170], high: [190, 250, 230],
    tint: [30, 180, 190, 0.10],
  },
  noirPop: {
    label: 'Noir Pop',
    shadow: [12, 12, 14], mid: [120, 120, 130], high: [255, 250, 240],
    tint: [255, 220, 90, 0.08],
  },
};

export const DEFAULT_PANELS = 9;

export function defaultState() {
  const panels = [];
  for (let i = 0; i < DEFAULT_PANELS; i++) {
    panels.push({ photo: i % 2 === 0 ? 'A' : 'B', zoom: 1, ox: 0, oy: 0 });
  }
  return {
    layout: 'heroRight',
    grade: 'viceSunset',
    size: 'square',
    title: 'NEON SHORE',
    subtitle: 'one last summer',
    badge: 'PALM COAST',
    panels,
    effects: { grain: true, vignette: true, halftone: false, rays: true, frame: true },
  };
}

// --- small helpers ---------------------------------------------------------

// Deterministic PRNG, so the grain is identical on every render and export.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const noiseCache = new Map();
function noisePattern(ctx, w, h) {
  const key = `${w}x${h}`;
  if (noiseCache.has(key)) return noiseCache.get(key);
  const tile = document.createElement('canvas');
  tile.width = 160; tile.height = 160;
  const tctx = tile.getContext('2d');
  const img = tctx.createImageData(160, 160);
  const rnd = mulberry32(20261120);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rnd() * 255);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  tctx.putImageData(img, 0, 0);
  const pattern = ctx.createPattern(tile, 'repeat');
  noiseCache.set(key, pattern);
  return pattern;
}

function lerp(a, b, t) { return a + (b - a) * t; }

// Gradient-map `src` through the grade's three stops, then lay the wash
// tint over it. Returns a fresh canvas.
function gradeCanvas(src, grade) {
  const w = src.width, h = src.height;
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const octx = out.getContext('2d');
  octx.drawImage(src, 0, 0);
  const img = octx.getImageData(0, 0, w, h);
  const d = img.data;
  const [sr, sg, sb] = grade.shadow;
  const [mr, mg, mb] = grade.mid;
  const [hr, hg, hb] = grade.high;
  for (let i = 0; i < d.length; i += 4) {
    const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
    let r, g, b;
    if (lum < 0.5) {
      const t = lum / 0.5;
      r = lerp(sr, mr, t); g = lerp(sg, mg, t); b = lerp(sb, mb, t);
    } else {
      const t = (lum - 0.5) / 0.5;
      r = lerp(mr, hr, t); g = lerp(mg, hg, t); b = lerp(mb, hb, t);
    }
    // Keep a little of the photo's own colour so faces stay readable.
    d[i] = r * 0.72 + d[i] * 0.28;
    d[i + 1] = g * 0.72 + d[i + 1] * 0.28;
    d[i + 2] = b * 0.72 + d[i + 2] * 0.28;
  }
  octx.putImageData(img, 0, 0);
  const [tr, tg, tb, ta] = grade.tint;
  octx.fillStyle = `rgba(${tr},${tg},${tb},${ta})`;
  octx.fillRect(0, 0, w, h);
  return out;
}

// Cover-fit `img` into rect (x, y, w, h) with zoom and pan offsets
// (ox, oy in fractions of the rect size, -0.5..0.5).
function drawPhotoInto(ctx, img, rect, zoom, ox, oy) {
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const scale = base * zoom;
  const pw = img.naturalWidth * scale;
  const ph = img.naturalHeight * scale;
  const cx = rect.x + rect.w / 2 + ox * rect.w;
  const cy = rect.y + rect.h / 2 + oy * rect.h;
  ctx.drawImage(img, cx - pw / 2, cy - ph / 2, pw, ph);
}

function fitFont(ctx, text, maxWidth, startSize, family, weight) {
  let size = startSize;
  ctx.font = `${weight} ${size}px ${family}`;
  while (size > 10 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

// --- the draw --------------------------------------------------------------

/**
 * Draws the cover described by `state` onto `canvas` (already sized to the
 * export size). `photos` is { A: image|null, B: image|null }. `panels` in
 * state are indexed to the layout's panel list; extra entries are ignored
 * when a layout has fewer panels.
 */
export function drawCover(canvas, state, photos) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const layout = LAYOUTS[state.layout] || LAYOUTS.heroRight;
  const grade = GRADES[state.grade] || GRADES.viceSunset;
  const fx = state.effects || {};
  const gutter = Math.max(6, Math.round(W * 0.006));

  ctx.save();
  ctx.fillStyle = '#160a24';
  ctx.fillRect(0, 0, W, H);

  // Panels: draw each photo into an offscreen tile, grade it, composite it.
  layout.panels.forEach((p, i) => {
    const rect = {
      x: p.x * W + gutter / 2,
      y: p.y * H + gutter / 2,
      w: p.w * W - gutter,
      h: p.h * H - gutter,
    };
    const adj = (state.panels && state.panels[i]) || { photo: 'A', zoom: 1, ox: 0, oy: 0 };
    const img = photos[adj.photo] || photos.A || photos.B;
    const tile = document.createElement('canvas');
    tile.width = Math.max(2, Math.round(rect.w));
    tile.height = Math.max(2, Math.round(rect.h));
    const tctx = tile.getContext('2d');
    if (img) {
      drawPhotoInto(tctx, img, { x: 0, y: 0, w: tile.width, h: tile.height }, adj.zoom, adj.ox, adj.oy);
    } else {
      const g = tctx.createLinearGradient(0, 0, tile.width, tile.height);
      g.addColorStop(0, '#3a1c5e'); g.addColorStop(1, '#12081f');
      tctx.fillStyle = g; tctx.fillRect(0, 0, tile.width, tile.height);
    }
    const graded = gradeCanvas(tile, grade);
    ctx.save();
    if (p.tilt) {
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate((p.tilt * Math.PI) / 180);
      ctx.translate(-(rect.x + rect.w / 2), -(rect.y + rect.h / 2));
    }
    ctx.drawImage(graded, rect.x, rect.y, rect.w, rect.h);
    ctx.lineWidth = Math.max(3, W * 0.004);
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  });

  // Sun rays from the top corner, above the photos, below the lettering.
  if (fx.rays) {
    ctx.save();
    ctx.globalAlpha = 0.10;
    ctx.translate(W * 0.12, -H * 0.05);
    for (let k = 0; k < 9; k++) {
      ctx.rotate(Math.PI / 9);
      const grad = ctx.createLinearGradient(0, 0, W * 0.9, 0);
      grad.addColorStop(0, 'rgba(255,230,160,0.9)');
      grad.addColorStop(1, 'rgba(255,230,160,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(W * 0.9, -H * 0.05);
      ctx.lineTo(W * 0.9, H * 0.05);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // Halftone dots across the lower third.
  if (fx.halftone) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    const step = Math.max(10, W * 0.012);
    const y0 = H * 0.66;
    for (let y = y0; y < H; y += step) {
      for (let x = step / 2; x < W; x += step) {
        const r = step * 0.22 * (0.5 + 0.5 * ((y - y0) / (H - y0)));
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // Title block: dark scrim, Anton title, Pacifico subtitle.
  const title = (state.title || '').trim().toUpperCase();
  const subtitle = (state.subtitle || '').trim();
  if (title || subtitle) {
    const bandH = H * 0.24;
    const bandY = H - bandH;
    const scrim = ctx.createLinearGradient(0, bandY - H * 0.06, 0, H);
    scrim.addColorStop(0, 'rgba(10,4,20,0)');
    scrim.addColorStop(1, 'rgba(10,4,20,0.82)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, bandY - H * 0.06, W, bandH + H * 0.06);

    const cx = W / 2;
    let textY = H - H * 0.055;
    if (title) {
      const size = fitFont(ctx, title, W * 0.9, H * 0.115, 'Anton, sans-serif', '400');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.lineWidth = Math.max(3, size * 0.09);
      ctx.strokeStyle = 'rgba(20,4,32,0.9)';
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(255,60,180,0.55)';
      ctx.shadowBlur = size * 0.28;
      ctx.shadowOffsetY = size * 0.04;
      ctx.strokeText(title, cx, textY);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(title, cx, textY);
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      textY -= size * 1.02;
    }
    if (subtitle) {
      const size = fitFont(ctx, subtitle, W * 0.72, H * 0.05, 'Pacifico, cursive', '400');
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd9ec';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = size * 0.3;
      ctx.fillText(subtitle, cx, textY + size * 0.28);
      ctx.shadowBlur = 0;
    }
  }

  // Badge ribbon, top-right: measured first, then placed so the whole
  // rotated ribbon stays inside the canvas with a margin. Nothing is
  // allowed to clip at the edge.
  const badge = (state.badge || '').trim().toUpperCase();
  if (badge) {
    const margin = Math.round(W * 0.022);
    ctx.font = `400 ${Math.round(H * 0.032)}px Anton, sans-serif`;
    const textW = ctx.measureText(badge).width;
    const padX = H * 0.028;
    const ribbonW = textW + padX * 2;
    const ribbonH = H * 0.058;
    const angle = -4 * Math.PI / 180;
    const cos = Math.abs(Math.cos(angle)), sin = Math.abs(Math.sin(angle));
    const bbW = ribbonW * cos + ribbonH * sin;
    const bbH = ribbonW * sin + ribbonH * cos;
    const cx = W - margin - bbW / 2;
    const cy = margin + bbH / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.fillStyle = '#ff2e88';
    ctx.beginPath();
    ctx.moveTo(-ribbonW / 2, -ribbonH / 2);
    ctx.lineTo(ribbonW / 2, -ribbonH / 2);
    ctx.lineTo(ribbonW / 2 + ribbonH * 0.32, 0);
    ctx.lineTo(ribbonW / 2, ribbonH / 2);
    ctx.lineTo(-ribbonW / 2, ribbonH / 2);
    ctx.lineTo(-ribbonW / 2 - ribbonH * 0.32, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badge, 0, ribbonH * 0.02);
    ctx.restore();
  }

  // Vignette.
  if (fx.vignette) {
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(8,2,16,0.5)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  // Grain, tiled deterministically.
  if (fx.grain) {
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = noisePattern(ctx, W, H);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // Frame: outer band + thin inner keyline.
  if (fx.frame) {
    const bw = Math.max(10, W * 0.014);
    ctx.fillStyle = '#f5efe6';
    ctx.fillRect(0, 0, W, bw);
    ctx.fillRect(0, H - bw, W, bw);
    ctx.fillRect(0, 0, bw, H);
    ctx.fillRect(W - bw, 0, bw, H);
    ctx.strokeStyle = 'rgba(20,6,32,0.85)';
    ctx.lineWidth = Math.max(2, W * 0.002);
    ctx.strokeRect(bw * 1.6, bw * 1.6, W - bw * 3.2, H - bw * 3.2);
  }

  ctx.restore();
}

// Panel hit test in canvas coordinates: returns the panel index or -1.
export function panelAt(state, x, y, w, h) {
  const layout = LAYOUTS[state.layout] || LAYOUTS.heroRight;
  for (let i = layout.panels.length - 1; i >= 0; i--) {
    const p = layout.panels[i];
    if (x >= p.x * w && x < (p.x + p.w) * w && y >= p.y * h && y < (p.y + p.h) * h) return i;
  }
  return -1;
}
