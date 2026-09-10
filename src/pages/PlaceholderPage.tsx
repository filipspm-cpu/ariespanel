import { pageMeta } from "@/data/navigation";
import { useAppStore } from "@/store/useAppStore";
import { Card } from "@/components/ui/Card";

export function PlaceholderPage() {
  const route = useAppStore((s) => s.route);
  const meta = pageMeta[route];
  return (
    <div className="h-full overflow-auto p-6">
      <h1 className="text-[26px] font-semibold tracking-tight text-white">{meta.title}</h1>
      {meta.subtitle ? <p className="mt-1 text-[13px] text-zinc-500">{meta.subtitle}</p> : null}
      <Card className="mt-6 p-6 text-[13px] text-zinc-500">
        Ta sekcja korzysta z tego samego układu aplikacji. Logika biznesowa i źródło danych API zostaną podłączone w
        kolejnym etapie. Wszystkie ustawienia i nawigacja działają lokalnie.
      </Card>
    </div>
  );
}
