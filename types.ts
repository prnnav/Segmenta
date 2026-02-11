
export enum AssetType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO'
}

export type PlaybackMode = 'ASSET' | 'TIMELINE';

export interface Asset {
  id: string;
  type: AssetType;
  url: string; // Blob URL or remote URL
  name: string;
  base64?: string; // Cache for API calls
  mimeType: string;
  parentId?: string; // For version stack
  version?: number;
  category?: 'upload' | 'generated' | 'surgical';
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
  };
}

export enum TrackType {
  VIDEO_MAIN = 'VIDEO_MAIN',
  OVERLAY = 'OVERLAY',
  AUDIO = 'AUDIO'
}

export interface TimelineSegment {
  id: string;
  assetId: string;
  trackId: TrackType;
  startFrame: number; // Simulated frame index
  endFrame: number;
  duration: number; // in seconds
  label: string;
  isAiGenerated: boolean;
  continuityScore?: number; // 0-100 score with next clip
  linkedSegmentId?: string; // For A/V sync (Decoupled Cut)
  // We need to store the asset URL directly on the segment for easier rendering
  assetUrl?: string; 
  assetType?: AssetType;
  metadata?: {
      overlayX?: number; // 0-1 relative position
      overlayY?: number;
      maskData?: string; // Base64 mask for surgery
  }
}

export interface StoryboardSegment {
  id: number;
  action: string;
  frame_a_prompt: string;
  frame_b_prompt: string;
  camera_movement: string;
  voiceover_script?: string; // New: Audio script
  imgA?: Asset; 
  imgB?: Asset;
  audio?: Asset; // New: Generated Audio
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export enum GeneratorModel {
  GEMINI_2_5_FLASH_IMAGE = 'gemini-2.5-flash-image', // For generation and editing
  GEMINI_3_PRO = 'gemini-3-pro-preview', // Logic/Chat/Analysis/Continuity
  GEMINI_3_FLASH = 'gemini-3-flash-preview', // Transcription
  GEMINI_TTS = 'gemini-2.5-flash-preview-tts' // Audio
}
