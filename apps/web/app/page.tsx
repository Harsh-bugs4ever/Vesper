"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";

export default function RootPage() {
  const router = useRouter();
  const { role, isStaff, isGuest } = useAuth();

  useEffect(() => {
    if (isStaff) {
      router.replace("/staff");
    } else if (isGuest) {
      router.replace("/guest");
    } else {
      // Default to /admin or /login
      router.replace("/login");
    }
  }, [role, isStaff, isGuest, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf8f5]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-sage-700 flex items-center justify-center text-gold-300 font-serif text-2xl font-bold animate-pulse">
          V
        </div>
        <p className="text-xs text-sand-600 font-medium tracking-wide">
          Entering Vesper Smart Resort 360...
        </p>
      </div>
    </div>
  );
}
