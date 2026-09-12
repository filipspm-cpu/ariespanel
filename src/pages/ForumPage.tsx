import { forumRuleById } from "@/data/forumRules";
import { useAppStore } from "@/store/useAppStore";

const NOTE_RE = /^(wyjaśnienie|uwaga|wyjątek|przykład|w naszym rozumieniu)\b/i;
const RULE_RE = /^\d+(\.\d+)*/;

function isHeading(line: string) {
  const t = line.trim();
  if (!t || t.length > 90) return false;
  if (RULE_RE.test(t)) return false;
  if (t.includes(" | ")) return false;
  if (NOTE_RE.test(t)) return false;
  return true;
}

function RuleLine({ line }: { line: string }) {
  const trimmed = line.trim();
  if (!trimmed) return <div className="forum-gap" />;

  const pipe = trimmed.lastIndexOf(" | ");
  const main = pipe > 0 ? trimmed.slice(0, pipe).trim() : trimmed;
  const penalty = pipe > 0 ? trimmed.slice(pipe + 3).trim() : "";

  if (isHeading(main) && !penalty) {
    return <h2 className="forum-h">{main}</h2>;
  }

  const note = NOTE_RE.test(main);

  return (
    <p className={note ? "forum-note" : "forum-p"}>
      <span>{main}</span>
      {penalty ? <span className="forum-penalty">{penalty}</span> : null}
    </p>
  );
}

export function ForumPage() {
  const forumRuleId = useAppStore((s) => s.forumRuleId);
  const rule = forumRuleById(forumRuleId);
  const lines = rule.body.replace(/\u200B/g, "").split("\n");
  const bodyLines =
    lines[0]?.trim().toLowerCase() === rule.title.trim().toLowerCase() ? lines.slice(1) : lines;

  return (
    <div className="studio-page">
      <div className="studio-header">
        <div className="credits-kicker">FORUM</div>
        <h1>{rule.title}</h1>
        <div className="credits-rule" />
      </div>
      <div className="studio-body">
        <article className="studio-card forum-card">
          {bodyLines.map((line, i) => (
            <RuleLine key={`${i}-${line.slice(0, 24)}`} line={line} />
          ))}
        </article>
      </div>
    </div>
  );
}
