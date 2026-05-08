import { createTRPCRouter } from "../trpc";
import { authRouter } from "./auth";
import { tenantRouter } from "./tenant";
import { userRouter } from "./user";
import { clientRouter } from "./client";
import { projectRouter } from "./project";
import { invoiceRouter } from "./invoice";
import { expenseRouter } from "./expense";
import { employeeRouter } from "./employee";
import { payrollRouter } from "./payroll";
import { jobOrderRouter } from "./job-order";
import { inventoryRouter } from "./inventory";
import { reportRouter } from "./report";
import { storageRouter } from "./storage";
import { demoRouter } from "./demo";
import { notificationRouter } from "./notification";
import { platformRouter } from "./platform";
import { registrationRouter } from "./registration";
import { planRouter } from "./plan";
import { bankingRouter } from "./banking";
import { crmRouter } from "./crm";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  tenant: tenantRouter,
  user: userRouter,
  client: clientRouter,
  project: projectRouter,
  invoice: invoiceRouter,
  expense: expenseRouter,
  employee: employeeRouter,
  payroll: payrollRouter,
  jobOrder: jobOrderRouter,
  inventory: inventoryRouter,
  report: reportRouter,
  storage: storageRouter,
  demo: demoRouter,
  notification: notificationRouter,
  platform: platformRouter,
  registration: registrationRouter,
  plan: planRouter,
  banking: bankingRouter,
  crm: crmRouter,
});

export type AppRouter = typeof appRouter;
