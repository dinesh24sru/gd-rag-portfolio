import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outfile = process.env.ARTIFACTS_DIR
  ? join(process.env.ARTIFACTS_DIR, "handler.js")
  : join(root, "services/ingestion-worker/dist/handler.js");

mkdirSync(dirname(outfile), { recursive: true });

await esbuild.build({
  entryPoints: [join(root, "services/ingestion-worker/src/handler.ts")],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile,
  sourcemap: true,
  absWorkingDir: root,
  nodePaths: [
    join(root, "packages/providers/node_modules"),
    join(root, "packages/core/node_modules"),
    join(root, "services/ingestion-worker/node_modules"),
    join(root, "node_modules"),
  ],
  alias: {
    "@gd-rag/core": join(root, "packages/core/src/index.ts"),
    "@gd-rag/shared": join(root, "packages/shared/src/index.ts"),
    "@gd-rag/providers": join(root, "packages/providers/src/index.ts"),
  },
});

console.log(`Built ingestion worker → ${outfile}`);
