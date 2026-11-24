/* Home page: hero, project grid, "in production" list */

(async () => {
  const esc = Site.escapeHtml;

  /* Hero text from Config/userinformation.txt */
  const user = await Site.chrome();
  const roles = (user.role || "")
    .split(/[|/]|@/)
    .map((r) => r.trim())
    .filter(Boolean);
  document.getElementById("hero-roles").innerHTML = roles.map((r) => `<li>${esc(r)}</li>`).join("");
  if (user.place) document.getElementById("hero-place").textContent = `Based in ${user.place}`;
  Motion.hero();
  Motion.heroIntro();

  /* Projects, in the order of Config/projects.txt */
  const grid = document.getElementById("work-grid");
  const slugs = await Site.projectList();
  const projects = (await Promise.all(slugs.map(Site.project))).filter(Boolean);

  grid.innerHTML = projects.length ? projects
    .map((p) => {
      const meta = [p.year && `<b>${esc(p.year)}</b>`, p.client && esc(p.client)].filter(Boolean).join("");
      return `
        <a class="card" href="${p.url}">
          <div class="card-thumb">${p.thumb ? `<img src="${esc(p.thumb)}" alt="" loading="lazy">` : ""}</div>
          <h3 class="card-title">${esc(p.title)}</h3>
          ${meta ? `<p class="card-meta">${meta}</p>` : ""}
          <span class="card-cta">View project</span>
        </a>`;
    })
    .join("")
    : `<p class="empty">No projects yet. Add a folder name to Config/projects.txt.</p>`;

  grid.querySelectorAll(".card-thumb img").forEach(Site.fixYouTubeThumb);
  Motion.cards(grid);

  /* Hero banner: first media line marked with *, otherwise the first project's thumbnail */
  const bannerSrc = (projects.find((p) => p.banner) || {}).banner || (projects[0] && projects[0].thumb);
  if (bannerSrc) {
    const bg = document.getElementById("hero-bg");
    const probe = new Image();
    probe.onload = () => {
      let src = bannerSrc;
      if (probe.naturalWidth === 120) src = bannerSrc.replace("maxresdefault", "hqdefault");
      Motion.heroBg(bg, src);
    };
    probe.src = bannerSrc;
  }

  /* In production: Config/inproduction.txt, one per line, "Title | note" */
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
