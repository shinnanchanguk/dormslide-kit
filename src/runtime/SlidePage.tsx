import type { ReactNode } from "react";
import { strictInternalImagePath, strictPublicWebUrl } from "@/lib/safe-url";
import type { Block, BodyPayload, BodyResource, CoverPayload, ImagePayload, SurveyPayload } from "@/lib/deck-content";
import type { DeckSlide, ToolPayload } from "@/lib/deck";
import type { Design } from "./design";
import { AutoFit } from "./AutoFit";
import { Blocks } from "./Blocks";
import { InlineEditableText, type SlideInlineEditor } from "./InlineEditableText";
import { Icon } from "./Icon";
import { renderBodyAddons, renderSurvey, renderToolSlide } from "@tools/index";

/**
 * 장 하나를 그린다. 표지·그림·본문·설문·도구 장이 있고, 본문의 배치(layout)는 고른 디자인이 그린다.
 * editor 는 개발 서버의 [편집] 이 켜졌을 때만 온다. 그때는 글자를 눌러 그 자리에서 고친다.
 */

function ResourceLink({ resource, index, variant, editor }: { resource: BodyResource; index: number; variant: "generic" | "source" | "case" | "cover"; editor?: SlideInlineEditor }) {
  const url = strictPublicWebUrl(resource.url);
  if (!url) return null;
  const className = variant === "source" ? "source-link" : variant === "case" ? "case-card" : variant === "cover" ? "cover-resource" : "body-page__resource";
  const prefix = variant === "source" ? <span className="source-link__prefix">출처</span> : null;
  const shown = variant === "cover" ? <span className="cover-resource__url">{url}</span> : null;
  if (editor) {
    return (
      <span className={`${className} ${className}--editing`}>
        {prefix}
        <InlineEditableText
          as="span"
          className={`${className}__label`}
          value={resource.label}
          ariaLabel={`자료 제목 ${index + 1} 편집`}
          allowEmpty={false}
          onCommit={(value) => editor.onCommit({ target: "resource", resourceIndex: index, value })}
        />
        {shown}
      </span>
    );
  }
  return (
    <a className={className} href={url} target="_blank" rel="noreferrer noopener">
      {prefix}
      <span className={`${className}__label`}>{resource.label}</span>
      {shown}
      {variant === "case" ? <Icon name="open" size={15} /> : null}
    </a>
  );
}

function Title({ as, className, value, field, editor }: { as: "h1" | "h2" | "div" | "p"; className: string; value: string; field: "eyebrow" | "title" | "hint"; editor?: SlideInlineEditor }) {
  return (
    <InlineEditableText
      as={as}
      className={className}
      value={value}
      ariaLabel={field === "title" ? "슬라이드 제목 편집" : field === "eyebrow" ? "머리말 편집" : "안내 문장 편집"}
      onCommit={editor ? (next) => editor.onCommit({ target: "payload", field, value: next }) : undefined}
    />
  );
}

export function SlidePage({ slide, index, design, editor }: { slide: DeckSlide; index: number; design: Design; editor?: SlideInlineEditor }) {
  if (slide.kind === "COVER") {
    const payload = slide.payload as CoverPayload;
    return (
      <AutoFit className="cover-page" min={18} max={108}>
        <Title as="div" className="eyebrow" value={payload.eyebrow} field="eyebrow" editor={editor} />
        <Title as="h1" className="cover__title" value={payload.title} field="title" editor={editor} />
        <div className="cover__rule" aria-hidden="true" />
      </AutoFit>
    );
  }

  if (slide.kind === "IMAGE") {
    const payload = slide.payload as ImagePayload;
    const src = strictInternalImagePath(payload.src);
    return (
      <div className="image-page">
        {src ? <img className="image-page__img" src={src} alt={payload.alt} /> : null}
        {payload.caption ? <p className="image-page__caption">{payload.caption}</p> : null}
      </div>
    );
  }

  if (slide.kind === "SURVEY" || slide.kind === "TOOL") {
    const payload = slide.payload as SurveyPayload | ToolPayload;
    const body = slide.kind === "SURVEY" ? renderSurvey(slide.payload as SurveyPayload, index) : renderToolSlide(slide.payload as ToolPayload, index);
    return (
      <AutoFit className={`body-page ${slide.kind === "SURVEY" ? "survey-page" : `tool-page tool-page--${(payload as ToolPayload).tool ?? ""}`}`} min={14} max={46}>
        <Title as="div" className="eyebrow" value={payload.eyebrow} field="eyebrow" editor={editor} />
        <Title as="h2" className="page-title" value={payload.title} field="title" editor={editor} />
        <div className="page-rule" />
        {payload.hint ? <Title as="p" className="survey-hint" value={payload.hint} field="hint" editor={editor} /> : null}
        <div className={slide.kind === "SURVEY" ? "survey-slot" : "tool-slot"}>{body}</div>
      </AutoFit>
    );
  }

  const payload = slide.payload as BodyPayload;
  const mediaSrc = payload.media ? strictInternalImagePath(payload.media.src) : null;
  const media = mediaSrc && payload.media ? (
    <figure className="body-page__media">
      <img src={mediaSrc} alt={payload.media.alt} />
    </figure>
  ) : null;
  const renderBlocks = (columnIndex: number, blocks: Block[], blockIndexes: number[]) => (
    <Blocks
      blocks={blocks}
      blockIndexes={blockIndexes}
      onCommit={editor ? (blockIndex, parts) => editor.onCommit({ target: "body-block", columnIndex, blockIndex, parts }) : undefined}
    />
  );
  const renderResource = (resource: BodyResource, resourceIndex: number, variant: "source" | "case" | "cover") => (
    <ResourceLink resource={resource} index={resourceIndex} variant={variant} editor={editor} />
  );
  const designed: ReactNode = payload.layout ? design.renderBody({ payload, renderBlocks, renderResource, media, editor }) : null;
  const content = payload.columns.length > 1 ? (
    <div className="two-col">
      {payload.columns.map((column, columnIndex) => (
        <div key={columnIndex}>{renderBlocks(columnIndex, column, column.map((_, blockIndex) => blockIndex))}</div>
      ))}
    </div>
  ) : (
    renderBlocks(0, payload.columns[0] ?? [], (payload.columns[0] ?? []).map((_, blockIndex) => blockIndex))
  );
  const resources = (payload.resources ?? []).filter((resource) => strictPublicWebUrl(resource.url));
  // 배치 없이 영상만 붙인 장은 영상이 주인공이다. 글은 영상 옆에 짧게 둔다.
  if (!payload.layout && payload.video?.url) {
    return (
      <AutoFit className="body-page body-page--video" min={12} max={30}>
        <div className="body-page__eyebrowRow">
          <div className="body-page__eyebrowLead">
            <Title as="div" className="eyebrow" value={payload.eyebrow} field="eyebrow" editor={editor} />
          </div>
        </div>
        <Title as="h2" className="page-title" value={payload.title} field="title" editor={editor} />
        <div className="page-rule" />
        <div className="ds-videoRow">
          {renderBodyAddons(payload, index)}
          <div className="ds-videoRow__copy">{content}</div>
        </div>
      </AutoFit>
    );
  }
  const max = payload.layout ? design.fitMax?.(payload.layout) ?? 34 : 72;

  return (
    <AutoFit className={`body-page${payload.layout ? ` body-page--${payload.layout}` : ""}`} min={payload.layout ? 12 : 13} max={max}>
      <div className="body-page__eyebrowRow">
        <div className="body-page__eyebrowLead">
          <Title as="div" className="eyebrow" value={payload.eyebrow} field="eyebrow" editor={editor} />
        </div>
      </div>
      <Title as="h2" className="page-title" value={payload.title} field="title" editor={editor} />
      <div className="page-rule" />
      {designed ??
        (media ? (
          <div className={`body-page__mediaLayout body-page__mediaLayout--${payload.media?.side ?? "left"}`}>
            {media}
            <div className="body-page__content">{content}</div>
          </div>
        ) : (
          content
        ))}
      {renderBodyAddons(payload, index)}
      {!payload.layout && resources.length ? (
        <div className="body-page__resources">
          {resources.map((resource, resourceIndex) => (
            <ResourceLink key={`${resource.url}:${resourceIndex}`} resource={resource} index={resourceIndex} variant="generic" editor={editor} />
          ))}
        </div>
      ) : null}
    </AutoFit>
  );
}
