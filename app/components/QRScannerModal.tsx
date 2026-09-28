"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { 
  QrCode, X, Camera, Upload, Keyboard, 
  AlertCircle, CheckCircle2, RefreshCw, Search, 
  ShieldAlert, ShieldX, Clock, MapPin 
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { EventItem } from "../../lib/types";

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEventScanned: (event: EventItem) => void;
}

export default function QRScannerModal({
  isOpen,
  onClose,
  onEventScanned
}: QRScannerModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [activeTab, setActiveTab] = useState<"camera" | "upload" | "manual">("camera");
  const [manualCode, setManualCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = "puratchi-qr-reader";

  // Stop camera stream safely
  const stopCamera = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.warn("Failed to stop scanner cleanly:", err);
      }
    }
    setCameraActive(false);
  };

  // Start camera stream
  const startCamera = async () => {
    setErrorMessage(null);
    setErrorType(null);
    setSuccessMessage(null);

    // Give DOM time to render the reader element
    setTimeout(async () => {
      try {
        if (!scannerRef.current) {
          scannerRef.current = new Html5Qrcode(scannerContainerId);
        }

        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        };

        await scannerRef.current.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            handleDecodedText(decodedText);
          },
          () => {
            // Ignore frame scan misses
          }
        );

        setCameraActive(true);
      } catch (err: any) {
        console.error("Camera start error:", err);
        setErrorMessage(
          err?.message?.includes("Permission") 
            ? "Camera permission denied. Please allow camera access or use the File Upload / Manual Entry options." 
            : "Could not access camera. Please use File Upload or enter the Event Code directly."
        );
        setCameraActive(false);
      }
    }, 200);
  };

  // Lifecycle control for modal
  useEffect(() => {
    if (isOpen && activeTab === "camera") {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab]);

  // Clean code payload
  const sanitizeQRInput = (raw: string): string => {
    let trimmed = raw.trim();
    try {
      if (trimmed.includes("http://") || trimmed.includes("https://") || trimmed.includes("?token=")) {
        const urlObj = new URL(trimmed, "http://localhost");
        const tokenParam = urlObj.searchParams.get("token");
        if (tokenParam) return tokenParam.trim();
      }
    } catch {
      // Not a valid URL, proceed with trimmed string
    }
    return trimmed;
  };

  // Call Server-Side QR Validation API Route
  const handleDecodedText = async (decodedText: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setErrorMessage(null);
    setErrorType(null);

    const cleanCode = sanitizeQRInput(decodedText);

    try {
      const response = await fetch("/api/authority/validate-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrCode: cleanCode })
      });

      const result = await response.json();

      if (!response.ok || !result.valid) {
        setErrorType(result.reason || "invalid");
        setErrorMessage(result.message || "Failed to validate QR code.");
        setIsProcessing(false);
        return;
      }

      // Stop camera
      await stopCamera();

      setSuccessMessage(result.message || `Verified: ${result.event.title}`);
      
      setTimeout(() => {
        setIsProcessing(false);
        onEventScanned(result.event);
        onClose();
      }, 700);

    } catch (err: any) {
      console.error("Error verifying QR event:", err);
      setErrorMessage(err.message || "Network error while verifying QR code with the sovereign registry.");
      setErrorType("network");
      setIsProcessing(false);
    }
  };

  // Handle Image File Upload for QR decode
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setErrorType(null);

    try {
      const html5QrCode = new Html5Qrcode("puratchi-file-scanner-temp");
      const decodedText = await html5QrCode.scanFile(file, true);
      await html5QrCode.clear();
      await handleDecodedText(decodedText);
    } catch (err: any) {
      console.error("File QR scan error:", err);
      setErrorMessage("Could not detect a valid PURATCHI Event QR code in this image. Please ensure the QR is clear and well-lit.");
      setErrorType("scan_failed");
      setIsProcessing(false);
    }
  };

  // Handle Manual Code Submission
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) {
      setErrorMessage("Please enter an Event Verification Token or UUID.");
      return;
    }
    await handleDecodedText(manualCode);
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border-2 border-red-800/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-red-600/20 text-red-400 border border-red-500/30">
              <QrCode size={18} />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Statutory QR Verification Terminal</h3>
              <p className="text-xs text-slate-400">Server-Side Authentication &amp; Jurisdiction Boundary Enforcement</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-3 border-b border-slate-800 bg-slate-950/60 p-1 text-xs font-semibold text-slate-400">
          <button
            onClick={() => {
              setActiveTab("camera");
            }}
            className={`py-2 rounded-md flex items-center justify-center gap-1.5 transition ${
              activeTab === "camera"
                ? "bg-red-600 text-white shadow"
                : "hover:text-slate-200"
            }`}
          >
            <Camera size={14} />
            <span>Camera Scan</span>
          </button>
          <button
            onClick={() => {
              stopCamera();
              setActiveTab("upload");
            }}
            className={`py-2 rounded-md flex items-center justify-center gap-1.5 transition ${
              activeTab === "upload"
                ? "bg-red-600 text-white shadow"
                : "hover:text-slate-200"
            }`}
          >
            <Upload size={14} />
            <span>Upload Image</span>
          </button>
          <button
            onClick={() => {
              stopCamera();
              setActiveTab("manual");
            }}
            className={`py-2 rounded-md flex items-center justify-center gap-1.5 transition ${
              activeTab === "manual"
                ? "bg-red-600 text-white shadow"
                : "hover:text-slate-200"
            }`}
          >
            <Keyboard size={14} />
            <span>Manual Token</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          
          {/* Detailed Error State Notifications */}
          {errorMessage && (
            <div className={`mb-4 p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
              errorType === "jurisdiction_mismatch"
                ? "bg-amber-950/90 border-amber-600 text-amber-200"
                : errorType === "revoked"
                ? "bg-red-950/90 border-red-600 text-red-200"
                : errorType === "expired"
                ? "bg-purple-950/90 border-purple-600 text-purple-200"
                : "bg-red-950/80 border-red-700/80 text-red-200"
            }`}>
              {errorType === "jurisdiction_mismatch" && (
                <ShieldAlert size={18} className="text-amber-400 shrink-0 mt-0.5" />
              )}
              {errorType === "revoked" && (
                <ShieldX size={18} className="text-red-400 shrink-0 mt-0.5" />
              )}
              {errorType === "expired" && (
                <Clock size={18} className="text-purple-400 shrink-0 mt-0.5" />
              )}
              {(!errorType || (errorType !== "jurisdiction_mismatch" && errorType !== "revoked" && errorType !== "expired")) && (
                <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <span className="font-bold block uppercase tracking-wide text-[10px]">
                  {errorType === "jurisdiction_mismatch" ? "Jurisdiction Scope Restricted" :
                   errorType === "revoked" ? "QR Pass Revoked" :
                   errorType === "expired" ? "QR Pass Expired" : "Verification Warning"}
                </span>
                <p className="leading-relaxed">{errorMessage}</p>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3.5 rounded-xl bg-emerald-950/90 border border-emerald-600 text-emerald-200 text-xs flex items-start gap-2.5">
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold block uppercase tracking-wide text-[10px]">Verification Success</span>
                <p>{successMessage}</p>
              </div>
            </div>
          )}

          {/* TAB 1: Live Camera Scanner */}
          {activeTab === "camera" && (
            <div className="flex flex-col items-center">
              <div 
                id={scannerContainerId} 
                className="w-full h-64 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 relative flex items-center justify-center"
              >
                {!cameraActive && (
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <RefreshCw size={24} className="animate-spin text-red-400" />
                    <span className="text-xs">Initializing camera feed...</span>
                  </div>
                )}
              </div>
              <p className="mt-3 text-[11px] text-slate-400 text-center">
                Point camera at the Host's official PURATCHI Assembly Pass QR token.
              </p>
            </div>
          )}

          {/* TAB 2: Upload Image */}
          {activeTab === "upload" && (
            <div className="flex flex-col items-center">
              <div id="puratchi-file-scanner-temp" className="hidden" />
              <label className="w-full h-56 border-2 border-dashed border-slate-700 hover:border-red-500 rounded-xl flex flex-col items-center justify-center cursor-pointer bg-slate-950/50 hover:bg-slate-950 transition p-4 group">
                <Upload size={32} className="text-slate-500 group-hover:text-red-400 mb-2 transition" />
                <span className="text-xs font-bold text-slate-200">Click or Drag &amp; Drop QR Pass Image</span>
                <span className="text-[10px] text-slate-400 mt-1">Supports PNG, JPG, JPEG, WEBP files</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isProcessing}
                />
              </label>
            </div>
          )}

          {/* TAB 3: Manual Entry */}
          {activeTab === "manual" && (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Event Security Token / Code
                </label>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="e.g. PQ-xxxxxxxx or PURATCHI-QR-xxxx or UUID"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500 font-mono"
                    disabled={isProcessing}
                  />
                </div>
                <span className="block text-[10px] text-slate-500 mt-1">
                  Non-sensitive token encoded on the official host assembly pass.
                </span>
              </div>

              <button
                type="submit"
                disabled={isProcessing || !manualCode.trim()}
                className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-700 active:scale-98 text-white font-bold text-xs transition disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Validating with Server...</span>
                  </>
                ) : (
                  <span>Verify Token &amp; Open Dossier</span>
                )}
              </button>
            </form>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <span>Puratchi Sovereign Verification Gateway</span>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="text-slate-400 hover:text-white"
          >
            Cancel
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
