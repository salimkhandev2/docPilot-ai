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
                    width: Math.ceil(pageConfig.pixelWidth || 1122),
                    height: Math.ceil(pageConfig.pixelHeight || 1587),
                },
                deviceScaleFactor: 1,
            });

            const page = await context.newPage();

            // High timeout for large documents
            page.setDefaultTimeout(120000);

            // Construct full HTML document with dynamic assets
            const fullHTML = `
<!DOCTYPE html>
<html lang="en" style="margin: 0; padding: 0;">
<head>
    <meta charset="UTF-8">
    ${styles.map((href: string) => `<link rel="stylesheet" href="${href}">`).join('\n')}
    ${scripts.map((src: string) => `<script src="${src}"></script>`).join('\n')}
    <style>
        ${css}
        html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: ${pageConfig.pixelWidth}px !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
    </style>
</head>
<body style="margin: 0; padding: 0;">
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
            await page.evaluate(({ bg, width, height, pixelWidth, pixelHeight }) => {
                const style = document.createElement('style');
                style.id = 'playwright-pdf-override';
                style.textContent = `
                    /* 1. Global Level Resets - Kill Browser Margins */
                    html, body {
                        margin: 0 !important;
                        padding: 0 !important;
                        width: ${pixelWidth}px !important;
                        overflow: visible !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    @page {
                        size: ${pixelWidth}px ${pixelHeight}px;
                        margin: 0 !important;
                    }
                    
                    /* Ensure backgrounds are printed for all elements */
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    /* If there's a specific background color for the page */
                    ${bg?.backgroundColor ? `body { background-color: ${bg.backgroundColor} !important; }` : ''}
                `;
                document.head.appendChild(style);
            }, { bg: pdfbg, width: pageConfig.width, height: pageConfig.height, pixelWidth: pageConfig.pixelWidth, pixelHeight: pageConfig.pixelHeight });

            // but usually we just wait for its styles to be injected.
            // We can check if any styles were added to the head by tailwind.

            // Wait for layout stabilization and potential Tailwind processing
            await new Promise(resolve => setTimeout(resolve, 3000));


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