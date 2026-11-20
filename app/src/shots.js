// Neon Shore Cover Studio — fixed scenes for screenshots.
// ?shot=cover draws one exported cover full-frame (editor chrome hidden by
// body.shot-cover); ?shot=editor shows the editor with photos loaded.
// Params: layout, grade, title (or caption), subtitle, badge, photo
// (boulevard|pier — the A photo; B gets the other sample), size.
// Sets window.__shotReady once fonts and photos are in and a frame is painted.
(function () {
  'use strict';

  var params = new URLSearchParams(location.search);
  var shot = params.get('shot');
  if (!shot) return;

  function param(name, fallback) {
    var v = params.get(name);
    return v === null || v === '' ? fallback : v;
  }

  function loadFonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([
      document.fonts.load('100px Anton'),
      document.fonts.load('40px Pacifico'),
    ]).catch(function () {});
  }

  function run() {
    var app = window.NeonShore;
    var Cover = window.NeonShoreCover;
    if (!app || !Cover) { window.__shotReady = true; return; }

    var current = app.state();
    var photo = param('photo', 'boulevard');
    var next = JSON.parse(JSON.stringify(current));
    var layout = param('layout', 'heroRight');
    var grade = param('grade', 'neonNights');
    var size = param('size', 'square');
    if (Cover.LAYOUTS[layout]) next.layout = layout;
    if (Cover.GRADES[grade]) next.grade = grade;
    if (Cover.SIZES[size]) next.size = size;
    next.title = param('caption', param('title', 'NEON SHORE'));
    next.subtitle = param('subtitle', 'one last summer');
    next.badge = param('badge', 'PALM COAST');

    var main = photo === 'pier' ? 'pier.jpg' : 'boulevard.jpg';
    var other = photo === 'pier' ? 'boulevard.jpg' : 'pier.jpg';

    Promise.all([loadFonts(), app.loadSample('A', main), app.loadSample('B', other)])
      .then(function () {
        app.setState(next);
        if (shot === 'cover') document.body.classList.add('shot-cover');
        return document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
      })
      .then(function () {
        app.render();
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { window.__shotReady = true; });
        });
      })
      .catch(function (err) {
        window.__shotError = String((err && err.message) || err);
        window.__shotReady = true;
      });
  }

  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run);
})();
