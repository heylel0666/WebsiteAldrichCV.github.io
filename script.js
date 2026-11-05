/* ==========================================================================
   Aldrich De Leon — Portfolio
   Vanilla JS, no dependencies
   ========================================================================== */
(function () {
  "use strict";

  var $ = function (sel, ctx) {
    return (ctx || document).querySelector(sel);
  };
  var $$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ----------------------------------------------------------------------
     Theme (dark / light) — persists to localStorage, respects OS default
     ---------------------------------------------------------------------- */
  (function theme() {
    var root = document.documentElement;
    var toggle = $("#theme-toggle");
    var stored = null;

    try {
      stored = localStorage.getItem("theme");
    } catch (e) {
      /* private mode — fall back to OS preference */
    }

    var initial =
      stored ||
      (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");

    root.setAttribute("data-theme", initial);

    function syncLabel() {
      if (!toggle) return;
      var isDark = root.getAttribute("data-theme") === "dark";
      toggle.setAttribute(
        "aria-label",
        isDark ? "Switch to light theme" : "Switch to dark theme"
      );
    }

    syncLabel();

    if (!toggle) return;

    toggle.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try {
        localStorage.setItem("theme", next);
      } catch (e) {
        /* ignore */
      }
      syncLabel();
    });
  })();

  /* ----------------------------------------------------------------------
     Mobile navigation
     ---------------------------------------------------------------------- */
  (function mobileNav() {
    var toggle = $("#nav-toggle");
    var links = $("#nav-links");

    if (!toggle || !links) return;

    function setOpen(open) {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      links.classList.toggle("is-open", open);
      document.body.classList.toggle("is-locked", open);
    }

    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    // Close when a link is chosen
    $$("a", links).forEach(function (a) {
      a.addEventListener("click", function () {
        setOpen(false);
      });
    });

    // Close on Escape
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false);
        toggle.focus();
      }
    });

    // Close when clicking outside
    document.addEventListener("click", function (e) {
      if (toggle.getAttribute("aria-expanded") !== "true") return;
      if (links.contains(e.target) || toggle.contains(e.target)) return;
      setOpen(false);
    });

    // Reset when resizing to desktop
    var mq = window.matchMedia("(min-width: 861px)");
    var onChange = function (e) {
      if (e.matches) setOpen(false);
    };
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else if (mq.addListener) mq.addListener(onChange);
  })();

  /* ----------------------------------------------------------------------
     Header shadow + scroll progress bar
     ---------------------------------------------------------------------- */
  (function onScroll() {
    var header = $("#site-header");
    var progress = $("#scroll-progress");
    var toTop = $("#to-top");
    var ticking = false;

    function update() {
      var y = window.scrollY || window.pageYOffset;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;

      if (header) header.classList.toggle("is-scrolled", y > 8);
      if (progress) {
        progress.style.width = (docHeight > 0 ? (y / docHeight) * 100 : 0) + "%";
      }
      if (toTop) toTop.classList.toggle("is-visible", y > 500);
      ticking = false;
    }

    window.addEventListener(
      "scroll",
      function () {
        if (!ticking) {
          ticking = true;
          window.requestAnimationFrame(update);
        }
      },
      { passive: true }
    );

    update();

    if (toTop) {
      toTop.addEventListener("click", function () {
        window.scrollTo({
          top: 0,
          behavior: prefersReducedMotion ? "auto" : "smooth",
        });
      });
    }
  })();

  /* ----------------------------------------------------------------------
     Scroll spy — highlights the active nav link
     ---------------------------------------------------------------------- */
  (function scrollSpy() {
    var links = $$(".nav__link");
    if (!links.length) return;

    var sections = links
      .map(function (link) {
        var id = link.getAttribute("href");
        return id && id.startsWith("#") ? document.querySelector(id) : null;
      })
      .filter(Boolean);

    if (!sections.length) return;

    function update() {
      var probe = 160;
      var scrolled = window.scrollY || window.pageYOffset;
      var docHeight = document.documentElement.scrollHeight;
      var currentId = null;

      if (scrolled > 120) {
        currentId = sections[0].id;
        sections.forEach(function (section) {
          if (section.getBoundingClientRect().top <= probe) currentId = section.id;
        });

        // Bottom of page → last section
        if (window.innerHeight + scrolled >= docHeight - 4) {
          currentId = sections[sections.length - 1].id;
        }
      }

      links.forEach(function (link) {
        var isActive = link.getAttribute("href") === "#" + currentId;
        link.classList.toggle("is-active", isActive);
        if (isActive) {
          link.setAttribute("aria-current", "true");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    }

    var ticking = false;
    window.addEventListener(
      "scroll",
      function () {
        if (!ticking) {
          ticking = true;
          window.requestAnimationFrame(function () {
            update();
            ticking = false;
          });
        }
      },
      { passive: true }
    );

    update();
  })();

  /* ----------------------------------------------------------------------
     Reveal on scroll
     ---------------------------------------------------------------------- */
  (function reveal() {
    var items = $$(".reveal");
    if (!items.length) return;

    // Stagger delay from data-delay attribute
    items.forEach(function (el) {
      var d = el.getAttribute("data-delay");
      if (d) el.style.setProperty("--reveal-delay", d);
    });

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      items.forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );

    items.forEach(function (el) {
      observer.observe(el);
    });
  })();

  /* ----------------------------------------------------------------------
     Animated counters
     ---------------------------------------------------------------------- */
  (function counters() {
    var els = $$("[data-count]");
    if (!els.length) return;

    function animate(el) {
      var target = parseInt(el.getAttribute("data-count"), 10) || 0;
      var duration = 1400;
      var start = null;

      function step(ts) {
        if (start === null) start = ts;
        var progress = Math.min((ts - start) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(target * eased) + (target >= 10 ? "+" : "");
        if (progress < 1) window.requestAnimationFrame(step);
      }

      window.requestAnimationFrame(step);
    }

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      els.forEach(function (el) {
        el.textContent = el.getAttribute("data-count") + "+";
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animate(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );

    els.forEach(function (el) {
      observer.observe(el);
    });
  })();

  /* ----------------------------------------------------------------------
     Typewriter — rotating role phrases
     ---------------------------------------------------------------------- */
  (function typewriter() {
    var el = $("#typewriter");
    if (!el) return;

    var phrases = [
      "workflow automations",
      "API integrations",
      "UX & UI designs",
      "CRM & ticketing flows",
      "system automations",
    ];

    if (prefersReducedMotion) {
      el.textContent = phrases[0];
      return;
    }

    var phraseIndex = 0;
    var charIndex = 0;
    var deleting = false;

    function tick() {
      var current = phrases[phraseIndex];
      el.textContent = current.substring(0, charIndex);

      if (!deleting && charIndex === current.length) {
        deleting = true;
        setTimeout(tick, 1900);
        return;
      }

      if (deleting && charIndex === 0) {
        deleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        setTimeout(tick, 320);
        return;
      }

      charIndex += deleting ? -1 : 1;
      setTimeout(tick, deleting ? 45 : 78);
    }

    setTimeout(tick, 900);
  })();

  /* ----------------------------------------------------------------------
     Copy email to clipboard
     ---------------------------------------------------------------------- */
  (function copyEmail() {
    var els = $$("[data-copy]");
    if (!els.length) return;

    els.forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        var value = el.getAttribute("data-copy");
        var note = el.parentElement.querySelector("small");

        function done(text) {
          var original = note ? note.textContent : "";
          if (note) note.textContent = text;
          setTimeout(function () {
            if (note) note.textContent = original;
          }, 1800);
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(value).then(
            function () {
              done("Copied to clipboard");
            },
            function () {
              window.location.href = "mailto:" + value;
            }
          );
        } else {
          window.location.href = "mailto:" + value;
        }
      });
    });
  })();

  /* ----------------------------------------------------------------------
     Contact form — client-side validation + mailto handoff
     ---------------------------------------------------------------------- */
  (function contactForm() {
    var form = $("#contact-form");
    if (!form) return;

    var note = $("#form-note");

    function setError(field, message) {
      var wrap = field.closest(".field");
      var err = form.querySelector('[data-error-for="' + field.id + '"]');
      if (wrap) wrap.classList.toggle("has-error", Boolean(message));
      if (err) err.textContent = message || "";
    }

    function validateField(field) {
      var value = field.value.trim();

      if (field.id === "cf-email") {
        if (!value) {
          setError(field, "Please enter your email address.");
          return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
          setError(field, "That email address doesn't look right.");
          return false;
        }
      } else if (field.required && !value) {
        setError(
          field,
          field.id === "cf-name"
            ? "Please enter your name."
            : "Please tell me a little about the project."
        );
        return false;
      }

      setError(field, "");
      return true;
    }

    var fields = $$("input, textarea", form);

    fields.forEach(function (field) {
      field.addEventListener("blur", function () {
        if (field.value.trim() || field.required) validateField(field);
      });
      field.addEventListener("input", function () {
        var wrap = field.closest(".field");
        if (wrap && wrap.classList.contains("has-error")) validateField(field);
      });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var valid = true;
      var firstInvalid = null;

      fields.forEach(function (field) {
        if (!validateField(field) && valid) {
          valid = false;
          firstInvalid = field;
        }
      });

      if (!valid) {
        if (firstInvalid) firstInvalid.focus();
        if (note) {
          note.textContent = "Please fix the highlighted fields.";
          note.classList.remove("is-success");
        }
        return;
      }

      var submit = $("#cf-submit");
      var label = submit ? submit.querySelector(".btn__label") : null;
      var originalLabel = label ? label.textContent : "";

      if (submit) {
        submit.classList.add("is-sending");
        if (label) label.textContent = "Opening your mail app…";
      }

      var name = form.querySelector("#cf-name").value.trim();
      var email = form.querySelector("#cf-email").value.trim();
      var subject = form.querySelector("#cf-subject").value;
      var message = form.querySelector("#cf-message").value.trim();

      var body =
        "Hi Aldrich,\n\n" +
        message +
        "\n\n---\n" +
        "Name: " + name + "\n" +
        "Email: " + email + "\n" +
        "Interested in: " + subject + "\n";

      var href =
        "mailto:aldrichdlion@gmail.com" +
        "?subject=" +
        encodeURIComponent(subject + " — " + name) +
        "&body=" +
        encodeURIComponent(body);

      setTimeout(function () {
        window.location.href = href;

        if (submit) submit.classList.remove("is-sending");
        if (label) label.textContent = originalLabel;
        if (note) {
          note.textContent = "Thanks! Your email client should be open now.";
          note.classList.add("is-success");
        }
        form.reset();
      }, 400);
    });
  })();

  /* ----------------------------------------------------------------------
     Creative enhancements: custom cursor
     ---------------------------------------------------------------------- */
  (function customCursor() {
    var cursor = $(".cursor");
    if (!cursor) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    document.documentElement.classList.add("has-custom-cursor");

    var dot = cursor.querySelector(".cursor__dot");
    var ring = cursor.querySelector(".cursor__ring");
    var mx = window.innerWidth / 2;
    var my = window.innerHeight / 2;
    var rx = mx;
    var ry = my;
    var visible = false;

    window.addEventListener("mousemove", function (e) {
      mx = e.clientX;
      my = e.clientY;
      if (!visible) {
        visible = true;
        cursor.style.opacity = "1";
      }
    });

    window.addEventListener("mouseleave", function () {
      cursor.style.opacity = "0";
    });

    window.addEventListener("mouseenter", function () {
      cursor.style.opacity = "1";
    });

    // Hover detection
    function isInteractive(target) {
      if (!target) return false;
      return !!target.closest(
        "a, button, [role='button'], input, textarea, select, .tilt, .chip, .stat, .project, .skill-card"
      );
    }

    document.addEventListener("mouseover", function (e) {
      cursor.classList.toggle("is-hover", isInteractive(e.target));
    });

    document.addEventListener("mousedown", function () {
      cursor.classList.add("is-click");
    });
    document.addEventListener("mouseup", function () {
      cursor.classList.remove("is-click");
    });

    function loop() {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      if (dot) dot.style.transform = "translate(" + mx + "px," + my + "px) translate(-50%,-50%)";
      if (ring) ring.style.transform = "translate(" + rx + "px," + ry + "px) translate(-50%,-50%)";
      window.requestAnimationFrame(loop);
    }
    loop();
  })();

  /* ----------------------------------------------------------------------
     Hero particle canvas
     ---------------------------------------------------------------------- */
  (function heroParticles() {
    var canvas = $("#hero-canvas");
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var ctx = canvas.getContext("2d");
    var hero = canvas.closest(".hero");
    var particles = [];
    var mouse = { x: -9999, y: -9999 };
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      var rect = hero.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function makeParticles() {
      particles = [];
      var rect = hero.getBoundingClientRect();
      var count = Math.max(28, Math.min(70, Math.round((rect.width * rect.height) / 18000)));
      for (var i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * rect.width,
          y: Math.random() * rect.height,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.35,
          r: Math.random() * 1.6 + 0.6,
          hue: Math.random() < 0.5 ? 230 : 320,
        });
      }
    }

    resize();
    makeParticles();

    window.addEventListener("resize", function () {
      resize();
      makeParticles();
    });

    hero.addEventListener("mousemove", function (e) {
      var rect = hero.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    });
    hero.addEventListener("mouseleave", function () {
      mouse.x = -9999;
      mouse.y = -9999;
    });

    function step() {
      var rect = hero.getBoundingClientRect();
      var w = rect.width;
      var h = rect.height;
      ctx.clearRect(0, 0, w, h);

      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        // mouse repulsion
        var dx = p.x - mouse.x;
        var dy = p.y - mouse.y;
        var dist = Math.hypot(dx, dy);
        if (dist < 120 && dist > 0) {
          var force = (120 - dist) / 120;
          p.vx += (dx / dist) * force * 0.06;
          p.vy += (dy / dist) * force * 0.06;
        }
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;

        // draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle =
          p.hue === 230 ? "rgba(99,102,241,0.8)" : "rgba(236,72,153,0.7)";
        ctx.fill();

        // connections
        for (var j = i + 1; j < particles.length; j++) {
          var q = particles[j];
          var d = Math.hypot(p.x - q.x, p.y - q.y);
          if (d < 110) {
            ctx.strokeStyle = "rgba(99,102,241," + (1 - d / 110) * 0.22 + ")";
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }
      }

      window.requestAnimationFrame(step);
    }
    step();
  })();

  /* ----------------------------------------------------------------------
     3D tilt + glare on cards
     ---------------------------------------------------------------------- */
  (function tiltCards() {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var selectors =
      ".project, .skill-card, .about__facts li, .contact__card, .certs__list li, .timeline__card, .stat";
    var nodes = $$(selectors);
    nodes.forEach(function (node) {
      node.classList.add("tilt");

      node.addEventListener("mousemove", function (e) {
        var rect = node.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        var px = x / rect.width - 0.5;
        var py = y / rect.height - 0.5;
        var rx = (-py * 8).toFixed(2);
        var ry = (px * 10).toFixed(2);
        node.style.transform =
          "perspective(900px) rotateX(" + rx + "deg) rotateY(" + ry + "deg) translateY(-2px)";
        node.style.setProperty("--mx", x + "px");
        node.style.setProperty("--my", y + "px");
      });

      node.addEventListener("mouseleave", function () {
        node.style.transform = "";
        node.style.removeProperty("--mx");
        node.style.removeProperty("--my");
      });
    });
  })();

  /* ----------------------------------------------------------------------
     Magnetic buttons
     ---------------------------------------------------------------------- */
  (function magnetic() {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    $$(".btn, .hero__socials a, .contact__socials a, .brand__mark").forEach(function (el) {
      el.classList.add("magnetic");
      el.addEventListener("mousemove", function (e) {
        var rect = el.getBoundingClientRect();
        var x = e.clientX - rect.left - rect.width / 2;
        var y = e.clientY - rect.top - rect.height / 2;
        var tx = Math.max(-10, Math.min(10, x * 0.25));
        var ty = Math.max(-10, Math.min(10, y * 0.25));
        el.style.transform = "translate(" + tx + "px," + ty + "px)";
      });
      el.addEventListener("mouseleave", function () {
        el.style.transform = "";
      });
    });
  })();

  /* ----------------------------------------------------------------------
     Click sparkles
     ---------------------------------------------------------------------- */
  (function clickSparkles() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    document.addEventListener("click", function (e) {
      var count = 12;
      for (var i = 0; i < count; i++) {
        var s = document.createElement("span");
        s.className = "sparkle";
        var angle = (Math.PI * 2 * i) / count;
        var dist = 28 + Math.random() * 22;
        var dx = Math.cos(angle) * dist;
        var dy = Math.sin(angle) * dist;
        s.style.left = e.clientX + "px";
        s.style.top = e.clientY + "px";
        s.style.setProperty("--dx", dx + "px");
        s.style.setProperty("--dy", dy + "px");
        // color variation
        if (Math.random() < 0.5) {
          s.style.background = "var(--brand-2)";
          s.style.boxShadow = "0 0 10px var(--brand-2)";
        } else if (Math.random() < 0.5) {
          s.style.background = "var(--brand-3)";
          s.style.boxShadow = "0 0 10px var(--brand-3)";
        }
        document.body.appendChild(s);
        (function (node) {
          setTimeout(function () {
            if (node.parentNode) node.parentNode.removeChild(node);
          }, 750);
        })(s);
      }
    });
  })();

  /* ----------------------------------------------------------------------
     Parallax on hero visual (mouse)
     ---------------------------------------------------------------------- */
  (function heroParallax() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var visual = $(".hero__visual");
    var avatar = $(".hero__avatar");
    if (!visual || !avatar) return;
    var chips = $$(".hero__chip");

    visual.addEventListener("mousemove", function (e) {
      var rect = visual.getBoundingClientRect();
      var px = (e.clientX - rect.left) / rect.width - 0.5;
      var py = (e.clientY - rect.top) / rect.height - 0.5;
      avatar.style.transform = "translate(" + px * -12 + "px," + py * -12 + "px)";
      chips.forEach(function (c, i) {
        var factor = (i + 1) * 6;
        c.style.transform = "translate(" + px * factor + "px," + py * factor + "px)";
      });
    });
    visual.addEventListener("mouseleave", function () {
      avatar.style.transform = "";
      chips.forEach(function (c) {
        c.style.transform = "";
      });
    });
  })();

  /* ----------------------------------------------------------------------
     Cursor trail (creative)
     ---------------------------------------------------------------------- */
  (function cursorTrail() {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var canvas = document.createElement("canvas");
    canvas.className = "cursor-trail";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var points = [];

    function resize() {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    window.addEventListener("mousemove", function (e) {
      points.push({ x: e.clientX, y: e.clientY, age: 0 });
      if (points.length > 48) points.shift();
    });

    function step() {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (var i = 0; i < points.length; i++) {
        var p = points[i];
        p.age += 1;
        var life = 1 - p.age / 40;
        if (life <= 0) continue;
        var radius = 2 + life * 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(99,102,241," + life * 0.55 + ")";
        ctx.fill();
      }
      // remove dead
      while (points.length && (1 - points[0].age / 40) <= 0) points.shift();
      window.requestAnimationFrame(step);
    }
    step();
  })();
  /* ----------------------------------------------------------------------
     Fun controls
     ---------------------------------------------------------------------- */
  (function fun() {
    var btn = $("#fun-btn");
    var panel = $("#fun-panel");
    if (!btn || !panel) return;

    function togglePanel(open) {
      var isOpen = open === undefined ? !panel.classList.contains("is-open") : open;
      panel.classList.toggle("is-open", isOpen);
      panel.setAttribute("aria-hidden", String(!isOpen));
      btn.setAttribute("aria-expanded", String(isOpen));
    }

    btn.addEventListener("click", function () {
      togglePanel();
    });

    document.addEventListener("click", function (e) {
      if (!panel.contains(e.target) && !btn.contains(e.target)) togglePanel(false);
    });

    var confettiCanvas = null;
    var confettiCtx = null;
    var confettiPieces = [];
    var confettiRunning = false;

    function ensureConfettiCanvas() {
      if (confettiCanvas) return;
      confettiCanvas = document.createElement("canvas");
      confettiCanvas.className = "confetti-canvas";
      confettiCanvas.setAttribute("aria-hidden", "true");
      document.body.appendChild(confettiCanvas);
      confettiCtx = confettiCanvas.getContext("2d");
      function resize() {
        confettiCanvas.width = window.innerWidth;
        confettiCanvas.height = window.innerHeight;
      }
      resize();
      window.addEventListener("resize", resize);
    }

    function launchConfetti(opts) {
      opts = opts || {};
      ensureConfettiCanvas();
      var count = opts.count || 140;
      var originX = opts.x !== undefined ? opts.x : window.innerWidth / 2;
      var originY = opts.y !== undefined ? opts.y : window.innerHeight / 3;
      var colors = ["#6366f1", "#ec4899", "#22d3ee", "#facc15", "#34d399", "#f97316"];
      for (var i = 0; i < count; i++) {
        var angle = Math.random() * Math.PI * 2;
        var speed = 4 + Math.random() * 8;
        confettiPieces.push({
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 4,
          g: 0.25 + Math.random() * 0.15,
          w: 6 + Math.random() * 6,
          h: 8 + Math.random() * 6,
          rot: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 0.3,
          color: colors[Math.floor(Math.random() * colors.length)],
          life: 0,
          maxLife: 90 + Math.random() * 40,
        });
      }
      if (!confettiRunning) {
        confettiRunning = true;
        runConfetti();
      }
    }

    function runConfetti() {
      if (!confettiCtx) return;
      confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      for (var i = confettiPieces.length - 1; i >= 0; i--) {
        var c = confettiPieces[i];
        c.life++;
        c.vy += c.g;
        c.x += c.vx;
        c.y += c.vy;
        c.vx *= 0.99;
        c.rot += c.vr;
        var t = c.life / c.maxLife;
        if (t >= 1 || c.y > confettiCanvas.height + 40) {
          confettiPieces.splice(i, 1);
          continue;
        }
        confettiCtx.save();
        confettiCtx.translate(c.x, c.y);
        confettiCtx.rotate(c.rot);
        confettiCtx.globalAlpha = 1 - t;
        confettiCtx.fillStyle = c.color;
        confettiCtx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
        confettiCtx.restore();
      }
      if (confettiPieces.length > 0) {
        window.requestAnimationFrame(runConfetti);
      } else {
        confettiRunning = false;
        confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      }
    }

    var partyTimer = null;
    var partyConfettiTimer = null;
    function toggleParty(force) {
      var on = force === undefined ? !document.body.classList.contains("is-party") : force;
      document.body.classList.toggle("is-party", on);
      if (on) {
        partyConfettiTimer = setInterval(function () {
          launchConfetti({ count: 30, x: Math.random() * window.innerWidth, y: -20 });
        }, 450);
        partyTimer = setTimeout(function () {
          toggleParty(false);
        }, 9000);
      } else {
        if (partyConfettiTimer) clearInterval(partyConfettiTimer);
        if (partyTimer) clearTimeout(partyTimer);
        partyConfettiTimer = null;
        partyTimer = null;
      }
    }

    function prepareScatter(el) {
      if (el.dataset.scattered === "1") return;
      var text = el.textContent;
      el.textContent = "";
      var frag = document.createDocumentFragment();
      for (var i = 0; i < text.length; i++) {
        var span = document.createElement("span");
        span.className = "scatter-char";
        span.textContent = text[i] === " " ? "\u00A0" : text[i];
        frag.appendChild(span);
      }
      el.appendChild(frag);
      el.dataset.scattered = "1";
    }

    var scatterActive = false;
    function scatterTitles() {
      scatterActive = !scatterActive;
      $$(".section__title, .hero__title").forEach(function (title) {
        prepareScatter(title);
        var chars = $$(".scatter-char", title);
        chars.forEach(function (ch) {
          if (scatterActive) {
            var dx = (Math.random() - 0.5) * 80;
            var dy = (Math.random() - 0.5) * 60;
            var rot = (Math.random() - 0.5) * 40;
            ch.style.transform = "translate(" + dx + "px," + dy + "px) rotate(" + rot + "deg)";
            ch.classList.add("is-scattered");
          } else {
            ch.style.transform = "";
            ch.classList.remove("is-scattered");
          }
        });
      });
    }

    var rainbowOn = false;
    var rainbowRaf = null;
    function toggleRainbow(force) {
      rainbowOn = force === undefined ? !rainbowOn : force;
      document.body.classList.toggle("rainbow-cursor", rainbowOn);
      if (rainbowOn) {
        var hue = 0;
        function step() {
          hue = (hue + 3) % 360;
          document.body.style.setProperty("--hue", hue + "deg");
          rainbowRaf = window.requestAnimationFrame(step);
        }
        step();
      } else {
        if (rainbowRaf) cancelAnimationFrame(rainbowRaf);
        rainbowRaf = null;
      }
    }

    function spinCards() {
      document.body.classList.remove("spin-cards");
      void document.body.offsetWidth;
      document.body.classList.add("spin-cards");
      setTimeout(function () {
        document.body.classList.remove("spin-cards");
      }, 900);
    }

    function boom(e) {
      var x = e && e.clientX !== undefined ? e.clientX : window.innerWidth / 2;
      var y = e && e.clientY !== undefined ? e.clientY : window.innerHeight / 2;
      var flash = document.createElement("div");
      flash.className = "boom-flash";
      flash.style.setProperty("--bx", (x / window.innerWidth * 100) + "%");
      flash.style.setProperty("--by", (y / window.innerHeight * 100) + "%");
      document.body.appendChild(flash);
      setTimeout(function () {
        if (flash.parentNode) flash.parentNode.removeChild(flash);
      }, 750);
      launchConfetti({ count: 60, x: x, y: y });
    }

    $$(".fun-action").forEach(function (a) {
      a.addEventListener("click", function () {
        var action = a.getAttribute("data-action");
        switch (action) {
          case "confetti":
            launchConfetti({});
            break;
          case "party":
            toggleParty();
            break;
          case "scatter":
            scatterTitles();
            break;
          case "rainbow":
            toggleRainbow();
            break;
          case "spin":
            spinCards();
            break;
          case "boom":
            boom({ clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 });
            break;
        }
      });
    });

    var konami = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
    var konamiIndex = 0;
    document.addEventListener("keydown", function (e) {
      if (e.key === konami[konamiIndex]) {
        konamiIndex++;
        if (konamiIndex === konami.length) {
          konamiIndex = 0;
          toggleParty(true);
          launchConfetti({ count: 300 });
        }
      } else {
        konamiIndex = 0;
      }
    });

    var brandMark = $(".brand__mark");
    if (brandMark) {
      var clicks = 0;
      var clickTimer = null;
      brandMark.addEventListener("click", function (e) {
        clicks++;
        if (clickTimer) clearTimeout(clickTimer);
        clickTimer = setTimeout(function () { clicks = 0; }, 500);
        if (clicks >= 3) {
          clicks = 0;
          launchConfetti({ count: 200, x: e.clientX, y: e.clientY });
          boom(e);
        }
      });
    }

    // expose confetti for terminal/easter eggs
    window.launchConfetti = launchConfetti;
    window.toggleParty = toggleParty;
    var typed = "";
    document.addEventListener("keydown", function (e) {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT")) return;
      if (e.key && e.key.length === 1) {
        typed = (typed + e.key.toLowerCase()).slice(-7);
        if (typed === "aldrich") {
          typed = "";
          toggleRainbow(true);
          launchConfetti({ count: 180 });
          setTimeout(function () { toggleRainbow(false); }, 6000);
        }
      }
    });
  })();

  (function injectConfettiStyle() {
    var style = document.createElement("style");
    style.textContent = ".confetti-canvas{position:fixed;inset:0;pointer-events:none;z-index:9994;}";
    document.head.appendChild(style);
  })();

  /* ----------------------------------------------------------------------
     Terminal
     ---------------------------------------------------------------------- */
  (function terminal() {
    var output = $("#term-output");
    var input = $("#term-input");
    if (!output || !input) return;

    var commands = {
      help: function () {
        return [
          "Available commands:",
          "  help        show this help",
          "  about       who I am",
          "  skills      tech & tools",
          "  projects    selected work",
          "  experience  career timeline",
          "  contact     how to reach me",
          "  socials     links",
          "  theme <name>  switch theme (default|cyber|sunset|forest|ocean|candy)",
          "  clear       clear the screen",
          "  konami      🎉",
          "  sudo hire   ???",
        ].join("\n");
      },
      about: function () {
        return [
          "Aldrich O. De Leon",
          "Operations Excellence Supervisor & Systems Automation Specialist",
          "Quezon City, Philippines · Open to opportunities",
          "",
          "I engineer scalable workflows, API integrations and automated pipelines",
          "that remove operational bottlenecks — backed by UX/UI, graphic design",
          "and motion graphics.",
        ].join("\n");
      },
      skills: function () {
        return [
          "Automation & Ops: Pipedream, Cloudflare Workers, Freshdesk Omni, Bitrix24, UAT",
          "Development: HTML/CSS, JavaScript, Java, Python, REST APIs, Android Studio",
          "UX/UI & Design: Figma, Photoshop, Illustrator, Premiere Pro, After Effects, Blender",
          "Management: cross-functional coordination, process mapping, project management",
        ].join("\n");
      },
      projects: function () {
        return [
          "1. Cebu Museum Interactive Map — Python/Java/HTML5 — Fullstack + UX/UI",
          "2. Voyage to Heritage — Android Studio — Fullstack + UX/UI",
          "3. EatGridients App — Firebase/MySQL/Jetpack Compose — PM + UX/UI + Fullstack",
          "4. PETMOKO — mobile game — Animator/Background Artist/Programmer",
          "5. Art Gallery (React), Sales Dashboard (MySQL/Firebase), Capstone film, knOWLedge",
          "",
          "→ scroll to #projects for visuals",
        ].join("\n");
      },
      experience: function () {
        return [
          "Apr 2025 – Present  Operations Excellence Supervisor — Cepat Kredit Financing Inc.",
          "Apr 2024 – Mar 2025 Marketing Supervisor — Beesee Global, Quezon City",
          "May 2022 – 2024     UX/UI Developer — BSTech Solution",
        ].join("\n");
      },
      contact: function () {
        return [
          "Email: aldrichdlion@gmail.com",
          "Phone: +63 962 525 1351",
          "Location: Quezon City, Philippines",
          "GitHub: https://github.com/heylel0666",
          "LinkedIn: https://www.linkedin.com/in/aldrich-de-leon-9385481a5/",
        ].join("\n");
      },
      socials: function () {
        return "github.com/heylel0666 · linkedin.com/in/aldrich-de-leon-9385481a5 · facebook.com/ArtInHel";
      },
      clear: function () {
        output.innerHTML = "";
        return null;
      },
      konami: function () {
        document.body.classList.add("is-party");
        if (typeof launchConfetti === "function") launchConfetti({ count: 300 });
        setTimeout(function () { document.body.classList.remove("is-party"); }, 9000);
        return "🎉 PARTY MODE ACTIVATED";
      },
      "sudo hire": function () {
        return "Permission granted. Sending offer letter… (just kidding — email me!)";
      },
    };

    function printLine(text, cls) {
      var line = document.createElement("div");
      line.className = "terminal__line" + (cls ? " " + cls : "");
      line.textContent = text;
      output.appendChild(line);
      output.scrollTop = output.scrollHeight;
    }

    function run(cmd) {
      var trimmed = cmd.trim();
      if (!trimmed) return;
      printLine("$ " + trimmed, "terminal__line--cmd");

      var themeMatch = trimmed.match(/^theme\s+(\w+)$/i);
      if (themeMatch) {
        var name = themeMatch[1].toLowerCase();
        var valid = ["default", "cyber", "sunset", "forest", "ocean", "candy"];
        if (valid.indexOf(name) === -1) {
          printLine("Unknown theme: " + name + ". Try: " + valid.join(", "), "terminal__line--err");
          return;
        }
        applyThemePreset(name);
        printLine("Theme switched to " + name, "terminal__line--ok");
        return;
      }

      var fn = commands[trimmed.toLowerCase()];
      if (!fn) {
        printLine("command not found: " + trimmed + ". Type 'help'.", "terminal__line--err");
        return;
      }
      var result = fn();
      if (result === null) return;
      String(result).split("\n").forEach(function (l) {
        printLine(l, "terminal__line--info");
      });
    }

    function applyThemePreset(name) {
      document.body.classList.remove("theme-cyber", "theme-sunset", "theme-forest", "theme-ocean", "theme-candy");
      if (name !== "default") document.body.classList.add("theme-" + name);
      $$(".swatch").forEach(function (s) {
        s.classList.toggle("is-active", s.getAttribute("data-theme-preset") === name);
      });
      try { localStorage.setItem("theme-preset", name); } catch (e) {}
    }

    window.applyThemePreset = applyThemePreset;

    printLine("Welcome to aldrich.sh — type 'help' to begin.", "terminal__line--ok");
    printLine("", "");

    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        run(input.value);
        input.value = "";
      } else if (e.key === "Tab") {
        e.preventDefault();
        var val = input.value.trim().toLowerCase();
        var keys = Object.keys(commands).concat(["theme"]);
        var match = keys.filter(function (k) { return k.indexOf(val) === 0; });
        if (match.length === 1) input.value = match[0];
      }
    });

    var stored = null;
    try { stored = localStorage.getItem("theme-preset"); } catch (e) {}
    if (stored) applyThemePreset(stored);
    else {
      var first = $(".swatch");
      if (first) first.classList.add("is-active");
    }

    $(".terminal").addEventListener("click", function () {
      input.focus();
    });
  })();

  /* ----------------------------------------------------------------------
     Theme swatches
     ---------------------------------------------------------------------- */
  (function themeSwatches() {
    $$(".swatch").forEach(function (s) {
      s.addEventListener("click", function () {
        var name = s.getAttribute("data-theme-preset");
        if (window.applyThemePreset) window.applyThemePreset(name);
      });
    });
  })();

  /* ----------------------------------------------------------------------
     Mini game
     ---------------------------------------------------------------------- */
  (function miniGame() {
    var modal = $("#game-modal");
    if (!modal) return;
    var canvas = $("#game-canvas");
    var ctx = canvas.getContext("2d");
    var scoreEl = $("#game-score");
    var livesEl = $("#game-lives");
    var startBtn = $("#game-start");
    var running = false;
    var raf = null;
    var basketX = canvas.width / 2;
    var items = [];
    var score = 0;
    var lives = 3;
    var spawnTimer = 0;
    var speed = 2.2;

    function open() {
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      reset();
      draw();
    }
    function close() {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      stop();
    }
    modal.querySelectorAll("[data-close-game]").forEach(function (el) {
      el.addEventListener("click", close);
    });

    function reset() {
      items = [];
      score = 0;
      lives = 3;
      speed = 2.2;
      spawnTimer = 0;
      scoreEl.textContent = "0";
      livesEl.textContent = "3";
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    }

    function start() {
      reset();
      running = true;
      startBtn.textContent = "Restart";
      loop();
    }

    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    }

    function spawn() {
      var types = ["{ }", "</>", "fn()", "=>", "[]", "&&", "npm", "git"];
      items.push({
        x: 40 + Math.random() * (canvas.width - 80),
        y: -20,
        vy: speed + Math.random() * 1.2,
        label: types[Math.floor(Math.random() * types.length)],
        color: ["#6366f1", "#ec4899", "#22d3ee", "#facc15", "#34d399"][Math.floor(Math.random() * 5)],
        caught: false,
      });
    }

    function loop() {
      if (!running) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#0b0f1a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      spawnTimer++;
      if (spawnTimer > 55) {
        spawn();
        spawnTimer = 0;
      }

      for (var i = items.length - 1; i >= 0; i--) {
        var it = items[i];
        it.y += it.vy;
        if (!it.caught && it.y > canvas.height - 40 && Math.abs(it.x - basketX) < 46) {
          it.caught = true;
          score += 10;
          scoreEl.textContent = String(score);
          items.splice(i, 1);
          continue;
        }
        if (it.y > canvas.height + 20) {
          items.splice(i, 1);
          lives--;
          livesEl.textContent = String(lives);
          if (lives <= 0) {
            running = false;
            startBtn.textContent = "Play again";
            setTimeout(function () { drawGameOver(); }, 50);
            return;
          }
          continue;
        }
        ctx.font = "bold 14px monospace";
        ctx.fillStyle = it.color;
        ctx.textAlign = "center";
        ctx.fillText(it.label, it.x, it.y);
      }

      ctx.fillStyle = "#6366f1";
      ctx.fillRect(basketX - 40, canvas.height - 28, 80, 12);
      ctx.fillStyle = "#ec4899";
      ctx.fillRect(basketX - 30, canvas.height - 40, 60, 12);

      raf = window.requestAnimationFrame(loop);
    }

    function draw() {
      ctx.fillStyle = "#0b0f1a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#97a1bd";
      ctx.font = "16px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("Press Start to play", canvas.width / 2, canvas.height / 2);
    }

    function drawGameOver() {
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 28px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 10);
      ctx.font = "16px system-ui";
      ctx.fillText("Final score: " + score, canvas.width / 2, canvas.height / 2 + 20);
    }

    canvas.addEventListener("mousemove", function (e) {
      var rect = canvas.getBoundingClientRect();
      var scaleX = canvas.width / rect.width;
      basketX = (e.clientX - rect.left) * scaleX;
      basketX = Math.max(40, Math.min(canvas.width - 40, basketX));
    });
    canvas.addEventListener("touchmove", function (e) {
      e.preventDefault();
      var rect = canvas.getBoundingClientRect();
      var scaleX = canvas.width / rect.width;
      basketX = (e.touches[0].clientX - rect.left) * scaleX;
      basketX = Math.max(40, Math.min(canvas.width - 40, basketX));
    }, { passive: false });

    startBtn.addEventListener("click", start);

    var gameBtn = document.querySelector('[data-action="game"]');
    if (gameBtn) {
      gameBtn.addEventListener("click", function () {
        open();
      });
    }
  })();

  /* launchConfetti bridge for terminal konami */
  /* (launchConfetti is scoped; expose via window) */

  (function year() {
    var el = $("#year");
    if (el) el.textContent = String(new Date().getFullYear());
  })();
})();
