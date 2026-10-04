import { describe, expect, it } from "vitest";
import {
  currentMonthKeyIn,
  formatDay,
  isIsoDay,
  isMonthKey,
  monthLabel,
  nextMonthKey,
  previousMonthKey,
  todayIn,
  zonedTimeToUtc,
} from "./months";

describe("month keys", () => {
  it("validates", () => {
    expect(isMonthKey("2026-10")).toBe(true);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("october-2026")).toBe(false);
    expect(isIsoDay("2026-02-29")).toBe(false);
    expect(isIsoDay("2028-02-29")).toBe(true);
  });

  it("labels and steps across years", () => {
    expect(monthLabel("2026-10")).toBe("October 2026");
    expect(previousMonthKey("2026-01")).toBe("2025-12");
    expect(nextMonthKey("2026-12")).toBe("2027-01");
    expect(previousMonthKey("2026-03")).toBe("2026-02");
  });

  it("formats days without timezone drift", () => {
    expect(formatDay("2026-10-04")).toBe("Sunday, October 4");
    expect(formatDay("2026-10-04", { withYear: true })).toBe("Sunday, October 4, 2026");
  });
});

describe("timezones", () => {
  // 2026-11-01 03:30 UTC is still October 31 in Los Angeles.
  const instant = new Date("2026-11-01T03:30:00Z");

  it("uses the configured timezone, not the server's", () => {
    expect(todayIn("America/Los_Angeles", instant)).toBe("2026-10-31");
    expect(todayIn("Asia/Tokyo", instant)).toBe("2026-11-01");
    expect(currentMonthKeyIn("America/Los_Angeles", instant)).toBe("2026-10");
    expect(previousMonthKey(currentMonthKeyIn("Asia/Tokyo", instant))).toBe("2026-10");
  });

  it("converts wall-clock time to UTC, including across DST", () => {
    expect(zonedTimeToUtc("2026-10-04", "18:30", "America/New_York").toISOString()).toBe("2026-10-04T22:30:00.000Z");
    expect(zonedTimeToUtc("2026-12-04", "18:30", "America/New_York").toISOString()).toBe("2026-12-04T23:30:00.000Z");
    expect(zonedTimeToUtc("2026-10-04", "12:00:00", "UTC").toISOString()).toBe("2026-10-04T12:00:00.000Z");
    expect(zonedTimeToUtc("2026-07-01", "09:15", "Asia/Manila").toISOString()).toBe("2026-07-01T01:15:00.000Z");
  });
});
