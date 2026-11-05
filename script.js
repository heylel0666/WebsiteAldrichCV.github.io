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
     Dialogs — scroll lock, focus handling, Escape to close
     ---------------------------------------------------------------------- */
  var openDialogs = [];
  var FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

  function focusables(modal) {
    return $$(FOCUSABLE, modal).filter(function (el) {
      return el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length;
    });
  }

  function lockScroll() {
    if (!openDialogs.length) return;
    var gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.classList.add("is-locked");
    document.body.style.paddingRight = gap > 0 ? gap + "px" : "";
  }

  function unlockScroll() {
    document.body.classList.remove("is-locked");
    document.body.style.paddingRight = "";
  }

  function openDialog(modal, trigger) {
    if (!modal || modal.classList.contains("is-open")) return;
    modal.__opener = trigger && typeof trigger.focus === "function" ? trigger : document.activeElement;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    openDialogs.push(modal);
    lockScroll();

    var target = modal.querySelector("[data-autofocus]") || focusables(modal)[0] || modal;
    if (target && target.focus) {
      if (!target.hasAttribute("tabindex") && target === modal) target.setAttribute("tabindex", "-1");
      window.setTimeout(function () {
        target.focus({ preventScroll: true });
      }, 30);
    }
  }

  function closeDialog(modal) {
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    var index = openDialogs.indexOf(modal);
    if (index > -1) openDialogs.splice(index, 1);
    if (!openDialogs.length) unlockScroll();

    var opener = modal.__opener;
    modal.__opener = null;
    if (opener && document.contains(opener) && typeof opener.focus === "function") {
      window.setTimeout(function () {
        opener.focus({ preventScroll: true });
      }, 10);
    }
  }

  document.addEventListener("keydown", function (e) {
    var modal = openDialogs[openDialogs.length - 1];
    if (!modal) return;

    if (e.key === "Escape") {
      e.preventDefault();
      var closeBtn = modal.querySelector(".game-modal__close");
      if (closeBtn) closeBtn.click();
      else closeDialog(modal);
      return;
    }

    if (e.key !== "Tab") return;

    var items = focusables(modal);
    if (!items.length) {
      e.preventDefault();
      return;
    }

    var first = items[0];
    var last = items[items.length - 1];
    var active = document.activeElement;

    if (e.shiftKey && (active === first || !modal.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !modal.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  });

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

    var resizeTimer = null;
    window.addEventListener("resize", function () {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        resize();
        makeParticles();
      }, 150);
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

    var running = false;
    var inView = true;

    function step() {
      if (!running) return;
      var w = canvas.width / dpr;
      var h = canvas.height / dpr;
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

    function sync() {
      var shouldRun = inView && !document.hidden;
      if (shouldRun === running) return;
      running = shouldRun;
      if (running) window.requestAnimationFrame(step);
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

    running = true;
    window.requestAnimationFrame(step);
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

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || !panel.classList.contains("is-open")) return;
      togglePanel(false);
      btn.focus();
    });

    // space game launcher (global)
    var openSpaceGame = function (trigger) {
      if (window.openSpaceGameImpl) window.openSpaceGameImpl(trigger);
    };

    var partyTimer = null;
    function toggleParty(force) {
      var on = force === undefined ? !document.body.classList.contains("is-party") : force;
      document.body.classList.toggle("is-party", on);
      if (on) {
        partyTimer = setTimeout(function () {
          toggleParty(false);
        }, 9000);
      } else {
        if (partyTimer) clearTimeout(partyTimer);
        partyTimer = null;
      }
    }

    function prepareScatter(el) {
      if (el.dataset.scattered === "1") return;
      el.dataset.originalHtml = el.innerHTML;
      var text = el.textContent.replace(/\s+/g, " ").trim();
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

    function restoreScatter(el) {
      if (el.dataset.originalHtml == null) return;
      el.innerHTML = el.dataset.originalHtml;
      delete el.dataset.originalHtml;
      el.dataset.scattered = "0";
    }

    var scatterActive = false;
    function scatterTitles() {
      scatterActive = !scatterActive;
      $$(".section__title, .hero__title").forEach(function (title) {
        if (!scatterActive) {
          restoreScatter(title);
          return;
        }
        prepareScatter(title);
        var chars = $$(".scatter-char", title);
        chars.forEach(function (ch) {
          var dx = (Math.random() - 0.5) * 80;
          var dy = (Math.random() - 0.5) * 60;
          var rot = (Math.random() - 0.5) * 40;
          ch.style.transform = "translate(" + dx + "px," + dy + "px) rotate(" + rot + "deg)";
          ch.classList.add("is-scattered");
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
    }

    $$(".fun-action").forEach(function (a) {
      a.addEventListener("click", function () {
        var action = a.getAttribute("data-action");
        togglePanel(false);
        switch (action) {
          case "space":
            openSpaceGame(btn);
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
          case "game":
            if (window.openMiniGameImpl) window.openMiniGameImpl(btn);
            break;
          case "tamagotchi":
            var im = document.querySelector("#iframe-modal");
            var iframe = document.querySelector("#game-iframe");
            var iTitle = document.querySelector("#iframe-title");
            if (im && iframe) {
              if (iTitle) iTitle.textContent = "Tamagotchi";
              iframe.title = "Tamagotchi game";
              iframe.src = "tamagotchi/index.html";
              openDialog(im, btn);
            }
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
          openSpaceGame();
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
          openSpaceGame();
          boom(e);
        }
      });
    }

    // expose for terminal/easter eggs
    window.toggleParty = toggleParty;
    var typed = "";
    document.addEventListener("keydown", function (e) {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT")) return;
      if (e.key && e.key.length === 1) {
        typed = (typed + e.key.toLowerCase()).slice(-7);
        if (typed === "aldrich") {
          typed = "";
          toggleRainbow(true);
          openSpaceGame();
          setTimeout(function () { toggleRainbow(false); }, 6000);
        }
      }
    });
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
        openSpaceGame();
        setTimeout(function () { document.body.classList.remove("is-party"); }, 9000);
        return "🚀 SPACE IMPACT LAUNCHED";
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
        var active = s.getAttribute("data-theme-preset") === name;
        s.classList.toggle("is-active", active);
        s.setAttribute("aria-pressed", String(active));
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
    var validPresets = ["default", "cyber", "sunset", "forest", "ocean", "candy"];
    try { stored = localStorage.getItem("theme-preset"); } catch (e) {}
    applyThemePreset(stored && validPresets.indexOf(stored) > -1 ? stored : "default");

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

    function open(trigger) {
      openDialog(modal, trigger);
      reset();
      draw();
    }
    function close() {
      stop();
      closeDialog(modal);
    }

    window.openMiniGameImpl = open;
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

  /* ----------------------------------------------------------------------
     Design playground
     ---------------------------------------------------------------------- */
  (function playground() {
    var color = $("#pg-color");
    var radius = $("#pg-radius");
    var spacing = $("#pg-spacing");
    var blur = $("#pg-blur");
    var font = $("#pg-font");
    var reset = $("#pg-reset");
    var preview = $("#pg-preview");
    if (!preview) return;

    var defaults = { color: "#6366f1", radius: 16, spacing: 16, blur: 12, font: "Outfit" };

    function apply() {
      var c = color ? color.value : defaults.color;
      var r = radius ? parseInt(radius.value, 10) : defaults.radius;
      var s = spacing ? parseInt(spacing.value, 10) : defaults.spacing;
      var b = blur ? parseInt(blur.value, 10) : defaults.blur;
      var f = font ? font.value : defaults.font;

      preview.style.setProperty("--pg-accent", c);
      preview.style.setProperty("--pg-radius", r + "px");
      preview.style.setProperty("--pg-blur", b + "px");

      var card = preview.querySelector(".pg-card");
      if (card) {
        card.style.fontFamily = f === "system-ui" ? "system-ui" : '"' + f + '", system-ui';
        card.style.padding = (s / 16 * 1.25).toFixed(2) + "rem";
      }

      var rv = $("#pg-radius-val");
      var sv = $("#pg-spacing-val");
      var bv = $("#pg-blur-val");
      if (rv) rv.textContent = r + "px";
      if (sv) sv.textContent = (s / 16).toFixed(2) + "rem";
      if (bv) bv.textContent = b + "px";
    }

    [color, radius, spacing, blur, font].forEach(function (el) {
      if (el) {
        el.addEventListener("input", apply);
        el.addEventListener("change", apply);
      }
    });

    if (reset) {
      reset.addEventListener("click", function () {
        if (color) color.value = defaults.color;
        if (radius) radius.value = defaults.radius;
        if (spacing) spacing.value = defaults.spacing;
        if (blur) blur.value = defaults.blur;
        if (font) font.value = defaults.font;
        apply();
      });
    }

    apply();
  })();

  /* ----------------------------------------------------------------------
     Space Impact game
     ---------------------------------------------------------------------- */
  (function spaceGame() {
    var modal = $("#space-modal");
    if (!modal) return;
    var canvas = $("#space-canvas");
    var ctx = canvas.getContext("2d");
    var scoreEl = $("#space-score");
    var livesEl = $("#space-lives");
    var startBtn = $("#space-start");
    var W = canvas.width;
    var H = canvas.height;

    var running = false;
    var raf = null;
    var player = { x: 60, y: H / 2, vy: 0, w: 28, h: 20 };
    var bullets = [];
    var enemies = [];
    var particles = [];
    var stars = [];
    var score = 0;
    var lives = 3;
    var spawnTimer = 0;
    var fireTimer = 0;
    var speed = 2.0;
    var keys = {};

    for (var i = 0; i < 80; i++) {
      stars.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 1.5 + 0.3, v: Math.random() * 1.2 + 0.3 });
    }

    function open(trigger) {
      openDialog(modal, trigger);
      reset();
      drawIdle();
    }
    function close() {
      stop();
      closeDialog(modal);
    }
    modal.querySelectorAll("[data-close-space]").forEach(function (el) {
      el.addEventListener("click", close);
    });

    function reset() {
      bullets = [];
      enemies = [];
      particles = [];
      score = 0;
      lives = 3;
      speed = 2.0;
      spawnTimer = 0;
      fireTimer = 0;
      player.y = H / 2;
      player.vy = 0;
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
      keys = {};
    }

    function spawnEnemy() {
      var type = Math.random() < 0.3 ? "big" : "small";
      enemies.push({
        x: W + 20,
        y: 30 + Math.random() * (H - 60),
        vy: (Math.random() - 0.5) * 1.2,
        w: type === "big" ? 34 : 22,
        h: type === "big" ? 26 : 16,
        hp: type === "big" ? 3 : 1,
        speed: speed + Math.random() * 0.8,
        type: type,
        color: type === "big" ? "#ec4899" : "#facc15",
      });
    }

    function explode(x, y, color) {
      for (var i = 0; i < 18; i++) {
        var a = Math.random() * Math.PI * 2;
        var sp = 1 + Math.random() * 3;
        particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 30 + Math.random() * 20, color: color });
      }
    }

    function loop() {
      if (!running) return;
      for (var i = 0; i < stars.length; i++) {
        stars[i].x -= stars[i].v;
        if (stars[i].x < 0) { stars[i].x = W; stars[i].y = Math.random() * H; }
      }

      if (keys["ArrowUp"] || keys["w"] || keys["W"]) player.y -= 4;
      if (keys["ArrowDown"] || keys["s"] || keys["S"]) player.y += 4;
      if (player.targetY !== undefined) {
        player.y += (player.targetY - player.y) * 0.18;
      }
      player.y = Math.max(20, Math.min(H - 20, player.y));

      fireTimer++;
      if (fireTimer > 10) {
        bullets.push({ x: player.x + 18, y: player.y, vx: 7 });
        fireTimer = 0;
      }

      for (var b = bullets.length - 1; b >= 0; b--) {
        bullets[b].x += bullets[b].vx;
        if (bullets[b].x > W + 10) bullets.splice(b, 1);
      }

      spawnTimer++;
      if (spawnTimer > 55) {
        spawnEnemy();
        spawnTimer = 0;
      }

      for (var e = enemies.length - 1; e >= 0; e--) {
        var en = enemies[e];
        en.x -= en.speed;
        en.y += en.vy;
        if (en.y < 20 || en.y > H - 20) en.vy *= -1;

        for (var bb = bullets.length - 1; bb >= 0; bb--) {
          var bl = bullets[bb];
          if (bl.x > en.x - en.w / 2 && bl.x < en.x + en.w / 2 && bl.y > en.y - en.h / 2 && bl.y < en.y + en.h / 2) {
            bullets.splice(bb, 1);
            en.hp--;
            if (en.hp <= 0) {
              explode(en.x, en.y, en.color);
              enemies.splice(e, 1);
              score += en.type === "big" ? 30 : 10;
              scoreEl.textContent = String(score);
              speed = 2.0 + score / 200;
            }
            break;
          }
        }

        if (enemies[e]) {
          var en2 = enemies[e];
          if (en2.x < -30) {
            enemies.splice(e, 1);
            lives--;
            livesEl.textContent = String(lives);
            if (lives <= 0) { gameOver(); return; }
            continue;
          }
          if (Math.abs(en2.x - player.x) < (en2.w + player.w) / 2 && Math.abs(en2.y - player.y) < (en2.h + player.h) / 2) {
            explode(en2.x, en2.y, en2.color);
            enemies.splice(e, 1);
            lives--;
            livesEl.textContent = String(lives);
            if (lives <= 0) { gameOver(); return; }
          }
        }
      }

      for (var p = particles.length - 1; p >= 0; p--) {
        var pt = particles[p];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.vx *= 0.96;
        pt.vy *= 0.96;
        pt.life++;
        if (pt.life > pt.max) particles.splice(p, 1);
      }

      draw();
      raf = window.requestAnimationFrame(loop);
    }

    function draw() {
      ctx.fillStyle = "#050816";
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = "#97a1bd";
      for (var i = 0; i < stars.length; i++) {
        ctx.globalAlpha = 0.4 + 0.6 * Math.random();
        ctx.fillRect(stars[i].x, stars[i].y, stars[i].s, stars[i].s);
      }
      ctx.globalAlpha = 1;

      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.fillStyle = "#6366f1";
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-14, -10);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-14, 10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#22d3ee";
      ctx.fillRect(-10, -3, 6, 6);
      ctx.restore();

      ctx.fillStyle = "#facc15";
      for (var b = 0; b < bullets.length; b++) {
        ctx.fillRect(bullets[b].x - 2, bullets[b].y - 2, 8, 4);
      }

      for (var e = 0; e < enemies.length; e++) {
        var en = enemies[e];
        ctx.fillStyle = en.color;
        ctx.fillRect(en.x - en.w / 2, en.y - en.h / 2, en.w, en.h);
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(en.x - en.w / 4, en.y - en.h / 4, en.w / 2, en.h / 2);
      }

      for (var p = 0; p < particles.length; p++) {
        var pt = particles[p];
        var t = pt.life / pt.max;
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x - 1.5, pt.y - 1.5, 3, 3);
      }
      ctx.globalAlpha = 1;
    }

    function drawIdle() {
      ctx.fillStyle = "#050816";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#97a1bd";
      ctx.font = "16px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("Press Start to launch", W / 2, H / 2);
    }

    function gameOver() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 28px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("Mission Failed", W / 2, H / 2 - 10);
      ctx.font = "16px system-ui";
      ctx.fillText("Final score: " + score, W / 2, H / 2 + 20);
      startBtn.textContent = "Play again";
    }

    canvas.addEventListener("mousemove", function (e) {
      var rect = canvas.getBoundingClientRect();
      var scaleY = H / rect.height;
      player.targetY = (e.clientY - rect.top) * scaleY;
    });
    canvas.addEventListener("touchmove", function (e) {
      e.preventDefault();
      var rect = canvas.getBoundingClientRect();
      var scaleY = H / rect.height;
      player.targetY = (e.touches[0].clientY - rect.top) * scaleY;
    }, { passive: false });

    var gameKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "W", "s", "S", "a", "A", "d", "D"];
    window.addEventListener("keydown", function (e) {
      if (modal.getAttribute("aria-hidden") !== "false") return;
      if (gameKeys.indexOf(e.key) > -1) e.preventDefault();
      keys[e.key] = true;
    });
    window.addEventListener("keyup", function (e) {
      keys[e.key] = false;
    });

    startBtn.addEventListener("click", start);

    window.openSpaceGameImpl = open;

    var spaceBtn = document.querySelector('[data-action="space"]');
    if (spaceBtn) spaceBtn.addEventListener("click", open);
  })();

  /* ----------------------------------------------------------------------
     Iframe game modal close handling
     ---------------------------------------------------------------------- */
  (function iframeModal() {
    var modal = $("#iframe-modal");
    if (!modal) return;
    modal.querySelectorAll("[data-close-iframe]").forEach(function (el) {
      el.addEventListener("click", function () {
        closeDialog(modal);
        var iframe = $("#game-iframe");
        if (iframe) iframe.src = "about:blank";
      });
    });
  })();

  (function year() {
    var el = $("#year");
    if (el) el.textContent = String(new Date().getFullYear());
  })();
})();
