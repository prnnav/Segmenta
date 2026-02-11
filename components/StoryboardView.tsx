
import React, { useState } from 'react';
import { StoryboardSegment, Asset } from '../types';
import { SparklesIcon, ArrowRightIcon, FilmIcon, XMarkIcon, UserIcon, MusicalNoteIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from '@heroicons/react/24/solid';

interface StoryboardViewProps {
  segments: StoryboardSegment[];
  characterAnchor: Asset | null;
  onApprove: (includeAudio: boolean) => void;
  onCancel: () => void;
  isProcessing: boolean;
}

const StoryboardView: React.FC<StoryboardViewProps> = ({ segments, characterAnchor, onApprove, onCancel, isProcessing }) => {
  const [includeAudio, setIncludeAudio] = useState(true);

  return (
    <div className="fixed inset-0 bg-studio-900 z-50 flex flex-col items-center justify-center p-6 overflow-hidden backdrop-blur-xl bg-black/90">
      
      {/* Header */}
      <div className="w-full max-w-7xl flex justify-between items-center mb-6 border-b border-white/5 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 flex items-center gap-3">
                <SparklesIcon className="w-6 h-6 text-purple-400" />
                Director Mode: Consistency & Flow
            </h1>
            <p className="text-sm text-gray-400 mt-1">Review the Character Anchor and scene flow before rendering.</p>
          </div>
          <button onClick={onCancel} className="text-gray-500 hover:text-white transition-colors">
              <XMarkIcon className="w-8 h-8" />
          </button>
      </div>
      
      <div className="flex-1 w-full max-w-7xl flex gap-8 overflow-hidden mb-8">
          
          {/* LEFT: CHARACTER ANCHOR */}
          <div className="w-64 flex flex-col shrink-0 bg-white/5 border-r border-white/5 p-4 rounded-xl shadow-2xl">
              <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <UserIcon className="w-4 h-4" /> Character Anchor
              </h3>
              <div className="aspect-[3/4] bg-black rounded-lg overflow-hidden border border-emerald-500/30 relative shadow-lg group">
                  {characterAnchor ? (
                      <img src={characterAnchor.url} className="w-full h-full object-cover" alt="Anchor" />
                  ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">Generating...</div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-2 text-[10px] text-gray-300 backdrop-blur-sm">
                      Source of Truth
                  </div>
              </div>
              <p className="text-[10px] text-gray-500 mt-4 leading-relaxed">
                  This image is injected into every scene generation to ensure visual consistency.
              </p>
          </div>

          {/* RIGHT: SCROLLING STORYBOARD */}
          <div className="flex-1 overflow-x-auto custom-scrollbar pb-4">
              <div className="flex gap-12 px-4 min-w-max">
                {segments.map((scene, index) => (
                <div key={scene.id} className="flex flex-col items-center gap-4 relative group pt-8">
                    
                    {/* Scene Number */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 text-[10px] font-mono text-zinc-500 bg-black/80 px-2 uppercase tracking-widest border border-white/10 rounded-full z-10 backdrop-blur-md">
                        Scene 0{index + 1}
                    </div>

                    {/* The "Bridge" Visualization */}
                    <div className="flex items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/5 shadow-2xl backdrop-blur-sm group-hover:border-purple-500/30 transition-colors">
                    
                        {/* Frame A */}
                        <div className="relative">
                            <div className="w-48 aspect-video bg-black rounded-lg overflow-hidden border border-white/10 relative shadow-lg">
                                {scene.imgA ? (
                                    <img src={scene.imgA.url} className="w-full h-full object-cover" alt="Start Frame" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-700 bg-studio-900 text-xs">Generating...</div>
                                )}
                            </div>
                            <span className="absolute -bottom-2 left-2 text-[9px] font-bold bg-purple-900/90 text-purple-100 px-2 py-0.5 rounded shadow-sm border border-purple-700">START</span>
                        </div>

                        {/* Arrow / Veo Indicator */}
                        <div className="flex flex-col items-center gap-1 w-24 opacity-60">
                            <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-purple-500 to-transparent"></div>
                            <div className="flex items-center gap-1 text-[9px] text-purple-300 uppercase font-bold tracking-wider">
                                <FilmIcon className="w-3 h-3" />
                                Veo
                            </div>
                            <div className="text-[8px] text-gray-500 text-center leading-tight w-20 truncate">
                                {scene.camera_movement}
                            </div>
                            <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-purple-500 to-transparent"></div>
                        </div>

                        {/* Frame B */}
                        <div className="relative">
                            <div className="w-48 aspect-video bg-black rounded-lg overflow-hidden border border-white/10 relative shadow-lg">
                                {scene.imgB ? (
                                    <img src={scene.imgB.url} className="w-full h-full object-cover" alt="End Frame" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-700 bg-studio-900 text-xs">Generating...</div>
                                )}
                            </div>
                            <span className="absolute -bottom-2 right-2 text-[9px] font-bold bg-pink-900/90 text-pink-100 px-2 py-0.5 rounded shadow-sm border border-pink-700">END</span>
                        </div>
                    </div>

                    {/* Audio & Info */}
                    <div className="text-center max-w-[400px] flex flex-col gap-2 items-center">
                        <p className="text-xs font-medium text-gray-300 bg-white/5 px-3 py-1 rounded-full border border-white/10 inline-block shadow-sm">
                            {scene.action}
                        </p>
                        {scene.voiceover_script && (
                             <div className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition-opacity ${includeAudio ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-gray-600 bg-gray-800 border-gray-700 opacity-50 line-through'}`}>
                                <MusicalNoteIcon className="w-3 h-3" />
                                {scene.audio ? "Audio Ready" : "TTS Script Pending"}
                             </div>
                        )}
                    </div>
                    
                    {/* Connector */}
                    {index < segments.length - 1 && (
                        <div className="absolute top-1/2 -right-10 w-8 h-[2px] border-t-2 border-dashed border-studio-600 -mt-8 opacity-30"></div>
                    )}
                </div>
                ))}
              </div>
          </div>
      </div>

      {/* Footer / Actions */}
      <div className="w-full max-w-2xl text-center space-y-4">
           {isProcessing ? (
               <div className="flex flex-col items-center gap-3 animate-pulse">
                   <div className="w-12 h-12 border-4 border-white/10 border-t-purple-500 rounded-full animate-spin"></div>
                   <p className="text-purple-300 font-bold tracking-wide">Synthesizing Videos & Audio...</p>
                   <p className="text-xs text-gray-500">Veo is rendering motion. Gemini TTS is generating voiceovers.</p>
               </div>
           ) : (
             <div className="flex flex-col items-center gap-4">
                {/* Audio Toggle */}
                <button 
                  onClick={() => setIncludeAudio(!includeAudio)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${includeAudio ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-white/5 border-white/10 text-gray-500'}`}
                >
                    {includeAudio ? <SpeakerWaveIcon className="w-4 h-4" /> : <SpeakerXMarkIcon className="w-4 h-4" />}
                    <span className="text-xs font-bold uppercase tracking-wider">{includeAudio ? "Include Audio Tracks" : "Mute Generated Audio"}</span>
                </button>

                <button 
                  onClick={() => onApprove(includeAudio)}
                  className="px-10 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-full text-lg shadow-[0_0_30px_rgba(168,85,247,0.4)] hover:shadow-[0_0_50px_rgba(168,85,247,0.6)] transition-all transform hover:scale-105 flex items-center justify-center gap-3 mx-auto"
                >
                  <FilmIcon className="w-6 h-6" />
                  Render Timeline
                  <ArrowRightIcon className="w-5 h-5 opacity-70" />
                </button>
             </div>
           )}
      </div>
    </div>
  );
};

export default StoryboardView;
