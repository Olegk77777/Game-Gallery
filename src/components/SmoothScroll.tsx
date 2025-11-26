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
            // Removed backface-visibility as it can sometimes conflict with filters in Safari
            wrapper.style.willChange = 'transform, filter';
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
                // Increased sensitivity again (0.05 -> 0.1)
                const skew = Math.max(-3, Math.min(3, currentVelocity * 0.1));

                // RGB Split Effect
                const offset = currentVelocity * 0.15;

                // Apply styles
                wrapper.style.transform = `skewY(${skew}deg) translate3d(0,0,0)`;

                if (Math.abs(offset) > 0.1) {
                    const filterVal = `
                        drop-shadow(0px ${-offset}px 0 rgba(255,0,0,0.5)) 
                        drop-shadow(0px ${offset}px 0 rgba(0,0,255,0.5))
                    `;
                    wrapper.style.filter = filterVal;
                    // @ts-ignore
                    wrapper.style.webkitFilter = filterVal; // Explicit webkit prefix for Safari
                } else {
                    wrapper.style.filter = 'none';
                    // @ts-ignore
                    wrapper.style.webkitFilter = 'none';
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
                // @ts-ignore
                wrapper.style.webkitFilter = 'none';
                wrapper.style.willChange = 'auto';
            }
        };
    }, []);

    return null;
}
