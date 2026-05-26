import { access } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const required = [
  "index.html",
  "styles.css",
  "src/app.js",
  "config.js",
  "manifest.webmanifest",
  "sw.js",
  "netlify.toml",
  "supabase/schema.sql",
  "templates/实验室设备标签.wdfx"
];

for (const file of required) {
  await access(file);
}

const syntaxCheck = spawnSync(process.execPath, ["--check", "src/app.js"], { stdio: "inherit" });
if (syntaxCheck.status !== 0) {
  process.exit(syntaxCheck.status ?? 1);
}

console.log("Build check passed.");
