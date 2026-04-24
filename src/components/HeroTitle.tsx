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
    gameCount: number;
    frameCount: number;
}

export default function HeroTitle({ shots, gameCount, frameCount }: HeroTitleProps) {
    const { isIntroComplete } = useIntro();
    const [activeIndex, setActiveIndex] = useState(0);
    const activeShot = shots[activeIndex];

    useEffect(() => {
        if (!isIntroComplete || shots.length <= 1) return;

        const timer = window.setInterval(() => {
            setActiveIndex((current) => (current + 1) % shots.length);
        }, 6500);

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
                <motion.p
                    className={styles.heroEyebrow}
                    initial={{ opacity: 0 }}
                    animate={isIntroComplete ? { opacity: 1 } : { opacity: 0 }}
                    transition={{ duration: 1.1, delay: 0.65 }}
                >
                    {activeShot?.gameTitle ?? "Curated game photography"}
                </motion.p>

            <motion.h1
                className={styles.title}
                initial={{ opacity: 0, y: 100 }}
                animate={isIntroComplete ? { opacity: 1, y: 0 } : { opacity: 0, y: 100 }}
                transition={{ duration: 1.5, ease: [0.19, 1, 0.22, 1], delay: 0.5 }}
            >
                GAME GALLERY
            </motion.h1>
            <motion.p
                className={styles.subtitle}
                initial={{ opacity: 0 }}
                animate={isIntroComplete ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 1.5, delay: 0.8 }}
            >
                Cinematic 21:9 frame archive
            </motion.p>
            <motion.div
                className={styles.heroMeta}
                initial={{ opacity: 0 }}
                animate={isIntroComplete ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 1, delay: 1.1 }}
            >
                <span>{String(gameCount).padStart(2, "0")} worlds</span>
                <span>{String(frameCount).padStart(2, "0")} frames</span>
                <span>ultrawide</span>
            </motion.div>
            </motion.div>

            {activeShot && (
                <motion.div
                    className={styles.heroCaption}
                    initial={{ opacity: 0, y: 20 }}
                    animate={isIntroComplete ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                    transition={{ duration: 1, delay: 1.35 }}
                >
                    <span>{String(activeIndex + 1).padStart(2, "0")}</span>
                    <p>{activeShot.annotation}</p>
                </motion.div>
            )}
        </div>
    );
}
