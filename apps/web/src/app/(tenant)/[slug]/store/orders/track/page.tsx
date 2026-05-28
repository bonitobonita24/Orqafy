"use client";

import { useState } from "react";
import { useParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

export default function OrderTrackPage(): React.ReactNode {
  const { slug } = useParams<{ slug: string }>();

  const [orderNumber, setOrderNumber] = useState("");
  const [phoneLast4, setPhoneLast4] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data, isFetching, error, refetch } = trpc.storefront.trackGuestOrder.useQuery(
    { tenantSlug: slug, orderNumber: orderNumber.trim(), phoneLast4: phoneLast4.trim() },
    { enabled: false, retry: false },
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setSubmitted(true);
    void refetch();
  }

  const hasError = submitted && error !== null;

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Track Your Order</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your order number and the last 4 digits of your phone number.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="orderNumber">Order Number</Label>
              <Input
                id="orderNumber"
                value={orderNumber}
                onChange={(e) => {
                  setSubmitted(false);
                  setOrderNumber(e.target.value);
                }}
                placeholder="e.g. ORQ-20240001"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phoneLast4">Last 4 Digits of Phone</Label>
              <Input
                id="phoneLast4"
                value={phoneLast4}
                onChange={(e) => {
                  setSubmitted(false);
                  setPhoneLast4(e.target.value);
                }}
                placeholder="e.g. 1234"
                maxLength={4}
                pattern="\d{4}"
                inputMode="numeric"
                required
              />
            </div>

            {hasError && (
              <p className="text-sm text-destructive">
                Order not found. Please check your details and try again.
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isFetching}>
              {isFetching ? "Looking up…" : "Track Order"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {data !== undefined && !isFetching && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">
              Order <span className="font-bold">{data.orderNumber}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant="secondary">{data.status}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Payment</span>
              <Badge variant="secondary">{data.paymentStatus}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Tracking</span>
              <span className="font-medium">
                {data.trackingNumber !== null && data.trackingNumber !== ""
                  ? data.trackingNumber
                  : "Not yet shipped"}
              </span>
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold">
                {data.currency}{" "}
                {Number(data.totalAmount).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
