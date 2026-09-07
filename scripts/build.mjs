import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await check(file);
    else if (/\.(js|mjs)$/.test(file)) {
      const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
      if (result.status !== 0) process.exit(result.status ?? 1);
    }
  }
}
await check("api"); await check("public");
for (const file of ["index.html", "search.html", "upload.html"])
  if (!(await readFile(path.join("public", file), "utf8")).includes("<html")) throw new Error(`Invalid page: ${file}`);
console.log("Production source validated: public pages and API modules.");
