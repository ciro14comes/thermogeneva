// MapLibre v6: il worker è un file separato (maplibre-gl-worker.mjs) che importa
// maplibre-gl-shared.mjs con un percorso relativo. Li copiamo insieme in public/maplibre/
// così il browser li carica da /maplibre/… (eseguito automaticamente prima di dev e build).
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve("maplibre-gl/package.json")) + "/dist";
const out = join(process.cwd(), "public", "maplibre");
mkdirSync(out, { recursive: true });

for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  const src = join(dist, f);
  if (!existsSync(src)) {
    console.warn(`[maplibre] ${f} non trovato (versione di maplibre-gl senza worker separato?)`);
    continue;
  }
  copyFileSync(src, join(out, f));
  console.log(`[maplibre] copiato ${f} -> public/maplibre/`);
}
