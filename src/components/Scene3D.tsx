"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const vertexShader = `
attribute float aSeed;
uniform float uTime;
uniform vec2 uPointer;
varying float vAlpha;

void main() {
    vec3 p = position;
    float wave = sin(uTime * 0.42 + aSeed * 6.283 + p.x * 0.035) * 1.15;

    p.x += cos(uTime * 0.22 + aSeed * 10.0) * 0.82 + uPointer.x * 2.4;
    p.y += wave + uPointer.y * 1.8;
    p.z += sin(uTime * 0.18 + aSeed * 12.0) * 1.2;

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = (2.2 + sin(aSeed * 20.0 + uTime) * 1.25) * (42.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;

    vAlpha = smoothstep(-44.0, 18.0, p.z) * (0.34 + aSeed * 0.26);
}
`;

const fragmentShader = `
varying float vAlpha;

void main() {
    float distanceToCenter = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.5, 0.05, distanceToCenter);
    vec3 color = mix(vec3(0.42, 0.48, 0.58), vec3(0.96, 0.92, 0.82), core);

    gl_FragColor = vec4(color, core * vAlpha);
}
`;

function seededValue(index: number, salt: number) {
    const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
    return value - Math.floor(value);
}

function LuminanceField({ count = 420 }) {
    const points = useRef<THREE.Points>(null);
    const material = useRef<THREE.ShaderMaterial>(null);
    const uniforms = useMemo(
        () => ({
            uTime: { value: 0 },
            uPointer: { value: new THREE.Vector2(0, 0) },
        }),
        []
    );

    const geometry = useMemo(() => {
        const positions = new Float32Array(count * 3);
        const seeds = new Float32Array(count);

        for (let i = 0; i < count; i += 1) {
            const radius = 18 + seededValue(i, 0.12) * 42;
            const angle = seededValue(i, 0.34) * Math.PI * 2;
            const layer = (seededValue(i, 0.56) - 0.5) * 42;

            positions[i * 3] = Math.cos(angle) * radius + (seededValue(i, 0.78) - 0.5) * 18;
            positions[i * 3 + 1] = Math.sin(angle) * radius * 0.46 + (seededValue(i, 0.91) - 0.5) * 16;
            positions[i * 3 + 2] = layer;
            seeds[i] = seededValue(i, 1.13);
        }

        return { positions, seeds };
    }, [count]);

    useFrame(({ clock, pointer }) => {
        if (material.current) {
            material.current.uniforms.uTime.value = clock.elapsedTime;
            material.current.uniforms.uPointer.value.lerp(pointer, 0.035);
        }

        if (points.current) {
            points.current.rotation.y = Math.sin(clock.elapsedTime * 0.08) * 0.08;
            points.current.rotation.x = Math.cos(clock.elapsedTime * 0.06) * 0.045;
        }
    });

    return (
        <points ref={points}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[geometry.positions, 3]} />
                <bufferAttribute attach="attributes-aSeed" args={[geometry.seeds, 1]} />
            </bufferGeometry>
            <shaderMaterial
                ref={material}
                uniforms={uniforms}
                vertexShader={vertexShader}
                fragmentShader={fragmentShader}
                transparent
                depthWrite={false}
                blending={THREE.AdditiveBlending}
            />
        </points>
    );
}

export default function Scene3D() {
    return (
        <div
            aria-hidden="true"
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                zIndex: -1,
                pointerEvents: "none",
            }}
        >
            <Canvas
                camera={{ position: [0, 0, 32], fov: 72 }}
                dpr={[1, 1.15]}
                gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}
            >
                <color attach="background" args={["#050505"]} />
                <LuminanceField />
                <fog attach="fog" args={["#050505", 24, 62]} />
            </Canvas>
        </div>
    );
}
