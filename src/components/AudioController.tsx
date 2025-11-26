"use client";

import { useState, useRef, useEffect } from "react";
import { Volume2, VolumeX } from "lucide-react";
import styles from "./AudioController.module.css";
import useSound from "@/hooks/useSound";

import { useIntro } from "./IntroContext";

export default function AudioController() {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const TARGET_VOLUME = 0.3;
    const FADE_DURATION = 1500; // ms
    const FADE_STEPS = 20;
    const { playHover, playClick } = useSound();
    const { isIntroComplete } = useIntro();

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = 0;
        }
    }, []);

    // Auto-play when intro completes
    // Auto-play removed to respect "Sound Off" default
    // useEffect(() => {
    //     if (isIntroComplete && audioRef.current) {
    //         ...
    //     }
    // }, [isIntroComplete]);

    const toggleAudio = () => {
        if (!audioRef.current) return;

        if (fadeIntervalRef.current) {
            clearInterval(fadeIntervalRef.current);
        }

        const audio = audioRef.current;
        const stepTime = FADE_DURATION / FADE_STEPS;
        const volumeStep = TARGET_VOLUME / FADE_STEPS;

        if (!isPlaying) {
            // Start playing (Fade In)
            audio.play().catch(e => console.error("Audio play failed:", e));
            setIsPlaying(true);

            fadeIntervalRef.current = setInterval(() => {
                if (audio.volume < TARGET_VOLUME) {
                    audio.volume = Math.min(audio.volume + volumeStep, TARGET_VOLUME);
                } else {
                    if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
                }
            }, stepTime);
        } else {
            // Stop playing (Fade Out)
            setIsPlaying(false); // Update UI immediately

            fadeIntervalRef.current = setInterval(() => {
                if (audio.volume > 0) {
                    audio.volume = Math.max(audio.volume - volumeStep, 0);
                } else {
                    audio.pause();
                    if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
                }
            }, stepTime);
        }
    };

    return (
        <div className={styles.container}>
            <audio ref={audioRef} src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/audio/ambient.wav`} loop />

            <button
                className={styles.button}
                onClick={toggleAudio}
                aria-label={isPlaying ? "Mute background music" : "Play background music"}
            >
                {isPlaying ? (
                    <>
                        <span>Sound On</span>
                        <div className={styles.equalizer}>
                            <div className={styles.bar} />
                            <div className={styles.bar} />
                            <div className={styles.bar} />
                        </div>
                    </>
                ) : (
                    <>
                        <span>Sound Off</span>
                        <VolumeX size={16} />
                    </>
                )}
            </button>
        </div>
    );
}
