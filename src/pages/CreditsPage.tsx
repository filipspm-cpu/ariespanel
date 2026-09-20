import { Copyright } from "@/components/Copyright";
import filipek from "@/assets/credits/filipek.gif";
import rysiasty from "@/assets/credits/rysiasty.webp";
import szczurek from "@/assets/credits/wisniowka.webp";
import dorek from "@/assets/credits/dorek.webp";
import fredka from "@/assets/credits/fredka.gif";
import { useEffect, useRef } from "react";

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
    role: "Logo · Beta tester",
    name: "Dorek",
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
  const gold = person.role === "Main developer" || person.role === "Developer";
  return (
    <div className={`credits-row ${person.featured ? "credits-row-featured" : ""} ${gold ? "credits-row-gold" : ""}`}>
      <div className={`credits-avatar-wrap ${gold ? "credits-avatar-gold" : ""}`} style={{ width: size, height: size }}>
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
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let stopped = false;
    let raf = 0;
    let last = performance.now();
    const pxPerSec = 42;

    const tick = (now: number) => {
      if (stopped) return;
      const dt = Math.min(48, now - last);
      last = now;
      const max = el.scrollHeight - el.clientHeight;
      if (max > 0) el.scrollTop = Math.min(max, el.scrollTop + (pxPerSec * dt) / 1000);
      if (!stopped && el.scrollTop < max - 0.5) raf = requestAnimationFrame(tick);
    };

    const stop = () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
    };

    el.addEventListener("wheel", stop, { passive: true });
    el.addEventListener("pointerdown", stop);
    el.addEventListener("touchstart", stop, { passive: true });
    el.addEventListener("keydown", stop);
    raf = requestAnimationFrame(tick);
    return () => {
      stop();
      el.removeEventListener("wheel", stop);
      el.removeEventListener("pointerdown", stop);
      el.removeEventListener("touchstart", stop);
      el.removeEventListener("keydown", stop);
    };
  }, []);

  return (
    <div className="credits-page">
      <div className="credits-header">
        <div className="credits-kicker">ARIES PANEL</div>
        <h1>Autorzy</h1>
        <div className="credits-rule" />
      </div>
      <div className="credits-stage" ref={stageRef} tabIndex={0} aria-label="Lista autorów">
        <div className="credits-vignette" />
        <div className="credits-roll">
          {PEOPLE.map((person) => (
            <CreditRow key={`${person.role}-${person.name}`} person={person} />
          ))}
          <Copyright className="credits-copyright" />
        </div>
      </div>
    </div>
  );
}
