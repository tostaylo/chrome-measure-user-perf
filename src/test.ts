import Run, { Config } from './index.js';

const config: Config = {
	host: 'http://localhost:8000',
	thresholds: { '2nd': 400, '3rd': 500 },
	traceDir: './traceDir/',
};

(async () => {
	const TraceRunner = new Run(config);
	await TraceRunner.run();
})();
