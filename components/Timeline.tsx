
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TimelineSegment, TrackType, Asset, AssetType } from '../types';
import { LinkIcon, VideoCameraIcon, MusicalNoteIcon, SparklesIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/solid';

interface TimelineProps {
  currentTime: number; // Controlled by App
  segments: TimelineSegment[];
  onCheckContinuity: (segA: TimelineSegment, segB: TimelineSegment) => void;
  onDropAsset: (asset: Asset, trackId: TrackType, time: number) => void;
  onDeleteSegment: (id: string) => void;
  onUnlinkSegment: (id: string) => void;
  onUpdateSegment: (id: string, updates: Partial<TimelineSegment>) => void;
  onSeek: (time: number) => void;
}

const Timeline: React.FC<TimelineProps> = ({ 
    currentTime, 
    segments, 
    onCheckContinuity, 
    onDropAsset, 
    onDeleteSegment, 
    onUnlinkSegment, 
    onUpdateSegment,
    onSeek 
}) => {
  const [zoom, setZoom] = useState(30);
  
  // Refs for smooth dragging
  const dragItemRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Global drag state reference
  const dragDataRef = useRef<{
      id: string;
      startX: number;
      initialLeft: number;
      originalStartFrame: number;
  } | null>(null);

  // Ghost State (Visual feedback only during drag)
  const [isDraggingId, setIsDraggingId] = useState<string | null>(null);

  // Layout Constants
  const HEADER_WIDTH = 96; // w-24 (6rem) in pixels

  // --- SEGMENT DRAG HANDLERS ---
  const handleMouseDownSegment = (e: React.MouseEvent, seg: TimelineSegment) => {
      e.stopPropagation();
      e.preventDefault();
      if ((e.target as HTMLElement).closest('button')) return;
      
      const el = e.currentTarget as HTMLDivElement;
      dragItemRef.current = el;
      
      dragDataRef.current = {
          id: seg.id,
          startX: e.clientX,
          initialLeft: (seg.startFrame / 30) * zoom,
          originalStartFrame: seg.startFrame
      };

      setIsDraggingId(seg.id);
      document.body.style.cursor = 'grabbing';
      
      // CRITICAL: Attach listeners to WINDOW to handle fast movement/leaving the div
      window.addEventListener('mousemove', handleSegmentMouseMove);
      window.addEventListener('mouseup', handleSegmentMouseUp);
  };

  const handleSegmentMouseMove = useCallback((e: MouseEvent) => {
      if (dragDataRef.current && dragItemRef.current) {
          const deltaX = e.clientX - dragDataRef.current.startX;
          // Constrain visual drag so it doesn't go below 0 (negative time)
          const constrainedDeltaX = Math.max(deltaX, -dragDataRef.current.initialLeft);

          dragItemRef.current.style.transform = `translateX(${constrainedDeltaX}px)`;
          dragItemRef.current.style.zIndex = '100';
          dragItemRef.current.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.5)';
      }
  }, []);

  const handleSegmentMouseUp = useCallback((e: MouseEvent) => {
      if (dragDataRef.current && dragItemRef.current) {
          const deltaX = e.clientX - dragDataRef.current.startX;
          const deltaFrames = Math.round((deltaX / zoom) * 30);
          const newStartFrame = Math.max(0, dragDataRef.current.originalStartFrame + deltaFrames);
          
          // Reset DOM styles
          dragItemRef.current.style.transform = '';
          dragItemRef.current.style.zIndex = '';
          dragItemRef.current.style.boxShadow = '';
          
          onUpdateSegment(dragDataRef.current.id, { startFrame: newStartFrame });
      }

      // Cleanup
      dragItemRef.current = null;
      dragDataRef.current = null;
      setIsDraggingId(null);
      document.body.style.cursor = 'default';
      window.removeEventListener('mousemove', handleSegmentMouseMove);
      window.removeEventListener('mouseup', handleSegmentMouseUp);
  }, [zoom, onUpdateSegment, handleSegmentMouseMove]);


  // --- PLAYHEAD SCRUB HANDLERS ---
  const handleRulerMouseDown = (e: React.MouseEvent) => {
      e.preventDefault();
      
      const updateSeek = (clientX: number) => {
          if (!scrollContainerRef.current) return;
          const rect = scrollContainerRef.current.getBoundingClientRect();
          const relativeX = clientX - rect.left + scrollContainerRef.current.scrollLeft - HEADER_WIDTH;
          
          const t = Math.max(0, relativeX / zoom);
          onSeek(t);
      };

      updateSeek(e.clientX); // Initial jump
      document.body.style.cursor = 'ew-resize';

      const handleGlobalMouseMove = (moveEvent: MouseEvent) => {
          updateSeek(moveEvent.clientX);
      };

      const handleGlobalMouseUp = () => {
          document.body.style.cursor = 'default';
          window.removeEventListener('mousemove', handleGlobalMouseMove);
          window.removeEventListener('mouseup', handleGlobalMouseUp);
      };

      // CRITICAL: Window listeners for scrubbing too
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
  };


  // --- RENDER HELPERS ---
  const videoSegments = segments.filter(s => s.trackId === TrackType.VIDEO_MAIN).sort((a,b) => a.startFrame - b.startFrame);
  const audioSegments = segments.filter(s => s.trackId === TrackType.AUDIO).sort((a,b) => a.startFrame - b.startFrame);
  
  const totalDuration = Math.max(60, ...segments.map(s => s.endFrame / 30)) + 10;
  const totalWidth = (totalDuration * zoom) + HEADER_WIDTH;

  const getStyle = (start: number, dur: number) => ({
      left: `${(start / 30) * zoom}px`,
      width: `${Math.max(1, dur * zoom)}px`
  });

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  
  const handleDrop = (e: React.DragEvent, trackId: TrackType) => {
      e.preventDefault();
      const data = e.dataTransfer.getData("application/json");
      if (data && scrollContainerRef.current) {
          try {
              const rect = scrollContainerRef.current.getBoundingClientRect();
              const offsetX = e.clientX - rect.left + scrollContainerRef.current.scrollLeft - HEADER_WIDTH;
              const time = Math.max(0, offsetX / zoom);
              const asset = JSON.parse(data) as Asset;
              onDropAsset(asset, trackId, time);
          } catch(err) { console.error(err) }
      }
  };


  return (
    <div className="h-80 bg-white/5 border-t border-white/5 flex flex-col shrink-0 select-none backdrop-blur-md">
        {/* Toolbar */}
        <div className="px-4 py-2 border-b border-white/5 flex justify-between items-center bg-white/5 shadow-sm z-20 backdrop-blur-sm">
            <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]"></span>
                Timeline
            </h3>
            <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400">Zoom</span>
                    <input 
                        type="range" min="10" max="200" value={zoom} 
                        onChange={(e) => setZoom(parseInt(e.target.value))}
                        className="w-24 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:rounded-full" 
                    />
                 </div>
                 <div className="flex gap-4 text-[10px] font-mono text-emerald-400 border-l border-white/10 pl-4">
                    <span>{currentTime.toFixed(2)}s</span>
                 </div>
            </div>
        </div>
        
        {/* Timeline Canvas */}
        <div 
            ref={scrollContainerRef}
            className="flex-1 overflow-x-auto overflow-y-hidden relative bg-black/40 custom-scrollbar timeline-scroll-container"
        >
            <div style={{ width: `${totalWidth}px`, minWidth: '100%' }} className="relative h-full flex flex-col">
                
                {/* RULER ROW (Sticky Top) */}
                <div className="flex h-6 sticky top-0 z-30 bg-black/60 backdrop-blur-sm border-b border-white/5">
                    {/* Header Placeholder (Sticky Left) */}
                    <div className="w-24 shrink-0 border-r border-white/5 sticky left-0 z-50 bg-black/80 shadow-lg"></div>
                    
                    {/* Ruler Content */}
                    <div 
                        className="flex-1 relative cursor-ew-resize overflow-hidden"
                        onMouseDown={handleRulerMouseDown}
                    >
                         {Array.from({length: Math.ceil(totalDuration)}).map((_, i) => (
                            <div key={i} className="border-l border-white/10 pl-1 relative h-2 pointer-events-none absolute bottom-0" style={{ left: `${i * zoom}px` }}>
                                {i % 5 === 0 && <span className="absolute -top-3 left-1 text-[9px] text-gray-500 font-mono">{i}s</span>}
                            </div>
                        ))}
                    </div>
                </div>

                {/* TRACKS CONTAINER */}
                <div className="py-2 space-y-1 relative flex-1">
                    {/* VIDEO TRACK */}
                    <div className="h-24 flex group">
                        {/* Header (Sticky Left) */}
                        <div className="w-24 bg-white/5 border-r border-white/5 flex flex-col items-center justify-center sticky left-0 z-40 backdrop-blur-md border-b border-white/5 shrink-0 shadow-lg select-none">
                            <VideoCameraIcon className="w-4 h-4 text-gray-400 mb-1" />
                            <span className="text-[9px] font-bold text-gray-500">V1 MAIN</span>
                        </div>
                        {/* Lane Content */}
                        <div className="flex-1 bg-white/5 border-b border-white/5 relative my-1 mr-1 rounded-r-lg" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, TrackType.VIDEO_MAIN)}>
                            {videoSegments.map((seg, idx) => (
                                <React.Fragment key={seg.id}>
                                    <div 
                                        onMouseDown={(e) => handleMouseDownSegment(e, seg)}
                                        className={`absolute top-1 bottom-1 rounded-lg border overflow-hidden hover:z-10 cursor-grab active:cursor-grabbing flex flex-col group/item transition-all duration-75
                                            ${isDraggingId === seg.id ? 'z-50 shadow-2xl border-emerald-500 ring-2 ring-emerald-500/30 scale-105' : 
                                              seg.linkedSegmentId ? 'border-purple-500/50 bg-purple-900/20' : 'bg-gray-800/40 border-white/10 hover:border-emerald-500/50'}`}
                                        style={getStyle(seg.startFrame, seg.duration)}
                                    >
                                        <div className="h-1 bg-white/20 w-full z-20 relative"></div>
                                        
                                        {/* THUMBNAIL BACKGROUND */}
                                        <div className="absolute inset-0 opacity-60 group-hover:opacity-80 transition-opacity bg-black pointer-events-none">
                                            {/* Image Thumb */}
                                            {seg.assetType === AssetType.IMAGE && seg.assetUrl && (
                                                <img src={seg.assetUrl} className="w-full h-full object-cover" alt="" draggable={false} />
                                            )}
                                            {/* Video Thumb - Static Video Element */}
                                            {seg.assetType === AssetType.VIDEO && seg.assetUrl && (
                                                <video 
                                                    src={seg.assetUrl} 
                                                    className="w-full h-full object-cover pointer-events-none" 
                                                    muted 
                                                    preload="metadata"
                                                    onLoadedMetadata={(e) => e.currentTarget.currentTime = 0.5} 
                                                />
                                            )}
                                        </div>

                                        <div className="flex justify-between items-center px-2 relative z-20 mt-1 pointer-events-none">
                                            <span className="text-[10px] font-bold text-white shadow-black drop-shadow-md truncate">{seg.label}</span>
                                        </div>
                                        
                                        {/* Actions Layer */}
                                        <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity bg-black/60 rounded p-1 z-30 backdrop-blur-sm">
                                            {seg.linkedSegmentId && (
                                                <button onMouseDown={(e) => e.stopPropagation()} onClick={() => onUnlinkSegment(seg.id)} className="p-0.5 hover:text-red-400 pointer-events-auto" title="Unlink"><XMarkIcon className="w-3 h-3" /></button>
                                            )}
                                            <button onMouseDown={(e) => e.stopPropagation()} onClick={() => onDeleteSegment(seg.id)} className="p-0.5 hover:text-red-500 pointer-events-auto"><TrashIcon className="w-3 h-3" /></button>
                                        </div>
                                    </div>
                                    
                                    {/* Continuity Bridge */}
                                    {isDraggingId !== seg.id && idx < videoSegments.length - 1 && (
                                        <div 
                                            className="absolute top-1/2 -mt-3 z-20 cursor-pointer hover:scale-125 transition-transform"
                                            style={{ left: `${((seg.startFrame/30 + seg.duration) * zoom)}px` }}
                                            onClick={() => onCheckContinuity(seg, videoSegments[idx+1])}
                                        >
                                            <div className="w-5 h-5 -ml-2.5 rounded-full bg-black/50 border border-white/20 backdrop-blur-md shadow-lg flex items-center justify-center hover:bg-emerald-500 hover:border-emerald-400 transition-colors">
                                                <LinkIcon className="w-3 h-3 text-white" />
                                            </div>
                                        </div>
                                    )}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>

                    {/* OVERLAY TRACK */}
                    <div className="h-16 flex group">
                        <div className="w-24 bg-white/5 border-r border-white/5 flex flex-col items-center justify-center sticky left-0 z-40 backdrop-blur-md border-b border-white/5 shrink-0 shadow-lg">
                            <SparklesIcon className="w-4 h-4 text-purple-400 mb-1" />
                            <span className="text-[9px] font-bold text-gray-500">V2 FX</span>
                        </div>
                         <div className="flex-1 bg-white/5 border-b border-white/5 relative my-1 mr-1 rounded-r-lg border-dashed border-white/10" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, TrackType.OVERLAY)}>
                            {segments.filter(s => s.trackId === TrackType.OVERLAY).map(seg => (
                                <div key={seg.id}
                                    onMouseDown={(e) => handleMouseDownSegment(e, seg)}
                                    className={`absolute top-1 bottom-1 rounded-md bg-purple-500/20 border border-purple-500/30 cursor-grab overflow-hidden backdrop-blur-sm ${isDraggingId === seg.id ? 'z-50 shadow-lg ring-2 ring-purple-500' : 'hover:bg-purple-500/30'}`}
                                    style={getStyle(seg.startFrame, seg.duration)}
                                >
                                    {seg.assetUrl && <img src={seg.assetUrl} className="absolute inset-0 w-full h-full object-cover opacity-50 pointer-events-none" alt="" />}
                                    <span className="relative z-10 text-[9px] text-purple-100 px-1 truncate block mt-1 drop-shadow pointer-events-none">{seg.label}</span>
                                </div>
                            ))}
                         </div>
                    </div>

                    {/* AUDIO TRACK */}
                    <div className="h-16 flex group">
                        <div className="w-24 bg-white/5 border-r border-white/5 flex flex-col items-center justify-center sticky left-0 z-40 backdrop-blur-md border-b border-white/5 shrink-0 shadow-lg">
                             <MusicalNoteIcon className="w-4 h-4 text-blue-400 mb-1" />
                            <span className="text-[9px] font-bold text-gray-500">A1 AUDIO</span>
                        </div>
                        <div className="flex-1 bg-white/5 border-b border-white/5 relative my-1 mr-1 rounded-r-lg" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, TrackType.AUDIO)}>
                             {audioSegments.map((seg) => (
                                 <div 
                                    key={seg.id}
                                    onMouseDown={(e) => handleMouseDownSegment(e, seg)}
                                    className={`absolute top-1 bottom-1 rounded-md overflow-hidden flex flex-col justify-center cursor-grab group/item backdrop-blur-sm transition-all ${isDraggingId === seg.id ? 'z-50 shadow-lg border-blue-400 ring-2 ring-blue-500' : 'bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20'}`}
                                    style={getStyle(seg.startFrame, seg.duration)}
                                 >
                                    <div className="absolute inset-0 flex items-center opacity-40 pointer-events-none">
                                        <div className="w-full h-8 flex items-center gap-[1px] px-1">
                                             {Array.from({length: Math.ceil(seg.duration * 8)}).map((_, i) => (
                                                <div key={i} className="flex-1 bg-blue-400 rounded-full" style={{ height: `${20 + Math.random() * 60}%` }}></div>
                                             ))}
                                        </div>
                                    </div>
                                    <div className="flex justify-between px-2 relative z-10 pointer-events-none">
                                         <span className="text-[9px] text-blue-100 font-mono truncate">{seg.label}</span>
                                    </div>
                                    
                                    {/* Actions Layer */}
                                    <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity bg-black/60 rounded p-1 z-30">
                                        <button onMouseDown={(e) => e.stopPropagation()} onClick={() => onDeleteSegment(seg.id)} className="p-0.5 hover:text-red-500 pointer-events-auto"><TrashIcon className="w-3 h-3" /></button>
                                    </div>
                                 </div>
                             ))}
                        </div>
                    </div>
                </div>
                
                {/* PLAYHEAD (UNIFIED LINE & HEAD) */}
                <div 
                    className="absolute top-0 bottom-0 w-[1px] bg-red-500 z-40 pointer-events-none transition-transform duration-75 will-change-transform shadow-[0_0_10px_rgba(239,68,68,0.8)]"
                    style={{ left: `${HEADER_WIDTH + (currentTime * zoom)}px` }}
                >
                     {/* Triangle Head attached to the line (Positioned at ruler bottom seam) */}
                     <div className="absolute top-6 left-1/2 w-3 h-3 bg-red-500 -translate-x-1/2 -translate-y-1/2 rotate-45 shadow-sm"></div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default Timeline;
