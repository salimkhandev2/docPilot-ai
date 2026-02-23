import { BrowserContext } from 'playwright';
import { PDFDocument } from 'pdf-lib';

export interface PDFPageConfig {
    width: string;
    height: string;
    pixelWidth: number;
    pixelHeight: number;
}

export interface PDFExportData {
    html: string;
    numPages: number;
    css: string;
    pageConfig: PDFPageConfig;
    scripts?: string[];
    inlineScripts?: string[];
    styles?: string[];
}

export class PDFService {
    private static readonly BATCH_SIZE = 10;
    private static readonly CONCURRENCY = 1; // Back to 1 for maximum DDR3 RAM safety

    /**
     * Generates a merged PDF using parallel chunked rendering.
     */
    static async generate(context: BrowserContext, data: PDFExportData): Promise<Uint8Array> {
        const { html, numPages, css, pageConfig, scripts = [], inlineScripts = [], styles = [] } = data;

        const pageHeight = Math.round(pageConfig.pixelHeight || 1123);
        const pixelWidth = Math.round(pageConfig.pixelWidth || 1122);
        const pixelHeight = Math.round(pageConfig.pixelHeight || 1587);

        console.log(`🚀 [PDFService] Measuring actual content height in headless browser...`);

        // 1. Measure the actual height in the backend to be safe against frontend race conditions
        const measurementPage = await context.newPage();
        try {
            const measureHTML = `
                <!DOCTYPE html>
                <html lang="en" style="margin: 0; padding: 0;">
                <head>
                    <meta charset="UTF-8">
                    ${styles.map((href: string) => `<link rel="stylesheet" href="${href}">`).join('\n')}
                    ${inlineScripts.map((js: string) => `<script>${js}</script>`).join('\n')}
                    ${scripts.map((src: string) => `<script src="${src}"></script>`).join('\n')}
                    <style>
                        ${css}
                        html, body {
                            margin: 0 !important;
                            padding: 0 !important;
                            width: ${pixelWidth}px !important;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                    </style>
                </head>
                <body style="margin: 0; padding: 0;">
                    <div id="measure-container" style="width: 100%;">${html}</div>
                </body>
                </html>
            `;
            await measurementPage.setContent(measureHTML, { waitUntil: 'networkidle', timeout: 30000 });

            // Wait for fonts and for the Tailwind Play CDN to finish scanning/injecting
            await measurementPage.evaluate(() => document.fonts.ready);
            await new Promise(r => setTimeout(r, 1500));

            const actualHeight = await measurementPage.evaluate(() => {
                const container = document.getElementById('measure-container');
                return container ? container.scrollHeight : 0;
            });

            // Recalculate totalPages based on actual height
            // We use a small 2px buffer just like the frontend
            const totalPages = Math.max(1, Math.ceil((actualHeight - 2) / pageHeight));
            console.log(`📊 [PDFService] Frontend said ${numPages} pages, Backend measured ${totalPages} pages. Using ${totalPages}.`);

            const totalBatches = Math.ceil(totalPages / this.BATCH_SIZE);
            const mergedPdf = await PDFDocument.create();

            console.log(`🚀 [PDFService] Starting parallel generation: ${totalPages} pages, ${totalBatches} batches.`);

            // Process batches in chunks of concurrency
            for (let i = 0; i < totalBatches; i += this.CONCURRENCY) {
                const batchPromises = [];

                for (let j = 0; j < this.CONCURRENCY && (i + j) < totalBatches; j++) {
                    const batchIndex = i + j;
                    batchPromises.push(this.renderBatch(context, {
                        batchIndex,
                        html,
                        css,
                        scripts,
                        inlineScripts,
                        styles,
                        pageConfig,
                        pageHeight,
                        pixelWidth,
                        pixelHeight,
                        totalPages
                    }));
                }

                const chunkBuffers = await Promise.all(batchPromises);

                // Merge the generated chunks into the master PDF
                for (const chunkBuffer of chunkBuffers) {
                    const chunkPdfDoc = await PDFDocument.load(chunkBuffer);
                    const copiedPages = await mergedPdf.copyPages(chunkPdfDoc, chunkPdfDoc.getPageIndices());
                    copiedPages.forEach((p) => mergedPdf.addPage(p));
                    console.log(`✅ [PDFService] Batch merged into master.`);
                }
            }

            return await mergedPdf.save();
        } finally {
            await measurementPage.close();
        }
    }

    /**
     * Renders a single batch of pages in its own browser tab.
     */
    private static async renderBatch(context: BrowserContext, params: any): Promise<Buffer> {
        const { batchIndex, html, css, scripts, inlineScripts = [], styles, pageConfig, pageHeight, pixelWidth, pixelHeight, totalPages } = params;
        const startPage = batchIndex * this.BATCH_SIZE;
        const endPage = Math.min(startPage + this.BATCH_SIZE, totalPages);

        console.log(`📦 [PDFService] Rendering Batch ${batchIndex + 1} (Pages ${startPage + 1} to ${endPage})...`);

        const page = await context.newPage();
        page.setDefaultTimeout(60000);

        // Build the full batch HTML string in memory to avoid race conditions with Tailwind scanning
        let viewportsHTML = '';
        for (let i = startPage; i < endPage; i++) {
            viewportsHTML += `
                <div class="pdf-viewport" style="
                    height: ${pageHeight}px; 
                    overflow: hidden; 
                    position: relative; 
                    page-break-after: always;
                    width: 100%;
                    background: white;
                    contain: paint;
                ">
                    <div class="pdf-shifter" style="
                        position: relative; 
                        transform: translateY(-${i * pageHeight}px); 
                        width: 100%;
                        transform-origin: top left;
                    ">
                        ${html}
                    </div>
                </div>
            `;
        }

        const fullHTML = `
<!DOCTYPE html>
<html lang="en" style="margin: 0; padding: 0;">
<head>
    <meta charset="UTF-8">
    ${styles.map((href: string) => `<link rel="stylesheet" href="${href}">`).join('\n')}
    ${inlineScripts.map((js: string) => `<script>${js}</script>`).join('\n')}
    ${scripts.map((src: string) => `<script src="${src}"></script>`).join('\n')}
    <style>
        ${css}
        html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: ${pixelWidth}px !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
    </style>
</head>
<body style="margin: 0; padding: 0;">
    <div id="pdf-pages-container">
        ${viewportsHTML}
    </div>
</body>
</html>
        `;

        await page.setContent(fullHTML, { waitUntil: 'networkidle', timeout: 60000 });

        // Inject Print Overrides
        await page.evaluate(({ pixelWidth, pixelHeight }) => {
            const style = document.createElement('style');
            style.textContent = `
                @page { size: ${pixelWidth}px ${pixelHeight}px; margin: 0 !important; }
                html, body { margin: 0 !important; padding: 0 !important; }
                * { -webkit-print-color-adjust: exact !important; }
            `;
            document.head.appendChild(style);
        }, { pixelWidth, pixelHeight });

        // Stabilize: Wait for fonts and for the Tailwind Play CDN to finish scanning/injecting
        await page.evaluate(() => document.fonts.ready);
        await new Promise(resolve => setTimeout(resolve, 2000));

        const pdfBuffer = await page.pdf({
            preferCSSPageSize: true,
            printBackground: true,
            scale: 1,
        });

        await page.close();
        console.log(`✅ [PDFService] Batch ${batchIndex + 1} complete. Memory cleared.`);
        return Buffer.from(pdfBuffer);
    }
}
