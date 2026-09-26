"use client";

import { MaintenancePanel } from "@/components/connected/maintenance-panel";
import { PageHeader } from "@/components/ui/page-header";

export default function MaintenancePage() {
  return <div className="space-y-6"><PageHeader title="Maintenance" description="Authorized defects and work orders from the backend" /><MaintenancePanel /></div>;
}
