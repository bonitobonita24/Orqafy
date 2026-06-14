import type { Metadata } from "next";
import { createServerCaller } from "@/server/trpc/server";
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

export const metadata: Metadata = { title: "Users" };

export const dynamic = "force-dynamic";

export default async function UsersSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await params;

  const api = await createServerCaller();
  const { items: users, total } = await api.user.list({ page: 1, limit: 50 });

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
                </TableCell>
                <TableCell>
                  {user.isActive ? (
                    <Badge
                      variant="outline"
                      className="border-[#00d992]/30 bg-[#00d992]/10 text-[#00d992] text-xs"
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
