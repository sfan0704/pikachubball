import { createContext, useContext } from "react";
import { useMutation } from "@tanstack/react-query";
import { signOut } from "@/api/endpoints";
import { useMe } from "@/api/hooks";

interface User {
  id: string;
  displayName: string | null;
  email: string | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Who is signed in, from `GET /api/me`; a 401 means nobody. Signing out starts the page afresh. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const me = useMe();
  const logoutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => window.location.assign("/auth"),
  });

  const value: AuthContextType = {
    user: me.data?.user ?? null,
    isLoading: me.isPending,
    logout: async () => {
      await logoutMutation.mutateAsync();
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
