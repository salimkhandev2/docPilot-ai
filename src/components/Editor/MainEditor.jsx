// ============================================================
// MainEditor.jsx
// Lean orchestrator – all logic lives in dedicated slices.
// ============================================================
"use client";
import { useEffect, useRef, useState } from "react";
import "grapesjs/dist/css/grapes.min.css";

import { useAIState } from "../../contexts/AIStateContext";
import { wrapPageBreaks } from "./utils/findNearMarkers";
import { PAGE_SIZES, OPENROUTER_MODELS } from "./utils/editorConstants";

// Hooks
import { useGrapesJsInit } from "./hooks/useGrapesJsInit";
import { usePageBreakMarkers } from "./hooks/usePageBreakMarkers";
import { usePdfExport } from "./hooks/usePdfExport";
import { useGrapesJsCommands } from "./hooks/useGrapesJsCommands";
import { useGrapesJsPanels } from "./hooks/useGrapesJsPanels";

// UI Components
import PreviewRenderer from "./PreviewRenderer";
import EditorToolbar from "./components/EditorToolbar";
import CustomPageSizeModal from "./components/CustomPageSizeModal";
import AiRegenerateModal from "./components/AiRegenerateModal";
import LayoutIssueBadge from "./components/LayoutIssueBadge";

export default function MainEditor() {
    // ── Refs ─────────────────────────────────────────────────────
    const containerRef = useRef(null);
    const editorRef = useRef(null);
    const blobURLsRef = useRef(new Set());
    const pdfPageHeightRef = useRef(1123);
    const pageSizeRef = useRef("A4");
    const orientationRef = useRef("portrait");
    const modalCallbacksRef = useRef({ setShowModal: () => { }, setModalData: () => { } });

    // ── Context ───────────────────────────────────────────────────
    const { state, dispatch } = useAIState();

    // ── Editor state ──────────────────────────────────────────────
    const [editor, setEditor] = useState(null);
    const [exported, setExported] = useState(null);

    // ── Page / PDF state ─────────────────────────────────────────
    const [pageSize, setPageSize] = useState("A4");
    const [orientation, setOrientation] = useState("portrait");
    const [pageCount, setPageCount] = useState(1);
    const [pdfPageHeight, setPdfPageHeight] = useState(1122.5);
    const [layoutIssues, setLayoutIssues] = useState(0);

    // ── Custom-size modal state ───────────────────────────────────
    const [showPDFCustomModal, setShowPDFCustomModal] = useState(false);
    const [customWidth, setCustomWidth] = useState("210");
    const [customHeight, setCustomHeight] = useState("297");
    const [customUnit, setCustomUnit] = useState("mm");

    // ── AI Regenerate modal state ─────────────────────────────────
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

    // ── Keep stale-closure refs in sync ──────────────────────────
    useEffect(() => {
        pageSizeRef.current = pageSize;
        orientationRef.current = orientation;
        pdfPageHeightRef.current = pdfPageHeight;
        modalCallbacksRef.current = { setShowModal, setModalData };
    }, [pageSize, orientation, pdfPageHeight]);

    // ── Apply page size whenever editor or dimensions change ──────
    useEffect(() => {
        if (editor?.applyPageSize) {
            editor.applyPageSize(pageSize, orientation);
        }
    }, [editor, pageSize, orientation]);

    // ── Keep pdfPageHeight ref in sync, trigger markers ──────────
    useEffect(() => {
        pdfPageHeightRef.current = pdfPageHeight;
        if (editor?.updateMarkers) {
            editor.updateMarkers();
        }
    }, [editor, pdfPageHeight]);

    // ── Hooks ─────────────────────────────────────────────────────
    useGrapesJsInit({
        containerRef, editorRef, blobURLsRef,
        state, dispatch,
        exported, setExported,
        setEditor,
        pageSizeRef, orientationRef,
        pdfPageHeightRef, setPdfPageHeight,
        setPageCount,
        modalCallbacksRef,
    });

    usePageBreakMarkers(editor, pdfPageHeightRef, setPageCount, setLayoutIssues);

    useGrapesJsCommands({
        editor,
        state,
        dispatch,
        pageSizeRef,
        orientationRef,
        setExported,
        modalCallbacksRef,
    });

    useGrapesJsPanels({ editor });

    const { handleExportPDF, isGeneratingPDF } = usePdfExport(editor, pdfPageHeightRef, pageSize, orientation);

    // ── Interaction handlers ──────────────────────────────────────
    // Matches original: receives event object from <select onChange>
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

    // Matches original applyCustomSize exactly
    const handleApplyCustomSize = () => {
        const unit = customUnit;
        PAGE_SIZES.CUSTOM = {
            portrait: {
                width: `${customWidth}${unit}`,
                height: `${customHeight}${unit}`,
            },
            landscape: {
                width: `${customHeight}${unit}`,
                height: `${customWidth}${unit}`,
            },
        };
        setPageSize('CUSTOM');
        // Force update if setPageSize was already 'CUSTOM' but values changed
        if (editor && editor.applyPageSize) {
            editor.applyPageSize('CUSTOM', orientation);
        }
        setShowPDFCustomModal(false);
    };

    // ── Preview mode ──────────────────────────────────────────────
    if (exported) {
        return (
            <PreviewRenderer
                html={exported.html}
                css={exported.css}
                onBack={() => setExported(null)}
            />
        );
    }

    // ── Main render ───────────────────────────────────────────────
    return (
        <>
            <div className="relative w-full h-[100vh]">
                <EditorToolbar
                    pageSize={pageSize}
                    orientation={orientation}
                    pdfPageHeight={pdfPageHeight}
                    pageCount={pageCount}
                    handleSizeChange={handleSizeChange}
                    handleOrientationToggle={handleOrientationToggle}
                    handleExportPDF={handleExportPDF}
                    isGeneratingPDF={isGeneratingPDF}
                />

                {/* Hide GrapesJS device switcher to prevent flickering */}
                <style>{`.gjs-pn-devices-c { display: none !important; }`}</style>

                <div id="gjs-editor" ref={containerRef} className="w-full h-full" />
            </div>

            {showPDFCustomModal && (
                <CustomPageSizeModal
                    customWidth={customWidth} setCustomWidth={setCustomWidth}
                    customHeight={customHeight} setCustomHeight={setCustomHeight}
                    customUnit={customUnit} setCustomUnit={setCustomUnit}
                    onCancel={() => setShowPDFCustomModal(false)}
                    onApply={handleApplyCustomSize}
                />
            )}

            {showModal && (
                <AiRegenerateModal modalData={modalData} setModalData={setModalData} />
            )}

            <LayoutIssueBadge
                layoutIssues={layoutIssues}
                onFixAll={() => editor && wrapPageBreaks(editor)}
            />
        </>
    );
}
