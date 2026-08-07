import type { Metadata } from "next";
import { Wallet } from "lucide-react";
import { prisma } from "@orqafy/db";
import { PageHeader } from "@/components/layout/page-header";
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
import { AddFundSourceButton, EditFundSourceButton, ToggleFundSourceButton } from "./fund-source-form";

async function getTenantId(slug: string) {
  const t = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  return t?.id ?? null;
}

export const metadata: Metadata = { title: "Fund Sources" };

export const dynamic = "force-dynamic";

async function getFundSources(tenantId: string) {
  return prisma.fundSource.findMany({
    // tenant-scoped: prevents cross-tenant data leak
    where: { tenantId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      type: true,
      currentBalance: true,
      currency: true,
      bankName: true,
      accountNumber: true,
      isActive: true,
    },
  });
}

const TYPE_LABELS: Record<string, string> = {
  cash_on_hand: "Cash on Hand",
  e_wallet: "E-Wallet",
  bank: "Bank Account",
  credit_card: "Credit Card",
  loan: "Loan",
};

const TYPE_COLORS: Record<string, string> = {
  bank: "text-primary bg-primary/10 border-primary/30",
  cash_on_hand: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  e_wallet: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  credit_card: "text-purple-400 bg-purple-400/10 border-purple-400/30",
  loan: "text-orange-400 bg-orange-400/10 border-orange-400/30",
};

function formatBalance(balance: unknown, currency: string): string {
  const num = Number(balance);
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(num);
}

export default async function FundSourcesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenantId = await getTenantId(slug);
  if (tenantId === null) return <div>Tenant not found</div>;
  const fundSources = await getFundSources(tenantId);
  const active = fundSources.filter((f) => f.isActive);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fund Sources"
        description={`${active.length} active of ${fundSources.length} total`}
        actions={<AddFundSourceButton />}
      />

      <Card>
        <CardContent className="p-0">
          {fundSources.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Wallet}
                title="No fund sources configured yet."
                action={<AddFundSourceButton />}
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fundSources.map((fs) => {
                  const typeClass =
                    TYPE_COLORS[fs.type] ??
                    "text-muted-foreground bg-muted border-border";
                  const typeLabel = TYPE_LABELS[fs.type] ?? fs.type;
                  return (
                    <TableRow key={fs.id}>
                      <TableCell>
                        <div className="font-medium">{fs.name}</div>
                        {fs.bankName !== null && (
                          <div className="text-xs text-muted-foreground">
                            {fs.bankName}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`rounded-full ${typeClass}`}>
                          {typeLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatBalance(fs.currentBalance, fs.currency)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {fs.accountNumber ?? "—"}
                      </TableCell>
                      <TableCell>
                        {fs.isActive ? (
                          <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/10 text-primary">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="rounded-full border-border bg-muted text-muted-foreground">
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <EditFundSourceButton
                            fundSource={{
                              id: fs.id,
                              name: fs.name,
                              type: fs.type,
                              bankName: fs.bankName,
                              accountNumber: fs.accountNumber,
                            }}
                          />
                          <ToggleFundSourceButton id={fs.id} isActive={fs.isActive} />
                        </div>
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
