import assert from 'assert';

import Run, { Config } from '../src/index.js';

describe('It TraceRuns', async function () {
	const config: Config = {
		host: 'http://localhost:8000',
		thresholds: { '2nd': 400, '3rd': 500 },
		traceDir: './traceDir/',
		throttleSetting: 0,
	};

	const TraceRunner = new Run(config);

	it('should evaluate thresholds accurately', function () {
		const result1 = TraceRunner.evaluateThresholds(401, '2nd');
		assert.strictEqual(result1?.status, 'Failed');
		const result2 = TraceRunner.evaluateThresholds(499, '3rd');
		assert.strictEqual(result2?.status, 'Passed');
	});
});
