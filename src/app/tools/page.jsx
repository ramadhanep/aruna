import Link from "next/link";
import { ChevronRight, Wrench } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { TOOLS_ITEMS } from "@/lib/tools-menu";

export const metadata = {
  title: "Tools | aruna",
};

export default function ToolsPage() {
  return (
    <div className="mx-auto max-w-4xl pb-24">
      <section className="mb-5">
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Explore all tools</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Access the same tools menu from desktop in a mobile-friendly list.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TOOLS_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.url} href={item.url} className="group">
              <Card className="h-full border-border/40 transition-colors hover:border-border/70 hover:bg-muted/20">
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg border border-border/40 bg-background p-2">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
