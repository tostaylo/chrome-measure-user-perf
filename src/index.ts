'use strict';
import puppeteer from 'puppeteer';
import * as fs from 'fs';
const TRACE_DIR = '../traces/';

(async () => {
	try {
		const data_click_vals = await getInteractiveElements();
		await generateTraces(data_click_vals);
		processFiles();

		process.exit(0);
	} catch (err) {
		console.error(err);
		process.exit(1);
	}
})();

async function generateTraces(data_click_vals: string[]) {
	for (const valStr of data_click_vals) {
		const { page, browser } = await launchBrowser();
		const dataAttr = `[data-click="${valStr}"]`;
		const selector = await page.waitForSelector(dataAttr);

		if (selector) {
			console.log(dataAttr);
			await page.tracing.start({ path: `${TRACE_DIR}trace.${valStr}.json`, screenshots: false });
			await page.click(dataAttr);
			await page.tracing.stop();
			console.log('Trace Successful');
		}

		await browser.close();
		console.log('closing browser');
	}
}

async function launchBrowser() {
	const browser = await puppeteer.launch({
		headless: true,
		args: ['--incognito', '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--no-zygote'],
	});

	const page = await browser.newPage();
	const navigationPromise = page.waitForNavigation();
	await page.goto('http://localhost:8000');
	await page.setViewport({ width: 1440, height: 714 });
	await (page as any).waitForTimeout(1000);
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
	fs.readdirSync(TRACE_DIR).forEach((file: string) => {
		const path = `${TRACE_DIR}${file}`;
		const fileName = file.split('.')[1];
		console.log(fileName);

		try {
			const data = fs.readFileSync(path, 'utf8');
			const json: { traceEvents: TraceEntry[] } = JSON.parse(data);
			if (!json?.traceEvents) {
				throw new Error('Unable to parse JSON data');
			}
			const { finalCompositeDur, finalCompositeStartTime, clickDur, clickStartTime } = processJSON(json.traceEvents);

			const totalDur = finalCompositeStartTime + finalCompositeDur - clickStartTime;
			console.log({ totalDur, clickDur });
			removeFiles(file);
		} catch (err) {
			console.error(err);
		}
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

interface CoreTimings {
	ts: number;
	dur: number;
}

function isCompositeEvent(event: string): boolean {
	if (event === RenderEvent.CompositeLayers) {
		return true;
	}
	return false;
}

function isClickEvent(event: string): boolean {
	if (event === RenderEvent.Click) {
		return true;
	}
	return false;
}

function getCoreTimings(entry: TraceEntry, predicate: () => boolean): CoreTimings | undefined {
	if (predicate()) {
		return { ts: entry.ts, dur: entry.dur };
	}
}

function processJSON(traceEvents: TraceEntry[]) {
	let finalCompositeStartTime = 0;
	let finalCompositeDur = 0;
	let clickStartTime = 0;
	let clickDur = 0;

	traceEvents.forEach((entry: TraceEntry) => {
		const clickTimings = getCoreTimings(entry, () => isClickEvent(entry.args?.data?.type));
		if (clickTimings) {
			const { ts, dur } = clickTimings;
			clickStartTime = ts;
			clickDur = dur;
		}

		const compositeTimings = getCoreTimings(entry, () => isCompositeEvent(entry.name));
		if (compositeTimings) {
			const { ts, dur } = compositeTimings;
			if (ts > finalCompositeStartTime) {
				finalCompositeStartTime = ts;
				finalCompositeDur = dur;
			}
		}
	});
	return { finalCompositeDur, finalCompositeStartTime, clickStartTime, clickDur };
}

function removeFiles(file: string) {
	try {
		fs.unlinkSync(`${TRACE_DIR}${file}`);
	} catch (err) {
		console.error(err);
	}
}

// Will need to write tests
