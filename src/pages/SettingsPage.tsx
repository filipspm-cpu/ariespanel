import { Copyright } from "@/components/Copyright";
import { RankBadges, useAccountRanks } from "@/components/RankBadge";
import { APP_VERSION } from "@/data/appVersion";
import { formatCash, PROMO_ENTER_CASH, PROMO_OWNER_CASH } from "@/data/achievements";
import { rewardsErrorText } from "@/services/rewardStats";
import { ariesLog } from "@/services/ariesLog";
import { useAppStore } from "@/store/useAppStore";
import { mergeImportedMacros, parseMacroFile } from "@/services/macroPack";
import type { UpdateStatus } from "@/types";
import type { RewardsState } from "@/types/rewards";
import { Toggle } from "@/components/ui/Toggle";
import { downloadPromoGif, downloadPromoPng } from "@/services/promoCard";
import { Copy, Download, FileImage, FileUp, ImagePlay, RefreshCw, Unplug } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function SettingsPage() {
  const settings = useAppStore((s) => s.settings);
  const patchSettings = useAppStore((s) => s.patchSettings);
  const macros = useAppStore((s) => s.macros);
  const setMacros = useAppStore((s) => s.setMacros);
  const [update, setUpdate] = useState<UpdateStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [packMsg, setPackMsg] = useState("");
  const [discordBusy, setDiscordBusy] = useState(false);
  const [discordMsg, setDiscordMsg] = useState("");
  const [promo, setPromo] = useState<RewardsState | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [promoMsg, setPromoMsg] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [cardBusy, setCardBusy] = useState<"png" | "gif" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void window.synvity?.updateStatus().then((s) => setUpdate(s));
    const off = window.synvity?.onUpdateStatus((s) => setUpdate(s));
    return () => off?.();
  }, []);

  useEffect(() => {
    if (!settings.discordId || !window.synvity?.rewardsState) return;
    void window.synvity.rewardsState().then((s) => {
      if (s) setPromo(s);
    });
  }, [settings.discordId]);

  const wantsUpdates = settings.autoUpdate !== false;

  const check = async () => {
    if (!wantsUpdates) return;
    setBusy(true);
    const s = await window.synvity?.updateCheck();
    if (s) setUpdate(s);
    setBusy(false);
  };

  const available = update?.status === "available" || update?.status === "downloaded";
  const ranks = useAccountRanks(settings.discordId);
  const letter = (settings.username || "A").trim().slice(0, 1).toUpperCase();
  const discordConnected = Boolean(settings.discordId);
  const displayName = settings.discordGlobalName || settings.username || "Bez nazwy";

  const connectDiscord = async () => {
    setDiscordBusy(true);
    setDiscordMsg("");
    try {
      const profile = await window.synvity?.discordConnect();
      if (!profile) throw new Error("Nie udało się połączyć z Discordem.");
      patchSettings({
        username: settings.profileNameSet && settings.username.trim() ? settings.username : profile.globalName || profile.username,
        discordId: profile.id,
        discordUsername: profile.username,
        discordGlobalName: profile.globalName,
        discordAvatar: profile.avatar,
        discordAvatarUrl: profile.avatarUrl,
      });
      setDiscordMsg("Połączono z Discordem.");
    } catch (err) {
      const text = err instanceof Error ? err.message : "Nie udało się połączyć z Discordem.";
      setDiscordMsg(text);
      ariesLog({
        level: "error",
        source: "ustawienia",
        message: "Połączenie z Discordem nie udało się",
        detail: text,
        open: true,
      });
    } finally {
      setDiscordBusy(false);
    }
  };

  const disconnectDiscord = () => {
    patchSettings({
      discordId: "",
      discordUsername: "",
      discordGlobalName: "",
      discordAvatar: null,
      discordAvatarUrl: "",
      profileNameSet: false,
    });
    setDiscordMsg("Rozłączono Discord.");
  };

  const generatePromo = async () => {
    setPromoBusy(true);
    setPromoMsg("");
    try {
      const next = await window.synvity?.rewardsGenerate();
      if (!next) {
        const text = rewardsErrorText("network");
        setPromoMsg(text);
        ariesLog({
          level: "error",
          source: "ustawienia",
          message: "Generowanie kodu nie udało się",
          detail: text,
          open: true,
        });
      } else {
        setPromo(next);
        if (next.ok === false) {
          if (next.error === "device" && next.deviceLocked) setPromoMsg("");
          else {
            const text = next.detail || rewardsErrorText(next.error);
            setPromoMsg(text);
            ariesLog({
              level: next.error === "login" ? "warn" : "error",
              source: "ustawienia",
              message: "Generowanie kodu nie udało się",
              detail: text,
              open: true,
            });
          }
        }
        else setPromoMsg(`Kod gotowy. Kto go wpisze, dostanie ${formatCash(PROMO_ENTER_CASH)} w grze, a Ty ${formatCash(PROMO_OWNER_CASH)}.`);
      }
    } catch {
      const text = rewardsErrorText("network");
      setPromoMsg(text);
      ariesLog({
        level: "error",
        source: "ustawienia",
        message: "Generowanie kodu nie udało się",
        detail: text,
        open: true,
      });
    } finally {
      setPromoBusy(false);
    }
  };

  const copyPromo = async () => {
    if (!promo?.code) return;
    try {
      await navigator.clipboard.writeText(promo.code);
      setPromoMsg("Skopiowano kod.");
    } catch {
      setPromoMsg(promo.code);
    }
  };

  const savePromoCard = async (kind: "png" | "gif") => {
    if (!promo?.code) return;
    setCardBusy(kind);
    setPromoMsg("");
    try {
      if (kind === "gif") await downloadPromoGif(promo.code, displayName);
      else await downloadPromoPng(promo.code, displayName);
      setPromoMsg(kind === "gif" ? "Zapisano GIF z kodem." : "Zapisano PNG z kodem.");
    } catch {
      setPromoMsg("Nie udało się zapisać obrazka.");
    } finally {
      setCardBusy(null);
    }
  };

  const redeemPromo = async () => {
    setPromoBusy(true);
    setPromoMsg("");
    try {
      const next = await window.synvity?.rewardsRedeem(promoInput);
      if (!next) {
        const text = rewardsErrorText("network");
        setPromoMsg(text);
        ariesLog({
          level: "error",
          source: "ustawienia",
          message: "Wpisanie kodu nie udało się",
          detail: text,
          open: true,
        });
      } else {
        setPromo(next);
        if (next.ok === false) {
          if (next.error === "device" && next.deviceLocked) setPromoMsg("");
          else {
            const text = next.detail || rewardsErrorText(next.error);
            setPromoMsg(text);
            ariesLog({
              level: ["network", "phpfile", "timeout", "json", "empty", "http", "db"].includes(String(next.error))
                ? "error"
                : "warn",
              source: "ustawienia",
              message: "Wpisanie kodu nie udało się",
              detail: text,
              open: true,
            });
          }
        }
        else {
          setPromoInput("");
          setPromoMsg(
            `Kod przyjęty. Dostajesz ${formatCash(PROMO_ENTER_CASH)} do wypłaty. Właściciel kodu dostaje ${formatCash(PROMO_OWNER_CASH)}.`,
          );
        }
      }
    } catch {
      setPromoMsg(rewardsErrorText("network"));
    } finally {
      setPromoBusy(false);
    }
  };

  const onPickMacros = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseMacroFile(text);
      const { next, added, skipped } = mergeImportedMacros(macros, parsed.macros);
      setMacros(next);
      setPackMsg(
        added
          ? `Dodano ${added} makr${skipped ? `, pominięto ${skipped} (już są)` : ""}.`
          : skipped
            ? "Wszystkie makra z pliku już masz."
            : "W pliku nie znaleziono makr.",
      );
    } catch (err) {
      setPackMsg(err instanceof Error ? err.message : "Nie udało się wczytać pliku.");
    }
  };

  const statusText =
    update?.status === "checking"
      ? "Sprawdzanie…"
      : update?.status === "not-available"
        ? "Masz najnowszą wersję."
        : update?.status === "error"
          ? update.message || "Nie udało się sprawdzić aktualizacji."
        : update?.status === "downloading"
          ? `Pobieranie v${update.version || ""}… ${Math.round(update.percent || 0)}%${update.detail ? ` · ${update.detail}` : ""}`
          : update?.status === "downloaded"
            ? "Pobrano. Instalowanie…"
            : available
            ? `Dostępna v${update?.version}`
            : "Nie sprawdzono jeszcze aktualizacji.";

  return (
    <div className="studio-page">
      <div className="studio-header">
        <div className="credits-kicker">ARIES PANEL</div>
        <h1>Ustawienia systemu</h1>
        <div className="credits-rule" />
      </div>

      <div className="studio-body settings-body">
        <div className="studio-card settings-profile">
          {settings.discordAvatarUrl ? (
            <img src={settings.discordAvatarUrl} alt="" className="settings-avatar-img" draggable={false} />
          ) : (
            <div className="settings-avatar">{letter}</div>
          )}
          <div className="mt-4 text-[11px] uppercase tracking-[0.22em] text-zinc-500">Konto</div>
          <div className="mt-2 text-center text-[22px] font-semibold text-white">{displayName}</div>
          {discordConnected ? <div className="mt-1 text-[12px] text-zinc-500">@{settings.discordUsername}</div> : null}
          <RankBadges ranks={ranks} size="md" />
          {!discordConnected ? (
            <p className="mt-4 text-center text-[12px] leading-5 text-zinc-500">
              Do panelu trzeba zalogować się Discordem.
            </p>
          ) : null}
          {discordConnected ? (
            <button onClick={disconnectDiscord} className="settings-btn mt-5 w-full" type="button">
              <Unplug size={18} />
              Rozłącz Discord
            </button>
          ) : (
            <button
              onClick={() => void connectDiscord()}
              disabled={discordBusy}
              className="settings-btn discord mt-5 w-full"
              type="button"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
                <path d="M20.317 4.37a19.8 19.8 0 0 0-4.885-1.515.07.07 0 0 0-.079.035c-.211.375-.444.864-.608 1.25a18.3 18.3 0 0 0-5.487 0 12.6 12.6 0 0 0-.617-1.25.08.08 0 0 0-.079-.035 19.7 19.7 0 0 0-4.885 1.515.06.06 0 0 0-.03.027C.533 9.046-.32 13.58.099 18.057a.08.08 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.08.08 0 0 0 .084-.027c.461-.63.873-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.07.07 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.07.07 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.08.08 0 0 0 .084.028 19.8 19.8 0 0 0 6.002-3.03.08.08 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.03M8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418m7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418" />
              </svg>
              {discordBusy ? "Łączenie…" : "Połącz z Discordem"}
            </button>
          )}
          <div className="accounts-privacy settings-privacy">
            <strong>ARIES nie pobiera żadnych innych informacji z Discorda.</strong>
            <span>Zapisujemy wyłącznie ID konta Discord, nazwę z Discorda oraz avatar.</span>
          </div>
          {discordMsg ? <div className="mt-3 text-center text-[12px] text-zinc-400">{discordMsg}</div> : null}
        </div>

        <div className="studio-card settings-update">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Aktualizacja</div>
              <div className="mt-2 text-[22px] font-semibold text-white">v{update?.currentVersion || APP_VERSION}</div>
              <div className="mt-1 text-[12px] text-zinc-500">Zainstalowana wersja</div>
            </div>
            <span className={`settings-pill ${wantsUpdates && available ? "on" : ""} ${wantsUpdates && update?.status === "error" ? "warn" : ""}`}>
              {!wantsUpdates ? "OFF" : available ? "Nowa" : update?.status === "error" ? "Błąd" : "OK"}
            </span>
          </div>

          <label className="settings-update-opt">
            <span>
              <span className="block text-[13px] text-zinc-200">Chcę otrzymywać aktualizacje</span>
              <span className="mt-0.5 block text-[11px] text-zinc-600">
                Wyłącz, jeśli nie chcesz sprawdzania nowych wersji.
              </span>
            </span>
            <Toggle
              checked={wantsUpdates}
              onChange={(v) => patchSettings({ autoUpdate: v })}
            />
          </label>

          <div className={`settings-status ${wantsUpdates && update?.status === "error" ? "warn" : wantsUpdates && available ? "on" : ""}`}>
            {!wantsUpdates
              ? "Sprawdzanie aktualizacji jest wyłączone."
              : statusText}
          </div>

          {wantsUpdates ? (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button onClick={() => void check()} disabled={busy} className="settings-btn">
              <RefreshCw size={14} className={busy ? "animate-spin" : ""} />
              Sprawdź aktualizacje
            </button>
            {available ? (
              <button onClick={() => void window.synvity?.updateInstall()} className="settings-btn primary">
                <Download size={14} />
                Zaktualizuj
              </button>
            ) : null}
            <button
              onClick={() => void window.synvity?.updateOpenSetup(update?.version)}
              className="settings-btn"
            >
              <Download size={14} />
              Pobierz instalator
            </button>
          </div>
          ) : null}
        </div>

        <div className="studio-card settings-macros">
          <div className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Import makr</div>
          <div className="mt-2 text-[18px] font-medium text-white">Szybkie makra z pliku</div>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-zinc-500">
            Wrzuć plik <span className="text-zinc-300">.txt</span> albo{" "}
            <span className="text-zinc-300">.ariesmacros</span>. Krótki tekst, długi blok, losowe opcje
            i licznik zapisują się znacznikami:
          </p>
          <pre className="settings-code">{`.p = Poczekaj chwilę.

.w:
  [losowe]
    Witam
    Hejka
    Cześć

.ogloszenie:
  [tekst]
    Szanowni Państwo,
    Proszę o spokój na kanale.

.ticket:
  [licznik:ticket]
  [tekst]
    Przyjąłem zgłoszenie.`}</pre>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.macros,.ariesmacros,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              void onPickMacros(file);
            }}
          />
          <button onClick={() => fileRef.current?.click()} className="settings-btn mt-4">
            <FileUp size={14} />
            Wczytaj plik makr
          </button>
          {packMsg ? <div className="mt-3 text-[12px] text-zinc-300">{packMsg}</div> : null}
        </div>

        <div className="studio-card settings-promo">
          <div className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Promokod</div>
          <div className="mt-2 text-[18px] font-medium text-white">Twój kod i wpisanie kodu</div>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-zinc-500">
            Każdy użytkownik może wygenerować jeden kod. Cudzy kod można wpisać tylko raz na konto i tylko raz na
            komputer — zapamiętywany jest też adres IP. Osoba, która wpisze kod, dostaje {formatCash(PROMO_ENTER_CASH)}.
            Właściciel kodu dostaje {formatCash(PROMO_OWNER_CASH)}.
          </p>
          {!discordConnected ? (
            <div className="mt-4 text-[13px] text-zinc-400">Najpierw połącz Discord.</div>
          ) : (
            <>
              <div className="settings-promo-row">
                <div className="settings-promo-code">{promo?.code || "Brak kodu"}</div>
                {promo?.code ? (
                  <>
                    <button type="button" className="settings-btn" onClick={() => void copyPromo()}>
                      <Copy size={14} />
                      Kopiuj
                    </button>
                    <button
                      type="button"
                      className="settings-btn"
                      disabled={Boolean(cardBusy)}
                      onClick={() => void savePromoCard("png")}
                    >
                      <FileImage size={14} />
                      {cardBusy === "png" ? "PNG…" : "PNG"}
                    </button>
                    <button
                      type="button"
                      className="settings-btn"
                      disabled={Boolean(cardBusy)}
                      onClick={() => void savePromoCard("gif")}
                    >
                      <ImagePlay size={14} />
                      {cardBusy === "gif" ? "GIF…" : "GIF"}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="settings-btn primary"
                    disabled={promoBusy}
                    onClick={() => void generatePromo()}
                  >
                    Wygeneruj kod
                  </button>
                )}
              </div>
              {promo?.code ? (
                <div className="mt-2 text-[12px] text-zinc-500">
                  Każdy, kto wpisze Twój kod, dodaje Ci {formatCash(PROMO_OWNER_CASH)} do wypłaty. Ta osoba dostaje{" "}
                  {formatCash(PROMO_ENTER_CASH)}. PNG i GIF to karta z kodem do wrzucenia na Discorda.
                </div>
              ) : null}
              {promo?.referrals ? (
                <div className="mt-2 text-[12px] text-zinc-500">
                  Twój kod wpisało {promo.referrals} {promo.referrals === 1 ? "osoba" : "osób"}.
                </div>
              ) : null}
              <div className="settings-promo-row mt-4">
                <input
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                  className="settings-input"
                  placeholder="ARIES-XXXXXX"
                  disabled={Boolean(promo?.redeemed || promo?.deviceLocked)}
                />
                <button
                  type="button"
                  className="settings-btn primary"
                  disabled={promoBusy || Boolean(promo?.redeemed || promo?.deviceLocked) || promoInput.trim().length < 8}
                  onClick={() => void redeemPromo()}
                >
                  {promo?.redeemed ? "Kod wpisany" : promo?.deviceLocked ? "Komputer zużyty" : "Wpisz kod"}
                </button>
              </div>
              {promo?.redeemedCode ? (
                <div className="mt-2 text-[12px] text-zinc-500">Wpisany kod: {promo.redeemedCode}</div>
              ) : promo?.deviceLocked ? (
                <div className="mt-2 text-[12px] text-zinc-500">Na tym komputerze kod promocyjny został już użyty.</div>
              ) : null}
              {promo && promo.pendingCash > 0 ? (
                <div className="mt-2 text-[12px] text-emerald-300">
                  Do wypłaty w grze: {formatCash(promo.pendingCash)}
                </div>
              ) : null}
            </>
          )}
          {promoMsg ? (
            <div className={`mt-3 whitespace-pre-line text-[12px] ${promo?.ok === false ? "text-rose-300" : "text-zinc-300"}`}>
              {promoMsg}
            </div>
          ) : null}
        </div>

        <Copyright className="settings-copyright" />
      </div>
    </div>
  );
}
