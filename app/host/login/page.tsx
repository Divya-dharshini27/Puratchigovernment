"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight, ShieldCheck, Eye, EyeOff, Lock, Mail,
  ArrowLeft, AlertCircle, CheckCircle2, RefreshCw
} from "lucide-react";
import { createClient } from "../../../lib/supabase/client";

export default function HostLoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  // Check if already logged in as Host
  useEffect(() => {
    async function checkExistingSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("auth_user_id", session.user.id)
          .single();

        if (profile?.role === "host") {
          router.replace("/host/dashboard");
        }
      }
    }
    checkExistingSession();
  }, [router, supabase]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email || !password) {
      setErrorMsg("Please enter both email and password.");
      return;
    }

    setLoading(true);

    try {
      // 1. Authenticate with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (authError) {
        setErrorMsg(authError.message || "Invalid credentials. Please try again.");
        setLoading(false);
        return;
      }

      if (!authData.user) {
        setErrorMsg("Failed to authenticate user.");
        setLoading(false);
        return;
      }

      // 2. Fetch User Profile to verify Host Role
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("auth_user_id", authData.user.id)
        .maybeSingle();

      // Check if profile exists and role is host
      const userRole = profile?.role || authData.user.user_metadata?.role;

      if (userRole !== "host") {
        // Sign out immediately if not a host account
        await supabase.auth.signOut();
        setErrorMsg("Access Denied: This account is not registered as a Host. Please sign up or log in as a Citizen.");
        setLoading(false);
        return;
      }

      setSuccessMsg("Authentication successful! Redirecting to Host Dashboard...");
      setTimeout(() => {
        router.push("/host/dashboard");
      }, 600);
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetMsg(null);

    if (!resetEmail) {
      setResetError("Please enter your email address.");
      return;
    }

    setResetLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/host/login?reset=true`
      });

      if (error) {
        setResetError(error.message);
      } else {
        setResetMsg("Password reset link has been sent to your email.");
      }
    } catch (err: any) {
      setResetError(err.message || "Failed to send reset link.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#fffdf7] text-slate-900 font-sans flex flex-col justify-between selection:bg-red-600/20 selection:text-red-950">
      {/* Top Bar Navigation */}
      <header className="w-full bg-red-950 border-b border-red-800 px-4 sm:px-8 py-4 text-white flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-2 group text-xs font-black uppercase tracking-wider text-amber-100 hover:text-white transition">
          <ArrowLeft size={16} className="transition group-hover:-translate-x-1" /> Back to Home
        </Link>
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded bg-red-600 text-white font-black text-xs">
            P
          </div>
          <span className="font-black text-sm uppercase tracking-wider text-white">
            PURATCHI
          </span>
        </div>
      </header>

      {/* Main Login Card Container */}
      <div className="flex-1 flex items-center justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-md bg-white rounded-2xl border-2 border-amber-200/80 shadow-xl p-6 sm:p-8">
          
          {/* Header & Branding */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-black uppercase tracking-wider mb-3">
              <ShieldCheck size={14} className="text-blue-700" /> Host Organizer Portal
            </div>

            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-slate-900">
              Host Login
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm font-medium text-slate-600">
              Access your organizer console to manage public assemblies & volunteer deployments.
            </p>
          </div>

          {/* Feedback Alerts */}
          {errorMsg && (
            <div className="mt-5 p-3.5 rounded-xl bg-red-50 border border-red-300 text-red-800 text-xs font-semibold flex items-start gap-2.5">
              <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mt-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold flex items-start gap-2.5">
              <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="mt-6 space-y-4 sm:space-y-5">
            {/* Email Field */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                Host Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="organizer@assembly.org"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600 focus:bg-white transition"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email);
                    setShowForgotModal(true);
                  }}
                  className="text-xs font-bold text-red-700 hover:text-red-800 transition hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-11 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600 focus:bg-white transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-red-700 hover:bg-red-800 text-white font-black text-xs sm:text-sm uppercase tracking-wider rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  Sign In to Host Portal <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Footer Link */}
          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-xs font-semibold text-slate-600">
              Don’t have a Host account?{" "}
              <Link href="/host/signup" className="font-black text-red-700 hover:text-red-800 transition hover:underline">
                Sign Up
              </Link>
            </p>
          </div>

        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border-2 border-amber-200 shadow-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-black uppercase text-slate-900">Reset Password</h3>
            <p className="mt-1 text-xs text-slate-600 font-medium">
              Enter your Host account email address to receive a password reset link.
            </p>

            {resetError && (
              <div className="mt-3 p-2.5 rounded-lg bg-red-50 text-red-800 text-xs font-semibold">
                {resetError}
              </div>
            )}

            {resetMsg && (
              <div className="mt-3 p-2.5 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-semibold">
                {resetMsg}
              </div>
            )}

            <form onSubmit={handleForgotPassword} className="mt-4 space-y-3">
              <input
                type="email"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="host@organization.org"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600"
              />
              <div className="flex items-center gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="px-4 py-1.5 bg-red-700 text-white rounded-lg text-xs font-black uppercase tracking-wider hover:bg-red-800 disabled:opacity-50"
                >
                  {resetLoading ? "Sending..." : "Send Reset Link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full bg-slate-950 border-t border-slate-800 px-4 py-4 text-center text-xs font-semibold text-slate-400">
        © 2026 PURATCHI — Host Portal Administration
      </footer>
    </main>
  );
}
