import { useMemo, useState } from "react"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/contexts/AuthContext"
import { Loader2 } from "lucide-react"
import {
  clearPendingInviteCode,
  clearReturningMarker,
  getPendingInviteCode,
  setPendingInviteCode,
  setReturningMarker,
} from "@/features/auth/inviteStorage"
import { useHasAppAccessQuery, useInviteValidationQuery } from "@/features/auth/hooks/useInviteAccess"

export function LoginPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const isSignup = location.pathname === "/auth/signup"
  const next = useMemo(() => searchParams.get("next") || "/app", [searchParams])
  const inviteFromQuery = useMemo(() => searchParams.get("invite")?.trim() || null, [searchParams])
  const inviteCode = useMemo(() => inviteFromQuery || getPendingInviteCode(), [inviteFromQuery])

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const { signIn, signInWithGoogle, signOut, signUp } = useAuth()
  const accessQuery = useHasAppAccessQuery(false)
  const inviteValidationQuery = useInviteValidationQuery(isSignup ? inviteCode : null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (isSignup) {
        if (!inviteCode) {
          setError("Enter your invite code on the landing page to create an account.")
          return
        }

        if (inviteValidationQuery.isLoading) {
          setError("Validating your invite code…")
          return
        }

        if (inviteValidationQuery.isError) {
          setError("We couldn’t validate that invite code right now. Please try again.")
          return
        }

        if (!inviteValidationQuery.data?.valid) {
          setError("That invite code isn’t valid anymore. Request a new invite.")
          return
        }

        setPendingInviteCode(inviteCode)
        const callbackUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          next
        )}&invite=${encodeURIComponent(inviteCode)}`

        const { error } = await signUp(email, password, callbackUrl)
        if (error) {
          if (error.message.includes("already registered")) {
            setError("This email is already registered. Try logging in instead.")
          } else {
            setError(error.message)
          }
          return
        }

        setMessage("Check your email for a confirmation link to finish creating your account.")
        return
      }

      const { error } = await signIn(email, password)
      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          setError("Invalid email or password. Please try again.")
        } else {
          setError(error.message)
        }
        return
      }

      const access = await accessQuery.refetch()
      if (!access.data) {
        clearReturningMarker()
        clearPendingInviteCode()
        await signOut()
        navigate("/?waitlist=1", { replace: true })
        return
      }

      setReturningMarker()
      navigate(next, { replace: true })
    } catch (err) {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (isSignup) {
        if (!inviteCode) {
          setError("Enter your invite code on the landing page to create an account.")
          return
        }

        if (inviteValidationQuery.isLoading) {
          setError("Validating your invite code…")
          return
        }

        if (inviteValidationQuery.isError) {
          setError("We couldn’t validate that invite code right now. Please try again.")
          return
        }

        if (!inviteValidationQuery.data?.valid) {
          setError("That invite code isn’t valid anymore. Request a new invite.")
          return
        }

        setPendingInviteCode(inviteCode)
      }

      const callbackUrl = isSignup
        ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}&invite=${encodeURIComponent(
            inviteCode ?? ""
          )}`
        : `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`

      const { error } = await signInWithGoogle(callbackUrl)
      if (error) {
        setError(error.message)
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="mb-0">
        <img src="/assets/logo.png" alt="Atlyr Logo" className="h-24 w-auto" />
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-sm p-8">
        {/* Header */}
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-semibold text-foreground mb-2">
            {isSignup ? "Create your account" : "Welcome back"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isSignup ? "Create an account to start using Atlyr" : "We missed you. Login to continue"}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 p-3 rounded-md bg-muted text-foreground text-sm">
            {message}
          </div>
        )}

        {isSignup && inviteValidationQuery.data && !inviteValidationQuery.data.valid && (
          <div className="mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            Invite required: that code can’t be used anymore. Request a new invite.
          </div>
        )}

        {/* Google Login Button */}
        <Button
          type="button"
          variant="outline"
          className="w-full h-11 mb-4 border-border bg-background hover:bg-muted/50"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#000000"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#000000"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#000000"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#000000"
            />
          </svg>
          {isSignup ? "Continue with Google" : "Login with Google"}
        </Button>

        {/* Separator */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="sr-only">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email"
              required
              disabled={loading}
              className="bg-muted/50 border-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="sr-only">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
              required
              disabled={loading}
              className="bg-muted/50 border-border"
            />
          </div>

          <Button
            type="submit"
            className="w-full h-11 bg-foreground text-background hover:bg-foreground/90"
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSignup ? "Create account" : "Login"}
          </Button>
        </form>

        {/* Sign Up Link */}
        <div className="mt-6 text-center text-sm">
          {isSignup ? (
            <>
              <span className="text-muted-foreground">Already have an account? </span>
              <Link
                to={`/auth/login?next=${encodeURIComponent(next)}`}
                className="text-foreground underline underline-offset-4 hover:text-foreground/80"
              >
                Log in
              </Link>
            </>
          ) : (
            <>
              <span className="text-muted-foreground">Have an invite? </span>
              <Link
                to="/?waitlist=1"
                className="text-foreground underline underline-offset-4 hover:text-foreground/80"
              >
                Redeem it on the landing page
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Terms and Privacy */}
      <div className="mt-8 w-[65%] text-center text-xs text-muted-foreground max-w-md">
        <p>
          By continuing, you agree to our{" "}
          <Link
            to="/terms"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link
            to="/privacy"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  )
}

export default LoginPage
