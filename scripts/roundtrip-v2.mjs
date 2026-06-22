// Round-trip verification for the v2 STAGE-LEVEL schema (flow-v2.ts).
// Bundles the pure TS lib (type-only imports erased), then imports -> exports
// docs/flow_odonto_stages_v2.json and deep-compares (lossless check).
import { readFileSync } from "node:fs";
import { build } from "esbuild";

const root = decodeURIComponent(new URL("..", import.meta.url).pathname);

const out = await build({
  entryPoints: [`${root}src/lib/flow-v2.ts`],
  bundle: true,
  format: "esm",
  write: false,
  platform: "node",
});
const mod = await import(
  "data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64")
);
const { parseFlowV2, serializeFlowV2, detectFormat } = mod;

const original = readFileSync(`${root}docs/flow_odonto_stages_v2.json`, "utf8");
const origParsed = JSON.parse(original);

console.log(`Formato detectado: ${detectFormat(origParsed)}`);

// IMPORT -> EXPORT
const flow = parseFlowV2(original);
console.log(
  `Importado: ${flow.stages.length} estágios, ${(flow.interrupts ?? []).length} interrupção(ões), entry=${flow.entry_stage}`,
);
const exported = serializeFlowV2(flow);
const expParsed = JSON.parse(exported);

// ─── Deep compare (key-order insensitive, array-order sensitive) ─────────────
const diffs = [];
function walk(a, b, path) {
  if (a === b) return;
  const ta = Array.isArray(a) ? "array" : a === null ? "null" : typeof a;
  const tb = Array.isArray(b) ? "array" : b === null ? "null" : typeof b;
  if (ta !== tb) {
    diffs.push(`${path}: type ${ta} -> ${tb}`);
    return;
  }
  if (ta === "array") {
    if (a.length !== b.length) diffs.push(`${path}: array length ${a.length} -> ${b.length}`);
    for (let i = 0; i < Math.max(a.length, b.length); i++) walk(a[i], b[i], `${path}[${i}]`);
    return;
  }
  if (ta === "object") {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if (!(k in a)) diffs.push(`${path}.${k}: ADDED ${JSON.stringify(b[k])}`);
      else if (!(k in b)) diffs.push(`${path}.${k}: REMOVED ${JSON.stringify(a[k])}`);
      else walk(a[k], b[k], `${path}.${k}`);
    }
    return;
  }
  diffs.push(`${path}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
}

walk(origParsed, expParsed, "flow");

if (diffs.length === 0) {
  console.log("\n✅ V2 ROUND-TRIP OK — import→export lossless (estrutura idêntica).");
  process.exit(0);
} else {
  console.log(`\n❌ ${diffs.length} diferença(s):\n`);
  for (const d of diffs.slice(0, 60)) console.log("  " + d);
  process.exit(1);
}
