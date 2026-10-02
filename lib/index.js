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

// node_modules/@deepseek-ai/dsh-typert-protocol/lib/index.js
import { Service } from "@deepseek-ai/cordis";
var TYPERT_REMOTE_SEGMENT_PATTERN = /^[A-Za-z0-9_$.-]+$/;
function isTypertRemoteSegment(value) {
  return value !== "." && value !== ".." && TYPERT_REMOTE_SEGMENT_PATTERN.test(value);
}
var REMOTE_METHOD_DESCRIPTOR = "@deepseek-ai/dsh-typert-protocol/remote-methods";
function bindTypertRemote(service, serviceKey, options = {}) {
  validateName("service key", serviceKey);
  const namespace = options.namespace ?? serviceKey;
  validateName("namespace", namespace);
  return Object.freeze({
    service,
    serviceKey,
    namespace
  });
}
var TypertRemoteService = class extends Service {
  /** Visible binding consumed by the Gateway's source-mode discovery. */
  typertRemote;
  /**
  * Register the Service and bind the same key to Typert Gateway.
  * @param ctx - owning Cordis Context.
  * @param serviceKey - exact Cordis service key and default wire namespace.
  * @param options - optional distinct wire namespace.
  */
  constructor(ctx, serviceKey, options = {}) {
    super(ctx, serviceKey);
    this.typertRemote = bindTypertRemote(this, this.name, options);
  }
};
function Remote(methodExportOrOptions, context) {
  if (typeof methodExportOrOptions === "string") {
    validateName("Remote export name", methodExportOrOptions);
    return remoteDecorator({ kind: "direct" }, void 0, methodExportOrOptions);
  }
  if (typeof methodExportOrOptions === "object") {
    if (remoteOptionMode(methodExportOrOptions) !== "stream" || Reflect.ownKeys(methodExportOrOptions).length !== 1) throw new TypeError('typert-protocol: Remote options must contain exactly mode: "stream"');
    return remoteDecorator({ kind: "direct" }, "stream");
  }
  if (context === void 0) throw new TypeError("typert-protocol: Remote decorator context is missing");
  addMarkerInitializer(context, { kind: "direct" });
}
function remoteOptionMode(options) {
  return Reflect.get(options, "mode");
}
function remoteDecorator(invocation, mode, exportName) {
  return function(_method, context) {
    addMarkerInitializer(context, invocation, mode, exportName);
  };
}
function readRemoteMethodDescriptor(prototype) {
  const property = Object.getOwnPropertyDescriptor(prototype, REMOTE_METHOD_DESCRIPTOR);
  if (property === void 0) return void 0;
  const descriptor = property.value;
  if (descriptor === null || typeof descriptor !== "object") throw new TypeError("typert-protocol: Remote method descriptor must be an object");
  const version = Reflect.get(descriptor, "version");
  if (version !== 1) throw new TypeError(`typert-protocol: unsupported Remote method descriptor version ${String(version)}`);
  const methods = Reflect.get(descriptor, "methods");
  if (!Array.isArray(methods)) throw new TypeError("typert-protocol: Remote method descriptor methods must be an array");
  return descriptor;
}
function addMarkerInitializer(context, invocation, mode, exportName) {
  if (context.private || context.static || typeof context.name !== "string") throw new TypeError("typert-protocol: Remote decorators require a public instance method with a string name");
  const method = context.name;
  context.addInitializer(function() {
    const prototype = Object.getPrototypeOf(this);
    if (prototype === null) throw new TypeError(`typert-protocol: cannot mark Remote method "${method}" on an object without a prototype`);
    mark(prototype, method, invocation, mode, exportName);
  });
}
function mark(prototype, method, invocation, mode, exportName) {
  const descriptor = readRemoteMethodDescriptor(prototype);
  const marker = Object.freeze({
    method,
    ...exportName === void 0 || exportName === method ? {} : { exportName },
    ...mode === void 0 ? {} : { mode },
    invocation: Object.freeze(invocation)
  });
  const current = descriptor?.methods.find((candidate) => candidate.method === method);
  if (current !== void 0) {
    if (current.exportName === marker.exportName && current.mode === marker.mode && sameInvocation(current.invocation, invocation)) return;
    throw new Error(`typert-protocol: Remote method "${method}" has conflicting invocation markers`);
  }
  Object.defineProperty(prototype, REMOTE_METHOD_DESCRIPTOR, {
    configurable: true,
    value: Object.freeze({
      version: 1,
      methods: Object.freeze([...descriptor?.methods ?? [], marker])
    })
  });
}
function sameInvocation(left, right) {
  if (left.kind === "direct") return right.kind === "direct";
  if (right.kind === "direct") return false;
  return left.context === right.context;
}
function validateName(subject, value) {
  if (!isTypertRemoteSegment(value)) throw new TypeError(`typert-protocol: ${subject} must contain only RPC endpoint segment characters`);
}

// node_modules/dsh-flowglass/flowglass/lib/index.js
var TOOLBOX_RUNTIME_OVERRIDES = {
  "mode": "static-bundle",
  "bundleId": "flow",
  "displayName": "\u6D41\u955C",
  "registryService": "toolboxRegistryFlow",
  "artifactService": "toolboxArtifactsFlow",
  "remoteService": "toolboxNativeFlow",
  "remoteNamespace": "toolboxNativeFlow",
  "rpcPrefix": "toolbox.flow",
  "storagePrefix": "dsh.toolbox.flow",
  "eventPrefix": "tb-flow",
  "slotPrefix": "toolbox-flow",
  "domId": "flow",
  "hostIdPrefix": "toolbox-host-flow",
  "dataDir": ".dsh-dynamic-toolbox",
  "capabilities": {
    "diskReload": false,
    "rebuildFromDisk": false,
    "pluginDefaults": false,
    "pluginRestart": false,
    "aiUsage": false,
    "managePlugins": false
  }
};
var TOOLBOX_RUNTIME = (() => {
  const o = typeof TOOLBOX_RUNTIME_OVERRIDES !== "undefined" && TOOLBOX_RUNTIME_OVERRIDES || {};
  const mode = o.mode || "dynamic-dev";
  const bundleId = o.bundleId || "dynamic";
  const rpcPrefix = o.rpcPrefix || "toolbox";
  const storagePrefix = o.storagePrefix || "dsh.toolbox";
  const eventPrefix = o.eventPrefix || "tb";
  const slotPrefix = o.slotPrefix || "toolbox";
  return Object.freeze({
    mode,
    // 'dynamic-dev' | 'static-bundle'
    bundleId,
    // 动态模式恒为 'dynamic'；静态安装包为 bundleId（如 'flow-plus'）
    displayName: o.displayName || "\u5DE5\u5177\u7BB1",
    registryService: o.registryService || "toolboxRegistry",
    artifactService: o.artifactService || null,
    remoteService: o.remoteService || null,
    remoteNamespace: o.remoteNamespace || null,
    rpcPrefix,
    // 动态 'toolbox'；编译 'toolbox.<bundleId>' → rpc('tools') = '<prefix>/tools'
    storagePrefix,
    // 动态 'dsh.toolbox'；编译 'dsh.toolbox.<bundleId>'
    eventPrefix,
    // 动态 'tb'；编译 'tb-<bundleId>' → event('session-changed')
    slotPrefix,
    // 动态 'toolbox'；编译 'toolbox-<bundleId>' → slot('entry') / slot('drawer')
    domId: o.domId || "dynamic",
    // DOM marker 命名值；动态恒 'dynamic'
    hostIdPrefix: o.hostIdPrefix || "toolbox-host",
    dataDir: o.dataDir || ".dsh-dynamic-toolbox",
    capabilities: Object.freeze(Object.assign({
      diskReload: mode === "dynamic-dev",
      rebuildFromDisk: mode === "dynamic-dev",
      pluginDefaults: true,
      pluginRestart: true,
      aiUsage: true,
      managePlugins: true
    }, o.capabilities || {})),
    // ---- 命名辅助（前缀已由构建器归一化，拼接即得最终名）----
    rpc: (suffix) => rpcPrefix + "/" + suffix,
    storageKey: (suffix) => storagePrefix + "." + suffix,
    event: (suffix) => eventPrefix + "-" + suffix,
    slot: (name2) => slotPrefix + "-" + name2,
    // DOM 标记值：动态默认保持历史值（mounted="1"、entry=""），编译模式用 bundleId 区分多 bundle
    domValue: () => bundleId === "dynamic" ? "" : bundleId,
    domMountedValue: () => bundleId === "dynamic" ? "1" : bundleId,
    logTag: () => bundleId === "dynamic" ? "[toolbox]" : "[toolbox:" + bundleId + "]"
  });
})();
var makeStaticRegistry = () => {
  const entries = /* @__PURE__ */ new Map();
  return {
    register(desc, handler) {
      if (!desc || typeof desc.id !== "string" || !desc.id || typeof handler !== "function") return () => {
      };
      const entry = { id: desc.id, label: desc.label || desc.id, order: typeof desc.order === "number" ? desc.order : 0, icon: desc.icon || null, handler };
      entries.set(desc.id, entry);
      return () => {
        if (entries.get(desc.id) === entry) entries.delete(desc.id);
      };
    },
    tools() {
      return [...entries.values()].sort((a, b) => a.order - b.order).map((x) => ({ id: x.id, label: x.label, order: x.order, icon: x.icon || null }));
    },
    async panel(root, call) {
      const toolId = call && typeof call.tool === "string" ? call.tool : "";
      const entry = entries.get(toolId);
      if (!entry) return { ok: false, error: "\u5DE5\u5177\u672A\u6CE8\u518C: " + (toolId || "(\u7A7A)") };
      try {
        const res = await entry.handler({
          action: call && typeof call.action === "string" ? call.action : "",
          fields: call && call.fields && typeof call.fields === "object" ? call.fields : {},
          state: call && call.state || null,
          root: typeof root === "string" && root ? root : void 0,
          session: call && typeof call.session === "string" && call.session ? call.session : void 0
        });
        if (!res || typeof res.html !== "string") return { ok: false, error: "\u5DE5\u5177\u8FD4\u56DE\u4E86\u65E0\u6548\u9762\u677F\u5185\u5BB9" };
        const out = { ok: true, html: res.html, state: res.state == null ? null : res.state };
        if (typeof res.copy === "string" && res.copy) out.copy = res.copy;
        if (res.navigateSession && typeof res.navigateSession === "object" && typeof res.navigateSession.sessionId === "string") {
          out.navigateSession = {
            sessionId: res.navigateSession.sessionId,
            ...typeof res.navigateSession.parentSessionId === "string" ? { parentSessionId: res.navigateSession.parentSessionId } : {},
            ...res.navigateSession.kind === "subagent" || res.navigateSession.kind === "session" ? { kind: res.navigateSession.kind } : {}
          };
        }
        if (res.flowContext && typeof res.flowContext === "object" && typeof res.flowContext.text === "string") {
          out.flowContext = {
            text: res.flowContext.text,
            ...typeof res.flowContext.sourceSessionId === "string" ? { sourceSessionId: res.flowContext.sourceSessionId } : {},
            ...Array.isArray(res.flowContext.seqs) ? { seqs: res.flowContext.seqs.filter((v) => typeof v === "number") } : {}
          };
        }
        return out;
      } catch (error) {
        return { ok: false, error: String(error && error.message || error) };
      }
    }
  };
};
var esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
var fmtSize = (n) => {
  if (n == null) return "";
  const b = Number(n);
  if (b < 1024) return b + " B";
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
  return (b / (1024 * 1024)).toFixed(1) + " MB";
};
var tryRegisterTool = (ctx, desc, handler) => {
  let off = null;
  let regSeen = null;
  const once = () => {
    let reg;
    try {
      reg = ctx.get(TOOLBOX_RUNTIME.registryService);
    } catch (e) {
      return;
    }
    if (!reg || typeof reg.register !== "function") return;
    if (reg === regSeen && off) return;
    if (off) {
      try {
        off();
      } catch (e) {
      }
      off = null;
    }
    try {
      const d = reg.register({ id: desc.id, label: desc.label, order: desc.order, icon: desc.icon || null }, handler);
      off = () => {
        try {
          d();
        } catch (e) {
        }
      };
      regSeen = reg;
    } catch (e) {
    }
  };
  once();
  let ivSlow = null;
  const ivFast = ctx.interval(() => {
    const had = off;
    once();
    if (!had && off && !ivSlow) {
      try {
        ivFast();
      } catch (e) {
      }
      ivSlow = ctx.interval(once, 2e3);
      ctx.effect(() => {
        if (ivSlow) ivSlow();
      });
    }
  }, 500);
  ctx.effect(() => ivFast);
  ctx.effect(() => () => {
    if (off) off();
  });
};
var makeSessionLogReader = (ctx, sq) => {
  let cache = null;
  return async (sid) => {
    const sessionsSvc = ctx.get("sessions");
    if (sessionsSvc) {
      try {
        const live = sessionsSvc.get(sid);
        if (live && typeof live.snapshotEvents === "function") {
          const seq = typeof live.seq === "number" && Number.isSafeInteger(live.seq) ? live.seq : null;
          if (seq != null && cache && cache.sid === sid && cache.count === seq) {
            return { events: cache.events, header: cache.header, count: cache.count, changed: false };
          }
          const events2 = live.snapshotEvents();
          if (Array.isArray(events2)) {
            const count = events2.length;
            const hit2 = cache && cache.sid === sid && cache.count === count;
            if (!hit2) cache = { sid, count, events: events2, header: live.header };
            return { events: cache.events, header: cache.header, count: cache.count, changed: !hit2 };
          }
        }
        if (live && live.events && typeof live.events.length === "number") {
          const hit2 = cache && cache.sid === sid && cache.count === live.events.length;
          if (!hit2) cache = { sid, count: live.events.length, events: live.events, header: live.header };
          return { events: cache.events, header: cache.header, count: cache.count, changed: !hit2 };
        }
      } catch (e) {
      }
    }
    const sp2 = ctx.get("sessionPersistence");
    if (sp2 && cache && cache.sid === sid && cache.events) {
      try {
        const inc = await sp2.readFrom(sid, cache.count);
        const add = inc && inc.events || [];
        if (add.length === 0) return { events: cache.events, header: cache.header, count: cache.count, changed: false };
        cache = { sid, count: cache.count + add.length, events: cache.events.concat(add), header: inc && inc.meta || cache.header };
        return { events: cache.events, header: cache.header, count: cache.count, changed: true };
      } catch (e) {
      }
    }
    const snap = await sq.readSession(sid);
    const events = snap && snap.events || [];
    const header = snap && snap.session || null;
    const hit = cache && cache.sid === sid && cache.count === events.length;
    if (!hit) cache = { sid, count: events.length, events, header };
    return { events: cache.events, header: cache.header, count: cache.count, changed: !hit };
  };
};
var _repoCache = null;
var findRepoRoot = async (ctx) => {
  if (typeof TOOLBOX_RUNTIME !== "undefined" && TOOLBOX_RUNTIME.mode === "static-bundle") return null;
  if (_repoCache) return _repoCache;
  const fsService = ctx.get("fs");
  if (!fsService) return null;
  const roots = [];
  const sp = ctx.get("sandboxPolicy");
  if (sp && typeof sp.workspaceRoot === "string" && sp.workspaceRoot) roots.push(sp.workspaceRoot);
  const ss = ctx.get("sessions");
  if (ss) {
    try {
      for (const s of ss.list()) {
        const c = s && s.header && s.header.cwd;
        if (typeof c === "string" && c && roots.indexOf(c) < 0) roots.push(c);
      }
    } catch (e) {
    }
  }
  const hasManifest = async (dir) => {
    try {
      const t = await fsService.resolve("plugins.json", { cwd: dir });
      if (!await fsService.stat(t)) return null;
      const parsed = JSON.parse(await fsService.readText(t));
      if (!parsed || !Array.isArray(parsed.plugins)) return null;
      if (!parsed.plugins.some((e) => e && e.id === "toolbox")) return null;
      return dir.replace(/[\\/]+$/, "");
    } catch (e) {
      return null;
    }
  };
  for (const root of roots) {
    const hit = await hasManifest(root);
    if (hit) {
      _repoCache = hit;
      return hit;
    }
  }
  for (const root of roots) {
    try {
      const dt = await fsService.resolve(".", { cwd: root });
      const entries = await fsService.listDir(dt);
      for (const ent of entries || []) {
        if (!ent || ent.type !== "directory" || !ent.name) continue;
        if (ent.name.charAt(0) === "." || ent.name === "node_modules") continue;
        const sub = root.replace(/[\\/]+$/, "") + "/" + ent.name;
        const hit = await hasManifest(sub);
        if (hit) {
          _repoCache = hit;
          return hit;
        }
      }
    } catch (e) {
    }
  }
  return null;
};
var findManifest = async (ctx) => {
  const fs = ctx.get("fs");
  if (!fs) return null;
  const root = await findRepoRoot(ctx);
  if (!root) return null;
  try {
    const t = await fs.resolve("plugins.json", { cwd: root });
    if (await fs.stat(t)) return { manifest: JSON.parse(await fs.readText(t)), root };
  } catch (e) {
  }
  return null;
};
var create_flow = () => {
  return {
    name: "flow-tool",
    inject: ["fs", "sessionQuery", "timer"],
    apply(ctx) {
      const sq = ctx.get("sessionQuery");
      const fs = ctx.get("fs");
      const readers = {};
      const growth = {};
      const readLog = async (sid) => {
        if (!sq) return { events: [], count: 0 };
        if (!readers[sid]) readers[sid] = makeSessionLogReader(ctx, sq);
        try {
          return await readers[sid](sid);
        } catch (e) {
          return { events: [], count: 0 };
        }
      };
      let manifestTools = null;
      const loadManifestTools = async () => {
        if (manifestTools) return;
        manifestTools = [];
        try {
          const found = await findManifest(ctx);
          const list = found && found.manifest && Array.isArray(found.manifest.plugins) ? found.manifest.plugins : [];
          for (const e of list) {
            if (e && Array.isArray(e.modelTools)) {
              for (const n of e.modelTools) if (typeof n === "string" && n) manifestTools.push(n);
            }
          }
        } catch (e) {
        }
      };
      const RE_SKILL = /^skill$/;
      const RE_MCP = /mcp/i;
      const RE_SUBAGENT = /^(subagent|subagent_fork|send_message|workflow|ralph)$/;
      const RE_SHELL = /^(pwsh|bash|sh|terminal_(open|send|read|close|list|signal)|run_code)$/;
      const RE_FILE = /^(read|write|edit|glob|grep|read_image)$/;
      const kindOf = (name2) => {
        if (/^cordis_/.test(name2)) return "cordis";
        if (/^ssh_/.test(name2)) return "cordis";
        if (manifestTools && manifestTools.indexOf(name2) >= 0) return "cordis";
        if (RE_SKILL.test(name2)) return "skill";
        if (RE_MCP.test(name2)) return "mcp";
        if (RE_SUBAGENT.test(name2)) return "subagent";
        if (RE_SHELL.test(name2)) return "shell";
        if (RE_FILE.test(name2)) return "file";
        return "builtin";
      };
      const KIND_META = {
        skill: { label: "\u6280\u80FD", color: "#7fa7f0", bg: "rgba(91,141,239,.12)" },
        cordis: { label: "\u63D2\u4EF6", color: "#d4b95c", bg: "rgba(212,167,44,.10)" },
        mcp: { label: "MCP", color: "#81c784", bg: "rgba(102,187,106,.10)" },
        shell: { label: "\u547D\u4EE4", color: "#d4b95c", bg: "rgba(212,167,44,.08)" },
        file: { label: "\u6587\u4EF6", color: "#7fa7f0", bg: "rgba(91,141,239,.10)" },
        builtin: { label: "\u5185\u7F6E", color: "#9a9ba6", bg: "rgba(138,139,150,.10)" }
      };
      const pad2 = (n) => (n < 10 ? "0" : "") + n;
      const fmtTime = (t) => {
        const d = new Date(t);
        if (isNaN(d.getTime())) return "";
        return pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds());
      };
      const fmtDur = (ms) => ms == null ? "" : ms < 1e3 ? ms + "ms" : (ms / 1e3).toFixed(1) + "s";
      const oneLine = (s, max) => {
        const t = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
        return t.length > max ? t.slice(0, max - 1) + "\u2026" : t;
      };
      const textOf = (blocks) => {
        if (!Array.isArray(blocks)) return "";
        return blocks.map((b) => b && b.type === "text" ? b.text : "").filter(Boolean).join("\n");
      };
      const expandStreamRecords = (stream) => {
        const out = [];
        if (!Array.isArray(stream)) return out;
        for (const rec of stream) {
          if (!rec || typeof rec !== "object") continue;
          if (rec.type === "chunk") {
            if (rec.chunk && typeof rec.chunk === "object") out.push({ time: rec.time, chunk: rec.chunk });
          } else if (rec.type === "text-chunks" || rec.type === "reasoning-chunks") {
            const texts = Array.isArray(rec.texts) ? rec.texts : [];
            let t = typeof rec.time0 === "number" ? rec.time0 : 0;
            for (let i = 0; i < texts.length; i++) {
              if (i > 0 && Array.isArray(rec.dt)) t += typeof rec.dt[i - 1] === "number" ? rec.dt[i - 1] : 0;
              out.push({ time: t, chunk: { type: rec.type === "text-chunks" ? "text-delta" : "reasoning-delta", index: rec.index, text: String(texts[i]) } });
            }
          } else if (rec.type === "tool-call-chunks") {
            const args = Array.isArray(rec.args) ? rec.args : [];
            let t = typeof rec.time0 === "number" ? rec.time0 : 0;
            for (let i = 0; i < args.length; i++) {
              if (i > 0 && Array.isArray(rec.dt)) t += typeof rec.dt[i - 1] === "number" ? rec.dt[i - 1] : 0;
              out.push({ time: t, chunk: { type: "tool-call-delta", index: rec.index, id: rec.id, name: rec.name, argumentsDelta: String(args[i]) } });
            }
          }
        }
        return out;
      };
      const makeAttemptState = (attemptId, turn, step) => ({
        attemptId: String(attemptId || ""),
        turn,
        step,
        firstSeq: null,
        firstAt: null,
        lastAt: null,
        text: "",
        reasoning: "",
        toolCall: false,
        finishKind: "",
        failCode: "",
        failMsg: "",
        usage: null
      });
      const applyChunkToAttempt = (a, time, chunk) => {
        if (a.firstAt == null) a.firstAt = time;
        a.lastAt = time;
        if (!chunk || typeof chunk !== "object") return;
        if (chunk.type === "text-delta" && typeof chunk.text === "string") a.text += chunk.text;
        else if (chunk.type === "reasoning-delta" && typeof chunk.text === "string") a.reasoning += chunk.text;
        else if (chunk.type === "tool-call-delta") a.toolCall = true;
        else if (chunk.type === "usage" && chunk.usage) a.usage = chunk.usage;
        else if (chunk.type === "finish" && chunk.reason) {
          a.finishKind = String(chunk.reason.kind || "");
          const f = chunk.reason.failure;
          if (f && typeof f === "object") {
            a.failCode = typeof f.code === "string" ? f.code : "";
            a.failMsg = typeof f.message === "string" ? f.message : "";
          }
        }
      };
      const attemptFromSnapshot = (snap) => {
        const a = makeAttemptState(
          snap && snap.attemptId,
          snap && typeof snap.turn === "number" ? snap.turn : null,
          snap && typeof snap.step === "number" ? snap.step : null
        );
        if (!snap) return a;
        a.firstSeq = typeof snap.firstSeq === "number" ? snap.firstSeq : null;
        a.firstAt = typeof snap.firstAt === "number" ? snap.firstAt : null;
        a.lastAt = typeof snap.lastAt === "number" ? snap.lastAt : a.firstAt;
        a.text = String(snap.text || "").slice(0, 8e3);
        a.reasoning = String(snap.reasoning || "").slice(0, 8e3);
        a.toolCall = Boolean(snap.toolCall);
        if (snap.finish && typeof snap.finish === "object") {
          a.finishKind = String(snap.finish.kind || "");
          a.failCode = typeof snap.finish.code === "string" ? snap.finish.code : "";
          a.failMsg = typeof snap.finish.message === "string" ? snap.finish.message : "";
        }
        return a;
      };
      const parseItems = (events, live) => {
        const items = [];
        const byCallId = {};
        const stepStarts = {};
        const stepEnds = {};
        const turnEnds = {};
        const retriesByStep = {};
        const retryById = {};
        let route = "";
        let curTurn = null;
        const stepCards = /* @__PURE__ */ new Map();
        const stepKey = (turn, step) => String(turn) + ":" + step;
        const cardOf = (turn, step) => {
          const k = stepKey(turn, step);
          let c = stepCards.get(k);
          if (!c) {
            c = { key: k, turn, step, uiSeq: null, attempts: [], message: null, live: null };
            stepCards.set(k, c);
          }
          return c;
        };
        if (live && Array.isArray(live.attempts)) {
          for (const snap of live.attempts) {
            if (!snap || snap.attemptId == null) continue;
            const a = attemptFromSnapshot(snap);
            if (a.turn == null || a.step == null) continue;
            cardOf(a.turn, a.step).live = a;
          }
        }
        for (const ev of events) {
          if (!ev || typeof ev.seq !== "number") continue;
          const d = ev.data || {};
          if (ev.type === "turn/start") {
            if (typeof d.turn === "number") curTurn = d.turn;
            continue;
          }
          if (ev.type === "step/start") {
            const turn = typeof d.turn === "number" ? d.turn : curTurn;
            const step = typeof d.step === "number" ? d.step : 0;
            stepStarts[stepKey(turn, step)] = ev.time;
            cardOf(turn, step);
            continue;
          }
          if (ev.type === "step/end") {
            const turn = typeof d.turn === "number" ? d.turn : curTurn;
            const step = typeof d.step === "number" ? d.step : 0;
            stepEnds[stepKey(turn, step)] = ev.time;
            continue;
          }
          if (ev.type === "turn/end") {
            if (typeof d.turn === "number") turnEnds[d.turn] = ev.time;
            continue;
          }
          if (ev.type === "llm/retry") {
            const key = String(d.turn) + ":" + d.step;
            const f = d.failure || {};
            const entry = { retry: d.retry, maxRetries: d.maxRetries, delayMs: d.delayMs, code: typeof f.code === "string" ? f.code : "", message: typeof f.message === "string" ? f.message : "", time: ev.time, startedAt: 0 };
            (retriesByStep[key] || (retriesByStep[key] = [])).push(entry);
            if (typeof d.retryId === "string" && d.retryId) retryById[d.retryId] = entry;
            continue;
          }
          if (ev.type === "llm/retry-started") {
            const r = typeof d.retryId === "string" ? retryById[d.retryId] : null;
            if (r) r.startedAt = ev.time;
            continue;
          }
          if (ev.type === "request/header") {
            const cfg = d.header && d.header.config;
            if (cfg && cfg.model) route = (cfg.provider ? cfg.provider + "/" : "") + cfg.model;
            continue;
          }
          if (ev.type === "tool/call") {
            const it = {
              kind: "call",
              seq: ev.seq,
              time: ev.time,
              turn: d.turn,
              step: d.step,
              name: String(d.name || "?"),
              cat: kindOf(String(d.name || "")),
              argsRaw: typeof d.arguments === "string" ? d.arguments : "",
              status: "pending",
              dur: null,
              resultText: "",
              outLen: 0
            };
            items.push(it);
            if (d.callId != null) byCallId[String(d.callId)] = it;
          } else if (ev.type === "tool/result") {
            const m = d.message || {};
            let callId = null;
            let text = "";
            if (Array.isArray(m.content)) {
              for (const block of m.content) {
                if (callId == null && block && block.toolCallId != null) callId = String(block.toolCallId);
                if (!text && block) {
                  const t = textOf(block.content);
                  if (t) text = t;
                }
              }
            }
            const failed = !!(d.error || Array.isArray(m.content) && m.content[0] && m.content[0].isError);
            const it = callId ? byCallId[callId] : null;
            if (it) {
              it.status = failed ? "error" : "ok";
              it.dur = ev.time - it.time;
              it.resultText = text;
              it.outLen = text.length;
              it.resSeq = ev.seq;
            }
          } else if (ev.type === "user/message") {
            const src = d.source && d.source.kind ? String(d.source.kind) : "user";
            const preview = oneLine(textOf(d.content), 110);
            if (src !== "user" && !preview) continue;
            items.push({ kind: "msg", role: src === "user" ? "user" : "inject", seq: ev.seq, time: ev.time, turn: curTurn, preview, full: textOf(d.content) });
          } else if (ev.type === "assistant/live-chunk") {
            if (d.attemptId == null) continue;
            const turn = typeof d.turn === "number" ? d.turn : curTurn;
            const step = typeof d.step === "number" ? d.step : 0;
            const card = cardOf(turn, step);
            let a = card.live && card.live.attemptId === String(d.attemptId) ? card.live : null;
            if (!a) {
              a = makeAttemptState(d.attemptId, turn, step);
              card.live = a;
            }
            if (a.firstSeq == null) a.firstSeq = ev.seq;
            applyChunkToAttempt(a, ev.time, d.chunk);
          } else if (ev.type === "assistant/message" || ev.type === "assistant/attempt") {
            const turn = typeof d.turn === "number" ? d.turn : curTurn;
            const step = typeof d.step === "number" ? d.step : 0;
            const card = cardOf(turn, step);
            const a = makeAttemptState(null, turn, step);
            for (const { time, chunk } of expandStreamRecords(d.stream)) applyChunkToAttempt(a, time, chunk);
            if (ev.type === "assistant/message") {
              card.message = { ev, data: d, stream: a, route };
            } else {
              card.attempts.push({ ev, stream: a });
            }
          }
        }
        for (const card of stepCards.values()) {
          const k = card.key;
          let uiSeq = null;
          if (card.live) uiSeq = card.live.firstSeq;
          if (uiSeq == null && live && Array.isArray(live.settled)) {
            const hit = live.settled.find((s) => s && s.turn === card.turn && s.step === card.step && typeof s.firstSeq === "number");
            if (hit) uiSeq = hit.firstSeq;
          }
          let it;
          if (card.message) {
            const { ev, data, stream, route: msgRoute } = card.message;
            const m = data.message || {};
            const u = data.usage || stream.usage || null;
            const finalText = textOf(m.content);
            it = {
              kind: "msg",
              role: "ai",
              seq: uiSeq != null ? uiSeq : ev.seq,
              time: ev.time,
              turn: card.turn,
              step: card.step,
              attemptId: card.live ? card.live.attemptId : "",
              akey: card.live ? "assistant-attempt:" + card.live.attemptId : "assistant-event:" + ev.seq,
              finalSeq: ev.seq,
              runStart: stepStarts[k] != null ? stepStarts[k] : stream.firstAt != null ? stream.firstAt : ev.time,
              runDur: Math.max(0, ev.time - (stepStarts[k] != null ? stepStarts[k] : stream.firstAt != null ? stream.firstAt : ev.time)),
              preview: oneLine(finalText, 110) || (stream.toolCall ? "\uFF08\u5DE5\u5177\u8C03\u7528\uFF09" : stream.reasoning ? oneLine(stream.reasoning, 110) : "\uFF08\u5DE5\u5177\u8C03\u7528\uFF09"),
              full: finalText || stream.text || stream.reasoning,
              tok: u ? u.outputTokens || 0 : null,
              route: msgRoute || route,
              streaming: false,
              settled: true,
              interrupted: data.interrupted === true,
              finishKind: stream.finishKind || (data.interrupted === true ? "interrupted" : ""),
              failCode: "",
              failMsg: ""
            };
          } else if (card.attempts.length && !card.live) {
            const last = card.attempts[card.attempts.length - 1];
            const s = last.stream;
            const failed = s.finishKind === "error" || s.finishKind === "aborted" || Boolean(s.failCode);
            const uiSeqFinal = uiSeq != null ? uiSeq : last.ev.seq;
            const runFrom = stepStarts[k] != null ? stepStarts[k] : s.firstAt != null ? s.firstAt : last.ev.time;
            const runTo = s.lastAt != null ? s.lastAt : last.ev.time;
            it = {
              kind: "msg",
              role: "ai",
              seq: uiSeqFinal,
              time: last.ev.time,
              turn: card.turn,
              step: card.step,
              attemptId: "",
              akey: "assistant-event:" + last.ev.seq,
              finalSeq: last.ev.seq,
              runStart: runFrom,
              runDur: Math.max(0, runTo - runFrom),
              preview: (s.text || s.reasoning ? oneLine(s.text || s.reasoning, 100) + " " : "") + (s.finishKind === "aborted" ? "\uFF08\u5DF2\u53D6\u6D88\uFF09" : "\uFF08\u751F\u6210\u5931\u8D25\uFF09"),
              full: s.text || s.reasoning,
              tok: null,
              route,
              streaming: false,
              settled: true,
              interrupted: false,
              failed: s.finishKind === "error" || Boolean(s.failCode),
              abandoned: s.finishKind === "aborted",
              finishKind: s.finishKind,
              failCode: s.failCode || "",
              failMsg: s.failMsg || ""
            };
            if (!failed && !s.failCode && s.finishKind !== "aborted") it.preview = oneLine(s.text || s.reasoning, 110) || "\uFF08\u5C1D\u8BD5\u672A\u5F62\u6210\u6D88\u606F\uFF09";
            const rsEarly = retriesByStep[k];
            const stepOpen = stepEnds[k] == null && (card.turn == null || turnEnds[card.turn] == null);
            const pendRetry = rsEarly && rsEarly.length && !rsEarly[rsEarly.length - 1].startedAt;
            if (rsEarly && rsEarly.length) it.retries = rsEarly;
            if (stepOpen) {
              it.interrupted = !pendRetry;
              it.awaitingRetry = Boolean(pendRetry);
            } else {
              it.interrupted = true;
            }
            items.push(it);
            continue;
          } else {
            const a = card.live;
            if (!a) continue;
            it = {
              kind: "msg",
              role: "ai",
              seq: a.firstSeq != null ? a.firstSeq : a.firstAt != null ? a.firstAt : Date.now(),
              time: a.firstAt,
              turn: card.turn,
              step: card.step,
              attemptId: a.attemptId,
              akey: "assistant-attempt:" + a.attemptId,
              finalSeq: null,
              runStart: stepStarts[k] != null ? stepStarts[k] : a.firstAt != null ? a.firstAt : Date.now(),
              preview: "",
              full: a.text || a.reasoning,
              tok: null,
              route,
              streaming: true,
              settled: false,
              finishKind: a.finishKind,
              failCode: a.failCode || "",
              failMsg: a.failMsg || ""
            };
            const endedAt = stepEnds[k] != null ? stepEnds[k] : card.turn != null && turnEnds[card.turn] != null ? turnEnds[card.turn] : null;
            if (endedAt != null && !a.text && !a.reasoning && !a.toolCall && a.finishKind === "") {
              continue;
            }
            if (endedAt != null || a.finishKind === "error" || a.finishKind === "aborted") {
              it.streaming = false;
              it.interrupted = true;
              it.failed = a.finishKind === "error" || Boolean(a.failCode);
              it.abandoned = a.finishKind === "aborted";
              it.settled = a.finishKind !== "";
              const endRef = endedAt != null ? endedAt : a.lastAt != null ? a.lastAt : it.runStart;
              it.runDur = Math.max(0, endRef - it.runStart);
              it.preview = (it.full ? oneLine(it.full, 100) + " " : "") + (it.abandoned ? "\uFF08\u5DF2\u53D6\u6D88\uFF09" : "\uFF08\u751F\u6210\u5DF2\u4E2D\u65AD\uFF09");
            } else {
              it.preview = oneLine(it.full, 110) || (a.toolCall ? "\u6B63\u5728\u51C6\u5907\u5DE5\u5177\u8C03\u7528\u2026" : a.reasoning ? "\u601D\u8003\u4E2D\u2026" : "\u6B63\u5728\u751F\u6210\u2026");
            }
          }
          const rs = retriesByStep[k];
          if (rs && rs.length) it.retries = rs;
          items.push(it);
        }
        const order = items.map((it, i) => [it.seq, i, it]);
        order.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
        return order.map((e) => e[2]);
      };
      const buildNodes = (items) => {
        const nodes = [];
        for (const it of items) {
          if (it.kind === "msg") {
            nodes.push({ t: "msg", it });
            continue;
          }
          if (it.cat === "subagent") {
            const last2 = nodes[nodes.length - 1];
            if (last2 && last2.t === "subs" && last2.turn === it.turn && last2.step === it.step) last2.calls.push(it);
            else nodes.push({ t: "subs", turn: it.turn, step: it.step, calls: [it] });
            continue;
          }
          const last = nodes[nodes.length - 1];
          if (last && last.t === "par" && last.turn === it.turn && last.step === it.step) last.calls.push(it);
          else nodes.push({ t: "par", turn: it.turn, step: it.step, calls: [it] });
        }
        return nodes;
      };
      const SESSION_ID_RE = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
      const childIdOf = (call) => {
        const m = /(?:subagent|agent)\s+([0-9a-f]{8}-[0-9a-f-]{27,})/i.exec(call.resultText || "");
        if (m) return m[1];
        if (call && call.name === "send_message") {
          try {
            const args = JSON.parse(call.argsRaw || "{}");
            const id = args && typeof args.agent_id === "string" ? args.agent_id.trim() : "";
            if (SESSION_ID_RE.test(id)) return id;
          } catch (e) {
          }
        }
        return null;
      };
      const childRows = async (childId, cap) => {
        const r = await readLog(childId);
        if (!r.events || !r.events.length) return { rows: [], live: false, total: 0 };
        const items = parseItems(r.events);
        const rows = [];
        for (const it of items) {
          if (it.kind === "msg") {
            if (it.role === "ai") rows.push({ txt: it.preview, cls: "ai" });
          } else {
            const km = KIND_META[it.cat] || KIND_META.builtin;
            rows.push({ txt: it.name + " " + oneLine(it.argsRaw, 40), cls: "", pill: km.label, status: it.status, dur: it.dur });
          }
        }
        let live = false;
        try {
          const agentsSvc = ctx.get("agents");
          if (agentsSvc) {
            const agent = agentsSvc.get(childId);
            live = !!(agent && agent.status === "running");
          } else {
            const sessionsSvc = ctx.get("sessions");
            live = !!(sessionsSvc && sessionsSvc.get(childId));
          }
        } catch (e) {
        }
        return { rows: rows.slice(-cap), live, total: rows.length };
      };
      const statusGlyph = (s, dur) => {
        if (s === "ok") return '<span style="color:var(--tb-done-text,#81c784)">\u2713 ' + fmtDur(dur) + "</span>";
        if (s === "error") return '<span style="color:var(--tb-danger-text,#f28b82)">\u2717 ' + fmtDur(dur) + "</span>";
        return '<span class="fl-spin"></span>';
      };
      const ARG_KEYS = ["command", "file_path", "path", "pattern", "query", "q", "description", "prompt", "text", "content", "url", "name", "key", "expression", "expr", "code", "script", "tool", "method", "message", "input", "old_string", "new_string"];
      const inSummary = (c) => {
        try {
          const a = JSON.parse(c.argsRaw || "{}");
          for (const k of ARG_KEYS) {
            if (typeof a[k] === "string" && a[k].trim()) return k + ": " + oneLine(a[k], 72);
            if (typeof a[k] === "number" || typeof a[k] === "boolean") return k + ": " + a[k];
          }
          const ks = Object.keys(a);
          if (ks.length) return ks[0] + ": " + oneLine(String(a[ks[0]]), 72);
          return "\uFF08\u65E0\u53C2\u6570\uFF09";
        } catch (e) {
          return oneLine(c.argsRaw, 72) || "\uFF08\u65E0\u53C2\u6570\uFF09";
        }
      };
      const outSummary = (c) => {
        if (c.status === "pending") return null;
        if (c.status === "error") {
          const t = (c.resultText || "").trim();
          return { text: t ? oneLine(t, 72) : "\uFF08\u8C03\u7528\u5931\u8D25\uFF09", err: true };
        }
        const lines = String(c.resultText || "").split("\n").map((s) => s.trim()).filter(Boolean);
        const first = lines[0] || "";
        return { text: (first ? oneLine(first, 72) : "\uFF08\u7A7A\u8FD4\u56DE\uFF09") + (c.outLen > 72 ? " \xB7 " + fmtSize(c.outLen) : ""), err: false };
      };
      const renderCallWire = (c, expandedSeq) => {
        const km = KIND_META[c.cat] || KIND_META.builtin;
        const isExp = expandedSeq === c.seq;
        const pending = c.status === "pending";
        const o = outSummary(c);
        return '<div class="fl-wp" data-flow-card="' + c.seq + '" data-flow-status="' + c.status + '"><div class="fl-wl"><span class="fl-wl-txt">\u8F93\u5165 ' + esc(inSummary(c)) + '</span><span class="fl-wl-row"><span class="fl-wl-line"></span><span class="fl-wl-arr">\u25B6</span></span></div>' + (pending ? '<div class="fl-wl fl-wl-b fl-wl-wait"><span class="fl-wl-txt">\u8F93\u51FA \u8FDB\u884C\u4E2D\u2026</span><span class="fl-wl-row"><span class="fl-wl-arr">\u25C0</span><span class="fl-wl-line"></span></span></div>' : '<div class="fl-wl fl-wl-b' + (o && o.err ? " fl-wl-err" : "") + '"><span class="fl-wl-txt">\u8F93\u51FA ' + esc(o ? o.text : "") + '</span><span class="fl-wl-row"><span class="fl-wl-arr">\u25C0</span><span class="fl-wl-line"></span></span></div>') + '</div><div class="fl-callside"><div class="fl-iocard' + (pending ? " fl-live" : "") + (isExp ? " fl-on" : "") + (o && o.err ? " fl-err" : "") + '" data-action="fdetail" data-seq="' + c.seq + '" data-flow-select-seq="' + c.seq + '" title="\u70B9\u51FB\u5728\u53F3\u4FA7\u67E5\u770B\u5B8C\u6574\u4F20\u5165/\u8FD4\u56DE"><div class="fl-iohead"><span class="fl-tag" style="color:' + km.color + ";background:" + km.bg + '">' + km.label + '</span><span class="fl-name">' + esc(c.name) + "</span>" + (pending ? '<span class="fl-spin"></span><span class="fl-time" data-flow-timer="' + c.time + '" data-flow-timer-prefix="\u23F1 ">\u23F1 0ms</span>' : statusGlyph(c.status, c.dur)) + "</div></div></div>";
      };
      const grpSide = (node, units) => {
        const n = node.calls.length;
        if (n < 2) return '<div class="fl-lane-side">' + units + "</div>";
        return '<div class="fl-lane-side fl-grp"><span class="fl-grp-tag">\u5E76\u884C \xD7' + n + "</span>" + units + "</div>";
      };
      const connMain = (content, withConn) => (withConn ? '<div class="fl-conn"><span class="fl-arrow">\u25BC</span></div>' : "") + content + (withConn ? '<span class="fl-conn-gap"></span>' : "");
      const renderPar = (node, expandedSeq) => {
        const units = node.calls.map((c) => renderCallWire(c, expandedSeq)).join("");
        return '<div class="fl-lane"><div></div><div class="fl-lane-main"><span class="fl-lane-line"></span></div>' + grpSide(node, units) + "</div>";
      };
      const retryBadgeHtml = (it) => {
        let out = "";
        const rs = it.retries;
        if (rs && rs.length) {
          const last = rs[rs.length - 1];
          const max = typeof last.maxRetries === "number" ? "/" + last.maxRetries : "";
          const tip = esc((last.code || "") + (last.message ? "\uFF1A" + last.message : ""));
          if ((it.streaming || it.awaitingRetry) && !last.startedAt) {
            const remain = Math.max(0, Math.ceil((last.time + (last.delayMs || 0) - Date.now()) / 1e3));
            out += '<span class="fl-retry fl-retry-wait" title="' + tip + '">\u27F3 \u7B49\u5F85\u91CD\u8BD5 ' + last.retry + max + (remain ? " \xB7 " + remain + "s" : "") + "</span>";
          } else if (it.streaming) {
            out += '<span class="fl-retry fl-retry-wait" title="' + tip + '">\u27F3 \u91CD\u8BD5 ' + last.retry + max + " \xB7 \u8FDB\u884C\u4E2D</span>";
          } else if (!last.startedAt) {
            out += '<span class="fl-retry fl-retry-cancel" title="\u9000\u907F\u7B49\u5F85\u671F\u95F4\u6B65\u9AA4/\u8F6E\u6B21\u5DF2\u7ED3\u675F">\u27F3 \u91CD\u8BD5 ' + last.retry + max + " \u672A\u6210\u884C</span>";
          } else if (it.interrupted) {
            out += '<span class="fl-retry fl-retry-fail" title="' + tip + '">\u27F3 \u91CD\u8BD5 ' + last.retry + max + " \xB7 \u5931\u8D25</span>";
          } else {
            out += '<span class="fl-retry fl-retry-ok" title="' + tip + '">\u27F3 \u91CD\u8BD5 ' + last.retry + max + " \xB7 \u6210\u529F</span>";
          }
        }
        if (it.interrupted && it.failCode) {
          out += '<span class="fl-retry fl-retry-fail" title="' + esc(it.failMsg || "") + '">\u2717 ' + esc(it.failCode) + "</span>";
        }
        if (it.finishKind === "max-tokens") {
          out += '<span class="fl-retry fl-retry-cancel" title="\u8F93\u51FA\u56E0 max-tokens \u957F\u5EA6\u4E0A\u9650\u622A\u65AD">\u2912 \u5DF2\u8FBE\u4E0A\u9650</span>';
        }
        return out;
      };
      const msgCardInner = (it, expandedSeq, live) => {
        const isUser = it.role === "user";
        const isAi = it.role === "ai";
        const aiRunning = isAi && it.streaming;
        const color = isUser ? "var(--tb-done-text,#81c784)" : isAi ? "var(--tb-active-text,#7fa7f0)" : "var(--tb-text-3,#777884)";
        const label = isUser ? "\u7528\u6237" : isAi ? "\u52A9\u624B" : "\u6CE8\u5165";
        const branchSeq = it.finalSeq != null ? it.finalSeq : it.seq;
        const flowState = it.streaming ? "streaming" : it.abandoned ? "abandoned" : it.failed || it.interrupted && it.failCode ? "failed" : "settled";
        const branch = isAi && !it.streaming ? '<button type="button" class="fl-branch-btn" data-flow-branch data-seq="' + branchSeq + '" title="\u4ECE\u8FD9\u6761\u52A9\u624B\u6D88\u606F\u5728 Harness \u4E2D\u521B\u5EFA\u65B0\u5206\u652F" aria-label="\u5728\u65B0\u5BF9\u8BDD\u4E2D\u5206\u652F"><svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 3v5a3 3 0 0 0 3 3h4"/><path d="M8 5l3-3 3 3"/><path d="M11 2v4"/><path d="M9 9l2 2-2 2"/></svg></button>' : "";
        return '<div class="fl-node' + (expandedSeq === it.seq ? " fl-on" : "") + (live ? " fl-live" : "") + '" style="border-left-color:' + color + '" data-flow-main-card="' + it.seq + '" data-flow-role="' + it.role + '" data-flow-state="' + flowState + '"' + (isAi && it.attemptId ? ' data-flow-attempt="' + esc(it.attemptId) + '"' : "") + ' data-flow-select-seq="' + it.seq + '" data-action="fdetail" data-seq="' + it.seq + '" title="\u70B9\u51FB\u67E5\u770B\u5B8C\u6574\u6D88\u606F"><div class="fl-node-head"><span class="fl-glyph" style="color:' + color + '">' + (isUser ? "\u25B2" : isAi ? "\u25C6" : "\u25A0") + '</span><span class="fl-tag" style="color:' + color + '">' + label + "</span>" + (isAi && it.route ? '<span class="fl-model">' + esc(it.route) + "</span>" : "") + (fmtTime(it.time) ? '<span class="fl-time">' + fmtTime(it.time) + "</span>" : "") + (aiRunning && it.runStart ? '<span class="fl-time" data-flow-timer="' + it.runStart + '" data-flow-timer-prefix="\u23F1 ">\u23F1 0ms</span>' : isAi && it.runDur != null ? '<span class="fl-time">\u23F1 ' + fmtDur(it.runDur) + "</span>" : "") + (it.tok ? '<span class="fl-time">+' + it.tok + " tok</span>" : "") + (isAi ? retryBadgeHtml(it) : "") + branch + '</div><div class="fl-preview"' + (it.interrupted ? ' style="color:var(--tb-danger-text,#f28b82)"' : "") + ">" + esc(it.preview || "\uFF08\u7A7A\uFF09") + "</div></div>";
      };
      const renderMsg = (it, expandedSeq, withConn, live) => '<div class="fl-lane fl-lane-compact"><div></div><div class="fl-lane-main">' + connMain(msgCardInner(it, expandedSeq, live), withConn) + "</div><div></div></div>";
      const copyButtonHtml = '<button type="button" class="fl-copy-btn" data-flow-copy="1" title="\u590D\u5236\u5185\u5BB9\u5230\u526A\u8D34\u677F" aria-label="\u590D\u5236\u5185\u5BB9\u5230\u526A\u8D34\u677F"><svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="5" width="8" height="8" rx="1.5"/><path d="M3 11H2.5A1.5 1.5 0 0 1 1 9.5v-7A1.5 1.5 0 0 1 2.5 1h7A1.5 1.5 0 0 1 11 2.5V3"/></svg></button>';
      const markdownPreviewButtonHtml = (seq) => '<button type="button" class="fl-md-preview-btn" data-flow-markdown-preview="1" data-flow-markdown-key="' + seq + '" title="Markdown \u9884\u89C8" aria-label="Markdown \u9884\u89C8" aria-pressed="false"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.5 8s2.3-4 6.5-4 6.5 4 6.5 4-2.3 4-6.5 4S1.5 8 1.5 8Z"/><circle cx="8" cy="8" r="1.8"/></svg></button>';
      const detailRail = (c, anim) => {
        let input = c.argsRaw || "";
        try {
          input = JSON.stringify(JSON.parse(c.argsRaw || "{}"), null, 2);
        } catch (e) {
        }
        const cap = 8e3;
        const inShown = input.length > cap ? input.slice(0, cap) + "\n\u2026\uFF08\u622A\u65AD\uFF0C\u5171 " + input.length + " \u5B57\u7B26\uFF09" : input;
        const out = c.status === "pending" ? "\uFF08\u8FDB\u884C\u4E2D\uFF0C\u5C1A\u65E0\u8FD4\u56DE\uFF09" : c.resultText || "\uFF08\u7A7A\u8FD4\u56DE\uFF09";
        const outShown = out.length > cap ? out.slice(0, cap) + "\n\u2026\uFF08\u622A\u65AD\uFF0C\u5171 " + out.length + " \u5B57\u7B26\uFF09" : out;
        return '<div class="fl-rail' + (anim ? " fl-rail-anim" : "") + '"><div class="fl-rail-resize" title="\u62D6\u62FD\u8C03\u5BBD\uFF08\u81EA\u52A8\u8BB0\u5FC6\uFF09"></div><div class="fl-rail-head"><span class="fl-rail-title">' + esc(c.name) + ' \xB7 \u8BE6\u60C5</span><button type="button" class="fl-rail-x" data-action="fdetail" data-seq="' + c.seq + '" title="\u5173\u95ED\u8BE6\u60C5">\u2715</button></div><div class="fl-rail-body"><div class="fl-sec"><div class="fl-sec-head"><span class="fl-sec-label">\u5165 \xB7 \u5B8C\u6574\u4F20\u5165' + (input.length > cap ? "\uFF08\u622A\u65AD\uFF09" : "") + "</span>" + copyButtonHtml + '</div><pre class="fl-pre">' + esc(inShown) + '</pre></div><div class="fl-sec"><div class="fl-sec-head"><span class="fl-sec-label">\u51FA \xB7 \u5B8C\u6574\u8FD4\u56DE' + (c.outLen ? "\uFF08" + fmtSize(c.outLen) + "\uFF09" : "") + "</span>" + copyButtonHtml + '</div><pre class="fl-pre">' + esc(outShown) + "</pre></div></div></div>";
      };
      const msgRail = (it, anim) => {
        const label = it.role === "user" ? "\u7528\u6237\u6D88\u606F" : it.role === "ai" ? "\u52A9\u624B\u6D88\u606F" : "\u6CE8\u5165\u6D88\u606F";
        const cap = 8e3;
        const full = String(it.full || it.preview || "");
        const shown = full.length > cap ? full.slice(0, cap) + "\n\u2026\uFF08\u622A\u65AD\uFF0C\u5171 " + full.length + " \u5B57\u7B26\uFF09" : full;
        const meta = [];
        if (fmtTime(it.time)) meta.push("\u65F6\u95F4 " + fmtTime(it.time));
        if (it.route) meta.push("\u6A21\u578B " + it.route);
        if (it.attemptId) meta.push("attempt " + String(it.attemptId).slice(0, 12));
        if (it.tok) meta.push("\u8F93\u51FA +" + it.tok + " tok");
        if (it.finishKind && it.finishKind !== "stop") meta.push("\u7ED3\u675F " + it.finishKind);
        if (it.failCode) meta.push("\u9519\u8BEF " + it.failCode + (it.failMsg ? "\uFF1A" + oneLine(it.failMsg, 80) : ""));
        if (it.retries && it.retries.length) meta.push("\u91CD\u8BD5 " + it.retries.length + " \u6B21\uFF08" + it.retries.map((r) => r.code || "?").join(" \u2192 ") + "\uFF09");
        const branch = it.role === "ai" && !it.streaming ? '<button type="button" class="fl-branch-btn" data-flow-branch data-seq="' + (it.finalSeq != null ? it.finalSeq : it.seq) + '" title="\u4ECE\u8FD9\u6761\u52A9\u624B\u6D88\u606F\u5728 Harness \u4E2D\u521B\u5EFA\u65B0\u5206\u652F" aria-label="\u5728\u65B0\u5BF9\u8BDD\u4E2D\u5206\u652F"><svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 3v5a3 3 0 0 0 3 3h4"/><path d="M8 5l3-3 3 3"/><path d="M11 2v4"/><path d="M9 9l2 2-2 2"/></svg></button>' : "";
        const markdown = it.role === "ai";
        return '<div class="fl-rail' + (anim ? " fl-rail-anim" : "") + '"' + (markdown ? ' data-flow-markdown-detail="1"' : "") + '><div class="fl-rail-resize" title="\u62D6\u62FD\u8C03\u5BBD\uFF08\u81EA\u52A8\u8BB0\u5FC6\uFF09"></div><div class="fl-rail-head"><span class="fl-rail-title">' + label + " \xB7 \u8BE6\u60C5</span>" + branch + '<button type="button" class="fl-rail-x" data-action="fdetail" data-seq="' + it.seq + '" title="\u5173\u95ED\u8BE6\u60C5">\u2715</button></div><div class="fl-rail-body"' + (markdown ? ' data-flow-markdown-body="1" data-flow-markdown-key="' + it.seq + '" data-flow-markdown-streaming="' + (it.streaming ? "1" : "0") + '"' : "") + ">" + (meta.length ? '<div class="fl-sec"><span class="fl-sec-label">' + esc(meta.join(" \xB7 ")) + "</span></div>" : "") + '<div class="fl-sec"><div class="fl-sec-head"><span class="fl-sec-label">\u5B8C\u6574\u5185\u5BB9' + (full.length > cap ? "\uFF08\u622A\u65AD\uFF09" : "") + "</span>" + (markdown ? markdownPreviewButtonHtml(it.seq) : "") + copyButtonHtml + '</div><pre class="fl-pre"' + (markdown ? ' data-flow-markdown-source="1"' : "") + ">" + esc(shown || "\uFF08\u7A7A\uFF09") + "</pre></div></div></div>";
      };
      const subBranchHtml = async (c) => {
        const cid = childIdOf(c);
        let subLive = c.status === "pending";
        let sub2 = null;
        if (cid) {
          try {
            sub2 = await childRows(cid, 10);
            if (sub2.live) subLive = true;
          } catch (e) {
          }
        }
        let sub = '<div class="fl-sub-card fl-sub-open' + (subLive ? " fl-live" : "") + '" data-action="' + (cid ? "fenter" : "fdetail") + '" data-seq="' + c.seq + '" data-flow-select-seq="' + c.seq + '" title="' + (cid ? "\u8FDB\u5165\u8BE5\u5B50\u4EE3\u7406\u7684\u5B9E\u65F6\u6D41\u955C" : "\u70B9\u51FB\u67E5\u770B\u5B8C\u6574\u4EFB\u52A1\u4F20\u5165/\u8FD4\u56DE") + '"><div class="fl-iohead"><span class="fl-tag" style="color:var(--tb-active-text,#7fa7f0);background:rgba(91,141,239,.12)">\u5B50\u4EE3\u7406</span><span class="fl-name">' + esc(c.name) + "</span>" + statusGlyph(c.status, c.dur) + '</div><div class="fl-sub-io"><span class="fl-io-tag">\u5165</span><span class="fl-branch-txt">' + esc(inSummary(c)) + "</span></div></div>";
        let steps = "";
        if (cid && sub2) {
          steps += '<div class="fl-sub-meta"><span class="fl-time">\u21B3 ' + esc(cid.slice(0, 8)) + "\u2026 \xB7 " + sub2.total + " \u6B65</span>" + (sub2.live ? '<span class="fl-tag" style="color:var(--tb-done-text,#81c784)">\u8FD0\u884C\u4E2D</span>' : "") + '<button type="button" class="tb-btn tb-btn-sm" data-action="fenter" data-seq="' + c.seq + '" title="\u8FDB\u5165\u8BE5\u5B50\u4EE3\u7406\u7684\u5B8C\u6574\u6D41\u7A0B\u56FE\uFF08\u53EF\u9010\u7EA7\u8FD4\u56DE\uFF09">\u8FDB\u5165 \u2192</button></div>';
          for (const r of sub2.rows) {
            steps += '<div class="fl-sub-step">' + (r.pill ? '<span class="fl-branch-pill">' + esc(r.pill) + "</span>" : "") + '<span class="fl-branch-txt' + (r.pill ? "" : " fl-branch-ai") + '">' + esc(r.txt) + "</span>" + (r.pill ? statusGlyph(r.status, r.dur) : "") + "</div>";
          }
          if (sub2.total > sub2.rows.length) steps += '<div class="fl-sub-step"><span class="fl-time">\u2026 \u66F4\u65E9 ' + (sub2.total - sub2.rows.length) + " \u6B65\u672A\u5C55\u5F00</span></div>";
        } else if (c.status === "pending") {
          steps = '<div class="fl-sub-step"><span class="fl-time">\u5B50\u4EE3\u7406\u542F\u52A8\u4E2D\u2026</span></div>';
        }
        if (steps) sub += '<div class="fl-sub-steps">' + steps + "</div>";
        if (c.status !== "pending") {
          const o = outSummary(c);
          sub += '<div class="fl-sub-card fl-sub-close" data-action="fdetail" data-seq="' + c.seq + '" title="\u70B9\u51FB\u67E5\u770B\u5B8C\u6574\u4EFB\u52A1\u4F20\u5165/\u8FD4\u56DE"><div class="fl-sub-io"><span class="fl-io-tag">\u51FA</span><span class="fl-time">' + fmtDur(c.dur) + "</span>" + (o ? '<span class="fl-args">' + esc(o.text) + "</span>" : "") + "</div></div>";
        }
        return sub;
      };
      const flowContextOf = (items, seqs, sid) => {
        const wanted = new Set(seqs);
        const selected = items.filter((it) => wanted.has(it.seq)).sort((a, b) => a.seq - b.seq);
        const chunks = ["\u4EE5\u4E0B\u662F\u4ECE Flowglass \u4F1A\u8BDD " + sid + " \u6846\u9009\u7684\u6D41\u7A0B\u7247\u6BB5\uFF08" + selected.length + " \u9879\uFF09\uFF1A"];
        for (const it of selected) {
          if (it.kind === "msg") {
            const role = it.role === "user" ? "\u7528\u6237" : it.role === "ai" ? "\u52A9\u624B" : "\u6CE8\u5165";
            chunks.push("\n[" + role + " \xB7 seq " + it.seq + "]\n" + String(it.full || it.preview || "\uFF08\u7A7A\uFF09"));
          } else {
            chunks.push("\n[\u5DE5\u5177 " + it.name + " \xB7 seq " + it.seq + "]\n\u4F20\u5165\uFF1A" + (it.argsRaw || "\uFF08\u65E0\u53C2\u6570\uFF09") + "\n\u8FD4\u56DE\uFF1A" + (it.status === "pending" ? "\uFF08\u8FDB\u884C\u4E2D\uFF09" : it.resultText || "\uFF08\u7A7A\u8FD4\u56DE\uFF09"));
          }
        }
        const text = chunks.join("\n");
        const cap = 24e3;
        return {
          sourceSessionId: sid,
          seqs: selected.map((it) => it.seq),
          text: text.length > cap ? text.slice(0, cap) + "\n\u2026\uFF08\u6846\u9009\u5185\u5BB9\u8FC7\u957F\uFF0C\u5DF2\u622A\u65AD\uFF09" : text
        };
      };
      const subGroupHtml = async (node) => {
        const branches = await Promise.all(node.calls.map(subBranchHtml));
        return (node.calls.length > 1 ? '<span class="fl-subgrp-tag">\u5E76\u884C\u5B50\u4EE3\u7406 \xD7' + node.calls.length + "</span>" : "") + branches.map((html) => '<div class="fl-subbranch">' + html + "</div>").join("");
      };
      const subColHtml = (node, html) => '<div class="fl-subcol' + (node.calls.length > 1 ? " fl-subgrp" : "") + '">' + html + "</div>";
      const render = async (st, sid, live) => {
        const r = await readLog(sid);
        const prevCount = growth[sid];
        const active = prevCount != null && (r.count || 0) > prevCount;
        growth[sid] = r.count || 0;
        await loadManifestTools();
        const overlayLive = Boolean(live && Array.isArray(live.attempts) && live.attempts.some((a) => a && a.attemptId != null));
        const items = parseItems(r.events || [], live);
        const nodes = buildNodes(items);
        const lastIt = items.length ? items[items.length - 1] : null;
        let sessionLive = false;
        let hasAgentStatus = false;
        try {
          const agentsSvc = ctx.get("agents");
          if (agentsSvc) {
            hasAgentStatus = true;
            const agent = agentsSvc.get(sid);
            sessionLive = !!(agent && agent.status === "running");
          }
        } catch (e) {
        }
        if (hasAgentStatus && !sessionLive && !overlayLive) {
          const tail = r.events && r.events.length ? r.events[r.events.length - 1] : null;
          const settledAt = tail && Number.isFinite(Number(tail.time)) ? Number(tail.time) : null;
          for (const it of items) {
            if (it.kind !== "msg" || it.role !== "ai" || !it.streaming) continue;
            it.streaming = false;
            it.interrupted = true;
            it.runDur = Math.max(0, (settledAt != null ? settledAt : it.runStart) - it.runStart);
            it.preview = (it.full ? oneLine(it.full, 100) + " " : "") + "\uFF08\u751F\u6210\u5931\u8D25\u6216\u5DF2\u4E2D\u65AD\uFF09";
          }
        }
        const liveAiSeq = (overlayLive || (hasAgentStatus ? sessionLive : active)) && lastIt && lastIt.kind === "msg" && lastIt.role === "ai" && !lastIt.interrupted ? lastIt.seq : null;
        const PAGE = 60;
        const limit = Number.isFinite(Number(st.limit)) ? Math.max(PAGE, Math.floor(Number(st.limit) / PAGE) * PAGE) : PAGE;
        st.limit = limit;
        const shown = nodes.slice(-limit);
        const hasOlder = nodes.length > shown.length;
        const parts = [];
        parts.push('<div class="jr-tabpanel tb-root tb-pane" data-flow data-flow-scope="' + esc(sid) + '" data-flow-has-older="' + (hasOlder ? "1" : "0") + '" data-flow-visible="' + shown.length + '" data-flow-total="' + nodes.length + '" data-autorefresh="' + (st.live ? "2000" : "") + '" data-tab-badge="' + (st.live ? String(nodes.length) : "") + '">');
        parts.push('<div class="tb-pane-head">');
        const drilled = !!(st.home && sid !== st.home);
        const depth = drilled && Array.isArray(st.crumbs) ? st.crumbs.length : 0;
        const help = [
          "\u2022 \u4E2D\u5217\u662F\u7528\u6237/\u52A9\u624B\u4E3B\u7EBF\uFF0C\u53F3\u5217\u662F\u5DE5\u5177\u8C03\u7528\uFF08\u8F93\u5165 \u25B6 / \u8F93\u51FA \u25C0\uFF09\uFF0C\u5DE6\u5217\u662F\u5B50\u4EE3\u7406\u5206\u652F\u3002",
          "\u2022 \u70B9\u51FB\u5361\u7247\u67E5\u770B\u5B8C\u6574\u5185\u5BB9\u3002",
          "\u2022 \u60AC\u505C\u52A9\u624B\u5361\u53EF\u4ECE\u8BE5\u8282\u70B9\u521B\u5EFA Harness \u5206\u652F\u3002",
          "\u2022 \u753B\u5E03\u9ED8\u8BA4\u53EF\u62D6\u52A8\u6846\u9009\uFF0C\u70B9\u51FB\u7A7A\u767D\u5904\u53D6\u6D88\u6846\u9009\u5E76\u6536\u8D77\u8BE6\u60C5\uFF1B\u5DE6\u4E0B\u53EF\u65B0\u5EFA\u4EC5\u6240\u9009\u5185\u5BB9\u7684\u4F1A\u8BDD\u8349\u7A3F\u6216\u5E26\u5165\u5DF2\u6709\u4F1A\u8BDD\u3002",
          "\u2022 Zoom \u652F\u6301\u7F29\u653E\u4E0E Zen \u539F\u751F\u5168\u5C4F\u3002",
          "\u2022 \u70B9\u51FB\u5B50\u4EE3\u7406\u5361\u8FDB\u5165\u5B9E\u65F6\u5B50\u6D41\u955C\uFF0C\u201C\u5B50\u4EE3\u7406\u8DDF\u968F\u201D\u5F00\u542F\u65F6 Harness \u540C\u6B65\u5207\u6362\u3002",
          "\u2022 \u6EDA\u5230\u9876\u90E8\u4F1A\u6BCF\u6B21\u81EA\u52A8\u52A0\u8F7D\u66F4\u65E9 60 \u4E2A\u8282\u70B9\u3002"
        ].join("\n");
        parts.push('<div class="tb-row">' + (drilled ? '<button type="button" class="tb-btn tb-btn-sm" data-action="fback" title="\u8FD4\u56DE\u4E0A\u4E00\u7EA7\u6D41\u7A0B\u56FE">\u2190 \u8FD4\u56DE</button>' : "") + '<span class="tb-sec-label">' + (drilled ? "\u5B50\u4EE3\u7406\u6D41\u955C" : "\u5B9E\u65F6\u6D41\u955C") + '</span><span class="tb-note">' + esc(sid.replace(/^session-/, "").slice(0, 8)) + " \xB7 " + items.length + " \u6761\u4E8B\u4EF6 \xB7 " + nodes.length + " \u8282\u70B9" + (drilled ? " \xB7 \u7B2C " + (depth + 1) + " \u5C42" : "") + '</span><button type="button" class="tb-chip' + (st.live ? " tb-chip-on" : "") + '" data-action="toggle-live">' + (st.live ? "\u25CF \u5B9E\u65F6\u540C\u6B65\u4E2D" : "\u23F8 \u5DF2\u6682\u505C") + '</button><button type="button" class="tb-chip' + (st.follow ? " tb-chip-on" : "") + '" data-action="toggle-follow" title="\u5F00\u542F\u540E\uFF0C\u70B9\u51FB\u5B50\u4EE3\u7406\u4F1A\u540C\u65F6\u5207\u6362 DeepSeek Harness \u4E3B\u4F1A\u8BDD">' + (st.follow ? "\u25CF \u5B50\u4EE3\u7406\u8DDF\u968F" : "\u25CB \u5B50\u4EE3\u7406\u8DDF\u968F") + '</button><button type="button" class="tb-btn tb-btn-sm" data-action="refresh">\u5237\u65B0</button><span class="fl-info" tabindex="0" aria-label="\u6D41\u955C\u4F7F\u7528\u8BF4\u660E"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><circle cx="8" cy="8" r="6.2"/><path d="M8 7.2v4"/><circle cx="8" cy="4.7" r=".7" fill="currentColor" stroke="none"/></svg><span class="fl-info-pop">' + esc(help) + "</span></span></div>");
        parts.push("</div>");
        parts.push('<div class="tb-pane-body">');
        if (!shown.length) {
          parts.push('<div class="tb-notice">\u5F53\u524D\u4F1A\u8BDD\u8FD8\u6CA1\u6709\u4E8B\u4EF6</div>');
        } else {
          const subHtmls = {};
          await Promise.all(shown.map(async (n, i) => {
            if (n.t === "subs") subHtmls[i] = await subGroupHtml(n);
          }));
          const rows = [];
          for (let i = 0; i < shown.length; i++) {
            const n = shown[i];
            const withConn = rows.length > 0;
            let h;
            if (n.t === "msg" && n.it.role === "ai" && shown[i + 1] && (shown[i + 1].t === "par" || shown[i + 1].t === "subs")) {
              let parN = null, subN = null, subIdx = -1, next = i + 1;
              if (shown[next] && shown[next].t === "par") {
                parN = shown[next];
                next++;
              }
              if (shown[next] && shown[next].t === "subs") {
                subN = shown[next];
                subIdx = next;
                next++;
              }
              if (!parN && shown[next] && shown[next].t === "par") {
                parN = shown[next];
                next++;
              }
              const subCalls = subN ? subN.calls : [];
              const aiLive = parN && parN.calls.some((c) => c.status === "pending") || subCalls.some((c) => c.status === "pending") || n.it.seq === liveAiSeq;
              let main = msgCardInner(n.it, st.expanded, aiLive);
              let lastI = next - 1;
              const allSettled = subCalls.length > 0 && subCalls.every((c) => c.resSeq != null);
              const resultSeq = allSettled ? Math.max(...subCalls.map((c) => c.resSeq)) : null;
              if (resultSeq != null) {
                for (let j = next; j < shown.length; j++) {
                  const m = shown[j];
                  if (m.t !== "msg") break;
                  if (subN.turn != null && m.it.turn != null && m.it.turn !== subN.turn) break;
                  main += '<span class="fl-arrow">\u25BC</span>' + msgCardInner(m.it, st.expanded, m.it.seq === liveAiSeq);
                  lastI = j;
                  if (m.it.seq > resultSeq) break;
                }
              }
              h = '<div class="fl-lane">' + (subN ? subColHtml(subN, subHtmls[subIdx] || "") : "<div></div>") + '<div class="fl-lane-main">' + connMain(main, withConn) + "</div>" + (parN ? grpSide(parN, parN.calls.map((c) => renderCallWire(c, st.expanded)).join("")) : "<div></div>") + "</div>";
              i = lastI;
            } else if (n.t === "msg") h = renderMsg(n.it, st.expanded, withConn, n.it.seq === liveAiSeq);
            else if (n.t === "par") h = renderPar(n, st.expanded);
            else h = '<div class="fl-lane">' + subColHtml(n, subHtmls[i] || "") + '<div class="fl-lane-main"><span class="fl-lane-line"></span></div><div></div></div>';
            rows.push(h);
          }
          if (hasOlder) rows.push('<div class="tb-notice fl-older" data-flow-older-hint>\u5DF2\u663E\u793A\u6700\u8FD1 ' + shown.length + " \u4E2A\u8282\u70B9 \xB7 \u7EE7\u7EED\u5411\u4E0A\u6EDA\u52A8\u4F1A\u81EA\u52A8\u52A0\u8F7D\u66F4\u65E9 " + Math.min(PAGE, nodes.length - shown.length) + " \u6761</div>");
          parts.push(rows.reverse().join(""));
        }
        parts.push("</div>");
        if (st.expanded != null) {
          const target = items.find((it) => it.seq === st.expanded && (it.kind === "call" || it.kind === "msg"));
          if (target) parts.push(target.kind === "call" ? detailRail(target, st.freshSeq === target.seq) : msgRail(target, st.freshSeq === target.seq));
        }
        delete st.freshSeq;
        parts.push("</div>");
        return parts.join("");
      };
      const handler = async ({ action, fields, state, session, live }) => {
        if (!sq) return { ok: false, error: "sessionQuery \u670D\u52A1\u4E0D\u53EF\u7528", html: "" };
        const st = state && typeof state === "object" && state ? state : { live: true, follow: true, limit: 60, sid: null, home: null, expanded: null, crumbs: [] };
        if (typeof st.follow !== "boolean") st.follow = true;
        if (!Number.isFinite(Number(st.limit)) || Number(st.limit) < 60) st.limit = 60;
        if (typeof st.expanded !== "number" && st.expanded != null) st.expanded = null;
        if (!Array.isArray(st.crumbs)) st.crumbs = [];
        const el = fields && fields.__el ? fields.__el : {};
        const carriedFollow = st.follow === true && st.home && session && st.sid === session && st.crumbs.length > 0;
        const home = carriedFollow ? st.home : session || st.home || st.sid;
        if (!home) return { ok: true, html: '<div class="jr-tabpanel tb-root"><div class="tb-notice">\u672A\u627E\u5230\u5F53\u524D\u4F1A\u8BDD</div></div>', state: st };
        st.home = home;
        if (!st.sid) st.sid = home;
        let navigateSession = null;
        let flowContext = null;
        const liveOverlay = live && typeof live === "object" && typeof live.sessionId === "string" && live.sessionId === st.sid ? {
          sessionId: live.sessionId,
          revision: typeof live.revision === "number" ? live.revision : 0,
          attempts: Array.isArray(live.attempts) ? live.attempts.slice(-8) : [],
          settled: Array.isArray(live.settled) ? live.settled.slice(-8) : []
        } : null;
        if (action === "toggle-live") st.live = !st.live;
        else if (action === "toggle-follow") st.follow = !st.follow;
        else if (action === "fmore") st.limit = Math.min(1e5, Number(st.limit) + 60);
        else if (action === "fcontext" && typeof el.seqs === "string") {
          const seqs = el.seqs.split(",").map((v) => Number(v)).filter((v) => Number.isFinite(v));
          const r = await readLog(st.sid);
          flowContext = flowContextOf(parseItems(r.events || [], liveOverlay), seqs, st.sid);
        } else if (action === "fdetail" && el.seq != null) {
          const seq = Number(el.seq);
          st.expanded = st.expanded === seq ? null : seq;
          st.freshSeq = st.expanded;
        } else if (action === "fenter" && el.seq != null) {
          const seq = Number(el.seq);
          const r = await readLog(st.sid);
          const call = parseItems(r.events || []).find((it) => it.kind === "call" && it.seq === seq && it.cat === "subagent");
          const cid = call ? childIdOf(call) : null;
          if (cid && cid !== st.sid) {
            const parentSid = st.sid;
            st.crumbs.push({ sid: st.sid, label: call.name + " " + cid.slice(0, 8) });
            st.sid = cid;
            st.expanded = null;
            if (st.follow) navigateSession = { sessionId: cid, parentSessionId: parentSid, kind: "subagent" };
          }
        } else if (action === "fback") {
          const prev = st.crumbs.pop();
          if (prev && prev.sid) {
            st.sid = prev.sid;
            st.expanded = null;
            if (st.follow) navigateSession = { sessionId: prev.sid, kind: "session" };
          }
        }
        const sid = st.sid;
        try {
          const html = await render(st, sid, liveOverlay);
          return { ok: true, html, state: st, navigateSession, flowContext };
        } catch (e) {
          return { ok: false, error: String(e && e.message || e), html: "", state: st };
        }
      };
      tryRegisterTool(ctx, { id: "flow", label: "\u6D41\u955C", order: 2, icon: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="3" r="1.5"/><circle cx="4" cy="12.5" r="1.5"/><circle cx="12" cy="12.5" r="1.5"/><path d="M8 4.5v2.2M8 6.7L4 11M8 6.7l4 4.3"/></svg>' }, handler);
    }
  };
};
var exposeRemote = (klass, method, exportName) => {
  const initializers = [];
  Remote(exportName || method)(klass.prototype[method], {
    private: false,
    static: false,
    name: method,
    addInitializer(fn) {
      initializers.push(fn);
    }
  });
  const marker = Object.create(klass.prototype);
  for (const init of initializers) init.call(marker);
};
var NativeToolboxRemote = class extends TypertRemoteService {
  constructor(ctx, registry) {
    super(ctx, "toolboxNativeFlow", { namespace: "toolboxNativeFlow" });
    this.registry = registry;
  }
  tools(request) {
    const root = request && typeof request.root === "string" ? request.root : void 0;
    return { ok: true, root: root || null, tools: this.registry.tools() };
  }
  panel(request) {
    const root = request && typeof request.root === "string" ? request.root : void 0;
    return this.registry.panel(root, request || {});
  }
  plugins(request) {
    void request;
    return { ok: true, plugins: [], capabilities: TOOLBOX_RUNTIME.capabilities };
  }
  async sessionInfo(request) {
    const sid = request && typeof request.session === "string" ? request.session : "";
    if (!sid) return { ok: false, error: "\u7F3A\u5C11\u4F1A\u8BDD id" };
    const sessions = this.ctx.get("sessions");
    if (sessions && typeof sessions.get === "function") {
      try {
        const session = sessions.get(sid);
        const cwd = session && session.header && session.header.cwd;
        if (typeof cwd === "string" && cwd) return { ok: true, cwd };
      } catch (error) {
      }
    }
    const query = this.ctx.get("sessionQuery");
    if (query && typeof query.listSessions === "function") {
      try {
        const rows = await query.listSessions();
        const hit = (rows || []).find((row) => row && row.id === sid);
        const cwd = hit && hit.header && hit.header.cwd;
        if (typeof cwd === "string" && cwd) return { ok: true, cwd };
      } catch (error) {
      }
    }
    return { ok: false, error: "\u4F1A\u8BDD\u4E0D\u5B58\u5728\u6216\u4E0D\u53EF\u8BFB: " + sid };
  }
};
for (const method of ["tools", "panel", "plugins", "sessionInfo"]) exposeRemote(NativeToolboxRemote, method);
async function apply(ctx) {
  const registry = makeStaticRegistry();
  ctx.provide(TOOLBOX_RUNTIME.registryService, registry);
  const features = [create_flow()];
  for (const feature of features) {
    if (!feature || typeof feature.apply !== "function") throw new Error("\u9759\u6001 feature \u672A\u8FD4\u56DE\u6709\u6548\u63D2\u4EF6\u5BF9\u8C61");
    const disposer = await feature.apply(ctx);
    if (typeof disposer === "function") ctx.effect(() => disposer);
  }
  new NativeToolboxRemote(ctx, registry);
  console.log(TOOLBOX_RUNTIME.logTag() + " \u539F\u751F\u9759\u6001 Host \u5DF2\u52A0\u8F7D\uFF08\u529F\u80FD: " + registry.tools().map((x) => x.id).join(", ") + "\uFF09");
}

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
var PLUGIN_VERSION = false ? "dev" : "0.1.1";
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
  const spawnShell = () => process.platform === "win32" ? { cmd: "powershell.exe", args: ["-NoLogo"] } : { cmd: process.env.SHELL || "/bin/bash", args: [] };
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
function registerRoute(ctx, webServer, route) {
  return ctx.effect(() => webServer.register(route), `dsh-mytable: ${route.kind} ${route.path}`);
}
async function apply2(ctx) {
  if (typeof ctx.inject === "function") {
    ;
    ctx.inject(["fs", "sessionQuery", "timer"], (flowCtx) => {
      void Promise.resolve(apply(flowCtx)).catch((error) => {
        flowCtx.logger?.warn?.("[dsh-mytable] \u6D41\u955C Host \u542F\u52A8\u5931\u8D25\uFF1A" + String(error));
      });
    });
  }
  const webServer = ctx.webServer;
  if (!webServer) {
    ctx.logger?.warn("[dsh-mytable] ctx.webServer \u4E0D\u53EF\u7528\uFF08headless profile\uFF1F\uFF09\uFF0C\u8DF3\u8FC7\u670D\u52A1\u7AEF\u8DEF\u7531");
    return;
  }
  registerRoute(ctx, webServer, {
    kind: "exact",
    path: HEALTH_PATH,
    handler: (_req, res) => {
      json(res, 200, { plugin: "dsh-mytable", version: PLUGIN_VERSION, ok: true });
    }
  });
  registerRoute(ctx, webServer, {
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
  registerRoute(ctx, webServer, {
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
  registerRoute(ctx, webServer, {
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
  registerRoute(ctx, webServer, {
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
  registerRoute(ctx, webServer, {
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
  registerRoute(ctx, webServer, {
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
  registerRoute(ctx, webServer, {
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
  registerRoute(ctx, webServer, {
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
  registerRoute(ctx, webServer, {
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
  registerRoute(ctx, webServer, {
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
  registerRoute(ctx, webServer, {
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
  registerRoute(ctx, webServer, {
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
  registerRoute(ctx, webServer, {
    kind: "exact",
    path: "/api/worktable/git-stage",
    handler: (req, res) => gitAction(req, res, async (root, body) => {
      const rel = typeof body.path === "string" && body.path ? body.path : "";
      return gitRun(root, rel !== "" ? ["add", "--", rel] : ["add", "-A"]);
    })
  });
  registerRoute(ctx, webServer, {
    kind: "exact",
    path: "/api/worktable/git-unstage",
    handler: (req, res) => gitAction(req, res, async (root, body) => {
      const rel = typeof body.path === "string" && body.path ? body.path : "";
      const hasHead = await gitExec(["rev-parse", "--verify", "HEAD"], root).then(() => true).catch(() => false);
      if (hasHead) return gitRun(root, rel !== "" ? ["reset", "-q", "HEAD", "--", rel] : ["reset", "-q", "HEAD"]);
      return gitRun(root, rel !== "" ? ["rm", "--cached", "-q", "--", rel] : ["rm", "--cached", "-r", "-q", "--", "."]);
    })
  });
  registerRoute(ctx, webServer, {
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
  registerRoute(ctx, webServer, {
    kind: "exact",
    path: "/api/worktable/git-commit",
    handler: (req, res) => gitAction(req, res, async (root, body) => {
      const message = typeof body.message === "string" ? body.message.trim() : "";
      if (message === "") return { ok: false, output: "missing message" };
      return gitRun(root, ["commit", "-m", message]);
    })
  });
  registerRoute(ctx, webServer, {
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
  registerRoute(ctx, webServer, {
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
  registerRoute(ctx, webServer, {
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
  registerRoute(ctx, webServer, {
    kind: "exact",
    path: "/api/worktable/git-show",
    handler: (req, res) => gitAction(req, res, async (root, body) => {
      const hash = typeof body.hash === "string" ? body.hash.trim() : "";
      if (hash === "") return { ok: false, output: "missing hash" };
      const out = await gitRun(root, ["show", "--no-ext-diff", "--no-color", "--format=", "-U3", "-m", "--first-parent", hash]);
      return out.ok ? { ok: true, output: out.output.slice(0, DIFF_MAX_BYTES_TOTAL) } : out;
    })
  });
  registerRoute(ctx, webServer, {
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
  registerRoute(ctx, webServer, {
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
  registerRoute(ctx, webServer, {
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
  registerRoute(ctx, webServer, {
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
  registerRoute(ctx, webServer, {
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
  apply2 as apply,
  inject,
  name
};
