import type { Plugin } from "vite";
import fs from "node:fs";
import path from "node:path";

/**
 * HTML 한 파일로 저장할 때(npm run build:html) 덱 속 그림 경로를 그림 자체(data: 주소)로 바꾼다.
 * 그래서 파일 하나만 옮겨도 그림이 깨지지 않는다. public/ 아래 그림만 읽는다.
 */
const MIME: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml", ".avif": "image/avif" };
const IMAGE_PATH = /"(\/(?:samples|slides|assets|decks)\/[A-Za-z0-9_\-./]+\.(?:png|jpe?g|webp|gif|svg|avif))"/g;

export function inlineDeckImages(root: string): Plugin {
  const publicDir = path.join(root, "public");
  return {
    name: "dormslide-inline-deck-images",
    enforce: "pre",
    transform(code, id) {
      if (!id.endsWith(".json") || !/[\\/](slides|samples)[\\/]/.test(id)) return null;
      const next = code.replace(IMAGE_PATH, (whole, rel: string) => {
        const file = path.join(publicDir, rel);
        if (!file.startsWith(publicDir) || !fs.existsSync(file)) return whole;
        const mime = MIME[path.extname(file).toLowerCase()];
        if (!mime) return whole;
        return JSON.stringify(`data:${mime};base64,${fs.readFileSync(file).toString("base64")}`);
      });
      return next === code ? null : { code: next, map: null };
    },
  };
}
