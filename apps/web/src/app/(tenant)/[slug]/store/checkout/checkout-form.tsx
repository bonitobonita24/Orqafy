"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Turnstile } from "@marsidev/react-turnstile";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Package } from "@/components/ui/icons";
import { useCart } from "@/lib/cart-store";
import { formatCurrency } from "@/lib/quotation-build";
import { trpc } from "@/lib/trpc";

interface CheckoutFormProps {
  tenantSlug: string;
}

type PaymentMethod = "cod" | "bank_transfer" | "xendit";

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  province: string;
  postalCode: string;
  paymentMethod: PaymentMethod;
  notes: string;
}

const INITIAL_STATE: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  province: "",
  postalCode: "",
  paymentMethod: "cod",
  notes: "",
};

export function CheckoutForm({
  tenantSlug,
}: CheckoutFormProps): React.ReactNode {
  const router = useRouter();
  const { state, subtotal, hydrated, clear } = useCart();
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [turnstileToken, setTurnstileToken] = useState<string>("");

  const placeOrder = trpc.storefront.placeOrderAsCustomer.useMutation({
    onSuccess: (data) => {
      clear();
      if (data.invoiceUrl !== undefined && data.invoiceUrl !== "") {
        toast.success(`Order ${data.orderNumber} placed. Redirecting to payment…`);
        window.location.href = data.invoiceUrl;
        return;
      }
      toast.success(`Order ${data.orderNumber} placed. We will contact you shortly.`);
      router.push(`/${tenantSlug}/store/products`);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  useEffect(() => {
    if (hydrated && state.items.length === 0 && !placeOrder.isPending) {
      router.replace(`/${tenantSlug}/store/products`);
    }
  }, [hydrated, state.items.length, placeOrder.isPending, router, tenantSlug]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (state.items.length === 0) {
      toast.error("Your cart is empty.");
      return;
    }

    const trimmedEmail = form.email.trim();
    const trimmedPhone = form.phone.trim();
    const trimmedNotes = form.notes.trim();

    placeOrder.mutate({
      tenantSlug,
      cfTurnstileToken: turnstileToken,
      items: state.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.price,
      })),
      customer: {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        ...(trimmedEmail.length > 0 && { email: trimmedEmail }),
        ...(trimmedPhone.length > 0 && { phone: trimmedPhone }),
      },
      shippingAddress: {
        line1: form.line1.trim(),
        ...(form.line2.trim().length > 0 && { line2: form.line2.trim() }),
        city: form.city.trim(),
        province: form.province.trim(),
        postalCode: form.postalCode.trim(),
        country: "PH",
      },
      paymentMethod: form.paymentMethod,
      ...(trimmedNotes.length > 0 && { notes: trimmedNotes }),
    });
  }

  const disabled = placeOrder.isPending || !hydrated;

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-6 lg:grid-cols-[2fr_1fr]"
    >
      <div data-fdl="checkout-form" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Contact
            </CardTitle>
          </CardHeader>
          <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First name *</Label>
              <Input
                id="firstName"
                value={form.firstName}
                onChange={(e) => {
                  update("firstName", e.target.value);
                }}
                required
                maxLength={100}
                disabled={disabled}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last name *</Label>
              <Input
                id="lastName"
                value={form.lastName}
                onChange={(e) => {
                  update("lastName", e.target.value);
                }}
                required
                maxLength={100}
                disabled={disabled}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => {
                  update("email", e.target.value);
                }}
                maxLength={200}
                disabled={disabled}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => {
                  update("phone", e.target.value);
                }}
                maxLength={50}
                disabled={disabled}
              />
            </div>
          </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Shipping address
            </CardTitle>
          </CardHeader>
          <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="line1">Address line 1 *</Label>
              <Input
                id="line1"
                value={form.line1}
                onChange={(e) => {
                  update("line1", e.target.value);
                }}
                required
                disabled={disabled}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="line2">Address line 2</Label>
              <Input
                id="line2"
                value={form.line2}
                onChange={(e) => {
                  update("line2", e.target.value);
                }}
                disabled={disabled}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => {
                  update("city", e.target.value);
                }}
                required
                disabled={disabled}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="province">Province *</Label>
              <Input
                id="province"
                value={form.province}
                onChange={(e) => {
                  update("province", e.target.value);
                }}
                required
                disabled={disabled}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="postalCode">Postal code</Label>
              <Input
                id="postalCode"
                value={form.postalCode}
                onChange={(e) => {
                  update("postalCode", e.target.value);
                }}
                disabled={disabled}
              />
            </div>
          </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Payment method
            </CardTitle>
          </CardHeader>
          <CardContent>
          <div className="space-y-2">
            <label className="flex items-start gap-3 rounded-md border border-border p-3 hover:bg-accent">
              <input
                type="radio"
                name="paymentMethod"
                value="cod"
                checked={form.paymentMethod === "cod"}
                onChange={() => {
                  update("paymentMethod", "cod");
                }}
                disabled={disabled}
                className="mt-1"
              />
              <span className="text-sm">
                <span className="font-medium">Cash on delivery</span>
                <span className="block text-muted-foreground">
                  Pay in cash when your order arrives.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-md border border-border p-3 hover:bg-accent">
              <input
                type="radio"
                name="paymentMethod"
                value="bank_transfer"
                checked={form.paymentMethod === "bank_transfer"}
                onChange={() => {
                  update("paymentMethod", "bank_transfer");
                }}
                disabled={disabled}
                className="mt-1"
              />
              <span className="text-sm">
                <span className="font-medium">Bank transfer</span>
                <span className="block text-muted-foreground">
                  We will send you bank details after you place the order.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-md border border-border p-3 hover:bg-accent">
              <input
                type="radio"
                name="paymentMethod"
                value="xendit"
                checked={form.paymentMethod === "xendit"}
                onChange={() => {
                  update("paymentMethod", "xendit");
                }}
                disabled={disabled}
                className="mt-1"
              />
              <span className="text-sm">
                <span className="font-medium">Pay online via Xendit</span>
                <span className="block text-muted-foreground">
                  Pay instantly by card, e-wallet, or bank. You will be
                  redirected to a secure payment page.
                </span>
              </span>
            </label>
          </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Order notes
            </CardTitle>
          </CardHeader>
          <CardContent>
          <Textarea
            value={form.notes}
            onChange={(e) => {
              update("notes", e.target.value);
            }}
            placeholder="Anything we should know about delivery (optional)"
            maxLength={2000}
            rows={3}
            disabled={disabled}
          />
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-4">
        <Card data-fdl="checkout-summary" className="sticky top-20">
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Order summary
            </CardTitle>
          </CardHeader>
          <CardContent>
          {!hydrated ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : state.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Your cart is empty.</p>
          ) : (
            <>
              <ul className="space-y-4">
                {state.items.map((item) => (
                  <li
                    key={item.productId}
                    className="flex items-start gap-3 text-sm"
                  >
                    <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                      {item.imageUrl !== null && item.imageUrl !== undefined && item.imageUrl !== "" ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Package className="size-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.quantity} × {formatCurrency(item.price)}
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold">
                      {formatCurrency(item.price * item.quantity)}
                    </p>
                  </li>
                ))}
              </ul>
              <Separator className="my-4" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold">{formatCurrency(subtotal)}</span>
              </div>
            </>
          )}
          <div className="mt-5 flex justify-center">
            <Turnstile
              siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
              onSuccess={setTurnstileToken}
              onExpire={() => setTurnstileToken("")}
              onError={() => setTurnstileToken("")}
              options={{ theme: "auto" }}
            />
          </div>
          <button
            type="submit"
            disabled={disabled || state.items.length === 0 || turnstileToken === ""}
            className="mt-5 w-full rounded-md border border-primary/40 bg-primary/10 px-4 py-3 text-sm font-medium text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {placeOrder.isPending ? "Placing order…" : "Place order"}
          </button>
          </CardContent>
        </Card>
      </aside>
    </form>
  );
}
