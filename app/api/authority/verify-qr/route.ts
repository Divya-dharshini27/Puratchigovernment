import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // 1. Verify caller session
    const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr || !session?.user) {
      return NextResponse.json(
        { 
          valid: false, 
          reason: "unauthorized", 
          message: "Authentication required to validate official assembly QR codes. Please log in as an authorized officer." 
        },
        { status: 401 }
      );
    }

    // 2. Fetch Officer Profile
    const { data: officerProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("auth_user_id", session.user.id)
      .maybeSingle();

    const role = officerProfile?.role || session.user.user_metadata?.role;
    if (role !== "authority" && role !== "government") {
      return NextResponse.json(
        { 
          valid: false, 
          reason: "unauthorized", 
          message: "Access restricted: Only Statutory Authority and Government personnel can validate assembly QR codes." 
        },
        { status: 403 }
      );
    }

    const officerDistrict = officerProfile?.district || session.user.user_metadata?.district;
    const officerState = officerProfile?.state || session.user.user_metadata?.state || "Tamil Nadu";
    const jurisdictionLevel = officerProfile?.jurisdiction_level || session.user.user_metadata?.jurisdiction_level || "district";
    const officerName = officerProfile?.full_name || session.user.user_metadata?.full_name || "Statutory Officer";
    const officerJurisdictionStr = officerDistrict ? `${officerDistrict} District, ${officerState}` : `${officerState} (Statewide)`;

    // 3. Extract QR token or payload
    const body = await req.json();
    const rawToken = (body.token || body.qrCode || body.code || "").trim();

    if (!rawToken) {
      return NextResponse.json(
        { valid: false, reason: "invalid", message: "Missing QR verification token." },
        { status: 400 }
      );
    }

    // Extract clean token (support URLs, prefix PQ-, PURATCHI-QR-, or UUIDs)
    let searchToken = rawToken;
    try {
      if (rawToken.includes("http://") || rawToken.includes("https://") || rawToken.includes("?token=")) {
        const urlObj = new URL(rawToken, "http://localhost");
        const urlToken = urlObj.searchParams.get("token");
        if (urlToken) searchToken = urlToken.trim();
      }
    } catch {
      // not a full url, keep searchToken as is
    }

    const uuidMatch = searchToken.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);

    // 4. Query Events by qr_token or UUID
    let query = supabase
      .from("events")
      .select(`
        *,
        profiles:host_id (
          full_name,
          email,
          phone
        )
      `);

    if (searchToken.startsWith("PQ-") || searchToken.startsWith("PURATCHI-QR-")) {
      const cleanToken = searchToken.replace("PURATCHI-QR-", "");
      query = query.or(`qr_token.eq.${cleanToken},qr_token.eq.${searchToken}`);
    } else if (uuidMatch) {
      query = query.or(`id.eq.${uuidMatch[0]},qr_token.eq.${searchToken}`);
    } else if (searchToken.startsWith("PURATCHI-EVENT-")) {
      const idPart = searchToken.replace("PURATCHI-EVENT-", "").trim();
      query = query.or(`id.eq.${idPart},qr_token.eq.${searchToken}`);
    } else {
      query = query.or(`qr_token.eq.${searchToken},id.eq.${searchToken}`);
    }

    const { data: eventData, error: eventErr } = await query.maybeSingle();

    if (eventErr || !eventData) {
      return NextResponse.json(
        { 
          valid: false, 
          reason: "not_found", 
          message: "No matching assembly registration found for this QR token. Code may be invalid or forged." 
        },
        { status: 404 }
      );
    }

    // 5. Check QR Revocation Status
    if (eventData.qr_status === "revoked") {
      return NextResponse.json(
        { 
          valid: false, 
          reason: "revoked", 
          message: "This Assembly QR Pass has been REVOKED by administrative order.",
          event: { 
            id: eventData.id, 
            title: eventData.title, 
            status: eventData.status,
            category: eventData.category,
            event_date: eventData.event_date
          }
        },
        { status: 410 }
      );
    }

    // 6. Check QR Expiry
    const isExpired = eventData.qr_status === "expired" || 
      (eventData.qr_expires_at && new Date(eventData.qr_expires_at).getTime() < Date.now());

    if (isExpired) {
      return NextResponse.json(
        { 
          valid: false, 
          reason: "expired", 
          message: "This Assembly QR Pass has EXPIRED. The host must request a new statutory clearance pass.",
          event: { 
            id: eventData.id, 
            title: eventData.title, 
            status: eventData.status,
            category: eventData.category,
            event_date: eventData.event_date
          }
        },
        { status: 410 }
      );
    }

    // 7. Check Authority Jurisdiction Scope
    const eventLocation = `${eventData.location_name || ""} ${eventData.place_of_assembly || ""}`;
    const eventDistrict = eventData.district || extractDistrict(eventLocation) || "Assigned District";
    const isStatewideOfficer = !officerDistrict || 
      officerDistrict.toLowerCase().includes("statewide") || 
      officerDistrict.toLowerCase().includes("tamil nadu") ||
      jurisdictionLevel === "state" ||
      jurisdictionLevel === "central" ||
      role === "government";

    if (!isStatewideOfficer && officerDistrict) {
      const locationLower = eventLocation.toLowerCase();
      const districtLower = officerDistrict.toLowerCase();
      const eventDistrictLower = (eventData.district || "").toLowerCase();

      const districtMatches = locationLower.includes(districtLower) || 
        (eventDistrictLower && eventDistrictLower.includes(districtLower));

      if (!districtMatches) {
        return NextResponse.json(
          {
            valid: false,
            reason: "jurisdiction_mismatch",
            message: `JURISDICTION RESTRICTION: This assembly is located in '${eventDistrict}', which is outside your assigned jurisdiction (${officerJurisdictionStr}). Only officers stationed in ${eventDistrict} or statewide supervisors can inspect this dossier.`,
            authorizedJurisdiction: officerJurisdictionStr,
            eventJurisdiction: eventDistrict,
            event: {
              id: eventData.id,
              title: eventData.title,
              category: eventData.category,
              location_name: eventData.location_name,
              place_of_assembly: eventData.place_of_assembly,
              status: eventData.status
            }
          },
          { status: 403 }
        );
      }
    }

    // 8. Log "QR_SCANNED" in Admin Audit Logs
    try {
      await supabase.from("admin_audit_logs").insert({
        event_id: eventData.id,
        performed_by: session.user.id,
        performer_name: officerName,
        role: role as "authority" | "government",
        jurisdiction: officerJurisdictionStr,
        action: "QR_SCANNED",
        previous_status: eventData.status,
        new_status: eventData.status,
        authority_notes: `Field QR Code validated via ${officerJurisdictionStr} officer terminal.`
      });
    } catch (auditErr) {
      console.warn("Could not record QR scan audit log:", auditErr);
    }

    // 9. Format Safe Output Payload
    const formattedEvent = {
      ...eventData,
      host_name: (eventData as any).profiles?.full_name || "Verified Organizer",
      host_email: (eventData as any).profiles?.email || "",
      host_phone: (eventData as any).profiles?.phone || ""
    };

    return NextResponse.json({
      valid: true,
      eventId: eventData.id,
      event: formattedEvent,
      officer: {
        name: officerName,
        jurisdiction: officerJurisdictionStr,
        role
      },
      message: `QR code successfully verified by ${officerName} (${officerJurisdictionStr}).`
    });

  } catch (error: any) {
    console.error("QR validation server error:", error);
    return NextResponse.json(
      { valid: false, reason: "invalid", message: error.message || "Internal server error validating QR code." },
      { status: 500 }
    );
  }
}

// Helper to extract district name from location text
function extractDistrict(text: string): string | null {
  const TN_DISTRICTS_SAMPLE = [
    "Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", 
    "Tirunelveli", "Erode", "Vellore", "Thoothukudi", "Dindigul", 
    "Thanjavur", "Kanchipuram", "Chengalpattu", "Tiruvallur", "Cuddalore",
    "Dharmapuri", "Karur", "Nagapattinam", "Namakkal", "Nilgiris", "Pudukkottai",
    "Ramanathapuram", "Sivaganga", "Tenkasi", "Theni", "Tiruppur", "Tiruvannamalai",
    "Villupuram", "Virudhunagar"
  ];
  for (const d of TN_DISTRICTS_SAMPLE) {
    if (new RegExp(`\\b${d}\\b`, "i").test(text)) {
      return d;
    }
  }
  return null;
}
