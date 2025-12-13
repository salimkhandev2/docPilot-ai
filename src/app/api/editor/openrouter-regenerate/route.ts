import { NextRequest } from "next/server";
import OpenAI from 'openai';

//======================================================================
// OpenRouter API Configuration
//======================================================================
const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
});

// Available models - can be selected via request body
const DEFAULT_MODEL = "z-ai/glm-4.5-air:free";
export const OPENROUTER_MODELS = [
    "z-ai/glm-4.5-air:free",
    "arcee-ai/trinity-mini:free",
    "kwaipilot/kat-coder-pro:free",
    "tngtech/deepseek-r1t2-chimera:free",
    "mistralai/devstral-2512:free",
    "nvidia/nemotron-nano-12b-v2-vl:free",
    "amazon/nova-2-lite-v1:free",
    "openai/gpt-oss-20b:free",
    "google/gemma-3-27b-it:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "nex-agi/deepseek-v3.1-nex-n1:free",
    "alibaba/tongyi-deepresearch-30b-a3b:free",
    "nousresearch/hermes-3-llama-3.1-405b:free",
    "nvidia/nemotron-nano-9b-v2:free",
    "mistralai/mistral-small-3.1-24b-instruct:free",
    "qwen/qwen3-4b:free",
    "google/gemma-3-12b-it:free",
    "google/gemma-3n-e2b-it:free",
    "google/gemma-3-4b-it:free"
];

//======================================================================
// OPENROUTER AI STREAMING HANDLER
// Text-only generation (no image support)
//======================================================================
export async function POST(request: NextRequest) {
    try {
        // Parse JSON request
        const body = await request.json();
        const { originalHTML, userRequest, customPrompt, model } = body;

        // Validate API key
        if (!process.env.OPENROUTER_API_KEY) {
            return new Response(
                JSON.stringify({ error: "OpenRouter API key not configured" }),
                {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }

        // Determine prompt based on request type
        let prompt: string;
        if (originalHTML && userRequest) {
            // HTML modification request
            prompt = `You are an expert web developer. Modify the HTML based on the user's request.

ORIGINAL HTML:
${originalHTML}
USER REQUEST:
${userRequest}

STRICT RULES:
- Your response must contain ONLY HTML code. Nothing else.
- DO NOT write any text before the HTML (no "Here is...", no "I've...", no explanations).
- DO NOT write any text after the HTML (no "Key improvements:", no summaries, no notes).
- If the user asks to "clone" or replicate a UI, use Tailwind CSS classes for all styling. Do not use inline CSS for cloning.
- For icons, use Font Awesome classes: <i class="fas fa-[icon-name]"></i> (solid), <i class="far fa-[icon-name]"></i> (regular), <i class="fab fa-[icon-name]"></i> (brands).
- When cloning a UI from an image, use Tailwind CSS for layout/structure.
- For style modifications to existing HTML, prefer inline CSS over adding new Tailwind classes.
- Return a single HTML output only.
- DO NOT use \`\`\`html or \`\`\` code blocks.
- DO NOT include <!DOCTYPE>, <html>, <head>, or <body> tags.
- Preserve all id and class attributes unless instructed otherwise.
- DO NOT add any animations, transitions, or hover effects (no scale, transform, transition, hover: classes, etc.).
Generate the modified HTML now:`;
        } else if (customPrompt) {
            // Custom prompt
            prompt = customPrompt;
        } else {
            return new Response(
                JSON.stringify({ error: "Either (originalHTML + userRequest) OR customPrompt is required" }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }

        console.log(`🚀 Starting OpenRouter stream... Model: ${model || 'z-ai/glm-4.5-air:free (default)'}\n`);

        // Create a streaming response using Server-Sent Events
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                let streamClosed = false;
                let fullHTML = '';
                let chunkCount = 0;

                const sendChunk = (chunk: string, isComplete: boolean = false) => {
                    if (streamClosed) return;
                    try {
                        const data = JSON.stringify({
                            chunk,
                            isComplete,
                            accumulatedLength: fullHTML.length
                        });
                        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                    } catch (error: any) {
                        streamClosed = true;
                        const isInvalidState = error?.code === 'ERR_INVALID_STATE';
                        if (!isInvalidState) {
                            console.error('[OpenRouter] Error sending chunk:', error);
                        }
                    }
                };

                const sendError = (error: string) => {
                    if (streamClosed) return;
                    try {
                        const data = JSON.stringify({ error });
                        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                    } catch (e) {
                        console.error('[OpenRouter] Error sending error:', e);
                    }
                };

                try {
                    // Use OpenAI SDK with streaming
                    const openRouterStream = await client.chat.completions.create({
                        model: model || DEFAULT_MODEL, // Default model if none provided
                        messages: [
                            {
                                role: "user",
                                content: prompt
                            }
                        ],
                        max_tokens: 5000,
                        temperature: 0.7,
                        stream: true
                    });

                    // Stream chunks from OpenRouter
                    for await (const chunk of openRouterStream) {
                        const content = chunk.choices[0]?.delta?.content || '';

                        if (content) {
                            chunkCount++;
                            fullHTML += content;

                            // Log chunk preview
                            console.log(`[Chunk ${chunkCount}] ${content}`);

                            // Send chunk to client
                            sendChunk(content, false);

                            if (chunkCount % 5 === 0) {
                                console.log(`📦 Processed ${chunkCount} chunks (${fullHTML.length} chars)`);
                            }
                        }
                    }

                    console.log(`✅ Stream complete: ${chunkCount} chunks, ${fullHTML.length} total chars`);

                    // Send completion signal
                    sendChunk('', true);

                    streamClosed = true;
                    controller.close();

                } catch (error: any) {
                    console.error("❌ OpenRouter AI Stream Error:", error);
                    sendError(`AI streaming failed: ${error.message}`);
                    streamClosed = true;
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (error: any) {
        console.error("❌ Error in OpenRouter route:", error);
        return new Response(
            JSON.stringify({ error: `Failed to process request: ${error.message}` }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}
