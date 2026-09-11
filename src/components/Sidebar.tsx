import {
  ChevronRight,
  Gamepad2,
  Gauge,
  Heart,
  Home,
  Info,
  Layers,
  MessagesSquare,
  ScrollText,
  Search,
  Settings,
  Terminal,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { RankBadge, useAccountRank } from "@/components/RankBadge";
import { navGroups } from "@/data/navigation";
import { useAppStore } from "@/store/useAppStore";
import type { RouteId } from "@/types";
import { clsx } from "./ui/clsx";

const icons: Record<string, LucideIcon> = {
  home: Home,
  gamepad: Gamepad2,
  terminal: Terminal,
  layers: Layers,
  zap: Zap,
  gauge: Gauge,
  settings: Settings,
  info: Info,
  heart: Heart,
  messages: MessagesSquare,
  scroll: ScrollText,
};

function NavButton({
  label,
  icon,
  active,
  badge,
  indented,
  chevron,
  open,
  onClick,
}: {
  label: string;
  icon: string;
  active?: boolean;
  badge?: string;
  indented?: boolean;
  chevron?: boolean;
  open?: boolean;
  onClick: () => void;
}) {
  const Icon = icons[icon] ?? Home;
  return (
    <button
      onClick={onClick}
      className={clsx(
        "group flex h-[30px] w-full items-center gap-2 rounded-md px-2 text-left text-[13px] transition-colors",
        indented && "pl-8",
        active ? "bg-white/[0.06] text-white" : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200",
      )}
    >
      <Icon size={15} strokeWidth={1.7} className={active ? "text-white" : "text-zinc-500"} />
      <span className="flex-1 truncate">{label}</span>
      {badge ? (
        <span className="rounded-[4px] bg-syn-green px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-black">
          {badge}
        </span>
      ) : null}
      {chevron ? (
        <ChevronRight
          size={14}
          className={clsx("text-zinc-600 transition-transform", open && "rotate-90")}
        />
      ) : null}
    </button>
  );
}

export function Sidebar() {
  const route = useAppStore((s) => s.route);
  const setRoute = useAppStore((s) => s.setRoute);
  const gameOpen = useAppStore((s) => s.gameOpen);
  const setGameOpen = useAppStore((s) => s.setGameOpen);
  const forumOpen = useAppStore((s) => s.forumOpen);
  const setForumOpen = useAppStore((s) => s.setForumOpen);
  const forumRuleId = useAppStore((s) => s.forumRuleId);
  const setForumRuleId = useAppStore((s) => s.setForumRuleId);
  const setSearchOpen = useAppStore((s) => s.setSearchOpen);
  const settings = useAppStore((s) => s.settings);
  const nick = settings.discordGlobalName || settings.username || "Konto";
  const letter = (nick || "A").trim().slice(0, 1).toUpperCase();
  const rank = useAccountRank(settings.discordId);

  return (
    <aside className="app-sidebar flex w-[252px] shrink-0 flex-col border-r border-white/[0.06] bg-black">
      <div className="px-4 pb-3 pt-4">
        <BrandMark />
        <button
          onClick={() => setSearchOpen(true)}
          className="mt-3 flex h-8 w-full items-center gap-2 rounded-md border border-white/[0.07] bg-[#050505] px-2 text-[12px] text-zinc-500"
        >
          <Search size={13} />
          <span className="flex-1 text-left">Szukaj</span>
          <span className="rounded border border-white/[0.08] px-1 py-px text-[10px] text-zinc-600">Ctrl K</span>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-3">
        {navGroups.map((group) => (
          <div key={group.id} className="mb-3">
            <div className="px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-600">
              {group.label}
            </div>
            {group.items.map((item) => {
              if (item.children) {
                const expanded = item.id === "forum" ? forumOpen : gameOpen;
                return (
                  <div key={item.label}>
                    <NavButton
                      label={item.label}
                      icon={item.icon}
                      chevron
                      open={expanded}
                      onClick={() => {
                        if (item.id === "forum") {
                          const next = !forumOpen;
                          setForumOpen(next);
                          if (next) setRoute("forum");
                          return;
                        }
                        setGameOpen(!gameOpen);
                      }}
                    />
                    {expanded
                      ? item.children.map((child) => (
                          <NavButton
                            key={`${child.id}-${child.forumRuleId ?? child.label}`}
                            label={child.label}
                            icon={child.icon}
                            badge={child.badge}
                            indented
                            active={
                              child.forumRuleId
                                ? route === "forum" && forumRuleId === child.forumRuleId
                                : route === child.id
                            }
                            onClick={() => {
                              if (child.forumRuleId) setForumRuleId(child.forumRuleId);
                              else setRoute(child.id);
                            }}
                          />
                        ))
                      : null}
                  </div>
                );
              }
              return (
                <NavButton
                  key={item.id}
                  label={item.label}
                  icon={item.icon}
                  active={route === item.id}
                  onClick={() => setRoute(item.id as RouteId)}
                />
              );
            })}
          </div>
        ))}
      </nav>

      <button
        type="button"
        onClick={() => setRoute("settings")}
        className="mx-2 mb-3 mt-auto flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-[#050505] px-2.5 py-2 text-left hover:bg-white/[0.04]"
      >
        {settings.discordAvatarUrl ? (
          <img
            src={settings.discordAvatarUrl}
            alt=""
            className="h-8 w-8 shrink-0 rounded-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[12px] font-semibold text-white">
            {letter}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <div className="min-w-0 truncate text-[13px] font-medium text-white">{nick}</div>
            <RankBadge rank={rank} size="xs" />
          </div>
          {settings.discordUsername ? (
            <div className="truncate text-[11px] text-zinc-500">@{settings.discordUsername}</div>
          ) : null}
        </div>
      </button>
    </aside>
  );
}
