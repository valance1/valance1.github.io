/* Project page: project.html?p=<FolderName> */

(async () => {
  const esc = Site.escapeHtml;
  Site.chrome();

  const slug = new URLSearchParams(location.search).get("p") || "";
  const slugs = await Site.projectList();
  const p = slug ? await Site.project(slug) : null;

  if (!p) {
    document.getElementById("title").innerHTML = `<span class="p">&gt;</span>Project not found`;
    document.getElementById("desc").innerHTML =
      `<p>There is no project called "${esc(slug)}". Check the folder name in Config/projects.txt, or <a href="index.html">go back to all work</a>.</p>`;
    return;
  }

  document.title = `${p.title} | Gabriel Pinotti`;

  /* ---------- Media builders ---------- */

  function frame(inner) {
    return `<div class="frame">${inner}</div>`;
  }

  function embed(item) {
    const url = item.urls[0];
    switch (item.type) {
      case "youtube": {
        const id = Site.youTubeId(url);
        if (!id) return "";
        return frame(
          `<iframe src="https://www.youtube.com/embed/${encodeURIComponent(id)}?rel=0" title="${esc(p.title)} video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`
        );
      }
      case "sketchfab": {
        const id = url.replace(/\/+$/, "").split("/").pop().split("-").pop();
        return frame(
          `<iframe src="https://sketchfab.com/models/${encodeURIComponent(id)}/embed" title="${esc(p.title)} 3D model"
            allow="autoplay; fullscreen; xr-spatial-tracking" allowfullscreen></iframe>`
        );
      }
      case "marmoset":
        return frame(`<iframe src="${esc(url)}" title="${esc(p.title)} 3D viewer" allow="autoplay; fullscreen" allowfullscreen></iframe>`);
      case "video":
        return frame(`<video src="${esc(url)}" controls autoplay muted loop playsinline></video>`);
      case "image":
        return `<img src="${esc(url)}" alt="${esc(item.caption || p.title)}" loading="lazy">`;
      case "compare":
        return `
          <div class="compare">
            <img src="${esc(item.urls[0])}" alt="${esc(item.caption || p.title)} (before)" loading="lazy">
            <img class="after" src="${esc(item.urls[1])}" alt="${esc(item.caption || p.title)} (after)" loading="lazy">
            <span class="handle"></span>
            <input type="range" min="0" max="100" value="50" aria-label="Compare images">
          </div>`;
    }
    return "";
  }

  /* The first video (or 3D viewer) goes in the big player at the top */
  const playable = ["youtube", "video", "sketchfab", "marmoset"];
  const leadIndex = p.media.findIndex((m) => playable.includes(m.type));
  const rest = p.media.filter((_, i) => i !== leadIndex);

  if (leadIndex !== -1) {
    document.getElementById("player").innerHTML = embed(p.media[leadIndex]);
    document.getElementById("player-band").hidden = false;
  }

  /* ---------- Text ---------- */

  document.getElementById("title").innerHTML = `<span class="p">&gt;</span>${esc(p.title)}`;
  document.getElementById("desc").innerHTML = Site.richText(p.description);
  document.getElementById("tags").innerHTML = p.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join("");

  /* Credits from stats.txt. Comma-separated values become one per line. */
  const credits = document.getElementById("credits");
  if (p.info.length) {
    credits.innerHTML = p.info
      .map((i) => {
        const values = /collaborator|credit|team/i.test(i.key)
          ? i.value.split(",").map((v) => v.trim()).filter(Boolean)
          : [i.value];
        return `<div><dt>${esc(i.key)}</dt>${values
          .map((v, n) => `<dd>${esc(v)}${n === values.length - 1 && i.note ? `<small>${esc(i.note)}</small>` : ""}</dd>`)
          .join("")}</div>`;
      })
      .join("");
  } else {
    credits.remove();
    document.querySelector(".project-head").style.gridTemplateColumns = "1fr";
  }

  /* ---------- Gallery ---------- */

  document.getElementById("gallery").innerHTML = rest
    .map((m) => {
      const body = embed(m);
      if (!body) return "";
      return `<figure>${body}${m.caption ? `<figcaption>${esc(m.caption)}</figcaption>` : ""}</figure>`;
    })
    .join("");

  document.querySelectorAll(".compare").forEach((c) => {
    const after = c.querySelector(".after");
    const handle = c.querySelector(".handle");
    c.querySelector("input").addEventListener("input", (e) => {
      after.style.clipPath = `inset(0 0 0 ${e.target.value}%)`;
      handle.style.left = `${e.target.value}%`;
    });
  });

  /* ---------- Previous / next ---------- */

  const at = slugs.indexOf(slug);
  const pager = document.getElementById("pager");
  if (at !== -1 && slugs.length > 1) {
    const prevSlug = slugs[(at - 1 + slugs.length) % slugs.length];
    const nextSlug = slugs[(at + 1) % slugs.length];
    const [prev, next] = await Promise.all([Site.project(prevSlug), Site.project(nextSlug)]);

    pager.innerHTML = `
      ${prev ? `<a class="pager-side prev" href="${prev.url}"><small><i class="fa-solid fa-chevron-left" aria-hidden="true"></i> Previous</small><strong>${esc(prev.title)}</strong></a>` : "<span></span>"}
      <a class="pager-all" href="index.html#work">All work</a>
      ${next ? `<a class="pager-side next" href="${next.url}"><small>Next <i class="fa-solid fa-chevron-right" aria-hidden="true"></i></small><strong>${esc(next.title)}</strong></a>` : "<span></span>"}`;

    /* Keyboard: left/right to switch project, Esc for all work */
    document.addEventListener("keydown", (e) => {
      if (e.target.closest("input, textarea")) return;
      if (e.key === "ArrowLeft" && prev) location.href = prev.url;
      if (e.key === "ArrowRight" && next) location.href = next.url;
      if (e.key === "Escape") location.href = "index.html#work";
    });
  } else {
    pager.innerHTML = `<span></span><a class="pager-all" href="index.html#work">All work</a><span></span>`;
  }
})();
