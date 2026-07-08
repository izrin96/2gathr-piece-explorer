import { describe, expect, it } from "vitest";

import { formatUtcDate, formatUtcDateTime, truncateAddress } from "./format";

describe("truncateAddress", () => {
  it("keeps the first 6 and last 4 characters", () => {
    expect(truncateAddress("0xabcd001122334455667788990011223344556677")).toBe("0xabcd…6677");
  });
});

describe("formatUtcDate", () => {
  it("formats pinned to UTC regardless of host timezone", () => {
    expect(formatUtcDate("2025-03-14T23:30:00.000Z")).toBe("Mar 14, 2025");
  });
});

describe("formatUtcDateTime", () => {
  it("includes the time and a UTC marker", () => {
    expect(formatUtcDateTime("2025-03-14T23:30:00.000Z")).toBe("Mar 14, 2025, 23:30:00 UTC");
  });
});
