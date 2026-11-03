"use client";

import { useEffect, useMemo, useState } from "react";
import type { Resource } from "@/lib/resources";
import { resolveLibraryResources, type LibrarySnapshot } from "@/lib/library-storage";

type ReviewModule = typeof import("@/lib/community-metadata");

export function useReviewedLibrary(library: LibrarySnapshot, featured: ReadonlyMap<string, Resource>) {
  const [reviews, setReviews] = useState<ReviewModule | null>(null);
  const isCommunity = (item: Resource) => item.origin === "community-index";
  const hasCommunity = library.project.resources.some(isCommunity) || library.saved.some(isCommunity);

  useEffect(() => {
    if (!hasCommunity || reviews) return;
    let active = true;
    function load() {
      // The same public chunk serves every kit. Stored resource IDs and project text stay in this browser.
      import("@/lib/community-metadata").then(module => {
        if (active) setReviews(module);
      }).catch(() => { /* The stored snapshot remains available offline. */ });
    }
    load();
    window.addEventListener("online", load);
    return () => { active = false; window.removeEventListener("online", load); };
  }, [hasCommunity, reviews]);

  return useMemo(() => resolveLibraryResources(library, featured, reviews?.getCommunityMetadata), [library, featured, reviews]);
}
