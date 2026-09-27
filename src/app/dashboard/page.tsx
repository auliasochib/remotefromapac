import { Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { DashboardClient } from "@/components/dashboard-client";

export const metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 shadow-lg shadow-violet-500/20">
            <Sparkles className="h-5 w-5 text-white" />
          </span>
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight">
              AI Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              Upload your resume once — get match scores and a recruiter-grade
              resume review.
            </p>
          </div>
        </div>

        <div className="mt-8">
          <DashboardClient />
        </div>
      </main>
    </div>
  );
}
