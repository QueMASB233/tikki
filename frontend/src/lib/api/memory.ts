import { SupabaseClient } from "@supabase/supabase-js";

// Versión simplificada de memoria - podemos mejorarla después
export class MemoryManager {
  constructor(private supabase: SupabaseClient) {}

  async searchSemantic(userId: string, query: string, limit: number = 5): Promise<string[]> {
    // Por ahora retornar array vacío - implementar después con embeddings
    return [];
  }

  async searchEpisodic(userId: string, query: string, limit: number = 5): Promise<string[]> {
    // Por ahora retornar array vacío - implementar después
    return [];
  }

  async getConversationSummary(conversationId: string): Promise<string | null> {
    try {
      const { data } = await this.supabase
        .from("conversation_summaries")
        .select("summary")
        .eq("conversation_id", conversationId)
        .single();
      return data?.summary || null;
    } catch {
      // Tabla puede no existir, retornar null
      return null;
    }
  }

  async addSemantic(userId: string, fact: string): Promise<void> {
    // Implementar después con embeddings
  }

  async updateConversationSummary(conversationId: string, summary: string, messageCount: number): Promise<void> {
    try {
      await this.supabase
        .from("conversation_summaries")
        .upsert({
          conversation_id: conversationId,
          summary,
          message_count: messageCount,
          updated_at: new Date().toISOString(),
        });
    } catch {
      // Tabla puede no existir, ignorar
    }
  }

  async addEpisodic(userId: string, summary: string, messageCount: number): Promise<void> {
    // Implementar después
  }

  async getMessageCount(conversationId: string): Promise<number> {
    const { count } = await this.supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("conversation_id", conversationId);
    return count || 0;
  }
}

