import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_TASKS,
  MONEY_TIERS,
  emptyAchievementStats,
  formatCash,
  taskUnlocked,
} from "@/data/achievements";
import { pushRewardStats, rewardsErrorText } from "@/services/rewardStats";
import { useAppStore } from "@/store/useAppStore";
import type { RewardsState } from "@/types/rewards";
import { Trophy } from "lucide-react";
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
});

export function AchievementsPage() {
  const discordId = useAppStore((s) => s.settings.discordId);
  const [rewards, setRewards] = useState<RewardsState>(emptyRewards);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!window.synvity?.rewardsState) return;
    await pushRewardStats(useAppStore.getState());
    const next = await window.synvity.rewardsState();
    if (next) setRewards(next);
  }, []);

  useEffect(() => {
    void load();
    const tick = window.setInterval(() => void load(), 20000);
    return () => window.clearInterval(tick);
  }, [load, discordId]);

  const nextTier = useMemo(
    () => MONEY_TIERS.find((tier) => !rewards.claimedKinds.includes(tier.id)) ?? MONEY_TIERS[MONEY_TIERS.length - 1],
    [rewards.claimedKinds],
  );
  const progress = nextTier ? Math.min(100, Math.round((rewards.points / nextTier.points) * 100)) : 100;

  const claim = async (id: string) => {
    setBusy(id);
    setMsg("");
    try {
      const next = await window.synvity?.rewardsClaim(id);
      if (!next) {
        setMsg(rewardsErrorText("network"));
      } else {
        setRewards(next);
        if (next.ok === false) setMsg(rewardsErrorText(next.error));
        else setMsg("Nagroda zapisana. Developer wypłaci ją w grze.");
      }
    } catch {
      setMsg(rewardsErrorText("network"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="studio-page">
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
              <div className="achieve-points">
                {rewards.points.toLocaleString("pl-PL")} pkt
              </div>
            </div>
            <div className="achieve-cash">
              <div>Do wypłaty w grze</div>
              <strong>{formatCash(rewards.pendingCash)}</strong>
            </div>
          </div>
          <div className="achieve-bar">
            <div className="achieve-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="achieve-bar-meta">
            Następna wypłata: {formatCash(nextTier.amount)} za {nextTier.points.toLocaleString("pl-PL")} pkt
            {rewards.points >= nextTier.points && !rewards.claimedKinds.includes(nextTier.id)
              ? " — gotowe do odbioru"
              : ` · brakuje ${Math.max(0, nextTier.points - rewards.points).toLocaleString("pl-PL")}`}
          </div>
          {rewards.paidCash > 0 ? (
            <div className="achieve-paid">Wypłacone wcześniej: {formatCash(rewards.paidCash)}</div>
          ) : null}
        </div>

        <div className="achieve-tiers">
          {MONEY_TIERS.map((tier) => {
            const claimed = rewards.claimedKinds.includes(tier.id);
            const ready = rewards.points >= tier.points && !claimed;
            return (
              <div key={tier.id} className={`studio-card achieve-tier ${claimed ? "done" : ready ? "ready" : ""}`}>
                <div className="achieve-tier-pts">{tier.points.toLocaleString("pl-PL")} pkt</div>
                <div className="achieve-tier-cash">{formatCash(tier.amount)}</div>
                <button
                  type="button"
                  disabled={!discordId || !ready || busy === tier.id}
                  onClick={() => void claim(tier.id)}
                >
                  {claimed ? "Odebrane" : ready ? "Odbierz" : "Zablokowane"}
                </button>
              </div>
            );
          })}
        </div>

        {msg ? <div className="achieve-msg">{msg}</div> : null}

        {ACHIEVEMENT_CATEGORIES.map((cat) => (
          <section key={cat.id} className="studio-card achieve-cat">
            <div className="achieve-cat-head">
              <h2>{cat.title}</h2>
              <p>{cat.blurb}</p>
            </div>
            <div className="achieve-tasks">
              {ACHIEVEMENT_TASKS.filter((task) => task.category === cat.id).map((task) => {
                const on = taskUnlocked(task, rewards.stats);
                const have = rewards.stats[task.stat] || 0;
                const pct = Math.min(100, Math.round((have / task.need) * 100));
                return (
                  <div key={task.id} className={`achieve-task ${on ? "on" : ""}`}>
                    <div className="achieve-task-top">
                      <span>{task.label}</span>
                      <strong>+{task.points} pkt</strong>
                    </div>
                    <div className="achieve-mini">
                      <div style={{ width: `${pct}%` }} />
                    </div>
                    <div className="achieve-task-foot">
                      {have.toLocaleString("pl-PL")} / {task.need.toLocaleString("pl-PL")} · {task.hint}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
