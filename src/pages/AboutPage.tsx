import { Card } from "@/components/ui/Card";
import { useEffect, useState } from "react";
import logo from "@/assets/aries-logo.png";

export function AboutPage() {
  const [version, setVersion] = useState("—");

  useEffect(() => {
    void window.synvity?.appVersion().then((v) => setVersion(v));
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-6">
      <div className="shrink-0">
        <h1 className="text-[26px] font-semibold tracking-tight text-white">O aplikacji</h1>
        <p className="mt-1 text-[13px] text-zinc-500">ARIES — prywatny panel administracyjny</p>
      </div>

      <div className="mt-6 grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="flex h-full min-h-0 flex-col items-center justify-center p-8">
          <img src={logo} alt="ARIES" className="h-28 w-28 object-contain" draggable={false} />
          <div className="mt-5 text-center">
            <div className="font-ethnocentric text-[28px] tracking-[0.28em] text-white">ARIES</div>
            <div className="font-mokoto mt-2 text-[11px] uppercase tracking-[0.4em] text-zinc-500">panel</div>
            <div className="mt-4 text-[14px] text-zinc-400">Wersja v{version}</div>
          </div>
        </Card>

        <div className="grid min-h-0 grid-rows-3 gap-4">
          <Card className="flex flex-col justify-center p-5">
            <div className="text-[12px] uppercase tracking-wider text-zinc-500">Opis</div>
            <div className="mt-2 text-[15px] leading-relaxed text-zinc-200">
              Prywatny panel do makr, nakładki, komend i statystyk na serwerach GTA RP.
            </div>
          </Card>
          <Card className="flex flex-col justify-center p-5">
            <div className="text-[12px] uppercase tracking-wider text-zinc-500">Funkcje</div>
            <div className="mt-2 text-[14px] leading-relaxed text-zinc-300">
              Makra czatu, wykonawca CMD, nakładka HUD, reporty i specyfikacje eventów.
            </div>
          </Card>
          <Card className="flex flex-col justify-center p-5">
            <div className="text-[12px] uppercase tracking-wider text-zinc-500">Wsparcie</div>
            <div className="mt-2 text-[14px] leading-relaxed text-zinc-300">
              Aktualizacje z GitHuba. Podziękowania znajdziesz w sąsiedniej zakładce.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
