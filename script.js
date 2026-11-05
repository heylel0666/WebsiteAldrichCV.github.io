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
  (function year() {
    var el = $("#year");
    if (el) el.textContent = String(new Date().getFullYear());
  })();
})();
