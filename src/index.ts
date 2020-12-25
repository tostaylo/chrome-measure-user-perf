const puppeteer = require('puppeteer');

(async () => {
	try {
		const data_click_vals = await getInteractiveElements();

		for (const valStr of data_click_vals) {
			const { page, browser } = await launchBrowser();
			const dataAttr = `[data-click="${valStr}"]`;
			const selector = await page.waitForSelector(dataAttr);

			if (selector) {
				await page.tracing.start({ path: `../traces/trace.${valStr}.json`, screenshots: false });
				await page.click(dataAttr);
				await page.tracing.stop();
				console.log('Trace Successful');
			}

			await browser.close();
			console.log('closing browser');
		}

		process.exit(0);
	} catch (err) {
		console.error(err);
		process.exit(1);
	}
})();

async function launchBrowser() {
	const browser = await puppeteer.launch({
		headless: true,
		args: ['--incognito', '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--no-zygote'],
	});

	const page = await browser.newPage();
	const navigationPromise = page.waitForNavigation();
	await page.goto('http://localhost:8000');
	await page.setViewport({ width: 1440, height: 714 });
	await page.waitForTimeout(1000);
	await navigationPromise;

	return { browser, page };
}

async function getInteractiveElements(): Promise<string[]> {
	const { page, browser } = await launchBrowser();

	const data_click_vals = await page.evaluate(() => {
		let elements = [...document.querySelectorAll('[data-click]')];

		// Return value must be JSON serializable
		return elements.map((item) => (item as any).dataset.click);
	});

	browser.close();
	return data_click_vals;
}
