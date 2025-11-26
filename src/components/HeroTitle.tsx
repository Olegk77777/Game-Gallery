"use client";

import { motion } from "framer-motion";
import { useIntro } from "./IntroContext";
import styles from "@/app/page.module.css";

export default function HeroTitle() {
    const { isIntroComplete } = useIntro();

    return (
        <div className={styles.titleWrapper}>
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
                Curated 21:9 Photography
            </motion.p>
            <motion.div
                className={styles.scrollIndicator}
                initial={{ opacity: 0 }}
                animate={isIntroComplete ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 1, delay: 2 }}
            >
                <p className={styles.scrollText}>Scroll to Explore</p>
            </motion.div>
        </div>
    );
}
