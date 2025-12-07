import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getSupabaseClientWithAuth } from "@/lib/api/auth-helper";
import { decryptMessage } from "@/lib/api/encryption";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { detail: "No autorizado" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversation_id");

    const supabase = getSupabaseClientWithAuth(request);
    if (!supabase) {
      return NextResponse.json(
        { detail: "Error de autenticación" },
        { status: 401 }
      );
    }
    let query = supabase
      .from("messages")
      .select("*")
      .eq("user_id", user.id);

    if (conversationId) {
      query = query.eq("conversation_id", conversationId);
    } else {
      query = query.is("conversation_id", null);
    }

    const { data: messages, error } = await query.order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching messages:", error);
      return NextResponse.json(
        { detail: "Error al obtener mensajes" },
        { status: 500 }
      );
    }

    // Desencriptar mensajes
    const decryptedMessages = (messages || []).map((msg: any) => ({
      ...msg,
      content: decryptMessage(msg.content),
    }));

    return NextResponse.json(decryptedMessages);
  } catch (error: any) {
    console.error("Get history error:", error);
    return NextResponse.json(
      { detail: error.message || "Error al obtener historial" },
      { status: 500 }
    );
  }
}

