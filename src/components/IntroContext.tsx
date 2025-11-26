"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface IntroContextType {
    isIntroComplete: boolean;
    setIntroComplete: (complete: boolean) => void;
}

const IntroContext = createContext<IntroContextType | undefined>(undefined);

export function IntroProvider({ children }: { children: ReactNode }) {
    const [isIntroComplete, setIsIntroComplete] = useState(false);

    return (
        <IntroContext.Provider value={{ isIntroComplete, setIntroComplete: setIsIntroComplete }}>
            {children}
        </IntroContext.Provider>
    );
}

export function useIntro() {
    const context = useContext(IntroContext);
    if (context === undefined) {
        throw new Error("useIntro must be used within an IntroProvider");
    }
    return context;
}
