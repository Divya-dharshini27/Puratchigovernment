"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Building2, ShieldCheck, QrCode, Lock, ArrowRight, 
  FileText, CheckCircle2, Clock, AlertTriangle, Landmark, 
  Users, MapPin, Eye, RefreshCw 
} from "lucide-react";
import { createClient } from "../lib/supabase/client";
import QRScannerModal from "./components/QRScannerModal";
import EventDossierModal from "./components/EventDossierModal";
import { EventItem } from "../lib/types";

export default function AdminHomePage() {
  const router = useRouter();
  const supabase = createClient();

  // Metrics State
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    districtsCount: 38
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // QR & Dossier Modal for Quick Action
  const [showQRModal, setShowQRModal] = useState(false);
  const [scannedEvent, setScannedEvent] = useState<EventItem | null>(null);
  const [showDossierModal, setShowDossierModal] = useState(false);

  // Check if already authenticated as Admin
  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("auth_user_id", session.user.id)
          .maybeSingle();

        if (profile?.role === "government") {
          router.replace("/government/dashboard");
        } else if (profile?.role === "authority") {
          router.replace("/authority/dashboard");
        }
      }
    }
    checkAuth();
  }, [router, supabase]);

  // Fetch Public Assembly Telemetry
  useEffect(() => {
    async function fetchStats() {
      try {
        const { data, error } = await supabase
          .from("events")
          .select("status");

        if (!error && data) {
          const total = data.length;
          const pending = data.filter(e => e.status === "pending" || e.status === "draft").length;
          const approved = data.filter(e => e.status === "approved" || e.status === "upcoming" || e.status === "ongoing").length;
          setStats(prev => ({ ...prev, total, pending, approved }));
        }
      } catch (err) {
        console.warn("Could not load stats:", err);
      } finally {
        setLoadingStats(false);
      }
    }
    fetchStats();
  }, [supabase]);

  const handleEventScanned = (event: EventItem) => {
    setScannedEvent(event);
    setShowDossierModal(true);
  };

  return (
    <div className="min-h-screen bg-[#fffdf7] text-slate-900 font-sans flex flex-col justify-between selection:bg-red-600/20 selection:text-red-950">
      
      {/* Top Bar Header */}
      <header className="w-full bg-slate-950 border-b border-red-950 px-4 sm:px-8 py-3.5 text-white flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-red-600 to-red-800 text-white font-black text-sm shadow">
            P
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-black text-base tracking-wider uppercase text-white">PURATCHI</span>
              <span className="text-[10px] font-bold text-amber-300 uppercase px-2 py-0.5 rounded bg-red-950 border border-red-800">
                ADMIN CONSOLE
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium tracking-tight">
              Government & Statutory Authority Administrative Portal
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setShowQRModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition shadow-sm border border-red-500 active:scale-95"
          >
            <QrCode size={14} />
            <span className="hidden sm:inline">Scan Event QR</span>
          </button>

          <Link
            href="/government/login"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 hover:text-amber-300 text-xs font-bold transition border border-slate-700 shadow-sm"
          >
            <Landmark size={13} />
            <span>Government Login</span>
          </Link>

          <Link
            href="/authority/login"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-800 hover:bg-red-700 text-white text-xs font-bold transition border border-red-700 shadow-sm"
          >
            <ShieldCheck size={13} />
            <span>Authority Login</span>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 sm:py-16 max-w-6xl mx-auto w-full">
        
        {/* Security Classification Banner */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-950/80 border border-red-800 text-red-200 text-xs font-semibold mb-6 shadow-sm">
          <Lock size={13} className="text-red-400" />
          <span>Restricted Administrative Terminal • Law Enforcement & Civil Administration Only</span>
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-5xl font-black text-center text-slate-900 tracking-tight max-w-3xl leading-tight mb-4">
          Civil Assemblies & Public Order Administration Console
        </h1>

        <p className="text-sm sm:text-base text-center text-slate-600 max-w-2xl mb-10 leading-relaxed">
          The sovereign digital regulatory platform coordinating real-time statutory review, private document inspection, field QR verification, and multi-tier government oversight.
        </p>

        {/* Portals Selection Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl mb-12">
          
          {/* 1. Government Administration Portal Card */}
          <div className="p-6 sm:p-8 rounded-2xl bg-white border-2 border-slate-200 hover:border-slate-400 shadow-xl flex flex-col justify-between transition group">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-slate-950 text-amber-400 shadow">
                  <Landmark size={24} />
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                  CENTRAL • STATE • DISTRICT
                </span>
              </div>

              <h2 className="text-xl font-black text-slate-900 mb-2 group-hover:text-red-700 transition">
                Government Administration Portal
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed mb-6">
                Multi-jurisdictional intelligence for Central, State, and District administrations. Monitor public gatherings, assess crowd safety compliance, track inter-departmental clearances, and audit decision logs.
              </p>

              <div className="space-y-2 text-xs text-slate-500 font-medium mb-6">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>National, State & District hierarchy scoping</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>Private host permit documents inspection</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>Immutable administrative audit trail</span>
                </div>
              </div>
            </div>

            <Link
              href="/government/login"
              className="w-full py-3 rounded-xl bg-slate-950 hover:bg-slate-800 active:scale-98 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-md"
            >
              <span>Enter Government Console</span>
              <ArrowRight size={15} />
            </Link>
          </div>

          {/* 2. Statutory Authority Portal Card */}
          <div className="p-6 sm:p-8 rounded-2xl bg-white border-2 border-red-200 hover:border-red-400 shadow-xl flex flex-col justify-between transition group">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-red-700 text-white shadow">
                  <ShieldCheck size={24} />
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-800 border border-red-200">
                  STATUTORY CLEARANCE
                </span>
              </div>

              <h2 className="text-xl font-black text-slate-900 mb-2 group-hover:text-red-700 transition">
                Statutory Authority Portal
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed mb-6">
                Designed for Police Commissionerates, Municipal Authorities, and Fire/Safety regulators. Scan host QR codes, review logistics, evaluate routes and sound systems, and issue binding approval or rejection directives.
              </p>

              <div className="space-y-2 text-xs text-slate-500 font-medium mb-6">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-red-600 shrink-0" />
                  <span>Instant Event QR scanner & dossier lookup</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-red-600 shrink-0" />
                  <span>24-hour statutory review SLA deadline queue</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-red-600 shrink-0" />
                  <span>Real-time sync to Public & Host portals</span>
                </div>
              </div>
            </div>

            <Link
              href="/authority/login"
              className="w-full py-3 rounded-xl bg-red-700 hover:bg-red-800 active:scale-98 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-md"
            >
              <span>Enter Authority Console</span>
              <ArrowRight size={15} />
            </Link>
          </div>

        </div>

        {/* Live System Telemetry Bar */}
        <div className="w-full max-w-4xl p-5 rounded-2xl bg-slate-950 text-white shadow-xl border border-red-950/60">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              <span>National Assembly Regulatory Telemetry</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Shared Supabase Database</span>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-xl sm:text-2xl font-black text-white">{stats.total}</div>
              <div className="text-[10px] text-slate-400 uppercase font-bold mt-0.5">Total Assemblies</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-xl sm:text-2xl font-black text-amber-400">{stats.pending}</div>
              <div className="text-[10px] text-amber-300 uppercase font-bold mt-0.5">Awaiting Clearance</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-xl sm:text-2xl font-black text-emerald-400">{stats.approved}</div>
              <div className="text-[10px] text-emerald-300 uppercase font-bold mt-0.5">Approved & Active</div>
            </div>
          </div>
        </div>

      </main>

      {/* QR Scanner Modal (Direct from Landing) */}
      <QRScannerModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        onEventScanned={handleEventScanned}
      />

      {/* Event Dossier Modal */}
      <EventDossierModal
        isOpen={showDossierModal}
        event={scannedEvent}
        currentUser={null}
        onClose={() => {
          setShowDossierModal(false);
          setScannedEvent(null);
        }}
      />

      {/* Official Footer */}
      <footer className="w-full py-5 text-center text-xs text-slate-500 bg-white border-t border-slate-200">
        PURATCHI Government & Statutory Authority Administrative Console • Second Website Deployment • Unauthorized Entry Prohibited
      </footer>

    </div>
  );
}