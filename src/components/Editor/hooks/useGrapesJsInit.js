import { useEffect, useRef } from "react";
import grapesjs from "grapesjs";
import gjsBlocksBasic from "grapesjs-blocks-basic";
import gjsForms from "grapesjs-plugin-forms";
import gjsPreset from "grapesjs-preset-webpage";
import "grapesjs/dist/css/grapes.min.css";
import { defaultHtml } from "../../../data/defaultHtml";
import { profileAvatarTemplate } from "../../../data/resume-templates/templateExports";
import { templates } from "../../../data/resume-templates/templateRegistry";
import { preprocessHTML, wrapTextNodesForGrapesJS } from "../utils/grapesjsTextWrapping";
import { stripFixationStyles } from "../utils/findNearMarkers";
import { convertComponentToInlineCSS } from "../utils/cssToInline";
import {
    applyRTLIfNeeded, convertToPixels, decodeHtmlEntities, generateRandomClass,
} from "../utils/grapesJsHelpers";
import {
    PAGE_SIZES, DOCUMENT_STRICT_STYLES, CANVAS_SCRIPTS, CANVAS_STYLES,
} from "../utils/editorConstants";


const TEXT_ELEMENTS = ["p", "h1", "h2", "h3", "h4", "h5", "h6", "span", "div", "blockquote", "a", "strong", "em", "b", "i", "u", "li", "td", "th", "section", "article", "header", "footer", "main", "aside", "nav", "pre", "code"];
const INLINE_ELEMENTS = ["span", "a", "strong", "em", "b", "i", "u", "code", "small", "sub", "sup"];

/**
 * Initialises GrapesJS, registers component types, commands, panel buttons,
 * and all event listeners. Exposes applyPageSize / updatePageCount / updateMarkers
 * on the editor instance. Destroys the editor on unmount.
 */
export function useGrapesJsInit({
    containerRef,
    editorRef,
    blobURLsRef,
    state,
    dispatch,
    exported,
    setExported,
    setEditor,
    pageSizeRef,
    orientationRef,
    pdfPageHeightRef,
    setPdfPageHeight,
    setPageCount,
    modalCallbacksRef,
}) {
    useEffect(() => {
        if (exported) return;
        if (!containerRef.current) return;

        // 🚀 PERSISTENCE: If editor already exists, don't re-init
        if (editorRef.current) {
            console.log("♻️ Reusing existing editor instance");
            return;
        }

        console.log("🏗️ Initializing GrapesJS Editor");
        const editor = grapesjs.init({
            container: "#gjs-editor",
            height: "100vh",
            width: "auto",
            storageManager: false,
            fromElement: false,
            undoManager: { trackSelection: true }, // 🔄 Explicitly enabled
            deviceManager: { devices: [{ name: "Desktop", width: "" }] },
            plugins: [gjsBlocksBasic, gjsForms, gjsPreset],
            pluginsOpts: {
                "grapesjs-preset-webpage": {
                    blocksBasic: true,
                    forms: true,
                    textPlugin: true,
                },
            },
            selectorManager: {
                componentFirst: true,
                escapeName: (name) => name,
                forceClass: false, // Prevents moving inline styles to classes
            },
            avoidInlineStyle: false, // Explicitly allow inline styles
            canvas: {
                scripts: CANVAS_SCRIPTS,
                styles: CANVAS_STYLES,
            },
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
                        if (file.size > maxSize) { alert(`${file.name} exceeds 5MB limit`); return; }
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
        });

        // ── Clean up deleted blob assets ──────────────────────────
        editor.on("asset:remove", (asset) => {
            const src = asset.get("src");
            if (src?.startsWith("blob:")) {
                URL.revokeObjectURL(src);
                blobURLsRef.current.delete(src);
                console.log(`🗑️ Blob URL revoked: ${src}`);
            }
        });

        // ── Strip fixation styles on clone ────────────────────────
        editor.on("component:clone", (cloned) => {
            stripFixationStyles(cloned);
            console.log("✨ Cloned component stripped of page-break fixation styles");
        });

        // ── Register visual-page component ────────────────────────
        editor.Components.addType("visual-page", {
            isComponent: (el) => el.classList && el.classList.contains("visual-page"),
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
            if (!editor?.Canvas) return;
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
            }
            const ed = editor;
            if (!ed || typeof ed.getWrapper !== "function") return;
            const wrapper = ed.getWrapper();
            if (!wrapper) return;
            const pages = wrapper.find(".visual-page");
            pages.forEach((page) => {
                // Original only sets width constraints — no min-height
                page.addStyle({
                    width: size.width,
                    "min-width": size.width,
                    "max-width": size.width,
                });
            });
            addPrintStyles(sizeKey, orient);
            setTimeout(() => { editor.updateMarkers?.(); }, 50);
        }

        // ── Helper: update page count state ────────────────────────
        function updatePageCount() {
            const ed = editor;
            if (!ed || typeof ed.getWrapper !== "function") return;
            const wrapper = ed.getWrapper();
            if (!wrapper) return;
            const pages = wrapper.find(".visual-page");

            const pageHeight = pdfPageHeightRef.current;
            if (!pageHeight || pageHeight <= 0) {
                setPageCount(pages.length);
                return;
            }

            let totalVirtualPages = 0;
            pages.forEach((page) => {
                const el = page.getEl();
                if (el) {
                    const numberOfPages = Math.ceil(el.scrollHeight / pageHeight);
                    totalVirtualPages += Math.max(1, numberOfPages);
                }
            });
            setPageCount(totalVirtualPages);
        }

        editor.applyPageSize = applyPageSize;
        editor.updatePageCount = updatePageCount;
        window.editor = editor;

        // ── load event ─────────────────────────────────────────────
        editor.on("load", () => {
            if (typeof editor.getWrapper !== "function") return;
            const wrapper = editor.getWrapper();
            wrapper.setStyle({
                background: "black",
                padding: "80px 20px 40px",
                "min-height": "100vh",
            });

            editor.Panels.removeButton("options", "canvas-clear");
            editor.Panels.removeButton("options", "gjs-open-import-webpage");
            editor.Panels.removeButton("views", "open-tm");

            if (!wrapper.find(".visual-page").length) {
                setTimeout(() => {
                    editor.runCommand("render-full-html", { html: state.htmlContent || defaultHtml });
                }, 50);
                return;
            }

            applyPageSize(pageSizeRef.current, orientationRef.current);
            addPrintStyles(pageSizeRef.current, orientationRef.current);
            updatePageCount();

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

        // ── component:add – SVG ────────────────────────────────────
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

        // ── component:add – text resizing + RTL ───────────────────
        editor.on("component:add", (component) => {
            const tagName = component.get("tagName")?.toLowerCase();
            if (TEXT_ELEMENTS.includes(tagName) || component.is("text") || component.is("link") || component.is("textnode")) {
                component.set({ resizable: true, editable: true, selectable: true, hoverable: true, droppable: true });
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

        // ── component:create ──────────────────────────────────────
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

        // ── component:selected ────────────────────────────────────
        let currentResizeClass = null;
        editor.on("component:selected", (component) => {
            const tagName = component.get("tagName")?.toLowerCase();
            if (TEXT_ELEMENTS.includes(tagName) || component.is("text") || component.is("link") || component.is("textnode")) {
                if (!component.get("resizable")) component.set("resizable", true);
                if (INLINE_ELEMENTS.includes(tagName)) {
                    const cur = component.getStyle("display");
                    if (!cur || cur === "inline") component.addStyle({ display: "inline-block" });
                }
                // Disabled: Injecting random classes (resize-xxx) on every click forces the 
                // browser to recalculate the CSS for the component and all descendants.
                // It was historically used to 'trick' old GrapesJS UI repaints but is completely deprecated
                // and causes massive lag on 15+ page documents.
                applyRTLIfNeeded(component);
            }
            if (component && component.is && component.is("image")) {
                const toolbar = component.get("toolbar") || [];
                if (!toolbar.some((t) => t.id === "change-image")) {
                    toolbar.unshift({ id: "change-image", attributes: { class: "fa fa-image", title: "Change image" }, command: "change-image" });
                    component.set("toolbar", toolbar);
                }
            }
        });

        // ── component:selected – AI inline CSS log ────────────────
        editor.on("component:selected", (component) => {
            if (!component) return;
            // Offload the massive inline CSS compilation off the main paint thread
            const compileLog = () => {
                try {
                    const htmlWithInline = convertComponentToInlineCSS(editor, component, { debug: false });
                    console.log("Selected component HTML with inline styles (for AI):", htmlWithInline);
                } catch (e) {
                    console.error("AI CSS logger failed:", e);
                }
            };

            if ("requestIdleCallback" in window) {
                window.requestIdleCallback(compileLog, { timeout: 1000 });
            } else {
                setTimeout(compileLog, 150);
            }
        });

        // ── component:update RTL ──────────────────────────────────
        editor.on("component:update", (component) => {
            // Only evaluate the specific component that changed. Removing the intense
            // O(N) recursive DOM tree traversal prevents freezing the browser when editing layouts.
            applyRTLIfNeeded(component);
        });

        editor.on("component:styleUpdate", (component) => { applyRTLIfNeeded(component); });

        editor.on("component:dblclick", (component) => {
            if (!component || !component.is || !component.is("image")) return;
            editor.runCommand("open-assets", { target: component, types: ["image"] });
        });

        // ── Resizable text component types ────────────────────────
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

        editor.setDevice("Desktop");

        editor.DomComponents.addType("cell", {
            extend: "cell",
            model: { defaults: { editable: true, selectable: true, hoverable: true, droppable: true } },
        });

        editor.DomComponents.addType("iframe-wrapper", {
            model: {
                defaults: {
                    tagName: "div", droppable: true,
                    attributes: { class: "iframe-wrapper" }, traits: [],
                    components: [{ type: "iframe", attributes: { src: "", style: "width: 100%; height: 100%; border: none;" }, content: "" }],
                },
            },
        });

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


        editor.Keymaps.add("toggle-blocks", "ctrl+b", "toggle-blocks");
        editor.Keymaps.add("toggle-right-panel", "ctrl+r", "toggle-right-panel");

        // ── Custom Tailwind blocks ────────────────────────────────
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

        // ── canvas:frame:load ─────────────────────────────────────
        editor.on("canvas:frame:load", () => {
            const frameDoc = editor.Canvas.getDocument();
            if (!frameDoc) return;

            const cfg = frameDoc.createElement("script");
            cfg.textContent = `// Tailwind preflight enabled by default for proper utility behavior`;
            frameDoc.head.insertBefore(cfg, frameDoc.head.firstChild);

            const rtlStyles = frameDoc.createElement("style");
            rtlStyles.textContent = `
[dir="rtl"] { direction: rtl; text-align: right; unicode-bidi: embed; }
[dir="rtl"] p,[dir="rtl"] h1,[dir="rtl"] h2,[dir="rtl"] h3,[dir="rtl"] h4,[dir="rtl"] h5,[dir="rtl"] h6,
[dir="rtl"] div,[dir="rtl"] span,[dir="rtl"] li { direction: rtl; text-align: right; }
[dir="rtl"] * { unicode-bidi: embed; }`;
            frameDoc.head.appendChild(rtlStyles);

            addPrintStyles(pageSizeRef.current, orientationRef.current);

            const hasTailwindConfig = frameDoc.querySelector('script[data-tailwind-config]');
            if (!hasTailwindConfig) {
                const tailwindConfig = frameDoc.createElement("script");
                tailwindConfig.setAttribute("data-tailwind-config", "true");
                tailwindConfig.textContent = `if (typeof tailwind !== 'undefined') { tailwind.config = { content: { files: [], extract: { html: () => document.body.innerHTML } }, safelist: [{ pattern: /./ }] }; }`;
                frameDoc.head.appendChild(tailwindConfig);
            }
        });

        editor.applyPageSize = applyPageSize;
        editor.updatePageCount = updatePageCount;
        editorRef.current = editor;
        setEditor(editor);
        return () => {
            // We only destroy if the component is actually unmounting,
            // not when exported state changes (handled by the dependency array)
        };

    }, [exported]);

    // ── Sync with external HTML logic (Templates Gallery, AI state) ──
    const lastUpdateCountRef = useRef(state.htmlUpdateCount);
    useEffect(() => {
        const ed = editorRef.current;
        if (!ed || state.htmlUpdateCount === 0) return;

        // Only trigger if actually changed externally
        if (state.htmlUpdateCount !== lastUpdateCountRef.current) {
            console.log("🔄 Global state changed, syncing editor content");
            ed.runCommand("render-full-html", { html: state.htmlContent });
            lastUpdateCountRef.current = state.htmlUpdateCount;
        }
    }, [state.htmlUpdateCount]);
}
