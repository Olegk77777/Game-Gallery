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

        function raf(time: number) {
            lenis.raf(time);

            // Lerp velocity for smooth transition
            // lenis.velocity can be 0 when stopped, so we lerp towards it
            const targetVelocity = lenis.velocity || 0;
            currentVelocity += (targetVelocity - currentVelocity) * 0.5;

            if (wrapper) {
                // Skew Effect
                // Clamp skew between -1 and 1 degrees
                const skew = Math.max(-1, Math.min(1, currentVelocity * 0.025));

                // RGB Split Effect
                // Shift red up/left and blue down/right based on velocity
                // Max shift around 5px
                const offset = currentVelocity * 0.15;

                // Apply styles
                // We use transform for skew
                wrapper.style.transform = `skewY(${skew}deg)`;

                // We use drop-shadow for the RGB split effect on everything (images + text)
                // Note: drop-shadow can be expensive, but it gives the best "whole site" effect
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
            }
        };
    }, []);

    return null;
}
