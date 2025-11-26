"use client";

import { useState, useRef, useEffect } from "react";

interface GlitchTextProps {
    text: string;
    className?: string;
}

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#_/[ ]";

export default function GlitchText({ text, className }: GlitchTextProps) {
    const [displayText, setDisplayText] = useState(text);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const [isHovered, setIsHovered] = useState(false);

    const startGlitch = () => {
        setIsHovered(true);
        let iteration = 0;

        if (intervalRef.current) clearInterval(intervalRef.current);

        intervalRef.current = setInterval(() => {
            setDisplayText(prev =>
                text
                    .split("")
                    .map((char, index) => {
                        if (index < iteration) {
                            return text[index];
                        }
                        return CHARS[Math.floor(Math.random() * CHARS.length)];
                    })
                    .join("")
            );

            if (iteration >= text.length) {
                if (intervalRef.current) clearInterval(intervalRef.current);
            }

            iteration += 2; // Speed of resolution. Higher = faster.
        }, 20);
    };

    const stopGlitch = () => {
        setIsHovered(false);
        if (intervalRef.current) clearInterval(intervalRef.current);
        setDisplayText(text); // Reset immediately to avoid stuck characters
    };

    useEffect(() => {
        // Cleanup on unmount
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    return (
        <span
            className={`${className} ${isHovered ? "font-mono" : ""}`}
            onMouseEnter={startGlitch}
            onMouseLeave={stopGlitch}
            style={{ display: "inline-block", minWidth: "max-content" }} // Prevent layout shift
        >
            {displayText}
        </span>
    );
}
