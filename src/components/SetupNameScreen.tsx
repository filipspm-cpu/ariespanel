import logo from "@/assets/aries-logo.png";
import { ariesLog } from "@/services/ariesLog";
import { useAppStore } from "@/store/useAppStore";
import { useState } from "react";

export function SetupNameScreen() {
  const patchSettings = useAppStore((s) => s.patchSettings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const connect = async () => {
    setBusy(true);
    setError("");
    try {
      const profile = await window.synvity?.discordConnect();
      if (!profile?.id) throw new Error("Nie udało się połączyć z Discordem.");
      const name = (profile.globalName || profile.username || "").trim();
      patchSettings({
        username: name || "Konto",
        profileNameSet: true,
        discordId: profile.id,
        discordUsername: profile.username,
        discordGlobalName: profile.globalName,
        discordAvatar: profile.avatar,
        discordAvatarUrl: profile.avatarUrl,
      });
      if (name) void window.synvity?.profileSaveName?.(name);
    } catch (err) {
      const text = err instanceof Error ? err.message : "Nie udało się połączyć z Discordem.";
      setError(text);
      ariesLog({
        level: "error",
        source: "discord",
        message: "Logowanie Discord nieudane",
        detail: text,
      });
      setBusy(false);
    }
  };

  return (
    <div className="loading-screen">
      <div className="loading-screen-drag drag-region">
        <div className="no-drag ml-auto flex">
          <button type="button" className="loading-win-btn" onClick={() => void window.synvity?.minimize()}>
            –
          </button>
          <button type="button" className="loading-win-btn" onClick={() => void window.synvity?.close()}>
            ×
          </button>
        </div>
      </div>
      <div className="loading-screen-body setup-name-body">
        <img src={logo} alt="" className="loading-logo" draggable={false} />
        <div className="loading-wordmark">ARIES</div>
        <div className="loading-kicker">PANEL</div>
        <h1 className="setup-name-title">Zaloguj się Discordem</h1>
        <p className="setup-name-copy">Wejście do panelu wymaga połączonego konta Discord.</p>
        <button type="button" disabled={busy} className="setup-name-btn setup-discord-btn" onClick={() => void connect()}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
            <path d="M20.317 4.37a19.8 19.8 0 0 0-4.885-1.515.07.07 0 0 0-.079.035c-.211.375-.444.864-.608 1.25a18.3 18.3 0 0 0-5.487 0 12.6 12.6 0 0 0-.617-1.25.08.08 0 0 0-.079-.035 19.7 19.7 0 0 0-4.885 1.515.06.06 0 0 0-.03.027C.533 9.046-.32 13.58.099 18.057a.08.08 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.08.08 0 0 0 .084-.027c.461-.63.873-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.07.07 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.07.07 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.08.08 0 0 0 .084.028 19.8 19.8 0 0 0 6.002-3.03.08.08 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.03M8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418m7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418" />
          </svg>
          {busy ? "Łączenie…" : "Połącz z Discordem"}
        </button>
        <div className="setup-privacy">
          <div className="setup-privacy-title">ARIES nie pobiera żadnych innych informacji</div>
          <p>
            Z Discorda zapisujemy wyłącznie ID konta, nazwę oraz avatar. Nie pobieramy wiadomości, serwerów, znajomych
            ani innych danych.
          </p>
        </div>
        {error ? <div className="setup-name-error">{error}</div> : null}
      </div>
    </div>
  );
}
