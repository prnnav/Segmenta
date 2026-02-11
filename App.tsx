

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import AssetPanel from './components/AssetPanel';
import PlayerPanel from './components/PlayerPanel';
import PropertyPanel from './components/PropertyPanel';
import Timeline from './components/Timeline';
import ChatAssistant from './components/ChatAssistant';
import RenderModal from './components/RenderModal';
import StoryboardView from './components/StoryboardView';
import { Asset, TimelineSegment, AssetType, TrackType, PlaybackMode, StoryboardSegment } from './types';
import { setDynamicApiKey, generateStoryboardStructure, generateImage, generateVideo, generateSpeech } from './services/geminiService';
import { ArrowDownTrayIcon, ShareIcon, SparklesIcon, ExclamationTriangleIcon, SpeakerWaveIcon, SpeakerXMarkIcon, DocumentDuplicateIcon, XMarkIcon } from '@heroicons/react/24/outline';

const App: React.FC = () => {
    // --- LANDING PAGE STATE ---
    const [showStudio, setShowStudio] = useState(false);

    // --- AUTH STATE ---
    const [hasKey, setHasKey] = useState<boolean>(false);
    const [checkingKey, setCheckingKey] = useState<boolean>(true);
    const [manualKey, setManualKey] = useState('');

    // --- APP STATE ---
    const [assets, setAssets] = useState<Asset[]>([]);
    const [activeAsset, setActiveAsset] = useState<Asset | null>(null);
    const [showRenderModal, setShowRenderModal] = useState(false);
    const [maskData, setMaskData] = useState<string | null>(null);

    // Director Mode State
    const [viewMode, setViewMode] = useState<'EDITOR' | 'DIRECTOR_INPUT' | 'STORYBOARD_REVIEW'>('EDITOR');
    const [directorPrompt, setDirectorPrompt] = useState('');
    const [directorContextAssets, setDirectorContextAssets] = useState<Asset[]>([]);
    const [includeDirectorAudio, setIncludeDirectorAudio] = useState<boolean>(true);

    const [storyboardSegments, setStoryboardSegments] = useState<StoryboardSegment[]>([]);
    const [characterAnchor, setCharacterAnchor] = useState<Asset | null>(null);

    // Master Playback State
    const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('TIMELINE');
    const [timelineTime, setTimelineTime] = useState(0);
    const [isTimelinePlaying, setIsTimelinePlaying] = useState(false);
    const lastTickRef = useRef<number>(0);
    const reqRef = useRef<number>(0);

    // Initial Segments
    const [segments, setSegments] = useState<TimelineSegment[]>([
        { id: '1', assetId: 'start', trackId: TrackType.VIDEO_MAIN, startFrame: 0, endFrame: 120, duration: 4, label: 'Intro Hook', isAiGenerated: false, assetUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4' },
        { id: '2', assetId: 'mid', trackId: TrackType.VIDEO_MAIN, startFrame: 121, endFrame: 240, duration: 4, label: 'Value Prop', isAiGenerated: true, assetUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4' },
    ]);

    const [isLoading, setIsLoading] = useState(false);
    const [loadingMsg, setLoadingMsg] = useState("");

    // --- 1. KEY CHECK ON MOUNT ---
    useEffect(() => {
        const checkKey = async () => {
            console.log("[Auth] Checking for API keys...");

            if ((window as any).aistudio) {
                const selected = await (window as any).aistudio.hasSelectedApiKey();
                console.log("[Auth] AI Studio detected. Key selected:", selected);
                setHasKey(selected);
            } else {
                const geminiKey = process.env.GEMINI_API_KEY;
                const apiKey = process.env.API_KEY;

                console.log("[Auth] Environment keys detected:", {
                    GEMINI_API_KEY: geminiKey ? `Found (${geminiKey.slice(0, 4)}...${geminiKey.slice(-4)})` : "Not Found",
                    API_KEY: apiKey ? `Found (${apiKey.slice(0, 4)}...${apiKey.slice(-4)})` : "Not Found"
                });

                if ((geminiKey && geminiKey.length > 10) || (apiKey && apiKey.length > 10)) {
                    console.log("[Auth] Valid key found in environment.");
                    setHasKey(true);
                } else {
                    console.log("[Auth] No valid environment key found.");
                    setHasKey(false);
                }
            }
            setCheckingKey(false);
        };
        checkKey();
    }, []);

    const handleConnectKey = async () => {
        if ((window as any).aistudio) {
            await (window as any).aistudio.openSelectKey();
            setHasKey(true);
        }
    };

    const handleManualKeySubmit = () => {
        if (manualKey.trim().length > 10) {
            setDynamicApiKey(manualKey.trim());
            setHasKey(true);
        } else {
            alert("Please enter a valid API Key.");
        }
    };

    // Calculate the total duration of the content dynamically
    const contentDuration = useMemo(() => {
        if (segments.length === 0) return 10; // Default canvas size if empty
        const maxEndFrame = Math.max(...segments.map(s => s.endFrame));
        return maxEndFrame / 30; // Convert frames to seconds
    }, [segments]);

    // --- Master Clock Loop ---
    useEffect(() => {
        const loop = (timestamp: number) => {
            if (!lastTickRef.current) lastTickRef.current = timestamp;
            const delta = (timestamp - lastTickRef.current) / 1000;
            lastTickRef.current = timestamp;

            if (isTimelinePlaying) {
                setTimelineTime(prev => {
                    const nextTime = prev + delta;
                    // Stop exactly at the last bit of media
                    if (nextTime >= contentDuration) {
                        setIsTimelinePlaying(false);
                        return contentDuration;
                    }
                    return nextTime;
                });
            }
            reqRef.current = requestAnimationFrame(loop);
        };
        reqRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(reqRef.current);
    }, [isTimelinePlaying, contentDuration]);

    const toggleTimelinePlay = useCallback(() => {
        // If we are at the end, restart
        if (timelineTime >= contentDuration) {
            setTimelineTime(0);
            setPlaybackMode('TIMELINE');
            setIsTimelinePlaying(true);
            lastTickRef.current = 0;
            return;
        }

        if (playbackMode !== 'TIMELINE') {
            setPlaybackMode('TIMELINE');
            setIsTimelinePlaying(true);
        } else {
            setIsTimelinePlaying(!isTimelinePlaying);
        }
        lastTickRef.current = 0;
    }, [timelineTime, contentDuration, playbackMode, isTimelinePlaying]);

    const handleSeek = useCallback((t: number) => {
        // Clamp seek to content duration to ensure cursor doesn't go further than media
        const clampedTime = Math.min(Math.max(0, t), contentDuration);
        setTimelineTime(clampedTime);
        setPlaybackMode('TIMELINE'); // Switching playhead switches to Timeline Mode
    }, [contentDuration]);

    // --- Asset Logic ---
    const handleSelectAsset = (asset: Asset) => {
        setActiveAsset(asset);
        setPlaybackMode('ASSET'); // Switch to Source Mode
        setIsTimelinePlaying(false);
    };

    const handleAddAsset = (asset: Asset) => {
        setAssets(prev => [...prev, asset]);
        handleSelectAsset(asset);
    };

    const handleSetGlobalLoading = (loading: boolean, msg: string = "Processing...") => {
        setIsLoading(loading);
        setLoadingMsg(msg);
    };

    const handleCaptureFrame = (base64: string) => {
        const newAsset: Asset = {
            id: crypto.randomUUID(),
            type: AssetType.IMAGE,
            url: `data:image/png;base64,${base64}`,
            name: `Frame Grab - ${new Date().toLocaleTimeString()}`,
            mimeType: 'image/png',
            base64: base64
        };
        handleAddAsset(newAsset);
    };

    const handleDirectorDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const data = e.dataTransfer.getData("application/json");
        if (data) {
            try {
                const asset = JSON.parse(data) as Asset;
                if (!directorContextAssets.find(a => a.id === asset.id)) {
                    setDirectorContextAssets(prev => [...prev, asset]);
                }
            } catch (err) { console.error(err); }
        }
    };

    // --- DIRECTOR MODE HANDLERS ---
    const startDirectorMode = async () => {
        if (!directorPrompt.trim()) return;

        setViewMode('EDITOR');
        handleSetGlobalLoading(true, "Director Agent (Gemini 3 Pro): Analyzing Context & Writing Script...");

        try {
            // 1. Generate Structure with Multimodal Context
            const structure = await generateStoryboardStructure(directorPrompt, directorContextAssets);
            const rawSegments = structure.segments || [];
            const characterPrompt = structure.character_prompt || "A generic person";

            // 2. GENERATE CHARACTER ANCHOR (Source of Truth)
            handleSetGlobalLoading(true, "Director Agent: Generating Character Anchor (Source of Truth)...");
            const anchorBase64 = await generateImage(characterPrompt);
            const anchorAsset: Asset = {
                id: crypto.randomUUID(),
                type: AssetType.IMAGE,
                url: anchorBase64,
                base64: anchorBase64.split(',')[1],
                name: 'Character Anchor',
                mimeType: 'image/png',
                category: 'generated'
            };
            setCharacterAnchor(anchorAsset);
            setAssets(prev => [...prev, anchorAsset]);

            // 3. Visualize Frames (A & B) + AUDIO using Anchor
            const visualizedSegments: StoryboardSegment[] = [];

            for (const seg of rawSegments) {
                handleSetGlobalLoading(true, `Director Agent: Visualizing Scene ${seg.id} (Injecting Character Anchor)...`);

                const reference = { mimeType: anchorAsset.mimeType, base64: anchorAsset.base64! };

                // Only generate speech if the user enabled it in the toggle
                const speechPromise = (includeDirectorAudio && seg.voiceover_script)
                    ? generateSpeech(seg.voiceover_script).catch(e => null)
                    : Promise.resolve(null);

                // Parallel generation
                const [imgABase64, imgBBase64, audioDataUrl] = await Promise.all([
                    generateImage(seg.frame_a_prompt, reference),
                    generateImage(seg.frame_b_prompt, reference),
                    speechPromise
                ]);

                // Create Visual Assets
                const assetA: Asset = {
                    id: crypto.randomUUID(),
                    type: AssetType.IMAGE,
                    url: imgABase64,
                    base64: imgABase64.split(',')[1],
                    name: `Scene ${seg.id} - Start`,
                    mimeType: 'image/png',
                    category: 'generated'
                };
                const assetB: Asset = {
                    id: crypto.randomUUID(),
                    type: AssetType.IMAGE,
                    url: imgBBase64,
                    base64: imgBBase64.split(',')[1],
                    name: `Scene ${seg.id} - End`,
                    mimeType: 'image/png',
                    category: 'generated'
                };

                // Create Audio Asset (if generated)
                let audioAsset: Asset | undefined = undefined;
                if (audioDataUrl) {
                    audioAsset = {
                        id: crypto.randomUUID(),
                        type: AssetType.AUDIO,
                        url: audioDataUrl,
                        base64: audioDataUrl.split(',')[1],
                        name: `Audio ${seg.id}`,
                        mimeType: 'audio/wav',
                        category: 'generated',
                        metadata: { duration: 5 } // Approximate
                    };
                }

                // Add to library
                setAssets(prev => [...prev, assetA, assetB]);
                if (audioAsset) setAssets(prev => [...prev, audioAsset!]);

                visualizedSegments.push({
                    ...seg,
                    imgA: assetA,
                    imgB: assetB,
                    audio: audioAsset
                });
            }

            setStoryboardSegments(visualizedSegments);
            handleSetGlobalLoading(false);
            setViewMode('STORYBOARD_REVIEW');

        } catch (e: any) {
            console.error(e);
            alert(`Director Mode Error: ${e.message}`);
            handleSetGlobalLoading(false);
            setViewMode('DIRECTOR_INPUT');
        }
    };

    const handleDirectorApprove = async (includeAudio: boolean) => {
        handleSetGlobalLoading(true, "Veo 3.1: Batch Rendering Video & Audio...");
        try {
            const newSegments: TimelineSegment[] = [];
            let currentStartFrame = segments.length > 0 ? Math.max(...segments.map(s => s.endFrame)) : 0;

            for (const scene of storyboardSegments) {
                if (!scene.imgA || !scene.imgB) continue;

                handleSetGlobalLoading(true, `Veo 3.1: Rendering Video Scene ${scene.id}...`);

                // Call Veo with Start and End frames (Consistent characters because imgA/B are consistent)
                const videoUrl = await generateVideo(
                    scene.camera_movement || "Cinematic movement",
                    '16:9',
                    [
                        { mimeType: scene.imgA.mimeType, data: scene.imgA.base64! },
                        { mimeType: scene.imgB.mimeType, data: scene.imgB.base64! }
                    ]
                );

                // Create Video Asset
                const vidAsset: Asset = {
                    id: crypto.randomUUID(),
                    type: AssetType.VIDEO,
                    url: videoUrl,
                    name: `Scene ${scene.id} - Final`,
                    mimeType: 'video/mp4',
                    category: 'generated',
                    metadata: { duration: 5 } // Veo typically returns ~5s
                };
                setAssets(prev => [...prev, vidAsset]);

                // 1. ADD VIDEO SEGMENT
                const duration = 5;
                const lengthInFrames = duration * 30;
                const videoSegId = crypto.randomUUID();

                newSegments.push({
                    id: videoSegId,
                    assetId: vidAsset.id,
                    assetUrl: vidAsset.url,
                    assetType: AssetType.VIDEO,
                    trackId: TrackType.VIDEO_MAIN,
                    startFrame: currentStartFrame,
                    endFrame: currentStartFrame + lengthInFrames,
                    duration: duration,
                    label: `Sc ${scene.id}: ${scene.action}`,
                    isAiGenerated: true
                });

                // 2. ADD AUDIO SEGMENT (Linked) - Only if enabled in review AND user didn't disable earlier
                if (includeAudio && scene.audio) {
                    newSegments.push({
                        id: crypto.randomUUID(),
                        assetId: scene.audio.id,
                        assetUrl: scene.audio.url, // Data URL or Blob
                        assetType: AssetType.AUDIO,
                        trackId: TrackType.AUDIO,
                        startFrame: currentStartFrame,
                        endFrame: currentStartFrame + lengthInFrames, // Stretch or crop to fit video?
                        duration: duration,
                        label: `VO: ${scene.action}`,
                        isAiGenerated: true,
                        linkedSegmentId: videoSegId
                    });
                }

                currentStartFrame += lengthInFrames;
            }

            setSegments(prev => [...prev, ...newSegments]);
            setViewMode('EDITOR');
            handleSetGlobalLoading(false);
            // Cleanup
            setDirectorContextAssets([]);
            setDirectorPrompt("");

        } catch (e: any) {
            console.error(e);
            alert(`Rendering Error: ${e.message}`);
            handleSetGlobalLoading(false);
        }
    };


    // --- Drag & Drop Logic ---
    const handleDropAssetOnTimeline = useCallback((asset: Asset, trackId: TrackType, time: number) => {
        const segId = crypto.randomUUID();
        const startFrame = Math.floor(time * 30);

        // Use asset duration if available (e.g., imported video/audio), else default to 4s (images)
        const duration = asset.metadata?.duration || 4;
        const lengthInFrames = Math.ceil(duration * 30);

        const newSegments: TimelineSegment[] = [];

        // Base Segment
        newSegments.push({
            id: segId,
            assetId: asset.id,
            assetUrl: asset.url, // Store URL for composition
            assetType: asset.type,
            trackId: asset.type === AssetType.VIDEO ? TrackType.VIDEO_MAIN : trackId,
            startFrame: startFrame,
            endFrame: startFrame + lengthInFrames,
            duration: duration,
            label: asset.name,
            isAiGenerated: false,
            linkedSegmentId: asset.type === AssetType.VIDEO ? `audio-${segId}` : undefined
        });

        // Auto-Split Audio for Video
        if (asset.type === AssetType.VIDEO) {
            newSegments.push({
                id: `audio-${segId}`,
                assetId: asset.id,
                assetUrl: asset.url,
                trackId: TrackType.AUDIO,
                startFrame: startFrame,
                endFrame: startFrame + lengthInFrames,
                duration: duration,
                label: `Audio: ${asset.name}`,
                isAiGenerated: false,
                linkedSegmentId: segId
            });
        }
        setSegments(prev => [...prev, ...newSegments]);
    }, []);

    const handleUpdateSegment = useCallback((id: string, updates: Partial<TimelineSegment>) => {
        setSegments(prev => prev.map(s => {
            if (s.id === id) {
                const updated = { ...s, ...updates };
                // Update End Frame if Start Changed
                if (updates.startFrame !== undefined) {
                    updated.endFrame = updates.startFrame + (s.duration * 30);
                }
                return updated;
            }
            // Linked Sync
            const movedSeg = prev.find(p => p.id === id);
            if (movedSeg && movedSeg.linkedSegmentId === s.id && updates.startFrame !== undefined) {
                const newStart = updates.startFrame;
                return { ...s, startFrame: newStart, endFrame: newStart + (s.duration * 30) };
            }
            return s;
        }));
    }, []);

    const handleDropAssetOnPlayer = (asset: Asset, x: number, y: number) => {
        // Create Overlay Segment
        const segId = crypto.randomUUID();
        const duration = asset.metadata?.duration || 5;
        const lengthInFrames = Math.ceil(duration * 30);

        setSegments(prev => [...prev, {
            id: segId,
            assetId: asset.id,
            assetUrl: asset.url,
            trackId: TrackType.OVERLAY,
            startFrame: Math.floor(timelineTime * 30), // Drop at current time
            endFrame: Math.floor(timelineTime * 30) + lengthInFrames,
            duration: duration,
            label: `Overlay: ${asset.name}`,
            isAiGenerated: false,
            metadata: { overlayX: x, overlayY: y }
        }]);
    };

    const handleUnlink = useCallback((id: string) => {
        setSegments(prev => prev.map(s => {
            if (s.id === id || s.linkedSegmentId === id) {
                return { ...s, linkedSegmentId: undefined };
            }
            return s;
        }));
    }, []);

    const handleDeleteSegment = useCallback((id: string) => {
        setSegments(prev => prev.filter(s => s.id !== id));
    }, []);

    const handleCheckContinuity = async (segA: TimelineSegment, segB: TimelineSegment) => {
        alert("Continuity Check: Use Gemini to analyze frames from these URLs.");
    }

    // --- RENDER BLOCKING AUTH SCREEN ---
    if (checkingKey) {
        return <div className="h-screen bg-black flex items-center justify-center text-white font-light tracking-widest animate-pulse">Initializing Studio...</div>;
    }

    if (!hasKey) {
        return (
            <div className="h-screen bg-black flex flex-col items-center justify-center text-white p-6 relative overflow-hidden">
                <div className="absolute inset-0 z-0 bg-gradient-to-br from-purple-900/30 via-black to-emerald-900/30"></div>
                <div className="relative z-10 max-w-md w-full bg-white/5 backdrop-blur-2xl border border-white/10 p-8 rounded-2xl shadow-2xl text-center">
                    <div className="w-16 h-16 bg-gradient-to-tr from-purple-500 to-emerald-400 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-glow">
                        <span className="text-3xl font-bold text-black">S</span>
                    </div>

                    <h1 className="text-3xl font-bold mb-2 tracking-tight">Segmenta Studio</h1>
                    <p className="text-gray-400 mb-8 font-light">Pro Generative Video Suite</p>

                    <div className="space-y-4">
                        {(window as any).aistudio && (
                            <button
                                onClick={handleConnectKey}
                                className="w-full bg-white text-black font-bold py-4 rounded-xl hover:scale-[1.02] transition-transform flex items-center justify-center gap-3 shadow-lg"
                            >
                                Connect Google API Key
                            </button>
                        )}

                        <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                            <label className="block text-xs text-left text-gray-400 mb-2 font-mono uppercase">Manual API Key Entry</label>
                            <div className="flex gap-2">
                                <input
                                    type="password"
                                    value={manualKey}
                                    onChange={(e) => setManualKey(e.target.value)}
                                    className="flex-1 bg-transparent border border-white/20 rounded px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none transition-colors"
                                    placeholder="Paste API Key here..."
                                />
                                <button
                                    onClick={handleManualKeySubmit}
                                    className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded font-bold text-xs transition-colors"
                                >
                                    Enter
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-white/5 text-xs text-gray-500">
                        <div className="flex items-start gap-2 text-left bg-yellow-500/10 p-2 rounded mb-4">
                            <ExclamationTriangleIcon className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                            <p className="text-yellow-200/80">
                                Veo 3.1 requires a <strong>Paid Billing Project</strong>.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // --- DIRECTOR INPUT MODAL ---
    if (viewMode === 'DIRECTOR_INPUT') {
        return (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6">
                <div className="w-full max-w-2xl bg-gray-900/90 border border-white/10 rounded-xl p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-emerald-500"></div>

                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                <SparklesIcon className="w-6 h-6 text-purple-400" />
                                Director Mode
                            </h2>
                            <p className="text-gray-400 text-sm">
                                Gemini 3 Pro will analyze your assets and script the video.
                            </p>
                        </div>
                    </div>

                    {/* MULTIMODAL DROPZONE */}
                    <div
                        className="w-full min-h-[80px] border border-dashed border-white/10 rounded-lg bg-black/40 p-3 mb-4 flex flex-wrap gap-2 hover:border-emerald-500/50 hover:bg-white/5 transition-all cursor-pointer relative"
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onDrop={handleDirectorDrop}
                    >
                        {directorContextAssets.length === 0 ? (
                            <div className="w-full flex flex-col items-center justify-center text-gray-500 text-xs py-4 pointer-events-none">
                                <DocumentDuplicateIcon className="w-6 h-6 mb-2 opacity-50" />
                                <p>Drag reference images/videos here for context</p>
                            </div>
                        ) : (
                            directorContextAssets.map(asset => (
                                <div key={asset.id} className="relative w-16 h-16 bg-black rounded-lg overflow-hidden group border border-white/10">
                                    {asset.type === AssetType.IMAGE && <img src={asset.url} className="w-full h-full object-cover opacity-80" alt="" />}
                                    {asset.type === AssetType.VIDEO && <video src={asset.url} className="w-full h-full object-cover opacity-80" />}
                                    <button
                                        onClick={() => setDirectorContextAssets(prev => prev.filter(p => p.id !== asset.id))}
                                        className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 text-white transition-opacity backdrop-blur-sm"
                                    >
                                        <XMarkIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    <textarea
                        value={directorPrompt}
                        onChange={(e) => setDirectorPrompt(e.target.value)}
                        className="w-full bg-black/50 border border-white/10 rounded-lg p-4 text-white focus:border-purple-500 focus:outline-none h-32 resize-none mb-4 font-light text-sm"
                        placeholder="E.g., A cyberpunk detective walking through a rainy neon city at night, he spots a robotic cat, picks it up, and looks at its glowing eyes."
                    />

                    {/* Audio Toggle */}
                    <div className="flex items-center justify-between bg-white/5 p-3 rounded-lg mb-6 border border-white/5">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${includeDirectorAudio ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-gray-500'}`}>
                                {includeDirectorAudio ? <SpeakerWaveIcon className="w-5 h-5" /> : <SpeakerXMarkIcon className="w-5 h-5" />}
                            </div>
                            <div>
                                <span className="block text-sm font-bold text-white">Generate Audio & Voiceovers</span>
                                <span className="block text-[10px] text-gray-400">Gemini TTS (Kore) will perform the script.</span>
                            </div>
                        </div>
                        <button
                            onClick={() => setIncludeDirectorAudio(!includeDirectorAudio)}
                            className={`w-10 h-5 rounded-full relative transition-colors ${includeDirectorAudio ? 'bg-emerald-500' : 'bg-gray-700'}`}
                        >
                            <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-all ${includeDirectorAudio ? 'left-6' : 'left-1'}`}></div>
                        </button>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button onClick={() => setViewMode('EDITOR')} className="px-6 py-2 text-gray-400 hover:text-white transition-colors">Cancel</button>
                        <button
                            onClick={startDirectorMode}
                            disabled={!directorPrompt}
                            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg text-sm"
                        >
                            Initialize Director Agent
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // --- STORYBOARD REVIEW ---
    if (viewMode === 'STORYBOARD_REVIEW') {
        return (
            <StoryboardView
                segments={storyboardSegments}
                characterAnchor={characterAnchor}
                onApprove={handleDirectorApprove}
                onCancel={() => setViewMode('EDITOR')}
                isProcessing={isLoading}
            />
        );
    }

    // --- MAIN APP RENDER ---
    return (
        <div className="flex flex-col h-screen bg-black text-gray-200 font-sans selection:bg-emerald-500 selection:text-white overflow-hidden relative">

            {/* GLOBAL BACKGROUND - The foundation of glassmorphism */}
            <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-purple-900/40 via-black to-emerald-900/20"></div>
            <div className="absolute inset-0 z-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 pointer-events-none"></div>

            {/* Header */}
            <header className="h-14 bg-white/5 border-b border-white/5 flex items-center px-6 justify-between shrink-0 z-20 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-tr from-purple-600 to-emerald-400 rounded-lg flex items-center justify-center font-bold text-black shadow-lg">S</div>
                    <div>
                        <h1 className="font-bold text-lg leading-tight tracking-tight text-white/90">Segmenta</h1>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <div className="flex gap-2">
                        {/* Director Mode Button */}
                        <button
                            onClick={() => setViewMode('DIRECTOR_INPUT')}
                            className="flex items-center gap-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-200 px-4 py-2 rounded-lg text-xs font-bold transition-all mr-2 backdrop-blur-sm"
                        >
                            <SparklesIcon className="w-4 h-4 text-purple-400" />
                            Director Mode
                        </button>

                        <button className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors border border-white/5 backdrop-blur-sm">
                            <ShareIcon className="w-4 h-4" />
                            Share
                        </button>
                        <button
                            onClick={() => setShowRenderModal(true)}
                            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-2 rounded-lg text-xs font-bold transition-colors shadow-lg shadow-emerald-500/20"
                        >
                            <ArrowDownTrayIcon className="w-4 h-4" />
                            Export
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Workspace */}
            <div className="flex-1 flex overflow-hidden relative z-10">
                <AssetPanel
                    assets={assets}
                    onSelectAsset={handleSelectAsset}
                    onAddAsset={handleAddAsset}
                    setGlobalLoading={handleSetGlobalLoading}
                />

                <div className="flex-1 flex flex-col min-w-0 border-r border-white/5 bg-black/20 backdrop-blur-sm">
                    <PlayerPanel
                        mode={playbackMode}
                        activeAsset={activeAsset}
                        timelineTime={timelineTime}
                        isPlaying={isTimelinePlaying}
                        segments={segments}
                        onTogglePlay={toggleTimelinePlay}
                        onSeek={handleSeek}
                        onCaptureFrame={handleCaptureFrame}
                        onUpdateMask={setMaskData}
                        onDropAssetOnFrame={handleDropAssetOnPlayer}
                    />
                    <Timeline
                        currentTime={timelineTime}
                        segments={segments}
                        onCheckContinuity={handleCheckContinuity}
                        onDropAsset={handleDropAssetOnTimeline}
                        onDeleteSegment={handleDeleteSegment}
                        onUnlinkSegment={handleUnlink}
                        onUpdateSegment={handleUpdateSegment}
                        onSeek={handleSeek}
                    />
                </div>

                <PropertyPanel
                    activeAsset={activeAsset}
                    onAddAsset={handleAddAsset}
                    setGlobalLoading={handleSetGlobalLoading}
                />
            </div>

            <ChatAssistant />
            {showRenderModal && <RenderModal segments={segments} assets={assets} onClose={() => setShowRenderModal(false)} />}

            {isLoading && viewMode !== 'STORYBOARD_REVIEW' && (
                <div className="fixed inset-0 bg-black/80 z-[60] flex flex-col items-center justify-center backdrop-blur-md">
                    <div className="w-12 h-12 border-4 border-white/10 border-t-emerald-500 rounded-full animate-spin mb-4 shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
                    <p className="text-xl font-light text-white animate-pulse tracking-wide font-mono">{loadingMsg}</p>
                </div>
            )}
        </div>
    );
};

export default App;
