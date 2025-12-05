"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  AdminAuthResponse,
  adminLogin as apiAdminLogin,
  adminSignup as apiAdminSignup,
  getAdminProfile,
  setAdminAuthToken,
  Document,
} from "./admin-api-client";
import { useRouter } from "next/navigation";

export interface AdminUser {
  id: string;
  email: string;
  full_name?: string;
  status: "pending" | "active";
}

interface AdminContextValue {
  admin: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AdminAuthResponse>;
  signup: (email: string, password: string, fullName: string) => Promise<AdminAuthResponse>;
  logout: () => void;
  setAdmin: (admin: AdminUser | null) => void;
}

const AdminContext = createContext<AdminContextValue | undefined>(undefined);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdminState] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      setAdminAuthToken();
      const storedAdmin =
        typeof window !== "undefined"
          ? localStorage.getItem("es_admin")
          : undefined;
      if (storedAdmin) {
        setAdminState(JSON.parse(storedAdmin));
      }
      try {
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem("es_token")
            : undefined;
        if (token) {
          setAdminAuthToken(token);
          const profile = await getAdminProfile();
          setAdminState(profile);
          if (typeof window !== "undefined") {
            localStorage.setItem("es_admin", JSON.stringify(profile));
          }
        }
      } catch (error) {
        console.error("No se pudo recuperar la sesión admin", error);
        setAdminAuthToken(undefined);
        setAdminState(null);
      } finally {
        setLoading(false);
      }
    };
    void init();
  }, []);

  const persistAdmin = useCallback((value: AdminUser | null) => {
    if (typeof window === "undefined") return;
    if (value) {
      localStorage.setItem("es_admin", JSON.stringify(value));
    } else {
      localStorage.removeItem("es_admin");
    }
  }, []);

  const setAdmin = useCallback(
    (value: AdminUser | null) => {
      setAdminState(value);
      persistAdmin(value);
    },
    [persistAdmin]
  );

  const handleAuth = useCallback(
    (response: AdminAuthResponse) => {
      if (response.token) {
        setAdminAuthToken(response.token);
      }
      if (response.user) {
        setAdmin(response.user);
      }
      return response;
    },
    [setAdmin]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await apiAdminLogin(email, password);
      return handleAuth(response);
    },
    [handleAuth]
  );

  const signup = useCallback(
    async (email: string, password: string, fullName: string) => {
      const response = await apiAdminSignup(email, password, fullName);
      return handleAuth(response);
    },
    [handleAuth]
  );

  const logout = useCallback(() => {
    setAdminAuthToken(undefined);
    setAdmin(null);
    router.push("/admin");
  }, [router, setAdmin]);

  return (
    <AdminContext.Provider
      value={{
        admin,
        loading,
        login,
        signup,
        logout,
        setAdmin,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error("useAdmin must be used within an AdminProvider");
  }
  return context;
}



