type Gender = "male" | "female" | null

export const homeKeys = {
  all: ["home"] as const,
  recentStyles: (userId: string | null, gender: Gender) =>
    [...homeKeys.all, "recent-styles", userId ?? "guest", gender ?? "neutral"] as const,
  curatedOutfits: (gender: Gender) => [...homeKeys.all, "curated-outfits", gender ?? "neutral"] as const,
}


