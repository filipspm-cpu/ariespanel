import { forumRuleById } from "@/data/forumRules";
import { useAppStore } from "@/store/useAppStore";

function isSectionTitle(line: string) {
  const t = line.trim();
  if (!t) return false;
  if (/^\d/.test(t)) return false;
  if (t.includes("|")) return false;
  if (t.endsWith(".")) return false;
  if (t.length > 90) return false;
  if (/^(wyjaśnienie|uwaga|wyjątek|przykład)\b/i.test(t)) return false;
  return /^(zasady\b|postanowienia\b|obowiązki lidera\b|warunki dotyczące\b|organizacje kryminalne\b|rodziny i klany\b|dyplomacja\b|dyplomacje\b|działalność\b|liderom zabrania\b|awanse\s*\/\s*zwolnienia\b|wspólne zasady\b|zadania i obowiązki\b)/i.test(
    t,
  );
}

export function ForumPage() {
  const forumRuleId = useAppStore((s) => s.forumRuleId);
  const rule = forumRuleById(forumRuleId);
  const lines = rule.body.replace(/\u200B/g, "").replace(/\r\n/g, "\n").split("\n");

  return (
    <div className="studio-page">
      <div className="studio-header">
        <div className="credits-kicker">FORUM</div>
        <h1>{rule.title}</h1>
        <div className="credits-rule" />
      </div>
      <div className="studio-body">
        <article className="studio-card forum-card">
          <pre className="forum-pre">
            {lines.map((line, i) => {
              const nl = i < lines.length - 1 ? "\n" : "";
              if (isSectionTitle(line)) {
                return (
                  <strong key={i}>
                    {line}
                    {nl}
                  </strong>
                );
              }
              return (
                <span key={i}>
                  {line}
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
