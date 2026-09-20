"use client";

import React from "react";
import {
  ListTodo,
  BedDouble,
  QrCode,
  AlertTriangle,
  UtensilsCrossed,
  Sparkles,
  Inbox,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-context";

export type StaffTab = "tasks" | "requests" | "rooms" | "scan" | "report";

interface StaffBottomNavProps {
  activeTab: StaffTab;
  onSelectTab: (tab: StaffTab) => void;
  pendingTasksCount?: number;
  pendingRequestsCount?: number;
}

interface NavTab {
  id: StaffTab;
  label: string;
  icon: LucideIcon;
  count?: number;
  isFab?: boolean;
}

export function StaffBottomNav({
  activeTab,
  onSelectTab,
  pendingTasksCount = 3,
  pendingRequestsCount = 0,
}: StaffBottomNavProps) {
  const { user } = useAuth();
  const isFb =
    user.department?.toLowerCase().includes("beverage") ||
    user.department?.toLowerCase().includes("f&b");

  const tabs: NavTab[] = [
    {
      id: "tasks",
      label: isFb ? "Food Orders" : "My Tasks",
      icon: isFb ? UtensilsCrossed : ListTodo,
      count: pendingTasksCount > 0 ? pendingTasksCount : undefined,
    },
    {
      id: "requests",
      label: "Requests",
      icon: Inbox,
      count: pendingRequestsCount > 0 ? pendingRequestsCount : undefined,
    },
    {
      id: "scan",
      label: "QR Scan",
      icon: QrCode,
      isFab: true,
    },
    {
      id: "rooms",
      label: isFb ? "Tables" : "Room Board",
      icon: isFb ? Sparkles : BedDouble,
    },
    {
      id: "report",
      label: isFb ? "Shortage" : "Log Issue",
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-sand-200 py-1 px-4 shadow-elevated">
      <div className="max-w-md mx-auto flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          if (tab.isFab) {
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className="relative -top-3 flex flex-col items-center group"
                aria-label={tab.label}
              >
                <div className="w-12 h-12 rounded-full bg-sage-600 text-white flex items-center justify-center shadow-card group-hover:bg-sage-700 transition-all border-2 border-white group-active:scale-95">
                  <Icon className="w-6 h-6 text-gold-300" />
                </div>
                <span className="text-[10px] font-semibold text-sand-800 mt-0.5">
                  {tab.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={cn(
                "flex flex-col items-center py-1.5 px-3 rounded-lg transition-colors relative",
                isActive
                  ? "text-sage-700 font-semibold"
                  : "text-sand-500 hover:text-sand-900"
              )}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {tab.count !== undefined && (
                  <span className="absolute -top-1 -right-2 w-4 h-4 bg-sage-600 text-white rounded-full text-[10px] flex items-center justify-center font-bold shadow-xs">
                    {tab.count}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-1">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
