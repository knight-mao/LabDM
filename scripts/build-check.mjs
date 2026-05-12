import { access } from "node:fs/promises";

const required = ["index.html", "styles.css", "src/app.js", "manifest.webmanifest", "sw.js", "netlify.toml"];

for (const file of required) {
  await access(file);
}

console.log("Build check passed.");
