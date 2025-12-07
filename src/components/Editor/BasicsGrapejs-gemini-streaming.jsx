"use client";
import grapesjs from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";
import { useEffect, useRef, useState } from "react";

export default function GrapesEditor() {
  const editorRef = useRef(null);
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState({ userRequest: '', imageFile: null, imageUrl: '', imagePreview: null, onSubmit: null, onCancel: null });
  const modalCallbacksRef = useRef({ setShowModal, setModalData });
  
  // Update ref when state setters change
  useEffect(() => {
    modalCallbacksRef.current = { setShowModal, setModalData };
  }, []);

  useEffect(() => {
    if (!editorRef.current) return;

    const editor = grapesjs.init({
      container: editorRef.current,
      height: "100vh",
      storageManager: false,
      fromElement: false,
      canvas: {
        scripts: ['https://cdn.tailwindcss.com'],
      },
      components: `
    <div>Salim</div>
      `,
    });

    // Configure Tailwind CSS in the canvas frame
    editor.on("canvas:frame:load", () => {
      const frameDoc = editor.Canvas.getDocument();
      if (!frameDoc) return;

      // Add Tailwind CDN script if not already present
      const hasTailwindScript = frameDoc.querySelector('script[src*="tailwindcss"]');
      if (!hasTailwindScript) {
        const tailwindScript = frameDoc.createElement("script");
        tailwindScript.src = "https://cdn.tailwindcss.com";
        frameDoc.head.appendChild(tailwindScript);
      }

      // Add Tailwind config to enable all utilities (for dynamic classes)
      const hasTailwindConfig = frameDoc.querySelector('script[data-tailwind-config]');
      if (!hasTailwindConfig) {
        const tailwindConfig = frameDoc.createElement("script");
        tailwindConfig.setAttribute("data-tailwind-config", "true");
        tailwindConfig.textContent = `
          if (typeof tailwind !== 'undefined') {
            tailwind.config = {
              content: {
                files: [],
                extract: {
                  html: () => document.body.innerHTML
                }
              },
              safelist: [
                { pattern: /./ }
              ]
            };
          }
        `;
        frameDoc.head.appendChild(tailwindConfig);
      }
    });

    let isProcessing = false;

    editor.on("component:selected", (component) => {
      if (!component) return;
      const originalHTML = component.toHTML();
      console.log("Selected component HTML:", originalHTML);
    });

    //----------------------------------------------------------------------
    // ADD AI REGENERATE BUTTON
    //----------------------------------------------------------------------
    editor.Panels.addButton('options', {
      id: 'ai-regenerate',
      className: 'fa fa-magic',
      command: 'ai-regenerate',
      attributes: { title: 'AI Regenerate' }
    });

    //----------------------------------------------------------------------
    // AI REGENERATION COMMAND WITH STREAMING
    //----------------------------------------------------------------------
    editor.Commands.add('ai-regenerate', {
      run: async (editor) => {
        const selected = editor.getSelected();
        console.log("selected😂",selected);

        if (!selected || selected.get('type') === 'wrapper') {
          return;
        }

        if (isProcessing) return;

        const originalHTML = selected.toHTML();

        // Show modal instead of prompt
        return new Promise((resolve) => {
          const callbacks = modalCallbacksRef.current;
          
          callbacks.setModalData({
            userRequest: '',
            imageFile: null,
            imageUrl: '',
            imagePreview: null,
            onSubmit: async (userRequest, imageFile, imageUrl) => {
              if (!userRequest.trim()) {
                alert('Please enter a request');
                return;
              }

              isProcessing = true;
              callbacks.setShowModal(false);

              const um = editor.UndoManager;
              let placeholderComponent = null;
              let streamingComponent = null;
              let accumulatedHTML = '';

              // Store parent and position before any operations
              const parent = selected.parent();
              const index = parent.components().indexOf(selected);

              try {
                console.log("📤 Sending to AI:", originalHTML);
                console.log("📝 User request:", userRequest);
                if (imageFile) {
                  console.log("🖼️ Image file:", imageFile.name);
                }
                if (imageUrl) {
                  console.log("🌐 Image URL:", imageUrl);
                }

                // Start undo grouping
                um.start();

                // Remove selected component
                selected.remove();

                // Create and insert placeholder at the same position
                const placeholderHTML =
                  '<div class="p-5 border-2 border-dashed border-green-500 bg-blue-50 text-center rounded-lg">' +
                  '<p class="m-0 text-green-500 font-bold">🔄 AI is generating...</p>' +
                  '<p class="mt-1.5 text-xs text-gray-600">Streaming response...</p>' +
                  '</div>';

                placeholderComponent = parent.append(placeholderHTML, { at: index });
                placeholderComponent = Array.isArray(placeholderComponent) ? placeholderComponent[0] : placeholderComponent;
                editor.select(placeholderComponent);

                // Stream from Gemini AI
                const cleanedHTML = await streamGeminiAI(originalHTML, userRequest, imageFile, imageUrl, (chunk, isComplete) => {
                  accumulatedHTML += chunk;

                  // Clean accumulated HTML before parsing
                  let htmlToParse = accumulatedHTML.trim();

                  // Remove any text before the first HTML tag (common with image responses)
                  const firstTagIndex = htmlToParse.indexOf('<');
                  if (firstTagIndex > 0) {
                    htmlToParse = htmlToParse.substring(firstTagIndex);
                  }

                  // Only update when we have valid HTML
                  if (htmlToParse.startsWith('<')) {
                    try {
                      const parser = new DOMParser();
                      const doc = parser.parseFromString(htmlToParse, 'text/html');

                      if (doc.body.firstElementChild) {
                        // First time: replace placeholder with streaming component
                        if (!streamingComponent) {
                          placeholderComponent.remove();
                          const newComponent = parent.append(htmlToParse, { at: index });
                          streamingComponent = Array.isArray(newComponent) ? newComponent[0] : newComponent;
                        } else {
                          // Update existing component by replacing its content
                          // This prevents duplication by updating in-place
                          const currentIndex = parent.components().indexOf(streamingComponent);
                          streamingComponent.remove();
                          const newComponent = parent.append(htmlToParse, { at: currentIndex });
                          streamingComponent = Array.isArray(newComponent) ? newComponent[0] : newComponent;
                        }

                        console.log(`📝 Streamed ${htmlToParse.length} chars so far...`);
                      }
                    } catch (parseError) {
                      console.log("⏳ Waiting for complete HTML structure...");
                    }
                  }
                });

                // Use the cleaned HTML returned from streamGeminiAI
                accumulatedHTML = cleanedHTML;

                // Final validation
                if (!validateAIResponse(accumulatedHTML)) {
                  throw new Error("Invalid AI response format");
                }

                // Ensure final component is properly set
                if (streamingComponent) {
                  editor.select(streamingComponent);  // Just select, no remove/append
                }

                um.stop();
                console.log("✅ AI streaming completed successfully");
                resolve();

              } catch (error) {
                console.error("❌ Error during AI regeneration:", error);
                um.undo();
                alert("AI regeneration failed: " + error.message);
                resolve();
              } finally {
                isProcessing = false;
              }
            },
            onCancel: () => {
              callbacks.setShowModal(false);
              resolve();
            }
          });
          callbacks.setShowModal(true);
        });
      }
    });

    return () => editor.destroy();
  }, []);

  return (
    <>
      <div ref={editorRef} className="w-full h-full" />
      
      {/* AI Regenerate Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4">AI Regenerate Component</h2>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                if (modalData.onSubmit) {
                  modalData.onSubmit(modalData.userRequest, modalData.imageFile, modalData.imageUrl);
                }
              }}>
                {/* Text Input */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    What would you like to change?
                  </label>
                  <textarea
                    value={modalData.userRequest}
                    onChange={(e) => setModalData({ ...modalData, userRequest: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder='e.g., "make it a hero section", "add a button", "change colors to blue"'
                    required
                  />
                </div>

                {/* Image URL Input */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Image URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={modalData.imageUrl}
                    onChange={(e) => {
                      const url = e.target.value;
                      setModalData({
                        ...modalData,
                        imageUrl: url,
                        imageFile: null, // Clear file if URL is entered
                        imagePreview: url || null
                      });
                    }}
                    placeholder="https://example.com/image.jpg"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Enter an image URL or upload a file below
                  </p>
                </div>

                {/* Divider */}
                <div className="mb-4 flex items-center">
                  <div className="flex-1 border-t border-gray-300"></div>
                  <span className="px-2 text-sm text-gray-500">OR</span>
                  <div className="flex-1 border-t border-gray-300"></div>
                </div>

                {/* Image Upload */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Image (Optional)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (!file.type.startsWith('image/')) {
                          alert('Please select an image file');
                          return;
                        }
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setModalData({
                            ...modalData,
                            imageFile: file,
                            imageUrl: '', // Clear URL if file is uploaded
                            imagePreview: reader.result
                          });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-full file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100
                      cursor-pointer"
                  />
                  
                  {/* Image Preview */}
                  {modalData.imagePreview && (
                    <div className="mt-4">
                      <img
                        src={modalData.imagePreview}
                        alt="Preview"
                        className="max-w-full h-auto max-h-48 rounded-lg border border-gray-300"
                      />
                      <button
                        type="button"
                        onClick={() => setModalData({ ...modalData, imageFile: null, imageUrl: '', imagePreview: null })}
                        className="mt-2 text-sm text-red-600 hover:text-red-800"
                      >
                        Remove Image
                      </button>
                    </div>
                  )}
                </div>

                {/* Buttons */}
                <div className="flex gap-4 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (modalData.onCancel) {
                        modalData.onCancel();
                      }
                    }}
                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md
                      hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500
                      transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 text-white rounded-md
                      hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500
                      transition-colors"
                  >
                    Generate
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

//======================================================================
// GEMINI AI STREAMING (via backend)
//======================================================================
async function streamGeminiAI(originalHTML, userRequest, imageFile, imageUrl, onChunk) {
  try {
    console.log("🚀 Starting Gemini AI stream via backend...");

    let response;
    
    // Use FormData if image file is provided, otherwise use JSON
    if (imageFile) {
      const formData = new FormData();
      formData.append('originalHTML', originalHTML);
      formData.append('userRequest', userRequest);
      formData.append('image', imageFile);
      // Also include imageUrl if provided (though file takes priority)
      if (imageUrl) {
        formData.append('imageUrl', imageUrl);
      }
      
      response = await fetch('/api/editor/ai-regenerate', {
        method: 'POST',
        body: formData, // FormData automatically sets Content-Type with boundary
      });
    } else if (imageUrl) {
      // Use JSON with imageUrl when URL is provided but no file
      response = await fetch('/api/editor/ai-regenerate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalHTML,
          userRequest,
          imageUrl,
        }),
      });
    } else {
      // No image at all
      response = await fetch('/api/editor/ai-regenerate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalHTML,
          userRequest,
        }),
      });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullHTML = '';
    let chunkCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            if (data.error) {
              throw new Error(data.error);
            }

            if (data.chunk !== undefined) {
              chunkCount++;
              fullHTML += data.chunk;

              if (onChunk) {
                onChunk(data.chunk, data.isComplete || false);
              }

              if (chunkCount % 5 === 0) {
                console.log(`📦 Processed ${chunkCount} chunks (${fullHTML.length} chars)`);
              }

              // Handle completion when isComplete is true
              if (data.isComplete) {
                console.log(`✅ Stream complete: ${chunkCount} chunks, ${fullHTML.length} total chars`);
              }
            }
          } catch (parseError) {
            // Skip invalid JSON lines
            console.warn('Failed to parse SSE data:', parseError);
          }
        }
      }
    }

    // Clean and return the accumulated HTML
    fullHTML = cleanAIResponse(fullHTML);
    return fullHTML;

  } catch (error) {
    console.error("❌ Backend AI Stream Error:", error);
    throw new Error(`AI streaming failed: ${error.message}`);
  }
}

//======================================================================
// RESPONSE CLEANING
//======================================================================
function cleanAIResponse(html) {
  let cleaned = html.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  cleaned = cleaned.trim();
  cleaned = cleaned.replace(/^<!DOCTYPE[^>]*>/i, '');
  cleaned = cleaned.replace(/^<html[^>]*>/i, '').replace(/<\/html>\s*$/i, '');
  cleaned = cleaned.replace(/^<head[^>]*>.*?<\/head>/is, '');
  cleaned = cleaned.replace(/^<body[^>]*>/i, '').replace(/<\/body>\s*$/i, '');
  return cleaned.trim();
}

//======================================================================
// VALIDATION
//======================================================================
function validateAIResponse(aiHTML) {
  const trimmed = aiHTML.trim();

  if (!trimmed) {
    console.error("❌ AI response is empty");
    return false;
  }

  if (!trimmed.startsWith('<')) {
    console.error("❌ AI response doesn't start with HTML tag");
    return false;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(trimmed, 'text/html');

    if (!doc.body.firstElementChild) {
      console.error("❌ AI response doesn't contain valid HTML elements");
      return false;
    }

    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      console.error("❌ HTML parsing error:", parserError.textContent);
      return false;
    }
  } catch (parseError) {
    console.error("❌ Failed to parse AI response:", parseError);
    return false;
  }

  console.log("✅ AI response validation passed");
  return true;
} 