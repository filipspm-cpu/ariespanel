import mark from "@/assets/aries-mark.png";
import type { AchievementTask } from "@/data/achievements";
import { clsx } from "./ui/clsx";

export function AchievementBadge({
  task,
  unlocked,
  have,
  canDelete,
  onDelete,
}: {
  task: AchievementTask;
  unlocked: boolean;
  have: number;
  canDelete?: boolean;
  onDelete?: () => void;
}) {
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
        {have.toLocaleString("pl-PL")} / {task.need.toLocaleString("pl-PL")}
      </div>
      <div className="achieve-badge-xp">{task.points} xp</div>
      {canDelete ? (
        <button type="button" className="achieve-badge-del" onClick={onDelete}>
          Usuń
        </button>
      ) : null}
    </div>
  );
}
