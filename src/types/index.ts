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
