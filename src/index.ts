'use strict';
import puppeteer from 'puppeteer';
import * as fs from 'fs';
import { TraceEntry, CoreTimings } from './types/index';
const TRACE_DIR = '../traces/';

enum RenderEvent {
	Click = 'click',
	Layout = 'Layout',
	UpdateLayoutTree = 'UpdateLayoutTree',
	Paint = 'Paint',
	CompositeLayers = 'CompositeLayers',
}
interface Result {
	name: string;
	status: string;
	threshold: number;
	actual: number;
}
export interface Config {
	host: string;
	thresholds?: Record<string, number>;
}

class Run {
	private config: Config;
	private results: Result[];

	constructor(config: Config) {
		this.config = config;
		this.results = [];
	}

	async run() {
		try {
			fs.mkdirSync(TRACE_DIR);

			const data_click_vals = await this.getInteractiveElements();
			await this.generateTraces(data_click_vals);
			this.processFiles();
			this.printResults();

			fs.rmdirSync(TRACE_DIR);

			process.exit(0);
		} catch (err) {
			console.error(err);
			process.exit(1);
		}
	}

	printResults() {
		this.results.map((result) => {
			console.log({ name: result.name, status: result.status });
		});
	}

	async generateTraces(data_click_vals: string[]) {
		for (const valStr of data_click_vals) {
			const { page, browser } = await this.launchBrowser();
			const dataAttr = `[data-click="${valStr}"]`;
			const selector = await page.waitForSelector(dataAttr);

			if (selector) {
				await page.tracing.start({ path: `${TRACE_DIR}trace.${valStr}.json`, screenshots: false });
				await page.click(dataAttr);
				await page.tracing.stop();
				console.log(dataAttr, 'Trace Successful');
			}

			await browser.close();
		}
	}

	async launchBrowser() {
		const browser = await puppeteer.launch({
			headless: true,
			args: ['--incognito', '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--no-zygote'],
		});

		const page = await browser.newPage();
		const navigationPromise = page.waitForNavigation();
		await page.goto(this.config.host);
		await page.setViewport({ width: 1440, height: 714 });
		await (page as any).waitForTimeout(1000);
		await navigationPromise;

		return { browser, page };
	}

	async getInteractiveElements(): Promise<string[]> {
		const { page, browser } = await this.launchBrowser();

		const data_click_vals = await page.evaluate(() => {
			let elements = [...document.querySelectorAll('[data-click]')];

			// Return value must be JSON serializable
			return elements.map((item) => (item as any).dataset.click);
		});

		browser.close();
		return data_click_vals;
	}

	processFiles() {
		console.log('Reading Traces Directory');
		fs.readdirSync(TRACE_DIR).forEach((file: string) => {
			const path = `${TRACE_DIR}${file}`;
			const fileName = file.split('.')[1];

			try {
				const data = fs.readFileSync(path, 'utf8');
				const json: { traceEvents: TraceEntry[] } = JSON.parse(data);
				if (!json?.traceEvents) {
					throw new Error('Unable to parse JSON data');
				}
				const { finalCompositeDur, finalCompositeStartTime, clickDur, clickStartTime } = this.processJSON(
					json.traceEvents
				);

				const totalDur = finalCompositeStartTime + finalCompositeDur - clickStartTime;
				this.evaluateThresholds(totalDur, fileName);

				console.log({ path, totalDur, clickDur });
				this.removeFiles(file);
			} catch (err) {
				console.error(err);
			}
		});
	}

	evaluateThresholds(totalDur: number, fileName: string) {
		const threshold = this.config.thresholds && this.config.thresholds[fileName];
		if (threshold) {
			let result: Result = {
				threshold,
				actual: totalDur,
				name: fileName,
				status: totalDur < threshold ? 'passed' : 'failed',
			};
			this.results.push(result);
		}
	}

	isCompositeEvent(event: string): boolean {
		if (event === RenderEvent.CompositeLayers) {
			return true;
		}
		return false;
	}

	isClickEvent(event: string): boolean {
		if (event === RenderEvent.Click) {
			return true;
		}
		return false;
	}

	getCoreTimings(entry: TraceEntry, predicate: () => boolean): CoreTimings | undefined {
		if (predicate()) {
			return { ts: entry.ts, dur: entry.dur };
		}
	}

	processJSON(traceEvents: TraceEntry[]) {
		let finalCompositeStartTime = 0;
		let finalCompositeDur = 0;
		let clickStartTime = 0;
		let clickDur = 0;

		traceEvents.forEach((entry: TraceEntry) => {
			const clickTimings = this.getCoreTimings(entry, () => this.isClickEvent(entry.args?.data?.type));
			if (clickTimings) {
				const { ts, dur } = clickTimings;
				clickStartTime = ts;
				clickDur = dur;
			}

			const compositeTimings = this.getCoreTimings(entry, () => this.isCompositeEvent(entry.name));
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

	removeFiles(file: string) {
		try {
			fs.unlinkSync(`${TRACE_DIR}${file}`);
		} catch (err) {
			console.error(err);
		}
	}
}

export default Run;

// Will need to write tests
