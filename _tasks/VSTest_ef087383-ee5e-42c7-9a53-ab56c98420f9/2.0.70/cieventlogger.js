"use strict";
const tl = require('vsts-task-lib/task');
const area = 'TestExecution';
const feature = 'TestExecutionTask';
function getDefaultProps() {
    return {
        releaseuri: tl.getVariable('Release.ReleaseUri'),
        releaseid: tl.getVariable('Release.ReleaseId'),
        builduri: tl.getVariable('Build.BuildUri'),
        buildid: tl.getVariable('Build.Buildid')
    };
}
function publishEvent(properties) {
    try {
        tl.publishTelemetry(area, feature, Object.assign(getDefaultProps(), properties));
    }
    catch (err) {
    }
}
exports.publishEvent = publishEvent;
