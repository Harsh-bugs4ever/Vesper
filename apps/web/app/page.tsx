"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";
import { UserRole, DEMO_USERS } from "@/lib/auth";
import { useToast } from "@/components/ui/toast";
import {
  Sparkles,
  ShieldCheck,
  Utensils,
  Smartphone,
  QrCode,
  Building2,
  ArrowRight,
  Sun,
  CheckCircle2,
  Clock,
  Activity,
  TrendingUp,
  Wrench,
  Boxes,
  Users,
  Bell,
  ChevronRight,
  Star,
  Layers,
  Compass,
  Cpu,
  RefreshCw,
  Eye,
  Check,
} from "lucide-react";

export default function LandingPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { showToast } = useToast();
  const [activeFlowStep, setActiveFlowStep] = useState(0);

  const handleLaunchDemo = (role: UserRole, dest: string) => {
    login(role);
    showToast({
      title: `Signed in as ${DEMO_USERS[role].name}`,
      description: `Opening ${DEMO_USERS[role].roleTitle} dashboard.`,
      type: "success",
    });
    router.push(dest);
  };

  const flowSteps = [
    {
      step: "01",
      actor: "In-Room Guest",
      action: "Scans Nightstand QR",
      desc: "Guest in Room 412 scans the encrypted QR code on their nightstand. No app download or account creation needed. Orders two club sandwiches.",
      badge: "Guest Service",
      icon: <QrCode className="w-5 h-5 text-gold-500" />,
    },
    {
      step: "02",
      actor: "Redis Event Bus",
      action: "Sub-Second Dispatch",
      desc: "A `guest.request.created` event fires on the Redis bus. Staff service routes it to F&B kitchen floor attendants with an SLA countdown timer.",
      badge: "Event Mesh",
      icon: <Activity className="w-5 h-5 text-sage-400" />,
    },
    {
      step: "03",
      actor: "Floor Attendant",
      action: "Kitchen Prepares & Delivers",
      desc: "Kitchen attendant's phone buzzes within 3 seconds. When delivered, waiter taps complete. The guest sees live status update in real time.",
      badge: "Staff PWA",
      icon: <Smartphone className="w-5 h-5 text-emerald-400" />,
    },
    {
      step: "04",
      actor: "Inventory Service",
      action: "Autonomous Depletion",
      desc: "Inventory service hears the completion event and immediately decrements bread, poultry, and condiments. Bread drops below safety minimum.",
      badge: "Stock Engine",
      icon: <Boxes className="w-5 h-5 text-amber-400" />,
    },
    {
      step: "05",
      actor: "AI Action Engine",
      action: "Action Card Suggested",
      desc: "The system generates a high-confidence purchase order card ranked by urgency × margin impact and places it in the General Manager's queue.",
      badge: "AI Action Card",
      icon: <Sparkles className="w-5 h-5 text-gold-400" />,
    },
    {
      step: "06",
      actor: "Resort Owner / GM",
      action: "1-Tap Approval & 10s Undo",
      desc: "GM approves purchase order with one click. An immutable audit record is committed, accompanied by a 10-second safety undo window.",
      badge: "Human-in-the-Loop",
      icon: <ShieldCheck className="w-5 h-5 text-gold-500" />,
    },
  ];

  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#212b26] flex flex-col selection:bg-sage-200 selection:text-sage-900 font-sans">
      {/* 1. TOP NAVIGATION */}
      <header className="sticky top-0 z-50 bg-[#faf8f5]/90 backdrop-blur-md border-b border-sand-200/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-sage-700 flex items-center justify-center text-gold-300 font-serif text-2xl font-bold shadow-soft group-hover:bg-sage-800 transition-colors">
              V
            </div>
            <div>
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-sage-950 font-serif block leading-none">
                VESPER
              </span>
              <span className="text-[10px] tracking-widest uppercase font-semibold text-gold-600 block mt-0.5">
                Smart Resort 360
              </span>
            </div>
          </Link>

          {/* Quick Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-sand-800">
            <a href="#how-it-helps" className="hover:text-sage-800 transition-colors">
              How It Helps
            </a>
            <a href="#features" className="hover:text-sage-800 transition-colors">
              Features
            </a>
            <a href="#system-flow" className="hover:text-sage-800 transition-colors">
              System Flow
            </a>
            <a href="#demo-roles" className="hover:text-sage-800 transition-colors">
              Demo Portals
            </a>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
            {/* Live Property Telemetry Badge */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-sand-100 border border-sand-200 text-xs font-medium text-sand-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>JW Marriott Mumbai · 78% Occupancy</span>
            </div>

            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg bg-sage-700 text-white text-xs sm:text-sm font-semibold hover:bg-sage-800 transition-all shadow-soft hover:shadow-card active:scale-98"
            >
              <span>Launch Demo</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION WITH JW MARRIOTT MUMBAI BACKGROUND */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Background Image: User Uploaded JW Marriott Mumbai Sahar */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 scale-105"
          style={{
            backgroundImage: "url('/api/resort-hero')",
          }}
        />

        {/* Tailored Luxury Gradient Overlay */}
        <div className="absolute inset-0 hero-gradient-overlay" />

        {/* Ambient Warm Golden Lights */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-gold-400/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 left-1/4 w-[500px] h-[400px] bg-sage-400/10 rounded-full blur-3xl pointer-events-none" />

        {/* Hero Content Container */}
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center flex flex-col items-center">
          {/* Property Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sand-950/70 border border-gold-300/40 text-gold-300 text-xs sm:text-sm font-medium backdrop-blur-md mb-6 shadow-elevated">
            <Sparkles className="w-3.5 h-3.5 text-gold-400 animate-spin-slow" />
            <span>JW Marriott Mumbai Sahar · Flagship Operational Model</span>
            <span className="w-1 h-1 rounded-full bg-gold-400" />
            <span className="text-sand-300">Smart Resort 360</span>
          </div>

          {/* Main Hero Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white font-serif max-w-4xl leading-[1.08] drop-shadow-md">
            One Operating Layer for the{" "}
            <span className="gold-gradient-text italic font-serif">Luxury Resort</span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-base sm:text-xl text-sand-100/90 max-w-2xl font-light leading-relaxed drop-shadow">
            Vesper connects the three people who never share a screen: the{" "}
            <strong className="text-white font-semibold underline decoration-gold-400/60 underline-offset-4">
              guest in the room
            </strong>
            , the{" "}
            <strong className="text-white font-semibold underline decoration-gold-400/60 underline-offset-4">
              staff member on the floor
            </strong>
            , and the{" "}
            <strong className="text-white font-semibold underline decoration-gold-400/60 underline-offset-4">
              owner in the office
            </strong>
            .
          </p>

          {/* Action CTAs */}
          <div className="mt-8 sm:mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/login"
              className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-gold-500 via-gold-400 to-gold-500 text-sand-950 font-bold text-sm sm:text-base shadow-gold hover:shadow-elevated hover:from-gold-400 hover:to-gold-500 transition-all active:scale-98"
            >
              <ShieldCheck className="w-4 h-4 text-sand-950" />
              <span>Explore All Demo Portals</span>
              <ArrowRight className="w-4 h-4 text-sand-950" />
            </Link>

            <Link
              href="/guest"
              className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl bg-sand-900/60 text-white font-medium text-sm sm:text-base border border-sand-300/30 backdrop-blur-md hover:bg-sand-900/80 hover:border-gold-300/60 transition-all active:scale-98"
            >
              <QrCode className="w-4 h-4 text-gold-300" />
              <span>View In-Room Guest Companion</span>
            </Link>

            <Link
              href="/staff"
              className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl bg-sand-900/60 text-white font-medium text-sm sm:text-base border border-sand-300/30 backdrop-blur-md hover:bg-sand-900/80 hover:border-gold-300/60 transition-all active:scale-98"
            >
              <Smartphone className="w-4 h-4 text-emerald-300" />
              <span>Staff Mobile PWA</span>
            </Link>
          </div>

          {/* Floating Key Metrics Grid */}
          <div className="mt-14 w-full grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-left">
            <div className="p-4 rounded-xl glass-card-dark border border-gold-300/20 text-white shadow-soft">
              <div className="flex items-center justify-between text-xs text-gold-300 font-medium mb-1">
                <span>Guest SLA</span>
                <Clock className="w-3.5 h-3.5 text-gold-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-serif text-white">&lt; 12m</div>
              <p className="text-[11px] text-sand-300 mt-0.5">Average request fulfillment</p>
            </div>

            <div className="p-4 rounded-xl glass-card-dark border border-gold-300/20 text-white shadow-soft">
              <div className="flex items-center justify-between text-xs text-gold-300 font-medium mb-1">
                <span>AI Accuracy</span>
                <Sparkles className="w-3.5 h-3.5 text-gold-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-serif text-white">94.2%</div>
              <p className="text-[11px] text-sand-300 mt-0.5">Engine recommendation score</p>
            </div>

            <div className="p-4 rounded-xl glass-card-dark border border-gold-300/20 text-white shadow-soft">
              <div className="flex items-center justify-between text-xs text-gold-300 font-medium mb-1">
                <span>Safe Undo</span>
                <RefreshCw className="w-3.5 h-3.5 text-gold-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-serif text-white">10-Sec</div>
              <p className="text-[11px] text-sand-300 mt-0.5">Safety window on all actions</p>
            </div>

            <div className="p-4 rounded-xl glass-card-dark border border-gold-300/20 text-white shadow-soft">
              <div className="flex items-center justify-between text-xs text-gold-300 font-medium mb-1">
                <span>RevPAR Lift</span>
                <TrendingUp className="w-3.5 h-3.5 text-gold-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-serif text-white">+14.8%</div>
              <p className="text-[11px] text-sand-300 mt-0.5">Adaptive pricing & margin</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. "HOW OUR WEBSITE HELPS PEOPLE" SECTION */}
      <section id="how-it-helps" className="py-20 sm:py-28 bg-[#faf8f5] relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sand-100 border border-sand-200 text-xs font-semibold text-sand-800 mb-3">
              <Users className="w-3.5 h-3.5 text-sage-600" />
              <span>Human-Centered Hospitality</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold font-serif text-sage-950 tracking-tight">
              How Vesper Helps Everyone in the Resort
            </h2>
            <p className="mt-4 text-sand-700 text-base sm:text-lg leading-relaxed font-light">
              Hospitality breaks when systems work in silos. Vesper empowers each stakeholder with
              frictionless tools designed specifically for their environment.
            </p>
          </div>

          {/* 4 In-Depth Role Benefit Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Card 1: For the In-Room Guest */}
            <div className="rounded-2xl border border-sand-200 bg-white p-8 shadow-soft hover:shadow-card transition-all flex flex-col justify-between group">
              <div>
                <div className="flex items-start justify-between mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-gold-50 border border-gold-200 flex items-center justify-center text-gold-600 group-hover:scale-105 transition-transform shadow-xs">
                    <QrCode className="w-7 h-7 text-gold-600" />
                  </div>
                  <span className="px-3 py-1 rounded-full bg-gold-100/70 border border-gold-200 text-gold-800 text-xs font-semibold">
                    In-Room Guest
                  </span>
                </div>

                <h3 className="text-2xl font-bold font-serif text-sage-950 mb-3">
                  Effortless Luxury at Your Fingertips
                </h3>
                <p className="text-sm text-sand-700 leading-relaxed mb-6">
                  Guests hate holding on the telephone for room service or downloading heavy hotel
                  apps. Vesper delivers an instant web companion right from their nightstand.
                </p>

                <div className="space-y-3 border-t border-sand-100 pt-6">
                  <div className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-sage-50 text-sage-700 mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <strong className="text-xs font-bold text-sand-950 block">Zero App, Zero Login</strong>
                      <p className="text-xs text-sand-600">
                        Scan the room QR code to immediately access room controls, menus, and services.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-sage-50 text-sage-700 mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <strong className="text-xs font-bold text-sand-950 block">Live Request Tracking</strong>
                      <p className="text-xs text-sand-600">
                        Watch your club sandwich or fresh linen request move in real time with an exact countdown.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-sage-50 text-sage-700 mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <strong className="text-xs font-bold text-sand-950 block">24/7 AI Concierge</strong>
                      <p className="text-xs text-sand-600">
                        Ask about spa treatments, beach dining, or airport transit anytime with instant answers.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-sand-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-gold-700">4.8 / 5 Guest Satisfaction</span>
                <Link
                  href="/guest"
                  className="inline-flex items-center gap-1 text-xs font-bold text-sage-700 hover:text-sage-900 group-hover:translate-x-1 transition-transform"
                >
                  <span>Experience Guest View</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Card 2: For Floor Staff & Housekeeping */}
            <div className="rounded-2xl border border-sand-200 bg-white p-8 shadow-soft hover:shadow-card transition-all flex flex-col justify-between group">
              <div>
                <div className="flex items-start justify-between mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform shadow-xs">
                    <Smartphone className="w-7 h-7 text-emerald-600" />
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-100/70 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                    Floor Staff & Housekeeping
                  </span>
                </div>

                <h3 className="text-2xl font-bold font-serif text-sage-950 mb-3">
                  Zero Radio Chaos & Clear Priorities
                </h3>
                <p className="text-sm text-sand-700 leading-relaxed mb-6">
                  Housekeepers and waitstaff shouldn't battle blaring walkie-talkies or handwritten
                  sheets. Vesper gives every worker a focused, prioritized mobile task runner.
                </p>

                <div className="space-y-3 border-t border-sand-100 pt-6">
                  <div className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-emerald-50 text-emerald-700 mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <strong className="text-xs font-bold text-sand-950 block">Prioritized Task Runner</strong>
                      <p className="text-xs text-sand-600">
                        Tasks auto-ordered by urgency, SLA, and proximity so staff always know what to do next.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-emerald-50 text-emerald-700 mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <strong className="text-xs font-bold text-sand-950 block">1-Tap Room Turnaround</strong>
                      <p className="text-xs text-sand-600">
                        Update room status from Dirty &rarr; Cleaning &rarr; Inspected &rarr; Ready with photo proof.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-emerald-50 text-emerald-700 mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <strong className="text-xs font-bold text-sand-950 block">Instant Defect & Shortage Reporting</strong>
                      <p className="text-xs text-sand-600">
                        Snap a photo of broken fixtures or low linen closets to trigger automated maintenance tickets.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-sand-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-700">38% Faster Turnaround</span>
                <Link
                  href="/staff"
                  className="inline-flex items-center gap-1 text-xs font-bold text-sage-700 hover:text-sage-900 group-hover:translate-x-1 transition-transform"
                >
                  <span>Open Staff PWA</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Card 3: For Department Managers */}
            <div className="rounded-2xl border border-sand-200 bg-white p-8 shadow-soft hover:shadow-card transition-all flex flex-col justify-between group">
              <div>
                <div className="flex items-start justify-between mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-sage-50 border border-sage-200 flex items-center justify-center text-sage-600 group-hover:scale-105 transition-transform shadow-xs">
                    <Utensils className="w-7 h-7 text-sage-600" />
                  </div>
                  <span className="px-3 py-1 rounded-full bg-sage-100/70 border border-sage-200 text-sage-800 text-xs font-semibold">
                    Department Managers
                  </span>
                </div>

                <h3 className="text-2xl font-bold font-serif text-sage-950 mb-3">
                  Proactive Control, Zero Firefighting
                </h3>
                <p className="text-sm text-sand-700 leading-relaxed mb-6">
                  F&B leads and Executive Housekeepers need to foresee bottlenecks before service collapses.
                  Vesper provides live departmental boards and auto-balancing rosters.
                </p>

                <div className="space-y-3 border-t border-sand-100 pt-6">
                  <div className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-sage-50 text-sage-700 mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <strong className="text-xs font-bold text-sand-950 block">Live Room & Order Board</strong>
                      <p className="text-xs text-sand-600">
                        Real-time visualization of all 145 rooms, order statuses, and housekeeping wings.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-sage-50 text-sage-700 mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <strong className="text-xs font-bold text-sand-950 block">Automated Overdue Escalation</strong>
                      <p className="text-xs text-sand-600">
                        Requests approaching SLA threshold automatically alert supervisors before guests complain.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-sage-50 text-sage-700 mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <strong className="text-xs font-bold text-sand-950 block">Smart Stock Deductions</strong>
                      <p className="text-xs text-sand-600">
                        Every kitchen order automatically updates inventory balances and drafts reorders.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-sand-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-sage-700">100% SLA Transparency</span>
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-1 text-xs font-bold text-sage-700 hover:text-sage-900 group-hover:translate-x-1 transition-transform"
                >
                  <span>Launch Manager View</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Card 4: For General Managers & Owners */}
            <div className="rounded-2xl border border-sand-200 bg-white p-8 shadow-soft hover:shadow-card transition-all flex flex-col justify-between group">
              <div>
                <div className="flex items-start justify-between mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 group-hover:scale-105 transition-transform shadow-xs">
                    <ShieldCheck className="w-7 h-7 text-amber-600" />
                  </div>
                  <span className="px-3 py-1 rounded-full bg-amber-100/70 border border-amber-200 text-amber-800 text-xs font-semibold">
                    General Manager & Owner
                  </span>
                </div>

                <h3 className="text-2xl font-bold font-serif text-sage-950 mb-3">
                  Strategic 360° Vision with Trustworthy AI
                </h3>
                <p className="text-sm text-sand-700 leading-relaxed mb-6">
                  Resort executives must manage RevPAR, preventive equipment maintenance, and staff
                  allocations without drowning in noise. AI recommends; you decide.
                </p>

                <div className="space-y-3 border-t border-sand-100 pt-6">
                  <div className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-amber-50 text-amber-700 mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <strong className="text-xs font-bold text-sand-950 block">AI Action Cards with 10s Undo</strong>
                      <p className="text-xs text-sand-600">
                        Clear, high-impact recommendations ranked by confidence × impact × urgency with instant reversal.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-amber-50 text-amber-700 mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <strong className="text-xs font-bold text-sand-950 block">Predictive Revenue & Maintenance</strong>
                      <p className="text-xs text-sand-600">
                        Forecast occupancy and catch chiller/pump anomalies days before catastrophic failure.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-amber-50 text-amber-700 mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <strong className="text-xs font-bold text-sand-950 block">DPDP Privacy & Full Audit Trail</strong>
                      <p className="text-xs text-sand-600">
                        Total regulatory compliance, zero guest data leak risk, and immutable audit logs.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-sand-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-700">+14.8% RevPAR Optimization</span>
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-1 text-xs font-bold text-sage-700 hover:text-sage-900 group-hover:translate-x-1 transition-transform"
                >
                  <span>Launch Executive 360</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. CORE PLATFORM FEATURES SECTION */}
      <section id="features" className="py-20 sm:py-28 bg-[#f4efe6]/60 border-y border-sand-200 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sand-100 border border-sand-200 text-xs font-semibold text-sand-800 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-gold-500" />
              <span>Engineered for Luxury Resorts</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold font-serif text-sage-950 tracking-tight">
              Next-Generation Resort Intelligence
            </h2>
            <p className="mt-4 text-sand-700 text-base sm:text-lg leading-relaxed font-light">
              Built on Next.js 15, FastAPI, Redis Event Bus, and cutting-edge machine learning engines.
            </p>
          </div>

          {/* 6 Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl bg-white border border-sand-200/90 shadow-soft hover:shadow-card hover:border-gold-300/80 transition-all flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-xl bg-gold-50 border border-gold-200/80 flex items-center justify-center text-gold-600 mb-5 group-hover:scale-105 transition-transform">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold font-serif text-sage-950 mb-2">
                  AI Action Cards & Safe Undo
                </h3>
                <p className="text-xs text-sand-600 leading-relaxed">
                  The AI evaluates thousands of telemetry data points to suggest concrete, high-impact
                  actions. The human decides, the system executes, and a 10-second undo prevents mistakes.
                </p>
              </div>
              <div className="mt-6 pt-3 border-t border-sand-100 flex items-center justify-between text-[11px] font-semibold text-gold-700">
                <span>Confidence × Impact × Urgency</span>
                <span className="w-1.5 h-1.5 rounded-full bg-gold-500" />
              </div>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl bg-white border border-sand-200/90 shadow-soft hover:shadow-card hover:border-sage-300 transition-all flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-xl bg-sage-50 border border-sage-200/80 flex items-center justify-center text-sage-600 mb-5 group-hover:scale-105 transition-transform">
                  <QrCode className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold font-serif text-sage-950 mb-2">
                  Ephemeral In-Room QR Engine
                </h3>
                <p className="text-xs text-sand-600 leading-relaxed">
                  Each guest room has an encrypted, dynamic QR link that is valid strictly while the
                  room is occupied. Zero passwords, zero downloads, zero security friction.
                </p>
              </div>
              <div className="mt-6 pt-3 border-t border-sand-100 flex items-center justify-between text-[11px] font-semibold text-sage-700">
                <span>Encrypted Nightstand Token</span>
                <span className="w-1.5 h-1.5 rounded-full bg-sage-500" />
              </div>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl bg-white border border-sand-200/90 shadow-soft hover:shadow-card hover:border-emerald-300 transition-all flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 mb-5 group-hover:scale-105 transition-transform">
                  <Activity className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold font-serif text-sage-950 mb-2">
                  Redis Event Mesh & Live SLAs
                </h3>
                <p className="text-xs text-sand-600 leading-relaxed">
                  Sub-second event bus distributes requests directly to floor attendants' phones with
                  live SLA timers. Prevents lost tickets and guarantees prompt service.
                </p>
              </div>
              <div className="mt-6 pt-3 border-t border-sand-100 flex items-center justify-between text-[11px] font-semibold text-emerald-700">
                <span>Sub-Second Floor Dispatch</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </div>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl bg-white border border-sand-200/90 shadow-soft hover:shadow-card hover:border-blue-300 transition-all flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600 mb-5 group-hover:scale-105 transition-transform">
                  <Wrench className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold font-serif text-sage-950 mb-2">
                  Predictive IoT Maintenance
                </h3>
                <p className="text-xs text-sand-600 leading-relaxed">
                  Isolation Forest ML models continuously monitor resort sensor readings (HVAC chillers,
                  water pumps, boilers) to diagnose and fix anomalies before guests notice.
                </p>
              </div>
              <div className="mt-6 pt-3 border-t border-sand-100 flex items-center justify-between text-[11px] font-semibold text-blue-700">
                <span>Early Anomaly Detection</span>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              </div>
            </div>

            {/* Feature 5 */}
            <div className="p-6 rounded-2xl bg-white border border-sand-200/90 shadow-soft hover:shadow-card hover:border-amber-300 transition-all flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 mb-5 group-hover:scale-105 transition-transform">
                  <Boxes className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold font-serif text-sage-950 mb-2">
                  Autonomous Inventory Depletion
                </h3>
                <p className="text-xs text-sand-600 leading-relaxed">
                  Every delivered meal automatically deducts constituent ingredients. When items cross
                  safety thresholds, purchase orders are auto-drafted for approval.
                </p>
              </div>
              <div className="mt-6 pt-3 border-t border-sand-100 flex items-center justify-between text-[11px] font-semibold text-amber-700">
                <span>Zero Stock-Out Guarantee</span>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              </div>
            </div>

            {/* Feature 6 */}
            <div className="p-6 rounded-2xl bg-white border border-sand-200/90 shadow-soft hover:shadow-card hover:border-purple-300 transition-all flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-200/80 flex items-center justify-center text-purple-600 mb-5 group-hover:scale-105 transition-transform">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold font-serif text-sage-950 mb-2">
                  DPDP Privacy & Immutable Audit
                </h3>
                <p className="text-xs text-sand-600 leading-relaxed">
                  Strict role-based access control, cryptographic session handling, and full DPDP Act
                  compliance ensure guest and financial data remain airtight.
                </p>
              </div>
              <div className="mt-6 pt-3 border-t border-sand-100 flex items-center justify-between text-[11px] font-semibold text-purple-700">
                <span>DPDP 2023 Compliant</span>
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. INTERACTIVE FLOW: "HOW ONE REQUEST FLOWS" */}
      <section id="system-flow" className="py-20 sm:py-28 bg-[#faf8f5] relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sand-100 border border-sand-200 text-xs font-semibold text-sand-800 mb-3">
              <Layers className="w-3.5 h-3.5 text-sage-600" />
              <span>End-to-End Orchestration</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold font-serif text-sage-950 tracking-tight">
              The Journey of a Single Guest Request
            </h2>
            <p className="mt-4 text-sand-700 text-base sm:text-lg leading-relaxed font-light">
              See how a guest ordering two club sandwiches in Room 412 flows seamlessly across staff,
              stock, AI recommendation, and management approval without a single phone call.
            </p>
          </div>

          {/* Interactive Steps Display */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Step Selector Column */}
            <div className="lg:col-span-5 space-y-3">
              {flowSteps.map((s, idx) => (
                <div
                  key={s.step}
                  onClick={() => setActiveFlowStep(idx)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center gap-4 ${
                    activeFlowStep === idx
                      ? "bg-white border-gold-400 shadow-card translate-x-1"
                      : "bg-sand-50/70 border-sand-200 hover:bg-white hover:border-sand-300"
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${
                      activeFlowStep === idx
                        ? "bg-sage-700 text-gold-300"
                        : "bg-sand-200 text-sand-800"
                    }`}
                  >
                    {s.step}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-sand-950">{s.action}</span>
                      <span className="text-[10px] uppercase font-semibold text-sage-700">
                        {s.actor}
                      </span>
                    </div>
                    <p className="text-xs text-sand-600 truncate mt-0.5">{s.desc}</p>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 transition-transform ${
                      activeFlowStep === idx ? "text-gold-600 translate-x-1" : "text-sand-400"
                    }`}
                  />
                </div>
              ))}
            </div>

            {/* Active Step Detail Card */}
            <div className="lg:col-span-7">
              <div className="rounded-3xl border border-sand-200 bg-white p-8 sm:p-10 shadow-elevated relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gold-50/50 rounded-full blur-3xl pointer-events-none" />

                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-sage-50 border border-sage-200 text-sage-700">
                      {flowSteps[activeFlowStep].icon}
                    </div>
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-gold-700">
                        Step {flowSteps[activeFlowStep].step} of 06
                      </span>
                      <h4 className="text-2xl font-bold font-serif text-sage-950">
                        {flowSteps[activeFlowStep].action}
                      </h4>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-sand-100 border border-sand-200 text-xs font-semibold text-sand-800">
                    {flowSteps[activeFlowStep].badge}
                  </span>
                </div>

                <div className="p-5 rounded-2xl bg-sand-50/80 border border-sand-200/80 mb-6">
                  <span className="text-xs font-semibold text-sage-800 uppercase tracking-wider block mb-1">
                    Active Stakeholder: {flowSteps[activeFlowStep].actor}
                  </span>
                  <p className="text-sm text-sand-800 leading-relaxed">
                    {flowSteps[activeFlowStep].desc}
                  </p>
                </div>

                {/* Progress bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-sand-600">
                    <span>Flow Progression</span>
                    <span className="font-semibold text-sage-900">
                      {Math.round(((activeFlowStep + 1) / flowSteps.length) * 100)}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-sand-100 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sage-600 to-gold-500 rounded-full transition-all duration-300"
                      style={{
                        width: `${((activeFlowStep + 1) / flowSteps.length) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Navigation Controls */}
                <div className="mt-8 flex items-center justify-between">
                  <button
                    onClick={() => setActiveFlowStep((prev) => Math.max(0, prev - 1))}
                    disabled={activeFlowStep === 0}
                    className="px-4 py-2 rounded-lg border border-sand-200 text-xs font-semibold text-sand-800 hover:bg-sand-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Previous Step
                  </button>
                  <button
                    onClick={() =>
                      setActiveFlowStep((prev) => Math.min(flowSteps.length - 1, prev + 1))
                    }
                    disabled={activeFlowStep === flowSteps.length - 1}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-sage-700 text-white text-xs font-semibold hover:bg-sage-800 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span>Next Step</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. INTERACTIVE DEMO ROLE LAUNCHPAD */}
      <section id="demo-roles" className="py-20 sm:py-28 bg-[#f4efe6]/50 border-t border-sand-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sand-100 border border-sand-200 text-xs font-semibold text-sand-800 mb-3">
              <Compass className="w-3.5 h-3.5 text-gold-500" />
              <span>Interactive Role Launchpad</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold font-serif text-sage-950 tracking-tight">
              Step Into Any Resort Persona
            </h2>
            <p className="mt-4 text-sand-700 text-base sm:text-lg leading-relaxed font-light">
              Explore the real application with seeded operational data. Click any role below to
              instantly test their dedicated layout, metrics, and permissions.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Persona 1: General Manager */}
            <div
              onClick={() => handleLaunchDemo("general_manager", "/admin")}
              className="p-6 rounded-2xl bg-white border border-sand-200 hover:border-gold-400 hover:shadow-elevated transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-xl bg-gold-50 border border-gold-200 text-gold-700 group-hover:scale-105 transition-transform">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-gold-100 text-gold-800 text-[11px] font-bold">
                    Executive 360
                  </span>
                </div>
                <h4 className="text-lg font-bold font-serif text-sage-950 group-hover:text-gold-700 transition-colors">
                  General Manager / Owner
                </h4>
                <p className="text-xs font-medium text-sand-500 mb-2">Executive Office</p>
                <p className="text-xs text-sand-600 leading-relaxed">
                  Full access to live revenue, AI action cards, what-if simulations, shadow engine
                  scoring, and resort occupancy.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-sand-100 flex items-center justify-between text-xs font-bold text-sage-700 group-hover:text-gold-700">
                <span>Enter Admin Portal</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Persona 2: F&B Manager */}
            <div
              onClick={() => handleLaunchDemo("dept_manager_fb", "/admin")}
              className="p-6 rounded-2xl bg-white border border-sand-200 hover:border-sage-400 hover:shadow-elevated transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-xl bg-sage-50 border border-sage-200 text-sage-700 group-hover:scale-105 transition-transform">
                    <Utensils className="w-6 h-6" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-sage-100 text-sage-800 text-[11px] font-bold">
                    F&B Orders & Stock
                  </span>
                </div>
                <h4 className="text-lg font-bold font-serif text-sage-950 group-hover:text-sage-800 transition-colors">
                  Department Manager (F&B)
                </h4>
                <p className="text-xs font-medium text-sand-500 mb-2">Food & Beverage</p>
                <p className="text-xs text-sand-600 leading-relaxed">
                  Manage live room service tickets, kitchen SLA countdowns, inventory depletion, and
                  automated ingredient reordering.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-sand-100 flex items-center justify-between text-xs font-bold text-sage-700 group-hover:text-sage-900">
                <span>Enter F&B Portal</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Persona 3: Housekeeping Manager */}
            <div
              onClick={() => handleLaunchDemo("dept_manager_hk", "/admin")}
              className="p-6 rounded-2xl bg-white border border-sand-200 hover:border-sage-400 hover:shadow-elevated transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-xl bg-sage-50 border border-sage-200 text-sage-700 group-hover:scale-105 transition-transform">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-sage-100 text-sage-800 text-[11px] font-bold">
                    Live Room Board
                  </span>
                </div>
                <h4 className="text-lg font-bold font-serif text-sage-950 group-hover:text-sage-800 transition-colors">
                  Executive Housekeeper
                </h4>
                <p className="text-xs font-medium text-sand-500 mb-2">Housekeeping Division</p>
                <p className="text-xs text-sand-600 leading-relaxed">
                  Oversee all 145 rooms, assign daily cleaning batches, track dirty-to-ready turnaround,
                  and inspect photo reports.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-sand-100 flex items-center justify-between text-xs font-bold text-sage-700 group-hover:text-sage-900">
                <span>Enter Housekeeping Portal</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Persona 4: Floor Attendant */}
            <div
              onClick={() => handleLaunchDemo("employee", "/staff")}
              className="p-6 rounded-2xl bg-white border border-sand-200 hover:border-emerald-400 hover:shadow-elevated transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 group-hover:scale-105 transition-transform">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                    Mobile PWA
                  </span>
                </div>
                <h4 className="text-lg font-bold font-serif text-sage-950 group-hover:text-emerald-800 transition-colors">
                  Floor Attendant
                </h4>
                <p className="text-xs font-medium text-sand-500 mb-2">Housekeeping & Operations</p>
                <p className="text-xs text-sand-600 leading-relaxed">
                  Mobile-optimized task list with SLA alerts, room cleaning checklists, attendance check-in,
                  and defect photo reporting.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-sand-100 flex items-center justify-between text-xs font-bold text-emerald-700 group-hover:text-emerald-900">
                <span>Enter Staff Mobile PWA</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Persona 5: In-House Guest */}
            <div
              onClick={() => handleLaunchDemo("guest", "/guest")}
              className="p-6 rounded-2xl bg-white border border-sand-200 hover:border-gold-400 hover:shadow-elevated transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-xl bg-gold-50 border border-gold-200 text-gold-700 group-hover:scale-105 transition-transform">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-gold-100 text-gold-800 text-[11px] font-bold">
                    No Login Needed
                  </span>
                </div>
                <h4 className="text-lg font-bold font-serif text-sage-950 group-hover:text-gold-700 transition-colors">
                  In-House Guest (Room 412)
                </h4>
                <p className="text-xs font-medium text-sand-500 mb-2">Deluxe Ocean View Wing</p>
                <p className="text-xs text-sand-600 leading-relaxed">
                  Browse restaurant menus, order room service, request fresh towels, track live status,
                  and chat with AI Concierge.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-sand-100 flex items-center justify-between text-xs font-bold text-gold-700 group-hover:text-gold-900">
                <span>Open In-Room Companion</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Persona 6: Standard Sign In */}
            <Link
              href="/login"
              className="p-6 rounded-2xl bg-gradient-to-br from-sage-800 to-sage-950 text-white hover:shadow-elevated transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-xl bg-sage-700/80 border border-sage-600 text-gold-300 group-hover:scale-105 transition-transform">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-gold-500/20 text-gold-300 text-[11px] font-bold border border-gold-400/30">
                    Enterprise Portal
                  </span>
                </div>
                <h4 className="text-lg font-bold font-serif text-white group-hover:text-gold-300 transition-colors">
                  Custom Staff Sign In
                </h4>
                <p className="text-xs font-medium text-sand-300 mb-2">Corporate Credentials</p>
                <p className="text-xs text-sand-200 leading-relaxed">
                  Sign in with custom staff email and password. All sessions logged to immutable audit trail.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-sage-800 flex items-center justify-between text-xs font-bold text-gold-300 group-hover:text-gold-200">
                <span>Go to Login Form</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* 7. LUXURY FOOTER */}
      <footer className="bg-sage-950 text-sand-200 py-16 border-t border-sand-900/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-sage-800/80">
            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sage-800 border border-gold-400/40 flex items-center justify-center text-gold-300 font-serif text-2xl font-bold">
                  V
                </div>
                <div>
                  <span className="text-2xl font-bold tracking-tight text-white font-serif block">
                    VESPER
                  </span>
                  <span className="text-[10px] tracking-widest uppercase font-semibold text-gold-400 block">
                    Smart Resort 360
                  </span>
                </div>
              </div>
              <p className="text-xs text-sand-300 max-w-md leading-relaxed">
                One operating layer for large luxury resorts. Bridging in-room guests, floor staff,
                and resort executives through real-time telemetry and human-in-the-loop AI.
              </p>
              <div className="pt-2 text-[11px] text-sand-400">
                <span>Demo property: </span>
                <strong className="text-white font-semibold">JW Marriott Mumbai Sahar & Juhu</strong>
              </div>
            </div>

            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-gold-400 mb-4">
                Portals & Apps
              </h5>
              <ul className="space-y-2.5 text-xs text-sand-300">
                <li>
                  <Link href="/guest" className="hover:text-white transition-colors">
                    Guest Room Companion
                  </Link>
                </li>
                <li>
                  <Link href="/staff" className="hover:text-white transition-colors">
                    Staff Mobile PWA
                  </Link>
                </li>
                <li>
                  <Link href="/admin" className="hover:text-white transition-colors">
                    Executive 360 Dashboard
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-white transition-colors">
                    Role Selector & Login
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-gold-400 mb-4">
                Architecture
              </h5>
              <ul className="space-y-2.5 text-xs text-sand-300">
                <li>Next.js 15 & React 19</li>
                <li>FastAPI Microservices</li>
                <li>Redis Real-Time Event Bus</li>
                <li>PostgreSQL & FAISS</li>
                <li>DPDP Act 2023 Compliant</li>
              </ul>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-sand-400 gap-4">
            <p>
              &copy; {new Date().getFullYear()} Vesper Smart Resort 360. Academic Demonstration.
            </p>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sand-300">All Operations Live</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
