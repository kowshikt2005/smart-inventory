"use client";

import { memo, Fragment, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Header = memo(function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    await signOut({ callbackUrl: `${window.location.origin}/login` });
  };

  const getUserInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleLabel = (roleName?: string) => {
    if (!roleName) return "User";
    return roleName
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  };

  // Build breadcrumbs from pathname
  const segments = pathname.split("/").filter(Boolean);
  const formatSegment = (seg: string) =>
    seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");

  return (
    <header className="fixed left-[230px] right-0 top-0 z-30 border-b border-border/30 bg-white/80 backdrop-blur-md shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]">
      <div className="flex h-16 items-center justify-between px-6">
        {/* Left Section - Breadcrumbs */}
        <div className="flex items-center gap-1.5 text-sm min-w-0">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            Dashboard
          </Link>
          {segments.map((segment, i) => {
            const href = "/" + segments.slice(0, i + 1).join("/");
            const isLast = i === segments.length - 1;
            // Skip UUID-like segments in display
            const isUuid = segment.length > 20;
            // Parent-only routes that have no dedicated page
            const nonClickableRoutes = ["/masters", "/ledger", "/bank-cash", "/sales", "/purchases"];
            const isNonClickable = nonClickableRoutes.includes(href);

            return (
              <Fragment key={i}>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                {isLast || isNonClickable ? (
                  <span className={cn(
                    "truncate",
                    isLast ? "font-medium text-foreground" : "text-muted-foreground"
                  )}>
                    {isUuid ? "Details" : formatSegment(segment)}
                  </span>
                ) : (
                  <Link
                    href={href}
                    className={cn(
                      "text-muted-foreground hover:text-foreground transition-colors truncate"
                    )}
                  >
                    {isUuid ? "Details" : formatSegment(segment)}
                  </Link>
                )}
              </Fragment>
            );
          })}
        </div>

        {/* Right Section - Search + User Menu */}
        <div className="flex items-center gap-4 shrink-0">
          {/* Global Search */}
          <div className="w-72">
            <GlobalSearch placeholder="Search... (Ctrl+K)" />
          </div>

          {session?.user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={session.user.image || ""} alt={session.user.name || ""} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                      {getUserInitials(session.user.name || "U")}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {session.user.name}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {session.user.email}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {getRoleLabel(session.user.roleName || session.user.role)}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} disabled={isSigningOut}>
                  {isSigningOut ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut className="mr-2 h-4 w-4" />
                  )}
                  <span>{isSigningOut ? "Signing out..." : "Log out"}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="outline" size="sm">
              Sign In
            </Button>
          )}
        </div>
      </div>
    </header>
  );
});
