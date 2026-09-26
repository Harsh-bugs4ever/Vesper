"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  ConciergeBell,
  CreditCard,
  Loader2,
  Minus,
  Plus,
  QrCode,
  RefreshCw,
  Scan,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkle,
  Sparkles,
  SprayCan,
  Star,
  TriangleAlert,
  Utensils,
  Waves,
  X,
} from "lucide-react";

import { VesperMark } from "@/components/layout/vesper-mark";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { StarRating } from "@/components/ui/star-rating";
import { useToast } from "@/components/ui/toast";
import { reviewErrorMessage, useRateStaff, useRateableStaff } from "@/lib/hooks/use-reviews";
import { GuestAiConciergeDrawer } from "@/components/guest/guest-ai-concierge-drawer";
import { guestRequests, guestTokens } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface GuestUiRequest {
  id: string;
  room: string;
  guest: string;
  channel: string;
  summary: string;
  detail: string;
  raisedAt: string;
  openFor: number;
  sla: number;
  state: "new" | "accepted" | "done";
  assignee?: string;
  value?: number;
}

interface MenuItem {
  id: string;
  name: string;
  category: "all-day" | "beverages" | "desserts";
  price: number;
  desc: string;
  tag?: string;
  veg?: boolean;
}

const MENU_ITEMS: MenuItem[] = [
  {
    id: "mumbai-club",
    name: "Mumbai Club Sandwich",
    category: "all-day",
    price: 650,
    desc: "Triple-layer toasted sourdough, smoked chicken, fried egg, aged cheddar, crisp iceberg.",
    tag: "Chef's Special",
    veg: false,
  },
  {
    id: "paneer-kathi",
    name: "Paneer Tikka Kathi Roll",
    category: "all-day",
    price: 520,
    desc: "Clay-oven roasted cottage cheese, bell peppers, mint & pomegranate chutney.",
    tag: "Vegetarian",
    veg: true,
  },
  {
    id: "caesar-salad",
    name: "Classic Caesar Salad",
    category: "all-day",
    price: 480,
    desc: "Crisp romaine hearts, shaved parmigiano-reggiano, garlic brioche croutons.",
    tag: "Fresh",
    veg: true,
  },
  {
    id: "dal-makhani",
    name: "Dal Vesper & Butter Naan",
    category: "all-day",
    price: 580,
    desc: "Slow-simmered 24-hour black lentils with churned butter and warm tandoori naan.",
    tag: "Signature",
    veg: true,
  },
  {
    id: "coconut-water",
    name: "Fresh Tender Coconut Water",
    category: "beverages",
    price: 220,
    desc: "Served chilled in natural shell with tender coconut malai.",
    tag: "Hydration",
    veg: true,
  },
  {
    id: "masala-chai",
    name: "Kullad Masala Chai (Pot)",
    category: "beverages",
    price: 180,
    desc: "Slow-brewed Assam CTC with hand-crushed ginger, green cardamom, and lemongrass.",
    tag: "Warm",
    veg: true,
  },
  {
    id: "watermelon-juice",
    name: "Cold-Pressed Watermelon Juice",
    category: "beverages",
    price: 280,
    desc: "Fresh organic watermelon, Persian mint, Himalayan pink salt, touch of lime.",
    tag: "Cold Pressed",
    veg: true,
  },
  {
    id: "chocolate-fondant",
    name: "Warm Valrhona Fondant",
    category: "desserts",
    price: 420,
    desc: "Molten dark chocolate core, Madagascar vanilla bean gelato.",
    tag: "Sweet",
    veg: true,
  },
  {
    id: "gulab-jamun",
    name: "Saffron Angoori Jamun",
    category: "desserts",
    price: 320,
    desc: "Warm baby dumplings in saffron & rose water syrup with pistachio slivers.",
    tag: "Traditional",
    veg: true,
  },
];

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

export default function GuestPage() {
  const { showToast } = useToast();

  // Active drawer states
  const [activeDrawer, setActiveDrawer] = useState<
    "room-service" | "housekeeping" | "towels" | "issue" | null
  >(null);
  const [aiConciergeOpen, setAiConciergeOpen] = useState(false);

  // Cart state: { [itemId]: quantity }
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartInstructions, setCartInstructions] = useState("");
  const [menuCategory, setMenuCategory] = useState<"all" | "all-day" | "beverages" | "desserts">("all");

  // Room Service UPI Payment & Scanner flow states
  const [orderStage, setOrderStage] = useState<"menu" | "payment" | "verifying" | "success">("menu");
  const [paymentTxnId, setPaymentTxnId] = useState("");
  const [lastPaymentMethod, setLastPaymentMethod] = useState("UPI QR");

  // Housekeeping request form state
  const [housekeepingType, setHousekeepingType] = useState("Full Room Turnover & Fresh Linens");
  const [housekeepingTime, setHousekeepingTime] = useState("Immediate (Within 20 mins)");
  const [housekeepingNotes, setHousekeepingNotes] = useState("");

  // Towels request state
  const [towelsCount, setTowelsCount] = useState<Record<string, number>>({
    bath: 2,
    hand: 1,
    pool: 0,
    robe: 0,
  });

  // Issue reporting state
  const [issueCategory, setIssueCategory] = useState("AC / Climate Control");
  const [issueDescription, setIssueDescription] = useState("");
  const [hasIssuePhoto, setHasIssuePhoto] = useState(false);

  // Active request state
  const [activeRequest, setActiveRequest] = useState<GuestUiRequest | null>(null);
  const [serviceRating, setServiceRating] = useState<number>(0);

  // Staff rating state (existing)
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const { staff: servedBy, isLoading: staffLoading } = useRateableStaff();
  const rateStaff = useRateStaff();

  // Load and listen to requests from backend
  useEffect(() => {
    if (!guestTokens.access()) {
      setActiveRequest(null);
      return;
    }

    let cancelled = false;
    let interval: NodeJS.Timeout | null = null;

    const fetchRequests = async () => {
      if (!guestTokens.access()) {
        setActiveRequest(null);
        if (interval) clearInterval(interval);
        return;
      }
      try {
        const list = await guestRequests.list();
        if (cancelled || list.length === 0) return;
        const first = list[0];
        setActiveRequest({
          id: first.id,
          room: first.room_number,
          guest: "In-Room Guest",
          channel:
            first.kind === "room_service"
              ? "Room Service"
              : first.kind === "housekeeping"
              ? "Housekeeping"
              : first.kind === "maintenance"
              ? "Maintenance"
              : "Guest Service",
          summary: first.note || `Request #${first.id.slice(0, 6)}`,
          detail: `Target SLA: ${first.sla_minutes} min`,
          raisedAt: new Date(first.created_at).toLocaleTimeString("en-IN", {
            hour: "numeric",
            minute: "2-digit",
          }),
          openFor: 0,
          sla: first.sla_minutes,
          state:
            first.status === "delivered"
              ? "done"
              : first.status === "accepted" || first.status === "in_progress"
              ? "accepted"
              : "new",
          value: Number(first.total_amount) || undefined,
        });
      } catch (err: unknown) {
        // Clear stale/expired guest token and stop polling on auth failures
        const message = err instanceof Error ? err.message.toLowerCase() : "";
        const isAuthError =
          message.includes("401") ||
          message.includes("403") ||
          message.includes("invalid token") ||
          message.includes("unauthorized") ||
          message.includes("not authenticated");
        if (isAuthError) {
          guestTokens.clear();
          setActiveRequest(null);
          if (interval) clearInterval(interval);
        }
      }
    };

    void fetchRequests();
    interval = setInterval(fetchRequests, 15_000);
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, []);

  // Cart helpers
  const updateCartQuantity = (itemId: string, delta: number) => {
    setCart((prev) => {
      const current = prev[itemId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return { ...prev, [itemId]: next };
    });
  };

  const totalCartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartSubtotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const item = MENU_ITEMS.find((m) => m.id === id);
    return sum + (item ? item.price * qty : 0);
  }, 0);
  const cartGst = Math.round(cartSubtotal * 0.05);
  const cartTotal = cartSubtotal + cartGst;

  // Room Service Payment & Order Flow
  const handleProceedToPayment = () => {
    if (totalCartCount === 0) return;
    setOrderStage("payment");
  };

  const handleProcessPayment = (methodName: string = "UPI QR") => {
    setLastPaymentMethod(methodName);
    setOrderStage("verifying");
    const txnId = `UPI${Math.floor(100000000000 + Math.random() * 900000000000)}`;
    setPaymentTxnId(txnId);

    const summaryItems = Object.entries(cart)
      .map(([id, qty]) => {
        const item = MENU_ITEMS.find((m) => m.id === id);
        return `${item?.name} ×${qty}`;
      })
      .join(", ");

    const note = `Paid via ${methodName} (Ref #${txnId}). ${cartInstructions ? `Notes: ${cartInstructions}` : "Standard preparation."} Items: ${summaryItems}`;

    if (guestTokens.access()) {
      guestRequests
        .create({ kind: "room_service", note })
        .then((created) => {
          setActiveRequest({
            id: created.id,
            room: created.room_number,
            guest: "In-Room Guest",
            channel: "Room Service",
            summary: summaryItems || "In-Room Dining",
            detail: note,
            value: cartTotal,
            sla: created.sla_minutes,
            raisedAt: new Date(created.created_at).toLocaleTimeString("en-IN", {
              hour: "numeric",
              minute: "2-digit",
            }),
            openFor: 0,
            state: "new",
          });
          setOrderStage("success");
          setServiceRating(0);
          showToast({
            title: "Order Placed & Dispatched",
            description: `₹${cartTotal.toLocaleString()} order confirmed. Routed to kitchen.`,
            type: "success",
          });
        })
        .catch((err) => {
          setOrderStage("menu");
          showToast({
            title: "Order Dispatch Failed",
            description: err instanceof Error ? err.message : "Could not place order.",
            type: "error",
          });
        });
    } else {
      setOrderStage("menu");
      showToast({
        title: "Guest Session Required",
        description: "Please scan your nightstand QR code to transmit orders to the kitchen.",
        type: "warning",
      });
    }
  };

  const handleCloseRoomService = () => {
    setActiveDrawer(null);
    setTimeout(() => {
      setOrderStage("menu");
      if (orderStage === "success") {
        setCart({});
        setCartInstructions("");
      }
    }, 300);
  };

  // Submit Housekeeping Request
  const handleRequestHousekeeping = () => {
    const detail = `Preferred time: ${housekeepingTime}.${housekeepingNotes ? ` Notes: ${housekeepingNotes}` : ""}`;
    if (guestTokens.access()) {
      guestRequests
        .create({
          kind: "housekeeping",
          note: `${housekeepingType}. ${detail}`,
        })
        .then((created) => {
          setActiveRequest({
            id: created.id,
            room: created.room_number,
            guest: "In-Room Guest",
            channel: "Housekeeping",
            summary: housekeepingType,
            detail,
            sla: created.sla_minutes,
            raisedAt: new Date(created.created_at).toLocaleTimeString("en-IN", {
              hour: "numeric",
              minute: "2-digit",
            }),
            openFor: 0,
            state: "new",
          });
          setActiveDrawer(null);
          setServiceRating(0);
          showToast({
            title: "Housekeeping Dispatched",
            description: `${housekeepingType} scheduled. Attendant assigned shortly.`,
            type: "success",
          });
        })
        .catch((err) => {
          showToast({
            title: "Request Failed",
            description: err instanceof Error ? err.message : "Could not dispatch request.",
            type: "error",
          });
        });
    } else {
      setActiveDrawer(null);
      showToast({
        title: "Guest Session Required",
        description: "Please scan your nightstand QR code to request housekeeping.",
        type: "default",
      });
    }
  };

  // Submit Towels Request
  const handleRequestTowels = () => {
    const towelSummary = [
      towelsCount.bath > 0 ? `${towelsCount.bath}x Bath Towels` : null,
      towelsCount.hand > 0 ? `${towelsCount.hand}x Hand Towels` : null,
      towelsCount.pool > 0 ? `${towelsCount.pool}x Pool Towels` : null,
      towelsCount.robe > 0 ? `${towelsCount.robe}x Bathrobes` : null,
    ]
      .filter(Boolean)
      .join(", ");

    if (guestTokens.access()) {
      guestRequests
        .create({
          kind: "amenities",
          note: `Extra amenities requested: ${towelSummary || "Towels"}`,
        })
        .then((created) => {
          setActiveRequest({
            id: created.id,
            room: created.room_number,
            guest: "In-Room Guest",
            channel: "Housekeeping",
            summary: towelSummary || "Extra Towels",
            detail: "Deliver to guest room.",
            sla: created.sla_minutes,
            raisedAt: new Date(created.created_at).toLocaleTimeString("en-IN", {
              hour: "numeric",
              minute: "2-digit",
            }),
            openFor: 0,
            state: "new",
          });
          setActiveDrawer(null);
          setServiceRating(0);
          showToast({
            title: "Towels Dispatched",
            description: `${towelSummary || "Towels"} dispatched to your room.`,
            type: "success",
          });
        })
        .catch((err) => {
          showToast({
            title: "Request Failed",
            description: err instanceof Error ? err.message : "Could not dispatch towels request.",
            type: "error",
          });
        });
    } else {
      setActiveDrawer(null);
      showToast({
        title: "Guest Session Required",
        description: "Please scan your nightstand QR code to request towels.",
        type: "default",
      });
    }
  };

  // Submit Maintenance Issue
  const handleReportIssue = () => {
    if (!issueDescription) {
      showToast({
        title: "Please add a description",
        description: "Let our engineering team know what requires attention.",
        type: "warning",
      });
      return;
    }

    if (guestTokens.access()) {
      guestRequests
        .reportIssue({
          summary: issueCategory,
          description: issueDescription,
          category: issueCategory.toLowerCase(),
          severity: "normal",
        })
        .then((created) => {
          setActiveRequest({
            id: created.id,
            room: created.room_number || "Room",
            guest: "In-Room Guest",
            channel: "Maintenance",
            summary: issueCategory,
            detail: `${issueDescription}${hasIssuePhoto ? " [Photo proof attached]" : ""}`,
            sla: 30,
            raisedAt: new Date(created.created_at).toLocaleTimeString("en-IN", {
              hour: "numeric",
              minute: "2-digit",
            }),
            openFor: 0,
            state: "new",
          });
          setIssueDescription("");
          setHasIssuePhoto(false);
          setActiveDrawer(null);
          setServiceRating(0);
          showToast({
            title: "Issue Dispatched to Engineering",
            description: `${issueCategory} logged. Duty engineer notified.`,
            type: "success",
          });
        })
        .catch((err) => {
          showToast({
            title: "Issue Report Failed",
            description: err instanceof Error ? err.message : "Could not submit issue report.",
            type: "error",
          });
        });
    } else {
      setActiveDrawer(null);
      showToast({
        title: "Guest Session Required",
        description: "Please scan your nightstand QR code to report maintenance issues.",
        type: "default",
      });
    }
  };

  // Staff rating submission
  const submitRating = (staffId: string, name: string, rating: number) => {
    setSaving(staffId);
    rateStaff.mutate(
      { staffId, rating },
      {
        onSuccess: (result) => {
          setSubmitted((current) => ({ ...current, [staffId]: true }));
          setSaving(null);
          showToast({
            title: "Thank you",
            description: result.delivered ? `Your rating for ${name} has been passed to their manager.` : "This preview did not send a rating to the resort.",
            type: result.delivered ? "success" : "default",
          });
        },
        onError: (error) => {
          setSaving(null);
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

  // Filtered menu items
  const filteredMenuItems = useMemo(() => {
    if (menuCategory === "all") return MENU_ITEMS;
    return MENU_ITEMS.filter((item) => item.category === menuCategory);
  }, [menuCategory]);

  // Request tracker stage calculations
  const stageIndex =
    activeRequest?.state === "done" ? 2 : activeRequest?.state === "accepted" ? 1 : 0;
  const stages = ["Request Placed", "In Progress", "Completed"] as const;

  return (
    <div className="min-h-screen bg-sand-50 pb-16">
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
        {/* Welcome Card */}
        <section className="overflow-hidden rounded-2xl border border-sand-200/80 bg-white">
          <div className="grid gap-0 sm:grid-cols-[1fr_auto]">
            <div className="p-6">
              <p className="text-xs font-medium tracking-[0.18em] text-sand-500 uppercase">
                Welcome to Vesper
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
              <div className="rounded-xl bg-sage-800 px-5 py-4 text-right shadow-soft">
                <p className="font-sans text-2xl font-semibold leading-none text-gold-300 tabular-nums">
                  Room 412
                </p>
                <p className="mt-1.5 text-xs text-sand-200">Deluxe Ocean View</p>
              </div>
            </div>
          </div>
        </section>

        {/* AI Concierge Card */}
        <section className="overflow-hidden rounded-2xl border border-gold-300/80 bg-gradient-to-br from-gold-50/80 via-white to-sand-50/70 p-5 shadow-soft">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3.5">
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-gold-400/60 bg-gradient-to-br from-gold-100 to-sand-100 text-gold-700 shadow-xs">
                <Sparkles className="h-6 w-6 text-gold-600" />
                <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-serif text-lg font-semibold text-sand-950">
                    Vesper AI Concierge
                  </h2>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                    24/7 Live
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-sand-600 leading-relaxed max-w-md">
                  Have a question or request? Ask anything &mdash; from today&apos;s dining menu to extra towels, late checkout, and resort amenities.
                </p>
              </div>
            </div>

            <button
              onClick={() => setAiConciergeOpen(true)}
              className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-sage-800 px-4 py-2.5 text-xs font-semibold text-white shadow-soft transition hover:bg-sage-900"
            >
              <Sparkles className="h-4 w-4 text-gold-300" />
              <span>Ask AI Concierge</span>
              <ChevronRight className="h-4 w-4 opacity-80" />
            </button>
          </div>

          {/* Quick suggestions pills */}
          <div className="mt-3.5 flex flex-wrap gap-2 border-t border-gold-200/50 pt-3 text-xs">
            <span className="text-[11px] font-medium text-sand-400 self-center">Try asking:</span>
            {[
              "What's in the menu for today?",
              "Request extra bath towels",
              "What time is late checkout?",
              "My AC isn't cooling",
            ].map((prompt) => (
              <button
                key={prompt}
                onClick={() => setAiConciergeOpen(true)}
                className="rounded-full border border-sand-200/90 bg-white/90 px-3 py-1 text-[11px] text-sand-700 transition hover:border-gold-300 hover:bg-gold-50/60"
              >
                &ldquo;{prompt}&rdquo;
              </button>
            ))}
          </div>
        </section>

        {/* 4 Interactive Service Cards */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SERVICES.map((service) => {
            const Icon = service.icon;
            return (
              <button
                key={service.id}
                onClick={() => setActiveDrawer(service.id)}
                className="flex items-center gap-4 rounded-2xl border border-sand-200/80 bg-white p-5 text-left transition-all hover:bg-sand-50 hover:border-sage-300 shadow-2xs group"
              >
                <Icon className={cn("h-8 w-8 shrink-0 transition-transform group-hover:scale-105", service.tone)} />
                <span className="min-w-0 flex-1">
                  <span className="block font-serif text-lg font-semibold text-sand-950">
                    {service.name}
                  </span>
                  <span className="mt-0.5 block text-sm leading-snug text-sand-600">
                    {service.detail}
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-sand-400 group-hover:text-sand-700 group-hover:translate-x-0.5 transition-all" />
              </button>
            );
          })}
        </section>

        {/* Live Request Tracker */}
        {activeRequest && (
          <section className="rounded-2xl border border-sand-200/80 bg-white p-5 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gold-700">
                  Live Request Status
                </span>
                <h2 className="font-serif text-xl font-semibold text-sand-950">
                  {activeRequest.summary}
                </h2>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold border",
                  activeRequest.state === "done"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : activeRequest.state === "accepted"
                    ? "bg-gold-50 text-gold-900 border-gold-200"
                    : "bg-sand-100 text-sand-800 border-sand-200"
                )}
              >
                {stages[stageIndex]}
              </span>
            </div>

            <div className="mt-4 rounded-xl border border-sand-200/80 p-4 bg-sand-50/40">
              <div className="flex items-center justify-between text-xs text-sand-600 mb-3">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-sand-400" />
                  Raised at {activeRequest.raisedAt}
                </span>

                {activeRequest.assignee && (
                  <span className="font-medium text-sage-900">
                    Attended by: <strong>{activeRequest.assignee}</strong>
                  </span>
                )}
              </div>

              {/* Progress Rail */}
              <div className="mt-4">
                <div className="relative flex items-center justify-between">
                  <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-sand-200" />
                  <div
                    className="absolute left-0 top-1/2 h-0.5 -translate-y-1/2 bg-sage-700 transition-all duration-500"
                    style={{ width: `${(stageIndex / (stages.length - 1)) * 100}%` }}
                  />
                  {stages.map((_, index) => (
                    <span
                      key={index}
                      className={cn(
                        "relative flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all duration-300",
                        index < stageIndex
                          ? "border-sage-700 bg-sage-700 text-white"
                          : index === stageIndex
                          ? "border-sage-700 bg-sage-700 text-white"
                          : "border-sand-300 bg-white text-transparent"
                      )}
                    >
                      {index <= stageIndex && <Check className="h-3.5 w-3.5" />}
                    </span>
                  ))}
                </div>

                <div className="mt-2 flex items-start justify-between gap-2 text-center text-xs">
                  <div className="flex-1 text-left">
                    <span className="block font-medium text-sand-900">Request Placed</span>
                    <span className="block text-[11px] text-sand-500">{activeRequest.raisedAt}</span>
                  </div>
                  <div className="flex-1">
                    <span className="block font-medium text-sand-900">In Progress</span>
                    <span className="block text-[11px] text-sand-500">
                      {activeRequest.state === "accepted"
                        ? "Floor team dispatched"
                        : activeRequest.state === "done"
                        ? "Processed"
                        : "Awaiting attendant"}
                    </span>
                  </div>
                  <div className="flex-1 text-right">
                    <span
                      className={cn(
                        "block font-medium",
                        stageIndex >= 2 ? "text-sand-900" : "text-sand-400"
                      )}
                    >
                      Completed
                    </span>
                    <span className="block text-[11px] text-sand-400">
                      {stageIndex >= 2 ? "Delivered to Room" : "We'll notify you"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 1-Tap Rating upon completion */}
            {stageIndex === 2 && (
              <div className="mt-4 pt-4 border-t border-sand-100 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h4 className="font-serif text-base font-semibold text-sand-950">
                    How was the delivery?
                  </h4>
                  <p className="text-xs text-sand-600">Tap to rate this service.</p>
                </div>
                <StarRating
                  value={serviceRating}
                  onChange={(val) => {
                    setServiceRating(val);
                    showToast({
                      title: "Thank you!",
                      description: `You rated this delivery ${val} out of 5 stars.`,
                      type: "success",
                    });
                  }}
                  size="md"
                  label="Rate this delivery"
                />
              </div>
            )}
          </section>
        )}

        {/* Rate our team section (existing feature) */}
        <section className="rounded-2xl border border-sand-200/80 bg-white p-5 shadow-soft">
          <h2 className="font-serif text-xl font-semibold text-sand-950">Rate our team</h2>
          <p className="mt-0.5 text-sm text-sand-600">
            Only the people who looked after you during this stay. Ratings go to their manager,
            never to the person directly, and you can rate each of them once.
          </p>

          {staffLoading ? (
            <div className="mt-4 space-y-2">
              {[0, 1, 2].map((row) => (
                <div key={row} className="h-14 animate-pulse rounded-xl bg-sand-100" />
              ))}
            </div>
          ) : servedBy.length === 0 ? (
            <p className="mt-4 text-sm text-sand-500">
              Nobody has attended to this room yet. Once someone does, you will be able to rate
              them here.
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

      {/* 1. ROOM SERVICE MENU & UPI PAYMENT DRAWER */}
      <Drawer
        open={activeDrawer === "room-service"}
        onOpenChange={(open) => {
          if (!open) handleCloseRoomService();
        }}
        title={
          orderStage === "payment"
            ? "Pay for Room Service"
            : orderStage === "verifying"
            ? "Verifying Payment"
            : orderStage === "success"
            ? "Order Confirmed"
            : "Room Service Menu"
        }
        description={
          orderStage === "payment"
            ? "Scan UPI QR code or choose your UPI app to complete payment for Room 412."
            : orderStage === "verifying"
            ? "Waiting for UPI bank authorization..."
            : orderStage === "success"
            ? "UPI payment received. Dispatched to the kitchen."
            : "Freshly prepared culinary offerings delivered to Room 412."
        }
        footer={
          orderStage === "menu" && totalCartCount > 0 ? (
            <div className="w-full space-y-3">
              <div className="flex items-center justify-between text-xs text-sand-600">
                <span>Subtotal ({totalCartCount} items)</span>
                <span className="font-semibold text-sand-950">₹{cartSubtotal.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-sand-600">
                <span>GST (5%)</span>
                <span>₹{cartGst.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm font-bold text-sand-950 pt-2 border-t border-sand-100">
                <span>Total Amount</span>
                <span>₹{cartTotal.toLocaleString()}</span>
              </div>
              <Button
                onClick={handleProceedToPayment}
                className="w-full bg-sage-700 hover:bg-sage-800 text-white font-semibold py-2.5 rounded-xl shadow-soft flex items-center justify-center gap-2"
              >
                <QrCode className="w-4 h-4" />
                Proceed to UPI Payment (₹{cartTotal.toLocaleString()})
              </Button>
            </div>
          ) : undefined
        }
      >
        {orderStage === "menu" ? (
          <div className="space-y-4">
            {/* Menu Category Selector */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
              {[
                { id: "all", label: "All Items" },
                { id: "all-day", label: "All Day Dining" },
                { id: "beverages", label: "Beverages" },
                { id: "desserts", label: "Desserts" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setMenuCategory(cat.id as any)}
                  className={cn(
                    "px-3 py-1.5 rounded-full border text-xs font-medium whitespace-nowrap transition-colors",
                    menuCategory === cat.id
                      ? "bg-sage-700 border-sage-700 text-white"
                      : "bg-white border-sand-200 text-sand-700 hover:bg-sand-50"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Menu Items List */}
            <div className="divide-y divide-sand-100">
              {filteredMenuItems.map((item) => {
                const qty = cart[item.id] || 0;
                return (
                  <div key={item.id} className="py-3.5 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "w-2 h-2 rounded-full",
                            item.veg ? "bg-emerald-600" : "bg-rose-600"
                          )}
                        />
                        <h4 className="text-sm font-bold text-sand-950 font-serif">{item.name}</h4>
                        {item.tag && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-gold-100 text-gold-900 border border-gold-200">
                            {item.tag}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-sand-600 mt-1 leading-relaxed">{item.desc}</p>
                      <span className="text-xs font-bold text-sand-950 mt-1 block">
                        ₹{item.price.toLocaleString()}
                      </span>
                    </div>

                    {/* Quantity Counter */}
                    <div className="flex items-center gap-2 shrink-0 bg-sand-100/80 rounded-lg p-1">
                      {qty > 0 ? (
                        <>
                          <button
                            onClick={() => updateCartQuantity(item.id, -1)}
                            className="w-6 h-6 rounded bg-white text-sand-700 flex items-center justify-center hover:bg-sand-200 transition-colors shadow-2xs"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-bold text-sand-950 w-4 text-center tabular-nums">
                            {qty}
                          </span>
                          <button
                            onClick={() => updateCartQuantity(item.id, 1)}
                            className="w-6 h-6 rounded bg-sage-700 text-white flex items-center justify-center hover:bg-sage-800 transition-colors shadow-2xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => updateCartQuantity(item.id, 1)}
                          className="h-7 px-2.5 text-xs bg-white text-sage-800 font-semibold hover:bg-sage-50 border border-sand-200"
                        >
                          Add
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Cart Special Instructions */}
            {totalCartCount > 0 && (
              <div className="pt-3 border-t border-sand-100">
                <label className="text-xs font-semibold text-sand-800 block mb-1">
                  Special Dietary or Delivery Notes
                </label>
                <textarea
                  rows={2}
                  value={cartInstructions}
                  onChange={(e) => setCartInstructions(e.target.value)}
                  placeholder="e.g., Deliver to balcony table, no onions, extra ice..."
                  className="w-full px-3 py-2 rounded-xl border border-sand-200 text-xs bg-sand-50/50"
                />
              </div>
            )}
          </div>
        ) : orderStage === "payment" ? (
          <div className="space-y-4">
            {/* Header bar */}
            <div className="flex items-center justify-between pb-2 border-b border-sand-200">
              <button
                onClick={() => setOrderStage("menu")}
                className="flex items-center gap-1.5 text-xs font-medium text-sand-600 hover:text-sand-950 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Cart
              </button>
              <span className="text-[11px] font-semibold text-sage-800 bg-sage-50 px-2.5 py-0.5 rounded-full border border-sage-200">
                Delivering to Room 412
              </span>
            </div>

            {/* Bill Summary Card */}
            <div className="rounded-xl border border-sand-200 bg-sand-50/70 p-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-sand-500 block">Total Amount to Pay</span>
                  <span className="font-serif text-xl font-bold text-sand-950">
                    ₹{cartTotal.toLocaleString()}
                  </span>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    Verified Merchant
                  </span>
                  <p className="text-[10px] text-sand-400 mt-1">Vesper Beach Resort · ICICI</p>
                </div>
              </div>
              <div className="mt-2.5 pt-2 border-t border-sand-200/80 text-[11px] text-sand-600 truncate">
                Items:{" "}
                {Object.entries(cart)
                  .map(([id, qty]) => {
                    const item = MENU_ITEMS.find((m) => m.id === id);
                    return `${item?.name} ×${qty}`;
                  })
                  .join(", ")}
              </div>
            </div>

            {/* Scan QR Section */}
            <div className="rounded-2xl border border-gold-200/90 bg-white p-4 text-center shadow-xs space-y-3">
              <div className="relative inline-block mx-auto rounded-xl p-3 bg-sand-50/60 border border-sand-200">
                {/* High Quality Authentic SVG QR Code */}
                <svg
                  className="w-44 h-44 mx-auto"
                  viewBox="0 0 200 200"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect width="200" height="200" rx="10" fill="white" />
                  {/* Top Left Detection Marker */}
                  <rect x="16" y="16" width="44" height="44" rx="6" stroke="#1c1917" strokeWidth="6" fill="white" />
                  <rect x="28" y="28" width="20" height="20" rx="3" fill="#1c1917" />
                  {/* Top Right Detection Marker */}
                  <rect x="140" y="16" width="44" height="44" rx="6" stroke="#1c1917" strokeWidth="6" fill="white" />
                  <rect x="152" y="28" width="20" height="20" rx="3" fill="#1c1917" />
                  {/* Bottom Left Detection Marker */}
                  <rect x="16" y="140" width="44" height="44" rx="6" stroke="#1c1917" strokeWidth="6" fill="white" />
                  <rect x="28" y="152" width="20" height="20" rx="3" fill="#1c1917" />

                  {/* Timing lines */}
                  <line x1="68" y1="28" x2="132" y2="28" stroke="#1c1917" strokeWidth="4" strokeDasharray="6 6" />
                  <line x1="28" y1="68" x2="28" y2="132" stroke="#1c1917" strokeWidth="4" strokeDasharray="6 6" />

                  {/* Data Matrix Dots */}
                  <rect x="68" y="44" width="8" height="8" fill="#1c1917" />
                  <rect x="84" y="44" width="16" height="8" fill="#1c1917" />
                  <rect x="116" y="44" width="12" height="8" fill="#1c1917" />
                  <rect x="44" y="68" width="12" height="12" fill="#1c1917" />
                  <rect x="64" y="68" width="8" height="12" fill="#1c1917" />
                  <rect x="128" y="68" width="16" height="12" fill="#1c1917" />
                  <rect x="152" y="68" width="12" height="12" fill="#1c1917" />
                  <rect x="44" y="88" width="8" height="16" fill="#1c1917" />
                  <rect x="60" y="88" width="12" height="8" fill="#1c1917" />
                  <rect x="132" y="88" width="20" height="16" fill="#1c1917" />
                  <rect x="160" y="88" width="12" height="16" fill="#1c1917" />
                  <rect x="44" y="112" width="16" height="12" fill="#1c1917" />
                  <rect x="68" y="112" width="12" height="16" fill="#1c1917" />
                  <rect x="124" y="112" width="12" height="8" fill="#1c1917" />
                  <rect x="144" y="112" width="16" height="16" fill="#1c1917" />
                  <rect x="68" y="140" width="12" height="16" fill="#1c1917" />
                  <rect x="88" y="140" width="16" height="8" fill="#1c1917" />
                  <rect x="112" y="140" width="20" height="12" fill="#1c1917" />
                  <rect x="140" y="140" width="16" height="16" fill="#1c1917" />
                  <rect x="164" y="140" width="12" height="8" fill="#1c1917" />
                  <rect x="68" y="164" width="20" height="12" fill="#1c1917" />
                  <rect x="96" y="164" width="12" height="8" fill="#1c1917" />
                  <rect x="116" y="164" width="16" height="12" fill="#1c1917" />
                  <rect x="148" y="164" width="24" height="12" fill="#1c1917" />

                  {/* Center Brand Badge */}
                  <rect x="76" y="76" width="48" height="48" rx="8" fill="#1c1917" stroke="#d97706" strokeWidth="2" />
                  <path d="M100 84L103 95L114 98L103 101L100 112L97 101L86 98L97 95Z" fill="#f59e0b" />
                  <text x="100" y="119" textAnchor="middle" fill="#fef3c7" fontSize="7" fontWeight="bold" letterSpacing="0.5">
                    UPI
                  </text>
                </svg>

                {/* Pulsing scanning beam line */}
                <div className="pointer-events-none absolute inset-x-4 top-4 bottom-4 overflow-hidden rounded-lg">
                  <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-emerald-500 to-transparent shadow-[0_0_8px_rgba(16,185,129,0.9)] animate-pulse" />
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-sand-900">
                  Scan with any UPI App to Pay
                </p>
                <p className="text-[11px] text-sand-500 mt-0.5">
                  Open Google Pay, PhonePe, Paytm, or BHIM and point your camera at this QR code.
                </p>
              </div>

              {/* Supported Apps Chips */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                {[
                  { name: "GPay", color: "bg-blue-50 text-blue-800 border-blue-200" },
                  { name: "PhonePe", color: "bg-purple-50 text-purple-800 border-purple-200" },
                  { name: "Paytm", color: "bg-sky-50 text-sky-800 border-sky-200" },
                  { name: "BHIM", color: "bg-emerald-50 text-emerald-800 border-emerald-200" },
                  { name: "CRED", color: "bg-sand-100 text-sand-800 border-sand-300" },
                ].map((app) => (
                  <span
                    key={app.name}
                    className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                      app.color
                    )}
                  >
                    {app.name}
                  </span>
                ))}
              </div>

              {/* Simulate Scan Button */}
              <Button
                onClick={() => handleProcessPayment("UPI QR Code")}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-2.5 rounded-xl shadow-soft flex items-center justify-center gap-2"
              >
                <Smartphone className="w-4 h-4" />
                Simulate QR Scan & Pay ₹{cartTotal.toLocaleString()}
              </Button>
            </div>

            {/* Fallback Option */}
            <div className="pt-2 border-t border-sand-200/80 text-center">
              <button
                onClick={() => handleProcessPayment("Room Folio Charge")}
                className="text-xs font-medium text-sand-600 hover:text-sand-950 underline transition"
              >
                Or charge ₹{cartTotal.toLocaleString()} to Room 412 folio (Pay at Checkout)
              </button>
            </div>
          </div>
        ) : orderStage === "verifying" ? (
          <div className="flex h-full flex-col items-center justify-center py-12 px-4 text-center space-y-4">
            <div className="relative flex h-20 w-20 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-30" />
              <div className="h-16 w-16 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin" />
              <ShieldCheck className="absolute h-7 w-7 text-emerald-600" />
            </div>

            <div>
              <h3 className="font-serif text-lg font-bold text-sand-950">
                Authorizing UPI Transaction
              </h3>
              <p className="text-xs text-sand-500 mt-1 max-w-xs">
                Communicating with NPCI payment switch and verifying ₹{cartTotal.toLocaleString()} for Room 412...
              </p>
            </div>

            <div className="rounded-xl border border-sand-200 bg-sand-50 p-3 text-left w-full max-w-xs text-xs space-y-1">
              <div className="flex justify-between text-sand-500">
                <span>Method</span>
                <span className="font-medium text-sand-900">{lastPaymentMethod}</span>
              </div>
              <div className="flex justify-between text-sand-500">
                <span>Transaction Ref</span>
                <span className="font-mono text-[11px] text-sand-700">{paymentTxnId}</span>
              </div>
              <div className="flex justify-between text-sand-500">
                <span>Status</span>
                <span className="text-amber-700 font-medium">Processing...</span>
              </div>
            </div>
          </div>
        ) : (
          /* Success Screen */
          <div className="flex h-full flex-col items-center justify-center py-8 px-4 text-center space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 shadow-sm animate-in zoom-in-75">
              <Check className="h-8 w-8 stroke-[3]" />
            </div>

            <div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200 mb-2">
                UPI Payment Confirmed
              </span>
              <h3 className="font-serif text-xl font-bold text-sand-950">
                Order Sent to Kitchen!
              </h3>
              <p className="text-xs text-sand-500 mt-1 max-w-xs">
                Your payment of ₹{cartTotal.toLocaleString()} was received successfully. The culinary team is preparing your order for Room 412.
              </p>
            </div>

            <div className="rounded-xl border border-sand-200 bg-sand-50/80 p-3.5 text-left w-full max-w-sm text-xs space-y-1.5">
              <div className="flex justify-between text-sand-500">
                <span>Payment Ref</span>
                <span className="font-mono text-[11px] font-semibold text-sand-900">
                  {paymentTxnId}
                </span>
              </div>
              <div className="flex justify-between text-sand-500">
                <span>Paid via</span>
                <span className="font-medium text-sand-900">{lastPaymentMethod}</span>
              </div>
              <div className="flex justify-between text-sand-500">
                <span>Destination</span>
                <span className="font-medium text-sand-900">Room 412 (Balcony table)</span>
              </div>
              <div className="flex justify-between text-sand-500">
                <span>Est. Delivery</span>
                <span className="font-semibold text-sage-900">20–30 Minutes</span>
              </div>
            </div>

            <Button
              onClick={handleCloseRoomService}
              className="w-full max-w-sm bg-sage-800 hover:bg-sage-900 text-white font-semibold py-2.5 rounded-xl shadow-soft"
            >
              Track Order on Dashboard
            </Button>
          </div>
        )}
      </Drawer>

      {/* 2. HOUSEKEEPING REQUEST DRAWER */}
      <Drawer
        open={activeDrawer === "housekeeping"}
        onOpenChange={(open) => {
          if (!open) setActiveDrawer(null);
        }}
        title="Housekeeping Request"
        description="Schedule room turnaround, fresh linens, or turndown service."
        footer={
          <Button
            onClick={handleRequestHousekeeping}
            className="w-full bg-sage-700 hover:bg-sage-800 text-white font-semibold py-2.5 rounded-xl shadow-soft"
          >
            Confirm Housekeeping Request
          </Button>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-sand-800 block mb-2">Service Type</label>
            <div className="space-y-2">
              {[
                { title: "Full Room Turnover & Fresh Linens", desc: "Complete bed change, vacuuming, and bathroom sanitization." },
                { title: "Evening Turndown Service", desc: "Ambient lighting, drapes drawn, pillow refresh, and chocolates." },
                { title: "Quick Trash & Amenity Restock", desc: "Clear room bins, restock coffee, water, and bath amenities." },
              ].map((opt) => (
                <div
                  key={opt.title}
                  onClick={() => setHousekeepingType(opt.title)}
                  className={cn(
                    "p-3 rounded-xl border cursor-pointer transition-all",
                    housekeepingType === opt.title
                      ? "border-sage-600 bg-sage-50/40 text-sage-950 font-semibold"
                      : "border-sand-200 hover:bg-sand-50 text-sand-700"
                  )}
                >
                  <p className="font-medium text-sand-950">{opt.title}</p>
                  <p className="text-[11px] text-sand-500 mt-0.5">{opt.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="font-semibold text-sand-800 block mb-2">Preferred Timing</label>
            <div className="grid grid-cols-1 gap-2">
              {[
                "Immediate (Within 20 mins)",
                "In 1 Hour",
                "This Evening (18:00 - 20:00)",
              ].map((time) => (
                <button
                  key={time}
                  type="button"
                  onClick={() => setHousekeepingTime(time)}
                  className={cn(
                    "px-3 py-2 rounded-xl border text-left font-medium transition-colors",
                    housekeepingTime === time
                      ? "border-sage-600 bg-sage-50 text-sage-950"
                      : "border-sand-200 text-sand-700 hover:bg-sand-50"
                  )}
                >
                  {time}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="font-semibold text-sand-800 block mb-1">Additional Notes</label>
            <textarea
              rows={2}
              value={housekeepingNotes}
              onChange={(e) => setHousekeepingNotes(e.target.value)}
              placeholder="e.g., Please do not disturb before 11 AM..."
              className="w-full px-3 py-2 rounded-xl border border-sand-200 bg-sand-50/50"
            />
          </div>
        </div>
      </Drawer>

      {/* 3. EXTRA TOWELS DRAWER */}
      <Drawer
        open={activeDrawer === "towels"}
        onOpenChange={(open) => {
          if (!open) setActiveDrawer(null);
        }}
        title="Extra Towels & Linens"
        description="Fresh Egyptian cotton towels delivered to Room 412."
        footer={
          <Button
            onClick={handleRequestTowels}
            className="w-full bg-sage-700 hover:bg-sage-800 text-white font-semibold py-2.5 rounded-xl shadow-soft"
          >
            Send Towels to Room 412
          </Button>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="divide-y divide-sand-100">
            {[
              { id: "bath", name: "Plush Bath Towels", desc: "100% combed Egyptian cotton (700 GSM)" },
              { id: "hand", name: "Hand Towels & Washcloths", desc: "Ultra-soft woven hand towels" },
              { id: "pool", name: "Pool & Beach Towels", desc: "Extra-long striped cabana towels" },
              { id: "robe", name: "Luxury Velour Bathrobes", desc: "Shawl collar with Vesper monogram" },
            ].map((item) => (
              <div key={item.id} className="py-3.5 flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-sand-950">{item.name}</h4>
                  <p className="text-[11px] text-sand-500 mt-0.5">{item.desc}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0 bg-sand-100/80 rounded-lg p-1">
                  <button
                    onClick={() =>
                      setTowelsCount((prev) => ({
                        ...prev,
                        [item.id]: Math.max(0, (prev[item.id] || 0) - 1),
                      }))
                    }
                    className="w-6 h-6 rounded bg-white text-sand-700 flex items-center justify-center hover:bg-sand-200 transition-colors shadow-2xs"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs font-bold text-sand-950 w-4 text-center tabular-nums">
                    {towelsCount[item.id] || 0}
                  </span>
                  <button
                    onClick={() =>
                      setTowelsCount((prev) => ({
                        ...prev,
                        [item.id]: (prev[item.id] || 0) + 1,
                      }))
                    }
                    className="w-6 h-6 rounded bg-sage-700 text-white flex items-center justify-center hover:bg-sage-800 transition-colors shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Drawer>

      {/* 4. REPORT AN ISSUE DRAWER */}
      <Drawer
        open={activeDrawer === "issue"}
        onOpenChange={(open) => {
          if (!open) setActiveDrawer(null);
        }}
        title="Report an In-Room Issue"
        description="Our 24/7 resort engineering team will attend to your room immediately."
        footer={
          <Button
            onClick={handleReportIssue}
            className="w-full bg-rose-700 hover:bg-rose-800 text-white font-semibold py-2.5 rounded-xl shadow-soft"
          >
            Dispatch Maintenance Engineer
          </Button>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-sand-800 block mb-2">Issue Category</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                "AC / Climate Control",
                "Plumbing / Water Leak",
                "Lighting / Electrical",
                "Wi-Fi / Smart TV",
                "Keycard / Door Lock",
                "Other Room Maintenance",
              ].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setIssueCategory(cat)}
                  className={cn(
                    "p-2.5 rounded-xl border text-left font-medium transition-colors text-xs",
                    issueCategory === cat
                      ? "border-rose-300 bg-rose-50/60 text-rose-950 font-bold"
                      : "border-sand-200 text-sand-700 hover:bg-sand-50"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="font-semibold text-sand-800 block mb-1">
              Please describe the problem
            </label>
            <textarea
              rows={3}
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              placeholder="e.g., The AC unit is making a slight rattling noise and not cooling below 24°C..."
              className="w-full px-3 py-2 rounded-xl border border-sand-200 bg-sand-50/50 text-xs"
            />
          </div>

          {/* Photo upload toggle simulation */}
          <div
            onClick={() => setHasIssuePhoto(!hasIssuePhoto)}
            className={cn(
              "p-3 rounded-xl border border-dashed flex items-center justify-between cursor-pointer transition-all",
              hasIssuePhoto
                ? "border-emerald-400 bg-emerald-50/40 text-emerald-800"
                : "border-sand-300 bg-sand-50/30 text-sand-600"
            )}
          >
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-sage-600" />
              <span>{hasIssuePhoto ? "Photo Attached (room412_issue.jpg)" : "Attach Photo (Optional)"}</span>
            </div>
            {hasIssuePhoto && <Check className="w-4 h-4 text-emerald-600" />}
          </div>
        </div>
      </Drawer>

      {/* Floating AI Concierge Launcher */}
      <button
        onClick={() => setAiConciergeOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 rounded-full border border-gold-300/80 bg-sage-800 px-4 py-3 text-xs font-semibold text-white shadow-elevated transition-all hover:bg-sage-900 hover:scale-105 group"
        aria-label="Open AI Concierge"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </span>
        <Sparkles className="h-4 w-4 text-gold-300 transition-transform group-hover:rotate-12" />
        <span>Ask AI Concierge</span>
      </button>

      {/* Guest AI Concierge Drawer */}
      <GuestAiConciergeDrawer
        open={aiConciergeOpen}
        onOpenChange={setAiConciergeOpen}
        roomNumber="412"
        onOpenRoomService={() => {
          setActiveDrawer("room-service");
        }}
      />
    </div>
  );
}
