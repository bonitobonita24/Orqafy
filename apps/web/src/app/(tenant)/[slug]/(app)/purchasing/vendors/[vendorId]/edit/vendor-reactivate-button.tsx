"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

interface VendorReactivateButtonProps {
  slug: string;
  vendorId: string;
  companyName: string;
}

export function VendorReactivateButton({ slug, vendorId, companyName }: VendorReactivateButtonProps) {
  const router = useRouter();

  const reactivateMut = trpc.purchasing.vendor.reactivate.useMutation({
    onSuccess: () => {
      toast.success(`${companyName} reactivated.`);
      router.push(`/${slug}/purchasing/vendors`);
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  function handleReactivate() {
    if (
      !window.confirm(
        `Reactivate vendor "${companyName}"? New POs can be created for this vendor again.`,
      )
    )
      return;
    reactivateMut.mutate({ id: vendorId });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleReactivate}
      disabled={reactivateMut.isPending}
      className="border-emerald-500/30 text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/10"
    >
      {reactivateMut.isPending ? "Reactivating…" : "Reactivate Vendor"}
    </Button>
  );
}
