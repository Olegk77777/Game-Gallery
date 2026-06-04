"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";
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

function createShuffledOrder(length: number, avoidFirstIndex?: number, firstIndex?: number) {
    const order = Array.from({ length }, (_, index) => index);

    for (let index = order.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
    }

    if (firstIndex !== undefined && order.length > 1) {
        const forcedIndex = order.indexOf(firstIndex);
        [order[0], order[forcedIndex]] = [order[forcedIndex], order[0]];
        return order;
    }

    if (avoidFirstIndex !== undefined && order.length > 1 && order[0] === avoidFirstIndex) {
        [order[0], order[1]] = [order[1], order[0]];
    }

    return order;
}

export default function HeroTitle({ shots }: HeroTitleProps) {
    const { isIntroComplete } = useIntro();
    const [activeIndex, setActiveIndex] = useState(0);
    const [shotOrder, setShotOrder] = useState<number[]>([]);
    const [loadedSources, setLoadedSources] = useState<Set<string>>(() => new Set());
    const orderedShots = shotOrder.length === shots.length
        ? shotOrder.map((shotIndex) => shots[shotIndex])
        : shots;
    const collageTileCount = Math.min(COLLAGE_TILE_COUNT, orderedShots.length);
    const collageShots = orderedShots.length > 0
        ? Array.from({ length: collageTileCount }, (_, index) => {
            const spreadOffset = Math.floor((index * orderedShots.length) / collageTileCount);
            return orderedShots[(activeIndex + spreadOffset) % orderedShots.length];
        })
        : [];

    useEffect(() => {
        setActiveIndex(0);
        setShotOrder(createShuffledOrder(shots.length, undefined, 0));
    }, [shots.length]);

    useEffect(() => {
        if (!isIntroComplete || shots.length <= 1) return;

        const timer = window.setInterval(() => {
            setActiveIndex((current) => {
                const next = current + 1;

                if (next < shots.length) {
                    return next;
                }

                setShotOrder((currentOrder) =>
                    createShuffledOrder(shots.length, currentOrder[current])
                );
                return 0;
            });
        }, 3600);

        return () => window.clearInterval(timer);
    }, [isIntroComplete, shots.length]);

    return (
        <div className={styles.titleWrapper}>
            <div className={styles.heroMedia} aria-hidden="true">
                <div className={styles.heroCollage}>
                    <AnimatePresence>
                        {collageShots.map((shot, index) => {
                            const imageSrc = shot.heroSrc ?? shot.src;
                            const isLoaded = loadedSources.has(imageSrc);

                            return (
                                <motion.div
                                    key={`${index}-${shot.id}`}
                                    className={`${styles.heroCollageTile} ${styles[`heroCollageTile${index + 1}`]} ${isLoaded ? styles.heroCollageTileLoaded : ""}`}
                                    initial={{ opacity: 0, y: 18, scale: 0.96 }}
                                    animate={{ opacity: isLoaded ? 1 : 0, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -14, scale: 0.98 }}
                                    transition={{ duration: 0.65, ease: [0.19, 1, 0.22, 1], delay: index * 0.04 }}
                                >
                                    <Image
                                        src={imageSrc}
                                        alt=""
                                        fill
                                        priority={index === 0}
                                        loading={index === 0 ? "eager" : "lazy"}
                                        sizes={index === 0 ? "(max-width: 760px) 92vw, 680px" : "(max-width: 760px) 46vw, 320px"}
                                        className={styles.heroCollageImage}
                                        onLoad={() => {
                                            setLoadedSources((current) => {
                                                if (current.has(imageSrc)) return current;
                                                const next = new Set(current);
                                                next.add(imageSrc);
                                                return next;
                                            });
                                        }}
                                    />
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
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
