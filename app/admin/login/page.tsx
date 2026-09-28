"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Building2, ShieldCheck, Lock, Mail, User, Eye, EyeOff, 
  ArrowRight, AlertCircle, CheckCircle2, RefreshCw, BadgeAlert, 
  MapPin, Landmark, Award 
} from "lucide-react";
import { createClient } from "../../../lib/supabase/client";
import { 
  INDIAN_STATES, TN_DISTRICTS, GOVT_DEPARTMENTS, 
  AUTHORITY_DEPARTMENTS, JurisdictionLevel 
} from "../../../lib/types";

export default function AdminLoginPage() {
  const router = useRouter();
  const supabase = createClient();

  // Active Portal Tab: Government vs. Authority
  const [selectedRole, setSelectedRole] = useState<"government" | "authority">("government");
  const [isRegistering, setIsRegistering] = useState(false);

  // Common Form Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Jurisdiction & Credential Fields (for Onboarding)
  const [jurisdictionLevel, setJurisdictionLevel] = useState<JurisdictionLevel>("district");
  const [state, setState] = useState("Tamil Nadu");
  const [district, setDistrict] = useState("Chennai");
  const [department, setDepartment] = useState("");
  const [badgeNumber, setBadgeNumber] = useState("");
  const [designation, setDesignation] = useState("");

  // Statuses
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Set default departments when role toggles
  useEffect(() => {
    if (selectedRole === "government") {
      setDepartment(GOVT_DEPARTMENTS[0]);
      setDesignation("District Executive Officer");
    } else {
      setDepartment(AUTHORITY_DEPARTMENTS[0]);
      setDesignation("Assistant Commissioner of Police");
    }
  }, [selectedRole]);

  // Read search params on client mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("notice") === "restricted_admin_console") {
        setErrorMessage("Administrative Notice: You navigated to the Government & Authority Console. Citizen and Host features reside exclusively on the Public website.");
      }
      if (params.get("portal") === "authority") {
        setSelectedRole("authority");
      } else if (params.get("portal") === "government") {
        setSelectedRole("government");
      }
    }
  }, []);

  // Check if session already active
  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("auth_user_id", session.user.id)
          .maybeSingle();

        if (profile?.role === "government") {
          router.replace("/government/dashboard");
        } else if (profile?.role === "authority") {
          router.replace("/authority/dashboard");
        }
      }
    }
    checkSession();
  }, [router, supabase]);

  // Handle Login Submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email || !password) {
      setErrorMessage("Please enter both official email and password.");
      return;
    }

    setLoading(true);

    try {
      // 1. Authenticate with Supabase Auth
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (authErr) throw authErr;

      if (!authData.user) {
        throw new Error("Authentication failed. Please verify credentials.");
      }

      // 2. Fetch User Profile from public.profiles
      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("auth_user_id", authData.user.id)
        .maybeSingle();

      const userRole = profile?.role || authData.user.user_metadata?.role;

      // 3. Strict Role Verification: BLOCK Citizen and Host users
      if (userRole === "citizen" || userRole === "host") {
        await supabase.auth.signOut();
        setErrorMessage(
          "ACCESS DENIED: Citizen and Host accounts are not permitted in the Government & Authority Administrative Console. Please access the public portal."
        );
        setLoading(false);
        return;
      }

      // 4. Strict Portal Role Isolation:
      // If user is on Government Portal, they CANNOT log in with Authority account.
      if (selectedRole === "government" && userRole !== "government") {
        await supabase.auth.signOut();
        setErrorMessage(
          "ACCESS DENIED: You are attempting to enter the Government Portal, but this account is registered as Statutory Authority. Please click the 'Authority Portal' tab above to log in."
        );
        setLoading(false);
        return;
      }

      // If user is on Authority Portal, they CANNOT log in with Government account.
      if (selectedRole === "authority" && userRole !== "authority") {
        await supabase.auth.signOut();
        setErrorMessage(
          "ACCESS DENIED: You are attempting to enter the Statutory Authority Portal, but this account is registered as Government Administration. Please click the 'Government Portal' tab above to log in."
        );
        setLoading(false);
        return;
      }

      if (selectedRole === "government") {
        setSuccessMessage("Government Credentials Verified! Entering Government Administration Console...");
        setTimeout(() => {
          router.push("/government/dashboard");
        }, 600);
      } else {
        setSuccessMessage("Authority Credentials Verified! Entering Statutory Authority Console...");
        setTimeout(() => {
          router.push("/authority/dashboard");
        }, 600);
      }

    } catch (err: any) {
      console.error("Login error:", err);
      setErrorMessage(err.message || "Invalid administrative credentials.");
    } finally {
      setLoading(false);
    }
  };

  // Handle Official Onboarding / Registration
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
      // 1. Create account with Supabase Auth
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: selectedRole,
            department,
            jurisdiction_level: selectedRole === "government" ? jurisdictionLevel : "district",
            state,
            district
          }
        }
      });

      if (authErr) throw authErr;

      const user = authData.user;
      if (!user) throw new Error("Could not initialize administrative user account.");

      // 2. Insert Official Profile into public.profiles
      const { error: profErr } = await supabase
        .from("profiles")
        .upsert({
          auth_user_id: user.id,
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          role: selectedRole,
          jurisdiction_level: selectedRole === "government" ? jurisdictionLevel : "district",
          state,
          district,
          department,
          badge_number: badgeNumber.trim() || null,
          designation: designation.trim() || null,
          language: "English"
        }, { onConflict: "auth_user_id" });

      if (profErr) {
        console.warn("Profile upsert notice:", profErr.message);
      }

      setSuccessMessage("Official Account Registered successfully! Redirecting to Console...");

      setTimeout(() => {
        if (selectedRole === "authority") {
          router.push("/authority/dashboard");
        } else {
          router.push("/government/dashboard");
        }
      }, 900);

    } catch (err: any) {
      console.error("Registration error:", err);
      setErrorMessage(err.message || "Failed to register official profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#fffdf7] text-slate-900 font-sans flex flex-col justify-between selection:bg-red-600/20 selection:text-red-950">
      
      {/* Top Bar Header */}
      <header className="w-full bg-slate-950 border-b border-red-950 px-4 sm:px-8 py-3.5 text-white flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-red-600 to-red-800 text-white font-black text-sm shadow">
            P
          </div>
          <div>
            <span className="font-black text-sm uppercase tracking-wider text-white">PURATCHI</span>
            <span className="ml-2 text-[10px] font-bold text-amber-300 uppercase px-2 py-0.5 rounded bg-red-950 border border-red-800">
              ADMIN GATEWAY
            </span>
          </div>
        </Link>
        <div className="text-xs text-slate-400 hidden sm:flex items-center gap-1.5 font-mono">
          <Lock size={13} className="text-red-400" />
          <span>Restricted Administrative Access</span>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-xl bg-white rounded-2xl border-2 border-red-950/10 shadow-2xl p-6 sm:p-8">
          
          {/* Official Badge & Heading */}
          <div className="text-center mb-6">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-slate-950 to-red-950 text-white shadow-lg border border-red-800/40 mb-3">
              {selectedRole === "government" ? (
                <Landmark size={28} className="text-amber-400" />
              ) : (
                <ShieldCheck size={28} className="text-red-400" />
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {selectedRole === "government" ? "Government Administration Portal" : "Statutory Authority Portal"}
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {selectedRole === "government" 
                ? "Jurisdiction monitoring, inter-departmental oversight & assembly intelligence."
                : "Regulatory review, statutory clearance, and enforcement decisions for public assemblies."}
            </p>
          </div>

          {/* Portal Switcher (Government vs Authority) */}
          <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 border border-slate-200 mb-6 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setSelectedRole("government");
                setErrorMessage(null);
                setSuccessMessage(null);
                if (typeof window !== "undefined") {
                  window.history.replaceState(null, "", "/admin/login?portal=government");
                }
              }}
              className={`py-2.5 rounded-lg flex items-center justify-center gap-2 transition ${
                selectedRole === "government"
                  ? "bg-slate-950 text-white shadow-md"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Landmark size={15} className={selectedRole === "government" ? "text-amber-400" : ""} />
              <span>Government Portal</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedRole("authority");
                setErrorMessage(null);
                setSuccessMessage(null);
                if (typeof window !== "undefined") {
                  window.history.replaceState(null, "", "/admin/login?portal=authority");
                }
              }}
              className={`py-2.5 rounded-lg flex items-center justify-center gap-2 transition ${
                selectedRole === "authority"
                  ? "bg-red-800 text-white shadow-md"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ShieldCheck size={15} className={selectedRole === "authority" ? "text-white" : ""} />
              <span>Authority Portal</span>
            </button>
          </div>

          {/* Mode Switcher: Sign In vs Official Onboarding */}
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 text-xs">
            <span className="font-bold text-slate-700">
              {isRegistering ? "Register Official Credentials" : "Official Sign In"}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className="text-red-700 hover:text-red-800 font-bold hover:underline"
            >
              {isRegistering ? "Existing Official? Sign In" : "+ Onboard Official Account"}
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

          {/* FORM: LOGIN OR ONBOARDING */}
          <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4">
            
            {/* Additional Registration Fields */}
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
                      placeholder="e.g. Inspector R. Sundaram"
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
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white transition"
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
                      placeholder="e.g. TN-POL-4482"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white transition font-mono"
                    />
                  </div>
                </div>

                {/* Government Specific Jurisdiction Level */}
                {selectedRole === "government" && (
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
                )}

                {/* State & District Selectors */}
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
                      District Jurisdiction *
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
                      Department / Wing
                    </label>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. Police Commissionerate"
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
                      placeholder="e.g. Sub-Divisional Magistrate"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Email Field */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Official Email Address *
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
              className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider text-white shadow-lg transition active:scale-98 flex items-center justify-center gap-2 mt-2 ${
                selectedRole === "authority"
                  ? "bg-gradient-to-r from-red-700 to-red-900 hover:from-red-800 hover:to-red-950"
                  : "bg-gradient-to-r from-slate-900 to-slate-950 hover:from-slate-800 hover:to-slate-900"
              } disabled:opacity-50`}
            >
              {loading ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>
                    {isRegistering 
                      ? (selectedRole === "government" ? "Register Government Official" : "Register Authority Officer") 
                      : (selectedRole === "government" ? "Login to Government Console" : "Login to Authority Console")}
                  </span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>

          </form>

          {/* Security Notice */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              <strong className="text-slate-600">Statutory Notice:</strong> This terminal is restricted to authorized Government & Law Enforcement officials. Citizen and Host accounts are barred. All actions are logged.
            </p>
          </div>

        </div>
      </div>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-slate-500 bg-white border-t border-slate-200">
        PURATCHI Civic Assembly Administrative Portal • Government of India & State Administration Framework
      </footer>

    </main>
  );
}
