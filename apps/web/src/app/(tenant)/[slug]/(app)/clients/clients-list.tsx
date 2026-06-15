"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";

const TIER_LABELS: Record<string, string> = {
  regular: "Regular",
  vip: "VIP",
  authorized_dealer: "Authorized Dealer",
};

const TIER_COLORS: Record<string, string> = {
  regular: "text-muted-foreground bg-muted border-border",
  vip: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  authorized_dealer: "text-primary bg-primary/10 border-primary/30",
};

export function ClientsList({ slug }: { slug: string }) {
  const [search, setSearch] = useState("");

  const { data, isPending, isError } = trpc.client.list.useQuery({
    page: 1,
    limit: 50,
    ...(search !== "" ? { search } : {}),
  });

  const clients = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground">
            {isPending ? "Loading…" : `${total} total`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients…"
            className="h-9 w-64 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary/50"
          />
          <Link
            href={`/${slug}/clients/new`}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            + New Client
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isError ? (
          <div className="px-6 py-12 text-center text-sm text-red-400">
            Failed to load clients. Please try again.
          </div>
        ) : isPending ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            Loading clients…
          </div>
        ) : clients.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            {search !== "" ? "No clients match your search." : "No clients yet."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Company / Name</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const tierClass =
                  TIER_COLORS[c.tier] ??
                  "text-muted-foreground bg-muted border-border";
                const tierLabel = TIER_LABELS[c.tier] ?? c.tier;
                const fullName = `${c.firstName} ${c.lastName}`;
                const location =
                  c.city !== null && c.province !== null
                    ? `${c.city}, ${c.province}`
                    : (c.city ?? c.province ?? null);
                return (
                  <tr
                    key={c.id}
                    className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/${slug}/clients/${c.id}/edit`}
                        className="hover:underline"
                      >
                        {c.companyName !== null ? (
                          <>
                            <div className="font-medium text-primary">
                              {c.companyName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {fullName}
                            </div>
                          </>
                        ) : (
                          <div className="font-medium text-primary">
                            {fullName}
                          </div>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.email !== null && (
                        <div className="text-xs">{c.email}</div>
                      )}
                      {c.phone !== null && (
                        <div className="text-xs">{c.phone}</div>
                      )}
                      {c.email === null && c.phone === null && "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {location ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${tierClass}`}
                      >
                        {tierLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {c.isActive ? (
                        <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          Active
                        </span>
                      ) : (
                        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/${slug}/clients/${c.id}/edit`}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
