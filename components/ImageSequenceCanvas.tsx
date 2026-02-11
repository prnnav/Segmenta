
import React, { useRef, useEffect, useState } from 'react';
import { useMotionValueEvent, MotionValue } from 'framer-motion';

interface ImageSequenceCanvasProps {
    urls: string[];
    progress: MotionValue<number>;
    width?: number;
    height?: number;
    onLoadProgress?: (progress: number) => void;
    className?: string;
}

const ImageSequenceCanvas: React.FC<ImageSequenceCanvasProps> = ({
    urls,
    progress,
    width = window.innerWidth,
    height = window.innerHeight,
    onLoadProgress,
    className = ""
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [images, setImages] = useState<(HTMLImageElement | null)[]>([]);
    const [loadedCount, setLoadedCount] = useState(0);

    // 1. Preload Images Logic
    useEffect(() => {
        let mounted = true;
        const loadedImages: (HTMLImageElement | null)[] = new Array(urls.length).fill(null);
        let count = 0;

        const loadImage = (index: number, priority: 'high' | 'low') => {
            if (!mounted) return;

            const img = new Image();
            img.src = urls[index];
            img.onload = () => {
                if (!mounted) return;
                loadedImages[index] = img;
                count++;
                setLoadedCount(count);
                if (onLoadProgress) onLoadProgress(count / urls.length);
            };
            img.onerror = () => {
                console.error(`Failed to load image: ${urls[index]}`);
            };
        };

        // LOD Strategy: Load every 3rd frame first (Low Res / Quick Scrub)
        for (let i = 0; i < urls.length; i += 3) {
            loadImage(i, 'high');
        }

        // Fill the gaps 
        setTimeout(() => {
            for (let i = 0; i < urls.length; i++) {
                if (i % 3 !== 0) loadImage(i, 'low');
            }
        }, 1000); // Start filling after 1s to prioritize first render

        setImages(loadedImages);

        return () => { mounted = false; };
    }, [urls]);

    // 2. Render Logic
    const renderFrame = (index: number) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        // Handle resize explicitly if needed, but props should trigger re-render
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;

        // Clear handled inside image draw block for optimization
        // ctx.fillStyle = '#121212'; 
        // ctx.fillRect(0, 0, width, height);

        const img = images[index];
        if (img) {
            // Object-Fit: Cover Logic
            const scale = Math.max(width / img.width, height / img.height);
            const x = (width / 2) - (img.width / 2) * scale;
            const y = (height / 2) - (img.height / 2) * scale;

            // Only clear if image has transparency or doesn't cover (which it should)
            // But to be safe, we can skip clearRect if we draw over everything
            ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
        } else {
            // Placeholder Fallback if frame trying to render isn't loaded yet
            ctx.fillStyle = '#121212';
            ctx.fillRect(0, 0, width, height); // Clear background only if no image

            ctx.font = '20px monospace';
            ctx.fillStyle = '#333';
            ctx.fillText(`Loading Frame ${index}...`, width / 2 - 50, height / 2);
        }
    };

    // 3. React to MotionValue
    useMotionValueEvent(progress, "change", (latest) => {
        // Use Math.round instead of floor for smoother index transitions at boundaries?
        // Actually floor is standard, but let's clamp strictly
        const frameIndex = Math.min(
            urls.length - 1,
            Math.max(0, Math.floor(latest * (urls.length - 1)))
        );

        // Use requestAnimationFrame for optimized paint cycle
        // But also check if index changed to avoid redundant draws?
        // The browser handles redundant draws well, but logic change is cheap
        requestAnimationFrame(() => renderFrame(frameIndex));
    });

    // Initial Paint
    useEffect(() => {
        renderFrame(0);
    }, [width, height, images[0]]); // Re-render when first image loads or resize

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className={`block w-full h-full object-cover ${className}`}
        />
    );
};

export default ImageSequenceCanvas;
