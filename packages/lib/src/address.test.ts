import { describe, expect, it } from "vitest";

import { isAddress, normalizeAddress, ZERO_ADDRESS } from "./address.js";

describe("normalizeAddress", () => {
  it("lowercases a valid checksummed address", () => {
    expect(normalizeAddress("0x16AC90358D5f8610A85FA5270659356AFDC48A9E")).toBe(
      "0x16ac90358d5f8610a85fa5270659356afdc48a9e",
    );
  });

  it("throws on an invalid address", () => {
    expect(() => normalizeAddress("0x123")).toThrow();
  });
});

describe("isAddress", () => {
  it("returns true for a 42-char hex address", () => {
    expect(isAddress("0x16ac90358d5f8610a85fa5270659356afdc48a9e")).toBe(true);
  });

  it("returns false for garbage", () => {
    expect(isAddress("nope")).toBe(false);
  });
});

it("exposes the zero address", () => {
  expect(ZERO_ADDRESS).toBe("0x0000000000000000000000000000000000000000");
});
