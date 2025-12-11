/**
 * Converts a GrapesJS component and its children to HTML with all applicable CSS rules converted to inline styles.
 * 
 * This utility extracts CSS rules from the GrapesJS CssComposer and applies them as inline styles to each element.
 * It supports all CSS selector types including tags, classes, IDs, descendant, child, sibling, and attribute selectors.
 * 
 * @param {Object} editor - The GrapesJS editor instance
 * @param {Object} component - The GrapesJS component to convert
 * @param {Object} [options={}] - Configuration options
 * @param {boolean} [options.debug=false] - Enable debug logging to console
 * @param {boolean} [options.preserveClasses=true] - Keep class attributes in output HTML
 * @param {boolean} [options.preserveIds=true] - Keep ID attributes in output HTML
 * 
 * @returns {string} HTML string with all applicable CSS converted to inline styles
 * 
 * @example
 * // Basic usage
 * const htmlWithInlineStyles = convertComponentToInlineCSS(editor, component);
 * 
 * @example
 * // With debug logging enabled
 * const htmlWithInlineStyles = convertComponentToInlineCSS(editor, component, { debug: true });
 * 
 * @example
 * // Remove class attributes after inlining
 * const htmlWithInlineStyles = convertComponentToInlineCSS(editor, component, { 
 *   preserveClasses: false 
 * });
 */
export function convertComponentToInlineCSS(editor, component, options = {}) {
    const { debug = false, preserveClasses = true, preserveIds = true } = options;

    if (!component) return '';

    const cssComposer = editor.CssComposer;
    const allRules = cssComposer.getAll();

    // Collect all CSS rules
    const cssRules = [];
    if (debug) console.log("\n🔍 --- DEBUG: EXTRACTING CSS RULES ---");

    allRules.forEach(rule => {
        const selectors = rule.selectorsToString?.();
        if (selectors) {
            const style = rule.getStyle();
            if (debug) console.log(`📏 Rule Found: "${selectors}"`, style);
            cssRules.push({ selectors, style });
        }
    });

    if (debug) console.log("----------------------------------------\n");

    // Helper to format styles object to CSS string
    const stylesToString = (styles) => {
        return Object.entries(styles)
            .map(([prop, value]) => `${prop}: ${value}`)
            .join('; ');
    };

    // 1. Generate clean HTML from the component
    const htmlString = component.toHTML();
    if (debug) console.log("📄 Raw HTML from component:", htmlString);

    // 2. Parse into a temporary DOM
    const parser = new DOMParser();
    const tempDoc = parser.parseFromString(htmlString, 'text/html');
    const tempRoot = tempDoc.body.firstElementChild;

    // Helper: Calculate CSS specificity for a selector
    const calculateSpecificity = (selector) => {
        let ids = 0, classes = 0, tags = 0;

        // Count IDs: #id
        ids = (selector.match(/#[\w-]+/g) || []).length;

        // Count classes, attributes, pseudo-classes: .class, [attr], :pseudo
        classes = (selector.match(/\.[\w-]+/g) || []).length;
        classes += (selector.match(/\[[^\]]+\]/g) || []).length;
        classes += (selector.match(/:(?!not|is|where|has)[\w-]+/g) || []).length;

        // Count tag selectors (remove combinators and other non-tag characters first)
        const tagPattern = selector
            .replace(/#[\w-]+/g, '') // Remove IDs
            .replace(/\.[\w-]+/g, '') // Remove classes
            .replace(/\[[^\]]+\]/g, '') // Remove attributes
            .replace(/:[\w-]+(?:\([^)]*\))?/g, '') // Remove pseudo-classes/elements
            .replace(/[>+~]/g, ' '); // Replace combinators with spaces

        tags = (tagPattern.match(/\b[a-z][\w-]*/gi) || []).length;

        // Return numeric specificity: IDs * 100 + classes * 10 + tags
        return (ids * 100) + (classes * 10) + tags;
    };

    // 3. Parallel traversal function
    const processComponent = (comp, tempEl, depth = 0) => {
        if (!comp || !tempEl) return;

        const indent = "  ".repeat(depth);
        const tag = tempEl.tagName.toLowerCase();
        const id = tempEl.id ? `#${tempEl.id}` : '';
        const cls = tempEl.className ? `.${tempEl.className.split(' ').join('.')}` : '';

        if (debug) console.log(`${indent}➡️ Processing: <${tag}${id}${cls}>`);

        // A. Match CSS Rules against the *Real* DOM Element and collect with specificity
        const realEl = comp.getEl();
        const matchedRules = []; // Store rules with their specificity

        if (realEl) {
            cssRules.forEach(({ selectors, style }) => {
                try {
                    const isMatch = realEl.matches(selectors);
                    if (isMatch) {
                        const specificity = calculateSpecificity(selectors);
                        if (debug) console.log(`${indent}   ✅ MATCHED selector: "${selectors}" (specificity: ${specificity})`, style);
                        matchedRules.push({ specificity, style, selectors });
                    } else {
                        if (debug) console.log(`${indent}   ❌ No match: "${selectors}"`);
                    }
                } catch (e) {
                    if (debug) console.warn(`${indent}   ⚠️ Invalid selector: ${selectors}`, e);
                }
            });
        } else {
            if (debug) console.warn(`${indent}   ⚠️ No real DOM element found for component`);
        }

        // Sort by specificity (lowest to highest) so higher specificity overwrites lower
        matchedRules.sort((a, b) => a.specificity - b.specificity);

        // Merge styles in order of specificity
        const matchedStyles = {};
        matchedRules.forEach(({ style, selectors, specificity }) => {
            if (debug) console.log(`${indent}   📝 Applying "${selectors}" (spec: ${specificity})`);
            Object.assign(matchedStyles, style);
        });

        // B. Merge with existing inline styles
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

        // Merge: Rules first, then Inline overrides
        const finalStyles = { ...matchedStyles, ...inlineStyles };

        // C. Apply merged styles to temp element
        if (Object.keys(finalStyles).length > 0) {
            tempEl.setAttribute('style', stylesToString(finalStyles));
        }

        // D. Optionally remove class/id attributes
        if (!preserveClasses && tempEl.hasAttribute('class')) {
            tempEl.removeAttribute('class');
        }
        if (!preserveIds && tempEl.hasAttribute('id')) {
            tempEl.removeAttribute('id');
        }

        // E. Traverse Children
        const childComponents = comp.components().filter(c => {
            const el = c.getEl();
            return el && el.nodeType === 1;
        });

        const tempChildren = Array.from(tempEl.children);

        if (debug && childComponents.length !== tempChildren.length) {
            console.warn(`${indent}   ⚠️ WARNING: Structure mismatch! GrapesJS children: ${childComponents.length}, TempDOM children: ${tempChildren.length}`);
        }

        const maxLen = Math.min(childComponents.length, tempChildren.length);
        for (let i = 0; i < maxLen; i++) {
            processComponent(childComponents[i], tempChildren[i], depth + 1);
        }
    };

    // Start processing
    processComponent(component, tempRoot);

    const finalHTML = tempDoc.body.innerHTML;

    if (debug) {
        console.log("\n📄 HTML WITH INLINE STYLES (Context Aware):");
        console.log(finalHTML);
    }

    return finalHTML;
}
