import { fileToBuffer } from "@/lib/image-processing";
import { GoogleGenAI } from '@google/genai';
import { NextRequest } from "next/server";

//======================================================================
// IMAGE DOWNLOADING HELPERS (matching image-analysis.js pattern)
//======================================================================

// ---- Convert URL image → base64 ----
async function fetchImageAsBase64(url: string): Promise<string> {
  console.log(`🌐 Downloading image: ${url}`);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`❌ Failed to download image: ${res.status} ${res.statusText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer).toString("base64");
}

// ---- Determine MIME type ----
function getMimeType(pathOrUrl: string): string {
  const extension = pathOrUrl.split(".").pop()?.toLowerCase().split("?")[0] || '';

  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
  };

  return mimeMap[extension] || "image/png";
}

//======================================================================
// GEMINI AI STREAMING HANDLER
// Supports both JSON and FormData (file upload) requests
//======================================================================
export async function POST(request: NextRequest) {
  try {
    // Check if request is FormData (file upload) or JSON
    const contentType = request.headers.get('content-type') || '';
    const isFormData = contentType.includes('multipart/form-data');

    let originalHTML: string | undefined;
    let userRequest: string | undefined;
    let customPrompt: string | undefined;
    let imageData: string | null = null;
    let imageMimeType: string | null = null;
    let imageUrl: string | undefined;

    if (isFormData) {
      // Handle FormData (file upload from frontend)
      const formData = await request.formData();
      const imageFile = formData.get("image") as File | null;
      originalHTML = formData.get("originalHTML") as string | undefined;
      userRequest = formData.get("userRequest") as string | undefined;
      customPrompt = formData.get("customPrompt") as string | undefined;
      imageUrl = formData.get("imageUrl") as string | undefined;

      // Process uploaded image file
      if (imageFile && imageFile instanceof File) {
        console.log(`🖼  Processing uploaded image file: ${imageFile.name}\n`);
        const imageBuffer = await fileToBuffer(imageFile);
        imageData = imageBuffer.toString('base64');
        imageMimeType = imageFile.type || 'image/jpeg';
        console.log(`📤 Image uploaded(${imageMimeType}, ${imageBuffer.length} bytes)...\n`);
      }
    } else {
      // Handle JSON request
      const body = await request.json();
      originalHTML = body.originalHTML;
      userRequest = body.userRequest;
      customPrompt = body.customPrompt;
      imageData = body.imageData || null;
      imageMimeType = body.imageMimeType || null;
      imageUrl = body.imageUrl;
    }

    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Gemini API key not configured" }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const client = new GoogleGenAI({
      apiKey: apiKey,
    });

    // Determine prompt based on request type (similar to image-analysis.js)
    let prompt: string;
    if (originalHTML && userRequest) {
      // HTML modification request
      prompt = `You are an expert web developer. Modify the HTML based on the user's request.

ORIGINAL HTML:
${originalHTML}
USER REQUEST:
${userRequest}

STRICT RULES:

- Never use Tailwind classes; prefer inline CSS for all style changes.
- Always map internal CSS to the corresponding element (match by id) and keep existing internal CSS unless a property must change.
- If a property changes, update it in inline styles (no Tailwind).
- Return a single HTML output only.
- DO NOT use \\\html or \\\ code blocks.
- DO NOT include <!DOCTYPE>, <html>, <head>, or <body> tags.
- Preserve all id and class attributes unless instructed otherwise.
- DO NOT add any animations, transitions, or hover effects (no scale, transform, transition, hover: classes, etc.).

Generate the modified HTML now:`;
    } else if (customPrompt) {
      // Custom prompt (for image analysis or other use cases)
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

    // Build contents array (similar to image-analysis.js)
    let contents: any;
    let base64ImageData: string | null = null;
    let imageMime: string | null = null;

    if (imageData) {
      // Image provided as base64 string (from JSON or converted from File)
      console.log(`🖼  Processing prompt with image(base64)...\n`);
      base64ImageData = imageData;
      imageMime = imageMimeType || 'image/jpeg';
      console.log(`📤 Using image(${imageMime})...\n`);
    } else if (imageUrl) {
      // ---------------------
      // CASE: URL IMAGE (matching image-analysis.js pattern)
      // ---------------------
      console.log(`🖼  Processing prompt with image from URL: ${imageUrl}\n`);
      try {
        // Check if it's a URL
        if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
          // Download image from URL and convert to base64 (matching image-analysis.js)
          base64ImageData = await fetchImageAsBase64(imageUrl);
          imageMime = getMimeType(imageUrl);
          console.log(`📤 Image downloaded from URL(${imageMime})...\n`);
        } else {
          throw new Error("Invalid image URL. Must start with http:// or https://");
        }
      } catch (error: any) {
        console.error('❌ Error fetching image:', error);
        return new Response(
          JSON.stringify({ error: `Failed to fetch image: ${error.message}` }),
      {
        status: 400,
          headers: { 'Content-Type': 'application/json' }
      }
        );
    }
  }

    // Build contents array (exactly like image-analysis.js)
    if (base64ImageData && imageMime) {
    // Generate content stream with prompt + image
    contents = [
      prompt,
      {
        inlineData: {
          mimeType: imageMime,
          data: base64ImageData
        }
      }
    ];
  } else {
    // Generate content stream with text prompt only
    console.log(`📝 Processing text prompt only...\n`);
    contents = prompt;
  }

  console.log("🚀 Starting stream...\n");

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
            console.error('[AI Regenerate] Error sending chunk:', error);
          }
        }
      };

      const sendError = (error: string) => {
        if (streamClosed) return;
        try {
          const data = JSON.stringify({ error });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch (e) {
          console.error('[AI Regenerate] Error sending error:', e);
        }
      };

      try {
        const response = await client.models.generateContentStream({
          model: "gemini-2.5-flash",
          contents: contents,
          config: {
            responseModalities: ["TEXT"],
            temperature: 0.7,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 8192,
            thinkingConfig: {
              thinkingBudget: 0,
            },
          }
        });

        // Stream chunks from Gemini
        for await (const chunk of response) {
          const chunkText = chunk.text;

          if (chunkText) {
            chunkCount++;
            fullHTML += chunkText;
            // preview chunk in console
            console.log(`[Chunk ${chunkCount}] ${chunkText}`);
            // Send chunk to client
            sendChunk(chunkText, false);

            if (chunkCount % 5 === 0) {
              console.log(`📦 Processed ${chunkCount} chunks(${fullHTML.length} chars)`);
            }
          }
        }

        console.log(`✅ Stream complete: ${chunkCount} chunks, ${fullHTML.length} total chars`);

        // Send completion signal
        sendChunk('', true);

        streamClosed = true;
        controller.close();

      } catch (error: any) {
        console.error("❌ Gemini AI Stream Error:", error);
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
  console.error("❌ Error in AI regenerate route:", error);
  return new Response(
    JSON.stringify({ error: `Failed to process request: ${error.message}` }),
    {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }
  );
  }
}