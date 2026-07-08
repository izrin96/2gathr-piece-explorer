// The edition of a Piece is just the raw contract `name()` / TopPort `title.en` string
// (e.g. "2025 Season 1", "2026 HBD", "Welcome", "Hidden Piece"). It is open-ended — new
// editions ship on 2GATHR's schedule — so it is stored and displayed verbatim, never
// classified against a hardcoded set. If the UI later needs edition grouping/ordering, derive
// it from the indexed data rather than a closed union here.

export function normalizeMember(member: string): string {
  if (!member) return member;
  return member.charAt(0).toUpperCase() + member.slice(1).toLowerCase();
}

const PIECE_NAME_RE = /^(?<member>[A-Za-z]+)(?:\s*\((?<hidden>Hidden)\))?\s*#(?<num>\d+)$/;

export function parsePieceName(name: string): {
  member: string | null;
  designNumber: number | null;
  hidden: boolean;
} {
  const m = PIECE_NAME_RE.exec(name.trim());
  if (!m?.groups) {
    return { member: null, designNumber: null, hidden: false };
  }
  return {
    member: m.groups.member ?? null,
    designNumber: m.groups.num ? Number.parseInt(m.groups.num, 10) : null,
    hidden: m.groups.hidden === "Hidden",
  };
}
