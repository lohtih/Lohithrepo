"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const path = require("path");
const tl = require("vsts-task-lib/task");
const locationHelpers = require("nuget-task-common/LocationHelpers");
const NuGetConfigHelper2_1 = require("nuget-task-common/NuGetConfigHelper2");
const ngToolRunner = require("nuget-task-common/NuGetToolRunner2");
const vstsNuGetPushToolRunner = require("./Common/VstsNuGetPushToolRunner");
const vstsNuGetPushToolUtilities = require("./Common/VstsNuGetPushToolUtilities");
const nutil = require("nuget-task-common/Utility");
const auth = require("nuget-task-common/Authentication");
const peParser = require('nuget-task-common/pe-parser/index');
const commandHelper = require("nuget-task-common/CommandHelper");
class PublishOptions {
    constructor(nuGetPath, feedUri, apiKey, configFile, verbosity, authInfo, environment) {
        this.nuGetPath = nuGetPath;
        this.feedUri = feedUri;
        this.apiKey = apiKey;
        this.configFile = configFile;
        this.verbosity = verbosity;
        this.authInfo = authInfo;
        this.environment = environment;
    }
}
function run(nuGetPath) {
    return __awaiter(this, void 0, Promise, function* () {
        let buildIdentityDisplayName = null;
        let buildIdentityAccount = null;
        try {
            nutil.setConsoleCodePage();
            // Get list of files to pusblish
            let searchPatternInput = tl.getPathInput("searchPatternPush", true, false);
            let useLegacyFind = tl.getVariable("NuGet.UseLegacyFindFiles") === "true";
            let filesList = [];
            if (!useLegacyFind) {
                let findOptions = {};
                let matchOptions = {};
                let searchPatterns = nutil.getPatternsArrayFromInput(searchPatternInput);
                filesList = tl.findMatch(undefined, searchPatterns, findOptions, matchOptions);
            }
            else {
                filesList = nutil.resolveFilterSpec(searchPatternInput);
            }
            filesList.forEach(packageFile => {
                if (!tl.stats(packageFile).isFile()) {
                    throw new Error(tl.loc("Error_PushNotARegularFile", packageFile));
                }
            });
            if (filesList && filesList.length < 1) {
                tl.setResult(tl.TaskResult.Succeeded, tl.loc("Info_NoPackagesMatchedTheSearchPattern"));
                return;
            }
            // Get the info the type of feed 
            let nugetFeedType = tl.getInput("nuGetFeedType") || "internal";
            // Make sure the feed type is an expected one
            let normalizedNuGetFeedType = ["internal", "external"].find(x => nugetFeedType.toUpperCase() === x.toUpperCase());
            if (!normalizedNuGetFeedType) {
                throw new Error(tl.loc("UnknownFeedType", nugetFeedType));
            }
            nugetFeedType = normalizedNuGetFeedType;
            let serviceUri = tl.getEndpointUrl("SYSTEMVSSCONNECTION", false);
            let urlPrefixes = yield locationHelpers.assumeNuGetUriPrefixes(serviceUri);
            tl.debug(`discovered URL prefixes: ${urlPrefixes}`);
            // Note to readers: This variable will be going away once we have a fix for the location service for
            // customers behind proxies
            let testPrefixes = tl.getVariable("NuGetTasks.ExtraUrlPrefixesForTesting");
            if (testPrefixes) {
                urlPrefixes = urlPrefixes.concat(testPrefixes.split(";"));
                tl.debug(`all URL prefixes: ${urlPrefixes}`);
            }
            // Setting up auth info
            let externalAuthArr = commandHelper.GetExternalAuthInfoArray("externalEndpoint");
            let accessToken = auth.getSystemAccessToken();
            const quirks = yield ngToolRunner.getNuGetQuirksAsync(nuGetPath);
            let credProviderPath = nutil.locateCredentialProvider();
            // Clauses ordered in this way to avoid short-circuit evaluation, so the debug info printed by the functions
            // is unconditionally displayed
            let useCredProvider = ngToolRunner.isCredentialProviderEnabled(quirks) && credProviderPath;
            let useCredConfig = ngToolRunner.isCredentialConfigEnabled(quirks) && !useCredProvider;
            let authInfo = new auth.NuGetExtendedAuthInfo(new auth.InternalAuthInfo(urlPrefixes, accessToken, useCredProvider, useCredConfig), externalAuthArr);
            let environmentSettings = {
                credProviderFolder: useCredProvider ? path.dirname(credProviderPath) : null,
                extensionsDisabled: true
            };
            let configFile = null;
            let apiKey;
            let credCleanup = () => { return; };
            let nuGetConfigHelper = new NuGetConfigHelper2_1.NuGetConfigHelper2(nuGetPath, null, authInfo, environmentSettings, null);
            let feedUri = undefined;
            let isInternalFeed = nugetFeedType === "internal";
            if (isInternalFeed) {
                let internalFeedId = tl.getInput("feedPublish");
                const nuGetVersion = yield peParser.getFileVersionInfoAsync(nuGetPath);
                feedUri = yield nutil.getNuGetFeedRegistryUrl(accessToken, internalFeedId, nuGetVersion);
                if (useCredConfig) {
                    nuGetConfigHelper.addSourcesToTempNuGetConfig([{ feedName: internalFeedId, feedUri: feedUri, isInternal: true }]);
                    configFile = nuGetConfigHelper.tempNugetConfigPath;
                    credCleanup = () => tl.rmRF(nuGetConfigHelper.tempNugetConfigPath);
                }
                apiKey = "VSTS";
            }
            else {
                let externalAuth = externalAuthArr[0];
                if (!externalAuth) {
                    tl.setResult(tl.TaskResult.Failed, tl.loc("Error_NoSourceSpecifiedForPush"));
                    return;
                }
                nuGetConfigHelper.addSourcesToTempNuGetConfig([externalAuth.packageSource]);
                feedUri = externalAuth.packageSource.feedUri;
                configFile = nuGetConfigHelper.tempNugetConfigPath;
                credCleanup = () => tl.rmRF(nuGetConfigHelper.tempNugetConfigPath);
                let authType = externalAuth.authType;
                switch (authType) {
                    case (auth.ExternalAuthType.UsernamePassword):
                    case (auth.ExternalAuthType.Token):
                        apiKey = "RequiredApiKey";
                        break;
                    case (auth.ExternalAuthType.ApiKey):
                        let apiKeyAuthInfo = externalAuth;
                        apiKey = apiKeyAuthInfo.apiKey;
                        break;
                    default:
                        break;
                }
            }
            yield nuGetConfigHelper.setAuthForSourcesInTempNuGetConfigAsync();
            let verbosity = tl.getInput("verbosityPush");
            let continueOnConflict = tl.getBoolInput("allowPackageConflicts");
            if (continueOnConflict && commandHelper.isOnPremisesTfs()) {
                tl.warning(tl.loc("Warning_AllowDuplicatesOnlyAvailableHosted"));
            }
            let useVstsNuGetPush = shouldUseVstsNuGetPush(isInternalFeed, continueOnConflict, nuGetPath);
            let vstsPushPath = undefined;
            if (useVstsNuGetPush) {
                vstsPushPath = vstsNuGetPushToolUtilities.getBundledVstsNuGetPushLocation();
                if (!vstsPushPath) {
                    tl.warning(tl.loc("Warning_FallBackToNuGet"));
                }
            }
            try {
                if (useVstsNuGetPush && vstsPushPath) {
                    tl.debug('Using VstsNuGetPush.exe to push the packages');
                    let vstsNuGetPushSettings = {
                        continueOnConflict: continueOnConflict
                    };
                    let publishOptions = {
                        vstsNuGetPushPath: vstsPushPath,
                        feedUri: feedUri,
                        internalAuthInfo: authInfo.internalAuthInfo,
                        verbosity: verbosity,
                        settings: vstsNuGetPushSettings
                    };
                    for (const packageFile of filesList) {
                        yield publishPackageVstsNuGetPushAsync(packageFile, publishOptions);
                    }
                }
                else {
                    tl.debug('Using NuGet.exe to push the packages');
                    let publishOptions = new PublishOptions(nuGetPath, feedUri, apiKey, configFile, verbosity, authInfo, environmentSettings);
                    for (const packageFile of filesList) {
                        yield publishPackageNuGetAsync(packageFile, publishOptions, authInfo);
                    }
                }
            }
            finally {
                credCleanup();
            }
            tl.setResult(tl.TaskResult.Succeeded, tl.loc("PackagesPublishedSuccessfully"));
        }
        catch (err) {
            tl.error(err);
            if (buildIdentityDisplayName || buildIdentityAccount) {
                tl.warning(tl.loc("BuildIdentityPermissionsHint", buildIdentityDisplayName, buildIdentityAccount));
            }
            tl.setResult(tl.TaskResult.Failed, tl.loc("PackagesFailedToPublish"));
        }
    });
}
exports.run = run;
function publishPackageNuGetAsync(packageFile, options, authInfo) {
    let nugetTool = ngToolRunner.createNuGetToolRunner(options.nuGetPath, options.environment, authInfo);
    nugetTool.arg("push");
    nugetTool.arg(packageFile);
    nugetTool.arg("-NonInteractive");
    nugetTool.arg(["-Source", options.feedUri]);
    nugetTool.argIf(options.apiKey, ["-ApiKey", options.apiKey]);
    if (options.configFile) {
        nugetTool.arg("-ConfigFile");
        nugetTool.arg(options.configFile);
    }
    if (options.verbosity && options.verbosity !== "-") {
        nugetTool.arg("-Verbosity");
        nugetTool.arg(options.verbosity);
    }
    return nugetTool.exec();
}
function publishPackageVstsNuGetPushAsync(packageFile, options) {
    return __awaiter(this, void 0, void 0, function* () {
        let vstsNuGetPushTool = vstsNuGetPushToolRunner.createVstsNuGetPushToolRunner(options.vstsNuGetPushPath, options.settings, options.internalAuthInfo);
        vstsNuGetPushTool.arg(packageFile);
        vstsNuGetPushTool.arg(["-Source", options.feedUri]);
        vstsNuGetPushTool.arg(["-AccessToken", options.internalAuthInfo.accessToken]);
        vstsNuGetPushTool.arg("-NonInteractive");
        if (options.verbosity && options.verbosity.toLowerCase() === "detailed") {
            vstsNuGetPushTool.arg(["-Verbosity", "Detailed"]);
        }
        let exitCode = yield vstsNuGetPushTool.exec();
        if (exitCode === 0) {
            return;
        }
        // ExitCode 2 means a push conflict occurred
        if (exitCode === 2 && options.settings.continueOnConflict) {
            tl.debug(`A conflict ocurred with package ${packageFile}, ignoring it since "Allow duplicates" was selected.`);
            return;
        }
        throw new Error(tl.loc("Error_UnexpectedErrorVstsNuGetPush"));
    });
}
function shouldUseVstsNuGetPush(isInternalFeed, conflictsAllowed, nugetExePath) {
    if (!isInternalFeed) {
        tl.debug('Pushing to an external feed so NuGet.exe will be used.');
        return false;
    }
    if (commandHelper.isOnPremisesTfs()) {
        tl.debug('Pushing to an onPrem environment, only NuGet.exe is supported.');
        return false;
    }
    const nugetOverrideFlag = tl.getVariable("NuGet.ForceNuGetForPush");
    if (nugetOverrideFlag === "true") {
        tl.debug("NuGet.exe is force enabled for publish.");
        if (conflictsAllowed) {
            tl.warning(tl.loc("Warning_ForceNuGetCannotSkipConflicts"));
        }
        return false;
    }
    if (nugetOverrideFlag === "false") {
        tl.debug("NuGet.exe is force disabled for publish.");
        return true;
    }
    const vstsNuGetPushOverrideFlag = tl.getVariable("NuGet.ForceVstsNuGetPushForPush");
    if (vstsNuGetPushOverrideFlag === "true") {
        tl.debug("VstsNuGetPush.exe is force enabled for publish.");
        return true;
    }
    if (vstsNuGetPushOverrideFlag === "false") {
        tl.debug("VstsNuGetPush.exe is force disabled for publish.");
        if (conflictsAllowed) {
            tl.warning(tl.loc("Warning_ForceNuGetCannotSkipConflicts"));
        }
        return false;
    }
    if (!(tl.osType() === 'Windows_NT' || !nugetExePath.trim().toLowerCase().endsWith(".exe"))) {
        tl.warning(tl.loc("Warning_SkipConflictsNotSupportedUnixAgents"));
        return false;
    }
    return true;
}
