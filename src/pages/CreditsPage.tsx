const PEOPLE = [
  {
    role: "Main developer",
    name: "Filipek",
    avatar:
      "https://cdn.discordapp.com/avatars/1305449847125708811/a_0f4b5d7a05b58415a1c2dd8522c45363.webp?size=28",
    size: 28,
  },
  {
    role: "Developer",
    name: "rysiasty",
    avatar: "https://cdn.discordapp.com/avatars/1039967564664676412/ed332cc74ab76bf8c0df6f4b54b53f65.webp?size=24",
    size: 24,
  },
  {
    role: "Beta tester",
    name: "wiśniófka",
    avatar: "https://cdn.discordapp.com/avatars/1200264556354752565/d4567453494fbc904a919d3ec08696fb.webp?size=24",
    size: 24,
  },
] as const;

function CreditRow({
  person,
}: {
  person: (typeof PEOPLE)[number];
}) {
  return (
    <div className="flex items-center justify-center gap-3 py-6">
      <img
        src={person.avatar}
        alt=""
        width={person.size}
        height={person.size}
        className="rounded-full"
        style={{ width: person.size, height: person.size }}
        draggable={false}
      />
      <div className="text-center leading-tight">
        <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{person.role}</div>
        <div className="mt-1 text-[20px] font-semibold text-white">{person.name}</div>
      </div>
    </div>
  );
}

export function CreditsPage() {
  const loop = [...PEOPLE, ...PEOPLE, ...PEOPLE];
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-6 pt-6">
        <h1 className="text-[26px] font-semibold tracking-tight text-white">Podziękowania</h1>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b from-syn-bg to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-syn-bg to-transparent" />
        <div className="credits-roll absolute inset-x-0">
          {loop.map((person, i) => (
            <CreditRow key={`${person.name}-${i}`} person={person} />
          ))}
        </div>
      </div>
    </div>
  );
}
