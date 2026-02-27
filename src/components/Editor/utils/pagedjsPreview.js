/**
 * Paged.js Preview Utility
 * This utility takes the GrapesJS content and renders it in a new window
 * using the Paged.js polyfill for professional A4 pagination.
 */

export const openPagedJsPreview = (editor) => {
    if (!editor) return;

    // 1. Get the content
    const html = editor.getHtml();
    const css = editor.getCss();

    // 2. Wrap the HTML in the necessary structure if needed
    // We assume the user has a #visual-page-id container or similar.

    const previewHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Paged.js Book Preview</title>
    
    <!-- Paged.js Polyfill -->
    <script src="https://unpkg.com/pagedjs/dist/paged.polyfill.js"></script>

    <!-- Font Awesome (for icons used in the book) -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    
    <style>
        /* Base styles to fix Paged.js preview layout in the browser */
        body {
            background-color: #f0f0f0;
            margin: 0;
            padding: 0;
        }

        /* The actual book content styles from GrapesJS */
        ${css}

        /* Paged.js Preview UI Adjustments */
        .pagedjs_pages {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 20px 0;
        }

        .pagedjs_page {
            background: white;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }

        /* Ensure images and tables don't break layout */
        img, table {
            max-width: 100%;
            height: auto;
        }

        /* Printing instructions for the user */
        @media screen {
            #print-button {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 10px 20px;
                background: #e94560;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                z-index: 9999;
                font-family: sans-serif;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            }
            #print-button:hover {
                background: #1a1a2e;
            }
        }
        @media print {
            #print-button { display: none; }
        }
    </style>
</head>
<body>
    <button id="print-button" onclick="window.print()">Print to PDF</button>
    
    <div id="content">
        ${html}
    </div>

    <script>
        // Optional: Custom Paged.js hooks can be added here
        class MyHandler extends Paged.Handler {
            constructor(chunker, polisher, caller) {
                super(chunker, polisher, caller);
            }

            afterRendered(pages) {
                console.log("Pagination complete:", pages.length, "pages generated.");
            }
        }
        Paged.registerHandlers(MyHandler);
    </script>
</body>
</html>
    `;

    // 3. Open in a new window
    const win = window.open('', '_blank');
    win.document.write(previewHtml);
    win.document.close();
};
