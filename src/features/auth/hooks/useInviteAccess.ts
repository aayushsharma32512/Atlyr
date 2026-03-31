import { useMutation, useQuery } from "@tanstack/react-query"

import { useAuth } from "@/contexts/AuthContext"
import { authKeys } from "@/features/auth/queryKeys"
import { inviteService } from "@/services/auth/inviteService"

export function useHasAppAccessQuery(enabled = true) {
  const { user } = useAuth()

  return useQuery({
    queryKey: authKeys.access(user?.id ?? null),
    queryFn: () => inviteService.hasAppAccess(),
    enabled: enabled && Boolean(user?.id),
    staleTime: 60 * 1000,
  })
}

export function useInviteValidationQuery(code: string | null) {
  return useQuery({
    queryKey: authKeys.inviteValidation(code),
    queryFn: () => inviteService.validateInviteCode(code ?? ""),
    enabled: Boolean(code),
    staleTime: 60 * 1000,
  })
}

export function useRedeemInviteMutation() {
  return useMutation({
    mutationFn: (code: string) => inviteService.redeemInvite(code),
  })
}

export function useValidateInviteMutation() {
  return useMutation({
    mutationFn: (code: string) => inviteService.validateInviteCode(code),
  })
}
