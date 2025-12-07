import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/api/auth-helper";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { detail: "No autorizado" },
        { status: 401 }
      );
    }

    const conversationId = params.id;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Verificar que la conversación pertenezca al usuario
    const { data: conversation } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .single();

    if (!conversation) {
      return NextResponse.json(
        { detail: "Conversación no encontrada o no autorizada" },
        { status: 404 }
      );
    }

    // Eliminar mensajes primero
    await supabase
      .from("messages")
      .delete()
      .eq("conversation_id", conversationId);

    // Eliminar la conversación
    await supabase
      .from("conversations")
      .delete()
      .eq("id", conversationId);

    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    console.error("Delete conversation error:", error);
    return NextResponse.json(
      { detail: error.message || "Error al eliminar conversación" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { detail: "No autorizado" },
        { status: 401 }
      );
    }

    const conversationId = params.id;
    const body = await request.json();
    const { title } = body;

    if (!title) {
      return NextResponse.json(
        { detail: "El título es requerido" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Verificar que la conversación pertenezca al usuario
    const { data: conversation } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .single();

    if (!conversation) {
      return NextResponse.json(
        { detail: "Conversación no encontrada o no autorizada" },
        { status: 404 }
      );
    }

    // Actualizar título
    const { data: updated, error } = await supabase
      .from("conversations")
      .update({ title })
      .eq("id", conversationId)
      .select()
      .single();

    if (error || !updated) {
      return NextResponse.json(
        { detail: "No se pudo actualizar la conversación" },
        { status: 500 }
      );
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Update conversation error:", error);
    return NextResponse.json(
      { detail: error.message || "Error al actualizar conversación" },
      { status: 500 }
    );
  }
}

