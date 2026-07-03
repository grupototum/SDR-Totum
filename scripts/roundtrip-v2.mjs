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

const fixtures = [`${root}docs/flow_odonto_stages_v2.json`, `${root}engine/flows/flow_odonto_v2.6.json`];

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

let failed = false;

// ─── Copilot: flow sintético (mesmo shape que WizardMode.applyToStore produz) ─
const docsDefault = JSON.parse(readFileSync(fixtures[0], "utf8"));
const copilotFlow = {
  flow_id: "copilot_smoke_test",
  name: "Copilot smoke test",
  version: docsDefault.version,
  niche: "Odontologia",
  channel: docsDefault.channel,
  objective: "Agendar uma conversa.",
  meta: { authoring_mode: "copilot" },
  globals: { ...docsDefault.globals, guardrails: ["Nunca falar preço antes da prévia"] },
  entry_stage: "abertura",
  stages: [
    {
      id: "abertura",
      goal: "Abrir contato",
      instruction: "Se apresente e confirme a empresa.",
      advance_when: "O lead respondeu.",
      reference_copy: ["Oi! Tudo bem?"],
      next: "diagnostico",
    },
    {
      id: "diagnostico",
      goal: "Mostrar oportunidade",
      instruction: "Explique o que encontrou na pesquisa.",
      advance_when: "O lead reconheceu a dor.",
      reference_copy: ["Percebi uma oportunidade na sua clínica."],
      next: "encerrado",
    },
    {
      id: "encerrado",
      goal: "Encerrar",
      instruction: "Encerre cordialmente.",
      advance_when: "Conversa encerrada.",
      reference_copy: ["Obrigado pelo papo!"],
      terminal: true,
    },
  ],
};

{
  console.log("\n(sintético) flow autorado no Copilot — formato: v2 (3 estágios)");
  const flow = parseFlowV2(JSON.stringify(copilotFlow));
  const exported = JSON.parse(serializeFlowV2(flow));
  diffs.length = 0;
  walk(copilotFlow, exported, "flow");
  if (diffs.length === 0 && exported.meta?.authoring_mode === "copilot") {
    console.log("  ✅ round-trip Copilot↔Flow Builder OK (mesmo objeto, meta.authoring_mode preservado)");
  } else {
    failed = true;
    console.log(`  ❌ ${diffs.length} diferença(s) ou meta.authoring_mode perdido:`);
    for (const d of diffs.slice(0, 60)) console.log("    " + d);
  }

  const { runPersona } = await import(`${root}engine/sim/run.js`);
  const persona = JSON.parse(readFileSync(`${root}engine/sim/personas.json`, "utf8"))[0];
  const result = await runPersona(persona, { flow: copilotFlow, llm: "mock" });
  if (result?.log?.length > 0) {
    console.log(`  ✅ flow do Copilot roda no simulador (${result.log.length} linhas de transcript)`);
  } else {
    failed = true;
    console.log("  ❌ flow do Copilot não produziu transcript no simulador");
  }
}

for (const path of fixtures) {
  const original = readFileSync(path, "utf8");
  const origParsed = JSON.parse(original);
  console.log(`\n${path.replace(root, "")} — formato: ${detectFormat(origParsed)}`);

  const flow = parseFlowV2(original);
  console.log(
    `  importado: ${flow.stages.length} estágios, ${(flow.interrupts ?? []).length} interrupção(ões), entry=${flow.entry_stage}`,
  );
  const exported = serializeFlowV2(flow);
  const expParsed = JSON.parse(exported);

  diffs.length = 0;
  walk(origParsed, expParsed, "flow");
  if (diffs.length === 0) {
    console.log("  ✅ round-trip lossless OK");
  } else {
    failed = true;
    console.log(`  ❌ ${diffs.length} diferença(s):`);
    for (const d of diffs.slice(0, 60)) console.log("    " + d);
  }
}

process.exit(failed ? 1 : 0);
