#!/usr/bin/env node
/**
 * Create an empty day JSON from schema defaults.
 * Usage: npm run new-day -- [YYYY-MM-DD]
 * Default: today in Asia/Shanghai.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT = path.resolve(__dirname, "..", "content");

function shanghaiToday() {
  // en-CA → YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const date = process.argv[2] || shanghaiToday();
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error("Usage: npm run new-day -- YYYY-MM-DD");
  process.exit(1);
}

const out = path.join(CONTENT, `${date}.json`);
if (fs.existsSync(out)) {
  console.error(`exists: ${out}`);
  process.exit(1);
}

const stub = {
  date,
  timezone: "Asia/Shanghai",
  subtitle: "",
  quiet: true,
  footer: "Daily News",
  sections: {
    research: { title: "Research", items: [] },
    vendors: { title: "厂商动态", items: [] },
    radar: { title: "新词雷达", items: [] },
    clips: {
      title: "剪藏",
      note: "近 24h 剪藏尚未接入；素材仓 haorui-lab/my-private-clips 只读。本日占位为空。",
      source: {
        repo: "haorui-lab/my-private-clips",
        path_pattern: "clips/YYYY/MM/YYYY-MM-DD-<slug>.md",
        index: "index/by-url.json",
      },
      items: [],
    },
  },
};

fs.mkdirSync(CONTENT, { recursive: true });
fs.writeFileSync(out, JSON.stringify(stub, null, 2) + "\n", "utf8");
console.log(`created ${out}`);
