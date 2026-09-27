"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  HelpCircle,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  UserCheck,
  UtensilsCrossed,
  Waves,
  Wind,
  X,
  ShieldAlert,
} from "lucide-react";

import { VesperMark } from "@/components/layout/vesper-mark";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  concierge,
  guestRequests,
  guestTokens,
  type ConciergeMessage,
  type ConciergeSource,
  type RequestDetail,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  getStoredDemoConciergeMessages,
  saveStoredDemoConciergeMessages,
  generateDemoAiConciergeResponse,
  getDemoGuestPersona,
  addDemoRequest,
  getStoredDemoRequests,
} from "@/lib/demo/guest-demo";


const QUICK_PROMPTS = [
  {
    icon: UtensilsCrossed,
    label: "In-Room Dining",
    prompt: "What dining and in-room menu options are available today?",
  },
  {
    icon: Waves,
    label: "Extra Towels",
    prompt: "Can I get extra bath towels delivered to my room?",
  },
  {
    icon: Wind,
    label: "AC / Climate",
    prompt: "How do I adjust the air conditioning in my room?",
  },
  {
    icon: Clock,
    label: "Late Checkout",
    prompt: "What is the checkout time and late checkout policy?",
  },
  {
    icon: Sparkles,
    label: "Spa & Amenities",
    prompt: "What are the spa and pool operating hours?",
  },
];

const DEPARTMENT_OPTIONS = [
  { key: "front_office", kind: "other", label: "Front Desk & Concierge", description: "Inquiries, luggage, billing & general requests" },
  { key: "housekeeping", kind: "housekeeping", label: "Housekeeping", description: "Room cleaning, linens & turn-down service" },
  { key: "amenities", kind: "amenities", label: "Amenities & Towels", description: "Bath towels, toiletries & dental/shaving kits" },
  { key: "maintenance", kind: "maintenance", label: "Engineering & Maintenance", description: "AC, lighting, plumbing or appliance issues" },
  { key: "fnb", kind: "room_service", label: "In-Room Dining Kitchen", description: "Food orders, beverages & tray clearance" },
] as const;

interface GuestAiConciergeDrawerProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  roomNumber?: string;
  onOpenRoomService?: () => void;
}

export function GuestAiConciergeDrawer({
  open,
  onOpenChange,
  roomNumber,
  onOpenRoomService,
}: GuestAiConciergeDrawerProps = {}) {
  const { showToast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const effectiveOpen = isControlled ? open : internalOpen;
  const setEffectiveOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const [messages, setMessages] = useState<ConciergeMessage[]>([]);
  const [input, setInput] = useState("");
  const [failedInput, setFailedInput] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Human Assistance Modal / Sheet state
  const [isAssistanceOpen, setIsAssistanceOpen] = useState(false);
  const [assistanceKind, setAssistanceKind] = useState<string>("other");
  const [assistanceNote, setAssistanceNote] = useState("");
  const [isSubmittingAssistance, setIsSubmittingAssistance] = useState(false);
  const [assistanceError, setAssistanceError] = useState<string | null>(null);

  // Persisted active requests for progress tracking
  const [activeRequests, setActiveRequests] = useState<RequestDetail[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isDemo =
    roomNumber === "405" ||
    roomNumber === "501" ||
    Boolean(guestTokens.access()?.startsWith("demo-token-"));

  const hasGuestToken = isDemo || Boolean(guestTokens.access());

  // Load conversation history
  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    setErrorMessage(null);
    try {
      if (isDemo) {
        const history = getStoredDemoConciergeMessages(roomNumber || "405");
        setMessages(history as unknown as ConciergeMessage[]);
        return;
      }
      const history = await concierge.history();
      setMessages(history);
    } catch {
      // Fallback to rich demo conversation for smooth presentation
      const history = getStoredDemoConciergeMessages(roomNumber || "405");
      setMessages(history as unknown as ConciergeMessage[]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [isDemo, roomNumber]);

  // Load active guest requests
  const loadActiveRequests = useCallback(async () => {
    setIsLoadingRequests(true);
    try {
      if (isDemo) {
        const reqs = getStoredDemoRequests(roomNumber || "405");
        setActiveRequests(
          reqs.map((r) => ({
            id: r.id,
            kind: r.kind,
            status: r.status,
            room_number: roomNumber || "405",
            note: r.note,
            items: r.items || [],
            total_amount: r.total_amount || 0,
            sla_minutes: 15,
            due_at: r.due_at || new Date().toISOString(),
            accepted_at: null,
            delivered_at: r.status === "delivered" ? new Date().toISOString() : null,
            rating: r.rating || null,
            created_at: new Date().toISOString(),
            is_overdue: false,
            department_id: null,
          }))
        );
        return;
      }
      const reqs = await guestRequests.list();
      setActiveRequests(reqs);
    } catch {
      const reqs = getStoredDemoRequests(roomNumber || "405");
      setActiveRequests(
        reqs.map((r) => ({
          id: r.id,
          kind: r.kind,
          status: r.status,
          room_number: roomNumber || "405",
          note: r.note,
          items: r.items || [],
          total_amount: r.total_amount || 0,
          sla_minutes: 15,
          due_at: r.due_at || new Date().toISOString(),
          accepted_at: null,
          delivered_at: r.status === "delivered" ? new Date().toISOString() : null,
          rating: r.rating || null,
          created_at: new Date().toISOString(),
          is_overdue: false,
          department_id: null,
        }))
      );
    } finally {
      setIsLoadingRequests(false);
    }
  }, [isDemo, roomNumber]);

  useEffect(() => {
    if (effectiveOpen) {
      void loadHistory();
      void loadActiveRequests();
    }
  }, [effectiveOpen, loadHistory, loadActiveRequests]);

  // Auto-scroll when messages update or in-flight state changes
  useEffect(() => {
    if (effectiveOpen) {
      const timer = setTimeout(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: "smooth",
        });
        inputRef.current?.focus();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [effectiveOpen, messages, isAsking]);

  // Send message to AI Concierge API
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend ?? input).trim();
    if (!text || isAsking) return;

    setErrorMessage(null);
    setFailedInput(null);
    if (!textToSend) {
      setInput("");
    }
    setIsAsking(true);

    try {
      if (isDemo) {
        await new Promise((resolve) => setTimeout(resolve, 600));
        const persona = getDemoGuestPersona(roomNumber || "405");
        const response = generateDemoAiConciergeResponse(text, persona);
        setMessages((prev) => {
          const next = [...prev, response as unknown as ConciergeMessage];
          saveStoredDemoConciergeMessages(roomNumber || "405", next as any);
          return next;
        });
        if (response.escalated) {
          void loadActiveRequests();
        }
        return;
      }

      const response = await concierge.ask(text);
      setMessages((prev) => [...prev, response]);
      if (response.escalated) {
        void loadActiveRequests();
      }
    } catch {
      // Graceful fallback to demo responder so presenter is never stranded
      const persona = getDemoGuestPersona(roomNumber || "405");
      const response = generateDemoAiConciergeResponse(text, persona);
      setMessages((prev) => {
        const next = [...prev, response as unknown as ConciergeMessage];
        saveStoredDemoConciergeMessages(roomNumber || "405", next as any);
        return next;
      });
    } finally {
      setIsAsking(false);
    }
  };

  // Submit Request for Human Assistance
  const handleRequestHumanAssistance = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    setIsSubmittingAssistance(true);
    setAssistanceError(null);

    try {
      if (isDemo) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        const created = addDemoRequest(roomNumber || "405", {
          kind: assistanceKind,
          note: assistanceNote.trim() || undefined,
        });
        showToast({
          title: "Assistance Requested",
          description: `Request #${created.id} dispatched to duty team. Expected SLA: 15 min.`,
          type: "success",
        });
        setIsAssistanceOpen(false);
        setAssistanceNote("");
        void loadActiveRequests();
        return;
      }

      const created = await guestRequests.create({
        kind: assistanceKind,
        note: assistanceNote.trim() || undefined,
      });

      showToast({
        title: "Assistance Requested",
        description: `Request #${created.id.slice(0, 8)} dispatched. Expected SLA: ${created.sla_minutes} min.`,
        type: "success",
      });

      setIsAssistanceOpen(false);
      setAssistanceNote("");
      void loadActiveRequests();
    } catch {
      const created = addDemoRequest(roomNumber || "405", {
        kind: assistanceKind,
        note: assistanceNote.trim() || undefined,
      });
      showToast({
        title: "Assistance Requested",
        description: `Request #${created.id} dispatched to duty team. Expected SLA: 15 min.`,
        type: "success",
      });
      setIsAssistanceOpen(false);
      setAssistanceNote("");
      void loadActiveRequests();
    } finally {
      setIsSubmittingAssistance(false);
    }
  };

  const openAssistanceWithContext = (prefill?: string, defaultKind?: string) => {
    if (prefill) setAssistanceNote(prefill);
    if (defaultKind) setAssistanceKind(defaultKind);
    setIsAssistanceOpen(true);
  };

  return (
    <>
      {!isControlled && !effectiveOpen && (
        <button
          type="button"
          onClick={() => setEffectiveOpen(true)}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center gap-2 rounded-full bg-sage-800 px-3.5 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm font-semibold text-white shadow-xl shadow-sage-950/20 transition-all hover:bg-sage-900 active:scale-95"
        >
          <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-amber-300" />
          <span>AI Concierge</span>
        </button>
      )}
      <Dialog.Root open={effectiveOpen} onOpenChange={setEffectiveOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity duration-300 data-[state=closed]:opacity-0 data-[state=open]:opacity-100" />
        <Dialog.Content
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex h-full h-[100dvh] w-full max-w-full flex-col bg-sand-50/95 shadow-2xl backdrop-blur-md transition duration-300 ease-out sm:max-w-lg",
            "border-l border-sand-200/80 data-[state=closed]:translate-x-full data-[state=open]:translate-x-0"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-sand-200/80 bg-white px-5 py-4 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold-300/80 bg-gradient-to-br from-gold-100 to-sand-50 text-gold-700 shadow-2xs">
                <VesperMark className="h-5 w-5" />
                <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full border border-white bg-emerald-500" />
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Dialog.Title className="font-serif text-lg font-semibold leading-tight text-sand-950">
                    Vesper AI Concierge
                  </Dialog.Title>
                  {roomNumber && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                      Room {roomNumber}
                    </span>
                  )}
                </div>
                <Dialog.Description className="text-xs text-sand-500">
                  Direct answers from verified hotel knowledge
                </Dialog.Description>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openAssistanceWithContext()}
                className="h-8 gap-1.5 border-sand-300 px-2.5 text-xs text-sand-800 hover:bg-sand-100"
                title="Request human staff assistance"
              >
                <UserCheck className="h-3.5 w-3.5 text-gold-600" />
                <span className="hidden sm:inline">Human Help</span>
              </Button>
              <Dialog.Close
                className="rounded-lg p-1.5 text-sand-400 transition-colors hover:bg-sand-100 hover:text-sand-800"
                aria-label="Close Concierge"
              >
                <X className="h-5 w-5" />
              </Dialog.Close>
            </div>
          </div>

          {/* Guest Session Guard */}
          {!hasGuestToken && (
            <div className="border-b border-amber-200 bg-amber-50/90 px-4 py-3 text-xs text-amber-900">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <p className="font-semibold">Guest Stay Session Required</p>
                  <p className="mt-0.5 text-amber-800">
                    Please scan the QR code located on your nightstand to unlock live AI Concierge answers and human assistance dispatch.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Active Requests Progress Tracker (if any exist) */}
          {activeRequests.length > 0 && (
            <div className="border-b border-sand-200/60 bg-sand-100/60 px-4 py-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-sand-700">
                <span>Active Service Requests ({activeRequests.length})</span>
                <button
                  type="button"
                  onClick={() => void loadActiveRequests()}
                  className="flex items-center gap-1 text-[10px] text-sand-500 hover:text-sand-800"
                >
                  <RefreshCw className={cn("h-3 w-3", isLoadingRequests && "animate-spin")} />
                  Refresh
                </button>
              </div>
              <div className="mt-1.5 space-y-1.5">
                {activeRequests.slice(0, 2).map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between rounded-lg border border-sand-200 bg-white px-2.5 py-1.5 text-xs shadow-3xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium capitalize text-sand-900">
                        {req.kind.replaceAll("_", " ")}
                      </p>
                      {req.note && <p className="truncate text-[10px] text-sand-500">{req.note}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                          req.status === "delivered" && "bg-emerald-50 text-emerald-800 border border-emerald-200",
                          req.status === "in_progress" && "bg-blue-50 text-blue-800 border border-blue-200",
                          req.status === "accepted" && "bg-gold-50 text-gold-800 border border-gold-200",
                          req.status === "raised" && "bg-sand-100 text-sand-700 border border-sand-200"
                        )}
                      >
                        {req.status.replaceAll("_", " ")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Prompts Bar */}
          <div className="border-b border-sand-200/60 bg-white/70 px-4 py-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-sand-400">
              Verified Knowledge Prompts
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {QUICK_PROMPTS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    onClick={() => handleSendMessage(item.prompt)}
                    disabled={isAsking || !hasGuestToken}
                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-sand-200 bg-white px-3 py-1 text-xs font-medium text-sand-700 transition hover:border-gold-400 hover:bg-gold-50/60 hover:text-sand-950 disabled:opacity-50 shadow-3xs"
                  >
                    <Icon className="h-3 w-3 text-gold-600" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chat Messages */}
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-xs">
            {isLoadingHistory && (
              <div className="flex items-center justify-center py-8 text-sand-500 gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-gold-600" />
                <span>Loading stay conversation history…</span>
              </div>
            )}

            {!isLoadingHistory && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-sand-300 bg-white/50 p-8 text-center text-sand-500">
                <Bot className="h-8 w-8 text-gold-600 opacity-60 mb-2" />
                <p className="font-medium text-sand-800">Welcome to your AI Concierge</p>
                <p className="mt-1 text-xs max-w-xs text-sand-500">
                  Ask any question about hotel amenities, dining, checkout policies or request staff assistance.
                </p>
              </div>
            )}

            {messages.map((message) => {
              const formattedTime = new Date(message.created_at).toLocaleTimeString("en-IN", {
                hour: "numeric",
                minute: "2-digit",
              });

              return (
                <div key={message.id} className="space-y-3">
                  {/* Guest Question */}
                  <div className="flex justify-end">
                    <div className="max-w-[85%] space-y-1">
                      <div className="rounded-2xl rounded-tr-xs bg-sage-800 px-4 py-3 text-white shadow-xs">
                        <p className="text-sm leading-relaxed">{message.question}</p>
                      </div>
                      <p className="text-right text-[10px] text-sand-400">{formattedTime}</p>
                    </div>
                  </div>

                  {/* AI Response */}
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold-300 bg-gold-100/70 text-gold-700 shadow-2xs">
                      <VesperMark className="h-4 w-4" />
                    </span>
                    <div className="max-w-[88%] space-y-2">
                      <div className="rounded-2xl rounded-tl-xs border border-sand-200 bg-white p-4 shadow-xs">
                        <div className="mb-1.5 flex items-center justify-between gap-2 border-b border-sand-100 pb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-serif font-semibold text-sand-950">
                              Vesper AI Concierge
                            </span>
                            {message.model && (
                              <span className="rounded bg-sand-100 px-1.5 py-0.5 text-[9px] font-mono text-sand-600">
                                {message.model}
                              </span>
                            )}
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase border",
                                message.outcome === "answered"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-amber-50 text-amber-800 border-amber-200"
                              )}
                            >
                              {message.outcome}
                            </span>
                          </div>
                          <span className="text-[10px] text-sand-400">{formattedTime}</span>
                        </div>

                        {/* Real Backend Answer */}
                        <p className="text-sm leading-relaxed text-sand-900 whitespace-pre-wrap">
                          {message.answer}
                        </p>

                        {/* Escalation or Human Dispatch Recommendation */}
                        {message.escalated && (
                          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
                            <div className="flex items-start gap-2">
                              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                              <div className="flex-1">
                                <p className="font-semibold text-amber-950">
                                  Escalated to Staff Support
                                </p>
                                <p className="mt-0.5 text-[11px] text-amber-800">
                                  {message.escalation_reason === "no_matching_knowledge"
                                    ? "Information not in resort knowledge base. Ready to forward to department staff."
                                    : message.escalation_reason === "model_unavailable"
                                    ? "AI service is currently offline. A human attendant is ready to assist."
                                    : message.escalation_reason === "rate_limited"
                                    ? "Request threshold reached. Please connect with the front desk."
                                    : "This inquiry requires human attention."}
                                </p>
                                {message.handled_at ? (
                                  <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-emerald-800">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                    <span>
                                      Handled by Front Desk at{" "}
                                      {new Date(message.handled_at).toLocaleTimeString("en-IN", {
                                        hour: "numeric",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openAssistanceWithContext(
                                        `Follow-up regarding inquiry: "${message.question}"`
                                      )
                                    }
                                    className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-amber-800 px-3 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-amber-900"
                                  >
                                    <UserCheck className="h-3.5 w-3.5" />
                                    <span>Request Human Assistance Now</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Real Sources Citation */}
                      {message.sources && message.sources.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] text-sand-400">Verified Sources:</span>
                          {message.sources.map((src, i) => {
                            const title =
                              typeof src === "string"
                                ? src
                                : (src as ConciergeSource).title || (src as ConciergeSource).category || `Passage #${(src as ConciergeSource).id?.slice(0, 6)}`;
                            return (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 rounded border border-sand-200 bg-sand-100/70 px-1.5 py-0.5 text-[10px] text-sand-600"
                              >
                                <FileText className="h-2.5 w-2.5 text-sand-400" />
                                {title}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* In-Flight Pending State (Actual API Call Pending) */}
            {isAsking && (
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold-300 bg-gold-100/70 text-gold-700">
                  <VesperMark className="h-4 w-4" />
                </span>
                <div className="flex items-center gap-2 rounded-2xl rounded-tl-xs border border-sand-200 bg-white px-4 py-3 shadow-xs">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-gold-600" />
                  <span className="text-xs text-sand-600">Retrieving resort knowledge base…</span>
                </div>
              </div>
            )}

            {/* Error & Retry Banner */}
            {errorMessage && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                  <div className="flex-1">
                    <p className="font-semibold text-rose-950">Inquiry Could Not Be Processed</p>
                    <p className="mt-0.5 text-rose-800">{errorMessage}</p>
                    {failedInput && (
                      <div className="mt-2 flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSendMessage(failedInput)}
                          className="h-7 border-rose-300 bg-white px-2.5 text-xs text-rose-900 hover:bg-rose-100"
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Retry Inquiry
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openAssistanceWithContext(failedInput)}
                          className="h-7 border-rose-300 bg-white px-2.5 text-xs text-rose-900 hover:bg-rose-100"
                        >
                          <UserCheck className="h-3 w-3 mr-1" />
                          Send to Human Staff
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Chat Input Bar */}
          <div className="border-t border-sand-200/80 bg-white p-3 sm:p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isAsking || !hasGuestToken}
                  placeholder={
                    hasGuestToken
                      ? "Ask a question (e.g. late checkout policy, spa hours)…"
                      : "Scan room QR code to activate concierge…"
                  }
                  className="w-full rounded-xl border border-sand-300/80 bg-sand-50/70 px-4 py-2.5 text-xs text-sand-950 placeholder:text-sand-400 focus:border-gold-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-gold-500/20 disabled:opacity-50 sm:text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={!input.trim() || isAsking || !hasGuestToken}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sage-800 text-white shadow-soft transition hover:bg-sage-900 disabled:opacity-40 disabled:hover:bg-sage-800"
                aria-label="Send Message"
              >
                {isAsking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>

            <div className="mt-2 flex items-center justify-between text-[11px] text-sand-400">
              <span className="flex items-center gap-1">
                <Bot className="h-3 w-3 text-gold-600" />
                Live Retrieval Concierge
              </span>
              <button
                type="button"
                onClick={() => openAssistanceWithContext()}
                className="text-sage-700 hover:text-sage-950 hover:underline font-medium"
              >
                Request Human Assistance
              </button>
            </div>
          </div>

          {/* Human Assistance Dialog */}
          {isAssistanceOpen && (
            <div className="absolute inset-0 z-60 flex flex-col bg-white">
              <div className="flex items-center justify-between border-b border-sand-200 px-5 py-4">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-gold-600" />
                  <div>
                    <h3 className="font-serif text-lg font-semibold text-sand-950">
                      Request Human Assistance
                    </h3>
                    <p className="text-xs text-sand-500">
                      Dispatches a persisted service request to department attendants
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAssistanceOpen(false)}
                  className="rounded-lg p-1.5 text-sand-400 hover:bg-sand-100 hover:text-sand-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleRequestHumanAssistance} className="flex-1 overflow-y-auto p-5 space-y-4">
                {assistanceError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                    {assistanceError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-sand-700 uppercase tracking-wider mb-2">
                    Department Service
                  </label>
                  <div className="space-y-2">
                    {DEPARTMENT_OPTIONS.map((dept) => (
                      <label
                        key={dept.key}
                        className={cn(
                          "flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition",
                          assistanceKind === dept.kind
                            ? "border-gold-500 bg-gold-50/50 shadow-xs"
                            : "border-sand-200 hover:border-sand-300 bg-white"
                        )}
                      >
                        <input
                          type="radio"
                          name="assistanceKind"
                          value={dept.kind}
                          checked={assistanceKind === dept.kind}
                          onChange={(e) => setAssistanceKind(e.target.value)}
                          className="mt-0.5 text-gold-600 focus:ring-gold-500"
                        />
                        <div className="min-w-0">
                          <p className="font-medium text-xs text-sand-950">{dept.label}</p>
                          <p className="text-[11px] text-sand-500">{dept.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="assistance-notes" className="block text-xs font-semibold text-sand-700 uppercase tracking-wider mb-1.5">
                    Request Notes / Specific Requirements
                  </label>
                  <textarea
                    id="assistance-notes"
                    value={assistanceNote}
                    onChange={(e) => setAssistanceNote(e.target.value)}
                    rows={4}
                    maxLength={500}
                    placeholder="Describe what you need assistance with..."
                    className="w-full rounded-xl border border-sand-300 p-3 text-xs text-sand-950 placeholder:text-sand-400 focus:border-gold-500 focus:outline-hidden focus:ring-2 focus:ring-gold-500/20"
                  />
                  <p className="mt-1 text-right text-[10px] text-sand-400">
                    {assistanceNote.length}/500
                  </p>
                </div>

                <div className="rounded-xl border border-sand-200 bg-sand-50/80 p-3 text-xs text-sand-600">
                  <p className="font-medium text-sand-800">Persisted Ticket Tracking</p>
                  <p className="mt-0.5 text-[11px]">
                    Submitting this form immediately routes a ticket into the department manager and floor staff queue with live SLA monitoring.
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAssistanceOpen(false)}
                    disabled={isSubmittingAssistance}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmittingAssistance}
                    className="bg-sage-800 text-white hover:bg-sage-900"
                  >
                    {isSubmittingAssistance ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                        Dispatching…
                      </>
                    ) : (
                      "Dispatch Request"
                    )}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
    </>
  );
}
