import { Navigate, useSearchParams } from "react-router-dom";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { useAuth } from "@/contexts/AuthContext";

const AuthPage = () => {
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();

  if (loading) {
    return null;
  }

  const next = searchParams.get("next") || "/profile/user-details";

  if (user) {
    return <Navigate to={next} replace />;
  }

  return <AuthScreen />;
};

export default AuthPage;

