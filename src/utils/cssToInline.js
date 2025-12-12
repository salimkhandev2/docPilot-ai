/**
 * Converts a GrapesJS component and its children to HTML with CSS converted to inline styles.
 * 
 * SIMPLIFIED version: Uses the component's auto-generated ID to get its CSS rule
 * directly from CssComposer, avoiding complex selector matching.
 * 
 * @param {Object} editor - The GrapesJS editor instance
 * @param {Object} component - The GrapesJS component to convert
 * @param {Object} [options={}] - Configuration options
 * @param {boolean} [options.debug=false] - Enable debug logging to console
 * 
 * @returns {string} HTML string with CSS converted to inline styles
 */
export function convertComponentToInlineCSS(editor, component, options = {}) {
    const { debug = false } = options;

    if (!component) return '';

    const cssComposer = editor.CssComposer;

    // Helper to format styles object to CSS string
    const stylesToString = (styles) => {
        return Object.entries(styles)
            .map(([prop, value]) => `${prop}: ${value}`)
            .join('; ');
    };

    // Process a single component: get its ID-based CSS rule and apply as inline
    const processComponent = (comp, tempEl, depth = 0) => {
        if (!comp || !tempEl) return;

        const indent = "  ".repeat(depth);
        const componentId = comp.getId();

        if (debug) {
            const tag = tempEl.tagName?.toLowerCase() || 'unknown';
            console.log(`${indent}➡️ Processing: <${tag}> (ID: ${componentId || 'none'})`);
        }

        // Get the CSS rule for this component by its ID
        let matchedStyles = {};

        if (componentId) {
            const selector = `#${componentId}`;
            const rule = cssComposer.getRule(selector);

            if (rule) {
                matchedStyles = rule.getStyle() || {};
                if (debug) console.log(`${indent}   ✅ Found CSS rule for ${selector}:`, matchedStyles);
            } else {
                if (debug) console.log(`${indent}   ℹ️ No CSS rule found for ${selector}`);
            }
        }

        // Get existing inline styles
        const existingStyleAttr = tempEl.getAttribute('style') || '';
        const inlineStyles = {};
        if (existingStyleAttr) {
            existingStyleAttr.split(';').forEach(chunk => {
                const [prop, val] = chunk.split(':');
                if (prop && val) {
                    inlineStyles[prop.trim()] = val.trim();
                }
            });
        }

        // Merge: CSS rule first, then existing inline styles override
        const finalStyles = { ...matchedStyles, ...inlineStyles };

        // Apply merged styles to element
        if (Object.keys(finalStyles).length > 0) {
            tempEl.setAttribute('style', stylesToString(finalStyles));
            if (debug) console.log(`${indent}   📝 Applied inline styles:`, finalStyles);
        }

        // Recursively process children
        const childComponents = comp.components().filter(c => {
            const el = c.getEl();
            return el && el.nodeType === 1;
        });

        const tempChildren = Array.from(tempEl.children);
        const maxLen = Math.min(childComponents.length, tempChildren.length);

        for (let i = 0; i < maxLen; i++) {
            processComponent(childComponents[i], tempChildren[i], depth + 1);
        }
    };

    // Generate HTML from component
    const htmlString = component.toHTML();
    if (debug) console.log("📄 Raw HTML from component:", htmlString);

    // Parse into temporary DOM
    const parser = new DOMParser();
    const tempDoc = parser.parseFromString(htmlString, 'text/html');
    const tempRoot = tempDoc.body.firstElementChild;

    // Process the component tree
    processComponent(component, tempRoot);

    const finalHTML = tempDoc.body.innerHTML;

    if (debug) {
        console.log("\n📄 FINAL HTML WITH INLINE STYLES:");
        console.log(finalHTML);
    }

    return finalHTML;
}
