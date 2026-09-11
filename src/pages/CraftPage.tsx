import { createElement } from "react";

export const CRAFT_WIKI_URL = "https://wiki.majestic-rp.ru/pl/crafts";

export function CraftPage() {
  return (
    <div className="craft-embed">
      {createElement("webview", {
        src: CRAFT_WIKI_URL,
        className: "craft-webview",
        partition: "persist:majestic-wiki",
      })}
    </div>
  );
}
