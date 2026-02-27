"use client";
import grapesjs from "grapesjs";

import { defaultHtml } from "@/data/defaultHtml";
import { convertBlobURLsToBase64 } from "@/utils/blobConverter";
import { convertComponentToInlineCSS } from "@/utils/cssToInline";
import { findComponentsNearRedLines, wrapFlaggedComponents, resetPageBreaks, stripFixationStyles } from "@/utils/findNearMarkers";

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

const DOCUMENT_STRICT_STYLES = `
  /* Force everything to stay within boundaries */
  * {
      box-sizing: border-box !important;
      max-width: 100% !important;
      word-break: normal;
      overflow-wrap: normal;
      word-wrap: normal;
      hyphens: none !important;
      white-space: normal !important;
      scrollbar-width: none !important; /* Firefox */
      min-width: 0 !important;
      line-height: normal !important;
  }

  /* Hide scrollbars for Chrome, Safari and Opera */
  *::-webkit-scrollbar {
      display: none !important;
  }


  table {
      width: 100% !important;
      table-layout: fixed !important; 
  }

  td, th {
      word-break: normal !important;
      white-space: normal !important;
  }

  .visual-page {
      overflow: hidden !important; 
  }
`;



export default function GrapesEditor() {
  const containerRef = useRef(null);
  const [editor, setEditor] = useState(null);
  const editorRef = useRef(null); // Keep a ref for synchronous access if needed, but use state for effects

  const blobURLsRef = useRef(new Set());

  // PDF Generator State
  const [pageSize, setPageSize] = useState('A4');
  const [orientation, setOrientation] = useState('portrait');
  const [pageCount, setPageCount] = useState(1);
  const [showPDFCustomModal, setShowPDFCustomModal] = useState(false);
  const [customWidth, setCustomWidth] = useState('210');
  const [customHeight, setCustomHeight] = useState('297');
  const [pdfPageHeight, setPdfPageHeight] = useState(1122.5); // Dynamically calculated from physical units
  const [customUnit, setCustomUnit] = useState('mm');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [layoutIssues, setLayoutIssues] = useState(0);

  // Helper Functions
  const convertToPixels = (cssValue, frameDoc) => {
    if (!frameDoc) return 0;
    const testEl = frameDoc.createElement('div');
    testEl.style.cssText = `position: absolute; visibility: hidden; height: ${cssValue}; `;
    frameDoc.body.appendChild(testEl);
    const pixels = testEl.offsetHeight;
    frameDoc.body.removeChild(testEl);
    return pixels;
  };

  // AI Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState({ userRequest: '', imageFile: null, imageUrl: '', imagePreview: null, aiProvider: 'gemini', openRouterModel: OPENROUTER_MODELS[0], onSubmit: null, onCancel: null });
  const modalCallbacksRef = useRef({ setShowModal, setModalData });

  // State Refs to avoid stale closures in GrapesJS events
  const pageSizeRef = useRef(pageSize);
  const orientationRef = useRef(orientation);

  // Update ref when state changes
  useEffect(() => {
    pageSizeRef.current = pageSize;
    orientationRef.current = orientation;
    modalCallbacksRef.current = { setShowModal, setModalData };
  }, [pageSize, orientation]);

  useEffect(() => {
    if (!containerRef.current) return;

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
              console.error(`Failed to load ${file.name}: `, error);
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

    // Strip fixation styles when components are cloned
    editor.on('component:clone', (cloned) => {
      stripFixationStyles(cloned);
      console.log('✨ Cloned component stripped of page-break fixation styles');
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
            'max-width': '210mm',
            'min-width': '210mm',
            margin: '0 auto',
            background: 'white',
            padding: '0px',
            position: 'relative',
            display: 'flow-root',
            'overflow-anchor': 'none',
          },
        },
      },
    });

    editor.on('load', () => {
      const wrapper = editor.getWrapper();

      wrapper.setStyle({
        background: 'black',
        padding: '80px 20px 40px',
        'min-height': '100vh',
      });

      if (!wrapper.find('.visual-page').length) {
        const firstPage = wrapper.append({ type: 'visual-page' });
        const page = Array.isArray(firstPage) ? firstPage[0] : firstPage;

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

    function applyPageSize(sizeKey, orient) {
      const size = PAGE_SIZES[sizeKey]?.[orient];
      if (!size) return;

      const frameDoc = editor.Canvas.getDocument();
      if (frameDoc) {
        const heightPx = convertToPixels(size.height, frameDoc);
        setPdfPageHeight(heightPx);
      }

      const wrapper = editor.getWrapper();
      const pages = wrapper.find('.visual-page');

      pages.forEach(page => {
        page.addStyle({
          width: size.width,
          'min-width': size.width,
          'max-width': size.width,
        });
      });

      addPrintStyles(sizeKey, orient);
      // Wait a bit for the layout to settle before updating markers
      setTimeout(() => {
        if (editor.updateMarkers) {
          editor.updateMarkers();
        }
      }, 50);
    }

    function addPrintStyles(sizeKey, orient) {
      const size = PAGE_SIZES[sizeKey]?.[orient];
      if (!size) return;

      const frameDoc = editor.Canvas.getDocument();
      if (!frameDoc) return;

      const oldStyle = frameDoc.getElementById('document-behavior-styles');
      if (oldStyle) oldStyle.remove();

      // GLOBAL BEHAVIOR: Force everything to stay within boundaries
      const behaviorStyle = `
            ${DOCUMENT_STRICT_STYLES}

@media print {
  @page {
    size: ${(sizeKey === 'A4' || sizeKey === 'LETTER') ? sizeKey : `${size.width} ${size.height}`};
    margin: 0;
  }
body {
    margin: 0;
    padding: 0;
    background: white;
  }
.visual-page {
    width: ${size.width} !important;
    margin: 0 !important;
    padding: 0 !important;
    box-shadow: none !important;
  }
.page-break-indicator {
    display: none !important;
  }
}
`;

      const styleEl = frameDoc.createElement('style');
      styleEl.id = 'document-behavior-styles';
      styleEl.textContent = behaviorStyle;
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
    editorRef.current = editor;
    setEditor(editor);
    window.editor = editor; // Expose for debugging

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

      // Re-apply document behaviors on frame load using the latest values
      addPrintStyles(pageSizeRef.current, orientationRef.current);

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
    // ADD UTILITY BUTTONS
    //----------------------------------------------------------------------
    editor.Panels.addButton('options', {
      id: 'check-markers',
      className: 'fa fa-search',
      command: 'check-near-lines',
      attributes: { title: 'Check Near Page Breaks' }
    });

    editor.Panels.addButton('options', {
      id: 'wrap-markers',
      className: 'fa fa-cube',
      command: 'wrap-near-lines',
      attributes: { title: 'Wrap Risk Elements' }
    });

    editor.Panels.addButton('options', {
      id: 'ai-regenerate',
      className: 'fa fa-magic',
      command: 'ai-regenerate',
      attributes: { title: 'AI Regenerate' }
    });



    //----------------------------------------------------------------------
    // UTILITY COMMANDS
    //----------------------------------------------------------------------
    editor.Commands.add('check-near-lines', {
      run: (editor) => {
        const results = findComponentsNearRedLines(editor, 10);
        if (results.length > 0) {
          console.table(results.map(r => ({ ID: r.id, Tag: r.tag })));
          console.log(`Found ${results.length} components near page break lines.`);
        } else {
          console.log('All components are safely away from red lines.');
        }
      }
    });

    editor.Commands.add('wrap-near-lines', {
      run: (editor) => {
        const count = wrapFlaggedComponents(editor);
        console.log(count > 0 ? `Pushed ${count} components below page breaks.` : 'Nothing to push.');
      }
    });

    editor.Commands.add('reset-page-breaks', {
      run: (editor) => { resetPageBreaks(editor); }
    });

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
            userRequest: "Make a Professional Security resume for Salim Khan, highlighting expertise in network security, ethical hacking, threat intelligence, incident response, vulnerability assessment, cloud security (AWS/Azure), penetration testing tools, and industry certifications like CISSP or CEH. Focus on technical skills, project impact, and security-first mindset.",
            imageFile: null,
            imageUrl: '',
            imagePreview: null,
            aiProvider: 'gemini',
            openRouterModel: OPENROUTER_MODELS[0],
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
                let isFinalized = false; // Safety flag to prevent double-finalization
                let latestHTML = '';
                let lastCleanedPreview = ''; // Reusability & Efficiency: Track the actual visible changes
                let streamingContainer = null;

                // Helper: Schedule update on next animation frame (syncs with browser repaint)
                const scheduleUpdate = (isFinal = false) => {
                  if (isFinalized) return;
                  if (pendingUpdate && !isFinal) return;

                  pendingUpdate = true;
                  requestAnimationFrame(() => {
                    pendingUpdate = false;
                    if (isFinalized) return;

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
                      if (isFinal && latestHTML && streamingContainer && streamingContainer.parent()) {
                        isFinalized = true; // Mark as done to prevent double trigger
                        console.log("🏁 Finalizing AI component integration...");
                        // Clean the final HTML one last time
                        const finalHTML = cleanAIResponse(latestHTML);
                        if (validateAIResponse(finalHTML)) {
                          const finalComponent = streamingContainer.replaceWith(finalHTML);
                          streamingContainer = null; // Prevent double-replacement
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
                const size = PAGE_SIZES[pageSizeRef.current]?.[orientationRef.current];
                const frameDoc = editor.Canvas.getDocument();
                const pixelWidth = convertToPixels(size.width, frameDoc);
                const physWidth = size.width;
                const physHeight = size.height;

                const cleanedHTML = await streamFn(originalHTML, userRequest, imageFile, imageUrl, openRouterModel, physHeight, physWidth, (chunk, isComplete) => {
                  accumulatedHTML += chunk;

                  if (isComplete || (accumulatedHTML && accumulatedHTML !== latestHTML)) {
                    latestHTML = accumulatedHTML;
                    scheduleUpdate(isComplete);
                  }
                });

                // Final safety: Use full cleaned result from the backend
                latestHTML = cleanedHTML;
                // scheduleUpdate(true); // Callback usually handles this; safety logic prevents double run anyway

                // Final confirmation
                accumulatedHTML = cleanedHTML;

                // Final validation
                if (!validateAIResponse(accumulatedHTML)) {
                  throw new Error("Invalid AI response format");
                }

                // The final selection is handled in scheduleUpdate(true)

                um.stop();
                console.log("✅ AI streaming completed successfully");

                // --- AUTO FIX ONCE AFTER AI ---
                setTimeout(() => {
                  console.log("🤖 Post-AI Auto-Fix starting...");
                  wrapFlaggedComponents(editor);
                }, 800);

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
    if (editor && editor.applyPageSize) {
      editor.applyPageSize(pageSize, orientation);
    }
  }, [editor, pageSize, orientation]);

  // We need to keep a ref to the current pdfPageHeight so the static closure functions can see it
  const pdfPageHeightRef = useRef(1123);
  useEffect(() => {
    pdfPageHeightRef.current = pdfPageHeight;
    if (editor?.updateMarkers) {
      editor.updateMarkers();
    }
  }, [editor, pdfPageHeight]);

  // Re-attach the marker logic properly to access the Ref
  useEffect(() => {
    if (!editor) return;

    function updatePageBreakMarkers() {
      if (!editor || !editor.Canvas) return;
      const frameDoc = editor.Canvas.getDocument();
      if (!frameDoc) return;

      // Find the visual-page container
      const wrapper = editor.getWrapper();
      const pages = wrapper.find('.visual-page, #visual-page-id');

      // Use the calibrated height
      const pageHeight = pdfPageHeightRef.current;
      if (!pageHeight || pageHeight <= 0) return;

      setPageCount(pages.length);

      // Check for layout issues (crossings)
      const results = findComponentsNearRedLines(editor, 10);
      setLayoutIssues(results.length);

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
          const markerY = i * pageHeight;
          const isBroken = results.some(r => r.boxes.some(b => b.markerY === markerY));

          const marker = frameDoc.createElement('div');
          marker.className = 'page-break-indicator';
          marker.style.cssText = `
            position: absolute;
            left: 0;
            right: 0;
            top: ${markerY}px;
            height: 2px;
            background: ${isBroken ? '#ff4444' : 'repeating-linear-gradient(90deg, #ff4444 0, #ff4444 15px, transparent 15px, transparent 30px)'};
            box-shadow: ${isBroken ? '0 0 10px rgba(255, 68, 68, 0.5)' : 'none'};
            pointer-events: none;
            z-index: 9999;
            transition: all 0.3s ease;
          `;

          const label = frameDoc.createElement('span');
          label.textContent = isBroken ? `⚠️ PAGE ${i + 1} OVERLAP` : `PAGE ${i + 1} START`;
          label.style.cssText = `
            position: absolute;
            right: 5px;
            top: 2px;
            background: #ff4444;
            color: white;
            padding: 1px 6px;
            font-size: 9px;
            font-weight: bold;
            border-radius: 3px;
            white-space: nowrap;
            opacity: ${isBroken ? '1' : '0.7'};
            transform: ${isBroken ? 'scale(1.1)' : 'scale(1)'};
            transition: all 0.3s ease;
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

  }, [editor]); // Run when editor is ready

  // Export and UI Handlers
  const handleExportPDF = async () => {
    // Note: We use the 'editor' instance directly if possible, or via ref
    // The ref 'editorRef.current' now holds the editor instance as per initialization
    if (!editor || !editor.getHtml) return;

    try {
      setIsGeneratingPDF(true);

      const wrapper = editor.getWrapper();
      const wrapperEl = wrapper?.view?.el;
      const frameDoc = editor.Canvas.getDocument();

      // --- FRONTEND LAYOUT SETTLE ---
      if (wrapperEl && frameDoc) {
        // 1. Wait for all images in the canvas to be ready
        const images = Array.from(frameDoc.querySelectorAll('img'));
        await Promise.all(images.map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise(res => { img.onload = res; img.onerror = res; });
        }));

        // 2. Forced reflow + small settle time for Tailwind JIT
        void frameDoc.body.offsetHeight;
        await new Promise(r => setTimeout(r, 300));
      }

      // 1. Calculate the required number of pages
      const pageHeight = pdfPageHeightRef.current || 1123;
      const scrollHeight = wrapperEl ? wrapperEl.scrollHeight : 0;

      // Robust calculation: Dynamically measure the padding applied to the wrapper
      let verticalPadding = 0;
      if (wrapperEl) {
        const style = frameDoc ? frameDoc.defaultView.getComputedStyle(wrapperEl) : window.getComputedStyle(wrapperEl);
        verticalPadding = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
      }

      // Subtract padding and use a 2px safety buffer for rounding
      const actualContentHeight = Math.max(0, scrollHeight - verticalPadding - 2);
      const numPages = Math.max(1, Math.ceil(actualContentHeight / pageHeight));

      // 2. Get and clean the content HTML
      let contentHtml = wrapperEl ? wrapperEl.innerHTML : editor.getHtml();
      contentHtml = await convertBlobURLsToBase64(contentHtml);

      // 3. Optimized Architecture: Send the source HTML and the page count separately
      // Instead of duplicating HTML here (which bloats the request), 
      // we send it once and let the backend construct the viewports.
      const singleHtml = contentHtml;

      let css = editor.getCss();

      // Ensure the strict document behavior is included in the PDF CSS
      css = DOCUMENT_STRICT_STYLES + `
        /* Force symbols and characters to render even if clipped */
        * {
          -webkit-print-color-adjust: exact;
          color-adjust: exact;
          line-height: normal !important;
          break-inside: auto !important;
          page-break-inside: auto !important;
          orphans: 1 !important;
          widows: 1 !important;
        }

        .pdf-viewport {
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
        }

        .pdf-shifter {
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          display: block !important;
        }
      ` + "\n" + css;

      const size = PAGE_SIZES[pageSize]?.[orientation];
      const pixelWidth = convertToPixels(size.width, frameDoc);
      const pixelHeight = pageHeight;

      const exportData = {
        html: singleHtml,
        numPages, // Tell the backend how many "Camera" segments to create
        css,
        pageConfig: {
          width: size.width,
          height: size.height,
          pixelWidth,
          pixelHeight,
        },
        scripts: [
          'https://cdn.tailwindcss.com',
        ],
        styles: [
          'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
        ],
      };

      const response = await fetch('/api/playwright', {
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
      alert('Failed to ge nerate PDF: ' + (error instanceof Error ? error.message : 'Unknown error'));
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
    const unit = customUnit;
    PAGE_SIZES.CUSTOM = {
      portrait: {
        width: `${customWidth}${unit}`,
        height: `${customHeight}${unit}`
      },
      landscape: {
        width: `${customHeight}${unit}`,
        height: `${customWidth}${unit}`
      },
    };
    setPageSize('CUSTOM');
    // Force update because setPageSize might not trigger it if it was already CUSTOM but values changed
    if (editor && editor.applyPageSize) {
      editor.applyPageSize('CUSTOM', orientation);
    }
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#9ca3af', textTransform: 'uppercase' }}>Page Size</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#374151', fontWeight: '500' }}>
                <span>{PAGE_SIZES[pageSize]?.[orientation]?.width} x {PAGE_SIZES[pageSize]?.[orientation]?.height}</span>
                <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '400' }}>({pdfPageHeight?.toFixed(1)}px / page)</span>
              </div>
            </div>
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

        <div id="gjs-editor" ref={containerRef} className="w-full h-full" />
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
      {/* Floating Layout Alert Badge */}
      {layoutIssues > 0 && (
        <div
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 bg-red-600 text-white px-4 py-2 rounded-full shadow-2xl animate-bounce hover:animate-none group cursor-pointer border-2 border-white/20 transition-all active:scale-95"
          onClick={() => editor && wrapFlaggedComponents(editor)}
          title="Click to fix all page break issues"
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
            </span>
            <span className="font-bold text-sm tracking-wide uppercase">
              {layoutIssues} PAGE BREAK {layoutIssues === 1 ? 'ISSUE' : 'ISSUES'} DETECTED
            </span>
          </div>
          <button className="bg-white text-red-600 px-3 py-0.5 rounded-full text-xs font-black uppercase group-hover:bg-red-50 transition-colors shadow-sm">
            Fix All
          </button>
        </div>
      )}
    </>
  );
}

//======================================================================
// GEMINI AI STREAMING (via backend)
//======================================================================
async function streamGeminiAI(originalHTML, userRequest, imageFile, imageUrl, model, physH, physW, onChunk) {
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
      throw new Error(errorData.error || `HTTP error! status: ${response.status} `);
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
                // console.log(`📦 Processed ${ chunkCount } chunks(${ fullHTML.length } chars)`);
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
    fullHTML = cleanAIResponse(fullHTML, physH, physW);
    return fullHTML;

  } catch (error) {
    console.error("❌ Backend AI Stream Error:", error);
    throw new Error(`AI streaming failed: ${error.message} `);
  }
}

//======================================================================
// OPENROUTER AI STREAMING (via backend)
//======================================================================
async function streamOpenRouterAI(originalHTML, userRequest, imageFile, imageUrl, model, physH, physW, onChunk) {
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
      throw new Error(errorData.error || `HTTP error! status: ${response.status} `);
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
    fullHTML = cleanAIResponse(fullHTML, physH, physW);
    return fullHTML;

  } catch (error) {
    console.error("❌ OpenRouter AI Stream Error:", error);
    throw new Error(`OpenRouter streaming failed: ${error.message} `);
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


/**
 * Efficient one-pass sanitizer for A4 PDF documents.
 * Converts viewport-relative units to fixed equivalents instead of removing them,
 * preserving the AI's layout intent while ensuring PDF compatibility.
 *
 * Mapping strategy (A4 page = 210mm x 297mm ≈ 794px x 1123px at 96dpi):
 *   h-screen / min-h-screen  →  min-h-[1123px]  (= one A4 page height)
 *   h-full                   →  h-auto           (content-driven)
 *   w-screen                 →  w-[210mm]        (fixed A4 page width)
 *   h-[100vh]                →  h-[1123px]       (JIT value converted)
 *   style="height:100vh"     →  style="height:1123px"
 */
function getProblematicClassReplacement(cls, heightStr, widthStr) {
  const map = {
    'h-screen': `min-h-[${heightStr}]`,
    'min-h-screen': `min-h-[${heightStr}]`,
    'max-h-screen': `max-h-[${heightStr}]`,
    'h-full': 'h-auto',
    'min-h-full': `min-h-[${heightStr}]`,
    'w-screen': `w-[${widthStr}]`,
    'min-w-screen': `w-[${widthStr}]`,
  };
  return map[cls];
}

function sanitizeA4Styles(html, physH = '297mm', physW = '210mm') {
  if (!html || typeof html !== 'string') return html;

  // Helper to parse "297mm" -> { val: 297, unit: "mm" }
  const parsePhys = (str) => {
    const m = str.match(/^([\d.]+)([a-z%]+)$/i);
    return m ? { val: parseFloat(m[1]), unit: m[2] } : { val: 0, unit: 'px' };
  };

  const h = parsePhys(physH);
  const w = parsePhys(physW);

  return html.replace(/class="([^"]*)"/g, (match, classList) => {
    if (!classList) return match;

    const cleaned = classList
      .split(/\s+/)
      .map(cls => {
        if (!cls) return '';

        // 1. Collapse breakpoints (sm:flex → flex)
        const colonIdx = cls.indexOf(':');
        if (colonIdx !== -1) {
          const prefix = cls.substring(0, colonIdx);
          if (['sm', 'md', 'lg', 'xl', '2xl'].includes(prefix)) {
            cls = cls.substring(colonIdx + 1);
          }
        }

        // 2. Replace known problematic classes
        const replacement = getProblematicClassReplacement(cls, physH, physW);
        if (replacement) return replacement;

        // 3. Convert JIT viewport values inside brackets (case-insensitive)
        if (cls.includes('[') && (/[0-9.]v[hw]/i.test(cls))) {
          return cls.replace(/(\d+(?:\.\d+)?)v([hw])/gi, (_, num, unit) => {
            const base = unit.toLowerCase() === 'h' ? h : w;
            const finalVal = ((parseFloat(num) / 100) * base.val).toFixed(2);
            return `${finalVal}${base.unit}`;
          });
        }

        // 4. Convert embedded physical dimensions inside brackets
        if (cls.includes('[')) {
          return cls
            .replace(/297\s*mm|29\.7\s*cm|11\s*in/gi, physH)
            .replace(/210\s*mm|21\s*cm|8\.5\s*in/gi, physW);
        }

        return cls;
      })
      .filter(Boolean)
      .join(' ');

    return `class="${cleaned.trim()}"`;
  })
    // 5. Convert viewport units in inline styles
    .replace(/style="([^"]*)"/gi, (match, styles) => {
      if (!styles.toLowerCase().includes('vh') && !styles.toLowerCase().includes('vw')) return match;
      const cleaned = styles.replace(/(\d+(?:\.\d+)?)v([hw])/gi, (_, num, unit) => {
        const base = unit.toLowerCase() === 'h' ? h : w;
        const finalVal = ((parseFloat(num) / 100) * base.val).toFixed(2);
        return `${finalVal}${base.unit}`;
      });
      return `style="${cleaned}"`;
    });
}

function cleanAIResponse(html, physH, physW) {
  let cleaned = html.trim();

  // Remove markdown code fences (```html and ```)
  cleaned = cleaned.replace(/^```html\s*/i, '');
  cleaned = cleaned.replace(/^```\s*/i, '');
  cleaned = cleaned.replace(/\s*```$/i, '');

  // Remove HTML document wrappers
  cleaned = cleaned.replace(/^<!DOCTYPE[^>]*>/i, '');
  cleaned = cleaned.replace(/^<html[^>]*>/i, '').replace(/<\/html>\s*$/i, '');
  cleaned = cleaned.replace(/<head[^>]*>.*?<\/head>/is, '');
  cleaned = cleaned.replace(/^<body[^>]*>/i, '').replace(/<\/body>\s*$/i, '');

  // CRITICAL: Strip all breakpoints and viewport units
  cleaned = sanitizeA4Styles(cleaned, physH, physW);

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