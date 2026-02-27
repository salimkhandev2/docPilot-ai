"use client";
import { useEffect } from "react";
import { defaultHtml } from "../../../data/defaultHtml";
import { templates } from "../../../data/resume-templates/templateRegistry";
import { preprocessHTML } from "../utils/grapesjsTextWrapping";
import { convertComponentToInlineCSS } from "../utils/cssToInline";
import { findComponentsNearRedLines, wrapPageBreaks, resetPageBreaks } from "../utils/findNearMarkers";
import { applyRTLIfNeeded, decodeHtmlEntities } from "../utils/grapesJsHelpers";
import { PAGE_SIZES, OPENROUTER_MODELS } from "../utils/editorConstants";
import { cleanAIResponse, cleanStreamingHTML, syncDOMNodes, validateAIResponse } from "../utils/htmlSanitizer";
import { streamGeminiAI, streamOpenRouterAI } from "../services/aiStreamingService";

export function useGrapesJsCommands({
    editor,
    state,
    dispatch,
    pageSizeRef,
    orientationRef,
    setExported,
    modalCallbacksRef,
}) {
    useEffect(() => {
        if (!editor) return;

        // ── Standard View Commands ─────────────────────────────────
        editor.Commands.add("show-layers", { run(ed) { ed.Panels.getButton("views", "open-layers")?.set("active", 1); } });
        editor.Commands.add("show-styles", { run(ed) { ed.Panels.getButton("views", "open-sm")?.set("active", 1); } });
        editor.Commands.add("show-traits", { run(ed) { ed.Panels.getButton("views", "open-tm")?.set("active", 1); } });
        editor.Commands.add("undo", { run(ed) { ed.UndoManager.undo(); } });
        editor.Commands.add("redo", { run(ed) { ed.UndoManager.redo(); } });

        editor.Commands.add("change-image", {
            run(ed, _sender, opts) {
                const target = (opts && opts.target) || ed.getSelected();
                if (target && target.is && target.is("image")) { ed.runCommand("open-assets", { target, types: ["image"] }); }
            },
        });

        // ── PDF Preview Command ───────────────────────────────────
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

        // ── Full Render Command (Syncing HTML) ─────────────────────
        editor.Commands.add("render-full-html", {
            run(ed, sender, opts) {
                ed.select(null);
                const rawHtml = (opts && opts.html) || state.htmlContent || defaultHtml;
                const decodedHtml = decodeHtmlEntities(rawHtml);
                const parser = new DOMParser();
                const doc = parser.parseFromString(decodedHtml, "text/html");

                const styleLinks = Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).map(l => l.getAttribute("href")).filter(Boolean);
                const scriptSources = Array.from(doc.querySelectorAll("script[src]")).map(s => s.getAttribute("src")).filter(Boolean);
                const currentStyles = ed.Canvas.getConfig().styles || [];
                const currentScripts = ed.Canvas.getConfig().scripts || [];
                styleLinks.forEach(href => { if (!currentStyles.includes(href)) currentStyles.push(href); });
                scriptSources.forEach(src => { if (!currentScripts.includes(src)) currentScripts.push(src); });

                const visualPage = doc.querySelector('[data-gjs-type="visual-page"], .visual-page');
                let inlineStyles = "";
                doc.querySelectorAll("style").forEach((s) => { inlineStyles += s.textContent || ""; });

                let bodyContent = doc.body.innerHTML;
                bodyContent = preprocessHTML(bodyContent);

                if (visualPage) {
                    ed.setComponents(bodyContent);
                } else {
                    ed.setComponents([{ type: "visual-page", components: bodyContent || "<div>Start typing your content here...</div>" }]);
                }

                if (inlineStyles) ed.setStyle(inlineStyles);

                setTimeout(() => {
                    if (ed.applyPageSize) ed.applyPageSize(pageSizeRef.current, orientationRef.current);
                }, 50);

                setTimeout(() => {
                    const allComponents = ed.DomComponents.getComponents();
                    const checkAll = (comps) => {
                        if (comps) comps.forEach((comp) => {
                            const tag = comp.get("tagName")?.toLowerCase();
                            if (tag === "td" || tag === "th") {
                                comp.set({ editable: true, selectable: true, hoverable: true, droppable: true });
                            }
                            applyRTLIfNeeded(comp);
                            if (comp.components) checkAll(comp.components());
                        });
                    };
                    checkAll(allComponents);
                    if (ed.Canvas && ed.Canvas.getDocument()) ed.updateMarkers?.();
                }, 100);

                // Inject scripts into frame
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
                                inlineScripts.forEach((script) => {
                                    const ns = frameDoc.createElement("script");
                                    ns.textContent = script.textContent;
                                    frameDoc.body.appendChild(ns);
                                });
                                const runScripts = frameDoc.createElement("script");
                                runScripts.textContent = `
                                    document.dispatchEvent(new CustomEvent('content-loaded'));
                                    const commonLibraries = [
                                        { name: 'Prism', init: 'highlightAll' },
                                        { name: 'hljs', init: 'highlightAll' },
                                        { name: 'mermaid', init: 'init' },
                                        { name: 'katex', init: 'renderAll' },
                                        { name: 'Chart', init: null }
                                    ];
                                    commonLibraries.forEach(lib => {
                                        if (window[lib.name]) {
                                            if (lib.init && typeof window[lib.name][lib.init] === 'function') {
                                                try { window[lib.name][lib.init](); } catch(e) { console.warn('Error initializing ' + lib.name + '.' + lib.init + '()', e); }
                                            }
                                        }
                                    });
                                    window.document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true, cancelable: true }));
                                `;
                                frameDoc.body.appendChild(runScripts);
                                return;
                            }
                            const script = scripts[index];
                            const src = script.getAttribute("src");
                            if (src) {
                                if (!frameDoc.querySelector(`head script[src="${src}"]`)) {
                                    const newScript = frameDoc.createElement("script");
                                    newScript.src = src;
                                    newScript.onload = () => { loadExternalScripts(scripts, index + 1); };
                                    newScript.onerror = () => { loadExternalScripts(scripts, index + 1); };
                                    frameDoc.head.appendChild(newScript);
                                } else { loadExternalScripts(scripts, index + 1); }
                            } else { loadExternalScripts(scripts, index + 1); }
                        };

                        if (externalScripts.length > 0) loadExternalScripts(externalScripts);
                        else {
                            inlineScripts.forEach((s) => {
                                const ns = frameDoc.createElement("script"); ns.textContent = s.textContent; frameDoc.body.appendChild(ns);
                            });
                        }
                    }
                }, 1500);
            },
        });

        // ── Utility Commands ──────────────────────────────────────
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

        // ── Template Gallery Command ──────────────────────────────
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
                        ed.runCommand("render-full-html", { html: tmpl.html });
                        setTimeout(() => { dispatch({ type: "SET_HTML_CONTENT", payload: tmpl.html }); }, 0);
                        modal.close();
                    };
                });
            },
        });

        // ── Page Break Helper Commands ────────────────────────────
        editor.Commands.add("check-near-lines", {
            run: (ed) => {
                const results = findComponentsNearRedLines(ed, 10);
                if (results.length > 0) { console.table(results.map((r) => ({ ID: r.id, Tag: r.tag }))); console.log(`Found ${results.length} components near page break lines.`); }
                else { console.log("All components are safely away from red lines."); }
            },
        });
        editor.Commands.add("wrap-near-lines", {
            run: (ed) => { const count = wrapPageBreaks(ed); console.log(count > 0 ? `Pushed ${count} components below page breaks.` : "Nothing to push."); },
        });
        editor.Commands.add("reset-page-breaks", { run: (ed) => { resetPageBreaks(ed); } });



        // ── AI Regeneration Command ───────────────────────────────
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
                        userRequest: "Make a Professional Security resume for Salim Khan...",
                        imageFile: null, imageUrl: "", imagePreview: null,
                        aiProvider: "gemini", openRouterModel: OPENROUTER_MODELS[0],
                        onSubmit: async (userRequest, imageFile, imageUrl, aiProvider, openRouterModel) => {
                            if (!userRequest.trim()) { alert("Please enter a request"); return; }
                            isProcessing = true;
                            callbacks.setShowModal(false);

                            let placeholderComponent = null;
                            let streamingContainer = null;
                            let accumulatedHTML = "";

                            // Capture position before removal
                            const parent = selected.parent();
                            if (!parent || !parent.components) {
                                console.error("AI Regeneration: Selected component has no parent or parent is invalid.");
                                isProcessing = false;
                                return;
                            }

                            const index = parent.components().indexOf(selected);
                            if (index === -1) {
                                console.error("AI Regeneration: Selected component not found in parent collection.");
                                isProcessing = false;
                                return;
                            }

                            // Remove selected component immediately
                            if (selected && selected.collection) {
                                selected.remove({ undo: false });
                            }

                            try {

                                // Add placeholder
                                const placeholderHTML =
                                    '<div class="p-5 border-2 border-dashed border-green-500 bg-blue-50 text-center rounded-lg">' +
                                    '<p class="m-0 text-green-500 font-bold">🔄 AI is generating...</p></div>';

                                placeholderComponent = parent.append(placeholderHTML, {
                                    at: index, undo: false,
                                });
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
                                                if (placeholderComponent) {
                                                    placeholderComponent.remove({ undo: false });
                                                    placeholderComponent = null;
                                                }
                                                const newContainer = parent.append({
                                                    tagName: "div", content: "",
                                                    attributes: {
                                                        class: "ai-streaming-wrapper",
                                                        style: "min-height: 100px; border: 2px dashed #3b82f6; border-radius: 8px; padding: 10px; position: relative; overflow: hidden;"
                                                    },
                                                }, { at: index, undo: false });
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

                                            if (isFinal && (streamingContainer || placeholderComponent)) {
                                                isFinalized = true;
                                                let finalHTML = "";
                                                let isValid = false;

                                                if (latestHTML && latestHTML.trim().length > 0) {
                                                    // Sync dimensions to prevent layout calculation loops (fixes lag/memory crash)
                                                    const physHeight = PAGE_SIZES[pageSizeRef.current]?.[orientationRef.current]?.height || "297mm";
                                                    const physWidth = PAGE_SIZES[pageSizeRef.current]?.[orientationRef.current]?.width || "210mm";
                                                    finalHTML = cleanAIResponse(latestHTML, physHeight, physWidth);
                                                    isValid = validateAIResponse(finalHTML);
                                                }

                                                // Cleanup placeholder if it still exists
                                                if (placeholderComponent) {
                                                    placeholderComponent.remove({ undo: false });
                                                    placeholderComponent = null;
                                                }

                                                if (isValid && streamingContainer && streamingContainer.collection) {
                                                    // Replace with final content
                                                    const finalComponent = streamingContainer.replaceWith(finalHTML);
                                                    streamingContainer = null;
                                                    const instantiated = Array.isArray(finalComponent) ? finalComponent[0] : finalComponent;
                                                    if (instantiated) ed.select(instantiated);
                                                    ed.Canvas.refresh();

                                                    // Sync global React state
                                                    setTimeout(() => {
                                                        dispatch({ type: "SET_HTML_CONTENT", payload: ed.getHtml() });
                                                    }, 100);
                                                } else {
                                                    console.warn("AI Completion: No valid replacement generated.");
                                                }
                                            }
                                        } catch (err) {
                                            console.error("AI Update Error:", err);
                                        }
                                    });
                                };

                                const streamFn = aiProvider === "openrouter" ? streamOpenRouterAI : streamGeminiAI;
                                const size = PAGE_SIZES[pageSizeRef.current]?.[orientationRef.current];
                                const physWidth = size?.width || "210mm";
                                const physHeight = size?.height || "297mm";

                                await streamFn(originalHTML, userRequest, imageFile, imageUrl, openRouterModel, physHeight, physWidth,
                                    (chunk, isComplete) => {
                                        accumulatedHTML += chunk;
                                        if (isComplete || (accumulatedHTML && accumulatedHTML !== latestHTML)) {
                                            latestHTML = accumulatedHTML;
                                            scheduleUpdate(isComplete);
                                        }
                                    }
                                );

                                setTimeout(() => { wrapPageBreaks(ed); }, 800);
                                resolve();
                            } catch (error) {
                                console.error("AI Regenerate Command Error:", error);
                                if (selected && selected.getEl()) selected.getEl().style.display = "";
                                if (placeholderComponent) placeholderComponent.remove();
                                if (streamingContainer) streamingContainer.remove();
                            } finally {
                                isProcessing = false;
                            }
                        },
                        onCancel: () => { callbacks.setShowModal(false); resolve(); },
                    });
                    callbacks.setShowModal(true);
                });
            },
        });

    }, [editor, state, pageSizeRef, orientationRef, setExported, modalCallbacksRef]);
}
