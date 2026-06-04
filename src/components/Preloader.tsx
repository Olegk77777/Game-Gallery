"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useIntro } from "./IntroContext";
import styles from "./Preloader.module.css";

export default function Preloader() {
    const { setIntroComplete } = useIntro();
    const [progress, setProgress] = useState(0);
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        document.body.style.overflow = "hidden";

        // Audio removed as per user request
        // audioRef.current = new Audio("/audio/intro.wav");
        // ...

        // Simulation Logic
        let currentProgress = 0;
        const startTime = Date.now();

        // Timeline:
        // 0-1s: Fast to 30%
        // 1-1.5s: Pause
        // 1.5-3.5s: Slow to 80%
        // 3.5-4s: Fast to 100%

        const updateProgress = () => {
            const now = Date.now();
            const elapsed = (now - startTime) / 1000;

            if (elapsed < 0.5) {
                // Fast start
                currentProgress = Math.min(30, (elapsed / 0.5) * 30);
            } else if (elapsed < 0.8) {
                // Pause
                currentProgress = 30;
            } else if (elapsed < 1.8) {
                // Slow crawl
                currentProgress = 30 + ((elapsed - 0.8) / 1) * 50; // 30 -> 80
            } else {
                // Fast finish
                currentProgress = 80 + ((elapsed - 1.8) / 0.2) * 20; // 80 -> 100
            }

            if (currentProgress >= 100) {
                currentProgress = 100;
                setProgress(100);

                // Complete
                setTimeout(() => {
                    setIsVisible(false);
                    document.body.style.overflow = ""; // Unlock scroll
                    setIntroComplete(true);
                }, 500); // Short delay at 100%
            } else {
                setProgress(Math.floor(currentProgress));
                requestAnimationFrame(updateProgress);
            }
        };

        requestAnimationFrame(updateProgress);

        return () => {
            document.body.style.overflow = "";
        };
    }, [setIntroComplete]);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ y: 0 }}
                    exit={{ y: "-100%", transition: { duration: 0.8, ease: [0.19, 1, 0.22, 1] } }}
                    className={styles.overlay}
                >
                    <div className={styles.inner}>
                        <div className={styles.header}>
                            <span>Game Gallery</span>
                            <span>Frame system boot</span>
                        </div>
                        <div className={styles.percent}>
                            {String(progress).padStart(3, "0")}%
                        </div>
                        <div className={styles.meter} aria-hidden="true">
                            <motion.span
                                style={{ width: `${progress}%` }}
                                transition={{ duration: 0.2, ease: "easeOut" }}
                            />
                        </div>
                        <div className={styles.footer}>
                            <span>Curating worlds</span>
                            <span>21:9 archive</span>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
