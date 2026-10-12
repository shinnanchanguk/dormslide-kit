#!/usr/bin/env node
/*
 * catalog.json 을 만든다. 디자인(designs/<이름>/design.json) · 도구(tools/<이름>/tool.json) · 시각화 조각(visuals/<이름>/visual.json)을 모은다.
 * 도름스 서재의 도름슬라이드 책이 이 파일을 읽어 디자인 상점·도구 상점·시각화 조각 칸을 그린다.
 *   node scripts/build-catalog.mjs          다시 만들기
 *   node scripts/build-catalog.mjs --check  지금 파일이 최신인지 확인(다르면 실패)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ID = /^[a-z][a-z0-9-]{1,59}$/;

function collect(dir, file, kind) {
  const base = path.join(root, dir);
  if (!fs.existsSync(base)) return [];
  return fs
    .readdirSync(base)
    .filter((name) => fs.existsSync(path.join(base, name, file)))
    .sort()
    .map((name) => {
      const meta = JSON.parse(fs.readFileSync(path.join(base, name, file), "utf8"));
      if (meta.id !== name || !ID.test(name)) throw new Error(`${dir}/${name}/${file}: id 는 폴더 이름과 같아야 해요.`);
      if (!meta.name || !meta.summary) throw new Error(`${dir}/${name}/${file}: name · summary 가 필요해요.`);
      // 미리보기 사이트 안의 주소(앞부분 없이). 도름스가 자기 미리보기 창에 이어 붙여 띄운다.
      // 디자인이 자기 샘플(samples/<이름>/deck.json)을 가졌으면 그 샘플로, 없으면 탄생비화 샘플로 미리 보여 준다.
      const sample = kind === "design" && fs.existsSync(path.join(root, "samples", name, "deck.json")) ? name : "dorms-story";
      const preview = kind === "design" ? `?sample=${sample}&design=${name}&embed=1` : kind === "tool" ? `?demo=${name}&embed=1` : `?visual=${name}&embed=1`;
      return { ...meta, kind, folder: `${dir}/${name}`, preview };
    });
}

const catalog = {
  version: 3,
  designs: collect("designs", "design.json", "design"),
  tools: collect("tools", "tool.json", "tool"),
  visuals: collect("visuals", "visual.json", "visual"),
};
const text = `${JSON.stringify(catalog, null, 1)}\n`;
const out = path.join(root, "catalog.json");
if (process.argv.includes("--check")) {
  const current = fs.existsSync(out) ? fs.readFileSync(out, "utf8") : "";
  if (current !== text) {
    console.error("catalog.json 이 최신이 아니에요. npm run catalog 로 다시 만들어 주세요.");
    process.exit(1);
  }
  console.log("catalog.json 최신");
} else {
  fs.writeFileSync(out, text);
  console.log(`catalog.json: 디자인 ${catalog.designs.length} · 도구 ${catalog.tools.length} · 시각화 ${catalog.visuals.length}`);
}
