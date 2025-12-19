const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/generate-pdf', async (req, res) => {
    console.log('Generating PDF...');
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        // Increased timeout for large documents
        page.setDefaultTimeout(120000);
        page.setDefaultNavigationTimeout(120000);

        await page.setViewport({
            width: 1920,
            height: 1080,
            deviceScaleFactor: 2  // Standard 1:1 pixel ratio (96 DPI)
        });

        await page.goto(`http://localhost:${PORT}/index.html`, {
            waitUntil: 'networkidle0',
            timeout: 120000
        });

        // Wait for fonts to fully load before measuring
        await page.evaluate(() => document.fonts.ready);

        // CRITICAL FIX #3: Normalize the layout to match indicator calculations
        await page.evaluate(() => {
            // Hide download button
            const button = document.getElementById('download-pdf');
            if (button) button.style.display = 'none';
            // also remve the other as well
            const calibrationInfo = document.getElementById('calibration-info');
            if (calibrationInfo) calibrationInfo.style.display = 'none';
            const controls = document.querySelector('.controls');
            if (controls) controls.style.display = 'none';

            // Remove body padding for PDF generation
            document.body.style.padding = '0';
            document.body.style.margin = '0';

            // Remove or override conflicting @page CSS rules
            const existingStyles = document.querySelectorAll('style');
            existingStyles.forEach(style => {
                if (style.textContent.includes('@page')) {
                    // Remove conflicting @page rules from existing styles
                    style.textContent = style.textContent.replace(
                        /@page\s*\{[^}]*\}/g,
                        ''
                    );
                }
            });

            // Inject CSS to set page size: full A4 width (210mm) × half A4 height (148.5mm)
            // This must come after existing styles to override them
            const style = document.createElement('style');
            style.id = 'puppeteer-pdf-override';
            style.textContent = `
                @page {
                    size: 210mm 297.5mm !important; /* Full A4 width (210mm) × Half A4 height (148.5mm) */
                   
                }
                /* Ensure content width matches full A4 width */
                /* CRITICAL: Keep padding consistent with browser rendering */
                .content {
                    width: 210mm !important;
                    max-width: 210mm !important;
                    min-width: 210mm !important;
                    padding: 0px !important;
                    /* CRITICAL: Clone padding on each page to prevent it from being "eaten" */

                }
            `;
            document.head.appendChild(style);
        });

        // Wait for fonts again after DOM modifications
        await page.evaluate(() => document.fonts.ready);

        // Wait for layout stabilization after CSS injection
        await new Promise(resolve => setTimeout(resolve, 2000));


        const pdfBuffer = await page.pdf({
            width: '210mm',   // Full A4 width (unchanged)
            height: '297.5mm', // Half of A4 height only (297mm / 2 = 148.5mm)
            printBackground: true,
            margin: { top: '0px', bottom: '40px', left: '0px', right: '0px' },
            preferCSSPageSize: true, // Use CSS @page size definition
            scale: 1,
        });


        await browser.close();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=output.pdf');
        res.send(pdfBuffer);
        console.log('PDF generated successfully!');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error generating PDF');
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is LIVE!`);
    console.log(`- Local:  http://localhost:${PORT}`);
    console.log(`- Mobile: http://192.168.18.62:${PORT}`);
});