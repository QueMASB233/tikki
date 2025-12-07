import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getSupabaseClientWithAuth, getSupabaseAdmin } from "@/lib/api/auth-helper";

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

    console.log(`[DELETE ${requestId}] Conversation verified, deleting all related data...`);

    // Usar admin client para bypass RLS y asegurar eliminación completa
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      console.error(`[DELETE ${requestId}] Failed to create admin client, falling back to auth client`);
    }

    // Usar admin client si está disponible, sino usar el auth client
    const deleteClient = supabaseAdmin || supabase;

    // 1. Eliminar conversation_summary primero (si existe)
    console.log(`[DELETE ${requestId}] Deleting conversation_summary...`);
    const { error: summaryError } = await deleteClient
      .from("conversation_summary")
      .delete()
      .eq("conversation_id", conversationId);

    if (summaryError) {
      console.warn(`[DELETE ${requestId}] Warning deleting conversation_summary:`, summaryError);
      // Continuar aunque falle
    } else {
      console.log(`[DELETE ${requestId}] Conversation summary deleted successfully`);
    }

    // 2. Eliminar mensajes
    console.log(`[DELETE ${requestId}] Deleting messages...`);
    const { error: messagesError, data: deletedMessages } = await deleteClient
      .from("messages")
      .delete()
      .eq("conversation_id", conversationId)
      .select();

    if (messagesError) {
      console.error(`[DELETE ${requestId}] Error deleting messages:`, messagesError);
      // Continuar con la eliminación de la conversación aunque falle la de mensajes
    } else {
      const messagesCount = deletedMessages?.length || 0;
      console.log(`[DELETE ${requestId}] Messages deleted successfully (count: ${messagesCount})`);
    }

    // 3. Eliminar la conversación
    console.log(`[DELETE ${requestId}] Deleting conversation...`);
    const { error: deleteError, data: deleteData } = await deleteClient
      .from("conversations")
      .delete()
      .eq("id", conversationId)
      .eq("user_id", user.id) // Verificar ownership también
      .select();

    if (deleteError) {
      console.error(`[DELETE ${requestId}] Error deleting conversation:`, deleteError);
      return NextResponse.json(
        { detail: "Error al eliminar la conversación" },
        { status: 500 }
      );
    }

    if (!deleteData || deleteData.length === 0) {
      console.warn(`[DELETE ${requestId}] No conversation was deleted (may have been already deleted)`);
      // Retornar éxito de todas formas (idempotente)
      return new NextResponse(null, { 
        status: 204,
        headers: {
          'Content-Length': '0',
        }
      });
    }

    const duration = Date.now() - startTime;
    console.log(`[DELETE ${requestId}] Conversation ${conversationId} deleted successfully in ${duration}ms`);
    console.log(`[DELETE ${requestId}] Delete result:`, deleteData);

    // 4. Verificar que la conversación fue eliminada usando admin client (bypass RLS)
    console.log(`[DELETE ${requestId}] Verifying deletion...`);
    const verifyClient = supabaseAdmin || supabase;
    const { data: verifyData } = await verifyClient
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .maybeSingle();
    
    if (verifyData) {
      console.error(`[DELETE ${requestId}] ERROR: Conversation ${conversationId} still exists after delete!`);
      // Intentar eliminar de nuevo con admin
      if (supabaseAdmin) {
        console.log(`[DELETE ${requestId}] Retrying deletion with admin client...`);
        const { error: retryError } = await supabaseAdmin
          .from("conversations")
          .delete()
          .eq("id", conversationId);
        
        if (retryError) {
          console.error(`[DELETE ${requestId}] Retry deletion failed:`, retryError);
        } else {
          console.log(`[DELETE ${requestId}] Successfully deleted on retry`);
        }
      }
    } else {
      console.log(`[DELETE ${requestId}] Verified: Conversation ${conversationId} successfully removed from database`);
    }

    // 5. Verificar que no queden mensajes huérfanos
    const { data: orphanMessages } = await verifyClient
      .from("messages")
      .select("id")
      .eq("conversation_id", conversationId)
      .limit(1);
    
    if (orphanMessages && orphanMessages.length > 0) {
      console.warn(`[DELETE ${requestId}] WARNING: Found ${orphanMessages.length} orphan messages, cleaning up...`);
      await verifyClient
        .from("messages")
        .delete()
        .eq("conversation_id", conversationId);
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

