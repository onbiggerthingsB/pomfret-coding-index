import cards from "../data/community-cards.json" with { type: "json" };
import access from "../data/api-requirements.json" with { type: "json" };
import type { Resource, ResourceRequirements } from "./resources.ts";

type CommunityCard = Partial<Pick<Resource, "name" | "description" | "kind" | "guidance">>;
const reviewedCards: Record<string, CommunityCard> = cards as Record<string, CommunityCard>;
const verifiedAccess: Record<string, ResourceRequirements> = access as Record<string, ResourceRequirements>;

// Editorial additions live outside the generated directory so the next import preserves them.
export function getCommunityMetadata(id: string): (CommunityCard & { requirements?: ResourceRequirements }) | undefined {
  const card = Object.hasOwn(reviewedCards, id) ? reviewedCards[id] : undefined;
  const requirements = Object.hasOwn(verifiedAccess, id) ? verifiedAccess[id] : undefined;
  if (requirements) return { ...card, requirements };
  return card;
}
