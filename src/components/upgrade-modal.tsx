"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Loader2, Lock, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const PREMIUM_PERKS = [
  "AI-ranked job matches (semantic scoring by DeepSeek)",
  "AI resume review — role-aware critique + ATS tips",
  "AI cover letter for every job, written from your resume",
  "Priority access to new AI features",
];

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        callbacks?: {
          onSuccess?: (result: unknown) => void;
          onPending?: (result: unknown) => void;
          onError?: (result: unknown) => void;
          onClose?: () => void;
        }
      ) => void;
    };
  }
}

function loadSnapScript(snapJsUrl: string, clientKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.snap) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-midtrans="snap"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("snap.js failed")));
      return;
    }
    const script = document.createElement("script");
    script.src = snapJsUrl;
    script.dataset.midtrans = "snap";
    script.dataset.clientKey = clientKey;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Midtrans Snap"));
    document.body.appendChild(script);
  });
}

export function UpgradeModal({
  open,
  onClose,
  onUpgraded,
}: {
  open: boolean;
  onClose: () => void;
  onUpgraded?: () => void;
}) {
  const [phase, setPhase] = useState<
    "details" | "creating" | "paying" | "success" | "error" | "not-configured"
  >("details");
  const [message, setMessage] = useState("");
  const [plan, setPlan] = useState<"search" | "premium">("search");
  const [searchPriceIdr, setSearchPriceIdr] = useState<number | null>(null);
  const [priceIdr, setPriceIdr] = useState<number | null>(null);
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      // Reset any previous run, then load the live prices and plan state.
      try {
        const res = await fetch("/api/payments/status");
        const data = res.ok ? await res.json() : null;
        if (cancelled) return;
        setPhase("details");
        setMessage("");
        if (data?.searchPriceIdr) setSearchPriceIdr(data.searchPriceIdr);
        if (data?.priceIdr) setPriceIdr(data.priceIdr);
        if (typeof data?.credits === "number") setCredits(data.credits);
        if (data?.premium) setPhase("success");
        if (data && data.paymentEnabled === false) setPhase("not-configured");
      } catch {
        if (!cancelled) setPhase("details");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const rupiah = (value: number | null, fallback: string) =>
    value ? `Rp ${value.toLocaleString("id-ID")}` : fallback;
  const searchPrice = rupiah(searchPriceIdr, "Rp 9.900");
  const premiumPrice = rupiah(priceIdr, "Rp 99.000");

  async function startPayment(chosen: "search" | "premium") {
    setPlan(chosen);
    setPhase("creating");
    try {
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: chosen }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 400 && data.error === "already_premium") {
        setPhase("success");
        onUpgraded?.();
        return;
      }
      if (res.status === 503) {
        setPhase("not-configured");
        setMessage(data.message ?? "");
        return;
      }
      if (!res.ok || !data.token) {
        setPhase("error");
        setMessage(data.message ?? "Could not start the payment.");
        return;
      }

      await loadSnapScript(data.snapJsUrl, data.clientKey);
      if (!window.snap) throw new Error("Midtrans Snap unavailable");

      setPhase("paying");
      window.snap.pay(data.token, {
        onSuccess: () => {
          setPhase("success");
          setMessage(
            plan === "search"
              ? "1 kredit AI search siap dipakai."
              : "Semua fitur AI sudah terbuka selama 30 hari."
          );
          onUpgraded?.();
        },
        onPending: () => {
          setPhase("success");
          setMessage(
            (plan === "search"
              ? "1 kredit AI search"
              : "Premium 30 hari") +
              " akan aktif otomatis begitu Midtrans mengonfirmasi pembayaran."
          );
          onUpgraded?.();
        },
        onError: () => {
          setPhase("error");
          setMessage("Midtrans reported a payment error. You can try again.");
        },
        onClose: () => {
          // Popup dismissed; webhook may still confirm it later.
          setPhase("details");
          onUpgraded?.();
        },
      });
    } catch (error) {
      setPhase("error");
      setMessage(String((error as Error).message ?? error));
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl">
        <div className="h-1.5 w-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-400" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Lock className="h-3 w-3" /> Premium
          </span>
          <h2 className="mt-3 font-heading text-xl font-bold">
            Unlock AI job matching
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Bayar per pencarian, atau ambil premium untuk akses penuh.
          </p>

          {phase === "success" ? (
            <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
              <p className="font-medium text-emerald-700 dark:text-emerald-400">
                Terima kasih! 🎉
              </p>
              <p className="mt-1 text-muted-foreground">
                {message || "Fitur AI sudah terbuka."}
              </p>
              <Button className="mt-3 w-full rounded-lg" onClick={onClose}>
                <Sparkles className="mr-1.5 h-4 w-4" /> Mulai pakai AI
              </Button>
            </div>
          ) : phase === "not-configured" ? (
            <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
              <p className="font-medium text-amber-700 dark:text-amber-400">
                Payment belum aktif
              </p>
              <p className="mt-1 text-muted-foreground">
                {message ||
                  "Midtrans keys are not configured on the server yet (MIDTRANS_SERVER_KEY / MIDTRANS_CLIENT_KEY)."}
              </p>
            </div>
          ) : phase === "error" ? (
            <div className="mt-5 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
              <p className="text-destructive">{message}</p>
              <Button
                variant="outline"
                className="mt-3 w-full rounded-lg"
                onClick={() => startPayment(plan)}
              >
                Try again
              </Button>
            </div>
          ) : (
            <>
              {/* Plan options */}
              <div className="mt-5 space-y-2.5">
                <button
                  type="button"
                  onClick={() => setPlan("search")}
                  className={`w-full rounded-xl border p-3.5 text-left transition-colors ${
                    plan === "search"
                      ? "border-primary/50 bg-primary/5 ring-1 ring-primary/30"
                      : "border-border/70 hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">
                      Bayar per pencarian
                    </span>
                    <span className="font-heading text-sm font-bold">
                      {searchPrice}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    1x AI-ranked search · tanpa langganan
                    {typeof credits === "number" && credits > 0
                      ? ` · kamu punya ${credits} kredit`
                      : ""}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setPlan("premium")}
                  className={`w-full rounded-xl border p-3.5 text-left transition-colors ${
                    plan === "premium"
                      ? "border-primary/50 bg-primary/5 ring-1 ring-primary/30"
                      : "border-border/70 hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">
                      Premium 30 hari
                    </span>
                    <span className="font-heading text-sm font-bold">
                      {premiumPrice}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Unlimited AI search + review + cover letter
                  </p>
                </button>
              </div>

              <ul className="mt-4 space-y-1.5">
                {PREMIUM_PERKS.map((perk) => (
                  <li
                    key={perk}
                    className="flex items-start gap-2 text-xs text-muted-foreground"
                  >
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    {perk}
                  </li>
                ))}
              </ul>

              <Button
                size="lg"
                className="mt-5 w-full rounded-xl shadow-md shadow-violet-500/20"
                onClick={() => startPayment(plan)}
                disabled={phase === "creating" || phase === "paying"}
              >
                {phase === "creating" || phase === "paying" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {phase === "creating" ? "Menyiapkan pembayaran…" : "Menunggu pembayaran…"}
                  </>
                ) : (
                  <>
                    Bayar {plan === "search" ? searchPrice : premiumPrice} — Midtrans
                  </>
                )}
              </Button>
            </>
          )}

          <p className="mt-3 text-center text-xs text-muted-foreground">
            QRIS, GoPay, bank transfer &amp; kartu kredit via Midtrans ·{" "}
            <Link href="/" className="underline" onClick={onClose}>
              lanjut tanpa premium
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
