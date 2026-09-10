export type LiveServerStatus = {
  endpoint: string;
  name: string;
  project: "majestic" | "gta5rp";
  players: number;
  online: boolean;
  region?: string;
};

type ServerDef = {
  endpoint: string;
  project: "majestic" | "gta5rp";
  name: string;
};

function titleFromEndpoint(endpoint: string): string {
  if (endpoint.includes("/join/")) {
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
  const host = endpoint.split(":")[0] ?? endpoint;
  const city = host.split(".")[0] ?? host;
  const map: Record<string, string> = {
    chiliad: "Chiliad",
    murrieta: "Murrieta",
    eclipse: "Eclipse",
    redwood: "Redwood",
    downtown: "Downtown",
    sunrise: "Sunrise",
    rockford: "Rockford",
    blackberry: "BlackBerry",
    richman: "RichMan",
    lapuerta: "La Puerta",
    insquad: "INSQUAD",
    strawberry: "StrawBerry",
    burton: "Burton",
    vinewood: "VineWood",
    lamesa: "LaMesa",
    grapeseed: "Grapeseed",
    alta: "Alta",
    milton: "Milton",
  };
  return map[city] ?? city.charAt(0).toUpperCase() + city.slice(1);
}

const ENDPOINTS = [
  "api.majestic-files.net:443/join/memphis",
  "chiliad.gta5rp.com:22005",
  "api.majestic-files.net:443/join/arbatsky",
  "api.majestic-files.net:443/join/tverskoy",
  "api.majestic-files.net:443/join/kutuzovsky",
  "api.majestic-files.net:443/join/orlando",
  "api.majestic-files.net:443/join/phoenix",
  "api.majestic-files.net:443/join/portland",
  "murrieta.gta5rp.com:22005",
  "eclipse.gta5rp.com:22005",
  "redwood.gta5rp.com:22005",
  "api.majestic-files.net:443/join/boston",
  "api.majestic-files.net:443/join/detroit",
  "api.majestic-files.net:443/join/newyork",
  "api.majestic-files.net:443/join/losangeles",
  "api.majestic-files.net:443/join/washington",
  "downtown.gta5rp.com:22005",
  "api.majestic-files.net:443/join/chicago",
  "api.majestic-files.net:443/join/dallas",
  "api.majestic-files.net:443/join/atlanta",
  "api.majestic-files.net:443/join/sanfrancisco",
  "api.majestic-files.net:443/join/lasvegas",
  "api.majestic-files.net:443/join/sandiego",
  "api.majestic-files.net:443/join/miami",
  "api.majestic-files.net:443/join/houston",
  "sunrise.gta5rp.com:22005",
  "api.majestic-files.net:443/join/seattle",
  "api.majestic-files.net:443/join/denver",
  "rockford.gta5rp.com:22005",
  "blackberry.gta5rp.com:22005",
  "api.majestic-files.net:443/join/warsaw",
  "richman.gta5rp.com:22005",
  "lapuerta.gta5rp.com:22005",
  "insquad.gta5rp.com:22005",
  "strawberry.gta5rp.com:22005",
  "burton.gta5rp.com:22005",
  "vinewood.gta5rp.com:22005",
  "lamesa.gta5rp.com:22005",
  "api.majestic-files.net:443/join/berlin",
  "grapeseed.gta5rp.com:22005",
  "alta.gta5rp.com:22005",
  "milton.gta5rp.com:22005",
  "api.majestic-files.net:443/join/mcl",
] as const;

const SERVERS: ServerDef[] = ENDPOINTS.map((endpoint) => ({
  endpoint,
  project: endpoint.includes("gta5rp.com") ? "gta5rp" : "majestic",
  name: titleFromEndpoint(endpoint),
}));

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
  const rageByHost = new Map<string, { name?: string; players?: number }>();

  const [majesticRes, rageRes] = await Promise.allSettled([
    fetchJson("https://api.majestic-files.com/meta/servers"),
    fetchJson("https://cdn.rage.mp/master/"),
  ]);

  if (majesticRes.status === "fulfilled") {
    const body = majesticRes.value as { result?: { servers?: MajesticApiServer[] } };
    for (const s of body.result?.servers ?? []) {
      if (s.ip) majesticByIp.set(s.ip.toLowerCase(), s);
    }
  }

  if (rageRes.status === "fulfilled" && rageRes.value && typeof rageRes.value === "object") {
    for (const [host, info] of Object.entries(rageRes.value as Record<string, { name?: string; players?: number }>)) {
      rageByHost.set(host.toLowerCase(), info);
    }
  }

  return SERVERS.map((def) => {
    const key = def.endpoint.toLowerCase();
    if (def.project === "majestic") {
      const live = majesticByIp.get(key);
      return {
        endpoint: def.endpoint,
        name: live?.name || def.name,
        project: def.project,
        players: Number(live?.players ?? 0),
        online: Boolean(live?.status ?? live),
        region: live?.region,
      };
    }
    const live = rageByHost.get(key);
    return {
      endpoint: def.endpoint,
      name: def.name,
      project: def.project,
      players: Number(live?.players ?? 0),
      online: Boolean(live),
      region: "ru",
    };
  });
}
