import { Command, Gauge, Layers, RefreshCw } from "lucide-react";
import logo from "@/assets/aries-logo.png";
import { Copyright } from "@/components/Copyright";
import { APP_VERSION } from "@/data/appVersion";

const FEATURES = [
  {
    icon: Command,
    title: "Makra i CMD",
    text: "Szybkie komendy czatu i wykonawca do procesu gry.",
  },
  {
    icon: Layers,
    title: "Nakładka",
    text: "HUD z reportami, Spotify i zegarem na ekranie gry.",
  },
  {
    icon: Gauge,
    title: "Statystyki",
    text: "Reporty i Event Specs z historią dnia, tygodnia i miesiąca.",
  },
  {
    icon: RefreshCw,
    title: "Aktualizacje",
    text: "Nowe wersje schodzą z GitHuba w ustawieniach systemu.",
  },
] as const;

export function AboutPage() {
  return (
    <div className="studio-page">
      <div className="studio-header">
        <div className="credits-kicker">ARIES PANEL</div>
        <h1>O aplikacji</h1>
        <div className="credits-rule" />
      </div>

      <div className="studio-body about-body">
        <div className="about-hero">
          <div className="about-orb" />
          <img src={logo} alt="ARIES" className="about-logo" draggable={false} />
          <div className="font-ethnocentric mt-6 text-[34px] tracking-[0.32em] text-white">ARIES</div>
          <div className="font-mokoto mt-2 text-[11px] uppercase tracking-[0.46em] text-zinc-500">panel</div>
          <div className="about-version">v{APP_VERSION}</div>
          <p className="about-lead">
            Prywatny panel do makr, nakładki, komend i statystyk na serwerach GTA RP.
          </p>
          <Copyright className="mt-5" />
        </div>

        <div className="about-features">
          {FEATURES.map((item) => (
            <div key={item.title} className="studio-card about-feature">
              <div className="about-feature-icon">
                <item.icon size={16} />
              </div>
              <div className="text-[14px] font-medium text-white">{item.title}</div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-500">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
