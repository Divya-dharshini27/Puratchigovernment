import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "../../../../lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const userClient = await createServerSupabaseClient();
    const adminClient = createAdminSupabaseClient();
    const db = adminClient || userClient;

    // 1. Authenticate Authority
    const { data: { session }, error: sessionErr } = await userClient.auth.getSession();
    if (sessionErr || !session?.user) {
      return NextResponse.json(
        { success: false, message: "Authentication required to submit statutory decisions." },
        { status: 401 }
      );
    }

    // 2. Fetch Officer Profile & Verify Role
    let { data: officerProfile } = await db
      .from("profiles")
      .select("*")
      .eq("auth_user_id", session.user.id)
      .maybeSingle();

    const email = session.user.email || "officer@authority.gov";
    const fullName = officerProfile?.full_name || session.user.user_metadata?.full_name || session.user.user_metadata?.name || email.split("@")[0];
    const role = officerProfile?.role || session.user.user_metadata?.role || "authority";
    const officerDistrict = officerProfile?.district || session.user.user_metadata?.district;
    const officerState = officerProfile?.state || session.user.user_metadata?.state || "Tamil Nadu";
    const officerJurisdictionStr = officerDistrict ? `${officerDistrict}, ${officerState}` : `${officerState} Jurisdiction`;
    const officerName = fullName || "Statutory Officer";

    // Auto-upsert officer profile to satisfy foreign key constraints (events_reviewed_by_fkey / admin_audit_logs)
    if (!officerProfile) {
      try {
        const profilePayload: Record<string, any> = {
          auth_user_id: session.user.id,
          full_name: officerName,
          email: email,
          role: role
        };
        if (officerDistrict) profilePayload.district = officerDistrict;
        if (officerState) profilePayload.state = officerState;

        const { data: createdProfile } = await db
          .from("profiles")
          .upsert(profilePayload, { onConflict: "auth_user_id" })
          .select()
          .maybeSingle();

        if (createdProfile) {
          officerProfile = createdProfile;
        }
      } catch (upsertErr) {
        console.warn("Could not upsert officer profile into public.profiles:", upsertErr);
      }
    }

    if (role !== "authority" && role !== "government") {
      return NextResponse.json(
        { success: false, message: "Only Statutory Authority officers can record assembly clearance decisions." },
        { status: 403 }
      );
    }

    // 3. Parse Request Body
    const body = await req.json();
    const { eventId, decision, notes, rejectionReason, requestMessage, requiredDocuments } = body;

    if (!eventId || !decision) {
      return NextResponse.json(
        { success: false, message: "Missing required fields: eventId and decision are mandatory." },
        { status: 400 }
      );
    }

    // 4. Fetch Event & Validate Existing State
    const { data: event, error: eventFetchErr } = await db
      .from("events")
      .select("*")
      .eq("id", eventId)
      .maybeSingle();

    if (eventFetchErr || !event) {
      return NextResponse.json(
        { success: false, message: `Assembly event [${eventId}] not found.` },
        { status: 404 }
      );
    }

    // Check Jurisdiction matching
    if (role === "authority" && officerDistrict) {
      const eventLocation = (event.location_name || "") + " " + (event.place_of_assembly || "");
      if (
        !eventLocation.toLowerCase().includes(officerDistrict.toLowerCase()) &&
        event.district &&
        event.district.toLowerCase() !== officerDistrict.toLowerCase()
      ) {
        return NextResponse.json(
          {
            success: false,
            message: `JURISDICTION VIOLATION: You are not authorized to make decisions on events in '${event.district || event.location_name}'. Your jurisdiction is ${officerDistrict}.`
          },
          { status: 403 }
        );
      }
    }

    const previousStatus = event.status;
    let newStatus = event.status;
    let auditAction = "REVIEWED";
    let auditReasonOrNotes: string | null = null;
    const reviewerId = officerProfile?.auth_user_id || officerProfile?.id || session.user.id;

    // Helper to safely perform events table update with foreign key fallback
    const performEventUpdate = async (updateFields: Record<string, any>) => {
      let { data: updatedRows, error: updateErr } = await db
        .from("events")
        .update({
          ...updateFields,
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString()
        })
        .eq("id", eventId)
        .select();

      // If foreign key constraint failed on reviewed_by, retry update without reviewed_by
      if (updateErr && (updateErr.message?.includes("events_reviewed_by_fkey") || updateErr.code === "23503")) {
        console.warn("Retrying event update without reviewed_by due to foreign key constraint:", updateErr.message);
        const retryResult = await db
          .from("events")
          .update({
            ...updateFields,
            reviewed_at: new Date().toISOString()
          })
          .eq("id", eventId)
          .select();
        updatedRows = retryResult.data;
        updateErr = retryResult.error;
      }

      if (updateErr) throw updateErr;
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error("Database rejected update: 0 rows affected. Please ensure database RLS policies grant Authority/Government update permissions on events.");
      }
      return updatedRows;
    };

    // ─────────────────────────────────────────────────────────────
    // ACTION 1: APPROVE
    // ─────────────────────────────────────────────────────────────
    if (decision === "APPROVE") {
      newStatus = "approved";
      auditAction = "APPROVED";
      auditReasonOrNotes = notes?.trim() || "Assembly cleared under standard statutory public order regulations.";

      await performEventUpdate({
        status: "approved",
        authority_notes: auditReasonOrNotes
      });
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION 2: REQUEST INFORMATION
    // ─────────────────────────────────────────────────────────────
    else if (decision === "REQUEST_INFO") {
      if (!requestMessage || !requestMessage.trim()) {
        return NextResponse.json(
          { success: false, message: "Specific details/clarifications required from the Host organizer must be provided." },
          { status: 400 }
        );
      }

      newStatus = "request_info";
      auditAction = "REQUEST_INFO";
      auditReasonOrNotes = requestMessage.trim();

      // 1. Update events table status
      await performEventUpdate({
        status: "request_info",
        authority_notes: `Information Requested: ${requestMessage.trim()}`
      });

      // 2. Insert into event_info_requests table
      try {
        await db.from("event_info_requests").insert({
          event_id: eventId,
          requested_by: reviewerId,
          officer_name: officerName,
          officer_jurisdiction: officerJurisdictionStr,
          request_message: requestMessage.trim(),
          required_documents: Array.isArray(requiredDocuments) ? requiredDocuments : [],
          status: "pending"
        });
      } catch (reqErr) {
        console.warn("Could not insert into event_info_requests:", reqErr);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION 3: REJECT
    // ─────────────────────────────────────────────────────────────
    else if (decision === "REJECT") {
      const reason = rejectionReason?.trim();
      if (!reason) {
        return NextResponse.json(
          { success: false, message: "A mandatory regulatory/statutory rejection reason is required." },
          { status: 400 }
        );
      }

      newStatus = "rejected";
      auditAction = "REJECTED";
      auditReasonOrNotes = reason;

      await performEventUpdate({
        status: "rejected",
        rejection_reason: reason
      });
    } 

    // ─────────────────────────────────────────────────────────────
    // ACTION 4: EMERGENCY REVOKE / UNVERIFY (Surge / Safety Breach)
    // ─────────────────────────────────────────────────────────────
    else if (decision === "REVOKE" || decision === "UNVERIFY") {
      const reason = (body.revocationReason || body.rejectionReason || body.reason || rejectionReason || notes)?.trim();
      if (!reason) {
        return NextResponse.json(
          { success: false, message: "A mandatory statutory emergency ground/reason is required to revoke assembly verification." },
          { status: 400 }
        );
      }

      newStatus = "revoked";
      auditAction = "REVOKED";
      auditReasonOrNotes = reason;
      const directives = (body.directives || notes || "")?.trim();
      const formattedNotes = directives 
        ? `EMERGENCY REVOCATION DIRECTIVES: ${directives}` 
        : `EMERGENCY REVOCATION: ${reason}`;

      await performEventUpdate({
        status: "revoked",
        qr_status: "revoked",
        rejection_reason: reason,
        authority_notes: formattedNotes
      });
    }
    
    else {
      return NextResponse.json(
        { success: false, message: `Unsupported decision type: ${decision}` },
        { status: 400 }
      );
    }

    // 5. Create Immutable Admin Audit Log
    try {
      await db.from("admin_audit_logs").insert({
        event_id: eventId,
        performed_by: reviewerId,
        performer_name: officerName,
        role: role as "authority" | "government",
        jurisdiction: officerJurisdictionStr,
        action: auditAction as any,
        previous_status: previousStatus,
        new_status: newStatus,
        rejection_reason: (decision === "REJECT" || decision === "REVOKE" || decision === "UNVERIFY") ? auditReasonOrNotes : null,
        authority_notes: (decision !== "REJECT") ? (notes || auditReasonOrNotes) : null
      });
    } catch (auditErr) {
      console.warn("Could not record audit log entry:", auditErr);
    }

    return NextResponse.json({
      success: true,
      decision,
      previousStatus,
      newStatus,
      message: `Statutory action '${decision}' recorded successfully by ${officerName}. Realtime updates dispatched.`,
      event: {
        id: eventId,
        status: newStatus,
        qr_status: newStatus === "revoked" ? "revoked" : event.qr_status,
        authority_notes: decision !== "REJECT" ? auditReasonOrNotes : null,
        rejection_reason: (decision === "REJECT" || decision === "REVOKE" || decision === "UNVERIFY") ? auditReasonOrNotes : null,
        reviewed_at: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error("Authority decision server error:", error);
    const rawMsg = error?.message || error?.details || error?.hint || (typeof error === "string" ? error : JSON.stringify(error));
    let customMsg = rawMsg || "Failed to record statutory decision.";

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      customMsg += " (Note: SUPABASE_SERVICE_ROLE_KEY not loaded in memory. Please restart your Next.js dev server to reload .env.local).";
    }

    return NextResponse.json(
      { success: false, message: customMsg },
      { status: 500 }
    );
  }
}

