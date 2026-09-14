import logo from "@/assets/aries-logo.png";

export function LoadingScreen() {
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
      <div className="loading-screen-body">
        <img src={logo} alt="" className="loading-logo" draggable={false} />
        <div className="loading-wordmark">ARIES</div>
        <div className="loading-kicker">PANEL</div>
        <div className="loading-bar" aria-hidden>
          <span />
        </div>
        <div className="loading-caption">Ładowanie…</div>
      </div>
    </div>
  );
}
