// Neon Shore Cover Studio — editor wiring.
// Owns the app state, the live preview canvas, photo slots, undo/redo and
// the PNG exports. The render engine lives in src/cover.js; the screenshot
// scenes live in src/shots.js.

(function () {
  'use strict';

  var Cover = window.NeonShoreCover;
  var canvas = document.getElementById('preview');
  var ctx = canvas.getContext('2d');

  var state = Cover.defaultState();
  var photos = { A: null, B: null }; // { img, name, src }
  var selectedPanel = 0;
  var undoStack = [];
  var redoStack = [];
  var fontsReady = false;

  // ------------------------------------------------------------ rendering
  function previewSize() {
    var s = Cover.SIZES[state.size] || Cover.SIZES.square;
    var max = 720;
    var k = Math.min(max / s.w, max / s.h);
    return { w: Math.round(s.w * k), h: Math.round(s.h * k) };
  }

  function render() {
    var size = previewSize();
    // In cover-shot mode the canvas fills the viewport at its exact size.
    if (document.body.classList.contains('shot-cover')) {
      size = { w: window.innerWidth, h: window.innerHeight };
    }
    if (canvas.width !== size.w || canvas.height !== size.h) {
      canvas.width = size.w;
      canvas.height = size.h;
    }
    var imgs = { A: photos.A && photos.A.img, B: photos.B && photos.B.img };
    Cover.drawCover(ctx, size.w, size.h, state, imgs);
  }

  function renderWhenFontsReady() {
    if (!fontsReady) return;
    render();
  }

  // Load the two display fonts, then draw. The canvas falls back to a
  // system sans until they arrive, so render again once they are in.
  function loadFonts() {
    var loads = [];
    if (document.fonts && document.fonts.load) {
      loads.push(document.fonts.load('100px Anton'));
      loads.push(document.fonts.load('40px Pacifico'));
    }
    Promise.all(loads).then(function () {
      fontsReady = true;
      render();
    }).catch(function () {
      fontsReady = true;
      render();
    });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { fontsReady = true; render(); });
    }
  }

  // ------------------------------------------------------------ history
  function snapshot() { return JSON.parse(JSON.stringify(state)); }

  function commit() {
    undoStack.push(snapshot());
    if (undoStack.length > 50) undoStack.shift();
    redoStack.length = 0;
    syncUndoButtons();
  }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    state = undoStack.pop();
    syncAll();
    syncUndoButtons();
  }

  function redo() {
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    state = redoStack.pop();
    syncAll();
    syncUndoButtons();
  }

  function syncUndoButtons() {
    document.getElementById('undoBtn').disabled = undoStack.length === 0;
    document.getElementById('redoBtn').disabled = redoStack.length === 0;
  }

  function resetDesign() {
    var keepPhotos = state.panels.map(function (p) { return p.photo; });
    var fresh = Cover.defaultState();
    fresh.size = state.size;
    fresh.panels.forEach(function (p, i) { p.photo = keepPhotos[i] || 'A'; });
    commit();
    state = fresh;
    selectedPanel = 0;
    syncAll();
  }

  // ------------------------------------------------------------ photos
  function setPhoto(slot, img, name, src) {
    photos[slot] = { img: img, name: name, src: src };
    var thumb = document.getElementById(slot === 'A' ? 'thumbA' : 'thumbB');
    thumb.src = src;
    thumb.alt = 'Photo ' + slot + ': ' + name;
    render();
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('could not load ' + src)); };
      img.src = src;
    });
  }

  function loadSample(slot, file) {
    var src = 'samples/' + file;
    return loadImage(src).then(function (img) {
      setPhoto(slot, img, file, src);
    });
  }

  function loadUpload(slot, file) {
    var reader = new FileReader();
    reader.onload = function () {
      loadImage(reader.result).then(function (img) {
        commit();
        setPhoto(slot, img, file.name, reader.result);
      });
    };
    reader.readAsDataURL(file);
  }

  function fillAllWithA() {
    commit();
    state.panels.forEach(function (p) { p.photo = 'A'; });
    syncPanelControls();
    render();
  }

  // ------------------------------------------------------------ export
  function renderToCanvas(sizeKey) {
    var s = Cover.SIZES[sizeKey] || Cover.SIZES.square;
    var out = document.createElement('canvas');
    out.width = s.w;
    out.height = s.h;
    var g = out.getContext('2d');
    var imgs = { A: photos.A && photos.A.img, B: photos.B && photos.B.img };
    Cover.drawCover(g, s.w, s.h, state, imgs);
    return out;
  }

  function slug(text) {
    return (text || 'cover').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cover';
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  }

  function exportPNG(sizeKey) {
    var note = document.getElementById('exportNote');
    var out = renderToCanvas(sizeKey);
    return new Promise(function (resolve) {
      out.toBlob(function (blob) {
        var name = 'neon-shore-' + slug(state.title) + '-' + sizeKey + '.png';
        downloadBlob(blob, name);
        note.textContent = 'Saved ' + name;
        resolve(blob);
      }, 'image/png');
    });
  }

  function exportAll() {
    var keys = ['square', 'portrait', 'wide'];
    var chain = Promise.resolve();
    keys.forEach(function (key) {
      chain = chain.then(function () { return exportPNG(key); });
    });
    return chain;
  }

  // ------------------------------------------------------------ controls
  function buildChips() {
    var layoutRow = document.getElementById('layoutRow');
    Cover.LAYOUT_ORDER.forEach(function (id) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = Cover.LAYOUTS[id].name;
      b.setAttribute('role', 'radio');
      b.dataset.layout = id;
      b.addEventListener('click', function () {
        if (state.layout === id) return;
        commit();
        state.layout = id;
        selectedPanel = 0;
        syncAll();
      });
      layoutRow.appendChild(b);
    });

    var gradeRow = document.getElementById('gradeRow');
    Cover.GRADE_ORDER.forEach(function (id) {
      var g = Cover.GRADES[id];
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'grade-swatch';
      b.title = g.name;
      b.setAttribute('aria-label', g.name);
      b.setAttribute('role', 'radio');
      b.dataset.grade = id;
      b.style.background = 'linear-gradient(135deg,' + g.titleFill[1] + ',' + g.titleFill[2] + ')';
      b.addEventListener('click', function () {
        if (state.grade === id) return;
        commit();
        state.grade = id;
        syncAll();
      });
      gradeRow.appendChild(b);
    });

    var checks = document.getElementById('effectChecks');
    [['grain', 'Grain'], ['vignette', 'Vignette'], ['halftone', 'Halftone'],
     ['rays', 'Sun rays'], ['frame', 'Frame']].forEach(function (pair) {
      var label = document.createElement('label');
      var box = document.createElement('input');
      box.type = 'checkbox';
      box.dataset.effect = pair[0];
      box.addEventListener('change', function () {
        commit();
        state.effects[pair[0]] = box.checked;
        render();
      });
      label.appendChild(box);
      label.appendChild(document.createTextNode(pair[1]));
      checks.appendChild(label);
    });
  }

  function syncAll() {
    // Layout + grade chips.
    document.querySelectorAll('#layoutRow button').forEach(function (b) {
      b.setAttribute('aria-checked', String(b.dataset.layout === state.layout));
    });
    document.querySelectorAll('#gradeRow button').forEach(function (b) {
      b.setAttribute('aria-checked', String(b.dataset.grade === state.grade));
      b.setAttribute('aria-checked', String(b.dataset.grade === state.grade));
    });
    // Text.
    document.getElementById('titleInput').value = state.title;
    document.getElementById('subtitleInput').value = state.subtitle;
    document.getElementById('badgeInput').value = state.badge;
    document.getElementById('sizeSelect').value = state.size;
    // Effects.
    document.querySelectorAll('#effectChecks input').forEach(function (box) {
      box.checked = !!state.effects[box.dataset.effect];
    });
    syncPanelControls();
    render();
  }

  function syncPanelControls() {
    var layout = Cover.LAYOUTS[state.layout];
    var count = layout.panels.length;
    if (selectedPanel >= count) selectedPanel = 0;
    var p = state.panels[selectedPanel];
    document.getElementById('panelName').textContent = '— panel ' + (selectedPanel + 1) + ' of ' + count;
    document.querySelectorAll('#panelPhotoSeg button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.photo === p.photo));
    });
    var zoom = document.getElementById('zoomInput');
    var panX = document.getElementById('panXInput');
    var panY = document.getElementById('panYInput');
    zoom.value = p.zoom;
    panX.value = p.x;
    panY.value = p.y;
    document.getElementById('zoomVal').textContent = Number(p.zoom).toFixed(2) + '×';
    document.getElementById('panXVal').textContent = (p.x >= 0 ? '+' : '') + Number(p.x).toFixed(2);
    document.getElementById('panYVal').textContent = (p.y >= 0 ? '+' : '') + Number(p.y).toFixed(2);
  }

  function bindControls() {
    document.getElementById('fileA').addEventListener('change', function (e) {
      if (e.target.files[0]) loadUpload('A', e.target.files[0]);
    });
    document.getElementById('fileB').addEventListener('change', function (e) {
      if (e.target.files[0]) loadUpload('B', e.target.files[0]);
    });
    document.getElementById('sampleA').addEventListener('click', function () {
      commit();
      loadSample('A', 'boulevard.jpg');
    });
    document.getElementById('sampleB').addEventListener('click', function () {
      commit();
      loadSample('B', 'pier.jpg');
    });
    document.getElementById('fillAllA').addEventListener('click', fillAllWithA);

    document.getElementById('titleInput').addEventListener('input', function (e) {
      state.title = e.target.value;
      render();
    });
    document.getElementById('titleInput').addEventListener('change', commit);
    document.getElementById('subtitleInput').addEventListener('input', function (e) {
      state.subtitle = e.target.value;
      render();
    });
    document.getElementById('subtitleInput').addEventListener('change', commit);
    document.getElementById('badgeInput').addEventListener('input', function (e) {
      state.badge = e.target.value;
      render();
    });
    document.getElementById('badgeInput').addEventListener('change', commit);

    document.getElementById('sizeSelect').addEventListener('change', function (e) {
      commit();
      state.size = e.target.value;
      render();
    });

    document.querySelectorAll('#panelPhotoSeg button').forEach(function (b) {
      b.addEventListener('click', function () {
        if (state.panels[selectedPanel].photo === b.dataset.photo) return;
        commit();
        state.panels[selectedPanel].photo = b.dataset.photo;
        syncPanelControls();
        render();
      });
    });

    document.getElementById('zoomInput').addEventListener('input', function (e) {
      state.panels[selectedPanel].zoom = Number(e.target.value);
      syncPanelControls();
      render();
    });
    document.getElementById('zoomInput').addEventListener('change', commit);
    document.getElementById('panXInput').addEventListener('input', function (e) {
      state.panels[selectedPanel].x = Number(e.target.value);
      syncPanelControls();
      render();
    });
    document.getElementById('panXInput').addEventListener('change', commit);
    document.getElementById('panYInput').addEventListener('input', function (e) {
      state.panels[selectedPanel].y = Number(e.target.value);
      syncPanelControls();
      render();
    });
    document.getElementById('panYInput').addEventListener('change', commit);

    document.getElementById('undoBtn').addEventListener('click', undo);
    document.getElementById('redoBtn').addEventListener('click', redo);
    document.getElementById('resetBtn').addEventListener('click', resetDesign);
    document.getElementById('exportBtn').addEventListener('click', function () {
      exportPNG(state.size);
    });
    document.getElementById('exportAllBtn').addEventListener('click', exportAll);

    bindCanvasPointer();
  }

  // ------------------------------------------------------------ canvas input
  function canvasPoint(e) {
    var r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / r.width,
      y: (e.clientY - r.top) / r.height,
      px: e.clientX - r.left,
      py: e.clientY - r.top,
    };
  }

  function bindCanvasPointer() {
    var dragging = null;

    canvas.addEventListener('pointerdown', function (e) {
      var pt = canvasPoint(e);
      var hit = Cover.hitPanel(state, pt.x, pt.y);
      if (hit === -1) return;
      selectedPanel = hit;
      syncPanelControls();
      var p = state.panels[hit];
      var img = (p.photo === 'A' ? photos.A : photos.B);
      dragging = {
        startX: pt.px, startY: pt.py,
        panX: p.x, panY: p.y,
        img: img ? img.img : null,
        zoom: p.zoom,
        rect: canvas.getBoundingClientRect(),
      };
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    canvas.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var pt = canvasPoint(e);
      var dx = pt.px - dragging.startX;
      var dy = pt.py - dragging.startY;
      var p = state.panels[selectedPanel];
      if (dragging.img) {
        // Convert canvas pixels to pan fractions: pan moves the photo by a
        // fraction of its drawn size.
        var rect = canvas.getBoundingClientRect();
        var scale = Math.max(
          (canvas.width * 0.5) / dragging.img.naturalWidth,
          (canvas.height * 0.5) / dragging.img.naturalHeight
        ) * dragging.zoom;
        var dw = dragging.img.naturalWidth * scale;
        var dh = dragging.img.naturalHeight * scale;
        p.x = clamp(dragging.panX - dx / dw * (canvas.width / rect.width), -0.5, 0.5);
        p.y = clamp(dragging.panY - dy / dh * (canvas.height / rect.height), -0.5, 0.5);
      } else {
        p.x = clamp(dragging.panX - dx / canvas.width, -0.5, 0.5);
        p.y = clamp(dragging.panY - dy / canvas.height, -0.5, 0.5);
      }
      syncPanelControls();
      render();
    });

    canvas.addEventListener('pointerup', function () {
      if (dragging) commit();
      dragging = null;
    });

    canvas.addEventListener('wheel', function (e) {
      var pt = canvasPoint(e);
      var hit = Cover.hitPanel(state, pt.x, pt.y);
      if (hit === -1) return;
      e.preventDefault();
      var p = state.panels[hit];
      p.zoom = clamp(p.zoom * (1 - e.deltaY * 0.001), 1, 3);
      selectedPanel = hit;
      syncPanelControls();
      render();
    }, { passive: false });
  }

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  // ------------------------------------------------------------ public API
  window.NeonShore = {
    state: function () { return state; },
    setState: function (next) { state = next; syncAll(); },
    photos: photos,
    render: render,
    renderToCanvas: renderToCanvas,
    exportPNG: exportPNG,
    exportAll: exportAll,
    loadSample: loadSample,
    loadImage: loadImage,
    selectPanel: function (i) { selectedPanel = i; syncPanelControls(); render(); },
    commit: commit,
    undo: undo,
    redo: redo,
    resetDesign: resetDesign,
    fontsReady: function () { return fontsReady; },
  };

  // ------------------------------------------------------------ boot
  buildChips();
  bindControls();
  syncAll();
  syncUndoButtons();
  loadFonts();
  render();
  // Open with both sample photos loaded, so the editor is useful at once.
  loadSample('A', 'boulevard.jpg');
  loadSample('B', 'pier.jpg');
})();
