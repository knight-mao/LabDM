import { access } from "node:fs/promises";

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

console.log("Build check passed.");
