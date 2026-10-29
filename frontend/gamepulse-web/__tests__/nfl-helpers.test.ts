import { display, nflEntity, nflHref } from "@/lib/nfl";

describe("NFL statistic formatting", () => {
  test("distinguishes missing data from zero", () => {
    expect(display(null)).toBe("—");
    expect(display(undefined)).toBe("—");
    expect(display(0)).toBe("0");
  });

  test("preserves negative and fractional statistics", () => {
    expect(display(-10)).toBe("-10");
    expect(display(1.5)).toBe("1.5");
  });
});

describe("NFL navigation", () => {
  test("builds a player link with the selected season and phase", () => {
    const link = nflHref(
      nflEntity("players", "00-0034857"),
      {
        season: "1999",
        seasonType: "POST",
      },
    );

    expect(link).toBe(
      "/leagues/nfl/players/00-0034857?season=1999&seasonType=POST",
    );
  });
});