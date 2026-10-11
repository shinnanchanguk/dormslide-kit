/** 모인 결과를 표 파일(CSV, 엑셀에서 열림)로 내려받는다. 이 브라우저 안에서 만들어 바로 저장한다(서버로 보내지 않는다). */
export function csvText(header: string[], rows: Array<Array<string | number>>) {
  const cell = (value: string | number) => {
    const text = String(value ?? "");
    // 엑셀이 수식으로 읽지 않게 = + - @ 로 시작하는 칸 앞에 ' 를 붙인다.
    const safe = /^[=+\-@\t\r\n]/.test(text) || /^\s+[=+\-@]/.test(text) ? `'${text}` : text;
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return `﻿${[header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n")}`;
}

export function downloadCsv(filename: string, header: string[], rows: Array<Array<string | number>>) {
  const blob = new Blob([csvText(header, rows)], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename.replace(/[\\/:*?"<>|]+/g, " ").slice(0, 80) || "결과.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
