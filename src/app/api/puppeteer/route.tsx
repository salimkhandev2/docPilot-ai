import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';

export async function POST(request: NextRequest) {
    try {
        const { html, css, pageConfig, scripts = [], styles = [] } = await request.json();

        if (!html || !css || !pageConfig) {
            return NextResponse.json(
                { error: 'Missing required fields: html, css, or pageConfig' },
                { status: 400 }
            );
        }

        // Launch Puppeteer with consistent settings
        const browser = await puppeteer.launch({
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();

        // High Resolution Viewport Settings
        await page.setViewport({
            width: 1920,
            height: 1080,
            deviceScaleFactor: 0.5  // Sharper rendering (DIP -> Pixel ratio)
        });


        // Increased timeout for large documents
        page.setDefaultTimeout(120000);
        page.setDefaultNavigationTimeout(120000);

        // Construct full HTML document with dynamic assets
        const fullHTML = `
<!DOCTYPE html>
<html>
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

        // Set content
        await page.setContent(fullHTML, {
            waitUntil: 'networkidle0',
            timeout: 120000
        });

        // Wait for fonts to fully load before measuring
        await page.evaluate(() => document.fonts.ready);

        // Normalize layout to match indicator calculations
        await page.evaluate((config) => {
            // Remove body padding/margin
            const body = document.body as HTMLElement;
            body.style.padding = '0';
            body.style.margin = '0';

            // Remove or override conflicting @page CSS rules
            const existingStyles = document.querySelectorAll('style');
            existingStyles.forEach(style => {
                if (style.textContent && style.textContent.includes('@page')) {
                    style.textContent = style.textContent.replace(
                        /@page\s*\{[^}]*\}/g,
                        ''
                    );
                }
            });

            // Inject CSS to set page size and overrides
            const style = document.createElement('style');
            style.id = 'puppeteer-pdf-override';
            style.textContent = `
                @page {
                    size: 210mm 297.5mm !important; /* Full A4 width (210mm) × Half A4 height (148.5mm) */
                }
                .visual-page {
                    margin: 0 auto !important;
                    padding: 0mm !important;
                    border: none !important;
                    box-shadow: none !important;
                    background: white !important;
                    max-width: none !important;
                    box-sizing: border-box !important;
                    position: relative !important;
                    
                }
                /* Ensure content width matches full A4 width */
                .content {
                    width: 210mm !important;
                    max-width: 210mm !important;
                    min-width: 210mm !important;
                    padding: 0px !important;
                }
                /* Show indicators in final PDF */
                .page-break-indicator {
                    display: block !important;
                }
            `;
            document.head.appendChild(style);
        }, pageConfig);

        // Wait for fonts again after DOM modifications
        await page.evaluate(() => document.fonts.ready);

        // Wait for layout stabilization
        await new Promise(resolve => setTimeout(resolve, 2000));
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '0mm',
                bottom: '0mm',
                left: '0mm',
                right: '0mm',
            },
            scale: 1,
        });

        await browser.close();

        // Return PDF as downloadable file
        return new NextResponse(Buffer.from(pdfBuffer), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'attachment; filename="document.pdf"',
            },
        });
    } catch (error) {
        console.error('PDF generation error:', error);
        return NextResponse.json(
            { error: 'Failed to generate PDF', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}