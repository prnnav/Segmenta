import React from 'react';
import { motion, useTransform, MotionValue } from 'framer-motion';

interface PhaseIndicatorProps {
    progress: MotionValue<number>;
}

const PhaseIndicator: React.FC<PhaseIndicatorProps> = ({ progress }) => {
    // Map scroll progress to active pill index
    // 0-0.45: Hat, 0.45-0.55: Transition, 0.55-0.9: Portal, 0.9+: Studio

    // We can just use simple transforms for opacity/scale of dots
    const hatOpacity = useTransform(progress, [0, 0.5], [1, 0.5]);
    const portalOpacity = useTransform(progress, [0.4, 0.5, 0.6], [0.5, 1, 0.5]);
    const studioOpacity = useTransform(progress, [0.8, 0.9], [0.5, 1]);

    return (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
            <div className="bg-black/50 backdrop-blur-md border border-white/10 rounded-full px-6 py-3 flex items-center gap-4 shadow-2xl">
                <div className="flex flex-col items-center gap-1">
                    <motion.div style={{ opacity: hatOpacity }} className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[10px] text-gray-500 font-mono uppercase">Hat</span>
                </div>
                <div className="w-px h-4 bg-white/10" />
                <div className="flex flex-col items-center gap-1">
                    <motion.div style={{ opacity: portalOpacity }} className="w-2 h-2 rounded-full bg-purple-500" />
                    <span className="text-[10px] text-gray-500 font-mono uppercase">Portal</span>
                </div>
                <div className="w-px h-4 bg-white/10" />
                <div className="flex flex-col items-center gap-1">
                    <motion.div style={{ opacity: studioOpacity }} className="w-2 h-2 rounded-full bg-white" />
                    <span className="text-[10px] text-gray-500 font-mono uppercase">Studio</span>
                </div>
            </div>
        </div>
    );
};

export default PhaseIndicator;
