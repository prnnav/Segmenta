
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { GeneratorModel, Asset, AssetType } from '../types';

let dynamicApiKey: string | null = null;

export const setDynamicApiKey = (key: string) => {
    dynamicApiKey = key;
};

// Helper to get client with current key
const getClient = () => {
    const apiKey = dynamicApiKey || process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
        throw new Error("API Key not found. Please select a key.");
    }
    return new GoogleGenAI({ apiKey });
};

// --- Chat & Orchestration ---
export const sendMessageToAssistant = async (history: { role: string, parts: string[] }[], message: string) => {
    const ai = getClient();
    const chat = ai.chats.create({
        model: GeneratorModel.GEMINI_3_PRO,
        config: {
            systemInstruction: "You are Ad-Iterate AI, a sophisticated creative director and technical assistant for video production. Help the user script ads, suggest visual edits, and debug their timeline.",
        },
        history: history.map(h => ({ role: h.role, parts: [{ text: h.parts[0] }] }))
    });

    const response = await chat.sendMessage({ message });
    return response.text;
};

// --- Multimodal Context Understanding ---
export const refinePromptWithMultimodalContext = async (userPrompt: string, assets: Asset[]): Promise<string> => {
    const ai = getClient();
    const parts: any[] = [{
        text: `
        You are a Prompt Engineer. Analyze these reference images/videos.
        Combine their style with the User Request: "${userPrompt}"
        Output a SINGLE, highly descriptive prompt.
    ` }];

    for (const asset of assets) {
        if (asset.base64) {
            parts.push({
                inlineData: {
                    mimeType: asset.mimeType,
                    data: asset.base64
                }
            });
        }
    }

    try {
        const response = await ai.models.generateContent({
            model: GeneratorModel.GEMINI_3_PRO,
            contents: { parts }
        });
        return response.text || userPrompt;
    } catch (e) {
        console.error("Context Refinement Failed:", e);
        return userPrompt;
    }
};

// --- Director Mode: Storyboard Generation ---
export const generateStoryboardStructure = async (userPrompt: string, contextAssets: Asset[] = []) => {
    const ai = getClient();

    const parts: any[] = [];

    // 1. Add Context Assets
    for (const asset of contextAssets) {
        if (asset.base64) {
            parts.push({
                inlineData: {
                    mimeType: asset.mimeType,
                    data: asset.base64
                }
            });
        }
    }

    // 2. Add System/User Prompt
    const promptText = `
        You are the 'Director Engine' for Segmenta. 
        Analyze the attached reference media (if any) and the user's idea: "${userPrompt}".
        
        Convert this into a structured 4-segment storyboard.
        
        Output: JSON object with:
        1. 'character_prompt': A highly detailed description of the main character/subject (face, clothes, style) based on the input text and visual references. This serves as the consistency anchor.
        2. 'segments': Array of 4 segments. Each has:
           - id: Integer
           - action: Summary
           - frame_a_prompt: Visual prompt for Start. MUST include "Consistent with character reference".
           - frame_b_prompt: Visual prompt for End. MUST include "Consistent with character reference".
           - camera_movement: 'Pan Right', 'Zoom In', etc.
           - voiceover_script: A short (1 sentence) voiceover line or sound description for this specific shot.

        Do NOT use markdown. Return raw JSON.
    `;
    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
        model: GeneratorModel.GEMINI_3_PRO,
        contents: { parts },
        config: { responseMimeType: "application/json" }
    });

    try {
        const json = JSON.parse(response.text || "{}");
        return json;
    } catch (e) {
        console.error("Failed to parse storyboard JSON", e);
        throw new Error("Director Agent failed to generate structure.");
    }
};

// --- Prompt Enhancement ---
export const enhancePrompt = async (input: string): Promise<string> => {
    if (input.length < 5) return "";
    const ai = getClient();
    try {
        const response = await ai.models.generateContent({
            model: GeneratorModel.GEMINI_3_FLASH,
            contents: {
                parts: [{ text: `Autocomplete this visual description (max 5 words): "${input}"` }]
            },
            config: { maxOutputTokens: 20 }
        });
        return response.text?.replace(/\n/g, '') || "";
    } catch (e) { return ""; }
};

// --- Image Generation (With Optional Reference for Consistency) ---
export const generateImage = async (prompt: string, referenceAsset?: { mimeType: string, base64: string }) => {
    const ai = getClient();

    const parts: any[] = [];

    // If we have a character anchor, pass it as the first part (Visual Prompting)
    if (referenceAsset) {
        parts.push({
            inlineData: {
                mimeType: referenceAsset.mimeType,
                data: referenceAsset.base64
            }
        });
        // Strengthen the prompt instruction
        parts.push({ text: `Using the style and character from the first image, generate: ${prompt}` });
    } else {
        parts.push({ text: prompt });
    }

    const response = await ai.models.generateContent({
        model: GeneratorModel.GEMINI_2_5_FLASH_IMAGE,
        contents: { parts },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            return `data:image/png;base64,${part.inlineData.data}`;
        }
    }
    throw new Error("No image generated");
};

// --- Image Editing ---
export const editImage = async (base64Image: string, mimeType: string, prompt: string) => {
    const ai = getClient();
    const response = await ai.models.generateContent({
        model: GeneratorModel.GEMINI_2_5_FLASH_IMAGE,
        contents: {
            parts: [
                { inlineData: { data: base64Image, mimeType: mimeType } },
                { text: prompt }
            ]
        }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            return `data:image/png;base64,${part.inlineData.data}`;
        }
    }
    throw new Error("No edited image returned");
};

// --- Audio Generation (TTS) ---
export const generateSpeech = async (text: string) => {
    if (!text) return null;
    const ai = getClient();

    // Using Gemini TTS capability
    const response = await ai.models.generateContent({
        model: GeneratorModel.GEMINI_TTS,
        contents: { parts: [{ text }] },
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' } // 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
                }
            }
        }
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
        return `data:audio/wav;base64,${base64Audio}`; // Gemini returns raw PCM usually but wrapped in a container for the API 
    }
    throw new Error("No audio generated");
};

// --- Video Generation (Veo 3.1) ---
export const generateVideo = async (
    prompt: string,
    aspectRatio: '16:9' | '9:16' = '16:9',
    images?: { mimeType: string; data: string }[]
) => {
    const ai = getClient();
    const model = 'veo-3.1-fast-generate-preview';

    try {
        let operation;

        if (images && images.length > 0) {
            const startImage = images[0];
            const endImage = images.length > 1 ? images[1] : undefined;

            const configPayload: any = {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: aspectRatio
            };

            if (endImage) {
                configPayload.lastFrame = {
                    imageBytes: endImage.data,
                    mimeType: endImage.mimeType
                };
            }

            operation = await ai.models.generateVideos({
                model,
                prompt: prompt || "Smooth cinematic movement",
                image: {
                    imageBytes: startImage.data,
                    mimeType: startImage.mimeType
                },
                config: configPayload
            });
        } else {
            operation = await ai.models.generateVideos({
                model,
                prompt,
                config: {
                    numberOfVideos: 1,
                    resolution: '720p',
                    aspectRatio: aspectRatio
                }
            });
        }

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            operation = await ai.operations.getVideosOperation({ operation });
        }

        const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!videoUri) throw new Error("Video generation failed or returned no URI.");

        const currentKey = dynamicApiKey || process.env.GEMINI_API_KEY || process.env.API_KEY;
        const response = await fetch(`${videoUri}&key=${currentKey}`);
        if (!response.ok) throw new Error("Failed to download generated video bytes.");

        const blob = await response.blob();
        return URL.createObjectURL(blob);

    } catch (error: any) {
        console.error("[GeminiService] Video Generation Failed:", error);
        if (error.toString().includes('403') || error.toString().includes('400') || error.toString().includes('Billing')) {
            console.warn("Falling back to simulation mode.");
            alert("Simulation Mode Active: Real Veo generation requires a paid billing project. A sample video will be used.");
            await new Promise(resolve => setTimeout(resolve, 2000));
            return "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4";
        }
        throw error;
    }
};

export const analyzeVideo = async (base64Video: string, mimeType: string, prompt: string) => {
    const ai = getClient();
    const response = await ai.models.generateContent({
        model: GeneratorModel.GEMINI_3_PRO,
        contents: {
            parts: [
                { inlineData: { data: base64Video, mimeType: mimeType } },
                { text: prompt }
            ]
        }
    });
    return response.text;
};

export const checkContinuity = async (base64FrameA: string, base64FrameB: string) => {
    const ai = getClient();
    const response = await ai.models.generateContent({
        model: GeneratorModel.GEMINI_3_PRO,
        contents: {
            parts: [
                { text: "Rate continuity 0-100 between these two frames." },
                { inlineData: { data: base64FrameA, mimeType: 'image/png' } },
                { inlineData: { data: base64FrameB, mimeType: 'image/png' } }
            ]
        }
    });
    return response.text;
};

export const transcribeAudio = async (base64Audio: string, mimeType: string) => {
    const ai = getClient();
    const response = await ai.models.generateContent({
        model: GeneratorModel.GEMINI_3_FLASH,
        contents: {
            parts: [
                { inlineData: { data: base64Audio, mimeType: mimeType } },
                { text: "Transcribe this audio precisely." }
            ]
        }
    });
    return response.text;
}
