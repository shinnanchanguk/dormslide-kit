export type SurveySnapshot = { counts: number[]; texts: string[] };
export type BoardItem = { id: string; nickname: string; text: string; url?: string; bucket?: string; likes: number; createdAt: string };

/** 실시간 모드가 해야 하는 일. 수파베이스 말고 다른 곳으로 옮기고 싶으면 이 모양만 지키면 된다. */
export type LiveClient = {
  subscribeSurvey: (room: string, slide: number, optionCount: number, on: (snapshot: SurveySnapshot) => void) => () => void;
  vote: (room: string, slide: number, option: number) => Promise<void>;
  answer: (room: string, slide: number, text: string) => Promise<void>;
  subscribeBoard: (room: string, slide: number, on: (items: BoardItem[]) => void) => () => void;
  post: (room: string, slide: number, item: { nickname: string; text: string; url?: string }) => Promise<void>;
  like: (room: string, slide: number, itemId: string) => Promise<void>;
  moveBucket: (room: string, slide: number, itemId: string, bucket: string) => Promise<void>;
  clearRoom: (room: string) => Promise<void>;
  subscribePresenter: (room: string, on: (index: number) => void) => () => void;
  setPresenter: (room: string, index: number) => Promise<void>;
};
