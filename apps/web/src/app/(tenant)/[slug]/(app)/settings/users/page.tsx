import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerCaller } from "@/server/trpc/server";
import { guardPage } from "@/server/rbac/guard-page";
import { auth } from "@/server/auth";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeactivateButton } from "./deactivate-button";
import { TransferOwnership } from "./transfer-ownership";

export const metadata: Metadata = { title: "Users" };

export const dynamic = "force-dynamic";

export default async function UsersSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await guardPage(slug, "users");

  // User Management is Tenant Super Admin / Platform Owner only
  // (tenant-rbac-standard.md §4 guardrails) — defense-in-depth over the
  // server mutations (`superAdminProcedure` in the `user` router).
  const session = await auth();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("Tenant Super Admin") && !roles.includes("Platform Owner")) {
    redirect(`/${slug}/settings`);
  }

  const api = await createServerCaller();
  const { items: users, total } = await api.user.list({ page: 1, limit: 50 });

  const currentUserId = session?.user?.id;
  const isCurrentUserOwner = users.some(
    (u) => u.id === currentUserId && u.isTenantOwner,
  );
  const candidates = users
    .filter((u) => u.isActive && !u.isTenantOwner && u.id !== currentUserId)
    .map((u) => ({
      id: u.id,
      label: u.displayName ?? (`${u.firstName} ${u.lastName}`.trim() || u.email),
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          Manage team members in this workspace.{" "}
          <span className="text-muted-foreground">
            Showing {users.length} of {total}.
          </span>
        </p>
      </div>

      {isCurrentUserOwner && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div>
            <h2 className="text-sm font-medium">Ownership</h2>
            <p className="text-xs text-muted-foreground">
              You are the tenant owner. Transfer ownership to another member.
            </p>
          </div>
          <TransferOwnership candidates={candidates} />
        </div>
      )}

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  {user.displayName ?? `${user.firstName} ${user.lastName}`.trim()}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.email}
                </TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground">
                    {user.role?.name ?? "—"}
                  </span>
                  {user.isTenantOwner && (
                    <Badge
                      variant="outline"
                      className="ml-2 border-primary/30 bg-primary/10 text-primary text-xs"
                    >
                      Owner
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {user.isActive ? (
                    <Badge
                      variant="outline"
                      className="border-primary/30 bg-primary/10 text-primary text-xs"
                    >
                      Active
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-border bg-muted text-muted-foreground text-xs"
                    >
                      Inactive
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {user.isActive ? (
                    <DeactivateButton
                      userId={user.id}
                      displayName={
                        user.displayName ??
                        `${user.firstName} ${user.lastName}`.trim()
                      }
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-sm text-muted-foreground py-8"
                >
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {total > 50 && (
        <p className="text-xs text-muted-foreground text-center">
          Showing first 50 of {total} users. Pagination coming soon.
        </p>
      )}
    </div>
  );
}
