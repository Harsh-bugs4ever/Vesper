"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { StaffRequisitions } from "@/components/connected/staff-requisitions";

export default function StaffSuppliesPage() {
  const { isReady, isConnected } = useAuth();

  if (!isReady) return <p role="status" className="p-8">Restoring your session…</p>;
  if (!isConnected) return <p className="p-8">Please <Link href="/login" className="underline">sign in</Link> to view supplies.</p>;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
      <Link href="/staff" className="text-sm font-medium text-sage-700 hover:text-sage-900 underline">
        ← Back to staff workspace
      </Link>
      <PageHeader
        title="Department Supplies & Requisitions"
        description="Submit supply requests for your department and track approval status."
      />
      <StaffRequisitions />
    </div>
  );
}

