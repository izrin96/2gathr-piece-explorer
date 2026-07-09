import { sortDesigns } from "./filters";
import type { Design } from "./types";

export interface MemberSlot {
  design: Design;
  isCollected: boolean;
}

export interface ResolvedMemberProgress {
  member: string;
  slots: MemberSlot[];
  collected: number;
  total: number;
  percent: number;
}

export function resolveMemberProgress(
  allDesigns: Design[],
  ownedAddresses: Set<string>,
): ResolvedMemberProgress[] {
  const byMember = new Map<string, Design[]>();
  for (const d of allDesigns) {
    if (d.isHidden || d.member == null) continue;
    byMember.set(d.member, [...(byMember.get(d.member) ?? []), d]);
  }

  return [...byMember.entries()]
    .map(([member, designs]) => {
      const slots = sortDesigns(designs, "newest").map((design) => ({
        design,
        isCollected: ownedAddresses.has(design.contractAddress),
      }));
      const collected = slots.filter((s) => s.isCollected).length;
      return {
        member,
        slots,
        collected,
        total: slots.length,
        percent: slots.length === 0 ? 0 : Math.round((collected / slots.length) * 100),
      };
    })
    .toSorted((a, b) => a.member.localeCompare(b.member));
}
