"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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
            ? {
                ...json,
                jobs: [...prev.jobs, ...json.jobs],
              }
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

  const filterSelects: { key: keyof Filters; options: typeof TYPE_OPTIONS }[] = [
    { key: "type", options: TYPE_OPTIONS },
    { key: "level", options: LEVEL_OPTIONS },
    { key: "category", options: CATEGORY_OPTIONS },
    { key: "region", options: REGION_OPTIONS },
  ];

  return (
    <div className="space-y-5">
      {/* Search + filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search job title, company or keyword..."
            className="pl-9"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
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
              <SelectTrigger className="w-full">
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

      {/* Result count */}
      {data ? (
        <p className="text-sm text-muted-foreground">
          {data.total} job{data.total === 1 ? "" : "s"} found
        </p>
      ) : null}

      {/* Job grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-lg border p-6">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => setPage(1)}
          >
            Retry
          </Button>
        </div>
      ) : data && data.jobs.length === 0 ? (
        <div className="rounded-lg border p-10 text-center">
          <p className="font-medium">No jobs found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a different keyword or remove some filters.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => {
              setSearch("");
              setFilters(DEFAULT_FILTERS);
              setPage(1);
            }}
          >
            Reset search & filters
          </Button>
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                search={debouncedSearch.trim() || undefined}
              />
            ))}
          </div>

          {data.hasMore ? (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => setPage((p) => p + 1)}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading..." : "Load more jobs"}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
