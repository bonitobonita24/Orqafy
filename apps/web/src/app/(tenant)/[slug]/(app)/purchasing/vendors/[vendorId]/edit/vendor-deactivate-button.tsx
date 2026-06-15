"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

interface VendorDeactivateButtonProps {
  slug: string;
  vendorId: string;
  companyName: string;
}

export function VendorDeactivateButton({ slug, vendorId, companyName }: VendorDeactivateButtonProps) {
  const router = useRouter();

  const deactivateMut = trpc.purchasing.vendor.deactivate.useMutation({
    onSuccess: () => {
      toast.success(`${companyName} deactivated.`);
      router.push(`/${slug}/purchasing/vendors`);
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  function handleDeactivate() {
    if (
      !window.confirm(
        `Deactivate vendor "${companyName}"? Existing POs will not be affected, but no new POs can be created for this vendor.`,
      )
    )
      return;
    deactivateMut.mutate({ id: vendorId });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDeactivate}
      disabled={deactivateMut.isPending}
      className="border-red-500/30 text-red-400 hover:border-red-500/50 hover:bg-red-500/10"
    >
      {deactivateMut.isPending ? "Deactivating…" : "Deactivate Vendor"}
    </Button>
  );
}
