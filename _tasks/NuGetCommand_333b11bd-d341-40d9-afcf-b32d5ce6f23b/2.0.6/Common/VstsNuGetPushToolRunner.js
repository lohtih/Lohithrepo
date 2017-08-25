"use strict";
const toolrunner_1 = require("vsts-task-lib/toolrunner");
const tl = require("vsts-task-lib/task");
function initializeExecutionOptions(options, settings) {
    options = options || {};
    if (settings.continueOnConflict) {
        options.ignoreReturnCode = true;
    }
    return options;
}
class VstsNuGetPushToolRunner extends toolrunner_1.ToolRunner {
    constructor(vstsNuGetPushPath, settings, authInfo) {
        if (tl.osType() === 'Windows_NT' || !vstsNuGetPushPath.trim().toLowerCase().endsWith(".exe")) {
            super(vstsNuGetPushPath);
        }
        else {
            // TODO: check if it works with mono
            let monoPath = tl.which("mono", true);
            super(monoPath);
            this.arg(vstsNuGetPushPath);
        }
        this.settings = settings;
        this.authInfo = authInfo;
    }
    execSync(options) {
        options = initializeExecutionOptions(options, this.settings);
        return super.execSync(options);
    }
    exec(options) {
        options = initializeExecutionOptions(options, this.settings);
        return super.exec(options);
    }
}
exports.VstsNuGetPushToolRunner = VstsNuGetPushToolRunner;
function createVstsNuGetPushToolRunner(vstsNuGetPushPath, settings, authInfo) {
    let runner = new VstsNuGetPushToolRunner(vstsNuGetPushPath, settings, authInfo);
    runner.on("debug", message => tl.debug(message));
    return runner;
}
exports.createVstsNuGetPushToolRunner = createVstsNuGetPushToolRunner;
