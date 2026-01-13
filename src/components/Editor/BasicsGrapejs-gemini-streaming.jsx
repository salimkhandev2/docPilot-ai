"use client";
import grapesjs from "grapesjs";

import { defaultHtml } from "@/data/defaultHtml";
import { convertBlobURLsToBase64 } from "@/utils/blobConverter";
import { convertComponentToInlineCSS } from "@/utils/cssToInline";
import "grapesjs/dist/css/grapes.min.css";
import { useEffect, useRef, useState } from "react";

// OpenRouter available models
const OPENROUTER_MODELS = [
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

const PAGE_SIZES = {
  A4: {
    portrait: { width: '210mm', height: '297mm' },
    landscape: { width: '297mm', height: '210mm' },
  },
  LETTER: {
    portrait: { width: '8.5in', height: '11in' },
    landscape: { width: '11in', height: '8.5in' },
  },
  A5: {
    portrait: { width: '148mm', height: '210mm' },
    landscape: { width: '210mm', height: '148mm' },
  },
  CUSTOM: {
    portrait: { width: '210mm', height: '297mm' },
    landscape: { width: '297mm', height: '210mm' },
  },
};

export default function GrapesEditor() {
  const editorRef = useRef(null);
  const blobURLsRef = useRef(new Set());

  // PDF Generator State
  const [pageSize, setPageSize] = useState('A4');
  const [orientation, setOrientation] = useState('portrait');
  const [pageCount, setPageCount] = useState(1);
  const [showPDFCustomModal, setShowPDFCustomModal] = useState(false);
  const [customWidth, setCustomWidth] = useState('210');
  const [customHeight, setCustomHeight] = useState('297');
  const [pdfPageHeight, setPdfPageHeight] = useState(1123); // Default to A4 px height
  const [customUnit, setCustomUnit] = useState('mm');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // AI Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState({ userRequest: '', imageFile: null, imageUrl: '', imagePreview: null, aiProvider: 'gemini', openRouterModel: OPENROUTER_MODELS[0], onSubmit: null, onCancel: null });
  const modalCallbacksRef = useRef({ setShowModal, setModalData });

  // Update ref when state setters change
  useEffect(() => {
    modalCallbacksRef.current = { setShowModal, setModalData };
  }, []);

  useEffect(() => {
    if (!editorRef.current) return;

    const editor = grapesjs.init({
      container: '#gjs-editor',
      height: "100vh",
      storageManager: false,
      fromElement: false,

      selectorManager: {
        componentFirst: true,
        escapeName: name => name,
      },

      canvas: {
        scripts: [
          'https://cdn.tailwindcss.com',
        ],
        styles: [
          'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
        ],
      },
      assetManager: {
        upload: false, // Disable default upload
        uploadFile: function (e) {
          const files = e.dataTransfer ? e.dataTransfer.files : e.target.files;

          if (!files?.length) return;

          Array.from(files).forEach(file => {
            // Validate file type
            if (!file.type.startsWith('image/')) {
              console.warn(`Skipping non-image: ${file.name}`);
              return;
            }

            // Optional: Check file size (5MB limit)
            const maxSize = 5 * 1024 * 1024;
            if (file.size > maxSize) {
              alert(`${file.name} exceeds 5MB limit`);
              return;
            }

            try {
              // Create blob URL
              const blobURL = URL.createObjectURL(file);
              blobURLsRef.current.add(blobURL);

              // Add to asset manager
              editor.AssetManager.add({
                src: blobURL,
                name: file.name,
                type: 'image'
              });

              console.log(`✅ Image uploaded as blob: ${file.name}`);
            } catch (error) {
              console.error(`Failed to load ${file.name}:`, error);
            }
          });
        }
      },
      // components: defaultHtml, // REMOVED: Managed manually in 'load'
    });

    // Clean up deleted assets
    editor.on('asset:remove', (asset) => {
      const src = asset.get('src');
      if (src?.startsWith('blob:')) {
        URL.revokeObjectURL(src);
        blobURLsRef.current.delete(src);
        console.log(`🗑️ Blob URL revoked: ${src}`);
      }
    });

    // Register visual-page component
    editor.Components.addType('visual-page', {
      model: {
        defaults: {
          tagName: 'div',
          attributes: { class: 'visual-page', id: 'visual-page-id' },
          draggable: false,
          droppable: true,
          copyable: false,
          selectable: false,
          removable: false,
          hoverable: false,
          style: {
            width: '210mm',
            maxWidth: '210mm',
            minWidth: '210mm',
            margin: '0 auto',
            background: 'white',
            padding: '0px',
            position: 'relative',
            display: 'flow-root',
            overflowAnchor: 'none',
          },
        },
      },
    });

    editor.on('load', () => {
      const wrapper = editor.getWrapper();

      wrapper.setStyle({
        background: 'black',
        padding: '80px 20px 40px',
        minHeight: '100vh',
      });

      if (!wrapper.find('.visual-page').length) {
        const firstPage = wrapper.append({ type: 'visual-page' });
        const page = Array.isArray(firstPage) ? firstPage[0] : firstPage;

        // Use defaultHtml content if available, otherwise default text
        // If defaultHtml is an array of components, we append them. 
        // If it's a string, we append it as content.
        if (defaultHtml) {
          page.components(defaultHtml);
        } else {
          page.append(`
                    <div>
                        Start typing your content here...
                    </div>
                `);
        }
      }

      applyPageSize(pageSize, orientation);
      addPrintStyles(pageSize, orientation);
      updatePageCount();
    });

    // Helper Functions
    function convertToPixels(cssValue, frameDoc) {
      const testEl = frameDoc.createElement('div');
      testEl.style.cssText = `position: absolute; visibility: hidden; height: ${cssValue};`;
      frameDoc.body.appendChild(testEl);
      const pixels = testEl.offsetHeight;
      frameDoc.body.removeChild(testEl);
      return pixels;
    }

    function applyPageSize(sizeKey, orient) {
      const size = PAGE_SIZES[sizeKey]?.[orient];
      if (!size) return;

      const wrapper = editor.getWrapper();
      const pages = wrapper.find('.visual-page');

      pages.forEach(page => {
        page.addStyle({
          width: size.width,
        });
      });

      addPrintStyles(sizeKey, orient);
      if (editorRef.current?.updateMarkers) {
        editorRef.current.updateMarkers();
      }
    }

    function addPrintStyles(sizeKey, orient) {
      const size = PAGE_SIZES[sizeKey]?.[orient];
      if (!size) return;

      const frameDoc = editor.Canvas.getDocument();
      if (!frameDoc) return;

      const oldStyle = frameDoc.getElementById('print-styles');
      if (oldStyle) oldStyle.remove();

      const printStyle = `
            @media print {
                @page {
                    size: A4; /* Default fallback */
                }
                .content {
                    width: ${size.width};
                    margin: 0 auto;
                    background: white;
                    display: flow-root;
                }
              
                body {
                    background: black;
                    padding: 0;
                }
            }
        `;

      const styleEl = frameDoc.createElement('style');
      styleEl.id = 'print-styles';
      styleEl.textContent = printStyle;
      frameDoc.head.appendChild(styleEl);
    }

    function updatePageCount() {
      const wrapper = editor.getWrapper();
      const pages = wrapper.find('.visual-page');
      setPageCount(pages.length);
    }

    // Attach helpers to editor instance for external access
    editor.getEditor = () => editor;
    editor.applyPageSize = applyPageSize;
    editor.updatePageCount = updatePageCount;

    // ... (Tailwind config continues below) change from editorRef.current.getEditor to editor.getEditor specific assignment
    editorRef.current = editor; // Ensure ref points to editor instance if needed, or stick to editorRef usage pattern

    // Original code used editorRef.current as container, then assigned editor instance to it? 
    // Wait, the original code: editorRef.current = editor; 
    // I should maintain that.


    // Configure Tailwind CSS in the canvas frame
    editor.on("canvas:frame:load", () => {
      const frameDoc = editor.Canvas.getDocument();
      if (!frameDoc) return;

      // Add Tailwind CDN script if not already present
      const hasTailwindScript = frameDoc.querySelector('script[src*="tailwindcss"]');
      if (!hasTailwindScript) {
        const tailwindScript = frameDoc.createElement("script");
        // tailwindScript.src = "https://cdn.tailwindcss.com";
        frameDoc.head.appendChild(tailwindScript);
      }

      // Add Tailwind config
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

    // Component selection handler
    editor.on("component:selected", (component) => {
      if (!component) return;
      const htmlWithInline = convertComponentToInlineCSS(editor, component, {
        debug: false
      });
      console.log("Selected component HTML with inline styles (for AI):", htmlWithInline);
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

    //----------------------------------------------------------------------
    // AI REGENERATION COMMAND WITH STREAMING
    //----------------------------------------------------------------------
    editor.Commands.add('ai-regenerate', {
      run: async (editor) => {
        const selected = editor.getSelected();

        if (!selected || selected.get('type') === 'wrapper') {
          return;
        }

        if (isProcessing) return;

        // Build HTML with inline styles to send to AI using the utility
        const originalHTML = convertComponentToInlineCSS(editor, selected, { debug: false });

        // Show modal for user input
        return new Promise((resolve) => {
          const callbacks = modalCallbacksRef.current;

          callbacks.setModalData({
            userRequest: 'Create a professional two-column resume for Salim Khan as a Full Stack Developer. The left column should include a professional profile photo (rounded or circular), contact details, and clearly grouped skills (Frontend, Backend, Database, Tools). The right column should contain a concise professional summary (2–3 lines), practical project-based experience, work history, and education. Use a modern, clean, ATS-friendly design with professional colours like dark blue, grey, or black, and easy-to-read fonts. The resume should be job-ready and suitable for full stack developer roles.',
            imageFile: null,
            imageUrl: '',
            imagePreview: null,
            aiProvider: 'openrouter',
            openRouterModel: OPENROUTER_MODELS[2], // Select Alibaba model
            onSubmit: async (userRequest, imageFile, imageUrl, aiProvider, openRouterModel) => {
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
                  console.log("🖼 Image file:", imageFile.name);
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

                // Performance optimization: Use requestAnimationFrame for smooth updates
                let pendingUpdate = false;
                let latestHTML = '';
                let lastCleanedPreview = ''; // Reusability & Efficiency: Track the actual visible changes
                let streamingContainer = null;

                // Helper: Schedule update on next animation frame (syncs with browser repaint)
                const scheduleUpdate = (isFinal = false) => {
                  if (pendingUpdate && !isFinal) return;

                  pendingUpdate = true;
                  requestAnimationFrame(() => {
                    pendingUpdate = false;

                    try {
                      // 1. Create one stable container if it doesn't exist
                      if (!streamingContainer) {
                        if (placeholderComponent) placeholderComponent.remove();

                        // We create a wrapper component to hold the raw HTML during stream
                        const newContainer = parent.append({
                          tagName: 'div',
                          content: '', // Start empty
                          attributes: {
                            class: 'ai-streaming-wrapper',
                            style: 'min-height: 100px; border: 2px dashed #3b82f6; border-radius: 8px; padding: 10px; position: relative; overflow: hidden;'
                          }
                        }, { at: index });

                        streamingContainer = Array.isArray(newContainer) ? newContainer[0] : newContainer;
                        editor.select(streamingContainer);
                      }

                      // 2. Update the RAW element inside the container (SMART SYNC to avoid flickering)
                      const el = streamingContainer.getEl();
                      if (el && latestHTML) {
                        // PRE-CLEAN: Handle partial tags and markdown only when rendering (more efficient)
                        const cleanedPreview = cleanStreamingHTML(latestHTML);

                        // EFFICIENCY CHECK: Only touch the DOM if the CLEANED preview changed
                        if (cleanedPreview !== lastCleanedPreview || isFinal) {
                          lastCleanedPreview = cleanedPreview;
                          const temp = document.createElement('div');
                          temp.innerHTML = cleanedPreview;
                          syncDOMNodes(temp, el);
                        }
                      }

                      // 3. On finalization, replace the container with final GrapesJS components
                      if (isFinal && latestHTML) {
                        console.log("🏁 Finalizing AI component integration...");
                        // Clean the final HTML one last time
                        const finalHTML = cleanAIResponse(latestHTML);
                        if (validateAIResponse(finalHTML)) {
                          const finalComponent = streamingContainer.replaceWith(finalHTML);
                          const instantiated = Array.isArray(finalComponent) ? finalComponent[0] : finalComponent;
                          if (instantiated) {
                            editor.select(instantiated);
                          }
                        }
                      }
                    } catch (err) {
                      console.warn("⏳ Waiting for valid HTML chunk...", err);
                    }
                  });
                };

                // Stream from selected AI provider
                const streamFn = aiProvider === 'openrouter' ? streamOpenRouterAI : streamGeminiAI;
                const cleanedHTML = await streamFn(originalHTML, userRequest, imageFile, imageUrl, openRouterModel, (chunk, isComplete) => {
                  accumulatedHTML += chunk;

                  if (isComplete || (accumulatedHTML && accumulatedHTML !== latestHTML)) {
                    latestHTML = accumulatedHTML;
                    scheduleUpdate(isComplete);
                  }
                });

                // Final safety: Call update with full cleaned result from the backend
                latestHTML = cleanedHTML;
                scheduleUpdate(true);

                // Final confirmation
                accumulatedHTML = cleanedHTML;

                // Final validation
                if (!validateAIResponse(accumulatedHTML)) {
                  throw new Error("Invalid AI response format");
                }

                // The final selection is handled in scheduleUpdate(true)

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

  // Effect to update editor when size/orientation changes
  useEffect(() => {
    if (editorRef.current && editorRef.current.applyPageSize) {
      editorRef.current.applyPageSize(pageSize, orientation);
    }
  }, [pageSize, orientation]);

  // We need to keep a ref to the current pdfPageHeight so the static closure functions can see it
  const pdfPageHeightRef = useRef(1123);
  useEffect(() => {
    pdfPageHeightRef.current = pdfPageHeight;
    if (editorRef.current?.updateMarkers) {
      editorRef.current.updateMarkers();
    }
  }, [pdfPageHeight]);

  // Re-attach the marker logic properly to access the Ref
  useEffect(() => {
    if (!editorRef.current) return;

    const editor = editorRef.current;

    function updatePageBreakMarkers() {
      const frameDoc = editor.Canvas.getDocument();
      if (!frameDoc) return;

      // Find the visual-page container
      const wrapper = editor.getWrapper();
      const pages = wrapper.find('.visual-page, #visual-page-id');

      // Use the calibrated height
      const pageHeight = pdfPageHeightRef.current;
      if (!pageHeight || pageHeight <= 0) return;

      pages.forEach(page => {
        const el = page.getEl();
        if (!el) return;

        // Remove old markers first
        const oldMarkers = el.querySelectorAll('.page-break-indicator');
        oldMarkers.forEach(marker => marker.remove());

        // Total content height
        const totalContentHeight = el.scrollHeight;
        const numberOfPages = Math.ceil(totalContentHeight / pageHeight);

        if (numberOfPages <= 1) return;

        // Add visual indicators
        for (let i = 1; i < numberOfPages; i++) {
          const marker = frameDoc.createElement('div');
          marker.className = 'page-break-indicator';
          marker.style.cssText = `
            position: absolute;
            left: 0;
            right: 0;
            top: ${i * pageHeight}px;
            height: 2px;
            background: repeating-linear-gradient(90deg, #ff4444 0, #ff4444 15px, transparent 15px, transparent 30px);
            pointer-events: none;
            z-index: 9999;
          `;

          const label = frameDoc.createElement('span');
          label.textContent = `PAGE ${i + 1} START`;
          label.style.cssText = `
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            top: -10px;
            background: #ff4444;
            color: white;
            padding: 2px 8px;
            font-size: 10px;
            font-weight: bold;
            border-radius: 4px;
            white-space: nowrap;
          `;

          marker.appendChild(label);
          el.appendChild(marker);
        }
      });
    }

    editor.updateMarkers = updatePageBreakMarkers;

    // Listen to ALL relevant events for markers
    let markerTimeout;
    const triggerUpdate = () => {
      clearTimeout(markerTimeout);
      markerTimeout = setTimeout(updatePageBreakMarkers, 100);
    };

    editor.on('component:add component:remove component:update component:styleUpdate canvas:drop load', triggerUpdate);

    // Initial run
    updatePageBreakMarkers();

  }, []); // Run once to bind, but rely on ref for values

  // Export and UI Handlers
  const handleExportPDF = async () => {
    // Note: We use the 'editor' instance directly if possible, or via ref
    // The ref 'editorRef.current' now holds the editor instance as per initialization
    const editor = editorRef.current;
    if (!editor || !editor.getHtml) return;

    try {
      setIsGeneratingPDF(true);

      const wrapper = editor.getWrapper();
      const wrapperEl = wrapper?.view?.el;

      // Get actual rendered HTML including dynamically added markers from the wrapper element
      let html = wrapperEl ? wrapperEl.innerHTML : editor.getHtml();
      html = await convertBlobURLsToBase64(html);
      let css = editor.getCss();

      // DEBUG: Check if markers are in the HTML
      const markerCount = (html.match(/page-break-indicator/g) || []).length;
      if (markerCount === 0) {
        console.warn('⚠️ No markers found! HTML captured:', html.substring(0, 100));
      }

      // Convert camelCase CSS properties to kebab-case (CRITICAL for Puppeteer)
      css = css.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

      const size = PAGE_SIZES[pageSize]?.[orientation];

      const exportData = {
        html,
        css,
        pageConfig: {
          width: size.width,
          height: size.height,
        },
        scripts: [
          'https://cdn.tailwindcss.com',
        ],
        styles: [
          'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
        ],
      };

      const response = await fetch('/api/puppeteer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate PDF');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'document.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('PDF export error:', error);
      alert('Failed to generate PDF: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleSizeChange = (e) => {
    const newSize = e.target.value;
    if (newSize === 'CUSTOM') {
      setShowPDFCustomModal(true);
    } else {
      setPageSize(newSize);
    }
  };

  const handleOrientationToggle = () => {
    setOrientation(prev => prev === 'portrait' ? 'landscape' : 'portrait');
  };

  const applyCustomSize = () => {
    PAGE_SIZES.CUSTOM = {
      portrait: {
        width: `${customWidth}${customUnit}`,
        height: `${customHeight}${customUnit}`
      },
      landscape: {
        width: `${customHeight}${customUnit}`,
        height: `${customWidth}${customUnit}`
      },
    };
    setPageSize('CUSTOM');
    setShowPDFCustomModal(false);
  };

  return (
    <>
      <div className="relative w-full h-[100vh]">

        {/* PDF Control Toolbar */}
        <div style={{
          position: 'fixed', top: '10px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, background: 'white', padding: '12px 20px', borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', display: 'flex', gap: '16px',
          alignItems: 'center', border: '1px solid #e5e7eb',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span>PDF Page Height (px):</span>
              <input
                type="number"
                value={pdfPageHeight || ''}
                onChange={(e) => setPdfPageHeight(Number(e.target.value))}
                style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '12px', width: '80px' }}
              />
            </label>
          </div>

          <div style={{ width: '1px', height: '24px', background: '#e5e7eb' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>Size:</label>
            <select value={pageSize} onChange={handleSizeChange} style={{
              padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db',
              fontSize: '14px', cursor: 'pointer', background: 'white',
            }}>
              <option value="A4">A4</option>
              <option value="LETTER">Letter</option>
              <option value="CUSTOM">Custom...</option>
            </select>
          </div>

          <div style={{ width: '1px', height: '24px', background: '#e5e7eb' }} />

          <button onClick={handleOrientationToggle} style={{
            padding: '6px 16px', borderRadius: '6px', border: '1px solid #d1d5db',
            background: orientation === 'portrait' ? '#3b82f6' : '#f3f4f6',
            color: orientation === 'portrait' ? 'white' : '#374151',
            fontSize: '14px', fontWeight: '500', cursor: 'pointer',
          }}>
            📄 {orientation === 'portrait' ? 'Portrait' : 'Landscape'}
          </button>

          <div style={{ width: '1px', height: '24px', background: '#e5e7eb' }} />

          <button onClick={handleExportPDF} disabled={isGeneratingPDF} style={{
            padding: '6px 16px', borderRadius: '6px', border: '1px solid #ef4444',
            background: isGeneratingPDF ? '#9ca3af' : '#ef4444',
            color: 'white', fontSize: '14px', fontWeight: '500',
            cursor: isGeneratingPDF ? 'not-allowed' : 'pointer',
            opacity: isGeneratingPDF ? 0.7 : 1,
          }}>
            {isGeneratingPDF ? '⏳ Generating...' : '📄 Export PDF'}
          </button>
        </div>

        {/* Custom PDF Size Modal */}
        {showPDFCustomModal && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', zIndex: 2000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              background: 'white', padding: '24px', borderRadius: '12px', width: '400px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>Custom Page Size</h3>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Width</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="number" value={customWidth} onChange={(e) => setCustomWidth(e.target.value)}
                    style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px' }} />
                  <select value={customUnit} onChange={(e) => setCustomUnit(e.target.value)}
                    style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px' }}>
                    <option value="mm">mm</option>
                    <option value="in">in</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Height</label>
                <input type="number" value={customHeight} onChange={(e) => setCustomHeight(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px' }} />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowPDFCustomModal(false)} style={{
                  padding: '8px 16px', borderRadius: '6px', border: '1px solid #d1d5db',
                  background: 'white', cursor: 'pointer',
                }}>Cancel</button>
                <button onClick={applyCustomSize} style={{
                  padding: '8px 16px', borderRadius: '6px', border: 'none',
                  background: '#3b82f6', color: 'white', cursor: 'pointer',
                }}>Apply</button>
              </div>
            </div>
          </div>
        )}

        <div id="gjs-editor" ref={editorRef} className="w-full h-full" />
      </div>

      {/* AI Regenerate Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4">AI Regenerate Component</h2>

              <form onSubmit={(e) => {
                e.preventDefault();
                if (modalData.onSubmit) {
                  modalData.onSubmit(modalData.userRequest, modalData.imageFile, modalData.imageUrl, modalData.aiProvider, modalData.openRouterModel);
                }
              }}>
                {/* AI Provider Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    AI Provider
                  </label>
                  <select
                    value={modalData.aiProvider}
                    onChange={(e) => setModalData({ ...modalData, aiProvider: e.target.value, imageFile: null, imageUrl: '', imagePreview: null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="gemini">🔮 Gemini (supports images)</option>
                    <option value="openrouter">🌐 OpenRouter (text only)</option>
                  </select>
                </div>

                {/* OpenRouter Model Selection - Only show for OpenRouter */}
                {modalData.aiProvider === 'openrouter' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      OpenRouter Model
                    </label>
                    <select
                      value={modalData.openRouterModel}
                      onChange={(e) => setModalData({ ...modalData, openRouterModel: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                        font-mono text-sm"
                    >
                      {OPENROUTER_MODELS.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      {OPENROUTER_MODELS.length} free models available
                    </p>
                  </div>
                )}

                {/* Text Input */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    What would you like to change?
                  </label>
                  <textarea
                    value={modalData.userRequest}
                    onChange={(e) => setModalData({ ...modalData, userRequest: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (modalData.onSubmit) {
                          modalData.onSubmit(modalData.userRequest, modalData.imageFile, modalData.imageUrl, modalData.aiProvider, modalData.openRouterModel);
                        }
                      }
                    }}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder='e.g., "make it a hero section", "add a button", "change colors to blue"'
                    required
                  />
                </div>

                {/* Image URL Input - Only show for Gemini */}
                {modalData.aiProvider === 'gemini' && (
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
                )}

                {/* Divider - Only show for Gemini */}
                {modalData.aiProvider === 'gemini' && (
                  <div className="mb-4 flex items-center">
                    <div className="flex-1 border-t border-gray-300"></div>
                    <span className="px-2 text-sm text-gray-500">OR</span>
                    <div className="flex-1 border-t border-gray-300"></div>
                  </div>
                )}

                {/* Image Upload - Only show for Gemini */}
                {modalData.aiProvider === 'gemini' && (
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
                )}

                {/* OpenRouter Info */}
                {modalData.aiProvider === 'openrouter' && (
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-700">
                      🌐 <strong>OpenRouter</strong> uses free models for text-based HTML generation.
                      Image support is not available with this provider.
                    </p>
                  </div>
                )}

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
async function streamGeminiAI(originalHTML, userRequest, imageFile, imageUrl, model, onChunk) {
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
                // console.log(`📦 Processed ${chunkCount} chunks (${fullHTML.length} chars)`);
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
// OPENROUTER AI STREAMING (via backend)
//======================================================================
async function streamOpenRouterAI(originalHTML, userRequest, imageFile, imageUrl, model, onChunk) {
  try {
    console.log("🚀 Starting OpenRouter AI stream via backend...");
    console.log("🤖 Using model:", model);

    // OpenRouter only supports text, no image uploads
    const response = await fetch('/api/editor/openrouter-regenerate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        originalHTML,
        userRequest,
        model, // Send selected model to backend
      }),
    });

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

              if (data.isComplete) {
                console.log(`✅ OpenRouter stream complete: ${chunkCount} chunks, ${fullHTML.length} total chars`);
              }
            }
          } catch (parseError) {
            console.warn('Failed to parse SSE data:', parseError);
          }
        }
      }
    }

    // Clean and return the accumulated HTML
    fullHTML = cleanAIResponse(fullHTML);
    return fullHTML;

  } catch (error) {
    console.error("❌ OpenRouter AI Stream Error:", error);
    throw new Error(`OpenRouter streaming failed: ${error.message}`);
  }
}

//======================================================================
// STREAMING UTILS (Enhanced for Efficiency & Reusability)
//======================================================================

/**
 * Strips partial tags and markdown from a streaming HTML string.
 */
function cleanStreamingHTML(html) {
  const firstTag = html.indexOf('<');
  if (firstTag === -1) return '';

  let result = html.substring(firstTag);

  // Minimal logic: Strip trailing incomplete tags (e.g., "<div" or "</p")
  const lastOpen = result.lastIndexOf('<');
  const lastClose = result.lastIndexOf('>');
  if (lastOpen > lastClose) {
    result = result.substring(0, lastOpen);
  }

  return result.replace(/```\s*$/i, '').trim();
}

/**
 * Minimal recursive DOM syncing to prevent flickering.
 */
function syncDOMNodes(src, dest) {
  const sNodes = src.childNodes;
  const dNodes = dest.childNodes;

  for (let i = 0; i < sNodes.length; i++) {
    const s = sNodes[i];
    const d = dNodes[i];

    if (!d) {
      dest.appendChild(s.cloneNode(true));
    } else if (s.nodeType !== d.nodeType || s.nodeName !== d.nodeName) {
      dest.replaceChild(s.cloneNode(true), d);
    } else if (s.nodeType === 3) { // Text node
      if (d.nodeValue !== s.nodeValue) d.nodeValue = s.nodeValue;
    } else if (s.outerHTML !== d.outerHTML) {
      // Recurse for elements that partially changed
      // We check outerHTML to see if we need to recurse (standard sync pattern)
      if (i === sNodes.length - 1 || s.children.length < 10) {
        syncDOMNodes(s, d);
      } else {
        dest.replaceChild(s.cloneNode(true), d);
      }
    }
  }

  // Cleanup extra nodes
  while (dest.childNodes.length > sNodes.length) {
    dest.removeChild(dest.lastChild);
  }
}

//======================================================================
// RESPONSE CLEANING
//======================================================================
function cleanAIResponse(html) {
  let cleaned = html.replace(/^html\s*/i, '').replace(/^\s*/i, '').replace(/\s*```$/i, '').trim();
  cleaned = cleaned.trim();
  cleaned = cleaned.replace(/^<!DOCTYPE[^>]*>/i, '');
  cleaned = cleaned.replace(/^<html[^>]>/i, '').replace(/<\/html>\s$/i, '');
  cleaned = cleaned.replace(/^<head[^>]>.?<\/head>/is, '');
  cleaned = cleaned.replace(/^<body[^>]>/i, '').replace(/<\/body>\s$/i, '');
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
