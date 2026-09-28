"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  X, CheckCircle2, XCircle, AlertTriangle, Clock, 
  Calendar, MapPin, Users, FileText, Download, Eye, 
  User, Mail, Phone, ShieldCheck, MessageSquare, 
  RefreshCw, Check, AlertCircle, HelpCircle, Send, Plus,
  ShieldX, Ban
} from "lucide-react";
import { createClient } from "../../lib/supabase/client";
import { 
  EventItem, EventDocument, AdminProfile, 
  STATUTORY_REJECTION_REASONS, STATUTORY_REVOCATION_REASONS,
  STANDARD_REQUIRED_DOCUMENTS, 
  AdminAuditLog, EventInfoRequest 
} from "../../lib/types";

interface EventDossierModalProps {
  isOpen: boolean;
  event: EventItem | null;
  currentUser: AdminProfile | null;
  onClose: () => void;
  onEventUpdated?: (updatedEvent: EventItem) => void;
}

export default function EventDossierModal({
  isOpen,
  event,
  currentUser,
  onClose,
  onEventUpdated
}: EventDossierModalProps) {
  const supabase = createClient();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [documents, setDocuments] = useState<EventDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [eventAuditLogs, setEventAuditLogs] = useState<AdminAuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [infoRequests, setInfoRequests] = useState<EventInfoRequest[]>([]);
  const [loadingInfoReqs, setLoadingInfoReqs] = useState(false);

  // Decision States
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [authorityNotes, setAuthorityNotes] = useState("");
  
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [customReasonText, setCustomReasonText] = useState("");

  const [showRequestInfoModal, setShowRequestInfoModal] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [selectedRequiredDocs, setSelectedRequiredDocs] = useState<string[]>([]);

  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [revocationReason, setRevocationReason] = useState("");
  const [customRevocationReason, setCustomRevocationReason] = useState("");
  const [revocationDirectives, setRevocationDirectives] = useState("");

  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionSuccess, setDecisionSuccess] = useState<string | null>(null);

  // Load documents, audit logs, and info requests when event changes
  useEffect(() => {
    if (!isOpen || !event) {
      setDocuments([]);
      setEventAuditLogs([]);
      setInfoRequests([]);
      setShowApproveConfirm(false);
      setShowRejectModal(false);
      setShowRequestInfoModal(false);
      setShowRevokeModal(false);
      setAuthorityNotes("");
      setRejectionReason("");
      setCustomReasonText("");
      setRequestMessage("");
      setSelectedRequiredDocs([]);
      setRevocationReason("");
      setCustomRevocationReason("");
      setRevocationDirectives("");
      setDecisionError(null);
      setDecisionSuccess(null);
      return;
    }

    fetchEventDocuments(event.id);
    fetchEventAuditLogs(event.id);
    fetchEventInfoRequests(event.id);
  }, [isOpen, event]);

  // Fetch submitted official permit documents with secure signed URLs
  const fetchEventDocuments = async (eventId: string) => {
    setLoadingDocs(true);
    try {
      const { data: docsData, error } = await supabase
        .from("event_documents")
        .select("*")
        .eq("event_id", eventId)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;

      if (docsData && docsData.length > 0) {
        const docsWithUrls = await Promise.all(
          docsData.map(async (doc) => {
            try {
              const { data: signedData, error: signErr } = await supabase.storage
                .from("permit-documents")
                .createSignedUrl(doc.file_path, 3600);
              
              return {
                ...doc,
                signed_url: signErr ? null : signedData?.signedUrl
              };
            } catch {
              return doc;
            }
          })
        );
        setDocuments(docsWithUrls);
      } else {
        setDocuments([]);
      }
    } catch (err) {
      console.error("Error fetching documents:", err);
    } finally {
      setLoadingDocs(false);
    }
  };

  // Fetch audit logs for this specific event
  const fetchEventAuditLogs = async (eventId: string) => {
    setLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from("admin_audit_logs")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setEventAuditLogs(data as AdminAuditLog[]);
      }
    } catch (err) {
      console.error("Error loading event audit logs:", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Fetch information requests for this event
  const fetchEventInfoRequests = async (eventId: string) => {
    setLoadingInfoReqs(true);
    try {
      const { data, error } = await supabase
        .from("event_info_requests")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setInfoRequests(data as EventInfoRequest[]);
      }
    } catch (err) {
      console.warn("Info requests not yet populated or table initializing:", err);
    } finally {
      setLoadingInfoReqs(false);
    }
  };

  // Log Document Access for Audit Trail
  const handleDocumentAccess = async (doc: EventDocument) => {
    try {
      await fetch("/api/authority/log-document-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event?.id,
          documentName: doc.document_name,
          documentId: doc.id
        })
      });
      // Refresh audit logs in background
      if (event) fetchEventAuditLogs(event.id);
    } catch (err) {
      console.warn("Failed to log document access:", err);
    }
  };

  // 1. APPROVE ACTION
  const handleApproveEvent = async () => {
    if (!event) return;
    setSubmittingDecision(true);
    setDecisionError(null);

    try {
      const response = await fetch("/api/authority/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          decision: "APPROVE",
          notes: authorityNotes.trim()
        })
      });

      const res = await response.json();
      if (!response.ok || !res.success) {
        throw new Error(res.message || "Failed to approve assembly.");
      }

      setShowApproveConfirm(false);
      setDecisionSuccess("Assembly successfully APPROVED. Public listings and Host portal updated in real-time.");
      
      const updated: EventItem = {
        ...event,
        status: "approved",
        authority_notes: authorityNotes.trim() || "Approved under standard civic assembly regulations.",
        reviewed_at: new Date().toISOString()
      };

      if (onEventUpdated) onEventUpdated(updated);
      await fetchEventAuditLogs(event.id);

    } catch (err: any) {
      console.error("Approval error:", err);
      setDecisionError(err.message || "Failed to approve event.");
    } finally {
      setSubmittingDecision(false);
    }
  };

  // 2. REQUEST INFORMATION ACTION
  const handleRequestInfo = async () => {
    if (!event) return;
    if (!requestMessage.trim()) {
      setDecisionError("Please enter the specific information or document required from the host.");
      return;
    }

    setSubmittingDecision(true);
    setDecisionError(null);

    try {
      const response = await fetch("/api/authority/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          decision: "REQUEST_INFO",
          requestMessage: requestMessage.trim(),
          requiredDocuments: selectedRequiredDocs
        })
      });

      const res = await response.json();
      if (!response.ok || !res.success) {
        throw new Error(res.message || "Failed to submit information request.");
      }

      setShowRequestInfoModal(false);
      setDecisionSuccess("Information request recorded. Host has been notified to provide clarification. Assembly remains unapproved.");

      const updated: EventItem = {
        ...event,
        status: "request_info",
        authority_notes: `Information Requested: ${requestMessage.trim()}`,
        reviewed_at: new Date().toISOString()
      };

      if (onEventUpdated) onEventUpdated(updated);
      await fetchEventAuditLogs(event.id);
      await fetchEventInfoRequests(event.id);

    } catch (err: any) {
      console.error("Request info error:", err);
      setDecisionError(err.message || "Failed to submit request.");
    } finally {
      setSubmittingDecision(false);
    }
  };

  // 3. REJECT ACTION
  const handleRejectEvent = async () => {
    if (!event) return;
    const finalReason = rejectionReason === "other" ? customReasonText.trim() : rejectionReason.trim();

    if (!finalReason) {
      setDecisionError("A mandatory rejection reason is required by statutory regulations.");
      return;
    }

    setSubmittingDecision(true);
    setDecisionError(null);

    try {
      const response = await fetch("/api/authority/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          decision: "REJECT",
          rejectionReason: finalReason
        })
      });

      const res = await response.json();
      if (!response.ok || !res.success) {
        throw new Error(res.message || "Failed to record rejection decision.");
      }

      setShowRejectModal(false);
      setDecisionSuccess("Assembly has been REJECTED. Grounds recorded in permanent audit history.");

      const updated: EventItem = {
        ...event,
        status: "rejected",
        rejection_reason: finalReason,
        reviewed_at: new Date().toISOString()
      };

      if (onEventUpdated) onEventUpdated(updated);
      await fetchEventAuditLogs(event.id);

    } catch (err: any) {
      console.error("Rejection error:", err);
      setDecisionError(err.message || "Failed to record rejection decision.");
    } finally {
      setSubmittingDecision(false);
    }
  };

  // 4. EMERGENCY REVOCATION ACTION
  const handleRevokeEvent = async () => {
    if (!event) return;
    const finalReason = revocationReason === "other" ? customRevocationReason.trim() : revocationReason.trim();

    if (!finalReason) {
      setDecisionError("A mandatory statutory emergency reason is required to revoke assembly clearance.");
      return;
    }

    setSubmittingDecision(true);
    setDecisionError(null);

    try {
      const response = await fetch("/api/authority/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          decision: "REVOKE",
          revocationReason: finalReason,
          directives: revocationDirectives.trim()
        })
      });

      const res = await response.json();
      if (!response.ok || !res.success) {
        throw new Error(res.message || "Failed to revoke assembly verification.");
      }

      setShowRevokeModal(false);
      setDecisionSuccess("🚨 EMERGENCY REVOCATION ENFORCED: Assembly verification revoked and QR pass invalidated immediately.");

      const updated: EventItem = {
        ...event,
        status: "revoked",
        qr_status: "revoked",
        rejection_reason: finalReason,
        authority_notes: revocationDirectives.trim() ? `EMERGENCY REVOCATION DIRECTIVES: ${revocationDirectives.trim()}` : `EMERGENCY REVOCATION: ${finalReason}`,
        reviewed_at: new Date().toISOString()
      };

      if (onEventUpdated) onEventUpdated(updated);
      await fetchEventAuditLogs(event.id);

    } catch (err: any) {
      console.error("Revocation error:", err);
      setDecisionError(err.message || "Failed to revoke assembly clearance.");
    } finally {
      setSubmittingDecision(false);
    }
  };

  const toggleDocRequirement = (docName: string) => {
    setSelectedRequiredDocs(prev => 
      prev.includes(docName) 
        ? prev.filter(d => d !== docName)
        : [...prev, docName]
    );
  };

  if (!isOpen || !event || !mounted) return null;

  const isAuthority = currentUser?.role === "authority";
  const canMakeDecision = isAuthority && (event.status === "pending" || event.status === "draft" || event.status === "request_info");

  return createPortal(
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
        <div className="w-full max-w-4xl bg-slate-900 border-2 border-red-900/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 max-h-[92vh] flex flex-col my-auto">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
              event.status === "approved"
                ? "bg-emerald-950 text-emerald-300 border border-emerald-700"
                : event.status === "revoked"
                ? "bg-red-950 text-red-300 border-2 border-red-600 animate-pulse font-black"
                : event.status === "rejected"
                ? "bg-red-950 text-red-300 border border-red-700"
                : event.status === "request_info"
                ? "bg-amber-950 text-amber-300 border border-amber-600"
                : "bg-slate-800 text-slate-300 border border-slate-700"
            }`}>
              {event.status === "request_info" ? "INFO REQUESTED" : event.status === "revoked" ? "VERIFICATION REVOKED" : event.status}
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white leading-tight">
                {event.title}
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Official Assembly Dossier &bull; ID: <span className="font-mono text-slate-300">{event.id}</span>
                {event.qr_token && (
                  <span className="ml-2 font-mono text-amber-400 font-semibold">[Token: {event.qr_token}]</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Status Alerts */}
        {decisionSuccess && (
          <div className="px-6 py-2.5 bg-emerald-950 border-b border-emerald-800 text-emerald-200 text-xs font-medium flex items-center gap-2 shrink-0">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>{decisionSuccess}</span>
          </div>
        )}

        {decisionError && (
          <div className="px-6 py-2.5 bg-red-950 border-b border-red-800 text-red-200 text-xs font-medium flex items-center gap-2 shrink-0">
            <AlertCircle size={16} className="text-red-400 shrink-0" />
            <span>{decisionError}</span>
          </div>
        )}

        {/* Modal Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6">

          {/* Core Assembly Summary Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Category & Logistics */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={14} className="text-red-400" />
                <span>Date & Schedule</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="font-bold text-slate-100 text-sm">{event.event_date}</div>
                <div className="text-slate-400">{event.start_time} to {event.end_time}</div>
                <div className="pt-2 text-[11px] text-amber-400">
                  <span className="text-slate-400">Category: </span>
                  <span className="font-semibold">{event.category}</span>
                </div>
              </div>
            </div>

            {/* Venue & Location */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin size={14} className="text-red-400" />
                <span>Venue & Assembly Ground</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="font-bold text-slate-100">{event.place_of_assembly}</div>
                <div className="text-slate-400">{event.location_name}</div>
                {event.latitude && event.longitude && (
                  <div className="pt-1 text-[11px] font-mono text-slate-500">
                    GPS: {event.latitude.toFixed(4)}, {event.longitude.toFixed(4)}
                  </div>
                )}
              </div>
            </div>

            {/* Turnout & Capacity */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Users size={14} className="text-red-400" />
                <span>Expected Crowd</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="font-bold text-slate-100 text-sm">
                  {event.expected_attendance?.toLocaleString()} Attendees
                </div>
                <div className="text-slate-400">
                  Age Criterion: {event.min_age || 18}+ {event.max_age ? `to ${event.max_age}` : "years"}
                </div>
                {event.expected_attendance >= 1000 && (
                  <div className="pt-1 text-[11px] font-bold text-amber-400 flex items-center gap-1">
                    <AlertTriangle size={13} />
                    <span>High Capacity Assembly (&gt;1,000)</span>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Host / Organizer Dossier */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <User size={14} className="text-red-400" />
              <span>Organizer Credentials (Host)</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="block text-slate-500 text-[11px]">Full Name</span>
                <span className="font-bold text-slate-200">{event.host_name || "Verified Host Organizer"}</span>
              </div>
              <div>
                <span className="block text-slate-500 text-[11px]">Contact Email</span>
                <span className="text-slate-300 font-mono">{event.host_email || "Not disclosed"}</span>
              </div>
              <div>
                <span className="block text-slate-500 text-[11px]">Phone Number</span>
                <span className="text-slate-300 font-mono">{event.host_phone || "Not recorded"}</span>
              </div>
            </div>
          </div>

          {/* Purpose & Description */}
          <div className="space-y-3">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Statement of Purpose &amp; Public Cause
              </h4>
              <p className="text-sm font-semibold text-slate-200 bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                {event.purpose}
              </p>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Full Event Description
              </h4>
              <p className="text-xs text-slate-300 bg-slate-950 p-3.5 rounded-lg border border-slate-800 whitespace-pre-line leading-relaxed">
                {event.description}
              </p>
            </div>
          </div>

          {/* SUBMITTED OFFICIAL DOCUMENTS (Private Storage Access) */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <FileText size={15} className="text-red-400" />
                <span>Submitted Official Documents &amp; Permit Attachments</span>
              </h4>
              <span className="text-[11px] text-slate-400">
                {documents.length} Attachment{documents.length !== 1 ? "s" : ""}
              </span>
            </div>

            {loadingDocs ? (
              <div className="py-6 flex items-center justify-center gap-2 text-xs text-slate-400">
                <RefreshCw size={14} className="animate-spin text-red-400" />
                <span>Generating secure signed document access...</span>
              </div>
            ) : documents.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500 italic bg-slate-900/50 rounded-lg">
                No official permit documents uploaded for this assembly application.
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div 
                    key={doc.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded bg-red-950 text-red-400 border border-red-800/60">
                        <FileText size={16} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-200">{doc.document_name}</div>
                        <div className="text-[10px] text-slate-400">
                          Uploaded on {new Date(doc.uploaded_at).toLocaleDateString()} &bull; {doc.file_type || "Document"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {doc.signed_url ? (
                        <a
                          href={doc.signed_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => handleDocumentAccess(doc)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition border border-slate-700"
                        >
                          <Download size={13} />
                          <span>View / Download</span>
                        </a>
                      ) : (
                        <span className="text-[10px] text-red-400">URL expired or unavailable</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-2 text-[10px] text-slate-500 italic">
              * Classified Document Notice: Document access is restricted to authenticated statutory officers and logged in the immutable audit trail.
            </p>
          </div>

          {/* REQUEST INFORMATION DIALOGUE THREAD (If any requests exist) */}
          {infoRequests.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/70 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <HelpCircle size={15} />
                <span>Statutory Clarification &amp; Information Request History</span>
              </h4>
              <div className="space-y-3">
                {infoRequests.map((req) => (
                  <div key={req.id} className="p-3 rounded-lg bg-slate-950 border border-amber-900/50 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-bold text-amber-200">Requested by: {req.officer_name}</span>
                      <span className="font-mono">{new Date(req.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-200 font-medium">{req.request_message}</p>
                    
                    {req.required_documents && req.required_documents.length > 0 && (
                      <div className="pt-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Documents Required:</span>
                        <ul className="list-disc list-inside text-[11px] text-amber-300 mt-0.5 space-y-0.5">
                          {req.required_documents.map((d, i) => (
                            <li key={i}>{d}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {req.host_response && (
                      <div className="mt-2 p-2.5 rounded bg-slate-900 border border-slate-700 text-xs">
                        <div className="text-[10px] font-bold text-emerald-400 uppercase mb-0.5">Host Organizer Response:</div>
                        <p className="text-slate-200">{req.host_response}</p>
                        {req.responded_at && (
                          <div className="text-[10px] text-slate-500 font-mono mt-1">
                            Received: {new Date(req.responded_at).toLocaleString()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Event Audit Trail */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Clock size={14} className="text-amber-400" />
              <span>Immutable Administrative Audit Log</span>
            </h4>
            {loadingLogs ? (
              <div className="py-4 text-center text-xs text-slate-400">Loading audit history...</div>
            ) : eventAuditLogs.length === 0 ? (
              <div className="py-3 text-center text-xs text-slate-500 italic">No administrative actions logged yet.</div>
            ) : (
              <div className="space-y-2">
                {eventAuditLogs.map((log) => (
                  <div key={log.id} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          log.action === "APPROVED" ? "bg-emerald-950 text-emerald-300 border border-emerald-800" :
                          log.action === "REJECTED" ? "bg-red-950 text-red-300 border border-red-800" :
                          log.action === "REQUEST_INFO" ? "bg-amber-950 text-amber-300 border border-amber-800" :
                          log.action === "QR_SCANNED" ? "bg-blue-950 text-blue-300 border border-blue-800" :
                          log.action === "DOCUMENT_ACCESSED" ? "bg-purple-950 text-purple-300 border border-purple-800" :
                          "bg-slate-800 text-slate-300"
                        }`}>
                          {log.action}
                        </span>
                        <span className="font-bold text-slate-200">{log.performer_name}</span>
                        <span className="text-[10px] text-slate-400">({log.role} &bull; {log.jurisdiction})</span>
                      </div>
                      {(log.authority_notes || log.rejection_reason) && (
                        <div className="text-[11px] text-slate-300 mt-1">
                          {log.authority_notes || log.rejection_reason}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer & 3-Way Decision Toolbar */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-400">
            {canMakeDecision ? (
              <span className="text-amber-400 font-bold flex items-center gap-1">
                <Clock size={14} />
                <span>Statutory Authority Review &bull; Choose Action Below</span>
              </span>
            ) : (
              <span>Administrative Inspection Mode</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
            >
              Close
            </button>

            {/* Emergency Revocation Action for Approved / Ongoing Gatherings */}
            {(isAuthority || currentUser?.role === "government") && (event.status === "approved" || event.status === "upcoming" || event.status === "ongoing") && (
              <button
                onClick={() => {
                  setShowRevokeModal(true);
                  setShowApproveConfirm(false);
                  setShowRejectModal(false);
                  setShowRequestInfoModal(false);
                }}
                className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-xs font-black uppercase tracking-wider transition shadow-md border border-red-500 flex items-center gap-1.5 active:scale-95"
              >
                <ShieldX size={15} />
                <span>Emergency Revoke Verification</span>
              </button>
            )}

            {/* 3 Authority Decision Actions for Pending */}
            {canMakeDecision && (
              <>
                {/* 1. REJECT ACTION */}
                <button
                  onClick={() => {
                    setShowRejectModal(true);
                    setShowApproveConfirm(false);
                    setShowRequestInfoModal(false);
                    setShowRevokeModal(false);
                  }}
                  className="px-4 py-2 rounded-lg bg-red-950 hover:bg-red-900 border border-red-700 text-red-200 text-xs font-bold transition flex items-center gap-1.5"
                >
                  <XCircle size={15} />
                  <span>Reject</span>
                </button>

                {/* 2. REQUEST INFO ACTION */}
                <button
                  onClick={() => {
                    setShowRequestInfoModal(true);
                    setShowApproveConfirm(false);
                    setShowRejectModal(false);
                    setShowRevokeModal(false);
                  }}
                  className="px-4 py-2 rounded-lg bg-amber-950 hover:bg-amber-900 border border-amber-700 text-amber-200 text-xs font-bold transition flex items-center gap-1.5"
                >
                  <HelpCircle size={15} />
                  <span>Request Information</span>
                </button>

                {/* 3. APPROVE ACTION */}
                <button
                  onClick={() => {
                    setShowApproveConfirm(true);
                    setShowRejectModal(false);
                    setShowRequestInfoModal(false);
                    setShowRevokeModal(false);
                  }}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-md flex items-center gap-1.5"
                >
                  <CheckCircle2 size={15} />
                  <span>Approve</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>

      {/* SUB-MODAL 0: EMERGENCY REVOCATION CONFIRMATION */}
      {showRevokeModal && (
        <div key="submodal-revoke" className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 animate-in fade-in">
          <div className="w-full max-w-lg bg-slate-900 border-2 border-red-600 rounded-2xl p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center gap-2.5 text-red-400">
              <ShieldX size={24} className="shrink-0" />
              <div>
                <h3 className="font-black text-base text-white uppercase tracking-wide">
                  Emergency Revocation &amp; Invalidation
                </h3>
                <p className="text-xs text-red-200">
                  Immediately cancels statutory verification, invalidates all QR checkpoint passes, and flags the assembly in real-time.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                Select Statutory Emergency Grounds *
              </label>
              <div className="space-y-1.5">
                {STATUTORY_REVOCATION_REASONS.map((r) => (
                  <label key={r} className="flex items-start gap-2 text-xs text-slate-200 p-2 rounded-lg bg-slate-950 border border-red-950 hover:border-red-700 cursor-pointer">
                    <input
                      type="radio"
                      name="dossierRevokeReason"
                      value={r}
                      checked={revocationReason === r}
                      onChange={() => setRevocationReason(r)}
                      className="mt-0.5 accent-red-600"
                    />
                    <span>{r}</span>
                  </label>
                ))}
                <label className="flex items-start gap-2 text-xs text-slate-200 p-2 rounded-lg bg-slate-950 border border-red-950 hover:border-red-700 cursor-pointer">
                  <input
                    type="radio"
                    name="dossierRevokeReason"
                    value="other"
                    checked={revocationReason === "other"}
                    onChange={() => setRevocationReason("other")}
                    className="mt-0.5 accent-red-600"
                  />
                  <span>Custom statutory grounds (specify below)</span>
                </label>
              </div>
            </div>

            {revocationReason === "other" && (
              <div>
                <textarea
                  value={customRevocationReason}
                  onChange={(e) => setCustomRevocationReason(e.target.value)}
                  placeholder="Specify the exact hazard, unexpected crowd surge count, or transit obstruction..."
                  rows={2}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                Emergency Directives / Dispersal Instructions (Optional):
              </label>
              <textarea
                value={revocationDirectives}
                onChange={(e) => setRevocationDirectives(e.target.value)}
                placeholder="e.g. Order immediate dispersal; coordinate with local precinct to seal incoming roads."
                rows={2}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowRevokeModal(false)}
                disabled={submittingDecision}
                className="px-4 py-2 rounded-lg text-slate-400 hover:text-white text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRevokeEvent}
                disabled={submittingDecision || (!revocationReason && !customRevocationReason)}
                className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-black text-xs flex items-center gap-1.5 transition disabled:opacity-50 shadow-lg"
              >
                {submittingDecision ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Enforcing Revocation...</span>
                  </>
                ) : (
                  <>
                    <ShieldX size={15} />
                    <span>Enforce Emergency Revocation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL 1: APPROVE CONFIRMATION */}
      {showApproveConfirm && (
        <div key="submodal-approve" className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border-2 border-emerald-600 rounded-2xl p-6 shadow-2xl text-slate-100">
            <div className="flex items-center gap-2.5 text-emerald-400 mb-3">
              <CheckCircle2 size={22} />
              <h3 className="font-bold text-base text-white">Confirm Assembly Approval</h3>
            </div>
            <p className="text-xs text-slate-300 mb-4">
              Approving this assembly will change status to <strong className="text-emerald-400">APPROVED</strong>. It will immediately publish to public listings and notify the host organizer.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Authority Conditions / Directives (Optional)
              </label>
              <textarea
                value={authorityNotes}
                onChange={(e) => setAuthorityNotes(e.target.value)}
                placeholder="e.g. Loudspeakers permitted until 22:00 hrs; Traffic diversion along North corridor."
                rows={3}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowApproveConfirm(false)}
                disabled={submittingDecision}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleApproveEvent}
                disabled={submittingDecision}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition"
              >
                {submittingDecision ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Recording Approval...</span>
                  </>
                ) : (
                  <span>Confirm &amp; Authorize</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL 2: REQUEST INFORMATION */}
      {showRequestInfoModal && (
        <div key="submodal-request-info" className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 animate-in fade-in">
          <div className="w-full max-w-lg bg-slate-900 border-2 border-amber-600 rounded-2xl p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-2.5 text-amber-400 mb-2">
              <HelpCircle size={22} />
              <h3 className="font-bold text-base text-white">Request Information / Documents</h3>
            </div>
            <p className="text-xs text-slate-300 mb-4">
              The assembly status will change to <strong className="text-amber-400">REQUEST_INFO</strong> and remain <em>not approved</em>. The host organizer will be notified to submit the required clarifications.
            </p>

            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Clarification Required *
                </label>
                <textarea
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                  placeholder="Specify the exact clarifications, emergency details, or route information needed from the organizer..."
                  rows={3}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Check Required Official Documents (Optional):
                </label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {STANDARD_REQUIRED_DOCUMENTS.map((doc) => (
                    <label 
                      key={doc}
                      className={`flex items-start gap-2 text-xs p-2 rounded-lg border cursor-pointer transition ${
                        selectedRequiredDocs.includes(doc)
                          ? "bg-amber-950/80 border-amber-600 text-amber-100"
                          : "bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedRequiredDocs.includes(doc)}
                        onChange={() => toggleDocRequirement(doc)}
                        className="mt-0.5 accent-amber-500 rounded"
                      />
                      <span>{doc}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowRequestInfoModal(false)}
                disabled={submittingDecision}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestInfo}
                disabled={submittingDecision || !requestMessage.trim()}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition disabled:opacity-50"
              >
                {submittingDecision ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Sending Request...</span>
                  </>
                ) : (
                  <span>Submit Information Request</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL 3: REJECT DIALOG */}
      {showRejectModal && (
        <div key="submodal-reject" className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 animate-in fade-in">
          <div className="w-full max-w-lg bg-slate-900 border-2 border-red-700 rounded-2xl p-6 shadow-2xl text-slate-100">
            <div className="flex items-center gap-2.5 text-red-400 mb-2">
              <XCircle size={22} />
              <h3 className="font-bold text-base text-white">Statutory Assembly Rejection</h3>
            </div>
            <p className="text-xs text-slate-300 mb-4">
              Statutory guidelines require an explicit reason for assembly denial. The event is marked <strong className="text-red-400">REJECTED</strong> and removed from the active public list, but preserved in the registry for audit.
            </p>

            <div className="mb-4 space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Select Statutory Grounds *
              </label>
              <select
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-red-500"
              >
                <option value="">-- Choose Regulatory Reason --</option>
                {STATUTORY_REJECTION_REASONS.map((r, i) => (
                  <option key={i} value={r}>{r}</option>
                ))}
                <option value="other">Other Statutory Ground (Specify Below)</option>
              </select>

              {rejectionReason === "other" && (
                <textarea
                  value={customReasonText}
                  onChange={(e) => setCustomReasonText(e.target.value)}
                  placeholder="Enter explicit statutory rationale for denial..."
                  rows={3}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500 mt-2"
                />
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowRejectModal(false)}
                disabled={submittingDecision}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectEvent}
                disabled={submittingDecision || (!rejectionReason || (rejectionReason === "other" && !customReasonText.trim()))}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1.5 transition disabled:opacity-50"
              >
                {submittingDecision ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Recording Rejection...</span>
                  </>
                ) : (
                  <span>Submit Official Rejection</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
