"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Check,
  ChevronRight,
  ConciergeBell,
  Loader2,
  Sparkle,
  SprayCan,
  TriangleAlert,
  Waves,
  Plus,
  Minus,
  ShoppingBag,
  Clock,
  Camera,
  Utensils,
  CheckCircle2,
  X,
  Star,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { StarRating } from "@/components/ui/star-rating";
import { useToast } from "@/components/ui/toast";
import { reviewErrorMessage, useRateStaff, useRateableStaff } from "@/lib/hooks/use-reviews";
import {
  addGuestRequest,
  subscribeRequests,
  getStoredRequests,
  type GuestRequest,
} from "@/lib/demo/requests";
import { cn } from "@/lib/utils";

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

  // Cart state: { [itemId]: quantity }
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartInstructions, setCartInstructions] = useState("");
  const [menuCategory, setMenuCategory] = useState<"all" | "all-day" | "beverages" | "desserts">("all");

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

  // Active request state (for Room 412)
  const [activeRequest, setActiveRequest] = useState<GuestRequest | null>(null);
  const [serviceRating, setServiceRating] = useState<number>(0);

  // Staff rating state (existing)
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const { staff: servedBy, isLoading: staffLoading } = useRateableStaff();
  const rateStaff = useRateStaff();

  // Load and listen to requests for Room 412
  useEffect(() => {
    const updateFromStore = (all: GuestRequest[]) => {
      // Find the most relevant request for Room 412
      const roomReqs = all.filter((r) => r.room === "412");
      if (roomReqs.length > 0) {
        // Prioritize in-progress or new, else latest done
        const active =
          roomReqs.find((r) => r.state === "accepted") ||
          roomReqs.find((r) => r.state === "new") ||
          roomReqs[0];
        setActiveRequest(active);
      } else {
        // Default seed request
        const initialReq: GuestRequest = {
          id: "REQ-4182",
          room: "412",
          guest: "In-Room Guest",
          channel: "Room Service",
          summary: "Mumbai Club Sandwich ×2",
          detail: "Deliver to balcony table. Extra napkins requested.",
          raisedAt: "10:24 AM",
          openFor: 6,
          sla: 30,
          state: "accepted",
          assignee: "Ramesh Patil",
          value: 1300,
        };
        setActiveRequest(initialReq);
      }
    };

    updateFromStore(getStoredRequests());
    const unsub = subscribeRequests(updateFromStore);
    return unsub;
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

  // Submit Room Service Order
  const handlePlaceOrder = () => {
    if (totalCartCount === 0) return;

    const summaryItems = Object.entries(cart)
      .map(([id, qty]) => {
        const item = MENU_ITEMS.find((m) => m.id === id);
        return `${item?.name} ×${qty}`;
      })
      .join(", ");

    const newReq = addGuestRequest({
      room: "412",
      guest: "In-Room Guest",
      channel: "Room Service",
      summary: summaryItems,
      detail: cartInstructions ? `Notes: ${cartInstructions}` : "Standard preparation.",
      value: cartTotal,
      sla: 30,
      state: "new",
    });

    setActiveRequest(newReq);
    setCart({});
    setCartInstructions("");
    setActiveDrawer(null);
    setServiceRating(0);

    showToast({
      title: "Order Placed Successfully",
      description: `Your order for ${summaryItems} has been sent to the kitchen.`,
      type: "success",
    });
  };

  // Submit Housekeeping Request
  const handleRequestHousekeeping = () => {
    const newReq = addGuestRequest({
      room: "412",
      guest: "In-Room Guest",
      channel: "Housekeeping",
      summary: housekeepingType,
      detail: `Preferred time: ${housekeepingTime}.${housekeepingNotes ? ` Notes: ${housekeepingNotes}` : ""}`,
      sla: 20,
      state: "new",
    });

    setActiveRequest(newReq);
    setActiveDrawer(null);
    setServiceRating(0);

    showToast({
      title: "Housekeeping Requested",
      description: `${housekeepingType} scheduled. Attendant assigned shortly.`,
      type: "success",
    });
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

    const newReq = addGuestRequest({
      room: "412",
      guest: "In-Room Guest",
      channel: "Housekeeping",
      summary: towelSummary || "Extra Towels",
      detail: "Deliver to Room 412.",
      sla: 15,
      state: "new",
    });

    setActiveRequest(newReq);
    setActiveDrawer(null);
    setServiceRating(0);

    showToast({
      title: "Towels Requested",
      description: `${towelSummary || "Towels"} dispatched to Room 412.`,
      type: "success",
    });
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

    const newReq = addGuestRequest({
      room: "412",
      guest: "In-Room Guest",
      channel: "Maintenance",
      summary: issueCategory,
      detail: `${issueDescription}${hasIssuePhoto ? " [Photo proof attached]" : ""}`,
      sla: 30,
      state: "new",
    });

    setActiveRequest(newReq);
    setIssueDescription("");
    setHasIssuePhoto(false);
    setActiveDrawer(null);
    setServiceRating(0);

    showToast({
      title: "Issue Dispatched to Engineering",
      description: `${issueCategory} logged. Duty engineer notified.`,
      type: "success",
    });
  };

  // Staff rating submission
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

      {/* 1. ROOM SERVICE MENU & CART DRAWER */}
      <Drawer
        open={activeDrawer === "room-service"}
        onOpenChange={(open) => {
          if (!open) setActiveDrawer(null);
        }}
        title="Room Service Menu"
        description="Freshly prepared culinary offerings delivered to Room 412."
        footer={
          totalCartCount > 0 ? (
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
                onClick={handlePlaceOrder}
                className="w-full bg-sage-700 hover:bg-sage-800 text-white font-semibold py-2.5 rounded-xl shadow-soft"
              >
                Place Order (₹{cartTotal.toLocaleString()})
              </Button>
            </div>
          ) : undefined
        }
      >
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
    </div>
  );
}
