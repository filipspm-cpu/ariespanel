import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import crafts from "@/data/crafts.json";
import { CRAFT_FRACTIONS, fractionMeta, materialMeta, type CraftItem } from "@/data/craftMeta";

const ITEMS = crafts as CraftItem[];

export function CraftPage() {
  const [query, setQuery] = useState("");
  const [faction, setFaction] = useState("all");
  const [cart, setCart] = useState<Record<number, number>>({});

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ITEMS.filter((item) => {
      if (faction !== "all" && !item.fractions.includes(faction)) return false;
      if (!q) return true;
      return item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
    });
  }, [query, faction]);

  const cartItems = ITEMS.filter((item) => cart[item.id] > 0);
  const matsByType = cartItems.reduce<Record<string, number>>((acc, item) => {
    acc[item.materialType] = (acc[item.materialType] || 0) + item.materials * (cart[item.id] || 0);
    return acc;
  }, {});

  function add(id: number) {
    setCart((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  }

  return (
    <div className="studio-page craft-page">
      <div className="studio-header">
        <div className="credits-kicker">CRAFT</div>
        <h1>Tabela krafta</h1>
        <div className="credits-rule" />
      </div>
      <div className="studio-body craft-body">
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
              className={faction === "all" ? "is-on" : undefined}
              onClick={() => setFaction("all")}
            >
              Wszystkie
            </button>
            {CRAFT_FRACTIONS.map((row) => (
              <button
                key={row.id}
                type="button"
                className={faction === row.id ? "is-on" : undefined}
                onClick={() => setFaction(row.id)}
              >
                <span className="craft-dot" style={{ background: row.color }} />
                {row.label}
              </button>
            ))}
          </div>
        </div>

        <div className="craft-grid">
          {list.map((item) => (
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
              <div className="craft-win-bar">
                <span className={`craft-qty craft-qty-${item.materialType}`}>
                  {item.materials}
                  <span className="craft-qty-type">{materialMeta(item.materialType).label}</span>
                </span>
                <button type="button" className="craft-add" onClick={() => add(item.id)}>
                  DODAJ
                </button>
              </div>
            </article>
          ))}
        </div>
        {list.length === 0 ? <div className="mt-8 text-center text-[13px] text-zinc-500">Brak przedmiotów</div> : null}
      </div>

      {cartItems.length ? (
        <div className="craft-cart">
          <div className="craft-cart-meta">
            Kalkulator
            {Object.entries(matsByType).map(([type, count]) => (
              <span key={type} className={`craft-qty-type-inline craft-qty-${type}`}>
                {count} {materialMeta(type).label}
              </span>
            ))}
          </div>
          <div className="craft-cart-list">
            {cartItems.map((item) => (
              <span key={item.id}>
                {item.name} ×{cart[item.id]}
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
