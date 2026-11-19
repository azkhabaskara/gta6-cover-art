// Neon Shore Cover Studio — the cover engine.
// Draws a multi-panel GTA-style poster cover onto any 2D canvas context:
// photos clipped into poster panels, a sunset or neon colour grade, bold
// Anton title lettering with a Pacifico script subtitle, a badge ribbon,
// halftone dots, film grain and a vignette. Everything is drawn from the
// state object, so the live preview and the exported PNG are the same code.

/** The six panel layouts. Each panel is a fraction rect {x, y, w, h} of the cover. */
export const LAYOUTS = {
  heroLeft: {
    label: 'Hero left',
    panels: [
      { x: 0, y: 0, w: 0.62, h: 1 },
      { x: 0.62, y: 0, w: 0.38, h: 0.5 },
      { x: 0.62, y: 0.5, w: 0.38, h: 0.5 },
    ],
  },
  heroRight: {
    label: 'Hero right',
    panels: [
      { x: 0.38, y: 0, w: 0.62, h: 1 },
      { x: 0, y: 0, w: 0.38, h: 0.5 },
      { x: 0, y: 0.5, w: 0.38, h: 0.5 },
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
  trioStrip: {
    label: 'Trio strip',
    panels: [
      { x: 0, y: 0, w: 0.34, h: 1 },
      { x: 0.34, y: 0, w: 0.33, h: 1 },
      { x: 0.67, y: 0, w: 0.33, h: 1 },
    ],
  },
  fullBleed: {
    label: 'Snapshot',
    panels: [
      { x: 0, y: 0, w: 1, h: 1 },
      { x: 0.52, y: 0.52, w: 0.42, h: 0.4, tilt: -0.06, frame: true },
    ],
  },
  duoSplit: {
    label: 'Duo split',
    panels: [
      { x: 0, y: 0, w: 1, h: 0.56 },
      { x: 0, y: 0.56, w: 1, h: 0.44 },
    ],
  },
};

/** The six colour grades: sky, mid and deep stops plus the lettering accent. */
export const GRADES = {
  viceSunset: {
    label: 'Vice Sunset',
    sky: '#ff9a3d', mid: '#ff5e7a', deep: '#7b2d8b',
    tint: 'rgba(255, 94, 122, 0.28)', accent: '#ffd23f', ink: '#1c0b2e',
  },
  neonNights: {
    label: 'Neon Nights',
    sky: '#ff2e88', mid: '#7a2bff', deep: '#0b1035',
    tint: 'rgba(122, 43, 255, 0.30)', accent: '#37f2e2', ink: '#0b1035',
  },
  goldenHour: {
    label: 'Golden Hour',
    sky: '#ffc53d', mid: '#ff8a3d', deep: '#8a3d1e',
    tint: 'rgba(255, 160, 40, 0.26)', accent: '#fff3c4', ink: '#3d1e08',
  },
  tealNoir: {
    label: 'Teal Noir',
    sky: '#2dd4bf', mid: '#0e7490', deep: '#082f49',
    tint: 'rgba(45, 212, 191, 0.22)', accent: '#f0fdfa', ink: '#082f49',
  },
  hotPink: {
    label: 'Hot Pink',
    sky: '#ff7ad9', mid: '#e0218a', deep: '#4a044e',
    tint: 'rgba(224, 33, 138, 0.30)', accent: '#fdf4ff', ink: '#4a044e',
  },
  palmDusk: {
    label: 'Palm Dusk',
    sky: '#fda4af', mid: '#c026d3', deep: '#1e1b4b',
    tint: 'rgba(192, 38, 211, 0.26)', accent: '#fde68a', ink: '#1e1b4b',
  },
};

/** The three export sizes, in pixels. */
export const EXPORT_SIZES = [
  { id: 'square', label: 'Square 1080 x 1080', w: 1080, h: 1080 },
  { id: 'portrait', label: 'Portrait 1080 x 1350', w: 1080, h: 1350 },
  { id: 'wide', label: 'Wide 1920 x 1080', w: 1920, h: 1080 },
];

/** A fresh default state for the studio. */
export function defaultState() {
  return {
    layout: 'heroLeft',
    grade: 'viceSunset',
    title: 'Neon Shore',
    subtitle: 'one last summer',
    badge: 'Palm Coast',
    size: 'square',
    grain: true,
    vignette: true,
    halftone: true,
    sunburst: true,
    frame: true,
    // One slot per panel (at most four panels in any layout): which photo,
    // zoom factor and pan offsets, in fractions of the panel.
    panels: [
      { photo: 0, zoom: 1.05, dx: 0, dy: 0 },
      { photo: 1, zoom: 1.05, dx: 0, dy: 0 },
      { photo: 0, zoom: 1.25, dx: 0.06, dy: -0.04 },
      { photo: 1, zoom: 1.15, dx: -0.05, dy: 0.03 },
    ],
  };
}

/** A tiny deterministic random generator, so grain looks the same every render. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Draws one photo into a panel rect, cover-fit, with the panel's zoom and pan. */
export function drawPhotoIntoPanel(ctx, photo, rect, slot) {
  if (!photo) return;
  const pw = photo.naturalWidth;
  const ph = photo.naturalHeight;
  const scale = Math.max(rect.w / pw, rect.h / ph) * (slot.zoom || 1);
  const dw = pw * scale;
  const dh = ph * scale;
  const cx = rect.x + rect.w / 2 + (slot.dx || 0) * rect.w;
  const cy = rect.y + rect.h / 2 + (slot.dy || 0) * rect.h;
  ctx.drawImage(photo, cx - dw / 2, cy - dh / 2, dw, dh);
}

/** Paints the grade over the whole cover: a sky-to-deep wash plus a warm tint. */
export function applyGrade(ctx, grade, w, h) {
  const wash = ctx.createLinearGradient(0, 0, w * 0.25, h);
  wash.addColorStop(0, grade.sky);
  wash.addColorStop(0.55, grade.mid);
  wash.addColorStop(1, grade.deep);
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = grade.tint;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Sun rays fanning from the top corner, clipped to the cover. */
export function drawSunburst(ctx, grade, w, h) {
  const cx = w * 0.82;
  const cy = -h * 0.08;
  const rays = 14;
  const rand = mulberry32(77);
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = grade.sky;
  for (let i = 0; i < rays; i++) {
    const a0 = (i / rays) * Math.PI * 1.1 + 0.35;
    const a1 = a0 + (0.05 + rand() * 0.05);
    const r = Math.hypot(w, h);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, a0, a1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** A halftone dot field in the two top corners, like printed poster art. */
export function drawHalftone(ctx, w, h) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  const step = Math.max(14, w * 0.016);
  for (let gy = 0; gy < 7; gy++) {
    for (let gx = 0; gx < 9; gx++) {
      const r = (7 - gy) * 0.55 + (8 - gx) * 0.35;
      if (r <= 0.8) continue;
      ctx.beginPath();
      ctx.arc(w - 14 - gx * step, 14 + gy * step, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Film grain: thousands of faint speckles, same pattern on every render. */
export function drawGrain(ctx, w, h) {
  const rand = mulberry32(1337);
  ctx.save();
  const count = Math.floor((w * h) / 900);
  for (let i = 0; i < count; i++) {
    const v = rand();
    ctx.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(rand() * w, rand() * h, 1.6, 1.6);
  }
  ctx.restore();
}

/** A soft dark vignette around the edges. */
export function drawVignette(ctx, w, h) {
  const g = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.42,
    w / 2, h / 2, Math.hypot(w, h) * 0.62,
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Fits a one-line title to a max width by shrinking the font, returns the size. */
export function fitTitleFont(ctx, text, maxWidth, startSize, family) {
  let size = startSize;
  ctx.font = `${size}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && size > 10) {
    size -= 2;
    ctx.font = `${size}px ${family}`;
  }
  return size;
}

/** Draws the title block: a dark foot band, the big Anton title, script subtitle. */
export function drawTitleBlock(ctx, state, grade, w, h) {
  const bandH = h * 0.24;
  const band = ctx.createLinearGradient(0, h - bandH * 1.7, 0, h);
  band.addColorStop(0, 'rgba(10,6,20,0)');
  band.addColorStop(1, 'rgba(10,6,20,0.82)');
  ctx.fillStyle = band;
  ctx.fillRect(0, h - bandH * 1.7, w, bandH * 1.7);

  const title = (state.title || '').trim().toUpperCase();
  const margin = w * 0.055;
  if (title) {
    const size = fitTitleFont(ctx, title, w - margin * 2, h * 0.115, 'Anton, sans-serif');
    ctx.save();
    ctx.translate(margin, h - h * 0.085);
    ctx.rotate(-0.02);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `${size}px Anton, sans-serif`;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = grade.ink;
    ctx.lineWidth = Math.max(3, size * 0.09);
    ctx.strokeText(title, 0, 0);
    const fill = ctx.createLinearGradient(0, -size, 0, size * 0.1);
    fill.addColorStop(0, '#ffffff');
    fill.addColorStop(1, grade.accent);
    ctx.fillStyle = fill;
    ctx.fillText(title, 0, 0);
    ctx.restore();
  }

  const sub = (state.subtitle || '').trim();
  if (sub) {
    const size = Math.max(16, h * 0.038);
    ctx.save();
    ctx.font = `${size}px Pacifico, cursive`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = grade.mid;
    ctx.shadowBlur = size * 0.55;
    ctx.fillStyle = grade.accent;
    ctx.fillText(sub, margin, h - h * 0.028);
    ctx.restore();
  }
}

/** Draws the badge ribbon in the top-left corner. */
export function drawBadge(ctx, state, grade, w, h) {
  const text = (state.badge || '').trim().toUpperCase();
  if (!text) return;
  const size = Math.max(13, h * 0.024);
  ctx.save();
  ctx.font = `bold ${size}px Anton, sans-serif`;
  const tw = ctx.measureText(text).width;
  const padX = size * 0.9;
  const padY = size * 0.55;
  ctx.translate(w * 0.045, h * 0.055);
  ctx.rotate(-0.045);
  ctx.fillStyle = grade.accent;
  ctx.strokeStyle = grade.ink;
  ctx.lineWidth = Math.max(2, size * 0.08);
  const bw = tw + padX * 2;
  const bh = size + padY * 2;
  ctx.beginPath();
  ctx.rect(-padX, -size - padY * 0.4, bw, bh);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = grade.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, tw / 2, size * 0.12);
  ctx.restore();
}

/**
 * Draws the whole cover from `state` onto `ctx` at size w x h.
 * `photos` is an array of loaded images (or nulls), one per photo slot.
 */
export function drawCover(ctx, state, photos, w, h) {
  const grade = GRADES[state.grade] || GRADES.viceSunset;
  const layout = LAYOUTS[state.layout] || LAYOUTS.heroLeft;
  const gutter = Math.max(3, Math.round(w * 0.006));

  ctx.save();
  ctx.fillStyle = grade.ink;
  ctx.fillRect(0, 0, w, h);

  if (state.sunburst) drawSunburst(ctx, grade, w, h);

  layout.panels.forEach((panel, i) => {
    const slot = state.panels[i] || { photo: 0, zoom: 1, dx: 0, dy: 0 };
    const rect = {
      x: panel.x * w + (panel.x > 0 ? gutter / 2 : 0),
      y: panel.y * h + (panel.y > 0 ? gutter / 2 : 0),
      w: panel.w * w - (panel.x > 0 ? gutter / 2 : 0) - (panel.x + panel.w < 1 ? gutter / 2 : 0),
      h: panel.h * h - (panel.y > 0 ? gutter / 2 : 0) - (panel.y + panel.h < 1 ? gutter / 2 : 0),
    };
    ctx.save();
    if (panel.tilt) {
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate(panel.tilt);
      ctx.translate(-rect.w / 2, -rect.h / 2);
      rect.x = 0;
      rect.y = 0;
    }
    if (panel.frame) {
      ctx.fillStyle = '#ffffff';
      const f = Math.max(6, w * 0.012);
      ctx.fillRect(rect.x - f, rect.y - f, rect.w + f * 2, rect.h + f * 2);
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = w * 0.02;
      ctx.shadowOffsetY = h * 0.008;
    }
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    const photo = photos[slot.photo] || null;
    if (photo) {
      drawPhotoIntoPanel(ctx, photo, rect, slot);
    } else {
      const g = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
      g.addColorStop(0, grade.sky);
      g.addColorStop(1, grade.deep);
      ctx.fillStyle = g;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = `bold ${Math.max(14, w * 0.028)}px Anton, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('ADD A PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2);
    }
    ctx.restore();
  });

  applyGrade(ctx, grade, w, h);
  if (state.halftone) drawHalftone(ctx, w, h);
  drawTitleBlock(ctx, state, grade, w, h);
  drawBadge(ctx, state, grade, w, h);
  if (state.frame) {
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = Math.max(4, w * 0.008);
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
  }
  if (state.vignette) drawVignette(ctx, w, h);
  if (state.grain) drawGrain(ctx, w, h);
  ctx.restore();
}
