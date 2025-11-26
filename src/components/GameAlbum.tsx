"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X } from "lucide-react";
import ScreenshotCard from "./ScreenshotCard";
import ScrollReveal from "./ScrollReveal";
import Image from "next/image";
import styles from "./GameAlbum.module.css";
import useSound from "@/hooks/useSound";
import GlitchText from "./GlitchText";

const MotionImage = motion(Image);

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
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const { playHover, playClick } = useSound();

    return (
        <section className={styles.section}>
            <ScrollReveal>
                <motion.div
                    className={`${styles.header} cursor-hover`}
                    onClick={() => {
                        playClick();
                        setIsOpen(!isOpen);
                    }}
                    onMouseEnter={playHover}
                >
                    {/* Content */}
                    <div className={styles.headerContent}>
                        <div className={styles.titleWrapper}>
                            <h2 className={styles.title}>
                                <GlitchText text={title} />
                            </h2>
                        </div>
                        <motion.div
                            animate={{ rotate: isOpen ? 45 : 0 }}
                            transition={{ duration: 0.3 }}
                            className={styles.iconWrapper}
                        >
                            <Plus size={32} />
                        </motion.div>
                    </div>
                </motion.div>
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
                                        className={styles.cardWrapper}
                                    >
                                        <ScreenshotCard
                                            src={shot.src}
                                            alt={`${title} screenshot`}
                                            annotation={shot.annotation}
                                            onClick={() => setSelectedId(shot.id)}
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
                {selectedId && (
                    <>
                        {typeof document !== 'undefined' && createPortal(
                            <div className={styles.lightbox} onClick={() => {
                                playClick();
                                setSelectedId(null);
                            }}>
                                <motion.div
                                    className={styles.backdrop}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                />
                                <div className={styles.lightboxContent}>
                                    {screenshots.map(shot => shot.id === selectedId && (
                                        <div key={shot.id} className={styles.expandedImageWrapper}>
                                            <MotionImage
                                                layoutId={`image-${shot.id}`}
                                                src={shot.src}
                                                alt="Fullscreen view"
                                                width={3440}
                                                height={1440}
                                                sizes="95vw"
                                                className={styles.expandedImage}
                                                transition={{
                                                    duration: 1.2,
                                                    ease: [0.19, 1, 0.22, 1]
                                                }}
                                            />
                                            <motion.div
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 10 }}
                                                transition={{ delay: 0.2, duration: 0.3 }}
                                                className={styles.expandedAnnotation}
                                            >
                                                {shot.annotation}
                                            </motion.div>
                                        </div>
                                    ))}
                                </div>
                            </div>,
                            document.body
                        )}
                    </>
                )}
            </AnimatePresence>
        </section>
    );
}
