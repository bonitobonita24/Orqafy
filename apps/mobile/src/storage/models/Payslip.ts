import { Model } from "@nozbe/watermelondb";
import { field, date, readonly } from "@nozbe/watermelondb/decorators";

export class Payslip extends Model {
  static table = "payslips";

  @field("tenant_id") tenantId!: string;
  @field("user_id") userId!: string;
  @field("server_id") serverId!: string;
  @date("period_start") periodStart!: Date;
  @date("period_end") periodEnd!: Date;
  @field("gross_pay") grossPay!: number;
  @field("net_pay") netPay!: number;
  @field("deductions") deductions!: string;
  @readonly @date("created_at") createdAt!: Date;
  @readonly @date("updated_at") updatedAt!: Date;
}
