/* =========================================================
   PAGLAWIG — Interactive Shipwreck Sites
   ========================================================= */
(function () {
'use strict';

var D = window.MUCHD;
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

var svg = $('#phmap'), zoomLayer = $('#zoomLayer'), landPath = $('#landPath'),
    provLayer = $('#provLayer'), overlay = $('#pinOverlay'), stage = $('#mapstage'),
    panelScroll = $('#panelScroll'), tip = $('#tip');

var lang = 'en';
var mapData = null;
var sitesById = {}, periodById = {};
var cur = { period: null, site: null };
var pins = {};       // id -> {g, ll, hidden, sx, sy, side}
var M = null, OV = { left: 0, top: 0 };
var hoverId = null;

/* ---------- text helpers ---------- */
function t(o) { return (o == null) ? '' : (typeof o === 'string' ? o : (o[lang] || o.en || '')); }
function locOf(s) { return t(s.location); }
function discOf(s) { return t(s.discovery).replace(/^(Discovery|Nakaplagan)\s*:\s*/i, ''); }

/* ---------- projection (must match js/mapdata.js exactly) ---------- */
function project(lat, lon) {
  var m = mapData.merc;
  return [lon * Math.PI / 180 * m.s + m.dx,
          -Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * m.s + m.dy];
}
/* inverse: map units -> degrees */
function unproject(ux, uy) {
  var m = mapData.merc;
  var lon = (ux - m.dx) / m.s * 180 / Math.PI;
  var ym = (uy - m.dy) / m.s;
  var lat = (Math.atan(Math.exp(-ym)) - Math.PI / 4) * 360 / Math.PI;
  return [lat, lon];
}

/* =========================================================
   PIN POSITIONS  (editable — see Pin Editor)
   priority: localStorage  >  js/pins.js  >  data.js
   ========================================================= */
var LS_KEY = 'paglawig.pinpos.v1';
var store = { ok: true, data: {} };
try {
  store.data = JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {};
} catch (e) { store.ok = false; store.data = {}; }

var filePos = window.PINPOSITIONS || {};

function posFor(id) {
  var s = sitesById[id];
  var o = store.data[id] || filePos[id];
  if (o && isFinite(o[0]) && isFinite(o[1])) return [o[0], o[1]];
  return [s.lat, s.lon];
}
function defaultPos(id) {
  var s = sitesById[id];
  return [s.lat, s.lon];
}
function isEdited(id) {
  var o = store.data[id] || filePos[id], d = defaultPos(id);
  return !!(o && (Math.abs(o[0] - d[0]) > 1e-9 || Math.abs(o[1] - d[1]) > 1e-9));
}
function setPos(id, ll) {
  store.data[id] = [round6(ll[0]), round6(ll[1])];
  pins[id].ll = store.data[id];
  saveStore();
  syncEditor();
  applyT();
}
function round6(v) { return Math.round(v * 1e6) / 1e6; }
function saveStore() {
  if (!store.ok) return;
  try { localStorage.setItem(LS_KEY, JSON.stringify(store.data)); }
  catch (e) { store.ok = false; }
}

/* =========================================================
   MAP METRICS  (viewBox -> pixels, preserveAspectRatio=meet)
   ========================================================= */
function metrics() {
  var r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
  var s = Math.min(r.width / vb.width, r.height / vb.height);
  return { r: r, vb: vb, s: s,
           ox: (r.width - vb.width * s) / 2,
           oy: (r.height - vb.height * s) / 2 };
}

var T = { k: 1, x: 0, y: 0 };
var MIN_K = 1, MAX_K = 30;

function applyT() {
  M = metrics();
  T.k = Math.max(MIN_K, Math.min(MAX_K, T.k));
  zoomLayer.setAttribute('transform',
    'translate(' + T.x.toFixed(2) + ',' + T.y.toFixed(2) + ') scale(' + T.k.toFixed(4) + ')');

  overlay.setAttribute('viewBox', '0 0 ' + M.r.width.toFixed(1) + ' ' + M.r.height.toFixed(1));
  overlay.setAttribute('width', M.r.width);
  overlay.setAttribute('height', M.r.height);
  var ovr = overlay.getBoundingClientRect();
  OV.left = ovr.left; OV.top = ovr.top;
  updateFurniture();

  // screen-space pin placement (constant pixel size at any zoom)
  var placed = [];
  D.sites.forEach(function (s) {
    var p = pins[s.id];
    if (!p) return;
    var u = project(p.ll[0], p.ll[1]);
    var ux = T.x + u[0] * T.k, uy = T.y + u[1] * T.k;
    var sx = ux * M.s + M.ox, sy = uy * M.s + M.oy;
    p.g.setAttribute('transform', 'translate(' + sx.toFixed(1) + ',' + sy.toFixed(1) + ')');
    p.sx = sx; p.sy = sy;
    var off = p.hidden
      || sx < -80 || sx > M.r.width + 80 || sy < -60 || sy > M.r.height + 60;
    p.g.style.display = off ? 'none' : '';
    if (!off) placed.push(p);
  });

  /* Label placement: try a ring of candidate spots around each pin and take the
     first that clears the other pins and the labels already placed. There is no
     zoom cutoff — names stay on screen at every scale. */
  placed.sort(function (a, b) {
    var w = (b.id === cur.site) - (a.id === cur.site);
    return w || a.sy - b.sy;
  });
  var CANDS = [
    [12, -34, 'start'], [-12, -34, 'end'],
    [12, 20, 'start'],  [-12, 20, 'end'],
    [0, -50, 'middle'], [0, 34, 'middle'],
    [24, -28, 'start'], [-24, -28, 'end'],
    [24, 12, 'start'],  [-24, 12, 'end']
  ];
  var boxes = [];
  placed.forEach(function (p) {
    var lbl = p.g.querySelector('.lbl');
    if (editing) {                       // editor shows every name, no culling
      lbl.style.opacity = 1;
      lbl.setAttribute('x', 0);
      lbl.setAttribute('text-anchor', 'middle');
      lbl.setAttribute('y', -40);
      return;
    }
    var lw = p.name.length * 6.4 + 12, lh = 15;
    var best = null;
    for (var c = 0; c < CANDS.length && !best; c++) {
      var dx = CANDS[c][0], dy = CANDS[c][1], an = CANDS[c][2];
      var x1 = an === 'start' ? p.sx + dx : an === 'end' ? p.sx + dx - lw : p.sx + dx - lw / 2;
      var y1 = p.sy + dy - lh / 2;
      var box = { x1: x1, y1: y1, x2: x1 + lw, y2: y1 + lh };
      var clash = false;
      for (var j = 0; j < placed.length && !clash; j++) {
        var o = placed[j];
        if (o === p) continue;
        var r = 11;                        // keep clear of the pin glyph
        if (box.x1 < o.sx + r && box.x2 > o.sx - r
            && box.y1 < o.sy + 5 && box.y2 > o.sy - 26) clash = true;
      }
      for (var i = 0; i < boxes.length && !clash; i++) {
        var b = boxes[i];
        if (box.x1 < b.x2 && box.x2 > b.x1 && box.y1 < b.y2 && box.y2 > b.y1) clash = true;
      }
      if (!clash) { boxes.push(box); best = { dx: dx, dy: dy, an: an }; }
    }
    if (best) {
      lbl.style.opacity = 1;
      lbl.setAttribute('x', best.dx);
      lbl.setAttribute('y', best.dy);
      lbl.setAttribute('text-anchor', best.an);
    } else {
      lbl.style.opacity = 0;
    }
  });
  /* keep the tooltip glued to its pin while the map moves */
  if (hoverId && pins[hoverId] && pins[hoverId].g.style.display !== 'none') {
    tip.style.left = (OV.left + pins[hoverId].sx).toFixed(1) + 'px';
    tip.style.top = (OV.top + pins[hoverId].sy - 26).toFixed(1) + 'px';
  }

  // editor crosshair follows the selected pin
  if (editing && selId && pins[selId] && guides && guides.style.display !== 'none') {
    var sp = pins[selId], su = project(sp.ll[0], sp.ll[1]);
    var gx = (T.x + su[0] * T.k) * M.s + M.ox, gy = (T.y + su[1] * T.k) * M.s + M.oy;
    var ls = guides.children;
    ls[0].setAttribute('x1', gx); ls[0].setAttribute('x2', gx);
    ls[0].setAttribute('y1', 0);    ls[0].setAttribute('y2', M.r.height);
    ls[1].setAttribute('y1', gy);   ls[1].setAttribute('y2', gy);
    ls[1].setAttribute('x1', 0);    ls[1].setAttribute('x2', M.r.width);
    ls[2].setAttribute('cx', gx);   ls[2].setAttribute('cy', gy);
  }

  /* The tap-wreck only makes sense while a site is open. Without this, leaving
     mid-animation strands a ship sinking over the overview map. */
  if (sinkMark && !cur.site) stopSink();
}

function zoomAt(cx, cy, factor) {
  stopCam();
  var k2 = Math.max(MIN_K, Math.min(MAX_K, T.k * factor));
  var real = k2 / T.k;
  var ux = (cx - M.ox) / M.s, uy = (cy - M.oy) / M.s;
  T.x = ux - (ux - T.x) * real;
  T.y = uy - (uy - T.y) * real;
  T.k = k2;
  applyT();
}
function zoomCentre(f) { zoomAt(M.r.width / 2, M.r.height / 2, f); }
/* cursor (client px) -> map user units, undoing the current zoom/pan */
function screenToMap(cx, cy) {
  var r = svg.getBoundingClientRect();
  var sx = (cx - r.left - M.ox) / M.s;
  var sy = (cy - r.top - M.oy) / M.s;
  return unproject((sx - T.x) / T.k, (sy - T.y) / T.k);
}
function centreOn(ux, uy, k) {
  T.k = Math.max(MIN_K, Math.min(MAX_K, k));
  T.x = (M.r.width / 2 - M.ox) / M.s - ux * T.k;
  T.y = (M.r.height / 2 - M.oy) / M.s - uy * T.k;
  applyT();
}

/* Animated camera moves are driven here rather than with a CSS transition.
   The pins live in a separate overlay positioned from applyT(), so anything
   that moves the map without re-running applyT() every frame leaves them
   floating off the coastline — visible as a glitch on the way back Home. */
var camRAF = null;
function stopCam() {
  if (camRAF) { cancelAnimationFrame(camRAF); camRAF = null; }
}
function flyTo(tx, ty, k, ms) {
  stopCam();
  var from = { x: T.x, y: T.y, k: T.k };
  var to = { x: tx, y: ty, k: Math.max(MIN_K, Math.min(MAX_K, k)) };
  if (Math.abs(from.x - to.x) < 0.5 && Math.abs(from.y - to.y) < 0.5
      && Math.abs(from.k - to.k) < 0.001) { applyT(); return; }
  var t0 = performance.now();
  (function step(now) {
    var f = Math.min(1, (now - t0) / ms);
    var e = 1 - Math.pow(1 - f, 3);            // ease-out cubic
    T.x = from.x + (to.x - from.x) * e;
    T.y = from.y + (to.y - from.y) * e;
    T.k = from.k + (to.k - from.k) * e;
    applyT();
    camRAF = f < 1 ? requestAnimationFrame(step) : null;
  })(t0);
}

function resetMap(anim) {
  stopCam();
  if (anim) flyTo(0, 0, 1, 700);
  else { T.k = 1; T.x = 0; T.y = 0; applyT(); }
}

/* ---------- drag (delta in px -> divide by user-unit scale) ---------- */
var drag = null;
stage.addEventListener('pointerdown', function (e) {
  if (e.target.closest('.pin')) return;
  stopCam();
  drag = { x: e.clientX, y: e.clientY, ox: T.x, oy: T.y, id: e.pointerId, moved: 0 };
  stage.classList.add('dragging');
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener('pointermove', function (e) {
  if (!drag || e.pointerId !== drag.id) return;
  var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.moved = Math.max(drag.moved, Math.abs(dx) + Math.abs(dy));
  T.x = drag.ox + dx / M.s;
  T.y = drag.oy + dy / M.s;
  applyT();
});
function endDrag(e) {
  if (!drag || (e && e.pointerId !== drag.id)) return;
  stage.classList.remove('dragging');
  drag = null;
}
stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', endDrag);
stage.addEventListener('wheel', function (e) {
  e.preventDefault();
  var r = svg.getBoundingClientRect();
  zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.18 : 1 / 1.18);
}, { passive: false });

$('#zin').onclick  = function () { zoomCentre(1.55); };
$('#zout').onclick = function () { zoomCentre(1 / 1.55); };
$('#zreset').onclick = function () { resetMap(true); };

/* =========================================================
   BUILD
   ========================================================= */
function buildMap() {
  return new Promise(function (res, rej) {
    if (!window.PHMAP) return rej(new Error('map data missing'));
    var m = window.PHMAP;
    mapData = m;
    landPath.setAttribute('d', m.land);
    var h = '';
    m.provinces.forEach(function (p) { h += '<path d="' + p.d + '"/>'; });
    provLayer.innerHTML = h;
    buildPins();
    res();
  });
}

var PIN_PATH = 'M0 0c-5.2 0-9.3 4.1-9.3 9.2C-9.3 16.1 0 26.4 0 26.4S9.3 16.1 9.3 9.2C9.3 4.1 5.2 0 0 0z';

/* a small junk ship, drawn side-on and listing as she goes down */
var SHIP_ART =
    '<path class="wash" d="M4 62c14 5 34 5 48 0 14-5 34-5 48 0"/>'
  + '<path class="ship" d="M10 44h92l-9 17H19z"/>'
  + '<path class="ship" d="M40 44V6M76 44V16"/>'
  + '<path class="ship" d="M42 9c14 3 22 17 21 35H42z"/>'
  + '<path class="ship" d="M74 18c10 4 14 15 13 26H74z"/>'
  + '<path class="ship" d="M40 6l11 4-11 4z"/>';

var SHIP_SCALE = 0.36;
/* visual centre of the artwork, so the hull sits on the pin rather than beside it */
var SHIP_CX = 53, SHIP_CY = 34;
function shipXf(scale) {
  return 'translate(' + (-SHIP_CX * scale).toFixed(2) + ',' + (-SHIP_CY * scale).toFixed(2) +
         ') scale(' + scale + ')';
}

/* The wreck that plays when a pin is tapped.
   Position and animation live on separate elements: a CSS `transform` overrides
   the SVG transform attribute, so they must not share a node. */
function buildSinkMark() {
  var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('id', 'sinkLayer');
  g.setAttribute('aria-hidden', 'true');
  g.innerHTML = '<g class="sinkpos" id="sinkpos"><g class="sinkmark" id="sinkmark">'
              + '<g transform="' + shipXf(SHIP_SCALE * 1.15) + '">'
              + '<g class="gb"><circle class="q1" cx="24" cy="50" r="7"/>'
              + '<circle class="q2" cx="54" cy="53" r="5"/>'
              + '<circle class="q3" cx="78" cy="50" r="6"/></g>'
              + SHIP_ART + '</g></g></g>';
  overlay.appendChild(g);
  sinkMark = g.querySelector('#sinkmark');
  sinkPos = g.querySelector('#sinkpos');
}

var sinkMark = null, sinkPos = null;

/* The wreck that plays when a pin is tapped.
   Driven with the Web Animations API rather than a CSS class: re-triggering a
   CSS animation on an SVG node is unreliable, because style changes coalesce and
   the previous run simply carries on. `animate()` always builds a fresh one. */
var SINK_KEYS = [
  { offset: 0,    opacity: 0,    transform: 'translate(-30px,-6px) rotate(0deg)' },
  { offset: 0.09, opacity: 0.95 },
  { offset: 0.34, opacity: 0.92, transform: 'translate(-6px,0) rotate(4deg)' },
  { offset: 0.58, opacity: 0.74, transform: 'translate(5px,15px) rotate(14deg)' },
  { offset: 0.80, opacity: 0.40, transform: 'translate(13px,35px) rotate(25deg)' },
  { offset: 0.93, opacity: 0.14, transform: 'translate(18px,49px) rotate(32deg)' },
  { offset: 1,    opacity: 0,    transform: 'translate(21px,58px) rotate(36deg)' }
];

function playSink(pin) {
  if (!sinkMark || !sinkPos || editing || !pin || pin.sx === undefined) return;
  if (pin.sx < -40 || pin.sx > M.r.width + 40 || pin.sy < -40 || pin.sy > M.r.height + 40) return;

  sinkPos.setAttribute('transform',
    'translate(' + pin.sx.toFixed(1) + ',' + pin.sy.toFixed(1) + ')');
  stopSink();
  sinkMark.animate(SINK_KEYS, {
    duration: 2900,
    easing: 'cubic-bezier(.4,.06,.55,1)',
    fill: 'forwards'
  });
}

function stopSink() {
  if (!sinkMark || !sinkMark.getAnimations) return;
  sinkMark.getAnimations().forEach(function (a) { a.cancel(); });
}

function buildPins() {
  var h = '';
  D.sites.forEach(function (s, i) {
    var col = periodById[s.period].color;
    h += '<g class="pin enter" data-site="' + s.id + '" tabindex="0" role="button" '
      +  'aria-label="' + s.name + '" style="--pin:' + col + ';animation-delay:' + (i * 32) + 'ms">'
      +  '<g class="bub">'
      +    '<circle class="b1" cx="-4.5" cy="14" r="2.5"/>'
      +    '<circle class="b2" cx="3.5" cy="14" r="1.8"/>'
      +    '<circle class="b3" cx="0" cy="14" r="2.1"/>'
      +  '</g>'
      +  '<circle class="pulse" cx="0" cy="0" r="14"/>'
      +  '<circle class="pulse r2" cx="0" cy="0" r="14"/>'
      +  '<circle class="pulse r3" cx="0" cy="0" r="14"/>'
      +  '<circle class="hit" cx="0" cy="6" r="23"/>'
      +  '<path class="shape" d="' + PIN_PATH + '" transform="translate(0,-9)"/>'
      +  '<circle class="dot" cx="0" cy="0.4" r="3.4" fill="#fff"/>'
      +  '<text class="lbl" y="-36">' + s.name + '</text>'
      +  '</g>';
  });
  overlay.innerHTML = h;

  D.sites.forEach(function (s) {
    var g = overlay.querySelector('.pin[data-site="' + s.id + '"]');
    pins[s.id] = { g: g, id: s.id, name: s.name, ll: posFor(s.id), hidden: false };
    g.addEventListener('click', function () { if (!editing) openSite(s.id); });
    g.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSite(s.id); }
    });
    g.addEventListener('pointerenter', showTip);
    g.addEventListener('pointerleave', hideTip);
  });
  applyT();
  setTimeout(function () {
    $$('.pin', overlay).forEach(function (g) { g.classList.remove('enter'); });
  }, 1700);
}

/* the tooltip is anchored to the pin above it, so it stays put when the map
   moves and never drifts away from the pin it describes */
function showTip(e) {
  hoverId = e.currentTarget.getAttribute('data-site');
  var s = sitesById[hoverId];
  tip.textContent = s.name + ' · ' + periodById[s.period].short;
  tip.classList.add('show');
  placeTip();
}
function placeTip() {
  var p = pins[hoverId];
  if (!p) return;
  tip.style.left = (OV.left + p.sx).toFixed(1) + 'px';
  tip.style.top = (OV.top + p.sy - 26).toFixed(1) + 'px';
}
function hideTip() { hoverId = null; tip.classList.remove('show'); }

/* =========================================================
   FILTER / CAMERA
   ========================================================= */
function applyFilter() {
  D.sites.forEach(function (s) {
    var p = pins[s.id];
    if (!p) return;
    /* On the overview no pins are shown at all — the visitor picks a period
       first, and only that period's wrecks appear. Pin Editor is the exception:
       every pin must be visible and draggable regardless. */
    var show = editing ? true : (!!cur.period && s.period === cur.period);
    p.hidden = !show;
    p.g.classList.toggle('on', cur.site === s.id);
  });
  $$('#legend .lg').forEach(function (b) {
    b.classList.toggle('on', b.getAttribute('data-p') === cur.period);
  });
  $$('#periodList .pcard').forEach(function (c) {
    c.classList.toggle('on', c.getAttribute('data-p') === cur.period);
  });
  applyT();
}

function framePeriod() {
  if (!cur.period) { resetMap(true); return; }
  var ps = periodById[cur.period].sites.map(function (id) { return project(pins[id].ll[0], pins[id].ll[1]); });
  if (!ps.length) return;
  var xs = ps.map(function (p) { return p[0]; }), ys = ps.map(function (p) { return p[1]; });
  var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
  var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
  var pad = 110;
  var kw = ((maxX - minX) + pad * 2) * M.s / M.r.width;
  var kh = ((maxY - minY) + pad * 2) * M.s / M.r.height;
  centreOn((minX + maxX) / 2, (minY + maxY) / 2, Math.max(MIN_K, Math.min(6, Math.min(kw, kh))));
}
function focusSite(id) {
  var p = pins[id];
  var u = project(p.ll[0], p.ll[1]);
  centreOn(u[0], u[1], Math.max(T.k < 5 ? 5 : T.k, 5));
}

/* =========================================================
   VIEWS
   ========================================================= */
function showView(n) {
  $$('.view').forEach(function (v) { v.hidden = v.getAttribute('data-view') !== n; });
  panelScroll.scrollTop = 0;
}

var CAL_ICO = '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>';
var PIN_ICO = '<svg viewBox="0 0 24 24"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/></svg>';
var SHIP_ICO = '<svg viewBox="0 0 24 24"><path d="M12 3c-2.6 4-4.4 5.8-4.4 9.4V16h8.8v-3.6C16.4 8.8 14.6 7 12 3z"/><path d="M4 18h16M3 21c2.6 1.7 5.6 2.6 9 2.6S18.4 22.7 21 21c-2.6 2.8-5.6 3.9-9 3.9S5.6 23.8 3 21z"/><path d="M12 3v13"/></svg>';
var CAM_ICO = '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3.8"/><path d="M8 6l1.4-2h5.2L16 6"/></svg>';

function renderCrumbs() {
  var c = $('#crumbs'), h = '';
  h += '<button class="crumb' + (cur.site ? '' : ' cur') + '" data-go="home">'
     + t(D.mapTitle) + '</button>';
  if (cur.period) {
    h += '<span class="crumb-sep">/</span><button class="crumb' + (cur.site ? '' : ' cur')
       + '" data-go="period" data-p="' + cur.period + '">' + periodById[cur.period].short + '</button>';
  }
  if (cur.site) {
    h += '<span class="crumb-sep">/</span><button class="crumb cur" data-go="site">'
       + sitesById[cur.site].name + '</button>';
  }
  c.innerHTML = h;
  $$('.crumb', c).forEach(function (b) {
    b.onclick = function () {
      var g = b.getAttribute('data-go');
      if (g === 'home') goHome();
      else if (g === 'period') openPeriod(b.getAttribute('data-p'), true);
      else openSite(cur.site);
    };
  });
}

function goHome(keepZoom) {
  cur.period = null; cur.site = null;
  showView('home'); renderHome(); renderCrumbs();
  if (!keepZoom) resetMap(true);
}

/* ---------- century icons ----------
   One vessel per period, so the icon tells you which century you are looking
   at before you read the label. The sequence is chronological and each vessel
   is the one actually associated with that period of Philippine maritime trade:
     13th  balangay      pre-colonial outrigger
     15th  Chinese junk  battened lugsails dominate regional trade
     16-17 Spanish galleon colonial era
     18-19 steamship     the East Indiaman / steam transition
   Drawn on a shared 64x40 grid and filled with currentColor.                 */
var PERIOD_ICON = {
  c13: '<path d="M14 35c11 4 29 4 40 0-11 5-29 5-40 0Z"/>'
     + '<path d="M20 30h2.8v7H20zM41.2 30h2.8v7h-2.8z"/>'
     + '<path d="M2 23C10 20 18 22 32 24c14 2 22 0 30-3-4 9-14 13-30 13S6 32 2 23Z"/>'
     + '<path d="M25 17h14v6H25zM31.4 5h1.7v12h-1.7z"/>',
  c15: '<path d="M17 3h2.2v24H17zM31 1h2.2v26H31zM45 5h2.2v22h-2.2z"/>'
     + '<path d="M6 26h44l9 3q-5 8-27 9T6 26Z"/><path d="M51 15h11v10H51z"/>'
     + '<path d="M9 6h14v6H9zM9 13h14v6H9zM9 20h14v6H9z'
     + 'M25 3.5h14v6H25zM25 10.5h14v6H25zM25 17.5h14v6H25z'
     + 'M40.5 8h10v5h-10zM40.5 14h10v5h-10zM40.5 20h10v4h-10z"/>',
  c16: '<path d="M13.8 2h2v23h-2zM29.8 .5h2v24.5h-2zM42.8 5h2v20h-2z"/>'
     + '<path d="M8 22q8-3 16-2h20q12 0 16 3-4 9-26 10T8 22Z"/><path d="M50 12h11v10H50z"/>'
     + '<path d="M7 9h13v7H7zM23.5 5h13v7H23.5zM38 11h10v6H38z"/>',
  c18: '<circle cx="33.5" cy="5.5" r="2.7" opacity=".5"/><circle cx="40" cy="2.4" r="2" opacity=".36"/>'
     + '<path d="M4 22q9-3 17-2h22q11 0 16 4-4 9-27 10Q8 33 4 22Z"/>'
     + '<path d="M12 13.5h22V22H12zM27 3.5h8l-1.4 10h-5.2Z"/><path d="M42.5 11h1.7v11h-1.7z"/>'
};
var PERIOD_VESSEL = { c13: 'Balangay', c15: 'Chinese junk', c16: 'Spanish galleon', c18: 'Steamship' };
function periodIcon(pid, cls) {
  var b = PERIOD_ICON[pid];
  if (!b) return '';
  return '<svg class="' + (cls || '') + '" viewBox="0 0 64 40" fill="currentColor" aria-hidden="true"'
       + ' role="img" data-vessel="' + (PERIOD_VESSEL[pid] || '') + '">' + b + '</svg>';
}

function renderHome() {
  $('#screenTitle').textContent = t(D.mapTitle);
  $('#homeLede').textContent = lang === 'ceb'
    ? 'Piliin ang yugto aron makita ang mga nalunod nga barko niini nga panahon, o pinduta ang mapa mismo.'
    : 'Choose a period to see the shipwrecks of that time on the map, or tap a location directly.';
  $('#homeStat').innerHTML = PIN_ICO + '<span>' + (lang === 'ceb'
    ? D.sites.length + ' ka nalunod nga barko sa ' + D.periods.length + ' ka yugto. Piliin ang mapa aron makita ang kada posisyon.'
    : D.sites.length + ' shipwrecks across ' + D.periods.length + ' periods. Select any period, or tap a pin on the map.') + '</span>';

  var pl = $('#periodList'), h = '';
  D.periods.forEach(function (p) {
    h += '<button class="pcard" data-p="' + p.id + '" style="--c:' + p.color + '">'
      + '<span class="pcard-ico">' + periodIcon(p.id, 'pcard-ship')
        + '<span class="pcard-vessel">' + PERIOD_VESSEL[p.id] + '</span></span>'
      + '<span class="pcard-tx"><b>' + (lang === 'ceb' ? p.nameCeb : p.nameEn) + '</b>'
      + '<i>' + (lang === 'ceb' ? p.nameEn : p.nameCeb) + '</i></span>'
      + '<span class="pcard-n">' + p.sites.length + '</span></button>';
  });
  pl.innerHTML = h;
  $$('.pcard', pl).forEach(function (c) {
    c.onclick = function () { openPeriod(c.getAttribute('data-p')); };
  });

  var lg = $('#legend'), lh = '';
  D.periods.forEach(function (p) {
    lh += '<button class="lg" data-p="' + p.id + '" style="--c:' + p.color + '"'
        + ' title="' + PERIOD_VESSEL[p.id] + '">'
        + periodIcon(p.id, 'lg-ico')
        + '<span class="lg-tx"><b>' + p.short + '</b><i>' + PERIOD_VESSEL[p.id] + '</i></span>'
        + ' <em>' + p.sites.length + '</em></button>';
  });
  lg.innerHTML = lh;
  $$('.lg', lg).forEach(function (b) {
    b.onclick = function () {
      var id = b.getAttribute('data-p');
      if (cur.period === id) goHome(); else openPeriod(id);
    };
  });

  renderAll();
  applyFilter();
  $('#startTour').onclick = startTour;
}

/* ---- all-wrecks finder (tier 1: a way in when no pin is showing) ---- */
function renderAll(q) {
  q = (q || '').trim().toLowerCase();
  var box = $('#allList'), h = '';

  D.periods.forEach(function (p) {
    var rows = '';
    p.sites.forEach(function (sid) {
      var s = sitesById[sid];
      if (q && (s.name + ' ' + locOf(s) + ' ' + p.nameEn + ' ' + p.short).toLowerCase().indexOf(q) === -1) return;
      rows += '<button class="arow" data-s="' + sid + '" style="--c:' + p.color + '">'
        + '<span class="arow-dot"></span>'
        + '<span class="arow-tx"><b>' + s.name + '</b><i>' + locOf(s) + '</i></span>'
        + '<span class="arow-n">' + (lang === 'ceb' ? 'kitaa' : '') + '</span></button>';
    });
    if (!rows) return;
    h += '<div class="agroup">' + (lang === 'ceb' ? p.nameCeb : p.nameEn) + '</div>' + rows;
  });

  box.innerHTML = h;
  $('#finderEmpty').hidden = !!h;
  $$('.arow', box).forEach(function (b) {
    b.onclick = function () { openSite(b.getAttribute('data-s')); };
  });
}

function openPeriod(id, fromCrumb) {
  var p = periodById[id];
  if (!p) return;
  var changed = cur.period !== id;
  cur.period = id; cur.site = null;
  showView('period');

  $('#pHero').style.setProperty('--c', p.color);
  $('#pHeroImg').src = 'assets/graphics/art-' + p.art + '.jpg';
  $('#pHeroImg').alt = '';
  $('#pRange').textContent = p.range;
  $('#pName').textContent = lang === 'ceb' ? p.nameCeb : p.nameEn;
  $('#pNameCeb').textContent = lang === 'ceb' ? p.nameEn : p.nameCeb;
  $('#pShipsLbl').textContent = lang === 'ceb' ? 'Mga Nalunod nga Barko' : 'Shipwrecks';

  var bh = '';
  p.body[lang].forEach(function (x) { bh += '<p' + (lang === 'ceb' ? ' class="cb"' : '') + '>' + x + '</p>'; });
  $('#pBody').innerHTML = bh;

  var sh = '';
  p.sites.forEach(function (sid) {
    var s = sitesById[sid];
    sh += '<button class="ship" data-s="' + sid + '" style="--c:' + p.color + '">'
      + '<span class="ship-dot"></span>'
      + '<span class="ship-tx"><b>' + s.name + '</b><i>' + locOf(s) + '</i></span>'
      + '<span class="ship-n">' + s.photos.length + CAM_ICO + '</span></button>';
  });
  $('#shipList').innerHTML = sh;
  $$('.ship', $('#shipList')).forEach(function (x) {
    x.onclick = function () { openSite(x.getAttribute('data-s')); };
  });

  renderCrumbs(); applyFilter();
  if (changed && !fromCrumb) framePeriod();
}

function openSite(id) {
  var s = sitesById[id];
  if (!s) return;
  if (!cur.period) cur.period = s.period;
  cur.site = id;
  showView('site');
  renderSite(s);
  renderCrumbs(); applyFilter();
  focusSite(id);
  playSink(pins[id]);
  logVisit('site', id);
}

function renderSite(s) {
  var p = periodById[s.period];
  var hero = $('#sHeroImg');
  if (s.photos.length) {
    hero.src = s.photos[0];
    hero.alt = s.name;
    $('#shero').classList.remove('art');
  } else {
    hero.src = 'assets/graphics/art-' + p.art + '.jpg';
    hero.alt = '';
    $('#shero').classList.add('art');
  }
  $('#sLoc').textContent = locOf(s);
  $('#sName').textContent = s.name;
  $('#sNameCeb').textContent = (lang === 'ceb' || s.title.ceb === s.title.en) ? '' : s.title.ceb;
  $('#sGalLbl').textContent = lang === 'ceb' ? 'Mga Litrato' : 'Photographs';

  $('#sFacts').innerHTML =
      '<span class="fact period" style="--c:' + p.color + '">' + periodIcon(s.period, 'fact-ship') + '<span>' + p.short + '</span></span>'
    + '<span class="fact" style="--c:' + p.color + '">' + CAL_ICO + '<span>'
    + (lang === 'ceb' ? 'Nakaplagan' : 'Discovered') + ': ' + discOf(s) + '</span></span>'
    + '<span class="fact" style="--c:' + p.color + '">' + PIN_ICO + '<span>' + locOf(s) + '</span></span>';

  var bh = '';
  s.body[lang].forEach(function (x) { bh += '<p' + (lang === 'ceb' ? ' class="cb"' : '') + '>' + x + '</p>'; });
  $('#sBody').innerHTML = bh;

  renderGallery(s);
}

/* ---------- photo resolution ----------
   Thumbs are generated once (see README): 480px tiles for the grid and a
   1280px "hi_" version for the lightbox and site hero. Falling back to the
   original keeps the app working even if the thumbs folder is missing.   */
var HAVE_THUMBS = true;                       /* flipped off if thumbs fail */
function thumb(p) { return 'assets/photos/thumbs/' + p.split('/').pop(); }
function hero_(p) { return 'assets/photos/thumbs/hi_' + p.split('/').pop(); }
function tileSrc(p) { return HAVE_THUMBS ? thumb(p) : p; }
function fullSrc(p) { return HAVE_THUMBS ? hero_(p) : p; }

/* A gallery tile that 404s should degrade quietly, not show a broken icon. */
function onImgFail(img, p) {
  if (img.dataset.failed) return;
  img.dataset.failed = '1';
  if (HAVE_THUMBS && img.src.indexOf('/thumbs/') !== -1) {
    HAVE_THUMBS = false;                       /* thumbs missing: use originals */
    img.src = p;
    return;
  }
  img.classList.add('img-bad');
  img.parentElement.classList.add('gi-bad');
}

function renderGallery(s) {
  var g = $('#sGallery');
  if (!s.photos.length) {
    g.innerHTML = '<div class="no-photo">'
      + '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 16l5-4 4 3 3-2 6 5"/><circle cx="8.5" cy="9.5" r="1.5"/></svg>'
      + '<div>' + (lang === 'ceb'
        ? 'Wala pang litrato nga naa alang sa niining lugar. Palonghok ang teksto, ug isip ang lugar sa mapa.'
        : 'Photographs for this site are not yet available. Read the text, and find the site on the map.') + '</div></div>';
    return;
  }
  var h = '';
  s.photos.forEach(function (p, i) {
    h += '<button class="gi" data-i="' + i + '">'
      + '<img loading="lazy" decoding="async" src="' + tileSrc(p) + '" data-full="' + p + '" alt="'
      + s.name + ' photograph ' + (i + 1) + '">'
      + '<span>' + (i + 1) + '/' + s.photos.length + '</span></button>';
  });
  g.innerHTML = h;
  $$('.gi', g).forEach(function (b) {
    b.onclick = function () { openLightbox(s, +b.getAttribute('data-i')); };
  });
}

/* error does not bubble, so this listens in the capture phase */
$('#sGallery').addEventListener('error', function (e) {
  var img = e.target;
  if (img && img.tagName === 'IMG') onImgFail(img, img.getAttribute('data-full') || '');
}, true);

/* ---------- lightbox ---------- */
var lb = $('#lightbox'), lbImg = $('#lbImg'), lbCap = $('#lbCap'), lbCount = $('#lbCount');
var lbStage = $('#lbStage'), lbNote = $('#lbNote');
var lbSite = null, lbIdx = 0;

/* ---------- artifact zoom ----------
   The photographs are of porcelain, coins and ceramics: the whole point is
   seeing the decoration, so the lightbox pans and zooms rather than just
   fitting the frame. Pointer events cover mouse, pen and touch together. */
var lbZoom = 1, lbPanX = 0, lbPanY = 0;
var LB_MIN = 1, LB_MAX = 6;

function applyLbTransform() {
  lbImg.style.transform = 'translate(' + lbPanX.toFixed(1) + 'px,' + lbPanY.toFixed(1) + 'px) scale(' + lbZoom.toFixed(3) + ')';
  lb.classList.toggle('zoomed', lbZoom > 1.02);
  var hint = $('#lbZoomHint');
  if (hint) hint.style.opacity = lbZoom > 1.02 ? '0' : '';
}
function lbClampPan() {
  var r = lbStage.getBoundingClientRect();
  var lim = Math.max(0, (r.width * lbZoom - r.width) / 2);
  var limY = Math.max(0, (r.height * lbZoom - r.height) / 2);
  lbPanX = Math.max(-lim, Math.min(lim, lbPanX));
  lbPanY = Math.max(-limY, Math.min(limY, lbPanY));
}
function lbZoomAt(cx, cy, factor) {
  var r = lbStage.getBoundingClientRect();
  var ox = cx - (r.left + r.width / 2), oy = cy - (r.top + r.height / 2);
  var z0 = lbZoom, z1 = Math.max(LB_MIN, Math.min(LB_MAX, z0 * factor));
  if (z1 === z0) return;
  lbPanX = ox * (z1 / z0 - 1) + lbPanX;
  lbPanY = oy * (z1 / z0 - 1) + lbPanY;
  lbZoom = z1;
  lbClampPan();
  applyLbTransform();
}
function lbReset() { lbZoom = 1; lbPanX = 0; lbPanY = 0; applyLbTransform(); }

lbStage.addEventListener('wheel', function (e) {
  e.preventDefault();
  lbZoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.18 : 1 / 1.18);
}, { passive: false });

var lbPts = new Map(), lbLastDist = 0, lbMoved = false;
lbStage.addEventListener('pointerdown', function (e) {
  lbPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  lbMoved = false;
  if (lbPts.size === 1) lbStage.setPointerCapture(e.pointerId);
  if (lbPts.size === 2) {
    var a = Array.from(lbPts.values());
    lbLastDist = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
  }
});
lbStage.addEventListener('pointermove', function (e) {
  if (!lbPts.has(e.pointerId)) return;
  var prev = lbPts.get(e.pointerId);
  lbPts.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (lbPts.size === 2) {                        /* pinch */
    var a = Array.from(lbPts.values());
    var d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
    if (lbLastDist > 0) {
      lbZoomAt((a[0].x + a[1].x) / 2, (a[0].y + a[1].y) / 2, d / lbLastDist);
      lbMoved = true;
    }
    lbLastDist = d;
  } else if (lbZoom > 1.02) {                    /* pan while zoomed */
    lbPanX += e.clientX - prev.x;
    lbPanY += e.clientY - prev.y;
    lbMoved = true;
    lbClampPan();
    applyLbTransform();
  }
});
function lbEndPtr(e) {
  lbPts.delete(e.pointerId);
  if (lbPts.size < 2) lbLastDist = 0;
}
lbStage.addEventListener('pointerup', lbEndPtr);
lbStage.addEventListener('pointercancel', lbEndPtr);
lbStage.addEventListener('dblclick', function (e) {
  e.preventDefault();
  if (lbZoom > 1.02) lbReset(); else lbZoomAt(e.clientX, e.clientY, 2.5);
});
function openLightbox(s, i) { lbSite = s; lbIdx = i; lb.hidden = false; showLb(); }
function showLb() {
  var p = lbSite.photos[lbIdx];
  lbImg.src = fullSrc(p);
  lbImg.alt = lbSite.name + ' photograph ' + (lbIdx + 1);
  lbZoom = 1; lbPanX = 0; lbPanY = 0; applyLbTransform();
  lbCount.textContent = (lbIdx + 1) + ' / ' + lbSite.photos.length;
  lbCap.textContent = lbSite.name;
  lbNote.textContent = photoCaption(lbSite);
  logVisit('photo', lbSite.id);
}
function step(d) { lbIdx = (lbIdx + d + lbSite.photos.length) % lbSite.photos.length; showLb(); }
function closeLb() { lb.hidden = true; lbSite = null; }
$('#lbClose').onclick = closeLb;
$('#lbPrev').onclick = function () { step(-1); };
$('#lbNext').onclick = function () { step(1); };
lb.onclick = function (e) { if (e.target === lb) closeLb(); };
document.addEventListener('keydown', function (e) {
  if (lb.hidden) return;
  if (e.key === 'Escape') closeLb();
  else if (e.key === 'ArrowLeft') step(-1);
  else if (e.key === 'ArrowRight') step(1);
});
var sx = 0;
lb.addEventListener('pointerdown', function (e) { sx = e.clientX; });
lb.addEventListener('pointerup', function (e) {
  /* swipe only when not zoomed - while zoomed the same drag pans the artifact */
  if (lbSite && lbZoom <= 1.02 && Math.abs(e.clientX - sx) > 55) step(e.clientX < sx ? 1 : -1);
});

/* =========================================================
   PIN EDITOR  (maintenance mode)
   enter: ?edit=1 in the URL, or Ctrl+Shift+E
   ========================================================= */
var editing = false, selId = null, dragPin = null;
var eb = {}, guides = null;

function buildEditor() {
  eb.bar   = $('#editbar');
  eb.site  = $('#ebSite');
  eb.lat   = $('#ebLat');
  eb.lon   = $('#ebLon');
  eb.status= $('#ebStatus');
  eb.read  = $('#ebReadout');

  D.sites.forEach(function (s) {
    var o = document.createElement('option');
    o.value = s.id; o.textContent = s.name;
    eb.site.appendChild(o);
  });

  guides = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  guides.setAttribute('id', 'guides');
  guides.setAttribute('class', 'guides');
  guides.innerHTML =
      '<line class="guide" x1="0" y1="0" x2="0" y2="0"></line>'
    + '<line class="guide" x1="0" y1="0" x2="0" y2="0"></line>'
    + '<circle class="guide-dot" cx="0" cy="0" r="20"></circle>';
  guides.style.display = 'none';
  overlay.appendChild(guides);

  eb.site.onchange = function () { select(eb.site.value, true); eb.site.blur(); };
  eb.lat.onchange = eb.lon.onchange = function () {
    var la = parseFloat(eb.lat.value), lo = parseFloat(eb.lon.value);
    if (isFinite(la) && isFinite(lo)) setPos(selId, [la, lo]);
    syncEditor();
    eb.lat.blur(); eb.lon.blur();
  };
  $('#ebReset').onclick = function () {
    if (!selId) return;
    delete store.data[selId];
    pins[selId].ll = posFor(selId);
    saveStore(); syncEditor(); applyT(); say('Pin reset to default', 'ok');
  };
  $('#ebResetAll').onclick = function () {
    if (!confirm('Reset ALL pin positions on this device back to the defaults?\n\nSaved pins.js (if present) is not affected.')) return;
    store.data = {}; saveStore();
    D.sites.forEach(function (s) { pins[s.id].ll = posFor(s.id); });
    syncEditor(); applyT(); say('All pins reset to defaults', 'ok');
  };
  $('#ebExport').onclick = exportPins;
  $('#ebClose').onclick = function () { setEditing(false); };
}

function setEditing(on) {
  editing = !!on;
  document.body.classList.toggle('editing', editing);
  eb.bar.hidden = !editing;
  if (!editing) { selId = null; guides.style.display = 'none'; }
  else {
    if (!store.ok) say('This browser blocks local saving — use "Save pins.js".', 'warn');
    select(selId || D.sites[0].id, true);
    var c = unproject((M.r.width / 2 - M.ox) / M.s, (M.r.height / 2 - M.oy) / M.s);
    eb.read.textContent = c[0].toFixed(4) + '\u00b0  ' + c[1].toFixed(4) + '\u00b0';
  }
  applyFilter();
}

function select(id, focus) {
  selId = id;
  $$('.pin', overlay).forEach(function (g) { g.classList.toggle('sel', g.getAttribute('data-site') === id); });
  guides.style.display = editing ? '' : 'none';
  eb.site.value = id;
  syncEditor();
  if (focus && editing) {
    var p = pins[id], u = project(p.ll[0], p.ll[1]);
    // always bring the pin into view; zoom in a little if we were wide out
    centreOn(u[0], u[1], T.k < 3 ? 3.5 : T.k);
  }
}
function syncEditor() {
  if (!editing || !selId) return;
  var ll = posFor(selId);
  if (document.activeElement !== eb.lat) eb.lat.value = ll[0].toFixed(5);
  if (document.activeElement !== eb.lon) eb.lon.value = ll[1].toFixed(5);
}
function say(msg, kind) {
  eb.status.textContent = msg;
  eb.status.className = 'eb-status' + (kind ? ' ' + kind : '');
  clearTimeout(say._t);
  if (kind === 'ok') say._t = setTimeout(function () { eb.status.textContent = ''; }, 3600);
}

/* ---- dragging ---- */
overlay.addEventListener('pointerdown', function (e) {
  if (!editing) return;
  var g = e.target.closest('.pin');
  if (!g) { selId = null; guides.style.display = 'none';
            $$('.pin', overlay).forEach(function (x) { x.classList.remove('sel'); }); return; }
  var id = g.getAttribute('data-site');
  select(id, false);
  var p = pins[id];
  dragPin = { id: id, id_: e.pointerId, sx: e.clientX, sy: e.clientY,
              ll0: [p.ll[0], p.ll[1]] };
  g.setPointerCapture(e.pointerId);
  stage.classList.add('dragging');
  e.preventDefault();
});
overlay.addEventListener('pointermove', function (e) {
  if (!editing) return;
  var ll = screenToMap(e.clientX, e.clientY);
  eb.read.textContent = ll[0].toFixed(4) + '\u00b0  ' + ll[1].toFixed(4) + '\u00b0';

  if (!dragPin || e.pointerId !== dragPin.id_) return;
  setPos(dragPin.id, ll);
});
function endPinDrag(e) {
  if (!dragPin || (e && e.pointerId !== dragPin.id_)) return;
  stage.classList.remove('dragging');
  dragPin = null;
  say('Position saved on this device', 'ok');
}
overlay.addEventListener('pointerup', endPinDrag);
overlay.addEventListener('pointercancel', endPinDrag);

/* arrow-key nudge on the selected pin */
document.addEventListener('keydown', function (e) {
  if (e.ctrlKey && e.shiftKey && (e.key === 'E' || e.key === 'e')) {
    e.preventDefault(); setEditing(!editing); return;
  }
  if (!editing || !selId) return;
  if (e.key === 'Escape') { setEditing(false); return; }
  if (/^(INPUT|SELECT|TEXTAREA)$/.test((e.target.tagName || ''))) return;
  var step = e.shiftKey ? 10 : 1;
  var dx = 0, dy = 0;
  if (e.key === 'ArrowLeft') dx = -step;
  else if (e.key === 'ArrowRight') dx = step;
  else if (e.key === 'ArrowUp') dy = -step;
  else if (e.key === 'ArrowDown') dy = step;
  else return;
  e.preventDefault();
  var ll = posFor(selId);
  var u = project(ll[0], ll[1]);
  setPos(selId, unproject(u[0] + dx / (M.s * T.k), u[1] + dy / (M.s * T.k)));
});

/* ---- export ---- */
function exportPins() {
  var out = { 'san-antonio': [0, 0] };
  var merged = {};
  Object.keys(filePos).forEach(function (k) { merged[k] = filePos[k]; });
  Object.keys(store.data).forEach(function (k) { merged[k] = store.data[k]; });

  var lines = ['/* Pin positions - PAGLAWIG',
               '   Edited with the in-app Pin Editor (?edit=1 or Ctrl+Shift+E).',
               '   Keep this file in the js/ folder so every kiosk uses the same positions.',
               '   Values are [latitude, longitude] in decimal degrees. */',
               'window.PINPOSITIONS = {'];
  Object.keys(merged).sort().forEach(function (k) {
    var d = defaultPos(k);
    var v = merged[k];
    var moved = Math.abs(v[0] - d[0]) > 1e-9 || Math.abs(v[1] - d[1]) > 1e-9;
    lines.push('  ' + JSON.stringify(k) + ': [' + round6(v[0]) + ', ' + round6(v[1]) + ']'
               + (moved ? '' : '   // unchanged'));
  });
  lines.push('};');
  var blob = new Blob([lines.join('\n')], { type: 'text/javascript' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'pins.js';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  say('Downloaded pins.js - copy it into the js/ folder', 'ok');
}

/* =========================================================
   LANG / INIT
   ========================================================= */
$$('.lang-b').forEach(function (b) {
  b.onclick = function () {
    if (b.getAttribute('data-lang') === lang) return;
    lang = b.getAttribute('data-lang');
    $$('.lang-b').forEach(function (x) { x.classList.toggle('is-on', x === b); });
    document.documentElement.lang = lang === 'ceb' ? 'fil' : 'en';
    var ks = cur.site, kp = cur.period;
    renderHome();
    if (ks) openSite(ks); else if (kp) openPeriod(kp, true); else renderCrumbs();
  };
});
$('#homeBtn').onclick = function () { goHome(); };

var hint = $('#maphint');
function showHint(msg, ms) {
  hint.firstElementChild.textContent = msg;
  hint.classList.add('show');
  clearTimeout(showHint._t);
  showHint._t = setTimeout(function () { hint.classList.remove('show'); }, ms || 3400);
}

function init() {
  D.periods.forEach(function (p) { periodById[p.id] = p; });
  D.sites.forEach(function (s) { sitesById[s.id] = s; });
  M = metrics();

  buildMap().then(function () {
    renderHome(); renderCrumbs(); showView('home'); applyT();
  attractStrings();
    placeInstruments();
    buildEditor();
    buildSinkMark();

    var si = $('#siteSearch');
    si.addEventListener('input', function () { renderAll(si.value); });

    applyT();
    initWater();
    if (/[?&]edit=1/.test(location.search)) setEditing(true);
    setTimeout(function () {
      if (editing) return;
      showHint(lang === 'ceb'
        ? 'Piliin ang yugto, o pinduta ang mapa aron makita ang mga lokasyon'
        : 'Pick a period, or tap the map to explore the locations', 4600);
    }, 800);
    $('#boot').classList.add('done');
  }).catch(function (err) {
    $('#boot').innerHTML = '<div class="boot-in"><p class="boot-t">Map data failed to load</p></div>';
    console.error(err);
  });
}

/* =========================================================
   WATER EFFECTS (marine snow)
   Particles live in map coordinates and are projected each
   frame, so they drift with the sea rather than over the UI.
   ========================================================= */
function initWater() {
  if (!window.WaterFX) return;
  try {
    window.WaterFX.init($('#seafloor'), {
    /* map user units -> screen pixels (applies the current zoom + pan) */
    project: function (ux, uy) {
      return [(T.x + ux * T.k) * M.s + M.ox,
              (T.y + uy * T.k) * M.s + M.oy];
    },
    view: function () { return { s: M.s, k: T.k }; },
    bounds: function () {
      var ux0 = -T.x / T.k, uy0 = -T.y / T.k;
      var ux1 = (M.r.width / M.s - M.ox - T.x) / T.k;
      var uy1 = (M.r.height / M.s - M.oy - T.y) / T.k;
      return { x0: ux0 - 20, y0: uy0 - 20, x1: ux1 + 20, y1: uy1 + 20 };
    }
    });
  } catch (e) {
    /* decorative only — never let it stop the exhibit */
    console.warn('WaterFX unavailable:', e);
  }
}

var rt;
window.addEventListener('resize', function () {
  clearTimeout(rt);
  rt = setTimeout(function () {
    applyT();
    placeInstruments();
    if (window.WaterFX) window.WaterFX.resize();
  }, 90);
});
/* ---------- photo captions ----------
   Everything shown here is derived from data already in data.js - site name,
   place, period and discovery year - so nothing is invented. A rights line
   appears only if the museum has added a "credit" field to the site; without
   one we say nothing rather than guess at a photographer or holder.          */
function photoCaption(s) {
  var bits = [periodById[s.period].short, locOf(s), discOf(s)];
  var cap = bits.join('  \u00b7  ');
  if (s.credit && s.credit.trim()) {
    cap += '\n' + (lang === 'ceb' ? 'Kredito: ' : 'Credit: ') + s.credit.trim();
  }
  return cap;
}

/* =========================================================
   USAGE LOG  (curator-facing; invisible to visitors)
   Counts which wrecks actually get opened so the gallery knows
   where to spend effort. Lives in localStorage, exported as CSV
   from the Pin Editor bar so nothing is transmitted anywhere.
   ========================================================= */
var LOG_KEY = 'paglawig.usage.v1';
function logVisit(kind, id) {
  try {
    var raw = localStorage.getItem(LOG_KEY);
    var d = raw ? JSON.parse(raw) : null;
    if (!d || typeof d !== 'object') d = { sessions: 0, sites: {}, photos: {}, lang: { en: 0, ceb: 0 }, first: null };
    var day = new Date().toISOString().slice(0, 10);
    if (d.last !== day) { d.sessions = (d.sessions || 0) + 1; d.last = day; }
    if (!d.first) d.first = new Date().toISOString();
    var bucket = kind === 'photo' ? d.photos : d.sites;
    if (!bucket[id]) bucket[id] = { opens: 0, photos: 0 };
    bucket[id][kind === 'photo' ? 'photos' : 'opens']++;
    localStorage.setItem(LOG_KEY, JSON.stringify(d));
  } catch (e) { /* private mode or quota: logging is optional, never fatal */ }
}

function exportUsageCSV() {
  try {
    var raw = localStorage.getItem(LOG_KEY);
    if (!raw) { say('No usage recorded on this device yet.', 'warn'); return; }
    var d = JSON.parse(raw);
    var rows = [['site_id', 'site_name', 'period', 'opened', 'photos_viewed']];
    D.sites.forEach(function (s) {
      var e = d.sites[s.id];
      var ph = (d.photos && d.photos[s.id]) ? d.photos[s.id].photos : 0;
      rows.push([s.id, '"' + s.name + '"', periodById[s.period].short,
                 e ? e.opens : 0, ph]);
    });
    rows.push([]);
    rows.push(['total_sessions', d.sessions || 0]);
    rows.push(['since', d.first || '']);
    rows.push(['english_views', (d.lang && d.lang.en) || 0]);
    rows.push(['cebuano_views', (d.lang && d.lang.ceb) || 0]);
    var csv = rows.map(function (r) { return r.join(','); }).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'paglawig-usage.csv';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    say('Usage CSV downloaded', 'ok');
  } catch (e) { say('Could not export usage: ' + e.message, 'warn'); }
}
/* =========================================================
   GUIDED TOUR
   Attract mode is automatic cycling; a tour is authored - a curator-chosen
   sequence through a handful of wrecks with a framing line between them.
   It steps on demand, never autoplays, so a guide controls the pace.
   ========================================================= */
var TOUR = {
  id: 'porcelan',
  title: { en: 'The Porcelan Trade in Six Wrecks', ceb: 'Ang Keramika sa Kadawatan' },
  blurb: {
    en: 'A short route through the shipwrecks, following the blue-and-white wares that moved between China, Southeast Asia and the islands of the archipelago.',
    ceb: 'Maubang nga ruta pinaagi sa mga nalunod nga barko, nga nagsunod sa mga puting-ug-blue nga keramika nga nagpalipat sa China, Southeast Asia, ug ang mga isla sa arkipelago.'
  },
  stops: [
    { id: 'breaker-reef', line: { en: 'The wreck that opened the collection.', ceb: 'Ang barko nga nag-ugsab sa koleksyon.' } },
    { id: 'pandanan', line: { en: 'Cargo found on a small Palawan island.', ceb: 'Karga nga nakit-an sa gamayng isla sa Palawan.' } },
    { id: 'san-isidro', line: { en: 'Six metres wide, forty-four metres down.', ceb: 'Usa ka metro nga gilap, ka-44 metro ang lawa.' } },
    { id: 'san-jose', line: { en: 'A galleon built to carry more than her crew needed.', ceb: 'Usa ka galleyon nga gitukang nga labaw sa iyang crew.' } },
    { id: 'nuestra-senora-dela-vida', line: { en: 'The Manila galleon\u2019s lost sister ship.', ceb: 'Ang nawala nga kapatid nga barko sa galleyon sa Maynila.' } },
    { id: 'san-diego', line: { en: 'The largest, best preserved, and the last to close the route.', ceb: 'Ang pinakamalaki, pinakamahusay nga naa, ug ang pinakahuling miyapos sa ruta.' } }
  ]
};
var tourIdx = -1, tourOn = false;

function tourIsValid() {
  return TOUR.stops.every(function (s) { return !!sitesById[s.id]; });
}
function startTour() {
  if (!tourIsValid()) return;
  tourOn = true; tourIdx = -1;
  showView('tour');
  renderTour();
}
function renderTour() {
  var intro = tourIdx < 0;                 /* the tour opens on an intro screen */
  var st = intro ? null : TOUR.stops[tourIdx];
  $('#tourTitle').textContent = lang === 'ceb' ? TOUR.title.ceb : TOUR.title.en;
  $('#tourBlurb').textContent = lang === 'ceb' ? TOUR.blurb.ceb : TOUR.blurb.en;
  $('#tourStep').textContent = (intro ? 1 : tourIdx + 1) + ' / ' + TOUR.stops.length;
  $('#tourLine').textContent = intro
    ? (lang === 'ceb'
        ? 'Pindutan ang "Sugda" aron magsimula ang ruta.'
        : 'Tap "Next stop" below to begin the route.')
    : (lang === 'ceb' ? st.line.ceb : st.line.en);

  var dots = '';
  TOUR.stops.forEach(function (s, i) {
    var site = sitesById[s.id];
    dots += '<button class="tour-dot' + (!intro && i === tourIdx ? ' on' : '') + '" data-t="' + i
         + '" style="--c:' + periodById[site.period].color + '" aria-label="Stop '
         + (i + 1) + ': ' + site.name + '"></button>';
  });
  $('#tourDots').innerHTML = dots;
  $$('#tourDots .tour-dot').forEach(function (b) {
    b.onclick = function () { gotoStop(+b.getAttribute('data-t')); };
  });

  var last = !intro && tourIdx >= TOUR.stops.length - 1;
  $('#tourPrev').disabled = intro || tourIdx <= 0;
  /* the last stop keeps its button live so it can end the tour, not dead-end */
  $('#tourNext').textContent = last
    ? (lang === 'ceb' ? 'Tapos na' : 'End of tour')
    : intro
      ? (lang === 'ceb' ? 'Sugda' : 'Start the route')
      : (lang === 'ceb' ? 'Sunod' : 'Next stop');
}
/* The tour keeps the panel and drives the map, so the visitor is never stranded.
   Tapping the pin still opens the full site text. */
function gotoStop(i) {
  i = Math.max(0, Math.min(TOUR.stops.length - 1, i));
  tourIdx = i;
  var s = sitesById[TOUR.stops[i].id];
  cur.period = s.period; cur.site = s.id;
  showView('tour');
  renderTour();
  renderCrumbs(); applyFilter();
  focusSite(s.id);
  playSink(pins[s.id]);
  logVisit('tour', s.id);
}
function endTour() { tourOn = false; tourIdx = -1; goHome(); }

/* =========================================================
   INSTRUMENT PLACEMENT
   The legend, compass and scale bar live in the rail on a wide screen.
   When the rail is hidden (narrow screens) they move onto the map instead,
   so they are never lost. One element each, relocated - never duplicated.
   ========================================================= */
var instrumentsInRail = null;
function placeInstruments() {
  var rail = $('#rail'), map = $('#mapwrap');
  var railOn = getComputedStyle(rail).display !== 'none';
  if (railOn === instrumentsInRail) return;
  instrumentsInRail = railOn;
  if (railOn) {
    /* insert before .rail-find so the legend stays under its heading */
    rail.insertBefore($('#legend'), rail.querySelector('.rail-find'));
    var foot = rail.querySelector('.rail-foot');
    foot.appendChild($('#compass'));
    foot.appendChild($('#scalebar'));
  } else {
    map.appendChild($('#legend'));
    map.appendChild($('#scalebar'));
    map.appendChild($('#compass'));
  }
}

/* rail search: a quick jump that works from any view */
var railSearch = $('#railSearch'), railResults = $('#railResults');
function renderRailResults(q) {
  q = (q || '').trim().toLowerCase();
  if (!q) { railResults.hidden = true; railResults.innerHTML = ''; return; }
  var hits = [];
  D.sites.forEach(function (s) {
    if ((s.name + ' ' + locOf(s) + ' ' + periodById[s.period].short).toLowerCase().indexOf(q) !== -1) {
      hits.push(s);
    }
  });
  if (!hits.length) {
    railResults.innerHTML = '<div class="rr-none">' + (lang === 'ceb' ? 'Walang barkong tugma.' : 'No wreck matches.') + '</div>';
  } else {
    railResults.innerHTML = hits.slice(0, 8).map(function (s) {
      return '<button data-s="' + s.id + '"><b>' + s.name + '</b><i>'
           + periodById[s.period].short + ' · ' + locOf(s) + '</i></button>';
    }).join('');
  }
  railResults.hidden = false;
  $$('button', railResults).forEach(function (b) {
    b.onclick = function () {
      railSearch.value = '';
      railResults.hidden = true;
      openSite(b.getAttribute('data-s'));
    };
  });
}
railSearch.addEventListener('input', function () { renderRailResults(railSearch.value); });
railSearch.addEventListener('focus', function () { renderRailResults(railSearch.value); });
document.addEventListener('click', function (e) {
  if (!railResults.hidden && !e.target.closest('.rail-find')) railResults.hidden = true;
});
$('#railHead').textContent = lang === 'ceb' ? 'Mga Yugto' : 'Periods';
railSearch.placeholder = lang === 'ceb' ? 'Lumaktaw sa barko' : 'Jump to a wreck';

function updateFurniture() {
  if (!M) return;

  /* scale bar: real ground distance at the current view.
     applyT maps base units to screen as  sx = (T.x + ux*T.k)*M.s + M.ox,
     so one screen pixel spans 1/(T.k*M.s) base units, and one base unit is
     (180/PI)/merc.s degrees of longitude. unproject() returns [lat, lon].     */
  var c = unproject((M.r.width / 2 - M.ox) / M.s, (M.r.height / 2 - M.oy) / M.s);
  var lat = c[0];
  var kmPerPx = (180 / Math.PI) * 111.32 * Math.cos(lat * Math.PI / 180)
             / (T.k * M.s * mapData.merc.s);
  if (!(kmPerPx > 0) || !isFinite(kmPerPx)) return;

  var maxKm = kmPerPx * 132;                 /* the bar is 132px wide */
  var steps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000];
  var pick = steps[0];
  for (var i = 0; i < steps.length; i++) if (steps[i] <= maxKm) pick = steps[i];
  var w = pick / kmPerPx;
  var bar = $('#scalebar');
  bar.querySelector('.sb-bar').style.width = Math.max(34, Math.round(w)) + 'px';
  $('#sbKm').textContent = pick >= 1000 ? (pick / 1000) + ',000 km' : pick + ' km';

  /* compass: keep north pointing north-ish as the map is only translated in Mercator */
  $('#compass').querySelector('.c-rose').style.transform = 'rotate(0deg)';
}

/* =========================================================
   TIER 1 — idle reset + attract mode (unattended kiosk)
   ========================================================= */
/* Museum staff can tune these in the URL, e.g. index.html?idle=60000&attract=120000
   Defaults: no input for 90s -> back to Home; 2.5m -> attract loop.          */
function urlMs(key, dflt) {
  var m = new RegExp('[?&]' + key + '=(\\d+)').exec(location.search);
  var v = m ? parseInt(m[1], 10) : dflt;
  return (v > 1000) ? v : dflt;
}
var IDLE_RESET_MS = urlMs('idle', 90000);
var IDLE_ATTRACT_MS = urlMs('attract', 150000);
var ATTRACT_EVERY_MS = urlMs('hold', 9000);

var idleTimer = null, attractIdx = 0, attractHold = null,
    firstTouch = true, attractOn = false;

function showCard() {
  var ov = $('#attract');
  ov.hidden = false; ov.classList.remove('gone');
}
function hideCard() {
  var ov = $('#attract');
  ov.classList.add('gone');
  setTimeout(function () { if (!attractOn) ov.hidden = true; }, 620);
}

/* Any real input: leave attract mode, drop the title card once, then re-arm. */
function kickIdle() {
  if (attractOn) leaveAttract();
  if (firstTouch) {
    firstTouch = false; hideCard();
    /* first real gesture is also our chance to start audio legally */
    if (window.Ambience) window.Ambience.start();
  }
  if (editing) return;

  clearTimeout(idleTimer);
  idleTimer = setTimeout(function () {
    if (firstTouch || editing) return;
    if (cur.site || cur.period) goHome(true);          /* soft reset to Home */
    idleTimer = setTimeout(function () {
      if (!firstTouch && !editing) enterAttract();
    }, Math.max(0, IDLE_ATTRACT_MS - IDLE_RESET_MS));
  }, IDLE_RESET_MS);
}

function enterAttract() {
  if (firstTouch || editing) return;
  attractOn = true;
  showCard();
  attractIdx = 0;
  (function step() {
    if (!attractOn) return;
    var s = D.sites[attractIdx % D.sites.length];
    attractIdx++;
    cur.period = s.period;
    cur.site = s.id;
    renderSite(s);
    showView('site');
    renderCrumbs();
    applyFilter();
    focusSite(s.id);
    attractHold = setTimeout(step, ATTRACT_EVERY_MS);
  })();
}

function leaveAttract() {
  if (!attractOn) return;
  attractOn = false;
  clearTimeout(attractHold);
  goHome(true);
  hideCard();
}

['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (ev) {
  window.addEventListener(ev, function () { kickIdle(); }, { passive: true });
});

/* =========================================================
   KIOSK HARDENING
   An exhibit screen should not show browser chrome, and a cursor left
   sitting on a touch screen reads as broken. Both are opt-in via
   ?kiosk=1 and are skipped in Pin Editor mode.
   ========================================================= */
var KIOSK = /[?&]kiosk=1/.test(location.search);
if (KIOSK && !/[?&]edit=1/.test(location.search)) {
  /* Fullscreen needs user activation, so this can only be requested from inside
     a real gesture task. Requesting it on load is rejected by the browser and
     the rejection is not catchable with try/catch. */
  var enteredOnce = false;
  function goFull() {
    if (document.fullscreenElement) return;
    var el = document.documentElement;
    var r = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (!r) return;
    try {
      var p = r.call(el);
      if (p && typeof p.catch === 'function') p.catch(function () {});
    } catch (e) {}
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
    window.addEventListener(ev, function () { setTimeout(goFull, 60); }, { passive: true });
  });
  document.addEventListener('fullscreenchange', function () {
    if (document.fullscreenElement) enteredOnce = true;
    else if (enteredOnce && typeof say === 'function') say('Fullscreen exited - tap the screen to restore it', 'warn');
  });

  var cursorTimer = null;
  var hideCursor = function () { document.body.classList.add('nocursor'); };
  var showCursor = function () {
    document.body.classList.remove('nocursor');
    clearTimeout(cursorTimer);
    cursorTimer = setTimeout(hideCursor, 4000);
  };
  ['pointermove', 'pointerdown', 'wheel'].forEach(function (ev) {
    window.addEventListener(ev, showCursor, { passive: true });
  });
  showCursor();
}

/* language usage, for the curator's CSV */
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('.lang-b');
  if (!b) return;
  try {
    var raw = localStorage.getItem(LOG_KEY);
    var d = raw ? JSON.parse(raw) : null;
    if (!d || typeof d !== 'object') return;
    if (!d.lang) d.lang = { en: 0, ceb: 0 };
    d.lang[b.getAttribute('data-lang')] = (d.lang[b.getAttribute('data-lang')] || 0) + 1;
    localStorage.setItem(LOG_KEY, JSON.stringify(d));
  } catch (err) {}
}, true);

/* tour controls */
$('#tourNext').onclick = function () {
  if (tourIdx >= TOUR.stops.length - 1) { endTour(); return; }
  gotoStop(tourIdx + 1);
};
$('#tourPrev').onclick = function () { gotoStop(tourIdx - 1); };
$('#tourExit').onclick = endTour;

/* sound toggle */
var soundBtn = $('#soundBtn');
soundBtn.onclick = function () {
  var on = window.Ambience ? window.Ambience.toggle() : false;
  document.body.classList.toggle('muted', !on);
  soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  soundBtn.title = on ? 'Sound on' : 'Sound off';
};

/* curator's usage export lives in the editor, so visitors never see it */
$('#ebUsage').onclick = exportUsageCSV;

/* the title card holds until the first visitor touches it */
function attractStrings() {
  $('#attractSub').textContent = lang === 'ceb'
    ? 'Kultural na Paglalakbay sa mga Dagat'
    : 'Cultural Movement Across the Seas';
  $('#attractPrompt').textContent = lang === 'ceb'
    ? 'Pindutan ang screen aron magsimula'
    : 'Touch the screen to explore';
}
if (!/[?&]edit=1/.test(location.search)) {
  $('#attract').hidden = false;
  attractStrings();
}

init();

})();
