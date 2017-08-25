"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const tl = require("vsts-task-lib/task");
const path = require("path");
const nugetRestore = require('./nugetrestore');
const nugetPublish = require('./nugetpublisher');
const nugetPack = require('./nugetpack');
const nugetCustom = require('./nugetcustom');
const nuGetGetter = require("nuget-task-common/NuGetToolGetter");
const NUGET_EXE_CUSTOM_LOCATION = "NuGetExeCustomLocation";
function main() {
    return __awaiter(this, void 0, Promise, function* () {
        tl.setResourcePath(path.join(__dirname, "task.json"));
        // Getting NuGet
        tl.debug('Getting NuGet');
        let nuGetPath = undefined;
        try {
            nuGetPath = process.env[nuGetGetter.NUGET_EXE_TOOL_PATH_ENV_VAR] || process.env[NUGET_EXE_CUSTOM_LOCATION];
            if (!nuGetPath) {
                nuGetGetter.cacheBundledNuGet_4_0_0();
                nuGetPath = yield nuGetGetter.getNuGet("4.0.0");
            }
        }
        catch (error) {
            tl.setResult(tl.TaskResult.Failed, error.message);
            return;
        }
        let nugetCommand = tl.getInput("command", true);
        switch (nugetCommand) {
            case "restore":
                nugetRestore.run(nuGetPath);
                break;
            case "pack":
                nugetPack.run(nuGetPath);
                break;
            case "push":
                nugetPublish.run(nuGetPath);
                break;
            case "custom":
                nugetCustom.run(nuGetPath);
                break;
            default:
                tl.setResult(tl.TaskResult.Failed, tl.loc("Error_CommandNotRecognized", nugetCommand));
                break;
        }
    });
}
main();
