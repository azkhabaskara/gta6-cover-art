// Neon Shore Cover Studio — editor wiring.
// State, undo/redo, photo slots, per-panel crop/pan/zoom, PNG export, and
// the window.NeonShore bridge the screenshot scenes use.
import { drawCover, defaultState, LAYOUTS, GRADES, SIZES, panelAt } from './cover.js';

const $ = (id) => document.getElementById(id);
const canvas = $('cover');
const statusEl = $('status');

let state = defaultState();
let photos = { A: null, B: null };
let selectedPanel = 0;
let undoStack = [];
let redoStack = [];

function snapshot() { return JSON.stringify(state); }
function pushHistory() {
  undoStack.push(snapshot());
  if (undoStack.length > 60) undoStack.shift();
  redoStack = [];
  syncUndoButtons();
}
function applySnapshot(json) {
  state = JSON.parse(json);
  selectedPanel = Math.min(selectedPanel, panelCount() - 1);
  syncControls();
  render();
}
function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  applySnapshot(undoStack.pop());
  syncUndoButtons();
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  applySnapshot(redoStack.pop());
  syncUndoButtons();
}
function syncUndoButtons() {
  $('undo').disabled = !undoStack.length;
  $('redo').disabled = !redoStack.length;
}

function panelCount() {
  return (LAYOUTS[state.layout] || LAYOUTS.heroRight).panels.length;
}

function render() {
  const size = SIZES[state.size] || SIZES.square;
  if (canvas.width !== size.w || canvas.height !== size.h) {
    canvas.width = size.w;
    canvas.height = size.h;
  }
  drawCover(canvas, state, photos);
  const n = panelCount();
  $('panelLabel').textContent = `Panel ${selectedPanel + 1} of ${n}`;
  const adj = state.panels[selectedPanel];
  $('zoom').value = adj.zoom;
  $('zoomVal').textContent = `${Math.round(adj.zoom * 100)}%`;
  $('panX').value = adj.ox;
  $('panY').value = adj.oy;
  $('photoA').classList.toggle('active', adj.photo === 'A');
  $('photoB').classList.toggle('active', adj.photo === 'B');
}

function setStatus(msg) { statusEl.textContent = msg; }

function commit(mutator, label) {
  pushHistory();
  mutator();
  syncControls();
  render();
  if (label) setStatus(label);
}

// --- controls ---------------------------------------------------------------

function buildPickers() {
  const layoutBox = $('layouts');
  Object.entries(LAYOUTS).forEach(([key, def]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick';
    b.dataset.layout = key;
    b.textContent = def.label;
    b.addEventListener('click', () => {
      if (state.layout === key) return;
      commit(() => {
        state.layout = key;
        selectedPanel = 0;
      }, `Layout: ${def.label}`);
    });
    layoutBox.appendChild(b);
  });

  const gradeBox = $('grades');
  Object.entries(GRADES).forEach(([key, def]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.dataset.grade = key;
    b.title = def.label;
    b.style.background = `linear-gradient(135deg, rgb(${def.shadow.join(',')}), rgb(${def.mid.join(',')}) 55%, rgb(${def.high.join(',')}))`;
    const span = document.createElement('span');
    span.textContent = def.label;
    b.appendChild(span);
    b.addEventListener('click', () => {
      if (state.grade === key) return;
      commit(() => { state.grade = key; }, `Grade: ${def.label}`);
    });
    gradeBox.appendChild(b);
  });

  const sizeBox = $('sizes');
  Object.entries(SIZES).forEach(([key, def]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick';
    b.dataset.size = key;
    b.textContent = def.label;
    b.addEventListener('click', () => {
      if (state.size === key) return;
      commit(() => { state.size = key; }, `Export size: ${def.label}`);
    });
    sizeBox.appendChild(b);
  });
}

function syncControls() {
  document.querySelectorAll('[data-layout]').forEach((b) =>
    b.classList.toggle('active', b.dataset.layout === state.layout));
  document.querySelectorAll('[data-grade]').forEach((b) =>
    b.classList.toggle('active', b.dataset.grade === state.grade));
  document.querySelectorAll('[data-size]').forEach((b) =>
    b.classList.toggle('active', b.dataset.size === state.size));
  $('title').value = state.title;
  $('subtitle').value = state.subtitle;
  $('badge').value = state.badge;
  Object.entries(state.effects).forEach(([key, on]) => {
    const box = $(`fx-${key}`);
    if (box) box.checked = !!on;
  });
}

function bindControls() {
  $('title').addEventListener('input', (e) => { state.title = e.target.value; render(); });
  $('title').addEventListener('change', () => pushHistory());
  $('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; render(); });
  $('subtitle').addEventListener('change', () => pushHistory());
  $('badge').addEventListener('input', (e) => { state.badge = e.target.value; render(); });
  $('badge').addEventListener('change', () => pushHistory());

  Object.keys(state.effects).forEach((key) => {
    $(`fx-${key}`).addEventListener('change', (e) => {
      commit(() => { state.effects[key] = e.target.checked; },
        `${key} ${e.target.checked ? 'on' : 'off'}`);
    });
  });

  $('zoom').addEventListener('input', (e) => {
    state.panels[selectedPanel].zoom = Number(e.target.value);
    render();
  });
  $('zoom').addEventListener('change', () => pushHistory());
  $('panX').addEventListener('input', (e) => {
    state.panels[selectedPanel].ox = Number(e.target.value);
    render();
  });
  $('panX').addEventListener('change', () => pushHistory());
  $('panY').addEventListener('input', (e) => {
    state.panels[selectedPanel].oy = Number(e.target.value);
    render();
  });
  $('panY').addEventListener('change', () => pushHistory());

  $('photoA').addEventListener('click', () => {
    commit(() => { state.panels[selectedPanel].photo = 'A'; }, 'Panel uses photo A');
  });
  $('photoB').addEventListener('click', () => {
    commit(() => { state.panels[selectedPanel].photo = 'B'; }, 'Panel uses photo B');
  });
  $('panelPrev').addEventListener('click', () => {
    selectedPanel = (selectedPanel + panelCount() - 1) % panelCount();
    render();
  });
  $('panelNext').addEventListener('click', () => {
    selectedPanel = (selectedPanel + 1) % panelCount();
    render();
  });

  $('undo').addEventListener('click', undo);
  $('redo').addEventListener('click', redo);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
  });

  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * canvas.width;
    const y = ((e.clientY - r.top) / r.height) * canvas.height;
    const hit = panelAt(state, x, y, canvas.width, canvas.height);
    if (hit >= 0) { selectedPanel = hit; render(); setStatus(`Selected panel ${hit + 1}`); }
  });

  $('exportPng').addEventListener('click', () => exportPng(state.size));
  $('exportAll').addEventListener('click', exportAll);
}

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('could not read that image'));
    img.src = URL.createObjectURL(file);
  });
}

function bindPhotos() {
  const wire = (inputId, slot) => {
    $(inputId).addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        photos[slot] = await loadImageFile(file);
        render();
        setStatus(`Photo ${slot} loaded: ${file.name}`);
      } catch (err) {
        setStatus(`Photo ${slot} failed to load.`);
      }
    });
  };
  wire('uploadA', 'A');
  wire('uploadB', 'B');
  $('sampleA').addEventListener('click', () => loadSample('A', 'boulevard.jpg'));
  $('sampleB').addEventListener('click', () => loadSample('B', 'pier.jpg'));
}

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function loadSample(slot, file) {
  try {
    photos[slot] = await loadImage(`samples/${file}`);
    render();
    setStatus(`Sample ${slot} loaded (${file})`);
  } catch {
    setStatus(`Sample ${file} failed to load.`);
  }
}

// --- export -----------------------------------------------------------------

function download(canvasEl, filename) {
  return new Promise((resolve) => {
    canvasEl.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      resolve();
    }, 'image/png');
  });
}

async function exportPng(sizeKey) {
  const size = SIZES[sizeKey] || SIZES.square;
  const off = document.createElement('canvas');
  off.width = size.w; off.height = size.h;
  drawCover(off, { ...state, size: sizeKey }, photos);
  await download(off, `neon-shore-${size.w}x${size.h}.png`);
  setStatus(`Saved neon-shore-${size.w}x${size.h}.png`);
}

async function exportAll() {
  for (const key of Object.keys(SIZES)) {
    // eslint-disable-next-line no-await-in-loop
    await exportPng(key);
  }
  setStatus('Saved all three sizes.');
}

// --- screenshot bridge ------------------------------------------------------

window.NeonShore = {
  state: () => JSON.parse(JSON.stringify(state)),
  setState(next) {
    pushHistory();
    state = { ...defaultState(), ...next };
    selectedPanel = 0;
    syncControls();
  },
  render,
  loadSample,
};

async function boot() {
  buildPickers();
  bindControls();
  bindPhotos();
  syncControls();
  syncUndoButtons();
  // Wait for the vendored fonts so the first paint already uses them.
  try {
    if (document.fonts) {
      await Promise.all([
        document.fonts.load('100px Anton'),
        document.fonts.load('40px Pacifico'),
      ]);
    }
  } catch { /* fall back to system fonts */ }
  // In screenshot mode (?shot=…) shots.js owns sample loading, so the
  // boot-time samples must not race it and overwrite the shot's photos.
  // (v3 race: boot loaded boulevard→A / pier→B while a shot wanted
  // pier→A / boulevard→B, so shots 1 & 4 sometimes showed the photos
  // swapped. Skipping the boot samples in shot mode fixes it.)
  const shotMode = new URLSearchParams(location.search).has('shot');
  if (!shotMode) {
    await Promise.all([loadSample('A', 'boulevard.jpg'), loadSample('B', 'pier.jpg')]);
  }
  render();
  setStatus('Samples loaded. Pick a layout and a grade, then export.');
}

boot();
