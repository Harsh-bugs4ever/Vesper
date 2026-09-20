"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Award,
  CalendarPlus,
  CircleUser,
  Gift,
  IndianRupee,
  Moon,
  Pencil,
  Star,
} from "lucide-react";

import { SentimentTrendChart } from "@/components/charts/sentiment-trend-chart";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { PeriodSelect } from "@/components/ui/period-select";
import { SectionTabs } from "@/components/ui/section-tabs";
import { StarRating } from "@/components/ui/star-rating";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { atRisk, guests, suggestedOffer } from "@/lib/demo/guest-profile";
import { cn } from "@/lib/utils";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "stays", label: "Stays" },
  { value: "preferences", label: "Preferences" },
  { value: "communications", label: "Communications" },
  { value: "notes", label: "Notes" },
  { value: "activity", label: "Activity" },
] as const;

type Tab = (typeof TABS)[number]["value"];

const SENTIMENT_RANGES = ["Last 2 Years", "Last Year", "All Time"] as const;

export default function GuestProfilePage() {
  const { showToast } = useToast();

  const guest = guests[0];
  const [tab, setTab] = useState<Tab>("overview");
  const [range, setRange] = useState<string>(SENTIMENT_RANGES[0]);
  const [offerHandled, setOfferHandled] = useState<"approved" | "saved" | null>(null);

  const initials = guest.name
    .split(" ")
    .map((part) => part[0])
    .join("");

  return (
    <div className="space-y-5">
      {/* Breadcrumb row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/guests"
          className="inline-flex items-center gap-2 text-sm font-medium text-sand-600 hover:text-sand-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Guest Profiles
        </Link>

        <Button
          size="sm"
          onClick={() =>
            showToast({
              title: "New booking",
              description: `Opening the booking form pre-filled for ${guest.name}.`,
              type: "default",
            })
          }
        >
          <CalendarPlus className="h-3.5 w-3.5" />
          New Booking
        </Button>
      </div>

      {/* Identity card */}
      <Panel>
        <PanelBody className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-5">
              <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-sage-50 font-serif text-3xl font-semibold text-sage-800">
                {initials}
              </span>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="font-serif text-3xl font-semibold leading-tight text-sand-950">
                    {guest.name}
                  </h1>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-200 bg-gold-50 px-2.5 py-0.5 text-xs font-medium text-gold-800">
                    <Award className="h-3 w-3" />
                    {guest.tier}
                  </span>
                </div>

                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-sand-600">
                  <span>Member since {guest.memberSince}</span>
                  <span className="text-sand-300">|</span>
                  <span>{guest.location}</span>
                  <span className="text-sand-300">|</span>
                  <span>{guest.email}</span>
                  <span className="text-sand-300">|</span>
                  <span>{guest.phone}</span>
                </p>

                {guest.quote && (
                  <p className="mt-2 font-serif text-base italic text-sand-700">
                    &ldquo;{guest.quote}&rdquo;
                  </p>
                )}
              </div>
            </div>

            <Button variant="outline" size="sm">
              <Pencil className="h-3.5 w-3.5" />
              Edit Profile
            </Button>
          </div>

          {/* Headline figures */}
          <div className="grid grid-cols-2 gap-4 border-t border-sand-200/80 pt-5 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { icon: CircleUser, value: guest.pastStays, label: "Past Stays" },
              {
                icon: IndianRupee,
                value: `₹${guest.totalSpend.toLocaleString("en-IN")}`,
                label: "Total Spend",
              },
              { icon: Moon, value: guest.avgNights, label: "Avg. Nights" },
              { icon: CalendarPlus, value: guest.lastStay, label: "Last Stay" },
              {
                icon: Star,
                value: guest.guestRating === null ? "—" : `${guest.guestRating}/10`,
                label: "Guest Rating",
              },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="flex items-center gap-3">
                  <Icon className="h-5 w-5 shrink-0 text-sand-400" />
                  <div className="min-w-0">
                    <p className="font-serif text-xl font-semibold leading-tight text-sand-950">
                      {stat.value}
                    </p>
                    <p className="text-xs text-sand-500">{stat.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </PanelBody>
      </Panel>

      <SectionTabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
          <div className="space-y-4">
            <Panel>
              <PanelHeader
                title="Guest Preferences"
                description="Personalise every stay"
                action={
                  <button className="pt-1 text-xs font-medium text-sage-700 hover:text-sage-900">
                    Edit
                  </button>
                }
              />
              <PanelBody className="pt-4">
                <ul className="flex flex-wrap gap-2">
                  {guest.preferences.map((pref) => {
                    const Icon = pref.icon;
                    return (
                      <li
                        key={pref.label}
                        className="flex items-center gap-2 rounded-full border border-sand-200 bg-sand-50/70 px-3.5 py-2 text-sm text-sand-800"
                      >
                        <Icon className="h-4 w-4 shrink-0 text-sand-500" />
                        {pref.label}
                      </li>
                    );
                  })}
                </ul>
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader
                title="Guest Sentiment Trend"
                description="Based on feedback, reviews and in-stay requests"
                action={
                  <PeriodSelect value={range} onChange={setRange} options={SENTIMENT_RANGES} />
                }
              />
              <PanelBody className="pt-4">
                <SentimentTrendChart data={guest.sentiment} average={guest.sentimentAverage} />
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader
                title="Recent Stays"
                action={
                  <button
                    onClick={() => setTab("stays")}
                    className="pt-1 text-xs font-medium text-sage-700 hover:text-sage-900"
                  >
                    View all
                  </button>
                }
              />
              <PanelBody className="pt-4">
                <Table>
                  <THead>
                    <tr>
                      <TH>Check-in</TH>
                      <TH>Check-out</TH>
                      <TH>Room Type</TH>
                      <TH align="right">Nights</TH>
                      <TH align="right">Amount (₹)</TH>
                      <TH align="right">Feedback</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {guest.stays.map((stay) => (
                      <TR key={stay.checkIn}>
                        <TD className="text-sand-700">{stay.checkIn}</TD>
                        <TD className="text-sand-700">{stay.checkOut}</TD>
                        <TD className="font-medium text-sand-900">{stay.roomType}</TD>
                        <TD align="right" className="text-sand-700">
                          {stay.nights}
                        </TD>
                        <TD align="right" className="text-sand-800">
                          {stay.amount.toLocaleString("en-IN")}
                        </TD>
                        <TD align="right">
                          {stay.feedback === null ? (
                            <span className="text-sand-400">—</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-sage-200 bg-sage-50 px-2 py-0.5 text-xs font-medium text-sage-800">
                              <Star className="h-3 w-3 fill-sage-700 text-sage-700" />
                              {stay.feedback}/10
                            </span>
                          )}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </PanelBody>
            </Panel>
          </div>

          <div className="space-y-4">
            <Panel>
              <PanelHeader
                title="At-Risk Guests"
                description="Guests who may not return soon"
                action={
                  <button className="pt-1 text-xs font-medium text-sage-700 hover:text-sage-900">
                    View all
                  </button>
                }
              />
              <PanelBody className="pt-4">
                <ul className="divide-y divide-sand-100">
                  {atRisk.map((person) => (
                    <li key={person.id} className="flex items-center gap-3 py-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sand-100 text-xs font-semibold text-sand-700">
                        {person.name
                          .split(" ")
                          .map((part) => part[0])
                          .join("")}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-sand-950">
                          {person.name}
                        </span>
                        <span className="block text-xs text-sand-500">
                          Last stay: {person.lastStay}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-sand-500">
                        {person.daysSince} days
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                          person.risk === "high"
                            ? "border-rose-200 bg-rose-50 text-rose-700"
                            : "border-gold-200 bg-gold-50 text-gold-800"
                        )}
                      >
                        {person.risk === "high" ? "High Risk" : "At Risk"}
                      </span>
                    </li>
                  ))}
                </ul>
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader
                title={
                  <span className="flex items-center gap-2">
                    <Gift className="h-4 w-4 text-gold-600" />
                    Suggested Offer
                  </span>
                }
                action={
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-sage-200 bg-sage-50 px-2.5 py-0.5 text-xs font-medium text-sage-800">
                    Personalised for this guest
                  </span>
                }
              />
              <PanelBody className="space-y-4 pt-4">
                <div>
                  <p className="font-serif text-lg font-semibold text-sand-950">
                    {suggestedOffer.title}
                  </p>
                  <p className="mt-1 text-sm text-sand-600">{suggestedOffer.detail}</p>

                  <ul className="mt-3 flex flex-wrap gap-2">
                    {suggestedOffer.tags.map((tag) => (
                      <li
                        key={tag}
                        className="rounded-full border border-sand-200 bg-sand-50 px-2.5 py-1 text-xs text-sand-600"
                      >
                        {tag}
                      </li>
                    ))}
                  </ul>
                </div>

                {offerHandled ? (
                  <p
                    className={cn(
                      "rounded-xl border p-3 text-xs",
                      offerHandled === "approved"
                        ? "border-emerald-200 bg-emerald-50/60 text-emerald-800"
                        : "border-sand-200 bg-sand-50 text-sand-600"
                    )}
                  >
                    {offerHandled === "approved"
                      ? "Approved. It will be attached to their next booking and logged to the audit trail."
                      : "Saved. It stays on the shelf until someone approves it."}
                  </p>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setOfferHandled("approved");
                        showToast({
                          title: "Offer approved",
                          description: `Sea view upgrade attached to ${guest.name}'s next stay.`,
                          type: "success",
                        });
                      }}
                    >
                      Approve Offer
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setOfferHandled("saved")}
                    >
                      Save for Later
                    </Button>
                  </div>
                )}
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader
                title="Guest Notes"
                action={
                  <button
                    onClick={() => setTab("notes")}
                    className="pt-1 text-xs font-medium text-sage-700 hover:text-sage-900"
                  >
                    View all
                  </button>
                }
              />
              <PanelBody className="pt-4">
                <ul className="divide-y divide-sand-100">
                  {guest.notes.map((note) => (
                    <li key={note.note} className="py-2.5">
                      <p className="text-sm text-sand-800">{note.note}</p>
                      <p className="mt-0.5 text-xs text-sand-500">
                        {note.source} · {note.date}
                      </p>
                    </li>
                  ))}
                </ul>
              </PanelBody>
            </Panel>
          </div>
        </div>
      )}

      {tab === "stays" && (
        <Panel>
          <PanelHeader title="Every Stay" description="All bookings on record for this guest." />
          <PanelBody className="pt-4">
            <Table>
              <THead>
                <tr>
                  <TH>Check-in</TH>
                  <TH>Check-out</TH>
                  <TH>Room Type</TH>
                  <TH align="right">Nights</TH>
                  <TH align="right">Amount</TH>
                  <TH align="right">Feedback</TH>
                </tr>
              </THead>
              <TBody>
                {guest.stays.map((stay) => (
                  <TR key={stay.checkIn}>
                    <TD className="text-sand-700">{stay.checkIn}</TD>
                    <TD className="text-sand-700">{stay.checkOut}</TD>
                    <TD className="font-medium text-sand-900">{stay.roomType}</TD>
                    <TD align="right" className="text-sand-700">
                      {stay.nights}
                    </TD>
                    <TD align="right" className="text-sand-800">
                      ₹{stay.amount.toLocaleString("en-IN")}
                    </TD>
                    <TD align="right">
                      {stay.feedback === null ? (
                        <span className="text-sand-400">—</span>
                      ) : (
                        <span className="flex justify-end">
                          <StarRating value={Math.round(stay.feedback / 2)} size="sm" />
                        </span>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </PanelBody>
        </Panel>
      )}

      {tab === "preferences" && (
        <Panel>
          <PanelHeader
            title="Preferences"
            description="Gathered from past stays, requests and what the guest has told us."
          />
          <PanelBody className="pt-4">
            <ul className="flex flex-wrap gap-2">
              {guest.preferences.map((pref) => {
                const Icon = pref.icon;
                return (
                  <li
                    key={pref.label}
                    className="flex items-center gap-2 rounded-full border border-sand-200 bg-sand-50/70 px-3.5 py-2 text-sm text-sand-800"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-sand-500" />
                    {pref.label}
                  </li>
                );
              })}
            </ul>
          </PanelBody>
        </Panel>
      )}

      {tab === "notes" && (
        <Panel>
          <PanelHeader title="Notes" description="What colleagues have recorded about this guest." />
          <PanelBody className="pt-4">
            <ul className="divide-y divide-sand-100">
              {guest.notes.map((note) => (
                <li key={note.note} className="py-3">
                  <p className="text-sm text-sand-800">{note.note}</p>
                  <p className="mt-0.5 text-xs text-sand-500">
                    {note.source} · {note.date}
                  </p>
                </li>
              ))}
            </ul>
          </PanelBody>
        </Panel>
      )}

      {(tab === "communications" || tab === "activity") && (
        <Panel>
          <PanelBody className="py-14 text-center">
            <h3 className="font-serif text-lg font-semibold text-sand-950">
              {tab === "communications" ? "Communications" : "Activity"} lands on Day 9
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-sand-600">
              {tab === "communications"
                ? "Every message sent to this guest and whether it was delivered."
                : "A single timeline of stays, orders, requests and ratings."}
            </p>
          </PanelBody>
        </Panel>
      )}
    </div>
  );
}
