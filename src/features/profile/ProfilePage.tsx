import { useNavigate } from "react-router-dom"
import {
  Instagram,
  MessageSquareReply,
  AtSign,
  LogOut,
  Settings,
  SquareUserRound,
  PersonStanding,
  Columns2,
  GitPullRequestDraft,
  CircleFadingPlus,
  MailOpen,
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/contexts/AuthContext"
import { MenuItemButton } from "@/features/profile/components/MenuItemButton"
import { useMannequinHead } from "@/features/profile/hooks/useMannequinHead"
import { useProfileContext } from "@/features/profile/providers/ProfileProvider"
import { AppShellLayout } from "@/layouts/AppShellLayout"

function ProfilePageView() {
  const { profile, gender, skinTone } = useProfileContext()
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const { headUrl } = useMannequinHead({ gender, skinTone })

  const handleLogout = async () => {
    await signOut()
    navigate("/")
  }

  const handleMenuClick = (itemId: string) => {
    switch (itemId) {
      case "avatar":
        navigate("/profile/avatar")
        break
      case "user-details":
        navigate("/profile/user-details")
        break
      default:
        break
    }
  }

  const menuItems = [
    {
      id: "invites",
      label: "Invites",
      icon: MailOpen,
      group: 1,
    },
    {
      id: "instagram",
      label: "Link Instagram",
      icon: Instagram,
      group: 1,
    },
    {
      id: "avatar",
      label: "Avatar",
      icon: SquareUserRound,
      group: 2,
      onClick: () => handleMenuClick("avatar"),
    },
    {
      id: "user-details",
      label: "User details",
      icon: PersonStanding,
      group: 2,
      onClick: () => handleMenuClick("user-details"),
    },
    {
      id: "wardrobe",
      label: "Wardrobe",
      icon: Columns2,
      group: 2,
    },
    {
      id: "train-ai",
      label: "Train Atlyr ai",
      icon: GitPullRequestDraft,
      group: 2,
    },
    {
      id: "add-inventory",
      label: "Add Inventory",
      icon: CircleFadingPlus,
      group: 3,
    },
    {
      id: "feedback",
      label: "Feedback",
      icon: MessageSquareReply,
      group: 3,
    },
    {
      id: "contact",
      label: "Contact Us",
      icon: AtSign,
      group: 3,
    },
    {
      id: "logout",
      label: "Log Out",
      icon: LogOut,
      group: 3,
      onClick: handleLogout,
    },
  ]

  const profileName = profile?.name?.trim()
  const profileInitial = profileName ? profileName.charAt(0).toUpperCase() : ""

  return (
    <div className="min-h-screen bg-background text-white">
      {/* Main Content */}
      <div>
        {/* Header */}
        <div className="px-4 pt-4 pb-6">
          {/* Profile Card */}
          <div className="bg-background rounded-lg p-4">
            <div className="flex items-start gap-4 relative">
              {/* Profile Picture */}
              <Avatar className="w-16 h-16">
                <AvatarImage src={headUrl || undefined} />
                <AvatarFallback className="bg-gray-200 text-gray-600">
                  {profileInitial}
                </AvatarFallback>
              </Avatar>

              {/* Profile Info */}
              <div className="flex-1 min-w-0">
                {profileName ? (
                  <h2 className="text-base font-bold text-gray-900 mb-1">{profileName}</h2>
                ) : null}
              </div>

              {/* Settings Icon */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-0 right-0 text-gray-900 hover:text-gray-900"
              >
                <Settings className="w-8 h-8 text-gray-900" />
              </Button>
            </div>
          </div>
            <Separator className="bg-border" />

          {/* Menu Items */}
          <div className="bg-white rounded-lg overflow-hidden">
            {/* Group 1: Invites & Link Instagram */}
            <div>
              {menuItems
                .filter((item) => item.group === 1)
                .map((item) => (
                  <MenuItemButton
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    onClick={item.onClick}
                  />
                ))}
            </div>

            {/* Separator between Group 1 and Group 2 */}
            <Separator className="bg-gray-200" />

            {/* Group 2: Avatar, User details, Wardrobe, Train Atlyr ai */}
            <div>
              {menuItems
                .filter((item) => item.group === 2)
                .map((item) => (
                  <MenuItemButton
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                          onClick={item.onClick}
                  />
                ))}
                          </div>

            {/* Separator between Group 2 and Group 3 */}
            <Separator className="bg-gray-200" />

            {/* Group 3: Add Inventory, Feedback, Contact Us, Log Out */}
            <div>
              {menuItems
                .filter((item) => item.group === 3)
                .map((item) => (
                  <MenuItemButton
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    onClick={item.onClick}
                  />
                ))}
                </div>
          </div>

        </div>
      </div>
    </div>
  )
}

function ProfilePage() {
  return (
    <AppShellLayout>
      <ProfilePageView />
    </AppShellLayout>
  )
}

export default ProfilePage
