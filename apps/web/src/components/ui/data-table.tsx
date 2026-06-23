"use client";

// ─── Generic TanStack DataTable — shadcn data-table pattern ──────────────────
// Builds on the existing shadcn Table primitive (table.tsx).
// Features: sortable column headers (ArrowUpDown icon), EmptyState-based no-rows
// row, and a clean generic type so callers can pass any row shape.

import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import { ArrowUpDown } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LucideIcon } from "lucide-react";

export interface DataTableEmptyConfig {
  icon: LucideIcon;
  title: string;
  description: string;
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  empty?: DataTableEmptyConfig;
  /** Initial sort state — e.g. [{ id: "revenue", desc: true }] */
  initialSorting?: SortingState;
}

/**
 * Generic sortable DataTable built on the shadcn Table primitive + TanStack
 * react-table. Sortable columns receive an ArrowUpDown button header by
 * default when using the `sortableHeader` helper below.
 *
 * Usage:
 *   const columns: ColumnDef<MyRow>[] = [
 *     { accessorKey: "name", header: "Name" },
 *     { accessorKey: "revenue", header: sortableHeader("Revenue") },
 *   ];
 *   <DataTable columns={columns} data={rows} empty={{ icon: Users, title: "No data" }} />
 */
export function DataTable<TData, TValue>({
  columns,
  data,
  empty,
  initialSorting = [],
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((hg) => (
          <TableRow key={hg.id}>
            {hg.headers.map((header) => (
              <TableHead key={header.id}>
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {rows.length > 0 ? (
          rows.map((row) => (
            <TableRow
              key={row.id}
              data-state={row.getIsSelected() ? "selected" : undefined}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={columns.length} className="h-40 p-0">
              {empty ? (
                <EmptyState
                  icon={empty.icon}
                  title={empty.title}
                  description={empty.description}
                  className="border-0"
                />
              ) : (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                  No results.
                </div>
              )}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

/**
 * sortableHeader — returns a header render function that shows a clickable
 * ArrowUpDown button. Pass the result as the `header` value in a ColumnDef.
 *
 * Example:
 *   { accessorKey: "revenue", header: sortableHeader("Revenue") }
 */
export function sortableHeader(label: string) {
  // eslint-disable-next-line react/display-name
  return function SortableColumnHeader({
    column,
  }: {
    column: {
      toggleSorting: (desc?: boolean) => void;
      getIsSorted: () => false | "asc" | "desc";
    };
  }) {
    const sorted = column.getIsSorted();
    return (
      <button
        type="button"
        onClick={() => column.toggleSorting(sorted === "asc")}
        className="flex items-center gap-1 text-left font-medium text-muted-foreground hover:text-foreground"
      >
        {label}
        <ArrowUpDown className="h-3.5 w-3.5 shrink-0" />
      </button>
    );
  };
}
