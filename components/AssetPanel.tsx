
import React, { useRef, useCallback } from 'react';
import { Asset, AssetType } from '../types';
import { VideoCameraIcon, PhotoIcon, MusicalNoteIcon, CloudArrowUpIcon, DocumentTextIcon, Square2StackIcon, SparklesIcon, BeakerIcon } from '@heroicons/react/24/outline';
import { fileToBase64 } from '../utils/helpers';
import { transcribeAudio } from '../services/geminiService';

interface AssetPanelProps {
  assets: Asset[];
  onSelectAsset: (asset: Asset) => void;
  onAddAsset: (asset: Asset) => void;
  setGlobalLoading: (loading: boolean, msg?: string) => void;
}

const AssetPanel: React.FC<AssetPanelProps> = ({ assets, onSelectAsset, onAddAsset, setGlobalLoading }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
      const url = URL.createObjectURL(file);
      const base64 = await fileToBase64(file);
      
      let type = AssetType.IMAGE;
      if (file.type.startsWith('video')) type = AssetType.VIDEO;
      if (file.type.startsWith('audio')) type = AssetType.AUDIO;

      // Extract duration for time-based media
      let duration = 0;
      if (type === AssetType.VIDEO || type === AssetType.AUDIO) {
          try {
              duration = await new Promise((resolve) => {
                  const media = document.createElement(type === AssetType.VIDEO ? 'video' : 'audio');
                  media.preload = 'metadata';
                  media.onloadedmetadata = () => {
                      resolve(media.duration);
                  };
                  media.onerror = () => resolve(0);
                  media.src = url;
              });
          } catch (e) {
              console.warn("Could not extract duration", e);
          }
      }

      const newAsset: Asset = {
        id: crypto.randomUUID(),
        type,
        url,
        name: file.name,
        mimeType: file.type,
        base64,
        category: 'upload',
        metadata: {
            duration: duration > 0 ? duration : undefined
        }
      };
      
      onAddAsset(newAsset);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      Array.from(e.target.files).forEach(processFile);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          Array.from(e.dataTransfer.files).forEach(processFile);
      }
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
  };

  const handleDragStart = (e: React.DragEvent, asset: Asset) => {
      e.dataTransfer.setData("application/json", JSON.stringify(asset));
      e.dataTransfer.effectAllowed = "copy";
  };

  const handleTranscribe = async (asset: Asset) => {
    if (asset.type !== AssetType.AUDIO) return;
    setGlobalLoading(true, "Transcribing Audio...");
    try {
        const text = await transcribeAudio(asset.base64 || "", asset.mimeType);
        alert(`Transcription:\n\n${text}`);
    } catch (e) {
        console.error(e);
        alert("Transcription failed.");
    } finally {
        setGlobalLoading(false);
    }
  }

  // --- Group Assets ---
  const generatedAssets = assets.filter(a => a.category === 'generated');
  const surgicalAssets = assets.filter(a => a.category === 'surgical');
  const uploadAssets = assets.filter(a => !a.category || a.category === 'upload');

  const renderAssetList = (list: Asset[], emptyMsg: string) => {
      if (list.length === 0) return <div className="text-[10px] text-gray-500 italic px-2">{emptyMsg}</div>;
      return list.map(asset => (
          <div 
            key={asset.id} 
            draggable
            onDragStart={(e) => handleDragStart(e, asset)}
            className="group relative p-2 rounded-lg bg-white/5 hover:bg-white/10 cursor-grab active:cursor-grabbing transition-all border border-transparent hover:border-white/10 backdrop-blur-sm"
            onClick={() => onSelectAsset(asset)}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-black/40 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden relative border border-white/5">
                {asset.type === AssetType.IMAGE && <img src={asset.url} alt={asset.name} className="w-full h-full object-cover" />}
                {asset.type === AssetType.VIDEO && <VideoCameraIcon className="w-5 h-5 text-gray-400" />}
                {asset.type === AssetType.AUDIO && <MusicalNoteIcon className="w-5 h-5 text-gray-400" />}
                
                <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-all"></div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-200 truncate group-hover:text-white transition-colors">{asset.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] bg-black/40 px-1.5 py-0.5 rounded text-gray-400 uppercase font-bold tracking-wider">{asset.type}</span>
                    {asset.metadata?.duration && <span className="text-[9px] text-emerald-400 font-mono">{asset.metadata.duration.toFixed(1)}s</span>}
                </div>
              </div>
            </div>
            {/* Quick Actions overlay */}
            {asset.type === AssetType.AUDIO && (
                <button 
                    onClick={(e) => { e.stopPropagation(); handleTranscribe(asset); }}
                    className="absolute right-2 top-2 p-1 bg-black/60 rounded text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
                    title="Transcribe"
                >
                    <DocumentTextIcon className="w-3 h-3" />
                </button>
            )}
          </div>
      ));
  }

  return (
    <div className="w-64 bg-black/20 border-r border-white/5 flex flex-col h-full z-30 shadow-xl backdrop-blur-xl">
      <div className="p-4 border-b border-white/5">
        <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2 uppercase tracking-widest opacity-80">
            <Square2StackIcon className="w-4 h-4 text-emerald-400" />
            Library
        </h2>
        
        {/* Smart Ingest Dropzone */}
        <div 
            className="w-full h-24 border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-gray-500 hover:border-emerald-500/50 hover:text-emerald-400 hover:bg-white/5 transition-all cursor-pointer group"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
        >
          <CloudArrowUpIcon className="w-6 h-6 mb-1 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-bold">Drop Media Here</span>
          <span className="text-[10px] opacity-50 group-hover:opacity-80">MP4, PNG, MP3</span>
        </div>

        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          multiple
          accept="image/*,video/*,audio/*"
          onChange={handleFileUpload}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-6 custom-scrollbar">
        
        {/* Generated Section */}
        <div>
            <h3 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-2 px-1 opacity-90">
                <SparklesIcon className="w-3 h-3" /> New Generations
            </h3>
            <div className="space-y-1">
                {renderAssetList(generatedAssets, "No generated assets yet.")}
            </div>
        </div>

        {/* Surgical Section */}
        <div>
            <h3 className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-2 flex items-center gap-2 px-1 border-t border-white/5 pt-4 opacity-90">
                <BeakerIcon className="w-3 h-3" /> Surgical Edits
            </h3>
            <div className="space-y-1">
                {renderAssetList(surgicalAssets, "No edits yet.")}
            </div>
        </div>

        {/* Uploads Section */}
        <div>
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2 px-1 border-t border-white/5 pt-4 opacity-90">
                <CloudArrowUpIcon className="w-3 h-3" /> Uploads
            </h3>
             <div className="space-y-1">
                {renderAssetList(uploadAssets, "Drag files to start.")}
            </div>
        </div>

      </div>
    </div>
  );
};

export default AssetPanel;
