import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import crafts from "@/data/crafts.json";
import {
  CRAFT_FRACTIONS,
  EMPTY_STOCK,
  MATERIAL_KEYS,
  asStock,
  formatKg,
  fractionMeta,
  materialMeta,
  type CraftItem,
  type MaterialKey,
  type MaterialStock,
} from "@/data/craftMeta";
import { useAppStore } from "@/store/useAppStore";

const ITEMS = crafts as CraftItem[];

function parseCount(value: string) {
  const n = Math.floor(Number(value.replace(",", ".")));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function CraftPage() {
  const [query, setQuery] = useState("");
  const [filterFaction, setFilterFaction] = useState("all");
  const [cart, setCart] = useState<Record<number, number>>({});
  const [qty, setQty] = useState<Record<number, string>>({});
  const [cmdFaction, setCmdFaction] = useState(CRAFT_FRACTIONS[0].id);
  const [copied, setCopied] = useState(false);
  const stocks = useAppStore((s) => s.settings.craftStocks) ?? {};
  const patchSettings = useAppStore((s) => s.patchSettings);
  const current = asStock(stocks[cmdFaction]);
  const faction = fractionMeta(cmdFaction);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ITEMS.filter((item) => {
      if (filterFaction !== "all" && !item.fractions.includes(filterFaction)) return false;
      if (!q) return true;
      return item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
    });
  }, [query, filterFaction]);

  const cartItems = ITEMS.filter((item) => cart[item.id] > 0);

  const needed = useMemo(() => {
    const next: MaterialStock = { ...EMPTY_STOCK };
    for (const item of cartItems) {
      const key = (MATERIAL_KEYS.includes(item.materialType as MaterialKey)
        ? item.materialType
        : "green") as MaterialKey;
      next[key] += item.materials * cart[item.id];
    }
    return next;
  }, [cartItems, cart]);

  const weightGrams = cartItems.reduce((sum, item) => sum + item.weight * cart[item.id], 0);

  const totals = useMemo(() => {
    const next: MaterialStock = { ...EMPTY_STOCK };
    for (const key of MATERIAL_KEYS) next[key] = current[key] + needed[key];
    return next;
  }, [current, needed]);

  const commands = MATERIAL_KEYS.filter((key) => needed[key] > 0).map(
    (key) => `/setmaterials ${faction.gameId} ${key} ${totals[key]}`,
  );

  function add(item: CraftItem) {
    const count = parseCount(qty[item.id] ?? "1") || 1;
    setCart((prev) => ({ ...prev, [item.id]: (prev[item.id] || 0) + count }));
  }

  function setHave(key: MaterialKey, value: string) {
    const next = { ...current, [key]: parseCount(value) };
    patchSettings({
      craftStocks: { ...stocks, [cmdFaction]: next },
    });
  }

  function applyResult() {
    patchSettings({
      craftStocks: { ...stocks, [cmdFaction]: { ...totals } },
    });
    setCart({});
  }

  async function copyCommands() {
    if (!commands.length) return;
    await navigator.clipboard.writeText(commands.join("\n"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="studio-page craft-page">
      <div className="studio-header">
        <div className="credits-kicker">CRAFT</div>
        <h1>Tabela krafta</h1>
        <div className="credits-rule" />
      </div>
      <div className="studio-body craft-body">
        <div className="studio-card craft-formula">
          <div className="craft-formula-title">Formuła /setmaterials</div>
          <div className="craft-formula-grid craft-formula-grid-2">
            <div>
              <div className="craft-formula-label">Frakcja</div>
              <select
                className="craft-formula-select"
                value={cmdFaction}
                onChange={(e) => setCmdFaction(e.target.value)}
              >
                {CRAFT_FRACTIONS.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.label} · ID {row.gameId}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="craft-formula-label">Aktualnie ma (zapisuje się)</div>
              <div className="craft-formula-row">
                {MATERIAL_KEYS.map((key) => (
                  <label key={key} className={`craft-mat-field craft-qty-${key}`}>
                    {key}
                    <input
                      type="number"
                      min={0}
                      value={current[key] || ""}
                      placeholder="0"
                      onChange={(e) => setHave(key, e.target.value)}
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="craft-needed">
            Potrzeba z craftu
            {MATERIAL_KEYS.map((key) => (
              <span key={key} className={`craft-qty-type-inline craft-qty-${key}`}>
                {needed[key]} {key}
              </span>
            ))}
            <span className="craft-needed-weight">łącznie {formatKg(weightGrams)}</span>
          </div>
          <div className="craft-formula-result">
            <div className="craft-formula-cmds">
              {commands.length ? (
                commands.map((cmd) => <code key={cmd}>{cmd}</code>)
              ) : (
                <span>Dodaj przedmioty z kart poniżej.</span>
              )}
            </div>
            <div className="craft-formula-actions">
              <button type="button" className="craft-add" disabled={!commands.length} onClick={() => void copyCommands()}>
                {copied ? "Skopiowano" : "Kopiuj"}
              </button>
              <button type="button" className="craft-add" disabled={!commands.length} onClick={applyResult}>
                Dodaj do stanu
              </button>
            </div>
          </div>
        </div>

        <div className="craft-toolbar">
          <label className="craft-search">
            <Search size={14} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Szukaj przedmiotu…"
            />
          </label>
          <div className="craft-factions">
            <button
              type="button"
              className={filterFaction === "all" ? "is-on" : undefined}
              onClick={() => setFilterFaction("all")}
            >
              Wszystkie
            </button>
            {CRAFT_FRACTIONS.map((row) => (
              <button
                key={row.id}
                type="button"
                className={filterFaction === row.id ? "is-on" : undefined}
                onClick={() => setFilterFaction(row.id)}
              >
                <span className="craft-dot" style={{ background: row.color }} />
                {row.label}
              </button>
            ))}
          </div>
        </div>

        <div className="craft-grid">
          {list.map((item) => {
            const count = parseCount(qty[item.id] ?? "1") || 1;
            return (
              <article key={item.id} className="craft-win" title={item.description}>
                <div className="craft-win-dots">
                  {item.fractions.map((id) => (
                    <span key={id} className="craft-dot" style={{ background: fractionMeta(id).color }} />
                  ))}
                </div>
                <div className="craft-win-art">
                  <img src={item.imageUrl} alt="" draggable={false} />
                </div>
                <div className="craft-win-name">{item.name}</div>
                <div className="craft-win-meta">
                  <span className={`craft-qty craft-qty-${item.materialType}`}>
                    {item.materials}
                    <span className="craft-qty-type">{materialMeta(item.materialType).label}</span>
                  </span>
                  <span className="craft-kg">
                    {formatKg(item.weight)}
                    {count > 1 ? ` · ${formatKg(item.weight * count)}` : ""}
                  </span>
                </div>
                <div className="craft-win-bar">
                  <input
                    className="craft-count"
                    type="number"
                    min={1}
                    value={qty[item.id] ?? "1"}
                    onChange={(e) => setQty((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  />
                  <button type="button" className="craft-add" onClick={() => add(item)}>
                    DODAJ
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        {list.length === 0 ? <div className="mt-8 text-center text-[13px] text-zinc-500">Brak przedmiotów</div> : null}
      </div>

      {cartItems.length ? (
        <div className="craft-cart">
          <div className="craft-cart-meta">Wybrane · {formatKg(weightGrams)}</div>
          <div className="craft-cart-list">
            {cartItems.map((item) => (
              <span key={item.id}>
                {item.name} ×{cart[item.id]} · {formatKg(item.weight * cart[item.id])}
              </span>
            ))}
          </div>
          <button type="button" className="craft-add" onClick={() => setCart({})}>
            Wyczyść
          </button>
        </div>
      ) : null}
    </div>
  );
}
