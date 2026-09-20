import logo from "@/assets/aries-logo.png";
import { useAppStore } from "@/store/useAppStore";
import { useState } from "react";

export function SetupNameScreen() {
  const patchSettings = useAppStore((s) => s.patchSettings);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    const next = name.trim().slice(0, 32);
    if (next.length < 2) {
      setError("Podaj nazwę (minimum 2 znaki).");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const saved = await window.synvity?.profileSaveName?.(next);
      if (saved && saved.ok === false) {
        setError(saved.error === "invalid" ? "Podaj nazwę (minimum 2 znaki)." : "Nie udało się zapisać nazwy.");
        setBusy(false);
        return;
      }
      const finalName = saved?.name || next;
      patchSettings({ username: finalName, profileNameSet: true });
    } catch {
      setError("Nie udało się zapisać nazwy. Spróbuj jeszcze raz.");
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
        <h1 className="setup-name-title">Podaj swoją nazwę</h1>
        <p className="setup-name-copy">Przy pierwszym wejściu potrzebna jest nazwa. Zapisze się w bazie panelu.</p>
        <form
          className="setup-name-form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <input
            autoFocus
            value={name}
            maxLength={32}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
            placeholder="Twoja nazwa"
            className="settings-input"
          />
          <button type="submit" disabled={busy} className="setup-name-btn">
            {busy ? "Zapisywanie…" : "Wejdź do panelu"}
          </button>
        </form>
        {error ? <div className="setup-name-error">{error}</div> : null}
      </div>
    </div>
  );
}
