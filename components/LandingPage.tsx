import React, { useRef, useState } from 'react';
import { useScroll, useTransform, motion, useSpring, useMotionValueEvent } from 'framer-motion';
import FrameScroller from './FrameScroller';
import NoiseOverlay from './NoiseOverlay';
import PhaseIndicator from './PhaseIndicator';
import { ArrowRightIcon } from '@heroicons/react/24/outline';

// --- CONFIG ---
const FRAME_COUNT_ONE = 120;
const FRAME_COUNT_TWO = 120;

const FRAMES_ONE = Array.from({ length: FRAME_COUNT_ONE }).map((_, i) =>
    `/frames/framesone/ezgif-frame-${(i + 1).toString().padStart(3, '0')}.jpg`
);

const FRAMES_TWO = Array.from({ length: FRAME_COUNT_TWO }).map((_, i) =>
    `/frames/framestwo/ezgif-frame-${(i + 1).toString().padStart(3, '0')}.jpg`
);

interface LandingPageProps {
    onEnterStudio: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onEnterStudio }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll(); // Tracks window scroll

    // --- PHASE MAPPING ---
    // 1. Sequence 1 (0% -> 45%)
    const seq1Progress = useTransform(scrollYProgress, [0, 0.45], [0, 1]);
    const seq1Opacity = useTransform(scrollYProgress, [0.45, 0.5], [1, 0]);

    // 2. Sequence 2 (55% -> 90%)
    const seq2Progress = useTransform(scrollYProgress, [0.55, 0.9], [0, 1]);
    const seq2Opacity = useTransform(scrollYProgress, [0.45, 0.55], [0, 1]);

    // Text & UI Logic
    const text1Opacity = useTransform(scrollYProgress, [0, 0.2, 0.4], [1, 1, 0]);
    const text1Y = useTransform(scrollYProgress, [0, 0.4], [0, -50]);

    // Phase 3: Reveal (90% - 100%) - CTA Card
    const cardOpacity = useTransform(scrollYProgress, [0.9, 0.98], [0, 1]);
    const cardScale = useTransform(scrollYProgress, [0.9, 0.98], [0.9, 1]);
    const cardY = useTransform(scrollYProgress, [0.9, 0.98], [50, 0]);

    // Phase 1 Hook text opacity
    const hookOpacity = useTransform(scrollYProgress, [0, 0.1], [1, 0]);

    return (
        <div ref={scrollRef} className="relative w-full h-[8000px] bg-[#121212]">
            <NoiseOverlay />
            <PhaseIndicator progress={scrollYProgress} />

            {/* STICKY CANVAS CONTAINER */}
            <div className="sticky top-0 left-0 w-full h-screen overflow-hidden">
                {/* SEQUENCE 1: Magic Hat (0% - 50%) */}
                <motion.div style={{ opacity: seq1Opacity }} className="absolute inset-0">
                    <FrameScroller
                        urls={FRAMES_ONE}
                        scrollProgress={seq1Progress}
                    />
                </motion.div>

                {/* SEQUENCE 2: Portal (50% - 100%) */}
                <motion.div style={{ opacity: seq2Opacity }} className="absolute inset-0">
                    <FrameScroller
                        urls={FRAMES_TWO}
                        scrollProgress={seq2Progress}
                    />
                </motion.div>

                {/* Vignette */}
                <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)]"></div>

                {/* PHASE 1: Hook Text */}
                <motion.div
                    style={{ opacity: text1Opacity, y: text1Y }}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
                >
                    <div className="text-center">
                        <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/20 tracking-tighter mb-4">
                            SEGMENTA
                        </h1>
                        <p className="text-xl md:text-2xl text-emerald-500/80 font-mono tracking-widest uppercase">
                            The Magic Hat
                        </p>
                    </div>
                </motion.div>

                {/* PHASE 3: CTA Card */}
                <motion.div
                    style={{ opacity: cardOpacity, scale: cardScale, y: cardY }}
                    className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
                >
                    {/* Glass Card "Cupertino Style" */}
                    <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-12 rounded-3xl shadow-2xl max-w-md w-full text-center pointer-events-auto group hover:scale-[1.02] transition-transform duration-500">
                        <div className="w-16 h-16 bg-gradient-to-tr from-emerald-500 to-cyan-400 rounded-2xl mx-auto mb-6 shadow-[0_0_30px_rgba(16,185,129,0.4)] flex items-center justify-center text-black font-bold text-2xl">
                            S
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-2">Segmenta Studio</h2>
                        <p className="text-gray-400 mb-8 font-light leading-relaxed">
                            Your assets are ready. Enter the director's suite.
                        </p>

                        <button
                            onClick={onEnterStudio}
                            className="w-full py-4 bg-[#00dc82] hover:bg-[#00c072] text-black font-bold text-lg rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-emerald-500/20 active:scale-95"
                        >
                            Enter Studio
                            <ArrowRightIcon className="w-5 h-5 stroke-2" />
                        </button>
                    </div>
                </motion.div>
            </div>

            {/* Scroll Spacer Guide */}
            <div className="absolute top-[40%] right-10 text-white/10 font-mono rotate-90 origin-right">
                SCROLL TO REVEAL
            </div>
        </div>
    );
};

export default LandingPage;
