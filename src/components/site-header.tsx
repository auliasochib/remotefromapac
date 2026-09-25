import Link from "next/link";
import { Globe2 } from "lucide-react";
import { auth, signOut } from "@/auth";
import { HeaderNav } from "@/components/header-nav";

export async function SiteHeader() {
  const session = await auth();
  const userLabel = session?.user?.email ?? session?.user?.name ?? null;

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-2 px-4 sm:gap-6 sm:px-6">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2.5 font-heading text-base font-bold tracking-tight sm:text-lg"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 shadow-lg shadow-violet-500/25 transition-transform group-hover:scale-105">
            <Globe2 className="h-5 w-5 text-white" />
          </span>
          <span>
            Remote{" "}
            <span className="bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent dark:from-violet-400 dark:to-fuchsia-400">
              from APAC
            </span>
          </span>
        </Link>

        <HeaderNav userLabel={userLabel} onSignOut={handleSignOut} />
      </div>
    </header>
  );
}
