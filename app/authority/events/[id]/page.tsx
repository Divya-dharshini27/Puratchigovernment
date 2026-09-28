"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ShieldCheck, ArrowLeft, Calendar, MapPin, Users, 
  FileText, Clock, AlertTriangle, CheckCircle2, XCircle, 
  User, Mail, Phone, RefreshCw, Eye, Download, 
  Check, AlertCircle, HelpCircle, Send, Shield, Lock, 
  ExternalLink, Compass, ShieldAlert, BadgeCheck, FileCheck,
  ShieldX, Ban, AlertOctagon
} from "lucide-react";
import { createClient } from "../../../../lib/supabase/client";
import { 
  EventItem, EventDocument, AdminProfile, 
  STATUTORY_REJECTION_REASONS, STATUTORY_REVOCATION_REASONS,
  STANDARD_REQUIRED_DOCUMENTS, 
  AdminAuditLog, EventInfoRequest 
} from "../../../../lib/types";
import AdminNavbar from "../../../components/AdminNavbar";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function AuthorityEventReviewPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const eventId = resolvedParams.id;

  const router = useRouter();
  const supabase = createClient();

  // Auth & Profile
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Event Data
  const [event, setEvent] = useState<EventItem | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [documents, setDocuments] = useState<EventDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [infoRequests, setInfoRequests] = useState<EventInfoRequest[]>([]);

  // Decision States
  const [authorityNotes, setAuthorityNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [customReasonText, setCustomReasonText] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [selectedRequiredDocs, setSelectedRequiredDocs] = useState<string[]>([]);

  // UI Active Modals / Forms
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showRequestInfoForm, setShowRequestInfoForm] = useState(false);
  const [showRevokeForm, setShowRevokeForm] = useState(false);
  const [revocationReason, setRevocationReason] = useState("");
  const [customRevocationReason, setCustomRevocationReason] = useState("");
  const [revocationDirectives, setRevocationDirectives] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  // 1. Authenticate Authority
  useEffect(() => {
    async function checkAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          router.replace(`/authority/login?redirect=/authority/events/${eventId}`);
          return;
        }

        const { data: userProfile, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("auth_user_id", session.user.id)
          .maybeSingle();

        const role = userProfile?.role || session.user.user_metadata?.role;
        if (role !== "authority" && role !== "government") {
          router.replace("/authority/login");
          return;
        }

        const officerProf: AdminProfile = {
          auth_user_id: session.user.id,
          full_name: userProfile?.full_name || session.user.user_metadata?.full_name || "Statutory Officer",
          email: session.user.email || "",
          role: "authority",
          district: userProfile?.district || session.user.user_metadata?.district || "Chennai",
          state: userProfile?.state || session.user.user_metadata?.state || "Tamil Nadu",
          department: userProfile?.department || session.user.user_metadata?.department || "City Police Commissionerate",
          designation: userProfile?.designation || session.user.user_metadata?.designation || "Assistant Commissioner of Police",
          badge_number: userProfile?.badge_number || session.user.user_metadata?.badge_number || null,
          jurisdiction_level: userProfile?.jurisdiction_level || session.user.user_metadata?.jurisdiction_level || "district"
        };

        setProfile(officerProf);
      } catch (err) {
        console.error("Auth error:", err);
        router.replace("/authority/login");
      } finally {
        setLoadingProfile(false);
      }
    }
    checkAuth();
  }, [router, supabase, eventId]);

  // 2. Fetch Event, Documents, Audit Logs & Info Requests
  useEffect(() => {
    if (!eventId) return;

    async function loadEventData() {
      setLoadingEvent(true);
      try {
        // Fetch event with host profile
        const { data: eventData, error } = await supabase
          .from("events")
          .select(`
            *,
            profiles:host_id (
              full_name,
              email,
              phone
            )
          `)
          .eq("id", eventId)
          .maybeSingle();

        if (error) throw error;
        if (!eventData) {
          setFeedbackError(`No assembly record found for ID: ${eventId}`);
          return;
        }

        const formatted: EventItem = {
          ...eventData,
          host_name: eventData.profiles?.full_name || "Verified Organizer",
          host_email: eventData.profiles?.email || "",
          host_phone: eventData.profiles?.phone || ""
        };
        setEvent(formatted);

        // Fetch private permit documents, audit trail, info requests
        fetchDocuments(eventId);
        fetchAuditLogs(eventId);
        fetchInfoRequests(eventId);

      } catch (err: any) {
        console.error("Error loading event:", err);
        setFeedbackError(err.message || "Failed to load event details.");
      } finally {
        setLoadingEvent(false);
      }
    }

    loadEventData();
  }, [eventId, supabase]);

  // Realtime updates
  useEffect(() => {
    if (!eventId) return;

    const channel = supabase
      .channel(`authority-event-detail-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events", filter: `id=eq.${eventId}` },
        (payload: any) => {
          if (payload.new) {
            setEvent(prev => prev ? { ...prev, ...payload.new } : null);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_audit_logs", filter: `event_id=eq.${eventId}` },
        () => {
          fetchAuditLogs(eventId);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_info_requests", filter: `event_id=eq.${eventId}` },
        () => {
          fetchInfoRequests(eventId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, supabase]);

  // Fetch Documents via signed URLs
  const fetchDocuments = async (id: string) => {
    setLoadingDocs(true);
    try {
      const { data: docsData, error } = await supabase
        .from("event_documents")
        .select("*")
        .eq("event_id", id)
        .order("uploaded_at", { ascending: false });

      if (!error && docsData) {
        const docsWithUrls = await Promise.all(
          docsData.map(async (doc) => {
            try {
              const res = await fetch("/api/documents/signed-url", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  filePath: doc.file_path,
                  eventId: id,
                  documentName: doc.document_name,
                  documentId: doc.id
                })
              });
              const resData = await res.json();
              return { ...doc, signed_url: resData.signedUrl || null };
            } catch {
              return doc;
            }
          })
        );
        setDocuments(docsWithUrls);
      }
    } catch (err) {
      console.error("Error loading docs:", err);
    } finally {
      setLoadingDocs(false);
    }
  };

  const fetchAuditLogs = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from("admin_audit_logs")
        .select("*")
        .eq("event_id", id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setAuditLogs(data as AdminAuditLog[]);
      }
    } catch (err) {
      console.error("Error loading audit logs:", err);
    }
  };

  const fetchInfoRequests = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from("event_info_requests")
        .select("*")
        .eq("event_id", id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setInfoRequests(data as EventInfoRequest[]);
      }
    } catch (err) {
      console.warn("Error fetching info requests:", err);
    }
  };

  const handleDocumentAccess = async (doc: EventDocument) => {
    try {
      await fetch("/api/authority/log-document-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          documentName: doc.document_name,
          documentId: doc.id
        })
      });
      fetchAuditLogs(eventId);
    } catch (err) {
      console.warn("Failed to log document access:", err);
    }
  };

  // 3. Authority Approval
  const handleApprove = async () => {
    if (!event || !profile) return;
    setSubmitting(true);
    setFeedbackError(null);

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
        throw new Error(res.message || "Failed to record approval decision.");
      }

      setFeedbackSuccess("Assembly successfully APPROVED. Public listings and Host portal updated in real-time.");
      setEvent(prev => prev ? { ...prev, status: "approved", authority_notes: authorityNotes.trim() } : null);
      setShowApproveConfirm(false);
      await fetchAuditLogs(event.id);

    } catch (err: any) {
      console.error("Approval error:", err);
      setFeedbackError(err.message || "Failed to record approval decision.");
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Authority Request Information
  const handleRequestInfo = async () => {
    if (!event || !profile) return;
    if (!requestMessage.trim()) {
      setFeedbackError("Please specify the clarification or document required.");
      return;
    }

    setSubmitting(true);
    setFeedbackError(null);

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

      setFeedbackSuccess("Information request sent to host organizer. Event remains unapproved.");
      setEvent(prev => prev ? { ...prev, status: "request_info", authority_notes: `Information Requested: ${requestMessage.trim()}` } : null);
      setShowRequestInfoForm(false);
      await fetchAuditLogs(event.id);
      await fetchInfoRequests(event.id);

    } catch (err: any) {
      console.error("Request info error:", err);
      setFeedbackError(err.message || "Failed to send request.");
    } finally {
      setSubmitting(false);
    }
  };

  // 5. Authority Rejection
  const handleReject = async () => {
    if (!event || !profile) return;
    const finalReason = rejectionReason === "other" ? customReasonText.trim() : rejectionReason.trim();

    if (!finalReason) {
      setFeedbackError("A mandatory statutory rejection reason is required.");
      return;
    }

    setSubmitting(true);
    setFeedbackError(null);

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

      setFeedbackSuccess("Assembly has been REJECTED. Grounds recorded in permanent audit history.");
      setEvent(prev => prev ? { ...prev, status: "rejected", rejection_reason: finalReason } : null);
      setShowRejectForm(false);
      await fetchAuditLogs(event.id);

    } catch (err: any) {
      console.error("Rejection error:", err);
      setFeedbackError(err.message || "Failed to record rejection decision.");
    } finally {
      setSubmitting(false);
    }
  };

  // 6. Authority Emergency Revocation / Unverify (Surge & Safety Hazards)
  const handleRevoke = async () => {
    if (!event || !profile) return;
    const finalReason = revocationReason === "other" ? customRevocationReason.trim() : revocationReason.trim();

    if (!finalReason) {
      setFeedbackError("A mandatory statutory emergency reason is required to revoke assembly verification.");
      return;
    }

    setSubmitting(true);
    setFeedbackError(null);

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
        throw new Error(res.message || "Failed to record emergency revocation.");
      }

      setFeedbackSuccess("🚨 EMERGENCY REVOCATION ENFORCED: Assembly verification revoked and QR pass invalidated immediately.");
      setEvent(prev => prev ? { 
        ...prev, 
        status: "revoked", 
        qr_status: "revoked",
        rejection_reason: finalReason,
        authority_notes: revocationDirectives.trim() ? `EMERGENCY REVOCATION DIRECTIVES: ${revocationDirectives.trim()}` : `EMERGENCY REVOCATION: ${finalReason}`
      } : null);
      setShowRevokeForm(false);
      await fetchAuditLogs(event.id);

    } catch (err: any) {
      console.error("Revocation error:", err);
      setFeedbackError(err.message || "Failed to record emergency revocation.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleDocRequirement = (docName: string) => {
    setSelectedRequiredDocs(prev => 
      prev.includes(docName) 
        ? prev.filter(d => d !== docName)
        : [...prev, docName]
    );
  };

  // Remaining SLA Calculation
  const getRemainingTime = (deadlineStr?: string | null, createdStr?: string) => {
    const deadline = deadlineStr 
      ? new Date(deadlineStr).getTime() 
      : new Date(createdStr || Date.now()).getTime() + 24 * 60 * 60 * 1000;
    
    const diffMs = deadline - Date.now();
    if (diffMs <= 0) return { label: "SLA EXPIRED", isUrgent: true, expired: true };

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    return {
      label: `${hours}h ${minutes}m left`,
      isUrgent: hours < 6,
      expired: false
    };
  };

  if (loadingProfile || loadingEvent) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-200">
        <RefreshCw size={32} className="animate-spin text-red-500 mb-3" />
        <span className="text-xs font-bold tracking-wider uppercase">Loading Official Assembly Dossier...</span>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-[#fffdf7] text-slate-900 flex flex-col">
        <AdminNavbar profile={profile} />
        <div className="flex-1 max-w-xl mx-auto px-4 py-16 text-center space-y-4">
          <AlertCircle size={48} className="text-red-600 mx-auto" />
          <h1 className="text-xl font-black">Assembly Record Not Found</h1>
          <p className="text-xs text-slate-600">The requested Event ID [{eventId}] does not exist in the official database.</p>
          <Link
            href="/authority/dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-950 text-white rounded-lg text-xs font-bold"
          >
            <ArrowLeft size={14} />
            <span>Return to Authority Console</span>
          </Link>
        </div>
      </div>
    );
  }

  const isPending = event.status === "pending" || event.status === "draft" || event.status === "request_info";
  const sla = getRemainingTime(event.approval_deadline, event.created_at);

  // Jurisdiction check
  const eventLocation = `${event.location_name || ""} ${event.place_of_assembly || ""}`;
  const officerDistrict = profile?.district;
  const isStatewide = !officerDistrict || 
    officerDistrict.toLowerCase().includes("statewide") || 
    officerDistrict.toLowerCase().includes("tamil nadu") ||
    profile?.jurisdiction_level === "state" ||
    profile?.role === "government";

  const isJurisdictionMatch = isStatewide || 
    (officerDistrict && eventLocation.toLowerCase().includes(officerDistrict.toLowerCase())) ||
    (officerDistrict && event.district && event.district.toLowerCase() === officerDistrict.toLowerCase());

  return (
    <div className="min-h-screen bg-[#fffdf7] text-slate-900 font-sans flex flex-col selection:bg-red-600/20 selection:text-red-950">
      
      {/* Top Navbar */}
      <AdminNavbar profile={profile} />

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        
        {/* Navigation Breadcrumb & Quick Badges */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Link
            href="/authority/dashboard"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-950 transition"
          >
            <ArrowLeft size={15} />
            <span>Back to Authority Clearance Queue</span>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            {/* Jurisdiction Badge */}
            <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
              isJurisdictionMatch 
                ? "bg-emerald-100 text-emerald-800 border border-emerald-300" 
                : "bg-amber-100 text-amber-900 border border-amber-400"
            }`}>
              <Compass size={13} />
              <span>{isJurisdictionMatch ? "Jurisdiction Authorized" : "Out-of-District (Read-Only)"}</span>
            </span>

            {/* SLA Status Badge */}
            {isPending && (
              <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                sla.isUrgent 
                  ? "bg-red-100 text-red-800 border border-red-300 animate-pulse" 
                  : "bg-amber-100 text-amber-900 border border-amber-300"
              }`}>
                <Clock size={13} />
                <span>SLA: {sla.label}</span>
              </span>
            )}

            {/* Event Status Badge */}
            <span className={`px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
              event.status === "approved"
                ? "bg-emerald-600 text-white shadow-sm"
                : event.status === "revoked"
                ? "bg-red-950 text-red-300 border-2 border-red-600 shadow-md animate-pulse"
                : event.status === "rejected"
                ? "bg-red-700 text-white shadow-sm"
                : event.status === "request_info"
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-slate-800 text-white"
            }`}>
              STATUS: {event.status === "request_info" ? "INFO REQUESTED" : event.status === "revoked" ? "VERIFICATION REVOKED" : event.status.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Emergency Revocation Alert Banner */}
        {event.status === "revoked" && (
          <div className="p-5 rounded-2xl bg-red-950/90 border-2 border-red-600 text-red-100 shadow-2xl space-y-3 animate-in fade-in">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-red-600/20 text-red-400 border border-red-500/30 shrink-0 mt-0.5">
                <ShieldX size={24} />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-black uppercase tracking-widest text-red-400 block">
                  STATUTORY EMERGENCY ENFORCEMENT NOTICE
                </span>
                <h2 className="text-lg font-black text-white">
                  Assembly Verification Revoked / Clearance Invalidated
                </h2>
                <p className="text-xs text-red-200 leading-relaxed">
                  Official clearance for this assembly has been <strong>REVOKED</strong> by statutory authorities due to crowd capacity limits breach or safety emergency. All field QR passes are immediately invalidated.
                </p>
              </div>
            </div>

            {event.rejection_reason && (
              <div className="p-3 bg-black/50 rounded-xl border border-red-800 text-xs">
                <strong className="text-red-300 block uppercase text-[10px] font-black mb-0.5">Statutory Grounds for Revocation:</strong>
                <span className="text-slate-100">{event.rejection_reason}</span>
              </div>
            )}

            {event.authority_notes && (
              <div className="p-3 bg-black/50 rounded-xl border border-red-800 text-xs">
                <strong className="text-amber-300 block uppercase text-[10px] font-black mb-0.5">Authority Directives &amp; Field Instructions:</strong>
                <span className="text-slate-100">{event.authority_notes}</span>
              </div>
            )}
          </div>
        )}

        {/* Alerts */}
        {feedbackSuccess && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2.5 shadow-sm">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <span>{feedbackSuccess}</span>
          </div>
        )}

        {feedbackError && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium flex items-center gap-2.5 shadow-sm">
            <AlertCircle size={18} className="text-red-600 shrink-0" />
            <span>{feedbackError}</span>
          </div>
        )}

        {/* Out of Jurisdiction Warning */}
        {!isJurisdictionMatch && (
          <div className="p-4 rounded-xl bg-amber-950 border-2 border-amber-500 text-amber-200 text-xs flex items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-2.5">
              <ShieldAlert size={20} className="text-amber-400 shrink-0" />
              <div>
                <strong className="block text-white font-black uppercase text-[11px]">Jurisdiction Notice</strong>
                <span>This assembly belongs to another district boundary. Review actions are restricted to assigned territorial officers.</span>
              </div>
            </div>
            <span className="text-[10px] font-mono bg-amber-900 px-2.5 py-1 rounded text-amber-100 shrink-0">
              Station: {profile?.district}
            </span>
          </div>
        )}

        {/* 12-FIELD COMPREHENSIVE ASSEMBLY DOSSIER CARD */}
        <div className="bg-slate-900 text-white rounded-2xl border-2 border-red-900/80 shadow-2xl p-6 sm:p-8 space-y-6">
          
          {/* FIELD 1, 2, 10, 11: Header & Regulatory Metadata */}
          <div className="border-b border-slate-800 pb-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                <ShieldCheck size={16} />
                <span>Field 2 &bull; Category: {event.category}</span>
              </div>

              {event.qr_token && (
                <span className="text-xs font-mono bg-amber-950/80 border border-amber-700/80 text-amber-300 px-2.5 py-0.5 rounded-md font-semibold">
                  Pass Token: {event.qr_token}
                </span>
              )}
            </div>

            {/* Field 1: Event Name */}
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {event.title}
            </h1>

            <p className="text-xs text-slate-400 font-mono mt-1">
              System ID: {event.id} &bull; Registration Submitted: {new Date(event.created_at).toLocaleString()}
            </p>
          </div>

          {/* KEY FIELDS GRID (Fields 5, 6, 7, 12) */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* Field 5: Date & Schedule */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
                <Calendar size={14} className="text-red-400" />
                <span>Field 5: Schedule</span>
              </div>
              <div className="font-black text-white text-sm">{event.event_date}</div>
              <div className="text-xs text-amber-400 font-mono">{event.start_time} - {event.end_time}</div>
            </div>

            {/* Field 6: Location & Coordinates */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 md:col-span-2">
              <div className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
                <MapPin size={14} className="text-red-400" />
                <span>Field 6: Assembly Venue &amp; Coordinates</span>
              </div>
              <div className="font-black text-white text-sm truncate">{event.location_name}</div>
              <div className="text-xs text-slate-300 truncate">{event.place_of_assembly}</div>
              {(event.latitude || event.longitude) && (
                <div className="text-[10px] font-mono text-slate-400">
                  GPS: {event.latitude?.toFixed(4)}, {event.longitude?.toFixed(4)}
                </div>
              )}
            </div>

            {/* Field 7: Expected Attendance & Age Scope */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
                <Users size={14} className="text-red-400" />
                <span>Field 7: Attendance</span>
              </div>
              <div className="font-black text-amber-400 text-lg">
                {event.expected_attendance.toLocaleString()} Citizens
              </div>
              <div className="text-[10px] text-slate-400">
                Age: {event.min_age || 18}+ {event.max_age ? `to ${event.max_age}` : "years"}
              </div>
            </div>

          </div>

          {/* FIELDS 3 & 4: Statement of Purpose & Description */}
          <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Field 3 &bull; Statement of Public Purpose
              </span>
              <p className="text-sm font-semibold text-slate-100 mt-1">{event.purpose}</p>
            </div>
            
            <div className="pt-3 border-t border-slate-800/80">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Field 4 &bull; Detailed Assembly Description &amp; Logistics
              </span>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed whitespace-pre-wrap">{event.description}</p>
            </div>

            {event.route_details && (
              <div className="pt-3 border-t border-slate-800/80">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                  Route &amp; March Trajectory Details
                </span>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">{event.route_details}</p>
              </div>
            )}
          </div>

          {/* FIELD 8: Host Organizer & Government Details */}
          <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <User size={14} className="text-red-400" />
              <span>Field 8: Host Organizer &amp; Reviewing Officer Credentials</span>
            </span>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Host Organizer */}
              <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Verified Host Organizer</span>
                  <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                    <BadgeCheck size={12} /> KYC Verified
                  </span>
                </div>
                <div className="font-bold text-white text-sm">{event.host_name}</div>
                <div className="text-slate-300 flex items-center gap-1.5">
                  <Mail size={12} className="text-slate-500" />
                  <span className="font-mono">{event.host_email || "organizer@domain.gov"}</span>
                </div>
                {event.host_phone && (
                  <div className="text-slate-300 flex items-center gap-1.5">
                    <Phone size={12} className="text-slate-500" />
                    <span className="font-mono">{event.host_phone}</span>
                  </div>
                )}
              </div>

              {/* Authority Officer */}
              <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Reviewing Authority Officer</span>
                  <span className="text-[10px] text-amber-400 font-bold">Statutory Officer</span>
                </div>
                <div className="font-bold text-white text-sm">{profile?.full_name}</div>
                <div className="text-slate-300 font-mono text-[11px]">
                  {profile?.designation || "Assistant Commissioner"} &bull; {profile?.department}
                </div>
                <div className="text-amber-300 text-[11px]">
                  Station: {profile?.district || "Tamil Nadu"} Jurisdiction
                </div>
              </div>
            </div>
          </div>

          {/* FIELD 9: Private Submitted Supporting Documents */}
          <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <FileText size={15} className="text-red-400" />
                <span>Field 9: Supporting Regulatory Documents ({documents.length})</span>
              </span>
              <span className="text-[10px] font-bold text-amber-400 bg-amber-950/60 border border-amber-800 px-2 py-0.5 rounded flex items-center gap-1">
                <Lock size={10} /> SECURE PRIVATE STORAGE
              </span>
            </div>

            {loadingDocs ? (
              <div className="py-4 text-center text-xs text-slate-400">Loading private documents...</div>
            ) : documents.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-500 italic">No official documents uploaded by organizer.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {documents.map((doc) => (
                  <div key={doc.id} className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                    <div className="truncate mr-2">
                      <p className="font-semibold text-white truncate flex items-center gap-1">
                        <FileCheck size={13} className="text-red-400 shrink-0" />
                        <span className="truncate">{doc.document_name}</span>
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB • ` : ""}
                        Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}
                      </p>
                    </div>

                    {doc.signed_url ? (
                      <a
                        href={doc.signed_url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => handleDocumentAccess(doc)}
                        className="px-2.5 py-1 rounded bg-red-700 hover:bg-red-800 text-white font-bold text-[11px] flex items-center gap-1 shrink-0 transition shadow"
                      >
                        <Eye size={12} />
                        <span>Inspect</span>
                      </a>
                    ) : (
                      <span className="text-[10px] text-slate-500">Restricted</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info Requests Thread */}
          {infoRequests.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/60 space-y-2 text-xs">
              <span className="font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1">
                <HelpCircle size={14} />
                <span>Information Request Thread ({infoRequests.length})</span>
              </span>
              <div className="space-y-2 pt-1">
                {infoRequests.map((req) => (
                  <div key={req.id} className="p-3 rounded-lg bg-slate-950 border border-amber-900/40 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <strong className="text-amber-200">Query from {req.officer_name}</strong>
                      <span className="font-mono">{new Date(req.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-200">{req.request_message}</p>
                    {req.required_documents && req.required_documents.length > 0 && (
                      <div className="text-[11px] text-amber-300/90 font-mono">
                        Required docs: {req.required_documents.join(", ")}
                      </div>
                    )}
                    {req.host_response && (
                      <div className="mt-2 p-2.5 rounded bg-slate-900 border border-slate-700 text-xs">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase block">Host Response:</span>
                        <p className="text-slate-200 mt-0.5">{req.host_response}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audit Trail Clearance History */}
          {auditLogs.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <span className="font-bold uppercase tracking-wider text-slate-400">Statutory Clearance History</span>
              <div className="space-y-2 pt-1 max-h-60 overflow-y-auto">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 flex items-start justify-between">
                    <div>
                      <div className="font-bold text-white flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          log.action === "APPROVED" ? "bg-emerald-950 text-emerald-300" :
                          log.action === "REJECTED" ? "bg-red-950 text-red-300" :
                          log.action === "REVOKED" ? "bg-red-950 text-red-300 border border-red-700 font-bold" :
                          log.action === "REQUEST_INFO" ? "bg-amber-950 text-amber-300" :
                          log.action === "QR_SCANNED" ? "bg-blue-950 text-blue-300" :
                          "bg-slate-800 text-slate-300"
                        }`}>
                          {log.action}
                        </span>
                        <span className="text-slate-400 font-normal">by {log.performer_name}</span>
                      </div>
                      {log.rejection_reason && (
                        <p className="text-red-400 text-[11px] mt-0.5">Grounds: {log.rejection_reason}</p>
                      )}
                      {log.authority_notes && (
                        <p className="text-slate-300 text-[11px] mt-0.5">Notes: {log.authority_notes}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 shrink-0 font-mono">{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3-WAY DECISION ACTIONS TERMINAL & EMERGENCY REVOCATION */}
          {isJurisdictionMatch && (
            <div className="pt-4 border-t border-slate-800 space-y-4">
              
              {/* Actions for Pending Assemblies */}
              {isPending && !showRejectForm && !showApproveConfirm && !showRequestInfoForm && !showRevokeForm && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* 1. REJECT */}
                  <button
                    onClick={() => setShowRejectForm(true)}
                    className="py-3 rounded-xl bg-red-800 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer"
                  >
                    <XCircle size={16} />
                    <span>Reject Assembly</span>
                  </button>

                  {/* 2. REQUEST INFO */}
                  <button
                    onClick={() => setShowRequestInfoForm(true)}
                    className="py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer"
                  >
                    <HelpCircle size={16} />
                    <span>Request Information</span>
                  </button>

                  {/* 3. APPROVE */}
                  <button
                    onClick={() => setShowApproveConfirm(true)}
                    className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer"
                  >
                    <CheckCircle2 size={16} />
                    <span>Approve Clearance</span>
                  </button>
                </div>
              )}

              {/* Emergency Action for Already Approved / Active Assemblies */}
              {(event.status === "approved" || event.status === "upcoming" || event.status === "ongoing") && !showRevokeForm && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-red-950/80 via-slate-950 to-slate-950 border-2 border-red-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                      <AlertTriangle size={13} />
                      <span>ON-GROUND CROWD SAFETY &amp; SURGE CONTROL</span>
                    </span>
                    <h4 className="text-sm font-black text-white">
                      Assembly Currently Verified &amp; Cleared
                    </h4>
                    <p className="text-xs text-slate-300">
                      If crowd capacity limits are breached or on-ground safety hazards arise, you can immediately unverify and revoke clearance.
                    </p>
                  </div>

                  <button
                    onClick={() => setShowRevokeForm(true)}
                    className="px-4 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-white font-black text-xs uppercase tracking-wider shadow-lg border border-red-500 flex items-center gap-2 transition shrink-0 active:scale-95 cursor-pointer"
                  >
                    <ShieldX size={16} />
                    <span>Emergency Revoke Verification</span>
                  </button>
                </div>
              )}

              {/* Emergency Revoke Form */}
              {showRevokeForm && (
                <div className="p-5 rounded-xl bg-red-950/90 border-2 border-red-600 space-y-4 animate-in fade-in shadow-2xl">
                  <div className="flex items-center gap-2 text-red-300">
                    <ShieldX size={22} className="text-red-400 shrink-0" />
                    <div>
                      <h3 className="font-black text-sm text-white uppercase tracking-wide">
                        Emergency Revocation &amp; Pass Invalidation
                      </h3>
                      <p className="text-xs text-red-200 mt-0.5">
                        Revoking clearance will immediately set status to <strong className="text-white">REVOKED</strong>, invalidate QR passes on all check terminals, and notify organizer &amp; field units.
                      </p>
                    </div>
                  </div>

                  {/* Reason Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-2 uppercase tracking-wider">
                      Statutory Emergency Grounds *
                    </label>
                    <div className="space-y-1.5">
                      {STATUTORY_REVOCATION_REASONS.map((r) => (
                        <label key={r} className="flex items-start gap-2 text-xs text-slate-200 p-2 rounded-lg bg-slate-900/80 hover:bg-slate-900 cursor-pointer border border-red-900/40">
                          <input
                            type="radio"
                            name="revocationReason"
                            value={r}
                            checked={revocationReason === r}
                            onChange={() => setRevocationReason(r)}
                            className="mt-0.5 accent-red-600"
                          />
                          <span>{r}</span>
                        </label>
                      ))}
                      <label className="flex items-start gap-2 text-xs text-slate-200 p-2 rounded-lg bg-slate-900/80 hover:bg-slate-900 cursor-pointer border border-red-900/40">
                        <input
                          type="radio"
                          name="revocationReason"
                          value="other"
                          checked={revocationReason === "other"}
                          onChange={() => setRevocationReason("other")}
                          className="mt-0.5 accent-red-600"
                        />
                        <span>Custom statutory emergency grounds (specify below)</span>
                      </label>
                    </div>
                  </div>

                  {revocationReason === "other" && (
                    <div>
                      <textarea
                        value={customRevocationReason}
                        onChange={(e) => setCustomRevocationReason(e.target.value)}
                        placeholder="Detail the specific safety risk, unexpected crowd surge count, or boundary violation..."
                        rows={2}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                      />
                    </div>
                  )}

                  {/* Directives */}
                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1 uppercase tracking-wider">
                      Emergency Directives / Dispersal Instructions (Optional):
                    </label>
                    <textarea
                      value={revocationDirectives}
                      onChange={(e) => setRevocationDirectives(e.target.value)}
                      placeholder="e.g. Order immediate dispersal towards South gate; notify Traffic Police Division 4 to redirect incoming crowds."
                      rows={2}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-red-900/80">
                    <button
                      type="button"
                      onClick={() => setShowRevokeForm(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={submitting || (!revocationReason && !customRevocationReason)}
                      onClick={handleRevoke}
                      className="px-5 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-xs font-black text-white flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-lg"
                    >
                      {submitting ? <RefreshCw size={14} className="animate-spin" /> : <ShieldX size={14} />}
                      <span>Enforce Emergency Revocation</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Approve Form */}
              {showApproveConfirm && (
                <div className="p-5 rounded-xl bg-emerald-950/60 border border-emerald-800 space-y-3 animate-in fade-in">
                  <h3 className="font-black text-sm text-emerald-300">
                    Confirm Statutory Assembly Clearance
                  </h3>
                  <p className="text-xs text-slate-300">
                    Approving this assembly will broadcast official clearance to the Public Discovery Portal and Host Organizer console.
                  </p>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">
                      Authority Directives / Mandatory Conditions (Optional):
                    </label>
                    <textarea
                      value={authorityNotes}
                      onChange={(e) => setAuthorityNotes(e.target.value)}
                      placeholder="e.g. Standard traffic diversion along North Avenue; mandatory 20 volunteer marshals on site."
                      rows={2}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowApproveConfirm(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleApprove}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-xs font-black text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                      <span>Confirm Statutory Approval</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Request Info Form */}
              {showRequestInfoForm && (
                <div className="p-5 rounded-xl bg-amber-950/60 border border-amber-800 space-y-3 animate-in fade-in">
                  <h3 className="font-black text-sm text-amber-300">
                    Request Clarifications / Documents from Organizer
                  </h3>
                  <p className="text-xs text-slate-300">
                    The assembly will remain <strong>NOT APPROVED</strong>. The host will receive the request to submit clarifications.
                  </p>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">
                      Information Required *
                    </label>
                    <textarea
                      value={requestMessage}
                      onChange={(e) => setRequestMessage(e.target.value)}
                      placeholder="Specify the exact documentation, crowd management clarifications, or route modifications required..."
                      rows={3}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5">
                      Required Documents (Optional):
                    </label>
                    <div className="space-y-1">
                      {STANDARD_REQUIRED_DOCUMENTS.map((doc) => (
                        <label key={doc} className="flex items-center gap-2 text-xs text-slate-200 p-1.5 rounded bg-slate-900 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedRequiredDocs.includes(doc)}
                            onChange={() => toggleDocRequirement(doc)}
                            className="accent-amber-500 rounded"
                          />
                          <span>{doc}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowRequestInfoForm(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={submitting || !requestMessage.trim()}
                      onClick={handleRequestInfo}
                      className="px-5 py-2 bg-amber-600 hover:bg-amber-700 rounded-lg text-xs font-black text-slate-950 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                      <span>Submit Request</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Reject Form */}
              {showRejectForm && (
                <div className="p-5 rounded-xl bg-red-950/60 border border-red-800 space-y-3 animate-in fade-in">
                  <h3 className="font-black text-sm text-red-300">
                    Statutory Grounds for Assembly Rejection
                  </h3>
                  <p className="text-xs text-slate-300">
                    Select a mandatory regulatory reason as required by assembly oversight statutes:
                  </p>

                  <div className="space-y-1.5">
                    {STATUTORY_REJECTION_REASONS.map((r) => (
                      <label key={r} className="flex items-start gap-2 text-xs text-slate-200 p-2 rounded bg-slate-900/80 hover:bg-slate-900 cursor-pointer">
                        <input
                          type="radio"
                          name="rejectionReason"
                          value={r}
                          checked={rejectionReason === r}
                          onChange={() => setRejectionReason(r)}
                          className="mt-0.5 accent-red-600"
                        />
                        <span>{r}</span>
                      </label>
                    ))}
                    <label className="flex items-start gap-2 text-xs text-slate-200 p-2 rounded bg-slate-900/80 hover:bg-slate-900 cursor-pointer">
                      <input
                        type="radio"
                        name="rejectionReason"
                        value="other"
                        checked={rejectionReason === "other"}
                        onChange={() => setRejectionReason("other")}
                        className="mt-0.5 accent-red-600"
                      />
                      <span>Custom statutory grounds (specify below)</span>
                    </label>
                  </div>

                  {rejectionReason === "other" && (
                    <textarea
                      value={customReasonText}
                      onChange={(e) => setCustomReasonText(e.target.value)}
                      placeholder="Specify detailed statutory grounds for denial..."
                      rows={3}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                    />
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowRejectForm(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={submitting || (!rejectionReason && !customReasonText)}
                      onClick={handleReject}
                      className="px-5 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-xs font-black text-white flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      {submitting ? <RefreshCw size={14} className="animate-spin" /> : <XCircle size={14} />}
                      <span>Enforce Rejection</span>
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

      </main>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-slate-500 bg-white border-t border-slate-200 mt-12">
        PURATCHI Statutory Clearance Bureau &bull; Official Assembly Dossier Terminal
      </footer>

    </div>
  );
}
