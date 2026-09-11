import { useEffect, useState } from "react";
import { ExternalLink, LoaderCircle } from "lucide-react";
import { FORUM_RULES, forumRuleById } from "@/data/forumRules";
import { useAppStore } from "@/store/useAppStore";

export function ForumPage() {
  const ruleId = useAppStore((s) => s.forumRuleId);
  const rule = forumRuleById(ruleId);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setBusy(true);
    setError("");
    setText("");
    void window.synvity
      ?.forumText(rule.url)
      .then((body) => {
        if (!alive) return;
        setText(body || "");
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Nie udało się wczytać regulaminu.");
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [rule.url]);

  return (
    <div className="studio-page">
      <div className="studio-header">
        <div className="credits-kicker">FORUM MAJESTIC</div>
        <h1>{rule.title}</h1>
        <div className="credits-rule" />
      </div>
      <div className="studio-body">
        <div className="studio-card forum-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-[12px] text-zinc-500">
              {FORUM_RULES.length} regulaminów · sam tekst z oficjalnego wątku
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400 hover:text-white"
              onClick={() => void window.synvity?.forumOpen(rule.url)}
            >
              <ExternalLink size={13} />
              Otwórz na forum
            </button>
          </div>
          {busy ? (
            <div className="mt-8 flex items-center gap-2 text-[13px] text-zinc-500">
              <LoaderCircle size={16} className="animate-spin" />
              Wczytywanie regulaminu…
            </div>
          ) : null}
          {error ? <div className="mt-6 text-[13px] text-red-400">{error}</div> : null}
          {text ? <div className="forum-text">{text}</div> : null}
        </div>
      </div>
    </div>
  );
}
