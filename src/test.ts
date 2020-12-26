import Run, { Config } from './index.js';

const config: Config = { host: 'http://localhost:8000', thresholds: { '1st': 5000000 } };

(async () => {
	const TraceRunner = new Run(config);
	await TraceRunner.run();
})();
