"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Globe2,
  Loader2,
  MapPin,
  RefreshCw,
  Rows3,
  Search,
  SlidersHorizontal,
  Table2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JobCard } from "@/components/job-card";
import Link from "next/link";
import { timeAgo } from "@/lib/format";
import { CAREERS_SOURCE } from "@/lib/types";
import type { JobListResponse, JobSort } from "@/lib/types";
import type { JobStats } from "@/lib/stats";

/* -------------------------------------------------------------------------- */
/* Filter option definitions                                                   */
/* -------------------------------------------------------------------------- */

const TYPE_OPTIONS = [
  { value: "all", label: "Any type" },
  { value: "full-time", label: "Full-time" },
  { value: "part-time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "freelance", label: "Freelance" },
  { value: "internship", label: "Internship" },
  { value: "other", label: "Other" },
];

const LEVEL_OPTIONS = [
  { value: "all", label: "Any level" },
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid-level" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead / Manager" },
];

const CATEGORY_OPTIONS = [
  { value: "all", label: "All categories" },
  { value: "Engineering", label: "Engineering" },
  { value: "Data & AI", label: "Data & AI" },
  { value: "Design", label: "Design" },
  { value: "Marketing", label: "Marketing" },
  { value: "Product", label: "Product" },
  { value: "Sales", label: "Sales" },
  { value: "Customer Support", label: "Customer Support" },
  { value: "Human Resources", label: "Human Resources" },
  { value: "Finance", label: "Finance" },
  { value: "Writing", label: "Writing" },
  { value: "Other", label: "Other" },
];

// Locations: APAC countries plus worldwide-remote postings.
const REGION_OPTIONS = [
  { value: "all", label: "All locations" },
  { value: "Worldwide", label: "Worldwide" },
  { value: "Asia", label: "Asia" },
  { value: "Oceania", label: "Oceania" },
  { value: "Other", label: "Other" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "company", label: "Company A–Z" },
];

const SOURCE_LABELS: Record<string, string> = {
  [CAREERS_SOURCE]: "Company careers",
};

const SOURCE_ORDER = [CAREERS_SOURCE];

interface Filters {
  type: string;
  level: string;
  category: string;
  region: string;
  source: string;
}

const DEFAULT_FILTERS: Filters = {
  type: "all",
  level: "all",
  category: "all",
  region: "all",
  source: "all",
};

function itemsFrom(options: { value: string; label: string }[]) {
  return Object.fromEntries(options.map((o) => [o.value, o.label]));
}

/* -------------------------------------------------------------------------- */

export function JobBoard({
  stats,
  initialData,
}: {
  stats: JobStats;
  /** First page, rendered on the server so the board paints with content. */
  initialData?: JobListResponse;
}) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<JobSort>("newest");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<JobListResponse | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [view, setView] = useState<"list" | "table">("list");
  const abortRef = useRef<AbortController | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  /** The server already fetched the default view — don't fetch it again. */
  const skipFirstFetch = useRef(Boolean(initialData));

  // Debounce the search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch whenever search, filters, sort or page change
  useEffect(() => {
    if (skipFirstFetch.current) {
      skipFirstFetch.current = false;
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const isLoadMore = page > 1;

    (async () => {
      if (isLoadMore) setLoadingMore(true);
      else {
        setLoading(true);
        setError(null);
      }

      try {
        const params = new URLSearchParams({ page: String(page), sort });
        if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
        if (filters.type !== "all") params.set("type", filters.type);
        if (filters.level !== "all") params.set("level", filters.level);
        if (filters.category !== "all") params.set("category", filters.category);
        if (filters.region !== "all") params.set("region", filters.region);
        if (filters.source !== "all") params.set("source", filters.source);

        const res = await fetch(`/api/jobs?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);

        const json: JobListResponse = await res.json();
        setData((prev) =>
          prev && isLoadMore ? { ...json, jobs: [...prev.jobs, ...json.jobs] } : json
        );
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError("Could not load jobs. Check your connection and try again.");
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    })();

    return () => controller.abort();
  }, [debouncedSearch, filters, sort, page]);

  // Infinite scroll: when the sentinel below the list becomes visible, load
  // the next page automatically.
  const hasMore = data?.hasMore ?? false;
  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasMore || loading || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setPage((p) => p + 1);
        }
      },
      { rootMargin: "400px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore]);

  const updateFilter = useCallback((key: keyof Filters, value: string) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetAll = useCallback(() => {
    setSearch("");
    setFilters(DEFAULT_FILTERS);
    setSort("newest");
    setPage(1);
  }, []);

  const activeChips = useMemo(() => {
    const groups: { key: keyof Filters; options: { value: string; label: string }[] }[] = [
      { key: "type", options: TYPE_OPTIONS },
      { key: "level", options: LEVEL_OPTIONS },
      { key: "category", options: CATEGORY_OPTIONS },
      { key: "region", options: REGION_OPTIONS },
      { key: "source", options: sourceOptions(stats) },
    ];
    return groups
      .filter(({ key }) => filters[key] !== "all")
      .map(({ key, options }) => ({
        key,
        label: options.find((o) => o.value === filters[key])?.label ?? "",
      }));
  }, [filters, stats]);

  const hasFilters = Boolean(debouncedSearch.trim()) || activeChips.length > 0;

  const filterPanel = (
    <div className="space-y-5">
      <FilterField
        label="Location"
        value={filters.region}
        options={REGION_OPTIONS}
        onChange={(v) => updateFilter("region", v)}
      />
      <FilterField
        label="Job type"
        value={filters.type}
        options={TYPE_OPTIONS}
        onChange={(v) => updateFilter("type", v)}
      />
      <FilterField
        label="Experience"
        value={filters.level}
        options={LEVEL_OPTIONS}
        onChange={(v) => updateFilter("level", v)}
      />
      <FilterField
        label="Category"
        value={filters.category}
        options={CATEGORY_OPTIONS}
        onChange={(v) => updateFilter("category", v)}
      />
      <FilterField
        label="Source"
        value={filters.source}
        options={sourceOptions(stats)}
        onChange={(v) => updateFilter("source", v)}
      />

      <Button
        variant="outline"
        size="sm"
        className="w-full rounded-lg"
        onClick={resetAll}
        disabled={!hasFilters}
      >
        Reset filters
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col">
      {/* Hero with integrated search */}
      <section className="hero-glow relative overflow-hidden border-b border-border/60">
        <div className="bg-grid-dots pointer-events-none absolute inset-0" />
        <div className="relative mx-auto w-full max-w-7xl px-4 pb-8 pt-12 sm:px-6 sm:pb-10 sm:pt-16">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
              <Globe2 className="h-3.5 w-3.5 text-primary" />
              Remote roles you can take from Asia–Pacific
            </span>
            <h1 className="mt-5 font-heading text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl md:text-5xl">
              Find your next <span className="text-gradient">remote job</span>
            </h1>
          </div>

          {/* Search */}
          <div className="relative mx-auto mt-7 max-w-2xl">
            <div className="group relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search role, company or skill…"
                className="h-13 rounded-2xl border-border/70 bg-background pl-11 pr-11 text-base shadow-lg shadow-violet-500/5 transition-shadow focus-visible:ring-2 focus-visible:ring-primary/30 sm:h-14"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setPage(1);
                  }}
                  aria-label="Clear search"
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>

          {/* Live stats */}
          {stats.available ? (
            <div className="mx-auto mt-6 flex max-w-2xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <Stat
                icon={<Building2 className="h-4 w-4 text-primary" />}
                value={stats.total}
                label="remote roles"
              />
              <Stat
                icon={<MapPin className="h-4 w-4 text-primary" />}
                value={stats.companies}
                label="companies hiring"
              />
              <Stat
                icon={<Globe2 className="h-4 w-4 text-primary" />}
                value={stats.sources.filter((s) => s.count > 0).length}
                label="sources"
              />
              <Stat
                icon={<RefreshCw className="h-4 w-4 text-primary" />}
                value={stats.lastSyncedAt ? timeAgo(stats.lastSyncedAt) : "—"}
                label="updated"
              />
            </div>
          ) : null}
        </div>
      </section>

      {/* Board */}
      <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[248px_minmax(0,1fr)]">
          {/* Sidebar (desktop) */}
          <aside className="hidden lg:block">
            <div className="sticky top-20 rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
              <h2 className="mb-4 font-heading text-sm font-semibold">
                Filters
              </h2>
              {filterPanel}
            </div>
          </aside>

          {/* Results */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-muted-foreground">
                {loading && !data ? (
                  "Loading roles…"
                ) : data ? (
                  <>
                    <span className="font-semibold text-foreground">
                      {data.total}
                    </span>{" "}
                    {data.total === 1 ? "role" : "roles"}
                    {hasFilters ? " matching" : ""}
                  </>
                ) : null}
              </p>

              <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                {/* View switcher — table is a desktop affordance */}
                <div className="hidden items-center gap-1 rounded-full border border-border/70 bg-card p-1 md:flex">
                  <button
                    type="button"
                    onClick={() => setView("list")}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      view === "list"
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Rows3 className="h-3.5 w-3.5" /> List
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("table")}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      view === "table"
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Table2 className="h-3.5 w-3.5" /> Table
                  </button>
                </div>
                {/* Mobile filter toggle */}
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg lg:hidden"
                  onClick={() => setMobileFiltersOpen((open) => !open)}
                >
                  <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
                  Filters
                  {activeChips.length > 0 ? (
                    <Badge className="ml-1.5 h-4 rounded-md bg-primary px-1.5 text-[10px] text-primary-foreground">
                      {activeChips.length}
                    </Badge>
                  ) : null}
                </Button>

                <Select
                  value={sort}
                  onValueChange={(value) => {
                    if (value) {
                      setSort(value as JobSort);
                      setPage(1);
                    }
                  }}
                  items={itemsFrom(SORT_OPTIONS)}
                >
                  <SelectTrigger className="w-[152px] rounded-lg border-border/70">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Mobile filter panel */}
            {mobileFiltersOpen ? (
              <div className="mt-4 rounded-2xl border border-border/70 bg-card p-5 shadow-sm lg:hidden">
                {filterPanel}
              </div>
            ) : null}

            {/* Active filter chips */}
            {activeChips.length > 0 ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {activeChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => updateFilter(chip.key, "all")}
                    className="group flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                  >
                    {chip.label}
                    <X className="h-3 w-3 opacity-60 transition-opacity group-hover:opacity-100" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={resetAll}
                  className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Clear all
                </button>
              </div>
            ) : null}

            {/* Results */}
            <div className="mt-5">
              {loading ? (
                <SkeletonGrid />
              ) : error ? (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-10 text-center">
                  <p className="text-sm font-medium text-destructive">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 rounded-lg"
                    onClick={() => setPage(1)}
                  >
                    Try again
                  </Button>
                </div>
              ) : data && data.jobs.length === 0 ? (
                <div className="rounded-2xl border border-border/70 bg-card p-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Search className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="mt-4 font-heading font-semibold">
                    No roles match those filters
                  </p>
                  <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
                    Try a different keyword, or widen the location and category
                    filters.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-5 rounded-lg"
                    onClick={resetAll}
                  >
                    Reset search &amp; filters
                  </Button>
                </div>
              ) : data ? (
                <>
                  {view === "table" ? (
                    <div className="hidden overflow-x-auto rounded-2xl border border-border/70 bg-card md:block">
                      <table className="w-full text-sm">
                        <thead className="border-b border-border/60 bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3 font-medium">
                              <button
                                type="button"
                                className={`hover:text-foreground ${sort === "company" ? "text-foreground" : ""}`}
                                onClick={() => setSort("company")}
                              >
                                Company
                              </button>
                            </th>
                            <th className="px-4 py-3 font-medium">Role</th>
                            <th className="px-4 py-3 font-medium">
                              <button
                                type="button"
                                className={`hover:text-foreground ${sort !== "company" ? "text-foreground" : ""}`}
                                onClick={() =>
                                  setSort(sort === "newest" ? "oldest" : "newest")
                                }
                              >
                                Posted {sort === "newest" ? "↓" : sort === "oldest" ? "↑" : ""}
                              </button>
                            </th>
                            <th className="px-4 py-3 font-medium">Location</th>
                            <th className="px-4 py-3 font-medium">Salary</th>
                            <th className="px-4 py-3" />
                          </tr>
                        </thead>
                        <tbody>
                          {data.jobs.map((job) => (
                            <tr
                              key={job.id}
                              className="border-b border-border/40 transition-colors last:border-0 hover:bg-muted/30"
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  {job.companyLogo ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={job.companyLogo}
                                      alt=""
                                      className="h-8 w-8 shrink-0 rounded-lg border border-border/70 bg-background object-contain p-1"
                                    />
                                  ) : (
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold">
                                      {job.company.slice(0, 1)}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="max-w-44 truncate font-medium">
                                      {job.company}
                                    </p>
                                    <p className="truncate font-mono text-xs text-muted-foreground">
                                      {job.source}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="max-w-72 px-4 py-3">
                                <Link
                                  href={`/jobs/${job.id}`}
                                  className="line-clamp-2 font-medium hover:text-primary"
                                >
                                  {job.title}
                                </Link>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {job.jobType === "full-time" ? "Full-time" : job.jobType} · {job.category}
                                </p>
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                                {timeAgo(job.publishedAt)}
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-amber-500/10 px-1.5 py-0.5 font-mono text-xs text-amber-700 dark:text-amber-400">
                                  <MapPin className="h-3 w-3" />
                                  {job.location}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-pink-600 dark:text-pink-400">
                                {job.salary ?? "N/A"}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="rounded-full"
                                    render={<Link href={`/jobs/${job.id}`} />}
                                  >
                                    Details
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="rounded-full px-4 shadow-sm shadow-violet-500/20"
                                    render={
                                      <a
                                        href={job.applyUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      />
                                    }
                                  >
                                    APPLY
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}

                  {/* Vertical list — on mobile alongside the table view, or as the primary view */}
                  <div
                    className={
                      view === "table"
                        ? "flex flex-col gap-4 md:hidden"
                        : "flex flex-col gap-4"
                    }
                  >
                    {data.jobs.map((job, index) => (
                      <JobCard
                        key={job.id}
                        job={job}
                        search={debouncedSearch.trim() || undefined}
                        index={index}
                      />
                    ))}
                  </div>

                  {data.hasMore ? (
                    <div className="flex flex-col items-center gap-3 pt-8">
                      <div ref={loadMoreRef} aria-hidden className="h-1 w-full" />
                      {loadingMore ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      ) : (
                        <Button
                          variant="outline"
                          size="lg"
                          className="rounded-xl px-6"
                          onClick={() => setPage((p) => p + 1)}
                        >
                          Load more roles
                        </Button>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Showing {data.jobs.length} of {data.total}
                      </p>
                    </div>
                  ) : (
                    <p className="pt-8 text-center text-xs text-muted-foreground">
                      That is everything — {data.total}{" "}
                      {data.total === 1 ? "role" : "roles"} in total.
                    </p>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
}) {
  return (
    <span className="flex items-center gap-2">
      {icon}
      <span className="font-heading text-base font-semibold text-foreground tabular-nums">
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
      <span>{label}</span>
    </span>
  );
}

function FilterField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const active = value !== "all";
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <Select
        value={value}
        onValueChange={(next) => {
          if (next) onChange(next);
        }}
        items={itemsFrom(options)}
      >
        <SelectTrigger
          className={`w-full rounded-lg ${
            active
              ? "border-primary/40 ring-1 ring-primary/20"
              : "border-border/70"
          }`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Source options with live counts, aggregated into one "Company careers" entry. */
function sourceOptions(stats: JobStats): { value: string; label: string }[] {
  const counts = new Map<string, number>();
  for (const entry of stats.sources) {
    if (
      entry.source === "greenhouse" ||
      entry.source === "lever" ||
      entry.source === "ashby"
    ) {
      counts.set(CAREERS_SOURCE, (counts.get(CAREERS_SOURCE) ?? 0) + entry.count);
    } else {
      counts.set(entry.source, (counts.get(entry.source) ?? 0) + entry.count);
    }
  }

  const options = [{ value: "all", label: "All sources" }];
  for (const key of SOURCE_ORDER) {
    const count = counts.get(key);
    if (!count) continue;
    options.push({
      value: key,
      label: `${SOURCE_LABELS[key] ?? key} (${count})`,
    });
  }
  return options;
}

function SkeletonGrid() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-border/70 bg-card p-5"
        >
          <div className="flex items-start gap-4">
            <div className="skeleton-shimmer h-12 w-12 shrink-0 rounded-xl bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="skeleton-shimmer h-4 w-3/5 rounded bg-muted" />
              <div className="skeleton-shimmer h-3.5 w-2/5 rounded bg-muted" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <div className="skeleton-shimmer h-5 w-20 rounded-md bg-muted" />
            <div className="skeleton-shimmer h-5 w-16 rounded-md bg-muted" />
          </div>
          <div className="skeleton-shimmer mt-3 h-3.5 w-full rounded bg-muted" />
          <div className="mt-5 h-px bg-border" />
          <div className="skeleton-shimmer mt-3.5 h-3 w-40 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
