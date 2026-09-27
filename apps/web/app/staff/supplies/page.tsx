"use client";

import Link from "next/link";
import { ArrowLeft, PackageCheck, Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";
import { StaffRequisitions } from "@/components/connected/staff-requisitions";

export default function StaffSuppliesPage() {
  const { isReady, isConnected } = useAuth();

  if (!isReady) return <p role="status" className="p-8">Restoring your session…</p>;
  if (!isConnected) return <p className="p-8">Please <Link href="/login" className="underline">sign in</Link> to view supplies.</p>;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/staff" className="inline-flex items-center gap-2 text-xs font-semibold text-sand-500 transition-colors hover:text-sage-800">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to my shift
      </Link>
      <section className="relative isolate overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#173a2d] via-[#244c3a] to-[#355b46] px-5 py-6 text-white shadow-[0_24px_60px_-35px_rgba(23,58,45,.8)] sm:px-8 sm:py-8">
        <div aria-hidden="true" className="absolute -right-16 -top-20 -z-10 h-56 w-56 rounded-full border border-white/10 bg-white/[0.035]" />
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.1] text-gold-200"><PackageCheck className="h-5 w-5" /></span>
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-200"><Sparkles className="h-3 w-3" /> Department operations</p>
            <h1 className="mt-2 font-serif text-2xl leading-tight sm:text-3xl">Department inventory</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/75">See the supplies available to your department and current stock levels.</p>
          </div>
        </div>
      </section>
      <StaffRequisitions />
    </div>
  );
}

