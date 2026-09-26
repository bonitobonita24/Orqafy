import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldAlert } from "@/components/ui/icons";
import { getLoginErrorMessage } from "./login-error-messages";

/**
 * ORQ-39 — banner for the `?error=` code a redirect put on /login.
 * Renders nothing without a code; only ever renders mapped copy, never the
 * raw param (see login-error-messages.ts).
 */
export function LoginErrorAlert({ code }: { code: string | string[] | undefined }) {
  const message = getLoginErrorMessage(code);
  if (message === null) return null;

  return (
    <Alert variant="destructive" data-fdl="login-error-alert" className="mb-4">
      <ShieldAlert aria-hidden="true" className="size-4" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
