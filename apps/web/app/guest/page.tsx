"use client";

import React, { useState } from "react";
import {
  Check,
  ChevronRight,
  ConciergeBell,
  Loader2,
  Sparkle,
  SprayCan,
  TriangleAlert,
  Waves,
} from "lucide-react";

import { StarRating } from "@/components/ui/star-rating";
import { useToast } from "@/components/ui/toast";
import { reviewErrorMessage, useRateStaff, useRateableStaff } from "@/lib/hooks/use-reviews";
import { cn } from "@/lib/utils";

/**
 * The page behind the in-room QR code.
 *
 * No login: the room token in the URL is the whole session, so the page shows only what
 * this room is entitled to and asks for nothing a guest would have to remember.
 */

const SERVICES = [
  {
    id: "room-service",
    name: "Room Service",
    detail: "Food & beverages to your room",
    icon: ConciergeBell,
    tone: "text-sage-700",
  },
  {
    id: "housekeeping",
    name: "Housekeeping",
    detail: "Request room cleaning or amenities",
    icon: SprayCan,
    tone: "text-gold-600",
  },
  {
    id: "towels",
    name: "Extra Towels",
    detail: "Request additional towels or linens",
    icon: Waves,
    tone: "text-sage-700",
  },
  {
    id: "issue",
    name: "Report an Issue",
    detail: "Let us know if something needs attention",
    icon: TriangleAlert,
    tone: "text-rose-500",
  },
] as const;

/** The three states a request moves through, in order. */
const STAGES = ["Request Placed", "In Progress", "Completed"] as const;

export default function GuestPage() {
  const { showToast } = useToast();

  const [stage, setStage] = useState(1);
  const [serviceRating, setServiceRating] = useState(0);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);

  // Who this guest may rate: the people who actually accepted a request for this room.
  const { staff: servedBy, isLoading: staffLoading } = useRateableStaff();
  const rateStaff = useRateStaff();

  const submitRating = (staffId: string, name: string, rating: number) => {
    setSaving(staffId);
    rateStaff.mutate(
      { staffId, rating },
      {
        onSuccess: () => {
          setSubmitted((current) => ({ ...current, [staffId]: true }));
          setSaving(null);
          showToast({
            title: "Thank you",
            description: `Your rating for ${name} has been passed to their manager.`,
            type: "success",
          });
        },
        onError: (error) => {
          setSaving(null);
          // Clear the stars back: leaving them filled would tell the guest their
          // rating landed when it did not.
          setRatings((current) => {
            const next = { ...current };
            delete next[staffId];
            return next;
          });
          showToast({
            title: "Rating not sent",
            description: reviewErrorMessage(error),
            type: "warning",
          });
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-sand-50 pb-10">
      {/* Masthead */}
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-6">
        <div className="flex items-center gap-3">
          <Sparkle className="h-7 w-7 shrink-0 text-sand-400" />
          <div>
            <p className="font-serif text-2xl leading-none tracking-[0.18em] text-sand-950">
              VESPER
            </p>
            <p className="mt-1.5 text-[11px] tracking-[0.22em] text-sand-500">BEACH RESORT</p>
          </div>
        </div>
        <span className="rounded-full border border-sand-200 bg-white px-3 py-1.5 text-xs font-medium text-sand-700">
          EN
        </span>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-5">
        {/* Welcome */}
        <section className="overflow-hidden rounded-2xl border border-sand-200/80 bg-white">
          <div className="grid gap-0 sm:grid-cols-[1fr_auto]">
            <div className="p-6">
              <p className="text-xs font-medium tracking-[0.18em] text-sand-500">
                WELCOME TO VESPER
              </p>
              <h1 className="mt-2 font-serif text-3xl font-semibold leading-tight text-sand-950">
                Make Yourself
                <br />
                at Home
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-sand-600">
                Services at your fingertips.
                <br />
                We&rsquo;re here to make your stay special.
              </p>
            </div>

            <div className="flex items-start justify-end p-6 sm:pl-0">
              <div className="rounded-xl bg-sand-400/90 px-5 py-4 text-right">
                <p className="font-serif text-2xl font-semibold leading-none text-white">
                  Room 412
                </p>
                <p className="mt-1.5 text-xs text-white/90">Deluxe Sea View</p>
              </div>
            </div>
          </div>
        </section>

        {/* Services */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SERVICES.map((service) => {
            const Icon = service.icon;
            return (
              <button
                key={service.id}
                onClick={() =>
                  showToast({
                    title: `${service.name} requested`,
                    description: "Someone will be with you shortly.",
                    type: "success",
                  })
                }
                className="flex items-center gap-4 rounded-2xl border border-sand-200/80 bg-white p-5 text-left transition-colors hover:bg-sand-50"
              >
                <Icon className={cn("h-8 w-8 shrink-0", service.tone)} />
                <span className="min-w-0 flex-1">
                  <span className="block font-serif text-lg font-semibold text-sand-950">
                    {service.name}
                  </span>
                  <span className="mt-0.5 block text-sm leading-snug text-sand-600">
                    {service.detail}
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-sand-400" />
              </button>
            );
          })}
        </section>

        {/* Live request tracker */}
        <section className="rounded-2xl border border-sand-200/80 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-serif text-xl font-semibold text-sand-950">Your Request</h2>
            <button className="flex items-center gap-1 text-sm font-medium text-sage-700 hover:text-sage-900">
              View All Requests
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 rounded-xl border border-sand-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-50 text-gold-700">
                  <Waves className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-serif text-lg font-semibold leading-tight text-sand-950">
                    Extra Towels
                  </p>
                  <p className="text-sm text-sand-600">Requested at 10:24 AM</p>
                </div>
              </div>
              <span className="shrink-0 rounded-lg bg-sage-50 px-3 py-1.5 text-sm font-medium text-sage-800">
                {STAGES[stage]}
              </span>
            </div>

            {/* Progress rail */}
            <div className="mt-5">
              <div className="relative flex items-center justify-between">
                <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-sand-200" />
                <div
                  className="absolute left-0 top-1/2 h-0.5 -translate-y-1/2 bg-sage-600 transition-all"
                  style={{ width: `${(stage / (STAGES.length - 1)) * 100}%` }}
                />
                {STAGES.map((_, index) => (
                  <span
                    key={index}
                    className={cn(
                      "relative flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors",
                      index < stage
                        ? "border-sage-600 bg-sage-600 text-white"
                        : index === stage
                          ? "border-sage-600 bg-sage-600"
                          : "border-sand-300 bg-white"
                    )}
                  >
                    {index < stage && <Check className="h-3.5 w-3.5" />}
                  </span>
                ))}
              </div>

              <div className="mt-2 flex items-start justify-between gap-2 text-center">
                <span className="flex-1 text-left">
                  <span className="block text-sm font-medium text-sand-900">Request Placed</span>
                  <span className="block text-xs text-sand-500">10:24 AM</span>
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-medium text-sand-900">In Progress</span>
                  <span className="block text-xs text-sand-500">Our team is on it</span>
                </span>
                <span className="flex-1 text-right">
                  <span
                    className={cn(
                      "block text-sm font-medium",
                      stage >= 2 ? "text-sand-900" : "text-sand-400"
                    )}
                  >
                    Completed
                  </span>
                  <span className="block text-xs text-sand-400">
                    {stage >= 2 ? "Done" : "We'll notify you"}
                  </span>
                </span>
              </div>
            </div>

            {stage < 2 && (
              <button
                onClick={() => setStage(2)}
                className="mt-4 text-xs text-sand-400 hover:text-sand-600"
              >
                (demo: advance to completed)
              </button>
            )}
          </div>
        </section>

        {/* Service rating */}
        <section className="rounded-2xl border border-sand-200/80 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-serif text-xl font-semibold text-sand-950">
                How was the service?
              </h2>
              <p className="mt-0.5 text-sm text-sand-600">
                Your feedback helps us serve you better.
              </p>
            </div>
            <StarRating
              value={serviceRating}
              onChange={(value) => {
                setServiceRating(value);
                showToast({
                  title: "Thank you for the feedback",
                  description: `You rated this service ${value} out of 5.`,
                  type: "success",
                });
              }}
              size="lg"
              label="Rate this service"
            />
          </div>
        </section>

        {/* Rating the people who served this stay */}
        <section className="rounded-2xl border border-sand-200/80 bg-white p-5">
          <h2 className="font-serif text-xl font-semibold text-sand-950">Rate our team</h2>
          <p className="mt-0.5 text-sm text-sand-600">
            Only the people who looked after you during this stay. Ratings go to their
            manager, never to the person directly, and you can rate each of them once.
          </p>

          {staffLoading ? (
            <div className="mt-4 space-y-2">
              {[0, 1, 2].map((row) => (
                <div key={row} className="h-14 animate-pulse rounded-xl bg-sand-100" />
              ))}
            </div>
          ) : servedBy.length === 0 ? (
            <p className="mt-4 text-sm text-sand-500">
              Nobody has attended to this room yet. Once someone does, you will be able to
              rate them here.
            </p>
          ) : (
          <ul className="mt-4 divide-y divide-sand-100">
            {servedBy.map((member) => {
              const done = submitted[member.id] || member.already_rated;
              const isSaving = saving === member.id;

              return (
                <li
                  key={member.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sage-50 text-sm font-semibold text-sage-800">
                      {member.name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-sand-950">{member.name}</p>
                      <p className="text-xs text-sand-500">{member.role}</p>
                    </div>
                  </div>

                  {done ? (
                    <span className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                      <StarRating value={ratings[member.id] ?? 0} size="sm" />
                      <Check className="h-4 w-4" />
                      Thank you
                    </span>
                  ) : isSaving ? (
                    <span className="flex items-center gap-2 text-sm text-sand-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending
                    </span>
                  ) : (
                    <StarRating
                      value={ratings[member.id] ?? 0}
                      onChange={(value) => {
                        setRatings((current) => ({ ...current, [member.id]: value }));
                        submitRating(member.id, member.name, value);
                      }}
                      label={`Rate ${member.name}`}
                    />
                  )}
                </li>
              );
            })}
          </ul>
          )}
        </section>

        <footer className="border-t border-sand-200/80 pt-5 text-center">
          <p className="text-xs tracking-[0.18em] text-sand-500">VESPER BEACH RESORT</p>
          <p className="mt-1 text-xs tracking-[0.14em] text-sand-400">
            HOSPITALITY FOR A BRIGHTER TOMORROW
          </p>
          <p className="mt-3 text-xs tracking-[0.2em] text-sand-500">STAY · RELAX · BELONG</p>
        </footer>
      </main>
    </div>
  );
}
