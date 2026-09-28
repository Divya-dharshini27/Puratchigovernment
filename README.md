# PURATCHI — Sovereign Regulatory & Assembly Oversight Platform

> **Official Government & Statutory Authority Administrative Console Documentation**  
> *Secure Public Assembly Oversight, Cryptographic QR Field Verification, Multi-Tier Jurisdiction Access Control, and Immutable Audit Logging.*

---

## 🏛️ Executive Summary

**PURATCHI** provides an enterprise-grade administrative and statutory framework designed for state civil administrations, home departments, district magistracies, police commissionerates, and regulatory safety bodies.

The platform establishes transparency, accountability, and real-time coordination for public gatherings, marches, civic assemblies, and community forums while ensuring strict compliance with public safety laws and statutory timelines.

---

## 👥 Role Architecture: Government Officials vs. Statutory Authorities

The platform enforces a strict separation of powers between **Macro Civil Administration (Government)** and **Field Enforcement & Licensing (Statutory Authority)**:

| Capability / Permission | Government Officials (`role: 'government'`) | Statutory Authority Officers (`role: 'authority'`) |
|---|---|---|
| **Primary Departments** | State Home Department, Civil Administration, District Collectorates / Magistrates, Urban Development | City Police Commissionerates, District SP Offices, Traffic Police, Fire & Rescue, SDM Licensing Branches |
| **Operational Scope** | Statewide Oversight, Policy Review, Macro Analytics, Audit Compliance | Territorial Jurisdiction (District / Sub-division Enforcement & Decisions) |
| **Statewide Assembly View** | ✅ Yes (Filter across all 38 districts & statewide) | ⚠️ Scoped to assigned district/station territory |
| **3-Way Statutory Decisions** | 👁️ Supervisory Oversight (View-only audit) | ⚡ Executive Action (`APPROVE`, `REQUEST_INFO`, `REJECT`) |
| **Field QR Code Scanner** | 👁️ Verification & Audit lookup | ⚡ Active Field Validation & On-Site Inspection |
| **Total Log & State Timeline** | ✅ Full statewide timeline with export capabilities | ⚠️ Scoped event audit logs & information threads |
| **Officer Management** | ✅ Provision, activate/deactivate authority officers | ❌ Managed by Government Administrators |
| **Private Document Inspection** | ✅ Secure signed URL access with audit logging | ✅ Secure signed URL access with audit logging |
| **24-Hour Statutory SLA Tracking** | ✅ Statewide SLA compliance monitoring | ⚡ Real-time dynamic countdown timers on queue items |

---

## 🔍 Features & Details Accessible by Government Officials

Government Officials logging into the **Government Console** (`/government/dashboard`) have access to the following features:

### 1. Macro Executive Command & Analytics Dashboard
- **Statewide Assembly Metrics**:
  - **Total Assemblies Registered**: Aggregated real-time count of all civic assemblies across all categories.
  - **Pending Statutory Review**: Real-time counter of applications currently within the statutory 24-hour review queue.
  - **Approved & Sanctioned Assemblies**: Total assemblies cleared by territorial police and regulatory agencies.
  - **Clarification / Info Requested**: Assemblies pending host documentation or safety revisions.
  - **Rejected Assemblies**: Applications denied with recorded statutory justifications.
  - **Expired Reviews**: Applications where statutory deadlines lapsed.
- **Estimated Total Citizen Attendance**: Aggregate crowd scope calculated across all active assemblies to anticipate public infrastructure and transportation requirements.
- **High-Density Zone Monitoring**: Visual alerts identifying districts with simultaneous large-scale assemblies.

### 2. Multi-Level Jurisdiction Filtering & Regional Drill-Down
- **Statewide vs District-Level Filtering**:
  - Filter across all **38 Districts of Tamil Nadu** (Chennai, Coimbatore, Madurai, Tiruchirappalli, Salem, etc.) or custom state scopes.
- **Category-Based Filtering**:
  - Youth Civic Assemblies, Climate & Environment Marches, Education Rights Forums, Digital Safety & Tech Rights Gatherings, Cultural Gatherings, Peaceful Demonstrations, Community Welfare Drives.
- **Status Filter Tabs**:
  - Instant toggle between *All, Pending, Info Requested, Approved, Rejected,* and *Expired*.

### 3. Total Log & Sovereign Legislative Audit Trail
- **Comprehensive Timeline View**:
  - Inspect every single administrative action executed in the state in chronological order.
  - View **which officer** performed the action (Name, Designation, Department, Station).
  - View **action types**: `APPROVED`, `REJECTED`, `REQUEST_INFO`, `QR_SCANNED`, `DOCUMENT_ACCESSED`, `ADMINISTRATIVE_CHANGES`.
  - View **statutory rejection grounds** and **officer condition notes**.
  - Track **Host clarification responses** submitted by organizers.
- **Compliance Export**:
  - Export audit logs and assembly summaries for legislative review, departmental inquiries, or RTI compliance.

### 4. Complete 12-Field Assembly Dossier Inspection
Government Officials can inspect any assembly's comprehensive dossier containing all 12 regulatory fields:
1. **Event Name**: Official public assembly title.
2. **Category**: Statutory event classification.
3. **Statement of Purpose**: Foundational purpose and civic objective.
4. **Assembly Description & Route Details**: Complete schedule, march trajectory, route coordinates, and safety volunteer marshals.
5. **Date & Schedule**: Assembly date, starting time, ending time.
6. **Venue & GPS Coordinates**: Location name, place of assembly ground/street, exact GPS coordinates (Latitude/Longitude).
7. **Attendance & Demographics Scope**: Expected attendee count, age criteria (min/max age), volunteer marshal requirements.
8. **Host & Officer Credentials**:
   - **Host Organizer Details**: Full name, verified email, phone number, DigiLocker / KYC verification badge.
   - **Reviewing Officer Details**: Assigned statutory officer, badge number, department, and jurisdiction station.
9. **Private Supporting Documents**:
   - Inspection of private regulatory documents (Police NOC, Fire NOC, Traffic Diversion Plan, Venue Permission, Medical Plan) via short-lived cryptographic signed URLs.
10. **Regulatory Status Badge**: Live status (`pending`, `request_info`, `approved`, `rejected`, `expired`).
11. **Approval Deadline**: 24-hour statutory review window timer.
12. **Jurisdiction Badge**: State/District boundary authorization confirmation.

### 5. Authority Officer Provisioning & Management
Government Administrators have administrative authority over officer access via the **Authority Management Module** (`/app/components/AuthorityManagementModal.tsx`):
- View all registered statutory officers across all police commissionerates and district administrations.
- Filter officers by District, Department, and Active Status.
- Provision new authority profiles (Full Name, Official Email, Department, Designation, Badge Number, District).
- Enable/Disable executive decision rights (`can_act`).
- Activate or Deactivate officer credentials with automatic audit trail logging.

---

## 🛡️ Features & Details Accessible by Statutory Authority Officers

Statutory Authority Officers (Police Commissionerates, Traffic Regulators, Fire Services, SDMs) logging into the **Authority Console** (`/authority/dashboard` and `/authority/events/[id]`) have access to:

### 1. Territorial Clearance Queue & 24-Hour SLA Timer
- Scoped strictly to the officer's assigned **District / Division**.
- Real-time priority alerts for pending assemblies approaching the 24-hour statutory deadline.
- Dynamic urgency countdown: `Xh Ym left` (flashing red alert when `< 6 hours` remaining).

### 2. Statutory QR Code Verification Terminal (`/authority/scan`)
- **Live Camera Scanner**: High-speed QR scanning using device camera.
- **Image Upload Scanner**: Direct upload of pass images for decode.
- **Manual Token Entry**: Direct lookup of cryptographic pass tokens (`PQ-...`).
- **Server-Side Security Enforcement**:
  - Validates pass existence against central database.
  - Blocks forged or tampered QR codes (`INVALID_TOKEN`).
  - Flags revoked assembly passes with administrative revocation orders (`REVOKED_TOKEN`).
  - Alerts expired passes (`EXPIRED_TOKEN`).
  - **Jurisdiction Boundary Enforcement**: Blocks out-of-district officers from unauthorized dossier inspection (`JURISDICTION_RESTRICTION`).
  - Records scan telemetry (`QR_SCANNED`) in immutable audit logs.

### 3. Statutory Action Terminal (4-Way Decisions & Emergency Override)
Authorized officers can execute binding statutory decisions directly on the dossier or on-site scanner terminal:
1. **Approve Clearance (`APPROVE`)**:
   - Attaches mandatory police/safety conditions and traffic advisories.
   - Updates status to `approved`, immediately broadcasting to Public Discovery and Host Portal.
   - Logs `APPROVED` in audit logs.
2. **Request Information (`REQUEST_INFO`)**:
   - Specifies required clarifications or selects from preset required documents (Fire NOC, Traffic Plan, Volunteer Marshals, Noise Compliance).
   - Updates status to `request_info`. Assembly remains unapproved until the host submits requested materials.
   - Logs `REQUEST_INFO` and opens an interactive clarification thread.
3. **Reject Assembly (`REJECT`)**:
   - Selects mandatory statutory denial grounds from preset regulatory reasons or specifies custom legal grounds.
   - Updates status to `rejected`.
   - Logs `REJECTED` in permanent audit history.
4. **Emergency Unverify / Revoke Verification (`REVOKE` / `UNVERIFY`)**:
   - **Context**: When an active/approved assembly experiences dangerous crowd surges exceeding venue limits, marshal breakdown, corridor obstructions, or severe hazards.
   - **Executive Effect**:
     - Immediately changes event status to `revoked` and invalidates the cryptographic token (`qr_status = "revoked"`).
     - Field QR scanners (`/authority/scan`) instantly flag all scanned passes with crimson `REVOKED_TOKEN` alerts and cease entry.
     - Public discovery portal automatically removes the assembly from citizen view and suspends volunteer coordination links.
     - Host dashboard displays high-visibility emergency revocation orders with dispersal directives.
     - Records an immutable `REVOKED` entry in `admin_audit_logs` capturing officer ID, jurisdiction, statutory grounds, and emergency directives.

---

## 🔒 Security, Privacy & Compliance Architecture

1. **Cryptographic QR Pass Token Strategy**:
   - QR codes contain strictly opaque cryptographic lookup tokens (`PQ-` prefix with high-entropy randomized strings) pointing to official regulatory verification endpoints (`${origin}/authority/scan?token=...`).
   - **Zero sensitive PII, phone numbers, or passwords** are ever embedded in the raw QR matrix.
2. **Private Document Storage with Signed URLs**:
   - Supporting documents (NOCs, route blueprints, IDs) are stored in private Supabase Storage (`permit-documents`).
   - Accessible only via short-lived (60-3600 second) HMAC signed URLs generated on-demand after validating user role and jurisdiction authorization.
3. **Territorial Row Level Security (RLS)**:
   - Database policies ensure hosts only access their own submissions, authority officers access events matching their jurisdiction, and government administrators have statewide audit visibility.
4. **Immutable Audit Trail**:
   - Every view, scan, document inspection, and status transition is recorded in `admin_audit_logs` with timestamps, performer credentials, and jurisdiction badges.

---

## 🚀 Running the Platform Locally

### Prerequisites
- Node.js 18+ or 20+
- npm or pnpm
- Supabase Project credentials configured in `.env.local`

### Quick Start
```bash
# 1. Install dependencies
npm install

# 2. Run the development server
npm run dev
```

### Portal Entry Points
| Console / Portal | URL Path | Description |
|---|---|---|
| **Landing Portal** | `http://localhost:3000/` | Main sovereign gateway |
| **Government Console** | `http://localhost:3000/government/dashboard` | Statewide oversight & analytics |
| **Authority Console** | `http://localhost:3000/authority/dashboard` | Station clearance queue & reviews |
| **QR Scan Terminal** | `http://localhost:3000/authority/scan` | Field QR verification resolver |
| **Authority Review Page**| `http://localhost:3000/authority/events/[id]` | Full 12-field dossier & 3-way actions |
| **Host Dashboard** | `http://localhost:3000/host/dashboard` | Host organizer assembly manager & QR passes |
| **Citizen Portal** | `http://localhost:3000/citizen/dashboard` | Public discovery, volunteering & journalism |

---

## 📜 Statutory Regulatory Presets

### Standard Rejection Reasons (Oversight Statutes)
- Route conflict with essential emergency transit / hospital corridor.
- High security exclusion zone / Section 144 regulatory restriction.
- Failure to submit mandatory fire & emergency medical contingency plan.
- Excessive anticipated attendance exceeding safe physical capacity of venue.
- Noise pollution regulations / Loudspeaker prohibited near silent zone (school/hospital).
- Incomplete or unverified identity / organizer clearance documentation.
- Conflict with previously sanctioned high-priority state public assembly.
- Failure to provide designated trained citizen safety marshals.

### Standard Required Documents Checklist
- Fire & Emergency Services Clearance / NOC
- Venue Owner / Ground Authority Permission Letter
- Traffic Dispersal & Parking Contingency Plan
- Medical First-Aid Team & Ambulance Deployment Plan
- Organizing Committee Identity & Address Verification
- Sound & Loudspeaker Decibel Compliance Declaration
- Citizen Volunteer Safety Marshal Roster (Minimum 10 marshals)

### Statutory Emergency Revocation Grounds (Public Safety & Capacity Breach)
- **Crowd Surge / Physical Capacity Breach**: Turnout exceeded authorized limits (>200%), causing stampede hazard.
- **Corridor / Emergency Route Obstruction**: Assembly spilled onto unapproved arterial highway/rail transit, blocking ambulances.
- **Safety Marshal & Security Breakdown**: Host volunteer marshal deployment collapsed or failed to maintain designated buffer lines.
- **Public Order / Statutory Curfew Enacted**: District Magistrate issued emergency Section 144 order or curfew in the vicinity.
- **Severe Weather / Structural Safety Hazard**: Extreme weather, lightning advisory, or structural compromise of stage/barricades.
- **Host Violation of Mandated Approval Conditions**: Unsanctioned high-decibel amplifiers or unauthorized hazardous equipment deployed.

---

*PURATCHI Sovereign Assembly Oversight System — Government of Tamil Nadu & Statutory Regulatory Authorities.*
