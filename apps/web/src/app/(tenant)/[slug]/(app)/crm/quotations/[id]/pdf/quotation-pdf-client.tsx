"use client";

import dynamic from "next/dynamic";
import type { QuotationPdfData } from "./quotation-pdf-viewer";

const QuotationPdfViewer = dynamic(
  () => import("./quotation-pdf-viewer").then((m) => m.QuotationPdfViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading PDF preview…
      </div>
    ),
  },
);

interface QuotationPdfClientProps {
  data: QuotationPdfData;
}

export function QuotationPdfClient({ data }: QuotationPdfClientProps) {
  return <QuotationPdfViewer data={data} />;
}
