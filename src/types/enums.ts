export enum Status {
	Passed,
	Failed,
}

export enum ThrottleSetting {
	NO_THROTTLE = 0,
	THROTTLE_4X = 4,
}

export enum RenderEvent {
	Click = 'click',
	Layout = 'Layout',
	UpdateLayoutTree = 'UpdateLayoutTree',
	Paint = 'Paint',
	CompositeLayers = 'CompositeLayers',
}
