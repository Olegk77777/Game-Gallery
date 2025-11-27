"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import styles from "./CustomCursor.module.css";

export default function CustomCursor() {
    const [isHovered, setIsHovered] = useState(false);
    const cursorX = useMotionValue(-100);
    const cursorY = useMotionValue(-100);

    const springConfig = { damping: 35, stiffness: 400, mass: 0.3 }; // Snappier, less lag
    const cursorXSpring = useSpring(cursorX, springConfig);
    const cursorYSpring = useSpring(cursorY, springConfig);

    // Use layout effect to ensure styles are applied before paint
    useLayoutEffect(() => {
        const moveCursor = (e: MouseEvent) => {
            cursorX.set(e.clientX - 10); // Center the 20px cursor
            cursorY.set(e.clientY - 10);

            // Force cursor none continuously
            if (document.body.style.cursor !== 'none') {
                document.body.style.cursor = 'none';
            }
        };

        const handleMouseOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'A' ||
                target.tagName === 'BUTTON' ||
                target.closest('a') ||
                target.closest('button') ||
                target.closest('[role="button"]') ||
                target.classList.contains('cursor-hover')) {
                setIsHovered(true);
            } else {
                setIsHovered(false);
            }
        };

        const forceCursor = () => {
            if (document.body.style.cursor !== 'none') {
                document.body.style.cursor = 'none';
            }
        };

        window.addEventListener("mousemove", moveCursor);
        window.addEventListener("mouseover", handleMouseOver);
        window.addEventListener("scroll", forceCursor, { passive: true });
        window.addEventListener("mousedown", forceCursor);
        window.addEventListener("mouseup", forceCursor);

        // Initial force
        forceCursor();

        return () => {
            window.removeEventListener("mousemove", moveCursor);
            window.removeEventListener("mouseover", handleMouseOver);
            window.removeEventListener("scroll", forceCursor);
            window.removeEventListener("mousedown", forceCursor);
            window.removeEventListener("mouseup", forceCursor);
        };
    }, [cursorX, cursorY]);

    return (
        <motion.div
            className={styles.cursor}
            style={{
                x: cursorXSpring,
                y: cursorYSpring,
            }}
            animate={{
                scale: isHovered ? 2 : 1,
            }}
            transition={{ duration: 0.2 }}
        />
    );
}
