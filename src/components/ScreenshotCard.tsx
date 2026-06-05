import { motion } from "framer-motion";
import Image from "next/image";
import styles from "./ScreenshotCard.module.css";
import useSound from "@/hooks/useSound";

const MotionImage = motion(Image);

interface ScreenshotCardProps {
    src: string;
    previewSrc?: string;
    alt: string;
    annotation: string;
    onClick?: () => void;
    layoutId?: string;
}

export default function ScreenshotCard({ src, previewSrc, alt, annotation, onClick, layoutId }: ScreenshotCardProps) {
    const { playHover, playClick } = useSound();
    const imageSrc = previewSrc ?? src;

    return (
        <motion.button
            type="button"
            className={`${styles.container} cursor-hover`}
            onClick={() => {
                onClick?.();
                playClick();
            }}
            onMouseEnter={playHover}
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.3 }}
            aria-label={`Open screenshot: ${annotation}`}
        >
            {/* 21:9 Aspect Ratio Container - Shared Element for Lightbox */}
            <div className={styles.imageWrapper}>
                <MotionImage
                    layoutId={layoutId}
                    src={imageSrc}
                    alt={alt}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className={styles.image}
                    loading="lazy"
                    transition={{
                        duration: 0.8,
                        ease: [0.4, 0, 0.2, 1]
                    }}
                />

                {/* Overlay Gradient */}
                <div className={styles.overlay} />
            </div>

            {/* Annotation */}
            <div className={styles.annotation}>
                <p className={styles.label}>
                    ANNOTATION
                </p>
                <p className={styles.text}>
                    {annotation}
                </p>
            </div>
        </motion.button>
    );
}
