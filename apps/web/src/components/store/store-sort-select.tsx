"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type StoreSortKey = "newest" | "price_asc" | "price_desc";

const SORT_OPTIONS: { label: string; value: StoreSortKey }[] = [
  { label: "Newest first", value: "newest" },
  { label: "Price: Low to High", value: "price_asc" },
  { label: "Price: High to Low", value: "price_desc" },
];

interface StoreSortSelectProps {
  value: StoreSortKey;
}

/**
 * URL-driven sort control — adapted from starter/shopix shop-toolbar.tsx's
 * sort <Select>, but wired to router navigation (not local state) so sort
 * stays server-rendered + shareable via ?sort=, matching every other filter
 * on this page. The only client-interactive piece of the catalog filters.
 */
export function StoreSortSelect({ value }: StoreSortSelectProps): React.ReactNode {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(next: string): void {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "newest") {
      params.delete("sort");
    } else {
      params.set("sort", next);
    }
    params.delete("page");
    const qs = params.toString();
    router.push(qs.length > 0 ? `${pathname}?${qs}` : pathname);
  }

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger className="h-9 w-full sm:w-52">
        <span className="text-muted-foreground">Sort:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
