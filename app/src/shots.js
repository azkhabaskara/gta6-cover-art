// Neon Shore Cover Studio — screenshot scenes.
// ?shot=cover draws one exported cover full-frame (the editor chrome is
// hidden by body.shot-cover); ?shot=editor shows the editor with a photo
// loaded. Both set window.__shotReady once the fonts and photos are in, so
// the screenshot runner knows the scene is settled.
//
// Params: layout, grade, title (or caption), subtitle, badge, photo
// (boulevard|pier — the A photo; B gets the other sample), size.

(function () {
  'use strict';

  var params = new URLSearchParams(location.search);
  var shot = params.get('shot');
  if (!shot) return;

  var app = window.NeonShore;
  var Cover = window.NeonShoreCover;

  function param(name, fallback) {
    var v = params.get(name);
    return v === null || v === '' ? fallback : v;
  }

  function buildState() {
    var current = app.state();
    var photo = param('photo', 'boulevard');
    var next = JSON.parse(JSON.stringify(current));
    var layout = param('layout', 'heroRight');
    var grade = param('grade', 'neonNights');
    if (Cover.LAYOUTS[layout]) next.layout = layout;
    if (Cover.GRADES[grade]) next.grade = grade;
    next.title = param('caption', param('title', 'NEON SHORE'));
    next.subtitle = param('subtitle', 'one last summer');
    next.badge = param('badge', 'PALM COAST');
    var size = param('size', 'square');
    if (Cover.SIZES[size]) next.size = size;
    return { next: next, photo: photo };
  }

  function loadFonts() {
    var loads = [];
    if (document.fonts && document.fonts.load) {
      loads.push(document.fonts.load('100px Anton'));
      loads.push(document.fonts.load('40px Pacifico'));
    }
    return Promise.all(loads).catch(function () {});
  }

  function run() {
    var scene = buildState();
    var other = scene.photo === 'pier' ? 'boulevard.jpg' : 'pier.jpg';
    var main = scene.photo === 'pier' ? 'pier.jpg' : 'boulevard.jpg';

    return Promise.all([
      loadFonts(),
      app.loadSample('A', main),
      app.loadSample('B', other),
    ]).then(function () {
      app.setState(scene.next);
      if (shot === 'cover') {
        document.body.classList.add('shot-cover');
      }
      // One more render after the fonts land, then signal readiness.
      return (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve())
        .then(function () {
          app.render();
          window.__shotReady = true;
        });
    }).catch(function (err) {
      window.__shotError = String(err && err.message || err);
      window.__shotReady = true;
    });
  }

  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run);
})();
