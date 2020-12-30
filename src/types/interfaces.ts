import { Status, ThrottleSetting } from './enums';

export interface TraceEntry {
	args: { data: { type: string } };
	name: string;
	ts: number;
	dur: number;
}

export interface CoreTimings {
	ts: number;
	dur: number;
}

export interface Result {
	name: string;
	status: Status;
	threshold: number;
	actual: number;
}

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
