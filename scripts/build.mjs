#!/usr/bin/env node
/**
 * Fill templates/day.html from content/*.json → public/YYYY/MM/DD/index.html
 * Fill templates/home.html → public/index.html (landing with latest + archive).
 * Copies assets/. Softens redirects so `/` serves the real homepage.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONTENT = path.join(ROOT, "content");
const TEMPLATE = path.join(ROOT, "templates", "day.html");
const HOME_TEMPLATE = path.join(ROOT, "templates", "home.html");
const ASSETS = path.join(ROOT, "assets");
const OUT = path.join(ROOT, "public");

const SECTION_ORDER = [
  ["research", "Research"],
  ["vendors", "厂商动态"],
  ["radar", "新词雷达"],
  ["clips", "剪藏"],
];

const SHORT = {
  research: "Research",
  vendors: "厂商动态",
  radar: "新词雷达",
  clips: "剪藏",
};

function sectionIndex(key) {
  const i = SECTION_ORDER.findIndex(([k]) => k === key);
  return String(Math.max(i, 0) + 1).padStart(2, "0");
}

function dateDisplay(iso) {
  const [y, m, d] = iso.split("-");
  return `<span class="y">${y}</span><span class="md"><span>${m}</span><span class="slash" aria-hidden="true">/</span><span>${d}</span></span>`;
}

function weekdayZh(iso, timeZone) {
  const dt = new Date(`${iso}T12:00:00+08:00`);
  return new Intl.DateTimeFormat("zh-CN", {
    weekday: "long",
    timeZone: timeZone || "Asia/Shanghai",
  }).format(dt);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Allow simple inline <code>…</code> and <strong> already in gist/note; escape the rest lightly. */
function softHtml(s) {
  if (!s) return "";
  let t = esc(s);
  t = t
    .replace(/&lt;code&gt;/g, "<code>")
    .replace(/&lt;\/code&gt;/g, "</code>")
    .replace(/&lt;strong&gt;/g, "<strong>")
    .replace(/&lt;\/strong&gt;/g, "</strong>");
  return t;
}

/** Stable short slug for anchors from section key + title (+ index for uniqueness). */
function itemId(sectionKey, item, index) {
  const base = String(item.title || `item-${index}`)
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const hash = createHash("sha1")
    .update(`${sectionKey}:${item.title || ""}:${index}`)
    .digest("hex")
    .slice(0, 6);
  return `item-${sectionKey}-${base || "x"}-${hash}`;
}

function sectionId(sectionKey) {
  return `section-${sectionKey}`;
}

function renderItem(item, id) {
  const meta = item.meta ? `<p class="meta">${esc(item.meta)}</p>` : "";
  const note = item.note
    ? `<p class="note"><span class="note-label">为什么值得看</span>${softHtml(item.note)}</p>`
    : "";
  const links = (item.links || [])
    .map(
      (l) =>
        `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)}</a>`
    )
    .join("\n          ");
  const linksBlock = links ? `<div class="links">\n          ${links}\n        </div>` : "";
  return `<article class="item" id="${esc(id)}">
        ${meta}
        <h3 class="item-title">${softHtml(item.title)}</h3>
        <p class="body">${softHtml(item.gist)}</p>
        ${note}
        ${linksBlock}
      </article>`;
}

function renderSection(key, section, fallbackTitle) {
  const title = section?.title || fallbackTitle;
  const items = section?.items || [];
  const sid = sectionId(key);
  const clipsNote =
    key === "clips" && section?.note
      ? `<p class="empty">${esc(section.note)}</p>`
      : "";

  const countLabel =
    items.length > 0 ? `<span class="count">${items.length}</span>` : "";
  const head = `<header class="section-head"><span class="section-index">${sectionIndex(key)}</span><h2>${esc(title)}${countLabel}</h2></header>`;

  if (!items.length) {
    return `<section id="${esc(sid)}" data-section="${esc(key)}" class="is-empty">
      ${head}
      ${clipsNote || `<p class="empty">本日无条目。</p>`}
    </section>`;
  }

  let html = "";
  let lastSub = null;
  items.forEach((item, index) => {
    if (item.subgroup && item.subgroup !== lastSub) {
      html += `<p class="subgroup">${esc(item.subgroup)}</p>\n      `;
      lastSub = item.subgroup;
    }
    const id = itemId(key, item, index);
    html += renderItem(item, id) + "\n\n      ";
  });

  return `<section id="${esc(sid)}" data-section="${esc(key)}">
      ${head}
      ${html.trim()}
    </section>`;
}

function tocTitlePlain(title) {
  return String(title || "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function renderToc(day) {
  const parts = [];
  for (const [key, fallback] of SECTION_ORDER) {
    const section = day.sections?.[key];
    const title = section?.title || fallback;
    const items = section?.items || [];
    const sid = sectionId(key);
    const emptyClass = items.length ? "" : " is-empty";

    // Quiet empty sections: still list in TOC but grayed (CSS .is-empty)
    let itemsHtml = "";
    if (items.length) {
      const lis = items
        .map((item, index) => {
          const id = itemId(key, item, index);
          const label = tocTitlePlain(item.title);
          return `<li><a href="#${esc(id)}">${esc(label)}</a></li>`;
        })
        .join("\n          ");
      itemsHtml = `<ul class="toc-items">\n          ${lis}\n        </ul>`;
    }

    parts.push(`<div class="toc-section${emptyClass}">
        <a class="toc-section-title" href="#${esc(sid)}"><span class="toc-idx">${sectionIndex(key)}</span><span class="toc-label">${esc(title)}</span></a>
        ${itemsHtml}
      </div>`);
  }
  return parts.join("\n      ");
}

function dateParts(iso) {
  const [y, m, d] = iso.split("-");
  return { y, m, d, path: `${y}/${m}/${d}` };
}

function loadDays() {
  const files = fs
    .readdirSync(CONTENT)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();
  return files.map((f) => {
    const raw = JSON.parse(fs.readFileSync(path.join(CONTENT, f), "utf8"));
    return raw;
  });
}

function assetHref(depth, name) {
  return "../".repeat(depth) + `assets/${name}`;
}

const PREVIEW_LIMIT = 6;

function sectionCounts(day) {
  return SECTION_ORDER.map(([key, fallback]) => {
    const section = day.sections?.[key];
    const title = section?.title || fallback;
    const n = (section?.items || []).length;
    return { key, title, n, sid: sectionId(key) };
  });
}

function collectPreviews(day, dayPath, limit = PREVIEW_LIMIT) {
  const out = [];
  for (const [key, fallback] of SECTION_ORDER) {
    const section = day.sections?.[key];
    const items = section?.items || [];
    const secTitle = section?.title || fallback;
    items.forEach((item, index) => {
      if (out.length >= limit) return;
      out.push({
        title: tocTitlePlain(item.title),
        section: SHORT[key] || secTitle,
        href: `/${dayPath}/#${itemId(key, item, index)}`,
      });
    });
    if (out.length >= limit) break;
  }
  return out;
}

function renderCountsHtml(day, dayPath) {
  return sectionCounts(day)
    .map(({ key, n, sid }, i) => {
      const idx = String(i + 1).padStart(2, "0");
      const inner = `<span class="idx">${idx}</span><span class="n">${n}</span><span class="name">${esc(SHORT[key])}</span>`;
      if (!n) return `<li class="is-zero">${inner}</li>`;
      return `<li><a href="/${dayPath}/#${esc(sid)}">${inner}</a></li>`;
    })
    .join("\n        ");
}

function renderPreviewsHtml(previews) {
  if (!previews.length) {
    return `<li class="is-quiet">本日暂无条目</li>`;
  }
  return previews
    .map((p, i) => {
      const idx = String(i + 1).padStart(2, "0");
      return `<li><a href="${esc(p.href)}"><span class="idx">${idx}</span><span class="t">${esc(p.title)}</span><span class="sec">${esc(p.section)}</span></a></li>`;
    })
    .join("\n        ");
}

function renderArchiveHtml(dates, byDate, latest) {
  return [...dates]
    .reverse()
    .map((date) => {
      const day = byDate.get(date);
      const { y, m, d, path: urlPath } = dateParts(date);
      const counts = sectionCounts(day);
      const total = counts.reduce((s, c) => s + c.n, 0);
      const meta = total
        ? counts.map((c) => `${SHORT[c.key]} ${c.n}`).join(" · ")
        : "安静日";
      const flag = date === latest ? `<span class="flag">最新</span>` : "";
      const cls = date === latest ? ` class="is-latest"` : "";
      return `<li${cls}><a href="/${urlPath}/"><span class="d"><span class="md">${m} / ${d}</span><span class="y">${y}</span></span><span class="meta">${esc(meta)}</span><span class="total">${flag}${total} 条</span></a></li>`;
    })
    .join("\n        ");
}

function renderHome(days, dates, byDate, latest) {
  const homeTpl = fs.readFileSync(HOME_TEMPLATE, "utf8");
  const latestDay = byDate.get(latest);
  const latestPath = dateParts(latest).path;
  const previews = collectPreviews(latestDay, latestPath);
  const subtitleHtml = latestDay.subtitle
    ? `<p class="deck">${esc(latestDay.subtitle)}</p>`
    : "";

  return homeTpl
    .replaceAll("{{title}}", "日报 · Daily News")
    .replaceAll("{{css_href}}", "assets/site.css")
    .replaceAll("{{timezone}}", latestDay.timezone || "Asia/Shanghai")
    .replaceAll("{{latest_href}}", `/${latestPath}/`)
    .replaceAll("{{latest_date_html}}", dateDisplay(latest))
    .replaceAll("{{latest_weekday}}", weekdayZh(latest, latestDay.timezone))
    .replaceAll("{{latest_subtitle_html}}", subtitleHtml)
    .replaceAll("{{counts_html}}", renderCountsHtml(latestDay, latestPath))
    .replaceAll("{{previews_html}}", renderPreviewsHtml(previews))
    .replaceAll("{{archive_count}}", String(dates.length))
    .replaceAll("{{archive_html}}", renderArchiveHtml(dates, byDate, latest))
    .replaceAll(
      "{{footer}}",
      latestDay.footer || "Daily News"
    );
}


function build() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  copyDir(ASSETS, path.join(OUT, "assets"));

  const template = fs.readFileSync(TEMPLATE, "utf8");
  const days = loadDays();
  if (!days.length) {
    console.error("No content/*.json day files found.");
    process.exit(1);
  }

  const byDate = new Map(days.map((d) => [d.date, d]));
  const dates = [...byDate.keys()].sort();

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const day = byDate.get(date);
    const { y, m, d, path: urlPath } = dateParts(date);
    const outDir = path.join(OUT, y, m, d);
    fs.mkdirSync(outDir, { recursive: true });

    const sectionsHtml = SECTION_ORDER.map(([key, fallback]) =>
      renderSection(key, day.sections?.[key], fallback)
    ).join("\n\n    ");

    const tocHtml = renderToc(day);

    const prev = dates[i - 1];
    const next = dates[i + 1];
    const prevLink = prev
      ? `<a class="jump jump-prev" href="/${dateParts(prev).path}/"><span class="jump-dir">上一期</span><span class="jump-date">${prev}</span></a>`
      : "";
    const nextLink = next
      ? `<a class="jump jump-next" href="/${dateParts(next).path}/"><span class="jump-dir">下一期</span><span class="jump-date">${next}</span></a>`
      : "";
    const dateBits = [weekdayZh(date, day.timezone)];
    if (day.subtitle) dateBits.push(day.subtitle);

    const html = template
      .replaceAll("{{title}}", `日报 · ${date}`)
      .replaceAll("{{heading}}", date)
      .replaceAll("{{timezone}}", day.timezone || "Asia/Shanghai")
      .replaceAll("{{date_display}}", dateDisplay(date))
      .replaceAll("{{date_line}}", dateBits.join(" · "))
      .replaceAll("{{css_href}}", assetHref(3, "site.css"))
      .replaceAll("{{js_href}}", assetHref(3, "site.js"))
      .replaceAll("{{prev_link}}", prevLink)
      .replaceAll("{{next_link}}", nextLink)
      .replaceAll("{{toc_html}}", tocHtml)
      .replaceAll("{{sections_html}}", sectionsHtml)
      .replaceAll(
        "{{footer}}",
        day.footer || "Daily News"
      );

    fs.writeFileSync(path.join(outDir, "index.html"), html, "utf8");
    console.log(`built /${urlPath}/`);
  }

  const latest = dates[dates.length - 1];
  const latestPath = dateParts(latest).path;
  const indexHtml = renderHome(days, dates, byDate, latest);
  fs.writeFileSync(path.join(OUT, "index.html"), indexHtml, "utf8");
  console.log("built / (home landing)");

  // Keep _redirects present for Pages, but do NOT force `/` away from index.html.
  fs.writeFileSync(
    path.join(OUT, "_redirects"),
    `# Cloudflare Pages — homepage is public/index.html; no root redirect.\n`,
    "utf8"
  );

  fs.writeFileSync(
    path.join(OUT, "..", "vercel.json"),
    JSON.stringify(
      {
        cleanUrls: true,
        trailingSlash: true,
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  console.log(`latest day /${latestPath}/ · ${dates.length} days in archive`);
}

build();
