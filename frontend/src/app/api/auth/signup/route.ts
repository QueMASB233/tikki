import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { auth_user_id, email, full_name, personality_type, favorite_activity, daily_goals } = body;

    if (!auth_user_id || !email || !full_name) {
      return NextResponse.json(
        { detail: "Faltan campos requeridos" },
        { status: 400 }
      );
    }

    // Verificar que el auth_user_id existe en Supabase Auth
    try {
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(auth_user_id);
      if (authError || !authUser?.user) {
        return NextResponse.json(
          { detail: "Usuario de autenticación no encontrado" },
          { status: 400 }
        );
      }
    } catch (error) {
      return NextResponse.json(
        { detail: "No se pudo verificar el usuario de autenticación" },
        { status: 400 }
      );
    }

    // Verificar si ya existe un perfil
    const { data: existing } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("auth_user_id", auth_user_id)
      .single();

    if (existing) {
      return NextResponse.json({
        token: "",
        user: {
          id: existing.id,
          email: existing.email,
          status: existing.status,
          full_name: existing.full_name,
          personality_type: existing.personality_type,
          favorite_activity: existing.favorite_activity,
          daily_goals: existing.daily_goals,
        },
        requiresPayment: null,
      });
    }

    // Crear perfil en public.users
    const { data: newUser, error: insertError } = await supabaseAdmin
      .from("users")
      .insert({
        auth_user_id,
        email,
        full_name,
        status: "active",
        personality_type: personality_type || null,
        favorite_activity: favorite_activity || null,
        daily_goals: daily_goals || null,
      })
      .select()
      .single();

    if (insertError || !newUser) {
      console.error("Error creating user:", insertError);
      return NextResponse.json(
        { detail: "No se pudo crear el perfil del usuario" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      token: "",
      user: {
        id: newUser.id,
        email: newUser.email,
        status: newUser.status,
        full_name: newUser.full_name,
        personality_type: newUser.personality_type,
        favorite_activity: newUser.favorite_activity,
        daily_goals: newUser.daily_goals,
      },
      requiresPayment: null,
    });
  } catch (error: any) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { detail: error.message || "Error al crear el usuario" },
      { status: 500 }
    );
  }
}

