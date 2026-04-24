"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import ScreenshotCard from "./ScreenshotCard";
import ScrollReveal from "./ScrollReveal";
import Image from "next/image";
import styles from "./GameAlbum.module.css";
import useSound from "@/hooks/useSound";
import GlitchText from "./GlitchText";

interface Screenshot {
    id: string;
    src: string;
    annotation: string;
}

interface GameAlbumProps {
    title: string;
    screenshots: Screenshot[];
}

export default function GameAlbum({ title, screenshots }: GameAlbumProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const { playHover, playClick } = useSound();
    const coverShot = screenshots[0];
    const selectedShot = selectedIndex !== null ? screenshots[selectedIndex] : null;

    const moveSelection = useCallback((direction: number) => {
        setSelectedIndex((current) => {
            if (current === null) return current;
            return (current + direction + screenshots.length) % screenshots.length;
        });
    }, [screenshots.length]);

    useEffect(() => {
        if (selectedIndex === null) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setSelectedIndex(null);
            }

            if (event.key === "ArrowRight") {
                moveSelection(1);
            }

            if (event.key === "ArrowLeft") {
                moveSelection(-1);
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [selectedIndex, moveSelection]);

    return (
        <section className={styles.section}>
            <ScrollReveal>
                <motion.button
                    type="button"
                    className={`${styles.header} cursor-hover`}
                    onClick={() => {
                        playClick();
                        setIsOpen(!isOpen);
                    }}
                    onMouseEnter={playHover}
                    aria-expanded={isOpen}
                >
                    {coverShot && (
                        <div className={styles.coverImage} aria-hidden="true">
                            <Image
                                src={coverShot.src}
                                alt=""
                                fill
                                sizes="(max-width: 768px) 100vw, 1600px"
                                className={styles.coverPhoto}
                            />
                            <div className={styles.coverShade} />
                        </div>
                    )}
                    <div className={styles.headerContent}>
                        <div className={styles.titleWrapper}>
                            <p className={styles.kicker}>Collection</p>
                            <h2 className={styles.title}>
                                <GlitchText text={title} />
                            </h2>
                            {coverShot?.annotation && (
                                <p className={styles.coverAnnotation}>{coverShot.annotation}</p>
                            )}
                            <div className={styles.metaRow}>
                                <span>{String(screenshots.length).padStart(2, "0")} frames</span>
                                <span>21:9 photography</span>
                            </div>
                        </div>
                        <motion.div
                            animate={{ rotate: isOpen ? 45 : 0 }}
                            transition={{ duration: 0.3 }}
                            className={styles.iconWrapper}
                        >
                            <Plus size={32} />
                        </motion.div>
                    </div>
                </motion.button>
            </ScrollReveal>

            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Floating Close Button - rendered in Portal to escape transform context */}
                        {typeof document !== 'undefined' && createPortal(
                            <motion.button
                                className={styles.floatingCloseButton}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    playClick();
                                    setIsOpen(false);
                                }}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                transition={{ duration: 0.2 }}
                            >
                                <X size={24} />
                            </motion.button>,
                            document.body
                        )}

                        <motion.div
                            initial="hidden"
                            animate="visible"
                            exit="hidden"
                            variants={{
                                hidden: { opacity: 0, height: 0 },
                                visible: {
                                    opacity: 1,
                                    height: "auto",
                                    transition: {
                                        duration: 0.5,
                                        staggerChildren: 0.1
                                    }
                                }
                            }}
                            className={styles.gridWrapper}
                        >
                            <motion.div
                                className={styles.grid}
                                variants={{
                                    hidden: { opacity: 0 },
                                    visible: {
                                        opacity: 1,
                                        transition: {
                                            staggerChildren: 0.1,
                                            delayChildren: 0.2
                                        }
                                    }
                                }}
                            >
                                {screenshots.map((shot, index) => (
                                    <motion.div
                                        key={shot.id}
                                        variants={{
                                            hidden: { opacity: 0, y: 50 },
                                            visible: { opacity: 1, y: 0 }
                                        }}
                                        transition={{ duration: 0.5, ease: "easeOut" }}
                                        className={`${styles.cardWrapper} ${index % 5 === 0 ? styles.cardWide : ""}`}
                                    >
                                        <ScreenshotCard
                                            src={shot.src}
                                            alt={`${title} screenshot`}
                                            annotation={shot.annotation}
                                            onClick={() => setSelectedIndex(index)}
                                            layoutId={`image-${shot.id}`}
                                        />
                                    </motion.div>
                                ))}
                            </motion.div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {selectedShot && selectedIndex !== null && (
                    <>
                        {typeof document !== 'undefined' && createPortal(
                            <motion.div
                                className={styles.lightbox}
                                onClick={() => {
                                    playClick();
                                    setSelectedIndex(null);
                                }}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.25 }}
                            >
                                <div className={styles.backdrop}>
                                    <Image
                                        src={selectedShot.src}
                                        alt=""
                                        fill
                                        sizes="100vw"
                                        className={styles.backdropImage}
                                    />
                                </div>

                                <motion.button
                                    type="button"
                                    className={`${styles.lightboxCloseButton} cursor-hover`}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        playClick();
                                        setSelectedIndex(null);
                                    }}
                                    whileHover={{ scale: 1.08 }}
                                    whileTap={{ scale: 0.94 }}
                                    aria-label="Close image"
                                >
                                    <X size={22} />
                                </motion.button>

                                {screenshots.length > 1 && (
                                    <>
                                        <motion.button
                                            type="button"
                                            className={`${styles.navButton} ${styles.navPrevious} cursor-hover`}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                playClick();
                                                moveSelection(-1);
                                            }}
                                            onMouseEnter={playHover}
                                            whileHover={{ x: -4 }}
                                            whileTap={{ scale: 0.94 }}
                                            aria-label="Previous image"
                                        >
                                            <ChevronLeft size={30} />
                                        </motion.button>
                                        <motion.button
                                            type="button"
                                            className={`${styles.navButton} ${styles.navNext} cursor-hover`}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                playClick();
                                                moveSelection(1);
                                            }}
                                            onMouseEnter={playHover}
                                            whileHover={{ x: 4 }}
                                            whileTap={{ scale: 0.94 }}
                                            aria-label="Next image"
                                        >
                                            <ChevronRight size={30} />
                                        </motion.button>
                                    </>
                                )}

                                <div
                                    className={styles.lightboxContent}
                                    onClick={(event) => event.stopPropagation()}
                                >
                                    <div className={styles.lightboxHeader}>
                                        <span>{title}</span>
                                        <span>{String(selectedIndex + 1).padStart(2, "0")} / {String(screenshots.length).padStart(2, "0")}</span>
                                    </div>

                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={selectedShot.id}
                                            className={styles.expandedImageWrapper}
                                            initial={{ opacity: 0, y: 24, scale: 0.98 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -18, scale: 0.985 }}
                                            transition={{ duration: 0.45, ease: [0.19, 1, 0.22, 1] }}
                                        >
                                            <div className={styles.expandedImageFrame}>
                                                <Image
                                                    src={selectedShot.src}
                                                    alt={`${title} fullscreen view`}
                                                    fill
                                                    sizes="92vw"
                                                    className={styles.expandedImage}
                                                />
                                            </div>
                                            <motion.div
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 10 }}
                                                transition={{ delay: 0.2, duration: 0.3 }}
                                                className={styles.expandedAnnotation}
                                            >
                                                {selectedShot.annotation}
                                            </motion.div>
                                        </motion.div>
                                    </AnimatePresence>
                                </div>
                            </motion.div>,
                            document.body
                        )}
                    </>
                )}
            </AnimatePresence>
        </section>
    );
}
