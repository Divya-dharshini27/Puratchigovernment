"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Landmark, ShieldCheck, Lock, Mail, User, Eye, EyeOff, 
  ArrowRight, RefreshCw, BadgeAlert, 
  CheckCircle2, Info
} from "lucide-react";
import { createClient } from "../../../lib/supabase/client";
import { 
  INDIAN_STATES, TN_DISTRICTS, GOVT_DEPARTMENTS, JurisdictionLevel 
} from "../../../lib/types";

export default function GovernmentLoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const authListenerRef = useRef<{ subscription: { unsubscribe: () => void } } | null>(null);

  const [isRegistering, setIsRegistering] = useState(false);

  // Form Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Jurisdiction & Credential Fields (for Onboarding)
  const [jurisdictionLevel, setJurisdictionLevel] = useState<JurisdictionLevel>("district");
  const [state, setState] = useState("Tamil Nadu");
  const [district, setDistrict] = useState("Chennai");
  const [department, setDepartment] = useState(GOVT_DEPARTMENTS[0]);
  const [badgeNumber, setBadgeNumber] = useState("");
  const [designation, setDesignation] = useState("District Executive Officer");

  // Statuses
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [awaitingEmailConfirm, setAwaitingEmailConfirm] = useState(false);

  // ─── Check existing session on mount ─────────────────────────────────────
  useEffect(() => {
    let active = true;

    async function checkCurrentSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user || !active) return;

        // Try getting profile
        let userRole = session.user.user_metadata?.role;
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("auth_user_id", session.user.id)
            .maybeSingle();

          if (profile?.role) {
            userRole = profile.role;
          }
        } catch (e) {
          console.warn("Profile fetch fallback to metadata:", e);
        }

        if (userRole === "government") {
          setSuccessMessage("Active Government session detected. Entering console...");
          setTimeout(() => {
            if (active) router.replace("/government/dashboard");
          }, 300);
        }
      } catch (err) {
        console.error("Initial session check error:", err);
      }
    }

    checkCurrentSession();

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!active) return;
      if (event === "SIGNED_IN" && session?.user) {
        let userRole = session.user.user_metadata?.role;
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("auth_user_id", session.user.id)
            .maybeSingle();

          if (profile?.role) {
            userRole = profile.role;
          }
        } catch (e) {
          console.warn("Profile role query in auth change:", e);
        }

        if (userRole === "government") {
          setSuccessMessage("Government credentials verified. Entering console...");
          router.replace("/government/dashboard");
        }
      }
    });

    authListenerRef.current = listener;
    return () => {
      active = false;
      listener?.subscription.unsubscribe();
    };
  }, [router, supabase]);

  // ─── Handle Login: STRICTLY FOR GOVERNMENT ───────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email || !password) {
      setErrorMessage("Please enter both official government email and password.");
      return;
    }

    setLoading(true);

    try {
      // 1. Authenticate with Supabase Auth
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (authErr) {
        if (authErr.message?.toLowerCase().includes("email not confirmed")) {
          setErrorMessage(
            "Email not confirmed yet. Please check your inbox and click the confirmation link, then try logging in again."
          );
          setLoading(false);
          return;
        }
        if (authErr.message?.toLowerCase().includes("invalid login credentials")) {
          setErrorMessage(
            "Invalid email or password. If you recently reset the database or haven't registered this account yet, please click '+ Onboard Government Account' above to register first."
          );
          setLoading(false);
          return;
        }
        throw authErr;
      }

      if (!authData.user) {
        throw new Error("Authentication failed. Please verify government credentials.");
      }

      // 2. Fetch User Profile from public.profiles with auto-healing and metadata fallback
      let userRole = authData.user.user_metadata?.role;
      try {
        const { data: profile, error: profErr } = await supabase
          .from("profiles")
          .select("*")
          .eq("auth_user_id", authData.user.id)
          .maybeSingle();

        if (profile?.role) {
          userRole = profile.role;
        } else {
          // Auto-heal / Restore missing profile in public.profiles using auth metadata
          const meta = authData.user.user_metadata;
          const roleToSet = meta?.role || "government";
          if (roleToSet === "government") {
            await supabase.from("profiles").upsert({
              auth_user_id: authData.user.id,
              full_name: meta?.full_name || authData.user.email?.split("@")[0] || "Government Administrator",
              email: authData.user.email || email.trim(),
              phone: authData.user.phone || null,
              role: "government",
              jurisdiction_level: meta?.jurisdiction_level || "district",
              state: meta?.state || "Tamil Nadu",
              district: meta?.district || "Chennai",
              department: meta?.department || "Department of Public Order",
              badge_number: meta?.badge_number || null,
              designation: meta?.designation || "Civil Administration Officer",
              is_active: true,
              can_act: false,
              language: "English"
            }, { onConflict: "auth_user_id" });
            userRole = "government";
          }
        }
      } catch (err: any) {
        console.warn("Database profile fetch warning (using metadata):", err.message);
      }

      // 3. Strict Role Validations
      if (userRole === "citizen" || userRole === "host") {
        await supabase.auth.signOut();
        setErrorMessage(
          "ACCESS DENIED: Citizen and Host accounts cannot access the Government Administration Console. Please use the public portal."
        );
        setLoading(false);
        return;
      }

      if (userRole === "authority") {
        await supabase.auth.signOut();
        setErrorMessage(
          "ACCESS RESTRICTED: Your account is registered as Statutory Authority. Please switch to the Authority Login portal."
        );
        setLoading(false);
        return;
      }

      if (userRole !== "government") {
        // Unknown or missing role
        await supabase.auth.signOut();
        setErrorMessage(
          "ACCESS DENIED: This account does not possess verified Government Administrator credentials."
        );
        setLoading(false);
        return;
      }

      // 4. Verification Successful -> Navigate to Dashboard
      setSuccessMessage("Government Credentials Verified! Redirecting to Dashboard...");
      
      // Immediate navigate
      router.push("/government/dashboard");

    } catch (err: any) {
      console.error("Government Login error:", err);
      const msg = err?.message || "";
      if (msg.toLowerCase().includes("failed to fetch") || err?.name === "AuthRetryableFetchError") {
        setErrorMessage(
          "Network Connection Error: Unable to reach the authentication service. Please check your internet connection, disable ad-blockers / VPN for this site, and try again."
        );
      } else {
        setErrorMessage(msg || "Invalid government credentials. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Handle Official Government Registration ──────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!fullName || !email || !password) {
      setErrorMessage("Please fill in all required official credential fields.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);

    try {
      // 1. Create account via server API with auto-confirmed email (avoids Supabase email rate limits)
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          phone: phone.trim() || null,
          role: "government",
          department,
          jurisdictionLevel,
          state,
          district,
          badgeNumber: badgeNumber.trim() || null,
          designation: designation.trim() || null,
          isActive: true,
          canAct: false,
          language: "English"
        })
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to create government account.");
      }

      // 2. Sign in immediately to establish user session
      const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (loginErr) {
        setSuccessMessage("Account created! Please enter your password to sign in.");
        setIsRegistering(false);
        return;
      }

      setSuccessMessage("Government Official Account created! Entering Console...");
      router.push("/government/dashboard");

    } catch (err: any) {
      console.error("Registration error:", err);
      if (err?.message?.toLowerCase().includes("rate limit") || err?.code === "over_email_send_rate_limit") {
        setErrorMessage(
          "Supabase email rate limit exceeded. You can disable 'Confirm email' in Supabase Dashboard -> Authentication -> Providers -> Email."
        );
      } else {
        setErrorMessage(err.message || "Failed to register government profile.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#fffdf7] text-slate-900 font-sans flex flex-col justify-between selection:bg-red-600/20 selection:text-red-950">
      
      {/* Top Bar Header */}
      <header className="w-full bg-slate-950 border-b border-red-950 px-4 sm:px-8 py-3.5 text-white flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-red-600 to-red-800 text-white font-black text-sm shadow">
            P
          </div>
          <div>
            <span className="font-black text-sm uppercase tracking-wider text-white">PURATCHI</span>
            <span className="ml-2 text-[10px] font-bold text-amber-300 uppercase px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
              GOVERNMENT PORTAL
            </span>
          </div>
        </Link>

        <Link
          href="/authority/login"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition border border-slate-700"
        >
          <ShieldCheck size={14} className="text-red-400" />
          <span>Switch to Authority Login &rarr;</span>
        </Link>
      </header>

      {/* Main Form Container */}
      <div className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-xl bg-white rounded-2xl border-2 border-slate-950/20 shadow-2xl p-6 sm:p-8">
          
          {/* Header & Emblem */}
          <div className="text-center mb-6">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 text-amber-400 shadow-lg border border-slate-800 mb-3">
              <Landmark size={28} />
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Government Administration Login
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Central, State &amp; District Administration. Restricted portal for civil administrative and oversight personnel.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 text-xs">
            <span className="font-bold text-slate-700">
              {isRegistering ? "Register Official Government Account" : "Government Official Sign In"}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setErrorMessage(null);
                setSuccessMessage(null);
                setAwaitingEmailConfirm(false);
              }}
              className="text-red-700 hover:text-red-800 font-bold hover:underline"
            >
              {isRegistering ? "Existing Official? Sign In" : "+ Onboard Government Account"}
            </button>
          </div>

          {/* Status Messages */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5 animate-in fade-in">
              <BadgeAlert size={17} className="text-red-600 shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle2 size={17} className="text-emerald-600 shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">{successMessage}</span>
            </div>
          )}

          {/* Awaiting email confirm banner */}
          {awaitingEmailConfirm && !successMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-start gap-2.5">
              <Info size={17} className="text-blue-600 shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">
                Confirmation email sent. After clicking the link in your email, come back here and sign in with your credentials.
              </span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4">
            
            {isRegistering && (
              <>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Officer Full Name *
                  </label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. T. Rajendran, IAS"
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Official Contact Phone
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98400 12345"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Badge / Officer ID
                    </label>
                    <input
                      type="text"
                      value={badgeNumber}
                      onChange={(e) => setBadgeNumber(e.target.value)}
                      placeholder="e.g. TN-GOV-1049"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white font-mono"
                    />
                  </div>
                </div>

                {/* Jurisdiction Tier */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Jurisdiction Tier *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["central", "state", "district"] as JurisdictionLevel[]).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setJurisdictionLevel(level)}
                        className={`py-2 rounded-lg text-xs font-bold capitalize transition border ${
                          jurisdictionLevel === level
                            ? "bg-slate-950 text-white border-slate-950"
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {level} Level
                      </button>
                    ))}
                  </div>
                </div>

                {/* State & District */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      State *
                    </label>
                    <select
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white"
                    >
                      {INDIAN_STATES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      District Jurisdiction *
                    </label>
                    <select
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white"
                    >
                      {TN_DISTRICTS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Department & Designation */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Department
                    </label>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. Department of Public Order"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Official Designation
                    </label>
                    <input
                      type="text"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      placeholder="e.g. Sub-Divisional Magistrate"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Email Field */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Official Government Email Address *
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. officer@tn.gov.in"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white transition"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Security Password *
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider text-white shadow-lg bg-slate-950 hover:bg-slate-900 active:scale-98 transition flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>Verifying Government Credentials...</span>
                </>
              ) : (
                <>
                  <span>{isRegistering ? "Register Government Official" : "Login to Government Console"}</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>

          </form>

          {/* Alternate Switcher Link */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Statutory Authority officer?</span>
            <Link
              href="/authority/login"
              className="font-bold text-red-700 hover:text-red-800 hover:underline flex items-center gap-1"
            >
              <span>Go to Authority Portal</span>
              <ArrowRight size={13} />
            </Link>
          </div>

        </div>
      </div>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-slate-500 bg-white border-t border-slate-200">
        PURATCHI Government Administration Portal • Official Administrative Framework
      </footer>

    </main>
  );
}
