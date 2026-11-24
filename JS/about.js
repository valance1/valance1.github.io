/* About page: summary, software, skills, experience */

(async () => {
  const esc = Site.escapeHtml;
  const user = await Site.chrome();

  const avatar = document.getElementById("avatar");
  if (user.avatar) avatar.src = user.avatar; else avatar.remove();
  if (user.place) document.getElementById("place").textContent = `Based in ${user.place}`;

  const [summary, software, skills, productions] = await Promise.all([
    Site.text("Config/summary.txt"),
    Site.text("Config/software.txt"),
    Site.text("Config/skills.txt"),
    Site.text("Config/productions.txt"),
  ]);

  /* summary.txt: plain text, each line is a paragraph */
  document.getElementById("summary").innerHTML = Site.richText(Site.lines(summary).join("\n\n"));

  const chips = (body) => Site.lines(body).map((s) => `<span class="chip">${esc(s)}</span>`).join("");
  document.getElementById("software").innerHTML = chips(software);
  document.getElementById("skills").innerHTML = chips(skills);

  /* productions.txt: blocks separated by ---
     Role / Company / Dates / Image URL / Description (comments ignored) */
  const jobs = Site.blocks(productions)
    .map((b) => Site.lines(b))
    .filter((l) => l.length)
    .map(([role, company, dates, image, ...desc]) => ({ role, company, dates, image, desc: desc.join(" ") }));

  if (jobs.length) {
    document.getElementById("exp-wrap").hidden = false;
    document.getElementById("jobs").innerHTML = jobs
      .map((j) => {
        const where = [j.company && j.company !== "None" ? j.company : "", j.dates].filter(Boolean).join(", ");
        return `
          <article class="job">
            ${j.image ? `<img src="${esc(j.image)}" alt="" loading="lazy">` : "<span></span>"}
            <div>
              <h3>${esc(j.role)}</h3>
              ${where ? `<p class="where">${esc(where)}</p>` : ""}
              ${j.desc ? `<p>${esc(j.desc)}</p>` : ""}
            </div>
          </article>`;
      })
      .join("");
  }
})();
