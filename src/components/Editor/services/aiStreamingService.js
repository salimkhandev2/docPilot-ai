import { cleanAIResponse } from "../utils/htmlSanitizer";

// ======================================================================
// GEMINI AI STREAMING (via backend)
// ======================================================================
export async function streamGeminiAI(originalHTML, userRequest, imageFile, imageUrl, model, physH, physW, onChunk) {
    try {
        console.log("🚀 Starting Gemini AI stream via backend...");

        let response;

        if (imageFile) {
            const formData = new FormData();
            formData.append("originalHTML", originalHTML);
            formData.append("userRequest", userRequest);
            formData.append("image", imageFile);
            if (imageUrl) formData.append("imageUrl", imageUrl);
            response = await fetch("/api/editor/ai-regenerate", { method: "POST", body: formData });
        } else if (imageUrl) {
            response = await fetch("/api/editor/ai-regenerate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ originalHTML, userRequest, imageUrl }),
            });
        } else {
            response = await fetch("/api/editor/ai-regenerate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ originalHTML, userRequest }),
            });
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        if (!response.body) throw new Error("Response body is null");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullHTML = "";
        let chunkCount = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.error) throw new Error(data.error);
                        if (data.chunk !== undefined) {
                            chunkCount++;
                            fullHTML += data.chunk;
                            if (onChunk) onChunk(data.chunk, data.isComplete || false);
                            if (data.isComplete) console.log(`✅ Stream complete: ${chunkCount} chunks, ${fullHTML.length} total chars`);
                        }
                    } catch (parseError) { console.warn("Failed to parse SSE data:", parseError); }
                }
            }
        }

        fullHTML = cleanAIResponse(fullHTML, physH, physW);
        return fullHTML;
    } catch (error) {
        console.error("❌ Backend AI Stream Error:", error);
        throw new Error(`AI streaming failed: ${error.message}`);
    }
}

// ======================================================================
// OPENROUTER AI STREAMING (via backend)
// ======================================================================
export async function streamOpenRouterAI(originalHTML, userRequest, imageFile, imageUrl, model, physH, physW, onChunk) {
    try {
        console.log("🚀 Starting OpenRouter AI stream via backend...");
        console.log("🤖 Using model:", model);

        const response = await fetch("/api/editor/openrouter-regenerate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ originalHTML, userRequest, model }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        if (!response.body) throw new Error("Response body is null");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullHTML = "";
        let chunkCount = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.error) throw new Error(data.error);
                        if (data.chunk !== undefined) {
                            chunkCount++;
                            fullHTML += data.chunk;
                            if (onChunk) onChunk(data.chunk, data.isComplete || false);
                            if (data.isComplete) console.log(`✅ OpenRouter stream complete: ${chunkCount} chunks, ${fullHTML.length} total chars`);
                        }
                    } catch (parseError) { console.warn("Failed to parse SSE data:", parseError); }
                }
            }
        }

        fullHTML = cleanAIResponse(fullHTML, physH, physW);
        return fullHTML;
    } catch (error) {
        console.error("❌ OpenRouter AI Stream Error:", error);
        throw new Error(`OpenRouter streaming failed: ${error.message}`);
    }
}
