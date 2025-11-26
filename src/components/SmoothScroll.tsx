"use client";

import { useEffect } from "react";
import Lenis from "lenis";

export default function SmoothScroll() {
    useEffect(() => {
        const lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            orientation: "vertical",
            gestureOrientation: "vertical",
            smoothWheel: true,
        });

        let currentVelocity = 0;
        const wrapper = document.querySelector('.layout-wrapper') as HTMLElement;

        // Force hardware acceleration for Safari
        if (wrapper) {
            wrapper.style.willChange = 'transform, filter';
            wrapper.style.backfaceVisibility = 'hidden';
            // @ts-ignore
            wrapper.style.webkitFontSmoothing = 'subpixel-antialiased';
        }

        function raf(time: number) {
            lenis.raf(time);

            // Lerp velocity for smooth transition
            const targetVelocity = lenis.velocity || 0;
            currentVelocity += (targetVelocity - currentVelocity) * 0.5;

            if (wrapper) {
                // Skew Effect
                // Increased sensitivity and range for better visibility in Chrome
                const skew = Math.max(-2, Math.min(2, currentVelocity * 0.05));

                // RGB Split Effect
                // Shift red up/left and blue down/right based on velocity
                const offset = currentVelocity * 0.15;

                // Apply styles
                // Add translate3d(0,0,0) to force hardware acceleration layer
                wrapper.style.transform = `skewY(${skew}deg) translate3d(0,0,0)`;

                // We use drop-shadow for the RGB split effect on everything (images + text)
                if (Math.abs(offset) > 0.1) {
                    wrapper.style.filter = `
                        drop-shadow(0px ${-offset}px 0 rgba(255,0,0,0.5)) 
                        drop-shadow(0px ${offset}px 0 rgba(0,0,255,0.5))
                    `;
                } else {
                    wrapper.style.filter = 'none';
                }
            }

            requestAnimationFrame(raf);
        }

        requestAnimationFrame(raf);

        return () => {
            lenis.destroy();
            // Reset styles on unmount
            if (wrapper) {
                wrapper.style.transform = 'none';
                wrapper.style.filter = 'none';
                wrapper.style.willChange = 'auto';
                wrapper.style.backfaceVisibility = 'visible';
            }
        };
    }, []);

    return null;
}
