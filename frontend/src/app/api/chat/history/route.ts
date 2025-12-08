import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getSupabaseClientWithAuth } from "@/lib/api/auth-helper";
import { decryptMessage } from "@/lib/api/encryption";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  console.log(`[GET /api/chat/history] Request started at ${new Date().toISOString()}`);
  
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      console.error(`[GET /api/chat/history] No user found - unauthorized`);
      return NextResponse.json(
        { detail: "No autorizado" },
        { status: 401 }
      );
    }

    console.log(`[GET /api/chat/history] User authenticated: ${user.id} (${user.email})`);

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversation_id");
    console.log(`[GET /api/chat/history] Conversation ID: ${conversationId || 'null'}`);

    const supabase = getSupabaseClientWithAuth(request);
    if (!supabase) {
      console.error(`[GET /api/chat/history] Supabase client creation failed for user ${user.id}`);
      return NextResponse.json(
        { detail: "Error de autenticación" },
        { status: 401 }
      );
    }
    
    // Validar que conversationId sea un UUID válido si se proporciona
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (conversationId && !uuidRegex.test(conversationId)) {
      console.error(`[GET /api/chat/history] Invalid UUID format: ${conversationId} for user ${user.id}`);
      return NextResponse.json(
        { detail: "ID de conversación inválido" },
        { status: 400 }
      );
    }
    
    // Si no hay conversation_id, no devolvemos mensajes huérfanos
    if (!conversationId) {
      console.log(`[GET /api/chat/history] No conversation_id provided -> returning []`);
      return NextResponse.json([]);
    }

    console.log(`[GET /api/chat/history] Querying messages for conversation: ${conversationId}`);
    const { data: messages, error } = await supabase
      .from("messages")
      .select("*")
      // RLS controla visibilidad; no filtramos por user_id para evitar excluir registros válidos
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(2000);

    if (error) {
      const duration = Date.now() - startTime;
      console.error(`[GET /api/chat/history] Database error after ${duration}ms:`, error);
      console.error(`[GET /api/chat/history] Error code: ${error.code}, message: ${error.message}`);
      console.error(`[GET /api/chat/history] Error details:`, JSON.stringify(error, null, 2));
      return NextResponse.json(
        { detail: "Error al obtener mensajes" },
        { status: 500 }
      );
    }

    const ids = (messages || []).map((m: any) => m.id).join(', ');
    console.log(`[GET /api/chat/history] Supabase returned ${messages?.length || 0} messages. IDs: ${ids}`);
    console.log(`[GET /api/chat/history] Found ${messages?.length || 0} messages, decrypting...`);
    // Desencriptar mensajes
    const decryptedMessages = (messages || []).map((msg: any) => {
      try {
        return {
          ...msg,
          content: decryptMessage(msg.content),
        };
      } catch (decryptError) {
        console.error(`[GET /api/chat/history] Error decrypting message ${msg.id}:`, decryptError);
        return msg; // Return encrypted if decryption fails
      }
    });

    const duration = Date.now() - startTime;
    console.log(`[GET /api/chat/history] Success: Returned ${decryptedMessages.length} messages for user ${user.id} in ${duration}ms`);
    return NextResponse.json(decryptedMessages);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[GET /api/chat/history] Exception after ${duration}ms:`, error);
    console.error(`[GET /api/chat/history] Error stack:`, error?.stack);
    return NextResponse.json(
      { detail: error.message || "Error al obtener historial" },
      { status: 500 }
    );
  }
}

