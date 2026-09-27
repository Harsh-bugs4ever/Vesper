"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, Check, Lock, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/ui/star-rating";
import { useToast } from "@/components/ui/toast";
import { reviewErrorMessage, useDepartingStays, useReviewGuest } from "@/lib/hooks/use-reviews";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-context";
import { performanceApi } from "@/lib/api/performance";

/**
 * Staff reviewing the guests they looked after.
 *
 * The mirror of the rating panel on the guest QR page, and deliberately more explicit
 * about its own rules: this is an opinion about a named person, recorded by someone the
 * guest cannot see, feeding a decision about how that guest is treated on the way out.
 * The page says so rather than leaving it implied.
 */

interface DepartingStay {
  stayId: string;
  guest: string;
  room: string;
  nights: number;
  departsAt: string;
  /** What this staff member actually did for them — the basis for having a view at all. */
  interactions: string[];
}

export default function StaffReviewsPage() {
  const { showToast } = useToast();
  const { user, isConnected, hasPermission } = useAuth();
  const canReadOwn = hasPermission("staff_review:read_own");
  const canReviewDeparting = hasPermission("guest_review:read");
  const ownRatings = useQuery({
    queryKey: ["staff", "own-ratings", user?.propertyId, user?.id],
    queryFn: performanceApi.mine,
    enabled: isConnected && canReadOwn,
  });

  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [done, setDone] = useState<Record<string, boolean>>({});

  const { stays: liveStays, isLoading, error: staysError } = useDepartingStays();
  const reviewGuest = useReviewGuest();

  const departing: DepartingStay[] = liveStays.map((stay) => ({
    stayId: stay.stay_id,
    guest: `Room ${stay.room_number ?? "—"}`,
    room: stay.room_number ?? "—",
    nights: 0,
    departsAt: stay.departs_on ?? "Today",
    interactions: [],
  }));

  const submit = (stay: DepartingStay) => {
    const rating = ratings[stay.stayId];
    if (!rating) {
      showToast({
        title: "Pick a rating first",
        description: "A comment on its own does not tell the manager much.",
        type: "warning",
      });
      return;
    }

    reviewGuest.mutate(
      { stayId: stay.stayId, rating, comment: comments[stay.stayId] || undefined },
      {
        onSuccess: (result) => {
          setDone((current) => ({ ...current, [stay.stayId]: true }));
          showToast({
            title: `Review recorded for ${stay.guest}`,
            description: "Final once submitted. The guest never sees it.",
            type: "success",
          });
        },
        onError: (error) => {
          showToast({
            title: "Review not sent",
            description: reviewErrorMessage(error),
            type: "warning",
          });
        },
      }
    );
  };

  const remaining = departing.filter((stay) => !done[stay.stayId]).length;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <section className="relative isolate overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#173a2d] via-[#244c3a] to-[#355b46] p-5 text-white shadow-[0_24px_60px_-35px_rgba(23,58,45,.8)] sm:p-8">
        <div aria-hidden="true" className="absolute -right-16 -top-24 -z-10 h-56 w-56 rounded-full border border-white/10 bg-white/[0.035]" />
        <Link
          href="/staff"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/65 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to my shift
        </Link>

        <h1 className="mt-5 font-serif text-3xl font-semibold text-white sm:text-4xl">
          {canReviewDeparting ? "Review departing guests" : "My guest ratings"}
        </h1>
        {canReviewDeparting ? (
          <>
            <p className="mt-2 text-sm text-white/75">
              {remaining === 0
                ? "You have reviewed everyone departing from your floor."
                : `${remaining} guest${remaining === 1 ? "" : "s"} you looked after ${remaining === 1 ? "is" : "are"} checking out.`}
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.08] px-3 py-2 text-xs font-medium text-white/85">
              <ShieldCheck className="h-4 w-4 text-gold-200" /> Confidential team handover
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-white/75">Feedback guests gave about your work.</p>
        )}
      </section>

      {!canReadOwn && !canReviewDeparting ? <p role="alert" className="rounded-xl border border-amber-200 bg-white p-4 text-sm text-sand-700">Your account cannot view personal ratings.</p>
        : !canReadOwn ? null
        : ownRatings.isPending ? <p role="status" className="rounded-xl bg-white p-4 text-sm text-sand-700">Loading your ratings…</p>
        : ownRatings.isError ? <p role="alert" className="rounded-xl border border-rose-200 bg-white p-4 text-sm text-rose-700">Could not load your ratings: {ownRatings.error instanceof Error ? ownRatings.error.message : "Please try again."}</p>
          : ownRatings.data && <section aria-label="Your rating summary" className="rounded-xl border border-sand-200 bg-white p-5">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <div>
                <p className="text-sm text-sand-600">Average guest rating</p>
                <p className="font-serif text-3xl font-semibold text-sand-950">{ownRatings.data.mean_rating == null ? "—" : `${ownRatings.data.mean_rating.toFixed(1)} / 5`}</p>
              </div>
              {ownRatings.data.mean_rating != null && <StarRating value={Math.round(ownRatings.data.mean_rating)} size="sm" />}
              <p className="text-sm text-sand-700">From {ownRatings.data.review_count} guest rating{ownRatings.data.review_count === 1 ? "" : "s"}</p>
            </div>
            {ownRatings.data.review_count === 0 ? <p className="mt-3 text-sm text-sand-700">No guest ratings have been recorded for you yet.</p>
              : <ul className="mt-4 space-y-1 text-sm text-sand-700">{ownRatings.data.reasons.map((reason, index) => <li key={`${index}-${reason}`}>{reason}</li>)}</ul>}
            <p className="mt-4 text-xs text-sand-600">Individual guest comments are reviewed with your manager.</p>
          </section>}

      {canReviewDeparting && <section className="space-y-4" aria-label="Review departing guests">
        <div>
          <h2 className="font-serif text-xl font-semibold text-sand-950">Review departing guests</h2>
          <p className="mt-1 text-sm text-sand-600">{remaining === 0
            ? "You have reviewed everyone departing from your floor."
            : `${remaining} guest${remaining === 1 ? "" : "s"} you looked after ${remaining === 1 ? "is" : "are"} checking out.`}</p>
        </div>
      {/* The rules, stated before the form rather than buried after it. */}
      <div className="flex items-start gap-2.5 rounded-2xl border border-sage-200/70 bg-white p-4 shadow-sm sm:p-5">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sage-600" />
        <p className="text-xs leading-relaxed text-sand-600">
          The guest never sees this, and neither do your colleagues. One review per guest
          per stay, and it cannot be edited once sent. Your manager sees your name against
          it, and sees it flagged if the guest raised a complaint about your department.
        </p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[0, 1].map((row) => (
            <div key={row} className="h-40 animate-pulse rounded-2xl bg-sand-100" />
          ))}
        </div>
      )}

      {staysError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{reviewErrorMessage(staysError)}</p>}

      <ul className="space-y-3">
        {departing.map((stay) => {
          const submitted = done[stay.stayId];

          return (
            <li
              key={stay.stayId}
              className={cn(
                "rounded-2xl border p-4",
                submitted ? "border-sand-200 bg-sand-50/60" : "border-sand-200 bg-white"
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-serif text-lg font-semibold leading-tight text-sand-950">
                    {stay.guest}
                  </p>
                  <p className="mt-0.5 text-xs text-sand-500">
                    Room {stay.room} · {stay.nights} night{stay.nights === 1 ? "" : "s"} · departs{" "}
                    {stay.departsAt}
                  </p>
                </div>

                {submitted && (
                  <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-emerald-700">
                    <Lock className="h-3.5 w-3.5" />
                    Submitted
                  </span>
                )}
              </div>

              <ul className="mt-2.5 flex flex-wrap gap-1.5">
                {stay.interactions.map((item) => (
                  <li
                    key={item}
                    className="rounded-full border border-sand-200 bg-sand-50 px-2.5 py-0.5 text-xs text-sand-600"
                  >
                    {item}
                  </li>
                ))}
              </ul>

              {submitted ? (
                <div className="mt-3 flex items-center gap-2">
                  <StarRating value={ratings[stay.stayId] ?? 0} size="sm" />
                  <span className="text-xs text-sand-500">
                    <Check className="mr-1 inline h-3 w-3" />
                    Recorded and final
                  </span>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-sand-700">
                      How was this guest to look after?
                    </label>
                    <StarRating
                      value={ratings[stay.stayId] ?? 0}
                      onChange={(value) =>
                        setRatings((current) => ({ ...current, [stay.stayId]: value }))
                      }
                      label={`Rate ${stay.guest}`}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={`comment-${stay.stayId}`}
                      className="mb-1.5 block text-xs font-medium text-sand-700"
                    >
                      Anything the next shift should know? <span className="text-sand-400">(optional)</span>
                    </label>
                    <textarea
                      id={`comment-${stay.stayId}`}
                      rows={2}
                      maxLength={500}
                      value={comments[stay.stayId] ?? ""}
                      onChange={(event) =>
                        setComments((current) => ({
                          ...current,
                          [stay.stayId]: event.target.value,
                        }))
                      }
                      placeholder="Kept the room tidy, easy to work around."
                      className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm text-sand-900 placeholder:text-sand-400 focus:border-sage-500 focus:outline-none focus:ring-1 focus:ring-sage-500"
                    />
                  </div>

                  <Button
                    size="sm"
                    className="w-full"
                    disabled={reviewGuest.isPending}
                    onClick={() => submit(stay)}
                  >
                    {reviewGuest.isPending ? "Sending…" : "Submit review"}
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      </section>}
    </div>
  );
}
