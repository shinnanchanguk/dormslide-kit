#!/usr/bin/env node
/*
 * 올리기 전 점검. 열쇠(비밀번호·토큰)나 학생 개인정보처럼 보이는 것이 레포에 들어가 있으면 멈춘다.
 * 공개 레포라서 한 번 올라가면 누구나 볼 수 있다. 의심되는 줄을 보여 주니 사람이 확인하고 지운다.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set(["node_modules", "dist", "dist-previews", ".git", ".dorms", ".work"]);
const TEXT = /\.(?:[cm]?[jt]sx?|json|md|css|html|sql|ya?ml|txt|svg|env|example)$/i;
const RULES = [
  [/sbp_[A-Za-z0-9]{20,}/, "수파베이스 관리 열쇠"],
  [/eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/, "로그인 열쇠(JWT)처럼 보이는 값"],
  [/service_role["'\s:=]+eyJ/, "수파베이스 service_role 열쇠"],
  [/gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}/, "깃허브 토큰"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "개인 열쇠"],
  [/sk-[A-Za-z0-9]{32,}|AIza[0-9A-Za-z_-]{35}/, "AI·구글 열쇠"],
  [/dorms_[a-z]+_[A-Za-z0-9_-]{30,}/, "도름스 작업 토큰"],
  [/\b01[016789]-?\d{3,4}-?\d{4}\b/, "휴대폰 번호"],
  [/\b\d{6}-[1-4]\d{6}\b/, "주민등록번호"],
];
const ALLOW_FILES = new Set(["scripts/check-release.mjs"]);
const hits = [];
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    const rel = path.relative(root, full);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full);
    else if (TEXT.test(name) && stat.size < 5_000_000 && !ALLOW_FILES.has(rel)) {
      const lines = fs.readFileSync(full, "utf8").split("\n");
      lines.forEach((line, index) => {
        for (const [re, label] of RULES) if (re.test(line)) hits.push(`${rel}:${index + 1}  ${label}`);
      });
    }
  }
}
walk(root);
const env = fs.readdirSync(root).filter((name) => /^\.env(\.|$)/.test(name) && name !== ".env.example");
for (const name of env) {
  const tracked = fs.existsSync(path.join(root, ".git")) ? "" : "";
  void tracked;
}
if (hits.length) {
  console.error("올리기 전에 확인이 필요한 줄이 있어요(공개 레포라 누구나 볼 수 있어요):\n");
  for (const hit of hits.slice(0, 50)) console.error(`  - ${hit}`);
  process.exit(1);
}
console.log("올리기 전 점검 통과(열쇠·개인정보로 보이는 줄 없음)");
