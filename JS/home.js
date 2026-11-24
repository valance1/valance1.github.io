/* Home page: hero banner, category tabs, project mosaic, "in production" list */

(async () => {
  const esc = Site.escapeHtml;

  /* ---------- Hero text from Config/userinformation.txt ---------- */
  const user = await Site.chrome();
  const roles = (user.role || "")
    .split(/[|/]|@/)
    .map((r) => r.trim())
    .filter(Boolean);
  document.getElementById("hero-roles").innerHTML = roles.map((r) => `<li>${esc(r)}</li>`).join("");
  if (user.place) document.getElementById("hero-place").textContent = `Based in ${user.place}`;
  Motion.hero();
  Motion.heroIntro();

  /* ---------- Projects ---------- */
  const grid = document.getElementById("work-grid");
  const slugs = await Site.projectList();
  const projects = (await Promise.all(slugs.map(Site.project))).filter(Boolean);

  if (!projects.length) {
    grid.innerHTML = `<p class="empty">No projects yet. Add a folder name to Config/projects.txt.</p>`;
  } else {
    grid.innerHTML = projects
      .map((p) => {
        const meta = [p.year && `<b>${esc(p.year)}</b>`, p.client && esc(p.client)].filter(Boolean).join("");
        const kind = p.categories.join(" / ");
        return `
          <a class="card" href="${p.url}" data-cats="${esc(p.categories.join(",").toLowerCase())}" data-art="${p.isArt ? 1 : 0}">
            <div class="card-thumb">${p.thumb ? `<img src="${esc(p.thumb)}" alt="" loading="lazy">` : ""}<span class="card-kind">${esc(kind)}</span></div>
            <h3 class="card-title">${esc(p.title)}</h3>
            ${meta ? `<p class="card-meta">${meta}</p>` : ""}
            <span class="card-cta">View project</span>
          </a>`;
      })
      .join("");
  }

  const cards = [...grid.querySelectorAll(".card")];

  /* Thumbnails: videos stay 16:9, image projects keep their own shape */
  cards.forEach((card) => {
    const img = card.querySelector(".card-thumb img");
    if (!img) return;
    Site.fixYouTubeThumb(img);
    if (card.dataset.art === "1") {
      const setShape = () => {
        if (!img.naturalWidth) return;
        const ratio = Math.min(Math.max(img.naturalWidth / img.naturalHeight, 0.65), 2);
        card.querySelector(".card-thumb").style.setProperty("--ar", ratio);
        layout(false);
      };
      if (img.complete) setShape(); else img.addEventListener("load", setShape, { once: true });
    }
  });

  /* ---------- Mosaic layout (masonry) ---------- */
  let current = "all";

  function columnsFor(width) {
    if (width < 560) return 1;
    if (width < 900) return 2;
    return 3;
  }

  function layout(animate = false) {
    if (!cards.length) return;
    const width = grid.clientWidth;
    const gap = width < 560 ? 32 : 28;
    const cols = columnsFor(width);
    const colW = (width - gap * (cols - 1)) / cols;
    const heights = new Array(cols).fill(0);
    const moves = [];

    cards.forEach((card) => {
      const show = current === "all" || card.dataset.cats.split(",").includes(current);
      card.style.width = `${colW}px`;
      if (!show) { moves.push({ card, show }); return; }
      const col = heights.indexOf(Math.min(...heights));
      const x = col * (colW + gap);
      const y = heights[col];
      heights[col] += card.offsetHeight + gap + 12;
      moves.push({ card, show, x, y });
    });

    grid.style.height = `${Math.max(0, Math.max(...heights) - gap - 12)}px`;
    Motion.arrange(moves, animate);
  }

  /* ---------- Category tabs ---------- */
  const ORDER = ["Animation", "3D", "2D"];
  const counts = Object.fromEntries(ORDER.map((c) => [c, projects.filter((p) => p.categories.includes(c)).length]));
  const used = ORDER.filter((c) => counts[c] > 0);
  const tabs = document.getElementById("work-tabs");

  if (used.length > 1) {
    const tab = (key, label, n) =>
      `<button type="button" class="tab" data-cat="${key}" aria-pressed="false">${label}<span class="tab-n">${n}</span></button>`;
    tabs.innerHTML =
      tab("all", "All", projects.length) +
      used.map((c) => tab(c.toLowerCase(), c, counts[c])).join("") +
      `<span class="tab-ink" aria-hidden="true"></span>`;
    tabs.hidden = false;

    // Remember the chosen tab in the address (?cat=3d) so "back" returns to it
    const fromUrl = new URLSearchParams(location.search).get("cat");
    if (fromUrl && tabs.querySelector(`[data-cat="${CSS.escape(fromUrl)}"]`)) current = fromUrl;

    const select = (key, animate) => {
      current = key;
      tabs.querySelectorAll(".tab").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cat === key)));
      Motion.tabInk(tabs, tabs.querySelector(`[data-cat="${CSS.escape(key)}"]`), animate);
      layout(animate);
      const url = new URL(location.href);
      if (key === "all") url.searchParams.delete("cat"); else url.searchParams.set("cat", key);
      history.replaceState(null, "", url);
    };
    tabs.addEventListener("click", (e) => {
      const b = e.target.closest(".tab");
      if (b && b.dataset.cat !== current) select(b.dataset.cat, true);
    });
    select(current, false);
  } else {
    layout(false);
  }

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      layout(false);
      if (!tabs.hidden) Motion.tabInk(tabs, tabs.querySelector('.tab[aria-pressed="true"]'), false);
    }, 150);
  });
  if (document.fonts) document.fonts.ready.then(() => {
    layout(false);
    if (!tabs.hidden) Motion.tabInk(tabs, tabs.querySelector('.tab[aria-pressed="true"]'), false);
  });

  Motion.cards(grid);

  /* ---------- Banner: slideshow from Config/banner.txt ---------- */
  const bannerList = Site.lines(await Site.text("Config/banner.txt"));
  const fallback = (projects.find((p) => p.banner) || {}).banner || (projects[0] && projects[0].thumb);
  const slides = bannerList.length ? bannerList : fallback ? [fallback] : [];
  if (slides.length) {
    Motion.heroSlides(document.getElementById("hero-bg"), slides);
  } else {
    Motion.ready();
  }

  /* ---------- In production: Config/inproduction.txt, "Title | note" ---------- */
  const soon = Site.lines(await Site.text("Config/inproduction.txt")).map((l) => {
    const [title, note] = l.split("|").map((s) => s.trim());
    return { title, note: note || "Coming soon" };
  });
  if (soon.length) {
    document.getElementById("soon").hidden = false;
    document.getElementById("jump-soon").hidden = false;
    document.getElementById("soon-grid").innerHTML = soon
      .map((s) => `
        <div class="card card--soon">
          <div class="card-thumb"><span>${esc(s.note)}</span></div>
          <h3 class="card-title">${esc(s.title)}</h3>
        </div>`)
      .join("");
  }

  Motion.tapes();
  Motion.refresh();
})();
