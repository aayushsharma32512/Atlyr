import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useProfileContext } from "@/features/profile/providers/ProfileProvider"
import { useMannequinHead } from "@/features/profile/hooks/useMannequinHead"

interface BasicInformationCardProps {
  name: string
  age: string
  gender: string
  skinTone?: string | null
  onNameChange: (name: string) => void
  onAgeChange: (age: string) => void
  onGenderChange: (gender: string) => void
}

export function BasicInformationCard({
  name,
  age,
  gender,
  skinTone,
  onNameChange,
  onAgeChange,
  onGenderChange,
}: BasicInformationCardProps) {
  const { profile, skinTone: profileSkinTone } = useProfileContext()
  const fallbackName = name || profile?.name || "User"
  const fallbackInitial = fallbackName.trim() ? fallbackName.trim().charAt(0).toUpperCase() : "U"
  const resolvedGender: "male" | "female" | null =
    gender === "male" || gender === "female"
      ? gender
      : profile?.gender === "male" || profile?.gender === "female"
        ? profile.gender
        : null
  const resolvedSkinTone = skinTone ?? profileSkinTone ?? null
  const { headUrl } = useMannequinHead({ gender: resolvedGender, skinTone: resolvedSkinTone })

  return (
    <div className="bg-card rounded-[18px] p-6 border border-border" style={{ boxSizing: "border-box" }}>
      <h3 className="text-sm font-medium text-foreground mb-4">Basic Information</h3>
      <div className="flex items-start gap-4">
        {/* Profile Picture */}
        <Avatar className="w-16 h-16 flex-shrink-0">
          <AvatarImage src={headUrl || undefined} />
          <AvatarFallback className="bg-muted text-muted-foreground">
            {fallbackInitial}
          </AvatarFallback>
        </Avatar>

        {/* Form Fields */}
        <div className="flex-1 space-y-4">
          {/* Name Input */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm text-foreground">
              Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              className="w-full"
            />
          </div>

          {/* Age and Gender Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Age Select */}
            <div className="space-y-2">
              <Label htmlFor="age" className="text-sm text-foreground">
                Age
              </Label>
              <Select value={age || undefined} onValueChange={onAgeChange}>
                <SelectTrigger id="age" className="w-full">
                  <SelectValue placeholder="Select age" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 83 }, (_, i) => i + 18).map((age) => (
                    <SelectItem key={age} value={age.toString()}>
                      {age}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Gender Select */}
            <div className="space-y-2">
              <Label htmlFor="gender" className="text-sm text-foreground">
                Gender
              </Label>
              <Select value={gender || undefined} onValueChange={onGenderChange}>
                <SelectTrigger id="gender" className="w-full">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
