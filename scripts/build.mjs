#!/usr/bin/env node
/**
 * Fill templates/day.html from content/*.json → public/YYYY/MM/DD/index.html
 * Also writes public/index.html (redirect to latest) and copies assets/.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONTENT = path.join(ROOT, "content");
const TEMPLATE = path.join(ROOT, "templates", "day.html");
const ASSETS = path.join(ROOT, "assets");
const OUT = path.join(ROOT, "public");

const SECTION_ORDER = [
  ["research", "Research"],
  ["vendors", "厂商动态"],
  ["radar", "新词雷达"],
  ["clips", "剪藏"],
];

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
        `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`
    )
    .join("\n          ");
  const linksBlock = links ? `<div class="links">\n          ${links}\n        </div>` : "";
  return `<article class="item" id="${esc(id)}">
        <h3 class="item-title">${softHtml(item.title)}</h3>
        ${meta}
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

  if (!items.length) {
    return `<section id="${esc(sid)}" data-section="${esc(key)}" class="is-empty">
      <h2>${esc(title)}${countLabel}</h2>
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
      <h2>${esc(title)}${countLabel}</h2>
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
        <a class="toc-section-title" href="#${esc(sid)}">${esc(title)}</a>
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

function build() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const outAssets = path.join(OUT, "assets");
  fs.mkdirSync(outAssets, { recursive: true });
  for (const f of fs.readdirSync(ASSETS)) {
    fs.copyFileSync(path.join(ASSETS, f), path.join(outAssets, f));
  }

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
      ? `<a href="/${dateParts(prev).path}/">← ${prev}</a>`
      : "";
    const nextLink = next
      ? `<a href="/${dateParts(next).path}/">${next} →</a>`
      : "";

    const html = template
      .replaceAll("{{title}}", `Daily News · ${date}`)
      .replaceAll("{{heading}}", date)
      .replaceAll(
        "{{date_line}}",
        `${day.timezone || "Asia/Shanghai"}${
          day.subtitle ? ` · ${day.subtitle}` : ""
        }`
      )
      .replaceAll("{{css_href}}", assetHref(3, "site.css"))
      .replaceAll("{{js_href}}", assetHref(3, "site.js"))
      .replaceAll("{{prev_link}}", prevLink)
      .replaceAll("{{next_link}}", nextLink)
      .replaceAll("{{toc_html}}", tocHtml)
      .replaceAll("{{sections_html}}", sectionsHtml)
      .replaceAll(
        "{{footer}}",
        day.footer || "工作日盯梢 · 有干货才推 · Research · 厂商 · 新词雷达 · 剪藏"
      );

    fs.writeFileSync(path.join(outDir, "index.html"), html, "utf8");
    console.log(`built /${urlPath}/`);
  }

  const latest = dates[dates.length - 1];
  const latestPath = dateParts(latest).path;
  const indexHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="0; url=/${latestPath}/">
<link rel="canonical" href="/${latestPath}/">
<title>Daily News · 最新</title>
<script>location.replace("/${latestPath}/");</script>
</head>
<body>
  <p><a href="/${latestPath}/">进入最新日报 ${latest}</a></p>
</body>
</html>
`;
  fs.writeFileSync(path.join(OUT, "index.html"), indexHtml, "utf8");

  fs.writeFileSync(
    path.join(OUT, "_redirects"),
    `# Cloudflare Pages\n/ /${latestPath}/ 302\n`,
    "utf8"
  );

  fs.writeFileSync(
    path.join(OUT, "..", "vercel.json"),
    JSON.stringify(
      {
        cleanUrls: true,
        trailingSlash: true,
        redirects: [{ source: "/", destination: `/${latestPath}/`, permanent: false }],
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  console.log(`latest → /${latestPath}/ (${dates.length} days)`);
}

build();
