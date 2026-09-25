"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, SlidersHorizontal, X } from "lucide-react";
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
import type { JobListResponse } from "@/lib/types";

const TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "full-time", label: "Full-Time" },
  { value: "part-time", label: "Part-Time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
  { value: "freelance", label: "Freelance" },
  { value: "other", label: "Other" },
];

const LEVEL_OPTIONS = [
  { value: "all", label: "All Levels" },
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid-Level" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead / Manager" },
];

const CATEGORY_OPTIONS = [
  { value: "all", label: "All Categories" },
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
];

const REGION_OPTIONS = [
  { value: "all", label: "All Locations" },
  { value: "Worldwide", label: "Worldwide" },
  { value: "Asia", label: "Asia" },
  { value: "Europe", label: "Europe" },
  { value: "Americas", label: "Americas" },
  { value: "Oceania", label: "Oceania" },
  { value: "Africa", label: "Africa" },
  { value: "Other", label: "Other" },
];

interface Filters {
  type: string;
  level: string;
  category: string;
  region: string;
}

const DEFAULT_FILTERS: Filters = {
  type: "all",
  level: "all",
  category: "all",
  region: "all",
};

export function JobBrowser() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<JobListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Debounce the search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch jobs whenever search, filters or page change
  useEffect(() => {
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
        const params = new URLSearchParams({ page: String(page) });
        if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
        if (filters.type !== "all") params.set("type", filters.type);
        if (filters.level !== "all") params.set("level", filters.level);
        if (filters.category !== "all") params.set("category", filters.category);
        if (filters.region !== "all") params.set("region", filters.region);

        const res = await fetch(`/api/jobs?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);

        const json: JobListResponse = await res.json();
        setData((prev) =>
          prev && isLoadMore
            ? { ...json, jobs: [...prev.jobs, ...json.jobs] }
            : json
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
  }, [debouncedSearch, filters, page]);

  function updateFilter(key: keyof Filters, value: string) {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function resetAll() {
    setSearch("");
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  }

  const activeChips = useMemo(() => {
    const all = [
      { key: "type" as const, options: TYPE_OPTIONS },
      { key: "level" as const, options: LEVEL_OPTIONS },
      { key: "category" as const, options: CATEGORY_OPTIONS },
      { key: "region" as const, options: REGION_OPTIONS },
    ];
    return all
      .filter(({ key }) => filters[key] !== "all")
      .map(({ key, options }) => ({
        key,
        label: options.find((o) => o.value === filters[key])?.label ?? "",
      }));
  }, [filters]);

  const hasActiveSearch = Boolean(debouncedSearch.trim()) || activeChips.length > 0;
  const filterSelects: { key: keyof Filters; options: typeof TYPE_OPTIONS }[] = [
    { key: "type", options: TYPE_OPTIONS },
    { key: "level", options: LEVEL_OPTIONS },
    { key: "category", options: CATEGORY_OPTIONS },
    { key: "region", options: REGION_OPTIONS },
  ];

  return (
    <div className="space-y-6">
      {/* Search + filters toolbar */}
      <div className="rounded-2xl border border-border/70 bg-card/60 p-4 shadow-sm backdrop-blur sm:p-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search job title, company or keyword..."
            className="h-12 rounded-xl border-border/70 bg-background pl-10 pr-10 text-base shadow-sm focus-visible:ring-2 focus-visible:ring-primary/30"
          />
          {search ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <SlidersHorizontal className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
          <div className="grid flex-1 grid-cols-2 gap-2 md:grid-cols-4">
            {filterSelects.map(({ key, options }) => (
              <Select
                key={key}
                value={filters[key]}
                onValueChange={(value) => {
                  if (value) updateFilter(key, value);
                }}
                items={Object.fromEntries(
                  options.map((option) => [option.value, option.label])
                )}
              >
                <SelectTrigger
                  className={`w-full rounded-xl border-border/70 bg-background ${
                    filters[key] !== "all"
                      ? "border-primary/40 text-foreground ring-1 ring-primary/20"
                      : ""
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
            ))}
          </div>
        </div>

        {activeChips.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
            <span className="text-xs font-medium text-muted-foreground">
              Filters:
            </span>
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
              className="ml-auto text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Clear all
            </button>
          </div>
        ) : null}
      </div>

      {/* Result count */}
      {data && !loading ? (
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{data.total}</span>{" "}
          {data.total === 1 ? "job" : "jobs"} found
          {hasActiveSearch ? " for your filters" : ""}
        </p>
      ) : null}

      {/* Job grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border/70 bg-card p-5"
            >
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 animate-pulse rounded-xl bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
                  <div className="h-3.5 w-2/5 animate-pulse rounded bg-muted" />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <div className="h-5 w-20 animate-pulse rounded-md bg-muted" />
                <div className="h-5 w-16 animate-pulse rounded-md bg-muted" />
              </div>
              <div className="mt-5 h-px bg-border" />
              <div className="mt-3.5 h-3 w-24 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
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
          <p className="mt-4 font-heading font-semibold">No jobs found</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
            Try a different keyword or remove some filters to widen your
            search.
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
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                search={debouncedSearch.trim() || undefined}
              />
            ))}
          </div>

          {data.hasMore ? (
            <div className="flex flex-col items-center gap-3 pt-4">
              <Button
                variant="outline"
                size="lg"
                className="rounded-xl px-6"
                onClick={() => setPage((p) => p + 1)}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Load more jobs"
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Showing {data.jobs.length} of {data.total}
              </p>
            </div>
          ) : (
            <p className="pt-4 text-center text-xs text-muted-foreground">
              You have reached the end — {data.total}{" "}
              {data.total === 1 ? "job" : "jobs"} in total.
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}
