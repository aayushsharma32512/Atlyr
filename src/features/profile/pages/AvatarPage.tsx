import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Save, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ScreenHeader } from "@/design-system/primitives"
import { AppShellLayout } from "@/layouts/AppShellLayout"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AvatarCard } from "@/features/profile/components/AvatarCard"

interface Avatar {
  id: string
  imageUrl?: string
  generationDate: string
}

export function AvatarPage() {
  const navigate = useNavigate()
  const [avatars] = useState<Avatar[]>([
    {
      id: "1",
      generationDate: "<generation date>",
    },
    {
      id: "2",
      generationDate: "<generation date>",
    },
    {
      id: "3",
      generationDate: "<generation date>",
    },
    {
      id: "4",
      generationDate: "<generation date>",
    },
    {
      id: "5",
      generationDate: "<generation date>",
    },
    {
      id: "6",
      generationDate: "<generation date>",
    },
  ])
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null)

  const handleMakeDefault = () => {
    if (selectedAvatarId) {
      console.log("Make default:", selectedAvatarId)
    }
  }

  const handleGenerateNew = () => {
    console.log("Generate new avatar")
  }

  const handleDelete = (id: string) => {
    console.log("Delete avatar:", id)
  }

  const handleMaximize = (id: string) => {
    console.log("Maximize avatar:", id)
  }
  const handleBack = () => {
    navigate("/profile")
  }

  return (
    <AppShellLayout>
      <div className="relative flex flex-1 flex-col min-h-0 bg-background border border-border rounded-[18px] m-2 shadow-sm"
           style={{ maxHeight: "calc(100vh - 60px)", overflow: "hidden" }}>
        <ScreenHeader
          onAction={handleBack}
          className="absolute left-4 top-4 z-20 px-0 pt-0 pb-0"
        />
        {/* Header */}
        <div className="flex gap-3 sticky top-0 items-center justify-center h-auto p-6 shrink-0 bg-background z-10">
          <div className="flex flex-1 flex-col gap-1.5 items-center justify-center text-center">
            <p className="text-base font-medium text-card-foreground leading-none">
              User Avatars
            </p>
            <p className="text-sm font-normal text-muted-foreground leading-5">
              View all generated avatars for virtual try-on
            </p>
          </div>
        </div>

        {/* Scrollable Avatar Grid */}
        <div className="flex-1 min-h-0 overflow-hidden relative rounded-[14px] w-full overflow-y-auto scrollbar-hide">
          <ScrollArea className="h-full w-full">
            <div className="grid grid-cols-2 gap-3 justify-items-center px-6 py-[28px] w-full">
              {avatars.map((avatar) => (
                <AvatarCard
                  key={avatar.id}
                  id={avatar.id}
                  imageUrl={avatar.imageUrl}
                  generationDate={avatar.generationDate}
                  isSelected={selectedAvatarId === avatar.id}
                  onSelect={() => setSelectedAvatarId(avatar.id)}
                  onDelete={() => handleDelete(avatar.id)}
                  onMaximize={() => handleMaximize(avatar.id)}
                />
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 items-center justify-center pb-6 pt-2.5 px-6 shrink-0">
          <Button
            type="button"
            onClick={handleMakeDefault}
            className="bg-primary flex flex-1 gap-2 h-9 items-center justify-center px-4 py-2 rounded-[10px] shadow-sm"
            disabled={!selectedAvatarId}
          >
            <Save className="relative shrink-0 size-4 text-primary-foreground" />
            <p className="font-medium leading-5 relative shrink-0 text-primary-foreground text-sm">
              make default
            </p>
          </Button>
          <Button
            type="button"
            onClick={handleGenerateNew}
            className="bg-primary flex flex-1 gap-2 h-9 items-center justify-center px-4 py-2 rounded-[10px] shadow-sm"
          >
            <Sparkles className="relative shrink-0 size-4 text-primary-foreground" />
            <p className="font-medium leading-5 relative shrink-0 text-primary-foreground text-sm">
              generate new
            </p>
          </Button>
        </div>
      </div>
    </AppShellLayout>
  )
}

export default AvatarPage
