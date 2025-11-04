"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function DocsPage() {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Aruna Docs</CardTitle>
          <CardDescription>Learn what you can do in this app.</CardDescription>
        </CardHeader>
        <div className="grid gap-3 text-sm">
          <div className="rounded-lg border p-3">
            <div className="font-medium mb-1">Portfolio Tracker</div>
            <p className="text-muted-foreground">Record digital assets and cash, view net worth, and analyze distribution.</p>
            <div className="mt-2 text-xs">
              <Link href="/portfolio-tracker" className="text-primary underline">Open Portfolio</Link>
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="font-medium mb-1">Seasonal Explorer</div>
            <p className="text-muted-foreground">Explore election-cycle patterns and compare performance over cycles.</p>
            <div className="mt-2 text-xs">
              <Link href="/election-cycle" className="text-primary underline">Open Explorer</Link>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

