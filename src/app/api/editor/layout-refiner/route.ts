import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { document_info, violation } = body;

        const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

        if (!apiKey) {
            return new Response(
                JSON.stringify({ error: "Gemini API key not configured" }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

        const systemPrompt = `
      You are an Expert Typographic Layout Agent. Your job is to fix page-break violations in an A4 document.
      
      CONTEXT:
      - Page Height: ${document_info.page_height}px
      - Current Red Line (Page Break): ${violation.geometry.split_point}px
      
      VIOLATION DATA:
      - Component Type: ${violation.type}
      - HTML: ${violation.html}
      - Element Top: ${violation.geometry.top}px, Element Bottom: ${violation.geometry.bottom}px
      
      RULES:
      1. NEVER split small elements (h1, h2, h3, images). Move them entirely below the split point.
      2. If a heading is too close to a red line (within 40px), move it below to avoid orphaning.
      3. CLUSTER RULE: If this is part of a cluster or grid row, move the entire group.
      4. If a LARGE paragraph is split, find a natural sentence break.
      
      REQUIRED OUTPUT FORMAT (JSON ONLY, NO MARKDOWN):
      { "action": "set_style", "target_id": "optional_id", "data": { "margin-top": "25px" } }
      OR
      { "action": "split_text", "data": { "split_at": "text for first part", "remaining_text": "text for second part" } }
    `;

        const result = await model.generateContent(systemPrompt);
        const responseText = result.response.text() || "";

        // Extract JSON from potentially markdown-wrapped response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        const cleanJson = jsonMatch ? jsonMatch[0] : responseText;

        return new Response(cleanJson, { headers: { 'Content-Type': 'application/json' } });

    } catch (error: any) {
        console.error("Layout Refiner Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
