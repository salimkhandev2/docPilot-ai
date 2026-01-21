import { NextRequest, NextResponse } from 'next/server';
import { browserPool } from '../../../lib/browserPool';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
    try {
        const { html, css, pageConfig, scripts = [], styles = [] } = await request.json();

        if (!html || !css || !pageConfig) {
            return NextResponse.json(
                { error: 'Missing required fields: html, css, or pageConfig' },
                { status: 400 }
            );
        }

        // Acquire browser from pool (reuses existing browser)
        const browser = await browserPool.acquireBrowser();

        try {
            // Create isolated context for this request
            const context = await browser.newContext({
                viewport: {
                    width: 1920,
                    height: 1080,
                },
            });

            const page = await context.newPage();

            // High timeout for large documents
            page.setDefaultTimeout(120000);

            // Construct full HTML document with dynamic assets
            const fullHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    ${styles.map((href: string) => `<link rel="stylesheet" href="${href}">`).join('\n')}
    ${scripts.map((src: string) => `<script src="${src}"></script>`).join('\n')}
    <style>
        ${css}
    </style>
</head>
<body>
    ${html}
</body>
</html>
        `;

            // Save the HTML for debugging/reference
            try {
                const exportPath = path.join(process.cwd(), 'src/app/api/playwright/latest_export.html');
                fs.writeFileSync(exportPath, fullHTML);
                console.log('✅ HTML exported to:', exportPath);
            } catch (err) {
                console.error('❌ Failed to save HTML export:', err);
            }

            // Set content
            await page.setContent(fullHTML, {
                waitUntil: 'networkidle',
                timeout: 120000
            });

            // Wait for fonts to fully load
            await page.evaluate(() => document.fonts.ready);

            const backgrounds = await page.evaluate(() => {
                function getSelector(el: Element): string {
                    if (el.id) return `#${el.id}`;
                    if (el.className && typeof el.className === 'string') {
                        return (
                            el.tagName.toLowerCase() +
                            '.' +
                            el.className.trim().split(/\s+/).join('.')
                        );
                    }
                    return el.tagName.toLowerCase();
                }

                const results: any[] = [];
                const elements = Array.from(document.querySelectorAll('*'));

                for (const el of elements) {
                    // 🚫 Skip body & html
                    if (el.tagName === 'BODY' || el.tagName === 'HTML') continue;

                    const style = window.getComputedStyle(el);

                    const bgColor = style.backgroundColor;
                    const bgImage = style.backgroundImage;

                    const hasColor =
                        bgColor &&
                        bgColor !== 'rgba(0, 0, 0, 0)' &&
                        bgColor !== 'transparent';

                    const hasImage =
                        bgImage && bgImage !== 'none';

                    if (hasColor || hasImage) {
                        results.push({
                            selector: getSelector(el),
                            backgroundColor: hasColor ? bgColor : null,
                            backgroundImage: hasImage ? bgImage : null,
                        });
                    }
                }

                return results;
            });

            console.log('🎨 Backgrounds (excluding body & html)');
            // backgrounds = array of background objects
            const pdfbg = backgrounds.find((bg: any) => {
                return !/visual-page-id/.test(bg.selector);
            });

            console.log('PDF Background Color:', pdfbg?.backgroundColor || 'Not found');

            // Inject CSS to set page size and overrides
            await page.evaluate((bg: any) => {
                const style = document.createElement('style');
                style.id = 'playwright-pdf-override';
                style.textContent = `
                    /* 1. Global Level Resets - Kill Browser Margins */
                    html, body {
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 210mm !important;
                        height: 100% !important;
                        -webkit-print-color-adjust: exact;
                        font-smoothing: antialiased;
                        text-rendering: geometricPrecision;
                    }

                    /* 2. Kill Smart Pagination Logic - "Dumb" Mode */
                    /* Force the engine to allow breaks anywhere, even slicing text lines */
                    * {
                        widows: 1 !important;
                        orphans: 1 !important;
                        break-inside: auto !important;
                        page-break-inside: auto !important;
                        break-before: auto !important;
                        break-after: auto !important;
                    }

                    /* 3. Define PDF page settings */
                    @page {
                        size: A4;
                        margin: 0 !important;
  /*
  ${bg?.backgroundColor
                        ? `background-color: ${bg.backgroundColor} !important;`
                        : ''}
  */
                        background-color: #ffffff !important;
                    }

                    .visual-page {
                        margin: 0 !important; 
                        padding: 0mm !important;
                        border: none !important;
                        box-shadow: none !important;
                        max-width: none !important;
                        box-sizing: border-box !important;
                        position: relative !important;
                        background-color: transparent !important;
                        width: 210mm !important;
                    }
                    .content {
                        width: 210mm !important;
                        max-width: 210mm !important;
                        min-width: 210mm !important;
                        padding: 0px !important;
                        margin: 0 !important;
                    }
                    .page-break-indicator {
                        display: block !important;
                    }
                `;
                document.head.appendChild(style);
            }, pdfbg);

            // Wait for layout stabilization
            await new Promise(resolve => setTimeout(resolve, 2000));

            const pdfBuffer = await page.pdf({
                preferCSSPageSize: true,
                printBackground: true,
                scale: 1,
            });

            // Close context (reuses browser in pool)
            await context.close();

            // Return PDF as downloadable file
            return new NextResponse(Buffer.from(pdfBuffer), {
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': 'attachment; filename="document.pdf"',
                },
            });
        } finally {
            // Always release browser back to pool
            browserPool.releaseBrowser(browser);
        }
    } catch (error) {
        console.error('PDF generation error:', error);
        return NextResponse.json(
            { error: 'Failed to generate PDF', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}