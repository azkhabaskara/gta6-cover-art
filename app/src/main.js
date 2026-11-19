// Neon Shore Cover Studio — wires the editor page: photo picking, layout and
// grade chips, per-panel crop and position (sliders, drag, scroll), caption
// editing, undo and redo, and PNG export in the three post sizes.
// A `?shot=` query sets up a fixed scene for a screenshot instead (shots.js).
import { drawCover, defaultState, LAYOUTS, GRADES, EXPORT_SIZES } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const photoStatus = document.getElementById('photoStatus');

let state = defaultState();
let photos = [null, null];
let selectedPanel = 0;
let history = [];
let future = [];

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('could not load image'));
    img.src = url;
  });
}

function panelCount() {
  return (LAYOUTS[state.layout] || LAYOUTS.heroLeft).panels.length;
}

function currentSize() {
  return EXPORT_SIZES.find((s) => s.id === state.size) || EXPORT_SIZES[0];
}

/** Redraws the preview canvas at the current export aspect. */
export function redraw() {
  const size = currentSize();
  const previewW = 1080;
  const previewH = Math.round((1080 * size.h) / size.w);
  if (canvas.width !== previewW || canvas.height !== previewH) {
    canvas.width = previewW;
    canvas.height = previewH;
  }
  drawCover(ctx, state, photos, canvas.width, canvas.height);
  syncPanelControls();
}

/** Renders the cover at full export resolution and returns a PNG blob. */
export function exportCover(sizeId) {
  const size = EXPORT_SIZES.find((s) => s.id === sizeId) || EXPORT_SIZES[0];
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  drawCover(off.getContext('2d'), state, photos, size.w, size.h);
  return new Promise((resolve) => off.toBlob(resolve, 'image/png'));
}

/** Downloads one exported PNG and reports it in the status line. */
export async function downloadCover(sizeId) {
  const size = EXPORT_SIZES.find((s) => s.id === sizeId) || EXPORT_SIZES[0];
  const blob = await exportCover(size.id);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `neon-shore-cover-${size.w}x${size.h}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  statusEl.textContent = `Saved ${a.download} (${Math.round(blob.size / 1024)} KiB)`;
  return blob;
}

function snapshot() {
  return JSON.stringify(state);
}

function commit() {
  history.push(snapshot());
  if (history.length > 60) history.shift();
  future = [];
}

function restore(json) {
  state = JSON.parse(json);
  syncAllControls();
  redraw();
}

function undo() {
  if (!history.length) return;
  future.push(snapshot());
  restore(history.pop());
  statusEl.textContent = 'Undid that change.';
}

function redo() {
  if (!future.length) return;
  history.push(snapshot());
  restore(future.pop());
  statusEl.textContent = 'Redid that change.';
}

// ---- control builders -------------------------------------------------------

function buildChips(container, items, current, onPick) {
  container.innerHTML = '';
  items.forEach(([id, label]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (id === current) b.classList.add('active');
    b.addEventListener('click', () => {
      commit();
      onPick(id);
      buildChips(container, items, id, onPick);
      redraw();
    });
    container.appendChild(b);
  });
}

function buildLayoutChips() {
  buildChips(
    document.getElementById('layoutRow'),
    Object.entries(LAYOUTS).map(([id, l]) => [id, l.label]),
    state.layout,
    (id) => { state.layout = id; selectedPanel = 0; },
  );
}

function buildGradeSwatches() {
  const row = document.getElementById('gradeRow');
  row.innerHTML = '';
  Object.entries(GRADES).forEach(([id, g]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch' + (id === state.grade ? ' active' : '');
    b.title = g.label;
    b.setAttribute('aria-label', g.label);
    b.style.background = `linear-gradient(135deg, ${g.sky} 0%, ${g.mid} 55%, ${g.deep} 100%)`;
    b.addEventListener('click', () => {
      commit();
      state.grade = id;
      buildGradeSwatches();
      redraw();
    });
    row.appendChild(b);
  });
}

function buildSizeChips() {
  buildChips(
    document.getElementById('sizeRow'),
    EXPORT_SIZES.map((s) => [s.id, s.label]),
    state.size,
    (id) => { state.size = id; },
  );
}

function buildPanelChips() {
  const row = document.getElementById('panelRow');
  row.innerHTML = '';
  for (let i = 0; i < panelCount(); i++) {
    const b = document.createElement('button');
    b.type = 'button';
    const slot = state.panels[i];
    b.textContent = `Panel ${i + 1} · ${slot.photo === 0 ? 'A' : 'B'}`;
    if (i === selectedPanel) b.classList.add('active');
    b.addEventListener('click', () => {
      selectedPanel = i;
      buildPanelChips();
      syncPanelControls();
    });
    row.appendChild(b);
  }
  const useA = document.createElement('button');
  useA.type = 'button';
  useA.textContent = 'Use photo A here';
  useA.addEventListener('click', () => { commit(); state.panels[selectedPanel].photo = 0; buildPanelChips(); redraw(); });
  const useB = document.createElement('button');
  useB.type = 'button';
  useB.textContent = 'Use photo B here';
  useB.addEventListener('click', () => { commit(); state.panels[selectedPanel].photo = 1; buildPanelChips(); redraw(); });
  row.appendChild(useA, useB);
}

/** Syncs the zoom/pan sliders to the selected panel. */
function syncPanelControls() {
  buildPanelChips();
  const slot = state.panels[selectedPanel];
  const zoom = document.getElementById('zoom');
  const dx = document.getElementById('dx');
  const dy = document.getElementById('dy');
  zoom.value = slot.zoom;
  dx.value = slot.dx;
  dy.value = slot.dy;
  document.getElementById('zoomVal').textContent = `${Number(slot.zoom).toFixed(2)}×`;
  document.getElementById('dxVal').textContent = Number(slot.dx).toFixed(2);
  document.getElementById('dyVal').textContent = Number(slot.dy).toFixed(2);
}

function syncAllControls() {
  document.getElementById('title').value = state.title;
  document.getElementById('subtitle').value = state.subtitle;
  document.getElementById('badge').value = state.badge;
  document.getElementById('fxSunburst').checked = state.sunburst;
  document.getElementById('fxHalftone').checked = state.halftone;
  document.getElementById('fxGrain').checked = state.grain;
  document.getElementById('fxVignette').checked = state.vignette;
  document.getElementById('fxFrame').checked = state.frame;
  buildLayoutChips();
  buildGradeSwatches();
  buildSizeChips();
  syncPanelControls();
}

// ---- photo loading ---------------------------------------------------------

async function setPhoto(index, fileOrUrl, isUrl) {
  const img = isUrl ? await loadImage(fileOrUrl) : await loadImage(URL.createObjectURL(fileOrUrl));
  photos[index] = img;
  photoStatus.textContent = `Photo ${index === 0 ? 'A' : 'B'} loaded — ${img.naturalWidth} x ${img.naturalHeight}px. Drag it on the preview to position it.`;
  redraw();
}

function bindPhotoInput(id, index) {
  document.getElementById(id).addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await setPhoto(index, file, false);
    } catch {
      statusEl.textContent = 'That file could not be read as a photo.';
    }
  });
}

bindPhotoInput('photoA', 0);
bindPhotoInput('photoB', 1);

document.getElementById('sampleA').addEventListener('click', async () => {
  await setPhoto(0, 'samples/boulevard.jpg', true);
});
document.getElementById('sampleB').addEventListener('click', async () => {
  await setPhoto(1, 'samples/pier.jpg', true);
});
document.getElementById('fillAll').addEventListener('click', () => {
  commit();
  state.panels.forEach((p) => { p.photo = 0; });
  buildPanelChips();
  redraw();
  statusEl.textContent = 'Every panel now uses photo A — each with its own crop.';
});

// ---- text and effect controls ----------------------------------------------

function bindText(id, key) {
  document.getElementById(id).addEventListener('input', (e) => {
    state[key] = e.target.value;
    redraw();
  });
  document.getElementById(id).addEventListener('change', () => commit());
}
bindText('title', 'title');
bindText('subtitle', 'subtitle');
bindText('badge', 'badge');

function bindToggle(id, key) {
  document.getElementById(id).addEventListener('change', (e) => {
    commit();
    state[key] = e.target.checked;
    redraw();
  });
}
bindToggle('fxSunburst', 'sunburst');
bindToggle('fxHalftone', 'halftone');
bindToggle('fxGrain', 'grain');
bindToggle('fxVignette', 'vignette');
bindToggle('fxFrame', 'frame');

function bindSlider(id, key, format) {
  const el = document.getElementById(id);
  el.addEventListener('input', () => {
    state.panels[selectedPanel][key] = Number(el.value);
    redraw();
  });
  el.addEventListener('change', () => commit());
}
bindSlider('zoom', 'zoom');
bindSlider('dx', 'dx');
bindSlider('dy', 'dy');

// ---- canvas drag, wheel zoom and panel picking ------------------------------

function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    fx: (e.clientX - r.left) / r.width,
    fy: (e.clientY - r.top) / r.height,
  };
}

function panelAt(fx, fy) {
  const panels = (LAYOUTS[state.layout] || LAYOUTS.heroLeft).panels;
  for (let i = panels.length - 1; i >= 0; i--) {
    const p = panels[i];
    if (fx >= p.x && fx <= p.x + p.w && fy >= p.y && fy <= p.y + p.h) return i;
  }
  return 0;
}

let dragging = null;
canvas.addEventListener('pointerdown', (e) => {
  const { fx, fy } = canvasPoint(e);
  selectedPanel = panelAt(fx, fy);
  dragging = { fx, fy, dx: state.panels[selectedPanel].dx, dy: state.panels[selectedPanel].dy };
  canvas.setPointerCapture(e.pointerId);
  syncPanelControls();
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const { fx, fy } = canvasPoint(e);
  const slot = state.panels[selectedPanel];
  slot.dx = Math.max(-0.5, Math.min(0.5, dragging.dx + (fx - dragging.fx)));
  slot.dy = Math.max(-0.5, Math.min(0.5, dragging.dy + (fy - dragging.fy)));
  redraw();
});
canvas.addEventListener('pointerup', () => {
  if (dragging) commit();
  dragging = null;
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const { fx, fy } = canvasPoint(e);
  selectedPanel = panelAt(fx, fy);
  const slot = state.panels[selectedPanel];
  slot.zoom = Math.max(1, Math.min(2.5, slot.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
  commit();
  redraw();
}, { passive: false });

// ---- export, undo, reset ----------------------------------------------------

document.getElementById('export').addEventListener('click', () => downloadCover(state.size));
document.getElementById('exportAll').addEventListener('click', async () => {
  statusEl.textContent = 'Exporting all three sizes…';
  for (const s of EXPORT_SIZES) {
    await downloadCover(s.id);
    await new Promise((r) => setTimeout(r, 300));
  }
});
document.getElementById('undo').addEventListener('click', undo);
document.getElementById('redo').addEventListener('click', redo);
document.getElementById('reset').addEventListener('click', () => {
  commit();
  const keepPhotos = photos;
  state = defaultState();
  photos = keepPhotos;
  selectedPanel = 0;
  syncAllControls();
  redraw();
  statusEl.textContent = 'Cover reset — your photos are kept.';
});

// ---- test hook for automated checks -----------------------------------------
window.__studio = {
  get state() { return state; },
  set state(next) { state = next; syncAllControls(); redraw(); },
  get photos() { return photos; },
  setPhoto,
  redraw,
  exportCover,
  downloadCover,
  loadImage,
};

// ---- start ------------------------------------------------------------------

const query = new URLSearchParams(location.search);
const shot = query.get('shot');
if (shot) {
  runShot(shot, query, {
    loadImage,
    setPhoto: async (index, url) => { await setPhoto(index, url, true); },
    apply: (patch) => {
      Object.assign(state, patch);
      if (patch.panels) state.panels = patch.panels;
      syncAllControls();
      redraw();
    },
    redraw,
    exportCover,
    canvas,
  });
} else {
  syncAllControls();
  if (document.fonts && document.fonts.ready) {
    document.fonts.load('80px Anton').catch(() => {});
    document.fonts.load('40px Pacifico').catch(() => {});
    document.fonts.ready.then(redraw);
  }
  redraw();
}
