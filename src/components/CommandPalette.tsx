import { useEffect, useMemo, useState } from "react";
import { navGroups } from "@/data/navigation";
import { useAppStore } from "@/store/useAppStore";
import type { RouteId } from "@/types";

export function CommandPalette() {
  const open = useAppStore((s) => s.searchOpen);
  const setOpen = useAppStore((s) => s.setSearchOpen);
  const query = useAppStore((s) => s.searchQuery);
  const setQuery = useAppStore((s) => s.setSearchQuery);
  const setRoute = useAppStore((s) => s.setRoute);
  const [index, setIndex] = useState(0);

  const items = useMemo(() => {
    const flat: { id: RouteId; label: string }[] = [];
    for (const g of navGroups) {
      for (const item of g.items) {
        if (item.children) {
          for (const c of item.children) flat.push({ id: c.id, label: c.label });
        } else {
          flat.push({ id: item.id, label: item.label });
        }
      }
    }
    const q = query.trim().toLowerCase();
    return q ? flat.filter((i) => i.label.toLowerCase().includes(q)) : flat;
  }, [query]);

  useEffect(() => {
    setIndex(0);
  }, [query, open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
      if (!open) return;
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIndex((i) => Math.min(items.length - 1, i + 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      }
      if (e.key === "Enter" && items[index]) {
        setRoute(items[index].id);
        setOpen(false);
        setQuery("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, items, index, setOpen, setRoute, setQuery]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-28" onClick={() => setOpen(false)}>
      <div
        className="w-[480px] overflow-hidden rounded-lg border border-syn-border bg-syn-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Szukaj"
          className="h-12 w-full border-b border-syn-border bg-transparent px-4 text-sm outline-none"
        />
        <div className="max-h-72 overflow-y-auto py-1">
          {items.map((item, i) => (
            <button
              key={item.id + item.label}
              className={`flex h-9 w-full items-center px-4 text-left text-[13px] ${
                i === index ? "bg-[#1c1c1f] text-white" : "text-zinc-400"
              }`}
              onMouseEnter={() => setIndex(i)}
              onClick={() => {
                setRoute(item.id);
                setOpen(false);
                setQuery("");
              }}
            >
              {item.label}
            </button>
          ))}
          {items.length === 0 ? <div className="px-4 py-6 text-center text-sm text-zinc-500">Brak wyników</div> : null}
        </div>
      </div>
    </div>
  );
}
