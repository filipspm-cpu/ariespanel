export type LiveServerStatus = {
  endpoint: string;
  name: string;
  project: "majestic";
  players: number;
  online: boolean;
  region?: string;
};

function titleFromEndpoint(endpoint: string): string {
  const slug = endpoint.split("/join/")[1] ?? endpoint;
  const map: Record<string, string> = {
    arbatsky: "Арбатский",
    tverskoy: "Тверской",
    kutuzovsky: "Кутузовский",
    newyork: "New York",
    losangeles: "Los Angeles",
    sanfrancisco: "San Francisco",
    lasvegas: "Las Vegas",
    sandiego: "San Diego",
    mcl: "MCL",
  };
  if (map[slug]) return map[slug];
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

const ENDPOINTS = [
  "api.majestic-files.net:443/join/arbatsky",
  "api.majestic-files.net:443/join/tverskoy",
  "api.majestic-files.net:443/join/kutuzovsky",
  "api.majestic-files.net:443/join/orlando",
  "api.majestic-files.net:443/join/phoenix",
  "api.majestic-files.net:443/join/portland",
  "api.majestic-files.net:443/join/boston",
  "api.majestic-files.net:443/join/detroit",
  "api.majestic-files.net:443/join/newyork",
  "api.majestic-files.net:443/join/losangeles",
  "api.majestic-files.net:443/join/washington",
  "api.majestic-files.net:443/join/chicago",
  "api.majestic-files.net:443/join/dallas",
  "api.majestic-files.net:443/join/atlanta",
  "api.majestic-files.net:443/join/sanfrancisco",
  "api.majestic-files.net:443/join/lasvegas",
  "api.majestic-files.net:443/join/sandiego",
  "api.majestic-files.net:443/join/miami",
  "api.majestic-files.net:443/join/houston",
  "api.majestic-files.net:443/join/seattle",
  "api.majestic-files.net:443/join/denver",
  "api.majestic-files.net:443/join/warsaw",
  "api.majestic-files.net:443/join/berlin",
  "api.majestic-files.net:443/join/mcl",
] as const;

type MajesticApiServer = {
  name?: string;
  ip?: string;
  players?: number;
  status?: boolean;
  region?: string;
};

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": "ARIES", Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

export async function fetchMajesticServerStatuses(): Promise<LiveServerStatus[]> {
  const majesticByIp = new Map<string, MajesticApiServer>();
  try {
    const body = (await fetchJson("https://api.majestic-files.com/meta/servers")) as {
      result?: { servers?: MajesticApiServer[] };
    };
    for (const s of body.result?.servers ?? []) {
      if (s.ip) majesticByIp.set(s.ip.toLowerCase(), s);
    }
  } catch {
    /* keep empty map */
  }

  return ENDPOINTS.map((endpoint) => {
    const live = majesticByIp.get(endpoint.toLowerCase());
    return {
      endpoint,
      name: live?.name || titleFromEndpoint(endpoint),
      project: "majestic" as const,
      players: Number(live?.players ?? 0),
      online: Boolean(live?.status ?? live),
      region: live?.region,
    };
  });
}
