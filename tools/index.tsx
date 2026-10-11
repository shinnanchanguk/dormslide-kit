import { Suspense, lazy, type ReactNode } from "react";
import type { BodyPayload, SurveyPayload } from "@/lib/deck-content";
import type { ToolPayload } from "@/lib/deck";
import { SurveyTool } from "./survey/SurveyTool";
import { LinkQrTool } from "./link-qr/LinkQrTool";
import { TimerTool } from "./timer/TimerTool";
import { YoutubeEmbed } from "./youtube/YoutubeEmbed";
import { LinkPreviewCard, type LinkPreview } from "./link-preview/LinkPreviewCard";
import { LIVE_TOOLS, renderLiveTool } from "./live";
import { ActivityFrameTool } from "./activity-frame/ActivityFrame";
import { FollowDemo } from "./follow-demo";

/**
 * 도구 상자. 장에 붙는 도구를 여기서 이어 준다.
 *
 * - 본문 장(BODY)에 덧붙는 것: video(유튜브) · linkPreview(링크 미리보기 카드) · pet:"doreumi"(도름이 산책)
 * - 설문 장(SURVEY): 객관식·서술형. 실시간 모드가 꺼져 있으면 이 화면에서만 세는 '혼자 보는 판'이다.
 * - 도구 장(TOOL): payload.tool 로 고른다. link-qr · timer 는 혼자 쓰는 판에서도 돌고,
 *   link-board · classify · likes · join 은 실시간 모드(내 수파베이스)가 있어야 돈다.
 *
 * 무엇이 있는지는 catalog.json 과 tools/<이름>/README.md 에 적혀 있다.
 */

/** 3D 도름이는 three.js 를 쓰므로 그 장을 열 때만 불러온다. */
const DoreumiStage = lazy(() => import("./doreumi-walk/DoreumiStage").then((module) => ({ default: module.DoreumiStage })));

export function renderBodyAddons(payload: BodyPayload & { linkPreview?: LinkPreview }, _index: number): ReactNode {
  const parts: ReactNode[] = [];
  if (payload.video?.url) parts.push(<YoutubeEmbed key="video" url={payload.video.url} title={payload.title} />);
  if (payload.linkPreview?.url) parts.push(<LinkPreviewCard key="preview" preview={payload.linkPreview} />);
  if (payload.pet === "doreumi")
    parts.push(
      <Suspense key="doreumi" fallback={null}>
        <DoreumiStage />
      </Suspense>,
    );
  return parts.length ? parts : null;
}

export function renderSurvey(payload: SurveyPayload, index: number): ReactNode {
  return <SurveyTool payload={payload} slideIndex={index} />;
}

export function renderToolSlide(payload: ToolPayload, index: number): ReactNode {
  switch (payload.tool) {
    case "link-qr":
      return <LinkQrTool config={payload.config} />;
    case "timer":
      return <TimerTool config={payload.config} />;
    case "activity-frame":
      return <ActivityFrameTool config={payload.config} />;
    case "follow-demo":
      return <FollowDemo />;
    default:
      if (LIVE_TOOLS.has(payload.tool)) return renderLiveTool(payload, index);
      return <p className="tool-missing">이 장의 도구({payload.tool})를 찾지 못했어요. tools/ 폴더와 catalog.json 을 확인해 주세요.</p>;
  }
}
