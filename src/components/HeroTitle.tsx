"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useIntro } from "./IntroContext";
import styles from "@/app/page.module.css";

interface HeroShot {
    id: string;
    src: string;
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
    const orderedShots = shotOrder.length === shots.length
        ? shotOrder.map((shotIndex) => shots[shotIndex])
        : shots;
    const activeShot = orderedShots[activeIndex];

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
        }, 5600);

        return () => window.clearInterval(timer);
    }, [isIntroComplete, shots.length]);

    return (
        <div className={styles.titleWrapper}>
            {activeShot && (
                <div className={styles.heroMedia} aria-hidden="true">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeShot.id}
                            className={styles.heroFrame}
                            initial={{ opacity: 0, scale: 1.08 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.03 }}
                            transition={{ duration: 1.6, ease: [0.19, 1, 0.22, 1] }}
                        >
                            <Image
                                src={activeShot.src}
                                alt=""
                                fill
                                priority={activeIndex === 0}
                                sizes="100vw"
                                className={styles.heroImage}
                            />
                        </motion.div>
                    </AnimatePresence>
                    <div className={styles.heroScrim} />
                    <div className={styles.heroLetterbox} />
                </div>
            )}

            <motion.div
                className={styles.heroContent}
                initial={{ opacity: 0, y: 80 }}
                animate={isIntroComplete ? { opacity: 1, y: 0 } : { opacity: 0, y: 80 }}
                transition={{ duration: 1.4, ease: [0.19, 1, 0.22, 1], delay: 0.25 }}
            >
                <motion.h1
                    className={styles.heroGameTitle}
                    initial={{ opacity: 0 }}
                    animate={isIntroComplete ? { opacity: 1 } : { opacity: 0 }}
                    transition={{ duration: 1.1, delay: 0.45 }}
                >
                    {activeShot?.gameTitle ?? "Game Gallery"}
                </motion.h1>
                {activeShot?.annotation && (
                    <motion.p
                        className={styles.heroGameAnnotation}
                        initial={{ opacity: 0, y: 18 }}
                        animate={isIntroComplete ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
                        transition={{ duration: 1.1, delay: 0.65 }}
                    >
                        {activeShot.annotation}
                    </motion.p>
                )}
            </motion.div>
        </div>
    );
}
