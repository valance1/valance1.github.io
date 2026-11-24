/* =========================================================
   Motion: page transitions, hero parallax, card tilt,
   text scramble and scroll reveals. Uses GSAP + ScrollTrigger.
   Everything is skipped when the visitor asks for reduced motion,
   and the site still works if GSAP fails to load.
   ========================================================= */

const Motion = (() => {
  const root = document.documentElement;
  const hasGsap = typeof window.gsap !== "undefined";
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const on = hasGsap && !reduced;

  if (!on) {
    // No animation: show everything as is
    root.classList.remove("js");
  } else {
    root.classList.add("motion-on");
    if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
  }

  /* ---------- Smooth scroll (Lenis) ---------- */

  let lenis = null;
  if (on && window.Lenis && window.ScrollTrigger) {
    lenis = new Lenis({ lerp: 0.1, anchors: { offset: -72 }, autoRaf: false });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  /* ---------- Text scramble (terminal decode) ---------- */

  const GLYPHS = "!<>-_\\/[]{}=+*^?#%&01ABCDEFGHJKLMNPQRSTUVWXYZ";
  const scrambleJobs = new WeakMap();

  function scramble(el, finalText, duration = 0.6) {
    if (!el) return Promise.resolve();
    const text = finalText ?? el.dataset.text ?? el.textContent;
    el.dataset.text = text;
    if (!on) { el.textContent = text; return Promise.resolve(); }

    const token = {};
    scrambleJobs.set(el, token);
    const chars = [...text];
    const ms = duration * 1000;
    const settleAt = chars.map((c, i) => (i / chars.length) * ms * 0.65 + Math.random() * ms * 0.35);
    const start = performance.now();

    return new Promise((resolve) => {
      function frame(now) {
        if (scrambleJobs.get(el) !== token) return resolve();
        const t = now - start;
        let done = true;
        el.textContent = chars
          .map((c, i) => {
            if (c === " " || t >= settleAt[i]) return c;
            done = false;
            return GLYPHS[(Math.random() * GLYPHS.length) | 0];
          })
          .join("");
        if (done) { el.textContent = text; resolve(); }
        else requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  }

  /* ---------- Page transitions ---------- */

  const wipe = document.querySelector(".wipe");
  const wipeLabel = wipe && wipe.querySelector(".wipe-label");
  let leaving = false;

  function readLabel() {
    try { return sessionStorage.getItem("wipe-label") || ""; } catch (e) { return ""; }
  }
  function saveLabel(text) {
    try { sessionStorage.setItem("wipe-label", text); } catch (e) {}
  }

  /* Resolves when the page is uncovered enough for intros to start */
  const entered = new Promise((resolve) => {
    if (!on || !wipe) return resolve();
    if (wipeLabel) wipeLabel.textContent = readLabel() || wipeLabel.textContent;
    gsap.set(wipe, { clipPath: "inset(0% 0% 0% 0%)", visibility: "visible" });
    gsap.timeline({ delay: 0.15 })
      .to(wipeLabel, { autoAlpha: 0, y: -12, duration: 0.3, ease: "power2.in" })
      .to(wipe, {
        clipPath: "inset(0% 0% 100% 0%)",
        duration: 0.75,
        ease: "power3.inOut",
        onComplete: () => gsap.set(wipe, { visibility: "hidden" }),
      }, "-=0.05")
      .call(resolve, null, "-=0.45");
  });

  function go(url, label = "") {
    if (!on || !wipe || leaving) { location.href = url; return; }
    leaving = true;
    const text = `>${label.trim() || "loading"}_`;
    saveLabel(text);
    if (wipeLabel) wipeLabel.textContent = text;
    gsap.timeline({ onComplete: () => { location.href = url; } })
      .set(wipe, { visibility: "visible", clipPath: "inset(100% 0% 0% 0%)" })
      .set(wipeLabel, { autoAlpha: 0, y: 12 })
      .to(wipe, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.55, ease: "power3.inOut" })
      .to(wipeLabel, { autoAlpha: 1, y: 0, duration: 0.25, ease: "power2.out" }, "-=0.15");
  }

  function isInternalPage(a) {
    if (!a || a.target === "_blank" || a.hasAttribute("download")) return false;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return false;
    if (url.pathname === location.pathname && url.search === location.search && url.hash) return false;
    return /\.html$|\/$/.test(url.pathname);
  }

  if (on && wipe) {
    document.addEventListener("click", (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest("a[href]");
      if (!isInternalPage(a)) return;
      e.preventDefault();
      const label = a.dataset.label || a.getAttribute("aria-label") || a.textContent;
      go(a.href, label.replace(/\s+/g, " "));
    });

    // Coming back with the browser's back button: make sure the cover is gone
    window.addEventListener("pageshow", (e) => {
      if (e.persisted) {
        leaving = false;
        gsap.set(wipe, { visibility: "hidden", clipPath: "inset(0% 0% 100% 0%)" });
      }
    });
  }

  /* ---------- Scroll helpers ---------- */

  let refreshTimer;
  function refresh() {
    if (!on || !window.ScrollTrigger) return;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 120);
  }
  window.addEventListener("load", refresh);

  /* Fade + rise when an element enters the screen */
  function reveal(targets, { y = 28, stagger = 0.08, start = "top 85%" } = {}) {
    if (!on) return;
    const els = gsap.utils.toArray(targets);
    if (!els.length) return;
    gsap.set(els, { autoAlpha: 0, y });
    ScrollTrigger.batch(els, {
      start,
      once: true,
      onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.8, ease: "power3.out", stagger }),
    });
  }

  /* Striped tapes slide with the scroll; labels open from the center */
  function tapes() {
    if (!on) return;
    gsap.utils.toArray(".tape").forEach((tape) => {
      gsap.fromTo(tape, { backgroundPosition: "0px 0px" }, {
        backgroundPosition: "320px 0px",
        ease: "none",
        scrollTrigger: { trigger: tape, start: "top bottom", end: "bottom top", scrub: true },
      });
      const label = tape.querySelector(".tape-label");
      if (!label) return;
      gsap.fromTo(label,
        { clipPath: "inset(0% 50% 0% 50%)" },
        {
          clipPath: "inset(0% 0% 0% 0%)",
          duration: 0.9,
          ease: "power4.out",
          scrollTrigger: { trigger: tape, start: "top 85%", toggleActions: "play none none reverse" },
          onStart: () => {
            const word = label.querySelector(".w");
            if (word) scramble(word, null, 0.7);
          },
        });
    });
  }

  /* Horizontal gallery: pinned and scroll-driven on wide screens,
     a swipeable strip everywhere else */
  function hgallery(section) {
    if (!section || section.hidden) return;
    const scroller = section.querySelector(".hgallery");
    const track = section.querySelector(".hgallery-track");
    const bar = section.querySelector(".hgallery-bar i");
    const count = section.querySelector(".hgallery-count");
    const figs = [...track.children];
    const n = figs.length;
    const setCount = (i) => { count.textContent = `${i} / ${n}`; };
    const setBar = (p) => { bar.style.transform = `scaleX(${p})`; };
    setCount(1);

    const wide = window.matchMedia("(min-width: 761px)").matches;
    if (!on || !wide || n < 2) {
      const update = () => {
        const max = scroller.scrollWidth - scroller.clientWidth;
        const p = max > 0 ? scroller.scrollLeft / max : 1;
        setBar(p);
        setCount(Math.round(p * (n - 1)) + 1);
      };
      scroller.addEventListener("scroll", update, { passive: true });
      window.addEventListener("load", update);
      update();
      if (on) reveal(figs, { y: 24 });
      return;
    }

    section.classList.add("is-pinned");
    const pin = section.querySelector(".hgallery-pin");
    const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);

    const strip = gsap.to(track, {
      x: () => -distance(),
      ease: "none",
      scrollTrigger: {
        trigger: pin,
        start: "top top",
        end: () => `+=${distance()}`,
        pin: true,
        scrub: 0.8,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          setBar(self.progress);
          setCount(Math.min(n, Math.floor(self.progress * n) + 1));
        },
      },
    });

    // Each picture drifts inside its frame as it crosses the screen
    figs.forEach((fig) => {
      const img = fig.querySelector(".shot > img");
      if (!img) return;
      gsap.fromTo(img, { xPercent: -5, scale: 1.12 }, {
        xPercent: 5,
        scale: 1.12,
        ease: "none",
        scrollTrigger: { trigger: fig, containerAnimation: strip, start: "left right", end: "right left", scrub: true },
      });
    });

    track.querySelectorAll("img").forEach((img) => img.addEventListener("load", refresh, { once: true }));
  }

  /* ---------- Home hero ---------- */

  function hero() {
    const heroEl = document.querySelector(".hero");
    if (!heroEl || !on) return;

    const bg = heroEl.querySelector(".hero-bg");
    const outline = heroEl.querySelector(".hero-outline");
    const inner = heroEl.querySelector(".hero-inner");

    // Scroll: each layer travels at its own speed
    const st = { trigger: heroEl, start: "top top", end: "bottom top", scrub: true };
    gsap.to(".hero-bg-wrap", { y: () => heroEl.offsetHeight * 0.35, ease: "none", scrollTrigger: { ...st, invalidateOnRefresh: true } });
    gsap.to(".hero-outline-wrap", { y: () => -heroEl.offsetHeight * 0.25, ease: "none", scrollTrigger: { ...st, invalidateOnRefresh: true } });
    gsap.to(".hero-content", { y: -90, autoAlpha: 0, ease: "none", scrollTrigger: { ...st, end: "80% top" } });

    // Mouse: deeper layers move less
    if (finePointer) {
      const layers = [
        [bg, 18, 12],
        [outline, 46, 26],
        [inner, 10, 6],
      ].filter(([el]) => el).map(([el, ax, ay]) => ({
        x: gsap.quickTo(el, "x", { duration: 0.9, ease: "power3.out" }),
        y: gsap.quickTo(el, "y", { duration: 0.9, ease: "power3.out" }),
        ax, ay,
      }));
      heroEl.addEventListener("pointermove", (e) => {
        const r = heroEl.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width - 0.5;
        const ny = (e.clientY - r.top) / r.height - 0.5;
        layers.forEach((l) => { l.x(-nx * l.ax * 2); l.y(-ny * l.ay * 2); });
      });
      heroEl.addEventListener("pointerleave", () => layers.forEach((l) => { l.x(0); l.y(0); }));
    }
  }

  /* The one orchestrated moment: name decodes, roles slide in */
  async function heroIntro() {
    const title = document.querySelector(".hero-title [data-name]");
    if (!on) return;
    await entered;
    const tl = gsap.timeline();
    tl.to(".hero-title", { autoAlpha: 1, duration: 0.01 })
      .call(() => scramble(title, title.textContent, 1.1))
      .fromTo(".hero-outline", { autoAlpha: 0, xPercent: 8 }, { autoAlpha: 1, xPercent: 0, duration: 1.6, ease: "power3.out" }, 0)
      .fromTo(".hero-roles li", { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: 0.07 }, 0.55)
      .fromTo(".hero-place", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6 }, 1)
      .fromTo(".jump > *", { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.06, ease: "power2.out" }, 0.9);
  }

  function heroBg(bg, src) {
    bg.style.backgroundImage = `url("${src}")`;
    if (!on) { bg.classList.add("is-loaded"); return; }
    entered.then(() => {
      gsap.fromTo(bg, { autoAlpha: 0, scale: 1.25 }, { autoAlpha: 1, scale: 1.08, duration: 2, ease: "power2.out" });
    });
  }

  /* ---------- Cards: 3D tilt with glare + title scramble ---------- */

  function cards(grid) {
    if (!grid) return;
    grid.querySelectorAll(".card:not(.card--soon)").forEach((card) => {
      const title = card.querySelector(".card-title");
      if (title) {
        card.setAttribute("aria-label", title.textContent);
        const run = () => scramble(title, title.dataset.text || title.textContent, 0.55);
        card.addEventListener("pointerenter", run);
        card.addEventListener("focus", run);
      }

      if (!on || !finePointer) return;
      const thumb = card.querySelector(".card-thumb");
      const glare = document.createElement("span");
      glare.className = "glare";
      thumb.appendChild(glare);

      const rx = gsap.quickTo(thumb, "rotationX", { duration: 0.6, ease: "power3.out" });
      const ry = gsap.quickTo(thumb, "rotationY", { duration: 0.6, ease: "power3.out" });
      const sc = gsap.quickTo(thumb, "scale", { duration: 0.6, ease: "power3.out" });

      card.addEventListener("pointermove", (e) => {
        const r = thumb.getBoundingClientRect();
        const px = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);
        const py = Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1);
        ry((px - 0.5) * 16);
        rx((0.5 - py) * 12);
        sc(1.03);
        glare.style.setProperty("--gx", `${px * 100}%`);
        glare.style.setProperty("--gy", `${py * 100}%`);
      });
      card.addEventListener("pointerenter", () => gsap.to(glare, { autoAlpha: 1, duration: 0.3 }));
      card.addEventListener("pointerleave", () => {
        rx(0); ry(0); sc(1);
        gsap.to(glare, { autoAlpha: 0, duration: 0.4 });
      });
    });
    refresh();
  }

  /* ---------- Project page ---------- */

  async function projectIntro() {
    const title = document.querySelector("#title .t");
    if (!on) return;
    await entered;
    gsap.timeline()
      .fromTo("#player-band:not([hidden]) .player", { autoAlpha: 0, scale: 0.97 }, { autoAlpha: 1, scale: 1, duration: 1, ease: "power3.out" })
      .set("#title", { autoAlpha: 1 }, 0.15)
      .call(() => title && scramble(title, title.textContent, 0.9), null, 0.15)
      .fromTo(["#desc", "#tags"], { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: "power3.out", stagger: 0.1 }, 0.35)
      .fromTo("#credits > div", { autoAlpha: 0, x: 16 }, { autoAlpha: 1, x: 0, duration: 0.6, ease: "power3.out", stagger: 0.08 }, 0.45);
    tapes();
    hgallery(document.getElementById("gallery-section"));
  }

  /* ---------- About page ---------- */

  async function aboutIntro() {
    const name = document.querySelector(".about-intro [data-name]");
    if (!on) return;
    await entered;
    gsap.timeline()
      .fromTo(".avatar", { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1, ease: "power4.out" })
      .set(".about-intro h1", { autoAlpha: 1 }, 0.1)
      .call(() => scramble(name, name.textContent, 1), null, 0.1)
      .fromTo([".about-intro .hero-place", ".about-intro .summary"], { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.12, ease: "power3.out" }, 0.4);
    tapes();
    reveal(".chips .chip", { y: 12, stagger: 0.03 });
    reveal(".block-title", { y: 12 });
    reveal(".job", { y: 30 });
  }

  /* Safety net: never leave hidden content if something fails */
  if (on) setTimeout(() => root.classList.remove("js"), 6000);

  return { on, lenis: () => lenis, entered, go, scramble, reveal, tapes, refresh, hero, heroIntro, heroBg, cards, projectIntro, aboutIntro };
})();
