export type NoticeKind = "changelog" | "announcement";

export type PanelNotice = {
  id: number;
  kind: NoticeKind;
  title: string;
  body: string;
  authorName: string;
  createdAt: string;
};
