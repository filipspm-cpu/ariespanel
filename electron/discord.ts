import net from "net";

export interface DiscordProfile {
  id: string;
  username: string;
  globalName: string;
  discriminator: string;
  avatar: string | null;
  avatarUrl: string;
}

const OP_HANDSHAKE = 0;
const OP_FRAME = 1;
const CLIENT_ID = "180984871685062656";

function ipcPath(index: number) {
  if (process.platform === "win32") return `\\\\.\\pipe\\discord-ipc-${index}`;
  const base = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || "/tmp";
  return `${base}/discord-ipc-${index}`;
}

function encode(op: number, payload: unknown) {
  const json = Buffer.from(JSON.stringify(payload), "utf8");
  const header = Buffer.alloc(8);
  header.writeInt32LE(op, 0);
  header.writeInt32LE(json.length, 4);
  return Buffer.concat([header, json]);
}

function avatarUrl(id: string, avatar: string | null, discriminator: string) {
  if (avatar) {
    const ext = avatar.startsWith("a_") ? "gif" : "webp";
    return `https://cdn.discordapp.com/avatars/${id}/${avatar}.${ext}?size=128`;
  }
  const index =
    discriminator && discriminator !== "0"
      ? Number(discriminator) % 5
      : Number(BigInt(id) >> 22n) % 6;
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

function toProfile(user: {
  id?: string;
  username?: string;
  global_name?: string;
  discriminator?: string;
  avatar?: string | null;
}): DiscordProfile | null {
  if (!user?.id || !user.username) return null;
  const discriminator = user.discriminator || "0";
  return {
    id: user.id,
    username: user.username,
    globalName: user.global_name || user.username,
    discriminator,
    avatar: user.avatar ?? null,
    avatarUrl: avatarUrl(user.id, user.avatar ?? null, discriminator),
  };
}

function connectPipe(path: string, timeoutMs: number): Promise<DiscordProfile> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ path });
    let buf = Buffer.alloc(0);
    let settled = false;

    const finish = (err?: Error, profile?: DiscordProfile) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      if (err) reject(err);
      else if (profile) resolve(profile);
      else reject(new Error("Discord nie zwrócił profilu."));
    };

    const timer = setTimeout(() => finish(new Error("Discord nie odpowiada.")), timeoutMs);

    socket.on("connect", () => {
      socket.write(
        encode(OP_HANDSHAKE, {
          v: 1,
          client_id: CLIENT_ID,
        }),
      );
    });

    socket.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      while (buf.length >= 8) {
        const length = buf.readInt32LE(4);
        if (buf.length < 8 + length) break;
        const op = buf.readInt32LE(0);
        const body = buf.subarray(8, 8 + length).toString("utf8");
        buf = buf.subarray(8 + length);
        if (op !== OP_FRAME && op !== OP_HANDSHAKE) continue;
        try {
          const msg = JSON.parse(body) as {
            evt?: string;
            cmd?: string;
            data?: { user?: Parameters<typeof toProfile>[0] };
            user?: Parameters<typeof toProfile>[0];
          };
          const profile = toProfile(msg.data?.user ?? msg.user ?? {});
          if (profile && (msg.evt === "READY" || msg.cmd === "DISPATCH" || msg.user || msg.data?.user)) {
            finish(undefined, profile);
            return;
          }
        } catch {
          /* keep reading */
        }
      }
    });

    socket.on("error", (err) => finish(err));
    socket.on("close", () => {
      if (!settled) finish(new Error("Rozłączono z Discordem."));
    });
  });
}

export async function connectDiscord(): Promise<DiscordProfile> {
  const errors: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    try {
      return await connectPipe(ipcPath(i), 4000);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  throw new Error("Nie znaleziono Discorda. Włącz aplikację Discord na komputerze i spróbuj ponownie.");
}
