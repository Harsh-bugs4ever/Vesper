"use client";

import React, { useState } from "react";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { AdminTopBar } from "@/components/layout/admin-topbar";
import { RoleGuard } from "@/components/auth/role-guard";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <RoleGuard
      allowedRoles={["system_admin", "general_manager", "dept_manager_fb", "dept_manager_hk"]}
      fallbackUrl="/access-denied"
    >
      <div className="min-h-screen bg-[#faf8f5] flex">
        {/* Sidebar for Desktop & Mobile Drawer */}
        <AdminSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 lg:pl-72 transition-all">
          <AdminTopBar onOpenSidebar={() => setSidebarOpen(true)} />

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-in fade-in duration-300">
            {children}
          </main>
        </div>
      </div>
    </RoleGuard>
  );
}
