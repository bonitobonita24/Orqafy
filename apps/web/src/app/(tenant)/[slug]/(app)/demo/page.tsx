import type { Metadata } from "next";

export const metadata: Metadata = { title: "Demo Mode" };

export default function DemoPage() {
  return (
    <div className="space-y-6">
      <div className="inline-flex items-center gap-2 rounded-full border border-[#00d992]/30 bg-[#00d992]/10 px-3 py-1">
        <span className="h-1.5 w-1.5 rounded-full bg-[#00d992]" />
        <span className="text-xs font-medium text-[#00d992]">Demo Mode</span>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome to Orqafy</h1>
      <p className="text-sm text-muted-foreground">
        This is the interactive demo. All data is read-only and resets daily.
      </p>
    </div>
  );
}
