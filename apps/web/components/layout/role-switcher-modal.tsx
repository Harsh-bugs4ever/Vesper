"use client";

import React from "react";
import { useAuth } from "@/components/auth/auth-context";
import { UserRole, DEMO_USERS } from "@/lib/auth";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Utensils,
  Sparkles,
  Smartphone,
  KeyRound,
  QrCode,
  X,
  Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RoleSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RoleSwitcherModal({ isOpen, onClose }: RoleSwitcherModalProps) {
  const { role, switchRole } = useAuth();
  const router = useRouter();

  if (!isOpen) return null;

  const rolesList: {
    key: UserRole;
    title: string;
    person: string;
    description: string;
    icon: React.ReactNode;
    route: string;
    badgeVariant: "gold" | "sage" | "sand" | "outline";
  }[] = [
    {
      key: "general_manager",
      title: "General Manager / Owner",
      person: DEMO_USERS.general_manager.name,
      description: "Full visibility, approves AI high-impact actions (>10% rate, >₹50k purchases), owner dashboard.",
      icon: <ShieldCheck className="w-5 h-5 text-gold-600" />,
      route: "/admin",
      badgeVariant: "gold",
    },
    {
      key: "dept_manager_fb",
      title: "Department Manager (F&B)",
      person: DEMO_USERS.dept_manager_fb.name,
      description: "Manages kitchen and dining tasks, ingredient low-stock alerts, and food service SLA.",
      icon: <Utensils className="w-5 h-5 text-sage-600" />,
      route: "/admin",
      badgeVariant: "sage",
    },
    {
      key: "dept_manager_hk",
      title: "Housekeeping Manager",
      person: DEMO_USERS.dept_manager_hk.name,
      description: "Directs floor room board (dirty → cleaning → ready) and staff task distribution.",
      icon: <Sparkles className="w-5 h-5 text-sage-600" />,
      route: "/admin",
      badgeVariant: "sage",
    },
    {
      key: "employee",
      title: "Floor Attendant (Staff Portal)",
      person: DEMO_USERS.employee.name,
      description: "Mobile-first PWA view: mark shift attendance, work task list, scan room QR codes.",
      icon: <Smartphone className="w-5 h-5 text-emerald-600" />,
      route: "/staff",
      badgeVariant: "sand",
    },
    {
      key: "system_admin",
      title: "System Administrator",
      person: DEMO_USERS.system_admin.name,
      description: "Resort profile, user roles & permissions, API integrations, and immutable audit logs.",
      icon: <KeyRound className="w-5 h-5 text-sand-700" />,
      route: "/admin",
      badgeVariant: "outline",
    },
    {
      key: "guest",
      title: "In-House Guest (Room 412)",
      person: "Deluxe Ocean View · Room 412",
      description: "Room QR scan companion: order food, request towels, chat with AI concierge (no login).",
      icon: <QrCode className="w-5 h-5 text-gold-600" />,
      route: "/guest",
      badgeVariant: "gold",
    },
  ];

  const handleSelectRole = (roleKey: UserRole, route: string) => {
    switchRole(roleKey);
    onClose();
    router.push(route);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-sand-950/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-elevated border border-sand-200 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-sand-200/80 bg-sand-50/60 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gold-500 animate-pulse" />
              <span className="text-xs font-semibold tracking-wider text-gold-800 uppercase">
                Demo Environment
              </span>
            </div>
            <h2 className="text-xl font-semibold text-sand-950 font-serif-title mt-0.5">
              Switch User Perspective
            </h2>
            <p className="text-xs text-sand-600 mt-0.5">
              Instantly test Vesper through the eyes of different resort stakeholders.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-sand-400 hover:text-sand-800 hover:bg-sand-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Roles List */}
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-3">
          {rolesList.map((item) => {
            const isSelected = role === item.key;
            return (
              <div
                key={item.key}
                onClick={() => handleSelectRole(item.key, item.route)}
                className={cn(
                  "p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-4 text-left group",
                  isSelected
                    ? "border-sage-500 bg-sage-50/50 shadow-soft ring-1 ring-sage-500"
                    : "border-sand-200 hover:border-sage-300 hover:bg-sand-50/70"
                )}
              >
                <div className="p-2.5 rounded-lg bg-white border border-sand-200 shrink-0 group-hover:scale-105 transition-transform shadow-xs">
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-sand-950 group-hover:text-sage-900 transition-colors">
                        {item.title}
                      </h4>
                      <Badge variant={item.badgeVariant} className="text-[10px] py-0 px-2">
                        {item.person}
                      </Badge>
                    </div>
                    {isSelected && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-sage-700 bg-sage-100/80 px-2 py-0.5 rounded-md">
                        <Check className="w-3.5 h-3.5" />
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-sand-600 leading-relaxed">
                    {item.description}
                  </p>
                  <div className="mt-2 text-[11px] font-medium text-sage-600 flex items-center gap-1 group-hover:underline">
                    Opens {item.route} &rarr;
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-sand-50/60 border-t border-sand-200 flex items-center justify-between text-xs text-sand-500">
          <span>Property: JW Marriott Mumbai, Juhu (355 Rooms)</span>
          <button
            onClick={onClose}
            className="text-xs font-medium text-sand-700 hover:text-sand-950 underline"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
