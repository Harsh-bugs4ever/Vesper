"use client";

import React from "react";
import { StaffHeader } from "@/components/layout/staff-header";

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#faf8f5] flex flex-col text-sand-950">
      <StaffHeader />

      <main className="flex-1 max-w-xl w-full mx-auto p-4 pb-24 animate-in fade-in duration-300">
        {children}
      </main>
    </div>
  );
}
