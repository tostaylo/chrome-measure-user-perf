import assert from 'assert';
import Run, { Config, RenderEvent, Status } from '../src/index.js';
import { TraceEntry } from '../src/types/index';
import { spawn } from 'child_process';
import * as fs from 'fs';

describe('It has individual methods that work', async function () {
	const config: Config = {
		host: 'http://localhost:8000',
		thresholds: { '2nd': 400, '3rd': 500 },
		traceDir: './traceDir/',
		throttleSetting: 0,
	};

	const TraceRunner = new Run(config);
	const traceEvents: TraceEntry[] = [
		{ args: { data: { type: 'click' } }, dur: 5000, name: 'click', ts: 0 },
		{ args: { data: { type: '' } }, dur: 5000, name: 'Paint', ts: 5001 },
		{ args: { data: { type: '' } }, dur: 5000, name: RenderEvent.CompositeLayers, ts: 5001 },
		{ args: { data: { type: '' } }, dur: 7000, name: RenderEvent.CompositeLayers, ts: 5002 },
	];

	it('should evaluate thresholds accurately', function () {
		const result1 = TraceRunner.evaluateThresholds(401, '2nd');
		assert.strictEqual(result1?.status, Status.Failed);
		const result2 = TraceRunner.evaluateThresholds(499, '3rd');
		assert.strictEqual(result2?.status, Status.Passed);
	});

	it('should process the json data', function () {
		const { finalCompositeDur, finalCompositeStartTime, clickStartTime, clickDur } = TraceRunner.processJSON(
			traceEvents
		);

		assert.strictEqual(finalCompositeDur, 7000);
		assert.strictEqual(clickStartTime, 0);
		assert.strictEqual(finalCompositeStartTime, 5002);
		assert.strictEqual(clickDur, 5000);
	});
});

describe('The whole thing should work', async function () {
	for (let i = 0; i <= 1; i++) {
		it(`should work when called from Node and be ${i === 0 ? 'Passing' : 'Failing'}`, async function () {
			let hasExited = false;
			let exitCode = null;
			let args = i === 0 ? ['test.js'] : ['test.js', 'failing'];

			const nodeTest = spawn('node', args, {
				// stdio: 'inherit',
				// shell: true,
				cwd: '/Users/torre/Dev/chrome-measure-user-perf/src',
			});

			// nodeTest.stdout.on('data', (data: Buffer) => {
			// 	const dataStr = data.toString();
			// 	if (dataStr.indexOf('Passed') > -1 || dataStr.indexOf('Failed') > -1) {
			// 		console.log(dataStr);
			// 		// jsonData.push(JSON.parse(dataStr));
			// 	}
			// });

			// nodeTest.stderr.on('data', (data: any) => {
			// 	console.log(`stderr: ${data}`);
			// });

			// nodeTest.on('error', (error: any) => {
			// 	console.log(`error: ${error.message}`);
			// });

			nodeTest.on('close', (code: number) => {
				exitCode = code;
				hasExited = true;
			});

			while (!hasExited) {
				await delay(100, null);
			}

			assert.strictEqual(exitCode, i);
			assert.strictEqual(fs.existsSync('./traceDir/'), false);
		});
	}
});

function delay(t: number, val: any) {
	return new Promise(function (resolve) {
		setTimeout(function () {
			resolve(val);
		}, t);
	});
}
