"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { type CSSProperties, type PointerEvent, useEffect, useState } from "react";
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
    const progress = shots.length > 0 ? `${((activeIndex + 1) / shots.length) * 100}%` : "0%";

    const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
        const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;

        event.currentTarget.style.setProperty("--mx", x.toFixed(3));
        event.currentTarget.style.setProperty("--my", y.toFixed(3));
    };

    const resetPointer = (event: PointerEvent<HTMLDivElement>) => {
        event.currentTarget.style.setProperty("--mx", "0");
        event.currentTarget.style.setProperty("--my", "0");
    };

    useEffect(() => {
        if (!isIntroComplete || shots.length <= 1) return;

        const timer = window.setInterval(() => {
            setActiveIndex((current) => (current + 1) % shots.length);
        }, 6500);

        return () => window.clearInterval(timer);
    }, [isIntroComplete, shots.length]);

    return (
        <div
            className={styles.titleWrapper}
            onPointerMove={handlePointerMove}
            onPointerLeave={resetPointer}
            style={{ "--hero-progress": progress } as CSSProperties}
        >
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
                    <div className={styles.heroAura} />
                    <div className={styles.heroGrid} />
                    <div className={styles.heroScrim} />
                    <div className={styles.heroLetterbox} />
                    <div className={styles.heroScanline} />
                </div>
            )}

            <motion.div
                className={styles.heroContent}
                initial={{ opacity: 0, y: 80 }}
                animate={isIntroComplete ? { opacity: 1, y: 0 } : { opacity: 0, y: 80 }}
                transition={{ duration: 1.4, ease: [0.19, 1, 0.22, 1], delay: 0.25 }}
            >
                <motion.div
                    className={styles.heroSystemBar}
                    initial={{ opacity: 0, y: -12 }}
                    animate={isIntroComplete ? { opacity: 1, y: 0 } : { opacity: 0, y: -12 }}
                    transition={{ duration: 1, delay: 0.45 }}
                >
                    <span>Frame operating system</span>
                    <span>Live curation</span>
                    <span>{String(activeIndex + 1).padStart(2, "0")} / {String(shots.length).padStart(2, "0")}</span>
                </motion.div>

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
                    <span className={styles.titleLine} data-text="GAME">GAME</span>
                    <span className={styles.titleLine} data-text="GALLERY">GALLERY</span>
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

                <motion.div
                    className={styles.heroTelemetry}
                    initial={{ opacity: 0, y: 18 }}
                    animate={isIntroComplete ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
                    transition={{ duration: 1, delay: 1.2 }}
                >
                    <div className={styles.telemetryPanel}>
                        <span>Active world</span>
                        <strong>{activeShot?.gameTitle ?? "Curated game photography"}</strong>
                    </div>
                    <div className={styles.telemetryPanel}>
                        <span>Signal</span>
                        <strong>Cinematic stream</strong>
                    </div>
                    <div className={styles.heroProgress} aria-hidden="true">
                        <span />
                    </div>
                </motion.div>
            </motion.div>

            {shots.length > 0 && (
                <motion.div
                    className={styles.heroDeck}
                    initial={{ opacity: 0, x: 24 }}
                    animate={isIntroComplete ? { opacity: 1, x: 0 } : { opacity: 0, x: 24 }}
                    transition={{ duration: 1, delay: 1.15 }}
                    aria-label="Featured frames"
                >
                    {shots.map((shot, index) => (
                        <button
                            key={shot.id}
                            type="button"
                            className={`${styles.heroThumb} ${index === activeIndex ? styles.heroThumbActive : ""}`}
                            onClick={() => setActiveIndex(index)}
                            aria-label={`Show frame ${index + 1}: ${shot.gameTitle}`}
                        >
                            <Image
                                src={shot.src}
                                alt=""
                                fill
                                sizes="96px"
                                className={styles.heroThumbImage}
                            />
                            <span>{String(index + 1).padStart(2, "0")}</span>
                        </button>
                    ))}
                </motion.div>
            )}

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
