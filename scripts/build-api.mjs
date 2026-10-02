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

const { writeFileSync } = await import("node:fs");
writeFileSync(
  join(dirname(outfile), "package.json"),
  JSON.stringify({ name: "@gd-rag/api-bundle", private: true, main: "handler.js" }, null, 2),
);

console.log(`Built API handler → ${outfile}`);
