import { describe, expect, it } from "vitest";

import { computeClassDistribution, computeRubyBalances } from "./compute.js";

const ZERO = "0x0000000000000000000000000000000000000000";
const A = "0x00000000000000000000000000000000000000aa";
const B = "0x00000000000000000000000000000000000000bb";

describe("computeRubyBalances", () => {
  it("folds mints and transfers, excluding the zero address and zero balances", () => {
    const balances = computeRubyBalances([
      { from: ZERO, to: A, value: 100n }, // mint 100 to A
      { from: ZERO, to: B, value: 50n }, // mint 50 to B
      { from: A, to: B, value: 30n }, // A -> B 30
      { from: B, to: ZERO, value: 80n }, // B burns 80
    ]);
    expect(balances.get(A)).toBe(70n); // 100 - 30
    expect(balances.get(B)).toBeUndefined(); // 50 + 30 - 80 = 0 -> dropped
    expect(balances.has(ZERO)).toBe(false);
  });

  it("keeps a positive residual balance", () => {
    const balances = computeRubyBalances([
      { from: ZERO, to: A, value: 100n },
      { from: A, to: B, value: 40n },
    ]);
    expect(balances.get(A)).toBe(60n);
    expect(balances.get(B)).toBe(40n);
  });
});

describe("computeClassDistribution", () => {
  it("counts designs per class, bucketing nulls as unknown", () => {
    expect(
      computeClassDistribution([{ rarity: 1 }, { rarity: 1 }, { rarity: 3 }, { rarity: null }]),
    ).toEqual({ "1": 2, "3": 1, unknown: 1 });
  });
});
