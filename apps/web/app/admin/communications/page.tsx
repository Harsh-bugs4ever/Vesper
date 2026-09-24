"use client";

import React, { useCallback, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileSpreadsheet,
  Filter,
  Inbox,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Search,
  Send,
  Upload,
  X,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { csvDryRunResults, outboxMessages, type CsvImportRow } from "@/lib/demo/csv-outbox";
import { cn } from "@/lib/utils";

const CHANNEL_ICONS = {
  whatsapp: MessageSquare,
  sms: Phone,
  email: Mail,
} as const;

const CHANNEL_COLORS = {
  whatsapp: "bg-emerald-50 text-emerald-700 border-emerald-200",
  sms: "bg-blue-50 text-blue-700 border-blue-200",
  email: "bg-purple-50 text-purple-700 border-purple-200",
} as const;

const STATUS_COLORS = {
  delivered: "bg-emerald-50 text-emerald-800 border-emerald-200",
  sent: "bg-sage-50 text-sage-800 border-sage-200",
  failed: "bg-rose-50 text-rose-700 border-rose-200",
  queued: "bg-amber-50 text-amber-800 border-amber-200",
} as const;

type Tab = "outbox" | "csv_import";

export default function CommunicationsPage() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("outbox");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // CSV import state
  const [csvFile, setCsvFile] = useState<string | null>(null);
  const [isDryRunning, setIsDryRunning] = useState(false);
  const [dryRunComplete, setDryRunComplete] = useState(false);
  const [importRows, setImportRows] = useState<CsvImportRow[]>([]);

  const handleCsvUpload = useCallback(() => {
    setCsvFile("guest_reservations_dec2026.csv");
    setIsDryRunning(true);
    setDryRunComplete(false);

    // Simulate dry run
    setTimeout(() => {
      setIsDryRunning(false);
      setDryRunComplete(true);
      setImportRows(csvDryRunResults);
      showToast({
        title: "Dry Run Complete",
        description: `10 rows parsed: 5 valid, 1 warning, 4 errors. Review results before importing.`,
        type: "default",
      });
    }, 1500);
  }, [showToast]);

  const handleImport = useCallback(() => {
    const validRows = importRows.filter((r) => r.status === "valid" || r.status === "warning");
    showToast({
      title: `${validRows.length} Reservations Imported`,
      description: `${importRows.filter((r) => r.status === "error").length} rows skipped due to validation errors.`,
      type: "success",
    });
  }, [importRows, showToast]);

  const filteredMessages = outboxMessages.filter((msg) => {
    if (channelFilter !== "all" && msg.channel !== channelFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        msg.recipient.toLowerCase().includes(q) ||
        msg.subject.toLowerCase().includes(q) ||
        msg.preview.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const errorCount = importRows.filter((r) => r.status === "error").length;
  const warningCount = importRows.filter((r) => r.status === "warning").length;
  const validCount = importRows.filter((r) => r.status === "valid").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Communications & Import"
        description="Outbox across WhatsApp, SMS and email — plus CSV import with dry-run validation."
      />

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-sand-200 pb-2">
        <button
          onClick={() => setActiveTab("outbox")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all",
            activeTab === "outbox"
              ? "bg-sage-700 text-white shadow-soft"
              : "text-sand-600 hover:text-sand-950 hover:bg-sand-100"
          )}
        >
          <Inbox className="h-4 w-4" />
          Outbox ({outboxMessages.length})
        </button>
        <button
          onClick={() => setActiveTab("csv_import")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all",
            activeTab === "csv_import"
              ? "bg-sage-700 text-white shadow-soft"
              : "text-sand-600 hover:text-sand-950 hover:bg-sand-100"
          )}
        >
          <FileSpreadsheet className="h-4 w-4" />
          CSV Import
        </button>
      </div>

      {/* OUTBOX TAB */}
      {activeTab === "outbox" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search messages..."
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-1.5">
              {["all", "whatsapp", "sms", "email"].map((ch) => (
                <button
                  key={ch}
                  onClick={() => setChannelFilter(ch)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all capitalize",
                    channelFilter === ch
                      ? "border-sage-500 bg-sage-50 text-sage-900"
                      : "border-sand-200 bg-white text-sand-600 hover:bg-sand-50"
                  )}
                >
                  {ch === "all" ? "All Channels" : ch}
                </button>
              ))}
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-sand-200/80 bg-white p-3">
              <p className="text-[11px] text-sand-500">Total Sent</p>
              <p className="font-serif text-xl font-semibold text-sand-950">{outboxMessages.length}</p>
            </div>
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-3">
              <p className="text-[11px] text-emerald-600">Delivered</p>
              <p className="font-serif text-xl font-semibold text-emerald-900">
                {outboxMessages.filter((m) => m.status === "delivered").length}
              </p>
            </div>
            <div className="rounded-xl border border-rose-200/80 bg-rose-50/40 p-3">
              <p className="text-[11px] text-rose-600">Failed</p>
              <p className="font-serif text-xl font-semibold text-rose-900">
                {outboxMessages.filter((m) => m.status === "failed").length}
              </p>
            </div>
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-3">
              <p className="text-[11px] text-amber-600">Queued</p>
              <p className="font-serif text-xl font-semibold text-amber-900">
                {outboxMessages.filter((m) => m.status === "queued").length}
              </p>
            </div>
          </div>

          {/* Message list */}
          <Panel>
            <PanelBody className="divide-y divide-sand-200/80">
              {filteredMessages.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="No messages found"
                  description="Try adjusting your search or channel filter."
                  className="my-6"
                />
              ) : (
                filteredMessages.map((msg) => {
                  const ChannelIcon = CHANNEL_ICONS[msg.channel];
                  return (
                    <div key={msg.id} className="flex items-start gap-3 py-3.5 first:pt-2 last:pb-2">
                      <span
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                          CHANNEL_COLORS[msg.channel]
                        )}
                      >
                        <ChannelIcon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-sand-950 truncate">{msg.subject}</span>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                              STATUS_COLORS[msg.status]
                            )}
                          >
                            {msg.status === "delivered" && <CheckCircle2 className="h-3 w-3" />}
                            {msg.status === "sent" && <Send className="h-3 w-3" />}
                            {msg.status === "failed" && <XCircle className="h-3 w-3" />}
                            {msg.status === "queued" && <Clock className="h-3 w-3" />}
                            {msg.status}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-sand-600 truncate">{msg.preview}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-sand-500">
                          <span>{msg.recipient}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {msg.sentAt}
                          </span>
                          {msg.template && (
                            <span className="rounded bg-sand-100 px-1.5 py-0.5 font-mono text-[10px] text-sand-600">
                              {msg.template}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </PanelBody>
          </Panel>
        </div>
      )}

      {/* CSV IMPORT TAB */}
      {activeTab === "csv_import" && (
        <div className="space-y-4">
          {/* Upload zone */}
          {!csvFile && (
            <div
              onClick={handleCsvUpload}
              className="cursor-pointer rounded-2xl border-2 border-dashed border-sand-300 bg-sand-50/50 p-12 text-center transition-all hover:border-sage-400 hover:bg-sage-50/30"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sage-50 text-sage-600">
                <Upload className="h-7 w-7" />
              </div>
              <p className="mt-4 font-serif text-lg font-semibold text-sand-950">
                Drop your CSV file here or click to upload
              </p>
              <p className="mt-1 text-sm text-sand-600">
                Supports reservation imports with guest name, email, room category, check-in and check-out dates.
              </p>
              <p className="mt-3 text-xs text-sand-500">
                Max 10MB · .csv format · UTF-8 encoding
              </p>
            </div>
          )}

          {/* Dry-run in progress */}
          {isDryRunning && (
            <Panel>
              <PanelBody className="flex flex-col items-center gap-4 py-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-sage-600" />
                <div>
                  <p className="font-serif text-lg font-semibold text-sand-950">Running Dry-Run Validation...</p>
                  <p className="mt-1 text-sm text-sand-600">
                    Checking data types, required fields, room categories, and date ranges.
                  </p>
                </div>
              </PanelBody>
            </Panel>
          )}

          {/* Dry-run results */}
          {dryRunComplete && (
            <>
              {/* Summary banner */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-sand-200 bg-gradient-to-r from-sand-50 via-white to-sand-50 p-4">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-5 w-5 text-sage-700" />
                  <div>
                    <p className="font-serif text-base font-semibold text-sand-950">
                      {csvFile}
                    </p>
                    <p className="text-xs text-sand-600">
                      {importRows.length} rows parsed · {validCount} valid · {warningCount} warning · {errorCount} errors
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCsvFile(null);
                      setDryRunComplete(false);
                      setImportRows([]);
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleImport}
                    disabled={validCount === 0}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Import {validCount + warningCount} Valid Rows
                  </Button>
                </div>
              </div>

              {/* Error highlight */}
              {errorCount > 0 && (
                <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/60 p-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                  <div>
                    <p className="text-xs font-semibold text-rose-900">
                      {errorCount} rows have validation errors and will be skipped
                    </p>
                    <p className="mt-0.5 text-xs text-rose-700">
                      Fix the errors in your CSV and re-upload, or proceed to import only the valid rows.
                    </p>
                  </div>
                </div>
              )}

              {/* Results table */}
              <Panel>
                <PanelBody className="overflow-x-auto">
                  <Table>
                    <THead>
                      <tr>
                        <TH>Row</TH>
                        <TH>Status</TH>
                        <TH>Guest Name</TH>
                        <TH>Email</TH>
                        <TH>Room Category</TH>
                        <TH>Check-in</TH>
                        <TH>Check-out</TH>
                        <TH>Message</TH>
                      </tr>
                    </THead>
                    <TBody>
                      {importRows.map((row) => (
                        <TR
                          key={row.row}
                          className={cn(
                            row.status === "error" && "bg-rose-50/40",
                            row.status === "warning" && "bg-amber-50/40"
                          )}
                        >
                          <TD className="font-mono text-sand-500">{row.row}</TD>
                          <TD>
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize",
                                row.status === "valid" && "border-emerald-200 bg-emerald-50 text-emerald-800",
                                row.status === "warning" && "border-amber-200 bg-amber-50 text-amber-800",
                                row.status === "error" && "border-rose-200 bg-rose-50 text-rose-700"
                              )}
                            >
                              {row.status === "valid" && <CheckCircle2 className="h-3 w-3" />}
                              {row.status === "warning" && <AlertCircle className="h-3 w-3" />}
                              {row.status === "error" && <XCircle className="h-3 w-3" />}
                              {row.status}
                            </span>
                          </TD>
                          <TD className="font-medium text-sand-900">{row.guestName || "—"}</TD>
                          <TD className="font-mono text-xs text-sand-600">{row.email}</TD>
                          <TD className="font-mono text-xs">{row.roomCategory}</TD>
                          <TD>{row.checkIn}</TD>
                          <TD>{row.checkOut}</TD>
                          <TD className="max-w-[200px]">
                            {row.message ? (
                              <span className={cn(
                                "text-xs",
                                row.status === "error" ? "text-rose-700" : "text-amber-700"
                              )}>
                                {row.message}
                              </span>
                            ) : (
                              <span className="text-xs text-sand-400">—</span>
                            )}
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </PanelBody>
              </Panel>
            </>
          )}
        </div>
      )}
    </div>
  );
}
