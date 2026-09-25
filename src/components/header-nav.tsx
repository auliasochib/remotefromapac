"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_ITEMS = [
  { href: "/", label: "Jobs" },
  { href: "/saved", label: "Saved" },
];

export function HeaderNav({
  userLabel,
  onSignOut,
}: {
  userLabel: string | null;
  onSignOut?: () => Promise<void>;
}) {
  const pathname = usePathname();

  return (
    <>
      <nav className="flex items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors sm:px-3 ${
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <ThemeToggle />
        {userLabel && onSignOut ? (
          <>
            <span className="hidden max-w-[180px] truncate text-sm text-muted-foreground lg:inline">
              {userLabel}
            </span>
            <form action={onSignOut}>
              <Button variant="outline" size="sm" type="submit" className="rounded-lg">
                <LogOut className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </form>
          </>
        ) : (
          <Button
            size="sm"
            className="rounded-lg shadow-sm shadow-violet-500/20"
            render={<Link href="/signin" />}
          >
            Sign in
          </Button>
        )}
      </div>
    </>
  );
}
