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

  /* Pages call Motion.ready(images) once their content is on screen */
  let markReady;
  const pageReady = new Promise((r) => { markReady = r; });
  function ready(images = []) {
    const waits = [...images].filter(Boolean).map((img) =>
      img.complete ? Promise.resolve() : new Promise((r) => { img.addEventListener("load", r, { once: true }); img.addEventListener("error", r, { once: true }); }));
    Promise.all(waits).then(() => markReady());
  }

  function firstVisit() { try { return !sessionStorage.getItem("visited"); } catch (e) { return false; } }
  function markVisited() { try { sessionStorage.setItem("visited", "1"); } catch (e) {} }

  /* First visit of the session: a 0-100 counter that follows real loading
     steps (fonts, page load, page content). Never waits more than ~4.5 s. */
  function loadingCounter() {
    const counter = document.createElement("div");
    counter.className = "wipe-count";
    counter.innerHTML = '<span class="wipe-num">000</span><span class="wipe-pct">%</span>';
    wipe.appendChild(counter);
    wipe.classList.add("is-counting");
    if (wipeLabel) wipeLabel.textContent = ">loading_portfolio_";
    const num = counter.querySelector(".wipe-num");

    const steps = [
      document.fonts ? document.fonts.ready : Promise.resolve(),
      document.readyState === "complete" ? Promise.resolve() : new Promise((r) => window.addEventListener("load", r, { once: true })),
      pageReady,
    ];
    let target = 6;
    let doneSteps = 0;
    steps.forEach((step) => step.then(() => { doneSteps++; target = Math.max(target, Math.round((doneSteps / steps.length) * 100)); }));

    let allDone = false;
    const minTime = new Promise((r) => setTimeout(r, 1400));
    const timeout = new Promise((r) => setTimeout(r, 4500));
    Promise.race([Promise.all([Promise.all(steps), minTime]), timeout]).then(() => { allDone = true; });

    let shown = 0;
    return new Promise((resolve) => {
      const tick = () => {
        const goal = allDone ? 100 : Math.min(target, 96);
        shown = Math.min(goal, shown + Math.max((goal - shown) * 0.09, 0.3));
        num.textContent = String(Math.floor(shown)).padStart(3, "0");
        if (allDone && shown >= 100) {
          gsap.ticker.remove(tick);
          num.textContent = "100";
          setTimeout(resolve, 200);
        }
      };
      gsap.ticker.add(tick);
    }).then(() => gsap.to(counter, { autoAlpha: 0, y: -20, duration: 0.3, ease: "power2.in" }).then());
  }

  /* Resolves when the page is uncovered enough for intros to start */
  const entered = new Promise(async (resolve) => {
    if (!on || !wipe) return resolve();
    gsap.set(wipe, { clipPath: "inset(0% 0% 0% 0%)", visibility: "visible" });
    if (firstVisit()) {
      markVisited();
      await loadingCounter();
    } else if (wipeLabel) {
      wipeLabel.textContent = readLabel() || wipeLabel.textContent;
    }
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
    wipe.classList.remove("is-counting");
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

  /* Film grain: a small noise tile, generated once, shifted every frame by CSS */
  function grainTile() {
    const size = 160;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL("image/png");
  }

  /* Banner slideshow: each image holds for 8 s under a film grain,
     then an RGB glitch tears it into the next one. */
  function heroSlides(bg, srcs) {
    bg.style.backgroundImage = "none";
    const HOLD = 8;

    const grain = document.createElement("div");
    grain.className = "hero-grain";
    try { grain.style.backgroundImage = `url("${grainTile()}")`; } catch (e) {}
    bg.parentElement.appendChild(grain);

    const make = (src) => {
      const el = document.createElement("div");
      el.className = "hero-slide";
      el.style.backgroundImage = `url("${src}")`;
      bg.appendChild(el);
      return el;
    };
    const load = (src) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.naturalWidth === 120 ? src.replace("maxresdefault", "hqdefault") : src);
      img.onerror = () => resolve(null);
      img.src = src;
    });

    /* ~0.7 s glitch: slices of old and new images jump sideways,
       red and cyan copies split apart, then everything snaps to the new image */
    function glitchTo(oldSlide, oldSrc, newSrc) {
      return new Promise((resolve) => {
        const fresh = make(newSrc);
        gsap.set(fresh, { autoAlpha: 0 });
        const fx = document.createElement("div");
        fx.className = "glitch-fx";
        const bands = Array.from({ length: 11 }, () => {
          const band = document.createElement("div");
          band.className = "glitch-band";
          fx.appendChild(band);
          return band;
        });
        const red = document.createElement("div");
        const cyan = document.createElement("div");
        red.className = "glitch-rgb r";
        cyan.className = "glitch-rgb c";
        red.style.backgroundImage = cyan.style.backgroundImage = `url("${newSrc}")`;
        fx.append(red, cyan);
        bg.appendChild(fx);

        const STEP = 0.055;
        const FRAMES = 11;
        const tl = gsap.timeline({
          onComplete: () => {
            fx.remove();
            oldSlide.remove();
            resolve(fresh);
          },
        });
        for (let f = 0; f < FRAMES; f++) {
          tl.call(() => {
            const progress = f / (FRAMES - 1);
            bands.forEach((band) => {
              const top = Math.random() * 92;
              const h = 3 + Math.random() * 18;
              band.style.backgroundImage = `url("${Math.random() < progress ? newSrc : oldSrc}")`;
              band.style.clipPath = `inset(${top}% 0 ${Math.max(0, 100 - top - h)}% 0)`;
              band.style.transform = `translateX(${(Math.random() - 0.5) * 320}px)`;
              band.style.display = Math.random() < 0.85 ? "block" : "none";
            });
            gsap.set(red, { x: 14 + Math.random() * 34, y: (Math.random() - 0.5) * 6, autoAlpha: 0.55 + Math.random() * 0.35 });
            gsap.set(cyan, { x: -(14 + Math.random() * 34), y: (Math.random() - 0.5) * 6, autoAlpha: 0.55 + Math.random() * 0.35 });
            fx.style.filter = Math.random() < 0.35 ? "brightness(1.8) contrast(1.3) saturate(1.4)" : "none";
          }, null, f * STEP);
        }
        tl.set(fresh, { autoAlpha: 1 }, Math.floor(FRAMES / 2) * STEP)
          .call(() => {
            bands.forEach((band) => (band.style.display = "none"));
            fx.style.filter = "none";
          }, null, FRAMES * STEP)
          .to([red, cyan], { x: 0, y: 0, autoAlpha: 0, duration: 0.4, ease: "power2.out" }, FRAMES * STEP);
      });
    }

    (async () => {
      let index = 0;
      let first = await load(srcs[0]);
      while (!first && index < srcs.length - 1) first = await load(srcs[++index]);
      ready();
      if (!first) return;
      let shown = make(first);
      let shownSrc = first;
      if (!on) { bg.classList.add("is-loaded"); return; }

      await entered;
      gsap.fromTo(bg, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.4, ease: "power2.out" });
      if (srcs.length < 2) return;

      const next = async () => {
        index = (index + 1) % srcs.length;
        const src = await load(srcs[index]);
        if (!src) { gsap.delayedCall(0.1, next); return; }
        shown = await glitchTo(shown, shownSrc, src);
        shownSrc = src;
        gsap.delayedCall(HOLD, next);
      };
      gsap.delayedCall(HOLD, next);
    })();
  }

  /* Mosaic: move cards to their new spots, fade the filtered ones */
  function arrange(moves, animate) {
    moves.forEach(({ card, show, x, y }) => {
      const wasHidden = card.dataset.hidden === "1";
      if (!show) {
        if (wasHidden) return;
        card.dataset.hidden = "1";
        if (on && animate) {
          gsap.to(card, { autoAlpha: 0, scale: 0.94, duration: 0.3, ease: "power2.in", onComplete: () => { if (card.dataset.hidden === "1") card.style.display = "none"; } });
        } else {
          card.style.display = "none";
        }
        return;
      }
      card.dataset.hidden = "0";
      card.style.display = "";
      if (!on) { card.style.transform = `translate(${x}px, ${y}px)`; return; }
      if (animate && wasHidden) {
        gsap.set(card, { x, y });
        gsap.fromTo(card, { autoAlpha: 0, scale: 0.94 }, { autoAlpha: 1, scale: 1, duration: 0.5, delay: 0.2, ease: "power3.out" });
      } else if (animate) {
        gsap.to(card, { x, y, autoAlpha: 1, scale: 1, duration: 0.65, ease: "power3.inOut" });
      } else {
        gsap.set(card, { x, y, autoAlpha: 1, scale: 1 });
      }
    });
    refresh();
  }

  /* Underline that slides to the active tab */
  function tabInk(tabs, btn, animate) {
    const ink = tabs.querySelector(".tab-ink");
    if (!ink || !btn) return;
    const x = btn.offsetLeft;
    const width = btn.offsetWidth;
    if (!on) { ink.style.transform = `translateX(${x}px)`; ink.style.width = `${width}px`; return; }
    if (animate) gsap.to(ink, { x, width, duration: 0.45, ease: "power3.inOut" });
    else gsap.set(ink, { x, width });
  }

  /* ArtStation-style page: each image wipes in as it reaches the screen */
  function artStack(stack) {
    if (!stack || !on) return;
    stack.querySelectorAll("figure").forEach((fig) => {
      gsap.fromTo(fig,
        { clipPath: "inset(10% 0% 10% 0%)", autoAlpha: 0.2 },
        { clipPath: "inset(0% 0% 0% 0%)", autoAlpha: 1, duration: 1, ease: "power3.out", scrollTrigger: { trigger: fig, start: "top 90%", once: true } });
    });
    stack.querySelectorAll("img").forEach((img) => img.addEventListener("load", refresh, { once: true }));
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
    artStack(document.getElementById("art-stack"));
  }

  /* ---------- About page ---------- */

  async function aboutIntro() {
    const name = document.querySelector(".about-intro [data-name]");
    timeline();
    if (!on) return;
    await entered;
    gsap.timeline()
      .fromTo(".avatar-wrap", { clipPath: "inset(100% 0% 0% 0%)", autoAlpha: 1 }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1, ease: "power4.out" })
      .set(".about-intro h1", { autoAlpha: 1 }, 0.1)
      .call(() => scramble(name, name.textContent, 1), null, 0.1)
      .fromTo([".about-intro .hero-place", ".about-intro .summary"], { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.12, ease: "power3.out" }, 0.4);
    tapes();
    reveal(".chips .chip", { y: 12, stagger: 0.03 });
    reveal(".block-title", { y: 12 });
  }

  /* Experience timeline: the line draws with the scroll, nodes light up */
  function timeline() {
    const el = document.querySelector(".timeline");
    if (!el) return;
    const line = el.querySelector(".timeline-progress");
    const jobs = [...el.querySelectorAll(".job")];
    if (!on) {
      el.classList.add("is-static");
      jobs.forEach((j) => j.classList.add("is-lit"));
      return;
    }
    gsap.fromTo(line, { scaleY: 0 }, {
      scaleY: 1,
      ease: "none",
      scrollTrigger: { trigger: el, start: "top 70%", end: "bottom 55%", scrub: true },
    });
    jobs.forEach((job) => {
      ScrollTrigger.create({
        trigger: job,
        start: "top 65%",
        onEnter: () => job.classList.add("is-lit"),
        onLeaveBack: () => job.classList.remove("is-lit"),
      });
    });
    reveal(jobs, { y: 30 });
  }

  /* Contact block before the footer: title decodes when it scrolls in */
  function contact() {
    const block = document.querySelector(".contact");
    if (!block || !on) return;
    const word = block.querySelector(".contact-title .w");
    gsap.set([".contact-title", ".contact-sub", ".contact-actions"], { autoAlpha: 0, y: 24 });
    ScrollTrigger.create({
      trigger: block,
      start: "top 75%",
      once: true,
      onEnter: () => {
        gsap.to([".contact-title", ".contact-sub", ".contact-actions"], { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.12, ease: "power3.out" });
        scramble(word, word.textContent, 1.2);
      },
    });
  }

  /* Social icons and contact buttons drift toward the pointer */
  function magnets() {
    if (!on || !finePointer) return;
    document.querySelectorAll(".socials a, .contact-link, .contact-mail").forEach((el) => {
      if (el.dataset.magnet) return;
      el.dataset.magnet = "1";
      const pull = el.matches(".socials a") ? 0.55 : 0.3;
      const x = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" });
      const y = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" });
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        x((e.clientX - (r.left + r.width / 2)) * pull);
        y((e.clientY - (r.top + r.height / 2)) * pull);
      });
      el.addEventListener("pointerleave", () => { x(0); y(0); });
    });
  }

  contact();

  /* Safety net: never leave hidden content if something fails */
  if (on) setTimeout(() => root.classList.remove("js"), 9000);

  return { on, lenis: () => lenis, entered, ready, magnets, timeline, go, scramble, reveal, tapes, refresh, hero, heroIntro, heroSlides, arrange, tabInk, cards, projectIntro, aboutIntro };
})();
