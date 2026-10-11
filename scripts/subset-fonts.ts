import fs from "node:fs";
import path from "node:path";
// @ts-expect-error 이 패키지는 타입 선언을 함께 주지 않는다.
import subsetFont from "subset-font";

/**
 * HTML 한 파일로 저장할 때만 쓴다. 한글 글꼴은 글자 수가 많아 통째로 넣으면 수 MB 가 된다.
 * 덱(slides/content.json)과 화면 코드에 실제로 쓰인 글자만 남긴 글꼴을 node_modules/.dormslide-fonts 에 만들고,
 * 빌드가 원래 글꼴 대신 그것을 쓰게 한다(vite.config.ts 의 alias).
 */
export const BIG_FONTS = ["PretendardVariable", "WantedSansVariable"];

function collectText(root: string): string {
  const parts: string[] = [];
  const read = (file: string) => {
    try {
      parts.push(fs.readFileSync(file, "utf8"));
    } catch {
      /* 없는 파일은 건너뛴다 */
    }
  };
  read(path.join(root, "slides", "content.json"));
  const walk = (dir: string) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (/\.(tsx?|json)$/.test(name)) read(full);
    }
  };
  for (const dir of ["src", "tools", "designs", "visuals", "samples"]) if (fs.existsSync(path.join(root, dir))) walk(path.join(root, dir));
  let ascii = "";
  for (let code = 0x20; code < 0x7f; code++) ascii += String.fromCharCode(code);
  return [...new Set(parts.join("") + ascii + "·…‘’“”→←↑↓")].filter((ch) => ch.codePointAt(0)! >= 0x20).join("");
}

export async function makeFontSubsets(root: string): Promise<string> {
  const out = path.join(root, "node_modules", ".dormslide-fonts");
  fs.mkdirSync(out, { recursive: true });
  const text = collectText(root);
  for (const name of BIG_FONTS) {
    const source = fs.readFileSync(path.join(root, "src", "assets", "fonts", `${name}.woff2`));
    try {
      const slim: Buffer = await subsetFont(source, text, { targetFormat: "woff2" });
      fs.writeFileSync(path.join(out, `${name}.woff2`), slim);
    } catch {
      // 줄이기에 실패하면 원본을 그대로 쓴다(글자가 깨지는 것보다 무거운 편이 낫다).
      fs.writeFileSync(path.join(out, `${name}.woff2`), source);
    }
  }
  return out;
}
