import { AchievementBadge } from "@/components/AchievementBadge";
import { useAccountRanks } from "@/components/RankBadge";
import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_RARITIES,
  ACHIEVEMENT_STATS,
  allAchievementTasks,
  emptyAchievementStats,
  formatCash,
  formatPrize,
  MONEY_TIERS,
  taskUnlocked,
  type AchievementCategory,
  type AchievementRarity,
  type AchievementStat,
} from "@/data/achievements";
import { hasDeveloperAccess } from "@/data/testers";
import { pushRewardStats, rewardsErrorText } from "@/services/rewardStats";
import { useAppStore } from "@/store/useAppStore";
import type { RewardsState } from "@/types/rewards";
import { Trophy, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const emptyRewards = (): RewardsState => ({
  ok: false,
  code: "",
  redeemed: false,
  redeemedCode: "",
  referrals: 0,
  points: 0,
  stats: emptyAchievementStats(),
  pendingCash: 0,
  paidCash: 0,
  payouts: [],
  claimedKinds: [],
  customTasks: [],
  leaderboard: [],
});

const TRACK = MONEY_TIERS;

export function AchievementsPage() {
  const discordId = useAppStore((s) => s.settings.discordId);
  const ranks = useAccountRanks(discordId);
  const isDev = hasDeveloperAccess(ranks);
  const [rewards, setRewards] = useState<RewardsState>(emptyRewards);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | AchievementCategory>("all");
  const [rankOpen, setRankOpen] = useState(false);
  const [form, setForm] = useState({
    label: "",
    hint: "",
    category: "wlasne" as AchievementCategory,
    stat: "reports" as AchievementStat,
    need: 100,
    points: 50,
    rarity: "brown" as AchievementRarity,
  });

  const apply = (next: RewardsState | undefined) => {
    if (!next) return;
    setRewards((prev) => ({
      ...next,
      customTasks: next.customTasks ?? prev.customTasks,
      leaderboard: next.leaderboard?.length ? next.leaderboard : prev.leaderboard,
    }));
  };

  const load = useCallback(async () => {
    if (!window.synvity?.rewardsState) return;
    await pushRewardStats(useAppStore.getState());
    const [next, accounts] = await Promise.all([
      window.synvity.rewardsState(),
      window.synvity.rewardsAccounts?.() ?? Promise.resolve([]),
    ]);
    if (next) {
      setRewards({
        ...next,
        leaderboard: next.leaderboard?.length ? next.leaderboard : accounts ?? [],
      });
    } else if (accounts?.length) {
      setRewards((prev) => ({ ...prev, leaderboard: accounts }));
    }
  }, []);

  useEffect(() => {
    void load();
    const tick = window.setInterval(() => void load(), 20000);
    return () => window.clearInterval(tick);
  }, [load, discordId]);

  const tasks = useMemo(() => {
    const extra = (rewards.customTasks ?? []).map((task) => ({
      ...task,
      category: (task.category || "wlasne") as AchievementCategory,
      rarity: (task.rarity || "brown") as AchievementRarity,
      custom: true,
    }));
    return allAchievementTasks(extra);
  }, [rewards.customTasks]);
  const nextTier = useMemo(
    () => MONEY_TIERS.find((tier) => !rewards.claimedKinds.includes(tier.id)) ?? MONEY_TIERS[MONEY_TIERS.length - 1],
    [rewards.claimedKinds],
  );
  const trackPct = useMemo(() => {
    const stops = [0, ...TRACK.map((tier) => tier.points)];
    if (rewards.points <= 0) return 0;
    for (let i = 0; i < stops.length - 1; i++) {
      const from = stops[i];
      const to = stops[i + 1];
      if (rewards.points <= to) {
        const t = (rewards.points - from) / Math.max(1, to - from);
        return ((i + t) / (stops.length - 1)) * 100;
      }
    }
    return 100;
  }, [rewards.points]);

  const claim = async (id: string) => {
    setBusy(id);
    setMsg("");
    try {
      const next = await window.synvity?.rewardsClaim(id);
      if (!next) setMsg(rewardsErrorText("network"));
      else {
        apply(next);
        if (next.ok === false) setMsg(rewardsErrorText(next.error));
        else {
          setMsg(id === "rank-500" ? "Ranga VIP przyznana." : "Nagroda zapisana. Developer wypłaci ją w grze.");
          const testers = await window.synvity?.ranksList?.();
          if (testers) useAppStore.getState().setTesters(testers);
        }
      }
    } catch {
      setMsg(rewardsErrorText("network"));
    } finally {
      setBusy(null);
    }
  };

  const addCustom = async () => {
    setBusy("define");
    setMsg("");
    try {
      const next = await window.synvity?.rewardsDefine(form);
      if (!next) setMsg(rewardsErrorText("network"));
      else {
        apply(next);
        if (next.ok === false) setMsg(rewardsErrorText(next.error));
        else {
          setForm((f) => ({ ...f, label: "", hint: "" }));
          setMsg("Osiągnięcie dodane.");
        }
      }
    } catch {
      setMsg(rewardsErrorText("network"));
    } finally {
      setBusy(null);
    }
  };

  const removeCustom = async (id: string) => {
    setBusy(id);
    try {
      const next = await window.synvity?.rewardsUndefine(id);
      if (next) apply(next);
    } finally {
      setBusy(null);
    }
  };

  const grantTask = async (id: string) => {
    setBusy(id);
    setMsg("");
    try {
      const next = await window.synvity?.rewardsGrant?.(id);
      if (!next) setMsg(rewardsErrorText("network"));
      else {
        apply(next);
        if (next.ok === false) setMsg(rewardsErrorText(next.error));
        else setMsg("Osiągnięcie przyznane.");
      }
    } catch {
      setMsg(rewardsErrorText("network"));
    } finally {
      setBusy(null);
    }
  };

  const board = rewards.leaderboard ?? [];
  const visible = useMemo(
    () => (filter === "all" ? tasks : tasks.filter((task) => task.category === filter)),
    [filter, tasks],
  );
  const filterCats = ACHIEVEMENT_CATEGORIES.filter((cat) => tasks.some((task) => task.category === cat.id));

  return (
    <div className="studio-page achieve-page">
      <div className="studio-header">
        <div className="credits-kicker">OSIĄGNIĘCIA</div>
        <h1>Osiągnięcia</h1>
        <div className="credits-rule" />
      </div>
      <div className="studio-body achieve-body">
        {!discordId ? (
          <div className="studio-card achieve-empty">
            Połącz Discord w ustawieniach, żeby zbierać punkty i odbierać dolary do gry.
          </div>
        ) : null}

        <div className="studio-card achieve-hero">
          <div className="achieve-hero-top">
            <Trophy size={18} />
            <div>
              <div className="achieve-kicker">Postęp</div>
              <div className="achieve-points">{rewards.points.toLocaleString("pl-PL")} pkt</div>
            </div>
            <div className="achieve-cash">
              <div>Do wypłaty w grze</div>
              <strong>{formatCash(rewards.pendingCash)}</strong>
            </div>
          </div>

          <div className="achieve-track">
            <div className="achieve-rail">
              <div className="achieve-rail-fill" style={{ width: `${trackPct}%` }} />
              {TRACK.map((tier, index) => {
                const reached = rewards.points >= tier.points;
                const claimed = rewards.claimedKinds.includes(tier.id);
                return (
                  <span
                    key={tier.id}
                    className={`achieve-dot ${reached ? "on" : ""} ${claimed ? "done" : ""}`}
                    style={{ left: `${((index + 1) / TRACK.length) * 100}%` }}
                  />
                );
              })}
            </div>
            <div className="achieve-track-labels">
              {TRACK.map((tier, index) => {
                const reached = rewards.points >= tier.points;
                const claimed = rewards.claimedKinds.includes(tier.id);
                const ready = Boolean(discordId && reached && !claimed);
                const edge = index === TRACK.length - 1 ? "end" : index === 0 ? "start" : "";
                return (
                  <button
                    key={tier.id}
                    type="button"
                    className={`achieve-label ${edge} ${reached ? "on" : ""} ${claimed ? "done" : ""}`}
                    style={{ left: `${((index + 1) / TRACK.length) * 100}%` }}
                    disabled={!ready || busy === tier.id}
                    onClick={() => (ready ? void claim(tier.id) : undefined)}
                  >
                    <strong>{formatPrize(tier)}</strong>
                    <span>{tier.points.toLocaleString("pl-PL")} xp</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="achieve-bar-meta">
            Następna nagroda: {formatPrize(nextTier)} za {nextTier.points.toLocaleString("pl-PL")} xp
            {rewards.points >= nextTier.points && !rewards.claimedKinds.includes(nextTier.id)
              ? " — kliknij próg, żeby odebrać"
              : ` · brakuje ${Math.max(0, nextTier.points - rewards.points).toLocaleString("pl-PL")}`}
          </div>
          {rewards.paidCash > 0 ? (
            <div className="achieve-paid">Wypłacone wcześniej: {formatCash(rewards.paidCash)}</div>
          ) : null}
        </div>

        {msg ? <div className="achieve-msg">{msg}</div> : null}

        {isDev ? (
          <section className="studio-card achieve-dev">
            <div className="achieve-cat-head">
              <h2>Wersja developera</h2>
              <p>Tylko ty widzisz to pole. Przyznaj sobie wykonane zadania na kafelkach albo dodaj nowe osiągnięcie dla wszystkich.</p>
            </div>
            <div className="achieve-dev-grid">
              <label>
                Nazwa
                <input
                  className="settings-input"
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="Nazwa osiągnięcia"
                />
              </label>
              <label>
                Opis
                <input
                  className="settings-input"
                  value={form.hint}
                  onChange={(e) => setForm((f) => ({ ...f, hint: e.target.value }))}
                  placeholder="Krótki opis"
                />
              </label>
              <label>
                Kategoria
                <select
                  className="settings-input"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as AchievementCategory }))}
                >
                  {ACHIEVEMENT_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Statystyka
                <select
                  className="settings-input"
                  value={form.stat}
                  onChange={(e) => setForm((f) => ({ ...f, stat: e.target.value as AchievementStat }))}
                >
                  {ACHIEVEMENT_STATS.map((stat) => (
                    <option key={stat.id} value={stat.id}>
                      {stat.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Wymagane
                <input
                  className="settings-input"
                  type="number"
                  min={1}
                  value={form.need}
                  onChange={(e) => setForm((f) => ({ ...f, need: Number(e.target.value) || 1 }))}
                />
              </label>
              <label>
                Punkty
                <input
                  className="settings-input"
                  type="number"
                  min={1}
                  value={form.points}
                  onChange={(e) => setForm((f) => ({ ...f, points: Number(e.target.value) || 1 }))}
                />
              </label>
              <label>
                Trudność
                <select
                  className="settings-input"
                  value={form.rarity}
                  onChange={(e) => setForm((f) => ({ ...f, rarity: e.target.value as AchievementRarity }))}
                >
                  {ACHIEVEMENT_RARITIES.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="button"
              className="settings-btn primary"
              disabled={busy === "define" || form.label.trim().length < 2}
              onClick={() => void addCustom()}
            >
              Dodaj osiągnięcie
            </button>
          </section>
        ) : null}

        <section className="studio-card achieve-cat">
          <div className="achieve-cat-head">
            <h2>Zadania</h2>
            <p>
              {filter === "all"
                ? "Wszystkie osiągnięcia w jednym miejscu."
                : ACHIEVEMENT_CATEGORIES.find((cat) => cat.id === filter)?.blurb}
            </p>
          </div>
          <div className="achieve-filters">
            <button type="button" className={filter === "all" ? "is-on" : ""} onClick={() => setFilter("all")}>
              Wszystkie
            </button>
            {filterCats.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={filter === cat.id ? "is-on" : ""}
                onClick={() => setFilter(cat.id)}
              >
                {cat.title}
              </button>
            ))}
          </div>
          <div className="achieve-badges">
            {visible.map((task) => {
              const unlocked = taskUnlocked(task, rewards.stats);
              return (
                <AchievementBadge
                  key={task.id}
                  task={task}
                  unlocked={unlocked}
                  have={rewards.stats[task.stat] || 0}
                  canDelete={isDev && Boolean(task.custom)}
                  canGrant={Boolean(isDev && discordId && !unlocked)}
                  busy={busy === task.id}
                  onDelete={() => void removeCustom(task.id)}
                  onGrant={() => void grantTask(task.id)}
                />
              );
            })}
          </div>
        </section>
      </div>

      <button
        type="button"
        className={`achieve-rank-tab ${rankOpen ? "is-open" : ""}`}
        onClick={() => setRankOpen((open) => !open)}
        aria-expanded={rankOpen}
      >
        Ranking
      </button>
      <aside className={`achieve-rank-drawer ${rankOpen ? "open" : ""}`}>
        <div className="achieve-rank-drawer-head">
          <div>
            <h2>Ranking</h2>
            <p>Kto ma najwięcej punktów za osiągnięcia.</p>
          </div>
          <button type="button" className="achieve-rank-close" onClick={() => setRankOpen(false)} aria-label="Zamknij ranking">
            <X size={16} />
          </button>
        </div>
        {board.length ? (
          <ol className="achieve-rank-list">
            {board.slice(0, 20).map((row, index) => (
              <li key={row.id || row.name} className={row.id === discordId ? "me" : ""}>
                <span className="achieve-rank-pos">{index + 1}</span>
                {row.avatarUrl ? <img src={row.avatarUrl} alt="" /> : <span className="achieve-rank-fallback" />}
                <span className="achieve-rank-name">{row.name || row.id}</span>
                <strong>{row.points.toLocaleString("pl-PL")} xp</strong>
              </li>
            ))}
          </ol>
        ) : (
          <div className="achieve-empty">Ranking pojawi się, gdy ktoś zbierze punkty.</div>
        )}
      </aside>
      {rankOpen ? <button type="button" className="achieve-rank-mask" onClick={() => setRankOpen(false)} aria-label="Zamknij ranking" /> : null}
    </div>
  );
}
