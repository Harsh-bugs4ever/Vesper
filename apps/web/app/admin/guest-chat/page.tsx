"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Activity,
  BookOpen,
  Bot,
  BrainCircuit,
  CalendarCheck,
  CheckCircle2,
  Clock,
  ConciergeBell,
  Cpu,
  Database,
  FileText,
  Gift,
  Layers,
  MoreHorizontal,
  NotebookPen,
  Paperclip,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  SquareCheck,
  Trash2,
  User,
  UserRound,
  UtensilsCrossed,
  Wifi,
  Zap,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import { VesperMark } from "@/components/layout/vesper-mark";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  from: "user" | "assistant";
  text: string;
  time: string;
  sources?: string[];
}

const SOURCE_ICONS: Record<string, typeof BookOpen> = {
  "Live Inventory": BookOpen,
  "Rate Policy": FileText,
  "Late Checkout Policy": FileText,
  "Front Desk": ConciergeBell,
  "Front Desk SOP": ConciergeBell,
  "F&B Menu": UtensilsCrossed,
  "Guest Preferences": UserRound,
  "In-Room Dining": UtensilsCrossed,
  "Dining Hours": Clock,
  "Culinary Guidelines": UtensilsCrossed,
  "Spa Directory": Sparkles,
  "Wellness Services": Sparkles,
  "IT Policy": Wifi,
  "Guest Services": ConciergeBell,
  "Housekeeping Dispatch": Layers,
  "SLA Guidelines": CheckCircle2,
  "Transport Desk": FileText,
  "Concierge Guide": BookOpen,
  "Loyalty Matrix": ShieldCheck,
  "Hotel Knowledge Base": Database,
  "Operations SOP": BrainCircuit,
};

const SUGGESTED_PROMPTS = [
  {
    icon: Sparkles,
    label: "Room Upgrade Availability",
    prompt: "Do we have sea-facing rooms available for an upgrade tonight?",
  },
  {
    icon: Clock,
    label: "Late Checkout Policy",
    prompt: "What is the late checkout policy for Gold Elite guests?",
  },
  {
    icon: UtensilsCrossed,
    label: "Jain & Dietary Dining",
    prompt: "What are the Jain meal options and dinner timings at The Verandah?",
  },
  {
    icon: ConciergeBell,
    label: "Spa & Wellness Hours",
    prompt: "What are the spa operating hours and available wellness treatments?",
  },
  {
    icon: Wifi,
    label: "Guest Wi-Fi Setup",
    prompt: "What are the Wi-Fi network credentials and speed limits for in-house guests?",
  },
];

const GUEST_PREFERENCES = [
  "Sea-facing room",
  "Late checkout",
  "Jain meal (no onion/garlic)",
  "High-speed Wi-Fi",
  "Extra pillows",
];

const GUEST_ACTIVITY = [
  { label: "Upgrade inquiry", time: "10:14 AM", live: true },
  { label: "Late checkout request", time: "10:15 AM", live: true },
  { label: "Jain meal request", time: "10:16 AM", live: true },
  { label: "Room service order", time: "17 Nov, 08:12 PM", live: false },
  { label: "Check-in completed", time: "18 Nov, 02:05 PM", live: false },
];

export default function GuestChatPage() {
  const { showToast } = useToast();
  const { user } = useAuth();

  const userName = user?.name || "Arjun Mehta";
  const userRole = user?.roleTitle || "General Manager";
  const userInitials =
    userName
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "AM";

  // Clean initial state without dummy chats
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [rightTab, setRightTab] = useState<"ai-intel" | "guest-file">("ai-intel");
  const endRef = useRef<HTMLDivElement>(null);

  // Keep newest message in view
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, thinking]);

  const handleSend = (textToSend?: string) => {
    const text = (textToSend ?? draft).trim();
    if (!text || thinking) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      from: "user",
      text,
      time: new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }),
    };

    setMessages((current) => [...current, userMessage]);
    if (!textToSend) {
      setDraft("");
    }
    setThinking(true);

    // AI Concierge Engine responds to user queries
    setTimeout(() => {
      const lower = text.toLowerCase();
      let reply = "";
      let sources: string[] = ["Front Desk", "Hotel Knowledge Base"];

      if (
        lower.includes("upgrade") ||
        lower.includes("sea-facing") ||
        lower.includes("sea facing") ||
        lower.includes("suite") ||
        lower.includes("view")
      ) {
        reply =
          "We currently have 2 Executive Sea View Suites available for an upgrade tonight. The prevailing upgrade rate is ₹4,500 + taxes per night. As a Gold Elite guest, complimentary Executive Lounge access and buffet breakfast at The Verandah are included. Would you like me to process this room upgrade?";
        sources = ["Live Inventory", "Rate Policy", "Loyalty Matrix"];
      } else if (
        lower.includes("checkout") ||
        lower.includes("check out") ||
        lower.includes("late")
      ) {
        reply =
          "Standard checkout is at 11:00 AM. In-house Gold Elite guests are eligible for complimentary late checkout until 2:00 PM, subject to room availability. For extensions up to 6:00 PM, a half-day tariff of ₹2,500 + taxes applies.";
        sources = ["Late Checkout Policy", "Front Desk SOP", "Guest Services"];
      } else if (
        lower.includes("jain") ||
        lower.includes("breakfast") ||
        lower.includes("dinner") ||
        lower.includes("food") ||
        lower.includes("restaurant") ||
        lower.includes("dining") ||
        lower.includes("meal")
      ) {
        reply =
          "The Verandah offers an authentic Sattvic & Jain culinary selection prepared strictly without onion, garlic, or root vegetables. Breakfast buffet runs from 6:30 AM to 10:30 AM (until 11:00 AM on weekends), and dinner begins at 7:00 PM. 24/7 in-room dining is also available.";
        sources = ["F&B Menu", "Dining Hours", "In-Room Dining"];
      } else if (
        lower.includes("spa") ||
        lower.includes("pool") ||
        lower.includes("massage") ||
        lower.includes("gym") ||
        lower.includes("wellness")
      ) {
        reply =
          "Vesper Wellness Spa & Gym is located on Level 3. The fitness center and pool are open daily from 6:00 AM to 10:00 PM, while holistic Ayurvedic therapies and massage slots are available from 8:00 AM to 9:00 PM. Shall I reserve a slot for you?";
        sources = ["Spa Directory", "Wellness Services"];
      } else if (
        lower.includes("wifi") ||
        lower.includes("internet") ||
        lower.includes("network") ||
        lower.includes("password")
      ) {
        reply =
          "High-speed property-wide Wi-Fi is complimentary for all in-house guests. Connect to network 'Vesper_Guest' and authenticate with the guest room number and last name. Gold Elite members receive unthrottled bandwidth up to 200 Mbps.";
        sources = ["IT Policy", "Guest Services"];
      } else if (
        lower.includes("pillow") ||
        lower.includes("towel") ||
        lower.includes("clean") ||
        lower.includes("housekeeping")
      ) {
        reply =
          "Housekeeping dispatch is active on all guest floors. A floor attendant can deliver extra hypoallergenic pillows, fresh bath sheets, or evening turndown service within 10 minutes.";
        sources = ["Housekeeping Dispatch", "SLA Guidelines"];
      } else if (
        lower.includes("airport") ||
        lower.includes("cab") ||
        lower.includes("taxi") ||
        lower.includes("car")
      ) {
        reply =
          "Chhatrapati Shivaji Maharaj International Airport (BOM) is approximately 30 minutes away. Our luxury hotel BMW 5-Series transfer can be scheduled for ₹3,200 net. City cabs can also pull up to the main porch.";
        sources = ["Transport Desk", "Concierge Guide"];
      } else {
        reply = `I have received your inquiry: "${text}". Based on current property policies and live hotel systems, all services are operating normally. I can dispatch an action to Front Desk, Housekeeping, or F&B as needed. How would you like to proceed?`;
        sources = ["Hotel Knowledge Base", "Front Desk", "Operations SOP"];
      }

      setMessages((current) => [
        ...current,
        {
          id: `msg-${Date.now() + 1}`,
          from: "assistant",
          text: reply,
          time: new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }),
          sources,
        },
      ]);
      setThinking(false);
    }, 900);
  };

  const handleClearChat = () => {
    setMessages([]);
    showToast({
      title: "Chat cleared",
      description: "Chat history has been reset.",
      type: "default",
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Guest Chat & AI Concierge"
        description="Autonomous AI Agent resolving guest requests, policy queries, and operations in real time"
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        {/* Chat Thread Panel */}
        <Panel className="flex h-[720px] flex-col">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-200/80 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gold-400/40 bg-gradient-to-br from-gold-100 to-sand-50 shadow-xs">
                <VesperMark className="h-6 w-6 text-gold-600" />
                <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                </span>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-serif text-lg font-semibold leading-tight text-sand-950">
                    Vesper AI Agent
                  </p>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                    AI Agent Active
                  </span>
                </div>
                <p className="text-xs text-sand-500">
                  Autonomous Hotel Concierge · Groq Llama 3.3
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearChat}
                  className="text-sand-600 hover:text-sand-900 hover:bg-sand-100"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1 text-sand-400" />
                  Clear Chat
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  showToast({
                    title: "Escalated to Front Desk",
                    description: "Duty Manager has been notified to follow up on this thread.",
                    type: "success",
                  })
                }
              >
                <UserRound className="h-3.5 w-3.5 mr-1" />
                Escalate to Front Desk
              </Button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center py-8 px-4 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-gold-200/80 bg-gradient-to-br from-gold-100 via-sand-50 to-sand-100 shadow-sm">
                  <VesperMark className="h-8 w-8 text-gold-600" />
                </div>
                <h3 className="mb-1 font-serif text-xl font-medium text-sand-900">
                  How can Vesper AI help you today?
                </h3>
                <p className="mb-6 max-w-md text-xs text-sand-500 sm:text-sm">
                  The AI Concierge responds with verified property policies, live room inventory,
                  Jain dining options, and operational dispatch.
                </p>

                <div className="w-full max-w-lg space-y-2">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-sand-400">
                    Suggested Inquiries
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {SUGGESTED_PROMPTS.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.label}
                          onClick={() => handleSend(item.prompt)}
                          className="group flex items-center gap-2.5 rounded-xl border border-sand-200/90 bg-white/90 p-3 text-left transition hover:border-gold-300 hover:bg-gold-50/40 hover:shadow-xs"
                        >
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sand-100 text-sand-600 transition-colors group-hover:bg-gold-100 group-hover:text-gold-700">
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-sand-800 group-hover:text-sand-950">
                              {item.label}
                            </p>
                            <p className="truncate text-[11px] text-sand-400">{item.prompt}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((message) =>
                message.from === "user" ? (
                  <div key={message.id} className="flex items-start justify-end gap-2.5">
                    <div className="max-w-[78%]">
                      <div className="rounded-2xl rounded-tr-sm bg-sand-900 px-4 py-3 text-white shadow-xs">
                        <p className="text-sm leading-relaxed">{message.text}</p>
                      </div>
                      <div className="mt-1 flex items-center justify-end gap-1.5 text-xs text-sand-400">
                        <span>{userName}</span>
                        <span>·</span>
                        <span>{message.time}</span>
                      </div>
                    </div>
                    <span
                      title={`${userName} (${userRole})`}
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sand-200 text-xs font-semibold text-sand-800"
                    >
                      {userInitials}
                    </span>
                  </div>
                ) : (
                  <div key={message.id} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold-200/80 bg-gold-50 shadow-xs">
                      <VesperMark className="h-4 w-4 text-gold-600" />
                    </span>

                    <div className="max-w-[78%]">
                      <div className="rounded-2xl rounded-tl-sm border border-sand-200 bg-white px-4 py-3 shadow-xs">
                        <div className="mb-1 flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-sand-900">
                            Vesper AI Agent
                          </span>
                          <span className="rounded bg-gold-100 px-1.5 py-0.5 text-[10px] font-medium text-gold-800">
                            Concierge
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-sand-900">{message.text}</p>
                      </div>

                      {message.sources && message.sources.length > 0 && (
                        <ul className="mt-1.5 flex flex-wrap gap-1.5">
                          {message.sources.map((source) => {
                            const Icon = SOURCE_ICONS[source] ?? FileText;
                            return (
                              <li
                                key={source}
                                className="flex items-center gap-1.5 rounded-lg border border-sand-200 bg-sand-50/90 px-2 py-1 text-xs text-sand-600"
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
              )
            )}

            {thinking && (
              <div className="flex items-start gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold-200/80 bg-gold-50">
                  <VesperMark className="h-4 w-4 text-gold-600" />
                </span>
                <div
                  className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-sand-200 bg-white px-4 py-3 shadow-xs"
                  role="status"
                  aria-label="Vesper AI is typing"
                >
                  <span className="text-xs text-sand-500">Retrieving sources</span>
                  <div className="flex items-center gap-1">
                    {[0, 1, 2].map((dot) => (
                      <span
                        key={dot}
                        className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold-500"
                        style={{ animationDelay: `${dot * 150}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div ref={endRef} />
          </div>

          {/* Input Box */}
          <div className="flex items-center gap-2 border-t border-sand-200/80 px-5 py-4">
            <button
              className="rounded-xl border border-sand-200 p-2.5 text-sand-500 transition-colors hover:bg-sand-50"
              aria-label="Attach a file"
              onClick={() =>
                showToast({
                  title: "Document Attachment",
                  description: "Upload policy documents or guest folios to analyze.",
                  type: "default",
                })
              }
            >
              <Paperclip className="h-4 w-4" />
            </button>

            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask Vesper AI about room upgrades, Jain food, policies..."
              aria-label="Message"
              className="flex-1 rounded-xl border border-sand-200 bg-white px-4 py-2.5 text-sm text-sand-900 placeholder:text-sand-400 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500"
            />

            <button
              onClick={() => handleSend()}
              disabled={draft.trim() === "" || thinking}
              className="rounded-xl bg-gold-600 p-2.5 text-white shadow-xs transition-colors hover:bg-gold-700 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </Panel>

        {/* Right Context Panel (AI Intelligence & In-House Guest File) */}
        <div className="space-y-4">
          {/* Tab Navigation */}
          <div className="flex rounded-xl border border-sand-200 bg-sand-100/60 p-1">
            <button
              onClick={() => setRightTab("ai-intel")}
              className={cn(
                "flex-1 rounded-lg py-1.5 text-xs font-medium transition",
                rightTab === "ai-intel"
                  ? "bg-white text-sand-950 shadow-xs"
                  : "text-sand-600 hover:text-sand-900"
              )}
            >
              AI Agent Intel
            </button>
            <button
              onClick={() => setRightTab("guest-file")}
              className={cn(
                "flex-1 rounded-lg py-1.5 text-xs font-medium transition",
                rightTab === "guest-file"
                  ? "bg-white text-sand-950 shadow-xs"
                  : "text-sand-600 hover:text-sand-900"
              )}
            >
              Guest File (Room 608)
            </button>
          </div>

          {rightTab === "ai-intel" ? (
            <>
              {/* AI Agent Status Card */}
              <Panel>
                <PanelBody className="space-y-3.5">
                  <div className="flex items-center justify-between border-b border-sand-200/80 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-100 text-gold-700">
                        <Cpu className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-sand-950">Groq Llama 3.3 70B</p>
                        <p className="text-xs text-sand-500">RAG Engine · Retrieval Augmented</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                      Live
                    </span>
                  </div>

                  <dl className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-sand-50/80 p-2 border border-sand-200/60">
                      <dt className="text-sand-400 text-[10px]">Latency</dt>
                      <dd className="font-semibold text-sand-900 mt-0.5">420 ms</dd>
                    </div>
                    <div className="rounded-lg bg-sand-50/80 p-2 border border-sand-200/60">
                      <dt className="text-sand-400 text-[10px]">Indexed</dt>
                      <dd className="font-semibold text-sand-900 mt-0.5">142 docs</dd>
                    </div>
                    <div className="rounded-lg bg-sand-50/80 p-2 border border-sand-200/60">
                      <dt className="text-sand-400 text-[10px]">Method</dt>
                      <dd className="font-semibold text-sand-900 mt-0.5">BM25 + RAG</dd>
                    </div>
                  </dl>
                </PanelBody>
              </Panel>

              {/* Connected Knowledge Bases */}
              <Panel>
                <PanelHeader
                  title="Connected Knowledge Bases"
                  action={
                    <button
                      onClick={() =>
                        showToast({
                          title: "Knowledge Bases Verified",
                          description: "All 5 property knowledge bases are synchronized.",
                          type: "success",
                        })
                      }
                      className="pt-1 text-xs font-medium text-gold-700 hover:text-gold-900"
                    >
                      Sync All
                    </button>
                  }
                />
                <PanelBody className="pt-3">
                  <ul className="space-y-2">
                    {[
                      {
                        name: "Live Inventory & Rate Policies",
                        source: "PMS / Channel Manager",
                        status: "Synced",
                      },
                      {
                        name: "Front Desk & Late Checkout SOP",
                        source: "Operations Guide",
                        status: "Synced",
                      },
                      {
                        name: "The Verandah & Jain Dining Menus",
                        source: "F&B POS",
                        status: "Synced",
                      },
                      {
                        name: "Vesper Wellness Spa & Gym Directory",
                        source: "Spa Services",
                        status: "Synced",
                      },
                      {
                        name: "IT Infrastructure & Guest Wi-Fi",
                        source: "IT Network",
                        status: "Synced",
                      },
                    ].map((kb) => (
                      <li
                        key={kb.name}
                        className="flex items-center justify-between rounded-lg border border-sand-200/70 bg-sand-50/50 p-2.5 text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-medium text-sand-900 truncate">{kb.name}</p>
                          <p className="text-[11px] text-sand-400">{kb.source}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-emerald-100/80 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                          {kb.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                </PanelBody>
              </Panel>

              {/* Quick AI Actions */}
              <Panel>
                <PanelHeader title="Operational Shortcuts" />
                <PanelBody className="grid grid-cols-2 gap-2 pt-3">
                  {[
                    {
                      label: "Check Upgrades",
                      prompt: "What room upgrades are available tonight and at what rates?",
                      icon: Sparkles,
                    },
                    {
                      label: "Late Checkout",
                      prompt: "Review late checkout requests and policies for today",
                      icon: Clock,
                    },
                    {
                      label: "Jain Dinners",
                      prompt: "What Jain meal options are available for in-room dining?",
                      icon: UtensilsCrossed,
                    },
                    {
                      label: "Spa Schedule",
                      prompt: "What are the spa treatment hours and available therapists?",
                      icon: ConciergeBell,
                    },
                  ].map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.label}
                        onClick={() => handleSend(action.prompt)}
                        className="flex flex-col items-center gap-1.5 rounded-xl border border-sand-200 p-3 text-center text-xs font-medium text-sand-700 transition hover:border-gold-300 hover:bg-gold-50/40"
                      >
                        <Icon className="h-4 w-4 text-gold-600" />
                        <span>{action.label}</span>
                      </button>
                    );
                  })}
                </PanelBody>
              </Panel>
            </>
          ) : (
            <>
              {/* In-House Guest File (Clarifying Ananya Kapoor is an In-House Guest) */}
              <Panel>
                <PanelBody className="space-y-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sand-200 text-sm font-semibold text-sand-800">
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
                      <p className="text-xs font-medium text-sage-700">In-House Guest</p>
                      <p className="text-xs text-sand-500">Mumbai, India · +91 98765 43210</p>
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

              {/* Guest Preferences */}
              <Panel>
                <PanelHeader
                  title="Guest Stay Preferences"
                  action={
                    <button className="pt-1 text-xs font-medium text-sage-700 hover:text-sage-900">
                      Edit
                    </button>
                  }
                />
                <PanelBody className="pt-4">
                  <ul className="flex flex-wrap gap-2">
                    {GUEST_PREFERENCES.map((pref) => (
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

              {/* Recent Activity */}
              <Panel>
                <PanelHeader
                  title="Recent Guest Activity"
                  action={
                    <button className="pt-1 text-xs font-medium text-sage-700 hover:text-sage-900">
                      View all
                    </button>
                  }
                />
                <PanelBody className="pt-4">
                  <ul className="space-y-2.5">
                    {GUEST_ACTIVITY.map((item) => (
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

              {/* Actions for this guest */}
              <Panel>
                <PanelHeader title="Guest Actions" />
                <PanelBody className="grid grid-cols-2 gap-2 pt-4 sm:grid-cols-4 xl:grid-cols-2">
                  {[
                    { label: "Add Note", icon: NotebookPen },
                    { label: "Create Task", icon: SquareCheck },
                    { label: "Send Offer", icon: Gift },
                    { label: "View Profile", icon: UserRound },
                  ].map((action) => {
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
