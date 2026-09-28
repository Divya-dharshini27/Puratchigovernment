import { NextResponse } from "next/server";
import { createAdminSupabaseClient, createServerSupabaseClient } from "../../../../lib/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      email,
      password,
      fullName,
      phone,
      role = "government",
      department,
      jurisdictionLevel,
      state,
      district,
      badgeNumber,
      designation,
      language = "English",
      isActive = true,
      canAct
    } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = fullName ? fullName.trim() : "";

    const adminClient = createAdminSupabaseClient();

    if (adminClient) {
      // Create user using Supabase Admin API with email_confirm = true
      // This completely bypasses Supabase's email rate limits & email sending queue
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email: trimmedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: trimmedName,
          role,
          department: department || null,
          jurisdiction_level: jurisdictionLevel || (role === "authority" ? "district" : undefined),
          state: state || null,
          district: district || null,
          badge_number: badgeNumber ? badgeNumber.trim() : null,
          designation: designation ? designation.trim() : null
        }
      });

      if (authError) {
        console.error("Admin user creation error:", authError);
        return NextResponse.json(
          { error: authError.message || "Failed to create user." },
          { status: 400 }
        );
      }

      const user = authData.user;
      if (!user) {
        return NextResponse.json(
          { error: "Failed to initialize user." },
          { status: 500 }
        );
      }

      // Upsert profile record
      const { error: profileError } = await adminClient
        .from("profiles")
        .upsert(
          {
            auth_user_id: user.id,
            full_name: trimmedName,
            email: trimmedEmail,
            phone: phone ? phone.trim() : null,
            role,
            jurisdiction_level: jurisdictionLevel || (role === "authority" ? "district" : null),
            state: state || null,
            district: district || null,
            department: department || null,
            badge_number: badgeNumber ? badgeNumber.trim() : null,
            designation: designation ? designation.trim() : null,
            is_active: isActive,
            can_act: typeof canAct === "boolean" ? canAct : role === "authority",
            language
          },
          { onConflict: "auth_user_id" }
        );

      if (profileError) {
        console.warn("Profile table upsert warning in admin register:", profileError);
      }

      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role
        }
      });
    }

    // Fallback if SERVICE_ROLE_KEY is not configured
    const serverClient = await createServerSupabaseClient();
    const { data: authData, error: authError } = await serverClient.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: {
          full_name: trimmedName,
          role,
          department,
          jurisdiction_level: jurisdictionLevel,
          state,
          district,
          badge_number: badgeNumber || null,
          designation: designation || null
        }
      }
    });

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      user: authData.user,
      session: authData.session
    });
  } catch (error: any) {
    console.error("Auth register route error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error during registration." },
      { status: 500 }
    );
  }
}
