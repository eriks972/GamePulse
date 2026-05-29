"use client";

type SeasonSelectorProps = {
  seasons: string[];
  selectedSeason: string;
};

export default function SeasonSelector({
  seasons,
  selectedSeason,
}: SeasonSelectorProps) {
  return (
    <div className="mt-8">
      <label
        htmlFor="season"
        className="mb-2 block text-sm font-semibold text-slate-300"
      >
        Season
      </label>

      <select
        id="season"
        value={selectedSeason}
        onChange={(event) => {
          window.location.href = `/leagues/nba?season=${event.target.value}`;
        }}
        className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-950 px-5 py-3 text-white outline-none transition focus:border-blue-500"
      >
        {(seasons ?? []).map((season) => (
          <option key={season} value={season}>
            {season}
          </option>
        ))}
      </select>
    </div>
  );
}