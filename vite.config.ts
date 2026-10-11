import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { editServer } from "./scripts/edit-server";
import { inlineDeckImages } from "./scripts/inline-images";
import { BIG_FONTS, makeFontSubsets } from "./scripts/subset-fonts";

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * 도름슬라이드 빌드 설정.
 *
 *   npm run dev         개발 서버. 화면 아래 [편집] 을 누르면 글자를 그 자리에서 고치고 slides/content.json 에 바로 저장된다.
 *   npm run build:html  HTML 한 파일(dist/index.html → 내 슬라이드.html). 그림·글꼴까지 다 들어 있어 인터넷 없이도 열린다.
 *   npm run build       배포용 폴더(dist/). 깃허브 페이지·버셀에 그대로 올린다.
 */
export default defineConfig(async ({ mode }) => {
  const html = mode === "html";
  // HTML 한 파일에는 쓰인 글자만 남긴 한글 글꼴을 넣는다.
  const fontDir = html ? await makeFontSubsets(root) : null;
  // HTML 한 파일: 샘플·예시 덱을 빼고, 도름이 산책을 안 쓰는 덱이면 3D 엔진도 뺀다.
  const usesDoreumi = html && fs.readFileSync(path.join(root, "slides", "content.json"), "utf8").includes('"pet": "doreumi"');
  const htmlAliases = html
    ? [
        { find: /^\.\/previews$/, replacement: path.join(root, "src", "previews.empty.ts") },
        ...(usesDoreumi ? [] : [{ find: /^\.\/doreumi-walk\/DoreumiStage$/, replacement: path.join(root, "tools", "doreumi-walk", "DoreumiStage.empty.tsx") }]),
      ]
    : [];
  const plugins: PluginOption[] = [react(), editServer(root)];
  if (html) plugins.push(inlineDeckImages(root), viteSingleFile({ removeViteModuleLoader: true }));
  return {
    base: "./",
    plugins,
    resolve: {
      alias: [
        ...htmlAliases,
        ...(fontDir ? [{ find: new RegExp(`^.*assets/fonts/(${BIG_FONTS.join("|")})\\.woff2$`), replacement: `${fontDir}/$1.woff2` }] : []),
        { find: "@designs", replacement: path.join(root, "designs") },
        { find: "@tools", replacement: path.join(root, "tools") },
        { find: "@samples", replacement: path.join(root, "samples") },
        { find: "@slides", replacement: path.join(root, "slides") },
        { find: "@", replacement: path.join(root, "src") },
      ],
    },
    define: html
      ? {
          // HTML 한 파일은 내 컴퓨터 파일을 읽을 수 없어 도름이 3D 는 공개 주소에서 받는다(인터넷이 없으면 정지 그림).
          "import.meta.env.VITE_DOREUMI_BASE": JSON.stringify("https://shinnanchanguk.github.io/dormslide/mascot/doreumi"),
        }
      : undefined,
    build: {
      outDir: "dist",
      emptyOutDir: true,
      assetsInlineLimit: html ? 100_000_000 : 4096,
      chunkSizeWarningLimit: 4000,
    },
    server: { port: 5173, strictPort: false },
  };
});
