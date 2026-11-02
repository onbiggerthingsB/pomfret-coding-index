import { CodingIndex } from "@/components/CodingIndex";
import { getFeaturedResources, getResources } from "@/lib/resources";

export default function Home() {
  const resources = getResources();
  return <CodingIndex featured={getFeaturedResources()} indexed={resources.length} />;
}
