import { z } from "zod";

/**
 * RBAC permission actions — the strict CRUD split required by the
 * tenant-rbac-standard (§4): `create` is create-only, `update` is
 * edit-only, `delete` is its own column. A custom role can be as narrow
 * as view-only on a single feature.
 */
export const ACTIONS = ["view", "create", "update", "delete"] as const;

export type PermissionAction = (typeof ACTIONS)[number];

export const actionSchema = z.enum(ACTIONS);
