/* =========================================================
   Shared helpers: reading the .txt files, parsing media,
   building the socials and footer. Used by every page.
   ========================================================= */

const Site = (() => {
  /* Fetch a text file. Returns null if it is missing.
     GitHub Pages answers missing files with an HTML 404 page,
     so that case is treated as missing too. */
  async function text(path) {
    try {
      const res = await fetch(path, { cache: "no-cache" });
      if (!res.ok) return null;
      const body = await res.text();
      if (/^\s*<!doctype html/i.test(body)) return null;
      return body;
    } catch (e) {
      return null;
    }
  }

  /* Non-empty lines, comments (# ...) removed */
  function lines(body) {
    return (body || "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
  }

  /* Split on lines that contain only --- */
  function blocks(body) {
    return (body || "").split(/^\s*---\s*$/m).map((b) => b.trim());
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  /* Escape text, then turn URLs into links and blank lines into paragraphs */
  function richText(raw) {
    const urlRe = /\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)\]'"]/g;
    return escapeHtml(raw)
      .split(/\n\s*\n/)
      .map((para) => {
        const linked = para.replace(urlRe, (url) => {
          let label = url;
          try { label = new URL(url.replace(/&amp;/g, "&")).hostname.replace(/^www\./, ""); } catch (e) {}
          return `<a href="${url}" target="_blank" rel="noopener">${label}</a>`;
        });
        return `<p>${linked.replace(/\n/g, "<br>")}</p>`;
      })
      .join("");
  }

  /* ---------- Media ---------- */

  function youTubeId(url) {
    try {
      const u = new URL(url);
      if (u.hostname.includes("youtu.be")) return u.pathname.slice(1).split("/")[0] || null;
      if (u.searchParams.get("v")) return u.searchParams.get("v");
      const m = u.pathname.match(/\/(embed|shorts|live|v)\/([^/?#]+)/);
      return m ? m[2] : null;
    } catch (e) {
      return null;
    }
  }

  function mediaType(url) {
    const clean = url.split(/[?#]/)[0].toLowerCase();
    if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
    if (/sketchfab\.com/i.test(url)) return "sketchfab";
    if (/\.(mp4|webm)$/.test(clean)) return "video";
    if (/\.mview$/.test(clean)) return "marmoset";
    if (/\.(glb|gltf)$/.test(clean)) return "model";
    if (/\.(jpe?g|png|gif|webp|avif)$/.test(clean) || /i\.ytimg\.com|img\.youtube\.com/.test(url)) return "image";
    return null;
  }

  /* Parse media.txt into a list of items.
     Same rules as before:
       - one media URL per line
       - a line that is not media right after it is its caption
       - "a.png // b.png" makes a before/after slider
       - a line ending in * is the banner for the home page
       - a caption containing "(marmoset viewer)" turns the URL into .mview
     Relative paths are resolved from the project's folder. */
  function parseMedia(body, folder) {
    const src = lines(body);
    const items = [];
    let banner = null;

    const resolve = (u) => (/^https?:\/\//i.test(u) ? u : `${folder}${u}`);

    for (let i = 0; i < src.length; i++) {
      let line = src[i];
      let isBanner = false;
      if (line.endsWith("*")) {
        line = line.slice(0, -1).trim();
        isBanner = true;
      }

      let urls = line.includes(" // ") ? line.split(" // ").map((u) => u.trim()) : [line];
      urls = urls.map(resolve);

      let type = mediaType(urls[0]);
      if (!type) continue; // stray text without a media line before it

      let caption = "";
      const next = src[i + 1];
      if (next && !next.includes(" // ") && !mediaType(next.replace(/\*$/, "").trim())) {
        caption = next;
        i++;
      }

      if (caption.includes("(marmoset viewer)")) {
        urls = [`${urls[0]}.mview`];
        type = "marmoset";
        caption = caption.replace("(marmoset viewer)", "").trim();
      }

      if (isBanner && type === "image") banner = urls[0];

      items.push({ type: urls.length > 1 && type === "image" ? "compare" : type, urls, caption });
    }

    return { items, banner };
  }

  /* Thumbnail for a project: the one in description.txt,
     otherwise the first YouTube video's thumbnail. */
  function thumbFor(project) {
    if (project.thumbnail) return project.thumbnail;
    const yt = project.media.find((m) => m.type === "youtube");
    const id = yt && youTubeId(yt.urls[0]);
    if (id) return `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
    const img = project.media.find((m) => m.type === "image");
    return img ? img.urls[0] : "";
  }

  /* YouTube serves a tiny grey 120x90 picture when maxres does not exist.
     Swap to the hq version in that case. */
  function fixYouTubeThumb(img) {
    const swap = () => {
      if (img.dataset.swapped) return;
      const m = img.src.match(/\/vi\/([^/]+)\//);
      if (!m) return;
      img.dataset.swapped = "1";
      img.src = `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg`;
    };
    img.addEventListener("error", swap);
    img.addEventListener("load", () => { if (img.naturalWidth === 120) swap(); });
  }

  /* ---------- Data files ---------- */

  async function projectList() {
    return lines(await text("Config/projects.txt"));
  }

  /* Reads Projects/<slug>/description.txt, media.txt and stats.txt */
  async function project(slug) {
    const folder = `Projects/${slug}/`;
    const [desc, media, stats] = await Promise.all([
      text(`${folder}description.txt`),
      text(`${folder}media.txt`),
      text(`${folder}stats.txt`),
    ]);
    if (desc === null) return null;

    const [title = slug, description = "", tags = "", thumbnail = ""] = blocks(desc);
    const parsed = parseMedia(media, folder);

    /* stats.txt: every "Key: Value" line with a value becomes a credit.
       Text in (parentheses) is shown as a small note under the value.
       Only the first colon splits, so URLs in values are safe. */
    const info = lines(stats)
      .map((l) => {
        const at = l.indexOf(":");
        if (at === -1) return null;
        const key = l.slice(0, at).trim();
        let value = l.slice(at + 1).trim();
        let note = "";
        const paren = value.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
        if (paren) { value = paren[1]; note = paren[2]; }
        return value ? { key, value, note } : null;
      })
      .filter(Boolean);

    /* Category: Animation, 3D or 2D. Taken out of the credits list.
       Without one, it is guessed from the media: video means Animation,
       a .glb model means 3D, images only means 2D. */
    const catLine = info.find((i) => /^categor(y|ies)$/i.test(i.key));
    const credits = info.filter((i) => i !== catLine);
    const CANON = { animation: "Animation", anim: "Animation", video: "Animation", "3d": "3D", sculpt: "3D", sculpture: "3D", "2d": "2D", art: "2D", drawing: "2D", illustration: "2D" };
    let categories = (catLine ? catLine.value.split(",") : [])
      .map((c) => CANON[c.trim().toLowerCase()])
      .filter(Boolean);
    if (!categories.length) {
      if (parsed.items.some((m) => ["youtube", "video"].includes(m.type))) categories = ["Animation"];
      else if (parsed.items.some((m) => ["model", "sketchfab", "marmoset"].includes(m.type))) categories = ["3D"];
      else categories = ["2D"];
    }
    categories = [...new Set(categories)];

    const p = {
      slug,
      categories,
      title,
      description,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      thumbnail: thumbnail.trim(),
      media: parsed.items,
      banner: parsed.banner,
      info: credits,
      url: `project.html?p=${encodeURIComponent(slug)}`,
    };
    p.thumb = thumbFor(p);
    p.year = (credits.find((i) => /^year$/i.test(i.key)) || {}).value || "";
    p.client = (credits.find((i) => /^client$/i.test(i.key)) || {}).value || "";
    /* Image-only projects (no video, no 3D viewer) get the ArtStation-style page */
    p.isArt = !p.media.some((m) => ["youtube", "video", "sketchfab", "marmoset", "model"].includes(m.type));
    return p;
  }

  async function userInfo() {
    const l = lines(await text("Config/userinformation.txt"));
    const [avatar = "", name = "", role = "", place = "", ...socials] = l;
    return { avatar, name, role, place, socials };
  }

  /* ---------- Socials + footer ---------- */

  const ICONS = {
    "x.com": "fa-brands fa-x-twitter",
    "twitter.com": "fa-brands fa-x-twitter",
    "bsky.app": "fa-brands fa-bluesky",
    "facebook.com": "fa-brands fa-facebook",
    "discord": "fa-brands fa-discord",
    "dsc.gg": "fa-brands fa-discord",
    "instagram.com": "fa-brands fa-instagram",
    "youtube.com": "fa-brands fa-youtube",
    "linkedin.com": "fa-brands fa-linkedin",
    "artstation.com": "fa-brands fa-artstation",
    "github.com": "fa-brands fa-github",
    "vimeo.com": "fa-brands fa-vimeo-v",
    "behance.net": "fa-brands fa-behance",
    "sketchfab.com": "fa-solid fa-cube",
    "tiktok.com": "fa-brands fa-tiktok",
    "twitch.tv": "fa-brands fa-twitch",
    "patreon.com": "fa-brands fa-patreon",
    "tumblr.com": "fa-brands fa-tumblr",
    "threads.net": "fa-brands fa-threads",
  };

  function socialLinks(socials) {
    return socials
      .map((s) => {
        const key = Object.keys(ICONS).find((k) => s.includes(k));
        const isMail = !key && s.includes("@");
        const href = isMail ? `mailto:${s}` : s;
        const icon = key ? ICONS[key] : isMail ? "fa-solid fa-envelope" : "fa-solid fa-link";
        let label = isMail ? "Email" : s;
        try { if (!isMail) label = new URL(s).hostname.replace(/^www\./, ""); } catch (e) {}
        return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener" aria-label="${escapeHtml(label)}"><i class="${icon}" aria-hidden="true"></i></a>`;
      })
      .join("");
  }

  const NAMES = {
    "x.com": "X", "twitter.com": "X", "bsky.app": "Bluesky", "facebook.com": "Facebook",
    "discord": "Discord", "dsc.gg": "Discord", "instagram.com": "Instagram", "youtube.com": "YouTube",
    "linkedin.com": "LinkedIn", "artstation.com": "ArtStation", "github.com": "GitHub", "vimeo.com": "Vimeo",
    "behance.net": "Behance", "sketchfab.com": "Sketchfab", "tiktok.com": "TikTok", "twitch.tv": "Twitch",
    "patreon.com": "Patreon", "tumblr.com": "Tumblr", "threads.net": "Threads",
  };

  /* Contact block: an e-mail line in userinformation.txt becomes a
     copy-to-clipboard button; links become buttons with their names. */
  function contactActions(socials) {
    const mail = socials.find((s) => s.includes("@") && !/^https?:/i.test(s));
    const links = socials.filter((s) => /^https?:/i.test(s));
    const mailBtn = mail
      ? `<button class="contact-mail" type="button" data-email="${escapeHtml(mail)}"><span class="contact-mail-text">${escapeHtml(mail)}</span></button>`
      : "";
    const linkBtns = links
      .map((l) => {
        const key = Object.keys(ICONS).find((k) => l.includes(k));
        let name = key ? NAMES[key] : l;
        if (!key) { try { name = new URL(l).hostname.replace(/^www\./, ""); } catch (e) {} }
        const icon = key ? ICONS[key] : "fa-solid fa-link";
        return `<a class="contact-link" href="${escapeHtml(l)}" target="_blank" rel="noopener"><i class="${icon}" aria-hidden="true"></i><span>${escapeHtml(name)}</span></a>`;
      })
      .join("");
    return mailBtn + linkBtns;
  }

  function wireMailButton(btn) {
    const text = btn.querySelector(".contact-mail-text");
    const mail = btn.dataset.email;
    const say = (t) => (typeof Motion !== "undefined" ? Motion.scramble(text, t, 0.45) : (text.textContent = t));
    btn.addEventListener("pointerenter", () => say(mail));
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(mail);
        say("copied to clipboard");
        setTimeout(() => say(mail), 1800);
      } catch (e) {
        location.href = `mailto:${mail}`;
      }
    });
  }

  async function chrome() {
    const user = await userInfo();
    document.querySelectorAll("[data-socials]").forEach((el) => (el.innerHTML = socialLinks(user.socials)));
    document.querySelectorAll("[data-contact]").forEach((el) => {
      el.innerHTML = contactActions(user.socials);
      el.querySelectorAll(".contact-mail").forEach(wireMailButton);
    });
    document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
    document.querySelectorAll("[data-name]").forEach((el) => (el.textContent = user.name || el.textContent));
    if (typeof Motion !== "undefined") Motion.magnets();
    return user;
  }

  return {
    text, lines, blocks, escapeHtml, richText,
    youTubeId, parseMedia, fixYouTubeThumb,
    projectList, project, userInfo, chrome,
  };
})();
