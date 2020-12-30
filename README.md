# chrome-measure-user-perf

_Automate user interaction performance testing_

**Experimental status. Use at own risk!**

This package utilizes [Puppeteer](https://developers.google.com/web/tools/puppeteer) and the [Google Chrome Developer Tools Performance Timeline](https://developers.google.com/web/tools/chrome-devtools/evaluate-performance/reference) to record the duration of click events and the resulting browser render process on your webpage. You can set timing thresholds for each click event and this package will evaluate the success or failure of each interaction based on the timing threshold.

## Motivation

A short [presentation](https://docs.google.com/presentation/d/1fmtKu9JcdGmVvJsUlWtRxmyqH0_fpIX6bX-QYlGw2vk/edit#slide=id.gaf58bd1369_1_0) describing the motivation and process behind this package.

## Use

```shell

npm install chrome-measure-user-perf

```

First add the `data-click=[aUniqueIdentifier]` to the HTML elements which initiate the user interactions you would like to measure.

```html
<button data-click="1st">1st button interaction</button>
<button data-click="2nd">2nd button interaction</button>
<button data-click="3rd">3rd button interaction</button>
```

Then create your Node script.

```typescript
import TraceRunner, { Config, ThrottleSetting } from 'chrome-measure-user-perf';

let config: Config = {
	host: 'http://localhost:8000',
	thresholds: { '1st': 500 ,'2nd': 400, '3rd': 1000 };,

  // The following name will be used to create a directory located inside
  // the current working directory on every invocation of TracerRunner.run
  // The directory is then deleted after every TraceRunner.run invocation.
	traceDirName: 'uniqueDirectoryName', // This will be created at ./uniqueDirectoryName/
	throttleSetting: ThrottleSetting.NO_THROTTLE,
	keepDir: false,
};

(async () => {
	const TR = new TraceRunner(config);
	await TR.run();
})();
```

Make sure the `config.host` matches the url your application is running on.

Execute your Node script invoking `TraceRunner.run`

## Configuration

```typescript
export interface Config {
	// Where your application is running.
	host: string;

	// Record of all the elements on the page with the "data-click" attribute
	// Key = Name of unique identifer given to the value of "data-click" for each element
	// Value = Test baseline (in milliseconds) which determines if that user interaction passes or fails
	thresholds: Record<string, number>;

	// Local Directory which will be temporarily created for every invocation of TraceRunner.run
	// MUST BE UNIQUE NAME FROM ANY OTHER DIRECTORY IN THE CURRENT WORKING DIRECTORY!
	// IT WILL BE DELETED AFTER EVERY RUN!
	traceDirName: string;

	// Enum for throttling the CPU of Chrome Dev Tools Performance Timeline
	// 0 = No Throttle, 4 = 4x Throttle
	throttleSetting?: ThrottleSetting;

	// Keep trace file directory between executions of TraceRunner.run. Helpful for debugging.
	keepDir?: boolean;

	// Time to wait for page load.
	// Can be increased if interactions are being executed by Puppeteer too soon before event listeners have been attached.
	// Or if the elements containing data-click attributes on the page have not rendered yet.
	pageLoadAwait?: number;
}
```

## Defaults

```typescript
const DEFAULT_CONFIG: Partial<Config> = { pageLoadAwait: 1000, throttleSetting: ThrottleSetting.NO_THROTTLE };
```

## How it Works

1. A new directory you name in the configuration object using `traceDirName` is created in the current working directory.
2. [Puppeteer](https://developers.google.com/web/tools/puppeteer) opens a new instance of Chrome to collect all of the `data-click` attribute values on the page.
3. For every `data-click` attribute values on the page a new Chrome instance is opened, [Puppeteer](https://developers.google.com/web/tools/puppeteer) clicks the element with the attribute, a [performance timeline trace](https://developers.google.com/web/tools/chrome-devtools/evaluate-performance/reference) is recorded and placed in the local directory you name in the configuration object using `traceDirName`, and the Chrome instance is closed.
4. Once the [performance timeline traces](https://developers.google.com/web/tools/chrome-devtools/evaluate-performance/reference) have been recorded for every element containing the `data-click` attribute , the trace files are processed and results are printed to the console.
5. The directory containing all of the trace files is removed using [Trash](https://github.com/sindresorhus/trash#readme).
