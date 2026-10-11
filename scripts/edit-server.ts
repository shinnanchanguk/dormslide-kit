import type { Plugin } from "vite";
import fs from "node:fs";
import path from "node:path";

/**
 * 개발 서버의 [편집] 저장 통로. 화면에서 고친 장 하나를 받아 덱 파일의 같은 자리에 써 넣는다.
 *
 * - 개발 서버(npm run dev)에서만 돈다. 배포본·HTML 파일에는 이 통로가 없다.
 * - 쓸 수 있는 파일은 slides/content.json 과 samples/<이름>/deck.json 뿐이다.
 * - 고친 내용은 slides/.edits.jsonl 에 한 줄씩 남는다(깃에 올라가지 않는다). AI 는 이 기록을 보고 사람이 무엇을 고쳤는지 안다.
 */
const TARGET = /^(slides\/content\.json|samples\/[a-z0-9-]{1,60}\/deck\.json)$/;
const MAX_BODY = 2_000_000;

export function editServer(root: string): Plugin {
  return {
    name: "dormslide-edit-server",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__dormslide/edit", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end();
          return;
        }
        // 같은 컴퓨터의 화면에서 온 요청만 받는다.
        const origin = req.headers.origin;
        const host = req.headers.host;
        if (origin && host && new URL(origin).host !== host) {
          res.statusCode = 403;
          res.end("다른 곳에서 온 요청은 받지 않아요.");
          return;
        }
        let body = "";
        req.on("data", (chunk: Buffer) => {
          body += chunk.toString("utf8");
          if (body.length > MAX_BODY) req.destroy();
        });
        req.on("end", () => {
          try {
            const { target, slideIndex, slide } = JSON.parse(body) as { target: string; slideIndex: number; slide: { kind?: string; payload?: unknown } };
            if (!TARGET.test(target) || !Number.isInteger(slideIndex) || slideIndex < 0 || !slide || typeof slide.kind !== "string" || typeof slide.payload !== "object") {
              res.statusCode = 400;
              res.end("고칠 수 없는 요청이에요.");
              return;
            }
            const file = path.join(root, target);
            const deck = JSON.parse(fs.readFileSync(file, "utf8")) as { slides: unknown[] };
            if (slideIndex >= deck.slides.length) {
              res.statusCode = 400;
              res.end("없는 장이에요.");
              return;
            }
            const before = deck.slides[slideIndex];
            deck.slides[slideIndex] = slide;
            fs.writeFileSync(file, `${JSON.stringify(deck, null, 1)}\n`);
            const log = path.join(root, "slides", ".edits.jsonl");
            fs.appendFileSync(log, `${JSON.stringify({ at: new Date().toISOString(), target, slideIndex, before, after: slide })}\n`);
            res.statusCode = 200;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ ok: true }));
          } catch {
            res.statusCode = 400;
            res.end("저장하지 못했어요.");
          }
        });
      });
    },
  };
}
