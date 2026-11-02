import type { Player } from "@/lib/api";

export default function NbaCatalogNotice({ players }: { players: Player[] }) {
  const refreshed = players.filter((p) => p.catalogUpdatedAt);
  const latest = refreshed.map((p) => p.catalogUpdatedAt!).sort().at(-1);
  const parsed = latest ? new Date(latest) : null;
  const date = parsed && !Number.isNaN(parsed.getTime())
    ? parsed.toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" })
    : null;
  const legacy = players.length - refreshed.length;

  return (
    <aside className="mt-6 rounded-2xl border border-blue-500/30 bg-blue-500/5 p-4 text-sm text-slate-300" aria-label="Player directory coverage">
      <p className="font-semibold text-blue-300">
        {date ? `NBA directory updated ${date}` : "Legacy NBA player directory"}
      </p>
      <p className="mt-2">
        {date
          ? "Listed teams and roster status reflect the directory snapshot. Career years use the NBA’s published values; they do not confirm season appearances or available statistics."
          : "Team assignments, roster status, and career dates may be outdated."}
      </p>
      {date && legacy > 0 && (
        <p className="mt-2">{legacy} retained historical {legacy === 1 ? "record was" : "records were"} absent from the refresh and may contain older details.</p>
      )}
    </aside>
  );
}
