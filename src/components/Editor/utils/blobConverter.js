// utils/blobConverter.js

/**
 * Converts blob URLs in HTML to base64 data URIs
 * Optimized for speed and memory efficiency
 * @param {string} html - HTML string containing blob URLs
 * @returns {Promise<string>} HTML with base64 images
 */
export async function convertBlobURLsToBase64(html) {
    if (!html.includes('blob:')) return html;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const images = tempDiv.querySelectorAll('img[src^="blob:"]');

    if (images.length === 0) return html;

    // Process in chunks to avoid memory spikes (5 at a time)
    const CHUNK_SIZE = 5;
    const imageArray = Array.from(images);

    for (let i = 0; i < imageArray.length; i += CHUNK_SIZE) {
        const chunk = imageArray.slice(i, i + CHUNK_SIZE);

        await Promise.all(
            chunk.map(async (img) => {
                try {
                    const response = await fetch(img.src);
                    const blob = await response.blob();

                    // FileReader is ALWAYS faster - it's native C++ code
                    // The browser optimizes this internally
                    const base64 = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });

                    img.src = base64;
                } catch (error) {
                    console.error('Failed to convert blob URL:', error);
                    // Leave original src on error
                }
            })
        );
    }

    return tempDiv.innerHTML;
}

export default convertBlobURLsToBase64;