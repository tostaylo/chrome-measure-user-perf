'use strict';
import puppeteer from 'puppeteer';
import * as fs from 'fs';
import { TraceEntry, CoreTimings } from './types/index';

// Configurable Options
// Throttled

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
	thresholds: Record<string, number>;
	traceDir: string;
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
			// remove directory if it exists already.
			fs.rmdirSync(this.config.traceDir, { recursive: true });
			fs.mkdirSync(this.config.traceDir);

			const data_click_vals = await this.getInteractiveElements();
			await this.generateTraces(data_click_vals);
			this.processFiles();
			this.printResults();

			fs.rmdirSync(this.config.traceDir, { recursive: true });
			process.exit(0);
		} catch (err) {
			fs.rmdirSync(this.config.traceDir, { recursive: true });
			console.error(err);
			process.exit(1);
		}
	}

	printResults() {
		this.results.map((result) => {
			console.log({
				TestName: result.name,
				Status: result.status,
				Expected: `< ${result.threshold}`,
				Actual: result.actual,
			});
		});
	}

	async generateTraces(data_click_vals: string[]) {
		for (const valStr of data_click_vals) {
			const { page, browser } = await this.launchBrowser();
			const dataAttr = `[data-click="${valStr}"]`;
			const selector = await page.waitForSelector(dataAttr);

			if (selector) {
				await page.tracing.start({ path: `${this.config.traceDir}trace.${valStr}.json`, screenshots: false });
				await page.click(dataAttr);
				await page.tracing.stop();
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
		fs.readdirSync(this.config.traceDir).forEach((file: string) => {
			const path = `${this.config.traceDir}${file}`;
			const fileName = file.split('.')[1];

			try {
				const data = fs.readFileSync(path, 'utf8');
				const json: { traceEvents: TraceEntry[] } = JSON.parse(data);
				if (!json?.traceEvents) {
					throw new Error('Unable to parse JSON data');
				}
				let { finalCompositeDur, finalCompositeStartTime, clickDur, clickStartTime } = this.processJSON(
					json.traceEvents
				);

				let totalDur = finalCompositeStartTime + finalCompositeDur - clickStartTime;
				clickDur = clickDur / 1000;
				totalDur = totalDur / 1000;
				this.evaluateThresholds(totalDur, fileName);
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
		} else {
			throw new Error(
				`All elements with the [data-click] attribute must have a threshold set. No threshold was set for the element ${fileName}`
			);
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
}

export default Run;

// Will need to write tests
