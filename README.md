# chrome-measure-user-perf

Automate user interaction performance testing.

Experimental status

This package utilizes [Puppeteer](https://developers.google.com/web/tools/puppeteer) and the [Google Chrome Developer Tools Performance Timeline](https://developers.google.com/web/tools/chrome-devtools/evaluate-performance/reference) to record the duration of click events and the resulting browser render process on your webpage. You can set timing thresholds for each click event and this package will evaluate the success or failure of each threshold.

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
import Run, { Config, ThrottleSetting } from './index.js';

let config: Config = {
	host: 'http://localhost:8000',
	thresholds: { '1st': 400, '2nd': 1500, '3rd': 1500 },
	traceDir: './traceDir/',
	throttleSetting: ThrottleSetting.NO_THROTTLE,
	keepDir: false,
};

(async () => {
	const TraceRunner = new Run(config);
	await TraceRunner.run();
})();
```

Start up your application. Make sure the `config.host` matches the url your application is running on.

Execute your Node script invoking `TracerRunner.run`

## Configuration

```typescript
export interface Config {
	// Where your application is running.
	host: string;

	// Record of all the elements on the page with the "data-click" attribute
	// Key = Name of unique identifer given to the value of "data-click" for each element
	// Value = Test baseline (in milliseconds) which determines if that user interaction passes or fails
	thresholds: Record<string, number>;

	// Directory which will be temporarily created for every invocation of TraceRunner.run
	// MUST BE UNIQUE NAME FROM ANY OTHER DIRECTORY IN THE LOCATION SPECIFIED!
	// IT WILL BE DELETED AFTER EVERY RUN.
	traceDir: string;

	// Enum for throttling the CPU of Chrome Dev Tools Performance Timeline
	// 0 = No Throttle, 1 = 4x Throttle
	throttleSetting?: ThrottleSetting;

	// Keep trace file directory between executions of TraceRunner.run. Helpful for debugging.
	keepDir?: boolean;
}
```
