#!/usr/bin/env node
/*
 * npm run build:html 의 마지막 단계. dist/index.html 을 '덱 제목.html' 로 옮기고,
 * 파일 맨 앞에 출처 표시(세 번째 겹)를 넣는다. 화면에는 보이지 않지만 파일을 열면 누가 만든 틀인지 알 수 있다.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
if (!html.includes('data-ds-mark') && !html.includes("data-ds-mark")) {
  // 표식 코드는 번들 안에 들어 있다. 문자열이 아예 없으면 표식이 빠진 것이다.
}
if (!html.includes("DoRmSlide")) {
  console.error("만들어진 HTML 에 DoRmSlide 표식이 없어요. npm run check:mark 를 확인해 주세요.");
  process.exit(1);
}
const deck = JSON.parse(fs.readFileSync(path.join(root, "slides", "content.json"), "utf8"));
const title = String(deck?.meta?.title ?? "도름슬라이드").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").trim().slice(0, 80) || "도름슬라이드";
const stamp = crypto.createHash("sha256").update(html).digest("hex").slice(0, 16);
const provenance = `<!--\n  Made with DoRmSlide 도름슬라이드 · https://dorms.school\n  이용 조건: 비영리 이용 · DoRmSlide 표식 유지 (LICENSE · NOTICE.md)\n  출처 표시 ${stamp}\n-->\n`;
const out = html.replace(/^<!doctype html>/i, (m) => `${m}\n${provenance}`);
const file = path.join(dist, `${title}.html`);
fs.writeFileSync(file, out);
const kb = Math.round(fs.statSync(file).size / 1024);
console.log(`HTML 한 파일을 만들었어요: dist/${title}.html (${kb}KB)`);
