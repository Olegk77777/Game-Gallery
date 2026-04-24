import React from "react";

export default function Vignette() {
    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                pointerEvents: "none",
                background: "radial-gradient(circle, transparent 64%, rgba(0,0,0,0.14) 100%)",
                mixBlendMode: "multiply",
            }}
        />
    );
}
