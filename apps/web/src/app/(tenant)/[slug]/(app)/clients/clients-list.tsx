"use client";

import { useState } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

  const { data, isPending, isError } = trpc.clients.list.useQuery({
    page: 1,
    limit: 50,
    ...(search !== "" ? { search } : {}),
  });

  const clients = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description={isPending ? "Loading…" : `${total} total`}
        actions={
          <div className="flex items-center gap-3">
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients…"
              className="h-9 w-64"
            />
            <Button asChild>
              <Link href={`/${slug}/clients/new`}>+ New Client</Link>
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="p-0">
          {isError ? (
            <div className="p-6">
              <EmptyState
                icon={Users}
                title="Failed to load clients."
                description="Please try again."
              />
            </div>
          ) : isPending ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              Loading clients…
            </div>
          ) : clients.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Users}
                title={
                  search !== ""
                    ? "No clients match your search."
                    : "No clients yet."
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company / Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
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
                    <TableRow key={c.id}>
                      <TableCell>
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
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.email !== null && (
                          <div className="text-xs">{c.email}</div>
                        )}
                        {c.phone !== null && (
                          <div className="text-xs">{c.phone}</div>
                        )}
                        {c.email === null && c.phone === null && "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {location ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`rounded-full ${tierClass}`}
                        >
                          {tierLabel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {c.isActive ? (
                          <Badge
                            variant="outline"
                            className="rounded-full border-primary/30 bg-primary/10 text-primary"
                          >
                            Active
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="rounded-full border-border bg-muted text-muted-foreground"
                          >
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/${slug}/clients/${c.id}/edit`}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          Edit
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
