// Ingestão da lista de empresas (CSV ou JSON) -> leads status=novo.
// Uso: node src/ingest.js lista.csv | lista.json
import { readFileSync } from 'node:fs';
import { openDb, upsertLead } from './db.js';

export function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const split = (l) => {
    const out = []; let cur = '', q = false;
    for (const c of l) {
      if (c === '"') q = !q;
      else if (c === ',' && !q) { out.push(cur.trim()); cur = ''; }
      else cur += c;
    }
    out.push(cur.trim());
    return out;
  };
  const headers = split(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'));
  return lines.slice(1).map(l => Object.fromEntries(split(l).map((v, i) => [headers[i], v])));
}

export function ingestFile(db, path) {
  const raw = readFileSync(path, 'utf8');
  const rows = path.endsWith('.json') ? JSON.parse(raw) : parseCsv(raw);
  let n = 0;
  for (const row of rows) {
    if (!row.whatsapp || !String(row.whatsapp).trim()) { console.warn(`[ingest] pulado (sem whatsapp): ${JSON.stringify(row).slice(0, 80)}`); continue; }
    upsertLead(db, row);
    n++;
  }
  return n;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const path = process.argv[2];
  if (!path) { console.error('Uso: node src/ingest.js <lista.csv|lista.json>'); process.exit(1); }
  const db = openDb();
  const n = ingestFile(db, path);
  console.log(`[ingest] ${n} lead(s) carregado(s)/atualizado(s).`);
}
