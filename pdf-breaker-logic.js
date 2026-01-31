import express from 'express';
import { chromium } from 'playwright';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'pdf-breaker-logic.html'));
});

app.get('/generate-pdf', async (req, res) => {
    console.log('Starting PDF generation...');
    let browser;

    try {
        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const context = await browser.newContext({
            viewport: { width: 794, height: 1123 }, // A4 at 96 DPI
            deviceScaleFactor: 1
        });

        const page = await context.newPage();
        page.setDefaultTimeout(120000);

        await page.goto(`http://127.0.0.1:${PORT}/`, {
            waitUntil: 'networkidle',
            timeout: 120000
        });

        await page.evaluate(() => document.fonts.ready);

        await page.evaluate(() => {
            // Hide UI elements
            ['download-pdf', 'calibration-info'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
            const controls = document.querySelector('.controls');
            if (controls) controls.style.display = 'none';

            // Clean up existing page styles to prevent conflicts
            document.querySelectorAll('style').forEach(style => {
                if (style.textContent.includes('@page')) {
                    style.textContent = style.textContent.replace(/@page\s*\{[^}]*\}/gs, '');
                }
            });

            // Inject strict PDF layout styles
            const style = document.createElement('style');
            style.textContent = `
                /* 1. Global Reset - Match main builder approach */
                * {
                    box-sizing: border-box !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                    background-color: red !important;
                }

                html, body {
                    margin: 0 !important;
                    padding: 0 !important;
                    width: 210mm !important;
                    overflow: visible !important;
                }

                /* 2. Page Configuration */
                @page {
                    size: A4;
                    margin: 0 !important;
                }

                /* 3. Content Container Restraints */
                .content {
                    width: 210mm !important;
                    max-width: 210mm !important;
                    min-width: 210mm !important;
                    margin: 0 auto !important;
                    padding: 0 !important;
                    box-shadow: none !important;
                    background: white !important;
                    position: relative !important;
                    display: flow-root !important;
                }

                /* 4. Cross-browser printing consistency */
                body {
                     -webkit-font-smoothing: antialiased;
                    -moz-osx-font-smoothing: grayscale;
                }
                 
                /* 5. Hide visual debug indicators */
                .page-break-line {
                    display: none !important;
                }
            `;
            document.head.appendChild(style);
        });

        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(2000);

        const pdfBuffer = await page.pdf({
            preferCSSPageSize: true,
            printBackground: true,
            scale: 1
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=output.pdf');
        res.send(pdfBuffer);
        console.log('PDF generated successfully!');

    } catch (err) {
        console.error('PDF Generation Error:', err);
        res.status(500).send('Error generating PDF: ' + err.message);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.error('Port in use, retrying...');
        setTimeout(() => {
            server.close();
            server.listen(PORT, '0.0.0.0');
        }, 1000);
    }
});