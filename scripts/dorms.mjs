#!/usr/bin/env node
// 도름스 서재 「도름슬라이드」 책에 등록 요청을 보내는 도구(의존성 없음 · node 18+).
//
//   node scripts/dorms.mjs token                       클립보드의 협업 열쇠를 .dorms/token 에 보관(대화창에 붙이지 않는다)
//   node scripts/dorms.mjs request --pr <번호> --kind design|tool|visual|fix
//                                                      내 PR 을 도름스 운영자에게 등록 요청으로 보낸다(고친 뒤 다시 보내면 새 판으로 접수)
//   node scripts/dorms.mjs status                      내 등록 요청이 어디까지 왔는지 본다
//
// 안전: 열쇠는 .dorms/ 에만 두고 깃에 올리지 않는다. 도름스 주소는 고정이며, 레포 안의 설정 파일이 주소를 바꾸지 못한다.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const DIR = ".dorms";
const SITE = process.env.DORMS_SITE_DEV && /^http:\/\/127\.0\.0\.1:\d{2,5}$/.test(process.env.DORMS_SITE_DEV) ? process.env.DORMS_SITE_DEV : "https://dorms.school";
const UPSTREAM = "shinnanchanguk/dormslide";
const TOKEN_RE = /^dorms_pat_[A-Za-z0-9_-]{43}$/;
const KINDS = new Set(["design", "tool", "visual", "fix"]);
const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const say = (s) => console.log(s);
const fail = (s) => { console.error(s); process.exit(1); };

function git(...a) { return execFileSync("git", a, { encoding: "utf8" }).trim(); }
function refuseLink(p) {
  try { if (fs.lstatSync(p).isSymbolicLink()) fail(`${p} 가 다른 곳을 가리키는 링크예요. 지우고 다시 해 주세요.`); } catch { /* 없으면 괜찮다 */ }
}
function assertPrivate() {
  let tracked = "";
  try { tracked = git("ls-files", "--", DIR); } catch { tracked = ""; }
  if (tracked) fail(".dorms 안의 파일이 깃에 올라가 있어요. 'git rm --cached -r .dorms' 로 빼고 커밋한 뒤 다시 해 주세요.");
  refuseLink(DIR);
}
function ensureIgnored() {
  refuseLink(".gitignore");
  const ignore = fs.existsSync(".gitignore") ? fs.readFileSync(".gitignore", "utf8") : "";
  if (!ignore.split("\n").includes(".dorms/")) fs.appendFileSync(".gitignore", `${ignore.endsWith("\n") || !ignore ? "" : "\n"}.dorms/\n`);
}
function writePrivate(name, content) {
  assertPrivate();
  fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
  const file = path.join(DIR, name);
  refuseLink(file);
  const fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC | (fs.constants.O_NOFOLLOW ?? 0), 0o600);
  try { try { fs.fchmodSync(fd, 0o600); } catch { /* 윈도우 */ } fs.writeSync(fd, content); } finally { fs.closeSync(fd); }
}
function token() {
  assertPrivate();
  let value = "";
  try { value = fs.readFileSync(path.join(DIR, "token"), "utf8").trim(); } catch { value = ""; }
  if (!TOKEN_RE.test(value)) fail("먼저 협업 열쇠를 보관해 주세요. 도름스 서재 도름슬라이드 책 [협업] 에서 [협업 열쇠 복사] 를 누른 뒤 node scripts/dorms.mjs token");
  return value;
}
function readClipboard() {
  const tries = process.platform === "darwin" ? [["pbpaste", []]] : process.platform === "win32" ? [["powershell", ["-NoProfile", "-Command", "Get-Clipboard"]]] : [["wl-paste", []], ["xclip", ["-o", "-selection", "clipboard"]]];
  for (const [cmd, a] of tries) { try { return execFileSync(cmd, a, { encoding: "utf8" }).trim(); } catch { /* 다음 방법 */ } }
  return "";
}
function clearClipboard() {
  const tries = process.platform === "darwin" ? [["pbcopy", []]] : process.platform === "win32" ? [["powershell", ["-NoProfile", "-Command", "Set-Clipboard -Value $null"]]] : [["wl-copy", ["--clear"]], ["xclip", ["-selection", "clipboard", "-i", "/dev/null"]]];
  for (const [cmd, a] of tries) { try { execFileSync(cmd, a, { input: "", stdio: ["pipe", "ignore", "ignore"] }); return; } catch { /* 다음 방법 */ } }
}
async function call(method, route, body) {
  const res = await fetch(`${SITE}${route}`, {
    method,
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "error",
  });
  let data = {};
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) fail(`도름스가 받지 않았어요: ${data.message ?? res.status}`);
  return data;
}
const STATUS_WORD = { pending: "살펴보는 중", approved: "승인·반영됨", rejected: "돌려받음", changed: "바뀐 판 다시 살펴보는 중", closed: "닫힘" };

const [command] = args;
if (command === "token") {
  ensureIgnored();
  const value = readClipboard();
  if (!TOKEN_RE.test(value)) fail("클립보드에 협업 열쇠가 없어요. 서재 책 [협업] 에서 [협업 열쇠 복사] 를 다시 눌러 주세요.");
  writePrivate("token", value);
  clearClipboard();
  say("협업 열쇠를 .dorms/token 에 보관했어요(깃에는 올라가지 않아요). 클립보드는 비웠어요.");
} else if (command === "request") {
  const pr = Number(flag("--pr"));
  const kind = String(flag("--kind") ?? "");
  if (!Number.isInteger(pr) || pr < 1) fail("--pr 에 PR 번호를 적어 주세요.");
  if (!KINDS.has(kind)) fail("--kind 는 design · tool · visual · fix 가운데 하나예요.");
  const data = await call("POST", "/api/dormslide/requests", { repo: UPSTREAM, pr, kind });
  say(`등록 요청을 보냈어요. 접수 번호 ${data.number ?? data.id} · ${STATUS_WORD[data.status] ?? data.status}`);
  say("운영자가 쪽지에서 살펴본 뒤 승인하면 상점에 올라가요. 서재 책의 [등록 요청] 칸에서도 볼 수 있어요.");
} else if (command === "status") {
  const data = await call("GET", "/api/dormslide/requests?mine=1");
  const rows = Array.isArray(data.requests) ? data.requests : [];
  if (!rows.length) say("아직 보낸 등록 요청이 없어요.");
  for (const row of rows) {
    say(`#${row.number} [${STATUS_WORD[row.status] ?? row.status}] ${row.title} (PR ${row.pr})${row.note ? `\n    운영자: ${row.note}` : ""}`);
  }
} else {
  say("쓰는 법: node scripts/dorms.mjs token | request --pr <번호> --kind design|tool|visual|fix | status");
}
