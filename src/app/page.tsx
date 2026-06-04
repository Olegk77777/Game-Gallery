import Scene3D from "@/components/Scene3D";
import GameAlbum from "@/components/GameAlbum";
import AuthorBlock from "@/components/AuthorBlock";
import ScrollReveal from "@/components/ScrollReveal";
import HeroTitle from "@/components/HeroTitle";
import { getGames } from "@/lib/gallery";
import styles from "./page.module.css";

export default async function Home() {
  const games = await getGames();
  const frameCount = games.reduce((total, game) => total + game.screenshots.length, 0);
  const heroShots = games
    .flatMap((game) =>
      game.screenshots.slice(0, 2).map((shot) => ({
        ...shot,
        gameTitle: game.title,
      }))
    )
    .slice(0, 6);

  return (
    <main className={styles.main}>
      <Scene3D />

      <div className={styles.contentLayer}>
        {/* Hero Section */}
        <section className={styles.heroSection}>
          <HeroTitle
            shots={heroShots}
            gameCount={games.length}
            frameCount={frameCount}
          />
        </section>

        {/* Author Block */}
        <AuthorBlock />

        {/* Albums */}
        <div className={styles.albumsContainer}>
          {games.map((game, index) => (
            <ScrollReveal key={game.title} delay={index * 0.1}>
              <GameAlbum
                title={game.title}
                screenshots={game.screenshots}
                index={index}
              />
            </ScrollReveal>
          ))}
        </div>
      </div>
    </main>
  );
}
