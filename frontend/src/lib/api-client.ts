import axios from "axios";
import { supabase } from "./supabase-client";
// import { hashMessage } from "./security/hash-message"; // Ya no se usa
// import { appConfig } from "./config"; // Ya no se usa para hashing

// Usar rutas relativas - Vercel manejará las API routes automáticamente
const backendUrl = "/api";

console.log("[API Client] Backend URL:", backendUrl);

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    full_name?: string;
    status: "pending" | "active";
    personality_type?: string;
    favorite_activity?: string;
    daily_goals?: string;
  };
  requiresPayment?: boolean;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export const apiClient = axios.create({
  baseURL: backendUrl,
  headers: {
    "Content-Type": "application/json"
  },
  withCredentials: true
});

// Request interceptor para logging y cargar token automáticamente
apiClient.interceptors.request.use(
  (config) => {
    // Cargar token de localStorage si no está en los headers
    if (!config.headers.Authorization && typeof window !== "undefined") {
      const token = localStorage.getItem("es_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    
    console.log("[API Request]", {
      method: config.method?.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
      fullURL: `${config.baseURL}${config.url}`,
      hasAuth: !!config.headers.Authorization,
      data: config.data
    });
    return config;
  },
  (error) => {
    console.error("[API Request Error]", error);
    return Promise.reject(error);
  }
);

// Response interceptor para logging
apiClient.interceptors.response.use(
  (response) => {
    console.log("[API Response]", {
      status: response.status,
      url: response.config.url,
      data: response.data
    });
    return response;
  },
  (error) => {
    console.error("[API Response Error]", {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      baseURL: error.config?.baseURL,
      fullURL: error.config ? `${error.config.baseURL}${error.config.url}` : "N/A",
      responseData: error.response?.data,
      stack: error.stack
    });
    return Promise.reject(error);
  }
);

export function setAuthToken(token?: string) {
  if (token) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
    if (typeof window !== "undefined") {
      localStorage.setItem("es_token", token);
    }
  } else {
    delete apiClient.defaults.headers.common.Authorization;
    if (typeof window !== "undefined") {
      localStorage.removeItem("es_token");
    }
  }
}

export function loadAuthToken() {
  if (typeof window === "undefined") return;
  const token = localStorage.getItem("es_token");
  if (token) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  }
}

export async function login(email: string, password: string) {
  console.log("[Login] Attempting login for:", email);
  try {
    // Autenticar con Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      console.error("[Login] Supabase Auth error:", authError);
      throw new Error(authError.message || "Credenciales inválidas");
    }

    if (!authData.user || !authData.session) {
      throw new Error("No se pudo iniciar sesión");
    }

    const token = authData.session.access_token;
    console.log("[Login] Authenticated with Supabase Auth");

    // Guardar el token en localStorage y headers de axios
    setAuthToken(token);
    
    // Obtener perfil del usuario desde el backend
    const { data } = await apiClient.get<AuthResponse["user"]>("/auth/me", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log("[Login] Success:", data);
    
    return {
      token,
      user: data,
      requiresPayment: undefined
    } as AuthResponse;
  } catch (error: any) {
    console.error("[Login] Failed:", error);
    throw error;
  }
}

export async function signup(
  email: string, 
  password: string, 
  fullName: string,
  personalityType?: string,
  favoriteActivity?: string,
  dailyGoals?: string
) {
  console.log("[Signup] Attempting signup for:", email);
  try {
    // Paso A: Registrar usuario en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      console.error("[Signup] Supabase Auth error:", authError);
      throw new Error(authError.message || "Error al crear la cuenta");
    }

    if (!authData.user) {
      throw new Error("No se pudo crear el usuario");
    }

    const authUserId = authData.user.id;
    console.log("[Signup] User created in Supabase Auth:", authUserId);

    // Paso B: Crear perfil en public.users usando el backend
    const { data } = await apiClient.post<AuthResponse>("/auth/signup", {
      auth_user_id: authUserId,
      email,
      full_name: fullName,
      personality_type: personalityType,
      favorite_activity: favoriteActivity,
      daily_goals: dailyGoals
    }, {
      headers: {
        // Usar el token de sesión de Supabase Auth
        Authorization: `Bearer ${authData.session?.access_token || ''}`
      }
    });

    console.log("[Signup] Success:", data);
    
    // Si tenemos sesión, guardar el token
    if (authData.session) {
      const token = authData.session.access_token;
      data.token = token;
      setAuthToken(token);
    }
    
    return data;
  } catch (error: any) {
    console.error("[Signup] Failed:", error);
    throw error;
  }
}

export async function getSessionInfo(sessionId: string) {
  const { data } = await apiClient.get(`/billing/session-info?session_id=${sessionId}`);
  return data;
}

export async function completeSignup(
  sessionId: string,
  email: string,
  password: string,
  fullName: string,
  personalityType?: string,
  favoriteActivity?: string,
  dailyGoals?: string
) {
  const { data } = await apiClient.post("/auth/complete-signup", {
    session_id: sessionId,
    email,
    password,
    full_name: fullName,
    personality_type: personalityType,
    favorite_activity: favoriteActivity,
    daily_goals: dailyGoals,
  });
  return data;
}

export async function createCheckoutSession(returnUrl: string, email?: string) {
  const { data } = await apiClient.post<{ checkoutUrl: string }>(
    "/billing/checkout",
    {
      returnUrl,
      ...(email && { email })
    }
  );
  return data.checkoutUrl;
}

export async function fetchConversations() {
  const { data } = await apiClient.get<Conversation[]>("/chat/conversations");
  return data;
}

export async function createConversation(title?: string) {
  const { data } = await apiClient.post<Conversation>("/chat/conversations", {
    title: title || null
  });
  return data;
}

export async function deleteConversation(conversationId: string) {
  console.log(`[API Client] Deleting conversation: ${conversationId}`);
  try {
    const response = await apiClient.delete(`/chat/conversations/${conversationId}`);
    console.log(`[API Client] Delete response status: ${response.status}`);
    return response;
  } catch (error: any) {
    console.error(`[API Client] Error deleting conversation ${conversationId}:`, error);
    // Si es un 404, puede ser que la conversación ya no exista (race condition)
    if (error.response?.status === 404) {
      console.warn(`[API Client] Conversation ${conversationId} not found (may have been already deleted)`);
      // No lanzar error, considerar como éxito (idempotente)
      return { status: 204 };
    }
    throw error;
  }
}

export async function renameConversation(conversationId: string, title: string) {
  const { data } = await apiClient.patch<Conversation>(
    `/chat/conversations/${conversationId}`,
    { title }
  );
  return data;
}

export async function fetchMessages(conversationId?: string) {
  const params = conversationId ? { conversation_id: conversationId } : {};
  const { data } = await apiClient.get<Message[]>("/chat/history", { params });
  return data;
}

export async function sendMessage(content: string, conversationId?: string) {
  // Enviar mensaje en texto plano (el backend se encarga de encriptar)
  const { data } = await apiClient.post<Message>("/chat/send", {
    content,
    conversation_id: conversationId || null
  });
  return data;
}

export async function sendMessageStream(
  content: string,
  conversationId: string | null,
  onChunk: (chunk: string) => void,
  onComplete: (messageId: string, conversationId: string) => void,
  onError: (error: string) => void
) {
  const startTime = Date.now();
  console.log(`[CLIENT] sendMessageStream started at ${new Date().toISOString()}`);
  console.log(`[CLIENT] Content length: ${content.length}, conversationId: ${conversationId || 'null'}`);
  
  const token = typeof window !== "undefined" ? localStorage.getItem("es_token") : null;
  if (!token) {
    console.error(`[CLIENT] No authentication token found`);
    throw new Error("No authentication token");
  }

  console.log(`[CLIENT] Sending request to ${backendUrl}/chat/send`);
  // Enviar mensaje en texto plano (el backend se encarga de encriptar)
  const response = await fetch(`${backendUrl}/chat/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({
      content,
      conversation_id: conversationId || null,
    }),
  });

  console.log(`[CLIENT] Response status: ${response.status} ${response.statusText}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Error desconocido" }));
    console.error(`[CLIENT] Request failed:`, error);
    throw new Error(error.detail || "Error al enviar mensaje");
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No se pudo obtener el stream");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let hasReceivedChunks = false;
  let receivedConversationId: string | null = null;
  let totalChunks = 0;

  console.log(`[CLIENT] Starting to read stream`);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        const duration = Date.now() - startTime;
        console.log(`[CLIENT] Stream ended after ${duration}ms, chunks received: ${totalChunks}, hasReceivedChunks: ${hasReceivedChunks}`);
        // Si terminó el stream pero no recibimos chunks, puede ser un error
        if (!hasReceivedChunks) {
          console.warn(`[CLIENT] Stream ended without receiving any chunks`);
          // Intentar parsear el buffer por si hay un error
          if (buffer.trim()) {
            try {
              const lines = buffer.split("\n");
              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  const data = line.slice(6);
                  const parsed = JSON.parse(data);
                  if (parsed.error) {
                    onError(parsed.error);
                    return;
                  }
                }
              }
            } catch (e) {
              console.error("Error parsing final buffer:", e);
            }
          }
          onError("El servidor no devolvió ninguna respuesta");
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data.trim() === "") continue;

          try {
            const parsed = JSON.parse(data);
            
            // Manejar errores primero
            if (parsed.error) {
              console.error("Error from server:", parsed.error);
              onError(parsed.error);
              return;
            }
            
            // Manejar chunks de contenido
            if (parsed.chunk) {
              totalChunks++;
              if (!hasReceivedChunks) {
                console.log(`[CLIENT] First chunk received`);
                hasReceivedChunks = true;
              }
              if (totalChunks % 10 === 0) {
                console.log(`[CLIENT] Received ${totalChunks} chunks so far`);
              }
              onChunk(parsed.chunk);
            }
            
            // Manejar conversación creada
            if (parsed.conversation_id && !parsed.done) {
              receivedConversationId = parsed.conversation_id;
              console.log(`[CLIENT] Received conversation_id: ${receivedConversationId}`);
              // No llamar onComplete aquí, esperar a que termine el stream
            }
            
            // Manejar finalización
            if (parsed.done) {
              const finalMessageId = parsed.message_id || "";
              const finalConversationId = parsed.conversation_id || receivedConversationId || conversationId || "";
              const duration = Date.now() - startTime;
              console.log(`[CLIENT] Stream done after ${duration}ms:`, { 
                finalMessageId, 
                finalConversationId, 
                receivedConversationId, 
                conversationId,
                totalChunks 
              });
              onComplete(finalMessageId, finalConversationId);
              return;
            }
          } catch (e) {
            console.error("Error parsing SSE data:", e, data);
          }
        }
      }
    }
    
    // Si llegamos aquí sin llamar onComplete, pero recibimos chunks, 
    // asumir que el stream terminó correctamente
    if (hasReceivedChunks) {
      if (receivedConversationId) {
        console.warn("Stream ended without done flag, but we have chunks and conversation_id");
        onComplete("", receivedConversationId);
      } else if (conversationId) {
        console.warn("Stream ended without done flag, using provided conversationId");
        onComplete("", conversationId);
      } else {
        console.error("Stream ended without done flag, conversation_id, or provided conversationId");
        onError("El servidor no devolvió información de finalización");
      }
    } else {
      console.error("Stream ended without receiving any chunks");
      onError("El servidor no devolvió ninguna respuesta");
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[CLIENT] Error reading stream after ${duration}ms:`, error);
    console.error(`[CLIENT] Error message: ${error.message}`);
    console.error(`[CLIENT] Error stack:`, error?.stack);
    onError(error.message || "Error al leer la respuesta del servidor");
  } finally {
    reader.releaseLock();
    console.log(`[CLIENT] Stream reader released`);
  }
}

export async function fetchProfile() {
  const { data } = await apiClient.get<AuthResponse["user"]>("/auth/me");
  return data;
}

export async function updateProfile(
  fullName?: string,
  personalityType?: string,
  favoriteActivity?: string,
  dailyGoals?: string
) {
  const { data } = await apiClient.patch<AuthResponse["user"]>("/auth/me", {
    full_name: fullName,
    personality_type: personalityType,
    favorite_activity: favoriteActivity,
    daily_goals: dailyGoals
  });
  return data;
}

