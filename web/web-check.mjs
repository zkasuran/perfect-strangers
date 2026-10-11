// Minimal headless-Chrome checker over CDP (Node 22 global WebSocket, no deps).
// Opens a page target, emulates a color scheme, navigates, records console
// errors, page errors and CSP violations, confirms the game rendered, writes a
// screenshot. Usage: node web-check.mjs <url> <light|dark> <out.png> [dbg]
import { writeFileSync } from "node:fs";

const [url, scheme = "light", out = "/tmp/shot.png", dbg = "http://127.0.0.1:9444"] = process.argv.slice(2);

// open a fresh page target at about:blank so we can set emulation before load
let r = await fetch(`${dbg}/json/new?about:blank`, { method: "PUT" });
if (!r.ok) r = await fetch(`${dbg}/json/new?about:blank`);
const target = await r.json();

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let id = 0;
const pending = new Map();
const logs = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  const p = m.params || {};
  if (m.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(p.type))
    logs.push(`console.${p.type}: ${(p.args || []).map((a) => a.value ?? a.description ?? "").join(" ")}`);
  if (m.method === "Runtime.exceptionThrown")
    logs.push(`pageerror: ${p.exceptionDetails?.exception?.description || p.exceptionDetails?.text}`);
  if (m.method === "Log.entryAdded" && ["error", "warning"].includes(p.entry?.level))
    logs.push(`log.${p.entry.level}: ${p.entry.text}`);
};
const cmd = (method, params = {}) =>
  new Promise((res) => { const i = ++id; pending.set(i, (m) => (m.error ? res({ error: m.error }) : res(m.result))); ws.send(JSON.stringify({ id: i, method, params })); });

await cmd("Page.enable");
await cmd("Runtime.enable");
await cmd("Log.enable");
const vw = +(process.argv[6] || 0);
const vh = +(process.argv[7] || 0);
if (vw) await cmd("Emulation.setDeviceMetricsOverride", { width: vw, height: vh, deviceScaleFactor: 2, mobile: false });
await cmd("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] });
await cmd("Page.navigate", { url });
await new Promise((res) => setTimeout(res, 3500)); // let modules load and the game render

const probe = await cmd("Runtime.evaluate", {
  expression: `JSON.stringify({
    attemptBtns: document.querySelectorAll('#attempt button').length,
    chips: document.querySelectorAll('#attemptResult .chip').length,
    theme: document.documentElement.getAttribute('data-theme'),
    verdict: (document.getElementById('verdict')||{}).textContent
  })`, returnByValue: true,
});
const shot = await cmd("Page.captureScreenshot", { format: "png", captureBeyondViewport: !vw });
if (shot.data) writeFileSync(out, Buffer.from(shot.data, "base64"));

console.log("scheme:", scheme, "render:", probe?.result?.value || JSON.stringify(probe));
console.log("issues:", logs.length ? JSON.stringify(logs, null, 2) : "none");
ws.close();
process.exit(logs.length ? 2 : 0);
