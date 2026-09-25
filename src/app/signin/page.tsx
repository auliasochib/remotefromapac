import Link from "next/link";
import { redirect } from "next/navigation";
import { GitBranch, LogIn } from "lucide-react";
import { auth, signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "Sign in" };

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  const githubEnabled = !!(
    process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET
  );
  const googleEnabled = !!(
    process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
  );
  const anyProvider = githubEnabled || googleEnabled;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="hero-glow relative flex flex-1 items-center justify-center overflow-hidden px-4 py-12">
        <div className="bg-grid-dots pointer-events-none absolute inset-0" />
        <Card className="relative w-full max-w-md overflow-hidden rounded-2xl border-border/70 shadow-xl shadow-violet-500/5">
          <div className="h-1.5 w-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-400" />
          <CardHeader className="space-y-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 shadow-lg shadow-violet-500/25">
              <LogIn className="h-6 w-6 text-white" />
            </div>
            <CardTitle className="font-heading text-2xl">
              Sign in to RemoteFromAPAC
            </CardTitle>
            <CardDescription>
              Sign in to save jobs and manage your favorites.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {anyProvider ? (
              <>
                {githubEnabled ? (
                  <form
                    action={async () => {
                      "use server";
                      await signIn("github", { redirectTo: "/" });
                    }}
                  >
                    <Button
                      type="submit"
                      className="w-full rounded-xl shadow-md shadow-violet-500/20"
                      size="lg"
                    >
                      <GitBranch className="mr-2 h-4 w-4" />
                      Continue with GitHub
                    </Button>
                  </form>
                ) : null}
                {googleEnabled ? (
                  <form
                    action={async () => {
                      "use server";
                      await signIn("google", { redirectTo: "/" });
                    }}
                  >
                    <Button
                      type="submit"
                      variant="outline"
                      className="w-full rounded-xl"
                      size="lg"
                    >
                      <LogIn className="mr-2 h-4 w-4" />
                      Continue with Google
                    </Button>
                  </form>
                ) : null}
              </>
            ) : (
              <div className="space-y-3 rounded-xl border border-border/70 bg-muted/40 p-4 text-sm">
                <p className="font-medium">No sign-in provider configured yet.</p>
                <p className="text-muted-foreground">
                  Add OAuth credentials to <code>.env.local</code> to enable
                  sign-in:
                </p>
                <pre className="overflow-x-auto rounded bg-background p-2 text-xs">
{`AUTH_GITHUB_ID=...
AUTH_GITHUB_SECRET=...
# or
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...`}
                </pre>
                <p className="text-muted-foreground">
                  See the README for step-by-step instructions. You can still{" "}
                  <Link href="/" className="text-primary underline">
                    browse jobs
                  </Link>{" "}
                  without an account.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
