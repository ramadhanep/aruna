"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const LOCALES = [
  { code: "en", flag: "🇺🇸" },
  { code: "id", flag: "🇮🇩" },
];

export function LanguageToggle() {
  const t = useTranslations("modeToggle");
  const router = useRouter();
  const [locale, setLocale] = React.useState(() => {
    if (typeof document === "undefined") return "en";
    const match = document.cookie.match(/(?:^|;\s*)locale=([^;]+)/);
    return match ? match[1] : "en";
  });

  const handleToggle = () => {
    const next = locale === "id" ? "en" : "id";
    setLocale(next);
    document.cookie = `locale=${next};path=/;max-age=31536000;SameSite=Lax`;
    router.refresh();
  };

  const current = LOCALES.find((l) => l.code === (locale === "id" ? "id" : "en")) ?? LOCALES[0];

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9 text-lg"
      aria-label={t("toggleLanguage")}
      onClick={handleToggle}
    >
      {current.flag}
    </Button>
  );
}