"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";
import { StaffHeader } from "@/components/layout/staff-header";

function StaffLogout() {
  const router = useRouter();
  const { isConnected, isReady, logout } = useAuth();
  if (!isReady || !isConnected) return null;

  return (
    <div className="mx-auto flex w-full max-w-xl justify-end px-4 pt-3">
      <button
        type="button"
        onClick={() => {
          logout();
          router.push("/login");
        }}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-sand-200 bg-white px-3 text-sm font-medium text-sand-700 hover:border-rose-300 hover:text-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-700"
      >
        <LogOut aria-hidden="true" className="h-4 w-4" />
        Sign out
      </button>
    </div>
  );
}

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#faf8f5] flex flex-col text-sand-950">
      <StaffHeader />
      <StaffLogout />

      <main className="flex-1 max-w-xl w-full mx-auto p-4 pb-24 animate-in fade-in duration-300">
        {children}
      </main>
    </div>
  );
}
