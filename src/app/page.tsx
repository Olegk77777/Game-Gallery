import Scene3D from "@/components/Scene3D";
import GameAlbum from "@/components/GameAlbum";
import AuthorBlock from "@/components/AuthorBlock";
import ScrollReveal from "@/components/ScrollReveal";
import HeroTitle from "@/components/HeroTitle";
import { getGames } from "@/lib/gallery";
import styles from "./page.module.css";

export default async function Home() {
  const games = await getGames();
  const maxScreenshotCount = Math.max(...games.map((game) => game.screenshots.length));
  const heroShots = Array.from({ length: maxScreenshotCount }).flatMap((_, screenshotIndex) =>
    games.flatMap((game) => {
      const shot = game.screenshots[screenshotIndex];

      return shot
        ? [{
          ...shot,
          id: `${game.title}-${shot.id}`,
          gameTitle: game.title,
        }]
        : [];
    })
  );

  return (
    <main className={styles.main}>
      <Scene3D />

      <div className={styles.contentLayer}>
        {/* Hero Section */}
        <section className={styles.heroSection}>
          <HeroTitle
            shots={heroShots}
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
