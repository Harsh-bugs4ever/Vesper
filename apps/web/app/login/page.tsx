"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";
import { UserRole, DEMO_USERS } from "@/lib/auth";
import {
  ShieldCheck,
  Utensils,
  Sparkles,
  Smartphone,
  KeyRound,
  QrCode,
  Building2,
  Lock,
  Mail,
  ArrowRight,
  Sun,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<"demo" | "credentials">("demo");
  const [email, setEmail] = useState("arjun.mehta@vesperresorts.com");
  const [password, setPassword] = useState("••••••••");
  const [isLoading, setIsLoading] = useState(false);

  const demoAccounts: {
    role: UserRole;
    name: string;
    title: string;
    department: string;
    dest: string;
    badge: string;
    badgeVariant: "gold" | "sage" | "sand" | "outline";
    icon: React.ReactNode;
  }[] = [
    {
      role: "general_manager",
      name: DEMO_USERS.general_manager.name,
      title: "General Manager / Owner",
      department: "Executive Office",
      dest: "/admin",
      badge: "Full Access & High-Impact AI",
      badgeVariant: "gold",
      icon: <ShieldCheck className="w-5 h-5 text-gold-600" />,
    },
    {
      role: "dept_manager_fb",
      name: DEMO_USERS.dept_manager_fb.name,
      title: "Department Manager",
      department: "Food & Beverage",
      dest: "/admin",
      badge: "F&B Tasks & Orders",
      badgeVariant: "sage",
      icon: <Utensils className="w-5 h-5 text-sage-600" />,
    },
    {
      role: "dept_manager_hk",
      name: DEMO_USERS.dept_manager_hk.name,
      title: "Executive Housekeeper",
      department: "Housekeeping",
      dest: "/admin",
      badge: "Live Room Board",
      badgeVariant: "sage",
      icon: <Sparkles className="w-5 h-5 text-sage-600" />,
    },
    {
      role: "employee",
      name: DEMO_USERS.employee.name,
      title: "Floor Attendant (PWA)",
      department: "Housekeeping",
      dest: "/staff",
      badge: "Mobile Tasks & Attendance",
      badgeVariant: "sand",
      icon: <Smartphone className="w-5 h-5 text-emerald-600" />,
    },
    {
      role: "system_admin",
      name: DEMO_USERS.system_admin.name,
      title: "System Administrator",
      department: "IT & Systems",
      dest: "/admin",
      badge: "Integrations & Audit Log",
      badgeVariant: "outline",
      icon: <KeyRound className="w-5 h-5 text-sand-700" />,
    },
    {
      role: "guest",
      name: "Deluxe Ocean View (412)",
      title: "In-House Guest Companion",
      department: "Madh Island Wing",
      dest: "/guest",
      badge: "No Login Needed",
      badgeVariant: "gold",
      icon: <QrCode className="w-5 h-5 text-gold-600" />,
    },
  ];

  const handleSelectDemo = (role: UserRole, dest: string) => {
    login(role);
    showToast({
      title: `Signed in as ${DEMO_USERS[role].name}`,
      description: `Loaded ${DEMO_USERS[role].roleTitle} view with role-based permissions.`,
      type: "success",
    });
    router.push(dest);
  };

  const handleCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      login("general_manager");
      setIsLoading(false);
      showToast({
        title: "Welcome back, Arjun Mehta",
        description: "Authenticated with General Manager credentials.",
        type: "success",
      });
      router.push("/admin");
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative Warm Ambient Elements */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-sage-100/60 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-gold-100/50 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center relative z-10">
        {/* Left Side: Brand Narrative & Resort Information */}
        <div className="lg:col-span-6 space-y-6 lg:pr-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sand-100 border border-sand-200 text-xs font-semibold text-sand-800">
            <span className="w-2 h-2 rounded-full bg-gold-500 animate-pulse" />
            <span>Smart Resort 360 · Demo Environment</span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-sage-700 flex items-center justify-center text-gold-300 font-serif text-3xl font-bold shadow-card">
                V
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-sage-950 font-serif">
                VESPER
              </h1>
            </div>
            <p className="text-lg text-sage-800 font-serif italic">
              One operating layer for the whole resort, with AI that helps managers decide.
            </p>
          </div>

          <p className="text-sm text-sand-700 leading-relaxed">
            Vesper connects the three people who never share a screen: the{" "}
            <strong className="text-sand-950 font-semibold">guest in the room</strong>, the{" "}
            <strong className="text-sand-950 font-semibold">staff member on the floor</strong>, and
            the <strong className="text-sand-950 font-semibold">owner in the office</strong>.
          </p>

          {/* Value Highlights */}
          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/70 border border-sand-200/80 shadow-soft">
              <div className="p-2 rounded-lg bg-sage-50 text-sage-700 shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <strong className="text-sand-950 font-semibold block">AI suggests, managers decide</strong>
                <span className="text-sand-600 leading-snug">
                  High-impact pricing and repair decisions require human approval with a 10-second safe undo.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/70 border border-sand-200/80 shadow-soft">
              <div className="p-2 rounded-lg bg-gold-50 text-gold-700 shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <strong className="text-sand-950 font-semibold block">Madh Island Beach Resort (145 Rooms)</strong>
                <span className="text-sand-600 leading-snug">
                  Modelled on authentic Mumbai coastal hospitality telemetry, live occupancy and sensor streams.
                </span>
              </div>
            </div>
          </div>

          {/* Quick Property Telemetry Pill */}
          <div className="p-3.5 rounded-xl bg-sand-100/70 border border-sand-200 flex items-center justify-between text-xs text-sand-700">
            <span className="flex items-center gap-1.5 font-medium">
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              Mumbai 29°C Coastal Sunny
            </span>
            <span className="font-semibold text-sage-800">78% Live Occupancy</span>
            <span className="text-gold-800 font-medium">DPDP Compliant</span>
          </div>
        </div>

        {/* Right Side: Authentication Card */}
        <div className="lg:col-span-6">
          <Card className="shadow-elevated border-sand-200 bg-white/95 backdrop-blur-md">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl text-sage-950">Resort Portal Access</CardTitle>
                  <CardDescription className="text-sand-600 mt-1">
                    Select a simulated role or sign in with your enterprise credentials.
                  </CardDescription>
                </div>
                <Badge variant="sage" className="text-xs">
                  Day 1 Ready
                </Badge>
              </div>

              {/* Navigation Switch Tabs */}
              <div className="grid grid-cols-2 p-1 bg-sand-100 rounded-lg mt-4 text-xs font-semibold">
                <button
                  onClick={() => setActiveTab("demo")}
                  className={`py-2 rounded-md transition-all ${
                    activeTab === "demo"
                      ? "bg-white text-sage-900 shadow-soft font-bold"
                      : "text-sand-600 hover:text-sand-950"
                  }`}
                >
                  Quick Demo Accounts
                </button>
                <button
                  onClick={() => setActiveTab("credentials")}
                  className={`py-2 rounded-md transition-all ${
                    activeTab === "credentials"
                      ? "bg-white text-sage-900 shadow-soft font-bold"
                      : "text-sand-600 hover:text-sand-950"
                  }`}
                >
                  Standard Sign In
                </button>
              </div>
            </CardHeader>

            <CardContent className="pt-2">
              {activeTab === "demo" ? (
                <div className="space-y-2.5">
                  <p className="text-xs text-sand-500 mb-2">
                    Click any card below to test the corresponding layout & permissions:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {demoAccounts.map((acc) => (
                      <div
                        key={acc.role}
                        onClick={() => handleSelectDemo(acc.role, acc.dest)}
                        className="p-3 rounded-xl border border-sand-200 bg-sand-50/50 hover:bg-sage-50/60 hover:border-sage-300 transition-all cursor-pointer group flex flex-col justify-between text-left shadow-xs hover:shadow-soft"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="p-2 rounded-lg bg-white border border-sand-200 shadow-xs group-hover:scale-105 transition-transform">
                            {acc.icon}
                          </div>
                          <Badge variant={acc.badgeVariant} className="text-[10px] py-0 px-1.5">
                            {acc.badge}
                          </Badge>
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-sand-950 group-hover:text-sage-900">
                            {acc.name}
                          </h4>
                          <p className="text-[11px] text-sage-700 font-medium">{acc.title}</p>
                          <p className="text-[10px] text-sand-500 mt-0.5">{acc.department}</p>
                        </div>
                        <div className="mt-2.5 pt-2 border-t border-sand-200/60 flex items-center justify-between text-[11px] font-semibold text-sage-700 group-hover:text-sage-900">
                          <span>Enter {acc.dest}</span>
                          <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCredentialsSubmit} className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-sand-800">
                      Resort Property
                    </label>
                    <div className="px-3 py-2 rounded-lg border border-sand-200 bg-sand-50/60 text-xs font-medium text-sand-800 flex items-center justify-between">
                      <span>Madh Island Beach Resort, Mumbai</span>
                      <Building2 className="w-4 h-4 text-sage-600" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-sand-800">
                      Work Email
                    </label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@vesperresorts.com"
                      icon={<Mail className="w-4 h-4" />}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-sand-800">
                        Password
                      </label>
                      <span className="text-[11px] text-sage-700 hover:underline cursor-pointer">
                        Forgot key?
                      </span>
                    </div>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter security passphrase"
                      icon={<Lock className="w-4 h-4" />}
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full mt-2"
                    size="lg"
                    disabled={isLoading}
                  >
                    {isLoading ? "Verifying Credentials..." : "Enter Resort Operating Layer"}
                  </Button>

                  <p className="text-center text-[11px] text-sand-500 pt-2">
                    Single sign-on protected. All actions logged to immutable audit trail.
                  </p>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
