"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { CopyLink, Mail, ShieldCheck, ShieldAlert } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PortalAccessCardProps {
  customerId: string;
  portalEnabled: boolean;
  portalEmail: string | null;
}

export function PortalAccessCard({
  customerId,
  portalEnabled: initialPortalEnabled,
  portalEmail,
}: PortalAccessCardProps) {
  const router = useRouter();
  const [portalEnabled, setPortalEnabled] = useState(initialPortalEnabled);
  const [acceptUrl, setAcceptUrl] = useState<string | null>(null);
  const [disableOpen, setDisableOpen] = useState(false);

  function buildAbsoluteUrl(relativeUrl: string): string {
    return `${window.location.origin}${relativeUrl}`;
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied");
    } catch {
      toast.error("Could not copy link");
    }
  }

  const invite = trpc.customerPortal.invite.useMutation({
    onSuccess: (data) => {
      setAcceptUrl(buildAbsoluteUrl(data.acceptUrl));
      toast.success("Portal invite created");
      router.refresh();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const resetPassword = trpc.customerPortal.resetPassword.useMutation({
    onSuccess: (data) => {
      setAcceptUrl(buildAbsoluteUrl(data.acceptUrl));
      toast.success("New invite link generated");
      router.refresh();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const disable = trpc.customerPortal.disable.useMutation({
    onSuccess: () => {
      setPortalEnabled(false);
      setAcceptUrl(null);
      toast.success("Portal access disabled");
      setDisableOpen(false);
      router.refresh();
    },
    onError: (err) => {
      toast.error(err.message);
      setDisableOpen(false);
    },
  });

  function handleInvite() {
    if (portalEmail === null || portalEmail === "") {
      const email = window.prompt("Portal email for this customer:");
      if (email === null || email.trim() === "") return;
      invite.mutate({ customerId, email: email.trim() });
      return;
    }
    invite.mutate({ customerId });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {portalEnabled ? (
            <ShieldCheck className="size-4 text-emerald-500" />
          ) : (
            <ShieldAlert className="size-4 text-muted-foreground" />
          )}
          Portal Access
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {portalEnabled ? (
          <>
            <p className="text-xs text-muted-foreground">
              Portal access enabled
              {portalEmail !== null && portalEmail !== "" ? ` — ${portalEmail}` : ""}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => resetPassword.mutate({ customerId })}
                disabled={resetPassword.isPending}
              >
                {resetPassword.isPending ? "Resetting…" : "Reset password"}
              </Button>
              <AlertDialog open={disableOpen} onOpenChange={setDisableOpen}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-red-500/40 text-red-400 hover:bg-red-500/10"
                  onClick={() => setDisableOpen(true)}
                >
                  Disable access
                </Button>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disable portal access?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This immediately signs the customer out of the portal and
                      revokes any outstanding invite link. They will need a new
                      invite to regain access.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={disable.isPending}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-500 text-white hover:bg-red-600"
                      disabled={disable.isPending}
                      onClick={(e) => {
                        e.preventDefault();
                        disable.mutate({ customerId });
                      }}
                    >
                      {disable.isPending ? "Disabling…" : "Disable access"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              This customer does not have portal access yet.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleInvite}
              disabled={invite.isPending}
            >
              <Mail className="size-3.5" />
              {invite.isPending ? "Inviting…" : "Invite to portal"}
            </Button>
          </>
        )}

        {acceptUrl !== null && (
          <div className="flex items-center gap-1.5 rounded border border-border bg-muted/50 p-2">
            <code className="flex-1 truncate text-xs text-muted-foreground">
              {acceptUrl}
            </code>
            <button
              type="button"
              onClick={() => void copyLink(acceptUrl)}
              className="inline-flex shrink-0 items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 text-xs font-medium text-foreground hover:bg-muted/70"
            >
              <CopyLink className="size-3.5" />
              Copy invite link
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
