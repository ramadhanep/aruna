import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border text-2xs font-semibold transition-colors px-2 py-0.5",
  {
    variants: {
      variant: {
        default: "border-border bg-muted text-muted-foreground",
        success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-500",
        warning: "border-amber-500/20 bg-amber-500/10 text-amber-500",
        danger: "border-red-500/20 bg-red-500/10 text-red-500",
        neutral: "border-amber-500/20 bg-amber-500/10 text-amber-500",
        info: "border-blue-500/20 bg-blue-500/10 text-blue-500",
        new: "border-emerald-500/20 bg-emerald-500/10 text-emerald-500",
        accumulation: "border-teal-500/20 bg-teal-500/10 text-teal-500",
        highrisk: "border-orange-500/20 bg-orange-500/10 text-orange-500",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({ className, variant, ...props }) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants }
