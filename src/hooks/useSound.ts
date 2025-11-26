"use client";

import { useEffect, useRef } from "react";

type SoundType = "hover" | "click";

// Singleton state
let audioContext: AudioContext | null = null;
const buffers: Record<SoundType, AudioBuffer | null> = {
    hover: null,
    click: null,
};
const lastPlayTime: Record<SoundType, number> = {
    hover: 0,
    click: 0,
};

const initAudio = async () => {
    if (!audioContext) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

        // Global unlock for autoplay policy - attach immediately
        const unlockAudio = () => {
            if (audioContext && audioContext.state === "suspended") {
                audioContext.resume().then(() => {
                    ["click", "keydown", "touchstart", "pointerdown"].forEach((event) =>
                        document.removeEventListener(event, unlockAudio, true)
                    );
                });
            }
        };

        ["click", "keydown", "touchstart", "pointerdown"].forEach((event) =>
            document.addEventListener(event, unlockAudio, true)
        );
    }

    const loadBuffer = async (url: string, type: SoundType) => {
        if (buffers[type]) return; // Already loaded
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            buffers[type] = await audioContext!.decodeAudioData(arrayBuffer);
        } catch (error) {
            console.error(`Failed to load ${type} sound:`, error);
        }
    };

    await Promise.all([
        loadBuffer("/audio/hover.wav", "hover"),
        loadBuffer("/audio/click.wav", "click"),
    ]);
};

export default function useSound() {
    useEffect(() => {
        // Initialize on mount (idempotent)
        initAudio();

        return () => {
            // We don't close the context here because it's shared
        };
    }, []);

    const playSound = (type: SoundType) => {
        const now = Date.now();
        // Debounce: 50ms
        if (now - lastPlayTime[type] < 50) {
            return;
        }

        if (!audioContext) {
            initAudio();
            return;
        }

        // Resume context if suspended (browser policy)
        // Do this BEFORE checking buffers so the first click unlocks the engine
        if (audioContext.state === "suspended") {
            audioContext.resume();
        }

        if (!buffers[type]) {
            return;
        }

        const source = audioContext.createBufferSource();
        source.buffer = buffers[type];

        // Randomize pitch (0.9 - 1.1)
        const pitch = 0.9 + Math.random() * 0.2;
        source.playbackRate.value = pitch;

        // Volume control
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 0.15; // Very quiet

        source.connect(gainNode);
        gainNode.connect(audioContext.destination);

        source.start(0);
        lastPlayTime[type] = now;
    };

    return {
        playHover: () => playSound("hover"),
        playClick: () => playSound("click"),
    };
}
