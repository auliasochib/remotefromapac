import Link from "next/link";
import { Globe, LogOut } from "lucide-react";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";

export async function SiteHeader() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <Globe className="h-5 w-5 text-primary" />
          Remote<span className="text-primary">Hub</span>
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" className="text-muted-foreground hover:text-foreground">
            Jobs
          </Link>
          <Link
            href="/saved"
            className="text-muted-foreground hover:text-foreground"
          >
            Saved
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-3 text-sm">
          {session?.user ? (
            <>
              <span className="hidden text-muted-foreground sm:inline">
                {session.user.email ?? session.user.name}
              </span>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <Button variant="ghost" size="sm" type="submit">
                  <LogOut className="mr-1 h-4 w-4" />
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <Button size="sm" render={<Link href="/signin" />}>
              Sign in
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
