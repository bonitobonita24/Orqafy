"use client";

// ─── Top Clients DataTable ────────────────────────────────────────────────────
// Domain wrapper around the generic DataTable for the Reports page top-clients
// surface. Revenue column is sortable (default desc). Currency is formatted PHP
// (₱) HERE, inside this client component — formatters are NOT passed as props
// from the server page (functions can't cross the RSC boundary). The page passes
// only plain serializable data (numbers), and we format on the client.

import { type ColumnDef, type HeaderContext } from "@tanstack/react-table";
import { ArrowUpDown, Users } from "@/components/ui/icons";

import { DataTable } from "@/components/ui/data-table";

export interface TopClientRow {
  customerId: string;
  name: string;
  revenue: number;
  invoiceCount: number;
}

interface TopClientsTableProps {
  data: TopClientRow[];
}

// Client-safe formatters (no Prisma Decimal / no RSC boundary involved).
const formatAmount = (v: number): string =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(v);

const formatInt = (v: number): string =>
  new Intl.NumberFormat("en-PH").format(v);

function RevenueHeader({ column }: HeaderContext<TopClientRow, unknown>) {
  const sorted = column.getIsSorted();
  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={() => column.toggleSorting(sorted === "asc")}
        className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
      >
        Revenue
        <ArrowUpDown className="h-3.5 w-3.5 shrink-0" />
      </button>
    </div>
  );
}

export function TopClientsTable({ data }: TopClientsTableProps) {
  const columns: ColumnDef<TopClientRow>[] = [
    {
      id: "rank",
      header: "#",
      cell: ({ row, table }) => {
        // Reflect sorted position so rank stays meaningful after user sorts
        const pos = table.getRowModel().rows.findIndex((r) => r.id === row.id);
        return (
          <span className="text-muted-foreground">
            {(pos === -1 ? row.index : pos) + 1}
          </span>
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: "name",
      header: "Client",
      cell: ({ getValue }) => (
        <span className="font-medium">{getValue<string>()}</span>
      ),
    },
    {
      accessorKey: "invoiceCount",
      header: () => <div className="text-right">Invoices</div>,
      cell: ({ getValue }) => (
        <div className="text-right text-muted-foreground">
          {formatInt(getValue<number>())}
        </div>
      ),
    },
    {
      accessorKey: "revenue",
      header: RevenueHeader,
      cell: ({ getValue }) => (
        <div className="text-right font-mono text-xs text-primary">
          {formatAmount(getValue<number>())}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      initialSorting={[{ id: "revenue", desc: true }]}
      empty={{
        icon: Users,
        title: "No paid invoices yet",
        description:
          "Top clients by revenue will appear here once invoices are marked paid.",
      }}
    />
  );
}
