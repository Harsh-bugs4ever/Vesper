"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  CalendarCheck,
  ConciergeBell,
  FileText,
  Gift,
  MoreHorizontal,
  NotebookPen,
  Paperclip,
  Send,
  SquareCheck,
  UserRound,
  UtensilsCrossed,
} from "lucide-react";

import { VesperMark } from "@/components/layout/vesper-mark";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/**
 * The concierge thread, as a staff member sees it.
 *
 * Every assistant message carries the sources it answered from. That is not decoration:
 * a concierge that can quote the late check-out policy is useful, and one that invents
 * it costs the property a refund, so the answer and its provenance travel together.
 */

interface Message {
  id: string;
  from: "guest" | "assistant";
  text: string;
  time: string;
  sources?: string[];
}

const THREAD: Message[] = [
  {
    id: "m1",
    from: "guest",
    text: "Hi, do you have a sea-facing room available for an upgrade tonight?",
    time: "10:14 AM",
  },
  {
    id: "m2",
    from: "assistant",
    text: "Yes, we do have sea-facing rooms available for an upgrade tonight. The current upgrade rate is ₹4,500 + taxes per night for a Sea View Executive Room. Would you like me to proceed with the upgrade?",
    time: "10:14 AM",
    sources: ["Live Inventory", "Rate Policy"],
  },
  {
    id: "m3",
    from: "guest",
    text: "That sounds good. Can I also get a late checkout tomorrow?",
    time: "10:15 AM",
  },
  {
    id: "m4",
    from: "assistant",
    text: "Certainly! I've noted a late check-out request for 2:00 PM tomorrow, subject to availability. I'll confirm this with our front desk and update you shortly.",
    time: "10:16 AM",
    sources: ["Late Checkout Policy", "Front Desk"],
  },
  {
    id: "m5",
    from: "guest",
    text: "Thank you! Also, is it possible to have a Jain meal for dinner tonight?",
    time: "10:16 AM",
  },
  {
    id: "m6",
    from: "assistant",
    text: "Absolutely. I've shared your Jain meal preference with our F&B team. You can order from our Jain menu, or I can place the order for you now.",
    time: "10:17 AM",
    sources: ["F&B Menu", "Guest Preferences", "In-Room Dining"],
  },
];

const SOURCE_ICONS: Record<string, typeof BookOpen> = {
  "Live Inventory": BookOpen,
  "Rate Policy": FileText,
  "Late Checkout Policy": FileText,
  "Front Desk": ConciergeBell,
  "F&B Menu": UtensilsCrossed,
  "Guest Preferences": UserRound,
  "In-Room Dining": UtensilsCrossed,
};

const ACTIVITY = [
  { label: "Upgrade inquiry", time: "10:14 AM", live: true },
  { label: "Late checkout request", time: "10:15 AM", live: true },
  { label: "Jain meal request", time: "10:16 AM", live: true },
  { label: "Room service order", time: "17 Nov, 08:12 PM", live: false },
  { label: "Check-in completed", time: "18 Nov, 02:05 PM", live: false },
];

const PREFERENCES = ["Sea-facing room", "Late checkout", "Jain meal (no onion/garlic)", "High-speed Wi-Fi", "Extra pillows"];

const QUICK_ACTIONS = [
  { label: "Add Note", icon: NotebookPen },
  { label: "Create Task", icon: SquareCheck },
  { label: "Send Offer", icon: Gift },
  { label: "View Profile", icon: UserRound },
];

export default function GuestChatPage() {
  const { showToast } = useToast();

  const [messages, setMessages] = useState<Message[]>(THREAD);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view as the thread grows.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, thinking]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;

    setMessages((current) => [
      ...current,
      {
        id: `m${current.length + 1}`,
        from: "guest",
        text,
        time: new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }),
      },
    ]);
    setDraft("");
    setThinking(true);
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Guest Chat" description="Real-time support, happier guests" />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        {/* Thread */}
        <Panel className="flex h-[720px] flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-200/80 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sand-100 text-sm font-semibold text-sand-700">
                AK
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-serif text-lg font-semibold leading-tight text-sand-950">
                    Ananya Kapoor
                  </p>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-sage-200 bg-sage-50 px-2.5 py-0.5 text-xs font-medium text-sage-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-sage-600" />
                    In House
                  </span>
                </div>
                <p className="text-xs text-sand-500">Room 608 · JW Marriott Mumbai</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="rounded-lg p-2 text-sand-500 transition-colors hover:bg-sand-100"
                aria-label="More options"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  showToast({
                    title: "Escalated to the front desk",
                    description: "Priya Nair has picked this thread up.",
                    type: "success",
                  })
                }
              >
                <UserRound className="h-3.5 w-3.5" />
                Escalate to Front Desk
              </Button>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {messages.map((message) =>
              message.from === "guest" ? (
                <div key={message.id} className="flex items-start justify-end gap-2.5">
                  <div className="max-w-[78%]">
                    <div className="rounded-2xl rounded-tr-sm bg-sage-50 px-4 py-3">
                      <p className="text-sm leading-relaxed text-sand-900">{message.text}</p>
                    </div>
                    <p className="mt-1 text-right text-xs text-sand-400">{message.time}</p>
                  </div>
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sand-100 text-xs font-semibold text-sand-700">
                    AK
                  </span>
                </div>
              ) : (
                <div key={message.id} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-50">
                    <VesperMark className="h-4 w-4 text-gold-600" />
                  </span>

                  <div className="max-w-[78%]">
                    <div className="rounded-2xl rounded-tl-sm border border-sand-200 bg-white px-4 py-3">
                      <p className="text-sm leading-relaxed text-sand-900">{message.text}</p>
                    </div>

                    {message.sources && (
                      <ul className="mt-1.5 flex flex-wrap gap-1.5">
                        {message.sources.map((source) => {
                          const Icon = SOURCE_ICONS[source] ?? FileText;
                          return (
                            <li
                              key={source}
                              className="flex items-center gap-1.5 rounded-lg border border-sand-200 bg-sand-50 px-2 py-1 text-xs text-sand-600"
                            >
                              <Icon className="h-3 w-3 shrink-0 text-sand-400" />
                              {source}
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    <p className="mt-1 text-xs text-sand-400">{message.time}</p>
                  </div>
                </div>
              )
            )}

            {thinking && (
              <div className="flex items-start gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-50">
                  <VesperMark className="h-4 w-4 text-gold-600" />
                </span>
                <div
                  className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-sand-200 bg-white px-4 py-3.5"
                  role="status"
                  aria-label="Assistant is typing"
                >
                  {[0, 1, 2].map((dot) => (
                    <span
                      key={dot}
                      className="h-1.5 w-1.5 animate-pulse rounded-full bg-sand-400"
                      style={{ animationDelay: `${dot * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div ref={endRef} />
          </div>

          <div className="flex items-center gap-2 border-t border-sand-200/80 px-5 py-4">
            <button
              className="rounded-xl border border-sand-200 p-2.5 text-sand-500 transition-colors hover:bg-sand-50"
              aria-label="Attach a file"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              placeholder="Type a message..."
              aria-label="Message"
              className="flex-1 rounded-xl border border-sand-200 bg-white px-4 py-2.5 text-sm text-sand-900 placeholder:text-sand-400 focus:border-sage-500 focus:outline-none focus:ring-1 focus:ring-sage-500"
            />

            <button
              onClick={send}
              disabled={draft.trim() === ""}
              className="rounded-xl bg-sage-600 p-2.5 text-white transition-colors hover:bg-sage-700 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </Panel>

        {/* Guest context */}
        <div className="space-y-4">
          <Panel>
            <PanelBody className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sand-100 text-sm font-semibold text-sand-700">
                  AK
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-serif text-lg font-semibold leading-tight text-sand-950">
                      Ananya Kapoor
                    </p>
                    <span className="rounded-full border border-gold-200 bg-gold-50 px-2 py-0.5 text-xs font-medium text-gold-800">
                      Gold Elite
                    </span>
                  </div>
                  <p className="text-xs text-sand-500">Mumbai, India</p>
                  <p className="text-xs text-sand-500">+91 98765 43210</p>
                  <p className="truncate text-xs text-sand-500">ananya.kapoor@gmail.com</p>
                </div>
              </div>

              <dl className="grid grid-cols-3 gap-3 border-t border-sand-200/80 pt-4 text-sm">
                {[
                  { label: "Room", value: "608", sub: "Executive Sea View" },
                  { label: "Check-in", value: "18 Nov", sub: "2026" },
                  { label: "Check-out", value: "21 Nov", sub: "2026" },
                  { label: "Nights", value: "3", sub: null },
                  { label: "Total Spend", value: "₹62,700", sub: null },
                ].map((item) => (
                  <div key={item.label}>
                    <dt className="text-xs text-sand-500">{item.label}</dt>
                    <dd className="font-medium text-sand-950">{item.value}</dd>
                    {item.sub && <dd className="text-xs text-sand-500">{item.sub}</dd>}
                  </div>
                ))}
              </dl>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              title="Preferences"
              action={
                <button className="pt-1 text-xs font-medium text-sage-700 hover:text-sage-900">
                  Edit
                </button>
              }
            />
            <PanelBody className="pt-4">
              <ul className="flex flex-wrap gap-2">
                {PREFERENCES.map((pref) => (
                  <li
                    key={pref}
                    className="rounded-full border border-sand-200 bg-sand-50/70 px-3 py-1.5 text-xs text-sand-800"
                  >
                    {pref}
                  </li>
                ))}
              </ul>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              title="Recent Activity"
              action={
                <button className="pt-1 text-xs font-medium text-sage-700 hover:text-sage-900">
                  View all
                </button>
              }
            />
            <PanelBody className="pt-4">
              <ul className="space-y-2.5">
                {ACTIVITY.map((item) => (
                  <li key={item.label} className="flex items-center gap-2.5 text-sm">
                    <span
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full",
                        item.live ? "bg-sage-600" : "bg-sand-300"
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate text-sand-800">{item.label}</span>
                    <span className="shrink-0 text-xs text-sand-400">{item.time}</span>
                  </li>
                ))}
              </ul>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Quick Actions" />
            <PanelBody className="grid grid-cols-2 gap-2 pt-4 sm:grid-cols-4 xl:grid-cols-2">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    onClick={() =>
                      showToast({
                        title: action.label,
                        description: `${action.label} for Ananya Kapoor.`,
                        type: "default",
                      })
                    }
                    className="flex flex-col items-center gap-2 rounded-xl border border-sand-200 px-3 py-4 text-xs font-medium text-sand-700 transition-colors hover:bg-sand-50"
                  >
                    <Icon className="h-4 w-4 text-sand-500" />
                    {action.label}
                  </button>
                );
              })}
            </PanelBody>
          </Panel>
        </div>
      </div>
    </div>
  );
}
