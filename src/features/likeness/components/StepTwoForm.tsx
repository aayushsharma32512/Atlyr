import { UseFormReturn } from "react-hook-form"
import { CardHeader, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"
import { Maximize2, RefreshCw, Share } from "lucide-react"
import { useMemo, useState, type KeyboardEvent, type MouseEvent } from "react"
import type { LikenessFormData } from "../types"

interface CandidateCard {
  index: number
  candidateId: string
  path: string
  signedUrl: string | null
  summary?: string | null
}

type StepTwoViewMode = "grid" | "scroll"

interface StepTwoFormProps {
  type?: 'drawer' | 'screen'
  form: UseFormReturn<LikenessFormData>
  candidates: CandidateCard[]
  onSave: (candidateId: string) => void
  onPrevious?: () => void
  isSaving?: boolean
  onRefreshCandidate?: (path: string) => Promise<void | string> | void | string
  viewMode?: StepTwoViewMode
  showBack?: boolean
}

export function StepTwoForm({
  type = 'screen',
  form,
  candidates,
  onSave,
  onPrevious,
  isSaving = false,
  onRefreshCandidate,
  viewMode = "scroll",
  showBack = true,
}: StepTwoFormProps) {
  const [selectedIndex, setSelectedIndex] = useState<number>(() => candidates[0]?.index ?? 0)

  const canContinue = useMemo(() => candidates.length > 0 && typeof selectedIndex === "number", [candidates, selectedIndex])

  const handleSave = () => {
    if (!canContinue) return
    const selectedCandidate = candidates.find(c => c.index === selectedIndex)
    if (selectedCandidate) {
      onSave(selectedCandidate.candidateId)
    }
  }

  const handlePreview = (event: MouseEvent | KeyboardEvent, signedUrl: string | null) => {
    event.stopPropagation()
    if (!signedUrl) {
      return
    }
    window.open(signedUrl, "_blank", "noopener,noreferrer")
  }

  const handleRefresh = (event: MouseEvent | KeyboardEvent, path: string) => {
    event.stopPropagation()
    onRefreshCandidate?.(path)
  }

  const actionChipProps = {
    role: "button" as const,
    tabIndex: 0,
    className: "flex gap-1 h-6 items-center justify-center rounded-[8px] px-1 text-foreground bg-card/80 text-[11px] font-medium",
    onKeyDown: (handler: (event: KeyboardEvent) => void) => (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        handler(event)
      }
    },
  }

  return (
    <Form {...form}>
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 min-h-0 overflow-y-auto">
          <CardHeader className={`flex flex-col gap-3 items-center justify-center p-6 text-center shrink-0 ${type === 'drawer' ? 'border-none shadow-none' : ''}`}>
            <div className="flex flex-1 flex-col gap-1.5 items-center justify-center">
              <p className="text-base font-medium text-card-foreground leading-none">Select Closest Avatar</p>
              <p className="text-sm font-normal text-muted-foreground leading-5">
                Review the generated candidates and keep the closest likeness.
              </p>
            </div>
          </CardHeader>

          {viewMode === "grid" ? (
            <div className="grid grid-cols-2 gap-3 justify-items-center items-start px-3 py-[28px] w-full">
              {candidates.map((candidate) => (
                <div key={candidate.path} className="flex flex-col gap-2 items-center relative w-[150px]">
                  <button
                    type="button"
                    onClick={() => setSelectedIndex(candidate.index)}
                    className={`bg-muted flex flex-col items-end justify-between px-2.5 py-3 relative rounded-[10px] w-full aspect-square transition-all ${
                      selectedIndex === candidate.index ? "ring-2 ring-primary ring-offset-2" : ""
                    }`}
                  >
                    <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-[10px]">
                      {candidate.signedUrl ? (
                        <img src={candidate.signedUrl} alt={`candidate-${candidate.index}`} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-xs text-muted-foreground">preview unavailable</div>
                      )}
                    </div>
                    <div className="relative flex gap-2">
                      <span
                        {...actionChipProps}
                        onClick={(event) => handlePreview(event, candidate.signedUrl)}
                        onKeyDown={actionChipProps.onKeyDown((event) => handlePreview(event, candidate.signedUrl))}
                      >
                        <Maximize2 className="size-3" aria-hidden="true" />
                        view
                      </span>
                      <span
                        {...actionChipProps}
                        onClick={(event) => handleRefresh(event, candidate.path)}
                        onKeyDown={actionChipProps.onKeyDown((event) => handleRefresh(event, candidate.path))}
                      >
                        <RefreshCw className="size-3" aria-hidden="true" />
                        refresh
                      </span>
                    </div>
                  </button>
                  <p className="text-xs text-muted-foreground">generation #{candidate.index + 1}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 px-3 py-[28px] w-full">
              <div className="bg-muted relative rounded-[16px] w-full max-w-sm aspect-square">
                <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-[16px]">
                  {candidates[selectedIndex]?.signedUrl ? (
                    <img
                      src={candidates[selectedIndex]?.signedUrl ?? ""}
                      alt={`candidate-${selectedIndex}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-xs text-muted-foreground">preview unavailable</div>
                  )}
                </div>
                {candidates[selectedIndex]?.signedUrl ? (
                  <span
                    {...actionChipProps}
                    className="absolute top-3 right-3"
                    onClick={(event) => handlePreview(event, candidates[selectedIndex]?.signedUrl ?? null)}
                    onKeyDown={actionChipProps.onKeyDown((event) => handlePreview(event, candidates[selectedIndex]?.signedUrl ?? null))}
                  >
                    <Maximize2 className="size-3" aria-hidden="true" />
                    view
                  </span>
                ) : null}
                <span
                  {...actionChipProps}
                  className="absolute top-3 right-16"
                  onClick={(event) => handleRefresh(event, candidates[selectedIndex]?.path ?? "")}
                  onKeyDown={actionChipProps.onKeyDown((event) => handleRefresh(event, candidates[selectedIndex]?.path ?? ""))}
                >
                  <RefreshCw className="size-3" aria-hidden="true" />
                  refresh
                </span>
              </div>
              <div className="w-full max-w-sm">
                <div className="flex gap-2 overflow-x-auto px-1 pb-2 scrollbar-hide">
                  {candidates.map((candidate) => (
                    <button
                      key={candidate.path}
                      type="button"
                      onClick={() => setSelectedIndex(candidate.index)}
                      className={`relative flex-shrink-0 rounded-xl border ${selectedIndex === candidate.index ? "border-primary" : "border-transparent"} w-16 aspect-square overflow-hidden`}
                    >
                      {candidate.signedUrl ? (
                        <img src={candidate.signedUrl} alt={`candidate-thumb-${candidate.index}`} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">preview</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <CardFooter className={`flex flex-col gap-2 items-center justify-center pb-6 pt-2.5 px-6 shrink-0 ${type === 'drawer' ? 'border-none shadow-none' : ''}`}>
          <div className="flex w-full gap-2">
            {showBack ? (
              <Button type="button" variant="outline" className="flex-1" onClick={onPrevious}>
                back
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={handleSave}
              className="bg-primary flex gap-2 h-9 items-center justify-center px-4 py-2 rounded-[10px] shadow-sm flex-1"
              disabled={!canContinue || isSaving}
            >
              <Share className="relative shrink-0 size-4 text-primary-foreground" />
              <p className="font-medium leading-5 relative shrink-0 text-primary-foreground text-sm capitalize">
                {isSaving ? "saving..." : "save avatar"}
              </p>
            </Button>
          </div>
        </CardFooter>
      </div>
    </Form>
  )
}
