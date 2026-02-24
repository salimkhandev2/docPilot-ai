// ============================================================
// MainEditor.jsx
// Unified integration of Editor.tsx + BasicsGrapejs-gemini-streaming.jsx
// PHASE 1 of 4: Imports · Constants · State · Helper Functions
// ============================================================
"use client";
import grapesjs from "grapesjs";
import gjsBlocksBasic from "grapesjs-blocks-basic";
import gjsForms from "grapesjs-plugin-forms";
import gjsPreset from "grapesjs-preset-webpage";
import "grapesjs/dist/css/grapes.min.css";
import { useEffect, useRef, useState } from "react";
import { useAIState } from "../../contexts/AIStateContext";
import { defaultHtml } from "../../data/defaultHtml";
import { profileAvatarTemplate } from "../../data/resume-templates/templateExports";
import { templates } from "../../data/resume-templates/templateRegistry";
import {
    preprocessHTML,
    wrapTextNodesForGrapesJS,
} from "../../utils/grapesjsTextWrapping";
import { convertBlobURLsToBase64 } from "@/utils/blobConverter";
import { convertComponentToInlineCSS } from "@/utils/cssToInline";
import {
    findComponentsNearRedLines,
    wrapFlaggedComponents,
    resetPageBreaks,
    stripFixationStyles,
} from "@/utils/findNearMarkers";
import PreviewRenderer from "./PreviewRenderer";

// ──────────────────────────────────────────────────────────────
// CONSTANTS (from BasicsGrapejs-gemini-streaming.jsx)
// ──────────────────────────────────────────────────────────────
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
    "google/gemma-3-4b-it:free",
];

const PAGE_SIZES = {
    A4: {
        portrait: { width: "210mm", height: "297mm" },
        landscape: { width: "297mm", height: "210mm" },
    },
    LETTER: {
        portrait: { width: "8.5in", height: "11in" },
        landscape: { width: "11in", height: "8.5in" },
    },
    A5: {
        portrait: { width: "148mm", height: "210mm" },
        landscape: { width: "210mm", height: "148mm" },
    },
    CUSTOM: {
        portrait: { width: "210mm", height: "297mm" },
        landscape: { width: "297mm", height: "210mm" },
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
      scrollbar-width: none !important;
      min-width: 0 !important;
      line-height: normal !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
  }
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

// WebGL Interceptor: Forces preserveDrawingBuffer to true for all canvases.
// This is a universal, library-agnostic solution that ensures toDataURL() 
// can capture the visual content of 3D objects and dynamic charts for PDF export.
const WEBGL_INTERCEPTOR_SCRIPT = `
(function() {
  var originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, attributes) {
    if (type && (type === "webgl" || type === "webgl2" || type === "experimental-webgl")) {
      attributes = attributes || {};
      attributes.preserveDrawingBuffer = true;
    }
    return originalGetContext.call(this, type, attributes);
  };
})();
`;

const CANVAS_SCRIPTS = [
    // We inject the script as a Data URL so it runs early in the GrapesJS iframe
    `data:text/javascript;base64,${btoa(WEBGL_INTERCEPTOR_SCRIPT)}`,
    "https://cdn.tailwindcss.com",
];

const CANVAS_STYLES = [
    "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css",
];

// ──────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────────────────────────
export default function MainEditor() {
    // ── Refs ─────────────────────────────────────────────────────
    const containerRef = useRef(null);
    const editorRef = useRef(null);        // synchronous access to editor
    const blobURLsRef = useRef(new Set());

    // ── Context (from Editor.tsx) ─────────────────────────────────
    const { state, dispatch } = useAIState();

    // ── Export / Preview state (from Editor.tsx) ──────────────────
    const [exported, setExported] = useState(null);

    // ── GrapesJS editor instance state ───────────────────────────
    const [editor, setEditor] = useState(null);

    // ── PDF / Page state (from BasicsGrapejs-gemini-streaming.jsx) ─
    const [pageSize, setPageSize] = useState("A4");
    const [orientation, setOrientation] = useState("portrait");
    const [pageCount, setPageCount] = useState(1);
    const [showPDFCustomModal, setShowPDFCustomModal] = useState(false);
    const [customWidth, setCustomWidth] = useState("210");
    const [customHeight, setCustomHeight] = useState("297");
    const [pdfPageHeight, setPdfPageHeight] = useState(1122.5);
    const [customUnit, setCustomUnit] = useState("mm");
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [layoutIssues, setLayoutIssues] = useState(0);

    // ── AI Modal state (from BasicsGrapejs-gemini-streaming.jsx) ──
    const [showModal, setShowModal] = useState(false);
    const [modalData, setModalData] = useState({
        userRequest: "",
        imageFile: null,
        imageUrl: "",
        imagePreview: null,
        aiProvider: "gemini",
        openRouterModel: OPENROUTER_MODELS[0],
        onSubmit: null,
        onCancel: null,
    });
    const modalCallbacksRef = useRef({ setShowModal, setModalData });

    // ── Stale-closure refs for GrapesJS event handlers ───────────
    const pageSizeRef = useRef(pageSize);
    const orientationRef = useRef(orientation);

    // Keep refs in sync
    useEffect(() => {
        pageSizeRef.current = pageSize;
        orientationRef.current = orientation;
        modalCallbacksRef.current = { setShowModal, setModalData };
    }, [pageSize, orientation]);

    // Effect to update editor when size/orientation changes
    useEffect(() => {
        if (editor && editor.applyPageSize) {
            editor.applyPageSize(pageSize, orientation);
        }
    }, [editor, pageSize, orientation]);

    const pdfPageHeightRef = useRef(1123);
    // We need to keep a ref to the current pdfPageHeight so the static closure functions can see it
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

    // ══════════════════════════════════════════════════════════════
    // PURE HELPER FUNCTIONS (defined once, reused inside useEffects)
    // ══════════════════════════════════════════════════════════════

    // -- convertToPixels (from BasicsGrapejs-gemini-streaming.jsx) --
    const convertToPixels = (cssValue, frameDoc) => {
        if (!frameDoc) return 0;
        const testEl = frameDoc.createElement("div");
        testEl.style.cssText = `position: absolute; visibility: hidden; height: ${cssValue}; `;
        frameDoc.body.appendChild(testEl);
        const pixels = testEl.offsetHeight;
        frameDoc.body.removeChild(testEl);
        return pixels;
    };

    // -- decodeHtmlEntities (from Editor.tsx) --
    const decodeHtmlEntities = (html) => {
        const textarea = document.createElement("textarea");
        textarea.innerHTML = html;
        return textarea.value;
    };

    // -- containsUrduOrArabic (from Editor.tsx) --
    const containsUrduOrArabic = (text) => {
        if (!text || typeof text !== "string") return false;
        const urduArabicPattern =
            /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
        return urduArabicPattern.test(text);
    };

    // -- extractComponentText (from Editor.tsx) --
    const extractComponentText = (component) => {
        if (!component) return "";
        let textContent = "";
        const content = component.get("content");
        if (typeof content === "string") {
            textContent += content;
        } else if (Array.isArray(content)) {
            content.forEach((item) => {
                if (typeof item === "string") {
                    textContent += item;
                } else if (item && typeof item === "object") {
                    if (item.get && typeof item.get === "function") {
                        textContent += extractComponentText(item);
                    } else if (item.content) {
                        textContent +=
                            typeof item.content === "string"
                                ? item.content
                                : extractComponentText(item);
                    }
                }
            });
        }
        try {
            const view = component.getView?.();
            if (view && view.el) {
                const viewText = view.el.textContent || view.el.innerText || "";
                if (viewText.trim()) textContent += viewText;
            }
        } catch (e) { }
        try {
            const children = component.components?.();
            if (children && Array.isArray(children)) {
                children.forEach((child) => {
                    textContent += extractComponentText(child);
                });
            }
        } catch (e) { }
        return textContent;
    };

    // -- applyRTLIfNeeded (from Editor.tsx) --
    const applyRTLIfNeeded = (component) => {
        try {
            if (!component) return;
            const textContent = extractComponentText(component);
            if (containsUrduOrArabic(textContent)) {
                const currentDirection = component.getStyle("direction");
                if (!currentDirection || currentDirection === "ltr") {
                    component.addStyle({
                        direction: "rtl",
                        "text-align": "right",
                        "unicode-bidi": "embed",
                    });
                }
                component.setAttributes({ dir: "rtl" });
            } else {
                try {
                    const children = component.components?.();
                    if (!children || children.length === 0) {
                        // don't auto-remove user-set RTL
                    }
                } catch (e) { }
            }
        } catch (error) {
            console.warn("Error applying RTL:", error);
        }
    };

    // -- generateRandomClass (from Editor.tsx) --
    const generateRandomClass = () => {
        const prefix = "resize-";
        const randomId = Math.random().toString(36).substring(2, 9);
        return `${prefix}${randomId}`;
    };

    // ══════════════════════════════════════════════════════════════
    // GRAPESJS INIT useEffect
    // ══════════════════════════════════════════════════════════════
    useEffect(() => {
        // Guard: skip if preview is active (Editor.tsx pattern)
        if (exported) return;
        if (!containerRef.current) return;

        // ── grapesjs.init() ─────────────────────────────────────────
        const editor = grapesjs.init({
            container: "#gjs-editor",
            height: "100vh",
            width: "auto",
            storageManager: false,
            fromElement: false,

            // Undo/redo (from Editor.tsx)
            undoManager: { trackSelection: true },

            // Device manager – Desktop only (from Editor.tsx)
            deviceManager: {
                devices: [{ name: "Desktop", width: "" }],
            },


            // Plugins (from Editor.tsx)
            plugins: [gjsBlocksBasic, gjsForms, gjsPreset],
            pluginsOpts: {
                "grapesjs-preset-webpage": {
                    blocksBasic: true,
                    forms: true,
                    // Enable edition tools
                    textPlugin: true,
                },
            },

            // Selector manager (from BasicsGrapejs-gemini-streaming.jsx)
            selectorManager: {
                componentFirst: true,
                escapeName: (name) => name,
            },

            // Canvas (from Editor.tsx)
            canvas: {
                scripts: CANVAS_SCRIPTS,
                styles: CANVAS_STYLES,
            },

            // Asset manager with blob upload (from BasicsGrapejs-gemini-streaming.jsx)
            assetManager: {
                upload: false,
                uploadFile: function (e) {
                    const files = e.dataTransfer ? e.dataTransfer.files : e.target.files;
                    if (!files?.length) return;
                    Array.from(files).forEach((file) => {
                        if (!file.type.startsWith("image/")) {
                            console.warn(`Skipping non-image: ${file.name}`);
                            return;
                        }
                        const maxSize = 5 * 1024 * 1024;
                        if (file.size > maxSize) {
                            alert(`${file.name} exceeds 5MB limit`);
                            return;
                        }
                        try {
                            const blobURL = URL.createObjectURL(file);
                            blobURLsRef.current.add(blobURL);
                            editor.AssetManager.add({ src: blobURL, name: file.name, type: "image" });
                            console.log(`✅ Image uploaded as blob: ${file.name}`);
                        } catch (error) {
                            console.error(`Failed to load ${file.name}: `, error);
                        }
                    });
                },
            },
        }); // ← end grapesjs.init()

        // ── Clean up deleted blob assets (BasicsGrapejs) ──────────
        editor.on("asset:remove", (asset) => {
            const src = asset.get("src");
            if (src?.startsWith("blob:")) {
                URL.revokeObjectURL(src);
                blobURLsRef.current.delete(src);
                console.log(`🗑️ Blob URL revoked: ${src}`);
            }
        });

        // ── Strip fixation styles on clone (BasicsGrapejs) ────────
        editor.on("component:clone", (cloned) => {
            stripFixationStyles(cloned);
            console.log("✨ Cloned component stripped of page-break fixation styles");
        });

        // ── Register visual-page component (BasicsGrapejs) ────────
        editor.Components.addType("visual-page", {
            model: {
                defaults: {
                    tagName: "div",
                    attributes: { class: "visual-page", id: "visual-page-id" },
                    draggable: false, droppable: true, copyable: false,
                    selectable: false, removable: false, hoverable: false,
                    style: {
                        width: "210mm", "max-width": "210mm", "min-width": "210mm",
                        margin: "0 auto", background: "white", padding: "0px",
                        position: "relative", display: "flow-root", "overflow-anchor": "none",
                    },
                },
            },
        });

        // ── Helper: inject print/behavior styles into canvas frame ──
        function addPrintStyles(sizeKey, orient) {
            if (!editor || !editor.Canvas) return;
            const size = PAGE_SIZES[sizeKey]?.[orient];
            if (!size) return;
            const frameDoc = editor.Canvas.getDocument();
            if (!frameDoc) return;
            const old = frameDoc.getElementById("document-behavior-styles");
            if (old) old.remove();
            const behaviorStyle = `
${DOCUMENT_STRICT_STYLES}

@media print {
  @page {
    size: ${(sizeKey === "A4" || sizeKey === "LETTER") ? sizeKey : `${size.width} ${size.height}`};
    margin: 0;
  }
  body { margin: 0; padding: 0; background: white; }
  .visual-page {
    width: ${size.width} !important;
    margin: 0 !important;
    padding: 0 !important;
    box-shadow: none !important;
  }
  .page-break-indicator { display: none !important; }
}
`;
            const styleEl = frameDoc.createElement("style");
            styleEl.id = "document-behavior-styles";
            styleEl.textContent = behaviorStyle;
            frameDoc.head.appendChild(styleEl);
        }

        // ── Helper: apply page size to all visual-page components ──
        function applyPageSize(sizeKey, orient) {
            if (!editor) return;
            const size = PAGE_SIZES[sizeKey]?.[orient];
            if (!size) return;
            const frameDoc = editor.Canvas?.getDocument();
            if (frameDoc) {
                const heightPx = convertToPixels(size.height, frameDoc);
                setPdfPageHeight(heightPx);
                pdfPageHeightRef.current = heightPx;
            }
            const wrapper = editor.getWrapper?.();
            if (!wrapper) return;
            const pages = wrapper.find(".visual-page");
            pages.forEach((page) => {
                page.addStyle({
                    width: size.width,
                    "min-width": size.width,
                    "max-width": size.width,
                    "min-height": size.height,
                    margin: "0 auto",
                });
            });
            addPrintStyles(sizeKey, orient);
            setTimeout(() => { editor.updateMarkers?.(); }, 50);
        }

        // ── Helper: update page count state ────────────────────────
        function updatePageCount() {
            if (!editor) return;
            const wrapper = editor.getWrapper?.();
            if (!wrapper) return;
            const pages = wrapper.find(".visual-page");
            setPageCount(pages.length);
        }

        // ── Expose helpers on editor instance ──────────────────────
        editor.applyPageSize = applyPageSize;
        editor.updatePageCount = updatePageCount;
        window.editor = editor;

        // ── load: set up wrapper, visual-page, defaultHtml ─────────
        editor.on("load", () => {
            const wrapper = editor.getWrapper();

            // Black canvas background with tightened padding
            wrapper.setStyle({
                background: "black",
                padding: "80px 20px 40px",
                "min-height": "100vh",
            });

            // Remove preset buttons
            editor.Panels.removeButton("options", "canvas-clear");
            editor.Panels.removeButton("options", "gjs-open-import-webpage");
            editor.Panels.removeButton("devices-c", "set-device-desktop");
            editor.Panels.removeButton("devices-c", "set-device-tablet");
            editor.Panels.removeButton("devices-c", "set-device-mobile");

            // Remove Setting button (Traits)
            editor.Panels.removeButton("views", "open-tm");

            // Create visual-page if not present
            if (!wrapper.find(".visual-page").length) {
                // Use render-full-html to properly initialize content, extract scripts, and run them
                setTimeout(() => {
                    editor.runCommand("render-full-html", { html: state.htmlContent || defaultHtml });
                }, 50);
                return; // render-full-html handles applyPageSize, styles, and sweeping
            }

            applyPageSize(pageSizeRef.current, orientationRef.current);
            addPrintStyles(pageSizeRef.current, orientationRef.current);
            updatePageCount();

            // Also sweep existing components for RTL + table cells (from Editor.tsx)
            // Wrapping in setTimeout gives DOM time to attach to Canvas before mapping
            setTimeout(() => {
                const sweepComponents = (comps) => {
                    if (!comps) return;
                    comps.forEach((comp) => {
                        const tag = comp.get("tagName")?.toLowerCase();
                        if (tag === "td" || tag === "th") {
                            comp.set("editable", true);
                            comp.set("selectable", true);
                            comp.set("hoverable", true);
                            comp.set("droppable", true);
                            if (!comp.get("content") || comp.get("content").trim() === "")
                                comp.set("content", " ");
                        }
                        applyRTLIfNeeded(comp);
                        if (comp.components) sweepComponents(comp.components());
                    });
                };
                sweepComponents(editor.DomComponents.getComponents());
            }, 100);
        });
        editor.on("component:add", (component) => {
            const tagName = component.get("tagName")?.toLowerCase();
            if (tagName === "svg") {
                component.set({ droppable: true, editable: false, selectable: true, hoverable: true });
            }
            const parent = component.parent();
            if (parent && parent.get("tagName")?.toLowerCase() === "svg") {
                component.set({ selectable: true, hoverable: true });
            }
        });

        // ── Text resizing + RTL on component:add (Editor.tsx) ─────
        const TEXT_ELEMENTS = ["p", "h1", "h2", "h3", "h4", "h5", "h6", "span", "div", "blockquote", "a", "strong", "em", "b", "i", "u", "li", "td", "th", "section", "article", "header", "footer", "main", "aside", "nav", "pre", "code"];
        const INLINE_ELEMENTS = ["span", "a", "strong", "em", "b", "i", "u", "code", "small", "sub", "sup"];

        editor.on("component:add", (component) => {
            const tagName = component.get("tagName")?.toLowerCase();
            if (TEXT_ELEMENTS.includes(tagName) || component.is("text") || component.is("link") || component.is("textnode")) {
                component.set({
                    resizable: true,
                    editable: true,
                    selectable: true,
                    hoverable: true,
                    droppable: true // Allow things inside text if needed
                });

                if (INLINE_ELEMENTS.includes(tagName)) {
                    const cur = component.getStyle("display");
                    if (!cur || cur === "inline") component.addStyle({ display: "inline-block" });
                }
                if (!component.getStyle("min-width")) component.addStyle({ "min-width": "20px" });
                if (!component.getStyle("min-height")) component.addStyle({ "min-height": "10px" });
                const content = component.get("content");
                if (content && typeof content === "string" && content.trim()) {
                    component.set("editable", true);
                }
                applyRTLIfNeeded(component);
                setTimeout(() => {
                    const view = component.getView?.();
                    if (view?.el) wrapTextNodesForGrapesJS(view.el);
                }, 10);
            }
            if (tagName === "td" || tagName === "th") {
                component.set("editable", true);
                component.set("selectable", true);
                component.set("hoverable", true);
                component.set("droppable", true);
                if (!component.get("content") || component.get("content").trim() === "") {
                    component.set("content", " ");
                }
            }
        });

        // ── component:create (Editor.tsx) ─────────────────────────
        editor.on("component:create", (component) => {
            const tagName = component.get("tagName")?.toLowerCase();
            if (TEXT_ELEMENTS.includes(tagName) || component.is("text") || component.is("link") || component.is("textnode")) {
                component.set("resizable", true);
                if (INLINE_ELEMENTS.includes(tagName)) {
                    const cur = component.getStyle("display");
                    if (!cur || cur === "inline") component.addStyle({ display: "inline-block" });
                }
                applyRTLIfNeeded(component);
            }
        });

        // ── component:selected – resize class + RTL + image toolbar (Editor.tsx) ──
        let currentResizeClass = null;
        editor.on("component:selected", (component) => {
            const tagName = component.get("tagName")?.toLowerCase();
            if (TEXT_ELEMENTS.includes(tagName) || component.is("text") || component.is("link") || component.is("textnode")) {
                if (!component.get("resizable")) component.set("resizable", true);
                if (INLINE_ELEMENTS.includes(tagName)) {
                    const cur = component.getStyle("display");
                    if (!cur || cur === "inline") component.addStyle({ display: "inline-block" });
                }
                const currentClasses = component.get("classes") || [];
                const classNames = currentClasses.map((cls) => cls.get("name")).filter(Boolean);
                classNames.forEach((className) => { if (className.startsWith("resize-")) component.removeClass(className); });
                const randomClass = generateRandomClass();
                component.addClass(randomClass);
                currentResizeClass = randomClass;
                applyRTLIfNeeded(component);
            }
            // Image toolbar (Editor.tsx)
            if (component && component.is && component.is("image")) {
                const toolbar = component.get("toolbar") || [];
                if (!toolbar.some((t) => t.id === "change-image")) {
                    toolbar.unshift({ id: "change-image", attributes: { class: "fa fa-image", title: "Change image" }, command: "change-image" });
                    component.set("toolbar", toolbar);
                }
            }
        });

        // ── component:selected – AI inline CSS log (BasicsGrapejs) ──
        editor.on("component:selected", (component) => {
            if (!component) return;
            const htmlWithInline = convertComponentToInlineCSS(editor, component, { debug: false });
            console.log("Selected component HTML with inline styles (for AI):", htmlWithInline);
        });

        // ── component:update RTL (Editor.tsx) ─────────────────────
        editor.on("component:update", (component) => {
            applyRTLIfNeeded(component);
            const checkChildren = (comp) => {
                if (comp && comp.components) {
                    comp.components().forEach((child) => { applyRTLIfNeeded(child); checkChildren(child); });
                }
            };
            checkChildren(component);
        });

        // ── component:styleUpdate RTL (Editor.tsx) ─────────────────
        editor.on("component:styleUpdate", (component) => { applyRTLIfNeeded(component); });

        // ── component:dblclick image asset manager (Editor.tsx) ────
        editor.on("component:dblclick", (component) => {
            if (!component || !component.is || !component.is("image")) return;
            editor.runCommand("open-assets", { target: component, types: ["image"] });
        });

        // ── Resizable text component types (Editor.tsx) ───────────
        ["text", "textnode", "link", "label"].forEach((type) => {
            const typeDef = editor.DomComponents.getType(type);
            if (typeDef) {
                editor.DomComponents.addType(type, { model: { defaults: { ...typeDef.model?.defaults, resizable: true, resizableText: true } } });
            }
        });
        ["text", "link"].forEach((type) => {
            const typeDef = editor.DomComponents.getType(type);
            if (typeDef) {
                editor.DomComponents.addType(type, { model: { defaults: { ...typeDef.model?.defaults, resizable: true } } });
            }
        });

        // ── Force Desktop device (Editor.tsx) ─────────────────────
        editor.setDevice("Desktop");

        // ── Override table cell (Editor.tsx) ──────────────────────
        editor.DomComponents.addType("cell", {
            extend: "cell",
            model: { defaults: { editable: true, selectable: true, hoverable: true, droppable: true } },
        });

        // ── iframe-wrapper type (Editor.tsx) ──────────────────────
        editor.DomComponents.addType("iframe-wrapper", {
            model: {
                defaults: {
                    tagName: "div", droppable: true,
                    attributes: { class: "iframe-wrapper" }, traits: [],
                    components: [{ type: "iframe", attributes: { src: "", style: "width: 100%; height: 100%; border: none;" }, content: "" }],
                },
            },
        });

        // ── html-with-scripts type (Editor.tsx) ───────────────────
        editor.DomComponents.addType("html-with-scripts", {
            model: {
                defaults: {
                    tagName: "div", droppable: true, content: "",
                    script: function () {
                        const executeScripts = () => {
                            document.dispatchEvent(new CustomEvent("content-loaded"));
                            document.querySelectorAll("script:not([src])").forEach((s) => {
                                try { eval(s.textContent || ""); } catch (e) { console.warn("Error executing inline script:", e); }
                            });
                        };
                        setTimeout(executeScripts, 100);
                    },
                },
            },
        });

        // ══════════════════════════════════════════════════════════
        // COMMANDS
        // ══════════════════════════════════════════════════════════

        editor.Commands.add("show-layers", { run(ed) { ed.Panels.getButton("views", "open-layers")?.set("active", 1); } });
        editor.Commands.add("show-styles", { run(ed) { ed.Panels.getButton("views", "open-sm")?.set("active", 1); } });
        editor.Commands.add("show-traits", { run(ed) { ed.Panels.getButton("views", "open-tm")?.set("active", 1); } });

        editor.Commands.add("change-image", {
            run(ed, _sender, opts) {
                const target = (opts && opts.target) || ed.getSelected();
                if (target && target.is && target.is("image")) { ed.runCommand("open-assets", { target, types: ["image"] }); }
            },
        });

        editor.Commands.add("send-to-preview", {
            run() {
                let html = editor.getHtml();
                const css = editor.getCss() ?? "";
                const parser = new DOMParser();
                const rawHtml = state.htmlContent || defaultHtml;
                const decodedHtml = decodeHtmlEntities(rawHtml);
                const doc = parser.parseFromString(decodedHtml, "text/html");
                const styleLinks = Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).map((l) => l.outerHTML).join("\n");
                const inlineScriptTags = Array.from(doc.querySelectorAll("script:not([src])")).map((s) => s.outerHTML).join("\n");
                const externalScriptTags = Array.from(doc.querySelectorAll("script[src]")).map((s) => s.outerHTML).join("\n");
                const metaTags = Array.from(doc.querySelectorAll("meta")).map((m) => m.outerHTML).join("\n");
                const extractedStyles = Array.from(doc.querySelectorAll("style")).map((s) => s.textContent || "").join("\n");
                const combinedCss = extractedStyles + "\n" + css;
                const initScript = `document.addEventListener("DOMContentLoaded", function() {
  if (typeof Prism !== "undefined" && Prism.highlightAll) Prism.highlightAll();
  if (typeof hljs !== "undefined" && hljs.highlightAll) hljs.highlightAll();
  if (typeof mermaid !== "undefined" && mermaid.init) mermaid.init();
  if (typeof katex !== "undefined" && katex.renderAll) katex.renderAll();
});`;
                const fullHtml = "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  " + metaTags + "\n  <title>Document Preview</title>\n  " + styleLinks + "\n  " + inlineScriptTags + "\n  " + externalScriptTags + "\n  <style>" + css + "</style>\n</head>\n<body>\n  " + html + "\n  <script>" + initScript + "</script>\n</body>\n</html>";
                setExported({ html: fullHtml, css: combinedCss, isFullHtml: true });
            },
        });

        // Collect resources from htmlContent for canvas injection
        const extractResources = () => {
            const parser = new DOMParser();
            const rawHtml = state.htmlContent || defaultHtml;
            const decodedHtml = decodeHtmlEntities(rawHtml);
            const doc = parser.parseFromString(decodedHtml, "text/html");
            const styleLinks = Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).map((l) => l.getAttribute("href")).filter(Boolean);
            const scriptSources = Array.from(doc.querySelectorAll("script[src]")).map((s) => s.getAttribute("src")).filter(Boolean);
            return { styleLinks, scriptSources };
        };
        const { styleLinks: rStyleLinks, scriptSources: rScriptSources } = extractResources();
        rStyleLinks.forEach((href) => { if (href) editor.Canvas.getConfig()?.styles?.push(href); });
        rScriptSources.forEach((src) => { if (src) editor.Canvas.getConfig()?.scripts?.push(src); });

        editor.Commands.add("render-full-html", {
            run(ed, sender, opts) {
                // Clear active selection to prevent "lastComponent" styling crash
                ed.select(null);

                // opts.html lets callers (e.g. template gallery) bypass stale React state
                const rawHtml = (opts && opts.html) || state.htmlContent || defaultHtml;
                const decodedHtml = decodeHtmlEntities(rawHtml);
                const parser = new DOMParser();
                const doc = parser.parseFromString(decodedHtml, "text/html");

                // Extract and inject scripts/styles from the document
                const styleLinks = Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).map(l => l.getAttribute("href")).filter(Boolean);
                const scriptSources = Array.from(doc.querySelectorAll("script[src]")).map(s => s.getAttribute("src")).filter(Boolean);

                const currentStyles = ed.Canvas.getConfig().styles || [];
                const currentScripts = ed.Canvas.getConfig().scripts || [];

                styleLinks.forEach(href => { if (!currentStyles.includes(href)) currentStyles.push(href); });
                scriptSources.forEach(src => { if (!currentScripts.includes(src)) currentScripts.push(src); });

                let bodyContent = doc.body.innerHTML;
                bodyContent = preprocessHTML(bodyContent);

                const styleElements = doc.querySelectorAll("style");
                let inlineStyles = "";
                styleElements.forEach((s) => { inlineStyles += s.textContent || ""; });

                // Aligned with Editor.tsx: use setComponents wrapped in visual-page
                ed.setComponents([{
                    type: "visual-page",
                    components: bodyContent || "<div>Start typing your content here...</div>"
                }]);

                if (inlineStyles) ed.setStyle(inlineStyles);

                // Re-apply page size constraints
                setTimeout(() => {
                    if (ed.applyPageSize) ed.applyPageSize(pageSizeRef.current, orientationRef.current);
                }, 50);

                setTimeout(() => {
                    const allComponents = ed.DomComponents.getComponents();
                    const checkAll = (comps) => {
                        if (comps) comps.forEach((comp) => {
                            const tag = comp.get("tagName")?.toLowerCase();
                            if (tag === "td" || tag === "th") {
                                comp.set("editable", true);
                                comp.set("selectable", true);
                                comp.set("hoverable", true);
                                comp.set("droppable", true);
                            }
                            applyRTLIfNeeded(comp);
                            if (comp.components) checkAll(comp.components());
                        });
                    };
                    checkAll(allComponents);

                    // Safely update markers
                    if (ed.Canvas && ed.Canvas.getDocument()) {
                        ed.updateMarkers?.();
                    }
                }, 100);

                setTimeout(() => {
                    const frame = ed.Canvas.getFrameEl();
                    if (frame && frame.contentWindow) {
                        const frameDoc = frame.contentWindow.document;
                        const parser2 = new DOMParser();
                        const originalDoc = parser2.parseFromString(decodedHtml, "text/html");
                        const externalScripts = originalDoc.querySelectorAll("head script[src]");
                        const inlineScripts = originalDoc.querySelectorAll("script:not([src])");
                        const loadExternalScripts = (scripts, index = 0) => {
                            if (index >= scripts.length) {
                                // All external scripts loaded, now execute inline scripts
                                inlineScripts.forEach((script) => {
                                    const ns = frameDoc.createElement("script");
                                    ns.textContent = script.textContent;
                                    frameDoc.body.appendChild(ns);
                                });

                                // Create a generic script runner that will initialize any library
                                const runScripts = frameDoc.createElement("script");
                                runScripts.textContent = `
                                    // Dispatch a content loaded event that libraries can listen for
                                    document.dispatchEvent(new CustomEvent('content-loaded'));

                                    // Try to run any common library initializers that might be present
                                    // This is a fallback for libraries that don't auto-initialize
                                    const commonLibraries = [
                                        { name: 'Prism', init: 'highlightAll' },
                                        { name: 'hljs', init: 'highlightAll' },
                                        { name: 'mermaid', init: 'init' },
                                        { name: 'katex', init: 'renderAll' },
                                        { name: 'Chart', init: null } // Chart.js often needs custom init per canvas, but we check if it exists
                                    ];

                                    commonLibraries.forEach(lib => {
                                        if (window[lib.name]) {
                                            if (lib.init && typeof window[lib.name][lib.init] === 'function') {
                                                try {
                                                    window[lib.name][lib.init]();
                                                } catch(e) {
                                                    console.warn('Error initializing ' + lib.name + '.' + lib.init + '()', e);
                                                }
                                            } else {
                                                // If no specific init function but library exists, it's already a good sign
                                                console.log(lib.name + ' is available in frame');
                                            }
                                        }
                                    });

                                    // Manually trigger DOMContentLoaded for scripts that listen for it
                                    window.document.dispatchEvent(new Event('DOMContentLoaded', {
                                        bubbles: true,
                                        cancelable: true
                                    }));
                                `;
                                frameDoc.body.appendChild(runScripts);
                                return;
                            }

                            const script = scripts[index];
                            const src = script.getAttribute("src");
                            if (src) {
                                // Check if script already exists in head
                                const existingScript = frameDoc.querySelector(`head script[src="${src}"]`);
                                if (!existingScript) {
                                    const newScript = frameDoc.createElement("script");
                                    newScript.src = src;
                                    newScript.onload = () => {
                                        loadExternalScripts(scripts, index + 1);
                                    };
                                    newScript.onerror = () => {
                                        console.warn(`Failed to load script: ${src}`);
                                        loadExternalScripts(scripts, index + 1);
                                    };
                                    frameDoc.head.appendChild(newScript);
                                } else {
                                    // Script already exists, continue to next
                                    loadExternalScripts(scripts, index + 1);
                                }
                            } else {
                                // No src, skip and continue
                                loadExternalScripts(scripts, index + 1);
                            }
                        };

                        // Start loading external scripts
                        if (externalScripts.length > 0) {
                            loadExternalScripts(externalScripts);
                        } else {
                            // No external scripts, just execute inline scripts
                            inlineScripts.forEach((script) => {
                                const newScript = frameDoc.createElement("script");
                                newScript.textContent = script.textContent;
                                frameDoc.body.appendChild(newScript);
                            });

                            // Create a generic script runner
                            const runScripts = frameDoc.createElement("script");
                            runScripts.textContent = `
                                document.dispatchEvent(new CustomEvent('content-loaded'));
                                const commonLibraries = [
                                    { name: 'Prism', init: 'highlightAll' },
                                    { name: 'hljs', init: 'highlightAll' },
                                    { name: 'mermaid', init: 'init' },
                                    { name: 'katex', init: 'renderAll' }
                                ];
                                commonLibraries.forEach(lib => {
                                    if (window[lib.name] && typeof window[lib.name][lib.init] === 'function') {
                                        try {
                                            window[lib.name][lib.init]();
                                        } catch(e) {
                                            console.warn('Error initializing ' + lib.name + '.' + lib.init + '()', e);
                                        }
                                    }
                                });
                            `;
                            frameDoc.body.appendChild(runScripts);
                        }
                    }
                }, 1500);
            },
        });

        editor.Commands.add("export-json", {
            run(ed) {
                const json = ed.getProjectData();
                const dataStr = JSON.stringify(json, null, 2);
                const dataBlob = new Blob([dataStr], { type: "application/json" });
                const url = URL.createObjectURL(dataBlob);
                const link = document.createElement("a");
                link.href = url; link.download = "grapesjs-project.json"; link.click();
                URL.revokeObjectURL(url);
            },
        });

        editor.Commands.add("clear-canvas", {
            run(ed) { if (confirm("Are you sure you want to clear the canvas?")) { ed.DomComponents.clear(); ed.CssComposer.clear(); } },
        });

        editor.Commands.add("toggle-blocks", {
            run() {
                const p = document.querySelector(".w-64.bg-gray-900");
                if (p) p.style.display = p.style.display === "none" ? "block" : "none";
            },
        });
        editor.Commands.add("toggle-right-panel", {
            run() {
                const p = document.querySelector(".w-80.bg-gray-100");
                if (p) p.style.display = p.style.display === "none" ? "block" : "none";
            },
        });

        editor.Commands.add("open-template-gallery", {
            run(ed) {
                const modal = ed.Modal;
                if (!templates || !templates.length) {
                    modal.setTitle("Templates"); modal.setContent(`<div style="padding:16px;color:#e5e7eb;"><p>No templates registered yet.</p></div>`); modal.open(); return;
                }
                const cardsHtml = templates.map((t) => {
                    const safeTitle = t.title.replace(/"/g, "&quot;");
                    const safeDesc = (t.description || "").replace(/"/g, "&quot;");
                    return `<div class="dp-template-card" data-template-id="${t.id}">
<div class="dp-template-thumb"><iframe class="dp-template-iframe" data-template-id="${t.id}" loading="lazy"></iframe></div>
<div class="dp-template-meta"><div class="dp-template-title">${safeTitle}</div>${safeDesc ? `<div class="dp-template-desc">${safeDesc}</div>` : ""}
<button type="button" class="dp-template-apply" data-template-id="${t.id}">Use template</button></div></div>`;
                }).join("");
                const galleryHtml = `<style>
.dp-template-gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;padding:16px;max-height:70vh;overflow-y:auto;background:#111827}
.dp-template-card{display:flex;flex-direction:column;background:#1f2937;border-radius:10px;overflow:hidden;border:1px solid #374151;box-shadow:0 10px 25px rgba(0,0,0,.35)}
.dp-template-thumb{position:relative;width:100%;padding-top:130%;background:radial-gradient(circle at top,#111827,#020617);overflow:hidden}
.dp-template-thumb .dp-template-iframe{position:absolute;top:0;left:0;width:380%;height:380%;transform:scale(0.26);transform-origin:top left;border:0;background:#0b1120}
.dp-template-meta{padding:10px 12px 12px;display:flex;flex-direction:column;gap:6px}
.dp-template-title{font-size:14px;font-weight:600;color:#f9fafb}
.dp-template-desc{font-size:12px;color:#9ca3af}
.dp-template-apply{margin-top:4px;align-self:flex-start;padding:4px 10px;font-size:12px;border-radius:999px;border:1px solid #4f46e5;background:linear-gradient(135deg,#4f46e5,#6366f1);color:#e5e7eb;cursor:pointer;transition:background 120ms ease,transform 80ms ease;box-shadow:0 0 0 1px rgba(79,70,229,.3),0 8px 20px rgba(79,70,229,.5)}
.dp-template-apply:hover{background:linear-gradient(135deg,#6366f1,#818cf8);transform:translateY(-1px)}
</style><div class="dp-template-gallery">${cardsHtml}</div>`;
                modal.setTitle("Choose a template"); modal.setContent(galleryHtml); modal.open();
                const contentEl = modal.getContentEl();
                contentEl.querySelectorAll(".dp-template-iframe").forEach((frame) => {
                    const id = frame.getAttribute("data-template-id");
                    if (!id) return;
                    const tmpl = templates.find((t) => t.id === id);
                    if (tmpl) frame.srcdoc = tmpl.html;
                });
                contentEl.querySelectorAll(".dp-template-apply").forEach((btn) => {
                    const id = btn.getAttribute("data-template-id");
                    if (!id) return;
                    btn.onclick = () => {
                        const tmpl = templates.find((t) => t.id === id);
                        if (!tmpl) return;

                        // Decode + preprocess the template HTML immediately (no stale state)
                        const decodedHtml = decodeHtmlEntities(tmpl.html);
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(decodedHtml, "text/html");
                        let bodyContent = doc.body.innerHTML;
                        bodyContent = preprocessHTML(bodyContent);

                        // ── NEW: Direct Style & Script Injection (Preserves @page, @media, Tailwind Config) ──
                        const frameDoc = ed.Canvas.getDocument();
                        if (frameDoc) {
                            // 1. Inject Styles Directly (Prevents GrapesJS Style Manager from mangling @page/@media)
                            doc.querySelectorAll("style").forEach((s) => {
                                const newStyle = frameDoc.createElement("style");
                                newStyle.textContent = s.textContent;
                                frameDoc.head.appendChild(newStyle);
                            });

                            // 2. Inject Scripts Directly (Tailwind config, custom JS)
                            doc.querySelectorAll("script").forEach((s) => {
                                // Prevent duplicate Tailwind CDN if already in CANVAS_SCRIPTS
                                if (s.src && CANVAS_SCRIPTS.includes(s.src)) return;

                                const newScript = frameDoc.createElement("script");
                                if (s.src) newScript.src = s.src;
                                else newScript.textContent = s.textContent;
                                frameDoc.head.appendChild(newScript);
                            });
                        }

                        // Deselect to prevent lastComponent crash
                        ed.select(null);

                        // Inject directly into the existing .visual-page
                        // (avoids double-wrapping and removable:false conflicts)
                        const wrapper = ed.getWrapper();
                        const pages = wrapper.find(".visual-page");
                        if (pages && pages.length > 0) {
                            pages[0].components(bodyContent || "<div>Start typing your content here...</div>");
                        } else {
                            ed.setComponents([{
                                type: "visual-page",
                                components: bodyContent || "<div>Start typing...</div>"
                            }]);
                        }

                        if (inlineStyles) ed.setStyle(inlineStyles);

                        // Update state AFTER the editor change so re-init won't happen
                        // (dispatch increments htmlUpdateCount which destroys + recreates editor)
                        // We defer it slightly so the current runCommand cycle completes first
                        setTimeout(() => {
                            dispatch({ type: "SET_HTML_CONTENT", payload: tmpl.html });
                        }, 0);

                        // Re-apply page size + markers
                        setTimeout(() => {
                            if (ed.applyPageSize) ed.applyPageSize(pageSizeRef.current, orientationRef.current);
                            if (ed.Canvas && ed.Canvas.getDocument()) ed.updateMarkers?.();
                        }, 150);

                        modal.close();
                    };
                });
            },
        });

        // Page-break utility commands (BasicsGrapejs)
        editor.Commands.add("check-near-lines", {
            run: (ed) => {
                const results = findComponentsNearRedLines(ed, 10);
                if (results.length > 0) { console.table(results.map((r) => ({ ID: r.id, Tag: r.tag }))); console.log(`Found ${results.length} components near page break lines.`); }
                else { console.log("All components are safely away from red lines."); }
            },
        });
        editor.Commands.add("wrap-near-lines", {
            run: (ed) => { const count = wrapFlaggedComponents(ed); console.log(count > 0 ? `Pushed ${count} components below page breaks.` : "Nothing to push."); },
        });
        editor.Commands.add("reset-page-breaks", { run: (ed) => { resetPageBreaks(ed); } });

        // ── AI Regeneration command with streaming (BasicsGrapejs) ───
        let isProcessing = false;
        editor.Commands.add("ai-regenerate", {
            run: async (ed) => {
                const selected = ed.getSelected();
                if (!selected || selected.get("type") === "wrapper") return;
                if (isProcessing) return;
                const originalHTML = convertComponentToInlineCSS(ed, selected, { debug: false });
                return new Promise((resolve) => {
                    const callbacks = modalCallbacksRef.current;
                    callbacks.setModalData({
                        userRequest: "Make a Professional Security resume for Salim Khan, highlighting expertise in network security, ethical hacking, threat intelligence, incident response, vulnerability assessment, cloud security (AWS/Azure), penetration testing tools, and industry certifications like CISSP or CEH. Focus on technical skills, project impact, and security-first mindset.",
                        imageFile: null, imageUrl: "", imagePreview: null,
                        aiProvider: "gemini", openRouterModel: OPENROUTER_MODELS[0],
                        onSubmit: async (userRequest, imageFile, imageUrl, aiProvider, openRouterModel) => {
                            if (!userRequest.trim()) { alert("Please enter a request"); return; }
                            isProcessing = true;
                            callbacks.setShowModal(false);
                            const um = ed.UndoManager;
                            let placeholderComponent = null;
                            let streamingContainer = null;
                            let accumulatedHTML = "";
                            const parent = selected.parent();
                            const index = parent.components().indexOf(selected);
                            try {
                                console.log("📤 Sending to AI:", originalHTML);
                                console.log("📝 User request:", userRequest);
                                if (imageFile) console.log("🖼 Image file:", imageFile.name);
                                if (imageUrl) console.log("🌐 Image URL:", imageUrl);
                                um.start();
                                selected.remove();
                                const placeholderHTML =
                                    '<div class="p-5 border-2 border-dashed border-green-500 bg-blue-50 text-center rounded-lg">' +
                                    '<p class="m-0 text-green-500 font-bold">🔄 AI is generating...</p>' +
                                    '<p class="mt-1.5 text-xs text-gray-600">Streaming response...</p></div>';
                                placeholderComponent = parent.append(placeholderHTML, { at: index });
                                placeholderComponent = Array.isArray(placeholderComponent) ? placeholderComponent[0] : placeholderComponent;
                                ed.select(placeholderComponent);

                                let pendingUpdate = false;
                                let isFinalized = false;
                                let latestHTML = "";
                                let lastCleanedPreview = "";

                                const scheduleUpdate = (isFinal = false) => {
                                    if (isFinalized) return;
                                    if (pendingUpdate && !isFinal) return;
                                    pendingUpdate = true;
                                    requestAnimationFrame(() => {
                                        pendingUpdate = false;
                                        if (isFinalized) return;
                                        try {
                                            if (!streamingContainer) {
                                                if (placeholderComponent) placeholderComponent.remove();
                                                const newContainer = parent.append({
                                                    tagName: "div", content: "",
                                                    attributes: { class: "ai-streaming-wrapper", style: "min-height: 100px; border: 2px dashed #3b82f6; border-radius: 8px; padding: 10px; position: relative; overflow: hidden;" },
                                                }, { at: index });
                                                streamingContainer = Array.isArray(newContainer) ? newContainer[0] : newContainer;
                                                ed.select(streamingContainer);
                                            }
                                            const el = streamingContainer.getEl();
                                            if (el && latestHTML) {
                                                const cleanedPreview = cleanStreamingHTML(latestHTML);
                                                if (cleanedPreview !== lastCleanedPreview || isFinal) {
                                                    lastCleanedPreview = cleanedPreview;
                                                    const temp = document.createElement("div");
                                                    temp.innerHTML = cleanedPreview;
                                                    syncDOMNodes(temp, el);
                                                }
                                            }
                                            if (isFinal && latestHTML && streamingContainer && streamingContainer.parent()) {
                                                isFinalized = true;
                                                console.log("🏁 Finalizing AI component integration...");
                                                const finalHTML = cleanAIResponse(latestHTML);
                                                if (validateAIResponse(finalHTML)) {
                                                    const finalComponent = streamingContainer.replaceWith(finalHTML);
                                                    streamingContainer = null;
                                                    const instantiated = Array.isArray(finalComponent) ? finalComponent[0] : finalComponent;
                                                    if (instantiated) ed.select(instantiated);
                                                }
                                            }
                                        } catch (err) { console.warn("⏳ Waiting for valid HTML chunk...", err); }
                                    });
                                };

                                const streamFn = aiProvider === "openrouter" ? streamOpenRouterAI : streamGeminiAI;
                                const size = PAGE_SIZES[pageSizeRef.current]?.[orientationRef.current];
                                const physWidth = size.width; const physHeight = size.height;

                                const cleanedHTML = await streamFn(originalHTML, userRequest, imageFile, imageUrl, openRouterModel, physHeight, physWidth,
                                    (chunk, isComplete) => {
                                        accumulatedHTML += chunk;
                                        if (isComplete || (accumulatedHTML && accumulatedHTML !== latestHTML)) {
                                            latestHTML = accumulatedHTML;
                                            scheduleUpdate(isComplete);
                                        }
                                    }
                                );

                                latestHTML = cleanedHTML;
                                accumulatedHTML = cleanedHTML;
                                if (!validateAIResponse(accumulatedHTML)) throw new Error("Invalid AI response format");
                                um.stop();
                                console.log("✅ AI streaming completed successfully");
                                setTimeout(() => { console.log("🤖 Post-AI Auto-Fix starting..."); wrapFlaggedComponents(ed); }, 800);
                                resolve();
                            } catch (error) {
                                console.error("❌ Error during AI regeneration:", error);
                                um.undo();
                                alert("AI regeneration failed: " + error.message);
                                resolve();
                            } finally { isProcessing = false; }
                        },
                        onCancel: () => { callbacks.setShowModal(false); resolve(); },
                    });
                    callbacks.setShowModal(true);
                });
            },
        });

        // ── Panel buttons (both files) ─────────────────────────────
        editor.Panels.addButton("options", [
            { id: "reload-html-btn", className: "fa fa-refresh", command: "render-full-html", attributes: { title: "Reload HTML with Dependencies" } },
            { id: "preview-pdf-btn", className: "fa fa-file-pdf-o", command: "send-to-preview", attributes: { title: "Preview & Download PDF" } },
            { id: "open-template-gallery-btn", className: "fa fa-clone", command: "open-template-gallery", attributes: { title: "Open Templates Gallery" } },
            { id: "check-markers", className: "fa fa-search", command: "check-near-lines", attributes: { title: "Check Near Page Breaks" } },
            { id: "wrap-markers", className: "fa fa-cube", command: "wrap-near-lines", attributes: { title: "Wrap Risk Elements" } },
            { id: "ai-regenerate", className: "fa fa-magic", command: "ai-regenerate", attributes: { title: "AI Regenerate" } },
        ]);

        // ── Keyboard shortcuts (Editor.tsx) ───────────────────────
        editor.Keymaps.add("toggle-blocks", "ctrl+b", "toggle-blocks");
        editor.Keymaps.add("toggle-right-panel", "ctrl+r", "toggle-right-panel");

        // ── Custom Tailwind blocks (Editor.tsx) ───────────────────
        editor.BlockManager.add("tailwind-card", {
            label: "Card", category: "Tailwind",
            content: `<div class="max-w-sm rounded overflow-hidden shadow-lg p-6 bg-white"><div class="font-bold text-xl mb-2">Card Title</div><p class="text-gray-700 text-base">Card content goes here. This is a Tailwind CSS card component.</p></div>`,
        });
        editor.BlockManager.add("tailwind-button", {
            label: "Button", category: "Tailwind",
            content: `<button class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">Click Me</button>`,
        });
        editor.BlockManager.add("tailwind-hero", {
            label: "Hero Section", category: "Tailwind",
            content: `<div class="bg-gradient-to-r from-blue-500 to-purple-600 text-white py-20 px-4"><div class="max-w-4xl mx-auto text-center"><h1 class="text-5xl font-bold mb-4">Welcome to Our Site</h1><p class="text-xl mb-8">Build amazing things with Tailwind CSS</p><button class="bg-white text-blue-600 font-bold py-3 px-8 rounded-full hover:bg-gray-100">Get Started</button></div></div>`,
        });
        editor.BlockManager.add("tailwind-profile-avatar", {
            label: "Profile Avatar", category: "Tailwind",
            content: profileAvatarTemplate,
        });


        // ── canvas:frame:load (both files) ────────────────────────
        editor.on("canvas:frame:load", () => {
            const frameDoc = editor.Canvas.getDocument();
            if (!frameDoc) return;

            // Editor.tsx – Tailwind preflight note
            const cfg = frameDoc.createElement("script");
            cfg.textContent = `// Tailwind preflight enabled by default for proper utility behavior`;
            frameDoc.head.insertBefore(cfg, frameDoc.head.firstChild);

            // Editor.tsx – RTL support global styles
            const rtlStyles = frameDoc.createElement("style");
            rtlStyles.textContent = `
[dir="rtl"] { direction: rtl; text-align: right; unicode-bidi: embed; }
[dir="rtl"] p,[dir="rtl"] h1,[dir="rtl"] h2,[dir="rtl"] h3,[dir="rtl"] h4,[dir="rtl"] h5,[dir="rtl"] h6,
[dir="rtl"] div,[dir="rtl"] span,[dir="rtl"] li { direction: rtl; text-align: right; }
[dir="rtl"] * { unicode-bidi: embed; }`;
            frameDoc.head.appendChild(rtlStyles);

            // BasicsGrapejs – Re-apply print styles
            addPrintStyles(pageSizeRef.current, orientationRef.current);

            // BasicsGrapejs – Tailwind config
            const hasTailwindConfig = frameDoc.querySelector('script[data-tailwind-config]');
            if (!hasTailwindConfig) {
                const tailwindConfig = frameDoc.createElement("script");
                tailwindConfig.setAttribute("data-tailwind-config", "true");
                tailwindConfig.textContent = `if (typeof tailwind !== 'undefined') { tailwind.config = { content: { files: [], extract: { html: () => document.body.innerHTML } }, safelist: [{ pattern: /./ }] }; }`;
                frameDoc.head.appendChild(tailwindConfig);
            }
        });

        // ── Expose helpers on editor instance (BasicsGrapejs) ─────
        editor.applyPageSize = applyPageSize;
        editor.updatePageCount = updatePageCount;
        editorRef.current = editor;
        setEditor(editor);
        window.editor = editor;

        return () => { editor.destroy(); };

    }, [exported, state.htmlUpdateCount]);


    // ══════════════════════════════════════════════════════════════
    // PAGE SIZE SYNC useEffect (BasicsGrapejs-gemini-streaming.jsx)
    // ══════════════════════════════════════════════════════════════
    useEffect(() => {
        if (!editor) return;
        editor.applyPageSize?.(pageSize, orientation);
    }, [editor, pageSize, orientation]);

    // ══════════════════════════════════════════════════════════════
    // PAGE BREAK MARKER UPDATE useEffect (BasicsGrapejs-gemini-streaming.jsx)
    // ══════════════════════════════════════════════════════════════
    useEffect(() => {
        if (!editor) return;

        const updateMarkers = () => {
            // SAFETY: Prevents crash if frame document is not accessible/destroyed
            if (!editor?.Canvas) return;
            const frameDoc = editor.Canvas.getDocument();
            if (!frameDoc) return;

            const wrapper = editor.getWrapper();
            const pages = wrapper.find(".visual-page");
            setPageCount(pages.length);

            const results = findComponentsNearRedLines(editor, 10);
            setLayoutIssues(results.length);

            pages.forEach((page) => {
                const el = page.getEl();
                if (!el) return;

                // Remove existing markers
                el.querySelectorAll(".page-break-indicator").forEach((m) => m.remove());

                const pageHeight = pdfPageHeightRef.current;
                const totalHeight = el.scrollHeight;
                const numMarkers = Math.ceil(totalHeight / pageHeight);

                for (let i = 1; i < numMarkers; i++) {
                    const markerY = i * pageHeight;
                    const isBroken = results.some((r) => r.boxes && r.boxes.some((b) => Math.abs(b.markerY - markerY) < 50));

                    const marker = frameDoc.createElement("div");
                    marker.className = "page-break-indicator";
                    Object.assign(marker.style, {
                        position: "absolute",
                        left: "0",
                        right: "0",
                        top: `${markerY}px`,
                        height: "2px",
                        background: isBroken ? "#ff4444" : "#ffaa00",
                        zIndex: "9999",
                        pointerEvents: "none",
                    });
                    el.style.position = "relative";
                    el.appendChild(marker);
                }
            });
        };

        editor.updateMarkers = updateMarkers;
        editor.on("component:add component:remove component:update component:styleUpdate", updateMarkers);
        updateMarkers();

        return () => {
            editor.off("component:add component:remove component:update component:styleUpdate", updateMarkers);
        };
    }, [editor]);

    // ══════════════════════════════════════════════════════════════
    // HANDLERS (BasicsGrapejs-gemini-streaming.jsx)
    // ══════════════════════════════════════════════════════════════

    const handleSizeChange = (newSize) => {
        setPageSize(newSize);
        if (newSize === "CUSTOM") { setShowPDFCustomModal(true); return; }
        editor?.applyPageSize?.(newSize, orientation);
    };

    const handleOrientationToggle = () => {
        const newOrient = orientation === "portrait" ? "landscape" : "portrait";
        setOrientation(newOrient);
        editor?.applyPageSize?.(pageSize, newOrient);
    };

    const applyCustomSize = () => {
        const w = parseFloat(customWidth);
        const h = parseFloat(customHeight);
        if (!w || !h) { alert("Please enter valid dimensions."); return; }
        const unit = customUnit;
        PAGE_SIZES.CUSTOM = {
            portrait: { width: `${w}${unit}`, height: `${h}${unit}` },
            landscape: { width: `${h}${unit}`, height: `${w}${unit}` },
        };
        setShowPDFCustomModal(false);
        editor?.applyPageSize?.("CUSTOM", orientation);
    };

    const handleExportPDF = async () => {
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

                // 2. Forced reflow + settle time for dynamic assets (Charts, 3D, etc.)
                void frameDoc.body.offsetHeight;
                await new Promise(r => setTimeout(r, 1500));

                // 3. Extra wait for the next animation frame to ensure renderers have filled the buffer
                if (frameDoc.defaultView) {
                    await new Promise(r => frameDoc.defaultView.requestAnimationFrame(r));
                }
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
            let contentHtml;
            if (wrapperEl && frameDoc) {
                // Create a temporary clone to manipulate for export without affecting the live editor
                const exportClone = wrapperEl.cloneNode(true);
                const originalCanvases = Array.from(frameDoc.querySelectorAll('canvas'));
                const clonedCanvases = Array.from(exportClone.querySelectorAll('canvas'));

                // 2.a Universal Canvas Snapshotting (Handles Charts, 3D/WebGL, etc.)
                originalCanvases.forEach((canvas, idx) => {
                    const clonedCanvas = clonedCanvases[idx];
                    if (clonedCanvas) {
                        try {
                            const img = frameDoc.createElement('img');
                            const imgData = canvas.toDataURL('image/png');
                            img.src = imgData;
                            // Mirror computed layout
                            const computedStyle = frameDoc.defaultView.getComputedStyle(canvas);
                            img.style.cssText = canvas.style.cssText;
                            img.style.display = computedStyle.display;
                            img.style.width = computedStyle.width;
                            img.style.height = computedStyle.height;
                            img.className = canvas.className;
                            img.width = canvas.width;
                            img.height = canvas.height;

                            clonedCanvas.parentNode.replaceChild(img, clonedCanvas);
                        } catch (e) {
                            console.warn('Failed to snapshot canvas:', e);
                        }
                    }
                });
                contentHtml = exportClone.innerHTML;
            } else {
                contentHtml = editor.getHtml();
            }

            contentHtml = await convertBlobURLsToBase64(contentHtml);

            // 2.b Dynamic Resource Extraction (Universal solution for Tailwind configs, Icons, etc.)
            const headScripts = [];
            const inlineScripts = [];

            // Search the ENTIRE document (head + body) for scripts and styles,
            // because GrapesJS might place template-specific scripts in the body.
            Array.from(frameDoc.querySelectorAll('script')).forEach(s => {
                if (s.src) {
                    if (!CANVAS_SCRIPTS.includes(s.src)) {
                        headScripts.push(s.src);
                    }
                } else if (s.innerHTML.trim()) {
                    inlineScripts.push(s.innerHTML.trim());
                }
            });

            const headStyles = Array.from(frameDoc.querySelectorAll('link[rel="stylesheet"]'))
                .map(l => l.href)
                .filter(href => !CANVAS_STYLES.includes(href));

            // NEW: Extract all inline <style> tags from the entire document (to capture @page, @media, etc.)
            let inlineStyleTagsContent = "";
            Array.from(frameDoc.querySelectorAll('style')).forEach(s => {
                // Filter out behavior styles we manage elsewhere to avoid duplicates
                if (s.id !== "document-behavior-styles") {
                    inlineStyleTagsContent += s.textContent + "\n";
                }
            });

            const allRequiredScripts = [...new Set([...CANVAS_SCRIPTS, ...headScripts])];
            const allRequiredStyles = [...new Set([...CANVAS_STYLES, ...headStyles])];

            // 3. Optimized Architecture: Send the source HTML and the page count separately
            // Instead of duplicating HTML here (which bloats the request), 
            // we send it once and let the backend construct the viewports.
            const singleHtml = contentHtml;

            let css = editor.getCss();

            // Ensure the strict document behavior is included in the PDF CSS, 
            // and append all extracted inline styles from the template.
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
      ` + "\n" + inlineStyleTagsContent + "\n" + css;

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
                scripts: allRequiredScripts,
                inlineScripts: inlineScripts,
                styles: allRequiredStyles,
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
            alert('Failed to generate PDF: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    // ══════════════════════════════════════════════════════════════
    // PREVIEW CONDITIONAL (Editor.tsx)
    // ══════════════════════════════════════════════════════════════
    if (exported) {
        return (
            <PreviewRenderer
                html={exported.html}
                css={exported.css}
                onBack={() => setExported(null)}
            />
        );
    }

    // ══════════════════════════════════════════════════════════════
    // JSX RETURN – centered UI matching BasicsGrapejs-gemini-streaming.jsx
    // ══════════════════════════════════════════════════════════════
    return (
        <>

            {/* ── Full-screen editor wrapper ── */}
            <div className="relative w-full h-[100vh]">

                {/* ── White floating toolbar (centered, fixed at top) ── */}
                <div style={{
                    position: "fixed", top: "10px", left: "50%", transform: "translateX(-50%)",
                    zIndex: 1000, background: "white", padding: "12px 20px", borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", display: "flex", gap: "16px",
                    alignItems: "center", border: "1px solid #e5e7eb",
                }}>
                    {/* Page size info */}
                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span style={{ fontSize: "10px", fontWeight: "bold", color: "#9ca3af", textTransform: "uppercase" }}>Page Size</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#374151", fontWeight: "500" }}>
                                <span>{PAGE_SIZES[pageSize]?.[orientation]?.width} × {PAGE_SIZES[pageSize]?.[orientation]?.height}</span>
                                <span style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "400" }}>({pdfPageHeight?.toFixed(1)}px / page)</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ width: "1px", height: "24px", background: "#e5e7eb" }} />

                    {/* Size picker */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <label style={{ fontSize: "14px", fontWeight: "500", color: "#374151" }}>Size:</label>
                        <select
                            value={pageSize}
                            onChange={(e) => handleSizeChange(e.target.value)}
                            style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "14px", cursor: "pointer", background: "white" }}
                        >
                            <option value="A4">A4</option>
                            <option value="LETTER">Letter</option>
                            <option value="A5">A5</option>
                            <option value="CUSTOM">Custom…</option>
                        </select>
                    </div>

                    <div style={{ width: "1px", height: "24px", background: "#e5e7eb" }} />

                    {/* Orientation toggle */}
                    <button
                        onClick={handleOrientationToggle}
                        style={{
                            padding: "6px 16px", borderRadius: "6px", border: "1px solid #d1d5db",
                            background: orientation === "portrait" ? "#3b82f6" : "#f3f4f6",
                            color: orientation === "portrait" ? "white" : "#374151",
                            fontSize: "14px", fontWeight: "500", cursor: "pointer",
                        }}
                    >
                        📄 {orientation === "portrait" ? "Portrait" : "Landscape"}
                    </button>

                    <div style={{ width: "1px", height: "24px", background: "#e5e7eb" }} />

                    {/* Export PDF */}
                    <button
                        onClick={handleExportPDF}
                        disabled={isGeneratingPDF}
                        style={{
                            padding: "6px 16px", borderRadius: "6px", border: "1px solid #ef4444",
                            background: isGeneratingPDF ? "#9ca3af" : "#ef4444",
                            color: "white", fontSize: "14px", fontWeight: "500",
                            cursor: isGeneratingPDF ? "not-allowed" : "pointer",
                            opacity: isGeneratingPDF ? 0.7 : 1,
                        }}
                    >
                        {isGeneratingPDF ? "⏳ Generating..." : "📄 Export PDF"}
                    </button>
                </div>

                {/* ── GrapesJS mounts here ── */}
                <div id="gjs-editor" ref={containerRef} className="w-full h-full" />
            </div>

            {/* ── Custom page size modal ── */}
            {showPDFCustomModal && (
                <div style={{
                    position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000,
                    display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                    <div style={{
                        background: "white", padding: "24px", borderRadius: "12px", width: "400px",
                        boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
                    }}>
                        <h3 style={{ margin: "0 0 20px 0", fontSize: "18px", fontWeight: "600" }}>Custom Page Size</h3>
                        <div style={{ marginBottom: "16px" }}>
                            <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "500" }}>Width</label>
                            <div style={{ display: "flex", gap: "8px" }}>
                                <input type="number" value={customWidth} onChange={(e) => setCustomWidth(e.target.value)}
                                    style={{ flex: 1, padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "6px" }} />
                                <select value={customUnit} onChange={(e) => setCustomUnit(e.target.value)}
                                    style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "6px" }}>
                                    <option value="mm">mm</option>
                                    <option value="in">in</option>
                                    <option value="cm">cm</option>
                                    <option value="px">px</option>
                                </select>
                            </div>
                        </div>
                        <div style={{ marginBottom: "24px" }}>
                            <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "500" }}>Height</label>
                            <input type="number" value={customHeight} onChange={(e) => setCustomHeight(e.target.value)}
                                style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "6px" }} />
                        </div>
                        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                            <button onClick={() => setShowPDFCustomModal(false)} style={{
                                padding: "8px 16px", borderRadius: "6px", border: "1px solid #d1d5db", background: "white", cursor: "pointer",
                            }}>Cancel</button>
                            <button onClick={applyCustomSize} style={{
                                padding: "8px 16px", borderRadius: "6px", border: "none", background: "#3b82f6", color: "white", cursor: "pointer",
                            }}>Apply</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── AI Regeneration Modal ── */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <h2 className="text-2xl font-bold mb-4">AI Regenerate Component</h2>

                            <form onSubmit={(e) => { e.preventDefault(); modalData.onSubmit?.(modalData.userRequest, modalData.imageFile, modalData.imageUrl, modalData.aiProvider, modalData.openRouterModel); }}>

                                {/* AI Provider */}
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">AI Provider</label>
                                    <select
                                        value={modalData.aiProvider}
                                        onChange={(e) => setModalData({ ...modalData, aiProvider: e.target.value, imageFile: null, imageUrl: "", imagePreview: null })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="gemini">🔮 Gemini (supports images)</option>
                                        <option value="openrouter">🌐 OpenRouter (text only)</option>
                                    </select>
                                </div>

                                {/* OpenRouter model */}
                                {modalData.aiProvider === "openrouter" && (
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">OpenRouter Model</label>
                                        <select
                                            value={modalData.openRouterModel}
                                            onChange={(e) => setModalData({ ...modalData, openRouterModel: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                                        >
                                            {OPENROUTER_MODELS.map((m) => (<option key={m} value={m}>{m}</option>))}
                                        </select>
                                        <p className="mt-1 text-xs text-gray-500">{OPENROUTER_MODELS.length} free models available</p>
                                    </div>
                                )}

                                {/* Prompt */}
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">What would you like to change?</label>
                                    <textarea
                                        value={modalData.userRequest}
                                        onChange={(e) => setModalData({ ...modalData, userRequest: e.target.value })}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault();
                                                modalData.onSubmit?.(modalData.userRequest, modalData.imageFile, modalData.imageUrl, modalData.aiProvider, modalData.openRouterModel);
                                            }
                                        }}
                                        rows={4}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder='e.g., "make it a hero section", "add a button", "change colors to blue"'
                                        required
                                    />
                                </div>

                                {/* Image URL – Gemini only */}
                                {modalData.aiProvider === "gemini" && (
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Image URL (Optional)</label>
                                        <input
                                            type="url" value={modalData.imageUrl}
                                            onChange={(e) => { const url = e.target.value; setModalData({ ...modalData, imageUrl: url, imageFile: null, imagePreview: url || null }); }}
                                            placeholder="https://example.com/image.jpg"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <p className="mt-1 text-xs text-gray-500">Enter an image URL or upload a file below</p>
                                    </div>
                                )}

                                {/* Divider – Gemini only */}
                                {modalData.aiProvider === "gemini" && (
                                    <div className="mb-4 flex items-center">
                                        <div className="flex-1 border-t border-gray-300" />
                                        <span className="px-2 text-sm text-gray-500">OR</span>
                                        <div className="flex-1 border-t border-gray-300" />
                                    </div>
                                )}

                                {/* Image Upload – Gemini only */}
                                {modalData.aiProvider === "gemini" && (
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Upload Image (Optional)</label>
                                        <input
                                            type="file" accept="image/*"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    if (!file.type.startsWith("image/")) { alert("Please select an image file"); return; }
                                                    const reader = new FileReader();
                                                    reader.onloadend = () => { setModalData({ ...modalData, imageFile: file, imageUrl: "", imagePreview: reader.result }); };
                                                    reader.readAsDataURL(file);
                                                }
                                            }}
                                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                                        />
                                        {modalData.imagePreview && (
                                            <div className="mt-4">
                                                <img src={modalData.imagePreview} alt="Preview" className="max-w-full h-auto max-h-48 rounded-lg border border-gray-300" />
                                                <button type="button" onClick={() => setModalData({ ...modalData, imageFile: null, imageUrl: "", imagePreview: null })} className="mt-2 text-sm text-red-600 hover:text-red-800">Remove Image</button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* OpenRouter info */}
                                {modalData.aiProvider === "openrouter" && (
                                    <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                        <p className="text-sm text-blue-700">🌐 <strong>OpenRouter</strong> uses free models for text-based HTML generation. Image support is not available with this provider.</p>
                                    </div>
                                )}

                                {/* Buttons */}
                                <div className="flex gap-4 justify-end">
                                    <button type="button" onClick={() => modalData.onCancel?.()}
                                        className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors">
                                        Cancel
                                    </button>
                                    <button type="submit"
                                        className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors">
                                        Generate
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Floating layout-issue badge ── */}
            {layoutIssues > 0 && (
                <div
                    className="fixed top-20 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 bg-red-600 text-white px-4 py-2 rounded-full shadow-2xl animate-bounce hover:animate-none group cursor-pointer border-2 border-white/20 transition-all active:scale-95"
                    onClick={() => editor && wrapFlaggedComponents(editor)}
                    title="Click to fix all page break issues"
                >
                    <div className="flex items-center gap-2">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
                        </span>
                        <span className="font-bold text-sm tracking-wide uppercase">
                            {layoutIssues} PAGE BREAK {layoutIssues === 1 ? "ISSUE" : "ISSUES"} DETECTED
                        </span>
                    </div>
                    <button className="bg-white text-red-600 px-3 py-0.5 rounded-full text-xs font-black uppercase group-hover:bg-red-50 transition-colors shadow-sm">
                        Fix All
                    </button>
                </div>
            )}
        </>
    );
} // end MainEditor


// ======================================================================
// GEMINI AI STREAMING (via backend) – from BasicsGrapejs-gemini-streaming.jsx
// ======================================================================
async function streamGeminiAI(originalHTML, userRequest, imageFile, imageUrl, model, physH, physW, onChunk) {
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
// OPENROUTER AI STREAMING (via backend) – from BasicsGrapejs-gemini-streaming.jsx
// ======================================================================
async function streamOpenRouterAI(originalHTML, userRequest, imageFile, imageUrl, model, physH, physW, onChunk) {
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

// ======================================================================
// STREAMING UTILS – from BasicsGrapejs-gemini-streaming.jsx
// ======================================================================

/** Strips partial tags and markdown from a streaming HTML string. */
function cleanStreamingHTML(html) {
    const firstTag = html.indexOf("<");
    if (firstTag === -1) return "";
    let result = html.substring(firstTag);
    const lastOpen = result.lastIndexOf("<");
    const lastClose = result.lastIndexOf(">");
    if (lastOpen > lastClose) result = result.substring(0, lastOpen);
    return result.replace(/```\s*$/i, "").trim();
}

/** Minimal recursive DOM syncing to prevent flickering. */
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
        } else if (s.nodeType === 3) {
            if (d.nodeValue !== s.nodeValue) d.nodeValue = s.nodeValue;
        } else if (s.outerHTML !== d.outerHTML) {
            if (i === sNodes.length - 1 || s.children.length < 10) { syncDOMNodes(s, d); }
            else { dest.replaceChild(s.cloneNode(true), d); }
        }
    }
    while (dest.childNodes.length > sNodes.length) dest.removeChild(dest.lastChild);
}

// ======================================================================
// RESPONSE CLEANING – from BasicsGrapejs-gemini-streaming.jsx
// ======================================================================

function getProblematicClassReplacement(cls, heightStr, widthStr) {
    const map = {
        "h-screen": `min-h-[${heightStr}]`,
        "min-h-screen": `min-h-[${heightStr}]`,
        "max-h-screen": `max-h-[${heightStr}]`,
        "h-full": "h-auto",
        "min-h-full": `min-h-[${heightStr}]`,
        "w-screen": `w-[${widthStr}]`,
        "min-w-screen": `w-[${widthStr}]`,
    };
    return map[cls];
}

function sanitizeA4Styles(html, physH = "297mm", physW = "210mm") {
    if (!html || typeof html !== "string") return html;

    const parsePhys = (str) => {
        const m = str.match(/^([\d.]+)([a-z%]+)$/i);
        return m ? { val: parseFloat(m[1]), unit: m[2] } : { val: 0, unit: "px" };
    };

    const h = parsePhys(physH);
    const w = parsePhys(physW);

    return html
        .replace(/class="([^"]*)"/g, (match, classList) => {
            if (!classList) return match;
            const cleaned = classList
                .split(/\s+/)
                .map((cls) => {
                    if (!cls) return "";
                    // 1. Collapse breakpoints (sm:flex → flex)
                    const colonIdx = cls.indexOf(":");
                    if (colonIdx !== -1) {
                        const prefix = cls.substring(0, colonIdx);
                        if (["sm", "md", "lg", "xl", "2xl"].includes(prefix)) cls = cls.substring(colonIdx + 1);
                    }
                    // 2. Replace known problematic classes
                    const replacement = getProblematicClassReplacement(cls, physH, physW);
                    if (replacement) return replacement;
                    // 3. Convert JIT viewport values inside brackets
                    if (cls.includes("[") && /[0-9.]v[hw]/i.test(cls)) {
                        return cls.replace(/(\d+(?:\.\d+)?)v([hw])/gi, (_, num, unit) => {
                            const base = unit.toLowerCase() === "h" ? h : w;
                            const finalVal = ((parseFloat(num) / 100) * base.val).toFixed(2);
                            return `${finalVal}${base.unit}`;
                        });
                    }
                    // 4. Convert embedded physical dimensions inside brackets
                    if (cls.includes("[")) {
                        return cls
                            .replace(/297\s*mm|29\.7\s*cm|11\s*in/gi, physH)
                            .replace(/210\s*mm|21\s*cm|8\.5\s*in/gi, physW);
                    }
                    return cls;
                })
                .filter(Boolean)
                .join(" ");
            return `class="${cleaned.trim()}"`;
        })
        // 5. Convert viewport units in inline styles
        .replace(/style="([^"]*)"/gi, (match, styles) => {
            if (!styles.toLowerCase().includes("vh") && !styles.toLowerCase().includes("vw")) return match;
            const cleaned = styles.replace(/(\d+(?:\.\d+)?)v([hw])/gi, (_, num, unit) => {
                const base = unit.toLowerCase() === "h" ? h : w;
                const finalVal = ((parseFloat(num) / 100) * base.val).toFixed(2);
                return `${finalVal}${base.unit}`;
            });
            return `style="${cleaned}"`;
        });
}

function cleanAIResponse(html, physH, physW) {
    let cleaned = html.trim();
    // Remove markdown code fences
    cleaned = cleaned.replace(/^```html\s*/i, "");
    cleaned = cleaned.replace(/^```\s*/i, "");
    cleaned = cleaned.replace(/\s*```$/i, "");
    // Remove HTML document wrappers
    cleaned = cleaned.replace(/^<!DOCTYPE[^>]*>/i, "");
    cleaned = cleaned.replace(/^<html[^>]*>/i, "").replace(/<\/html>\s*$/i, "");
    cleaned = cleaned.replace(/<head[^>]*>.*?<\/head>/is, "");
    cleaned = cleaned.replace(/^<body[^>]*>/i, "").replace(/<\/body>\s*$/i, "");
    // Strip breakpoints and viewport units
    cleaned = sanitizeA4Styles(cleaned, physH, physW);
    return cleaned.trim();
}

// ======================================================================
// VALIDATION – from BasicsGrapejs-gemini-streaming.jsx
// ======================================================================
function validateAIResponse(aiHTML) {
    const trimmed = aiHTML.trim();
    if (!trimmed) { console.error("❌ AI response is empty"); return false; }
    if (!trimmed.startsWith("<")) { console.error("❌ AI response doesn't start with HTML tag"); return false; }
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(trimmed, "text/html");
        if (!doc.body.firstElementChild) { console.error("❌ AI response doesn't contain valid HTML elements"); return false; }
        const parserError = doc.querySelector("parsererror");
        if (parserError) { console.error("❌ HTML parsing error:", parserError.textContent); return false; }
    } catch (parseError) { console.error("❌ Failed to parse AI response:", parseError); return false; }
    console.log("✅ AI response validation passed");
    return true;
}


