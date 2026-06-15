import { redirect } from "next/navigation";
import { auth } from "@/server/auth";

export default async function PlatformAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (
    session === null ||
    !session.user.roles.includes("Platform Owner")
  ) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded border border-primary bg-card signal-glow">
            <span className="text-sm font-bold text-primary">O</span>
          </div>
          <span className="font-semibold tracking-tight">Orqafy</span>
          <span className="rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-xs text-primary">
            Platform Admin
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {session.user.email}
        </span>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
