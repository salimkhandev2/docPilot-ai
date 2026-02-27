import { useEffect } from "react";

export function useGrapesJsPanels({ editor }) {
    useEffect(() => {
        if (!editor) return;

        // ── Panel buttons ─────────────────────────────────────────
        editor.Panels.addButton("options", [
            { id: "undo", className: "fa fa-undo", command: "undo", attributes: { title: "Undo (Ctrl+Z)" } },
            { id: "redo", className: "fa fa-redo", command: "redo", attributes: { title: "Redo (Ctrl+Y)" } },
            { id: "reload-html-btn", className: "fa fa-refresh", command: "render-full-html", attributes: { title: "Reload HTML with Dependencies" } },
            { id: "preview-pdf-btn", className: "fa fa-file-pdf-o", command: "send-to-preview", attributes: { title: "Preview & Download PDF" } },
            { id: "open-template-gallery-btn", className: "fa fa-clone", command: "open-template-gallery", attributes: { title: "Open Templates Gallery" } },
            { id: "check-markers", className: "fa fa-search", command: "check-near-lines", attributes: { title: "Check Near Page Breaks" } },
            { id: "wrap-markers", className: "fa fa-cube", command: "wrap-near-lines", attributes: { title: "Wrap Risk Elements" } },
            { id: "ai-regenerate", className: "fa fa-magic", command: "ai-regenerate", attributes: { title: "AI Regenerate" } },
        ]);

        // ── UndoManager: Visual State Feedback ────────────────────
        const updateUndoButtons = () => {
            const um = editor.UndoManager;
            const panels = editor.Panels;
            const undoBtn = panels.getButton("options", "undo");
            const redoBtn = panels.getButton("options", "redo");

            if (undoBtn) {
                const hasUndo = um.hasUndo();
                const btnEl = undoBtn.get("el");
                if (btnEl) {
                    btnEl.style.opacity = hasUndo ? "1" : "0.3"; // Slightly higher opacity for visibility
                    btnEl.style.pointerEvents = hasUndo ? "auto" : "none";
                    btnEl.style.filter = hasUndo ? "none" : "grayscale(100%)";
                    btnEl.style.cursor = hasUndo ? "pointer" : "default";
                }
            }
            if (redoBtn) {
                const hasRedo = um.hasRedo();
                const btnEl = redoBtn.get("el");
                if (btnEl) {
                    btnEl.style.opacity = hasRedo ? "1" : "0.3";
                    btnEl.style.pointerEvents = hasRedo ? "auto" : "none";
                    btnEl.style.filter = hasRedo ? "none" : "grayscale(100%)";
                    btnEl.style.cursor = hasRedo ? "pointer" : "default";
                }
            }
        };

        editor.on("undo redo undoManager:update", updateUndoButtons);
        // Also update on any change since undoManager:update can be finicky
        editor.on("component:update style:update block:drag:stop canvas:drop", () => {
            setTimeout(updateUndoButtons, 10);
        });

        // Initial state update with increasing delays to catch GrapesJS initialization
        setTimeout(updateUndoButtons, 500);
        setTimeout(updateUndoButtons, 2000);
        setTimeout(updateUndoButtons, 5000);

    }, [editor]);
}
