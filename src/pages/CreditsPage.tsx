const PEOPLE = [
  {
    role: "Main developer",
    name: "Filipek",
    featured: true,
    avatar:
      "https://cdn.discordapp.com/avatars/1305449847125708811/a_0f4b5d7a05b58415a1c2dd8522c45363.webp?size=256",
  },
  {
    role: "Developer",
    name: "rysiasty",
    featured: false,
    avatar: "https://cdn.discordapp.com/avatars/1039967564664676412/ed332cc74ab76bf8c0df6f4b54b53f65.webp?size=256",
  },
  {
    role: "Beta tester",
    name: "wiśniófka",
    featured: false,
    avatar: "https://cdn.discordapp.com/avatars/1200264556354752565/d4567453494fbc904a919d3ec08696fb.webp?size=256",
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
        <img src={person.avatar} alt="" width={size} height={size} draggable={false} />
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
