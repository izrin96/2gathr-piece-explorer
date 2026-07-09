import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PieceSearch } from "@/lib/filters";
import type { PieceClass } from "@/lib/types";

const CLASSES = ["S", "A", "B"] as const;
const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "member", label: "Member" },
] as const;

export function DesignFilterFields({
  members,
  editions,
  member,
  pieceClass,
  edition,
  onMemberChange,
  onClassChange,
  onEditionChange,
  hasActiveFilters,
  onReset,
}: {
  members: readonly string[];
  editions: readonly string[];
  member: string | undefined;
  pieceClass: PieceClass | undefined;
  edition: string | undefined;
  onMemberChange: (value: string | undefined) => void;
  onClassChange: (value: PieceClass | undefined) => void;
  onEditionChange: (value: string | undefined) => void;
  // Caller decides what counts as "active" (e.g. the Activity tab also
  // counts its type filter, which this component doesn't know about).
  hasActiveFilters: boolean;
  onReset: () => void;
}) {
  return (
    <>
      <FilterSelect
        placeholder="Member"
        allLabel="All members"
        value={member}
        options={members}
        onChange={onMemberChange}
      />
      <FilterSelect
        placeholder="Class"
        allLabel="All classes"
        value={pieceClass}
        options={CLASSES}
        onChange={(v) => onClassChange(v as PieceClass | undefined)}
      />
      <FilterSelect
        placeholder="Edition"
        allLabel="All editions"
        value={edition}
        options={editions}
        onChange={onEditionChange}
      />
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onReset}>
          <XIcon /> Reset
        </Button>
      )}
    </>
  );
}

export function SortSelect({
  value,
  onChange,
}: {
  value: PieceSearch["sort"];
  onChange: (value: PieceSearch["sort"] | undefined) => void;
}) {
  return (
    <Select
      items={SORTS}
      value={value ?? "newest"}
      onValueChange={(v) => onChange(v === "newest" ? undefined : (v as PieceSearch["sort"]))}
    >
      <SelectTrigger className="w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        <SelectGroup>
          {SORTS.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export function FilterSelect({
  placeholder,
  allLabel,
  value,
  options,
  onChange,
}: {
  placeholder: string;
  allLabel: string;
  value: string | undefined;
  options: readonly string[];
  onChange: (value: string | undefined) => void;
}) {
  const items = [
    { value: "all", label: allLabel },
    ...options.map((o) => ({ value: o, label: o })),
  ];

  return (
    <Select
      items={items}
      value={value ?? "all"}
      onValueChange={(v) => onChange(v === "all" || v == null ? undefined : v)}
    >
      <SelectTrigger className="w-36">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
