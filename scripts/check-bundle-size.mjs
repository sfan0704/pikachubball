// Fails when the JavaScript a first visit downloads (the scripts and preloaded
// chunks index.html names) is over the budget in the target state, gzipped.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";

const BUDGET_BYTES = 200 * 1024;
const root = process.argv[2] ?? "dist/public";

const html = readFileSync(join(root, "index.html"), "utf8");
const scripts = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map((match) => match[1]);
if (scripts.length === 0) {
  console.error(`No scripts found in ${join(root, "index.html")}`);
  process.exit(1);
}

let total = 0;
for (const script of new Set(scripts)) {
  const size = gzipSync(readFileSync(join(root, script))).length;
  total += size;
  console.log(`${String(size).padStart(8)} B gzip  ${script}`);
}
console.log(`${String(total).padStart(8)} B gzip  initial JavaScript (budget ${BUDGET_BYTES})`);
if (total > BUDGET_BYTES) {
  console.error("The initial JavaScript is over the budget.");
  process.exit(1);
}
