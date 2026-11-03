import openingSheet from "@/data/floor-sheet.json";
import { CodingIndex } from "@/components/CodingIndex";
import { getFloorRoster } from "@/lib/floor-roster";
import { getFeaturedResources, getResources } from "@/lib/resources";

export default function Home() {
  const resources = getResources();
  const featured = getFeaturedResources();
  return (
    <>
      <link rel="preload" as="image" href={openingSheet.url} />
      <CodingIndex featured={featured} indexed={resources.length} {...getFloorRoster(featured)} />
    </>
  );
}
