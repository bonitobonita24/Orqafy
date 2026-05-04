import { Model } from "@nozbe/watermelondb";
import { field, date, readonly } from "@nozbe/watermelondb/decorators";

export class DtrEntry extends Model {
  static table = "dtr_entries";

  @field("tenant_id") tenantId!: string;
  @field("user_id") userId!: string;
  @date("clock_in_at") clockInAt!: Date;
  @date("clock_out_at") clockOutAt!: Date | null;
  @field("clock_in_lat") clockInLat!: number;
  @field("clock_in_lng") clockInLng!: number;
  @field("clock_out_lat") clockOutLat!: number | null;
  @field("clock_out_lng") clockOutLng!: number | null;
  @field("clock_in_accuracy") clockInAccuracy!: number | null;
  @field("clock_out_accuracy") clockOutAccuracy!: number | null;
  @field("status") status!: string;
  @field("synced") synced!: boolean;
  @field("server_id") serverId!: string | null;
  @readonly @date("created_at") createdAt!: Date;
  @readonly @date("updated_at") updatedAt!: Date;
}
