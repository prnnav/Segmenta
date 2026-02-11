
import React, { useRef, useState, useEffect } from 'react';
import { Asset, AssetType, TimelineSegment, TrackType, PlaybackMode } from '../types';
import { CameraIcon, PlayIcon, PauseIcon, PaintBrushIcon, CursorArrowRaysIcon } from '@heroicons/react/24/solid';

interface PlayerPanelProps {
  mode: PlaybackMode;
  // Asset Mode Props
  activeAsset: Asset | null;
  // Timeline Mode Props
  timelineTime: number;
  isPlaying: boolean;
  segments: TimelineSegment[];
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  // Common Props
  onCaptureFrame: (frameData: string) => void;
  onUpdateMask: (maskBase64: string | null) => void;
  onDropAssetOnFrame: (asset: Asset, x: number, y: number) => void;
}

const PlayerPanel: React.FC<PlayerPanelProps> = ({ 
    mode, 
    activeAsset, 
    timelineTime,
    isPlaying,
    segments,
    onTogglePlay,
    onSeek,
    onCaptureFrame, 
    onUpdateMask, 
    onDropAssetOnFrame 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // Local state for Asset Mode
  const [assetModePlaying, setAssetModePlaying] = useState(false);
  const [assetModeTime, setAssetModeTime] = useState(0);
  const [assetDuration, setAssetDuration] = useState(0);

  const [isMaskMode, setIsMaskMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  // --- COMPOSITION STATE ---
  // We separate Main Video Track into "Video Segment" or "Image Segment"
  const [activeVideoSeg, setActiveVideoSeg] = useState<TimelineSegment | null>(null);
  const [activeMainImageSeg, setActiveMainImageSeg] = useState<TimelineSegment | null>(null);
  const [activeOverlaySeg, setActiveOverlaySeg] = useState<TimelineSegment | null>(null);
  const [activeAudioSeg, setActiveAudioSeg] = useState<TimelineSegment | null>(null);

  useEffect(() => {
      if (mode === 'TIMELINE') {
          const currentFrame = timelineTime * 30;
          
          // 1. Resolve MAIN TRACK (V1)
          const mainSeg = segments.find(s => s.trackId === TrackType.VIDEO_MAIN && currentFrame >= s.startFrame && currentFrame < s.endFrame) || null;
          
          if (mainSeg?.assetType === AssetType.VIDEO) {
              setActiveVideoSeg(mainSeg);
              setActiveMainImageSeg(null);
          } else if (mainSeg?.assetType === AssetType.IMAGE) {
              setActiveMainImageSeg(mainSeg);
              setActiveVideoSeg(null);
          } else {
              setActiveVideoSeg(null);
              setActiveMainImageSeg(null);
          }

          // 2. Resolve OVERLAY TRACK (V2)
          const ovl = segments.find(s => s.trackId === TrackType.OVERLAY && currentFrame >= s.startFrame && currentFrame < s.endFrame) || null;
          setActiveOverlaySeg(ovl);

          // 3. Resolve AUDIO TRACK (A1)
          const aud = segments.find(s => s.trackId === TrackType.AUDIO && currentFrame >= s.startFrame && currentFrame < s.endFrame) || null;
          setActiveAudioSeg(aud);

          // --- SYNC VIDEO ELEMENT ---
          if (videoRef.current && mainSeg?.assetType === AssetType.VIDEO && mainSeg.assetUrl) {
              const localTime = timelineTime - (mainSeg.startFrame / 30);
              
              if (!videoRef.current.src.includes(mainSeg.assetUrl)) {
                  videoRef.current.src = mainSeg.assetUrl;
                  videoRef.current.load();
              }
              
              // Drift correction
              if (Math.abs(videoRef.current.currentTime - localTime) > 0.3) {
                  videoRef.current.currentTime = localTime;
              }

              if (isPlaying) videoRef.current.play().catch(() => {});
              else videoRef.current.pause();
          } else if (videoRef.current) {
              // If not playing a video segment, pause the video element
              videoRef.current.pause();
              if (!activeVideoSeg) videoRef.current.src = ""; 
          }

          // --- SYNC AUDIO ELEMENT ---
          if (audioRef.current && aud && aud.assetUrl) {
              const localTime = timelineTime - (aud.startFrame / 30);
              if (!audioRef.current.src.includes(aud.assetUrl)) {
                  audioRef.current.src = aud.assetUrl;
                  audioRef.current.load();
              }
               if (Math.abs(audioRef.current.currentTime - localTime) > 0.3) {
                  audioRef.current.currentTime = localTime;
              }
              if (isPlaying) audioRef.current.play().catch(() => {});
              else audioRef.current.pause();
          } else if (audioRef.current) {
              audioRef.current.pause();
          }
      }
  }, [mode, timelineTime, segments, isPlaying]);


  // --- ASSET MODE LOGIC ---
  useEffect(() => {
    if (mode === 'ASSET') {
        setAssetModePlaying(false);
        setAssetModeTime(0);
        clearMask();
    }
  }, [activeAsset, mode]);

  const toggleAssetPlay = () => {
    if (isMaskMode) return;
    if (videoRef.current) {
        if (videoRef.current.paused) {
            videoRef.current.play();
            setAssetModePlaying(true);
        } else {
            videoRef.current.pause();
            setAssetModePlaying(false);
        }
    }
  }

  // --- DRAWING / MASKING ---
  const clearMask = () => {
      const canvas = maskCanvasRef.current;
      if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx?.clearRect(0, 0, canvas.width, canvas.height);
          onUpdateMask(null);
      }
  }

  const startDrawing = (e: React.MouseEvent) => {
      if (!isMaskMode || !maskCanvasRef.current) return;
      setIsDrawing(true);
      draw(e);
  };
  const stopDrawing = () => {
      setIsDrawing(false);
      const canvas = maskCanvasRef.current;
      if(canvas) {
          const data = canvas.toDataURL('image/png');
          onUpdateMask(data.split(',')[1]);
      }
  };
  const draw = (e: React.MouseEvent) => {
      if (!isDrawing || !maskCanvasRef.current) return;
      const canvas = maskCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      ctx.lineWidth = 20;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
  };

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/png');
            onCaptureFrame(dataUrl.split(',')[1]);
        }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      const data = e.dataTransfer.getData("application/json");
      if (data) {
          try {
              const droppedAsset = JSON.parse(data) as Asset;
              const rect = e.currentTarget.getBoundingClientRect();
              const x = (e.clientX - rect.left) / rect.width;
              const y = (e.clientY - rect.top) / rect.height;
              onDropAssetOnFrame(droppedAsset, x, y);
          } catch(err) { console.error(err); }
      }
  }

  const displayTime = mode === 'TIMELINE' ? timelineTime : assetModeTime;
  const displayDuration = mode === 'TIMELINE' ? 60 : assetDuration;
  const displayPlaying = mode === 'TIMELINE' ? isPlaying : assetModePlaying;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 relative overflow-hidden backdrop-blur-sm">
      
      {/* Player Frame */}
      <div 
        className="w-full h-full max-w-4xl max-h-[80vh] flex flex-col items-center justify-center bg-black/60 rounded-xl shadow-2xl border border-white/10 overflow-hidden relative group backdrop-blur-xl"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        
        {/* VIEWPORT */}
        <div className="relative w-full h-full flex items-center justify-center bg-transparent">
            
            {/* 1. ASSET MODE PREVIEW */}
            {mode === 'ASSET' && activeAsset?.type === AssetType.IMAGE && (
                <img src={activeAsset.url} alt="Preview" className="max-w-full max-h-[calc(100%-48px)] object-contain shadow-2xl" />
            )}

            {/* 2. TIMELINE MODE: MAIN IMAGE (Slide) */}
            {mode === 'TIMELINE' && activeMainImageSeg && (
                <img 
                    src={activeMainImageSeg.assetUrl} 
                    alt="Main Slide" 
                    className="absolute inset-0 w-full h-full object-contain"
                />
            )}

            {/* 3. VIDEO ELEMENT (Shared for Timeline Video & Asset Video) */}
            <video 
                ref={videoRef}
                src={mode === 'ASSET' && activeAsset?.type === AssetType.VIDEO ? activeAsset.url : undefined} 
                className={`max-w-full max-h-[calc(100%-48px)] relative z-10 shadow-2xl ${
                    (mode === 'ASSET' && activeAsset?.type !== AssetType.VIDEO) || 
                    (mode === 'TIMELINE' && !activeVideoSeg) 
                    ? 'hidden' : 'block'}`}
                onTimeUpdate={() => {
                    if (mode === 'ASSET' && videoRef.current) setAssetModeTime(videoRef.current.currentTime);
                }}
                onLoadedMetadata={() => {
                    if (mode === 'ASSET' && videoRef.current) setAssetDuration(videoRef.current.duration);
                }}
                onClick={mode === 'ASSET' ? toggleAssetPlay : onTogglePlay}
                muted={mode === 'TIMELINE'} 
            />
            
            <audio ref={audioRef} className="hidden" />

            {/* 5. OVERLAY LAYER */}
            {mode === 'TIMELINE' && activeOverlaySeg && activeOverlaySeg.assetUrl && (
                 <img 
                    src={activeOverlaySeg.assetUrl} 
                    className="absolute z-20 pointer-events-none drop-shadow-xl"
                    style={{
                        left: `${(activeOverlaySeg.metadata?.overlayX || 0.5) * 100}%`,
                        top: `${(activeOverlaySeg.metadata?.overlayY || 0.5) * 100}%`,
                        transform: 'translate(-50%, -50%)',
                        maxWidth: '30%'
                    }}
                    alt="Overlay"
                 />
            )}

            {/* 6. MASK LAYER */}
            {isMaskMode && (
                <canvas 
                    ref={maskCanvasRef}
                    width={800} height={450}
                    className="absolute inset-0 z-30 cursor-crosshair w-full h-full object-contain opacity-70"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                />
            )}

            {/* Placeholder if empty */}
            {mode === 'TIMELINE' && !activeVideoSeg && !activeMainImageSeg && (
                <div className="absolute inset-0 flex items-center justify-center text-white/10 font-mono text-sm z-0 pointer-events-none">
                    NO SIGNAL
                </div>
            )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        {/* CONTROLS */}
        <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-md p-3 flex items-center gap-4 border-t border-white/10 z-40 transition-transform transform translate-y-full group-hover:translate-y-0 duration-300">
            <button 
                onClick={mode === 'ASSET' ? toggleAssetPlay : onTogglePlay} 
                className="text-white hover:text-emerald-400 transition-colors"
            >
                {displayPlaying ? <PauseIcon className="w-6 h-6"/> : <PlayIcon className="w-6 h-6"/>}
            </button>
            
            <input 
                type="range" 
                min="0" 
                max={displayDuration || 100} 
                value={displayTime} 
                onChange={(e) => {
                    const t = parseFloat(e.target.value);
                    if (mode === 'ASSET') {
                        if (videoRef.current) videoRef.current.currentTime = t;
                        setAssetModeTime(t);
                    } else {
                        onSeek(t);
                    }
                }}
                step="0.01"
                className="flex-1 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(16,185,129,0.5)]"
            />
            
            <div className="text-[10px] font-mono text-gray-400 w-12 text-right">
                {displayTime.toFixed(1)}s
            </div>

            <div className="h-6 w-[1px] bg-white/10 mx-2"></div>
            
            <button 
                onClick={() => setIsMaskMode(!isMaskMode)} 
                className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-bold border transition-all ${isMaskMode ? 'bg-emerald-500 text-black border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'}`}
            >
                {isMaskMode ? <CursorArrowRaysIcon className="w-3 h-3"/> : <PaintBrushIcon className="w-3 h-3"/>}
                <span>Nano</span>
            </button>

            <button 
                onClick={handleCapture}
                className="flex items-center gap-1 bg-white/5 hover:bg-white/10 text-white text-xs px-2 py-1 rounded border border-white/10 shadow-sm transition-colors"
            >
                <CameraIcon className="w-4 h-4 text-purple-400" />
            </button>
        </div>
      </div>
      
      {/* HUD Info */}
      <div className="absolute top-4 left-4 flex gap-2 z-50 pointer-events-none">
          <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg backdrop-blur-md ${mode === 'TIMELINE' ? 'bg-red-500/80 text-white' : 'bg-black/40 text-gray-400 border border-white/5'}`}>
              Program
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg backdrop-blur-md ${mode === 'ASSET' ? 'bg-emerald-500/80 text-black' : 'bg-black/40 text-gray-400 border border-white/5'}`}>
              Source: {activeAsset ? activeAsset.name : "None"}
          </div>
      </div>
    </div>
  );
};

export default PlayerPanel;
