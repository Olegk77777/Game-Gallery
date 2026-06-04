"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useIntro } from "./IntroContext";
import styles from "./Preloader.module.css";

export default function Preloader() {
    const { setIntroComplete } = useIntro();
    const [progress, setProgress] = useState(0);
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        document.body.style.overflow = "hidden";

        const timers = [
            setTimeout(() => setProgress(42), 80),
            setTimeout(() => setProgress(90), 520),
            setTimeout(() => setProgress(100), 900),
            setTimeout(() => {
                setIsVisible(false);
                document.body.style.overflow = "";
                setIntroComplete(true);
            }, 1120),
        ];

        return () => {
            timers.forEach((timer) => clearTimeout(timer));
            document.body.style.overflow = "";
        };
    }, [setIntroComplete]);

    if (!isVisible) {
        return null;
    }

    return (
        <motion.div
            initial={{ opacity: 1 }}
            className={styles.overlay}
        >
            <div className={styles.inner} role="status" aria-live="polite" aria-label="Loading">
                <div className={styles.percent}>
                    {String(progress).padStart(3, "0")}%
                </div>
                <div className={styles.meter} aria-hidden="true">
                    <motion.span
                        style={{ width: `${progress}%` }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                    />
                </div>
            </div>
        </motion.div>
    );
}
