
export const generateVideoPollinations = async (prompt: string, aspectRatio: '16:9' | '9:16' = '16:9', seed?: number, imageUrl?: string): Promise<string> => {
    console.log(`[Pollinations] Starting generation. Prompt: "${prompt.slice(0, 20)}...", HasImage: ${!!imageUrl}`);

    const width = aspectRatio === '16:9' ? 1280 : 720;
    const height = aspectRatio === '16:9' ? 720 : 1280;
    const finalSeed = seed !== undefined ? seed : Math.floor(Math.random() * 10000);
    const negativePrompt = "low quality, text, error, cropped, worst quality, low resolution, jpeg artifacts, ugly, duplicate, morbid, mutilated, out of frame, extra fingers, mutated hands, poorly drawn hands, poorly drawn face, mutation, deformed, blurry, dehydrated, bad anatomy, bad proportions, extra limbs, cloned face, disfigured, gross proportions, malformed limbs, missing arms, missing legs, extra arms, extra legs, fused fingers, too many fingers, long neck";

    // 1. Prepare Key
    let rawKey = process.env.POLLINATIONS_API_KEY || "";
    let cleanKey = rawKey.split(/[\s\?]+/)[0].trim();
    if (cleanKey.match(/(Fix|Error|Trace|Unexpected)/i) || cleanKey.length < 10) {
        console.warn("[Pollinations] Key appeared corrupted. Discarding.");
        cleanKey = "";
    }

    // 2. Helper to fetch
    const fetchVideo = async (useKey: boolean): Promise<Blob> => {
        const endpoint = 'https://text2video.pollinations.ai/';
        
        const params = new URLSearchParams({
            model: 'wan',
            width: width.toString(),
            height: height.toString(),
            seed: finalSeed.toString(),
            negative_prompt: negativePrompt,
        });
        
        if (imageUrl) {
            params.append('image', imageUrl);
        }
        
        if (useKey && cleanKey) {
            params.append('api_key', cleanKey);
        }

        const url = `${endpoint}${encodeURIComponent(prompt)}?${params.toString()}`;

        console.log(`[Pollinations] Fetching: ${useKey ? 'Authenticated' : 'Free Tier'} URL: ${url}`);

        const response = await fetch(url, {
            method: 'GET',
        });

        if (!response.ok) {
            const err = await response.text().catch(() => "Unknown");
            throw new Error(`${response.status}: ${err}`);
        }

        const blob = await response.blob();
        if (blob.size < 1000) throw new Error("Video too small (likely error)");
        return blob;
    };

    try {
        let blob: Blob;
        
        // Attempt 1: Authenticated (if key exists)
        if (cleanKey) {
            try {
                blob = await fetchVideo(true);
            } catch (e) {
                console.warn("[Pollinations] Auth failed, retrying free tier...", e);
                blob = await fetchVideo(false);
            }
        } else {
            blob = await fetchVideo(false);
        }

        return URL.createObjectURL(blob);

    } catch (error: any) {
        console.error("[Pollinations] Generation Failed:", error);
        
        // --- FALLBACK FOR DEMO ---
        console.warn("[Pollinations] Returning remote fallback URL due to error.");
        return "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4";
    }
};
