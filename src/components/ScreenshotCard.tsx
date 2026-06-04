import { motion } from "framer-motion";
import Image from "next/image";
import styles from "./ScreenshotCard.module.css";
import useSound from "@/hooks/useSound";

const MotionImage = motion(Image);

interface ScreenshotCardProps {
    src: string;
    alt: string;
    annotation: string;
    onClick?: () => void;
    layoutId?: string;
}

export default function ScreenshotCard({ src, alt, annotation, onClick, layoutId }: ScreenshotCardProps) {
    const { playHover, playClick } = useSound();

    return (
        <motion.div
            className={`${styles.container} cursor-hover`}
            onClick={() => {
                playClick();
                onClick?.();
            }}
            onMouseEnter={playHover}
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.3 }}
        >
            {/* 21:9 Aspect Ratio Container - Shared Element for Lightbox */}
            <div className={styles.imageWrapper}>
                <MotionImage
                    layoutId={layoutId}
                    src={src}
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
        </motion.div>
    );
}
