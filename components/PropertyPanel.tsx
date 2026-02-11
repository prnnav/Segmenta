
import React, { useState, useEffect } from 'react';
import { Asset, AssetType } from '../types';
import { generateImage, editImage, analyzeVideo, generateVideo, enhancePrompt, refinePromptWithMultimodalContext } from '../services/geminiService';
import { SparklesIcon, PaintBrushIcon, PhotoIcon, FilmIcon, PlayCircleIcon, MagnifyingGlassIcon, ViewfinderCircleIcon, DocumentDuplicateIcon, XMarkIcon, ArrowRightIcon } from '@heroicons/react/24/solid';

interface PropertyPanelProps {
  activeAsset: Asset | null;
  onAddAsset: (asset: Asset) => void;
  setGlobalLoading: (loading: boolean, msg?: string) => void;
}

const PropertyPanel: React.FC<PropertyPanelProps> = ({ activeAsset, onAddAsset, setGlobalLoading }) => {
  const [prompt, setPrompt] = useState('');
  const [suggestion, setSuggestion] = useState(''); // Ghost text suggestion
  const [mode, setMode] = useState<'generate' | 'edit' | 'video' | 'motion' | 'analyze'>('generate');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  
  // Multimodal Inputs
  const [contextAssets, setContextAssets] = useState<Asset[]>([]);
  
  // Motion Specific Inputs (Multi-Frame)
  const [startFrame, setStartFrame] = useState<Asset | null>(null);
  const [endFrame, setEndFrame] = useState<Asset | null>(null);

  // Auto-switch mode based on context
  useEffect(() => {
     if (activeAsset?.type === AssetType.VIDEO) {
         setMode('video');
     } else if (activeAsset?.type === AssetType.IMAGE) {
         setMode('edit');
     } else {
         setMode('generate');
     }
  }, [activeAsset]);

  // --- Prompt Enhancer Logic ---
  useEffect(() => {
      const timer = setTimeout(async () => {
          if (prompt.length > 5 && (mode === 'generate' || mode === 'video')) {
              const enhanced = await enhancePrompt(prompt);
              setSuggestion(enhanced);
          } else {
              setSuggestion('');
          }
      }, 500); // Debounce
      return () => clearTimeout(timer);
  }, [prompt, mode]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Tab' && suggestion) {
          e.preventDefault();
          setPrompt(prev => prev + suggestion);
          setSuggestion('');
      }
  };

  // --- Multimodal Drop Handler ---
  const handleDropContext = async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      const data = e.dataTransfer.getData("application/json");
      if (data) {
          try {
              const asset = JSON.parse(data) as Asset;
              if (!contextAssets.find(a => a.id === asset.id)) {
                  setContextAssets(prev => [...prev, asset]);
              }
          } catch(err) { console.error(err); }
      }
  }

  const handleDropFrame = (e: React.DragEvent, type: 'start' | 'end') => {
      e.preventDefault();
      const data = e.dataTransfer.getData("application/json");
      if (data) {
          try {
              const asset = JSON.parse(data) as Asset;
              if (asset.type !== AssetType.IMAGE) return;
              if (type === 'start') setStartFrame(asset);
              if (type === 'end') setEndFrame(asset);
          } catch(err) { console.error(err); }
      }
  };

  const handleAction = async () => {
    console.log(`[PropertyPanel] Action triggered. Mode: ${mode}`);
    try {
      
      // --- STEP 1: Multimodal Refinement ---
      let effectivePrompt = prompt;
      if (contextAssets.length > 0 && (mode === 'generate' || mode === 'video')) {
           setGlobalLoading(true, "Gemini 3 Pro: Analyzing References...");
           effectivePrompt = await refinePromptWithMultimodalContext(prompt, contextAssets);
      }

      if (mode === 'generate') {
        if (!effectivePrompt) return;
        setGlobalLoading(true, `Generating Image with Gemini 2.5 Flash...`);
        const base64 = await generateImage(effectivePrompt);
        const res = await fetch(base64);
        const blob = await res.blob();
        
        onAddAsset({
          id: crypto.randomUUID(),
          type: AssetType.IMAGE,
          url: URL.createObjectURL(blob),
          name: `Gen-${prompt.slice(0, 10)}.png`,
          mimeType: 'image/png',
          base64: base64.split(',')[1],
          category: 'generated'
        });

      } else if (mode === 'edit' && activeAsset) {
        if (!prompt) return;
        setGlobalLoading(true, "Nano Banana: Surgical Editing...");
        const base64Input = activeAsset.base64 || ""; 
        const resultBase64 = await editImage(base64Input, activeAsset.mimeType, prompt);
        const res = await fetch(resultBase64);
        const blob = await res.blob();

        onAddAsset({
          id: crypto.randomUUID(),
          type: AssetType.IMAGE,
          url: URL.createObjectURL(blob),
          name: `Edit-${activeAsset.name}`,
          mimeType: 'image/png',
          base64: resultBase64.split(',')[1],
          parentId: activeAsset.id,
          version: (activeAsset.version || 1) + 1,
          category: 'surgical'
        });

      } else if (mode === 'video') {
        if (!effectivePrompt) return;
        setGlobalLoading(true, "Generating Video with Veo 3.1...");
        
        // Pass first image context as Veo image input if available
        const firstImage = contextAssets.find(a => a.type === AssetType.IMAGE);
        const imageInput = firstImage && firstImage.base64 ? { mimeType: firstImage.mimeType, data: firstImage.base64 } : undefined;

        const videoUrl = await generateVideo(effectivePrompt, aspectRatio, imageInput ? [imageInput] : undefined);
        
        onAddAsset({
            id: crypto.randomUUID(),
            type: AssetType.VIDEO,
            url: videoUrl,
            name: `Veo-${prompt.slice(0, 10)}.mp4`,
            mimeType: 'video/mp4',
            category: 'generated'
        });

      } else if (mode === 'motion') {
         if (!startFrame) {
             alert("Start Frame is required for Motion mode.");
             return;
         }
         
         const frames: { mimeType: string, data: string }[] = [];
         
         if (startFrame.base64) frames.push({ mimeType: startFrame.mimeType, data: startFrame.base64 });
         if (endFrame?.base64) frames.push({ mimeType: endFrame.mimeType, data: endFrame.base64 });

         setGlobalLoading(true, `Veo 3.1: Interpolating ${frames.length > 1 ? 'A \u2192 B' : 'Motion'}...`);
         
         const videoUrl = await generateVideo(prompt || "Animate this scene naturally", aspectRatio, frames);

         onAddAsset({
            id: crypto.randomUUID(),
            type: AssetType.VIDEO,
            url: videoUrl,
            name: `Motion-${startFrame.name}`,
            mimeType: 'video/mp4',
            parentId: startFrame.id,
            category: 'generated'
        });
         
      } else if (mode === 'analyze' && activeAsset) {
        if (!prompt) return;
        setGlobalLoading(true, "Analyzing with Gemini 3 Pro...");
        if(!activeAsset.base64) throw new Error("No data");
        const result = await analyzeVideo(activeAsset.base64, activeAsset.mimeType, prompt);
        alert(`Analysis:\n\n${result}`);

      }
    } catch (e: any) {
      console.error("[PropertyPanel] Error in action:", e);
      alert(`Error: ${e.message}`);
    } finally {
      setGlobalLoading(false);
      setSuggestion('');
      setPrompt('');
      setContextAssets([]);
      setStartFrame(null);
      setEndFrame(null);
    }
  };

  return (
    <div className="w-80 bg-black/20 border-l border-white/5 flex flex-col p-4 overflow-y-auto shrink-0 custom-scrollbar backdrop-blur-xl">
      <div className="mb-6">
        <h2 className="text-white font-bold text-sm uppercase tracking-wider mb-1 opacity-80">Inspector</h2>
        <p className="text-xs text-gray-400 font-mono">Gemini 3 Pro + Veo 3.1 Engine</p>
      </div>

      {/* Contextual Mode Grid */}
      <div className="grid grid-cols-4 gap-2 mb-6 border-b border-white/5 pb-4">
        <button onClick={() => setMode('generate')} className={`p-2 rounded-lg flex flex-col items-center justify-center gap-1 transition-all ${mode === 'generate' ? 'bg-white/10 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'text-gray-500 hover:bg-white/5'}`} title="Text-to-Image">
          <PhotoIcon className="w-5 h-5" />
        </button>
        <button onClick={() => setMode('video')} className={`p-2 rounded-lg flex flex-col items-center justify-center gap-1 transition-all ${mode === 'video' ? 'bg-white/10 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'text-gray-500 hover:bg-white/5'}`} title="Text-to-Video">
          <FilmIcon className="w-5 h-5" />
        </button>
        <button onClick={() => setMode('motion')} className={`p-2 rounded-lg flex flex-col items-center justify-center gap-1 transition-all ${mode === 'motion' ? 'bg-white/10 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'text-gray-500 hover:bg-white/5'}`} title="Image-to-Video (Motion)">
           <PlayCircleIcon className="w-5 h-5" />
        </button>
        {activeAsset && activeAsset.type === AssetType.IMAGE && (
          <button onClick={() => setMode('edit')} className={`p-2 rounded-lg flex flex-col items-center justify-center gap-1 transition-all ${mode === 'edit' ? 'bg-white/10 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.2)]' : 'text-gray-500 hover:bg-white/5'}`} title="Nano Surgery">
            <PaintBrushIcon className="w-5 h-5" />
          </button>
        )}
         {activeAsset && activeAsset.type === AssetType.VIDEO && (
           <button onClick={() => setMode('analyze')} className={`p-2 rounded-lg flex flex-col items-center justify-center gap-1 transition-all ${mode === 'analyze' ? 'bg-white/10 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.2)]' : 'text-gray-500 hover:bg-white/5'}`} title="Analyze">
              <MagnifyingGlassIcon className="w-5 h-5" />
           </button>
        )}
      </div>

      <div className="space-y-4">
        
        {/* Dynamic Header */}
        <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-2 drop-shadow-sm">
            {mode === 'generate' && "New Asset Generation"}
            {mode === 'video' && "Veo 3.1 Video Gen"}
            {mode === 'motion' && "Veo A \u2192 B Motion"}
            {mode === 'edit' && <><ViewfinderCircleIcon className="w-4 h-4 text-purple-400" /> Nano Banana Surgery</>}
            {mode === 'analyze' && "Deep Analysis"}
        </div>

        {/* MULTIMODAL CONTEXT DROP ZONE */}
        {(mode === 'generate' || mode === 'video') && (
            <div className="space-y-2">
                <div 
                    className="w-full border border-dashed border-white/10 rounded-xl bg-black/20 p-2 min-h-[60px] flex flex-wrap gap-2 transition-all hover:border-emerald-500/50 hover:bg-white/5 cursor-pointer backdrop-blur-sm"
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={handleDropContext}
                    title="Drag Images or Videos here from your library or desktop"
                >
                    {contextAssets.length === 0 ? (
                        <div className="w-full h-full flex items-center justify-center text-gray-500 text-[10px] pointer-events-none">
                            <DocumentDuplicateIcon className="w-4 h-4 mr-1" />
                            Drag Reference Media Here (Image/Video)
                        </div>
                    ) : (
                        contextAssets.map(asset => (
                            <div key={asset.id} className="relative w-12 h-12 bg-black rounded-lg overflow-hidden group border border-white/10 shadow-lg">
                                {asset.type === AssetType.IMAGE && <img src={asset.url} className="w-full h-full object-cover opacity-80" alt="" />}
                                {asset.type === AssetType.VIDEO && <video src={asset.url} className="w-full h-full object-cover opacity-80" />}
                                <button 
                                    onClick={() => setContextAssets(prev => prev.filter(p => p.id !== asset.id))}
                                    className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 text-white transition-opacity backdrop-blur-sm"
                                >
                                    <XMarkIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ))
                    )}
                </div>
                {contextAssets.length > 0 && (
                    <div className="text-[10px] text-emerald-400 flex items-center gap-1 animate-pulse">
                        <SparklesIcon className="w-3 h-3" />
                        Gemini 3 Pro will analyze these references.
                    </div>
                )}
            </div>
        )}

        {/* MOTION MODE: DUAL FRAMES (Start -> End) */}
        {mode === 'motion' && (
            <div className="grid grid-cols-2 gap-2 bg-black/20 p-2 rounded-xl border border-white/5 backdrop-blur-sm">
                {/* START FRAME */}
                <div 
                    className="aspect-square bg-white/5 border border-dashed border-white/10 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500/50 transition-colors relative overflow-hidden group"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDropFrame(e, 'start')}
                >
                    {startFrame ? (
                        <>
                            <img src={startFrame.url} className="w-full h-full object-cover" alt="Start" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-sm">
                                <span className="text-[10px] text-white">Change</span>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); setStartFrame(null); }} className="absolute top-1 right-1 bg-red-500 rounded-full p-1 w-4 h-4 flex items-center justify-center text-[10px] text-white shadow-lg">x</button>
                        </>
                    ) : (
                        <>
                            <PhotoIcon className="w-5 h-5 text-gray-500 mb-1" />
                            <span className="text-[9px] text-gray-500">Start (A)</span>
                        </>
                    )}
                </div>

                {/* END FRAME */}
                <div 
                    className="aspect-square bg-white/5 border border-dashed border-white/10 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500/50 transition-colors relative overflow-hidden group"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDropFrame(e, 'end')}
                >
                    {endFrame ? (
                        <>
                            <img src={endFrame.url} className="w-full h-full object-cover" alt="End" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-sm">
                                <span className="text-[10px] text-white">Change</span>
                            </div>
                             <button onClick={(e) => { e.stopPropagation(); setEndFrame(null); }} className="absolute top-1 right-1 bg-red-500 rounded-full p-1 w-4 h-4 flex items-center justify-center text-[10px] text-white shadow-lg">x</button>
                        </>
                    ) : (
                        <>
                            <ArrowRightIcon className="w-5 h-5 text-gray-500 mb-1" />
                            <span className="text-[9px] text-gray-500">End (B)</span>
                        </>
                    )}
                </div>
            </div>
        )}

        {/* Prompt Input with Enhancer */}
        <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-purple-600 rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative">
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full bg-black/60 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-emerald-500/50 focus:outline-none transition-colors font-sans relative z-10 backdrop-blur-md"
                    rows={5}
                    placeholder={
                        mode === 'edit' ? "Describe change (e.g. 'remove logo', 'add sunglasses'). Draw mask on player for precision." :
                        mode === 'motion' ? "Camera zooms slowly from image A to image B..." :
                        "Describe your creative intent..."
                    }
                />
                {/* Ghost Text Overlay */}
                {suggestion && (
                    <div className="absolute top-0 left-0 p-3 pointer-events-none z-20 text-sm font-sans w-full whitespace-pre-wrap break-words">
                        <span className="text-transparent">{prompt}</span>
                        <span className="text-gray-500 opacity-50">{suggestion}</span>
                    </div>
                )}
            </div>
            {suggestion && (
                <div className="text-[10px] text-emerald-400 mt-2 flex items-center gap-1 animate-pulse">
                    <span>Press <kbd className="font-mono border border-emerald-500/30 px-1 rounded bg-emerald-500/10">TAB</kbd> to accept AI suggestion</span>
                </div>
            )}
        </div>

        {/* Parameter Controls */}
        {(mode === 'video' || mode === 'motion') && (
           <div className="space-y-3 bg-black/20 p-2 rounded-lg backdrop-blur-sm">
             <div className="flex bg-black/40 rounded-lg p-1 border border-white/5">
                  {(['16:9', '9:16'] as const).map(r => (
                    <button key={r} onClick={() => setAspectRatio(r)} className={`flex-1 text-xs py-1 rounded-md transition-all ${aspectRatio === r ? 'bg-white/10 text-white font-bold shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>{r}</button>
                  ))}
            </div>
           </div>
        )}

        <button
          onClick={handleAction}
          disabled={!prompt && mode !== 'motion'} // Motion can work without prompt sometimes but we prefer it
          className="w-full bg-gradient-to-r from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white font-bold py-3 rounded-lg shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:cursor-not-allowed transition-all uppercase tracking-wide text-xs relative overflow-hidden group"
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            {mode === 'generate' && (contextAssets.length > 0 ? "Generate with Context" : "Generate Asset")}
            {mode === 'edit' && "Apply AI Surgery"}
            {mode === 'video' && (contextAssets.length > 0 ? "Render Veo (Context Aware)" : "Render Veo Clip")}
            {mode === 'motion' && (startFrame && endFrame ? "Interpolate (A \u2192 B)" : "Animate Frame (A)")}
            {mode === 'analyze' && "Run Deep Analysis"}
          </span>
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
        </button>
      </div>
    </div>
  );
};

export default PropertyPanel;
