import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getSupabaseClientWithAuth } from "@/lib/api/auth-helper";

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { detail: "No autorizado" },
        { status: 401 }
      );
    }

    const { id: conversationId } = await params;
    const supabase = getSupabaseClientWithAuth(request);
    if (!supabase) {
      return NextResponse.json(
        { detail: "Error de autenticación" },
        { status: 401 }
      );
    }

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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { detail: "No autorizado" },
        { status: 401 }
      );
    }

    const { id: conversationId } = await params;
    const body = await request.json();
    const { title } = body;

    if (!title) {
      return NextResponse.json(
        { detail: "El título es requerido" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClientWithAuth(request);
    if (!supabase) {
      return NextResponse.json(
        { detail: "Error de autenticación" },
        { status: 401 }
      );
    }

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

