import { clsx } from "./clsx";

export function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={clsx("toggle-track", checked && "on")}
    >
      <span className="toggle-thumb" />
    </button>
  );
}
