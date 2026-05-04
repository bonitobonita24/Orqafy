import { Model } from "@nozbe/watermelondb";
import { field, date, readonly } from "@nozbe/watermelondb/decorators";

export class SyncQueueItem extends Model {
  static table = "sync_queue";

  @field("entity_type") entityType!: string;
  @field("entity_id") entityId!: string;
  @field("action") action!: string;
  @field("payload") payload!: string;
  @field("attempts") attempts!: number;
  @field("last_error") lastError!: string | null;
  @readonly @date("created_at") createdAt!: Date;
}
