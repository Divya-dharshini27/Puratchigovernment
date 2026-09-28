import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // 1. Authenticate user
    const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr || !session?.user) {
      return NextResponse.json(
        { success: false, message: "Authentication required to access private permit documents." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { filePath, eventId, documentName, documentId } = body;

    if (!filePath) {
      return NextResponse.json(
        { success: false, message: "Missing required document filePath." },
        { status: 400 }
      );
    }

    // 2. Fetch user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("auth_user_id", session.user.id)
      .maybeSingle();

    const role = profile?.role || session.user.user_metadata?.role;
    const isOfficer = role === "authority" || role === "government";

    // 3. If not an officer, verify host ownership
    if (!isOfficer) {
      if (!eventId) {
        return NextResponse.json(
          { success: false, message: "Event ID required for access verification." },
          { status: 400 }
        );
      }

      const { data: event } = await supabase
        .from("events")
        .select("host_id")
        .eq("id", eventId)
        .maybeSingle();

      if (!event || event.host_id !== session.user.id) {
        return NextResponse.json(
          { success: false, message: "Access restricted: You do not have permission to view this private document." },
          { status: 403 }
        );
      }
    }

    // 4. Generate signed URL from Supabase Storage (1 hour expiry)
    const { data: signedData, error: signErr } = await supabase.storage
      .from("permit-documents")
      .createSignedUrl(filePath, 3600);

    if (signErr || !signedData?.signedUrl) {
      return NextResponse.json(
        { success: false, message: signErr?.message || "Failed to generate secure signed URL for document." },
        { status: 500 }
      );
    }

    // 5. If officer accessed, log to admin audit trail
    if (isOfficer && eventId) {
      const officerName = profile?.full_name || session.user.user_metadata?.full_name || "Statutory Officer";
      const officerDistrict = profile?.district || session.user.user_metadata?.district;
      const officerState = profile?.state || session.user.user_metadata?.state || "Tamil Nadu";
      const officerJurisdictionStr = officerDistrict ? `${officerDistrict}, ${officerState}` : officerState;

      try {
        await supabase.from("admin_audit_logs").insert({
          event_id: eventId,
          performed_by: session.user.id,
          performer_name: officerName,
          role: role as "authority" | "government",
          jurisdiction: officerJurisdictionStr,
          action: "DOCUMENT_ACCESSED",
          authority_notes: `Inspected secure regulatory document: ${documentName || filePath}`
        });
      } catch (auditErr) {
        console.warn("Could not insert document audit log:", auditErr);
      }
    }

    return NextResponse.json({
      success: true,
      signedUrl: signedData.signedUrl,
      expiresIn: 3600,
      documentName: documentName || filePath.split("/").pop()
    });

  } catch (error: any) {
    console.error("Signed URL error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to generate signed document URL." },
      { status: 500 }
    );
  }
}
