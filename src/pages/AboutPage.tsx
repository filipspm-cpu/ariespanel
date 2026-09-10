import { Card } from "@/components/ui/Card";
import { useEffect, useState } from "react";
import logo from "@/assets/aries-logo.png";

const TEAM = [
  { role: "Main developer", name: "Filipek" },
  { role: "Developer", name: "Rysiasty" },
  { role: "Beta tester", name: "Wiśniófka" },
  { role: "Loga", name: "Dorek helper" },
] as const;

export function AboutPage() {
  const [version, setVersion] = useState("—");

  useEffect(() => {
    void window.synvity?.appVersion().then((v) => setVersion(v));
  }, []);

  return (
    <div className="h-full overflow-auto p-6">
      <h1 className="text-[26px] font-semibold tracking-tight text-white">O aplikacji</h1>
      <p className="mt-1 text-[13px] text-zinc-500">ARIES — prywatny panel administracyjny</p>

      <div className="mt-6 max-w-lg space-y-4">
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <img src={logo} alt="ARIES" className="h-14 w-14 object-contain" />
            <div>
              <div className="text-[20px] font-semibold tracking-wide text-white">ARIES</div>
              <div className="mt-0.5 text-[12px] text-zinc-500">Prywatny panel administracyjny</div>
              <div className="mt-1 text-[12px] text-zinc-400">Wersja v{version}</div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-[15px] font-medium text-white">Zespół</div>
          <ul className="mt-4 space-y-2.5">
            {TEAM.map((person) => (
              <li
                key={person.role}
                className="flex items-center justify-between gap-3 rounded-lg border border-syn-border bg-[#0c0c0e] px-3 py-2.5"
              >
                <span className="text-[12px] text-zinc-500">{person.role}</span>
                <span className="text-[13px] font-medium text-zinc-100">{person.name}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
