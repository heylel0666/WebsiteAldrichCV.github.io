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
     Footer year
     ---------------------------------------------------------------------- */
  (function year() {
    var el = $("#year");
    if (el) el.textContent = String(new Date().getFullYear());
  })();
})();
