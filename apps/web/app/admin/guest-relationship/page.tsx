"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Award,
  Bell,
  CheckCircle2,
  ChevronRight,
  CircleUser,
  Clock,
  Filter,
  Gift,
  Heart,
  HeartHandshake,
  IndianRupee,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldAlert,
  Sparkles,
  Star,
  User,
  UserCheck,
  Users,
  X,
  Zap,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

// Types
interface ServiceRequestItem {
  id: string;
  kind: string;
  status: string;
  room_number: string;
  note: string | null;
  total_amount: number;
  sla_minutes: number;
  due_at: string;
  created_at: string;
  is_overdue: boolean;
}

interface CommMessage {
  id: string;
  room_number: string;
  guest_name: string;
  channel: "whatsapp" | "sms" | "in_app" | "email";
  last_message: string;
  unread: boolean;
  status: "active" | "resolved" | "escalated";
  timestamp: string;
}

interface GuestProfileItem {
  id: string;
  guest_name: string;
  room_number: string;
  vip_tier: "Platinum Elite" | "Gold Reserve" | "Ambassador" | "Silver";
  total_stays: number;
  lifetime_spend: number;
  sentiment_score: number;
  risk_level: "low" | "medium" | "high";
  special_preferences: string[];
  recommended_perk: string;
}

const CLOSED_REQUEST_STATUSES = new Set(["delivered", "cancelled"]);

const MOCK_COMMUNICATIONS: CommMessage[] = [
  {
    id: "msg-1",
    room_number: "407",
    guest_name: "Vikram Malhotra",
    channel: "whatsapp",
    last_message: "Can we get 2 extra feather pillows and an iron board delivered?",
    unread: true,
    status: "escalated",
    timestamp: "2 mins ago",
  },
  {
    id: "msg-2",
    room_number: "204",
    guest_name: "Sarah Jenkins",
    channel: "in_app",
    last_message: "The sunset champagne tour was spectacular. Thank you for arranging!",
    unread: false,
    status: "resolved",
    timestamp: "18 mins ago",
  },
  {
    id: "msg-3",
    room_number: "512",
    guest_name: "Rajesh Singhania",
    channel: "sms",
    last_message: "Requesting late checkout at 2:00 PM tomorrow due to late flight.",
    unread: true,
    status: "active",
    timestamp: "35 mins ago",
  },
  {
    id: "msg-4",
    room_number: "108",
    guest_name: "Elena Rostova",
    channel: "whatsapp",
    last_message: "Please ensure the vegetarian gluten-free breakfast basket is ready at 8 AM.",
    unread: false,
    status: "active",
    timestamp: "1 hour ago",
  },
];

const MOCK_GUEST_PROFILES: GuestProfileItem[] = [
  {
    id: "gp-1",
    guest_name: "Vikram Malhotra",
    room_number: "407",
    vip_tier: "Platinum Elite",
    total_stays: 14,
    lifetime_spend: 480000,
    sentiment_score: 4.8,
    risk_level: "low",
    special_preferences: ["High floor ocean facing", "Non-feather pillows", "Sparkling water on arrival"],
    recommended_perk: "Complimentary Single Malt Tasting at Sunset Lounge",
  },
  {
    id: "gp-2",
    guest_name: "Sarah Jenkins",
    room_number: "204",
    vip_tier: "Ambassador",
    total_stays: 8,
    lifetime_spend: 320000,
    sentiment_score: 5.0,
    risk_level: "low",
    special_preferences: ["Early morning badminton", "Organic matcha tea", "Late turndown service"],
    recommended_perk: "Badminton Pavilion Morning Perk with Yonex Gear",
  },
  {
    id: "gp-3",
    guest_name: "Rajesh Singhania",
    room_number: "512",
    vip_tier: "Gold Reserve",
    total_stays: 5,
    lifetime_spend: 195000,
    sentiment_score: 3.4,
    risk_level: "high",
    special_preferences: ["Vegetarian Jains menu", "Express laundry", "Quiet wing"],
    recommended_perk: "Complimentary Chef's Special Jain Thali & Late Checkout",
  },
  {
    id: "gp-4",
    guest_name: "Elena Rostova",
    room_number: "108",
    vip_tier: "Silver",
    total_stays: 3,
    lifetime_spend: 110000,
    sentiment_score: 4.6,
    risk_level: "medium",
    special_preferences: ["Airport Mercedes transfer", "Spa aroma massage"],
    recommended_perk: "20% Luxury Ayurvedic Spa Voucher",
  },
];

export default function GuestRelationshipPage() {
  const { user, hasPermission } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"requests" | "communications" | "profiles">("requests");
  const [requestFilter, setRequestFilter] = useState<string>("open");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedConversation, setSelectedConversation] = useState<CommMessage | null>(MOCK_COMMUNICATIONS[0]);
  const [replyText, setReplyText] = useState<string>("");

  // 1. Fetch live requests
  const requestsKey = ["requests", user?.propertyId ?? "", user?.id ?? ""];
  const {
    data: rawRequests = [],
    isLoading: requestsLoading,
    refetch: refetchRequests,
  } = useQuery<ServiceRequestItem[]>({
    queryKey: requestsKey,
    queryFn: () => api.get<ServiceRequestItem[]>("/requests"),
    enabled: Boolean(user),
    refetchInterval: 30_000,
  });

  // Request actions mutation
  const requestMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "accept" | "in_progress" | "delivered" }) =>
      action === "accept"
        ? api.post(`/requests/${id}/accept`)
        : api.put(`/requests/${id}/status`, { status: action }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: requestsKey });
      showToast({
        title: "Request Updated",
        description: "Guest service status has been updated in real-time.",
        type: "default",
      });
    },
    onError: (err: any) => {
      showToast({
        title: "Update Failed",
        description: err.message ?? "Could not update request status.",
        type: "error",
      });
    },
  });

  // Dispatch perk mutation
  const dispatchPerkMutation = useMutation({
    mutationFn: (data: { room_number: string; perk: string; guest_name: string }) =>
      api.post("/guest-intel/goodies/dispatch", {
        room_number: data.room_number,
        title: data.perk,
      }),
    onSuccess: (res: any, variables) => {
      showToast({
        title: "VIP Reward Dispatched",
        description: `Delivered ${variables.perk} to Room ${variables.room_number} (${variables.guest_name}).`,
        type: "default",
      });
    },
    onError: (err: any) => {
      showToast({
        title: "Perk Dispatch Error",
        description: err.message ?? "Could not dispatch perk.",
        type: "error",
      });
    },
  });

  // Request calculations
  const openRequestsCount = rawRequests.filter((r) => !CLOSED_REQUEST_STATUSES.has(r.status)).length;
  const overdueRequestsCount = rawRequests.filter((r) => r.is_overdue && !CLOSED_REQUEST_STATUSES.has(r.status)).length;
  const deliveredTodayCount = rawRequests.filter((r) => r.status === "delivered").length;

  const filteredRequests = useMemo(() => {
    return rawRequests.filter((req) => {
      if (requestFilter === "open") return !CLOSED_REQUEST_STATUSES.has(req.status);
      if (requestFilter === "overdue") return req.is_overdue && !CLOSED_REQUEST_STATUSES.has(req.status);
      if (requestFilter === "all") return true;
      return req.status === requestFilter;
    });
  }, [rawRequests, requestFilter]);

  const handleSendReply = () => {
    if (!replyText.trim() || !selectedConversation) return;
    showToast({
      title: "Message Dispatched",
      description: `Sent via ${selectedConversation.channel.toUpperCase()} to Room ${selectedConversation.room_number}.`,
      type: "default",
    });
    setReplyText("");
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <PageHeader
        title="Guest Relationship"
        description="Unified guest experience command center: real-time room requests, 2-way omnichannel communications, and VIP retention intel."
        meta={format(new Date(), "EEEE, d MMMM yyyy")}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchRequests();
                showToast({
                  title: "Refreshed",
                  description: "Guest relationship telemetry updated.",
                  type: "default",
                });
              }}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        }
      />

      {/* TOP FLASH CARDS: Overall Performance across the 3 Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Pillar 1: Guest Requests */}
        <div
          onClick={() => setActiveTab("requests")}
          className={cn(
            "rounded-2xl border p-5 transition-all cursor-pointer",
            activeTab === "requests"
              ? "border-sand-900 bg-sand-900 text-white shadow-md ring-2 ring-sand-900/20"
              : "border-sand-200 bg-white hover:border-sand-400 hover:shadow-xs text-sand-950"
          )}
        >
          <div className="flex items-center justify-between">
            <span className={cn("text-xs font-semibold uppercase tracking-wider", activeTab === "requests" ? "text-sand-300" : "text-sand-500")}>
              Pillar 1 · Service Requests
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                activeTab === "requests"
                  ? "bg-sand-800 text-sand-100"
                  : overdueRequestsCount > 0
                  ? "bg-rose-100 text-rose-800"
                  : "bg-emerald-100 text-emerald-800"
              )}
            >
              {overdueRequestsCount > 0 ? `${overdueRequestsCount} Overdue SLA` : "All on Track"}
            </span>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <div>
              <p className="font-serif text-3xl font-semibold tracking-tight">{openRequestsCount}</p>
              <p className={cn("text-xs mt-0.5", activeTab === "requests" ? "text-sand-300" : "text-sand-600")}>
                Active room requests in queue
              </p>
            </div>
            <div className="text-right">
              <span className={cn("text-xs font-mono font-bold", activeTab === "requests" ? "text-emerald-400" : "text-emerald-700")}>
                {deliveredTodayCount} Delivered
              </span>
              <p className={cn("text-[10px]", activeTab === "requests" ? "text-sand-400" : "text-sand-500")}>96% SLA compliance</p>
            </div>
          </div>
        </div>

        {/* Pillar 2: Guest Communications */}
        <div
          onClick={() => setActiveTab("communications")}
          className={cn(
            "rounded-2xl border p-5 transition-all cursor-pointer",
            activeTab === "communications"
              ? "border-sand-900 bg-sand-900 text-white shadow-md ring-2 ring-sand-900/20"
              : "border-sand-200 bg-white hover:border-sand-400 hover:shadow-xs text-sand-950"
          )}
        >
          <div className="flex items-center justify-between">
            <span className={cn("text-xs font-semibold uppercase tracking-wider", activeTab === "communications" ? "text-sand-300" : "text-sand-500")}>
              Pillar 2 · Communications
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                activeTab === "communications" ? "bg-sand-800 text-amber-300" : "bg-amber-100 text-amber-800"
              )}
            >
              <MessageSquare className="h-3 w-3" />
              WhatsApp & In-App
            </span>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <div>
              <p className="font-serif text-3xl font-semibold tracking-tight">{MOCK_COMMUNICATIONS.length}</p>
              <p className={cn("text-xs mt-0.5", activeTab === "communications" ? "text-sand-300" : "text-sand-600")}>
                Active customer threads
              </p>
            </div>
            <div className="text-right">
              <span className={cn("text-xs font-mono font-bold", activeTab === "communications" ? "text-emerald-400" : "text-emerald-700")}>
                +0.88 Sentiment
              </span>
              <p className={cn("text-[10px]", activeTab === "communications" ? "text-sand-400" : "text-sand-500")}>Average reply &lt; 2 min</p>
            </div>
          </div>
        </div>

        {/* Pillar 3: Guest Profiles & Loyalty */}
        <div
          onClick={() => setActiveTab("profiles")}
          className={cn(
            "rounded-2xl border p-5 transition-all cursor-pointer",
            activeTab === "profiles"
              ? "border-sand-900 bg-sand-900 text-white shadow-md ring-2 ring-sand-900/20"
              : "border-sand-200 bg-white hover:border-sand-400 hover:shadow-xs text-sand-950"
          )}
        >
          <div className="flex items-center justify-between">
            <span className={cn("text-xs font-semibold uppercase tracking-wider", activeTab === "profiles" ? "text-sand-300" : "text-sand-500")}>
              Pillar 3 · VIP CRM & Intel
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                activeTab === "profiles" ? "bg-sand-800 text-gold-300" : "bg-gold-50 text-gold-900 border border-gold-200"
              )}
            >
              <Sparkles className="h-3 w-3 text-gold-500" />
              AI Retention Active
            </span>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <div>
              <p className="font-serif text-3xl font-semibold tracking-tight">80 In-House</p>
              <p className={cn("text-xs mt-0.5", activeTab === "profiles" ? "text-sand-300" : "text-sand-600")}>
                4 Elite VIPs currently checked in
              </p>
            </div>
            <div className="text-right">
              <span className={cn("text-xs font-mono font-bold", activeTab === "profiles" ? "text-gold-300" : "text-gold-700")}>
                4.82 / 5.0 Rating
              </span>
              <p className={cn("text-[10px]", activeTab === "profiles" ? "text-sand-400" : "text-sand-500")}>94% Positive pace</p>
            </div>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS FOR THE 3 PILLARS */}
      <div className="flex border-b border-sand-200 gap-6">
        <button
          onClick={() => setActiveTab("requests")}
          className={cn(
            "pb-3 text-sm font-semibold transition-all relative flex items-center gap-2",
            activeTab === "requests" ? "text-sand-950" : "text-sand-500 hover:text-sand-800"
          )}
        >
          <span>1. Live Guest Requests & SLA</span>
          <span className="rounded-full bg-sand-200 px-2 py-0.5 text-xs text-sand-800 font-mono">
            {openRequestsCount}
          </span>
          {activeTab === "requests" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sand-950 rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab("communications")}
          className={cn(
            "pb-3 text-sm font-semibold transition-all relative flex items-center gap-2",
            activeTab === "communications" ? "text-sand-950" : "text-sand-500 hover:text-sand-800"
          )}
        >
          <span>2. Guest Communications & Chat</span>
          <span className="rounded-full bg-sand-200 px-2 py-0.5 text-xs text-sand-800 font-mono">
            {MOCK_COMMUNICATIONS.length}
          </span>
          {activeTab === "communications" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sand-950 rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab("profiles")}
          className={cn(
            "pb-3 text-sm font-semibold transition-all relative flex items-center gap-2",
            activeTab === "profiles" ? "text-sand-950" : "text-sand-500 hover:text-sand-800"
          )}
        >
          <span>3. VIP Guest Profiles & Retention</span>
          <span className="rounded-full bg-sand-200 px-2 py-0.5 text-xs text-sand-800 font-mono">
            {MOCK_GUEST_PROFILES.length}
          </span>
          {activeTab === "profiles" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sand-950 rounded-full" />
          )}
        </button>
      </div>

      {/* =========================================================================
          TAB 1: GUEST REQUESTS & SLA QUEUE
          ========================================================================= */}
      {activeTab === "requests" && (
        <Panel>
          <PanelHeader
            title="Service Requests Queue"
            description="Real-time delivery requests dispatched from guest room tablets and mobile QR sessions."
            action={
              <div className="flex flex-wrap gap-1.5">
                {["open", "overdue", "raised", "accepted", "in_progress", "delivered", "all"].map((val) => (
                  <button
                    key={val}
                    onClick={() => setRequestFilter(val)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs capitalize transition-all",
                      requestFilter === val
                        ? "bg-sand-900 text-white font-semibold"
                        : "border border-sand-200 bg-white text-sand-700 hover:bg-sand-50"
                    )}
                  >
                    {val.replace("_", " ")}
                  </button>
                ))}
              </div>
            }
          />
          <PanelBody className="space-y-4">
            {requestsLoading ? (
              <div className="py-12 text-center text-sm text-sand-500">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-sand-400" />
                Loading service requests…
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="py-12 text-center text-sm text-sand-500">
                No requests currently in this filter.
              </div>
            ) : (
              <div className="divide-y divide-sand-100">
                {filteredRequests.map((req) => (
                  <div
                    key={req.id}
                    className={cn(
                      "py-4 flex flex-wrap items-center justify-between gap-4 transition-colors rounded-xl px-3",
                      req.is_overdue && !CLOSED_REQUEST_STATUSES.has(req.status)
                        ? "bg-rose-50/60 border border-rose-200"
                        : "hover:bg-sand-50/60"
                    )}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sand-950 text-sm">
                          Room {req.room_number} · {req.kind.replace("_", " ")}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                            req.status === "delivered"
                              ? "bg-emerald-100 text-emerald-800"
                              : req.status === "in_progress"
                              ? "bg-blue-100 text-blue-800"
                              : req.status === "accepted"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-sand-100 text-sand-700"
                          )}
                        >
                          {req.status.replace("_", " ")}
                        </span>
                        {req.is_overdue && !CLOSED_REQUEST_STATUSES.has(req.status) && (
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Overdue SLA
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-sand-700">
                        {req.note || "No special instructions"}
                      </p>
                      <p className="text-[11px] text-sand-500 font-mono">
                        Target SLA: {req.sla_minutes}m · Due: {new Date(req.due_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        {Number(req.total_amount) > 0 && ` · ₹${Number(req.total_amount).toLocaleString("en-IN")}`}
                      </p>
                    </div>

                    {/* Quick action buttons */}
                    <div className="flex items-center gap-2">
                      {req.status === "raised" && (
                        <Button
                          size="sm"
                          disabled={requestMutation.isPending}
                          onClick={() => requestMutation.mutate({ id: req.id, action: "accept" })}
                          className="bg-sand-900 text-sand-50 hover:bg-sand-800"
                        >
                          Accept
                        </Button>
                      )}
                      {req.status === "accepted" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={requestMutation.isPending}
                          onClick={() => requestMutation.mutate({ id: req.id, action: "in_progress" })}
                        >
                          Start Work
                        </Button>
                      )}
                      {(req.status === "accepted" || req.status === "in_progress") && (
                        <Button
                          size="sm"
                          disabled={requestMutation.isPending}
                          onClick={() => requestMutation.mutate({ id: req.id, action: "delivered" })}
                          className="bg-emerald-700 text-white hover:bg-emerald-800"
                        >
                          Mark Delivered
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PanelBody>
        </Panel>
      )}

      {/* =========================================================================
          TAB 2: GUEST COMMUNICATIONS & CHAT
          ========================================================================= */}
      {activeTab === "communications" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Threads list */}
          <div className="lg:col-span-5 space-y-3">
            <Panel>
              <PanelHeader
                title="Active Conversations"
                description="Live guest chats across WhatsApp, SMS, and in-room portal."
              />
              <PanelBody className="p-0">
                <div className="divide-y divide-sand-100">
                  {MOCK_COMMUNICATIONS.map((comm) => (
                    <div
                      key={comm.id}
                      onClick={() => setSelectedConversation(comm)}
                      className={cn(
                        "p-4 cursor-pointer transition-colors",
                        selectedConversation?.id === comm.id
                          ? "bg-sand-100/70 border-l-4 border-l-sand-900"
                          : "hover:bg-sand-50/60"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sand-950 text-sm">{comm.guest_name}</span>
                          <span className="rounded bg-sand-200/80 px-1.5 py-0.5 text-[10px] font-mono text-sand-800">
                            Room {comm.room_number}
                          </span>
                        </div>
                        <span className="text-[10px] text-sand-500 font-mono">{comm.timestamp}</span>
                      </div>
                      <p className="text-xs text-sand-600 line-clamp-1 mt-1">{comm.last_message}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {comm.channel}
                        </span>
                        {comm.unread && (
                          <span className="h-2 w-2 rounded-full bg-rose-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </PanelBody>
            </Panel>
          </div>

          {/* Chat Window */}
          <div className="lg:col-span-7">
            <Panel className="h-full flex flex-col justify-between">
              <PanelHeader
                title={
                  selectedConversation
                    ? `Room ${selectedConversation.room_number} · ${selectedConversation.guest_name}`
                    : "Select a conversation"
                }
                description={
                  selectedConversation
                    ? `Connected via ${selectedConversation.channel.toUpperCase()} · Verified In-House Guest`
                    : "Select from the list to reply directly."
                }
              />
              <PanelBody className="space-y-4 flex-1">
                {selectedConversation ? (
                  <div className="space-y-4">
                    {/* Guest Bubble */}
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-sand-200 flex items-center justify-center font-bold text-xs text-sand-700">
                        {selectedConversation.guest_name[0]}
                      </div>
                      <div className="rounded-2xl rounded-tl-none bg-sand-100 p-3 max-w-[80%] text-xs text-sand-900 space-y-1">
                        <p>{selectedConversation.last_message}</p>
                        <p className="text-[10px] text-sand-500 text-right">{selectedConversation.timestamp}</p>
                      </div>
                    </div>

                    {/* Staff Reply Box */}
                    <div className="pt-8 border-t border-sand-100">
                      <label className="block text-xs font-semibold text-sand-700 mb-1.5">
                        Reply as Concierge / General Manager
                      </label>
                      <div className="flex gap-2">
                        <Input
                          placeholder={`Type a quick response via ${selectedConversation.channel.toUpperCase()}…`}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSendReply()}
                          className="text-xs"
                        />
                        <Button
                          onClick={handleSendReply}
                          className="bg-sand-900 text-sand-50 hover:bg-sand-800 gap-1"
                        >
                          <Send className="h-3.5 w-3.5" />
                          Send
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-20 text-center text-sm text-sand-500">
                    Select a guest conversation to view and respond.
                  </div>
                )}
              </PanelBody>
            </Panel>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: VIP GUEST PROFILES & RETENTION INTEL
          ========================================================================= */}
      {activeTab === "profiles" && (
        <Panel>
          <PanelHeader
            title="In-House VIP & Elite Profiles"
            description="Guest CRM insights: loyalty tier, historical spend, personal stay preferences, and 1-click dynamic perk dispatch."
            action={
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-sand-400 absolute left-3 top-2.5" />
                <Input
                  placeholder="Search guest or room…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 text-xs w-48"
                />
              </div>
            }
          />
          <PanelBody className="p-0">
            <div className="divide-y divide-sand-100">
              {MOCK_GUEST_PROFILES.filter(
                (g) =>
                  !searchQuery ||
                  g.guest_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  g.room_number.includes(searchQuery)
              ).map((guest) => (
                <div key={guest.id} className="p-5 hover:bg-sand-50/50 transition-colors space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-sand-900 text-gold-400 flex items-center justify-center font-bold text-sm">
                        {guest.guest_name[0]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sand-950 text-base">{guest.guest_name}</span>
                          <span className="rounded bg-sand-200 px-2 py-0.5 text-xs font-mono font-bold text-sand-800">
                            Room {guest.room_number}
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[11px] font-semibold border",
                              guest.vip_tier === "Platinum Elite"
                                ? "bg-amber-50 text-amber-900 border-amber-300"
                                : guest.vip_tier === "Ambassador"
                                ? "bg-purple-50 text-purple-900 border-purple-300"
                                : "bg-sand-50 text-sand-800 border-sand-300"
                            )}
                          >
                            ★ {guest.vip_tier}
                          </span>
                        </div>
                        <p className="text-xs text-sand-500 mt-0.5">
                          {guest.total_stays} total stays · ₹{guest.lifetime_spend.toLocaleString("en-IN")} lifetime spend · {guest.sentiment_score}★ Sentiment
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          dispatchPerkMutation.mutate({
                            room_number: guest.room_number,
                            perk: guest.recommended_perk,
                            guest_name: guest.guest_name,
                          })
                        }
                        className="bg-gold-600 hover:bg-gold-700 text-white gap-1 text-xs shadow-xs"
                      >
                        <Gift className="h-3.5 w-3.5" />
                        Dispatch Perk (1-Click)
                      </Button>
                    </div>
                  </div>

                  {/* Preferences and Recommended Perk */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
                    <div className="rounded-xl border border-sand-200 bg-sand-50/60 p-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-sand-500 block mb-1">
                        Personal Preferences & Dietary
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {guest.special_preferences.map((pref, i) => (
                          <span key={i} className="rounded-md bg-white border border-sand-200 px-2 py-0.5 text-sand-700 text-[11px]">
                            {pref}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-gold-200 bg-gold-50/50 p-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gold-800 block mb-1">
                        AI Recommended Retention Perk
                      </span>
                      <p className="text-sand-900 font-medium text-[11px]">{guest.recommended_perk}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </PanelBody>
        </Panel>
      )}
    </div>
  );
}
