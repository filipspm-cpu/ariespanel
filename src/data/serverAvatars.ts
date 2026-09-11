import arbatskyIcon from "../assets/servers/arbatsky.svg?url";

const majesticIcons = import.meta.glob("../assets/servers/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const majesticEmoji = import.meta.glob("../assets/servers/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

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
  if (slug === "arbatsky") return arbatskyIcon;
  return assetUrl(majesticEmoji, slug, "webp") || assetUrl(majesticIcons, slug, "svg");
}
