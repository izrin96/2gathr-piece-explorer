import { describe, expect, it } from "vitest";

import { classLetter } from "./class.js";

describe("classLetter", () => {
  it("maps the rarity integer to the in-app class letter", () => {
    expect(classLetter(1)).toBe("B");
    expect(classLetter(2)).toBe("A");
    expect(classLetter(3)).toBe("S");
  });

  it("returns null for an unknown rarity", () => {
    expect(classLetter(0)).toBeNull();
    expect(classLetter(4)).toBeNull();
  });
});
