import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { BasicInformationCard } from "@/features/profile/components/BasicInformationCard"
import type { DropdownOption } from "@/features/profile/components/DropdownSelector"
import { ExpandableDetailCard } from "@/features/profile/components/ExpandableDetailCard"
import type { Option } from "@/features/profile/components/OptionSelector"
import { useProfileUpdateMutation } from "@/features/profile/hooks/useProfileQuery"
import { useProfileContext } from "@/features/profile/providers/ProfileProvider"
import { useMannequinHead } from "@/features/profile/hooks/useMannequinHead"
import {
  applySkinToneToSvg,
  buildSvgDataUrl,
} from "@/features/profile/utils/mannequin"
import { AppShellLayout } from "@/layouts/AppShellLayout"

const SKIN_TONE_SWATCHES = ["#F5D7C2", "#E9C4A6", "#D3A17B", "#B8875F", "#8D5A3A", "#5C3A2E"]

function buildHeightOptions(): DropdownOption[] {
  const options: DropdownOption[] = []
  for (let feet = 4; feet <= 7; feet += 1) {
    const maxInches = feet === 7 ? 0 : 11
    for (let inches = 0; inches <= maxInches; inches += 1) {
      const totalInches = feet * 12 + inches
      const cm = Math.round(totalInches * 2.54)
      const label = `${feet}'${inches}" (${cm} cm)`
      options.push({
        id: `${cm}`,
        label,
        value: label,
      })
    }
  }
  return options
}

export function UserDetailsPage() {
  const navigate = useNavigate()
  const { profile, isLoading } = useProfileContext()
  const updateProfileMutation = useProfileUpdateMutation()
  const [isSaving, setIsSaving] = useState(false)
  const [name, setName] = useState("")
  const [age, setAge] = useState("")
  const [gender, setGender] = useState("")
  const [selectedSkinTone, setSelectedSkinTone] = useState<string | null>(null)
  const [heightCm, setHeightCm] = useState<number | null>(null)
  const [skinToneOptions, setSkinToneOptions] = useState<Option[]>([])
  const [hasInitialized, setHasInitialized] = useState(false)
  const previousGenderRef = useRef<"male" | "female" | null>(null)
  const resolvedGender = gender === "male" || gender === "female" ? gender : null
  const { baseSvg } = useMannequinHead({ gender: resolvedGender, skinTone: null })

  useEffect(() => {
    if (isLoading || hasInitialized) {
      return
    }

    if (profile) {
      const initialName = profile.name === "User" ? "" : profile.name
      setName(initialName ?? "")
      setAge(profile.age ? profile.age.toString() : "")
      setGender(
        profile.gender === "male" || profile.gender === "female" ? profile.gender : ""
      )
      setSelectedSkinTone(profile.selected_skin_tone ?? null)
      setHeightCm(typeof profile.height_cm === "number" ? profile.height_cm : null)
    }

    setHasInitialized(true)
  }, [hasInitialized, isLoading, profile])

  useEffect(() => {
    if (!resolvedGender) {
      previousGenderRef.current = null
      setSkinToneOptions([])
      return
    }

    if (previousGenderRef.current && previousGenderRef.current !== resolvedGender) {
      setSelectedSkinTone(null)
    }
    previousGenderRef.current = resolvedGender

    if (!baseSvg) {
      setSkinToneOptions([])
      return
    }

    const options = SKIN_TONE_SWATCHES.map((hex, index) => {
      const tintedSvg = applySkinToneToSvg(baseSvg, hex)
      return {
        id: hex,
        label: `Tone ${index + 1}`,
        imageUrl: buildSvgDataUrl(tintedSvg),
      }
    })
    setSkinToneOptions(options)
  }, [baseSvg, resolvedGender])

  const trimmedName = name.trim()
  const parsedAge = Number.parseInt(age, 10)
  const isFormValid =
    trimmedName.length > 0 &&
    Number.isFinite(parsedAge) &&
    parsedAge > 0 &&
    (gender === "male" || gender === "female")

  const handleSave = async () => {
    if (!isFormValid) {
      return
    }

    setIsSaving(true)
    try {
      await updateProfileMutation.mutateAsync({
        name: trimmedName,
        age: parsedAge,
        gender,
        onboarding_complete: true,
        ...(selectedSkinTone ? { selected_skin_tone: selectedSkinTone } : {}),
        ...(typeof heightCm === "number" ? { height_cm: heightCm } : {}),
      })
      navigate("/home")
    } catch (error) {
      console.error("Failed to save user details", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSelectionChange = (sectionTitle: string, optionId: string) => {
    if (sectionTitle === "Skin Tone") {
      setSelectedSkinTone(optionId)
    }
    if (sectionTitle === "Height") {
      const parsedHeight = Number.parseInt(optionId, 10)
      setHeightCm(Number.isFinite(parsedHeight) ? parsedHeight : null)
    }
  }

  const heightOptions = useMemo(() => buildHeightOptions(), [])

  const facialFeaturesSections = useMemo(
    () => [
      {
        title: "Skin Tone",
        options: skinToneOptions,
      },
      /*
      {
        title: "Face Type",
        options: [
          { id: "face-1", label: "Round" },
          { id: "face-2", label: "Oval" },
          { id: "face-3", label: "Square" },
          { id: "face-4", label: "Heart" },
        ],
      },
      {
        title: "Hair",
        options: [
          { id: "hair-1", label: "Straight" },
          { id: "hair-2", label: "Wavy" },
          { id: "hair-3", label: "Curly" },
          { id: "hair-4", label: "Short" },
        ],
      },
      {
        title: "Other Features",
        options: [
          { id: "other-1", label: "Feature 1" },
          { id: "other-2", label: "Feature 2" },
          { id: "other-3", label: "Feature 3" },
          { id: "other-4", label: "Feature 4" },
        ],
      },
      */
    ],
    [skinToneOptions],
  )

  const bodyDetailsSections = useMemo(
    () => [
      {
        title: "Height",
        type: "dropdown" as const,
        options: heightOptions,
      },
      /*
      {
        title: "Build Type",
        type: "image" as const,
        options: [
          { id: "build-1", label: "Skinny" },
          { id: "build-2", label: "Slim" },
          { id: "build-3", label: "Average" },
          { id: "build-4", label: "Athletic" },
          { id: "build-5", label: "Muscular" },
        ],
      },
      */
    ],
    [heightOptions],
  )

  const facialSelections = useMemo<Record<string, string>>(
    () => (selectedSkinTone ? { "Skin Tone": selectedSkinTone } : {}),
    [selectedSkinTone],
  )

  const bodySelections = useMemo<Record<string, string>>(
    () => (typeof heightCm === "number" ? { Height: heightCm.toString() } : {}),
    [heightCm],
  )

  return (
    <AppShellLayout>
      <div className="flex flex-1 flex-col min-h-0 bg-background">
        {/* Scrollable Content */}
        <ScrollArea className="flex-1 min-h-0 w-full">
          <div className="px-4 pt-6 pb-4 space-y-4">
            {/* Basic Information Card */}
            <BasicInformationCard
              name={name}
              age={age}
              gender={gender}
              skinTone={selectedSkinTone}
              onNameChange={setName}
              onAgeChange={setAge}
              onGenderChange={setGender}
            />

            {/* Facial Features Card */}
            <ExpandableDetailCard
              title="Facial Features"
              items={[
                { label: "Skin Tone" },
                /*
                { label: "Face Type" },
                { label: "Hair" },
                { label: "Other Features" },
                */
              ]}
              selectionSections={facialFeaturesSections}
              onSelectionChange={handleSelectionChange}
              selectedValues={facialSelections}
            />

            {/* Body Details Card */}
            <ExpandableDetailCard
              title="Body Details"
              items={[
                { label: "Height" },
                /*
                { label: "Build Type" },
                */
              ]}
              selectionSections={bodyDetailsSections}
              onSelectionChange={handleSelectionChange}
              selectedValues={bodySelections}
            />
          </div>
        </ScrollArea>

        {/* Save Button - Fixed at bottom */}
        <div className="px-4 py-4 shrink-0 border-t border-border bg-background">
          <Button
            onClick={handleSave}
            disabled={isSaving || !isFormValid}
            className="w-full bg-foreground text-background hover:bg-foreground/90 h-11 rounded-lg"
          >
            {isSaving ? "Saving..." : "Save Details"}
          </Button>
        </div>
      </div>
    </AppShellLayout>
  )
}

export default UserDetailsPage
