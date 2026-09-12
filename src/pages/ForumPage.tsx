import { forumRuleById } from "@/data/forumRules";
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
