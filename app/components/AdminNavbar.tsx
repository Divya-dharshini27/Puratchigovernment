"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ShieldCheck, LogOut, QrCode, FileText, 
  MapPin, Building2, User, ChevronDown, CheckCircle2 
} from "lucide-react";
import { createClient } from "../../lib/supabase/client";
import { AdminProfile } from "../../lib/types";

interface AdminNavbarProps {
  profile: AdminProfile | null;
  onOpenQRScanner?: () => void;
  onOpenAuditLogs?: () => void;
  activeSection?: "events" | "audit" | "overview";
}

export default function AdminNavbar({
  profile,
  onOpenQRScanner,
  onOpenAuditLogs
}: AdminNavbarProps) {
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/admin/login");
  };

  const getJurisdictionLabel = () => {
    if (!profile) return "Administrative";
    if (profile.role === "government") {
      if (profile.jurisdiction_level === "central") return "Central Government (National)";
      if (profile.jurisdiction_level === "state") return `State Government (${profile.state || "State"})`;
      if (profile.jurisdiction_level === "district") return `District Admin (${profile.district || "District"})`;
      return "Government Administration";
    }
    if (profile.role === "authority") {
      return `Authority (${profile.district || profile.state || "Jurisdiction"})`;
    }
    return "Official";
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-slate-950 text-white border-b border-red-950 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Left Branding & Insignia */}
          <div className="flex items-center gap-3">
            <Link 
              href={profile?.role === "authority" ? "/authority/dashboard" : "/government/dashboard"}
              className="flex items-center gap-2.5 group focus:outline-none"
            >
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-red-600 to-red-800 text-white font-black text-sm shadow-md border border-red-500/40 group-hover:scale-105 transition">
                P
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-black text-base tracking-wider uppercase text-white">
                    PURATCHI
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-red-900/80 text-amber-300 border border-red-700/60">
                    {profile?.role === "authority" ? "AUTHORITY PORTAL" : "GOVERNMENT PORTAL"}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-medium tracking-tight hidden sm:block">
                  Civil Assembly & Regulatory Administrative Console
                </span>
              </div>
            </Link>
          </div>

          {/* Right Action & Profile Toolbar */}
          <div className="flex items-center gap-2 sm:gap-4">
            
            {/* Jurisdiction Badge */}
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs font-medium">
              <Building2 size={13} className="text-red-400" />
              <span>{getJurisdictionLabel()}</span>
            </div>

            {/* Authority QR Scanner Trigger */}
            {onOpenQRScanner && (
              <button
                onClick={onOpenQRScanner}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-bold transition shadow-sm border border-red-500"
                title="Scan Event QR Code"
              >
                <QrCode size={15} />
                <span className="hidden sm:inline">Scan Event QR</span>
              </button>
            )}

            {/* Audit Logs Trigger */}
            {onOpenAuditLogs && (
              <button
                onClick={onOpenAuditLogs}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 active:scale-95 text-slate-200 hover:text-white text-xs font-semibold transition border border-slate-700"
                title="View Administrative Audit Trail"
              >
                <FileText size={15} className="text-amber-400" />
                <span className="hidden sm:inline">Audit Trail</span>
              </button>
            )}

            {/* Officer Profile Card */}
            {profile && (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-slate-800 border border-slate-700 text-red-400 font-bold text-xs">
                  {profile.full_name?.charAt(0)?.toUpperCase() || "O"}
                </div>
                <div className="hidden lg:flex flex-col text-left">
                  <span className="text-xs font-bold text-slate-200 truncate max-w-[130px]">
                    {profile.full_name}
                  </span>
                  <span className="text-[10px] text-slate-400 truncate max-w-[130px]">
                    {profile.designation || profile.department || (profile.role === "authority" ? "Statutory Officer" : "Government Official")}
                  </span>
                </div>
              </div>
            )}

            {/* Sign Out Button */}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/40 transition text-xs font-semibold"
              title="Secure Sign Out"
            >
              <LogOut size={15} />
              <span className="hidden md:inline">Sign Out</span>
            </button>

          </div>
        </div>
      </div>
    </header>
  );
}
