"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { Loader2, UserRound } from "lucide-react";

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

export function HeaderAccountMenu({ onOpenSidebar }) {
  const { user, loading } = useAuth();
  const initials = user ? buildInitials(user) : null;
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;

  const handleClick = () => {
    if (loading) return;
    onOpenSidebar?.();
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-9 w-9 rounded-full bg-muted/50"
      aria-label="Open account"
      disabled={loading}
      onClick={handleClick}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : avatarUrl ? (
        <img
          src={avatarUrl}
          alt={initials || "Account"}
          className="h-full w-full rounded-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : initials ? (
        <span className="text-[11px] font-semibold uppercase">{initials}</span>
      ) : (
        <UserRound className="h-4 w-4" />
      )}
    </Button>
  );
}
