"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileText, Send, ArrowLeft, RefreshCw, CheckCircle2, AlertTriangle,
  ShieldAlert, Newspaper, Calendar, MapPin, User, Sparkles
} from "lucide-react";
import { createClient } from "../../../lib/supabase/client";
import { usePortalNavigation } from "../../components/GlobalPageTransition";

interface ApprovedEvent {
  id: string;
  title: string;
  location_name: string;
  event_date: string;
}

interface ArticleItem {
  id: string;
  event_id: string;
  author_id: string;
  author_name: string;
  title: string;
  content: string;
  status: string;
  created_at: string;
}

export default function JournalistPage() {
  const router = useRouter();
  const supabase = createClient();
  const { navigateTo } = usePortalNavigation();

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [userProfile, setUserProfile] = useState<{ id: string; name: string } | null>(null);

  const [approvedEvents, setApprovedEvents] = useState<ApprovedEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");

  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [articleTitle, setArticleTitle] = useState("");
  const [articleContent, setArticleContent] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function verifyJournalistAccess() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          setAuthorized(false);
          setLoading(false);
          return;
        }

        const userId = session.user.id;
        const name = session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Accredited Press Reporter";
        setUserProfile({ id: userId, name });
        setAuthorName(name);

        // Query volunteer_applications for status = 'approved' and selected_roles containing Journalist or Reporter
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

        const journalistApps = apps.filter((a: any) =>
          Array.isArray(a.selected_roles) &&
          a.selected_roles.some((r: string) =>
            r.toLowerCase().includes("journalist") || r.toLowerCase().includes("reporter")
          )
        );

        if (journalistApps.length === 0) {
          setAuthorized(false);
          setLoading(false);
          return;
        }

        const eventsList: ApprovedEvent[] = journalistApps
          .map((a: any) => a.events)
          .filter(Boolean);

        setApprovedEvents(eventsList);
        if (eventsList.length > 0) {
          setSelectedEventId(eventsList[0].id);
        }

        setAuthorized(true);
      } catch (err) {
        console.error("Journalist access verification error:", err);
        setAuthorized(false);
      } finally {
        setLoading(false);
      }
    }

    verifyJournalistAccess();
  }, [supabase]);

  // Fetch articles for selected event
  useEffect(() => {
    if (!selectedEventId) return;

    async function loadArticles() {
      const { data, error } = await supabase
        .from("event_articles")
        .select("*")
        .eq("event_id", selectedEventId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setArticles(data as ArticleItem[]);
      }
    }

    loadArticles();
  }, [selectedEventId, supabase]);

  const handleArticleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!selectedEventId) {
      setSubmitError("Please select an approved event.");
      return;
    }

    if (!articleTitle.trim() || !articleContent.trim()) {
      setSubmitError("Please provide both an Article Title and Article Content.");
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase.from("event_articles").insert({
        event_id: selectedEventId,
        author_id: userProfile?.id,
        author_name: authorName.trim() || userProfile?.name || "Press Reporter",
        title: articleTitle.trim(),
        content: articleContent.trim(),
        status: "published"
      });

      if (error) {
        throw new Error(error.message);
      }

      setSubmitSuccess("Article successfully published to the Public News Feed!");
      setArticleTitle("");
      setArticleContent("");

      // Refresh articles
      const { data: freshArticles } = await supabase
        .from("event_articles")
        .select("*")
        .eq("event_id", selectedEventId)
        .order("created_at", { ascending: false });

      if (freshArticles) setArticles(freshArticles as ArticleItem[]);
    } catch (err: any) {
      setSubmitError(err.message || "Failed to publish news article.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fffdf7] grid place-items-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw size={32} className="animate-spin text-red-700" />
          <p className="text-xs font-black uppercase tracking-wider text-slate-700">Verifying Journalist Credentials...</p>
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
            The **Journalist & Reporter Newsroom** is strictly reserved for volunteers whose application for the **Journalist / Reporter** role has been officially approved by the Host.
          </p>
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs font-medium text-amber-900 mb-6 text-left">
            <div className="font-bold flex items-center gap-1.5 mb-1 text-amber-950">
              <AlertTriangle size={14} /> Authorization Requirements:
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-800">
              <li>Must have applied for "Journalist / Reporter" role.</li>
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
              <Newspaper size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest bg-amber-400/20 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded">
                  Official Press Desk
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-black uppercase tracking-tight text-white">
                PURATCHI Press & Media Newsroom
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
        {/* Event Header & Selector */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-amber-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded mb-2 inline-block">
              Approved Press Assignment
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

        {/* Article Editor + Published Articles */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Editor (Left Column) */}
          <section className="bg-white rounded-3xl p-6 sm:p-8 border border-amber-200/80 shadow-sm h-fit">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-red-100 text-red-800 flex items-center justify-center font-bold">
                <FileText size={18} />
              </div>
              <div>
                <h3 className="text-base font-black uppercase text-slate-900">Publish News Report</h3>
                <p className="text-[11px] font-medium text-slate-500">Draft & release live articles to Public News Feed</p>
              </div>
            </div>

            {submitError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs font-semibold text-red-900 mb-4 flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0 text-red-700" />
                {submitError}
              </div>
            )}

            {submitSuccess && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-900 mb-4 flex items-center gap-2">
                <CheckCircle2 size={16} className="shrink-0 text-emerald-700" />
                {submitSuccess}
              </div>
            )}

            <form onSubmit={handleArticleSubmit} className="space-y-4">
              {/* Author Byline */}
              <div>
                <label className="block text-[11px] font-black uppercase text-slate-700 mb-1.5">
                  Author Byline / Reporter Name *
                </label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="E.g., Jane Doe, Senior Press Reporter"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600"
                  />
                </div>
              </div>

              {/* Headline */}
              <div>
                <label className="block text-[11px] font-black uppercase text-slate-700 mb-1.5">
                  Headline / Article Title *
                </label>
                <input
                  type="text"
                  required
                  value={articleTitle}
                  onChange={(e) => setArticleTitle(e.target.value)}
                  placeholder="E.g., Massive Turnout as Youth Mobilize for Assembly..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>

              {/* Content Body */}
              <div>
                <label className="block text-[11px] font-black uppercase text-slate-700 mb-1.5">
                  News Article Content *
                </label>
                <textarea
                  rows={8}
                  required
                  value={articleContent}
                  onChange={(e) => setArticleContent(e.target.value)}
                  placeholder="Write complete article details, key quotes, assembly highlights, and field observations..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600 leading-relaxed"
                />
              </div>

              {/* Publish Button */}
              <button
                type="submit"
                disabled={submitting || !articleTitle.trim() || !articleContent.trim()}
                className="w-full py-3.5 bg-gradient-to-r from-red-900 to-[#450a0a] hover:from-red-950 hover:to-slate-900 disabled:opacity-50 text-white font-black uppercase text-xs tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" /> Publishing Article...
                  </>
                ) : (
                  <>
                    <Send size={16} /> Publish News Article
                  </>
                )}
              </button>
            </form>
          </section>

          {/* Published Articles List (Right 2 Columns) */}
          <section className="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-8 border border-amber-200/80 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <Newspaper size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase text-slate-900">Published News Articles</h3>
                  <p className="text-[11px] font-medium text-slate-500">Live news feed for this assembly ({articles.length})</p>
                </div>
              </div>

              {articles.length === 0 ? (
                <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                  <FileText size={40} className="text-slate-300 mx-auto mb-3" />
                  <h4 className="text-sm font-black text-slate-700 uppercase mb-1">No News Reports Published Yet</h4>
                  <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto">
                    Use the newsroom editor on the left to write and publish live coverage for this event.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {articles.map((art) => (
                    <article key={art.id} className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[10px] font-black uppercase tracking-wider">
                          PUBLISHED
                        </span>
                        <span className="text-[11px] font-medium text-slate-400">
                          {new Date(art.created_at).toLocaleString()}
                        </span>
                      </div>
                      <h4 className="text-lg font-black text-slate-900 leading-snug">
                        {art.title}
                      </h4>
                      <div className="text-xs font-bold text-red-800">
                        By {art.author_name}
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed font-medium whitespace-pre-line">
                        {art.content}
                      </p>
                    </article>
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
