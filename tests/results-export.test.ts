import assert from "node:assert/strict";
import test from "node:test";
import { csvText } from "../tools/results-export/exportCsv.ts";
import { createLocalResults, localResultRows, roomResultRows } from "../tools/results-export/roomResults.ts";
import type { Deck } from "../src/lib/deck.ts";

const deck = {
  meta: { title: "수업", brand: "", railLabel: "", footLabel: "", issueLabel: "" },
  slides: [
    { kind: "SURVEY", payload: { title: "계절", eyebrow: "", kind: "CHOICE", options: ["봄", "여름"] } },
    { kind: "SURVEY", payload: { title: "해 볼 일", eyebrow: "", kind: "TEXT" } },
    { kind: "TOOL", payload: { title: "자료", eyebrow: "", tool: "link-board" } },
  ],
} as Deck;

test("one export includes choice, text, and links from every slide, in slide order", () => {
  const local = createLocalResults();
  local.surveys.set(1, { counts: [], texts: ["꽃 관찰"] });
  local.surveys.set(0, { counts: [3, 1], texts: [] });
  local.boards.set(2, [{ id: "private-row-id", nickname: "나무", text: "관찰 자료", url: "https://example.org", likes: 2, bucket: "관찰", createdAt: "2026-10-12T00:00:00Z" }]);
  const rows = localResultRows(deck, local);
  assert.deepEqual(rows.map((row) => [row[0], row[1], row[4], row[8]]), [[1, "계절", "봄", 3], [1, "계절", "여름", 1], [2, "해 볼 일", "꽃 관찰", 1], [3, "자료", "관찰 자료", 1]]);
  assert.equal(JSON.stringify(rows).includes("private-row-id"), false);
  assert.equal(rows[3][3], "나무");
  assert.equal(rows[3][5], "https://example.org");
  assert.equal(createLocalResults().surveys.size, 0, "a new deck must not inherit another deck's answers");
});

test("live exports project answers without account identifiers or rows outside the current deck", () => {
  const rows = roomResultRows(deck, {
    responses: [
      { slide: 0, kind: "choice", option: 1, text: null, createdAt: "2026-10-12T00:00:00Z" },
      { slide: 1, kind: "text", option: null, text: "걷기", createdAt: "2026-10-12T00:01:00Z" },
      { slide: 99, kind: "text", option: null, text: "다른 덱의 내용", createdAt: "" },
    ],
    board: [],
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0][4], "여름");
  assert.equal(rows[1][4], "걷기");
  assert.equal(rows.every((row) => row.length === 10), true);
});

test("Excel CSV preserves Korean and multiline answers while neutralizing formulas", () => {
  const csv = csvText(["응답"], [["가나다"], ["=1+1"], ["  @SUM(A1:A2)"], ["앞\r뒤"], ['한 줄, "인용"\n다음 줄']]);
  assert.ok(csv.startsWith("\uFEFF응답\r\n가나다"));
  assert.ok(csv.includes("' =") === false);
  assert.ok(csv.includes("'=1+1"));
  assert.ok(csv.includes("'  @SUM(A1:A2)"));
  assert.ok(csv.includes('"앞\r뒤"'));
  assert.ok(csv.includes('"한 줄, ""인용""\n다음 줄"'));
});
