import axios from "axios";
import { supabase } from "./supabase-client";

const backendUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export interface AdminAuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    full_name?: string;
    status: "pending" | "active";
  };
}

export interface Document {
  id: string;
  filename: string;
  file_path: string;
  file_size?: number;
  mime_type?: string;
  status: "active" | "inactive" | "processing" | "deleted" | "error";
  processing_status?: string;
  processing_error?: string;
  processed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Metrics {
  career_interest: Record<string, number>;
  study_type: Record<string, number>;
  nationality: Record<string, number>;
}

export interface ProcessingLog {
  id: string;
  document_id?: string;
  log_type: "info" | "warning" | "error" | "success";
  message: string;
  metadata?: any;
  created_at: string;
}

export const adminApiClient = axios.create({
  baseURL: backendUrl,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// Request interceptor
adminApiClient.interceptors.request.use(
  (config) => {
    if (!config.headers.Authorization && typeof window !== "undefined") {
      const token = localStorage.getItem("es_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export function setAdminAuthToken(token?: string) {
  if (token) {
    adminApiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
    if (typeof window !== "undefined") {
      localStorage.setItem("es_token", token);
    }
  } else {
    delete adminApiClient.defaults.headers.common.Authorization;
    if (typeof window !== "undefined") {
      localStorage.removeItem("es_token");
    }
  }
}

export async function adminLogin(email: string, password: string) {
  try {
    // Autenticar con Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      throw new Error(authError.message || "Credenciales inválidas");
    }

    if (!authData.user || !authData.session) {
      throw new Error("No se pudo iniciar sesión");
    }

    const token = authData.session.access_token;
    setAdminAuthToken(token);

    // Obtener perfil del admin
    const { data } = await adminApiClient.get<AdminAuthResponse["user"]>("/admin/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return {
      token,
      user: data,
    } as AdminAuthResponse;
  } catch (error: any) {
    throw error;
  }
}

export async function adminSignup(
  email: string,
  password: string,
  fullName: string
) {
  try {
    // Paso A: Registrar usuario en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      throw new Error(authError.message || "Error al crear la cuenta");
    }

    if (!authData.user) {
      throw new Error("No se pudo crear el usuario");
    }

    const authUserId = authData.user.id;

    // Paso B: Crear perfil en public.users usando el backend
    const { data } = await adminApiClient.post<AdminAuthResponse>("/admin/signup", {
      auth_user_id: authUserId,
      email,
      full_name: fullName,
    }, {
      headers: {
        Authorization: `Bearer ${authData.session?.access_token || ''}`
      }
    });

    // Si tenemos sesión, guardar el token
    if (authData.session) {
      const token = authData.session.access_token;
      data.token = token;
      setAdminAuthToken(token);
    }

    return data;
  } catch (error: any) {
    throw error;
  }
}

export async function getAdminProfile() {
  const { data } = await adminApiClient.get<AdminAuthResponse["user"]>("/admin/me");
  return data;
}

export async function uploadDocument(file: File): Promise<Document> {
  const formData = new FormData();
  formData.append("file", file);

  const { data } = await adminApiClient.post<Document>("/admin/documents/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return data;
}

export async function getDocuments(): Promise<Document[]> {
  const { data } = await adminApiClient.get<Document[]>("/admin/documents");
  return data;
}

export async function updateDocument(
  documentId: string,
  status?: "active" | "inactive" | "deleted"
): Promise<Document> {
  const { data } = await adminApiClient.patch<Document>(
    `/admin/documents/${documentId}`,
    { status }
  );
  return data;
}

export async function reprocessDocument(documentId: string): Promise<Document> {
  const { data } = await adminApiClient.post<Document>(
    `/admin/documents/${documentId}/reprocess`
  );
  return data;
}

export async function getMetrics(): Promise<Metrics> {
  const { data } = await adminApiClient.get<Metrics>("/admin/metrics");
  return data;
}

export async function getLogs(documentId?: string): Promise<ProcessingLog[]> {
  const params = documentId ? { document_id: documentId } : {};
  const { data } = await adminApiClient.get<ProcessingLog[]>("/admin/logs", { params });
  return data;
}



