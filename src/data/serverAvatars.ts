import arbatskyIcon from "../assets/servers/arbatsky.svg?url";
import tverskoyIcon from "../assets/servers/tverskoy.png?url";
import kutuzovskyIcon from "../assets/servers/kutuzovsky.png?url";

const majesticIcons = import.meta.glob("../assets/servers/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const majesticEmoji = import.meta.glob("../assets/servers/*.{webp,png}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const extraAvatars: Record<string, string> = {
  arbatsky: arbatskyIcon,
  tverskoy: tverskoyIcon,
  kutuzovsky: kutuzovskyIcon,
};

function slugFromEndpoint(endpoint: string) {
  if (endpoint.includes("/join/")) return (endpoint.split("/join/")[1] ?? "").toLowerCase();
  return (endpoint.split(".")[0] ?? "").toLowerCase();
}

function assetUrl(files: Record<string, string>, slug: string, ext: string) {
  const hit = Object.entries(files).find(([file]) => file.replace(/\\/g, "/").endsWith(`/${slug}.${ext}`));
  return hit?.[1];
}

export function serverAvatarUrl(endpoint: string) {
  const slug = slugFromEndpoint(endpoint);
  return extraAvatars[slug] || assetUrl(majesticEmoji, slug, "webp") || assetUrl(majesticEmoji, slug, "png") || assetUrl(majesticIcons, slug, "svg");
}
