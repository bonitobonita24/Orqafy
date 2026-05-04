import { Model } from "@nozbe/watermelondb";
import { field, date, readonly } from "@nozbe/watermelondb/decorators";

export class Task extends Model {
  static table = "tasks";

  @field("tenant_id") tenantId!: string;
  @field("server_id") serverId!: string;
  @field("title") title!: string;
  @field("description") description!: string | null;
  @field("status") status!: string;
  @field("priority") priority!: string;
  @field("assigned_to") assignedTo!: string | null;
  @date("due_date") dueDate!: Date | null;
  @field("project_id") projectId!: string | null;
  @field("synced") synced!: boolean;
  @readonly @date("created_at") createdAt!: Date;
  @readonly @date("updated_at") updatedAt!: Date;
}
