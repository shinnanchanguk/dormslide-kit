import type { Block, BodyResource, BodyTable, CaseStatItem } from "@/lib/deck-content";
import type { SlideInlineEdit } from "@/runtime/InlineEditableText";

/**
 * 무대에서 고친 한 토막을 서버의 `patchText` 요청 모양으로 바꾸고, 같은 변경을 화면 쪽
 * 자료에도 먼저 반영한다. 관리자 편집기와 발표자 화면의 바로 고치기가 이 파일 하나를 쓴다.
 *
 * 서버(lib/inline-text-patch.ts)가 허용하는 자리만 만든다. 주소·도구 설정은 여기서 만들 수 없다.
 */

export function inlinePatchRequest(slideId: string, change: SlideInlineEdit) {
  const base = { action: "patchText" as const, slideId };
  switch (change.target) {
    case "payload":
      return { ...base, patch: { target: "payload" as const, field: change.field }, value: change.value };
    case "body-block":
      return {
        ...base,
        patch: {
          target: "block" as const,
          collection: "columns" as const,
          column: change.columnIndex,
          block: change.blockIndex,
        },
        parts: change.parts,
      };
    case "tool-intro":
      return {
        ...base,
        patch: { target: "block" as const, collection: "intro" as const, block: change.blockIndex },
        parts: change.parts,
      };
    case "resource":
      return { ...base, patch: { target: "resource" as const, index: change.resourceIndex }, value: change.value };
    case "tool-config":
      return { ...base, patch: { target: "toolConfig" as const, field: change.field }, value: change.value };
    case "survey-prompt":
      return { ...base, patch: { target: "surveyPrompt" as const }, value: change.value };
    case "table-text":
      return {
        ...base,
        patch: { target: "tableText" as const, table: change.tableIndex, part: change.part },
        value: change.value,
      };
    case "table-head":
      return {
        ...base,
        patch: { target: "tableHead" as const, table: change.tableIndex, col: change.colIndex },
        value: change.value,
      };
    case "table-cell":
      return {
        ...base,
        patch: {
          target: "tableCell" as const,
          table: change.tableIndex,
          row: change.rowIndex,
          col: change.colIndex,
        },
        value: change.value,
      };
    case "case-stat":
      return { ...base, patch: { target: "caseStat" as const, index: change.index }, value: change.value };
    case "agenda":
      return { ...base, patch: { target: "agenda" as const, index: change.index }, value: change.value };
    case "card-label":
      return { ...base, patch: { target: "cardLabel" as const, index: change.index }, value: change.value };
    case "training-text":
      return {
        ...base,
        patch: {
          target: "trainingText" as const,
          part: change.part,
          ...(change.index === undefined ? {} : { index: change.index }),
          ...(change.profileKey ? { profileKey: change.profileKey } : {}),
          ...(change.branch ? { branch: change.branch } : {}),
        },
        value: change.value,
      };
    case "survey-option":
      return { ...base, patch: { target: "surveyOption" as const, index: change.index }, value: change.value };
    case "resource-caption":
      return { ...base, patch: { target: "resourceCaption" as const, index: change.index }, value: change.value };
    case "credit":
      return { ...base, patch: { target: "credit" as const, part: change.part }, value: change.value };
  }
}

type EditableSlide = {
  kind: string;
  payload: unknown;
  survey?: unknown;
  tool?: unknown;
};

function withTable(payload: Record<string, unknown>, tableIndex: number, change: (table: BodyTable) => BodyTable) {
  const tables = payload.tables as BodyTable[] | undefined;
  if (!tables?.[tableIndex]) return null;
  return {
    ...payload,
    tables: tables.map((table, index) => (index === tableIndex ? change(table) : table)),
  };
}

/**
 * 서버에 보낸 것과 같은 변경을 화면의 슬라이드 자료에 반영한다. 반영할 자리가 없으면
 * null 을 돌려주고, 부른 쪽은 저장을 보내지 않는다.
 */
export function applyInlineEditToSlide<T extends EditableSlide>(slide: T, change: SlideInlineEdit): T | null {
  const payload = (slide.payload ?? {}) as Record<string, unknown>;

  if (change.target === "payload") {
    return { ...slide, payload: { ...payload, [change.field]: change.value } };
  }

  if (change.target === "body-block") {
    if (slide.kind !== "BODY") return null;
    const columns = payload.columns as Block[][] | undefined;
    const block = columns?.[change.columnIndex]?.[change.blockIndex];
    if (!columns || !block || block.b === "rule") return null;
    return {
      ...slide,
      payload: {
        ...payload,
        columns: columns.map((column, columnIndex) =>
          columnIndex === change.columnIndex
            ? column.map((current, blockIndex) =>
                blockIndex === change.blockIndex ? { ...current, parts: change.parts } : current,
              )
            : column,
        ),
      },
    };
  }

  if (change.target === "tool-intro") {
    if (slide.kind !== "TOOL") return null;
    const intro = payload.intro as Block[] | undefined;
    const block = intro?.[change.blockIndex];
    if (!intro || !block || block.b === "rule") return null;
    return {
      ...slide,
      payload: {
        ...payload,
        intro: intro.map((current, blockIndex) =>
          blockIndex === change.blockIndex ? { ...current, parts: change.parts } : current,
        ),
      },
    };
  }

  if (change.target === "survey-prompt") {
    if (slide.kind !== "SURVEY" || !slide.survey) return null;
    return { ...slide, survey: { ...(slide.survey as object), prompt: change.value } };
  }

  if (change.target === "survey-option") {
    const options = (slide.survey as { options?: string[] } | undefined)?.options;
    if (slide.kind !== "SURVEY" || !options || change.index >= options.length) return null;
    return {
      ...slide,
      survey: { ...(slide.survey as object), options: options.map((option, index) => (index === change.index ? change.value : option)) },
    };
  }

  if (change.target === "tool-config") {
    if (slide.kind !== "TOOL" || !slide.tool) return null;
    return { ...slide, tool: { ...(slide.tool as object), [change.field]: change.value } };
  }

  if (slide.kind !== "BODY") return null;

  if (change.target === "resource") {
    const resources = payload.resources as BodyResource[] | undefined;
    if (!resources?.[change.resourceIndex]) return null;
    return {
      ...slide,
      payload: {
        ...payload,
        resources: resources.map((current, index) =>
          index === change.resourceIndex ? { ...current, label: change.value } : current,
        ),
      },
    };
  }

  if (change.target === "credit") {
    const credit = payload.credit as { prefix: string; label: string; url: string } | undefined;
    if (!credit) return null;
    return { ...slide, payload: { ...payload, credit: { ...credit, [change.part]: change.value } } };
  }

  if (change.target === "card-label") {
    const labels = [...((payload.cardLabels as string[] | undefined) ?? [])];
    while (labels.length <= change.index) labels.push("");
    labels[change.index] = change.value;
    return { ...slide, payload: { ...payload, cardLabels: labels } };
  }

  if (change.target === "resource-caption") {
    const resources = payload.resources as BodyResource[] | undefined;
    if (!resources?.[change.index]) return null;
    return {
      ...slide,
      payload: {
        ...payload,
        resources: resources.map((current, index) => {
          if (index !== change.index) return current;
          const next = { ...current };
          if (change.value.trim()) next.caption = change.value;
          else delete next.caption;
          return next;
        }),
      },
    };
  }

  if (change.target === "training-text") {
    type Steps = { items: { text: string; note?: string; link?: { label: string; url: string } }[]; done: string };
    type TreeEntry = string | { label: string; note?: string };
    type Guide = {
      kicker: string;
      title: string;
      footnote?: string;
      items?: string[];
      copyable?: true;
      tree?: { global: TreeEntry[]; project: TreeEntry[] };
    };
    const training = payload.training as
      | {
          action?: { label: string; aiNote?: string };
          visual?: { items: { title: string; note?: string; tag?: string }[] };
          progress?: { items: { label: string; note?: string }[]; current: number };
          steps?: Steps;
          stepsByProfile?: Record<string, Steps>;
          guides?: Record<string, Guide>;
        }
      | undefined;
    if (!training) return null;
    // 같은 변경을 서버가 다시 검사하므로 여기서는 깊은 복사본을 고쳐 화면에 먼저 보여 준다.
    const next = JSON.parse(JSON.stringify(training)) as typeof training;
    const setOptional = <T extends Record<string, unknown>>(target: T, key: keyof T & string) => {
      if (change.value.trim()) (target as Record<string, unknown>)[key] = change.value;
      else delete target[key];
    };
    if (change.part === "actionLabel" || change.part === "aiNote") {
      if (!next.action) return null;
      if (change.part === "actionLabel") next.action.label = change.value;
      else setOptional(next.action, "aiNote");
      return { ...slide, payload: { ...payload, training: next } };
    }
    if (change.part === "progressLabel" || change.part === "progressNote") {
      const item = change.index === undefined ? undefined : next.progress?.items[change.index];
      if (!item) return null;
      if (change.part === "progressLabel") item.label = change.value;
      else setOptional(item, "note");
      return { ...slide, payload: { ...payload, training: next } };
    }
    if (change.part.startsWith("guide")) {
      const guide =
        change.profileKey !== undefined && next.guides && Object.prototype.hasOwnProperty.call(next.guides, change.profileKey)
          ? next.guides[change.profileKey]
          : undefined;
      if (!guide) return null;
      if (change.part === "guideKicker") guide.kicker = change.value;
      else if (change.part === "guideTitle") guide.title = change.value;
      else if (change.part === "guideFootnote") guide.footnote = change.value;
      else if (change.part === "guideItem") {
        if (guide.copyable || !guide.items || change.index === undefined || change.index >= guide.items.length) return null;
        guide.items[change.index] = change.value;
      } else {
        const entries = change.branch && guide.tree ? guide.tree[change.branch] : undefined;
        const entry = change.index === undefined ? undefined : entries?.[change.index];
        if (!entries || entry === undefined || change.index === undefined) return null;
        if (change.part === "guideTreeLabel") {
          if (typeof entry === "string") entries[change.index] = change.value;
          else entry.label = change.value;
        } else {
          if (typeof entry === "string") return null;
          setOptional(entry, "note");
        }
      }
      return { ...slide, payload: { ...payload, training: next } };
    }
    if (change.part === "stepsDone" || change.part === "stepText" || change.part === "stepNote" || change.part === "stepLinkLabel") {
      const steps =
        change.profileKey === undefined
          ? next.steps
          : next.stepsByProfile && Object.prototype.hasOwnProperty.call(next.stepsByProfile, change.profileKey)
            ? next.stepsByProfile[change.profileKey]
            : undefined;
      if (!steps) return null;
      if (change.part === "stepsDone") {
        steps.done = change.value;
        return { ...slide, payload: { ...payload, training: next } };
      }
      const step = change.index === undefined ? undefined : steps.items[change.index];
      if (!step) return null;
      if (change.part === "stepText") step.text = change.value;
      else if (change.part === "stepLinkLabel") {
        if (!step.link) return null;
        step.link.label = change.value;
      } else setOptional(step, "note");
      return { ...slide, payload: { ...payload, training: next } };
    }
    const items = training.visual?.items;
    if (!items || change.index === undefined || !items[change.index]) return null;
    const key = change.part === "visualTitle" ? "title" : change.part === "visualNote" ? "note" : "tag";
    return {
      ...slide,
      payload: {
        ...payload,
        training: {
          ...training,
          visual: {
            ...training.visual!,
            items: items.map((item, index) => {
              if (index !== change.index) return item;
              const next = { ...item };
              if (key === "title" || change.value.trim()) next[key] = change.value;
              else delete next[key];
              return next;
            }),
          },
        },
      },
    };
  }

  if (change.target === "table-text") {
    const next = withTable(payload, change.tableIndex, (table) => {
      const copy = { ...table };
      if (change.value.trim()) copy[change.part] = change.value;
      else delete copy[change.part];
      return copy;
    });
    return next ? { ...slide, payload: next } : null;
  }

  if (change.target === "table-head") {
    const next = withTable(payload, change.tableIndex, (table) => ({
      ...table,
      head: table.head.map((cell, index) => (index === change.colIndex ? change.value : cell)),
    }));
    return next ? { ...slide, payload: next } : null;
  }

  if (change.target === "table-cell") {
    const next = withTable(payload, change.tableIndex, (table) => ({
      ...table,
      rows: table.rows.map((row, rowIndex) =>
        rowIndex === change.rowIndex
          ? row.map((cell, colIndex) => (colIndex === change.colIndex ? change.value : cell))
          : row,
      ),
    }));
    return next ? { ...slide, payload: next } : null;
  }

  if (change.target === "case-stat") {
    const stats = payload.caseStats as { items: CaseStatItem[] } | undefined;
    if (!stats?.items[change.index]) return null;
    return {
      ...slide,
      payload: {
        ...payload,
        caseStats: {
          ...stats,
          items: stats.items.map((item, index) => (index === change.index ? { ...item, label: change.value } : item)),
        },
      },
    };
  }

  const agenda = payload.agenda as string[] | undefined;
  if (!agenda || change.index >= agenda.length) return null;
  return {
    ...slide,
    payload: { ...payload, agenda: agenda.map((item, index) => (index === change.index ? change.value : item)) },
  };
}
