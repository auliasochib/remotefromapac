import { SiteHeader } from "@/components/site-header";
import { SavedJobsList } from "@/components/saved-jobs-list";

export const metadata = { title: "Saved jobs" };

export default function SavedJobsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-bold">Saved jobs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Jobs you bookmarked while browsing.
        </p>

        <div className="mt-6">
          <SavedJobsList />
        </div>
      </main>
    </div>
  );
}
