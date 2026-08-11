import Link from "next/link";
import Image from "next/image";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 text-center px-4">
      <div className="relative">
        <div className="text-[120px] lg:text-[160px] font-black leading-none tracking-tighter text-foreground/20 select-none">
          404
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="p-4 rounded-2xl bg-primary/10">
            <Image src="/aruna.png" alt="aruna" width={32} height={32} className="size-8" />
          </div>
        </div>
      </div>
      
      <div className="space-y-2 max-w-sm">
        <h1 className="text-xl font-bold">Page not found</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Looks like this page took a different route. Let&apos;s get you back to exploring the markets.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/"
          className={cn(buttonVariants({ size: "lg" }), "rounded-full")}
        >
          Back to Explore
        </Link>
        <Link
          href="/chart"
          className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "rounded-full")}
        >
          Open Charts
        </Link>
      </div>
    </div>
  );
}
