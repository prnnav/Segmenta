import React, { useRef, useEffect, useState } from 'react';
import { useSpring, useTransform, MotionValue, useMotionValueEvent } from 'framer-motion';
import { preloadManager } from '../utils/PreloadManager';

interface FrameScrollerProps {
    urls: string[];
    scrollProgress: MotionValue<number>;
    className?: string;
    onLoad?: (loading: boolean, progress: number) => void;
}

const FrameScroller: React.FC<FrameScrollerProps> = ({
    urls,
    scrollProgress,
    className = "",
    onLoad
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [width, setWidth] = useState(window.innerWidth);
    const [height, setHeight] = useState(window.innerHeight);

    // --- PHYSICS ENGINE ---
    // Mass: 0.5 (Light/Responsive), Stiffness: 50 (Snappy but fluid), Damping: 20 (No bounce, smooth stop)
    // This creates the "Jesko Jets" weighted feel.
    // Use explicit typing to silence linter if vague
    const smoothIndex = useSpring(scrollProgress, {
        mass: 0.5,
        stiffness: 50,
        damping: 20,
        restDelta: 0.001
    });

    // Map 0-1 progress -> 0-(N-1) frame index
    const frameIndex = useTransform(smoothIndex, [0, 1], [0, urls.length - 1]);

    // --- RENDER LOOP ---
    const render = (index: number) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        // Ensure canvas size matches window
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;

        // Round to nearest integer frame
        const i = Math.min(urls.length - 1, Math.max(0, Math.round(index)));
        const url = urls[i];

        if (!url) return;

        const img = preloadManager.getImage(url);

        if (img) {
            // "Object-Fit: Cover" Logic
            const scale = Math.max(width / img.width, height / img.height);
            const x = (width / 2) - (img.width / 2) * scale;
            const y = (height / 2) - (img.height / 2) * scale;

            ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
        } else {
            // Draw placeholder
            ctx.fillStyle = '#121212';
            ctx.fillRect(0, 0, width, height);

            // Debug Text
            ctx.fillStyle = '#333';
            ctx.font = '12px monospace';
            ctx.fillText(`SEQ LOAD: ${i}/${urls.length}`, 20, 50);
        }
    };

    // --- SUBSCRIBE TO PHYSICS ---
    useMotionValueEvent(frameIndex, "change", (latest) => {
        if (typeof latest === 'number') {
            requestAnimationFrame(() => render(latest));
        }
    });

    // --- RESIZE HANDLER ---
    useEffect(() => {
        const handleResize = () => {
            setWidth(window.innerWidth);
            setHeight(window.innerHeight);
            // Force re-render of current frame
            const current = frameIndex.get();
            if (typeof current === 'number') render(current);
        };
        window.addEventListener('resize', handleResize);

        // Initial render
        const initial = frameIndex.get();
        if (typeof initial === 'number') render(initial);

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // --- PRELOAD LOGIC ---
    useEffect(() => {
        if (onLoad) onLoad(true, 0);

        preloadManager.load(urls, (p) => {
            if (onLoad) onLoad(p < 1, p);
            // Initial render as frames arrive
            if (p === 1) {
                const current = frameIndex.get();
                if (typeof current === 'number') render(current);
            }
        }).then(() => {
            // Done
        });
    }, [urls]);

    return (
        <canvas
            ref={canvasRef}
            className={`block w-full h-full object-cover ${className}`}
            width={width}
            height={height}
        />
    );
};

export default FrameScroller;
