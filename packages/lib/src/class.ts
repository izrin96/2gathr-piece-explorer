// Rarity integer (TopPort item `rarity` / IPFS metadata `rarity`) -> in-app class letter.
// Confirmed against the 2GATHR app: 3 = S (Welcome specials), 2 = A (video pieces),
// 1 = B (standard image pieces). See docs/superpowers/research/2gathr-api-findings.md.
const RARITY_TO_LETTER: Record<number, string> = { 1: "B", 2: "A", 3: "S" };

export function classLetter(rarity: number): string | null {
  return RARITY_TO_LETTER[rarity] ?? null;
}
