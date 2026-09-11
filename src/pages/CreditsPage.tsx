import { Copyright } from "@/components/Copyright";
import filipek from "@/assets/credits/filipek.webp";
import rysiasty from "@/assets/credits/rysiasty.webp";
import szczurek from "@/assets/credits/wisniowka.webp";
import dorek from "@/assets/credits/dorek.webp";
import fredka from "@/assets/credits/fredka.webp";

const PEOPLE = [
  {
    role: "Main developer",
    name: "Filipek",
    featured: true,
    avatar: filipek,
  },
  {
    role: "Developer",
    name: "Rysiasty",
    featured: false,
    avatar: rysiasty,
  },
  {
    role: "Beta tester",
    name: "Szczurek",
    featured: false,
    avatar: szczurek,
  },
  {
    role: "Beta tester / Logo",
    name: "Dorek Helper",
    featured: false,
    avatar: dorek,
  },
  {
    role: "Beta tester",
    name: "Fretka",
    featured: false,
    avatar: fredka,
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
  return (
    <div className="credits-page">
      <div className="credits-header">
        <div className="credits-kicker">ARIES PANEL</div>
        <h1>Autorzy</h1>
        <div className="credits-rule" />
      </div>
      <div className="credits-stage">
        <div className="credits-vignette" />
        <div className="credits-roll">
          {PEOPLE.map((person) => (
            <CreditRow key={person.name} person={person} />
          ))}
          <Copyright className="credits-copyright" />
        </div>
      </div>
    </div>
  );
}
