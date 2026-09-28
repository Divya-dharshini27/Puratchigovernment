"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  ShieldCheck, ArrowLeft, RefreshCw, AlertCircle, CheckCircle2, 
  Clock, ShieldAlert, ShieldX, Lock, Camera, Upload, 
  Keyboard, QrCode, ArrowRight, MapPin, Building, User, Eye
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { createClient } from "../../../lib/supabase/client";
import { AdminProfile, EventItem } from "../../../lib/types";
import AdminNavbar from "../../components/AdminNavbar";

function ScanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTokenParam = searchParams.get("token") || searchParams.get("code") || searchParams.get("qr");

  const supabase = createClient();

  // Auth
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);

  // Scan / Verification State
  const [validating, setValidating] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    valid: boolean;
    reason?: "invalid" | "expired" | "revoked" | "jurisdiction_mismatch" | "not_found" | "unauthorized";
    message?: string;
    event?: EventItem | any;
    eventId?: string;
    officer?: any;
    authorizedJurisdiction?: string;
    eventJurisdiction?: string;
  } | null>(null);

  // In-Page Interactive Scanner State (when no token in URL)
  const [activeTab, setActiveTab] = useState<"camera" | "upload" | "manual">("camera");
  const [manualCode, setManualCode] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = "puratchi-authority-scan-container";

  // 1. Authenticate Authority
  useEffect(() => {
    async function checkAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          setAuthRequired(true);
          setAuthLoading(false);
          return;
        }

        const { data: userProfile } = await supabase
          .from("profiles")
          .select("*")
          .eq("auth_user_id", session.user.id)
          .maybeSingle();

        const role = userProfile?.role || session.user.user_metadata?.role;
        if (role !== "authority" && role !== "government") {
          setAuthRequired(true);
          setAuthLoading(false);
          return;
        }

        const officerProf: AdminProfile = {
          auth_user_id: session.user.id,
          full_name: userProfile?.full_name || session.user.user_metadata?.full_name || "Statutory Officer",
          email: session.user.email || "",
          role: "authority",
          district: userProfile?.district || session.user.user_metadata?.district || "Chennai",
          state: userProfile?.state || session.user.user_metadata?.state || "Tamil Nadu",
          department: userProfile?.department || session.user.user_metadata?.department || "City Police Commissionerate"
        };

        setProfile(officerProf);
        setAuthLoading(false);

        // If token param present, verify immediately
        if (rawTokenParam) {
          verifyToken(rawTokenParam);
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        setAuthRequired(true);
        setAuthLoading(false);
      }
    }

    checkAuth();
  }, [supabase, rawTokenParam]);

  // 2. Token Verification API Caller
  const verifyToken = async (tokenToVerify: string) => {
    setValidating(true);
    setVerificationResult(null);
    setScanError(null);

    try {
      const res = await fetch("/api/authority/verify-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenToVerify.trim() })
      });

      const data = await res.json();

      if (res.status === 401) {
        setAuthRequired(true);
        setValidating(false);
        return;
      }

      setVerificationResult(data);

      // If valid and user came directly via URL token, allow instant navigation or on-screen action
      if (data.valid && data.eventId && rawTokenParam) {
        setTimeout(() => {
          router.push(`/authority/events/${data.eventId}`);
        }, 2000);
      }

    } catch (err: any) {
      console.error("Verification error:", err);
      setVerificationResult({
        valid: false,
        reason: "invalid",
        message: err.message || "Network communication failure with the central sovereign registry."
      });
    } finally {
      setValidating(false);
    }
  };

  // Camera Management
  const stopCamera = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.warn("Failed stopping camera cleanly:", err);
      }
    }
    setCameraActive(false);
  };

  const startCamera = async () => {
    setScanError(null);
    setTimeout(async () => {
      try {
        if (!scannerRef.current) {
          scannerRef.current = new Html5Qrcode(containerId);
        }
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }

        await scannerRef.current.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 260 }, aspectRatio: 1.0 },
          (decodedText) => {
            stopCamera();
            verifyToken(decodedText);
          },
          () => {}
        );
        setCameraActive(true);
      } catch (err: any) {
        console.error("Camera start error:", err);
        setScanError("Camera access denied or unavailable. Please use image upload or enter token manually.");
        setCameraActive(false);
      }
    }, 250);
  };

  useEffect(() => {
    if (!rawTokenParam && !authRequired && !authLoading && activeTab === "camera") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [activeTab, rawTokenParam, authRequired, authLoading]);

  // File upload scan
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setValidating(true);
    setScanError(null);
    try {
      const html5Qr = new Html5Qrcode("puratchi-temp-file-scanner");
      const decodedText = await html5Qr.scanFile(file, true);
      await html5Qr.clear();
      verifyToken(decodedText);
    } catch (err) {
      console.error("File decode error:", err);
      setScanError("Could not detect a valid PURATCHI QR Code in this image.");
      setValidating(false);
    }
  };

  // Manual submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    verifyToken(manualCode);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-200">
        <RefreshCw size={32} className="animate-spin text-red-500 mb-3" />
        <span className="text-xs font-bold tracking-wider uppercase">Authenticating Officer Credentials...</span>
      </div>
    );
  }

  // Auth Required Screen
  if (authRequired) {
    const currentPath = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/authority/scan";
    return (
      <div className="min-h-screen bg-[#fffdf7] text-slate-900 flex flex-col justify-between">
        <AdminNavbar profile={null} />
        <div className="max-w-md w-full mx-auto px-4 py-16 text-center space-y-5">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-red-100 text-red-700 grid place-items-center shadow-inner">
            <Lock size={28} />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase text-slate-900">Authority Login Required</h1>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Assembly Pass verification is restricted to official Statutory Enforcement and Government personnel.
            </p>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-md space-y-3">
            <Link
              href={`/authority/login?redirect=${encodeURIComponent(currentPath)}`}
              className="w-full py-3 bg-red-700 hover:bg-red-800 text-white font-black text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 shadow-lg"
            >
              <span>Log in to Authority Terminal</span>
              <ArrowRight size={15} />
            </Link>

            <Link
              href="/"
              className="block text-xs text-slate-500 hover:text-slate-900 font-bold"
            >
              Return to Homepage
            </Link>
          </div>
        </div>
        <footer className="w-full py-4 text-center text-xs text-slate-400 bg-white border-t border-slate-200">
          PURATCHI Statutory Verification Bureau
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fffdf7] text-slate-900 font-sans flex flex-col justify-between selection:bg-red-600/20 selection:text-red-950">
      
      {/* Top Navbar */}
      <AdminNavbar profile={profile} />

      {/* Main Scanner Container */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8 space-y-6">
        
        {/* Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/authority/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-950 transition"
          >
            <ArrowLeft size={15} />
            <span>Return to Authority Queue</span>
          </Link>

          <span className="text-[11px] font-bold text-amber-700 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full">
            Terminal: {profile?.district || "Tamil Nadu"} Division
          </span>
        </div>

        {/* VERIFICATION IN PROGRESS */}
        {validating && (
          <div className="p-8 rounded-2xl bg-slate-900 border-2 border-red-800 text-white shadow-2xl text-center space-y-4 animate-in fade-in">
            <RefreshCw size={36} className="animate-spin text-red-500 mx-auto" />
            <div>
              <h2 className="text-lg font-black tracking-tight">Verifying Sovereign QR Token...</h2>
              <p className="text-xs text-slate-400 mt-1">
                Querying central assembly registry, validating cryptographic hash, and enforcing jurisdiction bounds.
              </p>
            </div>
          </div>
        )}

        {/* VERIFICATION RESULT SCREENS */}
        {!validating && verificationResult && (
          <div className="space-y-4 animate-in fade-in">
            
            {/* 1. SUCCESS STATE */}
            {verificationResult.valid && (
              <div className="p-6 sm:p-8 rounded-2xl bg-slate-900 border-2 border-emerald-500 text-white shadow-2xl space-y-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shrink-0">
                    <CheckCircle2 size={28} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block">
                      Cryptographic Pass Verified
                    </span>
                    <h2 className="text-xl font-black text-white">{verificationResult.event?.title}</h2>
                  </div>
                </div>

                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase block">Assembly Category</span>
                    <span className="font-bold text-slate-200">{verificationResult.event?.category}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase block">Current Status</span>
                    <span className="font-black text-emerald-400 uppercase">{verificationResult.event?.status}</span>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-slate-800 flex items-center gap-1.5 text-slate-300">
                    <MapPin size={13} className="text-red-400 shrink-0" />
                    <span className="truncate">{verificationResult.event?.place_of_assembly || verificationResult.event?.location_name}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Link
                      href={`/authority/events/${verificationResult.eventId || verificationResult.event?.id}`}
                      className="flex-1 sm:flex-initial px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md transition"
                    >
                      <Eye size={14} />
                      <span>Inspect Dossier</span>
                    </Link>

                    <Link
                      href={`/authority/events/${verificationResult.eventId || verificationResult.event?.id}`}
                      className="flex-1 sm:flex-initial px-3.5 py-2.5 bg-red-700 hover:bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md border border-red-500 transition"
                    >
                      <ShieldX size={14} />
                      <span>Emergency Revoke</span>
                    </Link>
                  </div>

                  <button
                    onClick={() => {
                      setVerificationResult(null);
                      if (activeTab === "camera") startCamera();
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
                  >
                    Scan Next Pass
                  </button>
                </div>
              </div>
            )}

            {/* 2. JURISDICTION RESTRICTION ALERT */}
            {!verificationResult.valid && verificationResult.reason === "jurisdiction_mismatch" && (
              <div className="p-6 sm:p-8 rounded-2xl bg-amber-950 border-2 border-amber-500 text-amber-100 shadow-2xl space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 mt-1">
                    <ShieldAlert size={28} />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-400 block">
                      Statutory Jurisdiction Restriction
                    </span>
                    <h2 className="text-lg font-black text-white">
                      Outside Assigned Enforcement Territory
                    </h2>
                    <p className="text-xs text-amber-200 leading-relaxed">
                      {verificationResult.message}
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-black/40 rounded-xl border border-amber-700/60 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-amber-400 text-[10px] uppercase font-bold block">Officer Jurisdiction</span>
                    <span className="font-mono text-white">{verificationResult.authorizedJurisdiction || profile?.district}</span>
                  </div>
                  <div>
                    <span className="text-amber-400 text-[10px] uppercase font-bold block">Event Territory</span>
                    <span className="font-mono text-white">{verificationResult.eventJurisdiction || "Other District"}</span>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => {
                      setVerificationResult(null);
                      if (activeTab === "camera") startCamera();
                    }}
                    className="px-4 py-2 bg-amber-900/80 hover:bg-amber-800 text-white rounded-xl text-xs font-bold transition"
                  >
                    Scan Another Pass
                  </button>
                  <Link
                    href="/authority/dashboard"
                    className="px-4 py-2 bg-white text-slate-950 hover:bg-amber-100 rounded-xl text-xs font-black transition"
                  >
                    Return to Station Dashboard
                  </Link>
                </div>
              </div>
            )}

            {/* 3. REVOKED TOKEN ALERT */}
            {!verificationResult.valid && verificationResult.reason === "revoked" && (
              <div className="p-6 sm:p-8 rounded-2xl bg-red-950 border-2 border-red-600 text-red-100 shadow-2xl space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-red-600/20 text-red-400 shrink-0 mt-1">
                    <ShieldX size={28} />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-black uppercase tracking-wider text-red-400 block">
                      Enforcement Alert
                    </span>
                    <h2 className="text-lg font-black text-white">
                      Assembly Pass Revoked
                    </h2>
                    <p className="text-xs text-red-200 leading-relaxed">
                      {verificationResult.message || "This assembly registration has been revoked by statutory regulatory authority."}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => {
                      setVerificationResult(null);
                      if (activeTab === "camera") startCamera();
                    }}
                    className="px-4 py-2 bg-red-900/80 hover:bg-red-800 text-white rounded-xl text-xs font-bold transition"
                  >
                    Scan Another Pass
                  </button>
                </div>
              </div>
            )}

            {/* 4. EXPIRED TOKEN ALERT */}
            {!verificationResult.valid && verificationResult.reason === "expired" && (
              <div className="p-6 sm:p-8 rounded-2xl bg-purple-950 border-2 border-purple-600 text-purple-100 shadow-2xl space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-purple-600/20 text-purple-400 shrink-0 mt-1">
                    <Clock size={28} />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-black uppercase tracking-wider text-purple-400 block">
                      Validity Expired
                    </span>
                    <h2 className="text-lg font-black text-white">
                      Assembly Authorization Pass Expired
                    </h2>
                    <p className="text-xs text-purple-200 leading-relaxed">
                      {verificationResult.message}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => {
                      setVerificationResult(null);
                      if (activeTab === "camera") startCamera();
                    }}
                    className="px-4 py-2 bg-purple-900/80 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition"
                  >
                    Scan Another Pass
                  </button>
                </div>
              </div>
            )}

            {/* 5. INVALID OR UNKNOWN TOKEN */}
            {!verificationResult.valid && 
              verificationResult.reason !== "jurisdiction_mismatch" && 
              verificationResult.reason !== "revoked" && 
              verificationResult.reason !== "expired" && (
              <div className="p-6 sm:p-8 rounded-2xl bg-slate-900 border-2 border-red-700 text-white shadow-2xl space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-red-600/20 text-red-400 shrink-0 mt-1">
                    <AlertCircle size={28} />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-black uppercase tracking-wider text-red-400 block">
                      Verification Warning
                    </span>
                    <h2 className="text-lg font-black text-white">
                      Invalid or Unregistered Assembly Pass
                    </h2>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {verificationResult.message || "No active assembly record found for this token. Pass may be counterfeit or expired."}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => {
                      setVerificationResult(null);
                      if (activeTab === "camera") startCamera();
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

        {/* INTERACTIVE SCANNER (When no active token validation display) */}
        {!validating && !verificationResult && (
          <div className="bg-slate-900 text-white rounded-2xl border-2 border-red-900/80 shadow-2xl overflow-hidden">
            
            {/* Header */}
            <div className="p-6 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-red-600/20 text-red-400 border border-red-500/30">
                  <QrCode size={20} />
                </div>
                <div>
                  <h2 className="text-base font-black text-white">Statutory Field Scan Terminal</h2>
                  <p className="text-xs text-slate-400">Validate Organizer Assembly Passes on Site</p>
                </div>
              </div>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-3 border-b border-slate-800 bg-slate-950/60 p-1 text-xs font-semibold text-slate-400">
              <button
                onClick={() => setActiveTab("camera")}
                className={`py-2 rounded-md flex items-center justify-center gap-1.5 transition ${
                  activeTab === "camera" ? "bg-red-600 text-white shadow font-bold" : "hover:text-slate-200"
                }`}
              >
                <Camera size={14} />
                <span>Live Camera</span>
              </button>

              <button
                onClick={() => {
                  stopCamera();
                  setActiveTab("upload");
                }}
                className={`py-2 rounded-md flex items-center justify-center gap-1.5 transition ${
                  activeTab === "upload" ? "bg-red-600 text-white shadow font-bold" : "hover:text-slate-200"
                }`}
              >
                <Upload size={14} />
                <span>Upload QR</span>
              </button>

              <button
                onClick={() => {
                  stopCamera();
                  setActiveTab("manual");
                }}
                className={`py-2 rounded-md flex items-center justify-center gap-1.5 transition ${
                  activeTab === "manual" ? "bg-red-600 text-white shadow font-bold" : "hover:text-slate-200"
                }`}
              >
                <Keyboard size={14} />
                <span>Enter Code</span>
              </button>
            </div>

            {/* Scanner Body */}
            <div className="p-6">
              
              {scanError && (
                <div className="mb-4 p-3 rounded-xl bg-red-950 border border-red-800 text-red-200 text-xs flex items-center gap-2">
                  <AlertCircle size={16} className="text-red-400 shrink-0" />
                  <span>{scanError}</span>
                </div>
              )}

              {/* TAB 1: Camera Feed */}
              {activeTab === "camera" && (
                <div className="flex flex-col items-center">
                  <div 
                    id={containerId} 
                    className="w-full h-72 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center relative"
                  >
                    {!cameraActive && (
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <RefreshCw size={24} className="animate-spin text-red-500" />
                        <span className="text-xs">Initializing camera sensor...</span>
                      </div>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-slate-400 text-center">
                    Align official Host Assembly Pass QR code inside the frame.
                  </p>
                </div>
              )}

              {/* TAB 2: Upload File */}
              {activeTab === "upload" && (
                <div className="flex flex-col items-center">
                  <div id="puratchi-temp-file-scanner" className="hidden" />
                  <label className="w-full h-64 border-2 border-dashed border-slate-700 hover:border-red-500 rounded-xl flex flex-col items-center justify-center cursor-pointer bg-slate-950/50 hover:bg-slate-950 transition p-4 group">
                    <Upload size={36} className="text-slate-500 group-hover:text-red-400 mb-2 transition" />
                    <span className="text-xs font-bold text-slate-200">Select or Drag &amp; Drop Pass Image</span>
                    <span className="text-[10px] text-slate-400 mt-1">PNG, JPG, WEBP formats supported</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {/* TAB 3: Manual Code Entry */}
              {activeTab === "manual" && (
                <form onSubmit={handleManualSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Statutory Pass Token / Event UUID
                    </label>
                    <input
                      type="text"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      placeholder="e.g. PQ-xxxxxxxxxxxxxxxx or UUID"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!manualCode.trim()}
                    className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <span>Validate Token</span>
                    <ArrowRight size={14} />
                  </button>
                </form>
              )}

            </div>

          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-slate-400 bg-white border-t border-slate-200">
        PURATCHI Statutory Clearance Bureau &bull; Official Regulatory Enforcement
      </footer>

    </div>
  );
}

export default function AuthorityScanPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-200">
        <RefreshCw size={32} className="animate-spin text-red-500 mb-3" />
        <span className="text-xs font-bold tracking-wider uppercase">Loading Scan Terminal...</span>
      </div>
    }>
      <ScanContent />
    </Suspense>
  );
}
