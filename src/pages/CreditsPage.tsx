import filipek from "@/assets/credits/filipek.webp";
import rysiasty from "@/assets/credits/rysiasty.webp";
import wisniowka from "@/assets/credits/wisniowka.webp";

const PEOPLE = [
  {
    role: "Main developer",
    name: "Filipek",
    featured: true,
    avatar: filipek,
  },
  {
    role: "Developer",
    name: "rysiasty",
    featured: false,
    avatar: rysiasty,
  },
  {
    role: "Beta tester",
    name: "wiśniófka",
    featured: false,
    avatar: wisniowka,
  },
] as const;

function CreditRow({
  person,
}: {
  person: (typeof PEOPLE)[number];
}) {
  const size = person.featured ? 92 : 64;
  return (
    <div className={`credits-row ${person.featured ? "credits-row-featured" : ""}`}>
      <div className="credits-avatar-wrap" style={{ width: size, height: size }}>
        <img src={person.avatar} alt="" width={size} height={size} draggable={false} referrerPolicy="no-referrer" />
      </div>
      <div className="credits-meta">
        <div className="credits-role">{person.role}</div>
        <div className="credits-name">{person.name}</div>
      </div>
    </div>
  );
}

export function CreditsPage() {
  const loop = [...PEOPLE, ...PEOPLE, ...PEOPLE, ...PEOPLE];
  return (
    <div className="credits-page">
      <div className="credits-header">
        <div className="credits-kicker">ARIES PANEL</div>
        <h1>Podziękowania</h1>
        <div className="credits-rule" />
      </div>
      <div className="credits-stage">
        <div className="credits-vignette" />
        <div className="credits-roll">
          {loop.map((person, i) => (
            <CreditRow key={`${person.name}-${i}`} person={person} />
          ))}
        </div>
      </div>
    </div>
  );
}
