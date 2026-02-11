
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { TimelineSegment, TrackType, AssetType, Asset } from '../types';

let ffmpeg: FFmpeg | null = null;

type ProgressCallback = (progress: number, stage: string) => void;

const CORE_VERSION = '0.12.6';
const BASE_URL = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/esm`;

const getExtension = (mimeType?: string): string => {
    const map: Record<string, string> = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/webp': 'webp',
        'video/mp4': 'mp4',
        'video/webm': 'webm',
        'audio/wav': 'wav',
        'audio/mpeg': 'mp3',
        'audio/aac': 'aac',
    };
    return map[mimeType || ''] || 'bin';
};

export const loadFFmpeg = async (onProgress?: ProgressCallback): Promise<FFmpeg> => {
    if (ffmpeg && ffmpeg.loaded) return ffmpeg;

    ffmpeg = new FFmpeg();

    ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg]', message);
    });

    onProgress?.(0.02, 'Downloading FFmpeg WASM core...');

    await ffmpeg.load({
        coreURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    return ffmpeg;
};

export const renderTimeline = async (
    segments: TimelineSegment[],
    assets: Asset[],
    onProgress: ProgressCallback
): Promise<string> => {
    const ff = await loadFFmpeg(onProgress);

    // Sort video segments by start frame
    const videoSegments = segments
        .filter(s => s.trackId === TrackType.VIDEO_MAIN && s.assetUrl)
        .sort((a, b) => a.startFrame - b.startFrame);

    const audioSegments = segments
        .filter(s => s.trackId === TrackType.AUDIO && s.assetUrl)
        .sort((a, b) => a.startFrame - b.startFrame);

    if (videoSegments.length === 0) {
        throw new Error('No video segments found on the timeline. Add clips to the V1 MAIN track first.');
    }

    // ========================================
    // STEP 1: Normalize each segment to a clip
    // ========================================
    const clipNames: string[] = [];

    for (let i = 0; i < videoSegments.length; i++) {
        const seg = videoSegments[i];
        const stepProgress = 0.05 + (i / videoSegments.length) * 0.55;
        onProgress(stepProgress, `Encoding clip ${i + 1}/${videoSegments.length}: "${seg.label}"`);

        const asset = assets.find(a => a.id === seg.assetId);
        const ext = getExtension(asset?.mimeType || (seg.assetType === AssetType.IMAGE ? 'image/png' : 'video/mp4'));
        const inputName = `input_${i}.${ext}`;
        const outputName = `clip_${i}.mp4`;

        try {
            // Fetch media bytes and write to FFmpeg FS
            const fileData = await fetchFile(seg.assetUrl!);
            await ff.writeFile(inputName, fileData);

            if (seg.assetType === AssetType.IMAGE) {
                // Image → short video clip
                await ff.exec([
                    '-loop', '1',
                    '-i', inputName,
                    '-t', String(Math.max(1, seg.duration)),
                    '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,format=yuv420p',
                    '-r', '30',
                    '-c:v', 'libx264',
                    '-preset', 'ultrafast',
                    '-pix_fmt', 'yuv420p',
                    outputName
                ]);
            } else {
                // Video → re-encode for consistency
                await ff.exec([
                    '-i', inputName,
                    '-t', String(Math.max(1, seg.duration)),
                    '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,format=yuv420p',
                    '-r', '30',
                    '-c:v', 'libx264',
                    '-preset', 'ultrafast',
                    '-pix_fmt', 'yuv420p',
                    '-an',
                    outputName
                ]);
            }

            clipNames.push(outputName);
        } catch (err) {
            console.error(`[FFmpeg] Failed to process clip ${i}:`, err);
            // Continue with remaining clips
        }

        // Cleanup input file to save memory
        try { await ff.deleteFile(inputName); } catch { }
    }

    if (clipNames.length === 0) {
        throw new Error('All clips failed to encode. Check your media files.');
    }

    // ========================================
    // STEP 2: Concatenate all normalized clips
    // ========================================
    onProgress(0.65, `Concatenating ${clipNames.length} clips...`);

    if (clipNames.length === 1) {
        // Single clip — just rename
        const data = await ff.readFile(clipNames[0]);
        await ff.writeFile('video_only.mp4', data);
    } else {
        // Create concat list file
        const concatList = clipNames.map(name => `file '${name}'`).join('\n');
        await ff.writeFile('concat.txt', concatList);

        await ff.exec([
            '-f', 'concat',
            '-safe', '0',
            '-i', 'concat.txt',
            '-c', 'copy',
            'video_only.mp4'
        ]);

        try { await ff.deleteFile('concat.txt'); } catch { }
    }

    // Cleanup individual clips
    for (const name of clipNames) {
        try { await ff.deleteFile(name); } catch { }
    }

    // ========================================
    // STEP 3: Mix in audio (if any)
    // ========================================
    let finalOutput = 'video_only.mp4';

    if (audioSegments.length > 0) {
        onProgress(0.75, `Mixing ${audioSegments.length} audio track(s)...`);

        const audioInputArgs: string[] = ['-i', 'video_only.mp4'];
        const filterParts: string[] = [];
        const mixLabels: string[] = [];
        let validAudioCount = 0;

        for (let i = 0; i < audioSegments.length; i++) {
            const seg = audioSegments[i];
            if (!seg.assetUrl) continue;

            const asset = assets.find(a => a.id === seg.assetId);
            const ext = getExtension(asset?.mimeType || 'audio/wav');
            const audioName = `audio_${i}.${ext}`;

            try {
                const audioData = await fetchFile(seg.assetUrl);
                await ff.writeFile(audioName, audioData);
                audioInputArgs.push('-i', audioName);

                const delayMs = Math.round((seg.startFrame / 30) * 1000);
                const inputIdx = validAudioCount + 1; // 0 is video_only.mp4
                filterParts.push(`[${inputIdx}:a]adelay=${delayMs}|${delayMs},apad[a${validAudioCount}]`);
                mixLabels.push(`[a${validAudioCount}]`);
                validAudioCount++;
            } catch (err) {
                console.warn(`[FFmpeg] Failed to load audio ${i}:`, err);
            }
        }

        if (validAudioCount > 0) {
            const mixFilter = `${filterParts.join(';')};${mixLabels.join('')}amix=inputs=${validAudioCount}:normalize=0[aout]`;

            try {
                await ff.exec([
                    ...audioInputArgs,
                    '-filter_complex', mixFilter,
                    '-map', '0:v',
                    '-map', '[aout]',
                    '-c:v', 'copy',
                    '-c:a', 'aac',
                    '-b:a', '128k',
                    '-shortest',
                    'final_output.mp4'
                ]);
                finalOutput = 'final_output.mp4';
            } catch (err) {
                console.warn('[FFmpeg] Audio mixing failed, exporting video only:', err);
            }
        }

        // Cleanup audio files
        for (let i = 0; i < audioSegments.length; i++) {
            try { await ff.deleteFile(`audio_${i}.wav`); } catch { }
        }
    }

    // ========================================
    // STEP 4: Read output and create download URL
    // ========================================
    onProgress(0.92, 'Packaging final MP4...');
    const outputData = await ff.readFile(finalOutput);

    // Cleanup
    try { await ff.deleteFile('video_only.mp4'); } catch { }
    try { await ff.deleteFile('final_output.mp4'); } catch { }

    const rawData = outputData instanceof Uint8Array ? new Uint8Array(outputData) : new TextEncoder().encode(outputData as string);
    const blob = new Blob(
        [rawData],
        { type: 'video/mp4' }
    );
    const url = URL.createObjectURL(blob);

    onProgress(1.0, 'Export complete!');
    return url;
};
