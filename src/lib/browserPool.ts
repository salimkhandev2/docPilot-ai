import { chromium, Browser } from 'playwright';

class BrowserPool {
    private browser: Browser | null = null;
    private isLaunching = false;

    async acquireBrowser(): Promise<Browser> {
        if (this.browser && this.browser.isConnected()) {
            return this.browser;
        }

        if (this.isLaunching) {
            // Wait for existing launch to complete
            while (this.isLaunching) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            if (this.browser && this.browser.isConnected()) {
                return this.browser;
            }
        }

        this.isLaunching = true;
        try {
            console.log('Launching new Playwright browser instance...');
            this.browser = await chromium.launch({
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
                headless: true,
            });
            return this.browser;
        } catch (error) {
            console.error('Failed to launch browser:', error);
            throw error;
        } finally {
            this.isLaunching = false;
        }
    }

    async releaseBrowser(browser: Browser) {
        // In this simple pool, we keep the browser open for reuse.
        // We could add logic to close it after a certain idle time if needed.
        // For now, we just ensure it's still connected.
        if (!browser.isConnected()) {
            this.browser = null;
        }
    }

    async closeAll() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}

export const browserPool = new BrowserPool();
