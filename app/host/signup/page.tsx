"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight, ShieldCheck, Eye, EyeOff, Lock, Mail, User, Phone,
  ArrowLeft, AlertCircle, CheckCircle2, RefreshCw
} from "lucide-react";
import { createClient } from "../../../lib/supabase/client";

export default function HostSignUpPage() {
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState("English");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!fullName || !email || !password) {
      setErrorMsg("Please fill in all required fields.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);

    try {
      // 1. Create account with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: "host"
          }
        }
      });

      if (authError) {
        setErrorMsg(authError.message);
        setLoading(false);
        return;
      }

      const user = authData.user;
      if (!user) {
        setErrorMsg("Failed to create user account.");
        setLoading(false);
        return;
      }

      // 2. Insert Host profile into public.profiles
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          auth_user_id: user.id,
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          role: "host",
          language: language || "English"
        }, { onConflict: "auth_user_id" });

      if (profileError) {
        console.warn("Profile insertion warning:", profileError.message);
      }

      setSuccessMsg("Host Account successfully created! Redirecting to login...");
      setTimeout(() => {
        router.push("/host/login");
      }, 1200);

    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#fffdf7] text-slate-900 font-sans flex flex-col justify-between selection:bg-red-600/20 selection:text-red-950">
      {/* Top Bar Navigation */}
      <header className="w-full bg-red-950 border-b border-red-800 px-4 sm:px-8 py-4 text-white flex items-center justify-between">
        <Link href="/host/login" className="inline-flex items-center gap-2 group text-xs font-black uppercase tracking-wider text-amber-100 hover:text-white transition">
          <ArrowLeft size={16} className="transition group-hover:-translate-x-1" /> Back to Login
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

      {/* Main Sign Up Card Container */}
      <div className="flex-1 flex items-center justify-center px-4 py-10 sm:py-14">
        <div className="w-full max-w-lg bg-white rounded-2xl border-2 border-amber-200/80 shadow-xl p-6 sm:p-8">
          
          {/* Header & Branding */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-black uppercase tracking-wider mb-3">
              <ShieldCheck size={14} className="text-blue-700" /> Host Registration
            </div>

            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-slate-900">
              Create Host Account
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm font-medium text-slate-600">
              Register as an Assembly Organizer to submit permissions and lead community causes.
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

          {/* Form */}
          <form onSubmit={handleSignUp} className="mt-6 space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                Full Name / Organization Lead *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Karthik Raja"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600 focus:bg-white"
                />
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                Email Address *
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
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600 focus:bg-white"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                Password *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full pl-10 pr-11 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Grid: Phone & Language */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                  Phone Number (Optional)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Phone size={18} />
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                  Primary Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600 focus:bg-white"
                >
                  <option value="English">English</option>
                  <option value="Tamil">Tamil (தமிழ்)</option>
                  <option value="Hindi">Hindi (हिंदी)</option>
                  <option value="Telugu">Telugu (తెలుగు)</option>
                  <option value="Malayalam">Malayalam (മലയാളം)</option>
                </select>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 py-3 px-4 bg-red-700 hover:bg-red-800 text-white font-black text-xs sm:text-sm uppercase tracking-wider rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Registering Host...
                </>
              ) : (
                <>
                  Create Host Account <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Footer Link */}
          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-xs font-semibold text-slate-600">
              Already have a Host account?{" "}
              <Link href="/host/login" className="font-black text-red-700 hover:text-red-800 transition hover:underline">
                Log In
              </Link>
            </p>
          </div>

        </div>
      </div>

      {/* Footer */}
      <footer className="w-full bg-slate-950 border-t border-slate-800 px-4 py-4 text-center text-xs font-semibold text-slate-400">
        © 2026 PURATCHI — Host Portal Registration
      </footer>
    </main>
  );
}
