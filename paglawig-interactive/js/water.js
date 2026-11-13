/* =========================================================
   Water effects — marine snow drifting in the sea
   Particles live in map coordinates, so they pan and zoom
   with the map instead of sliding over the screen.
   Hidden behind the landmass: they only show over water.
   ========================================================= */
(function () {
'use strict';

var cv, ctx, W = 0, H = 0, dpr = 1;
var parts = [], raf = null, last = 0, api = null, running = false;

var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function rnd(a, b) { return a + Math.random() * (b - a); }

function make(n) {
  parts = [];
  for (var i = 0; i < n; i++) parts.push(newParticle());
}

function newParticle() {
  return {
    x: rnd(0, 1000), y: rnd(0, 1746),
    r: rnd(0.7, 2.3), a: rnd(0.10, 0.34),
    vx: rnd(-0.10, 0.10), vy: rnd(0.16, 0.62),
    ph: rnd(0, Math.PI * 2), sw: rnd(0.5, 1.6),
    depth: Math.random() < 0.22 ? 1 : 0
  };
}

function resize() {
  if (!cv) return;
  var r = cv.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  W = Math.max(1, Math.round(r.width));
  H = Math.max(1, Math.round(r.height));
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  var want = Math.round(Math.min(150, Math.max(45, (W * H) / 14000)));
  if (Math.abs(want - parts.length) > 12) make(want);
}

function frame(ts) {
  if (!running) return;
  var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016;
  last = ts;

  var v = api.view();            // { s: px per map unit, k: zoom }
  var upp = 1 / (v.s * v.k);     // map units per screen pixel
  var vb = api.bounds();         // visible map-unit rect {x0,y0,x1,y1}

  ctx.clearRect(0, 0, W, H);

  for (var i = 0; i < parts.length; i++) {
    var p = parts[i];
    p.ph += dt * p.sw;
    p.y += p.vy * dt * 60 * upp;
    p.x += (p.vx + Math.sin(p.ph) * 0.055) * dt * 60 * upp;

    if (p.y > vb.y1) { p.y = vb.y0 - 6; p.x = rnd(vb.x0, vb.x1); }
    if (p.x < vb.x0 - 20) p.x = vb.x1 + 10;
    if (p.x > vb.x1 + 20) p.x = vb.x0 - 10;

    var s = api.project(p.x, p.y);          // map units -> screen px
    if (s[0] < -12 || s[0] > W + 12 || s[1] < -12 || s[1] > H + 12) continue;

    var r = p.depth ? p.r * 2.6 : p.r;
    var a = p.depth ? p.a * 0.42 : p.a;
    ctx.beginPath();
    ctx.arc(s[0], s[1], r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
    ctx.fill();
  }

  raf = requestAnimationFrame(frame);
}

function drawStatic() {
  var v = api.view();
  ctx.clearRect(0, 0, W, H);
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i];
    var s = api.project(p.y, p.x);
    if (s[0] < 0 || s[0] > W || s[1] < 0 || s[1] > H) continue;
    ctx.beginPath();
    ctx.arc(s[0], s[1], p.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,' + (p.a * 0.8).toFixed(3) + ')';
    ctx.fill();
  }
}

window.WaterFX = {
  init: function (canvas, cfg) {
    cv = canvas; ctx = cv.getContext('2d'); api = cfg;
    resize(); make(120);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { running = false; cancelAnimationFrame(raf); }
      else if (!reduce) { running = true; last = 0; raf = requestAnimationFrame(frame); }
    });
    if (reduce) drawStatic();
    else { running = true; raf = requestAnimationFrame(frame); }
  },
  resize: function () { resize(); if (reduce) drawStatic(); }
};
})();