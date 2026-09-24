"use client";

import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, ClipboardList, Timer, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChips } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { StatTile } from "@/components/ui/stat-tile";
import { useToast } from "@/components/ui/toast";
import {
  CHANNELS,
  channelMeta,
  getStoredRequests,
  subscribeRequests,
  updateGuestRequest,
  type GuestRequest,
  type RequestChannel,
} from "@/lib/demo/requests";
import { cn } from "@/lib/utils";

type ChannelFilter = RequestChannel | "all";
type StateFilter = "open" | "new" | "overdue" | "done";

const STATE_FILTERS: { value: StateFilter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "new", label: "Unclaimed" },
  { value: "overdue", label: "Overdue" },
  { value: "done", label: "Completed" },
];

function isOverdue(request: GuestRequest) {
  return request.state !== "done" && request.openFor > request.sla;
}

export default function RequestsPage() {
  const { showToast, showUndoToast } = useToast();

  const [requests, setRequests] = useState<GuestRequest[]>([]);
  const [channel, setChannel] = useState<ChannelFilter>("all");
  const [state, setState] = useState<StateFilter>("open");

  React.useEffect(() => {
    setRequests(getStoredRequests());
    const unsub = subscribeRequests(setRequests);
    return unsub;
  }, []);

  const open = requests.filter((request) => request.state !== "done");
  const overdue = requests.filter(isOverdue);
  const done = requests.filter((request) => request.state === "done");

  const visible = useMemo(
    () =>
      requests
        .filter((request) => channel === "all" || request.channel === channel)
        .filter((request) => {
          if (state === "open") return request.state !== "done";
          if (state === "new") return request.state === "new";
          if (state === "overdue") return isOverdue(request);
          return request.state === "done";
        })
        // Most pressing first: overdue, then closest to breaching its SLA.
        .sort((a, b) => b.openFor / b.sla - a.openFor / a.sla),
    [requests, channel, state]
  );

  const accept = (request: GuestRequest) => {
    updateGuestRequest(request.id, (item) => ({
      ...item,
      state: "accepted",
      assignee: "You",
    }));
    showToast({
      title: `${request.id} accepted`,
      description: `Room ${request.room} · ${request.summary}. Timer running against a ${request.sla} min target.`,
      type: "success",
    });
  };

  const complete = (request: GuestRequest) => {
    const previous = request.state;
    const previousAssignee = request.assignee;

    updateGuestRequest(request.id, (item) => ({ ...item, state: "done" }));

    showUndoToast(
      `${request.id} completed`,
      `Room ${request.room} · ${request.summary}. Guest asked to rate it.`,
      () =>
        updateGuestRequest(request.id, (item) => ({
          ...item,
          state: previous,
          assignee: previousAssignee,
        })),
      10
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Guest Requests"
        description="Everything raised from the in-room QR page, routed to the department that owns it."
        meta={format(new Date(), "EEE, d MMM yyyy")}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Open Requests"
          value={open.length}
          change="+3"
          intent="bad"
          comparison="vs. yesterday"
          tone="rose"
          icon={ClipboardList}
          trend={[6, 5, 8, 7, 9, 9, open.length]}
        />
        <StatTile
          label="Past SLA"
          value={overdue.length}
          change={overdue.length > 0 ? "needs a manager" : "all within target"}
          intent={overdue.length > 0 ? "bad" : "good"}
          comparison="escalated to the duty manager"
          tone="sand"
          icon={TriangleAlert}
        />
        <StatTile
          label="Avg. Response"
          value="6 min"
          change="-2 min"
          direction="down"
          intent="good"
          comparison="from raise to accept"
          tone="sage"
          icon={Timer}
          trend={[11, 10, 9, 9, 8, 7, 6]}
        />
        <StatTile
          label="Completed Today"
          value={48 + done.length}
          change="+12%"
          comparison="vs. same day last week"
          tone="forest"
          icon={CheckCircle2}
          trend={[31, 36, 39, 44, 47, 52, 48 + done.length]}
        />
      </div>

      <Panel>
        <PanelHeader
          title="Request Inbox"
          description="Sorted by how close each one is to breaching its promised time."
        />
        <PanelBody className="space-y-4 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <FilterChips
              options={[
                { value: "all" as const, label: "All channels", count: requests.length },
                ...CHANNELS.map((item) => ({
                  value: item,
                  label: item,
                  count: requests.filter((request) => request.channel === item).length,
                })),
              ]}
              value={channel}
              onChange={(value) => setChannel(value as ChannelFilter)}
            />
            <span className="mx-1 hidden h-5 w-px bg-sand-200 sm:block" />
            <FilterChips
              options={STATE_FILTERS.map((item) => ({
                ...item,
                count:
                  item.value === "open"
                    ? open.length
                    : item.value === "new"
                      ? requests.filter((request) => request.state === "new").length
                      : item.value === "overdue"
                        ? overdue.length
                        : done.length,
              }))}
              value={state}
              onChange={setState}
            />
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="All requests handled"
              description="Nothing here — every request matching this view has been resolved."
              className="py-12"
            />
          ) : (
            <ul className="space-y-3">
              {visible.map((request) => {
                const late = isOverdue(request);
                const pct = Math.min(100, Math.round((request.openFor / request.sla) * 100));

                return (
                  <li
                    key={request.id}
                    className={cn(
                      "rounded-xl border p-4 transition-colors",
                      late ? "border-rose-200 bg-rose-50/40" : "border-sand-200 bg-white hover:bg-sand-50/50"
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                              channelMeta[request.channel].chip
                            )}
                          >
                            {request.channel}
                          </span>
                          <span className="text-sm font-semibold text-sand-950">
                            Room {request.room}
                          </span>
                          <span className="text-xs text-sand-500">{request.guest}</span>
                          <span className="text-xs tabular-nums text-sand-400">{request.id}</span>
                        </div>

                        <p className="mt-1.5 text-sm font-medium text-sand-900">{request.summary}</p>
                        <p className="mt-0.5 text-xs text-sand-600">{request.detail}</p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {request.state === "new" && (
                          <Button size="sm" onClick={() => accept(request)}>
                            Accept
                          </Button>
                        )}
                        {request.state === "accepted" && (
                          <Button variant="outline" size="sm" onClick={() => complete(request)}>
                            Mark complete
                          </Button>
                        )}
                        {request.state === "done" && (
                          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="h-4 w-4" />
                            Completed
                          </span>
                        )}
                      </div>
                    </div>

                    {request.state !== "done" && (
                      <div className="mt-3 flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sand-100">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              late ? "bg-rose-500" : pct > 70 ? "bg-gold-500" : "bg-sage-600"
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span
                          className={cn(
                            "shrink-0 text-xs tabular-nums",
                            late ? "font-semibold text-rose-600" : "text-sand-500"
                          )}
                        >
                          {late
                            ? `${request.openFor - request.sla} min over`
                            : `${request.sla - request.openFor} min left`}
                        </span>
                        <span className="shrink-0 text-xs text-sand-500">
                          {request.assignee ? `· ${request.assignee}` : "· unclaimed"}
                        </span>
                      </div>
                    )}

                    {request.value !== undefined && (
                      <p className="mt-2 text-xs text-sand-500">
                        Posts ₹{request.value.toLocaleString("en-IN")} to the room folio · raised{" "}
                        {request.raisedAt}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}
