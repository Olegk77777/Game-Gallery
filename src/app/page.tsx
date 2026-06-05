import GalleryExperience from "@/components/GalleryExperience";
import { getGames } from "@/lib/gallery";

export default async function Home() {
  const games = await getGames();

  return <GalleryExperience games={games} />;
}
