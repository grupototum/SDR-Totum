// Round-trip verification harness for flow-serializer.ts
// Transpiles the TS serializer (type-only imports are erased) and runs
// import -> export against the real 181-node spec file, then deep-compares.
import { readFileSync } from "node:fs";
import { build } from "esbuild";

const root = decodeURIComponent(new URL("..", import.meta.url).pathname);

// Bundle the serializer; type-only imports (@/stores, @xyflow/react) are erased.
const out = await build({
  entryPoints: [`${root}src/lib/flow-serializer.ts`],
  bundle: true,
  format: "esm",
  write: false,
  platform: "node",
  external: ["@xyflow/react", "@/stores/flow-store"],
});
const mod = await import(
  "data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64")
);
const { importFlow, exportFlow } = mod;

const original = readFileSync(`${root}docs/flow_odonto_sdr_v1.json`, "utf8");
const origParsed = JSON.parse(original);

// IMPORT
const res = importFlow(original);
console.log(`Imported: ${res.nodes.length} nodes, ${res.edges.length} edges`);

// Reconstruct full humanization (export needs a complete config)
const humanization = {
  readingSpeed: 225,
  typingSpeed: 40,
  alwaysTyping: true,
  maxConsecutive: 3,
  sendWindowStart: "08:00",
  sendWindowEnd: "22:00",
  timezone: "America/Sao_Paulo",
  ...res.humanization,
};

// EXPORT
const exported = exportFlow({
  nodes: res.nodes,
  edges: res.edges,
  envelope: res.envelope,
  humanization,
  interrupts: res.interrupts,
});
const expParsed = JSON.parse(exported);

// ─── Deep compare (object-key-order insensitive, array-order sensitive) ───
const diffs = [];
function walk(a, b, path) {
  if (a === b) return;
  const ta = Array.isArray(a) ? "array" : a === null ? "null" : typeof a;
  const tb = Array.isArray(b) ? "array" : b === null ? "null" : typeof b;
  if (ta !== tb) {
    diffs.push(`${path}: type ${ta} -> ${tb} (${JSON.stringify(a)} -> ${JSON.stringify(b)})`);
    return;
  }
  if (ta === "array") {
    if (a.length !== b.length) diffs.push(`${path}: array length ${a.length} -> ${b.length}`);
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) walk(a[i], b[i], `${path}[${i}]`);
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

// Compare node-by-node keyed by id (order independent), plus envelope.
const origNodes = new Map(origParsed.nodes.map((n) => [n.id, n]));
const expNodes = new Map(expParsed.nodes.map((n) => [n.id, n]));
if (origNodes.size !== expNodes.size)
  diffs.push(`node count ${origNodes.size} -> ${expNodes.size}`);
for (const [id, n] of origNodes) {
  if (!expNodes.has(id)) {
    diffs.push(`node ${id}: MISSING in export`);
    continue;
  }
  walk(n, expNodes.get(id), `node(${id})`);
}

// Envelope (excluding nodes + globals which are intentionally reformatted)
const stripEnv = (o) => {
  const { nodes, globals, ...rest } = o;
  return rest;
};
walk(stripEnv(origParsed), stripEnv(expParsed), "envelope");

if (diffs.length === 0) {
  console.log("\n✅ ROUND-TRIP OK — every node + envelope field preserved.");
  process.exit(0);
} else {
  console.log(`\n❌ ${diffs.length} difference(s):\n`);
  for (const d of diffs.slice(0, 60)) console.log("  " + d);
  if (diffs.length > 60) console.log(`  ... +${diffs.length - 60} more`);
  process.exit(1);
}
