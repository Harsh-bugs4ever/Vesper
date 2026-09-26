"use client";

import React, { useState, useEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  BookOpen,
  Bot,
  Clock,
  ConciergeBell,
  CornerDownLeft,
  FileText,
  MessageSquare,
  Send,
  Sparkles,
  UtensilsCrossed,
  Waves,
  Wifi,
  Wind,
  X,
  CheckCircle2,
  ChevronRight,
  ShoppingBag,
} from "lucide-react";

import { VesperMark } from "@/components/layout/vesper-mark";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { addGuestRequest } from "@/lib/demo/requests";
import {
  getStoredChatThreads,
  addMessageToRoomThread,
  subscribeChatThreads,
  TODAY_MENU_ITEMS,
  type ChatMessage,
  type ChatMenuItem,
  type RoomIssue,
} from "@/lib/demo/guest-chats";
import { cn } from "@/lib/utils";

const QUICK_PROMPTS = [
  {
    icon: UtensilsCrossed,
    label: "What's in the menu?",
    prompt: "What's in the menu for today?",
  },
  {
    icon: Waves,
    label: "Request extra towels",
    prompt: "Can I get extra bath towels delivered to Room 412?",
  },
  {
    icon: Wind,
    label: "AC cooling issue",
    prompt: "My air conditioner isn't cooling properly.",
  },
  {
    icon: Clock,
    label: "Late checkout policy",
    prompt: "What is the late checkout policy for my room?",
  },
  {
    icon: Wifi,
    label: "Wi-Fi setup",
    prompt: "What is the guest Wi-Fi network and password?",
  },
  {
    icon: ConciergeBell,
    label: "Spa & gym hours",
    prompt: "What are the spa and pool hours today?",
  },
];

interface GuestAiConciergeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomNumber?: string;
  onOpenRoomService?: () => void;
}

export function GuestAiConciergeDrawer({
  open,
  onOpenChange,
  roomNumber = "412",
  onOpenRoomService,
}: GuestAiConciergeDrawerProps) {
  const { showToast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync messages from stored thread for this room
  useEffect(() => {
    const sync = () => {
      const threads = getStoredChatThreads();
      const thread = threads.find((t) => t.room === roomNumber);
      if (thread && thread.messages) {
        setMessages(thread.messages);
      }
    };
    sync();
    const unsub = subscribeChatThreads(sync);
    return unsub;
  }, [roomNumber]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: "smooth",
        });
        inputRef.current?.focus();
      }, 100);
    }
  }, [open, messages, thinking]);

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend ?? input).trim();
    if (!text || thinking) return;

    const timeStr = new Date().toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
    });

    const guestMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      from: "guest",
      senderName: `Guest (Room ${roomNumber})`,
      text,
      time: timeStr,
      type: "text",
    };

    // Save and render guest message
    addMessageToRoomThread(roomNumber, guestMessage, "active");
    if (!textToSend) setInput("");
    setThinking(true);

    // AI Concierge reasoning & response logic
    setTimeout(() => {
      const lower = text.toLowerCase();
      let aiText = "";
      let sources: string[] = ["Hotel Knowledge Base"];
      let type: "text" | "menu" | "request_dispatched" = "text";
      let menuItems: ChatMenuItem[] | undefined = undefined;
      let dispatchedRequestId: string | undefined = undefined;
      let dispatchedType: string | undefined = undefined;
      let updatedIssue: Partial<RoomIssue> | undefined = undefined;

      // 1. Food & Menu queries
      if (
        lower.includes("menu") ||
        lower.includes("food") ||
        lower.includes("eat") ||
        lower.includes("dining") ||
        lower.includes("dinner") ||
        lower.includes("lunch") ||
        lower.includes("breakfast") ||
        lower.includes("dish") ||
        lower.includes("order")
      ) {
        aiText =
          "Here is our Chef's In-Room Dining Menu for today at Vesper Beach Resort. Everything is prepared fresh in our kitchen:";
        sources = ["In-Room Dining Menu", "F&B Operations", "The Verandah Kitchen"];
        type = "menu";
        menuItems = TODAY_MENU_ITEMS;
        updatedIssue = {
          title: "In-room dining menu for the day inquired",
          description: "Guest requested and viewed today's in-room dining menu via AI Concierge.",
          category: "F&B",
          severity: "standard",
          status: "in_progress",
          reportedAt: timeStr,
          slaMinutes: 15,
          aiActionTaken: "AI Concierge presented today's featured dining menu.",
          assignedTeam: "In-Room Dining Kitchen",
        };
      }
      // 2. Towels & Housekeeping requests
      else if (
        lower.includes("towel") ||
        lower.includes("linen") ||
        lower.includes("pillow") ||
        lower.includes("bedsheet") ||
        lower.includes("cleaning") ||
        lower.includes("housekeeping")
      ) {
        const req = addGuestRequest({
          room: roomNumber,
          guest: "In-Room Guest",
          channel: "Housekeeping",
          summary: lower.includes("pillow")
            ? "Extra Pillows via AI Concierge"
            : "Fresh Bath Towels via AI Concierge",
          detail: `Automated request placed via Guest AI Concierge from Room ${roomNumber}. Prompt: "${text}"`,
          sla: 15,
          state: "new",
        });

        dispatchedRequestId = req.id;
        dispatchedType = "Housekeeping";
        type = "request_dispatched";
        aiText = `I have dispatched a request for fresh towels to our Floor Attendant (Ticket #${req.id}). Delivery to Room ${roomNumber} will arrive within 15 minutes.`;
        sources = ["Housekeeping Dispatch", "SLA Guidelines"];
        updatedIssue = {
          title: lower.includes("pillow")
            ? "Extra Pillows requested via AI Concierge"
            : "Fresh Bath Towels requested via AI Concierge",
          description: `Guest requested amenities: "${text}".`,
          category: "Housekeeping",
          severity: "standard",
          status: "open",
          ticketId: req.id,
          reportedAt: timeStr,
          slaMinutes: 15,
          aiActionTaken: `AI Concierge dispatched Floor Attendant (Ticket #${req.id}).`,
          assignedTeam: "Housekeeping (Floor Attendant)",
        };

        showToast({
          title: "Housekeeping Dispatched",
          description: `Ticket #${req.id} created for Room ${roomNumber}.`,
          type: "success",
        });
      }
      // 3. Maintenance / Problems (AC, water, TV, etc.)
      else if (
        lower.includes("ac") ||
        lower.includes("air condition") ||
        lower.includes("cooling") ||
        lower.includes("hot") ||
        lower.includes("leak") ||
        lower.includes("water") ||
        lower.includes("tv") ||
        lower.includes("broken") ||
        lower.includes("fix") ||
        lower.includes("not working") ||
        lower.includes("problem") ||
        lower.includes("issue")
      ) {
        const req = addGuestRequest({
          room: roomNumber,
          guest: "In-Room Guest",
          channel: "Maintenance",
          summary: lower.includes("ac") || lower.includes("cooling")
            ? "AC Cooling Issue (AI Concierge)"
            : "Room Maintenance Alert (AI Concierge)",
          detail: `Guest reported: "${text}". Immediate engineering attention required.`,
          sla: 20,
          state: "new",
        });

        dispatchedRequestId = req.id;
        dispatchedType = "Engineering";
        type = "request_dispatched";
        aiText = `I am very sorry for the inconvenience! I have alerted our Duty Engineering Team right away (Ticket #${req.id}). A technician is on their way to inspect Room ${roomNumber} within 20 minutes.`;
        sources = ["Maintenance Operations", "Duty Manager Alert"];
        updatedIssue = {
          title: "Air conditioner isn't cooling properly",
          description: `Guest reported: "${text}". Immediate engineering attention required.`,
          category: "Maintenance",
          severity: "urgent",
          status: "open",
          ticketId: req.id,
          reportedAt: timeStr,
          slaMinutes: 20,
          aiActionTaken: `AI Concierge logged Ticket #${req.id} and dispatched Duty Engineering.`,
          assignedTeam: "Duty Engineering Technician (Ramesh Patil)",
        };

        showToast({
          title: "Engineering Dispatched",
          description: `Ticket #${req.id} prioritized for Room ${roomNumber}.`,
          type: "warning",
        });
      }
      // 4. Late checkout
      else if (
        lower.includes("checkout") ||
        lower.includes("check-out") ||
        lower.includes("check out") ||
        lower.includes("extend") ||
        lower.includes("late")
      ) {
        aiText =
          "Standard checkout is at 11:00 AM. For our guests in Room 412, complimentary late checkout is extended until 2:00 PM today! If you need keycard extension, I have already notified the Front Desk team.";
        sources = ["Late Checkout Policy", "Front Desk SOP"];
      }
      // 5. Wi-Fi
      else if (
        lower.includes("wifi") ||
        lower.includes("wi-fi") ||
        lower.includes("internet") ||
        lower.includes("password")
      ) {
        aiText =
          "Property-wide high-speed Wi-Fi is complimentary. Connect to network: 'Vesper_Guest', enter Room Number '412', and use last name 'Guest'. Speed is unthrottled up to 200 Mbps.";
        sources = ["IT Infrastructure", "Guest Guide"];
      }
      // 6. Spa & Pool
      else if (
        lower.includes("spa") ||
        lower.includes("massage") ||
        lower.includes("gym") ||
        lower.includes("pool") ||
        lower.includes("wellness")
      ) {
        aiText =
          "Vesper Wellness Spa & Gym is located on Level 3. The infinity pool and fitness studio are open 6:00 AM – 10:00 PM. Ayurvedic massages and signature spa therapies are available 8:00 AM – 9:00 PM.";
        sources = ["Spa Directory", "Wellness Services"];
      }
      // 7. General fallback
      else {
        aiText = `Thank you for reaching out! I've noted: "${text}". Our Front Desk and Concierge team are always available to make your stay effortless. Would you like me to request anything specific for Room ${roomNumber}?`;
        sources = ["Front Desk", "Hotel Knowledge Base"];
      }

      const aiMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        from: "ai",
        senderName: "Vesper AI Concierge",
        text: aiText,
        time: new Date().toLocaleTimeString("en-IN", {
          hour: "numeric",
          minute: "2-digit",
        }),
        sources,
        type,
        menuItems,
        dispatchedRequestId,
        dispatchedType,
      };

      addMessageToRoomThread(roomNumber, aiMessage, "active", updatedIssue);
      setThinking(false);
    }, 850);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-sand-950/40 backdrop-blur-xs transition-opacity animate-in fade-in" />
        <Dialog.Content
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-sand-200 bg-sand-50 shadow-2xl transition-all animate-in slide-in-from-right duration-300",
            "sm:max-w-lg"
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
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                    Room {roomNumber}
                  </span>
                </div>
                <Dialog.Description className="text-xs text-sand-500">
                  Instant service, dining menu & room assistance
                </Dialog.Description>
              </div>
            </div>

            <Dialog.Close
              className="rounded-lg p-1.5 text-sand-400 transition-colors hover:bg-sand-100 hover:text-sand-800"
              aria-label="Close Concierge"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>

          {/* Quick Prompts Bar */}
          <div className="border-b border-sand-200/60 bg-white/70 px-4 py-2.5">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-sand-400">
              Quick Inquiries & Requests
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {QUICK_PROMPTS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    onClick={() => handleSendMessage(item.prompt)}
                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-sand-200 bg-white px-3 py-1 text-xs font-medium text-sand-700 transition hover:border-gold-400 hover:bg-gold-50/60 hover:text-sand-950 shadow-3xs"
                  >
                    <Icon className="h-3 w-3 text-gold-600" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chat Messages */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-xs"
          >
            {messages.map((message) => {
              const isGuest = message.from === "guest";
              const isStaff = message.from === "staff";

              if (isGuest) {
                return (
                  <div key={message.id} className="flex justify-end">
                    <div className="max-w-[85%] space-y-1">
                      <div className="rounded-2xl rounded-tr-xs bg-sage-800 px-4 py-3 text-white shadow-xs">
                        <p className="text-sm leading-relaxed">{message.text}</p>
                      </div>
                      <p className="text-right text-[10px] text-sand-400">
                        {message.time}
                      </p>
                    </div>
                  </div>
                );
              }

              if (isStaff) {
                return (
                  <div key={message.id} className="flex items-start gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sand-200 text-xs font-semibold text-sand-800">
                      GM
                    </span>
                    <div className="max-w-[88%] space-y-1.5">
                      <div className="rounded-2xl rounded-tl-xs border border-gold-200/80 bg-gold-50/80 px-4 py-3 text-sand-950 shadow-xs">
                        <div className="mb-1 flex items-center gap-1.5">
                          <span className="font-semibold text-xs text-gold-900">
                            {message.senderName || "Arjun Mehta"}
                          </span>
                          <span className="rounded bg-gold-200/70 px-1.5 py-0.2 text-[9px] font-semibold text-gold-800 uppercase">
                            {message.senderRole || "General Manager"}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed">{message.text}</p>
                      </div>
                      <p className="text-[10px] text-sand-400">{message.time}</p>
                    </div>
                  </div>
                );
              }

              // AI Message
              return (
                <div key={message.id} className="flex items-start gap-2.5">
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
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 uppercase border border-emerald-200">
                            Autonomous
                          </span>
                        </div>
                        <span className="text-[10px] text-sand-400">
                          {message.time}
                        </span>
                      </div>

                      <p className="text-sm leading-relaxed text-sand-900">
                        {message.text}
                      </p>

                      {/* When message contains the today's menu */}
                      {message.type === "menu" && message.menuItems && (
                        <div className="mt-3.5 space-y-2.5 border-t border-sand-200/70 pt-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-gold-800">
                              Today&apos;s Featured Menu
                            </span>
                            <span className="text-[11px] font-medium text-sand-500">
                              In-Room Dining
                            </span>
                          </div>

                          <div className="space-y-2">
                            {message.menuItems.map((item) => (
                              <div
                                key={item.id}
                                className="group relative rounded-xl border border-sand-200/90 bg-sand-50/60 p-2.5 transition hover:border-gold-300 hover:bg-white hover:shadow-xs"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium text-xs text-sand-950">
                                        {item.name}
                                      </p>
                                      {item.tag && (
                                        <span
                                          className={cn(
                                            "rounded px-1.5 py-0.2 text-[9px] font-semibold",
                                            item.veg
                                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                              : "bg-amber-50 text-amber-800 border border-amber-200"
                                          )}
                                        >
                                          {item.tag}
                                        </span>
                                      )}
                                    </div>
                                    <p className="mt-0.5 line-clamp-2 text-[11px] text-sand-500">
                                      {item.desc}
                                    </p>
                                  </div>
                                  <span className="shrink-0 font-sans font-semibold text-xs text-sand-900 tabular-nums">
                                    ₹{item.price}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>

                          {onOpenRoomService && (
                            <button
                              onClick={() => {
                                onOpenChange(false);
                                onOpenRoomService();
                              }}
                              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-sage-800 py-2.5 text-xs font-semibold text-white shadow-soft transition hover:bg-sage-900"
                            >
                              <ShoppingBag className="h-4 w-4 text-gold-300" />
                              <span>Order from In-Room Dining</span>
                              <ChevronRight className="h-3.5 w-3.5 opacity-80" />
                            </button>
                          )}
                        </div>
                      )}

                      {/* Dispatched request banner */}
                      {message.type === "request_dispatched" && (
                        <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-3 py-2 text-xs">
                          <div className="flex items-center gap-2 text-emerald-900 font-medium">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                            <span>
                              {message.dispatchedType || "Service"} Ticket Dispatched
                            </span>
                          </div>
                          <span className="font-mono text-[10px] font-bold text-emerald-800">
                            {message.dispatchedRequestId}
                          </span>
                        </div>
                      )}
                    </div>

                    {message.sources && message.sources.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] text-sand-400">Sources:</span>
                        {message.sources.map((src) => (
                          <span
                            key={src}
                            className="inline-flex items-center gap-1 rounded border border-sand-200 bg-sand-100/70 px-1.5 py-0.5 text-[10px] text-sand-600"
                          >
                            <FileText className="h-2.5 w-2.5 text-sand-400" />
                            {src}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {thinking && (
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold-300 bg-gold-100/70 text-gold-700">
                  <VesperMark className="h-4 w-4" />
                </span>
                <div className="flex items-center gap-2 rounded-2xl rounded-tl-xs border border-sand-200 bg-white px-4 py-3 shadow-xs">
                  <span className="text-xs text-sand-500">Checking hotel menu & services</span>
                  <div className="flex items-center gap-1">
                    {[0, 1, 2].map((dot) => (
                      <span
                        key={dot}
                        className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold-600"
                        style={{ animationDelay: `${dot * 180}ms` }}
                      />
                    ))}
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
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question or request (e.g. What's in the menu?)..."
                  className="w-full rounded-xl border border-sand-300/80 bg-sand-50/70 px-4 py-2.5 text-xs text-sand-950 placeholder:text-sand-400 focus:border-gold-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-gold-500/20 sm:text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={!input.trim() || thinking}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sage-800 text-white shadow-soft transition hover:bg-sage-900 disabled:opacity-40 disabled:hover:bg-sage-800"
                aria-label="Send Message"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
            <div className="mt-2 flex items-center justify-between text-[11px] text-sand-400">
              <span>Powered by Vesper Autonomous Hospitality Engine</span>
              <span>Available 24/7</span>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
