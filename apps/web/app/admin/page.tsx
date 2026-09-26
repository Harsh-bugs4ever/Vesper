"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserCheck, ArrowRight } from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import { GmDashboard, ManagerDashboard } from "@/components/connected/live-dashboard";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

export default function AdminDashboardPage() {
  const { user, isConnected } = useAuth();
  const router = useRouter();

  // Redirect staff / employee users to their dedicated personal work cockpit
  useEffect(() => {
    if (user?.role === "employee") {
      router.push("/staff");
    }
  }, [user, router]);

  if (user?.role === "employee") {
    return (
      <div className="mx-auto max-w-lg py-16 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sage-100 text-sage-800">
          <UserCheck className="h-6 w-6" />
        </div>
        <h2 className="font-serif text-xl font-bold text-sand-950">Staff Workspace</h2>
        <p className="text-sm text-sand-600">
          Your account has Staff permissions. Please navigate to the personal operational cockpit.
        </p>
        <div>
          <Link href="/staff">
            <Button className="inline-flex items-center gap-2">
              Go to Staff Cockpit
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Department managers (F&B, Housekeeping)
  if (user?.role === "dept_manager_fb" || user?.role === "dept_manager_hk") {
    return <ManagerDashboard />;
  }

  // General Manager (and executive governance)
  return <GmDashboard />;
}
