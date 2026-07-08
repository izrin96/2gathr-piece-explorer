import { describe, expect, it } from "vitest";

import { normalizeMember, parsePieceName } from "./piece.js";

describe("parsePieceName", () => {
  it("parses a standard piece name", () => {
    expect(parsePieceName("NAHYUN #001")).toEqual({
      member: "NAHYUN",
      designNumber: 1,
      hidden: false,
    });
  });

  it("parses a hidden piece name", () => {
    expect(parsePieceName("SEOHYEON (Hidden) #001")).toEqual({
      member: "SEOHYEON",
      designNumber: 1,
      hidden: true,
    });
  });

  it("returns nulls for a non-member piece", () => {
    expect(parsePieceName("Welcome to 2GATHR")).toEqual({
      member: null,
      designNumber: null,
      hidden: false,
    });
  });
});

describe("normalizeMember", () => {
  it("title-cases an all-uppercase name", () => {
    expect(normalizeMember("NAHYUN")).toBe("Nahyun");
  });

  it("leaves an already title-cased name unchanged", () => {
    expect(normalizeMember("Nahyun")).toBe("Nahyun");
  });

  it("returns an empty string as-is", () => {
    expect(normalizeMember("")).toBe("");
  });
});
