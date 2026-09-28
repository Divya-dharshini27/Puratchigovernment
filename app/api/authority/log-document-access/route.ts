import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "../../../../lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const userClient = await createServerSupabaseClient();
    const adminClient = createAdminSupabaseClient();
    const db = adminClient || userClient;

    const { data: { session }, error: sessionErr } = await userClient.auth.getSession();
    if (sessionErr || !session?.user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    let { data: profile } = await db
      .from("profiles")
      .select("*")
      .eq("auth_user_id", session.user.id)
      .maybeSingle();

    const role = profile?.role || session.user.user_metadata?.role || "authority";
    if (role !== "authority" && role !== "government") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { eventId, documentName, documentId } = body;

    if (!eventId) {
      return NextResponse.json({ success: false, message: "Missing eventId" }, { status: 400 });
    }

    const officerName = profile?.full_name || session.user.user_metadata?.full_name || "Statutory Officer";
    const officerDistrict = profile?.district || session.user.user_metadata?.district;
    const officerState = profile?.state || session.user.user_metadata?.state || "Tamil Nadu";
    const jurisdictionStr = officerDistrict ? `${officerDistrict}, ${officerState}` : `${officerState} Jurisdiction`;
    const performerId = profile?.auth_user_id || profile?.id || session.user.id;

    // Insert DOCUMENT_ACCESSED into admin_audit_logs
    try {
      await db.from("admin_audit_logs").insert({
        event_id: eventId,
        performed_by: performerId,
        performer_name: officerName,
        role: role as "authority" | "government",
        jurisdiction: jurisdictionStr,
        action: "DOCUMENT_ACCESSED",
        authority_notes: `Accessed private statutory document: '${documentName || "Permit Attachment"}' (Doc ID: ${documentId || "N/A"})`
      });
    } catch (auditErr) {
      console.warn("Could not insert document access audit log:", auditErr);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Document access log error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
