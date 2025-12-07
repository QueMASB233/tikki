import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function getCurrentUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authUser) {
    return null;
  }

  const { data: userProfile } = await supabase
    .from("users")
    .select("*")
    .eq("auth_user_id", authUser.id)
    .single();

  return userProfile;
}

export async function GET(request: NextRequest) {
  try {
    const userProfile = await getCurrentUser(request);
    
    if (!userProfile) {
      return NextResponse.json(
        { detail: "Usuario no encontrado. Por favor, completa tu registro." },
        { status: 404 }
      );
    }

    // Derivar nombre del email si no existe
    let full_name = userProfile.full_name;
    if (!full_name && userProfile.email) {
      full_name = userProfile.email.split("@")[0].capitalize();
    }

    return NextResponse.json({
      id: userProfile.id,
      email: userProfile.email,
      status: userProfile.status,
      full_name: full_name || userProfile.full_name,
      personality_type: userProfile.personality_type,
      favorite_activity: userProfile.favorite_activity,
      daily_goals: userProfile.daily_goals,
    });
  } catch (error: any) {
    console.error("Get user error:", error);
    return NextResponse.json(
      { detail: error.message || "Error al obtener el usuario" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userProfile = await getCurrentUser(request);
    
    if (!userProfile) {
      return NextResponse.json(
        { detail: "No autorizado" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const updateData: any = {};
    
    if (body.full_name) updateData.full_name = body.full_name;
    if (body.personality_type) updateData.personality_type = body.personality_type;
    if (body.favorite_activity) updateData.favorite_activity = body.favorite_activity;
    if (body.daily_goals) updateData.daily_goals = body.daily_goals;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({
        id: userProfile.id,
        email: userProfile.email,
        status: userProfile.status,
        full_name: userProfile.full_name,
        personality_type: userProfile.personality_type,
        favorite_activity: userProfile.favorite_activity,
        daily_goals: userProfile.daily_goals,
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: updatedUser, error } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", userProfile.id)
      .select()
      .single();

    if (error || !updatedUser) {
      return NextResponse.json(
        { detail: "No se pudo actualizar el perfil" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: updatedUser.id,
      email: updatedUser.email,
      status: updatedUser.status,
      full_name: updatedUser.full_name,
      personality_type: updatedUser.personality_type,
      favorite_activity: updatedUser.favorite_activity,
      daily_goals: updatedUser.daily_goals,
    });
  } catch (error: any) {
    console.error("Update profile error:", error);
    return NextResponse.json(
      { detail: error.message || "Error al actualizar el perfil" },
      { status: 500 }
    );
  }
}
