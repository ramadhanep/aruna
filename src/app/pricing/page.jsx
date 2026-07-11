"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowRight, Sparkles, Check } from "lucide-react";

const plans = [
  {
    name: "Monthly",
    price: "Rp20.000",
    period: "/ month",
    description: "Flexible access when you want to stay in motion.",
    highlight: false,
    features: ["Full product access", "Priority updates", "Cloud sync", "Premium insights"],
  },
  {
    name: "Yearly",
    price: "Rp200.000",
    period: "/ year",
    description: "Best value for long-term daily use.",
    highlight: true,
    features: ["Everything in Monthly", "2 months free", "Best value", "Early access to new tools"],
  },
];

export default function PricingPage() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-10 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          Temporary access preview
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Upgrade to Aruna Pro
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
          Unlock unlimited access to Aruna and keep exploring the product with a polished, premium experience.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={`relative overflow-hidden rounded-3xl border ${plan.highlight ? "border-foreground/20 bg-card shadow-[0_24px_70px_rgba(0,0,0,0.18)]" : "border-border/70 bg-card/70"}`}
          >
            {plan.highlight ? (
              <div className="absolute right-4 top-4 rounded-full border border-foreground/10 bg-foreground/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-foreground/80">
                Recommended
              </div>
            ) : null}
            <CardHeader className="space-y-4 px-6 pt-7">
              <div className="space-y-2">
                <CardTitle className="text-xl font-semibold text-foreground">{plan.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </div>
              <div className="flex items-end gap-1">
                <span className="text-4xl font-semibold tracking-tight text-foreground">{plan.price}</span>
                <span className="pb-1 text-sm text-muted-foreground">{plan.period}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 px-6 pb-7">
              <ul className="space-y-3 text-sm text-muted-foreground">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground/10 text-foreground">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full justify-center rounded-full bg-foreground text-background hover:bg-foreground/90"
                onClick={() => setOpen(true)}
              >
                Choose {plan.name}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 rounded-3xl border border-border/70 bg-card/70 p-6 text-left">
        <h2 className="text-xl font-semibold text-foreground">Early Access</h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          For now, you can continue using Aruna completely free by signing in with Google.
          In the future, Aruna will become a paid subscription service.
          As a thank you for joining early, users who create an account before the paid launch will receive one year of Aruna Pro at no additional cost.
        </p>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Coming Soon</DialogTitle>
            <DialogDescription className="text-sm leading-7 text-muted-foreground">
              Payments are currently under development. This feature will be available soon.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
