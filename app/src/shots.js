// Fixed scenes for screenshots: ?shot=editor shows the studio with sample
// photos loaded; ?shot=cover shows one exported cover full-frame, with the
// controls hidden. `photo` picks the sample, `caption` the title, `size`
// the export size (square, portrait or wide), `grade` the colour grade,
// `layout` the panel layout. window.__shotReady is set once painted.
import { EXPORT_SIZES } from './cover.js';

const SAMPLES = { boulevard: 'samples/boulevard.jpg', pier: 'samples/pier.jpg' };

export async function runShot(shot, query, api) {
  const sizeId = query.get('size') || 'square';
  const size = EXPORT_SIZES.find((s) => s.id === sizeId) || EXPORT_SIZES[0];
  const title = query.get('caption') || 'Neon Shore';
  const subtitle = query.get('subtitle') || 'one last summer';
  const badge = query.get('badge') || 'Palm Coast';
  const layout = query.get('layout') || 'heroLeft';
  const grade = query.get('grade') || 'viceSunset';
  const photoA = query.get('photo') || 'boulevard';
  const photoB = query.get('photoB') || 'pier';

  if (shot === 'cover') document.body.classList.add('shot-cover');

  await api.setPhoto(0, SAMPLES[photoA] || SAMPLES.boulevard);
  await api.setPhoto(1, SAMPLES[photoB] || SAMPLES.pier);

  api.apply({
    layout,
    grade,
    title,
    subtitle,
    badge,
    size: sizeId,
    panels: [
      { photo: 0, zoom: 1.05, dx: 0, dy: 0 },
      { photo: 1, zoom: 1.1, dx: 0, dy: -0.03 },
      { photo: 0, zoom: 1.18, dx: 0.02, dy: -0.02 },
      { photo: 1, zoom: 1.2, dx: -0.04, dy: 0.02 },
    ],
  });

  // The cover scene draws at the viewport's own size so the screenshot is
  // the app's own drawing at that size; the editor scene keeps the preview.
  if (shot === 'cover') {
    api.canvas.width = size.w;
    api.canvas.height = size.h;
    api.redraw();
  }

  if (document.fonts && document.fonts.ready) {
    try {
      await Promise.race([
        Promise.all([
          document.fonts.load('80px Anton'),
          document.fonts.load('40px Pacifico'),
        ]),
        new Promise((r) => setTimeout(r, 3000)),
      ]);
    } catch { /* fall back to system fonts */ }
    api.redraw();
  }

  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
