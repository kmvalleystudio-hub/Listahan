import fs from "fs";
import path from "path";

const url = "https://assets1.lottiefiles.com/packages/lf20_m81bllil.json";
const out = path.join(process.cwd(), "assets", "animations", "app-loading.json");

const res = await fetch(url);
if (!res.ok) throw new Error(`Download failed: ${res.status}`);
const json = await res.text();
if (!json.startsWith("{")) throw new Error("Not JSON");
fs.writeFileSync(out, json);
console.log(`Wrote ${out} (${json.length} bytes)`);
