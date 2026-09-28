import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../../lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper to generate secure random token
function generateSecureToken(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let token = "PQ-";
  for (let i = 0; i < 16; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: eventId } = await params;
    if (!eventId) {
      return NextResponse.json({ success: false, message: "Missing event ID." }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();

    // Fetch event
    const { data: event, error: fetchErr } = await supabase
      .from("events")
      .select("id, title, category, status, qr_token, qr_status, qr_expires_at, location_name, place_of_assembly, event_date, start_time, end_time, host_id")
      .eq("id", eventId)
      .maybeSingle();

    if (fetchErr || !event) {
      return NextResponse.json({ success: false, message: "Event not found." }, { status: 404 });
    }

    let qrToken = event.qr_token;
    let qrStatus = event.qr_status || "active";
    let qrExpiresAt = event.qr_expires_at;

    // Backfill token if not present
    if (!qrToken) {
      qrToken = generateSecureToken();
      qrStatus = "active";
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      qrExpiresAt = expiresAt;

      await supabase
        .from("events")
        .update({
          qr_token: qrToken,
          qr_status: qrStatus,
          qr_expires_at: expiresAt
        })
        .eq("id", eventId);
    }

    const origin = req.nextUrl.origin;
    const verificationUrl = `${origin}/authority/scan?token=${qrToken}`;

    return NextResponse.json({
      success: true,
      eventId: event.id,
      qr_token: qrToken,
      qr_status: qrStatus,
      qr_expires_at: qrExpiresAt,
      verification_url: verificationUrl,
      event: {
        id: event.id,
        title: event.title,
        category: event.category,
        status: event.status,
        event_date: event.event_date,
        location_name: event.location_name,
        place_of_assembly: event.place_of_assembly
      }
    });

  } catch (error: any) {
    console.error("Event QR retrieval error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to retrieve event QR token." },
      { status: 500 }
    );
  }
}

// POST endpoint to regenerate / refresh QR Token if revoked or requested
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: eventId } = await params;
    const supabase = await createServerSupabaseClient();

    // Verify session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    // Check ownership or authority
    const { data: event } = await supabase
      .from("events")
      .select("id, host_id")
      .eq("id", eventId)
      .maybeSingle();

    if (!event) {
      return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 });
    }

    const { data: userProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("auth_user_id", session.user.id)
      .maybeSingle();

    const isHost = event.host_id === session.user.id;
    const isOfficer = userProfile?.role === "authority" || userProfile?.role === "government";

    if (!isHost && !isOfficer) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const newToken = generateSecureToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: updateErr } = await supabase
      .from("events")
      .update({
        qr_token: newToken,
        qr_status: "active",
        qr_expires_at: expiresAt
      })
      .eq("id", eventId);

    if (updateErr) throw updateErr;

    const origin = req.nextUrl.origin;
    const verificationUrl = `${origin}/authority/scan?token=${newToken}`;

    return NextResponse.json({
      success: true,
      message: "QR Token regenerated successfully.",
      qr_token: newToken,
      qr_status: "active",
      qr_expires_at: expiresAt,
      verification_url: verificationUrl
    });

  } catch (error: any) {
    console.error("QR token regeneration error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to regenerate QR token." },
      { status: 500 }
    );
  }
}
