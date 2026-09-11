import { Toggle } from "@/components/ui/Toggle";
import { defaultMacros, migrateMacro, macroUid, parseTrigger } from "@/data/defaultMacros";
import { exportMacroPack, exportMacroTxt, mergeImportedMacros, parseMacroFile } from "@/services/macroPack";
import { useAppStore } from "@/store/useAppStore";
import type { Macro, MacroFolder, MacroStep, MacroStepType, MacroTrigger } from "@/types";
import {
  AlignLeft,
  Clock,
  Download,
  Folder,
  FolderPlus,
  GitBranch,
  GripVertical,
  Hash,
  Keyboard,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  Shuffle,
  Trash2,
  Type,
  ArrowLeftRight,
  FileUp,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

const STEP_MENU: { type: MacroStepType; label: string; icon: ReactNode }[] = [
  { type: "insert-text", label: "Wstaw tekst", icon: <Type size={14} /> },
  { type: "multiline-text", label: "Tekst wieloliniowy", icon: <AlignLeft size={14} /> },
  { type: "key-press", label: "Naciśnięcie klawisza", icon: <Keyboard size={14} /> },
  { type: "wait", label: "Czekaj", icon: <Clock size={14} /> },
  { type: "call-function", label: "Wywołaj funkcję", icon: <ArrowLeftRight size={14} /> },
  { type: "if", label: "Jeśli", icon: <GitBranch size={14} /> },
  { type: "if-else", label: "jeżeli / w przeciwnym razie", icon: <GitBranch size={14} /> },
  { type: "random", label: "Losowo", icon: <Shuffle size={14} /> },
  { type: "counter", label: "Licznik", icon: <Hash size={14} /> },
];

const STEP_STYLE: Record<MacroStepType, { badge: string; border: string; glow: string; icon: string }> = {
  "insert-text": { badge: "bg-sky-500/15 text-sky-300", border: "border-sky-500/25", glow: "from-sky-500/10", icon: "text-sky-400" },
  "multiline-text": { badge: "bg-cyan-500/15 text-cyan-300", border: "border-cyan-500/25", glow: "from-cyan-500/10", icon: "text-cyan-400" },
  "key-press": { badge: "bg-orange-500/15 text-orange-300", border: "border-orange-500/25", glow: "from-orange-500/10", icon: "text-orange-400" },
  wait: { badge: "bg-amber-500/15 text-amber-300", border: "border-amber-500/25", glow: "from-amber-500/10", icon: "text-amber-400" },
  "call-function": { badge: "bg-fuchsia-500/15 text-fuchsia-300", border: "border-fuchsia-500/25", glow: "from-fuchsia-500/10", icon: "text-fuchsia-400" },
  if: { badge: "bg-indigo-500/15 text-indigo-300", border: "border-indigo-500/25", glow: "from-indigo-500/10", icon: "text-indigo-400" },
  "if-else": { badge: "bg-indigo-500/15 text-indigo-300", border: "border-indigo-500/25", glow: "from-indigo-500/10", icon: "text-indigo-400" },
  random: { badge: "bg-violet-500/20 text-violet-200", border: "border-violet-500/35", glow: "from-violet-500/15", icon: "text-violet-300" },
  counter: { badge: "bg-emerald-500/15 text-emerald-300", border: "border-emerald-500/30", glow: "from-emerald-500/10", icon: "text-emerald-400" },
};

function emptyStep(type: MacroStepType): MacroStep {
  return {
    id: macroUid("step"),
    type,
    text: "",
    pressEnter: false,
    waitMs: type === "wait" ? 500 : undefined,
    key: type === "key-press" ? "Enter" : undefined,
    children: type === "random" || type === "if" || type === "if-else" ? [] : undefined,
    elseChildren: type === "if-else" ? [] : undefined,
    counterId: type === "counter" ? "ticket" : undefined,
  };
}

function syncTrigger(triggers: MacroTrigger[]): string {
  const t = triggers[0];
  return t ? `${t.prefix}${t.command}` : "";
}

export function MacrosPage() {
  const macros = useAppStore((s) => s.macros);
  const folders = useAppStore((s) => s.folders);
  const setMacros = useAppStore((s) => s.setMacros);
  const setFolders = useAppStore((s) => s.setFolders);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(macros[0]?.id ?? null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [packMsg, setPackMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const selected = macros.find((m) => m.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return macros;
    return macros.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.trigger.toLowerCase().includes(q) ||
        m.triggers?.some((t) => `${t.prefix}${t.command}`.toLowerCase().includes(q)),
    );
  }, [macros, query]);

  const addFolder = () => {
    setFolders([...folders, { id: macroUid("folder"), name: `Folder ${folders.length + 1}` }]);
  };

  const addMacro = (folderId: string | null) => {
    const m = migrateMacro({
      id: macroUid("macro"),
      name: ".",
      folderId,
      trigger: ".",
      triggers: [{ prefix: ".", command: "" }],
      random: false,
      enabled: true,
      steps: [emptyStep("insert-text")],
    });
    setMacros([...useAppStore.getState().macros, m]);
    setSelectedId(m.id);
  };

  const updateMacro = (id: string, patch: Partial<Macro>) => {
    const current = useAppStore.getState().macros;
    setMacros(current.map((m) => (m.id === id ? migrateMacro({ ...m, ...patch }) : m)));
  };

  const removeMacro = (id: string) => {
    const current = useAppStore.getState().macros;
    setMacros(current.filter((m) => m.id !== id));
    if (selectedId === id) setSelectedId(current.find((m) => m.id !== id)?.id ?? null);
  };

  const importDefaults = () => {
    const current = useAppStore.getState().macros;
    const names = new Set(current.map((m) => m.name));
    const extra = defaultMacros().filter((m) => !names.has(m.name));
    if (!extra.length) return;
    setMacros([...current, ...extra]);
    if (!selectedId && extra[0]) setSelectedId(extra[0].id);
  };

  const importFromFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = parseMacroFile(await file.text());
      const { next, added, skipped } = mergeImportedMacros(useAppStore.getState().macros, parsed.macros);
      setMacros(next);
      setPackMsg(added ? `Dodano ${added} makr` : skipped ? "Te makra już są" : "Pusty plik");
      if (added && parsed.macros[0]) setSelectedId(parsed.macros[0].id);
    } catch (err) {
      setPackMsg(err instanceof Error ? err.message : "Błąd pliku");
    }
  };

  const exportPack = (asTxt: boolean) => {
    const blob = new Blob([asTxt ? exportMacroTxt(macros) : exportMacroPack(macros, folders)], {
      type: "text/plain;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = asTxt ? "aries-makra.txt" : "aries-makra.ariesmacros";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="flex h-full min-h-0">
      <div className="flex w-[280px] shrink-0 flex-col border-r border-syn-line">
        <div className="flex items-center justify-between px-3 py-3">
          <div className="text-[15px] font-medium text-white">Makra</div>
          <div className="flex items-center gap-1 text-zinc-500">
            <button title="Nowe makro" className="rounded p-1 hover:bg-white/5 hover:text-white" onClick={() => addMacro(null)}>
              <Plus size={15} />
            </button>
            <button title="Wczytaj z pliku" className="rounded p-1 hover:bg-white/5 hover:text-white" onClick={() => fileRef.current?.click()}>
              <FileUp size={15} />
            </button>
            <button title="Zapisz do pliku" className="rounded p-1 hover:bg-white/5 hover:text-white" onClick={() => exportPack(true)}>
              <Download size={15} />
            </button>
            <button title="Nowy folder" className="rounded p-1 hover:bg-white/5 hover:text-white" onClick={addFolder}>
              <FolderPlus size={15} />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.macros,.ariesmacros,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                void importFromFile(file);
              }}
            />
          </div>
        </div>
        <div className="px-3 pb-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj makr..."
            className="h-8 w-full rounded-md border border-syn-border bg-[#0c0c0e] px-2 text-[12px] outline-none"
          />
          {packMsg ? <div className="mt-2 text-[11px] text-emerald-400">{packMsg}</div> : null}
        </div>
        <div className="flex-1 overflow-auto px-2 pb-3">
          {filtered.filter((m) => m.folderId === null).map((m) => (
            <MacroRow
              key={m.id}
              macro={m}
              active={m.id === selectedId}
              onSelect={() => setSelectedId(m.id)}
              onToggle={() => updateMacro(m.id, { enabled: !m.enabled })}
              onDragStart={() => setDragId(m.id)}
            />
          ))}
          {folders.map((folder) => (
            <FolderBlock
              key={folder.id}
              folder={folder}
              macros={filtered.filter((m) => m.folderId === folder.id)}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onToggle={(id, enabled) => updateMacro(id, { enabled })}
              onDragStart={setDragId}
              onDrop={() => {
                if (dragId) updateMacro(dragId, { folderId: folder.id });
                setDragId(null);
              }}
              onRename={() => {
                const name = window.prompt("Nazwa folderu", folder.name);
                if (name) setFolders(folders.map((f) => (f.id === folder.id ? { ...f, name } : f)));
              }}
              onRemoveFolder={() => {
                setFolders(folders.filter((f) => f.id !== folder.id));
                setMacros(macros.map((m) => (m.folderId === folder.id ? { ...m, folderId: null } : m)));
              }}
              onAdd={() => addMacro(folder.id)}
            />
          ))}
        </div>
      </div>

      <div className="min-w-0 flex-1 overflow-auto p-5">
        {!selected ? (
          <div className="flex h-full items-center justify-center text-[13px] text-zinc-600">Wybierz lub utwórz makro</div>
        ) : (
          <MacroEditor
            macro={selected}
            folders={folders}
            onChange={(patch) => updateMacro(selected.id, patch)}
            onDelete={() => removeMacro(selected.id)}
            onImportDefaults={importDefaults}
          />
        )}
      </div>
    </div>
  );
}

function FolderBlock({
  folder,
  macros,
  selectedId,
  onSelect,
  onToggle,
  onDragStart,
  onDrop,
  onRename,
  onRemoveFolder,
  onAdd,
}: {
  folder: MacroFolder;
  macros: Macro[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onDragStart: (id: string) => void;
  onDrop: () => void;
  onRename: () => void;
  onRemoveFolder: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="mt-2" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <div className="flex items-center gap-1 px-2 py-1 text-[12px] text-zinc-400">
        <Folder size={13} />
        <button className="flex-1 truncate text-left hover:text-white" onClick={onRename}>
          {folder.name}
        </button>
        <button className="text-zinc-600 hover:text-white" onClick={onAdd}>
          <Plus size={12} />
        </button>
        <button className="text-zinc-600 hover:text-red-400" onClick={onRemoveFolder}>
          <Trash2 size={12} />
        </button>
      </div>
      {macros.map((m) => (
        <MacroRow
          key={m.id}
          macro={m}
          active={m.id === selectedId}
          onSelect={() => onSelect(m.id)}
          onToggle={() => onToggle(m.id, !m.enabled)}
          onDragStart={() => onDragStart(m.id)}
        />
      ))}
    </div>
  );
}

function MacroRow({
  macro,
  active,
  onSelect,
  onToggle,
  onDragStart,
}: {
  macro: Macro;
  active: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onDragStart: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onSelect}
      className={`mb-0.5 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 ${
        active ? "bg-[#1c1c1f]" : "hover:bg-white/[0.03]"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] text-white">{macro.name}</div>
        <div className="text-[11px] text-zinc-600">+ Spacja</div>
      </div>
      <Pencil size={13} className="text-zinc-600" />
      <button
        className={macro.enabled ? "text-syn-green" : "text-zinc-700"}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        <Power size={13} />
      </button>
    </div>
  );
}

function MacroEditor({
  macro,
  folders,
  onChange,
  onDelete,
  onImportDefaults,
}: {
  macro: Macro;
  folders: MacroFolder[];
  onChange: (patch: Partial<Macro>) => void;
  onDelete: () => void;
  onImportDefaults: () => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [draggedStepId, setDraggedStepId] = useState<string | null>(null);
  const addRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!addRef.current?.contains(e.target as Node)) setAddOpen(false);
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const triggers = macro.triggers?.length ? macro.triggers : [parseTrigger(macro.trigger || macro.name)];

  const setTriggers = (next: MacroTrigger[]) => {
    onChange({ triggers: next, trigger: syncTrigger(next), name: syncTrigger(next) || macro.name });
  };

  const addStep = (type: MacroStepType) => {
    const step = emptyStep(type);
    // A random block is a container. New steps are created beside it and the
    // user chooses exactly which ones become its options by dragging them in.
    onChange({ steps: [...macro.steps, step], random: type === "random" || macro.random });
    setAddOpen(false);
  };

  const mapSteps = (steps: MacroStep[], fn: (s: MacroStep) => MacroStep): MacroStep[] => steps.map(fn);

  const patchStep = (id: string, patch: Partial<MacroStep>) => {
    const walk = (steps: MacroStep[]): MacroStep[] =>
      mapSteps(steps, (s) => {
        if (s.id === id) return { ...s, ...patch };
        return {
          ...s,
          children: s.children ? walk(s.children) : s.children,
          elseChildren: s.elseChildren ? walk(s.elseChildren) : s.elseChildren,
        };
      });
    onChange({ steps: walk(macro.steps) });
  };

  const removeStep = (id: string) => {
    const walk = (steps: MacroStep[]): MacroStep[] =>
      steps
        .filter((s) => s.id !== id)
        .map((s) => ({
          ...s,
          children: s.children ? walk(s.children) : s.children,
          elseChildren: s.elseChildren ? walk(s.elseChildren) : s.elseChildren,
        }));
    onChange({ steps: walk(macro.steps) });
  };

  const addChild = (parentId: string, type: MacroStepType) => {
    const walk = (steps: MacroStep[]): MacroStep[] =>
      mapSteps(steps, (s) => {
        if (s.id === parentId) return { ...s, children: [...(s.children ?? []), emptyStep(type)] };
        return {
          ...s,
          children: s.children ? walk(s.children) : s.children,
          elseChildren: s.elseChildren ? walk(s.elseChildren) : s.elseChildren,
        };
      });
    onChange({ steps: walk(macro.steps) });
  };

  const moveStepToRandom = (stepId: string, randomId: string) => {
    let moved: MacroStep | null = null;
    const remove = (steps: MacroStep[]): MacroStep[] =>
      steps
        .filter((step) => {
          if (step.id !== stepId) return true;
          moved = step;
          return false;
        })
        .map((step) => ({
          ...step,
          children: step.children ? remove(step.children) : step.children,
          elseChildren: step.elseChildren ? remove(step.elseChildren) : step.elseChildren,
        }));

    const withoutMoved = remove(macro.steps);
    // TypeScript cannot see the assignment made inside the recursive callback.
    const selectedStep = moved as MacroStep | null;
    if (!selectedStep || selectedStep.id === randomId || selectedStep.type === "random") return;
    const insert = (steps: MacroStep[]): MacroStep[] =>
      steps.map((step) =>
        step.id === randomId
          ? { ...step, children: [...(step.children ?? []), selectedStep] }
          : {
              ...step,
              children: step.children ? insert(step.children) : step.children,
              elseChildren: step.elseChildren ? insert(step.elseChildren) : step.elseChildren,
            },
      );
    onChange({ steps: insert(withoutMoved) });
  };

  const share = async () => {
    await navigator.clipboard.writeText(JSON.stringify(macro, null, 2));
  };

  const moveToFolder = () => {
    const names = ["(bez folderu)", ...folders.map((f) => f.name)].join("\n");
    const picked = window.prompt(`Folder:\n${names}`, folders[0]?.name ?? "");
    if (picked == null) return;
    if (picked === "(bez folderu)" || picked === "") onChange({ folderId: null });
    else {
      const f = folders.find((x) => x.name === picked);
      if (f) onChange({ folderId: f.id });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <input
          value={macro.name}
          onChange={(e) => {
            const name = e.target.value;
            const t = parseTrigger(name);
            onChange({ name, trigger: name, triggers: [{ ...t }] });
          }}
          className="bg-transparent text-[20px] font-semibold text-white outline-none"
        />
        <div className="flex items-center gap-2">
          <div className="relative" ref={addRef}>
            <button
              onClick={() => setAddOpen((v) => !v)}
              className="flex h-8 items-center gap-1 rounded-md border border-syn-border px-2 text-[12px] text-zinc-300"
            >
              <Plus size={13} /> Dodaj krok
            </button>
            {addOpen ? (
              <div className="absolute right-0 z-20 mt-1 w-[240px] rounded-md border border-syn-border bg-[#121214] py-1 shadow-xl">
                {STEP_MENU.map((item) => (
                  <button
                    key={item.type}
                    onClick={() => addStep(item.type)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-zinc-300 hover:bg-white/5"
                  >
                    <span className="text-zinc-500">{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-syn-border text-zinc-400 hover:text-white"
            >
              <MoreHorizontal size={16} />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 z-20 mt-1 w-[220px] rounded-md border border-syn-border bg-[#121214] py-1 shadow-xl">
                <MenuItem label="Przenieś do folderu" onClick={moveToFolder} />
                <MenuItem label="Udostępnij makro" onClick={() => void share()} />
                <MenuItem label="Importuj makra domyślne" onClick={onImportDefaults} />
                <MenuItem
                  label={macro.enabled ? "Dezaktywuj" : "Aktywuj"}
                  onClick={() => onChange({ enabled: !macro.enabled })}
                />
                <MenuItem
                  label="Usuń"
                  danger
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
        <span className="h-2 w-2 rounded-full bg-zinc-500" /> Wyzwalacz
      </div>
      <div className="mt-2 space-y-2 rounded-xl border border-zinc-800 bg-[#09090a] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.035)]">
        {triggers.map((t, i) => (
          <div key={`trigger-${i}`} className="flex flex-wrap items-center gap-2">
            <label className="text-[12px] text-zinc-500">
              Prefiks
              <input
                value={t.prefix}
                onChange={(e) => {
                  const next = triggers.map((x, idx) => (idx === i ? { ...x, prefix: e.target.value } : x));
                  setTriggers(next);
                }}
                className="ml-2 h-8 w-16 rounded-md border border-zinc-700 bg-black px-2 text-[13px] text-zinc-100 outline-none focus:border-zinc-400"
              />
            </label>
            <label className="text-[12px] text-zinc-500">
              Polecenie {i + 1}
              <input
                value={t.command}
                onChange={(e) => {
                  const next = triggers.map((x, idx) => (idx === i ? { ...x, command: e.target.value } : x));
                  setTriggers(next);
                }}
                className="ml-2 h-8 w-28 rounded-md border border-zinc-700 bg-black px-2 text-[13px] text-zinc-100 outline-none focus:border-zinc-400"
              />
            </label>
            {triggers.length > 1 ? (
              <button
                className="text-zinc-600 hover:text-red-400"
                onClick={() => setTriggers(triggers.filter((_, idx) => idx !== i))}
              >
                <Trash2 size={13} />
              </button>
            ) : null}
          </div>
        ))}
        <button
          onClick={() => setTriggers([...triggers, { prefix: triggers[0]?.prefix ?? ".", command: "" }])}
          className="rounded-md bg-zinc-800 px-2 py-1 text-[12px] text-zinc-300 transition hover:bg-zinc-700 hover:text-white"
        >
          + Dodaj wyzwalacz
        </button>
      </div>

      <div className="mt-6 text-[11px] uppercase tracking-wider text-zinc-600">Akcje</div>
      <div className="mt-2 space-y-2">
        {macro.steps.map((step) => (
          <StepBlock
            key={step.id}
            step={step}
            compact={false}
            onPatch={patchStep}
            onRemove={removeStep}
            onAddChild={addChild}
            onDragStart={setDraggedStepId}
            onDropIntoRandom={(randomId) => {
              if (draggedStepId) moveStepToRandom(draggedStepId, randomId);
              setDraggedStepId(null);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function MenuItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full px-3 py-1.5 text-left text-[13px] hover:bg-white/5 ${danger ? "text-red-400" : "text-zinc-300"}`}
    >
      {label}
    </button>
  );
}

function stepTitle(type: MacroStepType) {
  return STEP_MENU.find((s) => s.type === type)?.label ?? "Krok";
}

function StepBlock({
  step,
  compact,
  onPatch,
  onRemove,
  onAddChild,
  onDragStart,
  onDropIntoRandom,
}: {
  step: MacroStep;
  compact: boolean;
  onPatch: (id: string, patch: Partial<MacroStep>) => void;
  onRemove: (id: string) => void;
  onAddChild: (id: string, type: MacroStepType) => void;
  onDragStart: (id: string) => void;
  onDropIntoRandom: (randomId: string) => void;
}) {
  const nested = step.type === "random" || step.type === "if" || step.type === "if-else";
  const count = step.children?.length ?? 0;
  const style = STEP_STYLE[step.type];

  if (nested) {
    return (
      <div
        className={`overflow-hidden rounded-xl border bg-gradient-to-br ${style.glow} via-syn-card to-syn-card p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.04)] ${style.border}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          onDropIntoRandom(step.id);
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${style.badge}`}>{stepTitle(step.type)}</span>
              {step.type === "random" ? <span className="text-[11px] text-violet-200/70">Wybiera jedną opcję</span> : null}
            </div>
            {step.type === "random" ? (
              <div className="text-[11px] text-zinc-500">{count} propozycje</div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-md bg-violet-500/15 px-2 py-1 text-[12px] text-violet-200 transition hover:bg-violet-500/25 hover:text-white"
              onClick={() => onAddChild(step.id, "insert-text")}
            >
              + Dodaj opcję tekstową
            </button>
            <button className="text-zinc-600 hover:text-red-400" onClick={() => onRemove(step.id)}>
              <Trash2 size={13} />
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {(step.children ?? []).map((child) => (
            <StepBlock
              key={child.id}
              step={child}
              compact={compact}
              onPatch={onPatch}
              onRemove={onRemove}
              onAddChild={onAddChild}
              onDragStart={onDragStart}
              onDropIntoRandom={onDropIntoRandom}
            />
          ))}
          {step.type === "random" ? (
            <div className="rounded-lg border border-dashed border-violet-400/35 bg-violet-500/[0.06] px-3 py-5 text-center text-[12px] text-violet-200/70">
              <Shuffle size={15} className="mx-auto mb-1 text-violet-300" />
              Przeciągnij tutaj krok, który ma być losową opcją.
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        onDragStart(step.id);
      }}
      className={`group relative overflow-hidden rounded-xl border bg-gradient-to-r ${style.glow} via-syn-card to-syn-card p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.035)] transition hover:-translate-y-px hover:bg-syn-elevated ${style.border}`}
    >
      <div className="mb-2 flex items-center justify-between text-[12px] text-zinc-400">
        <span className="flex items-center gap-2">
          <GripVertical size={12} className="cursor-grab text-zinc-500 group-active:cursor-grabbing" />
          <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${style.badge}`}>{stepTitle(step.type)}</span>
        </span>
        <button className="text-zinc-600 hover:text-red-400" onClick={() => onRemove(step.id)}>
          <Trash2 size={13} />
        </button>
      </div>
      {step.type === "multiline-text" ? (
        <textarea
          value={step.text}
          onChange={(e) => onPatch(step.id, { text: e.target.value })}
          rows={compact ? 2 : 4}
          className="w-full rounded-md border border-syn-border bg-[#0c0c0e] px-3 py-2 text-[13px] outline-none"
        />
      ) : step.type === "wait" ? (
        <input
          type="number"
          value={step.waitMs ?? 500}
          onChange={(e) => onPatch(step.id, { waitMs: Number(e.target.value) })}
          className="h-9 w-40 rounded-md border border-syn-border bg-[#0c0c0e] px-3 text-[13px] outline-none"
        />
      ) : step.type === "key-press" ? (
        <input
          value={step.key ?? ""}
          onChange={(e) => onPatch(step.id, { key: e.target.value, text: e.target.value })}
          placeholder="Enter, T, ..."
          className="h-9 w-full rounded-md border border-syn-border bg-[#0c0c0e] px-3 text-[13px] outline-none"
        />
      ) : step.type === "counter" ? (
        <>
          <select
            value={step.counterId ?? "ticket"}
            onChange={(e) => onPatch(step.id, { counterId: e.target.value })}
            className="h-9 rounded-md border border-emerald-500/30 bg-[#07110d] px-3 text-[13px] text-emerald-100 outline-none focus:border-emerald-400"
          >
            <option value="ticket">Licznik reportów</option>
            <option value="event-specs">Licznik spec eventów</option>
          </select>
          <div className="mt-2 text-[11px] text-emerald-200/65">Zwiększy wybrany licznik o 1 po uruchomieniu makra.</div>
        </>
      ) : (
        <input
          value={step.text}
          onChange={(e) => onPatch(step.id, { text: e.target.value })}
          className="h-9 w-full rounded-md border border-syn-border bg-[#0c0c0e] px-3 text-[13px] outline-none"
          placeholder="Tekst do wstawienia"
        />
      )}
      {step.type === "insert-text" || step.type === "multiline-text" ? (
        <>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[12px] text-zinc-500">Naciśnij Enter po wstawieniu</span>
            <Toggle checked={step.pressEnter} onChange={(v) => onPatch(step.id, { pressEnter: v })} />
          </div>
          <div className="mt-2 text-[11px] leading-snug text-zinc-600">
            Użyj %1 by wstawić jako zmienną lub nazwę. Użyj {"{tab}"}, aby wstawić tabulator.
          </div>
        </>
      ) : null}
    </div>
  );
}
