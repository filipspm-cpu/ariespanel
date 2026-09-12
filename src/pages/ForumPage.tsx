import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { forumRuleById } from "@/data/forumRules";
import { askForum, searchForum, type ForumHit } from "@/data/forumIndex";
import { useAppStore } from "@/store/useAppStore";

const SECTION_TITLES = new Set([
  "Awanse / Zwolnienia",
  "Liderom zabrania się",
  "Obowiązki lidera",
  "Postanowienia ogólne",
  "Zadania i obowiązki FIB",
  "Zadania i obowiązki LSPD / LSCSD",
  "Zadania i obowiązki Rządu",
  "Zadania i obowiązki USSS",
  "Zasady AirDrop",
  "Zasady AirDrop & Wojny Magazynów/Dealerów",
  "Zasady Ataku na Fort Zancudo i Cayo Perico",
  "Zasady Captures (Turfs)",
  "Zasady Dealerów i Magazynów",
  "Zasady Dostaw & Kraftu",
  "Zasady Napadu na Bank & Biznes",
  "Zasady Ogólne",
  "Zasady Ogólne - Klany",
  "Zasady Ogólne - Rodziny",
  "Zasady Organizacje kryminalnych",
  "Zasady SANG",
  "Zasady dla frakcji kryminalnych",
  "Zasady dla frakcji państwowych",
  "Zasady dla organizacji kryminalnych",
  "Zasady dla organizacji państwowych",
  "Zasady dotyczące frakcji państwowych",
  "Zasady frakcji państwowych",
  "Zasady gry",
  "Zasady ogólne",
  "Zasady ogólne - Cayo Perico",
  "Zasady ogólne - Fort Zancudo",
  "Zasady ogólne Captures Gangów",
  "Zasady ogólne Captures Rodzinnych",
  "Zasady ogólne nalotu",
  "Zasady porwań dla frakcji państwowej",
  "Zasady przechwytywania dostaw",
  "Zasady rabunku dla organizacji kryminalnych",
  "Zasady składania skarg w ticketach",
  "Zasady weryfikacji oprogramowania firm trzecich",
]);

function isSectionTitle(line: string) {
  return SECTION_TITLES.has(line.trim().replace(/:$/, ""));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightText({ text, needle }: { text: string; needle: string }) {
  const q = needle.trim();
  if (q.length < 2) return <>{text}</>;
  const re = new RegExp(`(${escapeRegExp(q)})`, "gi");
  const parts = text.split(re);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="forum-mark">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function HitCard({
  hit,
  active,
  onOpen,
}: {
  hit: ForumHit;
  active?: boolean;
  onOpen: (hit: ForumHit) => void;
}) {
  return (
    <button type="button" className={`forum-hit ${active ? "on" : ""}`} onClick={() => onOpen(hit)}>
      <div className="forum-hit-meta">
        {hit.point ? <span className="forum-hit-point">Pkt {hit.point}</span> : null}
        <span className="forum-hit-doc">{hit.ruleTitle}</span>
      </div>
      <div className="forum-hit-text">{hit.text}</div>
      {hit.penalty ? <div className="forum-hit-penalty">{hit.penalty}</div> : null}
    </button>
  );
}

export function ForumPage() {
  const forumRuleId = useAppStore((s) => s.forumRuleId);
  const setForumRule = useAppStore((s) => s.setForumRule);
  const rule = forumRuleById(forumRuleId);
  const lines = useMemo(
    () => rule.body.replace(/\u200B/g, "").replace(/\r\n/g, "\n").split("\n"),
    [rule.body],
  );
  const [search, setSearch] = useState("");
  const [ask, setAsk] = useState("");
  const [asked, setAsked] = useState("");
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const lineRefs = useRef<Record<number, HTMLElement | null>>({});

  const searchHits = useMemo(() => searchForum(search, 12), [search]);
  const askHits = useMemo(() => (asked ? askForum(asked, 3) : []), [asked]);
  const needle = asked || search;
  const showAsk = asked.length >= 2;
  const showSearch = !showAsk && search.trim().length >= 2;

  useEffect(() => {
    if (activeLine == null) return;
    lineRefs.current[activeLine]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeLine, rule.id]);

  function openHit(hit: ForumHit) {
    setForumRule(hit.ruleId);
    setActiveLine(hit.lineIndex);
  }

  function runAsk() {
    const q = ask.trim();
    if (q.length < 2) return;
    setAsked(q);
    const hits = askForum(q, 3);
    if (hits[0]) openHit(hits[0]);
  }

  return (
    <div className="studio-page">
      <div className="studio-header">
        <div className="credits-kicker">FORUM</div>
        <h1>{rule.title}</h1>
        <div className="credits-rule" />
      </div>
      <div className="studio-body">
        <div className="studio-card forum-tools">
          <label className="forum-field">
            <Search size={14} />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setAsked("");
              }}
              placeholder="Szukaj we wszystkich regulaminach"
            />
          </label>
          <form
            className="forum-field forum-ask"
            onSubmit={(e) => {
              e.preventDefault();
              runAsk();
            }}
          >
            <Sparkles size={14} />
            <input
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              placeholder="Zapytaj asystenta, np. kara za RDM"
            />
            <button type="submit">Sprawdź</button>
          </form>
        </div>

        {showAsk ? (
          <div className="forum-results">
            <div className="forum-results-label">Konkretne punkty</div>
            {askHits.length ? (
            {askHits.map((hit) => (
                <HitCard
                  key={`${hit.ruleId}-${hit.lineIndex}`}
                  hit={hit}
                  active={hit.ruleId === rule.id && hit.lineIndex === activeLine}
                  onOpen={openHit}
                />
              ))
            ) : (
              <div className="forum-empty">Nie znaleziono punktu do tego pytania.</div>
            )}
          </div>
        ) : null}

        {showSearch ? (
          <div className="forum-results">
            <div className="forum-results-label">Wyniki wyszukiwania</div>
            {searchHits.length ? (
              searchHits.map((hit) => (
                <HitCard
                  key={`${hit.ruleId}-${hit.lineIndex}`}
                  hit={hit}
                  active={hit.ruleId === rule.id && hit.lineIndex === activeLine}
                  onOpen={openHit}
                />
              ))
            ) : (
              <div className="forum-empty">Brak trafień.</div>
            )}
          </div>
        ) : null}

        <article className="studio-card forum-card">
          <pre className="forum-pre">
            {lines.map((line, i) => {
              const nl = i < lines.length - 1 ? "\n" : "";
              const heading = isSectionTitle(line);
              const active = activeLine === i;
              return (
                <span
                  key={i}
                  ref={(el) => {
                    lineRefs.current[i] = el;
                  }}
                  className={active ? "forum-active" : undefined}
                >
                  {heading ? (
                    <strong>
                      <HighlightText text={line} needle={needle} />
                    </strong>
                  ) : (
                    <HighlightText text={line} needle={needle} />
                  )}
                  {nl}
                </span>
              );
            })}
          </pre>
        </article>
      </div>
    </div>
  );
}
