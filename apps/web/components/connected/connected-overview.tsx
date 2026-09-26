"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Download, RefreshCw, Search } from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody } from "@/components/ui/panel";

export type OverviewRow = Record<string, string | number | null | undefined>;
export type OverviewData = {
  metrics?: { label: string; value: string; detail?: string }[];
  columns: { key: string; label: string }[];
  rows: OverviewRow[];
  emptyMessage?: string;
  note?: string;
};

export function ConnectedOverview({
  title,
  description,
  queryKey,
  load,
}: {
  title: string;
  description: string;
  queryKey: string;
  load: () => Promise<OverviewData>;
}) {
  const { isConnected, user } = useAuth();
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["connected-overview", queryKey, user?.propertyId, user?.id],
    queryFn: load,
    enabled: isConnected && Boolean(user),
    retry: false,
    staleTime: 30_000,
  });
  const data = query.data;
  const rows = useMemo(() => {
    if (!data) return [];
    const needle = search.toLowerCase().trim();
    return needle
      ? data.rows.filter((row) => Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(needle)))
      : data.rows;
  }, [data, search]);

  const downloadCsv = () => {
    if (!data || rows.length === 0) return;
    const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [
      data.columns.map((column) => quote(column.label)).join(","),
      ...rows.map((row) => data.columns.map((column) => quote(row[column.key])).join(",")),
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${queryKey}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      {!isConnected ? (
        <Panel><PanelBody className="py-12 text-center">
          <h2 className="font-serif text-2xl text-sage-950">Connect to view current data</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-sage-700">This page reads from the resort API. The role preview does not contain live records.</p>
          <Link href="/login" className="mt-6 inline-flex rounded-lg bg-sage-700 px-5 py-3 text-sm font-medium text-white">Sign in with your account</Link>
        </PanelBody></Panel>
      ) : query.isPending ? (
        <Panel><PanelBody className="py-12 text-center text-sm text-sage-700" role="status">Loading current data…</PanelBody></Panel>
      ) : query.isError ? (
        <Panel><PanelBody className="py-12 text-center">
          <p role="alert" className="text-sm text-rose-700">{query.error instanceof Error ? query.error.message : "Could not load data."}</p>
          <button type="button" onClick={() => query.refetch()} className="mt-5 rounded-lg border border-sage-300 px-4 py-2 text-sm text-sage-800">Try again</button>
        </PanelBody></Panel>
      ) : data ? (
        <>
          {data.metrics && data.metrics.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {data.metrics.map((metric) => <div key={metric.label} className="rounded-xl border border-sand-200 bg-white p-5">
                <p className="text-xs text-sage-700">{metric.label}</p>
                <p className="mt-3 font-serif text-3xl text-sage-950">{metric.value}</p>
                {metric.detail && <p className="mt-2 text-xs text-sage-600">{metric.detail}</p>}
              </div>)}
            </div>
          )}
          <Panel><PanelBody className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-sage-700">Live API data · {data.rows.length} records</p>
              <div className="flex flex-wrap gap-2">
                <label className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-sage-500" aria-hidden="true" />
                  <span className="sr-only">Search {title}</span>
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search records" className="rounded-lg border border-sand-200 py-2 pl-9 pr-3 text-sm focus:border-sage-600 focus:outline-none" />
                </label>
                <button type="button" onClick={() => query.refetch()} aria-label="Refresh data" className="rounded-lg border border-sand-200 p-2 text-sage-700"><RefreshCw className="h-4 w-4" /></button>
                <button type="button" onClick={downloadCsv} disabled={rows.length === 0} className="inline-flex items-center gap-2 rounded-lg border border-sand-200 px-3 py-2 text-sm text-sage-700 disabled:opacity-50"><Download className="h-4 w-4" /> Export CSV</button>
              </div>
            </div>
            {data.note && <p className="mt-4 rounded-lg bg-sage-50 p-3 text-xs leading-5 text-sage-700">{data.note}</p>}
            {rows.length === 0 ? <p className="py-14 text-center text-sm text-sage-700">{search ? "No records match your search." : data.emptyMessage ?? "No records available yet."}</p> : (
              <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm">
                <thead><tr className="border-b border-sand-200 text-xs text-sage-700">{data.columns.map((column) => <th key={column.key} scope="col" className="px-3 py-3 font-medium">{column.label}</th>)}</tr></thead>
                <tbody>{rows.map((row, index) => <tr key={String(row.id ?? index)} className="border-b border-sand-100 last:border-0">{data.columns.map((column) => <td key={column.key} className="px-3 py-3 text-sage-950">{row[column.key] ?? "—"}</td>)}</tr>)}</tbody>
              </table></div>
            )}
          </PanelBody></Panel>
        </>
      ) : null}
    </div>
  );
}
