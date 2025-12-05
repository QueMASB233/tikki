import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  AuthResponse,
  fetchProfile,
  loadAuthToken,
  login as apiLogin,
  setAuthToken,
  signup as apiSignup
} from "./api-client";

export interface User {
  id: string;
  email: string;
  full_name?: string;
  status: "pending" | "active";
  study_type?: string;
  career_interest?: string;
  nationality?: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthResponse>;
  signup: (email: string, password: string, fullName: string, studyType?: string, careerInterest?: string, nationality?: string) => Promise<AuthResponse>;
  logout: () => void;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      loadAuthToken();
      const storedUser =
        typeof window !== "undefined"
          ? localStorage.getItem("es_user")
          : undefined;
      if (storedUser) {
        setUserState(JSON.parse(storedUser));
      }
      try {
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem("es_token")
            : undefined;
        if (token) {
          setAuthToken(token);
          const profile = await fetchProfile();
          setUserState(profile);
          if (typeof window !== "undefined") {
            localStorage.setItem("es_user", JSON.stringify(profile));
          }
        }
      } catch (error) {
        console.error("No se pudo recuperar la sesión", error);
        setAuthToken(undefined);
        setUserState(null);
      } finally {
        setLoading(false);
      }
    };
    void init();
  }, [setUserState]);

  const persistUser = useCallback((value: User | null) => {
    if (typeof window === "undefined") return;
    if (value) {
      localStorage.setItem("es_user", JSON.stringify(value));
    } else {
      localStorage.removeItem("es_user");
    }
  }, []);

  const setUser = useCallback(
    (value: User | null) => {
      setUserState(value);
      persistUser(value);
    },
    [persistUser]
  );

  const handleAuth = useCallback(
    (response: AuthResponse) => {
      if (response.token) {
        setAuthToken(response.token);
      }
      if (response.user) {
        setUser(response.user);
      }
      return response;
    },
    [setUser]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await apiLogin(email, password);
      return handleAuth(response);
    },
    [handleAuth]
  );

  const signup = useCallback(
    async (email: string, password: string, fullName: string, studyType?: string, careerInterest?: string, nationality?: string) => {
      const response = await apiSignup(email, password, fullName, studyType, careerInterest, nationality);
      return handleAuth(response);
    },
    [handleAuth]
  );

  const logout = useCallback(() => {
    setUser(null);
    setAuthToken(undefined);
  }, [setUser]);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      signup,
      logout,
      setUser
    }),
    [user, loading, login, signup, logout, setUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

