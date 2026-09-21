import type { NoticeKind, PanelNotice } from "@/types/notices";

export type { NoticeKind, PanelNotice };

export const DEFAULT_NOTICES: PanelNotice[] = [
  {
    id: -1,
    kind: "announcement",
    title: "Promuj Aries panel",
    body: "Pokaż ARIES znajomym z serwera. Im więcej osób korzysta z panelu, tym łatwiej trzymać raporty, makra i nakładkę w jednym miejscu.",
    authorName: "Filipek",
    createdAt: "2026-09-21T00:00:00.000Z",
  },
  {
    id: -2,
    kind: "changelog",
    title: "1.0.99",
    body: "• Na starcie panelu widać changelog i ogłoszenia\n• Main developer dodaje wpisy w zakładce Ogłoszenia",
    authorName: "Filipek",
    createdAt: "2026-09-21T00:00:00.000Z",
  },
  {
    id: -3,
    kind: "changelog",
    title: "1.0.98",
    body: "• Zakładka Konta znowu pokazuje połączone konta Discord\n• Przy pierwszym uruchomieniu panel pyta o nazwę i zapisuje ją w bazie\n• Sugestie i błędy można kopiować oraz trwale usuwać\n• Asystent forum odpowiada na pytania z regulaminu",
    authorName: "Filipek",
    createdAt: "2026-09-20T21:00:00.000Z",
  },
];
