import Scene3D from "@/components/Scene3D";
import GameAlbum from "@/components/GameAlbum";
import AuthorBlock from "@/components/AuthorBlock";
import ScrollReveal from "@/components/ScrollReveal";
import HeroTitle from "@/components/HeroTitle";
import { getGames } from "@/lib/gallery";
import styles from "./page.module.css";

export default async function Home() {
  const games = await getGames();

  return (
    <main className={styles.main}>
      <Scene3D />

      <div className="z-10 w-full">
        {/* Hero Section */}
        <section className={styles.heroSection}>
          <HeroTitle />
        </section>

        {/* Author Block */}
        <AuthorBlock />

        {/* Albums */}
        <div className={styles.albumsContainer}>
          {games.map((game, index) => (
            <ScrollReveal key={game.title} delay={index * 0.1}>
              <GameAlbum title={game.title} screenshots={game.screenshots} />
            </ScrollReveal>
          ))}
        </div>
      </div>
    </main>
  );
}
