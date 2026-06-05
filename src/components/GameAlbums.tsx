"use client";

import { useState } from "react";
import type { Game } from "@/lib/gallery";
import GameAlbum from "./GameAlbum";
import ScrollReveal from "./ScrollReveal";

interface GameAlbumsProps {
    games: Game[];
}

export default function GameAlbums({ games }: GameAlbumsProps) {
    const [openAlbumTitle, setOpenAlbumTitle] = useState<string | null>(null);

    return (
        <>
            {games.map((game, index) => (
                <ScrollReveal key={game.title} delay={index * 0.1}>
                    <GameAlbum
                        title={game.title}
                        screenshots={game.screenshots}
                        index={index}
                        isOpen={openAlbumTitle === game.title}
                        onToggle={() => {
                            setOpenAlbumTitle((currentTitle) =>
                                currentTitle === game.title ? null : game.title
                            );
                        }}
                    />
                </ScrollReveal>
            ))}
        </>
    );
}
