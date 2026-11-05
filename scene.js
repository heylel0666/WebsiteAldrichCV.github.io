/* ==========================================================================
   Aldrich De Leon — 3D Hero Scene (Three.js)
   ========================================================================== */
import * as THREE from "three";

(function () {
  "use strict";

  var container = document.getElementById("hero-3d");
  var hero = container ? container.closest(".hero") : null;
  if (!container || !hero) return;

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Some browsers / devices have WebGL disabled. Fail quietly instead of
  // throwing and leaving the hero visual half-initialised.
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (err) {
    return;
  }
  if (!renderer || !renderer.getContext()) return;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(hero.clientWidth, hero.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.position = "absolute";
  renderer.domElement.style.inset = "0";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.pointerEvents = "none";

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(55, hero.clientWidth / hero.clientHeight, 0.1, 100);
  camera.position.z = 6;

  // Lights
  var ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambient);
  var point1 = new THREE.PointLight(0x6366f1, 2.5, 20);
  point1.position.set(3, 3, 4);
  scene.add(point1);
  var point2 = new THREE.PointLight(0xec4899, 2, 20);
  point2.position.set(-3, -2, 3);
  scene.add(point2);

  // Central object: torus knot
  var geometry = new THREE.TorusKnotGeometry(1.1, 0.32, 180, 24);
  var material = new THREE.MeshStandardMaterial({
    color: 0x6366f1,
    metalness: 0.6,
    roughness: 0.25,
    emissive: 0x1e1b4b,
    emissiveIntensity: 0.4,
  });
  var knot = new THREE.Mesh(geometry, material);
  scene.add(knot);

  // Wireframe overlay
  var wireMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, wireframe: true, transparent: true, opacity: 0.18 });
  var wire = new THREE.Mesh(geometry, wireMat);
  wire.scale.setScalar(1.02);
  scene.add(wire);

  // Particle field
  var particleCount = 900;
  var positions = new Float32Array(particleCount * 3);
  for (var i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 14;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 14;
  }
  var pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  var pMat = new THREE.PointsMaterial({ color: 0x97a1bd, size: 0.035, transparent: true, opacity: 0.7 });
  var particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  // Mouse parallax
  var targetRotX = 0;
  var targetRotY = 0;
  var currentRotX = 0;
  var currentRotY = 0;
  hero.addEventListener("mousemove", function (e) {
    var rect = hero.getBoundingClientRect();
    var nx = (e.clientX - rect.left) / rect.width - 0.5;
    var ny = (e.clientY - rect.top) / rect.height - 0.5;
    targetRotY = nx * 0.6;
    targetRotX = ny * 0.4;
  });
  hero.addEventListener("mouseleave", function () {
    targetRotX = 0;
    targetRotY = 0;
  });

  // Scroll-driven rotation
  var scrollFactor = 0;
  window.addEventListener("scroll", function () {
    scrollFactor = window.scrollY || 0;
  }, { passive: true });

  function resize() {
    var w = hero.clientWidth;
    var h = hero.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    if (!running) renderStatic();
  }

  var resizeTimer = null;
  window.addEventListener("resize", function () {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });

  // A single frame — used for the initial paint under reduced motion and
  // whenever the canvas is resized while the loop is paused.
  function renderStatic() {
    knot.rotation.set(0.4, 0.6, 0);
    wire.rotation.copy(knot.rotation);
    particles.rotation.set(0, 0, 0);
    point1.position.set(3, 3, 4);
    point2.position.set(-3, -2, 3);
    renderer.render(scene, camera);
  }

  var running = false;
  var inView = true;
  var elapsed = 0;
  var lastTime = 0;

  function tick(now) {
    if (!running) return;

    if (!lastTime) lastTime = now;
    var dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    elapsed += dt;

    var t = elapsed;
    currentRotX += (targetRotX - currentRotX) * 0.05;
    currentRotY += (targetRotY - currentRotY) * 0.05;
    knot.rotation.x = t * 0.25 + currentRotX;
    knot.rotation.y = t * 0.35 + currentRotY + scrollFactor * 0.0004;
    wire.rotation.copy(knot.rotation);
    particles.rotation.y = t * 0.04;
    particles.rotation.x = currentRotX * 0.3;
    point1.position.x = Math.sin(t * 0.7) * 3;
    point1.position.y = Math.cos(t * 0.5) * 2;
    point2.position.x = Math.cos(t * 0.6) * 3;

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  function start() {
    if (running || prefersReducedMotion) return;
    running = true;
    lastTime = 0;
    requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    lastTime = 0;
  }

  function sync() {
    if (prefersReducedMotion) {
      renderStatic();
      return;
    }
    if (inView && !document.hidden) start();
    else stop();
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      function (entries) {
        inView = entries[0].isIntersecting;
        sync();
      },
      { threshold: 0 }
    ).observe(hero);
  }

  document.addEventListener("visibilitychange", sync);

  if (prefersReducedMotion) {
    renderStatic();
  } else {
    start();
  }

  // Expose for debugging
  window.__threeScene = { scene: scene, camera: camera, renderer: renderer };
})();
