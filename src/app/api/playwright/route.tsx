import { NextRequest, NextResponse } from 'next/server';
import { browserPool } from '../../../lib/browserPool';
import { PDFService, PDFExportData } from '../../../lib/pdf-service';

export async function POST(request: NextRequest) {
    try {
        const data: PDFExportData = await request.json();

        // 1. Get a browser from the pool (reuses existing browser)
        const browser = await browserPool.acquireBrowser();

        // 2. Create isolated context for this request
        const context = await browser.newContext({
            viewport: {
                width: Math.round(data.pageConfig.pixelWidth || 1122),
                height: Math.round(data.pageConfig.pixelHeight || 1587)
            },
            deviceScaleFactor: 1,
        });

        try {
            // 3. Delegate all complex PDF generation to the Service
            const finalPdfBytes = await PDFService.generate(context, data);

            // 4. Close context
            await context.close();

            // 5. Return PDF as downloadable file
            return new NextResponse(Buffer.from(finalPdfBytes), {
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': 'attachment; filename="document.pdf"',
                },
            });

        } finally {
            // ALWAYS release the browser back to the pool
            browserPool.releaseBrowser(browser);
        }

    } catch (error: any) {
        console.error('❌ PDF generation error:', error);
        return NextResponse.json(
            { error: 'Failed to generate PDF', details: error.message },
            { status: 500 }
        );
    }
}