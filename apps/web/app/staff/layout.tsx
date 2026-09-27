"use client";

import React from "react";
import { StaffHeader } from "@/components/layout/staff-header";

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f7f6f2] flex flex-col text-sand-950">
      <StaffHeader />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-12 pt-6 sm:px-6 sm:pt-8 lg:px-8 animate-in fade-in duration-300">
        {children}
      </main>
    </div>
  );
}
