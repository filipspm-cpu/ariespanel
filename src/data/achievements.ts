export const PROMO_CASH = 30_000;

export type AchievementStat = "reports" | "events" | "onlineHours" | "nightReports" | "activeDays" | "referrals";
export type AchievementRarity = "brown" | "silver" | "gold" | "rainbow";
export type AchievementCategory = "reporty" | "dyzur" | "eventy" | "rekrutacja" | "staz" | "noc" | "wlasne";

export type AchievementTask = {
  id: string;
  category: AchievementCategory;
  label: string;
  hint: string;
  stat: AchievementStat;
  need: number;
  points: number;
  rarity: AchievementRarity;
  custom?: boolean;
};

export type MoneyTier = {
  id: string;
  points: number;
  amount: number;
  prize: "cash" | "vip";
};

export const ACHIEVEMENT_CATEGORIES: { id: AchievementCategory; title: string; blurb: string }[] = [
  { id: "reporty", title: "Reporty", blurb: "Przyjęte zgłoszenia — najcięższa kategoria." },
  { id: "dyzur", title: "Dyżur", blurb: "Czas spędzony w panelu podczas służby." },
  { id: "eventy", title: "Event specy", blurb: "Obsłużone specyfikacje eventów." },
  { id: "rekrutacja", title: "Rekrutacja", blurb: "Ile osób wpisało Twój promokod." },
  { id: "staz", title: "Staż", blurb: "Dni z aktywnością w panelu." },
  { id: "noc", title: "Nocka", blurb: "Reporty przyjęte między 00:00 a 06:00." },
  { id: "wlasne", title: "Własne", blurb: "Osiągnięcia dodane przez developera." },
];

export const ACHIEVEMENT_STATS: { id: AchievementStat; label: string }[] = [
  { id: "reports", label: "Reporty" },
  { id: "events", label: "Event specy" },
  { id: "onlineHours", label: "Godziny dyżuru" },
  { id: "nightReports", label: "Nocne reporty" },
  { id: "activeDays", label: "Dni aktywności" },
  { id: "referrals", label: "Wpisy promokodu" },
];

export const ACHIEVEMENT_RARITIES: { id: AchievementRarity; label: string }[] = [
  { id: "brown", label: "Brąz" },
  { id: "silver", label: "Srebro" },
  { id: "gold", label: "Złoto" },
  { id: "rainbow", label: "Tęcza" },
];

export const ACHIEVEMENT_TASKS: AchievementTask[] = [
  { id: "rep-100", category: "reporty", label: "100 reportów", hint: "Setka przyjętych zgłoszeń.", stat: "reports", need: 100, points: 30, rarity: "brown" },
  { id: "rep-200", category: "reporty", label: "200 reportów", hint: "Dwieście ticketów.", stat: "reports", need: 200, points: 50, rarity: "brown" },
  { id: "rep-500", category: "reporty", label: "500 reportów", hint: "Pół tysiąca — regularny dyżur.", stat: "reports", need: 500, points: 90, rarity: "silver" },
  { id: "rep-1000", category: "reporty", label: "1 000 reportów", hint: "Tysiąc zgłoszeń na koncie.", stat: "reports", need: 1000, points: 150, rarity: "gold" },
  { id: "rep-2000", category: "reporty", label: "2 000 reportów", hint: "Dwa tysiące. Mało kto tu dochodzi.", stat: "reports", need: 2000, points: 260, rarity: "gold" },
  { id: "rep-3500", category: "reporty", label: "3 500 reportów", hint: "Elita administracji.", stat: "reports", need: 3500, points: 420, rarity: "rainbow" },
  { id: "rep-5000", category: "reporty", label: "5 000 reportów", hint: "Pięć tysięcy. Prawie nikt.", stat: "reports", need: 5000, points: 200, rarity: "rainbow" },

  { id: "duty-40", category: "dyzur", label: "40 godzin dyżuru", hint: "Panel otwarty przez 40 h łącznie.", stat: "onlineHours", need: 40, points: 20, rarity: "brown" },
  { id: "duty-100", category: "dyzur", label: "100 godzin dyżuru", hint: "Setka godzin w ARIES.", stat: "onlineHours", need: 100, points: 45, rarity: "brown" },
  { id: "duty-200", category: "dyzur", label: "200 godzin dyżuru", hint: "Dwieście godzin służby.", stat: "onlineHours", need: 200, points: 90, rarity: "silver" },
  { id: "duty-400", category: "dyzur", label: "400 godzin dyżuru", hint: "Długi staż przy panelu.", stat: "onlineHours", need: 400, points: 150, rarity: "gold" },
  { id: "duty-700", category: "dyzur", label: "700 godzin dyżuru", hint: "Prawie miesiąc non-stop.", stat: "onlineHours", need: 700, points: 240, rarity: "gold" },
  { id: "duty-1000", category: "dyzur", label: "1 000 godzin dyżuru", hint: "Tysiąc godzin w panelu.", stat: "onlineHours", need: 1000, points: 180, rarity: "rainbow" },

  { id: "ev-80", category: "eventy", label: "80 event speców", hint: "Osiemdziesiąt obsłużonych speców.", stat: "events", need: 80, points: 40, rarity: "brown" },
  { id: "ev-200", category: "eventy", label: "200 event speców", hint: "Dwieście eventów.", stat: "events", need: 200, points: 80, rarity: "silver" },
  { id: "ev-500", category: "eventy", label: "500 event speców", hint: "Pół tysiąca speców.", stat: "events", need: 500, points: 150, rarity: "gold" },
  { id: "ev-1000", category: "eventy", label: "1 000 event speców", hint: "Tysiąc eventów na koncie.", stat: "events", need: 1000, points: 250, rarity: "rainbow" },

  { id: "ref-1", category: "rekrutacja", label: "1 osoba z Twoim kodem", hint: "Ktoś wpisał Twój promokod.", stat: "referrals", need: 1, points: 100, rarity: "silver" },
  { id: "ref-2", category: "rekrutacja", label: "2 osoby z Twoim kodem", hint: "Drugi admin z Twojego kodu.", stat: "referrals", need: 2, points: 160, rarity: "gold" },
  { id: "ref-5", category: "rekrutacja", label: "5 osób z Twoim kodem", hint: "Pięciu ludzi na Twoim kodzie.", stat: "referrals", need: 5, points: 280, rarity: "rainbow" },
  { id: "ref-10", category: "rekrutacja", label: "10 osób z Twoim kodem", hint: "Dziesięciu — rzadkość.", stat: "referrals", need: 10, points: 450, rarity: "rainbow" },

  { id: "day-14", category: "staz", label: "14 dni aktywności", hint: "Dwa tygodnie z ruchem w panelu.", stat: "activeDays", need: 14, points: 25, rarity: "brown" },
  { id: "day-30", category: "staz", label: "30 dni aktywności", hint: "Miesiąc aktywnych dni.", stat: "activeDays", need: 30, points: 50, rarity: "silver" },
  { id: "day-60", category: "staz", label: "60 dni aktywności", hint: "Dwa miesiące.", stat: "activeDays", need: 60, points: 90, rarity: "gold" },
  { id: "day-120", category: "staz", label: "120 dni aktywności", hint: "Sezon w administracji.", stat: "activeDays", need: 120, points: 160, rarity: "rainbow" },

  { id: "night-30", category: "noc", label: "30 nocnych reportów", hint: "Zgłoszenia między 00:00 a 06:00.", stat: "nightReports", need: 30, points: 70, rarity: "silver" },
  { id: "night-80", category: "noc", label: "80 nocnych reportów", hint: "Regularne nocki.", stat: "nightReports", need: 80, points: 140, rarity: "gold" },
  { id: "night-180", category: "noc", label: "180 nocnych reportów", hint: "Nocna zmiana na stałe.", stat: "nightReports", need: 180, points: 250, rarity: "rainbow" },
  { id: "night-300", category: "noc", label: "300 nocnych reportów", hint: "Setki nocy na służbie.", stat: "nightReports", need: 300, points: 160, rarity: "rainbow" },
];

export const MONEY_TIERS: MoneyTier[] = [
  { id: "rank-500", points: 500, amount: 0, prize: "vip" },
  { id: "cash-1500", points: 1500, amount: 15_000, prize: "cash" },
  { id: "cash-2400", points: 2400, amount: 25_000, prize: "cash" },
  { id: "cash-3300", points: 3300, amount: 70_000, prize: "cash" },
  { id: "cash-4300", points: 4300, amount: 100_000, prize: "cash" },
];

export type AchievementStats = Record<AchievementStat, number>;

export function emptyAchievementStats(): AchievementStats {
  return { reports: 0, events: 0, onlineHours: 0, nightReports: 0, activeDays: 0, referrals: 0 };
}

export function taskUnlocked(task: AchievementTask, stats: AchievementStats) {
  return (stats[task.stat] || 0) >= task.need;
}

export function allAchievementTasks(custom: AchievementTask[] = []) {
  return [...ACHIEVEMENT_TASKS, ...custom];
}

export function totalAchievementPoints(stats: AchievementStats, custom: AchievementTask[] = []) {
  return allAchievementTasks(custom)
    .filter((task) => taskUnlocked(task, stats))
    .reduce((sum, task) => sum + task.points, 0);
}

export function formatCash(amount: number) {
  return `${amount.toLocaleString("pl-PL")} $`;
}

export function formatPrize(tier: MoneyTier) {
  return tier.prize === "vip" ? "Ranga VIP" : formatCash(tier.amount);
}
