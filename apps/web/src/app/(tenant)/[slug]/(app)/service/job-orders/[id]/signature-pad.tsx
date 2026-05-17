"use client";

import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

interface SignaturePadProps {
  jobOrderId: string;
  role: "customer" | "technician";
  label: string;
}

export function SignaturePad({ jobOrderId, role, label }: SignaturePadProps) {
  const ref = useRef<SignatureCanvas>(null);
  const router = useRouter();
  const [isEmpty, setIsEmpty] = useState(true);

  const recordSignature = trpc.jobOrder.recordSignature.useMutation({
    onSuccess: () => {
      toast.success(`${label} signature saved.`);
      router.refresh();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleSave = (): void => {
    const pad = ref.current;
    if (pad === null || pad.isEmpty()) {
      toast.error("Please sign before saving.");
      return;
    }
    const dataUrl = pad.getCanvas().toDataURL("image/png");
    recordSignature.mutate({ id: jobOrderId, role, dataUrl });
  };

  const handleClear = (): void => {
    ref.current?.clear();
    setIsEmpty(true);
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-foreground">{label} signature</div>
      <div className="overflow-hidden rounded-md border border-border bg-background">
        <SignatureCanvas
          ref={ref}
          canvasProps={{
            width: 480,
            height: 160,
            className: "block w-full",
            style: { touchAction: "none" },
          }}
          onEnd={() => {
            setIsEmpty(ref.current?.isEmpty() ?? true);
          }}
          backgroundColor="rgb(255,255,255)"
          penColor="rgb(15,23,42)"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={isEmpty || recordSignature.isPending}
        >
          {recordSignature.isPending ? "Saving…" : "Save signature"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={handleClear}>
          Clear
        </Button>
      </div>
    </div>
  );
}
