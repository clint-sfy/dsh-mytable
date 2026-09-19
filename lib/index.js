// src/index.ts
import { execFile } from "node:child_process";
import { readdirSync, realpathSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { basename, dirname, resolve as pathResolve, sep } from "node:path";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

// src/browser-policy.ts
function extractFrameAncestors(csp) {
  if (csp === null) return void 0;
  for (const directive of csp.split(";")) {
    const parts = directive.trim().split(/\s+/);
    if (parts[0] === "frame-ancestors") {
      const sources = parts.slice(1).filter((source) => source !== "");
      return sources.length === 0 ? void 0 : sources;
    }
  }
  return void 0;
}
var BROWSER_IFRAME_SANDBOX = "allow-scripts allow-forms allow-popups allow-downloads allow-modals allow-popups-to-escape-sandbox";
var BROWSER_IFRAME_SANDBOX_LOCAL = `${BROWSER_IFRAME_SANDBOX} allow-same-origin`;

// template/dshell.css
var dshell_default = `/* dsh-mytable \u539F\u751F\u76AE\u80A4 \xB7 DSH \u8BBE\u8BA1\u7CFB\u7EDF\u7EC4\u4EF6\u5E93\r
   \u7528\u6CD5\uFF1A<link rel="stylesheet" href="/api/worktable/template/dshell.css">\r
   \u6240\u6709\u989C\u8272\u8D70 DSH \u4E3B\u9898\u53D8\u91CF\uFF08--dsw-alias-*\uFF09\uFF0C\u81EA\u52A8\u9002\u914D\u660E\u6697\u4E3B\u9898\u3002 */\r
:root { color-scheme: dark; }\r
* { box-sizing: border-box; }\r
html, body { margin: 0; padding: 0; }\r
body {\r
  background: var(--dsw-alias-bg-base, #0b0e14);\r
  color: var(--dsw-alias-label-primary, #e6e8eb);\r
  font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;\r
  font-size: 13px;\r
  line-height: 1.6;\r
}\r
.dshell { display: flex; flex-direction: column; gap: 12px; padding: 14px 16px; min-height: 100%; }\r
/* \u6587\u5B57\u5C42\u7EA7 */\r
.dshell-title { margin: 0; font-size: 16px; font-weight: 600; color: var(--dsw-alias-label-primary, #e6e8eb); }\r
.dshell-sub { margin: 0; font-size: 12px; color: var(--dsw-alias-label-secondary, #9aa4b2); }\r
.dshell-muted { color: var(--dsw-alias-label-tertiary, #6b7280); font-size: 11.5px; }\r
/* \u5361\u7247 */\r
.dshell-card { border: 1px solid var(--dsw-alias-border-l1, #262b36); border-radius: 10px; background: var(--dsw-alias-fill-l1, rgba(255,255,255,.02)); padding: 12px 14px; }\r
.dshell-card + .dshell-card { margin-top: 10px; }\r
/* \u6309\u94AE\uFF08\u7EFF\u8272\u4E3B\u6309\u94AE / \u5E7D\u7075\u6309\u94AE / \u5371\u9669\uFF09 */\r
.dshell-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 999px; border: 1px solid transparent; background: #3fb950; color: #0b0e14; font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; }\r
.dshell-btn:hover { filter: brightness(1.08); }\r
.dshell-btnGhost { background: transparent; border-color: var(--dsw-alias-border-l1, #262b36); color: var(--dsw-alias-label-secondary, #9aa4b2); }\r
.dshell-btnGhost:hover { color: var(--dsw-alias-label-primary, #e6e8eb); border-color: var(--dsw-alias-border-l2, #3a4150); }\r
.dshell-btnDanger { background: transparent; border-color: #f85149; color: #f85149; }\r
/* \u72B6\u6001\u5FBD\u6807\uFF08\u5706\u70B9 + \u6587\u5B57\uFF1B\u7EFF=\u5DF2\u5B8C\u6210 \u9EC4=\u5F85\u529E/\u5F85\u53D1\u5E03 \u7070=\u672A\u5F00\u59CB\uFF09 */\r
.dshell-badge { display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px; border-radius: 999px; border: 1px solid var(--dsw-alias-border-l1, #262b36); font-size: 11.5px; color: var(--dsw-alias-label-secondary, #9aa4b2); background: var(--dsw-alias-fill-l1, rgba(255,255,255,.03)); }\r
.dshell-badge::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-label-tertiary, #6b7280); }\r
.dshell-badgeDone { color: #3fb950; border-color: rgba(63,185,80,.4); }\r
.dshell-badgeDone::before { background: #3fb950; box-shadow: 0 0 5px #3fb950; }\r
.dshell-badgeWait { color: #d29922; border-color: rgba(210,153,34,.4); }\r
.dshell-badgeWait::before { background: #d29922; box-shadow: 0 0 5px #d29922; }\r
.dshell-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--dsw-alias-label-tertiary, #6b7280); }\r
.dshell-dotDone { background: #3fb950; box-shadow: 0 0 5px #3fb950; }\r
.dshell-dotWait { background: #d29922; box-shadow: 0 0 5px #d29922; }\r
/* \u6807\u7B7E\u9875 */\r
.dshell-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--dsw-alias-border-l1, #262b36); }\r
.dshell-tab { padding: 7px 12px; font-size: 12.5px; color: var(--dsw-alias-label-secondary, #9aa4b2); cursor: pointer; border: none; background: none; font: inherit; border-bottom: 2px solid transparent; margin-bottom: -1px; }\r
.dshell-tabOn { color: var(--dsw-alias-label-primary, #e6e8eb); border-bottom-color: var(--dsw-alias-state-accent-primary, #4f8ef7); }\r
/* \u5217\u8868 */\r
.dshell-list { display: flex; flex-direction: column; gap: 6px; }\r
.dshell-listItem { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 12px; border: 1px solid var(--dsw-alias-border-l1, #262b36); border-radius: 8px; background: var(--dsw-alias-fill-l1, rgba(255,255,255,.02)); cursor: pointer; }\r
.dshell-listItem:hover { border-color: var(--dsw-alias-border-l2, #3a4150); background: var(--dsw-alias-fill-l1, rgba(255,255,255,.05)); }\r
.dshell-listItemTitle { font-size: 12.5px; color: var(--dsw-alias-label-primary, #e6e8eb); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\r
.dshell-listItemMeta { flex: none; font-size: 11px; color: var(--dsw-alias-label-tertiary, #6b7280); }\r
/* \u7F51\u683C / \u7EDF\u8BA1 */\r
.dshell-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }\r
.dshell-stat { padding: 10px 12px; border: 1px solid var(--dsw-alias-border-l1, #262b36); border-radius: 10px; background: var(--dsw-alias-fill-l1, rgba(255,255,255,.02)); }\r
.dshell-statLabel { font-size: 11px; color: var(--dsw-alias-label-secondary, #9aa4b2); }\r
.dshell-statValue { font-size: 20px; font-weight: 600; color: var(--dsw-alias-label-primary, #e6e8eb); }\r
.dshell-statDelta { font-size: 11px; color: #3fb950; }\r
/* \u8FDB\u5EA6\u6761 */\r
.dshell-progress { height: 6px; border-radius: 3px; background: var(--dsw-alias-fill-l1, rgba(255,255,255,.06)); overflow: hidden; }\r
.dshell-progressBar { height: 100%; border-radius: 3px; background: #3fb950; }\r
/* \u8F93\u5165 */\r
.dshell-input, .dshell-textarea { width: 100%; padding: 7px 10px; border: 1px solid var(--dsw-alias-border-l1, #262b36); border-radius: 8px; background: var(--dsw-alias-fill-l1, rgba(255,255,255,.03)); color: var(--dsw-alias-label-primary, #e6e8eb); font: inherit; font-size: 12.5px; outline: none; }\r
.dshell-input:focus, .dshell-textarea:focus { border-color: var(--dsw-alias-state-accent-primary, #4f8ef7); }\r
/* \u8868\u683C */\r
.dshell-table { width: 100%; border-collapse: collapse; font-size: 12px; }\r
.dshell-table th, .dshell-table td { text-align: left; padding: 7px 10px; border-bottom: 1px solid var(--dsw-alias-border-l1, #262b36); }\r
.dshell-table th { color: var(--dsw-alias-label-secondary, #9aa4b2); font-weight: 500; }\r
/* \u952E\u503C\u5BF9 */\r
.dshell-kv { display: flex; flex-direction: column; gap: 6px; }\r
.dshell-kvRow { display: flex; justify-content: space-between; gap: 10px; font-size: 12px; }\r
.dshell-kvKey { color: var(--dsw-alias-label-secondary, #9aa4b2); }\r
.dshell-kvValue { color: var(--dsw-alias-label-primary, #e6e8eb); text-align: right; }\r
/* \u5206\u5272\u7EBF */\r
.dshell-divider { height: 1px; background: var(--dsw-alias-border-l1, #262b36); margin: 6px 0; }\r
/* \u6EDA\u52A8\u6761 */\r
::-webkit-scrollbar { width: 10px; height: 10px; }\r
::-webkit-scrollbar-thumb { background: rgba(255,255,255,.14); border-radius: 5px; }\r
::-webkit-scrollbar-track { background: transparent; }\r
`;

// template/dshell.html
var dshell_default2 = '<!doctype html>\r\n<!-- dsh-mytable \u539F\u751F\u76AE\u80A4\u6A21\u677F\uFF1A\u65B0\u9875\u9762\u4EE5\u6B64\u4E3A\u57FA\u7840\uFF0C\u66FF\u6362\u4E0B\u9762\u793A\u4F8B\u5185\u5BB9\u5373\u53EF\u3002\r\n     \u6837\u5F0F\u8868\u7531\u63D2\u4EF6\u63D0\u4F9B\uFF08\u968F\u4E3B\u9898\u81EA\u52A8\u9002\u914D\uFF09\uFF0C\u4E0D\u8981\u590D\u5236\u6216\u6539\u5199\u5B83\u3002 -->\r\n<html lang="zh-CN">\r\n<head>\r\n  <meta charset="utf-8" />\r\n  <meta name="viewport" content="width=device-width, initial-scale=1" />\r\n  <title>\u6211\u7684\u7A97\u53E3</title>\r\n  <link rel="stylesheet" href="/api/worktable/template/dshell.css" />\r\n</head>\r\n<body>\r\n  <div class="dshell">\r\n    <!-- \u6807\u9898\u533A -->\r\n    <h1 class="dshell-title">\u7A97\u53E3\u6807\u9898</h1>\r\n    <p class="dshell-sub">\u4E00\u53E5\u8BDD\u8BF4\u660E\u8FD9\u4E2A\u7A97\u53E3\u505A\u4EC0\u4E48\u3002</p>\r\n\r\n    <!-- \u72B6\u6001\u5FBD\u6807\uFF1A\u5DF2\u5B8C\u6210 dshell-badgeDone / \u8FDB\u884C\u4E2D dshell-badgeWait / \u9ED8\u8BA4 -->\r\n    <div>\r\n      <span class="dshell-badge dshell-badgeDone">\u5DF2\u5B8C\u6210</span>\r\n      <span class="dshell-badge dshell-badgeWait">\u8FDB\u884C\u4E2D</span>\r\n      <span class="dshell-badge">\u672A\u5F00\u59CB</span>\r\n    </div>\r\n\r\n    <!-- \u6807\u7B7E\u9875 -->\r\n    <div class="dshell-tabs">\r\n      <button class="dshell-tab dshell-tabOn">\u6982\u89C8</button>\r\n      <button class="dshell-tab">\u8BE6\u60C5</button>\r\n      <button class="dshell-tab">\u8BBE\u7F6E</button>\r\n    </div>\r\n\r\n    <!-- \u7EDF\u8BA1\u5361\u7247\u7F51\u683C -->\r\n    <div class="dshell-grid">\r\n      <div class="dshell-stat">\r\n        <div class="dshell-statLabel">\u603B\u6570</div>\r\n        <div class="dshell-statValue">128</div>\r\n        <div class="dshell-statDelta">+12.4%</div>\r\n      </div>\r\n      <div class="dshell-stat">\r\n        <div class="dshell-statLabel">\u8FDB\u884C\u4E2D</div>\r\n        <div class="dshell-statValue">7</div>\r\n      </div>\r\n      <div class="dshell-stat">\r\n        <div class="dshell-statLabel">\u5DF2\u5B8C\u6210</div>\r\n        <div class="dshell-statValue">121</div>\r\n      </div>\r\n    </div>\r\n\r\n    <!-- \u5217\u8868 -->\r\n    <div class="dshell-list">\r\n      <div class="dshell-listItem">\r\n        <span class="dshell-listItemTitle">\u6761\u76EE\u4E00\uFF1A\u793A\u4F8B\u5185\u5BB9\u6807\u9898</span>\r\n        <span class="dshell-listItemMeta">\u6628\u5929</span>\r\n      </div>\r\n      <div class="dshell-listItem">\r\n        <span class="dshell-listItemTitle">\u6761\u76EE\u4E8C\uFF1A\u793A\u4F8B\u5185\u5BB9\u6807\u9898</span>\r\n        <span class="dshell-badge dshell-badgeDone">\u5DF2\u53D1\u5E03</span>\r\n      </div>\r\n    </div>\r\n\r\n    <!-- \u5361\u7247 + \u952E\u503C\u5BF9 -->\r\n    <div class="dshell-card">\r\n      <h2 class="dshell-sub" style="margin:0 0 8px">\u8BE6\u60C5</h2>\r\n      <div class="dshell-kv">\r\n        <div class="dshell-kvRow"><span class="dshell-kvKey">\u5B57\u6BB5 A</span><span class="dshell-kvValue">\u503C A</span></div>\r\n        <div class="dshell-kvRow"><span class="dshell-kvKey">\u5B57\u6BB5 B</span><span class="dshell-kvValue">\u503C B</span></div>\r\n      </div>\r\n      <div class="dshell-divider"></div>\r\n      <div class="dshell-progress"><div class="dshell-progressBar" style="width:72%"></div></div>\r\n    </div>\r\n\r\n    <!-- \u64CD\u4F5C\u533A -->\r\n    <div style="display:flex;gap:8px">\r\n      <button class="dshell-btn">\u4E3B\u8981\u64CD\u4F5C</button>\r\n      <button class="dshell-btn dshell-btnGhost">\u6B21\u8981\u64CD\u4F5C</button>\r\n    </div>\r\n  </div>\r\n</body>\r\n</html>\r\n';

// src/index.ts
function baseDshHome() {
  const env = process.env.DSH_HOME;
  const value = env !== void 0 && env.trim().length > 0 ? env : pathResolve(homedir(), ".dsh");
  if (value === "~") return homedir();
  if (value.startsWith("~/") || value.startsWith("~\\")) return pathResolve(homedir(), value.slice(2));
  return pathResolve(value);
}
var cachedDshHome = null;
var dshHomeSource = "fallback";
function resolveDshHomeSafe() {
  if (cachedDshHome) return cachedDshHome;
  try {
    const pkg = loadPkg("@deepseek-ai/dsh-home-paths");
    if (pkg && typeof pkg.resolveDshHome === "function") {
      const home = pkg.resolveDshHome(void 0, process.env);
      if (typeof home === "string" && home.trim() !== "") {
        dshHomeSource = "official";
        cachedDshHome = home;
        return cachedDshHome;
      }
    }
  } catch {
  }
  dshHomeSource = "fallback";
  cachedDshHome = baseDshHome();
  return cachedDshHome;
}
var PLUGIN_VERSION = false ? "dev" : "0.1.0";
var name = "dsh-mytable";
var inject = ["webServer", "sessions"];
var HEALTH_PATH = "/api/worktable/health";
var BROWSER_PROBE_PATH = "/api/worktable/browser/probe";
var MAX_ENTRIES = 500;
var FILE_TYPES = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  map: "application/json; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  markdown: "text/markdown; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  log: "text/plain; charset=utf-8",
  pdf: "application/pdf",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  ico: "image/x-icon",
  avif: "image/avif",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  wasm: "application/wasm",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  webm: "video/webm",
  // 文本/配置类（预览里当文本或代码读；MIME 给对，浏览器就不会乱猜）
  xml: "application/xml; charset=utf-8",
  yml: "text/yaml; charset=utf-8",
  yaml: "text/yaml; charset=utf-8",
  toml: "text/plain; charset=utf-8",
  ini: "text/plain; charset=utf-8",
  conf: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  tsv: "text/tab-separated-values; charset=utf-8",
  py: "text/x-python; charset=utf-8",
  sh: "text/x-shellscript; charset=utf-8",
  ps1: "text/plain; charset=utf-8",
  bat: "text/plain; charset=utf-8",
  sql: "text/plain; charset=utf-8",
  // 音频 / 视频（浏览器内置播放器要认这些类型，否则只给一个下载）
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
  opus: "audio/opus",
  weba: "audio/webm",
  ogv: "video/ogg",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  // Office 文档与压缩包：不内嵌渲染，但要给对 MIME（「在浏览器中打开」时按正确类型下载）
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
  rtf: "application/rtf",
  zip: "application/zip",
  gz: "application/gzip",
  tgz: "application/gzip",
  tar: "application/x-tar",
  "7z": "application/x-7z-compressed",
  rar: "application/vnd.rar",
  jar: "application/java-archive",
  exe: "application/vnd.microsoft.portable-executable",
  dll: "application/vnd.microsoft.portable-executable",
  iso: "application/x-iso9660-image",
  dmg: "application/x-apple-diskimage",
  db: "application/vnd.sqlite3",
  sqlite: "application/vnd.sqlite3",
  sqlite3: "application/vnd.sqlite3"
};
var SITE_PREFIX = "/api/worktable/site";
var TEMPLATE_PREFIX = "/api/worktable/template";
var loadProbeAttempts = 0;
function loadPkg(pkg) {
  const starts = /* @__PURE__ */ new Set();
  try {
    starts.add(dirname(fileURLToPath(import.meta.url)));
  } catch {
  }
  try {
    starts.add(realpathSync(dirname(fileURLToPath(import.meta.url))));
  } catch {
  }
  for (const start of starts) {
    let dir = start;
    while (dir && dir !== pathResolve(dir, "..")) {
      loadProbeAttempts++;
      try {
        const req = createRequire(pathToFileURL(pathResolve(dir, "__wt_probe__.js")).href);
        return req(pkg);
      } catch {
      }
      dir = pathResolve(dir, "..");
    }
  }
  try {
    const profilesDir = pathResolve(baseDshHome(), "profiles");
    for (const profile of readdirSync(profilesDir, { withFileTypes: true })) {
      if (!profile.isDirectory() && !profile.isSymbolicLink()) continue;
      const nm = pathResolve(profilesDir, profile.name, "node_modules");
      loadProbeAttempts++;
      try {
        const req = createRequire(pathToFileURL(pathResolve(nm, "__wt_probe__.js")).href);
        return req(pkg);
      } catch {
      }
    }
  } catch {
  }
  return null;
}
function __wtLoadProbeStats() {
  return { attempts: loadProbeAttempts, homeSource: dshHomeSource };
}
function serverCwd(ctx, sessionId, clientCwd) {
  if (sessionId) {
    try {
      const headerCwd = ctx.sessions?.get?.(sessionId)?.header?.cwd;
      if (typeof headerCwd === "string" && headerCwd) return headerCwd;
    } catch {
    }
  }
  if (typeof clientCwd === "string" && clientCwd) return clientCwd;
  return process.cwd();
}
function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}
async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
async function listDirectory(path) {
  const abs = pathResolve(path);
  const dirents = await readdir(abs, { withFileTypes: true });
  const entries = dirents.map((d) => ({ name: d.name, path: abs + sep + d.name, isDir: d.isDirectory(), hidden: d.name.startsWith(".") })).sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name, void 0, { sensitivity: "base" });
  });
  const truncated = entries.length > MAX_ENTRIES;
  return { path: abs, entries: truncated ? entries.slice(0, MAX_ENTRIES) : entries, truncated };
}
var SEARCH_MAX_RESULTS = 200;
var SEARCH_MAX_SCAN = 2e4;
var SEARCH_MAX_DEPTH = 12;
var SEARCH_SKIP_DIRS = /* @__PURE__ */ new Set([
  "node_modules",
  ".git",
  ".hg",
  ".svn",
  "dist",
  "build",
  "out",
  "target",
  "__pycache__",
  ".venv",
  "venv",
  ".cache",
  ".next",
  ".nuxt",
  ".turbo",
  "coverage"
]);
async function searchByName(root, query) {
  const needle = query.toLowerCase();
  const entries = [];
  let scanned = 0;
  let truncated = false;
  const walk = async (dir, depth) => {
    if (truncated || depth > SEARCH_MAX_DEPTH) return;
    let dirents;
    try {
      dirents = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    const dirs = [];
    for (const d of dirents) {
      if (scanned >= SEARCH_MAX_SCAN) {
        truncated = true;
        return;
      }
      scanned++;
      const abs = dir + sep + d.name;
      const isDir = d.isDirectory();
      const rel = abs.slice(root.length + 1);
      if (d.name.toLowerCase().includes(needle) || rel.toLowerCase().includes(needle)) {
        entries.push({ name: d.name, path: abs, isDir, hidden: d.name.startsWith(".") });
        if (entries.length >= SEARCH_MAX_RESULTS) {
          truncated = true;
          return;
        }
      }
      if (isDir && !SEARCH_SKIP_DIRS.has(d.name)) dirs.push(abs);
    }
    for (const sub of dirs) await walk(sub, depth + 1);
  };
  await walk(root, 0);
  entries.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.path.localeCompare(b.path, void 0, { sensitivity: "base" });
  });
  return { root, entries, scanned, truncated };
}
function gitExec(args, cwd) {
  return new Promise((resolvePromise, reject) => {
    execFile("git", args, { cwd, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
      if (err) reject(err);
      else resolvePromise(stdout);
    });
  });
}
var OPS_TEXT_MAX = 100 * 1024;
function narrowOpsEvent(ev) {
  if (ev?.type === "tool/call") {
    const d = ev.data ?? {};
    return {
      seq: ev.seq,
      time: ev.time,
      type: "tool/call",
      data: {
        name: typeof d.name === "string" ? d.name : "",
        callId: typeof d.callId === "string" ? d.callId : "",
        arguments: typeof d.arguments === "string" ? d.arguments.slice(0, OPS_TEXT_MAX) : ""
      }
    };
  }
  const message = ev?.data?.message ?? {};
  const blocks = Array.isArray(message.content) ? message.content : [];
  const outBlocks = [];
  for (const block of blocks) {
    if (block === null || typeof block !== "object" || block.type !== "tool-result") continue;
    const inner = Array.isArray(block.content) ? block.content : [];
    const texts = [];
    for (const item of inner) {
      if (item !== null && typeof item === "object" && item.type === "text" && typeof item.text === "string") {
        texts.push({ type: "text", text: item.text.slice(0, OPS_TEXT_MAX) });
      }
    }
    outBlocks.push({ type: "tool-result", isError: block.isError === true, content: texts });
  }
  return {
    seq: ev.seq,
    time: ev.time,
    type: "tool/result",
    data: { message: { source: { callId: typeof message?.source?.callId === "string" ? message.source.callId : "" }, content: outBlocks } }
  };
}
var TURN_TEXT_MAX = 4e3;
function makeTurnStat(turn, time) {
  return {
    turn,
    qa: 0,
    time,
    input: "",
    output: "",
    tools: 0,
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, total: 0, calls: 0 }
  };
}
function clip(text, max) {
  return text.length > max ? text.slice(0, max) + "\u2026" : text;
}
function messageText(message) {
  const blocks = Array.isArray(message?.content) ? message.content : [];
  const parts = [];
  for (const b of blocks) {
    if (b !== null && typeof b === "object" && b.type === "text" && typeof b.text === "string") parts.push(b.text);
  }
  return parts.join("\n").trim();
}
function addUsage(stat, usage) {
  if (usage === null || typeof usage !== "object") return;
  const num = (v) => typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
  stat.usage.input += num(usage.inputTokens);
  stat.usage.output += num(usage.outputTokens);
  stat.usage.cacheRead += num(usage.cacheReadTokens);
  stat.usage.cacheWrite += num(usage.cacheWriteTokens);
  stat.usage.reasoning += num(usage.reasoningTokens);
  stat.usage.total += num(usage.totalTokens) || num(usage.inputTokens) + num(usage.outputTokens);
  stat.usage.calls += 1;
}
function lastActivityOf(events) {
  const out = {};
  const argsOf = (raw) => {
    if (typeof raw !== "string" || raw === "") return "";
    try {
      const parsed = JSON.parse(raw);
      if (parsed !== null && typeof parsed === "object") {
        const first = Object.values(parsed).find((v) => typeof v === "string");
        if (typeof first === "string") return first.replace(/\s+/g, " ").trim();
      }
    } catch {
    }
    return raw.replace(/\s+/g, " ").trim();
  };
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i];
    if (ev?.type === "tool/call" && out.tool === void 0) {
      const d = ev.data ?? {};
      if (typeof d.name === "string" && d.name !== "") {
        out.tool = { name: d.name, args: argsOf(d.arguments).slice(0, 400) };
      }
    } else if (ev?.type === "assistant/message" && out.text === void 0) {
      const blocks = Array.isArray(ev?.data?.message?.content) ? ev.data.message.content : [];
      const parts = [];
      for (const b of blocks) {
        if (b !== null && typeof b === "object" && b.type === "text" && typeof b.text === "string") parts.push(b.text);
      }
      const text = parts.join("\n").trim();
      if (text !== "") out.text = text.slice(0, 1200);
    }
    if (out.text !== void 0 && out.tool !== void 0) break;
  }
  return out;
}
async function gitRootOf(path) {
  try {
    const out = await gitExec(["rev-parse", "--show-toplevel"], path);
    const root = out.trim();
    return root === "" ? null : pathResolve(root);
  } catch {
    return null;
  }
}
async function branchOf(root) {
  try {
    const out = await gitExec(["rev-parse", "--abbrev-ref", "HEAD"], root);
    const name2 = out.trim();
    if (name2 === "" || name2 === "HEAD") {
      const sha = await gitExec(["rev-parse", "--short", "HEAD"], root);
      return sha.trim();
    }
    return name2;
  } catch {
    return "";
  }
}
async function changeCountOf(root) {
  try {
    const out = await gitExec(["status", "--porcelain"], root);
    const paths = /* @__PURE__ */ new Set();
    for (const line of out.split(/\r?\n/)) {
      if (line.trim() === "") continue;
      const p = line.slice(3).trim().replace(/^"|"$/g, "");
      const arrow = p.indexOf(" -> ");
      paths.add(arrow === -1 ? p : p.slice(arrow + 4));
    }
    return paths.size;
  } catch {
    return 0;
  }
}
async function branchNamesOf(root) {
  const current = await branchOf(root);
  let names = [];
  try {
    const out = await gitExec(["for-each-ref", "--format=%(refname:short)", "refs/heads"], root);
    names = out.split(/\r?\n/).map((s) => s.trim()).filter((s) => s !== "");
  } catch {
    names = [];
  }
  if (current !== "" && !names.includes(current)) names = [current, ...names];
  return { current, names };
}
var REPO_CHILD_LIMIT = 60;
var REPO_DEEP_MAX_DEPTH = 3;
var REPO_DEEP_MAX_DIRS = 300;
var REPO_MAX_REPOS = 20;
var REPO_SKIP_DIRS = /* @__PURE__ */ new Set(["node_modules", "dist", "build", "out", "target", ".cache", ".venv", "venv", "__pycache__", "coverage"]);
function isSkippableDir(name2) {
  return name2.startsWith(".") || REPO_SKIP_DIRS.has(name2);
}
async function discoverRepos(base) {
  const abs = pathResolve(base);
  const self = await gitRootOf(abs);
  if (self !== null) {
    const one = { path: self, name: basename(self), branch: await branchOf(self), changes: await changeCountOf(self) };
    return { root: abs, repos: [one], searched: abs };
  }
  const repos = [];
  const seen = /* @__PURE__ */ new Set();
  const add = async (p) => {
    const abs2 = pathResolve(p);
    const key = abs2.toLowerCase();
    if (seen.has(key) || repos.length >= REPO_MAX_REPOS) return;
    seen.add(key);
    repos.push({ path: abs2, name: basename(abs2), branch: await branchOf(abs2), changes: await changeCountOf(abs2) });
  };
  let children = [];
  try {
    children = await readdir(abs, { withFileTypes: true });
  } catch {
    children = [];
  }
  const dirs = children.filter((d) => d.isDirectory() && !isSkippableDir(d.name)).map((d) => d.name).sort((a, b) => a.localeCompare(b, void 0, { sensitivity: "base" })).slice(0, REPO_CHILD_LIMIT);
  for (const name2 of dirs) {
    const root = await gitRootOf(abs + sep + name2);
    if (root !== null) await add(root);
  }
  if (repos.length === 0) {
    let scanned = 0;
    const walk = async (dir, depth) => {
      if (depth > REPO_DEEP_MAX_DEPTH || repos.length >= REPO_MAX_REPOS || scanned >= REPO_DEEP_MAX_DIRS) return;
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      if (entries.some((d) => d.isDirectory() && d.name === ".git")) {
        await add(dir);
        return;
      }
      for (const d of entries) {
        if (!d.isDirectory() || isSkippableDir(d.name)) continue;
        if (scanned >= REPO_DEEP_MAX_DIRS) return;
        scanned++;
        await walk(dir + sep + d.name, depth + 1);
      }
    };
    await walk(abs, 0);
  }
  repos.sort((a, b) => b.changes - a.changes || a.name.localeCompare(b.name, void 0, { sensitivity: "base" }));
  return { root: abs, repos, searched: abs };
}
var DIFF_MAX_FILES = 60;
var DIFF_MAX_BYTES_PER_FILE = 400 * 1024;
var DIFF_MAX_BYTES_TOTAL = 2 * 1024 * 1024;
var DIFF_UNTRACKED_MAX_LINES = 4e3;
function synthesizeAddedDiff(rel, text) {
  const lines = text.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  const shown = lines.slice(0, DIFF_UNTRACKED_MAX_LINES);
  const body = shown.map((l) => "+" + l).join("\n");
  const diff = `--- /dev/null
+++ b/${rel}
@@ -0,0 +1,${shown.length} @@
${body}
`;
  return { diff, additions: shown.length };
}
function countDiffLines(diff) {
  let additions = 0;
  let deletions = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) additions++;
    else if (line.startsWith("-") && !line.startsWith("---")) deletions++;
  }
  return { additions, deletions };
}
function splitDiffByFile(diffText) {
  const chunks = /* @__PURE__ */ new Map();
  for (const part of diffText.split(/^(?=diff --git )/m)) {
    if (!part.startsWith("diff --git ")) continue;
    const m = /^diff --git a\/(.+?) b\/(.+)$/m.exec(part);
    const rel = (m?.[2] ?? "").trim();
    if (rel !== "") chunks.set(rel, part);
  }
  return chunks;
}
async function workspaceChanges(root, onlyPath) {
  let branch = "";
  try {
    branch = (await gitExec(["rev-parse", "--abbrev-ref", "HEAD"], root)).trim();
  } catch {
    branch = "";
  }
  const hasHead = await gitExec(["rev-parse", "--verify", "HEAD"], root).then(() => true).catch(() => false);
  let porcelain = "";
  try {
    porcelain = await gitExec(["status", "--porcelain=v1", "-z"], root);
  } catch {
    porcelain = "";
  }
  const entries = porcelain.split("\0").filter((s) => s.length > 2).map((chunk) => ({
    status: chunk.slice(0, 2),
    rel: chunk.slice(3).replace(/\\/g, "/")
  }));
  const wantRel = (rel) => onlyPath === void 0 || pathResolve(root, rel) === pathResolve(onlyPath);
  const stagedChunks = /* @__PURE__ */ new Map();
  const unstagedChunks = /* @__PURE__ */ new Map();
  if (hasHead) {
    const pathArg = onlyPath !== void 0 ? ["--", onlyPath] : [];
    try {
      for (const [k, v] of splitDiffByFile(await gitExec(["diff", "--no-color", "-U3", "--cached", ...pathArg], root))) stagedChunks.set(k, v);
    } catch {
    }
    try {
      for (const [k, v] of splitDiffByFile(await gitExec(["diff", "--no-color", "-U3", ...pathArg], root))) unstagedChunks.set(k, v);
    } catch {
    }
  }
  const files = [];
  let truncated = false;
  let totalBytes = 0;
  const cap = (diff) => {
    if (diff.length > DIFF_MAX_BYTES_PER_FILE) {
      truncated = true;
      return diff.slice(0, DIFF_MAX_BYTES_PER_FILE);
    }
    if (totalBytes + diff.length > DIFF_MAX_BYTES_TOTAL) {
      truncated = true;
      return null;
    }
    totalBytes += diff.length;
    return diff;
  };
  for (const entry of entries) {
    if (!wantRel(entry.rel)) continue;
    if (files.length >= DIFF_MAX_FILES) {
      truncated = true;
      break;
    }
    const isUntracked = entry.status === "??";
    const item = { path: pathResolve(root, entry.rel), rel: entry.rel, status: entry.status, untracked: isUntracked };
    const x = entry.status[0] ?? " ";
    const y = entry.status[1] ?? " ";
    const stagedDiff = stagedChunks.get(entry.rel);
    if (x !== " " && x !== "?" && stagedDiff !== void 0) {
      const d = cap(stagedDiff);
      if (d !== null) item.staged = { diff: d, ...countDiffLines(d) };
    }
    const workDiff = unstagedChunks.get(entry.rel);
    if (isUntracked) {
      try {
        const text = await readFile(pathResolve(root, entry.rel), "utf8");
        const d = cap(synthesizeAddedDiff(entry.rel, text).diff);
        if (d !== null) item.unstaged = { diff: d, ...countDiffLines(d) };
      } catch {
      }
    } else if (y !== " " && workDiff !== void 0) {
      const d = cap(workDiff);
      if (d !== null) item.unstaged = { diff: d, ...countDiffLines(d) };
    } else if (!hasHead) {
      try {
        const text = await readFile(pathResolve(root, entry.rel), "utf8");
        const d = cap(synthesizeAddedDiff(entry.rel, text).diff);
        if (d !== null) item.unstaged = { diff: d, ...countDiffLines(d) };
      } catch {
      }
    }
    files.push(item);
  }
  return { isRepo: true, root, branch: branch === "HEAD" ? "" : branch, files, truncated };
}
async function gitRun(root, args) {
  try {
    const out = await gitExec(args, root);
    return { ok: true, output: out.trim() };
  } catch (err) {
    const detail = String(err?.stderr ?? err?.message ?? err).trim();
    return { ok: false, output: detail.slice(0, 2e3) };
  }
}
async function gitLogPage(root, limit, skip) {
  const out = await gitRun(root, ["log", `--max-count=${limit}`, `--skip=${skip}`, "--decorate=short", "--pretty=format:%H%x1f%h%x1f%an%x1f%at%x1f%s%x1f%D"]);
  if (!out.ok) return { isRepo: true, root, commits: [] };
  const commits = out.output.split("\n").filter((l) => l.trim() !== "").map((line) => {
    const [hash = "", short = "", author = "", at = "0", subject = "", refs = ""] = line.split("");
    const refNames = refs.split(",").map((s) => s.trim()).filter((s) => s !== "" && s !== "HEAD");
    return { hash, short, author, time: Number(at) * 1e3, subject, refs: refNames };
  });
  return { isRepo: true, root, commits };
}
async function gitStatus(cwd) {
  try {
    const branchRaw = await gitExec(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
    const porcelain = await gitExec(["status", "--porcelain=v1", "-z"], cwd);
    const entries = porcelain.split("\0").filter((s) => s.length > 2).map((s) => ({ xy: s.slice(0, 2), path: s.slice(3) }));
    return { isRepo: true, branch: branchRaw.trim() || "HEAD", entries };
  } catch {
    return { isRepo: false, branch: void 0, entries: [] };
  }
}
function setupTerminal(webServer, ctx) {
  if (typeof webServer.registerUpgrade !== "function") return;
  const wsMod = loadPkg("ws");
  const ptyMod = loadPkg("node-pty");
  ctx.logger?.info?.("[dsh-mytable] term deps: ws=" + (wsMod ? "ok" : "MISSING") + " node-pty=" + (ptyMod ? "ok" : "MISSING"));
  if (!wsMod || !ptyMod) {
    ctx.logger?.warn("[dsh-mytable] \u7EC8\u7AEF\u8DEF\u7531\u672A\u6CE8\u518C\uFF1Aws/node-pty \u4E0D\u53EF\u7528");
    return;
  }
  const WebSocketServer = wsMod.WebSocketServer ?? wsMod.default?.WebSocketServer;
  if (!WebSocketServer) return;
  const pty = ptyMod.default ?? ptyMod;
  const wss = new WebSocketServer({ noServer: true });
  const spawnShell = () => process.platform === "win32" ? { cmd: "powershell.exe", args: [] } : { cmd: process.env.SHELL || "/bin/bash", args: [] };
  const clampDim = (v, fallback) => Math.min(1024, Math.max(2, Number.isFinite(v) ? v : fallback));
  ctx.effect(() => webServer.registerUpgrade({
    path: "/api/worktable/term",
    handler: (req, socket, head) => {
      wss.handleUpgrade(req, socket, head, (ws) => {
        const u = new URL(req.url ?? "/", "http://dsh.internal");
        const cwd = serverCwd(ctx, u.searchParams.get("sessionId") || void 0, u.searchParams.get("cwd") || void 0);
        const cols = clampDim(Number(u.searchParams.get("cols")), 80);
        const rows = clampDim(Number(u.searchParams.get("rows")), 24);
        let term = null;
        try {
          const shell = spawnShell();
          term = pty.spawn(shell.cmd, shell.args, { name: "xterm-256color", cols, rows, cwd, env: process.env });
        } catch (err) {
          try {
            ws.send("\r\n[worktable] \u7EC8\u7AEF\u542F\u52A8\u5931\u8D25\uFF1A" + String(err));
          } catch {
          }
          try {
            ws.close();
          } catch {
          }
          return;
        }
        term.onData((d) => {
          try {
            ws.send(d);
          } catch {
          }
        });
        term.onExit(() => {
          try {
            ws.close();
          } catch {
          }
        });
        ws.on("message", (raw) => {
          const text = String(raw);
          try {
            const msg = JSON.parse(text);
            if (msg && msg.type === "resize" && Number.isFinite(msg.cols) && Number.isFinite(msg.rows)) {
              term.resize(clampDim(msg.cols, cols), clampDim(msg.rows, rows));
              return;
            }
          } catch {
          }
          try {
            term.write(text);
          } catch {
          }
        });
        ws.on("close", () => {
          try {
            term.kill();
          } catch {
          }
        });
      });
    }
  }), "dsh-mytable: terminal upgrade");
}
function apply(ctx) {
  const webServer = ctx.webServer;
  if (!webServer) {
    ctx.logger?.warn("[dsh-mytable] ctx.webServer \u4E0D\u53EF\u7528\uFF08headless profile\uFF1F\uFF09\uFF0C\u8DF3\u8FC7\u670D\u52A1\u7AEF\u8DEF\u7531");
    return;
  }
  webServer.register({
    kind: "exact",
    path: HEALTH_PATH,
    handler: (_req, res) => {
      json(res, 200, { plugin: "dsh-mytable", version: PLUGIN_VERSION, ok: true });
    }
  });
  webServer.register({
    kind: "exact",
    path: BROWSER_PROBE_PATH,
    handler: async (req, res) => {
      if (String(req.headers?.["sec-fetch-site"] ?? "") === "cross-site") {
        json(res, 403, { error: "cross-site probe refused" });
        return;
      }
      const raw = new URL(req.url ?? "/", "http://dsh.internal").searchParams.get("url") || "";
      let target;
      try {
        target = new URL(raw);
      } catch {
        json(res, 400, { error: "invalid url" });
        return;
      }
      if (target.protocol !== "http:" && target.protocol !== "https:") {
        json(res, 400, { error: "only http(s) urls can be probed" });
        return;
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8e3);
      try {
        let response = await fetch(target, { method: "HEAD", redirect: "follow", signal: controller.signal });
        let retriedAsGet = false;
        if (response.status === 405 || response.status === 501) {
          response = await fetch(target, { method: "GET", redirect: "follow", signal: controller.signal });
          retriedAsGet = true;
        }
        const hasEmbedSignals = response.headers.get("content-security-policy") !== null || response.headers.get("x-frame-options") !== null;
        if (!hasEmbedSignals && !retriedAsGet) {
          response = await fetch(target, { method: "GET", redirect: "follow", signal: controller.signal });
        }
        const frameAncestors = extractFrameAncestors(response.headers.get("content-security-policy"));
        const xFrameOptions = response.headers.get("x-frame-options");
        void response.body?.cancel();
        const out = {
          reachable: true,
          url: response.url,
          status: response.status,
          ...xFrameOptions !== null ? { xFrameOptions } : {},
          ...frameAncestors !== void 0 ? { frameAncestors } : {}
        };
        json(res, 200, out);
      } catch {
        json(res, 200, { reachable: false });
      } finally {
        clearTimeout(timer);
      }
    }
  });
  webServer.register({
    kind: "exact",
    path: "/api/worktable/file",
    handler: async (req, res) => {
      try {
        const u = new URL(req.url ?? "/", "http://dsh.internal");
        const p = u.searchParams.get("path") || "";
        if (!p) {
          json(res, 400, { error: "missing path" });
          return;
        }
        const abs = pathResolve(p);
        const stat = await import("node:fs/promises").then((m) => m.stat(abs));
        if (stat.size > 20 * 1024 * 1024) {
          json(res, 413, { error: "file too large" });
          return;
        }
        const data = await readFile(abs);
        const ext = (abs.split(".").pop() || "").toLowerCase();
        const types = {
          html: "text/html; charset=utf-8",
          htm: "text/html; charset=utf-8",
          css: "text/css; charset=utf-8",
          js: "text/javascript; charset=utf-8",
          mjs: "text/javascript; charset=utf-8",
          json: "application/json; charset=utf-8",
          md: "text/markdown; charset=utf-8",
          markdown: "text/markdown; charset=utf-8",
          txt: "text/plain; charset=utf-8",
          log: "text/plain; charset=utf-8",
          pdf: "application/pdf",
          svg: "image/svg+xml",
          png: "image/png",
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          gif: "image/gif",
          webp: "image/webp",
          bmp: "image/bmp",
          ico: "image/x-icon"
        };
        res.writeHead(200, { "content-type": FILE_TYPES[ext] ?? "application/octet-stream", "cache-control": "no-store" });
        res.end(data);
      } catch (err) {
        json(res, 404, { error: String(err) });
      }
    }
  });
  webServer.register({
    kind: "prefix",
    path: TEMPLATE_PREFIX,
    handler: (req, res) => {
      try {
        if (req.method !== "GET") {
          res.writeHead(405);
          res.end();
          return;
        }
        const pathname = new URL(req.url ?? "/", "http://dsh.internal").pathname;
        const rel = pathname.slice(TEMPLATE_PREFIX.length);
        if (rel === "/dshell.css") {
          res.writeHead(200, { "content-type": "text/css; charset=utf-8", "cache-control": "no-store" });
          res.end(dshell_default);
        } else {
          res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
          res.end(dshell_default2);
        }
      } catch (err) {
        res.writeHead(404);
        res.end(String(err));
      }
    }
  });
  webServer.register({
    kind: "prefix",
    path: SITE_PREFIX,
    handler: async (req, res) => {
      try {
        if (req.method !== "GET") {
          res.writeHead(405);
          res.end();
          return;
        }
        const pathname = new URL(req.url ?? "/", "http://dsh.internal").pathname;
        const segs = pathname.slice(SITE_PREFIX.length).split("/").filter(Boolean);
        const rootToken = decodeURIComponent(segs.shift() ?? "");
        const rel = segs.map((s) => {
          try {
            return decodeURIComponent(s);
          } catch {
            return s;
          }
        }).join("/");
        if (!rootToken) {
          json(res, 400, { error: "missing root" });
          return;
        }
        const root = pathResolve(rootToken);
        let abs = pathResolve(root, rel);
        if (abs !== root && !abs.startsWith(root + sep)) {
          json(res, 403, { error: "outside root" });
          return;
        }
        const statMod = await import("node:fs/promises");
        let info = await statMod.stat(abs).catch(() => null);
        if (info && info.isDirectory()) {
          abs = pathResolve(abs, "index.html");
          info = await statMod.stat(abs).catch(() => null);
        }
        if (!info || !info.isFile()) {
          json(res, 404, { error: "not found" });
          return;
        }
        if (info.size > 40 * 1024 * 1024) {
          json(res, 413, { error: "file too large" });
          return;
        }
        const data = await readFile(abs);
        const ext = (abs.split(".").pop() || "").toLowerCase();
        res.writeHead(200, { "content-type": FILE_TYPES[ext] ?? "application/octet-stream", "cache-control": "no-store" });
        res.end(data);
      } catch (err) {
        json(res, 404, { error: String(err) });
      }
    }
  });
  webServer.register({
    kind: "exact",
    path: "/api/worktable/fs",
    handler: async (req, res) => {
      try {
        const body = await readJsonBody(req);
        const path = typeof body.path === "string" && body.path ? body.path : serverCwd(ctx, body.sessionId, body.cwd);
        json(res, 200, await listDirectory(path));
      } catch (err) {
        json(res, 500, { path: "", entries: [], truncated: false, error: String(err) });
      }
    }
  });
  webServer.register({
    kind: "exact",
    path: "/api/worktable/search",
    handler: async (req, res) => {
      try {
        const body = await readJsonBody(req);
        const query = typeof body.query === "string" ? body.query.trim() : "";
        const root = typeof body.path === "string" && body.path ? body.path : serverCwd(ctx, body.sessionId, body.cwd);
        if (!query) {
          json(res, 200, { root, entries: [], scanned: 0, truncated: false });
          return;
        }
        json(res, 200, await searchByName(pathResolve(root), query));
      } catch (err) {
        json(res, 500, { root: "", entries: [], scanned: 0, truncated: false, error: String(err) });
      }
    }
  });
  webServer.register({
    kind: "exact",
    path: "/api/worktable/diff",
    handler: async (req, res) => {
      try {
        if (req.method !== "POST") {
          res.writeHead(405);
          res.end();
          return;
        }
        const body = await readJsonBody(req);
        const cwd = typeof body.cwd === "string" && body.cwd ? body.cwd : serverCwd(ctx, body.sessionId, void 0);
        const base = pathResolve(cwd);
        const explicitRepo = typeof body.repo === "string" && body.repo ? pathResolve(body.repo) : null;
        const root = explicitRepo ?? await gitRootOf(base);
        if (root === null) {
          json(res, 200, { isRepo: false, root: base, branch: "", files: [], truncated: false });
          return;
        }
        const onlyPath = typeof body.path === "string" && body.path ? pathResolve(body.path) : void 0;
        json(res, 200, await workspaceChanges(root, onlyPath));
      } catch (err) {
        json(res, 500, { isRepo: false, root: "", branch: "", files: [], truncated: false, error: String(err) });
      }
    }
  });
  webServer.register({
    kind: "exact",
    path: "/api/worktable/repos",
    handler: async (req, res) => {
      try {
        if (req.method !== "POST") {
          res.writeHead(405);
          res.end();
          return;
        }
        const body = await readJsonBody(req);
        const cwd = typeof body.cwd === "string" && body.cwd ? body.cwd : serverCwd(ctx, body.sessionId, void 0);
        json(res, 200, await discoverRepos(cwd));
      } catch (err) {
        json(res, 500, { root: "", repos: [], error: String(err) });
      }
    }
  });
  webServer.register({
    kind: "exact",
    path: "/api/worktable/ops",
    handler: async (req, res) => {
      try {
        if (req.method !== "POST") {
          res.writeHead(405);
          res.end();
          return;
        }
        const body = await readJsonBody(req);
        const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
        if (!sessionId) {
          json(res, 400, { error: "missing sessionId", events: [], lastSeq: 0, live: false });
          return;
        }
        const rawAfter = body.afterSeq;
        const afterSeq = Number.isSafeInteger(rawAfter) && rawAfter >= 0 ? rawAfter : -1;
        let all;
        try {
          all = ctx.sessions?.get?.(sessionId)?.snapshotEvents?.();
        } catch {
          all = void 0;
        }
        if (all === void 0) {
          json(res, 200, { events: [], lastSeq: Math.max(afterSeq, 0), live: false });
          return;
        }
        const narrowed = [];
        let turn = 0;
        let step = 0;
        let qa = 0;
        const turns = [];
        const humans = [];
        for (const ev of all) {
          const type = ev?.type;
          if (type === "turn/start") {
            turn += 1;
            step = 0;
            const stat = makeTurnStat(turn, Number(ev?.time) || 0);
            stat.startSeq = Number(ev?.seq) || 0;
            stat.qa = qa;
            turns.push(stat);
            continue;
          }
          if (type === "turn/end") {
            const cur = turns[turns.length - 1];
            if (cur !== void 0) {
              cur.endTime = Number(ev?.time) || cur.endTime;
              cur.endSeq = Number(ev?.seq) || cur.endSeq;
            }
            continue;
          }
          if (type === "step/start") {
            step += 1;
            continue;
          }
          if (type === "user/message") {
            const cur = turns[turns.length - 1];
            const msg = ev?.data?.message ?? ev?.data;
            const text = messageText(msg);
            if (text !== "" && msg?.source?.kind === "user") {
              humans.push({ seq: Number(ev?.seq) || 0, turn: cur?.turn ?? 0, text: clip(text, TURN_TEXT_MAX) });
              if (cur !== void 0) {
                if (cur.input === "") {
                  cur.input = clip(text, TURN_TEXT_MAX);
                  qa += 1;
                  cur.qa = qa;
                } else {
                  cur.input = clip(cur.input + "\n\n" + text, TURN_TEXT_MAX);
                }
              }
            }
            continue;
          }
          if (type === "assistant/message") {
            const cur = turns[turns.length - 1];
            if (cur !== void 0) {
              const text = messageText(ev?.data?.message);
              if (text !== "") cur.output = clip(text, TURN_TEXT_MAX);
              addUsage(cur, ev?.data?.usage);
            }
            continue;
          }
          if (type === "tool/call") {
            const cur = turns[turns.length - 1];
            if (cur !== void 0) cur.tools += 1;
          }
          if (type !== "tool/call" && type !== "tool/result") continue;
          if (!(Number(ev.seq) > afterSeq)) continue;
          narrowed.push({ ...narrowOpsEvent(ev), turn, step, qa });
        }
        let lastQa = 0;
        for (const t of turns) {
          if (t.input !== "" && t.qa > 0) {
            lastQa = t.qa;
            continue;
          }
          if (t.qa === 0 && lastQa > 0) t.qa = lastQa;
        }
        const cap = 4e3;
        const window_ = narrowed.length > cap ? narrowed.slice(narrowed.length - cap) : narrowed;
        const total = turns.reduce((acc, t) => ({
          input: acc.input + t.usage.input,
          output: acc.output + t.usage.output,
          cacheRead: acc.cacheRead + t.usage.cacheRead,
          cacheWrite: acc.cacheWrite + t.usage.cacheWrite,
          reasoning: acc.reasoning + t.usage.reasoning,
          total: acc.total + t.usage.total,
          calls: acc.calls + t.usage.calls,
          tools: acc.tools + t.tools
        }), { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, total: 0, calls: 0, tools: 0 });
        json(res, 200, {
          events: window_,
          turns: turns.slice(-200),
          ...body.debug === true ? { debug: { humans: humans.slice(-12), turns: turns.slice(-12).map((t) => ({ turn: t.turn, qa: t.qa, startSeq: t.startSeq, endSeq: t.endSeq, inputLen: t.input.length, outputLen: t.output.length, tools: t.tools })) } } : {},
          total: { ...total, turns: turns.length },
          lastSeq: window_.length > 0 ? Number(window_[window_.length - 1]?.seq) : Math.max(afterSeq, 0),
          live: true
        });
      } catch (err) {
        json(res, 500, { events: [], lastSeq: 0, live: false, error: String(err) });
      }
    }
  });
  webServer.register({
    kind: "exact",
    path: "/api/worktable/subagent-live",
    handler: async (req, res) => {
      try {
        if (req.method !== "POST") {
          res.writeHead(405);
          res.end();
          return;
        }
        const body = await readJsonBody(req);
        const rootSessionId = typeof body.rootSessionId === "string" ? body.rootSessionId : "";
        if (rootSessionId === "") {
          json(res, 400, { live: {}, error: "missing rootSessionId" });
          return;
        }
        const subagents = typeof ctx.get === "function" ? ctx.get("subagents") : void 0;
        if (subagents === void 0 || subagents === null || typeof subagents.listDescendants !== "function") {
          json(res, 200, { live: {}, unavailable: true });
          return;
        }
        let descendants = [];
        try {
          descendants = await subagents.listDescendants(rootSessionId);
        } catch {
          descendants = [];
        }
        const live = {};
        for (const entry of Array.isArray(descendants) ? descendants : []) {
          if (entry?.kind !== "child" || entry?.activity !== "running") continue;
          if (typeof entry?.label === "string" && entry.label.startsWith("Side: ")) continue;
          try {
            const activity = lastActivityOf(ctx.sessions?.get?.(entry.id)?.snapshotEvents?.() ?? []);
            if (activity.text !== void 0 || activity.tool !== void 0) live[String(entry.id)] = activity;
          } catch {
          }
        }
        json(res, 200, { live });
      } catch (err) {
        json(res, 500, { live: {}, error: String(err) });
      }
    }
  });
  webServer.register({
    kind: "exact",
    path: "/api/worktable/job-output",
    handler: async (req, res) => {
      try {
        if (req.method !== "POST") {
          res.writeHead(405);
          res.end();
          return;
        }
        const body = await readJsonBody(req);
        const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
        const jobId = typeof body.jobId === "string" ? body.jobId.trim() : "";
        if (!sessionId || !jobId) {
          json(res, 400, { text: "", read: false, calls: 0, error: "missing sessionId/jobId" });
          return;
        }
        let all;
        try {
          all = ctx.sessions?.get?.(sessionId)?.snapshotEvents?.();
        } catch {
          all = void 0;
        }
        if (all === void 0) {
          json(res, 200, { text: "", read: false, calls: 0, live: false });
          return;
        }
        const texts = [];
        let calls = 0;
        const pending = /* @__PURE__ */ new Map();
        for (const ev of all) {
          if (ev?.type === "tool/call") {
            const d = ev.data ?? {};
            if (typeof d.name !== "string" || !/^job_output$/i.test(d.name)) continue;
            let args = {};
            try {
              args = typeof d.arguments === "string" ? JSON.parse(d.arguments) : d.arguments ?? {};
            } catch {
              args = {};
            }
            const id = typeof args?.job_id === "string" ? args.job_id : typeof args?.jobId === "string" ? args.jobId : "";
            if (id !== jobId) continue;
            calls += 1;
            if (typeof d.callId === "string") pending.set(d.callId, true);
            continue;
          }
          if (ev?.type !== "tool/result") continue;
          const message = ev?.data?.message ?? {};
          const callId = message?.source?.callId;
          if (typeof callId !== "string" || pending.get(callId) !== true) continue;
          pending.delete(callId);
          const blocks = Array.isArray(message.content) ? message.content : [];
          for (const block of blocks) {
            if (block === null || typeof block !== "object" || block.type !== "tool-result") continue;
            if (block.isError === true) continue;
            const inner = Array.isArray(block.content) ? block.content : [];
            const parts = [];
            for (const item of inner) {
              if (item !== null && typeof item === "object" && item.type === "text" && typeof item.text === "string") parts.push(item.text);
            }
            if (parts.length > 0) texts.push(parts.join("\n"));
          }
        }
        const joined = texts.join("\n\n");
        const limited = joined.slice(0, OPS_TEXT_MAX);
        json(res, 200, {
          text: limited,
          truncated: joined.length > limited.length,
          read: texts.length > 0,
          calls,
          live: true
        });
      } catch (err) {
        json(res, 500, { text: "", read: false, calls: 0, error: String(err) });
      }
    }
  });
  webServer.register({
    kind: "exact",
    path: "/api/worktable/job-kill",
    handler: async (req, res) => {
      try {
        if (req.method !== "POST") {
          res.writeHead(405);
          res.end();
          return;
        }
        const body = await readJsonBody(req);
        const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
        const jobId = typeof body.jobId === "string" ? body.jobId.trim() : "";
        const reason = typeof body.reason === "string" && body.reason !== "" ? body.reason : "stopped from dsh-mytable";
        if (!jobId) {
          json(res, 200, { ok: false, output: "missing jobId" });
          return;
        }
        const registry = typeof ctx.get === "function" ? ctx.get("jobs") : void 0;
        if (registry === void 0 || registry === null || typeof registry.kill !== "function") {
          json(res, 200, { ok: false, output: "jobs-unavailable" });
          return;
        }
        const agents = typeof ctx.get === "function" ? ctx.get("agents") : void 0;
        const caller = sessionId !== "" && agents !== void 0 && agents !== null && typeof agents.get === "function" ? agents.get(sessionId) : void 0;
        if (caller === void 0 && sessionId !== "") {
          json(res, 200, { ok: false, output: "agent-not-live" });
          return;
        }
        const outcome = registry.kill(jobId, caller, reason);
        json(res, 200, { ok: true, outcome: String(outcome) });
      } catch (err) {
        json(res, 500, { ok: false, output: String(err) });
      }
    }
  });
  const gitAction = async (req, res, run) => {
    try {
      if (req.method !== "POST") {
        res.writeHead(405);
        res.end();
        return;
      }
      const body = await readJsonBody(req);
      const cwd = typeof body.cwd === "string" && body.cwd ? body.cwd : serverCwd(ctx, body.sessionId, void 0);
      const root = (typeof body.repo === "string" && body.repo ? pathResolve(body.repo) : null) ?? await gitRootOf(pathResolve(cwd));
      if (root === null) {
        json(res, 200, { ok: false, output: "not a git repository" });
        return;
      }
      json(res, 200, await run(root, body));
    } catch (err) {
      json(res, 500, { ok: false, output: String(err) });
    }
  };
  webServer.register({
    kind: "exact",
    path: "/api/worktable/git-stage",
    handler: (req, res) => gitAction(req, res, async (root, body) => {
      const rel = typeof body.path === "string" && body.path ? body.path : "";
      return gitRun(root, rel !== "" ? ["add", "--", rel] : ["add", "-A"]);
    })
  });
  webServer.register({
    kind: "exact",
    path: "/api/worktable/git-unstage",
    handler: (req, res) => gitAction(req, res, async (root, body) => {
      const rel = typeof body.path === "string" && body.path ? body.path : "";
      const hasHead = await gitExec(["rev-parse", "--verify", "HEAD"], root).then(() => true).catch(() => false);
      if (hasHead) return gitRun(root, rel !== "" ? ["reset", "-q", "HEAD", "--", rel] : ["reset", "-q", "HEAD"]);
      return gitRun(root, rel !== "" ? ["rm", "--cached", "-q", "--", rel] : ["rm", "--cached", "-r", "-q", "--", "."]);
    })
  });
  webServer.register({
    kind: "exact",
    path: "/api/worktable/git-discard",
    handler: (req, res) => gitAction(req, res, async (root, body) => {
      const rel = typeof body.path === "string" && body.path ? body.path : "";
      if (rel === "") return { ok: false, output: "missing path" };
      const untracked = typeof body.untracked === "boolean" ? body.untracked : false;
      if (untracked) {
        try {
          await import("node:fs/promises").then((m) => m.rm(pathResolve(root, rel), { force: true }));
          return { ok: true, output: "removed " + rel };
        } catch (err) {
          return { ok: false, output: String(err) };
        }
      }
      return gitRun(root, ["checkout", "--", rel]);
    })
  });
  webServer.register({
    kind: "exact",
    path: "/api/worktable/git-commit",
    handler: (req, res) => gitAction(req, res, async (root, body) => {
      const message = typeof body.message === "string" ? body.message.trim() : "";
      if (message === "") return { ok: false, output: "missing message" };
      return gitRun(root, ["commit", "-m", message]);
    })
  });
  webServer.register({
    kind: "exact",
    path: "/api/worktable/git-branches",
    handler: async (req, res) => {
      try {
        if (req.method !== "POST") {
          res.writeHead(405);
          res.end();
          return;
        }
        const body = await readJsonBody(req);
        const cwd = typeof body.cwd === "string" && body.cwd ? body.cwd : serverCwd(ctx, body.sessionId, void 0);
        const root = (typeof body.repo === "string" && body.repo ? pathResolve(body.repo) : null) ?? await gitRootOf(pathResolve(cwd));
        if (root === null) {
          json(res, 200, { isRepo: false, root: pathResolve(cwd), branch: "", branches: [] });
          return;
        }
        const info = await branchNamesOf(root);
        json(res, 200, { isRepo: true, root, branch: info.current, branches: info.names });
      } catch (err) {
        json(res, 500, { isRepo: false, root: "", branch: "", branches: [], error: String(err) });
      }
    }
  });
  webServer.register({
    kind: "exact",
    path: "/api/worktable/git-checkout",
    handler: (req, res) => gitAction(req, res, async (root, body) => {
      const branch = typeof body.branch === "string" ? body.branch.trim() : "";
      if (branch === "") return { ok: false, output: "missing branch" };
      if (branch.startsWith("-") || /[\s\u0000]/.test(branch)) return { ok: false, output: "invalid branch name: " + branch };
      const known = await branchNamesOf(root);
      if (!known.names.includes(branch)) return { ok: false, output: "no such local branch: " + branch };
      return gitRun(root, ["checkout", branch]);
    })
  });
  webServer.register({
    kind: "exact",
    path: "/api/worktable/git-log",
    handler: async (req, res) => {
      try {
        if (req.method !== "POST") {
          res.writeHead(405);
          res.end();
          return;
        }
        const body = await readJsonBody(req);
        const cwd = typeof body.cwd === "string" && body.cwd ? body.cwd : serverCwd(ctx, body.sessionId, void 0);
        const root = (typeof body.repo === "string" && body.repo ? pathResolve(body.repo) : null) ?? await gitRootOf(pathResolve(cwd));
        if (root === null) {
          json(res, 200, { isRepo: false, root: pathResolve(cwd), commits: [] });
          return;
        }
        const limit = Math.min(200, Math.max(1, Number(body.limit) || 30));
        const skip = Math.max(0, Number(body.skip) || 0);
        json(res, 200, await gitLogPage(root, limit, skip));
      } catch (err) {
        json(res, 500, { isRepo: false, root: "", commits: [], error: String(err) });
      }
    }
  });
  webServer.register({
    kind: "exact",
    path: "/api/worktable/git-show",
    handler: (req, res) => gitAction(req, res, async (root, body) => {
      const hash = typeof body.hash === "string" ? body.hash.trim() : "";
      if (hash === "") return { ok: false, output: "missing hash" };
      const out = await gitRun(root, ["show", "--no-ext-diff", "--no-color", "--format=", "-U3", "-m", "--first-parent", hash]);
      return out.ok ? { ok: true, output: out.output.slice(0, DIFF_MAX_BYTES_TOTAL) } : out;
    })
  });
  webServer.register({
    kind: "exact",
    path: "/api/worktable/git-blob",
    handler: (req, res) => gitAction(req, res, async (root, body) => {
      const rel = typeof body.rel === "string" ? body.rel.trim() : "";
      const rev = typeof body.rev === "string" && body.rev !== "" ? body.rev : "";
      if (rel === "") return { ok: false, output: "missing rel" };
      const out = await gitRun(root, ["show", rev === "" ? `:${rel}` : `${rev}:${rel}`]);
      return out.ok ? { ok: true, output: out.output.slice(0, 4 * 1024 * 1024) } : out;
    })
  });
  webServer.register({
    kind: "exact",
    path: "/api/worktable/workspaces",
    handler: async (_req, res) => {
      try {
        let registry = null;
        try {
          registry = ctx.workspaceRegistry ?? null;
        } catch {
        }
        if (!registry) {
          try {
            registry = ctx.get?.("workspaceRegistry") ?? null;
          } catch {
          }
        }
        if (registry && typeof registry.list === "function") {
          const list = registry.list() ?? [];
          const workspaceIds = [];
          const tables = {};
          for (const ws of list) {
            const id = String(ws?.id ?? "");
            if (!id) continue;
            workspaceIds.push(id);
            tables[id] = {
              title: typeof ws?.title === "string" ? ws.title : void 0,
              sessionIds: Array.isArray(ws?.sessionIds) ? ws.sessionIds.map(String) : []
            };
          }
          let archived = [];
          try {
            archived = (registry.archivedSessionIds ?? []).map(String);
          } catch {
          }
          json(res, 200, {
            unit: { name: "workspace", version: 2 },
            global: { initialized: true, workspaceIds, archivedSessionIds: archived },
            tables: { workspaces: tables }
          });
          return;
        }
        const file = pathResolve(resolveDshHomeSafe(), "storages", "workspace.json");
        const raw = await readFile(file, "utf8");
        json(res, 200, JSON.parse(raw.charCodeAt(0) === 65279 ? raw.slice(1) : raw));
      } catch (err) {
        json(res, 404, { error: String(err) });
      }
    }
  });
  webServer.register({
    kind: "exact",
    path: "/api/worktable/write",
    handler: async (req, res) => {
      try {
        if (req.method !== "POST") {
          res.writeHead(405);
          res.end();
          return;
        }
        const body = await readJsonBody(req);
        const p = typeof body.path === "string" ? body.path : "";
        const content = typeof body.content === "string" ? body.content : "";
        if (!p) {
          json(res, 400, { error: "missing path" });
          return;
        }
        if (content.length > 20 * 1024 * 1024) {
          json(res, 413, { error: "content too large" });
          return;
        }
        const abs = pathResolve(p);
        const base64 = body.encoding === "base64";
        const data = base64 ? Buffer.from(content, "base64") : content;
        await import("node:fs/promises").then((m) => m.writeFile(abs, data, base64 ? void 0 : "utf8"));
        json(res, 200, { ok: true, bytes: base64 ? data.length : Buffer.byteLength(content, "utf8") });
      } catch (err) {
        json(res, 500, { error: String(err) });
      }
    }
  });
  webServer.register({
    kind: "exact",
    path: "/api/worktable/mkdir",
    handler: async (req, res) => {
      try {
        if (req.method !== "POST") {
          res.writeHead(405);
          res.end();
          return;
        }
        const body = await readJsonBody(req);
        const p = typeof body.path === "string" ? body.path.trim() : "";
        if (!p) {
          json(res, 400, { error: "missing path" });
          return;
        }
        const abs = pathResolve(p);
        const fsx = await import("node:fs/promises");
        const parent = dirname(abs);
        try {
          await fsx.access(parent);
        } catch {
          json(res, 400, { error: "parent not found" });
          return;
        }
        await fsx.mkdir(abs);
        json(res, 200, { ok: true, path: abs });
      } catch (err) {
        json(res, err?.code === "EEXIST" ? 200 : 500, err?.code === "EEXIST" ? { ok: true, exists: true } : { error: String(err) });
      }
    }
  });
  webServer.register({
    kind: "exact",
    path: "/api/worktable/git",
    handler: async (req, res) => {
      const body = await readJsonBody(req);
      const cwd = serverCwd(ctx, body.sessionId, body.cwd);
      json(res, 200, await gitStatus(cwd));
    }
  });
  setupTerminal(webServer, ctx);
}
export {
  BROWSER_PROBE_PATH,
  HEALTH_PATH,
  __wtLoadProbeStats,
  apply,
  inject,
  name
};
