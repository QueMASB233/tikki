import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getSupabaseClientWithAuth } from "@/lib/api/auth-helper";

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  console.log(`[DELETE /api/chat/conversations/[id]] Request ${requestId} started at ${new Date().toISOString()}`);
  
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      console.warn(`[DELETE ${requestId}] Unauthorized: No user found`);
      return NextResponse.json(
        { detail: "No autorizado" },
        { status: 401 }
      );
    }

    const { id: conversationId } = await params;
    console.log(`[DELETE ${requestId}] Deleting conversation ${conversationId} for user ${user.id}`);
    
    const supabase = getSupabaseClientWithAuth(request);
    if (!supabase) {
      console.error(`[DELETE ${requestId}] Supabase client creation failed`);
      return NextResponse.json(
        { detail: "Error de autenticación" },
        { status: 401 }
      );
    }

    // Verificar que la conversación pertenezca al usuario
    const { data: conversation, error: checkError } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .single();

    if (checkError || !conversation) {
      console.warn(`[DELETE ${requestId}] Conversation not found or unauthorized: ${conversationId}`, checkError);
      return NextResponse.json(
        { detail: "Conversación no encontrada o no autorizada" },
        { status: 404 }
      );
    }

    console.log(`[DELETE ${requestId}] Conversation verified, deleting messages...`);

    // Eliminar mensajes primero
    const { error: messagesError } = await supabase
      .from("messages")
      .delete()
      .eq("conversation_id", conversationId);

    if (messagesError) {
      console.error(`[DELETE ${requestId}] Error deleting messages:`, messagesError);
      // Continuar con la eliminación de la conversación aunque falle la de mensajes
    } else {
      console.log(`[DELETE ${requestId}] Messages deleted successfully`);
    }

    // Eliminar la conversación
    const { error: deleteError, data: deleteData } = await supabase
      .from("conversations")
      .delete()
      .eq("id", conversationId)
      .select(); // Select para verificar que se eliminó

    if (deleteError) {
      console.error(`[DELETE ${requestId}] Error deleting conversation:`, deleteError);
      return NextResponse.json(
        { detail: "Error al eliminar la conversación" },
        { status: 500 }
      );
    }

    const duration = Date.now() - startTime;
    console.log(`[DELETE ${requestId}] Conversation ${conversationId} deleted successfully in ${duration}ms`);
    console.log(`[DELETE ${requestId}] Delete result:`, deleteData);

    // Verificar que la conversación fue eliminada consultando de nuevo
    const { data: verifyData } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();
    
    if (verifyData) {
      console.warn(`[DELETE ${requestId}] WARNING: Conversation ${conversationId} still exists after delete!`);
    } else {
      console.log(`[DELETE ${requestId}] Verified: Conversation ${conversationId} successfully removed from database`);
    }

    // Retornar 204 No Content con headers explícitos para Vercel
    return new NextResponse(null, { 
      status: 204,
      headers: {
        'Content-Length': '0',
      }
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[DELETE ${requestId}] Error after ${duration}ms:`, error);
    console.error(`[DELETE ${requestId}] Error stack:`, error.stack);
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

