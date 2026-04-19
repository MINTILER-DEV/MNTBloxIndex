import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDirectory = path.resolve(__dirname, "..");
const publicDirectory = path.join(rootDirectory, "public");
const distDirectory = path.join(rootDirectory, "dist");

await fs.rm(distDirectory, { recursive: true, force: true });
await fs.mkdir(distDirectory, { recursive: true });
await fs.cp(publicDirectory, distDirectory, { recursive: true });
