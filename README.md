# daily.haorui.dev

轻量静态日报站。每天只填 `content/YYYY-MM-DD.json`，`npm run build` 用同一套模板生成 `public/YYYY/MM/DD/index.html`。

目标域名：`https://daily.haorui.dev/YYYY/MM/DD`

## 结构

```
content/          # 每天一篇 JSON（唯一日常编辑面）
templates/day.html
assets/site.css
scripts/build.mjs
scripts/new-day.mjs
public/           # build 产出（可部署）
```

## 本地

```bash
npm run new-day                 # 今天（Asia/Shanghai）空壳 JSON
npm run new-day -- 2026-10-28   # 指定日期
npm run build                   # → public/
npx serve public -l 4173        # 本地预览
```

样例页：`public/2026/10/27/index.html` → 路径 `/2026/10/27/`

## Day JSON schema（摘要）

见 `content/_schema.json`。核心字段：

| 字段 | 说明 |
|------|------|
| `date` | `YYYY-MM-DD` |
| `timezone` | 默认 `Asia/Shanghai` |
| `subtitle` | 标题下一行说明 |
| `quiet` | 安静日标记 |
| `sections.research` / `vendors` / `radar` | `{ title, items[] }` |
| `sections.clips` | 同上 + `note` + `source`（剪藏仓只读约定） |
| `items[]` | `title`, `gist`, 可选 `tags`, `meta`, `subgroup`, `note`, `links[{label,url}]` |

栏目顺序固定：Research · 厂商动态 · 新词雷达 · 剪藏。

## 剪藏（只读素材，不在此仓建服务）

- 仓：`haorui-lab/my-private-clips`
- 路径：`clips/YYYY/MM/YYYY-MM-DD-<slug>.md`
- 索引：`index/by-url.json`
- 近 24h：按文件名日期或 frontmatter `saved_at` 筛
- 当前：`clips.items` 可手填；空则页面显示 `note` 占位

## 部署

优先 **Cloudflare Pages**（账号已有 `haorui.dev` zone；参考项目 `skills` → `skill.haorui.dev`）。

### Cloudflare Pages（推荐）

1. 把本仓推到 GitHub（如 `haorui-lab/daily-news`），**不要**推到 `my-private-clips`。
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect Git  
   - Project name: `daily-haorui-dev`  
   - Build command: `npm run build`  
   - Output directory: `public`  
   - Root: `/`
3. Custom domain: `daily.haorui.dev`（zone `haorui.dev` 已 active，加 CNAME 到 `daily-haorui-dev.pages.dev`）。
4. 或直接上传：本地 `npm run build` 后用 Wrangler：

```bash
npx wrangler pages project create daily-haorui-dev --production-branch main
npx wrangler pages deploy public --project-name=daily-haorui-dev
```

### Vercel（备选）

```bash
npm run build
npx vercel --prod --yes
# Root / Output: public；或把 vercel.json 留在仓根（build 会写一份 redirect 到最新日）
```

自定义域同样绑 `daily.haorui.dev`。

## 安静日

无新闻可不建 JSON（线上该日 404），或建 `quiet: true` + 空 `items`（生成空白日页）。聊天侧无干货则保持安静。

## 回填范围

当前种子：`2026-10-25`（空）、`2026-10-26`、`2026-10-27`。更早不生成。
