import Run, { Config, ThrottleSetting } from './index.js';

const passing = { '2nd': 1500, '3rd': 1500 };
const failed = { '2nd': 1000, '3rd': 50 };

let config: Config = {
	host: 'http://localhost:8000',
	thresholds: passing,
	traceDir: './traceDir/',
	throttleSetting: ThrottleSetting.NO_THROTTLE,
};

(async () => {
	if (process.argv.includes('failing')) {
		config.thresholds = failed;
	}

	const TraceRunner = new Run(config);
	await TraceRunner.run();
})();
