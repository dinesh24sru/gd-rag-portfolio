import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outfile = process.env.ARTIFACTS_DIR
  ? join(process.env.ARTIFACTS_DIR, "handler.js")
  : join(root, "services/api/dist/handler.js");

mkdirSync(dirname(outfile), { recursive: true });

await esbuild.build({
  entryPoints: [join(root, "services/api/src/handler.ts")],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile,
  sourcemap: true,
  alias: {
    "@gd-rag/core": join(root, "packages/core/src/index.ts"),
    "@gd-rag/shared": join(root, "packages/shared/src/index.ts"),
  },
});

// Do not write package.json into dist: SAM would run npm pack and fail.
// The esbuild output is a single self-contained handler.js.

console.log(`Built API handler → ${outfile}`);
