import fs from "fs";
import path from "path";

const ids = [
  "lf20_jcikwtux",
  "lf20_ini4duxq",
  "lf20_qp1spzqv",
  "lf20_ynf5cgjq",
  "lf20_lgk9882e",
  "lf20_khzniaya",
  "lf20_a2chheio",
  "lf20_yt4uj9bb",
  "lf20_cgjr9qu8",
  "lf20_u4yrau",
  "lf20_x62chyei",
];

const outDir = path.join(process.cwd(), "assets", "animations", "_probe");
fs.mkdirSync(outDir, { recursive: true });

for (const id of ids) {
  for (const host of [1, 2, 3, 4, 5, 6, 8, 9, 10]) {
    const url = `https://assets${host}.lottiefiles.com/packages/${id}.json`;
    const res = await fetch(url);
    if (!res.ok) continue;
    const text = await res.text();
    if (!text.startsWith("{")) continue;
    const names = [...text.matchAll(/"nm":"([^"]{0,50})"/g)].map((m) => m[1]);
    const joined = names.join(" ").toLowerCase();
    const score =
      (joined.includes("pen") ? 3 : 0) +
      (joined.includes("pencil") ? 3 : 0) +
      (joined.includes("hand") ? 2 : 0) +
      (joined.includes("write") ? 2 : 0) +
      (joined.includes("paper") ? 1 : 0) +
      (joined.includes("loading") ? 1 : 0);
    if (score >= 2) {
      const out = path.join(outDir, `${id}.json`);
      fs.writeFileSync(out, text);
      console.log("HIT", score, id, host, names.slice(0, 8).join(" | "));
    }
    break;
  }
}
