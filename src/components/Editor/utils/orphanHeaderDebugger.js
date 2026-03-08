/**
 * Debugging tool to visualize the distance of components from the nearest page break.
 * It adds a fixed panel to the main screen that updates when hovering over elements.
 */

export const attachOrphanHeaderDebugger = (editor) => {
    if (!editor) return;

    let panelEl = document.getElementById('orphan-header-debug-panel');
    if (!panelEl) {
        panelEl = document.createElement('div');
        panelEl.id = 'orphan-header-debug-panel';
        panelEl.style.position = 'fixed';
        panelEl.style.bottom = '20px';
        panelEl.style.right = '20px';
        panelEl.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
        panelEl.style.color = '#fff';
        panelEl.style.padding = '15px';
        panelEl.style.borderRadius = '8px';
        panelEl.style.fontSize = '14px';
        panelEl.style.zIndex = '999999';
        panelEl.style.pointerEvents = 'none';
        panelEl.style.fontFamily = 'monospace';
        panelEl.style.minWidth = '300px';
        panelEl.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.5)';
        panelEl.innerHTML = '<strong>Debugger Active</strong><br/><span style="color:#aaa;">Click an element in the editor...</span>';
        document.body.appendChild(panelEl);
    }

    // Helper to get the absolute position of the page container
    const getPageRect = () => {
        const wrapper = editor.getWrapper();
        const pageContainer = wrapper.find('.visual-page')[0] || wrapper.find('#visual-page-id')[0];
        return pageContainer ? pageContainer.getEl()?.getBoundingClientRect() : null;
    };

    // Helper to get all red line markers
    const getMarkers = (frameDoc) => {
        return Array.from(frameDoc.querySelectorAll('.page-break-indicator'));
    };

    const updatePanelForComponent = (comp) => {
        const frameDoc = editor.Canvas.getDocument();
        const pageRect = getPageRect();
        const panel = document.getElementById('orphan-header-debug-panel');

        if (!pageRect || !frameDoc || !panel) return;

        if (!comp) {
            panel.innerHTML = '<strong>Debugger Active</strong><br/><span style="color:#aaa;">Click an element in the editor...</span>';
            panel.style.borderLeft = '4px solid #555';
            return;
        }

        const el = comp.getEl();

        if (!el || el.classList.contains('page-break-indicator') || el.id === 'wrapper') {
            panel.innerHTML = '<strong>Debugger Active</strong><br/><span style="color:#aaa;">Click an element in the editor...</span>';
            panel.style.borderLeft = '4px solid #555';
            return;
        }

        const compRect = el.getBoundingClientRect();
        const vBottom = compRect.bottom - pageRect.top; // Bottom of component relative to page top
        const tag = el.tagName ? el.tagName.toLowerCase() : 'unknown';

        const markers = getMarkers(frameDoc);
        if (markers.length === 0) {
            panel.innerHTML = `<strong>Element:</strong> &lt;${tag}&gt;<br/><span style="color:#ef4444;">No page breaks found!</span>`;
            panel.style.borderLeft = '4px solid #ef4444';
            return;
        }

        // Find the next closest marker below this element
        let nearestMarkerY = Infinity;
        for (const marker of markers) {
            const markerRect = marker.getBoundingClientRect();
            const markerY = markerRect.top - pageRect.top;
            if (markerY >= (vBottom - 5)) { // 5px tolerance
                if (markerY < nearestMarkerY) {
                    nearestMarkerY = markerY;
                }
            }
        }

        if (nearestMarkerY === Infinity) {
            panel.innerHTML = `<strong>Element:</strong> &lt;${tag}&gt;<br/><span style="color:#9ca3af;">Below all page breaks.</span>`;
            panel.style.borderLeft = '4px solid #9ca3af';
            return;
        }

        const distance = Math.round(nearestMarkerY - vBottom);

        // Highlight logic based on current thresholds
        let statusHtml = '';
        let borderColor = '';

        if (distance <= 100) {
            statusHtml = `<span style="color:#ef4444; font-weight:bold;">${distance}px (Orphan Danger Zone!)</span>`;
            borderColor = '#ef4444'; // Red
        } else if (distance <= 400) {
            statusHtml = `<span style="color:#f59e0b; font-weight:bold;">${distance}px (Safe, but cohesive)</span>`;
            borderColor = '#f59e0b'; // Orange
        } else {
            statusHtml = `<span style="color:#10b981; font-weight:bold;">${distance}px (Safe)</span>`;
            borderColor = '#10b981'; // Green
        }

        panel.innerHTML = `
            <div style="margin-bottom: 4px;"><strong>Element:</strong> &lt;${tag}&gt;</div>
            <div style="margin-bottom: 4px;"><strong>Bottom Y:</strong> ${Math.round(vBottom)}px</div>
            <div><strong>Dist to Break:</strong> ${statusHtml}</div>
        `;
        panel.style.borderLeft = `4px solid ${borderColor}`;
    };

    // Bind to GrapesJS selection events
    editor.on('component:selected', (comp) => {
        updatePanelForComponent(comp);
    });

    editor.on('component:deselected', () => {
        updatePanelForComponent(null);
    });

    // If something is already selected when attached, show it
    const selected = editor.getSelected();
    if (selected) {
        updatePanelForComponent(selected);
    }

    console.log("Orphan Header Debugger Attached! Click on elements to see distance to nearest bottom page break.");
};

export const detachOrphanHeaderDebugger = (editor) => {
    if (!editor) return;
    const panelEl = document.getElementById('orphan-header-debug-panel');
    if (panelEl && panelEl.parentNode) {
        panelEl.parentNode.removeChild(panelEl);
    }
};
