"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";
import {
  ShieldAlert,
  Home,
  Lock,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default function AccessDeniedPage() {
  const router = useRouter();
  const { user, logout, isStaff, isGuest } = useAuth();

  const getAuthorizedPortal = () => {
    if (isStaff) return { path: "/staff", label: "Staff Mobile Portal" };
    if (isGuest) return { path: "/guest", label: "Guest Room Portal" };
    return { path: "/admin", label: "Resort Deck" };
  };

  const portal = getAuthorizedPortal();

  return (
    <div className="min-h-screen bg-[#faf8f5] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden text-sand-950">
      {/* Warm Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-100/50 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-lg w-full relative z-10 text-center">
        {/* Crest */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-50 border-2 border-amber-200/80 flex items-center justify-center text-amber-700 shadow-card mb-6">
          <ShieldAlert className="w-8 h-8 stroke-[1.75]" />
        </div>

        {/* Security Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100/70 border border-amber-300/80 text-xs font-semibold text-amber-900 mb-3">
          <Lock className="w-3.5 h-3.5" />
          <span>Security & Role Boundary</span>
        </div>

        {/* Heading */}
        <h1 className="text-3xl sm:text-4xl font-bold font-serif text-sand-950 tracking-tight">
          Access Restricted
        </h1>

        <p className="text-sm text-sand-600 mt-2 max-w-md mx-auto leading-relaxed">
          The requested operational area requires higher privileges or governance permissions than your current account profile.
        </p>

        {/* Current Active Account Card */}
        {user && (
          <Card className="mt-8 border-sand-200/90 bg-white/80 backdrop-blur-sm shadow-soft text-left">
            <CardContent className="p-5">
              <div className="flex items-center justify-between pb-3 border-b border-sand-200/80 mb-3">
                <span className="text-[11px] uppercase font-bold tracking-wider text-sand-500">
                  Current Authenticated Identity
                </span>
                <Badge variant="outline" className="text-[10px] bg-sand-100 font-mono">
                  {user.id}
                </Badge>
              </div>

              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-sage-100 border border-sage-300 flex items-center justify-center text-sage-800 font-bold text-sm">
                  {user.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-sand-950 truncate">
                      {user.name}
                    </h4>
                    <Badge variant="sage" className="text-[10px] py-0 px-1.5">
                      {user.roleTitle}
                    </Badge>
                  </div>
                  <p className="text-xs text-sand-500 truncate mt-0.5">
                    {user.department || "Resort Staff"} · {user.propertyName}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-sand-200/60 flex items-center justify-between text-xs text-sand-600">
                <span>Active Permissions:</span>
                <span className="font-semibold text-sand-800">
                  {user.permissions.length} active permissions
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action CTAs */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            variant="default"
            className="w-full sm:w-auto"
            onClick={() => router.push(portal.path)}
          >
            <Home className="w-4 h-4 mr-1.5" />
            Return to {portal.label}
          </Button>

          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => {
              logout();
              router.push("/login");
            }}
          >
            <LogOut className="w-4 h-4 text-rose-600 mr-1.5" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
