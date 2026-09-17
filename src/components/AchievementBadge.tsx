import mark from "@/assets/aries-mark.png";
import type { AchievementTask } from "@/data/achievements";
import { clsx } from "./ui/clsx";

export function AchievementBadge({
  task,
  unlocked,
  have,
  canDelete,
  canGrant,
  busy,
  onDelete,
  onGrant,
}: {
  task: AchievementTask;
  unlocked: boolean;
  have: number;
  canDelete?: boolean;
  canGrant?: boolean;
  busy?: boolean;
  onDelete?: () => void;
  onGrant?: () => void;
}) {
  const pct = Math.min(100, Math.round((Math.max(0, have) / Math.max(1, task.need)) * 100));
  return (
    <div className={clsx("achieve-badge", task.rarity, unlocked && "on")} title={task.hint}>
      <div
        className="achieve-badge-mark"
        style={{
          WebkitMaskImage: `url(${mark})`,
          maskImage: `url(${mark})`,
        }}
      />
      <div className="achieve-badge-name">{task.label}</div>
      <div className="achieve-badge-meta">
        {Math.min(have, task.need).toLocaleString("pl-PL")} / {task.need.toLocaleString("pl-PL")}
      </div>
      <div className="achieve-badge-bar" aria-hidden>
        <div className="achieve-badge-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="achieve-badge-xp">{task.points} xp</div>
      {canGrant ? (
        <button type="button" className="achieve-badge-grant" disabled={busy} onClick={onGrant}>
          Przyznaj
        </button>
      ) : null}
      {canDelete ? (
        <button type="button" className="achieve-badge-del" onClick={onDelete}>
          Usuń
        </button>
      ) : null}
    </div>
  );
}
