"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck, LogOut, PlusCircle, FileText, Users, Megaphone,
  Calendar, MapPin, CheckCircle2, Clock, AlertTriangle, ArrowRight,
  User, RefreshCw, X, Download, QrCode, Upload, Eye, EyeOff, Lock,
  ChevronRight, Heart, Share2, AlertCircle, MessageSquare, Check, Trash2, Filter,
  Sparkles, PartyPopper, HelpCircle
} from "lucide-react";
import confetti from "canvas-confetti";
import { createClient } from "../../../lib/supabase/client";
import QRCodeModal from "../../components/QRCodeModal";

// Types matching Supabase PostgreSQL Schema
export interface HostProfile {
  full_name: string;
  email: string;
  phone?: string;
  role: string;
}

export interface EventItem {
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
  status: "draft" | "pending" | "request_info" | "approved" | "rejected" | "expired" | "upcoming" | "ongoing" | "completed" | "archived" | "revoked";
  approval_deadline?: string;
  rejection_reason?: string;
  authority_notes?: string;
  qr_token?: string;
  whatsapp_group_link?: string;
  created_at: string;
}

export interface EventDocument {
  id: string;
  event_id: string;
  document_name: string;
  file_path: string;
  file_type?: string;
  uploaded_at: string;
}

export interface VolunteerRequirement {
  id?: string;
  event_id: string;
  role_name: string;
  target_count: number;
}

export interface VolunteerApplication {
  id: string;
  event_id: string;
  applicant_id: string;
  selected_roles: string[];
  motivation_notes?: string;
  applicant_age?: number;
  status: "pending" | "approved" | "rejected";
  applicant_name?: string;
  applicant_email?: string;
  applicant_phone?: string;
  created_at: string;
}

export interface EventUpdateItem {
  id: string;
  event_id: string;
  title: string;
  content: string;
  update_type: string;
  created_at: string;
}

export interface OnlineSupportItem {
  id: string;
  event_id: string;
  supporter_name?: string;
  support_message?: string;
  pledge_amount: number;
  payment_status: string;
  created_at: string;
}

const VOLUNTEER_ROLES = [
  "Safety Volunteer",
  "First-Aid / Medical Support Volunteer",
  "Emergency Assistance Volunteer",
  "Camera Crew",
  "Journalist / Reporter",
  "Logistics Volunteer"
];

const EVENT_CATEGORIES = [
  "Youth Civic Assembly",
  "Climate & Environment March",
  "Education Rights Forum",
  "Digital Safety & Tech Rights",
  "Cultural & Public Gathering",
  "Peaceful Protest / Demonstration",
  "Community Welfare Drive"
];

export default function HostDashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  // State
  const [profile, setProfile] = useState<HostProfile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Dynamic Data States
  const [events, setEvents] = useState<EventItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modals & Active Selections
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createdSuccessEvent, setCreatedSuccessEvent] = useState<EventItem | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [controlCenterTab, setControlCenterTab] = useState<"overview" | "volunteers" | "support" | "updates" | "documents">("overview");
  const [qrModalEvent, setQrModalEvent] = useState<EventItem | null>(null);

  // Celebratory Confetti Animation Handler (1-2 seconds brief burst matching PURATCHI design)
  const triggerCelebratoryConfetti = () => {
    const colors = ["#DC2626", "#F59E0B", "#10B981", "#F43F5E", "#FFFFFF", "#D97706"];

    // Central upward pop burst
    confetti({
      particleCount: 95,
      spread: 75,
      origin: { y: 0.55 },
      colors: colors,
      disableForReducedMotion: true,
      zIndex: 9999,
    });

    // Side festive burst after 150ms delay
    setTimeout(() => {
      confetti({
        particleCount: 40,
        angle: 60,
        spread: 55,
        origin: { x: 0.15, y: 0.6 },
        colors: colors,
        disableForReducedMotion: true,
        zIndex: 9999,
      });
      confetti({
        particleCount: 40,
        angle: 120,
        spread: 55,
        origin: { x: 0.85, y: 0.6 },
        colors: colors,
        disableForReducedMotion: true,
        zIndex: 9999,
      });
    }, 150);
  };

  // Control Center Related Dynamic Data
  const [eventDocs, setEventDocs] = useState<EventDocument[]>([]);
  const [volunteerReqs, setVolunteerReqs] = useState<VolunteerRequirement[]>([]);
  const [volunteerApps, setVolunteerApps] = useState<VolunteerApplication[]>([]);
  const [eventUpdates, setEventUpdates] = useState<EventUpdateItem[]>([]);
  const [onlineSupport, setOnlineSupport] = useState<OnlineSupportItem[]>([]);
  const [loadingControlData, setLoadingControlData] = useState(false);

  // Form States for Event Creation
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(EVENT_CATEGORIES[0]);
  const [purpose, setPurpose] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [locationName, setLocationName] = useState("");
  const [placeOfAssembly, setPlaceOfAssembly] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [expectedAttendance, setExpectedAttendance] = useState(500);
  const [minAge, setMinAge] = useState(18);
  const [maxAge, setMaxAge] = useState("");
  const [additionalCriteria, setAdditionalCriteria] = useState("");
  const [routeDetails, setRouteDetails] = useState("");
  const [equipmentDetails, setEquipmentDetails] = useState("");
  const [jurisdictionReqs, setJurisdictionReqs] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Form States inside Control Center
  const [updateTitle, setUpdateTitle] = useState("");
  const [updateContent, setUpdateContent] = useState("");
  const [updateSubmitting, setUpdateSubmitting] = useState(false);

  const [whatsappLink, setWhatsappLink] = useState("");
  const [whatsappSaving, setWhatsappSaving] = useState(false);

  // Volunteer Requirement Editing States
  const [editReqMinAge, setEditReqMinAge] = useState(18);
  const [editReqMaxAge, setEditReqMaxAge] = useState("");
  const [editReqAdditionalCriteria, setEditReqAdditionalCriteria] = useState("");
  const [editReqSaving, setEditReqSaving] = useState(false);
  const [editReqSuccess, setEditReqSuccess] = useState<string | null>(null);

  // Initial Data Load & Host Auth Check
  useEffect(() => {
    async function initDashboard() {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/host/login");
        return;
      }

      setUserId(session.user.id);

      // Verify Host Role
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, email, phone, role")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();

      const userRole = profileData?.role || session.user.user_metadata?.role;

      if (userRole !== "host") {
        await supabase.auth.signOut();
        router.replace("/host/login");
        return;
      }

      setProfile({
        full_name: profileData?.full_name || session.user.user_metadata?.full_name || "Host Organizer",
        email: profileData?.email || session.user.email || "",
        phone: profileData?.phone,
        role: "host"
      });

      // Fetch Host Events
      await fetchHostEvents(session.user.id);
      setLoading(false);
    }

    initDashboard();
  }, [router, supabase]);

  // Realtime Live Synchronization for Host Events
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("host-dashboard-events-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events", filter: `host_id=eq.${userId}` },
        () => {
          fetchHostEvents(userId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase]);

  // Clarification Response States
  const [hostClarification, setHostClarification] = useState("");
  const [submittingClarification, setSubmittingClarification] = useState(false);
  const [clarificationSuccess, setClarificationSuccess] = useState<string | null>(null);
  const [clarificationError, setClarificationError] = useState<string | null>(null);

  // Submit Host Clarification to Authority
  const handleHostSubmitClarification = async (eventId: string) => {
    if (!hostClarification.trim()) return;
    setSubmittingClarification(true);
    setClarificationError(null);
    setClarificationSuccess(null);
    try {
      const res = await fetch("/api/host/respond-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          hostResponse: hostClarification.trim()
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to submit clarification.");
      setClarificationSuccess("Clarification submitted! Event returned to Pending Review queue.");
      setHostClarification("");
      if (userId) fetchHostEvents(userId);
    } catch (err: any) {
      setClarificationError(err.message || "Failed to submit clarification.");
    } finally {
      setSubmittingClarification(false);
    }
  };

  // Fetch Host Events from Supabase
  const fetchHostEvents = async (hostUserId: string) => {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("host_id", hostUserId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching events:", error.message);
    } else {
      setEvents((data as EventItem[]) || []);
    }
  };

  // Fetch Control Center Details for a specific event
  const loadEventControlData = async (event: EventItem) => {
    setSelectedEvent(event);
    setWhatsappLink(event.whatsapp_group_link || "");
    setEditReqMinAge(event.min_age || 18);
    setEditReqMaxAge(event.max_age ? String(event.max_age) : "");
    setEditReqAdditionalCriteria(event.additional_criteria || "");
    setEditReqSuccess(null);
    setLoadingControlData(true);

    try {
      // 1. Fetch Documents
      const { data: docs } = await supabase
        .from("event_documents")
        .select("*")
        .eq("event_id", event.id);

      setEventDocs((docs as EventDocument[]) || []);

      // 2. Fetch Volunteer Requirements
      const { data: reqs } = await supabase
        .from("event_volunteer_requirements")
        .select("*")
        .eq("event_id", event.id);

      setVolunteerReqs((reqs as VolunteerRequirement[]) || []);

      // 3. Fetch Volunteer Applications
      const { data: apps } = await supabase
        .from("volunteer_applications")
        .select(`
          id, event_id, applicant_id, selected_roles, motivation_notes, status, created_at,
          profiles:applicant_id (full_name, email, phone)
        `)
        .eq("event_id", event.id);

      const formattedApps = (apps || []).map((a: any) => {
        const rawNotes = a.motivation_notes || "";
        const ageMatch = rawNotes.match(/^\[Age:\s*(\d+)\]\s*/i);
        const parsedAge = ageMatch ? parseInt(ageMatch[1], 10) : (a.applicant_age || undefined);
        const cleanNotes = ageMatch ? rawNotes.replace(/^\[Age:\s*\d+\]\s*/i, "") : rawNotes;

        return {
          id: a.id,
          event_id: a.event_id,
          applicant_id: a.applicant_id,
          selected_roles: a.selected_roles || [],
          motivation_notes: cleanNotes || undefined,
          applicant_age: parsedAge,
          status: a.status,
          applicant_name: a.profiles?.full_name || "Volunteer Applicant",
          applicant_email: a.profiles?.email || "",
          applicant_phone: a.profiles?.phone || "",
          created_at: a.created_at
        };
      });

      setVolunteerApps(formattedApps);

      // 4. Fetch Event Updates
      const { data: updates } = await supabase
        .from("event_updates")
        .select("*")
        .eq("event_id", event.id)
        .order("created_at", { ascending: false });

      setEventUpdates((updates as EventUpdateItem[]) || []);

      // 5. Fetch Online Support
      const { data: support } = await supabase
        .from("online_support")
        .select("*")
        .eq("event_id", event.id)
        .order("created_at", { ascending: false });

      setOnlineSupport((support as OnlineSupportItem[]) || []);

    } catch (err: any) {
      console.error("Error loading control data:", err);
    } finally {
      setLoadingControlData(false);
    }
  };

  // Sign Out Handler
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/host/login");
  };

  // Handle Event Creation Form Submission
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!title || !purpose || !description || !eventDate || !locationName || !placeOfAssembly) {
      setFormError("Please complete all required fields marked with *.");
      return;
    }

    if (!userId) return;

    setFormSubmitting(true);

    try {
      // 0. Ensure host profile exists in public.profiles to satisfy FK constraint
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("auth_user_id", userId)
        .maybeSingle();

      if (!existingProfile) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("profiles").upsert({
            auth_user_id: user.id,
            full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Host Organizer",
            email: user.email || "",
            role: "host",
            language: "English"
          }, { onConflict: "auth_user_id" });
        }
      }

      // 1. Insert Event into Supabase
      const { data: newEvent, error: eventErr } = await supabase
        .from("events")
        .insert({
          host_id: userId,
          title: title.trim(),
          category,
          purpose: purpose.trim(),
          description: description.trim(),
          event_date: eventDate,
          start_time: startTime,
          end_time: endTime,
          location_name: locationName.trim(),
          place_of_assembly: placeOfAssembly.trim(),
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null,
          expected_attendance: expectedAttendance,
          min_age: minAge ? parseInt(minAge.toString()) : 18,
          max_age: maxAge ? parseInt(maxAge) : null,
          additional_criteria: additionalCriteria.trim() || null,
          route_details: routeDetails.trim() || null,
          equipment_details: equipmentDetails.trim() || null,
          jurisdiction_requirements: jurisdictionReqs.trim() || null,
          status: "pending",
          approval_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        })
        .select()
        .single();

      if (eventErr || !newEvent) {
        throw new Error(eventErr?.message || "Failed to create event.");
      }

      // 2. Insert Default Volunteer Requirements for all 6 roles
      const defaultReqs = VOLUNTEER_ROLES.map((role) => ({
        event_id: newEvent.id,
        role_name: role,
        target_count: 5
      }));

      await supabase.from("event_volunteer_requirements").insert(defaultReqs);

      // 3. Upload File to Private Supabase Storage if file attached
      if (selectedFile) {
        const filePath = `${userId}/${newEvent.id}/${Date.now()}_${selectedFile.name}`;
        
        const { error: uploadErr } = await supabase.storage
          .from("permit-documents")
          .upload(filePath, selectedFile);

        if (!uploadErr) {
          // Record document in event_documents table
          await supabase.from("event_documents").insert({
            event_id: newEvent.id,
            host_id: userId,
            document_name: selectedFile.name,
            file_path: filePath,
            file_type: selectedFile.type
          });
        }
      }

      setFormSuccess("Assembly created successfully! Entered PENDING AUTHORITY APPROVAL (24-hour review window).");
      
      // Refresh Events
      await fetchHostEvents(userId);

      // Trigger 1-2s brief celebratory confetti animation
      triggerCelebratoryConfetti();

      // Hide creation modal, reset form state, and launch Event Success Modal with QR Code
      setShowCreateModal(false);
      resetForm();
      setCreatedSuccessEvent(newEvent as EventItem);

    } catch (err: any) {
      setFormError(err.message || "Failed to submit event application.");
    } finally {
      setFormSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setPurpose("");
    setDescription("");
    setLocationName("");
    setPlaceOfAssembly("");
    setRouteDetails("");
    setEquipmentDetails("");
    setJurisdictionReqs("");
    setLatitude("");
    setLongitude("");
    setSelectedFile(null);
    setFormError(null);
    setFormSuccess(null);
  };

  // Publish Host Update inside Control Center
  const handlePublishUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !userId || !updateTitle || !updateContent) return;

    setUpdateSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("event_updates")
        .insert({
          event_id: selectedEvent.id,
          host_id: userId,
          title: updateTitle.trim(),
          content: updateContent.trim(),
          update_type: "VERIFIED HOST UPDATE"
        })
        .select()
        .single();

      if (!error && data) {
        setEventUpdates([data as EventUpdateItem, ...eventUpdates]);
        setUpdateTitle("");
        setUpdateContent("");
      }
    } catch (err) {
      console.error("Error publishing update:", err);
    } finally {
      setUpdateSubmitting(false);
    }
  };

  // Save WhatsApp Communication Link
  const handleSaveWhatsapp = async () => {
    if (!selectedEvent || !userId) return;
    setWhatsappSaving(true);
    try {
      const { error } = await supabase
        .from("events")
        .update({ whatsapp_group_link: whatsappLink.trim() })
        .eq("id", selectedEvent.id)
        .eq("host_id", userId);

      if (!error) {
        setSelectedEvent({ ...selectedEvent, whatsapp_group_link: whatsappLink.trim() });
        setEvents(events.map(ev => ev.id === selectedEvent.id ? { ...ev, whatsapp_group_link: whatsappLink.trim() } : ev));
      }
    } catch (err) {
      console.error("Error saving WhatsApp link:", err);
    } finally {
      setWhatsappSaving(false);
    }
  };

  // Save Volunteer Requirements (Age Criteria & Additional Criteria)
  const handleSaveVolunteerRequirements = async () => {
    if (!selectedEvent || !userId) return;
    setEditReqSaving(true);
    setEditReqSuccess(null);
    try {
      const { error } = await supabase
        .from("events")
        .update({
          min_age: editReqMinAge,
          max_age: editReqMaxAge ? parseInt(editReqMaxAge) : null,
          additional_criteria: editReqAdditionalCriteria.trim() || null
        })
        .eq("id", selectedEvent.id)
        .eq("host_id", userId);

      if (!error) {
        const updatedEvent = {
          ...selectedEvent,
          min_age: editReqMinAge,
          max_age: editReqMaxAge ? parseInt(editReqMaxAge) : undefined,
          additional_criteria: editReqAdditionalCriteria.trim() || undefined
        };
        setSelectedEvent(updatedEvent);
        setEvents(events.map(ev => ev.id === selectedEvent.id ? updatedEvent : ev));
        setEditReqSuccess("Volunteer requirements saved successfully!");
      }
    } catch (err) {
      console.error("Error saving volunteer requirements:", err);
    } finally {
      setEditReqSaving(false);
    }
  };

  // Volunteer Application Decision (Accept/Reject)
  const handleVolunteerDecision = async (appId: string, decision: "approved" | "rejected") => {
    if (!userId) return;
    try {
      const { error } = await supabase
        .from("volunteer_applications")
        .update({
          status: decision,
          reviewed_by: userId,
          reviewed_at: new Date().toISOString()
        })
        .eq("id", appId);

      if (!error) {
        setVolunteerApps(volunteerApps.map(a => a.id === appId ? { ...a, status: decision } : a));
      }
    } catch (err) {
      console.error("Error updating volunteer decision:", err);
    }
  };

  // Filter events by selected status
  const filteredEvents = events.filter(e => {
    if (statusFilter === "all") return true;
    return e.status === statusFilter;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fffdf7] grid place-items-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw size={32} className="animate-spin text-red-700" />
          <p className="text-xs font-black uppercase tracking-wider text-slate-700">Connecting to Supabase Database...</p>
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
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/60 border border-blue-700/80 text-blue-200 text-xs font-black uppercase tracking-wider">
              <ShieldCheck size={14} className="text-blue-400" /> Host Console
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-amber-100">
              <User size={16} className="text-red-400" />
              <span className="max-w-[120px] sm:max-w-[180px] truncate">{profile?.full_name}</span>
            </div>

            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-900/80 hover:bg-red-800 border border-red-700 text-xs font-black uppercase tracking-wider text-white transition"
            >
              <LogOut size={14} /> <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">
        
        {/* 1. CREATIVE WELCOME & ARCHITECTURE WORKFLOW BANNER */}
        <div className="rounded-2xl border-2 border-amber-200/80 bg-gradient-to-r from-red-950 via-slate-900 to-red-950 p-6 sm:p-8 text-white shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-red-900/80">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-black uppercase tracking-wider mb-2">
                VERIFIED HOST ORGANIZER CONSOLE
              </div>
              <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">
                Welcome, {profile?.full_name}
              </h1>
              <p className="mt-1 text-xs sm:text-sm font-medium text-slate-300 max-w-2xl">
                Manage public assemblies, submit official permission records, coordinate volunteers, and communicate verified updates.
              </p>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg transition active:scale-95 cursor-pointer self-start md:self-auto"
            >
              <PlusCircle size={18} /> Create Assembly
            </button>
          </div>

          {/* Workflow Step Visual Representation */}
          <div className="mt-6 pt-2">
            <div className="text-[11px] font-black uppercase tracking-widest text-amber-200/80 mb-3">
              PURATCHI HOST EVENT LIFECYCLE WORKFLOW
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-red-900/40 border border-red-800/80 rounded-xl p-3 flex items-center gap-3">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-red-600 text-white font-black text-xs flex-shrink-0">
                  01
                </div>
                <div>
                  <div className="font-black text-white uppercase text-[11px]">CREATE EVENT</div>
                  <div className="text-[10px] text-slate-300 font-medium">Submit venue, route & NOC</div>
                </div>
              </div>

              <div className="bg-amber-950/40 border border-amber-800/80 rounded-xl p-3 flex items-center gap-3">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-amber-600 text-white font-black text-xs flex-shrink-0">
                  02
                </div>
                <div>
                  <div className="font-black text-amber-200 uppercase text-[11px]">AUTHORITY REVIEW</div>
                  <div className="text-[10px] text-amber-100/70 font-medium">24-hour approval window</div>
                </div>
              </div>

              <div className="bg-emerald-950/40 border border-emerald-800/80 rounded-xl p-3 flex items-center gap-3">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-600 text-white font-black text-xs flex-shrink-0">
                  03
                </div>
                <div>
                  <div className="font-black text-emerald-200 uppercase text-[11px]">GO LIVE</div>
                  <div className="text-[10px] text-emerald-100/70 font-medium">Public discovery & QR code</div>
                </div>
              </div>

              <div className="bg-blue-950/40 border border-blue-800/80 rounded-xl p-3 flex items-center gap-3">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-blue-600 text-white font-black text-xs flex-shrink-0">
                  04
                </div>
                <div>
                  <div className="font-black text-blue-200 uppercase text-[11px]">COORDINATE</div>
                  <div className="text-[10px] text-blue-100/70 font-medium">Volunteers & verified updates</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. MY EVENTS SECTION */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-slate-900 pb-3 mb-6">
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-red-700">REAL-TIME SUPABASE RECORDS</div>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-900">
                MY MANAGED ASSEMBLIES
              </h2>
            </div>

            {/* Status Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold bg-slate-100 p-1.5 rounded-xl border border-slate-200">
              {["all", "pending", "approved", "draft", "rejected", "revoked"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg capitalize transition ${
                    statusFilter === st
                      ? "bg-red-700 text-white shadow-sm font-black"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                  }`}
                >
                  {st === "all" ? `All (${events.length})` : st}
                </button>
              ))}
            </div>
          </div>

          {/* Events List */}
          {filteredEvents.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-amber-200 bg-white p-10 text-center">
              <Calendar size={40} className="mx-auto text-amber-400 mb-3" />
              <h3 className="text-base font-black uppercase text-slate-800">No Assemblies Found</h3>
              <p className="mt-1 text-xs text-slate-600 max-w-sm mx-auto font-medium">
                {statusFilter === "all"
                  ? "You haven't submitted any assembly applications yet. Click 'Create Assembly' to get started."
                  : `No events matching the '${statusFilter}' filter.`}
              </p>
              {statusFilter === "all" && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 px-4 py-2 bg-red-700 text-white text-xs font-black uppercase tracking-wider rounded-xl hover:bg-red-800"
                >
                  + Create Your First Assembly
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {filteredEvents.map((ev) => (
                <article
                  key={ev.id}
                  className={`rounded-2xl border-2 p-5 shadow-sm transition flex flex-col justify-between ${
                    ev.status === "revoked"
                      ? "border-red-600 bg-red-950/10 hover:border-red-700 hover:shadow-red-500/10"
                      : "border-amber-200/80 bg-white hover:border-red-700 hover:shadow-md"
                  }`}
                >
                  <div>
                    {/* Status Badge */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <StatusBadge status={ev.status} />
                      <span className="text-[11px] font-bold text-slate-500">{ev.event_date}</span>
                    </div>

                    <h3 className="text-lg font-black text-slate-900 leading-snug">{ev.title}</h3>
                    
                    <div className="mt-2 text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                      <MapPin size={14} className="text-red-700 flex-shrink-0" />
                      <span className="truncate">{ev.location_name}</span>
                    </div>

                    <p className="mt-2 text-xs text-slate-500 font-medium line-clamp-2 leading-relaxed">
                      {ev.description}
                    </p>

                    {/* Revocation Warning Alert if status is revoked */}
                    {ev.status === "revoked" && (
                      <div className="mt-3 p-2.5 rounded-xl bg-red-950 text-red-100 border border-red-500 text-[11px] font-semibold flex items-start gap-2 shadow-sm">
                        <AlertTriangle size={15} className="text-red-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-black text-white uppercase tracking-wider block text-[10px]">VERIFICATION REVOKED</span>
                          <span className="text-red-200 leading-tight block">{ev.rejection_reason || "Statutory authority revoked verification. Passes invalidated."}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-600">
                      {ev.expected_attendance.toLocaleString()} Expected
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setQrModalEvent(ev)}
                        className="p-2 border border-slate-300 hover:border-red-600 hover:text-red-700 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-sm"
                        title="View Official Pass QR"
                      >
                        <QrCode size={14} />
                      </button>

                      <button
                        onClick={() => loadEventControlData(ev)}
                        className="px-3.5 py-2 bg-slate-900 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5"
                      >
                        Control Center <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* 3. CREATE EVENT MODAL FORM */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border-2 border-amber-200 shadow-2xl w-full max-w-3xl my-8 overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-red-950 border-b border-red-800 px-6 py-4 text-white flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-amber-200">
                  PURATCHI FORM 101 — PERMISSION APPLICATION
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight text-white">
                  Create New Public Assembly
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="grid h-8 w-8 place-items-center rounded-lg bg-red-900 text-white hover:bg-red-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleCreateEvent} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              
              {/* Notice */}
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold flex items-start gap-2.5">
                <AlertCircle size={18} className="text-amber-700 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Important Protocol:</strong> Host cannot approve their own event. Upon submission, the event will enter <strong>PENDING AUTHORITY APPROVAL</strong> with a 24-hour review window.
                </span>
              </div>

              {formError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-300 text-red-800 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={16} className="text-red-600" /> {formError}
                </div>
              )}

              {formSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600" /> {formSuccess}
                </div>
              )}

              {/* Event Title & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Event Title / Assembly Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Youth Climate & Clean Energy Assembly"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-red-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Assembly Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-red-600"
                  >
                    {EVENT_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Purpose & Description */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                  Foundational Purpose *
                </label>
                <input
                  type="text"
                  required
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Promote environmental awareness and advocate for youth climate action."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-red-600"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                  Detailed Event Description *
                </label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Full schedule, speakers, safety measures, and civic coordination details..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-red-600"
                />
              </div>

              {/* Date & Times */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Event Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-red-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-red-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    End Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-red-600"
                  />
                </div>
              </div>

              {/* Location & Assembly Ground */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    City / District Location *
                  </label>
                  <input
                    type="text"
                    required
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    placeholder="Chennai, Tamil Nadu"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-red-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Place of Assembly Ground *
                  </label>
                  <input
                    type="text"
                    required
                    value={placeOfAssembly}
                    onChange={(e) => setPlaceOfAssembly(e.target.value)}
                    placeholder="Marina Beach Service Road Ground"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-red-600"
                  />
                </div>
              </div>

              {/* Attendance & Coordinates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Expected Turnout *
                  </label>
                  <input
                    type="number"
                    required
                    min={10}
                    value={expectedAttendance}
                    onChange={(e) => setExpectedAttendance(parseInt(e.target.value) || 100)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-red-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Latitude (Map Location)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="13.0489"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-red-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Longitude (Map Location)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="80.2822"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-red-600"
                  />
                </div>
              </div>

              {/* Volunteer Criteria Configuration */}
              <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/60 space-y-3">
                <div className="text-xs font-black uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                  <ShieldCheck size={16} className="text-amber-700" /> Host Volunteer Criteria & Eligibility Rules
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-700 mb-1">
                      Minimum Age Requirement *
                    </label>
                    <input
                      type="number"
                      required
                      min={16}
                      max={100}
                      value={minAge}
                      onChange={(e) => setMinAge(parseInt(e.target.value) || 18)}
                      placeholder="18"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-red-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-700 mb-1">
                      Maximum Age Limit (Optional)
                    </label>
                    <input
                      type="number"
                      min={18}
                      max={100}
                      value={maxAge}
                      onChange={(e) => setMaxAge(e.target.value)}
                      placeholder="e.g. 60 (leave empty for no limit)"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-red-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-700 mb-1">
                    Event-Specific Volunteer Criteria & Requirements
                  </label>
                  <textarea
                    rows={2}
                    value={additionalCriteria}
                    onChange={(e) => setAdditionalCriteria(e.target.value)}
                    placeholder="e.g., Physical fitness for crowd patrol, past medical experience preferred, local residency..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-red-600"
                  />
                </div>
              </div>

              {/* Optional Route / Equipment Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Procession / Rally Route (if applicable)
                  </label>
                  <textarea
                    rows={2}
                    value={routeDetails}
                    onChange={(e) => setRouteDetails(e.target.value)}
                    placeholder="Route details from Light House to Anna Square..."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-red-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Equipment / Sound Systems / Stage
                  </label>
                  <textarea
                    rows={2}
                    value={equipmentDetails}
                    onChange={(e) => setEquipmentDetails(e.target.value)}
                    placeholder="2 Sound Amplifiers (below 65dB), 1 Portable Stage..."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-red-600"
                  />
                </div>
              </div>

              {/* Official Document Upload (Private Bucket) */}
              <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/50">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-900 mb-1">
                  Upload Official NOC / Permission Document (Private)
                </label>
                <p className="text-[11px] text-slate-600 font-medium mb-2">
                  Uploaded files are stored in a <strong>private Supabase storage bucket</strong> accessible only by Host and Government Authorities.
                </p>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-black file:uppercase file:bg-red-700 file:text-white hover:file:bg-red-800"
                />
              </div>

              {/* Form Buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-black uppercase tracking-wider shadow-md transition disabled:opacity-50"
                >
                  {formSubmitting ? "Submitting Application..." : "Submit Event for Authority Review"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 4. EVENT CONTROL CENTER MODAL */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-2xl border-2 border-amber-200 shadow-2xl w-full max-w-4xl my-6 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="bg-red-950 border-b border-red-800 px-6 py-4 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <StatusBadge status={selectedEvent.status} />
                  <span className="text-xs text-amber-200 font-bold">{selectedEvent.event_date}</span>
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight text-white max-w-xl truncate">
                  {selectedEvent.title}
                </h3>
              </div>

              <button
                onClick={() => setSelectedEvent(null)}
                className="grid h-9 w-9 place-items-center rounded-xl bg-red-900 text-white hover:bg-red-800"
              >
                <X size={20} />
              </button>
            </div>

            {/* Control Center Navigation Tabs */}
            <div className="bg-slate-900 border-b border-slate-800 px-4 flex items-center gap-2 overflow-x-auto text-xs font-black uppercase tracking-wider text-slate-300">
              {[
                { id: "overview", label: "Overview & QR", icon: QrCode },
                { id: "volunteers", label: `Volunteers (${volunteerApps.length})`, icon: Users },
                { id: "support", label: `Online Support (${onlineSupport.length})`, icon: Heart },
                { id: "updates", label: `Host Updates (${eventUpdates.length})`, icon: Megaphone },
                { id: "documents", label: `NOC Docs (${eventDocs.length})`, icon: FileText }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setControlCenterTab(tab.id as any)}
                  className={`py-3 px-4 flex items-center gap-2 border-b-2 transition whitespace-nowrap cursor-pointer ${
                    controlCenterTab === tab.id
                      ? "border-red-600 text-white font-black"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <tab.icon size={16} /> {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              
              {loadingControlData ? (
                <div className="py-12 text-center">
                  <RefreshCw size={28} className="animate-spin text-red-700 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600">Loading Event Control Data...</p>
                </div>
              ) : (
                <>
                  {/* SUB-TAB 1: OVERVIEW & UNIQUE QR CODE */}
                  {controlCenterTab === "overview" && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        
                        {/* Event QR Code Container (Non-Sensitive Token) */}
                        <div className="bg-amber-50/60 border-2 border-amber-200 rounded-2xl p-5 text-center flex flex-col items-center justify-between">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-red-700">SECURE ASSEMBLY PASS</span>
                            <h4 className="text-sm font-black uppercase text-slate-900 mt-1">Official Event QR</h4>
                            <span className="text-[10px] font-mono text-slate-500 block mt-0.5">Token: {selectedEvent.qr_token || selectedEvent.id.slice(0, 12)}</span>
                          </div>

                          <div className="my-4 p-3 bg-white border border-amber-300 rounded-xl shadow-inner inline-block">
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${typeof window !== "undefined" ? window.location.origin : ""}/authority/scan?token=${selectedEvent.qr_token || selectedEvent.id}`)}`}
                              alt="Event QR Code"
                              className="w-40 h-40 object-contain mx-auto"
                            />
                          </div>

                          <div className="flex flex-col gap-2 w-full">
                            <button
                              onClick={() => setQrModalEvent(selectedEvent)}
                              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-sm cursor-pointer"
                            >
                              <QrCode size={14} /> View Pass Slip
                            </button>
                            <a
                              href={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(`${typeof window !== "undefined" ? window.location.origin : ""}/authority/scan?token=${selectedEvent.qr_token || selectedEvent.id}`)}`}
                              target="_blank"
                              download={`PURATCHI_PASS_${selectedEvent.id}.png`}
                              className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[11px] font-bold transition"
                            >
                              <Download size={13} /> Download Pass Image
                            </a>
                          </div>
                        </div>

                        {/* Authority Review Status & Inquiry Resolution */}
                        <div className="md:col-span-2 space-y-4">
                          <div className="p-4 rounded-2xl border border-amber-300 bg-white shadow-sm space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black uppercase tracking-wider text-slate-700">Authority Approval Status</span>
                              <StatusBadge status={selectedEvent.status} />
                            </div>

                            <div className="text-xs font-medium text-slate-600 leading-relaxed">
                              {selectedEvent.status === "pending" && (
                                <span className="text-amber-800 font-bold flex items-center gap-1">
                                  <Clock size={14} /> Under 24-Hour Regulatory Window. Pending jurisdiction authority approval.
                                </span>
                              )}

                              {selectedEvent.status === "approved" && (
                                <span className="text-emerald-800 font-bold flex items-center gap-1">
                                  <CheckCircle2 size={14} /> Verified &amp; Approved by Authority. Visible on public portal for citizen participation.
                                </span>
                              )}

                              {selectedEvent.status === "request_info" && (
                                <div className="space-y-3 pt-1">
                                  <div className="p-3 bg-amber-100 border border-amber-300 rounded-xl text-amber-950">
                                    <div className="font-bold flex items-center gap-1 mb-1 text-amber-900">
                                      <HelpCircle size={14} />
                                      <span>Authority Inquiry / Document Request:</span>
                                    </div>
                                    <p className="text-xs">{selectedEvent.authority_notes || "Please submit required safety contingency or route clarifications."}</p>
                                  </div>

                                  {clarificationSuccess && (
                                    <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1.5">
                                      <CheckCircle2 size={14} />
                                      <span>{clarificationSuccess}</span>
                                    </div>
                                  )}

                                  {clarificationError && (
                                    <div className="p-2.5 rounded-lg bg-red-100 text-red-800 text-xs font-bold flex items-center gap-1.5">
                                      <AlertCircle size={14} />
                                      <span>{clarificationError}</span>
                                    </div>
                                  )}

                                  <div className="space-y-2">
                                    <label className="block text-xs font-bold uppercase text-slate-700">
                                      Respond with Clarification / Document Details:
                                    </label>
                                    <textarea
                                      value={hostClarification}
                                      onChange={(e) => setHostClarification(e.target.value)}
                                      placeholder="Provide the required details or explain the uploaded documents..."
                                      rows={2}
                                      className="w-full p-2.5 border border-amber-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-amber-500"
                                    />
                                    <button
                                      onClick={() => handleHostSubmitClarification(selectedEvent.id)}
                                      disabled={submittingClarification || !hostClarification.trim()}
                                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition disabled:opacity-50"
                                    >
                                      {submittingClarification ? "Submitting to Authority..." : "Submit Clarification to Authority"}
                                    </button>
                                  </div>
                                </div>
                              )}

                              {selectedEvent.status === "rejected" && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs">
                                  <strong>Statutory Grounds for Denial:</strong> {selectedEvent.rejection_reason || "Regulatory restrictions apply."}
                                </div>
                              )}

                              {selectedEvent.status === "revoked" && (
                                <div className="p-4 bg-red-950 border-2 border-red-500 rounded-xl text-white space-y-2 shadow-lg">
                                  <div className="flex items-center gap-2 text-red-300 font-black text-xs uppercase tracking-wider">
                                    <AlertTriangle size={16} className="text-red-400 shrink-0" />
                                    <span>EMERGENCY STATUTORY REVOCATION NOTICE</span>
                                  </div>
                                  <p className="text-xs text-red-100 font-medium leading-relaxed">
                                    Jurisdiction authorities have revoked official verification for this event under statutory public safety powers. All QR check-in passes and live operations have been terminated.
                                  </p>
                                  {selectedEvent.rejection_reason && (
                                    <div className="p-2.5 bg-red-900/60 border border-red-700 rounded-lg text-xs">
                                      <span className="font-bold text-red-200 block text-[10px] uppercase">Official Grounds:</span>
                                      <span className="text-white font-medium">{selectedEvent.rejection_reason}</span>
                                    </div>
                                  )}
                                  {selectedEvent.authority_notes && (
                                    <div className="p-2.5 bg-red-900/40 border border-red-700/80 rounded-lg text-xs">
                                      <span className="font-bold text-amber-300 block text-[10px] uppercase">Emergency Directives / Dispersal Protocol:</span>
                                      <span className="text-amber-100 font-medium">{selectedEvent.authority_notes}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Details Summary */}
                          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2 text-xs">
                            <div className="grid grid-cols-2 gap-2">
                              <div><span className="font-bold text-slate-500">Category:</span> <span className="font-black">{selectedEvent.category}</span></div>
                              <div><span className="font-bold text-slate-500">Expected:</span> <span className="font-black">{selectedEvent.expected_attendance} citizens</span></div>
                              <div><span className="font-bold text-slate-500">Time:</span> <span className="font-black">{selectedEvent.start_time} - {selectedEvent.end_time}</span></div>
                              <div><span className="font-bold text-slate-500">Place:</span> <span className="font-black">{selectedEvent.place_of_assembly}</span></div>
                            </div>
                            <div className="pt-2 border-t border-slate-200">
                              <span className="font-bold text-slate-500">Purpose:</span> {selectedEvent.purpose}
                            </div>
                          </div>

                          {/* Communication Link Configuration */}
                          <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/60 space-y-2">
                            <label className="block text-xs font-black uppercase tracking-wider text-blue-950">
                              Event WhatsApp / Communication Link
                            </label>
                            <p className="text-[11px] text-blue-800 font-medium">
                              Only <strong>approved volunteers</strong> receive access to this link.
                            </p>
                            <div className="flex gap-2">
                              <input
                                type="url"
                                value={whatsappLink}
                                onChange={(e) => setWhatsappLink(e.target.value)}
                                placeholder="https://chat.whatsapp.com/..."
                                className="flex-1 px-3 py-2 bg-white border border-blue-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-600"
                              />
                              <button
                                onClick={handleSaveWhatsapp}
                                disabled={whatsappSaving}
                                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-black uppercase tracking-wider"
                              >
                                {whatsappSaving ? "Saving..." : "Save Link"}
                              </button>
                            </div>
                          </div>

                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUB-TAB 2: VOLUNTEERS MANAGEMENT */}
                  {controlCenterTab === "volunteers" && (
                    <div className="space-y-6">
                      
                      {/* Host Volunteer Requirements Editor */}
                      <div className="p-5 rounded-xl bg-amber-50/80 border-2 border-amber-300 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-black uppercase text-amber-950 flex items-center gap-1.5">
                            <ShieldCheck size={16} className="text-amber-700" /> Edit Volunteer Criteria & Requirements
                          </h4>
                          {editReqSuccess && (
                            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-1 rounded-lg flex items-center gap-1">
                              <CheckCircle2 size={12} /> {editReqSuccess}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[11px] font-black uppercase text-slate-700 mb-1">
                              Minimum Age *
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={editReqMinAge}
                              onChange={(e) => setEditReqMinAge(parseInt(e.target.value) || 18)}
                              className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-black uppercase text-slate-700 mb-1">
                              Maximum Age (Optional)
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={120}
                              value={editReqMaxAge}
                              onChange={(e) => setEditReqMaxAge(e.target.value)}
                              placeholder="Leave blank for no upper limit"
                              className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-black uppercase text-slate-700 mb-1">
                            Additional Volunteer Criteria (Optional)
                          </label>
                          <textarea
                            rows={2}
                            value={editReqAdditionalCriteria}
                            onChange={(e) => setEditReqAdditionalCriteria(e.target.value)}
                            placeholder="E.g., Must have first-aid certificate for medical roles. Camera crew must bring own equipment..."
                            className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>

                        <button
                          onClick={handleSaveVolunteerRequirements}
                          disabled={editReqSaving}
                          className="px-5 py-2.5 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white font-black uppercase text-xs tracking-wider rounded-xl transition-all shadow flex items-center gap-2 cursor-pointer"
                        >
                          {editReqSaving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                          {editReqSaving ? "Saving Requirements..." : "Save Volunteer Requirements"}
                        </button>
                      </div>


                      {/* Volunteer Target Requirements */}
                      <div>
                        <h4 className="text-sm font-black uppercase text-slate-900 mb-3">Six Volunteer Roles & Target Counts</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {VOLUNTEER_ROLES.map((role) => {
                            const req = volunteerReqs.find(r => r.role_name === role);
                            const count = volunteerApps.filter(a => a.selected_roles.includes(role) && a.status === "approved").length;
                            return (
                              <div key={role} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                                <div>
                                  <div className="text-xs font-black text-slate-900">{role}</div>
                                  <div className="text-[10px] text-slate-500 font-semibold">{count} / {req?.target_count || 5} Approved</div>
                                </div>
                                <span className="text-xs font-black text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded-md">
                                  {count >= (req?.target_count || 5) ? "Filled" : "Active"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Applications List */}
                      <div>
                        <h4 className="text-sm font-black uppercase text-slate-900 mb-3">
                          Volunteer Applications ({volunteerApps.length})
                        </h4>

                        {volunteerApps.length === 0 ? (
                          <div className="p-6 text-center border border-dashed border-slate-300 rounded-xl text-xs font-medium text-slate-500">
                            No volunteer applications received yet for this event.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {volunteerApps.map((app) => {
                              const minAge = selectedEvent.min_age || 18;
                              const maxAge = selectedEvent.max_age;
                              const age = app.applicant_age;
                              const meetsMin = !age || age >= minAge;
                              const meetsMax = !maxAge || !age || age <= maxAge;
                              const meetsCriteria = meetsMin && meetsMax;

                              return (
                                <div key={app.id} className="p-4 rounded-xl border border-amber-200/80 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-black text-sm text-slate-900">{app.applicant_name}</span>
                                      
                                      {/* Status Badge */}
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${
                                        app.status === "approved" ? "bg-emerald-50 text-emerald-800 border-emerald-300" :
                                        app.status === "rejected" ? "bg-red-50 text-red-800 border-red-300" : "bg-amber-50 text-amber-800 border-amber-300"
                                      }`}>
                                        {app.status}
                                      </span>

                                      {/* Criteria Check Badge */}
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${
                                        meetsCriteria ? "bg-emerald-50 text-emerald-800 border-emerald-300" : "bg-red-50 text-red-800 border-red-300"
                                      }`}>
                                        {age ? (meetsCriteria ? `Age ${age} (Meets Min ${minAge}+)` : `Age ${age} (Criteria Mismatch)`) : "Age Verified"}
                                      </span>
                                    </div>

                                    {/* Contact info */}
                                    <div className="text-[11px] text-slate-500 font-medium mt-1">
                                      {app.applicant_email} {app.applicant_phone ? `| ${app.applicant_phone}` : ""}
                                    </div>
                                    
                                    {/* Selected Roles (Max 2) */}
                                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                                      {app.selected_roles.map(r => (
                                        <span key={r} className="px-2 py-0.5 bg-blue-50 border border-blue-200 rounded text-[10px] font-black text-blue-800">
                                          {r}
                                        </span>
                                      ))}
                                    </div>

                                    {app.motivation_notes && (
                                      <p className="mt-1.5 text-xs text-slate-600 font-medium italic">"{app.motivation_notes}"</p>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 self-end sm:self-auto">
                                    <button
                                      onClick={() => handleVolunteerDecision(app.id, "approved")}
                                      disabled={app.status === "approved"}
                                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                                    >
                                      <Check size={14} /> Accept
                                    </button>
                                    <button
                                      onClick={() => handleVolunteerDecision(app.id, "rejected")}
                                      disabled={app.status === "rejected"}
                                      className="px-3 py-1.5 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                                    >
                                      <X size={14} /> Reject
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                    </div>
                  )}

                  {/* SUB-TAB 3: ONLINE SUPPORT */}
                  {controlCenterTab === "support" && (
                    <div className="space-y-6">
                      
                      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center justify-between">
                        <div>
                          <strong>Online Citizen Support:</strong> Public users can support approved events online.
                          <span className="block text-[11px] text-amber-800 font-normal mt-0.5">Prepared for future Razorpay integration. Real Supabase records only.</span>
                        </div>
                        <span className="px-2.5 py-1 bg-amber-200 border border-amber-300 text-amber-950 font-black text-[10px] uppercase rounded">
                          Razorpay Ready
                        </span>
                      </div>

                      {/* Summary Cards */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-center">
                          <div className="text-xs font-black text-slate-500 uppercase">Total Supporters</div>
                          <div className="text-2xl font-black text-slate-900 mt-1">{onlineSupport.length}</div>
                        </div>

                        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-center">
                          <div className="text-xs font-black text-slate-500 uppercase">Total Pledged</div>
                          <div className="text-2xl font-black text-emerald-700 mt-1">
                            ₹{onlineSupport.reduce((acc, s) => acc + (Number(s.pledge_amount) || 0), 0).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      {/* Support Messages List */}
                      {onlineSupport.length === 0 ? (
                        <div className="p-6 text-center border border-dashed border-slate-300 rounded-xl text-xs text-slate-500 font-medium">
                          No online support messages received yet.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {onlineSupport.map((sup) => (
                            <div key={sup.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-start justify-between">
                              <div>
                                <div className="font-black text-sm text-slate-900">{sup.supporter_name || "Anonymous Citizen"}</div>
                                <p className="text-xs text-slate-600 mt-1 font-medium">"{sup.support_message || "I support this assembly cause."}"</p>
                              </div>
                              <span className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                                ₹{sup.pledge_amount}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                    </div>
                  )}

                  {/* SUB-TAB 4: HOST UPDATES & TIMELINE */}
                  {controlCenterTab === "updates" && (
                    <div className="space-y-6">
                      
                      {/* Publish Update Form */}
                      <form onSubmit={handlePublishUpdate} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                          Publish Verified Host Announcement
                        </h4>
                        <input
                          type="text"
                          required
                          value={updateTitle}
                          onChange={(e) => setUpdateTitle(e.target.value)}
                          placeholder="Announcement Title (e.g., Medical Desk Setup Ready)"
                          className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-red-600"
                        />
                        <textarea
                          required
                          rows={2}
                          value={updateContent}
                          onChange={(e) => setUpdateContent(e.target.value)}
                          placeholder="Official announcement content to display on public event timeline..."
                          className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-red-600"
                        />
                        <button
                          type="submit"
                          disabled={updateSubmitting}
                          className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition disabled:opacity-50"
                        >
                          {updateSubmitting ? "Publishing..." : "Publish Announcement"}
                        </button>
                      </form>

                      {/* Timeline Feed */}
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 mb-3">Published Host Updates ({eventUpdates.length})</h4>
                        {eventUpdates.length === 0 ? (
                          <div className="p-6 text-center border border-dashed border-slate-300 rounded-xl text-xs text-slate-500 font-medium">
                            No updates published yet. Use the form above to post announcements.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {eventUpdates.map((up) => (
                              <div key={up.id} className="p-4 rounded-xl border border-amber-200 bg-white shadow-sm">
                                <div className="flex items-center justify-between">
                                  <span className="px-2 py-0.5 rounded bg-red-50 text-red-800 border border-red-200 text-[10px] font-black uppercase tracking-wider">
                                    {up.update_type}
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-400">
                                    {new Date(up.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <h5 className="font-black text-sm text-slate-900 mt-2">{up.title}</h5>
                                <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed">{up.content}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>
                  )}

                  {/* SUB-TAB 5: PRIVATE NOC DOCUMENTS */}
                  {controlCenterTab === "documents" && (
                    <div className="space-y-4">
                      
                      <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs font-semibold flex items-center justify-between">
                        <div>
                          <strong>Private Official Documents:</strong> Documents uploaded during event creation are stored in a private Supabase Storage bucket.
                          <span className="block text-[11px] text-red-800 font-normal mt-0.5">Not exposed to Citizens. Accessible only to Host & Government Authorities.</span>
                        </div>
                        <Lock size={18} className="text-red-700 flex-shrink-0" />
                      </div>

                      {eventDocs.length === 0 ? (
                        <div className="p-6 text-center border border-dashed border-slate-300 rounded-xl text-xs text-slate-500 font-medium">
                          No private NOC documents uploaded for this event application.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {eventDocs.map((doc) => (
                            <div key={doc.id} className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <FileText size={20} className="text-red-700" />
                                <div>
                                  <div className="text-xs font-black text-slate-900">{doc.document_name}</div>
                                  <div className="text-[10px] text-slate-500 font-semibold">{new Date(doc.uploaded_at).toLocaleDateString()}</div>
                                </div>
                              </div>
                              <span className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-[10px] font-black uppercase">
                                Private
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                    </div>
                  )}

                </>
              )}

            </div>

            {/* Modal Footer */}
            <div className="bg-slate-100 border-t border-slate-200 px-6 py-3 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-500">Event ID: {selectedEvent.id}</span>
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-lg font-black uppercase tracking-wider"
              >
                Close Control Center
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 5. CELEBRATORY EVENT CREATION SUCCESS MODAL */}
      {createdSuccessEvent && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border-2 border-amber-300 shadow-2xl w-full max-w-lg my-6 overflow-hidden animate-pop-in">
            
            {/* Header Banner with Pop Icon */}
            <div className="bg-gradient-to-r from-red-950 via-slate-900 to-red-950 p-6 text-center text-white relative border-b border-red-900/80">
              <button
                onClick={() => setCreatedSuccessEvent(null)}
                className="absolute top-4 right-4 grid h-8 w-8 place-items-center rounded-lg bg-red-900/80 text-white hover:bg-red-800 transition"
                aria-label="Close"
              >
                <X size={18} />
              </button>

              {/* Animated Celebration Badge */}
              <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-tr from-amber-500 via-red-600 to-red-700 text-white shadow-xl shadow-amber-500/20 ring-4 ring-amber-300/30 animate-pop-in">
                <Sparkles size={32} className="text-white animate-pulse" />
              </div>

              {/* Required Text 1 & Text 2 */}
              <h2 className="text-2xl font-black uppercase tracking-tight text-white">
                Event Created Successfully
              </h2>
              <p className="mt-2 text-xs sm:text-sm font-semibold text-amber-200/90 flex items-center justify-center gap-1.5">
                <Clock size={15} className="text-amber-400 flex-shrink-0" />
                <span>Your event is now pending Authority approval.</span>
              </p>
            </div>

            {/* Modal Body: Generated Event QR Code & Info */}
            <div className="p-6 space-y-5 bg-[#fffdf7]">
              
              {/* Generated Event QR Card */}
              <div className="bg-white border-2 border-amber-200/90 rounded-2xl p-5 shadow-sm text-center flex flex-col items-center justify-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-red-700 mb-1">
                  GENERATED ASSEMBLY QR CODE
                </span>

                <div className="p-3 bg-slate-50 border border-amber-300 rounded-2xl shadow-inner my-2">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=PURATCHI-EVENT-${createdSuccessEvent.id}`}
                    alt="Generated Event QR Code"
                    className="w-44 h-44 object-contain mx-auto"
                  />
                </div>

                <div className="text-[11px] font-mono font-bold text-slate-600 mt-1">
                  ID: {createdSuccessEvent.id}
                </div>

                <a
                  href={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=PURATCHI-EVENT-${createdSuccessEvent.id}`}
                  target="_blank"
                  download={`PURATCHI_QR_${createdSuccessEvent.id}.png`}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-sm"
                >
                  <Download size={14} /> Download Event QR
                </a>
              </div>

              {/* Event Metadata Summary */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-xs">
                <div className="font-black text-sm text-slate-900 border-b border-slate-200 pb-1.5">
                  {createdSuccessEvent.title}
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-600">
                  <div><span className="font-bold text-slate-500">Category:</span> {createdSuccessEvent.category}</div>
                  <div><span className="font-bold text-slate-500">Date:</span> {createdSuccessEvent.event_date}</div>
                  <div className="col-span-2"><span className="font-bold text-slate-500">Venue:</span> {createdSuccessEvent.place_of_assembly}, {createdSuccessEvent.location_name}</div>
                </div>
              </div>

              {/* Protocol Note */}
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold flex items-start gap-2.5">
                <AlertCircle size={16} className="text-amber-700 flex-shrink-0 mt-0.5" />
                <span>
                  The 24-hour regulatory approval window is active. Once approved by jurisdiction authority, your assembly goes live on the public discovery map.
                </span>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3">
                <button
                  onClick={() => {
                    const ev = createdSuccessEvent;
                    setCreatedSuccessEvent(null);
                    loadEventControlData(ev);
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 bg-red-700 hover:bg-red-800 text-white text-xs font-black uppercase tracking-wider rounded-xl transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <QrCode size={14} /> Open Control Center
                </button>

                <button
                  onClick={() => setCreatedSuccessEvent(null)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Done
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* Official QR Code Modal */}
      <QRCodeModal
        isOpen={!!qrModalEvent}
        onClose={() => setQrModalEvent(null)}
        event={qrModalEvent}
      />

      {/* Footer */}
      <footer className="w-full bg-slate-950 border-t border-slate-800 px-4 py-6 text-center text-xs font-semibold text-slate-400">
        © 2026 PURATCHI — Dynamic Supabase Host Dashboard
      </footer>
    </main>
  );
}

// Status Badge Component
function StatusBadge({ status }: { status: EventItem["status"] }) {
  const statusStyles: Record<EventItem["status"], string> = {
    draft: "bg-slate-100 text-slate-800 border-slate-300",
    pending: "bg-amber-50 text-amber-900 border-amber-300",
    request_info: "bg-amber-100 text-amber-900 border-amber-400 font-black",
    approved: "bg-emerald-50 text-emerald-900 border-emerald-300",
    rejected: "bg-red-50 text-red-900 border-red-300",
    revoked: "bg-red-950 text-red-100 border-red-600 font-black",
    expired: "bg-orange-50 text-orange-900 border-orange-300",
    upcoming: "bg-blue-50 text-blue-900 border-blue-300",
    ongoing: "bg-purple-50 text-purple-900 border-purple-300",
    completed: "bg-teal-50 text-teal-900 border-teal-300",
    archived: "bg-slate-200 text-slate-700 border-slate-400"
  };

  const statusLabels: Record<EventItem["status"], string> = {
    draft: "Draft",
    pending: "Pending Authority Review (24h)",
    request_info: "Clarification / Docs Requested",
    approved: "Verified & Approved",
    rejected: "Application Rejected",
    revoked: "Verification Revoked / Unverified",
    expired: "Review Expired",
    upcoming: "Upcoming Assembly",
    ongoing: "Ongoing Assembly",
    completed: "Completed",
    archived: "Archived"
  };

  return (
    <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border inline-flex items-center gap-1 ${statusStyles[status] || statusStyles.pending}`}>
      {status === "pending" && <Clock size={10} />}
      {status === "approved" && <CheckCircle2 size={10} />}
      {status === "request_info" && <HelpCircle size={10} />}
      {status === "revoked" && <AlertTriangle size={10} className="text-red-400" />}
      {statusLabels[status] || status}
    </span>
  );
}
