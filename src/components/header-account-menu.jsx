"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/components/auth-provider";
import { Loader2, LogOut, LogIn, UserRound, BriefcaseBusiness, Sparkles } from "lucide-react";

function buildInitials(user) {
  const fullName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.user_metadata?.display_name ??
    user?.email;
  if (!fullName) return "U";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function HeaderAccountMenu() {
  const { user, loading, signOut } = useAuth();
  const initials = user ? buildInitials(user) : null;
  const email = user?.email;

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.warn("Failed to sign out", error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-full border border-border/60 bg-background/80"
          aria-label="Account menu"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : user ? (
            <span className="text-[11px] font-semibold uppercase">{initials}</span>
          ) : (
            <UserRound className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={10} className="w-56">
        {user ? (
          <>
            <DropdownMenuLabel className="text-sm font-semibold">
              <span className="block truncate">{initials}</span>
            </DropdownMenuLabel>
            {email ? (
              <p className="px-2 text-xs text-muted-foreground truncate">{email}</p>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="text-xs">
              <Link href="/account" className="flex w-full items-center gap-2">
                <UserRound className="h-3.5 w-3.5" />
                Account
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="text-xs">
              <Link href="/portfolio-tracker" className="flex w-full items-center gap-2">
                <BriefcaseBusiness className="h-3.5 w-3.5" />
                Portfolio tracker
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="text-xs">
              <Link href="/explore" className="flex w-full items-center gap-2">
                <Sparkles className="h-3.5 w-3.5" />
                Explore hub
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-xs text-red-600 focus:text-red-600 focus:bg-red-500/10"
            >
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Sign out
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuLabel className="text-sm font-semibold">
              Guest mode
            </DropdownMenuLabel>
            <p className="px-2 text-xs text-muted-foreground">
              Sign in to sync watchlists & portfolios.
            </p>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="text-xs">
              <Link href="/account" className="flex w-full items-center gap-2">
                <LogIn className="h-3.5 w-3.5" />
                Go to account
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
