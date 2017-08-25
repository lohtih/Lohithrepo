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
const ngToolRunner = require("nuget-task-common/NuGetToolRunner2");
const nutil = require("nuget-task-common/Utility");
const path = require("path");
const auth = require("nuget-task-common/Authentication");
const locationHelpers = require("nuget-task-common/LocationHelpers");
const peParser = require('nuget-task-common/pe-parser/index');
class NuGetExecutionOptions {
    constructor(nuGetPath, environment, args, authInfo) {
        this.nuGetPath = nuGetPath;
        this.environment = environment;
        this.args = args;
        this.authInfo = authInfo;
    }
}
function run(nuGetPath) {
    return __awaiter(this, void 0, Promise, function* () {
        nutil.setConsoleCodePage();
        tl.setResourcePath(path.join(__dirname, "task.json"));
        let buildIdentityDisplayName = null;
        let buildIdentityAccount = null;
        let args = tl.getInput("arguments", false);
        const version = yield peParser.getFileVersionInfoAsync(nuGetPath);
        if (version.productVersion.a < 3 || (version.productVersion.a <= 3 && version.productVersion.b < 5)) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("Info_NuGetSupportedAfter3_5", version.strings.ProductVersion));
            return;
        }
        try {
            let credProviderPath = nutil.locateCredentialProvider();
            // Clauses ordered in this way to avoid short-circuit evaluation, so the debug info printed by the functions
            // is unconditionally displayed
            const quirks = yield ngToolRunner.getNuGetQuirksAsync(nuGetPath);
            const useCredProvider = ngToolRunner.isCredentialProviderEnabled(quirks) && credProviderPath;
            // useCredConfig not placed here: This task will only support NuGet versions >= 3.5.0 which support credProvider both hosted and OnPrem
            let accessToken = auth.getSystemAccessToken();
            let serviceUri = tl.getEndpointUrl("SYSTEMVSSCONNECTION", false);
            let urlPrefixes = yield locationHelpers.assumeNuGetUriPrefixes(serviceUri);
            tl.debug(`Discovered URL prefixes: ${urlPrefixes}`);
            // Note to readers: This variable will be going away once we have a fix for the location service for
            // customers behind proxies
            let testPrefixes = tl.getVariable("NuGetTasks.ExtraUrlPrefixesForTesting");
            if (testPrefixes) {
                urlPrefixes = urlPrefixes.concat(testPrefixes.split(";"));
                tl.debug(`All URL prefixes: ${urlPrefixes}`);
            }
            let authInfo = new auth.NuGetExtendedAuthInfo(new auth.InternalAuthInfo(urlPrefixes, accessToken, useCredProvider, false), []);
            let environmentSettings = {
                credProviderFolder: useCredProvider ? path.dirname(credProviderPath) : null,
                extensionsDisabled: true
            };
            let executionOptions = new NuGetExecutionOptions(nuGetPath, environmentSettings, args, authInfo);
            yield runNuGetAsync(executionOptions);
        }
        catch (err) {
            tl.error(err);
            if (buildIdentityDisplayName || buildIdentityAccount) {
                tl.warning(tl.loc("BuildIdentityPermissionsHint", buildIdentityDisplayName, buildIdentityAccount));
            }
            tl.setResult(tl.TaskResult.Failed, "");
        }
    });
}
exports.run = run;
function runNuGetAsync(executionOptions) {
    let nugetTool = ngToolRunner.createNuGetToolRunner(executionOptions.nuGetPath, executionOptions.environment, executionOptions.authInfo);
    nugetTool.line(executionOptions.args);
    nugetTool.arg("-NonInteractive");
    return nugetTool.exec();
}
