// ストア提出 / 手動インストール用の zip を dist/ に作る (ビルド工程は無く、ファイルをそのまま詰める)
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const out = `dist/notedeck-browser-${manifest.version}.zip`;
mkdirSync("dist", { recursive: true });
rmSync(out, { force: true });
execFileSync("zip", ["-r", "-q", out, "manifest.json", "icons", "_locales", "src"], { stdio: "inherit" });
console.log(out);
