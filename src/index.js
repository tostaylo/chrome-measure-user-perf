"use strict";
const puppeteer = require('puppeteer');
(async () => {
    try {
        const data_click_vals = await getElements();
        for (const valStr of data_click_vals) {
            const { page, browser } = await launchBrowser();
            await page.tracing.start({ path: `../traces/trace.${valStr}.json`, screenshots: false });
            await page.click(`[data-click="${valStr}"]`);
            await page.waitForTimeout(3000);
            console.log('hi');
            await page.tracing.stop();
            // await browser.close();
        }
        // await page.waitForSelector(selector, { timeout: 2000 });
        // await page.click(selector);
        // await page.tracing.stop();
        process.exit(0);
    }
    catch (err) {
        console.error(err);
        process.exit(1);
    }
})();
async function launchBrowser() {
    const browser = await puppeteer.launch({
        headless: false,
        args: [
            '--incognito',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--no-zygote',
        ],
    });
    const page = await browser.newPage();
    const navigationPromise = page.waitForNavigation();
    await page.goto('http://localhost:8000');
    await page.setViewport({ width: 1440, height: 714 });
    await page.waitForTimeout(1000);
    await navigationPromise;
    return { browser, page };
}
async function getElements() {
    const { page, browser } = await launchBrowser();
    const data_click_vals = await page.evaluate(() => {
        let elements = [...document.querySelectorAll('[data-click]')];
        // Return value must be JSON serializable
        return elements.map((item) => item.dataset.click);
    });
    browser.close();
    return data_click_vals;
}
