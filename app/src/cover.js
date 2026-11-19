// Neon Shore Cover Studio — cover render engine.
// Draws a multi-panel GTA-poster-style cover on any 2D canvas: photos in panels,
// a sunset / neon colour grade, bold Anton lettering with a Pacifico script
// subtitle, a badge ribbon, and toggleable print effects (grain, vignette,
// halftone, sun rays, frame). Pure canvas, no network, no dependencies.

(function () {
  'use strict';

  // ---------------------------------------------------------------- layouts
  // Panels live in the zone above the title band. Each panel is a rectangle
  // in fractions of the zone (x, y, w, h), or a polygon (poly) for the
  // diagonal split. Snapshot adds a tilted framed photo over a full-bleed
  // background photo.
  var LAYOUTS = {
    heroLeft: {
      name: 'Hero left',
      titleH: 0.24,
      panels: [
        { x: 0, y: 0, w: 0.57, h: 1 },
        { x: 0.57, y: 0, w: 0.43, h: 0.5 },
        { x: 0.57, y: 0.5, w: 0.43, h: 0.5 },
      ],
    },
    heroRight: {
      name: 'Hero right',
      titleH: 0.24,
      panels: [
        { x: 0.43, y: 0, w: 0.57, h: 1 },
        { x: 0, y: 0, w: 0.43, h: 0.5 },
        { x: 0, y: 0.5, w: 0.43, h: 0.5 },
      ],
    },
    fourGrid: {
      name: 'Four grid',
      titleH: 0.24,
      panels: [
        { x: 0, y: 0, w: 0.5, h: 0.5 },
        { x: 0.5, y: 0, w: 0.5, h: 0.5 },
        { x: 0, y: 0.5, w: 0.5, h: 0.5 },
        { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
      ],
    },
    trioStrip: {
      name: 'Trio strip',
      titleH: 0.24,
      panels: [
        { x: 0, y: 0, w: 1 / 3, h: 1 },
        { x: 1 / 3, y: 0, w: 1 / 3, h: 1 },
        { x: 2 / 3, y: 0, w: 1 / 3, h: 1 },
      ],
    },
    snapshot: {
      name: 'Snapshot',
      titleH: 0.24,
      background: 'A',
      panels: [
        { x: 0.5, y: 0.06, w: 0.44, h: 0.62, rot: -6 },
        { x: 0.04, y: 0.42, w: 0.34, h: 0.42, rot: 4 },
      ],
    },
    duoSplit: {
      name: 'Duo split',
      titleH: 0.24,
      panels: [
        { poly: [[0, 0], [0.56, 0], [0.44, 1], [0, 1]] },
        { poly: [[0.56, 0], [1, 0], [1, 1], [0.44, 1]] },
      ],
    },
  };

  var LAYOUT_ORDER = ['heroLeft', 'heroRight', 'fourGrid', 'trioStrip', 'snapshot', 'duoSplit'];

  // ------------------------------------------------------------------ grades
  // wash: soft-light colour wash over the photos; tint: flat overlay tint;
  // sun: warm glow position (fractions) and colour; titleBg: title band
  // gradient; titleFill: gradient stops for the big title; accent: badge.
  var GRADES = {
    viceSunset: {
      name: 'Vice Sunset',
      wash: '#ff7a18', washAlpha: 0.5, tint: '#ff2e88', tintAlpha: 0.1,
      sun: { x: 0.5, y: 0.08, color: '#ffd166' },
      titleBg: ['#160a2e', '#ff6b35'], titleFill: ['#ffffff', '#ffd166', '#ff6b35'],
      accent: '#ff2e88',
    },
    neonNights: {
      name: 'Neon Nights',
      wash: '#00e5ff', washAlpha: 0.5, tint: '#ff2e88', tintAlpha: 0.16,
      sun: { x: 0.5, y: 0.08, color: '#7df9ff' },
      titleBg: ['#0b0620', '#2b0a4a'], titleFill: ['#ffffff', '#7df9ff', '#ff2e88'],
      accent: '#00e5ff',
    },
    goldenHour: {
      name: 'Golden Hour',
      wash: '#ffb347', washAlpha: 0.55, tint: '#ff8c00', tintAlpha: 0.12,
      sun: { x: 0.28, y: 0.1, color: '#fff3c4' },
      titleBg: ['#1a0f00', '#7a3c00'], titleFill: ['#fff8e7', '#ffd166', '#ff8c00'],
      accent: '#ffb347',
    },
    tealNoir: {
      name: 'Teal Noir',
      wash: '#14b8a6', washAlpha: 0.5, tint: '#0f766e', tintAlpha: 0.18,
      sun: { x: 0.72, y: 0.06, color: '#99f6e4' },
      titleBg: ['#04151a', '#0b3b3b'], titleFill: ['#e6fffa', '#5eead4', '#14b8a6'],
      accent: '#2dd4bf',
    },
    hotPink: {
      name: 'Hot Pink',
      wash: '#ff2e88', washAlpha: 0.5, tint: '#d946ef', tintAlpha: 0.16,
      sun: { x: 0.5, y: 0.08, color: '#fbcfe8' },
      titleBg: ['#1c0416', '#4a0a3d'], titleFill: ['#ffffff', '#fbcfe8', '#ff2e88'],
      accent: '#f472b6',
    },
    palmDusk: {
      name: 'Palm Dusk',
      wash: '#7c3aed', washAlpha: 0.5, tint: '#f97316', tintAlpha: 0.1,
      sun: { x: 0.5, y: 0.06, color: '#fde68a' },
      titleBg: ['#12041f', '#3b0764'], titleFill: ['#ffffff', '#c4b5fd', '#f97316'],
      accent: '#a78bfa',
    },
  };

  var GRADE_ORDER = ['viceSunset', 'neonNights', 'goldenHour', 'tealNoir', 'hotPink', 'palmDusk'];

  var SIZES = {
    square: { w: 1080, h: 1080, label: 'Square 1080 × 1080' },
    portrait: { w: 1080, h: 1350, label: 'Portrait 1080 × 1350' },
    wide: { w: 1920, h: 1080, label: 'Wide 1920 × 1080' },
  };

  // ------------------------------------------------------------ seeded grain
  // Deterministic noise so the same cover always renders the same grain.
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var grainTile = null;
  function getGrainTile() {
    if (grainTile) return grainTile;
    var rnd = mulberry32(20261119);
    var c = document.createElement('canvas');
    c.width = 160; c.height = 160;
    var g = c.getContext('2d');
    var img = g.createImageData(160, 160);
    for (var i = 0; i < img.data.length; i += 4) {
      var v = Math.floor(rnd() * 255);
      img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    grainTile = c;
    return c;
  }

  // -------------------------------------------------------------- photo draw
  // Cover-fit the photo into a rectangle, with zoom and pan (fractions of
  // the panel size, -0.5..0.5). Pan moves the visible window across the photo.
  function drawPhotoInto(ctx, img, x, y, w, h, panel) {
    var zoom = panel.zoom || 1;
    var px = panel.x || 0;
    var py = panel.y || 0;
    var scale = Math.max(w / img.naturalWidth, h / img.naturalHeight) * zoom;
    var dw = img.naturalWidth * scale;
    var dh = img.naturalHeight * scale;
    var dx = x + (w - dw) / 2 - px * dw;
    var dy = y + (h - dh) / 2 - py * dh;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  function drawPlaceholder(ctx, x, y, w, h, label, accent) {
    var grad = ctx.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, '#2b1055');
    grad.addColorStop(0.55, '#7597de');
    grad.addColorStop(1, '#ff2e88');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = Math.max(2, w * 0.008);
    for (var i = -h; i < w; i += Math.max(24, w * 0.08)) {
      ctx.beginPath();
      ctx.moveTo(x + i, y + h);
      ctx.lineTo(x + i + h, y);
      ctx.stroke();
    }
    ctx.restore();
    var size = Math.min(w, h) * 0.14;
    ctx.font = size + 'px Anton, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(label, x + w / 2, y + h / 2);
    ctx.font = Math.max(10, size * 0.32) + 'px Anton, sans-serif';
    ctx.fillStyle = accent;
    ctx.fillText('TAP TO ADD A PHOTO', x + w / 2, y + h / 2 + size * 0.75);
  }

  function panelRect(layout, panel, W, zoneH) {
    if (panel.poly) {
      var pts = panel.poly.map(function (p) { return [p[0] * W, p[1] * zoneH]; });
      var xs = pts.map(function (p) { return p[0]; });
      var ys = pts.map(function (p) { return p[1]; });
      return {
        x: Math.min.apply(null, xs), y: Math.min.apply(null, ys),
        w: Math.max.apply(null, xs) - Math.min.apply(null, xs),
        h: Math.max.apply(null, ys) - Math.min.apply(null, ys),
        poly: pts,
      };
    }
    return { x: panel.x * W, y: panel.y * zoneH, w: panel.w * W, h: panel.h * zoneH, rot: panel.rot || 0 };
  }

  function clipPanel(ctx, rect) {
    ctx.beginPath();
    if (rect.poly) {
      ctx.moveTo(rect.poly[0][0], rect.poly[0][1]);
      for (var i = 1; i < rect.poly.length; i++) ctx.lineTo(rect.poly[i][0], rect.poly[i][1]);
      ctx.closePath();
    } else {
      ctx.rect(rect.x, rect.y, rect.w, rect.h);
    }
    ctx.clip();
  }

  // ------------------------------------------------------------------ render
  // state: { layout, grade, title, subtitle, badge,
  //          effects: {grain, vignette, halftone, rays, frame},
  //          panels: [{photo:'A'|'B', zoom, x, y}, ...] }
  // photos: { A: HTMLImageElement|null, B: HTMLImageElement|null }
  function drawCover(ctx, W, H, state, photos) {
    var layout = LAYOUTS[state.layout] || LAYOUTS.heroLeft;
    var grade = GRADES[state.grade] || GRADES.viceSunset;
    var fx = state.effects || {};
    var titleH = Math.round(H * layout.titleH);
    var zoneH = H - titleH;
    var gap = Math.max(2, Math.round(W * 0.006));
    var scale = W / 1080; // stroke widths scale with the cover width

    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#12041f';
    ctx.fillRect(0, 0, W, H);

    // Full-bleed background photo for the Snapshot layout.
    if (layout.background) {
      var bgImg = photos[layout.background];
      if (bgImg) drawPhotoInto(ctx, bgImg, 0, 0, W, H, { zoom: 1, x: 0, y: 0 });
      else drawPlaceholder(ctx, 0, 0, W, H, 'PHOTO A', grade.accent);
    }

    // Panels.
    layout.panels.forEach(function (panel, i) {
      var pstate = (state.panels && state.panels[i]) || { photo: 'A', zoom: 1, x: 0, y: 0 };
      var rect = panelRect(layout, panel, W, zoneH);
      var img = photos[pstate.photo] || null;
      ctx.save();
      if (rect.rot) {
        var cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
        ctx.translate(cx, cy);
        ctx.rotate((rect.rot * Math.PI) / 180);
        ctx.translate(-cx, -cy);
      }
      clipPanel(ctx, rect);
      var ix = rect.x + gap / 2, iy = rect.y + gap / 2;
      var iw = rect.w - gap, ih = rect.h - gap;
      if (img) drawPhotoInto(ctx, img, ix, iy, iw, ih, pstate);
      else drawPlaceholder(ctx, ix, iy, iw, ih, 'PHOTO ' + pstate.photo, grade.accent);
      ctx.restore();
      // White panel border (and the tilted frame for Snapshot panels).
      ctx.save();
      if (rect.rot) {
        var cx2 = rect.x + rect.w / 2, cy2 = rect.y + rect.h / 2;
        ctx.translate(cx2, cy2);
        ctx.rotate((rect.rot * Math.PI) / 180);
        ctx.translate(-cx2, -cy2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(rect.x - 6 * scale, rect.y - 6 * scale, rect.w + 12 * scale, rect.h + 12 * scale);
        ctx.restore();
        ctx.save();
        ctx.translate(cx2, cy2);
        ctx.rotate((rect.rot * Math.PI) / 180);
        ctx.translate(-cx2, -cy2);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = Math.max(2, 3 * scale);
      if (rect.poly) {
        ctx.beginPath();
        ctx.moveTo(rect.poly[0][0], rect.poly[0][1]);
        for (var k = 1; k < rect.poly.length; k++) ctx.lineTo(rect.poly[k][0], rect.poly[k][1]);
        ctx.closePath();
        ctx.stroke();
      } else {
        ctx.strokeRect(rect.x + gap / 2, rect.y + gap / 2, rect.w - gap, rect.h - gap);
      }
      ctx.restore();
    });

    // Colour grade: soft-light wash, flat tint, warm sun glow.
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = grade.washAlpha;
    ctx.fillStyle = grade.wash;
    ctx.fillRect(0, 0, W, zoneH);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = grade.tintAlpha;
    ctx.fillStyle = grade.tint;
    ctx.fillRect(0, 0, W, zoneH);
    ctx.restore();
    var glow = ctx.createRadialGradient(
      grade.sun.x * W, grade.sun.y * zoneH, 0,
      grade.sun.x * W, grade.sun.y * zoneH, W * 0.62
    );
    glow.addColorStop(0, grade.sun.color);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, zoneH);
    ctx.restore();

    // Sun rays from the grade's sun position.
    if (fx.rays) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, zoneH);
      ctx.clip();
      var sx = grade.sun.x * W, sy = grade.sun.y * zoneH;
      var rays = 14;
      var maxR = Math.hypot(W, zoneH);
      for (var r = 0; r < rays; r++) {
        var a0 = (r / rays) * Math.PI * 2;
        var a1 = ((r + 0.45) / rays) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.arc(sx, sy, maxR, a0, a1);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fill();
      }
      ctx.restore();
    }

    // Title band.
    var band = ctx.createLinearGradient(0, zoneH, 0, H);
    band.addColorStop(0, grade.titleBg[0]);
    band.addColorStop(1, grade.titleBg[1]);
    ctx.fillStyle = band;
    ctx.fillRect(0, zoneH, W, titleH);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(0, zoneH, W, Math.max(2, 3 * scale));

    // Halftone dots across the title band.
    if (fx.halftone) {
      ctx.save();
      var step = Math.max(10, 14 * scale);
      for (var hx = step / 2; hx < W; hx += step) {
        for (var hy = zoneH + step / 2; hy < H; hy += step) {
          var rad = (1 + 2.2 * Math.abs(Math.sin(hx * 0.02 + hy * 0.05))) * scale;
          ctx.beginPath();
          ctx.arc(hx, hy, rad, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.10)';
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // Big title: Anton, auto-fit to the width, gradient fill, dark outline.
    var title = (state.title || '').toUpperCase();
    var titleSize = titleH * 0.52;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    function titleFont(sz) { return sz + 'px Anton, "Arial Black", sans-serif'; }
    ctx.font = titleFont(titleSize);
    var maxW = W * 0.94;
    while (titleSize > 12 && ctx.measureText(title).width > maxW) {
      titleSize *= 0.94;
      ctx.font = titleFont(titleSize);
    }
    var titleGrad = ctx.createLinearGradient(0, zoneH + titleH * 0.12, 0, zoneH + titleH * 0.62);
    grade.titleFill.forEach(function (c, i) {
      titleGrad.addColorStop(i / (grade.titleFill.length - 1), c);
    });
    var titleY = zoneH + titleH * 0.36;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = Math.max(2, titleSize * 0.07);
    ctx.strokeText(title, W / 2, titleY);
    ctx.fillStyle = titleGrad;
    ctx.fillText(title, W / 2, titleY);

    // Script subtitle in Pacifico, tucked under the title.
    var sub = state.subtitle || '';
    if (sub) {
      var subSize = Math.max(14, titleH * 0.2);
      ctx.font = subSize + 'px Pacifico, cursive';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 6 * scale;
      ctx.fillText(sub, W / 2, zoneH + titleH * 0.82);
      ctx.shadowBlur = 0;
    }

    // Badge ribbon, top-right, tilted.
    var badge = state.badge || '';
    if (badge) {
      var badgeSize = Math.max(12, W * 0.026);
      ctx.font = badgeSize + 'px Anton, "Arial Black", sans-serif';
      var bw = ctx.measureText(badge.toUpperCase()).width + badgeSize * 1.6;
      var bh = badgeSize * 1.9;
      // Anchor the ribbon fully inside the cover: its right tail must not
      // cross the edge, whatever the badge text or cover width.
      var badgeX = W - bw / 2 - bh * 0.45 - 20 * scale;
      ctx.save();
      ctx.translate(badgeX, Math.max(28, H * 0.035));
      ctx.rotate((-6 * Math.PI) / 180);
      ctx.fillStyle = grade.accent;
      ctx.beginPath();
      ctx.moveTo(-bw / 2, -bh / 2);
      ctx.lineTo(bw / 2, -bh / 2);
      ctx.lineTo(bw / 2 + bh * 0.45, 0);
      ctx.lineTo(bw / 2, bh / 2);
      ctx.lineTo(-bw / 2, bh / 2);
      ctx.lineTo(-bw / 2 - bh * 0.45, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = Math.max(1.5, 2 * scale);
      ctx.stroke();
      ctx.fillStyle = '#14041f';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badge.toUpperCase(), 0, 1);
      ctx.restore();
    }

    // Vignette.
    if (fx.vignette) {
      var vg = ctx.createRadialGradient(
        W / 2, H / 2, Math.min(W, H) * 0.42,
        W / 2, H / 2, Math.hypot(W, H) * 0.62
      );
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.42)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    }

    // Deterministic grain over everything.
    if (fx.grain) {
      var tile = getGrainTile();
      var pat = ctx.createPattern(tile, 'repeat');
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // Frame: bold outer rule, thin inner rule.
    if (fx.frame) {
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = Math.max(4, 10 * scale);
      ctx.strokeRect(5 * scale, 5 * scale, W - 10 * scale, H - 10 * scale);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = Math.max(1, 2 * scale);
      ctx.strokeRect(20 * scale, 20 * scale, W - 40 * scale, H - 40 * scale);
    }

    ctx.restore();
  }

  // Panel hit test in cover fractions (fx 0..1, fy 0..1 of the full cover).
  // Returns the panel index or -1. Tilted snapshot panels use their box.
  function hitPanel(state, fx, fy) {
    var layout = LAYOUTS[state.layout] || LAYOUTS.heroLeft;
    var titleH = layout.titleH;
    var zoneH = 1 - titleH;
    var py = fy / zoneH;
    if (py > 1) return -1;
    for (var i = layout.panels.length - 1; i >= 0; i--) {
      var p = layout.panels[i];
      if (p.poly) {
        if (pointInPoly(fx, py, p.poly)) return i;
      } else if (fx >= p.x && fx <= p.x + p.w && py >= p.y && py <= p.y + p.h) {
        return i;
      }
    }
    return -1;
  }

  function pointInPoly(x, y, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0], yi = poly[i][1];
      var xj = poly[j][0], yj = poly[j][1];
      if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  function defaultState() {
    return {
      layout: 'heroLeft',
      grade: 'viceSunset',
      title: 'NEON SHORE',
      subtitle: 'one last summer',
      badge: 'PALM COAST',
      size: 'square',
      effects: { grain: true, vignette: true, halftone: true, rays: true, frame: true },
      panels: [
        { photo: 'A', zoom: 1, x: 0, y: 0 },
        { photo: 'B', zoom: 1, x: 0, y: 0 },
        { photo: 'A', zoom: 1, x: 0, y: 0 },
        { photo: 'B', zoom: 1, x: 0, y: 0 },
      ],
    };
  }

  window.NeonShoreCover = {
    LAYOUTS: LAYOUTS, LAYOUT_ORDER: LAYOUT_ORDER,
    GRADES: GRADES, GRADE_ORDER: GRADE_ORDER,
    SIZES: SIZES,
    drawCover: drawCover,
    hitPanel: hitPanel,
    defaultState: defaultState,
  };
})();
