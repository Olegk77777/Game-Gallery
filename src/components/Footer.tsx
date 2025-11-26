"use client";

import styles from "./Footer.module.css";
import useSound from "@/hooks/useSound";

export default function Footer() {
    const { playHover, playClick } = useSound();
    return (
        <footer className={styles.footer}>
            <div className={styles.content}>
                <p className={styles.copyright}>
                    © {new Date().getFullYear()} OLEG KRUGLIAK
                </p>
                <div className={styles.links}>
                    <a href="#" className={styles.link} onMouseEnter={playHover} onClick={playClick}>TWITTER</a>
                    <a href="#" className={styles.link} onMouseEnter={playHover} onClick={playClick}>INSTAGRAM</a>
                    <a href="#" className={styles.link} onMouseEnter={playHover} onClick={playClick}>ARTSTATION</a>
                </div>
            </div>
        </footer>
    );
}
