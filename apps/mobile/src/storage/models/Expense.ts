import { Model } from "@nozbe/watermelondb";
import { field, date, readonly } from "@nozbe/watermelondb/decorators";

export class Expense extends Model {
  static table = "expenses";

  @field("tenant_id") tenantId!: string;
  @field("user_id") userId!: string;
  @field("amount") amount!: number;
  @field("currency") currency!: string;
  @field("category") category!: string;
  @field("description") description!: string | null;
  @field("receipt_uri") receiptUri!: string | null;
  @field("status") status!: string;
  @field("synced") synced!: boolean;
  @field("server_id") serverId!: string | null;
  @readonly @date("created_at") createdAt!: Date;
  @readonly @date("updated_at") updatedAt!: Date;
}
