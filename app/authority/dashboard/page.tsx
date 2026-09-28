"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ShieldCheck, QrCode, Clock, CheckCircle2, XCircle, 
  AlertTriangle, Calendar, MapPin, Users, FileText, 
  RefreshCw, Eye, Search, AlertCircle, Sparkles, ExternalLink, 
  HelpCircle 
} from "lucide-react";
import { createClient } from "../../../lib/supabase/client";
import { EventItem, AdminProfile } from "../../../lib/types";
import AdminNavbar from "../../components/AdminNavbar";
import QRScannerModal from "../../components/QRScannerModal";
import EventDossierModal from "../../components/EventDossierModal";
import AuditTrailModal from "../../components/AuditTrailModal";

export default function AuthorityDashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  // Auth & Profile State
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Events Data
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<"pending" | "request_info" | "approved" | "rejected" | "revoked" | "expired" | "all">("pending");
  const [searchTerm, setSearchTerm] = useState("");

  // Modals
  const [showQRModal, setShowQRModal] = useState(false);
  const [showDossierModal, setShowDossierModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);

  const [authError, setAuthError] = useState<string | null>(null);

  // 1. Verify Authority Role & Load Profile
  useEffect(() => {
    async function verifyAndLoad() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          router.replace("/authority/login");
          return;
        }

        let authProf: AdminProfile | null = null;

        // 1. Try DB profile fetch
        try {
          const { data: userProfile } = await supabase
            .from("profiles")
            .select("*")
            .eq("auth_user_id", session.user.id)
            .maybeSingle();

          if (userProfile) {
            if (userProfile.role === "government") {
              router.replace("/government/dashboard");
              return;
            }

            if (userProfile.role !== "authority") {
              await supabase.auth.signOut();
              setAuthError("ACCESS DENIED: Citizen and Host accounts are not authorized to view the Statutory Authority Console.");
              setLoadingProfile(false);
              return;
            }

            authProf = {
              ...userProfile,
              role: "authority"
            };
          }
        } catch (dbErr) {
          console.warn("DB profile lookup warning, using session metadata:", dbErr);
        }

        // 2. Fallback to session metadata
        if (!authProf) {
          const metaRole = session.user.user_metadata?.role;
          if (metaRole === "government") {
            router.replace("/government/dashboard");
            return;
          }

          if (metaRole === "authority") {
            authProf = {
              auth_user_id: session.user.id,
              full_name: session.user.user_metadata?.full_name || session.user.email || "Statutory Authority Officer",
              email: session.user.email || "",
              role: "authority",
              jurisdiction_level: "district",
              state: session.user.user_metadata?.state || "Tamil Nadu",
              district: session.user.user_metadata?.district || "Chennai",
              department: session.user.user_metadata?.department || "City Police Commissionerate",
              badge_number: session.user.user_metadata?.badge_number || null,
              designation: session.user.user_metadata?.designation || "Assistant Commissioner of Police",
              can_act: true,
              is_active: true
            };
          } else {
            await supabase.auth.signOut();
            setAuthError("ACCESS DENIED: Citizen and Host accounts are not authorized to view the Statutory Authority Console.");
            setLoadingProfile(false);
            return;
          }
        }

        setProfile(authProf);
        await fetchAuthorityEvents(authProf);

      } catch (err: any) {
        console.error("Auth check error:", err);
        setAuthError(err?.message || "Authentication verification error.");
      } finally {
        setLoadingProfile(false);
      }
    }

    verifyAndLoad();
  }, [router, supabase]);

  // 2. Fetch Events for Assigned Jurisdiction
  const fetchAuthorityEvents = async (authProf?: AdminProfile) => {
    setLoadingEvents(true);
    try {
      const activeProf = authProf || profile;
      if (!activeProf) return;

      let query = supabase
        .from("events")
        .select(`
          *,
          profiles:host_id (
            full_name,
            email,
            phone
          )
        `)
        .order("created_at", { ascending: false });

      // Scope to assigned jurisdiction (district or state)
      if (activeProf.district) {
        query = query.ilike("location_name", `%${activeProf.district}%`);
      } else if (activeProf.state) {
        query = query.ilike("location_name", `%${activeProf.state}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data) {
        const formatted: EventItem[] = data.map((ev: any) => ({
          ...ev,
          host_name: ev.profiles?.full_name || "Verified Host Organizer",
          host_email: ev.profiles?.email || "",
          host_phone: ev.profiles?.phone || ""
        }));
        setEvents(formatted);
      }
    } catch (err) {
      console.error("Error fetching authority events:", err);
    } finally {
      setLoadingEvents(false);
    }
  };

  // 3. Supabase Realtime Listener
  useEffect(() => {
    const channel = supabase
      .channel("authority-dashboard-events-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        () => {
          fetchAuthorityEvents();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_audit_logs" },
        () => {
          fetchAuthorityEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, profile]);

  // Handle Event Scanned from QR code
  const handleEventScanned = (scannedEvent: EventItem) => {
    setSelectedEvent(scannedEvent);
    setShowDossierModal(true);
  };

  // Calculate 24-hour SLA remaining time
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

  // Filtered Events
  const filteredEvents = events.filter((ev) => {
    const sla = getRemainingTime(ev.approval_deadline, ev.created_at);
    const isExpired = ev.status === "expired" || (ev.status === "pending" && sla.expired);

    const matchesTab = 
      activeTab === "all" ? true :
      activeTab === "pending" ? (ev.status === "pending" || ev.status === "draft") :
      activeTab === "request_info" ? ev.status === "request_info" :
      activeTab === "approved" ? ev.status === "approved" :
      activeTab === "rejected" ? ev.status === "rejected" :
      activeTab === "revoked" ? ev.status === "revoked" :
      activeTab === "expired" ? isExpired : true;

    const matchesSearch = 
      searchTerm === "" ||
      ev.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.purpose.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.location_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.place_of_assembly.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ev.host_name && ev.host_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (ev.qr_token && ev.qr_token.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesTab && matchesSearch;
  });

  const pendingCount = events.filter(e => e.status === "pending" || e.status === "draft").length;
  const requestInfoCount = events.filter(e => e.status === "request_info").length;
  const approvedCount = events.filter(e => e.status === "approved" || e.status === "upcoming" || e.status === "ongoing").length;
  const rejectedCount = events.filter(e => e.status === "rejected").length;
  const revokedCount = events.filter(e => e.status === "revoked").length;
  const expiredCount = events.filter(e => e.status === "expired" || (e.status === "pending" && getRemainingTime(e.approval_deadline, e.created_at).expired)).length;

  if (authError) {
    return (
      <div className="min-h-screen bg-[#fffdf7] text-slate-900 flex flex-col justify-center items-center px-4">
        <div className="max-w-md w-full bg-white p-6 sm:p-8 rounded-2xl border-2 border-red-900/30 shadow-2xl text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-xl bg-red-100 text-red-700 grid place-items-center">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-lg font-black text-slate-900">Access Verification</h2>
          <p className="text-xs text-slate-600 leading-relaxed">{authError}</p>
          <div className="pt-2">
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.replace("/authority/login");
              }}
              className="w-full py-2.5 bg-slate-950 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition"
            >
              Sign Out &amp; Return to Authority Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loadingProfile) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-200">
        <RefreshCw size={32} className="animate-spin text-red-500 mb-3" />
        <span className="text-sm font-bold tracking-wider uppercase">Loading Statutory Authority Console...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fffdf7] text-slate-900 font-sans flex flex-col selection:bg-red-600/20 selection:text-red-950">
      
      {/* Top Navbar */}
      <AdminNavbar
        profile={profile}
        onOpenQRScanner={() => setShowQRModal(true)}
        onOpenAuditLogs={() => setShowAuditModal(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        
        {/* Authority Command Center Banner */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-red-950 via-slate-950 to-slate-900 text-white shadow-xl border border-red-800/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white text-[11px] font-black uppercase tracking-wider">
                STATUTORY ENFORCEMENT &amp; CLEARANCE
              </span>
              <span className="text-xs text-amber-300 font-semibold">
                {profile?.department || "City Police Commissionerate"}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Assembly Licensing &amp; Statutory Clearance Bureau
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl">
              Jurisdiction Station: <strong className="text-white">{profile?.district || "Chennai"} Division</strong>. Reviewing assembly applications, verifying private permit documents, scanning QR passes, and recording 3-way statutory actions.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Prominent QR Scanner CTA */}
            <button
              onClick={() => setShowQRModal(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold text-xs flex items-center gap-2 transition shadow-lg border border-red-500 active:scale-95"
            >
              <QrCode size={18} />
              <span>Scan Event QR</span>
            </button>

            <button
              onClick={() => fetchAuthorityEvents()}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition border border-slate-700 shadow-sm"
              title="Refresh Registry"
            >
              <RefreshCw size={16} className={loadingEvents ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Priority SLA Warning Banner if Pending Reviews Exist */}
        {pendingCount > 0 && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950 to-slate-950 border-2 border-amber-500/70 text-amber-200 text-xs flex items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                <Clock size={20} />
              </div>
              <div>
                <span className="font-bold text-sm text-white block">
                  {pendingCount} Pending Assembly Application{pendingCount > 1 ? "s" : ""} Require Statutory Review
                </span>
                <span className="text-[11px] text-amber-300/80">
                  Statutory SLA: 24-hour review window from submission time. Review dossiers promptly.
                </span>
              </div>
            </div>

            <button
              onClick={() => setActiveTab("pending")}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shrink-0"
            >
              View Queue
            </button>
          </div>
        )}

        {/* Tabs & Search Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          
          {/* Status Tabs */}
          <div className="flex flex-wrap p-1 rounded-xl bg-slate-200/80 border border-slate-300 w-full sm:w-auto text-xs font-bold gap-1">
            <button
              onClick={() => setActiveTab("pending")}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition ${
                activeTab === "pending"
                  ? "bg-amber-600 text-white shadow"
                  : "text-slate-700 hover:text-slate-900"
              }`}
            >
              <Clock size={14} />
              <span>Pending ({pendingCount})</span>
            </button>

            <button
              onClick={() => setActiveTab("request_info")}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition ${
                activeTab === "request_info"
                  ? "bg-amber-700 text-white shadow"
                  : "text-slate-700 hover:text-slate-900"
              }`}
            >
              <HelpCircle size={14} />
              <span>Info Requested ({requestInfoCount})</span>
            </button>

            <button
              onClick={() => setActiveTab("approved")}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition ${
                activeTab === "approved"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-700 hover:text-slate-900"
              }`}
            >
              <CheckCircle2 size={14} />
              <span>Approved ({approvedCount})</span>
            </button>

            <button
              onClick={() => setActiveTab("rejected")}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition ${
                activeTab === "rejected"
                  ? "bg-red-700 text-white shadow"
                  : "text-slate-700 hover:text-slate-900"
              }`}
            >
              <XCircle size={14} />
              <span>Rejected ({rejectedCount})</span>
            </button>

            <button
              onClick={() => setActiveTab("revoked")}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition ${
                activeTab === "revoked"
                  ? "bg-red-950 text-red-200 border border-red-600 shadow"
                  : "text-slate-700 hover:text-slate-900"
              }`}
            >
              <AlertTriangle size={14} className="text-red-500" />
              <span>Revoked ({revokedCount})</span>
            </button>

            <button
              onClick={() => setActiveTab("expired")}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition ${
                activeTab === "expired"
                  ? "bg-purple-700 text-white shadow"
                  : "text-slate-700 hover:text-slate-900"
              }`}
            >
              <Clock size={14} />
              <span>Expired ({expiredCount})</span>
            </button>

            <button
              onClick={() => setActiveTab("all")}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition ${
                activeTab === "all"
                  ? "bg-slate-900 text-white shadow"
                  : "text-slate-700 hover:text-slate-900"
              }`}
            >
              <span>All ({events.length})</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search station queue or token..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-red-600 shadow-sm"
            />
          </div>

        </div>

        {/* Priority Action Cards (Queue Highlight) */}
        {loadingEvents ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
            <RefreshCw size={28} className="animate-spin text-red-600" />
            <span className="text-xs font-semibold">Loading jurisdiction assembly applications...</span>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-500 italic bg-white rounded-2xl border border-slate-200">
            No assemblies found matching the current tab criteria for {profile?.district || "your jurisdiction"}.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredEvents.map((event) => {
              const sla = getRemainingTime(event.approval_deadline, event.created_at);
              const isPending = event.status === "pending" || event.status === "draft";
              const isInfoRequested = event.status === "request_info";

              return (
                <div 
                  key={event.id}
                  className={`rounded-2xl border-2 bg-white shadow-md p-5 flex flex-col justify-between transition hover:shadow-lg ${
                    isPending && sla.isUrgent
                      ? "border-red-500 ring-2 ring-red-500/20"
                      : isInfoRequested
                      ? "border-amber-400 bg-amber-50/20"
                      : isPending
                      ? "border-amber-300"
                      : "border-slate-200"
                  }`}
                >
                  <div>
                    {/* Top Row: Category & Status */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-bold text-red-700 uppercase tracking-wide">
                        {event.category}
                      </span>

                      <div className="flex items-center gap-2">
                        {/* 24h SLA Countdown Timer for Pending Events */}
                        {isPending && (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            sla.isUrgent
                              ? "bg-red-100 text-red-800 border border-red-300 animate-pulse"
                              : "bg-amber-100 text-amber-900 border border-amber-300"
                          }`}>
                            <Clock size={11} />
                            <span>{sla.label}</span>
                          </span>
                        )}

                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          event.status === "approved"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : event.status === "revoked"
                            ? "bg-red-950 text-red-300 border border-red-600 font-black animate-pulse"
                            : event.status === "rejected"
                            ? "bg-red-100 text-red-800 border border-red-300"
                            : event.status === "request_info"
                            ? "bg-amber-100 text-amber-900 border border-amber-400"
                            : "bg-amber-100 text-amber-900 border border-amber-300"
                        }`}>
                          {event.status === "request_info" ? "INFO REQUESTED" : event.status === "revoked" ? "REVOKED" : event.status}
                        </span>
                      </div>
                    </div>

                    {/* Assembly Title & Purpose */}
                    <h3 className="text-base font-black text-slate-900 mb-1 leading-snug">
                      {event.title}
                    </h3>
                    <p className="text-xs text-slate-600 mb-4 line-clamp-2">
                      {event.purpose}
                    </p>

                    {/* Assembly Logistics Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-1.5 truncate">
                        <Calendar size={13} className="text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-800">{event.event_date}</span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <Clock size={13} className="text-slate-400 shrink-0" />
                        <span>{event.start_time} - {event.end_time}</span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin size={13} className="text-red-500 shrink-0" />
                        <span className="truncate">{event.place_of_assembly}</span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <Users size={13} className="text-slate-400 shrink-0" />
                        <span className="font-semibold">{event.expected_attendance?.toLocaleString()} attendees</span>
                      </div>
                    </div>

                    {/* Host Information */}
                    <div className="text-[11px] text-slate-500 mb-4">
                      Host Organizer: <strong className="text-slate-800">{event.host_name}</strong> &bull; Contact: <span className="font-mono">{event.host_email || "Verified"}</span>
                      {event.qr_token && (
                        <div className="text-[10px] font-mono text-amber-700 mt-0.5">
                          Pass Token: {event.qr_token}
                        </div>
                      )}
                    </div>

                    {/* Revoked Notice Banner */}
                    {event.status === "revoked" && (
                      <div className="mb-4 p-2.5 rounded-lg bg-red-950 text-red-200 border border-red-700 text-[11px] space-y-1">
                        <strong className="text-red-300 block uppercase text-[10px] font-black">🚨 Statutory Verification Revoked:</strong>
                        <span>{event.rejection_reason || "Revoked by statutory emergency order."}</span>
                        {event.authority_notes && (
                          <div className="text-[10px] text-amber-300 mt-1">{event.authority_notes}</div>
                        )}
                      </div>
                    )}

                    {/* Authority Decision Notes if Already Decided or Request Info */}
                    {event.status === "request_info" && event.authority_notes && (
                      <div className="mb-4 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
                        <strong>Pending Host Response:</strong> {event.authority_notes}
                      </div>
                    )}

                    {event.status === "approved" && event.authority_notes && (
                      <div className="mb-4 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px]">
                        <strong>Authority Directives:</strong> {event.authority_notes}
                      </div>
                    )}

                    {event.status === "rejected" && event.rejection_reason && (
                      <div className="mb-4 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-[11px]">
                        <strong>Statutory Denial Grounds:</strong> {event.rejection_reason}
                      </div>
                    )}
                  </div>

                  {/* Review Action Toolbar */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono text-slate-400">
                      ID: {event.id.slice(0, 8)}...
                    </span>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/authority/events/${event.id}`}
                        className="px-3 py-1.5 rounded-xl border border-slate-300 hover:border-slate-400 text-slate-700 text-xs font-bold transition flex items-center gap-1"
                      >
                        <ExternalLink size={12} />
                        <span>Review Page</span>
                      </Link>

                      <button
                        onClick={() => {
                          setSelectedEvent(event);
                          setShowDossierModal(true);
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm ${
                          isPending || isInfoRequested
                            ? "bg-red-700 hover:bg-red-800 text-white"
                            : "bg-slate-900 hover:bg-slate-800 text-white"
                        }`}
                      >
                        <Eye size={14} />
                        <span>{isPending || isInfoRequested ? "Review & Decide" : "Inspect"}</span>
                      </button>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </main>

      {/* QR Scanner Modal */}
      <QRScannerModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        onEventScanned={handleEventScanned}
      />

      {/* Event Review & Decision Dossier Modal */}
      <EventDossierModal
        isOpen={showDossierModal}
        event={selectedEvent}
        currentUser={profile}
        onClose={() => {
          setShowDossierModal(false);
          setSelectedEvent(null);
        }}
        onEventUpdated={(updated) => {
          setEvents(events.map(e => e.id === updated.id ? updated : e));
          setSelectedEvent(updated);
        }}
      />

      {/* Audit Trail Modal */}
      <AuditTrailModal
        isOpen={showAuditModal}
        currentUser={profile}
        onClose={() => setShowAuditModal(false)}
      />

    </div>
  );
}
