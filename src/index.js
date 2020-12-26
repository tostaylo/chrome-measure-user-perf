'use strict';
import puppeteer from 'puppeteer';
import * as fs from 'fs';
const TRACE_DIR = '../traces/';
(async () => {
    try {
        const data_click_vals = await getInteractiveElements();
        await generateTraces(data_click_vals);
        processFiles();
        process.exit(0);
    }
    catch (err) {
        console.error(err);
        process.exit(1);
    }
})();
async function generateTraces(data_click_vals) {
    for (const valStr of data_click_vals) {
        const { page, browser } = await launchBrowser();
        const dataAttr = `[data-click="${valStr}"]`;
        const selector = await page.waitForSelector(dataAttr);
        if (selector) {
            console.log(dataAttr);
            await page.tracing.start({ path: `${TRACE_DIR}trace.${valStr}.json`, screenshots: false });
            await page.click(dataAttr);
            await page.tracing.stop();
            console.log('Trace Successful');
        }
        await browser.close();
        console.log('closing browser');
    }
}
async function launchBrowser() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--incognito', '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--no-zygote'],
    });
    const page = await browser.newPage();
    const navigationPromise = page.waitForNavigation();
    await page.goto('http://localhost:8000');
    await page.setViewport({ width: 1440, height: 714 });
    await page.waitForTimeout(1000);
    await navigationPromise;
    return { browser, page };
}
async function getInteractiveElements() {
    const { page, browser } = await launchBrowser();
    const data_click_vals = await page.evaluate(() => {
        let elements = [...document.querySelectorAll('[data-click]')];
        // Return value must be JSON serializable
        return elements.map((item) => item.dataset.click);
    });
    browser.close();
    return data_click_vals;
}
function processFiles() {
    console.log('Reading Traces Directory');
    fs.readdirSync(TRACE_DIR).forEach((file) => {
        const path = `${TRACE_DIR}${file}`;
        const fileName = file.split('.')[1];
        console.log(fileName);
        try {
            const data = fs.readFileSync(path, 'utf8');
            const json = JSON.parse(data);
            if (!(json === null || json === void 0 ? void 0 : json.traceEvents)) {
                throw new Error('Unable to parse JSON data');
            }
            const { finalCompositeDur, finalCompositeStartTime, clickDur, clickStartTime } = processJSON(json.traceEvents);
            const totalDur = finalCompositeStartTime + finalCompositeDur - clickStartTime;
            console.log({ totalDur, clickDur });
            removeFiles(file);
        }
        catch (err) {
            console.error(err);
        }
    });
}
var RenderEvent;
(function (RenderEvent) {
    RenderEvent["Click"] = "click";
    RenderEvent["Layout"] = "Layout";
    RenderEvent["UpdateLayoutTree"] = "UpdateLayoutTree";
    RenderEvent["Paint"] = "Paint";
    RenderEvent["CompositeLayers"] = "CompositeLayers";
})(RenderEvent || (RenderEvent = {}));
function isCompositeEvent(event) {
    if (event === RenderEvent.CompositeLayers) {
        return true;
    }
    return false;
}
function isClickEvent(event) {
    if (event === RenderEvent.Click) {
        return true;
    }
    return false;
}
function getCoreTimings(entry, predicate) {
    if (predicate()) {
        return { ts: entry.ts, dur: entry.dur };
    }
}
function processJSON(traceEvents) {
    let finalCompositeStartTime = 0;
    let finalCompositeDur = 0;
    let clickStartTime = 0;
    let clickDur = 0;
    traceEvents.forEach((entry) => {
        const clickTimings = getCoreTimings(entry, () => { var _a, _b; return isClickEvent((_b = (_a = entry.args) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.type); });
        if (clickTimings) {
            const { ts, dur } = clickTimings;
            clickStartTime = ts;
            clickDur = dur;
        }
        const compositeTimings = getCoreTimings(entry, () => isCompositeEvent(entry.name));
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
function removeFiles(file) {
    try {
        fs.unlinkSync(`${TRACE_DIR}${file}`);
    }
    catch (err) {
        console.error(err);
    }
}
