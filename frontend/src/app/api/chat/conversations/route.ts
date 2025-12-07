import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/api/auth-helper";

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }
  
  return createClient(supabaseUrl, supabaseAnonKey);
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { detail: "No autorizado" },
        { status: 401 }
      );
    }

    const supabase = getSupabaseClient();
    const { data: conversations, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching conversations:", error);
      return NextResponse.json(
        { detail: "Error al obtener conversaciones" },
        { status: 500 }
      );
    }

    return NextResponse.json(conversations || []);
  } catch (error: any) {
    console.error("Get conversations error:", error);
    return NextResponse.json(
      { detail: error.message || "Error al obtener conversaciones" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { detail: "No autorizado" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const title = body.title || "Nueva conversación";

    const supabase = getSupabaseClient();
    const { data: conversation, error } = await supabase
      .from("conversations")
      .insert({
        user_id: user.id,
        title,
      })
      .select()
      .single();

    if (error || !conversation) {
      console.error("Error creating conversation:", error);
      return NextResponse.json(
        { detail: "No se pudo crear la conversación" },
        { status: 500 }
      );
    }

    return NextResponse.json(conversation);
  } catch (error: any) {
    console.error("Create conversation error:", error);
    return NextResponse.json(
      { detail: error.message || "Error al crear conversación" },
      { status: 500 }
    );
  }
}

