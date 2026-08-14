"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SlidersHorizontal } from "@/components/ui/icons";

interface StoreFilterSheetProps {
  children: ReactNode;
}

/**
 * Mobile filter drawer — wraps the server-rendered filter form (passed as
 * `children`) in a shadcn Sheet, matching starter/shopix shop/index.tsx's
 * mobile filters affordance. The form itself needs no client state: it's a
 * real GET <form>, so it submits + navigates correctly from inside the
 * Sheet without this wrapper knowing anything about its contents.
 */
export function StoreFilterSheet({ children }: StoreFilterSheetProps): React.ReactNode {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 lg:hidden">
          <SlidersHorizontal className="size-4" />
          Filters
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 gap-0 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>
        <div className="p-4 pt-0">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
