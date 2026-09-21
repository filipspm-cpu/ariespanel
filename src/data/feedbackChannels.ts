export const FEEDBACK_CHANNELS = [
  { id: "home", label: "Strona główna" },
  { id: "cmd", label: "Wykonawca CMD" },
  { id: "overlay", label: "Nakładka" },
  { id: "macros", label: "Makra" },
  { id: "counters", label: "Statystyki" },
  { id: "forum", label: "Forum" },
  { id: "craft", label: "Craft" },
  { id: "settings", label: "Ustawienia" },
  { id: "accounts", label: "Konta" },
  { id: "about", label: "O aplikacji" },
  { id: "credits", label: "Autorzy" },
  { id: "achievements", label: "Osiągnięcia" },
  { id: "notices", label: "Ogłoszenia" },
  { id: "other", label: "Inne" },
] as const;

export type FeedbackChannelId = (typeof FEEDBACK_CHANNELS)[number]["id"];

export function feedbackChannelLabel(id?: string) {
  return FEEDBACK_CHANNELS.find((row) => row.id === id)?.label || "Inne";
}
