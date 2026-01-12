import { app as v, Menu as K, ipcMain as y, shell as Q, BrowserWindow as $ } from "electron";
import { fileURLToPath as Y } from "node:url";
import l from "node:path";
import O from "node:fs/promises";
import h from "node:fs";
import { spawn as k } from "node:child_process";
const B = l.dirname(Y(import.meta.url));
process.env.APP_ROOT = l.join(B, "..");
const F = process.env.VITE_DEV_SERVER_URL, Pt = l.join(process.env.APP_ROOT, "dist-electron"), W = l.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = F ? l.join(process.env.APP_ROOT, "public") : W;
const g = /* @__PURE__ */ new Map(), N = /* @__PURE__ */ new Map(), j = /* @__PURE__ */ new Map(), D = 2e3, Z = /* @__PURE__ */ new Set([
  "node_modules",
  ".git",
  ".svn",
  ".hg",
  ".idea",
  ".vscode",
  "dist",
  "build",
  "out",
  "coverage",
  "tmp",
  "temp",
  ".cache",
  ".next"
]), tt = ["node", "nodejs", "npm", "npx", "pnpm", "yarn", "bun", "deno", "electron", "vite"];
let u, H = !1;
const U = "npm was not found. Install Node.js or ensure npm is available in your PATH (e.g. system install, nvm, volta, or asdf).", V = "node was not found. Install Node.js or ensure node is available in your PATH (e.g. system install, nvm, volta, or asdf).";
function b(t) {
  if (t.length === 0)
    return process.env.PATH ?? "";
  const n = (process.env.PATH ?? "").split(l.delimiter).filter(Boolean);
  let o = !1;
  for (const s of t)
    s && (n.includes(s) || (n.push(s), o = !0));
  return o && (process.env.PATH = n.join(l.delimiter)), process.env.PATH ?? "";
}
function x() {
  if (H)
    return process.env.PATH ?? "";
  const e = (process.env.PATH ?? "").split(l.delimiter).filter(Boolean), n = v.isReady() ? v.getPath("home") : process.env.HOME ?? process.env.USERPROFILE ?? "", o = [];
  return n && o.push(
    l.join(n, ".local", "bin"),
    l.join(n, ".npm-global", "bin"),
    l.join(n, ".volta", "bin"),
    l.join(n, ".asdf", "bin"),
    l.join(n, ".asdf", "shims")
  ), process.platform !== "win32" && o.push("/usr/local/bin", "/usr/bin", "/bin", "/snap/bin"), process.platform === "darwin" && o.push("/opt/homebrew/bin", "/opt/homebrew/sbin"), b([...e, ...o]), H = !0, process.env.PATH ?? "";
}
function E(t) {
  try {
    return h.accessSync(t, h.constants.X_OK), !0;
  } catch {
    return !1;
  }
}
function M(t) {
  var s;
  const n = x().split(l.delimiter).filter(Boolean), o = process.platform === "win32" ? ((s = process.env.PATHEXT) == null ? void 0 : s.split(";").filter(Boolean)) ?? [".EXE", ".CMD", ".BAT"] : [""];
  for (const r of n)
    for (const i of o) {
      const a = l.join(r, `${t}${i}`);
      if (h.existsSync(a))
        return a;
    }
  return null;
}
function J(t, e) {
  const n = (i) => i.replace(/^v/, "").split(".").map((a) => Number(a)), o = n(t), s = n(e), r = Math.max(o.length, s.length);
  for (let i = 0; i < r; i += 1) {
    const a = (o[i] ?? 0) - (s[i] ?? 0);
    if (a !== 0)
      return a;
  }
  return 0;
}
function G() {
  x();
  const t = M("npm");
  if (t && E(t))
    return b([l.dirname(t)]), t;
  const e = v.getPath("home"), n = [
    l.join(e, ".volta", "bin", "npm"),
    l.join(e, ".asdf", "shims", "npm")
  ];
  for (const s of n)
    if (h.existsSync(s) && E(s))
      return b([l.dirname(s)]), s;
  const o = l.join(e, ".nvm", "versions", "node");
  if (h.existsSync(o)) {
    const s = h.readdirSync(o).filter((i) => i.startsWith("v")).sort(J), r = s[s.length - 1];
    if (r) {
      const i = l.join(o, r, "bin", "npm");
      if (h.existsSync(i) && E(i))
        return b([l.dirname(i)]), i;
    }
  }
  return null;
}
function X() {
  x();
  const t = M("node");
  if (t && E(t))
    return b([l.dirname(t)]), t;
  const e = M("nodejs");
  if (e && E(e))
    return b([l.dirname(e)]), e;
  const n = v.isReady() ? v.getPath("home") : process.env.HOME ?? process.env.USERPROFILE ?? "";
  if (n) {
    const o = [
      l.join(n, ".volta", "bin", "node"),
      l.join(n, ".asdf", "shims", "node")
    ];
    for (const r of o)
      if (h.existsSync(r) && E(r))
        return b([l.dirname(r)]), r;
    const s = l.join(n, ".nvm", "versions", "node");
    if (h.existsSync(s)) {
      const r = h.readdirSync(s).filter((a) => a.startsWith("v")).sort(J), i = r[r.length - 1];
      if (i) {
        const a = l.join(s, i, "bin", "node");
        if (h.existsSync(a) && E(a))
          return b([l.dirname(a)]), a;
      }
    }
  }
  return null;
}
v.disableHardwareAcceleration();
K.setApplicationMenu(null);
function q() {
  u = new $({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    autoHideMenuBar: !0,
    icon: l.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: l.join(B, "preload.mjs")
    }
  }), u.webContents.on("did-finish-load", () => {
    u == null || u.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), F ? u.loadURL(F) : u.loadFile(l.join(W, "index.html"));
}
function _(t, e) {
  const n = N.get(t) ?? [];
  n.push(e), n.length > D && n.splice(0, n.length - D), N.set(t, n);
}
function A(t) {
  const e = t.toLowerCase();
  return tt.some((n) => e.includes(n));
}
function L(t) {
  const e = t.trim().replace(/\[|\]/g, ""), n = e.lastIndexOf(":");
  if (n <= 0)
    return null;
  const o = Number(e.slice(n + 1));
  return Number.isFinite(o) ? { address: e.slice(0, n) || "*", port: o } : null;
}
function et(t) {
  const e = t.replace(/^TCP\s+/i, "").replace(/\s*\(LISTEN\)\s*$/i, "");
  return L(e);
}
function P(t, e) {
  return new Promise((n) => {
    var i, a;
    x();
    const o = k(t, e, { shell: process.platform === "win32" });
    let s = "", r = "";
    (i = o.stdout) == null || i.on("data", (c) => {
      s += c.toString();
    }), (a = o.stderr) == null || a.on("data", (c) => {
      r += c.toString();
    }), o.on("close", (c) => n({ stdout: s, stderr: r, exitCode: c })), o.on("error", () => n({ stdout: s, stderr: r, exitCode: null }));
  });
}
function nt(t) {
  const e = [];
  let n = "", o = !1;
  for (const s of t) {
    if (s === '"') {
      o = !o;
      continue;
    }
    if (s === "," && !o) {
      e.push(n), n = "";
      continue;
    }
    n += s;
  }
  return e.push(n), e;
}
async function st() {
  const { stdout: t } = await P("lsof", ["-nP", "-iTCP", "-sTCP:LISTEN", "-F", "pcn"]);
  if (!t)
    return [];
  const e = [], n = /* @__PURE__ */ new Set();
  let o = null, s = "";
  for (const r of t.split(`
`)) {
    if (!r)
      continue;
    const i = r[0], a = r.slice(1);
    if (i === "p") {
      o = Number(a);
      continue;
    }
    if (i === "c") {
      s = a;
      continue;
    }
    if (i !== "n" || !o || !s || o === process.pid || !A(s))
      continue;
    const c = et(a);
    if (!c)
      continue;
    const d = `${o}:${c.port}`;
    n.has(d) || (n.add(d), e.push({ port: c.port, pid: o, command: s, address: c.address }));
  }
  return e;
}
async function ot() {
  const { stdout: t } = await P("ss", ["-lptn"]);
  if (!t)
    return [];
  const e = [], n = /* @__PURE__ */ new Set();
  for (const o of t.split(`
`)) {
    if (!o.startsWith("LISTEN"))
      continue;
    const r = o.trim().split(/\s+/)[3], i = o.match(/users:\(\("?([^",]+)"?,pid=(\d+)/);
    if (!r || !i)
      continue;
    const a = i[1], c = Number(i[2]);
    if (!Number.isFinite(c) || c === process.pid || !A(a))
      continue;
    const d = L(r);
    if (!d)
      continue;
    const m = `${c}:${d.port}`;
    n.has(m) || (n.add(m), e.push({ port: d.port, pid: c, command: a, address: d.address }));
  }
  return e;
}
async function rt() {
  const { stdout: t } = await P("netstat", ["-lntp"]);
  if (!t)
    return [];
  const e = [], n = /* @__PURE__ */ new Set();
  for (const o of t.split(`
`)) {
    const s = o.trim();
    if (!s.startsWith("tcp"))
      continue;
    const r = s.split(/\s+/);
    if (r.length < 7)
      continue;
    const i = r[3], a = r[6], [c, d] = a.split("/"), m = Number(c);
    if (!Number.isFinite(m) || m === process.pid || !A(d ?? ""))
      continue;
    const p = L(i);
    if (!p)
      continue;
    const f = `${m}:${p.port}`;
    n.has(f) || (n.add(f), e.push({ port: p.port, pid: m, command: d, address: p.address }));
  }
  return e;
}
async function it() {
  const { stdout: t } = await P("tasklist", ["/FO", "CSV", "/NH"]), e = /* @__PURE__ */ new Map();
  for (const n of t.split(`
`)) {
    const o = n.trim();
    if (!o)
      continue;
    const s = nt(o);
    if (s.length < 2)
      continue;
    const r = Number(s[1]);
    Number.isFinite(r) && e.set(r, s[0]);
  }
  return e;
}
async function at() {
  const { stdout: t } = await P("netstat", ["-ano", "-p", "TCP"]);
  if (!t)
    return [];
  const e = await it(), n = [], o = /* @__PURE__ */ new Set();
  for (const s of t.split(`
`)) {
    const r = s.trim();
    if (!r.toUpperCase().startsWith("TCP"))
      continue;
    const i = r.split(/\s+/);
    if (i.length < 5)
      continue;
    const a = i[1], c = i[3], d = Number(i[4]);
    if (c.toUpperCase() !== "LISTENING" || !Number.isFinite(d) || d === process.pid)
      continue;
    const m = e.get(d) ?? "";
    if (!A(m))
      continue;
    const p = L(a);
    if (!p)
      continue;
    const f = `${d}:${p.port}`;
    o.has(f) || (o.add(f), n.push({ port: p.port, pid: d, command: m, address: p.address }));
  }
  return n;
}
async function ct() {
  const t = process.platform === "win32" ? await at() : await st();
  if (t.length > 0)
    return t.sort((e, n) => e.port - n.port);
  if (process.platform !== "win32") {
    const e = await ot();
    return e.length > 0 ? e.sort((o, s) => o.port - s.port) : (await rt()).sort((o, s) => o.port - s.port);
  }
  return [];
}
async function lt(t) {
  if (!Number.isFinite(t))
    return { status: "error", message: "Invalid PID." };
  if (t === process.pid)
    return { status: "error", message: "Cannot terminate the application process." };
  if (process.platform === "win32")
    return (await P("taskkill", ["/pid", `${t}`, "/t", "/f"])).exitCode !== 0 ? { status: "error", message: "Failed to terminate the process." } : { status: "killed" };
  try {
    return process.kill(t, "SIGTERM"), { status: "killed" };
  } catch {
    return { status: "error", message: "Failed to terminate the process." };
  }
}
function z() {
  return process.platform === "win32" ? `${process.env.SystemDrive ?? "C:"}\\` : "/";
}
async function ut(t) {
  if (!h.existsSync(t))
    return [];
  const e = await dt(t);
  return (await Promise.all(
    e.map(async (s) => {
      var r;
      try {
        const i = await O.readFile(s, "utf8"), a = JSON.parse(i), c = a.scripts ?? {}, d = !!c.dev, m = !!c.start;
        if (!d && !m)
          return null;
        const p = l.dirname(s), f = j.get(p), C = g.has(p), I = (f == null ? void 0 : f.status) ?? (C ? "running" : "stopped"), T = (f == null ? void 0 : f.command) ?? (C ? (r = g.get(p)) == null ? void 0 : r.command : void 0), R = {
          path: p,
          name: a.name ?? l.basename(p),
          hasDev: d,
          hasStart: m,
          status: I,
          exitCode: (f == null ? void 0 : f.exitCode) ?? null
        };
        return T && (R.command = T), R;
      } catch {
        return null;
      }
    })
  )).filter((s) => s !== null).sort((s, r) => s.name.localeCompare(r.name));
}
async function dt(t) {
  if (process.platform !== "win32") {
    const e = await pt(t);
    if (e.length)
      return e;
  }
  return ft(t);
}
function pt(t) {
  return new Promise((e) => {
    x();
    const n = [], s = k("find", [
      t,
      "-type",
      "f",
      "-name",
      "package.json",
      "-not",
      "-path",
      "*/node_modules/*",
      "-not",
      "-path",
      "*/.*/*",
      "-not",
      "-path",
      "*/.git/*",
      "-not",
      "-path",
      "*/dist/*",
      "-not",
      "-path",
      "*/build/*"
    ]);
    let r = "";
    s.stdout.on("data", (i) => {
      r += i.toString();
      const a = r.split(`
`);
      r = a.pop() ?? "";
      for (const c of a) {
        const d = c.trim();
        d.length > 0 && n.push(d);
      }
    }), s.stderr.on("data", () => {
    }), s.on("close", () => {
      r.trim().length > 0 && n.push(r.trim()), e(n);
    }), s.on("error", () => e(n));
  });
}
async function ft(t) {
  const e = [], n = [t];
  for (; n.length > 0; ) {
    const o = n.pop();
    if (!o)
      continue;
    let s;
    try {
      s = await O.readdir(o, { withFileTypes: !0 });
    } catch {
      continue;
    }
    for (const r of s) {
      if (r.isDirectory()) {
        if (r.name.startsWith(".") || Z.has(r.name))
          continue;
        n.push(l.join(o, r.name));
        continue;
      }
      r.isFile() && r.name === "package.json" && e.push(l.join(o, r.name));
    }
  }
  return e;
}
async function mt(t) {
  var f, C, I, T, R;
  if (g.has(t))
    return { status: "running", command: (f = g.get(t)) == null ? void 0 : f.command };
  const e = l.join(t, "package.json");
  let n;
  try {
    const w = await O.readFile(e, "utf8");
    n = JSON.parse(w);
  } catch {
    return { status: "error", message: "Cannot read package.json." };
  }
  const o = n.scripts ?? {}, s = !!o.dev, r = !!o.start;
  if (!s && !r)
    return { status: "error", message: "Missing dev or start script in package.json." };
  const i = s ? "npm run dev" : "npm start", a = s ? ["run", "dev"] : ["start"], c = G();
  if (!c)
    return { status: "error", message: U };
  if (!X())
    return { status: "error", message: V };
  const m = process.platform === "win32", p = k(c, a, {
    cwd: t,
    env: { ...process.env },
    shell: m,
    detached: process.platform !== "win32"
  });
  return N.set(t, []), j.set(t, { status: "running", command: i, exitCode: null }), g.set(t, { process: p, command: i }), (C = p.stdout) == null || C.setEncoding("utf8"), (I = p.stderr) == null || I.setEncoding("utf8"), (T = p.stdout) == null || T.on("data", (w) => {
    const S = w.toString();
    _(t, S), u == null || u.webContents.send("projects:output", { path: t, data: S, source: "stdout" });
  }), (R = p.stderr) == null || R.on("data", (w) => {
    const S = w.toString();
    _(t, S), u == null || u.webContents.send("projects:output", { path: t, data: S, source: "stderr" });
  }), p.on("close", (w, S) => {
    g.delete(t), j.set(t, { status: "stopped", command: i, exitCode: w }), u == null || u.webContents.send("projects:exit", { path: t, code: w, signal: S, command: i });
  }), p.on("error", () => {
    g.delete(t), j.set(t, { status: "error", command: i, exitCode: null }), u == null || u.webContents.send("projects:exit", { path: t, code: null, signal: "error", command: i });
  }), { status: "running", command: i };
}
function ht(t) {
  const e = t.process;
  if (!e.pid)
    return;
  if (process.platform === "win32") {
    k("taskkill", ["/pid", `${e.pid}`, "/t", "/f"]);
    return;
  }
  const n = e.pid, o = (r) => {
    try {
      process.kill(-n, r);
    } catch {
      try {
        process.kill(n, r);
      } catch {
        return;
      }
    }
  };
  o("SIGTERM");
  const s = setTimeout(() => o("SIGKILL"), 5e3);
  e.once("exit", () => clearTimeout(s));
}
function gt(t) {
  const e = g.get(t);
  return e ? (ht(e), g.delete(t), j.set(t, { status: "stopped", command: e.command, exitCode: null }), { status: "stopped" }) : { status: "stopped" };
}
async function vt(t) {
  var r, i;
  if (g.has(t))
    return { status: "error", message: "Process is currently running. Stop it before installing." };
  const e = G();
  if (!e)
    return { status: "error", message: U };
  if (!X())
    return { status: "error", message: V };
  const o = process.platform === "win32", s = k(e, ["install"], {
    cwd: t,
    env: { ...process.env },
    shell: o
  });
  return N.set(t, []), u == null || u.webContents.send("projects:output", { path: t, data: `> npm install
`, source: "stdout" }), (r = s.stdout) == null || r.on("data", (a) => {
    const c = a.toString();
    _(t, c), u == null || u.webContents.send("projects:output", { path: t, data: c, source: "stdout" });
  }), (i = s.stderr) == null || i.on("data", (a) => {
    const c = a.toString();
    _(t, c), u == null || u.webContents.send("projects:output", { path: t, data: c, source: "stderr" });
  }), new Promise((a) => {
    s.on("close", (c) => {
      a({ status: c === 0 ? "success" : "error", code: c });
    }), s.on("error", (c) => {
      a({ status: "error", message: c.message });
    });
  });
}
y.handle("projects:default-root", () => z());
y.handle("projects:scan", async (t, e) => {
  const n = typeof e == "string" && e.trim().length > 0 ? e.trim() : z();
  return ut(n);
});
y.handle("projects:start", async (t, e) => mt(e));
y.handle("projects:stop", (t, e) => gt(e));
y.handle("projects:install", async (t, e) => vt(e));
y.handle("projects:logs", (t, e) => N.get(e) ?? []);
y.handle("ports:list", async () => ct());
y.handle("ports:kill", async (t, e) => lt(e));
y.handle("shell:open-external", async (t, e) => {
  if (typeof e == "string")
    try {
      const n = new URL(e);
      if (n.protocol !== "http:" && n.protocol !== "https:")
        return;
      await Q.openExternal(n.toString());
    } catch {
      return;
    }
});
v.on("window-all-closed", () => {
  process.platform !== "darwin" && (v.quit(), u = null);
});
v.on("activate", () => {
  $.getAllWindows().length === 0 && q();
});
v.whenReady().then(() => {
  x(), q();
});
export {
  Pt as MAIN_DIST,
  W as RENDERER_DIST,
  F as VITE_DEV_SERVER_URL
};
