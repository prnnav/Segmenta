
import React, { useEffect, useState, useRef } from 'react';
import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/solid';
import { TimelineSegment, Asset } from '../types';
import { renderTimeline } from '../services/ffmpegService';

interface RenderModalProps {
    segments: TimelineSegment[];
    assets: Asset[];
    onClose: () => void;
}

const RenderModal: React.FC<RenderModalProps> = ({ segments, assets, onClose }) => {
    const [progress, setProgress] = useState(0);
    const [stage, setStage] = useState('Initializing...');
    const [state, setState] = useState<'rendering' | 'done' | 'error'>('rendering');
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [error, setError] = useState<string>('');
    const [logs, setLogs] = useState<string[]>(['[init] Segmenta Export Engine v1.0']);
    const renderStarted = useRef(false);
    const logsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (renderStarted.current) return;
        renderStarted.current = true;

        const handleProgress = (p: number, s: string) => {
            setProgress(Math.min(p * 100, 100));
            setStage(s);
            setLogs(prev => [...prev.slice(-50), `[${(p * 100).toFixed(0).padStart(3, ' ')}%] ${s}`]);
        };

        renderTimeline(segments, assets, handleProgress)
            .then(url => {
                setDownloadUrl(url);
                setState('done');
                setProgress(100);
            })
            .catch(err => {
                console.error('[RenderModal] Export error:', err);
                setError(err.message || 'An unknown error occurred during export.');
                setState('error');
            });
    }, [segments, assets]);

    // Auto-scroll logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const handleDownload = () => {
        if (!downloadUrl) return;
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `segmenta_export_${Date.now()}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const fileSizeMB = downloadUrl ? '—' : '0';

    return (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center backdrop-blur-sm">
            <div className="w-[540px] bg-gray-900/95 border border-white/10 rounded-2xl p-6 shadow-2xl relative backdrop-blur-xl overflow-hidden">
                {/* Gradient accent bar */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-purple-500 to-emerald-500"></div>

                {/* ─── RENDERING STATE ─── */}
                {state === 'rendering' && (
                    <>
                        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                            </span>
                            Rendering Timeline
                        </h3>

                        <div className="space-y-4">
                            {/* Progress label */}
                            <div className="flex justify-between text-xs text-gray-400 font-mono">
                                <span className="truncate mr-4 max-w-[380px]">{stage}</span>
                                <span className="text-emerald-400 font-bold">{Math.floor(progress)}%</span>
                            </div>

                            {/* Progress bar */}
                            <div className="h-2.5 bg-black/60 rounded-full overflow-hidden border border-white/5">
                                <div
                                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500 ease-out rounded-full relative"
                                    style={{ width: `${Math.max(progress, 1)}%` }}
                                >
                                    <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full"></div>
                                </div>
                            </div>

                            {/* Log terminal */}
                            <div className="h-44 bg-black/70 rounded-xl border border-white/5 p-3 font-mono text-[10px] text-emerald-400/80 overflow-y-auto custom-scrollbar backdrop-blur-sm">
                                {logs.map((log, i) => (
                                    <div key={i} className="leading-relaxed opacity-80 hover:opacity-100 transition-opacity">{log}</div>
                                ))}
                                <div ref={logsEndRef} className="text-emerald-500 animate-pulse">▊</div>
                            </div>

                            {/* Cancel hint */}
                            <p className="text-[10px] text-gray-600 text-center">
                                FFmpeg WASM is processing in your browser. This may take a moment.
                            </p>
                        </div>
                    </>
                )}

                {/* ─── DONE STATE ─── */}
                {state === 'done' && (
                    <div className="text-center py-8">
                        <div className="relative inline-block mb-4">
                            <CheckCircleIcon className="w-16 h-16 text-emerald-500" />
                            <div className="absolute inset-0 w-16 h-16 rounded-full bg-emerald-500/20 animate-ping"></div>
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">Export Complete</h3>
                        <p className="text-gray-400 text-sm mb-6">
                            Your timeline has been rendered and is ready to download.
                        </p>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={onClose}
                                className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white text-sm transition-all hover:scale-[1.02]"
                            >
                                Close
                            </button>
                            <button
                                onClick={handleDownload}
                                className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black font-bold rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/30 hover:scale-[1.02]"
                            >
                                Download MP4
                            </button>
                        </div>
                    </div>
                )}

                {/* ─── ERROR STATE ─── */}
                {state === 'error' && (
                    <div className="text-center py-8">
                        <ExclamationCircleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
                        <h3 className="text-2xl font-bold text-white mb-2">Export Failed</h3>
                        <p className="text-red-300 text-xs mb-6 font-mono bg-red-500/10 p-3 rounded-lg border border-red-500/20 text-left max-h-24 overflow-y-auto">
                            {error}
                        </p>

                        {/* Show logs for debugging */}
                        <details className="text-left mb-4">
                            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300 transition-colors">Show debug logs</summary>
                            <div className="mt-2 h-32 bg-black/60 rounded-lg p-2 font-mono text-[10px] text-gray-500 overflow-y-auto custom-scrollbar">
                                {logs.map((log, i) => (
                                    <div key={i}>{log}</div>
                                ))}
                            </div>
                        </details>

                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={onClose}
                                className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white text-sm transition-all"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RenderModal;
