"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full-Time" },
  { value: "part_time", label: "Part-Time" },
  { value: "contract", label: "Contract" },
  { value: "probationary", label: "Probationary" },
] as const;

type EmploymentType = "full_time" | "part_time" | "contract" | "probationary";

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string;
}

interface DepartmentOption {
  id: string;
  name: string;
}

interface EmployeeFormProps {
  slug: string;
  mode: "create" | "edit";
  employeeId?: string;
  users: UserOption[];
  departments: DepartmentOption[];
  initial?: {
    userId?: string | undefined;
    departmentId?: string | undefined;
    position?: string | undefined;
    employmentType?: EmploymentType | undefined;
    dateHired?: string | undefined; // ISO date string YYYY-MM-DD
    baseSalary?: string | undefined;
    dailyRate?: string | undefined;
    hourlyRate?: string | undefined;
    sssNumber?: string | undefined;
    philhealthNumber?: string | undefined;
    pagibigNumber?: string | undefined;
    tinNumber?: string | undefined;
    bankName?: string | undefined;
    bankAccountNumber?: string | undefined;
    emergencyContactName?: string | undefined;
    emergencyContactPhone?: string | undefined;
  };
}

function userLabel(u: UserOption): string {
  return (u.displayName ?? `${u.firstName} ${u.lastName}`.trim()) + ` (${u.email})`;
}

export function EmployeeForm({
  slug,
  mode,
  employeeId,
  users,
  departments,
  initial = {},
}: EmployeeFormProps) {
  const router = useRouter();

  // Core fields
  const [userId, setUserId] = useState(initial.userId ?? "");
  const [departmentId, setDepartmentId] = useState(initial.departmentId ?? "");
  const [position, setPosition] = useState(initial.position ?? "");
  const [employmentType, setEmploymentType] = useState<EmploymentType>(
    initial.employmentType ?? "full_time",
  );
  const [dateHired, setDateHired] = useState(initial.dateHired ?? "");

  // Compensation
  const [baseSalary, setBaseSalary] = useState(initial.baseSalary ?? "");
  const [dailyRate, setDailyRate] = useState(initial.dailyRate ?? "");
  const [hourlyRate, setHourlyRate] = useState(initial.hourlyRate ?? "");

  // Government IDs
  const [sssNumber, setSssNumber] = useState(initial.sssNumber ?? "");
  const [philhealthNumber, setPhilhealthNumber] = useState(initial.philhealthNumber ?? "");
  const [pagibigNumber, setPagibigNumber] = useState(initial.pagibigNumber ?? "");
  const [tinNumber, setTinNumber] = useState(initial.tinNumber ?? "");

  // Bank & Emergency
  const [bankName, setBankName] = useState(initial.bankName ?? "");
  const [bankAccountNumber, setBankAccountNumber] = useState(initial.bankAccountNumber ?? "");
  const [emergencyContactName, setEmergencyContactName] = useState(initial.emergencyContactName ?? "");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(initial.emergencyContactPhone ?? "");

  const [error, setError] = useState<string | null>(null);

  const createMutation = trpc.employee.create.useMutation({
    onSuccess: (data) => {
      toast.success("Employee created.");
      router.push(`/${slug}/employees/${data.id}`);
    },
    onError: (err) => {
      setError(err.message);
      toast.error(err.message);
    },
  });

  const updateMutation = trpc.employee.update.useMutation({
    onSuccess: () => {
      toast.success("Employee updated.");
      router.push(`/${slug}/employees/${employeeId}`);
      router.refresh();
    },
    onError: (err) => {
      setError(err.message);
      toast.error(err.message);
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function parseOptionalPositive(val: string): number | undefined {
    if (val.trim() === "") return undefined;
    const n = parseFloat(val);
    if (Number.isNaN(n) || n <= 0) return undefined;
    return n;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "create" && userId.trim() === "") {
      setError("Please select a user.");
      return;
    }
    if (dateHired.trim() === "") {
      setError("Date hired is required.");
      return;
    }

    const dateHiredDate = new Date(`${dateHired}T00:00:00`);

    const shared = {
      departmentId: departmentId.trim() !== "" ? departmentId : undefined,
      position: position.trim() !== "" ? position.trim() : undefined,
      employmentType,
      dateHired: dateHiredDate,
      baseSalary: parseOptionalPositive(baseSalary),
      dailyRate: parseOptionalPositive(dailyRate),
      hourlyRate: parseOptionalPositive(hourlyRate),
      sssNumber: sssNumber.trim() !== "" ? sssNumber.trim() : undefined,
      philhealthNumber: philhealthNumber.trim() !== "" ? philhealthNumber.trim() : undefined,
      pagibigNumber: pagibigNumber.trim() !== "" ? pagibigNumber.trim() : undefined,
      tinNumber: tinNumber.trim() !== "" ? tinNumber.trim() : undefined,
      bankName: bankName.trim() !== "" ? bankName.trim() : undefined,
      bankAccountNumber: bankAccountNumber.trim() !== "" ? bankAccountNumber.trim() : undefined,
      emergencyContactName: emergencyContactName.trim() !== "" ? emergencyContactName.trim() : undefined,
      emergencyContactPhone: emergencyContactPhone.trim() !== "" ? emergencyContactPhone.trim() : undefined,
    };

    if (mode === "create") {
      createMutation.mutate({ ...shared, userId });
    } else {
      if (employeeId === undefined || employeeId === "") return;
      updateMutation.mutate({ ...shared, id: employeeId });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl">
      {/* Employment */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Employment
        </h2>

        {mode === "create" ? (
          <div className="space-y-1">
            <Label htmlFor="userId" className="text-xs font-medium text-muted-foreground">
              User <span className="text-red-400">*</span>
            </Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger id="userId">
                <SelectValue placeholder="Select a user…" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {userLabel(u)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">User</Label>
            <p className="text-sm text-muted-foreground">
              {users.find((u) => u.id === initial.userId)
                ? userLabel(users.find((u) => u.id === initial.userId)!)
                : initial.userId ?? "—"}
              <span className="ml-2 text-xs text-muted-foreground/60">(read-only)</span>
            </p>
          </div>
        )}

        <div className="space-y-1">
          <Label htmlFor="department" className="text-xs font-medium text-muted-foreground">
            Department
          </Label>
          <Select
            value={departmentId === "" ? "__none__" : departmentId}
            onValueChange={(v) => setDepartmentId(v === "__none__" ? "" : v)}
          >
            <SelectTrigger id="department">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              {/* Radix forbids an empty-string SelectItem value; use a sentinel
                  and map it back to "" (= no department) in onValueChange. */}
              <SelectItem value="__none__">None</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="position" className="text-xs font-medium text-muted-foreground">
            Position
          </Label>
          <Input
            id="position"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            maxLength={200}
            placeholder="e.g. Software Engineer"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="employmentType" className="text-xs font-medium text-muted-foreground">
            Employment Type
          </Label>
          <Select
            value={employmentType}
            onValueChange={(v) => setEmploymentType(v as EmploymentType)}
          >
            <SelectTrigger id="employmentType">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EMPLOYMENT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="dateHired" className="text-xs font-medium text-muted-foreground">
            Date Hired <span className="text-red-400">*</span>
          </Label>
          <Input
            id="dateHired"
            type="date"
            value={dateHired}
            onChange={(e) => setDateHired(e.target.value)}
          />
        </div>
      </section>

      <Separator />

      {/* Compensation */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Compensation
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="baseSalary" className="text-xs font-medium text-muted-foreground">
              Base Salary
            </Label>
            <Input
              id="baseSalary"
              type="number"
              step="0.01"
              min="0.01"
              value={baseSalary}
              onChange={(e) => setBaseSalary(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dailyRate" className="text-xs font-medium text-muted-foreground">
              Daily Rate
            </Label>
            <Input
              id="dailyRate"
              type="number"
              step="0.01"
              min="0.01"
              value={dailyRate}
              onChange={(e) => setDailyRate(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="hourlyRate" className="text-xs font-medium text-muted-foreground">
              Hourly Rate
            </Label>
            <Input
              id="hourlyRate"
              type="number"
              step="0.01"
              min="0.01"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>
      </section>

      <Separator />

      {/* Government IDs */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Government IDs
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="sssNumber" className="text-xs font-medium text-muted-foreground">
              SSS Number
            </Label>
            <Input
              id="sssNumber"
              value={sssNumber}
              onChange={(e) => setSssNumber(e.target.value)}
              maxLength={50}
              placeholder="XX-XXXXXXX-X"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="philhealthNumber" className="text-xs font-medium text-muted-foreground">
              PhilHealth Number
            </Label>
            <Input
              id="philhealthNumber"
              value={philhealthNumber}
              onChange={(e) => setPhilhealthNumber(e.target.value)}
              maxLength={50}
              placeholder="XX-XXXXXXXXX-X"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pagibigNumber" className="text-xs font-medium text-muted-foreground">
              Pag-IBIG Number
            </Label>
            <Input
              id="pagibigNumber"
              value={pagibigNumber}
              onChange={(e) => setPagibigNumber(e.target.value)}
              maxLength={50}
              placeholder="XXXX-XXXX-XXXX"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tinNumber" className="text-xs font-medium text-muted-foreground">
              TIN
            </Label>
            <Input
              id="tinNumber"
              value={tinNumber}
              onChange={(e) => setTinNumber(e.target.value)}
              maxLength={50}
              placeholder="XXX-XXX-XXX-XXX"
            />
          </div>
        </div>
      </section>

      <Separator />

      {/* Bank & Emergency */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Bank & Emergency Contact
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="bankName" className="text-xs font-medium text-muted-foreground">
              Bank Name
            </Label>
            <Input
              id="bankName"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              maxLength={100}
              placeholder="e.g. BDO"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bankAccountNumber" className="text-xs font-medium text-muted-foreground">
              Account Number
            </Label>
            <Input
              id="bankAccountNumber"
              value={bankAccountNumber}
              onChange={(e) => setBankAccountNumber(e.target.value)}
              maxLength={50}
              placeholder="XXXX-XXXX-XXXX"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="emergencyContactName" className="text-xs font-medium text-muted-foreground">
              Emergency Contact Name
            </Label>
            <Input
              id="emergencyContactName"
              value={emergencyContactName}
              onChange={(e) => setEmergencyContactName(e.target.value)}
              maxLength={200}
              placeholder="Full name"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="emergencyContactPhone" className="text-xs font-medium text-muted-foreground">
              Emergency Contact Phone
            </Label>
            <Input
              id="emergencyContactPhone"
              value={emergencyContactPhone}
              onChange={(e) => setEmergencyContactPhone(e.target.value)}
              maxLength={30}
              placeholder="+63 9XX XXX XXXX"
            />
          </div>
        </div>
      </section>

      {error !== null && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={isPending}
          className="bg-[#00d992] text-black hover:bg-[#00d992]/90"
        >
          {isPending
            ? mode === "create"
              ? "Creating…"
              : "Saving…"
            : mode === "create"
              ? "Create Employee"
              : "Save Changes"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
