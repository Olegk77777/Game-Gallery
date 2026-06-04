"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useIntro } from "./IntroContext";
import styles from "@/app/page.module.css";

const COLLAGE_TILE_COUNT = 5;

interface HeroShot {
    id: string;
    src: string;
    heroSrc?: string;
    annotation: string;
    gameTitle: string;
}

interface HeroTitleProps {
    shots: HeroShot[];
}

function hashString(value: string) {
    let hash = 2166136261;

    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
}

function createMixedOrder(shots: HeroShot[]) {
    return Array.from({ length: shots.length }, (_, index) => index).sort((left, right) => {
        const leftKey = `${shots[left].gameTitle}-${shots[left].id}-${left}`;
        const rightKey = `${shots[right].gameTitle}-${shots[right].id}-${right}`;

        return hashString(leftKey) - hashString(rightKey);
    });
}

function createInitialTileIndexes(length: number) {
    const tileCount = Math.min(COLLAGE_TILE_COUNT, length);

    return Array.from({ length: tileCount }, (_, index) =>
        Math.floor((index * length) / tileCount)
    );
}

export default function HeroTitle({ shots }: HeroTitleProps) {
    const { isIntroComplete } = useIntro();
    const [isClientReady, setIsClientReady] = useState(false);
    const [loadedSources, setLoadedSources] = useState<Set<string>>(() => new Set());
    const [readyTiles, setReadyTiles] = useState<Set<number>>(() => new Set());
    const orderedShots = useMemo(
        () => createMixedOrder(shots).map((shotIndex) => shots[shotIndex]),
        [shots]
    );
    const [tileIndexes, setTileIndexes] = useState<number[]>(() => createInitialTileIndexes(shots.length));
    const collageShots = isClientReady ? tileIndexes
        .map((shotIndex) => orderedShots[shotIndex])
        .filter(Boolean) : [];

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setIsClientReady(true);
        }, 0);

        return () => window.clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!isClientReady || !isIntroComplete || orderedShots.length <= 1 || tileIndexes.length === 0) return;

        let tileCursor = 0;
        const timer = window.setInterval(() => {
            setTileIndexes((current) => {
                if (current.length === 0) return current;

                const tileIndex = tileCursor % current.length;
                tileCursor = (tileCursor + 1) % current.length;

                return current.map((shotIndex, index) =>
                    index === tileIndex ? (shotIndex + 1) % orderedShots.length : shotIndex
                );
            });
        }, 1900);

        return () => window.clearInterval(timer);
    }, [isClientReady, isIntroComplete, orderedShots.length, tileIndexes.length]);

    useEffect(() => {
        if (!isClientReady || !isIntroComplete || orderedShots.length <= 1 || tileIndexes.length === 0) return;

        tileIndexes.forEach((shotIndex) => {
            const shot = orderedShots[(shotIndex + 1) % orderedShots.length];
            const image = new window.Image();
            const imageSrc = shot.heroSrc ?? shot.src;

            image.onload = () => {
                setLoadedSources((current) => {
                    if (current.has(imageSrc)) return current;
                    const next = new Set(current);
                    next.add(imageSrc);
                    return next;
                });
            };
            image.src = imageSrc;
        });
    }, [isClientReady, isIntroComplete, orderedShots, tileIndexes]);

    return (
        <div className={styles.titleWrapper}>
            <div className={styles.heroMedia} aria-hidden="true">
                <div className={styles.heroCollage}>
                    {collageShots.map((shot, index) => {
                        const imageSrc = shot.heroSrc ?? shot.src;
                        const isLoaded = loadedSources.has(imageSrc);
                        const isReady = readyTiles.has(index);

                        return (
                            <div
                                key={`tile-${index}`}
                                className={`${styles.heroCollageTile} ${styles[`heroCollageTile${index + 1}`]} ${isReady ? styles.heroCollageTileLoaded : ""}`}
                            >
                                <AnimatePresence mode="sync">
                                    <motion.div
                                        key={imageSrc}
                                        className={styles.heroCollageImageLayer}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: isLoaded ? 1 : 0 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 1.75, ease: [0.22, 1, 0.36, 1] }}
                                    >
                                        <Image
                                            src={imageSrc}
                                            alt=""
                                            fill
                                            priority={index === 0}
                                            loading="eager"
                                            sizes={index === 0 ? "(max-width: 760px) 92vw, 680px" : "(max-width: 760px) 46vw, 320px"}
                                            className={styles.heroCollageImage}
                                            onLoad={() => {
                                                setLoadedSources((current) => {
                                                    if (current.has(imageSrc)) return current;
                                                    const next = new Set(current);
                                                    next.add(imageSrc);
                                                    return next;
                                                });
                                                setReadyTiles((current) => {
                                                    if (current.has(index)) return current;
                                                    const next = new Set(current);
                                                    next.add(index);
                                                    return next;
                                                });
                                            }}
                                        />
                                    </motion.div>
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </div>
                <div className={styles.heroScrim} />
                <div className={styles.heroLetterbox} />
            </div>

            <motion.div
                className={styles.heroContent}
                initial={{ opacity: 0, y: 80 }}
                animate={isIntroComplete ? { opacity: 1, y: 0 } : { opacity: 0, y: 80 }}
                transition={{ duration: 1.4, ease: [0.19, 1, 0.22, 1], delay: 0.25 }}
            >
                <motion.p
                    className={styles.heroBrandKicker}
                    initial={{ opacity: 0 }}
                    animate={isIntroComplete ? { opacity: 1 } : { opacity: 0 }}
                    transition={{ duration: 0.9, delay: 0.35 }}
                >
                    Cinematic 21:9 frame archive
                </motion.p>
                <motion.h1
                    className={styles.heroSiteTitle}
                    aria-label="Game Gallery"
                    initial={{ opacity: 0 }}
                    animate={isIntroComplete ? { opacity: 1 } : { opacity: 0 }}
                    transition={{ duration: 1.1, delay: 0.45 }}
                >
                    <span aria-hidden="true">Game</span>
                    <span aria-hidden="true">Gallery</span>
                </motion.h1>
                <motion.p
                    className={styles.heroSiteSubtitle}
                    initial={{ opacity: 0 }}
                    animate={isIntroComplete ? { opacity: 1 } : { opacity: 0 }}
                    transition={{ duration: 0.9, delay: 0.62 }}
                >
                    A curated visual archive of game worlds, light, atmosphere and composition.
                </motion.p>
            </motion.div>
        </div>
    );
}
