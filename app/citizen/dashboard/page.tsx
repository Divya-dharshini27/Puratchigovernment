"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Megaphone, LogOut, Calendar, MapPin, CheckCircle2, Clock,
  User, RefreshCw, X, Download, QrCode, Search, Heart, Share2,
  AlertCircle, ShieldCheck, ArrowRight, MessageSquare, Upload, Check, Sparkles, Eye, Info,
  Camera, Newspaper, Bell, ExternalLink
} from "lucide-react";
import confetti from "canvas-confetti";
import { createClient } from "../../../lib/supabase/client";
import { usePortalNavigation } from "../../components/GlobalPageTransition";

export interface CitizenProfile {
  full_name: string;
  email: string;
  phone?: string;
  role: string;
}

export interface PublicEventItem {
  id: string;
  host_id: string;
  title: string;
  category: string;
  purpose: string;
  description: string;
  event_date: string;
  start_time: string;
  end_time: string;
  location_name: string;
  place_of_assembly: string;
  latitude?: number;
  longitude?: number;
  expected_attendance: number;
  min_age?: number;
  max_age?: number;
  additional_criteria?: string;
  route_details?: string;
  equipment_details?: string;
  jurisdiction_requirements?: string;
  whatsapp_group_link?: string;
  status: string;
  created_at: string;
  host_name?: string;
  host_email?: string;
}

const VOLUNTEER_ROLES_LIST = [
  "Safety Volunteer",
  "First-Aid / Medical Support Volunteer",
  "Emergency Assistance Volunteer",
  "Camera Crew",
  "Journalist / Reporter",
  "Logistics Volunteer"
];

export interface MyApplicationItem {
  id: string;
  event_id: string;
  event_title: string;
  event_date: string;
  event_status?: string;
  selected_roles: string[];
  status: "pending" | "approved" | "rejected";
  whatsapp_group_link?: string;
  created_at: string;
}

export default function CitizenDashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<CitizenProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<PublicEventItem[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<PublicEventItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Page Transition State
  const [transitionActive, setTransitionActive] = useState(false);

  // Event Details Modal State
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Volunteer Modal State
  const [showVolunteerModal, setShowVolunteerModal] = useState(false);
  const [volunteerRoles, setVolunteerRoles] = useState<string[]>([]);
  const [applicantAge, setApplicantAge] = useState<number>(20);
  const [motivationNotes, setMotivationNotes] = useState("");
  const [volunteerSubmitting, setVolunteerSubmitting] = useState(false);
  const [volunteerError, setVolunteerError] = useState<string | null>(null);

  // Celebratory Submission Feedback Modal State
  const [showCelebratoryModal, setShowCelebratoryModal] = useState(false);
  const [submittedEventTitle, setSubmittedEventTitle] = useState("");

  // My Volunteer Applications State
  const [myApplications, setMyApplications] = useState<MyApplicationItem[]>([]);
  const [statusNotification, setStatusNotification] = useState<{ message: string; type: "approved" | "rejected" } | null>(null);

  // Auth Guard & Role Verification
  useEffect(() => {
    async function initCitizenDashboard() {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/citizen/login");
        return;
      }

      // Query profiles table for role
      let { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, email, phone, role")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();

      if (!profileData) {
        const fullName = session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Active Citizen";
        const email = session.user.email || "";
        await supabase.from("profiles").upsert({
          auth_user_id: session.user.id,
          full_name: fullName,
          email: email,
          role: "citizen",
          language: "English"
        }, { onConflict: "auth_user_id" });

        profileData = { full_name: fullName, email: email, phone: null, role: "citizen" };
      }

      const userRole = profileData?.role || session.user.user_metadata?.role;

      // STRICT PROTECTION GUARD: Do not allow Host, Government, or Authority users on Citizen Dashboard
      if (userRole !== "citizen") {
        await supabase.auth.signOut();
        router.replace("/citizen/login");
        return;
      }

      setProfile({
        full_name: profileData?.full_name || session.user.user_metadata?.full_name || "Active Citizen",
        email: profileData?.email || session.user.email || "",
        phone: profileData?.phone,
        role: "citizen"
      });

      // Fetch public assemblies
      await fetchApprovedPublicEvents();

      // Fetch citizen's own volunteer applications
      await fetchMyApplications(session.user.id);

      setLoading(false);
    }

    initCitizenDashboard();
  }, [router, supabase]);

  const fetchApprovedPublicEvents = async () => {
    const { data: eventsData, error } = await supabase
      .from("events")
      .select("*")
      .in("status", ["approved", "upcoming", "ongoing"])
      .order("created_at", { ascending: false });

    if (!error && eventsData) {
      // Fetch host profiles for complete info
      const hostIds = Array.from(new Set(eventsData.map((e: any) => e.host_id)));
      const { data: hostsData } = await supabase
        .from("profiles")
        .select("auth_user_id, full_name, email")
        .in("auth_user_id", hostIds);

      const hostMap = new Map((hostsData || []).map((h: any) => [h.auth_user_id, h]));

      const enrichedEvents = eventsData.map((e: any) => ({
        ...e,
        host_name: hostMap.get(e.host_id)?.full_name || "Verified Host Organizer",
        host_email: hostMap.get(e.host_id)?.email || "host@assembly.org"
      }));

      setEvents(enrichedEvents as PublicEventItem[]);
    }
  };

  // Realtime Live Synchronization for Approved Events
  useEffect(() => {
    const channel = supabase
      .channel("citizen-public-events-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        () => {
          fetchApprovedPublicEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // Fetch my volunteer applications with event info
  const fetchMyApplications = async (uid: string) => {
    const { data, error } = await supabase
      .from("volunteer_applications")
      .select("id, event_id, selected_roles, status, created_at, events(id, title, event_date, status, whatsapp_group_link)")
      .eq("applicant_id", uid)
      .order("created_at", { ascending: false });

    if (!error && data) {
      const formatted: MyApplicationItem[] = data.map((a: any) => ({
        id: a.id,
        event_id: a.event_id,
        event_title: a.events?.title || "Unknown Assembly",
        event_date: a.events?.event_date || "",
        event_status: a.events?.status,
        selected_roles: a.selected_roles || [],
        status: a.status,
        whatsapp_group_link: a.events?.whatsapp_group_link || undefined,
        created_at: a.created_at
      }));
      setMyApplications(formatted);
    }
  };

  // Subscribe to real-time volunteer application status changes
  useEffect(() => {
    let channel: any;

    async function subscribeToApplicationStatus() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      channel = supabase
        .channel("citizen-applications-status")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "volunteer_applications",
            filter: `applicant_id=eq.${session.user.id}`
          },
          (payload: any) => {
            const updated = payload.new;
            if (updated.status === "approved" || updated.status === "rejected") {
              setStatusNotification({
                message: updated.status === "approved"
                  ? "🎉 Your volunteer application has been ACCEPTED by the Host!"
                  : "Your volunteer application has been reviewed and was not selected this time.",
                type: updated.status
              });
            }
            // Refresh applications list
            setMyApplications(prev => prev.map(a =>
              a.id === updated.id ? { ...a, status: updated.status } : a
            ));
          }
        )
        .subscribe();
    }

    subscribeToApplicationStatus();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase]);

  const { navigateTo } = usePortalNavigation();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigateTo("/citizen/login");
  };

  // Toggle Volunteer Role Selection (MAXIMUM 2 ROLES)
  const handleRoleToggle = (role: string) => {
    if (volunteerRoles.includes(role)) {
      setVolunteerRoles(volunteerRoles.filter(r => r !== role));
    } else {
      if (volunteerRoles.length >= 2) {
        setVolunteerError("Maximum 2 volunteer roles allowed per application.");
        return;
      }
      setVolunteerError(null);
      setVolunteerRoles([...volunteerRoles, role]);
    }
  };

  // Submit Volunteer Application with Criteria Checking & Confetti
  const handleApplyVolunteer = async (e: React.FormEvent) => {
    e.preventDefault();
    setVolunteerError(null);

    if (!selectedEvent) return;

    if (volunteerRoles.length === 0) {
      setVolunteerError("Please select at least 1 volunteer role (maximum 2).");
      return;
    }

    if (volunteerRoles.length > 2) {
      setVolunteerError("You can select a maximum of 2 volunteer roles.");
      return;
    }

    // Criteria Validation Check (Age)
    const minAgeRequired = selectedEvent.min_age || 18;
    const maxAgeLimit = selectedEvent.max_age;

    if (applicantAge < minAgeRequired) {
      setVolunteerError(`Age Criterion Error: This event requires volunteers to be at least ${minAgeRequired} years old.`);
      return;
    }

    if (maxAgeLimit && applicantAge > maxAgeLimit) {
      setVolunteerError(`Age Criterion Error: Maximum age limit for this event is ${maxAgeLimit} years.`);
      return;
    }

    setVolunteerSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Citizen session expired. Please sign in again.");

      // 0. Ensure citizen profile exists in public.profiles to satisfy Foreign Key constraint (volunteer_applications_applicant_id_fkey)
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();

      if (!existingProfile) {
        await supabase.from("profiles").upsert({
          auth_user_id: session.user.id,
          full_name: session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Citizen Volunteer",
          email: session.user.email || "",
          role: "citizen",
          language: "English"
        }, { onConflict: "auth_user_id" });
      }

      const notesWithAge = motivationNotes.trim()
        ? `[Age: ${applicantAge}] ${motivationNotes.trim()}`
        : `[Age: ${applicantAge}]`;

      const { error } = await supabase.from("volunteer_applications").insert({
        event_id: selectedEvent.id,
        applicant_id: session.user.id,
        selected_roles: volunteerRoles,
        motivation_notes: notesWithAge,
        status: "pending"
      });

      if (error) {
        if (error.code === "23505") {
          throw new Error("You have already submitted a volunteer application for this assembly.");
        }
        throw new Error(error.message);
      }

      // Close application modal & reset form
      setShowVolunteerModal(false);
      setSubmittedEventTitle(selectedEvent.title);
      setVolunteerRoles([]);
      setMotivationNotes("");

      // Refresh my applications list so the new pending application appears immediately
      await fetchMyApplications(session.user.id);

      // Trigger 1-2s celebratory confetti/poppers burst
      triggerCelebratoryConfetti();

      // Show Celebratory Application Submitted Modal
      setShowCelebratoryModal(true);

    } catch (err: any) {
      setVolunteerError(err.message || "Failed to submit volunteer application.");
    } finally {
      setVolunteerSubmitting(false);
    }
  };

  // Celebratory Confetti Animation Handler
  const triggerCelebratoryConfetti = () => {
    const colors = ["#DC2626", "#F59E0B", "#10B981", "#FFFFFF", "#F43F5E"];

    confetti({
      particleCount: 95,
      spread: 75,
      origin: { y: 0.55 },
      colors,
      disableForReducedMotion: true,
      zIndex: 9999,
    });

    setTimeout(() => {
      confetti({
        particleCount: 40,
        angle: 60,
        spread: 55,
        origin: { x: 0.15, y: 0.6 },
        colors,
        disableForReducedMotion: true,
        zIndex: 9999,
      });
      confetti({
        particleCount: 40,
        angle: 120,
        spread: 55,
        origin: { x: 0.85, y: 0.6 },
        colors,
        disableForReducedMotion: true,
        zIndex: 9999,
      });
    }, 150);
  };

  const openEventDetails = (ev: PublicEventItem) => {
    setSelectedEvent(ev);
    setShowDetailsModal(true);
  };

  const openVolunteerFlow = (ev: PublicEventItem) => {
    setSelectedEvent(ev);
    setVolunteerError(null);
    setVolunteerRoles([]);
    setShowVolunteerModal(true);
  };

  const filteredEvents = events.filter((ev) => {
    const matchesSearch =
      ev.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.location_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.place_of_assembly.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      categoryFilter === "all" || ev.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fffdf7] grid place-items-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw size={32} className="animate-spin text-red-700" />
          <p className="text-xs font-black uppercase tracking-wider text-slate-700">Connecting to Citizen Portal...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#fffdf7] text-slate-900 font-sans flex flex-col justify-between selection:bg-red-600/20 selection:text-red-950">
      
      {/* Sticky Header Navbar */}
      <header className="sticky top-0 z-40 w-full bg-red-950 border-b border-red-800 text-white shadow-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-red-600 text-white font-black text-sm shadow">
              P
            </div>
            <span className="font-black text-lg tracking-wider uppercase text-white">
              PURATCHI
            </span>
          </Link>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/60 border border-emerald-700/80 text-emerald-200 text-xs font-black uppercase tracking-wider">
              <Megaphone size={14} className="text-emerald-400" /> Citizen Suite
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-amber-100">
              <User size={16} className="text-red-400" />
              <span className="max-w-[120px] sm:max-w-[180px] truncate">{profile?.full_name}</span>
            </div>

            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-900/80 hover:bg-red-800 border border-red-700 text-xs font-black uppercase tracking-wider text-white transition cursor-pointer"
            >
              <LogOut size={14} /> <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">
        
        {/* Welcome Banner */}
        <div className="rounded-2xl border-2 border-amber-200/80 bg-gradient-to-r from-red-950 via-slate-900 to-red-950 p-6 sm:p-8 text-white shadow-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-black uppercase tracking-wider mb-2">
            VERIFIED PUBLIC CITIZEN DASHBOARD
          </div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">
            Welcome, {profile?.full_name}
          </h1>
          <p className="mt-1 text-xs sm:text-sm font-medium text-slate-300 max-w-2xl">
            Explore transparent public assembly permits, inspect complete event details & criteria, apply to volunteer for civic causes (max 2 roles), and track verified updates.
          </p>

          <div className="mt-6 pt-4 border-t border-red-900/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-red-900/40 border border-red-800/80 rounded-xl p-3 flex items-center gap-3">
              <Search size={20} className="text-amber-300 flex-shrink-0" />
              <div>
                <div className="font-black text-white uppercase text-[11px]">DISCOVER ASSEMBLIES</div>
                <div className="text-[10px] text-slate-300">View real-time verified gatherings</div>
              </div>
            </div>

            <div className="bg-amber-950/40 border border-amber-800/80 rounded-xl p-3 flex items-center gap-3">
              <ShieldCheck size={20} className="text-amber-400 flex-shrink-0" />
              <div>
                <div className="font-black text-amber-200 uppercase text-[11px]">VOLUNTEER & CRITERIA</div>
                <div className="text-[10px] text-amber-100/70">Select up to 2 roles with criteria checks</div>
              </div>
            </div>

            <div className="bg-emerald-950/40 border border-emerald-800/80 rounded-xl p-3 flex items-center gap-3">
              <CheckCircle2 size={20} className="text-emerald-400 flex-shrink-0" />
              <div>
                <div className="font-black text-emerald-200 uppercase text-[11px]">TRANSPARENT DETAILS</div>
                <div className="text-[10px] text-emerald-100/70">Complete NOC & Host info</div>
              </div>
            </div>
          </div>
        </div>

        {/* Status Change Notification Toast */}
        {statusNotification && (
          <div className={`fixed top-20 right-4 z-[100] max-w-sm p-4 rounded-2xl shadow-2xl border-2 flex items-start gap-3 animate-pop-in ${
            statusNotification.type === "approved"
              ? "bg-emerald-50 border-emerald-400 text-emerald-900"
              : "bg-red-50 border-red-400 text-red-900"
          }`}>
            <Bell size={20} className={statusNotification.type === "approved" ? "text-emerald-600 shrink-0" : "text-red-600 shrink-0"} />
            <div className="flex-1">
              <div className="text-xs font-black uppercase tracking-wider mb-0.5">
                {statusNotification.type === "approved" ? "Application Accepted" : "Application Update"}
              </div>
              <p className="text-xs font-semibold leading-relaxed">{statusNotification.message}</p>
            </div>
            <button
              onClick={() => setStatusNotification(null)}
              className="text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* My Volunteer Applications */}
        {myApplications.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b-2 border-slate-900 pb-2">
              <Bell size={18} className="text-red-700" />
              <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">
                My Volunteer Applications ({myApplications.length})
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {myApplications.map((app) => {
                const isCameraCrew = app.selected_roles.some(r => r.toLowerCase().includes("camera"));
                const isJournalist = app.selected_roles.some(r => r.toLowerCase().includes("journalist") || r.toLowerCase().includes("reporter"));
                const isApproved = app.status === "approved";

                return (
                  <div key={app.id} className={`rounded-2xl border-2 p-5 bg-white shadow-sm flex flex-col gap-3 ${
                    app.status === "approved" ? "border-emerald-400" :
                    app.status === "rejected" ? "border-red-300" : "border-amber-300"
                  }`}>
                    {/* Event Title & Status Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-black text-slate-900 leading-snug">{app.event_title}</h3>
                      <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${
                        app.status === "approved" ? "bg-emerald-50 text-emerald-800 border-emerald-300" :
                        app.status === "rejected" ? "bg-red-50 text-red-800 border-red-300" :
                        "bg-amber-50 text-amber-800 border-amber-300"
                      }`}>
                        {app.status === "approved" ? "✓ Approved" : app.status === "rejected" ? "✗ Rejected" : "⏳ Pending"}
                      </span>
                    </div>

                    {/* Roles */}
                    <div className="flex flex-wrap gap-1.5">
                      {app.selected_roles.map(r => (
                        <span key={r} className="px-2 py-0.5 bg-blue-50 border border-blue-200 rounded text-[10px] font-black text-blue-800">{r}</span>
                      ))}
                    </div>

                    {/* Date */}
                    {app.event_date && (
                      <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                        <Calendar size={12} /> {app.event_date}
                      </p>
                    )}

                    {/* Revoked Event Notice */}
                    {app.event_status === "revoked" && (
                      <div className="p-2.5 rounded-xl bg-red-950 text-red-100 border border-red-500 text-[11px] font-semibold flex items-center gap-2">
                        <AlertCircle size={14} className="text-red-400 shrink-0" />
                        <span>Assembly verification revoked by authorities. Operations suspended.</span>
                      </div>
                    )}

                    {/* WhatsApp Link (approved volunteers only for active events) */}
                    {isApproved && app.event_status !== "revoked" && app.whatsapp_group_link && (
                      <a
                        href={app.whatsapp_group_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black uppercase tracking-wider rounded-xl transition shadow cursor-pointer"
                      >
                        <MessageSquare size={14} /> Join WhatsApp Group
                      </a>
                    )}

                    {/* Specialized portal access buttons (approved only for active events) */}
                    {isApproved && app.event_status !== "revoked" && isCameraCrew && (
                      <button
                        onClick={() => navigateTo("/citizen/camera-crew")}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#450a0a] hover:bg-red-900 text-white text-xs font-black uppercase tracking-wider rounded-xl transition shadow cursor-pointer"
                      >
                        <Camera size={14} /> Open Camera Crew Studio
                      </button>
                    )}

                    {isApproved && app.event_status !== "revoked" && isJournalist && (
                      <button
                        onClick={() => navigateTo("/citizen/journalist")}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#450a0a] hover:bg-red-900 text-white text-xs font-black uppercase tracking-wider rounded-xl transition shadow cursor-pointer"
                      >
                        <Newspaper size={14} /> Open Journalist Newsroom
                      </button>
                    )}

                    {app.status === "pending" && app.event_status !== "revoked" && (
                      <p className="text-[11px] text-amber-800 font-medium bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                        Awaiting Host review. You will be notified when the Host makes a decision.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Public Assemblies List */}
        <div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-slate-900 pb-3 mb-6">
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-red-700">PURATCHI PUBLIC PORTAL</div>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-900">
                VERIFIED PUBLIC ASSEMBLIES ({filteredEvents.length})
              </h2>
            </div>

            {/* Search & Category Filter */}
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search city, ground, title..."
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-red-600"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full sm:w-auto px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-red-600"
              >
                <option value="all">All Categories</option>
                <option value="Youth Civic Assembly">Youth Civic Assembly</option>
                <option value="Climate & Environment March">Climate & Environment March</option>
                <option value="Education Rights Forum">Education Rights Forum</option>
                <option value="Digital Safety & Tech Rights">Digital Safety & Tech Rights</option>
                <option value="Cultural & Public Gathering">Cultural & Public Gathering</option>
                <option value="Peaceful Protest / Demonstration">Peaceful Protest / Demonstration</option>
              </select>
            </div>
          </div>

          {/* Assembly Cards Grid */}
          {filteredEvents.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-amber-200 bg-white p-10 text-center">
              <Calendar size={40} className="mx-auto text-amber-400 mb-3" />
              <h3 className="text-base font-black uppercase text-slate-800">No Public Assemblies Found</h3>
              <p className="mt-1 text-xs text-slate-600 font-medium max-w-sm mx-auto">
                No active assemblies matching your search parameters.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {filteredEvents.map((ev) => (
                <article
                  key={ev.id}
                  className="rounded-2xl border-2 border-amber-200/80 bg-white p-5 shadow-sm transition hover:border-red-700 hover:shadow-md flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border inline-flex items-center gap-1 ${
                        ev.status === "approved" ? "bg-emerald-50 text-emerald-900 border-emerald-300" : "bg-amber-50 text-amber-900 border-amber-300"
                      }`}>
                        {ev.status === "approved" ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                        {ev.status === "approved" ? "Verified & Approved" : "Pending Authority Review"}
                      </span>
                      <span className="text-[11px] font-bold text-slate-500">{ev.event_date}</span>
                    </div>

                    <h3 className="text-lg font-black text-slate-900 leading-snug">{ev.title}</h3>
                    
                    <div className="mt-2 text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                      <MapPin size={14} className="text-red-700 flex-shrink-0" />
                      <span className="truncate">{ev.place_of_assembly}, {ev.location_name}</span>
                    </div>

                    <p className="mt-2 text-xs text-slate-500 font-medium line-clamp-2 leading-relaxed">
                      {ev.description}
                    </p>

                    {/* Criteria Badges Summary */}
                    <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-900 rounded text-[10px] font-mono font-bold">
                        Min Age: {ev.min_age || 18}+
                      </span>
                      {ev.max_age && (
                        <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-700 rounded text-[10px] font-mono font-bold">
                          Max Age: {ev.max_age}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => openEventDetails(ev)}
                      className="px-3 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <Eye size={14} /> Details
                    </button>

                    <button
                      onClick={() => openVolunteerFlow(ev)}
                      className="px-3.5 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer"
                    >
                      Volunteer <ArrowRight size={14} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* 1. CITIZEN — COMPLETE EVENT DETAILS MODAL */}
      {showDetailsModal && selectedEvent && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-2xl border-2 border-amber-200 shadow-2xl w-full max-w-2xl my-6 overflow-hidden animate-pop-in flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="bg-red-950 border-b border-red-800 px-6 py-4 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-200">OFFICIAL ASSEMBLY SPECIFICATIONS</span>
                <h3 className="text-xl font-black uppercase tracking-tight text-white max-w-md truncate">
                  {selectedEvent.title}
                </h3>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="grid h-8 w-8 place-items-center rounded-lg bg-red-900 text-white hover:bg-red-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5 bg-[#fffdf7]">
              
              {/* Category & Status */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <span className="px-3 py-1 bg-red-50 text-red-800 border border-red-200 rounded-lg text-xs font-black uppercase">
                  {selectedEvent.category}
                </span>
                <span className={`px-2.5 py-1 rounded text-xs font-black uppercase tracking-wider border ${
                  selectedEvent.status === "approved" ? "bg-emerald-50 text-emerald-900 border-emerald-300" : "bg-amber-50 text-amber-900 border-amber-300"
                }`}>
                  {selectedEvent.status === "approved" ? "Verified & Approved" : "Pending Review"}
                </span>
              </div>

              {/* Purpose & Description */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-1">Foundational Purpose</h4>
                <p className="text-xs text-slate-900 font-bold bg-amber-50/50 p-3 rounded-xl border border-amber-200">{selectedEvent.purpose}</p>
              </div>

              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-1">Detailed Description</h4>
                <p className="text-xs text-slate-600 font-medium leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">{selectedEvent.description}</p>
              </div>

              {/* Key Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                  <div className="font-bold text-slate-500">Date & Schedule</div>
                  <div className="font-black text-slate-900">{selectedEvent.event_date}</div>
                  <div className="text-slate-600 font-medium">{selectedEvent.start_time} - {selectedEvent.end_time}</div>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                  <div className="font-bold text-slate-500">Location & Assembly Ground</div>
                  <div className="font-black text-slate-900">{selectedEvent.place_of_assembly}</div>
                  <div className="text-slate-600 font-medium">{selectedEvent.location_name}</div>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                  <div className="font-bold text-slate-500">Expected Turnout</div>
                  <div className="font-black text-slate-900">{selectedEvent.expected_attendance.toLocaleString()} Citizens</div>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                  <div className="font-bold text-slate-500">Host Organizer Information</div>
                  <div className="font-black text-slate-900">{selectedEvent.host_name}</div>
                  <div className="text-slate-600 font-medium">{selectedEvent.host_email}</div>
                </div>
              </div>

              {/* Volunteer Criteria Specification Box */}
              <div className="p-4 rounded-xl border-2 border-amber-300 bg-amber-50/80 space-y-2">
                <div className="text-xs font-black uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                  <ShieldCheck size={16} className="text-amber-700" /> Host Configured Volunteer Criteria
                </div>
                
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2.5 py-1 bg-amber-200 border border-amber-300 rounded font-mono font-black text-amber-950">
                    Minimum Age: {selectedEvent.min_age || 18}+
                  </span>
                  {selectedEvent.max_age && (
                    <span className="px-2.5 py-1 bg-amber-200 border border-amber-300 rounded font-mono font-black text-amber-950">
                      Maximum Age: {selectedEvent.max_age}
                    </span>
                  )}
                  <span className="px-2.5 py-1 bg-amber-200 border border-amber-300 rounded font-mono font-black text-amber-950">
                    Max Roles Selectable: 2
                  </span>
                </div>

                {selectedEvent.additional_criteria && (
                  <p className="text-xs text-amber-900 font-medium pt-1">
                    <strong>Event-Specific Requirements:</strong> {selectedEvent.additional_criteria}
                  </p>
                )}
              </div>

              {/* Volunteer Roles Available */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-2">Available Volunteer Roles</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {VOLUNTEER_ROLES_LIST.map((role) => (
                    <div key={role} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" />
                      <span>{role}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-slate-100 border-t border-slate-200 px-6 py-3 flex items-center justify-between">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-200"
              >
                Close
              </button>

              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  openVolunteerFlow(selectedEvent);
                }}
                className="px-5 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow"
              >
                Apply to Volunteer <ArrowRight size={14} />
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 2. CITIZEN — VOLUNTEERING FLOW MODAL (MAXIMUM 2 ROLES + CRITERIA CHECK) */}
      {showVolunteerModal && selectedEvent && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border-2 border-amber-200 shadow-2xl w-full max-w-lg overflow-hidden animate-pop-in">
            
            <div className="bg-red-950 border-b border-red-800 px-6 py-4 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-200">VOLUNTEER APPLICATION</span>
                <h3 className="text-lg font-black uppercase text-white truncate max-w-sm">{selectedEvent.title}</h3>
              </div>
              <button
                onClick={() => setShowVolunteerModal(false)}
                className="grid h-8 w-8 place-items-center rounded-lg bg-red-900 text-white hover:bg-red-800"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleApplyVolunteer} className="p-6 space-y-4">
              
              {/* Event Criteria Overview */}
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-1">
                <div className="font-black uppercase tracking-wider text-amber-950 flex items-center gap-1">
                  <ShieldCheck size={14} className="text-amber-700" /> Host Event Volunteer Criteria:
                </div>
                <div className="font-medium text-[11px]">
                  • Minimum Age: <strong>{selectedEvent.min_age || 18}+ years</strong>
                  {selectedEvent.max_age ? ` | Maximum Age: ${selectedEvent.max_age} years` : ""}
                  <br />
                  • Role Limit: Select a <strong>maximum of 2 volunteer roles</strong>.
                </div>
              </div>

              {volunteerError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-300 text-red-800 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={16} className="text-red-600 flex-shrink-0" />
                  <span>{volunteerError}</span>
                </div>
              )}

              {/* Applicant Age Input */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                  Your Age * (Required for Host Criteria Verification)
                </label>
                <input
                  type="number"
                  required
                  min={16}
                  max={100}
                  value={applicantAge}
                  onChange={(e) => setApplicantAge(parseInt(e.target.value) || 18)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-red-600"
                />
              </div>

              {/* Select Volunteer Roles (MAX 2 ROLES) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                    Select Volunteer Roles * (Max 2 Roles)
                  </label>
                  <span className={`text-[11px] font-black uppercase px-2 py-0.5 rounded border ${
                    volunteerRoles.length === 2 ? "bg-amber-100 text-amber-900 border-amber-300" : "bg-slate-100 text-slate-700 border-slate-300"
                  }`}>
                    Selected: {volunteerRoles.length} / 2 Max
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {VOLUNTEER_ROLES_LIST.map((role) => {
                    const isChecked = volunteerRoles.includes(role);
                    const isDisabled = !isChecked && volunteerRoles.length >= 2;

                    return (
                      <label
                        key={role}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border transition ${
                          isChecked
                            ? "border-red-600 bg-red-50 text-red-950 font-black"
                            : isDisabled
                            ? "border-slate-200 bg-slate-100 text-slate-400 opacity-60 cursor-not-allowed"
                            : "border-slate-200 bg-slate-50 text-slate-800 font-bold hover:bg-slate-100 cursor-pointer"
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={isDisabled}
                          checked={isChecked}
                          onChange={() => handleRoleToggle(role)}
                          className="rounded text-red-600 focus:ring-red-600"
                        />
                        <span className="text-[11px] leading-tight">{role}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Motivation Notes */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                  Motivation / Relevant Skills Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={motivationNotes}
                  onChange={(e) => setMotivationNotes(e.target.value)}
                  placeholder="Briefly describe your skills, medical background, camera gear, etc."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-red-600"
                />
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowVolunteerModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={volunteerSubmitting || volunteerRoles.length === 0}
                  className="px-5 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-black uppercase tracking-wider disabled:opacity-50 cursor-pointer shadow"
                >
                  {volunteerSubmitting ? "Submitting Application..." : "Submit Volunteer Application"}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* 3. CELEBRATORY VOLUNTEER APPLICATION SUBMITTED MODAL */}
      {showCelebratoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border-2 border-amber-300 shadow-2xl w-full max-w-md my-6 overflow-hidden animate-pop-in">
            
            <div className="bg-gradient-to-r from-red-950 via-slate-900 to-red-950 p-6 text-center text-white relative border-b border-red-900/80">
              <button
                onClick={() => setShowCelebratoryModal(false)}
                className="absolute top-4 right-4 grid h-8 w-8 place-items-center rounded-lg bg-red-900/80 text-white hover:bg-red-800 transition"
                aria-label="Close"
              >
                <X size={18} />
              </button>

              <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-tr from-amber-500 via-red-600 to-red-700 text-white shadow-xl shadow-amber-500/20 ring-4 ring-amber-300/30 animate-pop-in">
                <Sparkles size={32} className="text-white animate-pulse" />
              </div>

              {/* Exact Required Text 1 & Text 2 */}
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white">
                Volunteer Application Submitted!
              </h2>
              <p className="mt-2 text-xs sm:text-sm font-bold text-amber-200">
                Your application has been sent to the Host.
              </p>
            </div>

            <div className="p-6 space-y-4 bg-[#fffdf7] text-center">
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold flex items-start gap-2 text-left">
                <Info size={16} className="text-amber-700 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Application Notice:</strong> Your volunteer application is now pending review by the Host for <em>"{submittedEventTitle}"</em>. The Host will evaluate your selected roles and criteria. (This application does not constitute event approval).
                </span>
              </div>

              <button
                onClick={() => setShowCelebratoryModal(false)}
                className="w-full py-2.5 bg-slate-900 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer shadow"
              >
                Return to Citizen Dashboard
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full bg-slate-950 border-t border-slate-800 px-4 py-6 text-center text-xs font-semibold text-slate-400">
        © 2026 PURATCHI — Public Citizen Media & Volunteer Suite
      </footer>
    </main>
  );
}
