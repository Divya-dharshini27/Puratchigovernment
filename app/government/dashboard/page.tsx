"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Building2, Search, Filter, Calendar, MapPin, 
  Users, CheckCircle2, XCircle, Clock, AlertTriangle, 
  FileText, RefreshCw, Eye, Download, ShieldCheck, 
  Layers, Landmark, ArrowUpRight, UserCheck, ShieldAlert, 
  Check, AlertCircle, HelpCircle, History, ExternalLink 
} from "lucide-react";
import { createClient } from "../../../lib/supabase/client";
import { 
  EventItem, AdminProfile, INDIAN_STATES, TN_DISTRICTS, 
  AdminAuditLog, EventInfoRequest 
} from "../../../lib/types";
import AdminNavbar from "../../components/AdminNavbar";
import EventDossierModal from "../../components/EventDossierModal";
import AuditTrailModal from "../../components/AuditTrailModal";
import AuthorityManagementModal from "../../components/AuthorityManagementModal";

export default function GovernmentDashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  // Auth & Profile State
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Active View Tab: Overview vs Total Log
  const [mainView, setMainView] = useState<"overview" | "total_log">("overview");

  // Events & Data State
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  // Total Log Data State
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [infoRequests, setInfoRequests] = useState<EventInfoRequest[]>([]);
  const [loadingTotalLog, setLoadingTotalLog] = useState(false);

  // Jurisdiction Filter State
  const [selectedState, setSelectedState] = useState<string>("All");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("All");

  // Query & Filter Controls
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Modals
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [showDossierModal, setShowDossierModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showAuthorityModal, setShowAuthorityModal] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // 1. Authenticate & Verify Government Role
  useEffect(() => {
    async function verifyAndLoad() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          router.replace("/government/login");
          return;
        }

        let adminProf: AdminProfile | null = null;

        // 1. Try DB profile fetch
        try {
          const { data: userProfile } = await supabase
            .from("profiles")
            .select("*")
            .eq("auth_user_id", session.user.id)
            .maybeSingle();

          if (userProfile) {
            if (userProfile.role === "authority") {
              router.replace("/authority/dashboard");
              return;
            }

            if (userProfile.role !== "government") {
              await supabase.auth.signOut();
              setAuthError("ACCESS DENIED: Citizen and Host accounts are not authorized to view the Government Console.");
              setLoadingProfile(false);
              return;
            }

            adminProf = {
              ...userProfile,
              role: "government"
            };
          }
        } catch (dbErr) {
          console.warn("DB profile lookup warning, using session metadata:", dbErr);
        }

        // 2. Fallback to session metadata
        if (!adminProf) {
          const metaRole = session.user.user_metadata?.role;
          if (metaRole === "authority") {
            router.replace("/authority/dashboard");
            return;
          }

          if (metaRole === "government") {
            adminProf = {
              auth_user_id: session.user.id,
              full_name: session.user.user_metadata?.full_name || session.user.email || "Government Administrator",
              email: session.user.email || "",
              role: "government",
              jurisdiction_level: session.user.user_metadata?.jurisdiction_level || "district",
              state: session.user.user_metadata?.state || "Tamil Nadu",
              district: session.user.user_metadata?.district || "Chennai",
              department: session.user.user_metadata?.department || "Department of Public Order",
              badge_number: session.user.user_metadata?.badge_number || null,
              designation: session.user.user_metadata?.designation || "Civil Administration Officer",
              can_act: false,
              is_active: true
            };
          } else {
            await supabase.auth.signOut();
            setAuthError("ACCESS DENIED: Citizen and Host accounts are not authorized to view the Government Console.");
            setLoadingProfile(false);
            return;
          }
        }

        setProfile(adminProf);

        if (adminProf.jurisdiction_level === "state" && adminProf.state) {
          setSelectedState(adminProf.state);
        } else if (adminProf.jurisdiction_level === "district") {
          if (adminProf.state) setSelectedState(adminProf.state);
          if (adminProf.district) setSelectedDistrict(adminProf.district);
        }

        await fetchGovernmentEvents(adminProf);
        await fetchTotalLogData();

      } catch (err: any) {
        console.error("Auth check error:", err);
        setAuthError(err?.message || "Authentication verification error.");
      } finally {
        setLoadingProfile(false);
      }
    }

    verifyAndLoad();
  }, [router, supabase]);

  // 2. Fetch Events within Government Scope
  const fetchGovernmentEvents = async (adminProf?: AdminProfile) => {
    setLoadingEvents(true);
    try {
      const activeProfile = adminProf || profile;
      if (!activeProfile) return;

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

      if (activeProfile.jurisdiction_level === "district" && activeProfile.district) {
        query = query.ilike("location_name", `%${activeProfile.district}%`);
      } else if (activeProfile.jurisdiction_level === "state" && activeProfile.state) {
        query = query.ilike("location_name", `%${activeProfile.state}%`);
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
      console.error("Error fetching government events:", err);
    } finally {
      setLoadingEvents(false);
    }
  };

  // 3. Fetch Total Log Data (All audit decisions & info requests)
  const fetchTotalLogData = async () => {
    setLoadingTotalLog(true);
    try {
      // 1. Fetch audit logs joined with event titles
      const { data: logsData } = await supabase
        .from("admin_audit_logs")
        .select(`
          *,
          events:event_id (
            title,
            category,
            location_name,
            place_of_assembly
          )
        `)
        .order("created_at", { ascending: false })
        .limit(200);

      if (logsData) {
        const formattedLogs = logsData.map((l: any) => ({
          ...l,
          event_title: l.events?.title || "Assembly"
        }));
        setAuditLogs(formattedLogs as AdminAuditLog[]);
      }

      // 2. Fetch info requests
      const { data: infoData } = await supabase
        .from("event_info_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (infoData) {
        setInfoRequests(infoData as EventInfoRequest[]);
      }

    } catch (err) {
      console.error("Error loading total log telemetry:", err);
    } finally {
      setLoadingTotalLog(false);
    }
  };

  // 4. Supabase Realtime Listener for instant updates
  useEffect(() => {
    const channel = supabase
      .channel("government-dashboard-events-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        () => {
          fetchGovernmentEvents();
          fetchTotalLogData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_audit_logs" },
        () => {
          fetchTotalLogData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_info_requests" },
        () => {
          fetchTotalLogData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, profile]);

  // Calculate 24-hour SLA remaining time / deadline status
  const getSLAStatus = (createdStr: string, deadlineStr?: string | null) => {
    const deadline = deadlineStr 
      ? new Date(deadlineStr).getTime() 
      : new Date(createdStr).getTime() + 24 * 60 * 60 * 1000;
    
    const diffMs = deadline - Date.now();
    if (diffMs <= 0) return { label: "SLA EXPIRED", expired: true, isUrgent: true };

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return {
      label: `${hours}h ${minutes}m left`,
      expired: false,
      isUrgent: hours < 6
    };
  };

  // Filtered Events
  const filteredEvents = events.filter((ev) => {
    const matchesSearch = 
      searchTerm === "" ||
      ev.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.purpose.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.location_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.place_of_assembly.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ev.host_name && ev.host_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (ev.qr_token && ev.qr_token.toLowerCase().includes(searchTerm.toLowerCase()));

    const isExpired = ev.status === "expired" || (ev.status === "pending" && getSLAStatus(ev.created_at, ev.approval_deadline).expired);
    const isUpcoming = ev.status === "approved" || ev.status === "upcoming" || ev.status === "ongoing";

    const matchesStatus = 
      statusFilter === "all" ? true :
      statusFilter === "pending" ? (ev.status === "pending" || ev.status === "draft") :
      statusFilter === "request_info" ? ev.status === "request_info" :
      statusFilter === "approved" ? ev.status === "approved" :
      statusFilter === "rejected" ? ev.status === "rejected" :
      statusFilter === "revoked" ? ev.status === "revoked" :
      statusFilter === "expired" ? isExpired :
      statusFilter === "upcoming" ? isUpcoming : true;

    const matchesCategory = categoryFilter === "all" || ev.category === categoryFilter;

    const matchesState = 
      selectedState === "All" || 
      ev.location_name.toLowerCase().includes(selectedState.toLowerCase());

    const matchesDistrict = 
      selectedDistrict === "All" || 
      ev.location_name.toLowerCase().includes(selectedDistrict.toLowerCase()) ||
      ev.place_of_assembly.toLowerCase().includes(selectedDistrict.toLowerCase());

    return matchesSearch && matchesStatus && matchesCategory && matchesState && matchesDistrict;
  });

  // Calculate Metrics
  const totalAssemblies = events.length;
  const pendingApprovals = events.filter(e => e.status === "pending" || e.status === "draft").length;
  const requestInfoCount = events.filter(e => e.status === "request_info").length;
  const approvedAssemblies = events.filter(e => e.status === "approved" || e.status === "upcoming" || e.status === "ongoing").length;
  const rejectedAssemblies = events.filter(e => e.status === "rejected").length;
  const revokedAssemblies = events.filter(e => e.status === "revoked").length;
  const expiredAssemblies = events.filter(e => e.status === "expired" || (e.status === "pending" && getSLAStatus(e.created_at, e.approval_deadline).expired)).length;

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
                router.replace("/government/login");
              }}
              className="w-full py-2.5 bg-slate-950 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition"
            >
              Sign Out &amp; Return to Government Login
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
        <span className="text-sm font-bold tracking-wider uppercase">Loading Government Administration Console...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fffdf7] text-slate-900 font-sans flex flex-col selection:bg-red-600/20 selection:text-red-950">
      
      {/* Top Navbar */}
      <AdminNavbar
        profile={profile}
        onOpenAuditLogs={() => setShowAuditModal(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        
        {/* Jurisdiction & Officer Banner */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-red-950 text-white shadow-xl border border-red-900/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white text-[11px] font-black uppercase tracking-wider">
                {profile?.jurisdiction_level?.toUpperCase()} JURISDICTION
              </span>
              <span className="text-xs text-amber-300 font-semibold">
                {profile?.department || "Department of Public Order"}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-slate-300 border border-slate-700">
                PERMISSION: {profile?.can_act ? "VIEW & ACT" : "VIEW OVERSIGHT"}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Civil Assembly &amp; Public Order Oversight Console
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl">
              Real-time synchronization of Authority clearances, information requests, rejection grounds, and sovereign jurisdiction governance.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Main View Switcher Buttons */}
            <button
              onClick={() => setMainView("overview")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                mainView === "overview"
                  ? "bg-red-600 text-white shadow border border-red-500"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
              }`}
            >
              <Building2 size={15} />
              <span>Assemblies Overview</span>
            </button>

            <button
              onClick={() => setMainView("total_log")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                mainView === "total_log"
                  ? "bg-red-600 text-white shadow border border-red-500"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
              }`}
            >
              <History size={15} className="text-amber-400" />
              <span>Government Total Log</span>
            </button>

            {/* Authority Administration Button */}
            <button
              onClick={() => setShowAuthorityModal(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition border border-slate-700 shadow-sm"
            >
              <ShieldCheck size={15} />
              <span>Authority Administration</span>
            </button>

            <button
              onClick={() => {
                fetchGovernmentEvents();
                fetchTotalLogData();
              }}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700 shadow-sm"
              title="Refresh Registry"
            >
              <RefreshCw size={15} className={loadingEvents || loadingTotalLog ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Intelligence & Analytics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          
          <div className="p-4 rounded-xl bg-white border-2 border-slate-200 shadow-sm">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Total Gatherings</span>
              <Building2 size={15} className="text-slate-400" />
            </div>
            <div className="text-2xl font-black text-slate-900">{totalAssemblies}</div>
            <div className="text-[10px] text-slate-500 mt-1">In authorized jurisdiction</div>
          </div>

          <div className="p-4 rounded-xl bg-white border-2 border-amber-300 shadow-sm">
            <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Pending Review</span>
              <Clock size={15} className="text-amber-600" />
            </div>
            <div className="text-2xl font-black text-amber-700">{pendingApprovals}</div>
            <div className="text-[10px] text-amber-600 font-semibold mt-1">Awaiting statutory clearance</div>
          </div>

          <div className="p-4 rounded-xl bg-white border-2 border-amber-400 shadow-sm">
            <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Info Requested</span>
              <HelpCircle size={15} className="text-amber-700" />
            </div>
            <div className="text-2xl font-black text-amber-800">{requestInfoCount}</div>
            <div className="text-[10px] text-amber-700 font-semibold mt-1">Awaiting organizer details</div>
          </div>

          <div className="p-4 rounded-xl bg-white border-2 border-emerald-300 shadow-sm">
            <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Approved</span>
              <CheckCircle2 size={15} className="text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-700">{approvedAssemblies}</div>
            <div className="text-[10px] text-emerald-600 mt-1">Published to Public</div>
          </div>

          <div className="p-4 rounded-xl bg-white border-2 border-red-200 shadow-sm">
            <div className="text-[11px] font-bold text-red-700 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Rejected</span>
              <XCircle size={15} className="text-red-600" />
            </div>
            <div className="text-2xl font-black text-red-700">{rejectedAssemblies}</div>
            <div className="text-[10px] text-red-500 mt-1">Grounds recorded in audit</div>
          </div>

          <div className="p-4 rounded-xl bg-white border-2 border-red-400 shadow-sm">
            <div className="text-[11px] font-bold text-red-900 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Revoked</span>
              <AlertTriangle size={15} className="text-red-700" />
            </div>
            <div className="text-2xl font-black text-red-900">{revokedAssemblies}</div>
            <div className="text-[10px] text-red-700 font-semibold mt-1">Emergency invalidations</div>
          </div>

          <div className="col-span-2 sm:col-span-1 p-4 rounded-xl bg-white border-2 border-slate-200 shadow-sm">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>SLA Expired</span>
              <AlertTriangle size={15} className="text-amber-600" />
            </div>
            <div className="text-2xl font-black text-red-600">{expiredAssemblies}</div>
            <div className="text-[10px] text-slate-500 mt-1">&gt; 24h statutory window</div>
          </div>

        </div>

        {/* ============================================================== */}
        {/* VIEW 1: ASSEMBLIES OVERVIEW LEDGER                             */}
        {/* ============================================================== */}
        {mainView === "overview" && (
          <div className="space-y-4">
            
            {/* Search, Hierarchy Filters & Multi-faceted Controls */}
            <div className="p-4 rounded-2xl bg-white border-2 border-amber-200/80 shadow-md space-y-3">
              
              <div className="flex flex-col md:flex-row items-center gap-3">
                
                {/* Search Input */}
                <div className="relative w-full md:flex-1">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by Assembly Title, Organizer, Ground, Token or Purpose..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-red-600 focus:bg-white transition"
                  />
                </div>

                {/* Jurisdiction Hierarchy Drill-Down (Central & State Officers) */}
                {profile?.jurisdiction_level === "central" && (
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <select
                      value={selectedState}
                      onChange={(e) => {
                        setSelectedState(e.target.value);
                        setSelectedDistrict("All");
                      }}
                      className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:border-red-600"
                    >
                      <option value="All">All States (National Scope)</option>
                      {INDIAN_STATES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>

                    <select
                      value={selectedDistrict}
                      onChange={(e) => setSelectedDistrict(e.target.value)}
                      className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:border-red-600"
                    >
                      <option value="All">All Districts</option>
                      {TN_DISTRICTS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                )}

                {profile?.jurisdiction_level === "state" && (
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="py-2 px-3 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold whitespace-nowrap">
                      State: {profile.state || "Tamil Nadu"}
                    </div>
                    <select
                      value={selectedDistrict}
                      onChange={(e) => setSelectedDistrict(e.target.value)}
                      className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:border-red-600"
                    >
                      <option value="All">All Districts in State</option>
                      {TN_DISTRICTS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                )}

                {profile?.jurisdiction_level === "district" && (
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="py-2 px-3 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold whitespace-nowrap flex items-center gap-1.5">
                      <MapPin size={13} className="text-red-600" />
                      <span>District Scope: {profile.district}</span>
                    </div>
                  </div>
                )}

              </div>

              {/* Status & Category Pills */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">Filter:</span>
                  {[
                    { id: "all", label: "All Assemblies" },
                    { id: "pending", label: "Pending Approval" },
                    { id: "request_info", label: "Info Requested" },
                    { id: "approved", label: "Approved" },
                    { id: "rejected", label: "Rejected" },
                    { id: "revoked", label: "Revoked" },
                    { id: "expired", label: "SLA Expired" }
                  ].map((st) => (
                    <button
                      key={st.id}
                      onClick={() => setStatusFilter(st.id)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                        statusFilter === st.id
                          ? "bg-slate-900 text-white shadow-sm"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                <span className="text-[11px] text-slate-500 font-medium">
                  Showing <strong className="text-slate-800">{filteredEvents.length}</strong> of {events.length} event(s)
                </span>
              </div>

            </div>

            {/* Events Registry Table */}
            <div className="bg-white rounded-2xl border-2 border-slate-200/80 shadow-md overflow-hidden">
              
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
                <div>
                  <h2 className="font-bold text-sm text-slate-900 uppercase tracking-wide">
                    Assembly Clearance &amp; Oversight Ledger
                  </h2>
                  <p className="text-xs text-slate-500">Official registry records synchronized in real-time</p>
                </div>
              </div>

              {loadingEvents ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <RefreshCw size={28} className="animate-spin text-red-600" />
                  <span className="text-xs font-semibold">Loading assemblies registry...</span>
                </div>
              ) : filteredEvents.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-500 italic">
                  No assemblies match the current filters within your authorized scope.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700 border-collapse">
                    <thead className="bg-slate-100 text-[11px] uppercase font-bold text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="p-4">Assembly / Cause</th>
                        <th className="p-4">Organizer (Host)</th>
                        <th className="p-4">Schedule</th>
                        <th className="p-4">Venue &amp; Location</th>
                        <th className="p-4">Expected Turnout</th>
                        <th className="p-4">Clearance SLA / Review</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {filteredEvents.map((event) => {
                        const sla = getSLAStatus(event.created_at, event.approval_deadline);
                        return (
                          <tr key={event.id} className="hover:bg-amber-50/40 transition">
                            
                            {/* Title & Category */}
                            <td className="p-4 max-w-xs">
                              <div className="font-bold text-slate-900 text-sm">{event.title}</div>
                              <div className="text-[11px] text-red-700 font-semibold">{event.category}</div>
                              <div className="text-[10px] text-slate-400 truncate mt-0.5">{event.purpose}</div>
                            </td>

                            {/* Organizer */}
                            <td className="p-4">
                              <div className="font-bold text-slate-900">{event.host_name}</div>
                              <div className="text-[11px] text-slate-500 font-mono">{event.host_email || "Email verified"}</div>
                            </td>

                            {/* Schedule */}
                            <td className="p-4 whitespace-nowrap">
                              <div className="font-bold text-slate-900">{event.event_date}</div>
                              <div className="text-[11px] text-slate-500">{event.start_time} - {event.end_time}</div>
                            </td>

                            {/* Venue */}
                            <td className="p-4 max-w-[200px]">
                              <div className="font-semibold text-slate-900 truncate">{event.place_of_assembly}</div>
                              <div className="text-[11px] text-slate-500 truncate">{event.location_name}</div>
                            </td>

                            {/* Turnout */}
                            <td className="p-4 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 font-bold ${
                                event.expected_attendance >= 1000 ? "text-red-700" : "text-slate-800"
                              }`}>
                                {event.expected_attendance?.toLocaleString()}
                                {event.expected_attendance >= 1000 && <AlertTriangle size={12} className="text-amber-600" />}
                              </span>
                            </td>

                            {/* SLA / Review info */}
                            <td className="p-4 whitespace-nowrap">
                              {event.status === "pending" ? (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  sla.expired ? "bg-red-100 text-red-700" : sla.isUrgent ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"
                                }`}>
                                  {sla.label}
                                </span>
                              ) : event.status === "request_info" ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                  Info Requested
                                </span>
                              ) : event.reviewed_at ? (
                                <div className="text-[11px] text-slate-500">
                                  <div>Reviewed: {new Date(event.reviewed_at).toLocaleDateString()}</div>
                                  {event.authority_notes && (
                                    <div className="text-[10px] text-slate-400 italic truncate max-w-[120px]">{event.authority_notes}</div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[11px]">N/A</span>
                              )}
                            </td>

                            {/* Status */}
                            <td className="p-4 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
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
                                {event.status === "approved" && <CheckCircle2 size={11} />}
                                {event.status === "revoked" && <AlertTriangle size={11} className="text-red-400" />}
                                {event.status === "rejected" && <XCircle size={11} />}
                                {event.status === "request_info" && <HelpCircle size={11} />}
                                {event.status === "pending" && <Clock size={11} />}
                                <span>{event.status === "request_info" ? "INFO REQ" : event.status === "revoked" ? "REVOKED" : event.status}</span>
                              </span>
                            </td>

                            {/* Action */}
                            <td className="p-4 text-right whitespace-nowrap">
                              <button
                                onClick={() => {
                                  setSelectedEvent(event);
                                  setShowDossierModal(true);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-red-700 text-white text-xs font-bold transition shadow-sm flex items-center gap-1 ml-auto"
                              >
                                <Eye size={13} />
                                <span>Inspect Dossier</span>
                              </button>
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW 2: SECTION 4 — GOVERNMENT TOTAL LOG                      */}
        {/* ============================================================== */}
        {mainView === "total_log" && (
          <div className="space-y-4">
            
            <div className="p-5 rounded-2xl bg-white border-2 border-red-900/30 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-4">
                <div>
                  <h2 className="font-black text-base text-slate-900 uppercase tracking-tight flex items-center gap-2">
                    <History size={18} className="text-red-600" />
                    <span>Government Total Log &bull; Statutory Authority Decision Trail</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Unified ledger recording every Authority decision, statutory rejection grounds, request-information dialogues, and audit history.
                  </p>
                </div>

                <button
                  onClick={() => setShowAuditModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <FileText size={14} className="text-amber-400" />
                  <span>Full Audit History Modal</span>
                </button>
              </div>

              {loadingTotalLog ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <RefreshCw size={28} className="animate-spin text-red-600" />
                  <span className="text-xs font-semibold">Aggregating Government Total Log records...</span>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 italic bg-slate-50 rounded-xl">
                  No Authority decisions or administrative actions recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs text-slate-700 border-collapse">
                    <thead className="bg-slate-950 text-[11px] uppercase font-bold text-slate-200 border-b border-slate-800">
                      <tr>
                        <th className="p-3.5">Decision Timestamp</th>
                        <th className="p-3.5">Event ID &amp; Name</th>
                        <th className="p-3.5">Decision / Action</th>
                        <th className="p-3.5">Authority Officer</th>
                        <th className="p-3.5">Jurisdiction</th>
                        <th className="p-3.5">Status Transition</th>
                        <th className="p-3.5">Grounds / Notes / Requests</th>
                        <th className="p-3.5 text-right">Inspect</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-medium">
                      {auditLogs.map((log) => {
                        const matchedEvent = events.find(e => e.id === log.event_id);
                        const matchedInfoReqs = infoRequests.filter(r => r.event_id === log.event_id);

                        return (
                          <tr key={log.id} className="hover:bg-slate-50 transition">
                            
                            {/* Timestamp */}
                            <td className="p-3.5 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                              {new Date(log.created_at).toLocaleString()}
                            </td>

                            {/* Event ID & Name */}
                            <td className="p-3.5 max-w-xs">
                              <div className="font-bold text-slate-900 text-xs truncate">
                                {log.event_title || matchedEvent?.title || "Assembly"}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono truncate">
                                ID: {log.event_id}
                              </div>
                            </td>

                            {/* Decision / Action Badge */}
                            <td className="p-3.5 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                log.action === "APPROVED" ? "bg-emerald-100 text-emerald-800 border border-emerald-300" :
                                log.action === "REJECTED" ? "bg-red-100 text-red-800 border border-red-300" :
                                log.action === "REVOKED" ? "bg-red-950 text-red-300 border border-red-600 font-black" :
                                log.action === "REQUEST_INFO" ? "bg-amber-100 text-amber-900 border border-amber-300" :
                                log.action === "QR_SCANNED" ? "bg-blue-100 text-blue-800 border border-blue-300" :
                                log.action === "DOCUMENT_ACCESSED" ? "bg-purple-100 text-purple-800 border border-purple-300" :
                                "bg-slate-100 text-slate-800"
                              }`}>
                                {log.action === "APPROVED" && <CheckCircle2 size={11} />}
                                {log.action === "REVOKED" && <AlertTriangle size={11} className="text-red-400" />}
                                {log.action === "REJECTED" && <XCircle size={11} />}
                                {log.action === "REQUEST_INFO" && <HelpCircle size={11} />}
                                <span>{log.action}</span>
                              </span>
                            </td>

                            {/* Authority */}
                            <td className="p-3.5 whitespace-nowrap">
                              <div className="font-bold text-slate-900">{log.performer_name}</div>
                              <div className="text-[10px] text-slate-500 uppercase">{log.role}</div>
                            </td>

                            {/* Jurisdiction */}
                            <td className="p-3.5 whitespace-nowrap text-slate-700">
                              {log.jurisdiction}
                            </td>

                            {/* Status Transition */}
                            <td className="p-3.5 whitespace-nowrap text-[11px]">
                              <span className="font-semibold text-slate-500">{log.previous_status || "n/a"}</span>
                              <span className="mx-1 text-slate-400">&rarr;</span>
                              <span className="font-bold text-slate-900">{log.new_status || log.action}</span>
                            </td>

                            {/* Grounds / Reason / Info history */}
                            <td className="p-3.5 max-w-sm text-xs">
                              {log.rejection_reason && (
                                <div className="text-red-700 font-semibold">
                                  <span className="text-[10px] uppercase font-bold block text-red-500">Rejection Ground:</span>
                                  {log.rejection_reason}
                                </div>
                              )}
                              {log.authority_notes && !log.rejection_reason && (
                                <div className="text-slate-700 italic">
                                  {log.authority_notes}
                                </div>
                              )}
                              {matchedInfoReqs.length > 0 && (
                                <div className="mt-1 text-[10px] text-amber-800 font-semibold">
                                  &bull; {matchedInfoReqs.length} Information Request Query(s) logged
                                </div>
                              )}
                            </td>

                            {/* Inspect Action */}
                            <td className="p-3.5 text-right whitespace-nowrap">
                              {matchedEvent ? (
                                <button
                                  onClick={() => {
                                    setSelectedEvent(matchedEvent);
                                    setShowDossierModal(true);
                                  }}
                                  className="px-2.5 py-1 rounded bg-slate-900 hover:bg-red-700 text-white text-[11px] font-bold transition flex items-center gap-1 ml-auto"
                                >
                                  <Eye size={12} />
                                  <span>Dossier</span>
                                </button>
                              ) : (
                                <span className="text-slate-400 text-[10px]">Archived</span>
                              )}
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}

      </main>

      {/* Event Dossier Modal (Inspection View) */}
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
          fetchTotalLogData();
        }}
      />

      {/* Authority Management Modal */}
      <AuthorityManagementModal
        isOpen={showAuthorityModal}
        currentUser={profile}
        onClose={() => setShowAuthorityModal(false)}
      />

      {/* Full Audit Trail Modal */}
      <AuditTrailModal
        isOpen={showAuditModal}
        currentUser={profile}
        onClose={() => setShowAuditModal(false)}
      />

    </div>
  );
}
