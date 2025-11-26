"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface ScrollRevealProps {
    children: ReactNode;
    className?: string;
    delay?: number;
    variant?: "fade-up" | "slide-left" | "slide-right";
}

export default function ScrollReveal({
    children,
    className = "",
    delay = 0,
    variant = "fade-up"
}: ScrollRevealProps) {

    const getVariants = () => {
        switch (variant) {
            case "slide-left":
                return {
                    hidden: { opacity: 0, x: -50 },
                    visible: { opacity: 1, x: 0 }
                };
            case "slide-right":
                return {
                    hidden: { opacity: 0, x: 50 },
                    visible: { opacity: 1, x: 0 }
                };
            case "fade-up":
            default:
                return {
                    hidden: { opacity: 0, y: 50, scale: 0.95 },
                    visible: { opacity: 1, y: 0, scale: 1 }
                };
        }
    };

    return (
        <motion.div
            className={className}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1, margin: "0px 0px -50px 0px" }}
            variants={getVariants()}
            transition={{
                duration: 0.8,
                delay: delay,
                ease: [0.22, 1, 0.36, 1]
            }}
        >
            {children}
        </motion.div>
    );
}
