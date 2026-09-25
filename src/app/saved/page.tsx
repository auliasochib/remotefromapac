import { Bookmark } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SavedJobsList } from "@/components/saved-jobs-list";

export const metadata = { title: "Saved jobs" };

export default function SavedJobsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 shadow-lg shadow-violet-500/20">
            <Bookmark className="h-5 w-5 text-white" />
          </span>
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight">
              Saved jobs
            </h1>
            <p className="text-sm text-muted-foreground">
              Jobs you bookmarked while browsing.
            </p>
          </div>
        </div>

        <div className="mt-8">
          <SavedJobsList />
        </div>
      </main>
    </div>
  );
}
