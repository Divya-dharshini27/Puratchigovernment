"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { 
  X, Download, Copy, Check, Printer, ShieldCheck, 
  AlertCircle, RefreshCw, Calendar, MapPin, ExternalLink, QrCode
} from "lucide-react";
import { EventItem } from "../../lib/types";

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventItem | null;
}

export default function QRCodeModal({
  isOpen,
  onClose,
  event
}: QRCodeModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [token, setToken] = useState<string | null>(null);
  const [verificationUrl, setVerificationUrl] = useState<string>("");
  const [loadingToken, setLoadingToken] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !event) return;

    // If event already has a token, build URL immediately
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    
    if (event.qr_token) {
      setToken(event.qr_token);
      setVerificationUrl(`${origin}/authority/scan?token=${event.qr_token}`);
    } else {
      // Fetch or generate token via server API
      async function fetchToken() {
        if (!event) return;
        setLoadingToken(true);
        try {
          const res = await fetch(`/api/events/${event.id}/qr`);
          const data = await res.json();
          if (data.success && data.qr_token) {
            setToken(data.qr_token);
            setVerificationUrl(data.verification_url || `${origin}/authority/scan?token=${data.qr_token}`);
          } else {
            // Fallback to ID
            const fallbackToken = `PQ-${event.id.slice(0, 16)}`;
            setToken(fallbackToken);
            setVerificationUrl(`${origin}/authority/scan?token=${fallbackToken}`);
          }
        } catch (err) {
          console.error("Failed to load QR token:", err);
          const fallbackToken = `PQ-${event.id.slice(0, 16)}`;
          setToken(fallbackToken);
          setVerificationUrl(`${origin}/authority/scan?token=${fallbackToken}`);
        } finally {
          setLoadingToken(false);
        }
      }
      fetchToken();
    }
  }, [isOpen, event]);

  if (!isOpen || !event) return null;

  // QR Code Image URL (High Resolution 360x360)
  const qrData = verificationUrl || (token ? `PURATCHI-QR-${token}` : `PURATCHI-EVENT-${event.id}`);
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(qrData)}&margin=10`;
  const highResQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=800x800&data=${encodeURIComponent(qrData)}&margin=15`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(verificationUrl || qrData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await fetch(highResQrUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `PURATCHI_PASS_${event.title.replace(/[^a-zA-Z0-9]/g, "_")}_${token || event.id.slice(0, 8)}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
      window.open(highResQrUrl, "_blank");
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-950 border-2 border-red-900/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-red-600/20 text-red-400 border border-red-500/30">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 className="font-black text-sm text-white uppercase tracking-wider">Official Statutory Assembly Pass</h3>
              <p className="text-[11px] text-slate-400">Government Regulatory Clearance Token</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body / Printable Pass Container */}
        <div className="p-6 overflow-y-auto space-y-5" ref={printRef}>
          
          {/* Security Banner */}
          <div className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
            event.status === "revoked" || event.qr_status === "revoked"
              ? "bg-red-950/80 border-red-600 text-red-200"
              : "bg-amber-950/40 border-amber-800/80 text-amber-200"
          }`}>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${
                event.status === "revoked" || event.qr_status === "revoked"
                  ? "bg-red-500 animate-ping"
                  : "bg-emerald-400 animate-ping"
              } shrink-0`} />
              <span className="font-bold text-[11px] uppercase tracking-wide">
                Regulatory Pass Status: {
                  event.status === "revoked" || event.qr_status === "revoked"
                    ? "REVOKED & INVALIDATED"
                    : event.status === "approved"
                    ? "APPROVED & SANCTIONED"
                    : event.status.toUpperCase()
                }
              </span>
            </div>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
              event.status === "revoked" || event.qr_status === "revoked"
                ? "bg-red-900 text-red-100 font-bold"
                : "bg-amber-900/50 text-amber-300"
            }`}>
              {event.status === "revoked" || event.qr_status === "revoked" ? "INVALID" : "Sovereign Auth"}
            </span>
          </div>

          {/* QR Code Presentation Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center flex flex-col items-center">
            
            <div className="mb-2">
              <span className={`text-[10px] font-black uppercase tracking-widest ${
                event.status === "revoked" || event.qr_status === "revoked" ? "text-red-400" : "text-red-400"
              }`}>
                STATUTORY FIELD VERIFICATION
              </span>
              <h4 className="text-base font-black text-white mt-0.5 line-clamp-1">
                {event.title}
              </h4>
            </div>

            {/* QR Visual */}
            <div className="my-3 p-3 bg-white rounded-xl shadow-xl border-4 border-amber-500/20 relative group">
              {loadingToken ? (
                <div className="w-48 h-48 flex flex-col items-center justify-center text-slate-900">
                  <RefreshCw size={28} className="animate-spin text-red-600 mb-2" />
                  <span className="text-xs font-bold">Securing Token...</span>
                </div>
              ) : (
                <div className="relative">
                  <img
                    src={qrImageUrl}
                    alt={`Pass QR for ${event.title}`}
                    className={`w-48 h-48 object-contain mx-auto ${
                      event.status === "revoked" || event.qr_status === "revoked" ? "opacity-30 grayscale" : ""
                    }`}
                  />
                  {(event.status === "revoked" || event.qr_status === "revoked") && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/80 rounded-lg p-2 text-center">
                      <span className="text-xs font-black uppercase tracking-widest text-white bg-red-700 px-2 py-1 rounded shadow">
                        PASS REVOKED
                      </span>
                      <span className="text-[10px] font-bold text-red-200 mt-1">
                        Invalid for Entry
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Token Badge */}
            <div className="w-full max-w-xs space-y-1">
              <div className="flex items-center justify-center gap-1.5 py-1 px-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-amber-300">
                <span className="text-slate-500 text-[10px]">PASS TOKEN:</span>
                <span className="font-bold tracking-wider">{token || event.qr_token || event.id.slice(0, 16)}</span>
              </div>
              <p className="text-[10px] text-slate-400">
                Point official Authority terminal camera to inspect live dossier.
              </p>
            </div>

          </div>

          {/* Event Quick Specs */}
          <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2 text-slate-300">
              <Calendar size={13} className="text-red-400 shrink-0" />
              <span className="truncate">{event.event_date} ({event.start_time})</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <MapPin size={13} className="text-red-400 shrink-0" />
              <span className="truncate">{event.place_of_assembly || event.location_name}</span>
            </div>
            <div className="text-[11px] text-slate-400 col-span-2 pt-1 border-t border-slate-800/80 flex items-center justify-between">
              <span>Category: <strong className="text-slate-200">{event.category}</strong></span>
              <span>Attendance: <strong className="text-amber-400">{event.expected_attendance?.toLocaleString()}</strong></span>
            </div>
          </div>

          {/* Official Verification URL Box */}
          <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Official Regulatory Verification URL
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={verificationUrl || `${typeof window !== "undefined" ? window.location.origin : ""}/authority/scan?token=${token || event.id}`}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-slate-300 select-all focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0"
              >
                {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>

        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition flex items-center gap-1.5"
              title="Print Pass Slip"
            >
              <Printer size={14} />
              <span>Print Slip</span>
            </button>

            <button
              onClick={handleDownload}
              disabled={downloading}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black transition flex items-center gap-1.5 shadow-md disabled:opacity-50"
            >
              {downloading ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
              <span>Download High-Res PNG</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
