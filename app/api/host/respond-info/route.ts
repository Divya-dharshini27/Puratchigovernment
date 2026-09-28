import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr || !session?.user) {
      return NextResponse.json({ success: false, message: "Authentication required." }, { status: 401 });
    }

    const body = await req.json();
    const { eventId, requestId, hostResponse } = body;

    if (!eventId || !hostResponse?.trim()) {
      return NextResponse.json(
        { success: false, message: "Missing eventId or host response message." },
        { status: 400 }
      );
    }

    // Verify host ownership of this event
    const { data: event, error: eventErr } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .maybeSingle();

    if (eventErr || !event) {
      return NextResponse.json({ success: false, message: "Event not found." }, { status: 404 });
    }

    if (event.host_id !== session.user.id) {
      return NextResponse.json({ success: false, message: "Only the event host organizer can respond to this inquiry." }, { status: 403 });
    }

    // 1. Update event_info_requests if requestId provided
    if (requestId) {
      await supabase
        .from("event_info_requests")
        .update({
          host_response: hostResponse.trim(),
          status: "responded",
          responded_at: new Date().toISOString()
        })
        .eq("id", requestId);
    } else {
      // Find latest pending request
      const { data: pendingReq } = await supabase
        .from("event_info_requests")
        .select("id")
        .eq("event_id", eventId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pendingReq) {
        await supabase
          .from("event_info_requests")
          .update({
            host_response: hostResponse.trim(),
            status: "responded",
            responded_at: new Date().toISOString()
          })
          .eq("id", pendingReq.id);
      }
    }

    // 2. Change event status back to 'pending'
    const { error: updateErr } = await supabase
      .from("events")
      .update({
        status: "pending",
        authority_notes: `Host Submitted Clarification: ${hostResponse.trim().slice(0, 100)}...`
      })
      .eq("id", eventId);

    if (updateErr) throw updateErr;

    // 3. Insert Admin Audit Log
    const { data: hostProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("auth_user_id", session.user.id)
      .maybeSingle();

    const hostName = hostProfile?.full_name || session.user.user_metadata?.full_name || "Host Organizer";

    await supabase.from("admin_audit_logs").insert({
      event_id: eventId,
      performed_by: session.user.id,
      performer_name: hostName,
      role: "authority", // recorded in admin audit system
      jurisdiction: event.district || event.location_name || "Host Submissions",
      action: "ADMINISTRATIVE_CHANGES",
      previous_status: "request_info",
      new_status: "pending",
      authority_notes: `Host supplied requested clarification. Event moved back to Pending Review queue: "${hostResponse.trim()}"`
    });

    return NextResponse.json({
      success: true,
      message: "Information submitted successfully. Assembly returned to Statutory Authority review queue."
    });

  } catch (error: any) {
    console.error("Host respond info error:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to submit response." }, { status: 500 });
  }
}
