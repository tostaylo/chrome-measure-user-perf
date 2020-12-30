import TraceRunner from './index.js';
import { Config } from './types/interfaces.js';
import { ThrottleSetting } from './types/enums.js';

const passing = { '2nd': 5000, '3rd': 5000 };
const failed = { '2nd': 1000, '3rd': 50 };

let config: Config = {
	host: 'http://localhost:8000',
	thresholds: passing,
	traceDirName: 'LocalTraceDirectoryNameWhichWillBeDeletedOnEveryRun',
	throttleSetting: ThrottleSetting.THROTTLE_4X,
	keepDir: false,
};

(async () => {
	if (process.argv.includes('failing')) {
		config.thresholds = failed;
	}

	const TR = new TraceRunner(config);
	await TR.run();
})();
