"use strict";
// Placed as a separate file for the purpose of unit testing
const path = require("path");
const commandHelper = require("nuget-task-common/CommandHelper");
function getBundledVstsNuGetPushLocation() {
    const vstsNuGetPushPaths = ["VstsNuGetPush/0.13.0"];
    const toolPath = commandHelper.locateTool("VstsNuGetPush", {
        root: path.dirname(__dirname),
        searchPath: vstsNuGetPushPaths,
        toolFilenames: ["VstsNuGetPush.exe"],
    });
    return toolPath;
}
exports.getBundledVstsNuGetPushLocation = getBundledVstsNuGetPushLocation;
