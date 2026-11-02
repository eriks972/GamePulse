import { render, screen } from "@testing-library/react";
import NbaCatalogNotice from "@/app/leagues/nba/players/NbaCatalogNotice";
import type { Player } from "@/lib/api";

test("labels a dated directory snapshot without claiming season statistics", () => {
  render(<NbaCatalogNotice players={[
    { catalogUpdatedAt: "2026-10-31T23:10:39+00:00" } as Player,
    {} as Player,
  ]} />);
  expect(screen.getByText("NBA directory updated October 31, 2026")).toBeInTheDocument();
  expect(screen.getByText(/do not confirm season appearances/)).toBeInTheDocument();
  expect(screen.getByText(/1 retained historical record was absent/)).toBeInTheDocument();
});

test("does not present an older catalog as refreshed", () => {
  render(<NbaCatalogNotice players={[{} as Player]} />);
  expect(screen.getByText("Legacy NBA player directory")).toBeInTheDocument();
  expect(screen.getByText(/may be outdated/)).toBeInTheDocument();
});

test("an invalid timestamp does not claim a successful refresh date", () => {
  render(<NbaCatalogNotice players={[{ catalogUpdatedAt: "invalid" } as Player]} />);
  expect(screen.getByText("Legacy NBA player directory")).toBeInTheDocument();
});
