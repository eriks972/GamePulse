import { render, screen, fireEvent } from "@testing-library/react";
import ScheduleClient from "@/app/leagues/nba/schedule/scheduleClient";
import type { Game } from "@/lib/api";

test("NBA schedule combines team and date filters and resets both", () => {
  const games = [
    { id: 1, externalGameId: "one", gameDate: "2026-03-01T00:00:00Z", homeTeamName: "Alpha", awayTeamName: "Beta", homeTeamAbbreviation: "A", awayTeamAbbreviation: "B", homeScore: 100, awayScore: 90, season: "2026", status: "Final" },
    { id: 2, externalGameId: "two", gameDate: "2026-03-02T00:00:00Z", homeTeamName: "Beta", awayTeamName: "Gamma", homeTeamAbbreviation: "B", awayTeamAbbreviation: "G", homeScore: 100, awayScore: 90, season: "2026", status: "Final" },
  ] as unknown as Game[];
  render(<ScheduleClient games={games} seasons={["2026"]} selectedSeason="2026" />);
  fireEvent.change(screen.getByLabelText("Team"), { target: { value: "Alpha" } });
  expect(screen.getAllByRole("link", { name: "View Details" })).toHaveLength(1);
  fireEvent.change(screen.getByLabelText("Game date"), { target: { value: "2026-03-02" } });
  expect(screen.getByText("No games found")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
  expect(screen.getAllByRole("link", { name: "View Details" })).toHaveLength(2);
});
