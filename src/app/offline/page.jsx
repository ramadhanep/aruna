"use client";

import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

export default function Offline() {
  const t = useTranslations("offline");
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 text-center px-4">
      <div className="p-5 rounded-full bg-muted/60">
        <WifiOff className="size-10 text-muted-foreground" />
      </div>
      <div className="space-y-2 max-w-xs">
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t("description")}
        </p>
      </div>
      <Button
        onClick={() => window.location.reload()}
        className="rounded-full px-6"
      >
        {t("retry")}
      </Button>
    </div>
  );
}
