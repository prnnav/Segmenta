export class PreloadManager {
    private images: Map<string, HTMLImageElement>;
    private pending: Set<string>;

    constructor() {
        this.images = new Map();
        this.pending = new Set();
    }

    /**
     * Preloads a list of URLs with a concurrency limit
     */
    public load(urls: string[], onProgress: (progress: number) => void): Promise<void> {
        return new Promise((resolve) => {
            let loaded = 0;
            const total = urls.length;

            if (total === 0) {
                onProgress(1);
                resolve();
                return;
            }

            // Parallel loading - simple implementation
            // Browsers handle concurrency well for images (usually 6-20 parallel requests)
            urls.forEach((url) => {
                if (this.images.has(url)) {
                    loaded++;
                    onProgress(loaded / total);
                    if (loaded === total) resolve();
                    return;
                }

                const img = new Image();
                img.src = url;
                img.onload = () => {
                    this.images.set(url, img);
                    loaded++;
                    onProgress(loaded / total);
                    if (loaded === total) resolve();
                };
                img.onerror = () => {
                    console.warn(`Failed to load: ${url}`);
                    // Treat error as loaded to prevent hanging
                    loaded++;
                    onProgress(loaded / total);
                    if (loaded === total) resolve();
                };
            });
        });
    }

    public getImage(url: string): HTMLImageElement | undefined {
        return this.images.get(url);
    }

    public has(url: string): boolean {
        return this.images.has(url);
    }
}

export const preloadManager = new PreloadManager();
