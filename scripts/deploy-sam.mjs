/**
 * Cross-platform launcher for SAM deploy.
 * Windows → PowerShell script; elsewhere → bash script.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const isWin = process.platform === "win32";

const result = isWin
  ? spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        join(root, "scripts", "deploy-sam.ps1"),
        ...args.map((a) => (a === "--no-confirm" ? "-NoConfirm" : a)),
      ],
      { cwd: root, stdio: "inherit", env: process.env },
    )
  : spawnSync("bash", [join(root, "scripts", "deploy-sam.sh"), ...args], {
      cwd: root,
      stdio: "inherit",
      env: process.env,
    });

process.exit(result.status ?? 1);
