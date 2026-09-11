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

const GTA5RP: Record<string, string> = {
  downtown: "https://gta5rp.com/sidback/01.png",
  strawberry: "https://gta5rp.com/sidback/02.png",
  vinewood: "https://gta5rp.com/sidback/03.png",
  blackberry: "https://gta5rp.com/sidback/04.png",
  insquad: "https://gta5rp.com/sidback/05.png",
  sunrise: "https://gta5rp.com/sidback/06.png",
  richman: "https://gta5rp.com/sidback/08.png",
  eclipse: "https://gta5rp.com/sidback/09.png",
  lamesa: "https://gta5rp.com/sidback/10.png",
  burton: "https://gta5rp.com/sidback/11.png",
  rockford: "https://gta5rp.com/sidback/12.png",
  alta: "https://gta5rp.com/sidback/13.png",
  redwood: "https://gta5rp.com/sidback/17.png",
  grapeseed: "https://gta5rp.com/sidback/19.png",
  murrieta: "https://gta5rp.com/sidback/20.png",
  milton: "https://gta5rp.com/sidback/22.png",
  lapuerta: "https://gta5rp.com/sidback/23.png",
  chiliad: "https://gta5rp.com/sidback/25.png",
};

function slugFromEndpoint(endpoint: string) {
  if (endpoint.includes("/join/")) return (endpoint.split("/join/")[1] ?? "").toLowerCase();
  return (endpoint.split(".")[0] ?? "").toLowerCase();
}

function assetUrl(files: Record<string, string>, slug: string, ext: string) {
  const hit = Object.entries(files).find(([file]) => file.replace(/\\/g, "/").endsWith(`/${slug}.${ext}`));
  return hit?.[1];
}

function majesticUrl(slug: string) {
  return assetUrl(majesticEmoji, slug, "webp") || assetUrl(majesticIcons, slug, "svg");
}

export function serverAvatarUrl(endpoint: string, project: "majestic" | "gta5rp") {
  const slug = slugFromEndpoint(endpoint);
  if (project === "gta5rp") return GTA5RP[slug];
  return majesticUrl(slug);
}
