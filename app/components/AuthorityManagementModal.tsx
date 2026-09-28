"use client";

import { useState, useEffect } from "react";
import { 
  X, ShieldCheck, UserPlus, Search, Edit2, CheckCircle2, 
  XCircle, AlertCircle, RefreshCw, MapPin, Building, Award, 
  Power, PowerOff, ArrowRight, UserCheck, Shield
} from "lucide-react";
import { createClient } from "../../lib/supabase/client";
import { 
  AdminProfile, INDIAN_STATES, TN_DISTRICTS, AUTHORITY_DEPARTMENTS 
} from "../../lib/types";

interface AuthorityManagementModalProps {
  isOpen: boolean;
  currentUser: AdminProfile | null;
  onClose: () => void;
}

export default function AuthorityManagementModal({
  isOpen,
  currentUser,
  onClose
}: AuthorityManagementModalProps) {
  const supabase = createClient();

  const [authorities, setAuthorities] = useState<AdminProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDistrict, setFilterDistrict] = useState("All");
  
  // Create / Onboard Authority Modal Form
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newState, setNewState] = useState("Tamil Nadu");
  const [newDistrict, setNewDistrict] = useState("Chennai");
  const [newDepartment, setNewDepartment] = useState(AUTHORITY_DEPARTMENTS[0]);
  const [newBadge, setNewBadge] = useState("");
  const [newDesignation, setNewDesignation] = useState("Assistant Commissioner of Police");
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);

  // Edit / Transfer Authority Modal
  const [editingAuthority, setEditingAuthority] = useState<AdminProfile | null>(null);
  const [editState, setEditState] = useState("Tamil Nadu");
  const [editDistrict, setEditDistrict] = useState("Chennai");
  const [editDepartment, setEditDepartment] = useState(AUTHORITY_DEPARTMENTS[0]);
  const [editDesignation, setEditDesignation] = useState("");
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Status Alerts
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch all authority accounts in scope
  useEffect(() => {
    if (!isOpen) return;
    fetchAuthorities();
  }, [isOpen, currentUser]);

  const fetchAuthorities = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      let query = supabase
        .from("profiles")
        .select("*")
        .eq("role", "authority")
        .order("full_name", { ascending: true });

      // If District Government, only view Authorities in same District
      if (currentUser?.jurisdiction_level === "district" && currentUser?.district) {
        query = query.eq("district", currentUser.district);
      } else if (currentUser?.jurisdiction_level === "state" && currentUser?.state) {
        query = query.eq("state", currentUser.state);
      }

      const { data, error } = await query;
      if (error) throw error;
      setAuthorities((data as AdminProfile[]) || []);
    } catch (err: any) {
      console.error("Error fetching authorities:", err);
      setErrorMessage(err.message || "Failed to load authority directory.");
    } finally {
      setLoading(false);
    }
  };

  // Toggle Activation State of Authority Account
  const handleToggleActive = async (target: AdminProfile) => {
    const nextState = target.is_active === false ? true : false;
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: nextState })
        .eq("auth_user_id", target.auth_user_id);

      if (error) throw error;

      setSuccessMessage(
        `Authority officer ${target.full_name} has been ${nextState ? "ACTIVATED" : "DEACTIVATED"}.`
      );
      setAuthorities(prev =>
        prev.map(a => (a.auth_user_id === target.auth_user_id ? { ...a, is_active: nextState } : a))
      );
    } catch (err: any) {
      console.error("Toggle error:", err);
      setErrorMessage(err.message || "Failed to update authority status.");
    }
  };

  // Handle Transfer / Assignment update
  const handleSaveTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAuthority) return;

    setIsSubmittingEdit(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          state: editState,
          district: editDistrict,
          department: editDepartment,
          designation: editDesignation.trim() || editingAuthority.designation
        })
        .eq("auth_user_id", editingAuthority.auth_user_id);

      if (error) throw error;

      setSuccessMessage(`Jurisdiction transferred successfully for ${editingAuthority.full_name}.`);
      setEditingAuthority(null);
      await fetchAuthorities();
    } catch (err: any) {
      console.error("Transfer error:", err);
      setErrorMessage(err.message || "Failed to transfer authority assignment.");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Handle Onboard New Authority Account
  const handleCreateAuthority = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword || !newFullName) {
      setErrorMessage("Please fill all required credentials.");
      return;
    }

    setIsSubmittingNew(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: newEmail.trim(),
        password: newPassword,
        options: {
          data: {
            full_name: newFullName.trim(),
            role: "authority",
            department: newDepartment,
            state: newState,
            district: newDistrict,
            badge_number: newBadge.trim() || null,
            designation: newDesignation.trim() || null
          }
        }
      });

      if (authErr) throw authErr;

      const user = authData.user;
      if (!user) throw new Error("Could not initialize authority credentials.");

      // Direct upsert profile if session or service allows
      await supabase.from("profiles").upsert({
        auth_user_id: user.id,
        full_name: newFullName.trim(),
        email: newEmail.trim(),
        phone: newPhone.trim() || null,
        role: "authority",
        jurisdiction_level: "district",
        state: newState,
        district: newDistrict,
        department: newDepartment,
        badge_number: newBadge.trim() || null,
        designation: newDesignation.trim() || null,
        is_active: true,
        can_act: true
      }, { onConflict: "auth_user_id" });

      setSuccessMessage(`New Statutory Authority Officer [${newFullName.trim()}] successfully onboarded.`);
      setShowCreateModal(false);
      setNewEmail("");
      setNewPassword("");
      setNewFullName("");
      setNewPhone("");
      setNewBadge("");
      await fetchAuthorities();
    } catch (err: any) {
      console.error("Creation error:", err);
      setErrorMessage(err.message || "Failed to onboard authority officer.");
    } finally {
      setIsSubmittingNew(false);
    }
  };

  if (!isOpen) return null;

  // Filtered Authorities
  const filtered = authorities.filter(a => {
    const matchesSearch = 
      searchTerm === "" ||
      a.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.badge_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.designation?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDistrict = filterDistrict === "All" || a.district === filterDistrict;
    return matchesSearch && matchesDistrict;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="w-full max-w-5xl bg-slate-900 border-2 border-red-900/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 max-h-[92vh] flex flex-col my-auto">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-red-900/60 border border-red-700 grid place-items-center text-red-300">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white leading-tight">
                Statutory Authority Administration &amp; Jurisdiction Bureau
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Government Oversight • Police &amp; Municipal Licensing Officer Governance
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow"
            >
              <UserPlus size={14} />
              <span>+ Onboard Authority</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Alerts */}
        {successMessage && (
          <div className="px-6 py-2.5 bg-emerald-950 border-b border-emerald-800 text-emerald-200 text-xs font-medium flex items-center gap-2 shrink-0">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="px-6 py-2.5 bg-red-950 border-b border-red-800 text-red-200 text-xs font-medium flex items-center gap-2 shrink-0">
            <AlertCircle size={16} className="text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Toolbar */}
        <div className="px-6 py-3 bg-slate-950/60 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="relative w-full sm:w-80">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search officer, badge ID, department..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <span className="text-xs text-slate-400 font-medium">District:</span>
            <select
              value={filterDistrict}
              onChange={e => setFilterDistrict(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-red-500"
            >
              <option value="All">All Districts</option>
              {TN_DISTRICTS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            <button
              onClick={fetchAuthorities}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Refresh Directory"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <RefreshCw size={24} className="animate-spin text-red-500 mx-auto" />
              <p className="text-xs font-bold uppercase tracking-wider">Loading Authority Officer Registry...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-slate-400 border border-dashed border-slate-800 rounded-xl">
              <Shield size={32} className="text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-300">No Authority Officers Found</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No statutory authority officers currently registered matching your jurisdiction and filters.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition"
              >
                <UserPlus size={14} />
                <span>Onboard Authority Officer</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map(auth => {
                const isActive = auth.is_active !== false;
                return (
                  <div
                    key={auth.auth_user_id || auth.id}
                    className={`p-4 rounded-xl border transition ${
                      isActive 
                        ? "bg-slate-950/80 border-slate-800 hover:border-slate-700" 
                        : "bg-slate-950/40 border-red-950/50 opacity-70"
                    } space-y-3`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">
                            {auth.full_name}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                            isActive
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-700"
                              : "bg-red-950 text-red-300 border border-red-700"
                          }`}>
                            {isActive ? "ACTIVE" : "INACTIVE"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {auth.designation || "Statutory Enforcement Officer"}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingAuthority(auth);
                            setEditState(auth.state || "Tamil Nadu");
                            setEditDistrict(auth.district || "Chennai");
                            setEditDepartment(auth.department || AUTHORITY_DEPARTMENTS[0]);
                            setEditDesignation(auth.designation || "");
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                          title="Modify Jurisdiction / Department"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleToggleActive(auth)}
                          className={`p-1.5 rounded-lg transition ${
                            isActive
                              ? "bg-red-950/60 hover:bg-red-900 text-red-300"
                              : "bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300"
                          }`}
                          title={isActive ? "Deactivate Officer" : "Activate Officer"}
                        >
                          {isActive ? <PowerOff size={13} /> : <Power size={13} />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-300 pt-1 border-t border-slate-800/80">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Department:</span>
                        <span className="font-semibold text-slate-200 text-right">{auth.department || "Police"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Station Jurisdiction:</span>
                        <span className="font-semibold text-amber-300">{auth.district || "Chennai"}, {auth.state || "Tamil Nadu"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Officer Badge ID:</span>
                        <span className="font-mono text-slate-300">{auth.badge_number || "UNASSIGNED"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Email:</span>
                        <span className="text-slate-400 font-mono text-[11px]">{auth.email}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>Authority Registry • Total Officers in Scope: {authorities.length}</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition"
          >
            Close Registry
          </button>
        </div>

      </div>

      {/* Onboard New Authority Sub-Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-red-700 rounded-2xl shadow-2xl p-6 text-white space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-black text-sm text-white flex items-center gap-2">
                <UserPlus size={16} className="text-red-400" />
                <span>Onboard Statutory Authority Officer</span>
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateAuthority} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1">Officer Full Name *</label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={e => setNewFullName(e.target.value)}
                  placeholder="e.g. Inspector R. Kannan"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">Official Email *</label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    placeholder="officer@police.tn.gov.in"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">Temporary Password *</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">Badge / Officer ID</label>
                  <input
                    type="text"
                    value={newBadge}
                    onChange={e => setNewBadge(e.target.value)}
                    placeholder="TN-POL-9021"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">Designation</label>
                  <input
                    type="text"
                    value={newDesignation}
                    onChange={e => setNewDesignation(e.target.value)}
                    placeholder="Assistant Commissioner"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">State Jurisdiction</label>
                  <select
                    value={newState}
                    onChange={e => setNewState(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  >
                    {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">District Jurisdiction</label>
                  <select
                    value={newDistrict}
                    onChange={e => setNewDistrict(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  >
                    {TN_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1">Department</label>
                <select
                  value={newDepartment}
                  onChange={e => setNewDepartment(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                >
                  {AUTHORITY_DEPARTMENTS.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNew}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-bold text-white flex items-center gap-1.5"
                >
                  {isSubmittingNew ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  <span>Onboard Officer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit / Transfer Jurisdiction Sub-Modal */}
      {editingAuthority && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-amber-700 rounded-2xl shadow-2xl p-6 text-white space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-black text-sm text-white flex items-center gap-2">
                <Edit2 size={16} className="text-amber-400" />
                <span>Modify / Transfer Jurisdiction</span>
              </h3>
              <button onClick={() => setEditingAuthority(null)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="text-xs text-slate-400">
              Transferring officer: <strong className="text-white">{editingAuthority.full_name}</strong> ({editingAuthority.email})
            </div>

            <form onSubmit={handleSaveTransfer} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1">State Jurisdiction</label>
                <select
                  value={editState}
                  onChange={e => setEditState(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                >
                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1">District Jurisdiction</label>
                <select
                  value={editDistrict}
                  onChange={e => setEditDistrict(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                >
                  {TN_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1">Department</label>
                <select
                  value={editDepartment}
                  onChange={e => setEditDepartment(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                >
                  {AUTHORITY_DEPARTMENTS.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1">Designation</label>
                <input
                  type="text"
                  value={editDesignation}
                  onChange={e => setEditDesignation(e.target.value)}
                  placeholder="e.g. Assistant Commissioner"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingAuthority(null)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded-lg font-bold text-white flex items-center gap-1.5"
                >
                  {isSubmittingEdit ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  <span>Save Transfer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
