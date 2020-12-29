'use strict';
import puppeteer from 'puppeteer';
import * as fs from 'fs';
import { TraceEntry, CoreTimings } from './types/index';
import chalk from 'chalk';
import trash from 'trash';

export enum Status {
	Passed,
	Failed,
}

export enum ThrottleSetting {
	NO_THROTTLE = 0,
	THROTTLE_4X = 4,
}

export enum RenderEvent {
	Click = 'click',
	Layout = 'Layout',
	UpdateLayoutTree = 'UpdateLayoutTree',
	Paint = 'Paint',
	CompositeLayers = 'CompositeLayers',
}
interface Result {
	name: string;
	status: Status;
	threshold: number;
	actual: number;
}

const DEFAULT_CONFIG: Partial<Config> = { pageLoadAwait: 1000, throttleSetting: ThrottleSetting.NO_THROTTLE };
export interface Config {
	// Where your application is running.
	host: string;

	// Record of all the elements on the page with the "data-click" attribute
	// Key = Name of unique identifer given to the value of "data-click" for each element
	// Value = Test baseline (in milliseconds)  which determines if that user interaction passes or fails
	thresholds: Record<string, number>;

	// Directory which will be temporarily created for every invocation of TraceRunner.run
	// MUST BE UNIQUE NAME FROM ANY OTHER DIRECTORY IN THE LOCATION SPECIFIED!
	// IT WILL BE DELETED AFTER EVERY RUN.
	traceDirName: string;

	// Enum for throttling the CPU of Chrome Dev Tools Performance Timeline
	// 0 = No Throttle, 1 = 4x Throttle
	throttleSetting?: ThrottleSetting;

	// Keep trace file directory between executions of TraceRunner.run. Helpful for debugging.
	keepDir?: boolean;

	// Time to wait for page load.
	// Can be increased if interactions are being executed by Puppeteer too soon before event listeners have been attached.
	// Or if the elements containing data-click attributes on the page have not rendered yet.
	pageLoadAwait?: number;
}

class TraceRunner {
	private config: Config;
	private results: Result[];
	private exitCode: number;

	constructor(config: Config) {
		this.config = { ...DEFAULT_CONFIG, ...config, traceDirName: `./${config.traceDirName}/` };
		this.results = [];
		this.exitCode = Status.Passed;
	}

	async run() {
		try {
			if (!this.config.traceDirName) {
				console.log(chalk.red('Must specify a unique temporary directory for trace files!'));
				process.exit(1);
			}

			if (!this.config.host) {
				console.log(chalk.red('Must specify a host!'));
				process.exit(1);
			}

			if (!fs.existsSync(this.config.traceDirName)) {
				fs.mkdirSync(this.config.traceDirName);
			} else {
				console.log(chalk.red('Trace Directory must not exist already!'));
				process.exit(1);
			}

			const data_click_vals = await this.getInteractiveElements();
			await this.generateTraces(data_click_vals);
			this.processFiles();
			this.printResults();

			if (!this.config.keepDir) {
				await trash([this.config.traceDirName]);
			}

			process.exit(this.exitCode);
		} catch (err) {
			if (!this.config.keepDir) {
				await trash([this.config.traceDirName]);
			}

			console.error(chalk.red(err));

			process.exit(1);
		}
	}

	printResults() {
		this.results.map((result) => {
			const [colorFn, statusStr] = result.status === Status.Passed ? [chalk.green, 'Passed'] : [chalk.red, 'Failed'];
			console.log(
				colorFn(`
				TestName: ${result.name},
				Status: ${statusStr},
				Expected: < ${result.threshold} ms,
				Actual: ${result.actual} ms,
			`)
			);
		});
	}

	async generateTraces(data_click_vals: string[]) {
		for (const valStr of data_click_vals) {
			const { page, browser } = await this.launchBrowser();
			const dataAttr = `[data-click="${valStr}"]`;
			const selector = await page.waitForSelector(dataAttr);

			if (selector) {
				await page.tracing.start({ path: `${this.config.traceDirName}trace.${valStr}.json`, screenshots: false });
				await page.click(dataAttr);
				await page.tracing.stop();
			}

			await browser.close();
		}
	}

	async launchBrowser(throttled = true) {
		const browser = await puppeteer.launch({
			headless: true,
			args: ['--incognito', '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--no-zygote'],
		});

		const page = await browser.newPage();
		const navigationPromise = page.waitForNavigation();
		await page.goto(this.config.host);
		await page.setViewport({ width: 1440, height: 714 });
		await (page as any).waitForTimeout(this.config.pageLoadAwait);
		await navigationPromise;

		if (throttled && this.config.throttleSetting !== ThrottleSetting.NO_THROTTLE) {
			// Connect to Chrome DevTools
			const client = await page.target().createCDPSession();

			// Set Network Throttling property
			// await client.send('Network.emulateNetworkConditions', {
			// 	offline: false,
			// 	downloadThroughput: (200 * 1024) / 8,
			// 	uploadThroughput: (200 * 1024) / 8,
			// 	latency: 20,
			// });

			// Set Network CPU Throttling property
			await client.send('Emulation.setCPUThrottlingRate', { rate: this.config.throttleSetting });
		}

		return { browser, page };
	}

	async getInteractiveElements(): Promise<string[]> {
		const { page, browser } = await this.launchBrowser(false);

		// What happens if I put a time out to not render the data-clicks for 5 seconds?
		const data_click_vals = await page.evaluate(() => {
			let elements = [...document.querySelectorAll('[data-click]')];

			// Return value must be JSON serializable
			return elements.map((item) => (item as any).dataset.click);
		});

		browser.close();
		return data_click_vals;
	}

	processFiles() {
		fs.readdirSync(this.config.traceDirName).forEach((file: string) => {
			const path = `${this.config.traceDirName}${file}`;
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

				const result = this.evaluateThresholds(totalDur, fileName);
				if (result) {
					this.results.push(result);
				}
			} catch (err) {
				console.error(chalk.red(err));
			}
		});
	}

	evaluateThresholds(totalDur: number, fileName: string): Result | undefined {
		const threshold = this.config.thresholds && this.config.thresholds[fileName];
		if (threshold) {
			let status = Status.Passed;

			if (totalDur >= threshold) {
				status = Status.Failed;
				this.exitCode = Status.Failed;
			}

			return {
				threshold,
				actual: totalDur,
				name: fileName,
				status,
			};
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

export default TraceRunner;
