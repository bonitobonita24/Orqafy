// Non-tRPC: Auth.js v5 requires its own Route Handler.
// Manual auth is not needed here — Auth.js handles the session internally.
import { handlers } from "@/server/auth";

export const { GET, POST } = handlers;
