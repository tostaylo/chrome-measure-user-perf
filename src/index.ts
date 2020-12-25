'use strict';
const puppeteer = require('puppeteer');
const fs = require('fs');

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

		processFiles();

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

function processFiles() {
	console.log('Reading Traces Directory');
	fs.readdirSync('../traces/').forEach((file: string) => {
		const path = `../traces/${file}`;
		const fileName = file.split('.')[1];
		console.log(fileName);

		try {
			const data = fs.readFileSync(path, 'utf8');
			const json = JSON.parse(data);

			let finalCompositeStartTime = 0;
			let finalCompositeDur = 0;
			let clickStartTime = 0;
			let clickDur = 0;

			json?.traceEvents?.forEach((entry: TraceEntry) => {
				if (entry.args?.data?.type === RenderEvent.Click) {
					clickStartTime = entry.ts;
					clickDur = entry.dur;
				}

				if (isCompositeEvent(entry.name)) {
					if (entry.ts > finalCompositeStartTime) {
						finalCompositeStartTime = entry.ts;
						finalCompositeDur = entry.dur;
					}
				}
			});
			const totalDur = finalCompositeStartTime + finalCompositeDur - clickStartTime;
			console.log(totalDur);
		} catch (err) {
			console.error(err);
		}

		// try {
		// 	fs.unlinkSync(`../traces/${file}`);
		// } catch (err) {
		// 	console.error(err);
		// }
	});
}

interface TraceEntry {
	args: { data: { type: string } };
	name: string;
	ts: number;
	dur: number;
}

enum RenderEvent {
	Click = 'click',
	Layout = 'Layout',
	UpdateLayoutTree = 'UpdateLayoutTree',
	Paint = 'Paint',
	CompositeLayers = 'CompositeLayers',
}

function isCompositeEvent(event: string): boolean {
	if (event === RenderEvent.CompositeLayers) {
		return true;
	}
	return false;
}
