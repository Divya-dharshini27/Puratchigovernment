// PURATCHI Government & Authority Administrative Console Types

export type UserRole = "citizen" | "host" | "government" | "authority";
export type JurisdictionLevel = "central" | "state" | "district" | "taluk";

export type EventStatus = 
  | "draft" 
  | "pending" 
  | "request_info"
  | "approved" 
  | "rejected" 
  | "revoked"
  | "expired" 
  | "upcoming" 
  | "ongoing" 
  | "completed" 
  | "archived";

export interface AdminProfile {
  id?: string;
  auth_user_id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  role: "government" | "authority";
  jurisdiction_level?: JurisdictionLevel | null;
  state?: string | null;
  district?: string | null;
  department?: string | null;
  badge_number?: string | null;
  designation?: string | null;
  language?: string | null;
  is_active?: boolean;
  can_act?: boolean;
  created_at?: string;
}

export interface EventItem {
  id: string;
  host_id: string;
  title: string;
  category: string;
  purpose: string;
  description: string;
  event_date: string;
  start_time: string;
  end_time: string;
  location_name: string;
  place_of_assembly: string;
  latitude?: number | null;
  longitude?: number | null;
  expected_attendance: number;
  min_age?: number | null;
  max_age?: number | null;
  additional_criteria?: string | null;
  route_details?: string | null;
  equipment_details?: string | null;
  jurisdiction_requirements?: string | null;
  status: EventStatus;
  approval_deadline?: string | null;
  rejection_reason?: string | null;
  authority_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  state?: string | null;
  district?: string | null;
  whatsapp_group_link?: string | null;
  qr_token?: string | null;
  qr_status?: "active" | "revoked" | "expired" | null;
  qr_expires_at?: string | null;
  created_at: string;
  updated_at?: string | null;
  // Augmented details joined from host profile
  host_name?: string;
  host_email?: string;
  host_phone?: string;
}

export interface EventDocument {
  id: string;
  event_id: string;
  host_id: string;
  document_name: string;
  file_path: string;
  file_type?: string | null;
  file_size?: number | null;
  uploaded_at: string;
  signed_url?: string | null;
}

export type AuditAction = 
  | "QR_SCANNED"
  | "EVENT_REVIEWED"
  | "APPROVED"
  | "REQUEST_INFO"
  | "REJECTED"
  | "REVOKED"
  | "UNVERIFIED"
  | "CONDITIONS_ATTACHED"
  | "DOCUMENT_ACCESSED"
  | "ADMINISTRATIVE_CHANGES"
  | "REVIEWED"
  | "FLAGGED";

export interface AdminAuditLog {
  id: string;
  event_id: string;
  performed_by: string;
  performer_name: string;
  role: "government" | "authority";
  jurisdiction: string;
  action: AuditAction;
  previous_status?: string | null;
  new_status?: string | null;
  rejection_reason?: string | null;
  authority_notes?: string | null;
  created_at: string;
  event_title?: string;
}

export interface EventInfoRequest {
  id: string;
  event_id: string;
  requested_by: string;
  officer_name: string;
  officer_jurisdiction?: string | null;
  request_message: string;
  required_documents: string[];
  host_response?: string | null;
  status: "pending" | "responded" | "resolved";
  created_at: string;
  responded_at?: string | null;
}

export interface QRValidationResponse {
  valid: boolean;
  event?: EventItem;
  reason?: "invalid" | "expired" | "revoked" | "jurisdiction_mismatch" | "not_found" | "unauthorized";
  message?: string;
  authorizedJurisdiction?: string;
  eventJurisdiction?: string;
}

export interface GovernmentTotalLogItem {
  eventId: string;
  eventTitle: string;
  category: string;
  status: EventStatus;
  authorityName?: string | null;
  authorityRole?: string | null;
  jurisdiction: string;
  decision?: string | null;
  decisionTimestamp?: string | null;
  rejectionReason?: string | null;
  authorityNotes?: string | null;
  infoRequests: EventInfoRequest[];
  auditHistory: AdminAuditLog[];
  created_at: string;
}

// Preset standard regulatory rejection reasons for statutory authorities
export const STATUTORY_REJECTION_REASONS = [
  "Route conflict with essential emergency transit / hospital corridor",
  "High security exclusion zone / Section 144 regulatory restriction",
  "Failure to submit mandatory fire & emergency medical contingency plan",
  "Excessive anticipated attendance exceeding safe physical capacity of venue",
  "Noise pollution regulations / Loudspeaker prohibited near silent zone (school/hospital)",
  "Incomplete or unverified identity / organizer clearance documentation",
  "Conflict with previously sanctioned high-priority state public assembly",
  "Failure to provide designated trained citizen safety marshals"
];

// Preset standard emergency revocation / unverify reasons for authorities when crowd surges or safety hazards occur
export const STATUTORY_REVOCATION_REASONS = [
  "Dangerous crowd surge exceeding safe physical venue capacity limits",
  "Emergency transit & ambulance corridor blocked / acute stampede hazard",
  "Failure or shortage of organizer safety marshals / perimeter breach",
  "High-security public order disturbance / Section 144 emergency imposition",
  "Severe structural hazard, fire incident, or extreme weather emergency",
  "Direct violation of attached statutory clearance conditions on site",
  "Organizer failure to maintain compliance with approved assembly boundaries"
];

// Preset standard required documents for Request Information
export const STANDARD_REQUIRED_DOCUMENTS = [
  "Fire & Emergency Services Clearance / NOC",
  "Venue Owner / Ground Authority Permission Letter",
  "Traffic Dispersal & Parking Contingency Plan",
  "Medical First-Aid Team & Ambulance Deployment Plan",
  "Organizing Committee Identity & Address Verification",
  "Sound & Loudspeaker Decibel Compliance Declaration",
  "Citizen Volunteer Safety Marshal Roster (Minimum 10 marshals)"
];

// Reference Indian States
export const INDIAN_STATES = [
  "Tamil Nadu",
  "Kerala",
  "Karnataka",
  "Andhra Pradesh",
  "Telangana",
  "Maharashtra",
  "Delhi (NCT)",
  "West Bengal",
  "Gujarat",
  "Rajasthan",
  "Uttar Pradesh",
  "Madhya Pradesh",
  "Punjab",
  "Haryana",
  "Odisha",
  "Assam",
  "Bihar"
];

// Reference Districts for Tamil Nadu (Default primary operational state for PURATCHI)
export const TN_DISTRICTS = [
  "Chennai",
  "Coimbatore",
  "Madurai",
  "Tiruchirappalli",
  "Salem",
  "Tirunelveli",
  "Erode",
  "Vellore",
  "Thoothukudi",
  "Dindigul",
  "Thanjavur",
  "Kanchipuram",
  "Chengalpattu",
  "Tiruvallur",
  "Cuddalore",
  "Dharmapuri",
  "Karur",
  "Nagapattinam",
  "Namakkal",
  "Nilgiris",
  "Pudukkottai",
  "Ramanathapuram",
  "Sivaganga",
  "Tenkasi",
  "Theni",
  "Tiruppur",
  "Tiruvannamalai",
  "Villupuram",
  "Virudhunagar"
];

// Common Government & Authority Departments
export const GOVT_DEPARTMENTS = [
  "Department of Home Affairs & Public Order",
  "State Home Department",
  "District Collectorate / Magistrate Office",
  "Revenue & Disaster Management",
  "Department of Youth Welfare & Sports",
  "Municipal Administration & Urban Development"
];

export const AUTHORITY_DEPARTMENTS = [
  "City Police Commissionerate (Law & Order)",
  "District Police Office (Superintendent of Police)",
  "Traffic Police Regulatory Division",
  "Municipal Corporation Public Health & Safety",
  "State Fire & Rescue Services Department",
  "Sub-Divisional Magistrate (SDM) Licensing Branch"
];
