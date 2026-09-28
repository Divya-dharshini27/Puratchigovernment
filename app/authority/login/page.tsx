"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ShieldCheck, Landmark, Lock, Mail, User, Eye, EyeOff, 
  ArrowRight, RefreshCw, BadgeAlert, 
  CheckCircle2, Info
} from "lucide-react";
import { createClient } from "../../../lib/supabase/client";
import { 
  INDIAN_STATES, TN_DISTRICTS, AUTHORITY_DEPARTMENTS 
} from "../../../lib/types";

export default function AuthorityLoginPage() {
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

  // Credential Fields (for Onboarding)
  const [state, setState] = useState("Tamil Nadu");
  const [district, setDistrict] = useState("Chennai");
  const [department, setDepartment] = useState(AUTHORITY_DEPARTMENTS[0]);
  const [badgeNumber, setBadgeNumber] = useState("");
  const [designation, setDesignation] = useState("Assistant Commissioner of Police");

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

        if (userRole === "authority") {
          setSuccessMessage("Active Authority session detected. Entering console...");
          setTimeout(() => {
            if (active) router.replace("/authority/dashboard");
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

        if (userRole === "authority") {
          setSuccessMessage("Authority credentials verified. Entering console...");
          router.replace("/authority/dashboard");
        }
      }
    });

    authListenerRef.current = listener;
    return () => {
      active = false;
      listener?.subscription.unsubscribe();
    };
  }, [router, supabase]);

  // ─── Handle Login: STRICTLY FOR STATUTORY AUTHORITY ──────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email || !password) {
      setErrorMessage("Please enter both official authority email and password.");
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
            "Invalid email or password. If you recently reset the database or haven't registered this account yet, please click '+ Onboard Authority Account' above to register first."
          );
          setLoading(false);
          return;
        }
        throw authErr;
      }

      if (!authData.user) {
        throw new Error("Authentication failed. Please verify statutory authority credentials.");
      }

      // 2. Fetch User Profile from public.profiles with auto-healing and metadata fallback
      let userRole = authData.user.user_metadata?.role;
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("auth_user_id", authData.user.id)
          .maybeSingle();

        if (profile?.role) {
          userRole = profile.role;
        } else {
          // Auto-heal / Restore missing profile in public.profiles using auth metadata
          const meta = authData.user.user_metadata;
          const roleToSet = meta?.role || "authority";
          if (roleToSet === "authority") {
            await supabase.from("profiles").upsert({
              auth_user_id: authData.user.id,
              full_name: meta?.full_name || authData.user.email?.split("@")[0] || "Authority Officer",
              email: authData.user.email || email.trim(),
              phone: authData.user.phone || null,
              role: "authority",
              jurisdiction_level: "district",
              state: meta?.state || "Tamil Nadu",
              district: meta?.district || "Chennai",
              department: meta?.department || "City Police Commissionerate",
              badge_number: meta?.badge_number || null,
              designation: meta?.designation || "Assistant Commissioner of Police",
              is_active: true,
              can_act: true,
              language: "English"
            }, { onConflict: "auth_user_id" });
            userRole = "authority";
          }
        }
      } catch (err: any) {
        console.warn("Database profile fetch warning (using metadata):", err.message);
      }

      // 3. Strict Role Validations
      if (userRole === "citizen" || userRole === "host") {
        await supabase.auth.signOut();
        setErrorMessage(
          "ACCESS DENIED: Citizen and Host accounts cannot access the Statutory Authority Console. Please use the public portal."
        );
        setLoading(false);
        return;
      }

      if (userRole === "government") {
        await supabase.auth.signOut();
        setErrorMessage(
          "ACCESS RESTRICTED: Your account is registered as Government Administration. Please switch to the Government Login portal."
        );
        setLoading(false);
        return;
      }

      if (userRole !== "authority") {
        await supabase.auth.signOut();
        setErrorMessage(
          "ACCESS DENIED: This account does not possess verified Statutory Authority credentials."
        );
        setLoading(false);
        return;
      }

      // 4. Verification Successful -> Navigate to Authority Dashboard
      setSuccessMessage("Authority Credentials Verified! Redirecting to Clearance Queue...");
      router.push("/authority/dashboard");

    } catch (err: any) {
      console.error("Authority Login error:", err);
      const msg = err?.message || "";
      if (msg.toLowerCase().includes("failed to fetch") || err?.name === "AuthRetryableFetchError") {
        setErrorMessage(
          "Network Connection Error: Unable to reach the authentication service. Please check your internet connection, disable ad-blockers / VPN for this site, and try again."
        );
      } else {
        setErrorMessage(msg || "Invalid statutory authority credentials. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Handle Official Authority Registration ───────────────────────────────
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
          role: "authority",
          department,
          jurisdictionLevel: "district",
          state,
          district,
          badgeNumber: badgeNumber.trim() || null,
          designation: designation.trim() || null,
          isActive: true,
          canAct: true,
          language: "English"
        })
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to create authority account.");
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

      setSuccessMessage("Statutory Authority Officer Account created! Entering Console...");
      router.push("/authority/dashboard");

    } catch (err: any) {
      console.error("Registration error:", err);
      if (err?.message?.toLowerCase().includes("rate limit") || err?.code === "over_email_send_rate_limit") {
        setErrorMessage(
          "Supabase email rate limit exceeded. You can disable 'Confirm email' in Supabase Dashboard -> Authentication -> Providers -> Email."
        );
      } else {
        setErrorMessage(err.message || "Failed to register authority profile.");
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
            <span className="ml-2 text-[10px] font-bold text-amber-300 uppercase px-2 py-0.5 rounded bg-red-950 border border-red-800">
              AUTHORITY PORTAL
            </span>
          </div>
        </Link>

        <Link
          href="/government/login"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition border border-slate-700"
        >
          <Landmark size={14} className="text-amber-400" />
          <span>Switch to Government Login &rarr;</span>
        </Link>
      </header>

      {/* Main Form Container */}
      <div className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-xl bg-white rounded-2xl border-2 border-red-950/20 shadow-2xl p-6 sm:p-8">
          
          {/* Header & Shield */}
          <div className="text-center mb-6">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-red-700 to-red-900 text-white shadow-lg border border-red-800 mb-3">
              <ShieldCheck size={28} />
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Statutory Authority Login
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Police Commissionerate, Municipal &amp; Regulatory Bureau. Assembly licensing and statutory enforcement terminal.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 text-xs">
            <span className="font-bold text-slate-700">
              {isRegistering ? "Register Official Authority Account" : "Authority Officer Sign In"}
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
              {isRegistering ? "Existing Officer? Sign In" : "+ Onboard Authority Account"}
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
                      placeholder="e.g. Inspector K. Murugan"
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white transition"
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
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white"
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
                      placeholder="e.g. TN-POL-8831"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white font-mono"
                    />
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
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white"
                    >
                      {INDIAN_STATES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Station District Jurisdiction *
                    </label>
                    <select
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white"
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
                      Authority Department
                    </label>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. City Police Commissionerate"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white"
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
                      placeholder="e.g. Assistant Commissioner of Police"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Email Field */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Official Authority Email Address *
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. officer@police.tn.gov.in"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white transition"
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
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white transition"
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
              className="w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider text-white shadow-lg bg-red-700 hover:bg-red-800 active:scale-98 transition flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>Verifying Authority Credentials...</span>
                </>
              ) : (
                <>
                  <span>{isRegistering ? "Register Authority Officer" : "Login to Authority Console"}</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>

          </form>

          {/* Alternate Switcher Link */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Government Administration official?</span>
            <Link
              href="/government/login"
              className="font-bold text-slate-800 hover:text-slate-900 hover:underline flex items-center gap-1"
            >
              <span>Go to Government Portal</span>
              <ArrowRight size={13} />
            </Link>
          </div>

        </div>
      </div>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-slate-500 bg-white border-t border-slate-200">
        PURATCHI Statutory Authority Portal • Police &amp; Municipal Regulatory Bureau
      </footer>

    </main>
  );
}
