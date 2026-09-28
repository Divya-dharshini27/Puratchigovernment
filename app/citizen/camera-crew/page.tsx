"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Camera, Upload, Image as ImageIcon, ArrowLeft, RefreshCw, CheckCircle2,
  AlertTriangle, ShieldAlert, Sparkles, Calendar, MapPin, ExternalLink
} from "lucide-react";
import { createClient } from "../../../lib/supabase/client";
import { usePortalNavigation } from "../../components/GlobalPageTransition";

interface ApprovedEvent {
  id: string;
  title: string;
  location_name: string;
  event_date: string;
}

interface PhotoItem {
  id: string;
  event_id: string;
  uploader_id: string;
  uploader_name: string;
  image_url: string;
  caption: string;
  created_at: string;
}

export default function CameraCrewPage() {
  const router = useRouter();
  const supabase = createClient();
  const { navigateTo } = usePortalNavigation();

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [userProfile, setUserProfile] = useState<{ id: string; name: string } | null>(null);

  const [approvedEvents, setApprovedEvents] = useState<ApprovedEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");

  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function verifyCameraCrewAccess() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          setAuthorized(false);
          setLoading(false);
          return;
        }

        const userId = session.user.id;
        const userName = session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Camera Crew Volunteer";
        setUserProfile({ id: userId, name: userName });

        // Query volunteer_applications for status = 'approved' and selected_roles containing 'Camera Crew'
        const { data: apps, error } = await supabase
          .from("volunteer_applications")
          .select("id, event_id, selected_roles, status, events(id, title, location_name, event_date)")
          .eq("applicant_id", userId)
          .eq("status", "approved");

        if (error || !apps || apps.length === 0) {
          setAuthorized(false);
          setLoading(false);
          return;
        }

        // Filter applications that include 'Camera Crew' in selected_roles
        const cameraCrewApps = apps.filter((a: any) =>
          Array.isArray(a.selected_roles) &&
          a.selected_roles.some((r: string) => r.toLowerCase().includes("camera"))
        );

        if (cameraCrewApps.length === 0) {
          setAuthorized(false);
          setLoading(false);
          return;
        }

        // Extract approved events
        const eventsList: ApprovedEvent[] = cameraCrewApps
          .map((a: any) => a.events)
          .filter(Boolean);

        setApprovedEvents(eventsList);
        if (eventsList.length > 0) {
          setSelectedEventId(eventsList[0].id);
        }

        setAuthorized(true);
      } catch (err) {
        console.error("Access verification error:", err);
        setAuthorized(false);
      } finally {
        setLoading(false);
      }
    }

    verifyCameraCrewAccess();
  }, [supabase]);

  // Load photos when selected event changes
  useEffect(() => {
    if (!selectedEventId) return;

    async function loadEventPhotos() {
      const { data, error } = await supabase
        .from("event_photos")
        .select("*")
        .eq("event_id", selectedEventId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setPhotos(data as PhotoItem[]);
      }
    }

    loadEventPhotos();
  }, [selectedEventId, supabase]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handlePhotoUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);
    setUploadSuccess(null);

    if (!selectedEventId) {
      setUploadError("Please select an approved event.");
      return;
    }

    if (!imageFile && !previewUrl) {
      setUploadError("Please select an image file to upload.");
      return;
    }

    setUploading(true);

    try {
      let finalImageUrl = "";

      if (imageFile) {
        // Try uploading to Supabase Storage bucket 'event-gallery'
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${selectedEventId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { data: storageData, error: storageError } = await supabase.storage
          .from("event-gallery")
          .upload(fileName, imageFile, { upsert: true });

        if (!storageError && storageData) {
          const { data: publicUrlData } = supabase.storage
            .from("event-gallery")
            .getPublicUrl(fileName);

          finalImageUrl = publicUrlData.publicUrl;
        } else {
          // Fallback: Use Base64 preview for robust deployment
          finalImageUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(imageFile);
          });
        }
      }

      if (!finalImageUrl) {
        throw new Error("Failed to process image file.");
      }

      // Record in public.event_photos
      const { error: dbError } = await supabase.from("event_photos").insert({
        event_id: selectedEventId,
        uploader_id: userProfile?.id,
        uploader_name: userProfile?.name || "Camera Crew Volunteer",
        image_url: finalImageUrl,
        caption: caption.trim() || "Official Event Photograph",
      });

      if (dbError) {
        throw new Error(dbError.message);
      }

      setUploadSuccess("Photograph successfully uploaded and published to the Public Gallery!");
      setImageFile(null);
      setPreviewUrl(null);
      setCaption("");

      // Refresh photo list
      const { data: freshPhotos } = await supabase
        .from("event_photos")
        .select("*")
        .eq("event_id", selectedEventId)
        .order("created_at", { ascending: false });

      if (freshPhotos) setPhotos(freshPhotos as PhotoItem[]);
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload photo.");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fffdf7] grid place-items-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw size={32} className="animate-spin text-red-700" />
          <p className="text-xs font-black uppercase tracking-wider text-slate-700">Verifying Camera Crew Authorization...</p>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-[#fffdf7] text-slate-900 font-sans flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-red-200 shadow-xl text-center">
          <div className="w-16 h-16 bg-red-100 text-red-700 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-200">
            <ShieldAlert size={32} />
          </div>
          <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">
            Access Restricted
          </h1>
          <p className="text-sm font-medium text-slate-600 mb-6 leading-relaxed">
            The **Camera Crew Portal** is exclusively reserved for volunteers whose application for the **Camera Crew** role has been officially approved by the Host.
          </p>
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs font-medium text-amber-900 mb-6 text-left">
            <div className="font-bold flex items-center gap-1.5 mb-1 text-amber-950">
              <AlertTriangle size={14} /> Authorization Checklist:
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-800">
              <li>Must have applied for the "Camera Crew" volunteer role.</li>
              <li>Host must have accepted & approved your application.</li>
            </ul>
          </div>
          <button
            onClick={() => navigateTo("/citizen/dashboard")}
            className="w-full py-3 bg-[#450a0a] hover:bg-red-900 text-white font-black uppercase text-xs tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft size={16} /> Return to Citizen Dashboard
          </button>
        </div>
      </main>
    );
  }

  const activeEvent = approvedEvents.find(e => e.id === selectedEventId);

  return (
    <main className="min-h-screen bg-[#fffdf7] text-slate-900 font-sans selection:bg-red-600/20 selection:text-red-950">
      {/* Top Banner Header */}
      <header className="bg-gradient-to-r from-slate-900 via-[#450a0a] to-slate-900 text-white border-b-4 border-amber-400 sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-400/20 border border-amber-400/40 rounded-xl flex items-center justify-center text-amber-300">
              <Camera size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest bg-amber-400/20 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded">
                  Official Volunteer Portal
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-black uppercase tracking-tight text-white">
                PURATCHI Camera Crew Studio
              </h1>
            </div>
          </div>

          <button
            onClick={() => navigateTo("/citizen/dashboard")}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Event Selector & Info Header */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-amber-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded mb-2 inline-block">
              Approved Assignment
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight">
              {activeEvent?.title || "Select Approved Event"}
            </h2>
            <div className="mt-2 flex flex-wrap gap-4 text-xs font-medium text-slate-600">
              {activeEvent?.location_name && (
                <span className="flex items-center gap-1">
                  <MapPin size={14} className="text-red-700" /> {activeEvent.location_name}
                </span>
              )}
              {activeEvent?.event_date && (
                <span className="flex items-center gap-1">
                  <Calendar size={14} className="text-amber-700" /> {activeEvent.event_date}
                </span>
              )}
            </div>
          </div>

          {approvedEvents.length > 1 && (
            <div className="w-full md:w-auto">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                Switch Approved Event
              </label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full md:w-64 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600"
              >
                {approvedEvents.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </section>

        {/* Main Content Grid: Upload Form + Published Gallery */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upload Form (Left Column) */}
          <section className="bg-white rounded-3xl p-6 sm:p-8 border border-amber-200/80 shadow-sm h-fit">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-red-100 text-red-800 flex items-center justify-center font-bold">
                <Upload size={18} />
              </div>
              <div>
                <h3 className="text-base font-black uppercase text-slate-900">Upload Event Photograph</h3>
                <p className="text-[11px] font-medium text-slate-500">Publish high-res event photos directly to Public Gallery</p>
              </div>
            </div>

            {uploadError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs font-semibold text-red-900 mb-4 flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0 text-red-700" />
                {uploadError}
              </div>
            )}

            {uploadSuccess && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-900 mb-4 flex items-center gap-2">
                <CheckCircle2 size={16} className="shrink-0 text-emerald-700" />
                {uploadSuccess}
              </div>
            )}

            <form onSubmit={handlePhotoUpload} className="space-y-4">
              {/* File Input Box */}
              <div>
                <label className="block text-[11px] font-black uppercase text-slate-700 mb-1.5">
                  Photograph File *
                </label>
                <div className="border-2 border-dashed border-slate-300 rounded-2xl p-4 text-center bg-slate-50 hover:bg-slate-100/80 transition-all cursor-pointer relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  {previewUrl ? (
                    <div className="space-y-2">
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="max-h-48 rounded-xl mx-auto object-cover border border-slate-200 shadow-sm"
                      />
                      <p className="text-[11px] font-bold text-slate-600">Click or drag to replace image</p>
                    </div>
                  ) : (
                    <div className="py-6 flex flex-col items-center gap-2">
                      <ImageIcon size={36} className="text-slate-400" />
                      <span className="text-xs font-black text-slate-700 uppercase">Choose Image / Take Photo</span>
                      <span className="text-[10px] text-slate-500 font-medium">Supports JPG, PNG, WEBP up to 10MB</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Photo Caption */}
              <div>
                <label className="block text-[11px] font-black uppercase text-slate-700 mb-1.5">
                  Caption / Description
                </label>
                <textarea
                  rows={3}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="E.g., Assembly crowd gathered at Central Plaza demanding action..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={uploading || (!imageFile && !previewUrl)}
                className="w-full py-3.5 bg-gradient-to-r from-red-900 to-[#450a0a] hover:from-red-950 hover:to-slate-900 disabled:opacity-50 text-white font-black uppercase text-xs tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {uploading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" /> Publishing to Gallery...
                  </>
                ) : (
                  <>
                    <Upload size={16} /> Publish Photograph
                  </>
                )}
              </button>
            </form>
          </section>

          {/* Published Event Gallery (Right 2 Columns) */}
          <section className="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-8 border border-amber-200/80 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                    <ImageIcon size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase text-slate-900">Event Photo Gallery</h3>
                    <p className="text-[11px] font-medium text-slate-500">Live published photographs for this assembly ({photos.length})</p>
                  </div>
                </div>
              </div>

              {photos.length === 0 ? (
                <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                  <Camera size={40} className="text-slate-300 mx-auto mb-3" />
                  <h4 className="text-sm font-black text-slate-700 uppercase mb-1">No Photographs Published Yet</h4>
                  <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto">
                    Use the upload panel on the left to add official event photographs to the public portal.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {photos.map((photo) => (
                    <div key={photo.id} className="group relative bg-slate-900 rounded-2xl overflow-hidden shadow-sm border border-slate-200 flex flex-col justify-between">
                      <div className="aspect-video w-full overflow-hidden bg-slate-950 relative">
                        <img
                          src={photo.image_url}
                          alt={photo.caption || "Event Photo"}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <div className="p-3 bg-white border-t border-slate-100">
                        <p className="text-xs font-semibold text-slate-800 line-clamp-2">
                          "{photo.caption || "Official Event Photograph"}"
                        </p>
                        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase">
                          <span>By {photo.uploader_name}</span>
                          <span>{new Date(photo.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
