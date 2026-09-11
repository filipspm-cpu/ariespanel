const majesticIcons = import.meta.glob("../assets/servers/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

function slugFromEndpoint(endpoint: string) {
  if (endpoint.includes("/join/")) return (endpoint.split("/join/")[1] ?? "").toLowerCase();
  return (endpoint.split(".")[0] ?? "").toLowerCase();
}

export function serverAvatarUrl(endpoint: string) {
  const slug = slugFromEndpoint(endpoint);
  const hit = Object.entries(majesticIcons).find(([file]) => file.replace(/\\/g, "/").endsWith(`/${slug}.svg`));
  return hit?.[1];
}
