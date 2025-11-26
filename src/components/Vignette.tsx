import React from "react";

export default function Vignette() {
    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                pointerEvents: "none",
                background: "radial-gradient(circle, transparent 40%, rgba(0,0,0,0.6) 100%)",
                mixBlendMode: "multiply",
            }}
        />
    );
}
