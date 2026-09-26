"use client";

import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";

const PROJECTS = [
  { name: "HVAC & Chiller Plant", approved: 8_500_000, deployed: 6_100_000, status: "In progress" },
  { name: "Guest Lifts Modernization", approved: 5_200_000, deployed: 2_100_000, status: "In progress" },
  { name: "Suite & Room Refurbishment", approved: 6_400_000, deployed: 3_700_000, status: "In progress" },
  { name: "Solar & BMS Automation", approved: 3_900_000, deployed: 1_600_000, status: "Review" },
  { name: "Kitchen & F&B Outlets", approved: 2_800_000, deployed: 1_900_000, status: "In progress" },
];

const formatRupees = (value: number) => `₹${value.toLocaleString("en-IN")}`;
const totalApproved = PROJECTS.reduce((sum, project) => sum + project.approved, 0);
const totalDeployed = PROJECTS.reduce((sum, project) => sum + project.deployed, 0);
const totalRemaining = totalApproved - totalDeployed;

export function CapitalPlan() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <strong>Demo capital plan.</strong> These seeded example projects help demonstrate the CapEx dashboard. They are not live commitments or accounting entries.
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Planned", totalApproved],
          ["Deployed", totalDeployed],
          ["Remaining", totalRemaining],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-sand-200 bg-white p-5">
            <p className="text-xs text-sand-600">{label}</p>
            <p className="mt-2 font-serif text-2xl font-semibold text-sand-950">{formatRupees(Number(value))}</p>
          </div>
        ))}
      </div>
      <Panel>
        <PanelHeader title="Capital project pacing" description="Approved plan compared with illustrative deployment." />
        <PanelBody className="space-y-5">
          {PROJECTS.map((project) => {
            const percent = Math.round((project.deployed / project.approved) * 100);
            return (
              <div key={project.name} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-sand-950">{project.name}</span>
                  <span className="text-xs text-sand-600">{formatRupees(project.deployed)} of {formatRupees(project.approved)} · {project.status}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-sand-100">
                  <div className="h-full rounded-full bg-sage-700" style={{ width: `${percent}%` }} />
                </div>
                <p className="text-xs text-sand-500">{percent}% deployed · {formatRupees(project.approved - project.deployed)} remaining</p>
              </div>
            );
          })}
          <div className="rounded-lg bg-sage-50 p-4 text-sm leading-6 text-sage-900">
            <strong>Planning insight:</strong> HVAC and room refurbishment represent 56% of the plan. Confirm chiller warranty coverage before approving additional HVAC spend; keep the solar project under review pending contract and savings validation.
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}
