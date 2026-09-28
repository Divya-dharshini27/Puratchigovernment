"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  X, FileText, Download, Search, Filter, 
  Clock, CheckCircle2, XCircle, Building2, User, RefreshCw, 
  HelpCircle, QrCode, Shield, FileCheck 
} from "lucide-react";
import { createClient } from "../../lib/supabase/client";
import { AdminAuditLog, AdminProfile } from "../../lib/types";

interface AuditTrailModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AdminProfile | null;
}

export default function AuditTrailModal({
  isOpen,
  onClose,
  currentUser
}: AuditTrailModalProps) {
  const supabase = createClient();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  useEffect(() => {
    if (isOpen) {
      fetchAuditLogs();
    }
  }, [isOpen]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("admin_audit_logs")
        .select(`
          *,
          events:event_id (
            title,
            location_name
          )
        `)
        .order("created_at", { ascending: false })
        .limit(250);

      if (!error && data) {
        const formatted = data.map((item: any) => ({
          ...item,
          event_title: item.events?.title || "Assembly"
        }));
        setLogs(formatted);
      }
    } catch (err) {
      console.error("Error loading audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  // Export audit logs to CSV
  const handleExportCSV = () => {
    if (logs.length === 0) return;

    const headers = [
      "Log ID",
      "Timestamp",
      "Action",
      "Performer Name",
      "Role",
      "Jurisdiction",
      "Event ID",
      "Event Title",
      "Previous Status",
      "New Status",
      "Rejection Reason",
      "Authority Notes"
    ];

    const rows = filteredLogs.map((log) => [
      `"${log.id}"`,
      `"${new Date(log.created_at).toISOString()}"`,
      `"${log.action}"`,
      `"${log.performer_name || ""}"`,
      `"${log.role}"`,
      `"${log.jurisdiction || ""}"`,
      `"${log.event_id}"`,
      `"${(log.event_title || "").replace(/"/g, '""')}"`,
      `"${log.previous_status || ""}"`,
      `"${log.new_status || ""}"`,
      `"${(log.rejection_reason || "").replace(/"/g, '""')}"`,
      `"${(log.authority_notes || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `PURATCHI_AUDIT_LOGS_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  if (!isOpen || !mounted) return null;

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = 
      searchTerm === "" ||
      log.performer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.event_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.event_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.jurisdiction?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.rejection_reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.authority_notes?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAction = actionFilter === "all" || log.action === actionFilter;

    return matchesSearch && matchesAction;
  });

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-5xl bg-slate-900 border-2 border-red-900/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 max-h-[90vh] flex flex-col my-auto">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-red-600/20 text-red-400 border border-red-500/30">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Administrative &amp; Statutory Audit Trail</h3>
              <p className="text-xs text-slate-400">Immutable Record of Authority Clearances, Information Requests &amp; Field Scans</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Filters & Actions Bar */}
        <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            
            {/* Search */}
            <div className="relative min-w-[220px] flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by Officer, Event, Jurisdiction, Reason..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
              />
            </div>

            {/* Action Filter */}
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="py-1.5 px-3 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-red-500"
            >
              <option value="all">All Action Types</option>
              <option value="QR_SCANNED">QR Scanned</option>
              <option value="EVENT_REVIEWED">Event Reviewed</option>
              <option value="APPROVED">Approved</option>
              <option value="REQUEST_INFO">Request Information</option>
              <option value="REJECTED">Rejected</option>
              <option value="REVOKED">Revoked (Emergency)</option>
              <option value="DOCUMENT_ACCESSED">Document Accessed</option>
              <option value="ADMINISTRATIVE_CHANGES">Administrative Changes</option>
            </select>

            <button
              onClick={fetchAuditLogs}
              className="p-2 rounded-lg bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 transition"
              title="Refresh Audit Logs"
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-red-400" : ""} />
            </button>
          </div>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition disabled:opacity-50"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <RefreshCw size={24} className="animate-spin text-red-400" />
              <span className="text-xs">Fetching verified audit records...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 italic">
              No audit logs matched your current query.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead className="bg-slate-900/80 text-[11px] uppercase font-bold text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Officer / Actor</th>
                    <th className="p-3">Jurisdiction</th>
                    <th className="p-3">Assembly Event</th>
                    <th className="p-3">Previous &rarr; New Status</th>
                    <th className="p-3">Directives / Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-900/50 transition">
                      <td className="p-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      
                      {/* Action */}
                      <td className="p-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black tracking-wide ${
                          log.action === "APPROVED" ? "bg-emerald-950 text-emerald-300 border border-emerald-800" :
                          log.action === "REJECTED" ? "bg-red-950 text-red-300 border border-red-800" :
                          log.action === "REVOKED" ? "bg-red-950 text-red-200 border border-red-600 font-black" :
                          log.action === "REQUEST_INFO" ? "bg-amber-950 text-amber-300 border border-amber-800" :
                          log.action === "QR_SCANNED" ? "bg-blue-950 text-blue-300 border border-blue-800" :
                          log.action === "DOCUMENT_ACCESSED" ? "bg-purple-950 text-purple-300 border border-purple-800" :
                          "bg-slate-800 text-slate-300 border border-slate-700"
                        }`}>
                          {log.action === "APPROVED" && <CheckCircle2 size={11} />}
                          {log.action === "REJECTED" && <XCircle size={11} />}
                          {log.action === "REVOKED" && <XCircle size={11} className="text-red-400" />}
                          {log.action === "REQUEST_INFO" && <HelpCircle size={11} />}
                          {log.action === "QR_SCANNED" && <QrCode size={11} />}
                          {log.action === "DOCUMENT_ACCESSED" && <FileCheck size={11} />}
                          <span>{log.action}</span>
                        </span>
                      </td>

                      {/* Actor */}
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-bold text-slate-100">{log.performer_name}</div>
                        <div className="text-[10px] text-slate-400 uppercase">{log.role}</div>
                      </td>

                      {/* Jurisdiction */}
                      <td className="p-3 text-slate-300 whitespace-nowrap">
                        {log.jurisdiction}
                      </td>

                      {/* Event */}
                      <td className="p-3 max-w-xs truncate">
                        <div className="font-semibold text-slate-200 truncate">{log.event_title}</div>
                        <div className="text-[10px] text-slate-500 font-mono truncate">ID: {log.event_id}</div>
                      </td>

                      {/* Status Transition */}
                      <td className="p-3 whitespace-nowrap text-[11px]">
                        <span className="text-slate-500 font-medium">{log.previous_status || "—"}</span>
                        <span className="mx-1 text-slate-400">&rarr;</span>
                        <span className="text-slate-200 font-bold">{log.new_status || log.action}</span>
                      </td>

                      {/* Directives / Reason */}
                      <td className="p-3 max-w-xs text-slate-300 text-[11px] italic">
                        {log.rejection_reason ? (
                          <span className="text-red-400 not-italic font-semibold">{log.rejection_reason}</span>
                        ) : log.authority_notes ? (
                          <span>{log.authority_notes}</span>
                        ) : (
                          <span className="text-slate-500">Standard recorded action.</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <span>Showing {filteredLogs.length} audit entry(ies)</span>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            Close
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
