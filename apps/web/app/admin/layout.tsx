"use client";

import React, { useState } from "react";

import { AdminFooter } from "@/components/layout/admin-footer";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { AdminTopBar } from "@/components/layout/admin-topbar";
import { RoleGuard } from "@/components/auth/role-guard";
import { DataSourceBoundary } from "@/components/auth/data-source-boundary";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <RoleGuard
      allowedRoles={["owner", "general_manager", "dept_manager_fb", "dept_manager_hk", "dept_manager_frontdesk", "employee"]}
      fallbackUrl="/access-denied"
    >
      <div className="flex min-h-screen bg-sand-50">
        <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
          <AdminTopBar onOpenSidebar={() => setSidebarOpen(true)} />

          <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-4 pb-8 pt-6 sm:px-6 lg:px-8">
            <main className="animate-in fade-in flex-1 duration-300"><DataSourceBoundary>{children}</DataSourceBoundary></main>
            <AdminFooter />
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
