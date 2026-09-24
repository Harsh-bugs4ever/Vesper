"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Lock, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/ui/star-rating";
import { useToast } from "@/components/ui/toast";
import { reviewErrorMessage, useDepartingStays, useReviewGuest } from "@/lib/hooks/use-reviews";
import { cn } from "@/lib/utils";

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

/** Shown when there is no session — the demo has to run without a backend. */
const DEMO_DEPARTING: DepartingStay[] = [
  {
    stayId: "BKG-20883",
    guest: "Dr. Sanjay Kulkarni",
    room: "507",
    nights: 3,
    departsAt: "Tomorrow, 05:30",
    interactions: ["Turndown service ×3", "Airport transfer arranged"],
  },
  {
    stayId: "BKG-20882",
    guest: "Ms. Kavya Iyer",
    room: "204",
    nights: 1,
    departsAt: "Tomorrow, 11:00",
    interactions: ["Extra towels delivered", "Room cleaned twice"],
  },
  {
    stayId: "BKG-20886",
    guest: "Mr. Nikhil Bose",
    room: "308",
    nights: 1,
    departsAt: "Today, 14:00",
    interactions: ["Late check-out handled"],
  },
];

export default function StaffReviewsPage() {
  const { showToast } = useToast();

  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [done, setDone] = useState<Record<string, boolean>>({});

  const { stays: liveStays, isDemo, isLoading, error: staysError } = useDepartingStays();
  const reviewGuest = useReviewGuest();

  const departing: DepartingStay[] = isDemo
    ? DEMO_DEPARTING
    : liveStays.map((stay) => ({
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
            title: result.delivered ? `Review recorded for ${stay.guest}` : "Demo review completed",
            description: result.delivered ? "Final once submitted. The guest never sees it." : "This preview did not send a review to the resort.",
            type: result.delivered ? "success" : "default",
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
    <div className="space-y-4">
      <div>
        <Link
          href="/staff"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-sand-500 hover:text-sand-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to my shift
        </Link>

        <h1 className="mt-2 font-serif text-2xl font-semibold text-sand-950">
          Review departing guests
        </h1>
        <p className="mt-1 text-sm text-sand-600">
          {remaining === 0
            ? "You have reviewed everyone departing from your floor."
            : `${remaining} guest${remaining === 1 ? "" : "s"} you looked after ${remaining === 1 ? "is" : "are"} checking out.`}
        </p>
      </div>

      {/* The rules, stated before the form rather than buried after it. */}
      <div className="flex items-start gap-2.5 rounded-xl border border-sand-200 bg-sand-50/70 p-3.5">
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
    </div>
  );
}
