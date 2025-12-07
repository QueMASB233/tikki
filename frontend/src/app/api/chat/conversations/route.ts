import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getSupabaseClientWithAuth } from "@/lib/api/auth-helper";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  console.log(`[GET /api/chat/conversations] Request started at ${new Date().toISOString()}`);
  
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      console.error(`[GET /api/chat/conversations] No user found - unauthorized`);
      return NextResponse.json(
        { detail: "No autorizado" },
        { status: 401 }
      );
    }

    console.log(`[GET /api/chat/conversations] User authenticated: ${user.id} (${user.email})`);

    const supabase = getSupabaseClientWithAuth(request);
    if (!supabase) {
      console.error(`[GET /api/chat/conversations] Supabase client creation failed for user ${user.id}`);
      return NextResponse.json(
        { detail: "Error de autenticación" },
        { status: 401 }
      );
    }
    
    console.log(`[GET /api/chat/conversations] Querying conversations for user ${user.id}`);
    // Usar RLS para filtrar automáticamente por usuario
    // La política RLS ya filtra por auth.uid(), pero también verificamos user_id para seguridad adicional
    const { data: conversations, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(100); // Limitar a 100 conversaciones para mejor rendimiento

    if (error) {
      console.error(`[GET /api/chat/conversations] Database error for user ${user.id}:`, error);
      console.error(`[GET /api/chat/conversations] Error code: ${error.code}, message: ${error.message}`);
      console.error(`[GET /api/chat/conversations] Error details:`, JSON.stringify(error, null, 2));
      return NextResponse.json(
        { detail: `Error al obtener conversaciones: ${error.message}`, error: error },
        { status: 500 }
      );
    }

    const duration = Date.now() - startTime;
    console.log(`[GET /api/chat/conversations] Success: Found ${conversations?.length || 0} conversations for user ${user.id} in ${duration}ms`);
    if (conversations && conversations.length > 0) {
      console.log(`[GET /api/chat/conversations] Conversation IDs: ${conversations.map(c => c.id).join(', ')}`);
    }
    return NextResponse.json(conversations || []);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[GET /api/chat/conversations] Exception after ${duration}ms:`, error);
    console.error(`[GET /api/chat/conversations] Error stack:`, error?.stack);
    return NextResponse.json(
      { detail: error.message || "Error al obtener conversaciones" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log(`[POST /api/chat/conversations] Request started at ${new Date().toISOString()}`);
  
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      console.error(`[POST /api/chat/conversations] No user found - unauthorized`);
      return NextResponse.json(
        { detail: "No autorizado" },
        { status: 401 }
      );
    }

    console.log(`[POST /api/chat/conversations] User authenticated: ${user.id} (${user.email})`);

    const body = await request.json();
    const title = body.title || "Nueva conversación";
    console.log(`[POST /api/chat/conversations] Creating conversation for user ${user.id} with title: "${title}"`);

    const supabase = getSupabaseClientWithAuth(request);
    if (!supabase) {
      console.error(`[POST /api/chat/conversations] Supabase client creation failed for user ${user.id}`);
      return NextResponse.json(
        { detail: "Error de autenticación" },
        { status: 401 }
      );
    }
    
    console.log(`[POST /api/chat/conversations] Inserting conversation into database`);
    const { data: conversation, error } = await supabase
      .from("conversations")
      .insert({
        user_id: user.id,
        title,
      })
      .select()
      .single();

    if (error || !conversation) {
      const duration = Date.now() - startTime;
      console.error(`[POST /api/chat/conversations] Database error after ${duration}ms:`, error);
      console.error(`[POST /api/chat/conversations] Error code: ${error?.code}, message: ${error?.message}`);
      console.error(`[POST /api/chat/conversations] Error details:`, JSON.stringify(error, null, 2));
      return NextResponse.json(
        { detail: "No se pudo crear la conversación" },
        { status: 500 }
      );
    }

    const duration = Date.now() - startTime;
    console.log(`[POST /api/chat/conversations] Success: Created conversation ${conversation.id} for user ${user.id} in ${duration}ms`);
    console.log(`[POST /api/chat/conversations] Returning conversation:`, JSON.stringify(conversation));
    
    // Asegurar que retornamos todos los campos necesarios
    return NextResponse.json({
      id: conversation.id,
      title: conversation.title,
      created_at: conversation.created_at,
      updated_at: conversation.updated_at || conversation.created_at,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[POST /api/chat/conversations] Exception after ${duration}ms:`, error);
    console.error(`[POST /api/chat/conversations] Error stack:`, error?.stack);
    return NextResponse.json(
      { detail: error.message || "Error al crear conversación" },
      { status: 500 }
    );
  }
}

