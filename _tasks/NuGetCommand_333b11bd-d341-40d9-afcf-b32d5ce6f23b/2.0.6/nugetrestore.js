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
const auth = require("nuget-task-common/Authentication");
const locationHelpers = require("nuget-task-common/LocationHelpers");
const NuGetConfigHelper2_1 = require("nuget-task-common/NuGetConfigHelper2");
const ngToolRunner = require("nuget-task-common/NuGetToolRunner2");
const nutil = require("nuget-task-common/Utility");
const peParser = require('nuget-task-common/pe-parser/index');
const commandHelper = require("nuget-task-common/CommandHelper");
class RestoreOptions {
    constructor(nuGetPath, configFile, noCache, verbosity, packagesDirectory, environment, authInfo) {
        this.nuGetPath = nuGetPath;
        this.configFile = configFile;
        this.noCache = noCache;
        this.verbosity = verbosity;
        this.packagesDirectory = packagesDirectory;
        this.environment = environment;
        this.authInfo = authInfo;
    }
}
function run(nuGetPath) {
    return __awaiter(this, void 0, Promise, function* () {
        let buildIdentityDisplayName = null;
        let buildIdentityAccount = null;
        try {
            nutil.setConsoleCodePage();
            // Reading inputs
            let solutionPattern = tl.getPathInput("solution", true, false);
            let useLegacyFind = tl.getVariable("NuGet.UseLegacyFindFiles") === "true";
            let filesList = [];
            if (!useLegacyFind) {
                let findOptions = {};
                let matchOptions = {};
                let searchPatterns = nutil.getPatternsArrayFromInput(solutionPattern);
                filesList = tl.findMatch(undefined, searchPatterns, findOptions, matchOptions);
            }
            else {
                filesList = nutil.resolveFilterSpec(solutionPattern, tl.getVariable("System.DefaultWorkingDirectory") || process.cwd());
            }
            filesList.forEach(solutionFile => {
                if (!tl.stats(solutionFile).isFile()) {
                    throw new Error(tl.loc("NotARegularFile", solutionFile));
                }
            });
            let noCache = tl.getBoolInput("noCache");
            let verbosity = tl.getInput("verbosityRestore");
            let packagesDirectory = tl.getPathInput("packagesDirectory");
            if (!tl.filePathSupplied("packagesDirectory")) {
                packagesDirectory = null;
            }
            const nuGetVersion = yield peParser.getFileVersionInfoAsync(nuGetPath);
            // Discovering NuGet quirks based on the version
            tl.debug('Getting NuGet quirks');
            const quirks = yield ngToolRunner.getNuGetQuirksAsync(nuGetPath);
            let credProviderPath = nutil.locateCredentialProvider();
            // Clauses ordered in this way to avoid short-circuit evaluation, so the debug info printed by the functions
            // is unconditionally displayed
            const useCredProvider = ngToolRunner.isCredentialProviderEnabled(quirks) && credProviderPath;
            const useCredConfig = ngToolRunner.isCredentialConfigEnabled(quirks) && !useCredProvider;
            // Setting up auth-related variables
            tl.debug('Setting up auth');
            let serviceUri = tl.getEndpointUrl("SYSTEMVSSCONNECTION", false);
            let urlPrefixes = yield locationHelpers.assumeNuGetUriPrefixes(serviceUri);
            tl.debug(`Discovered URL prefixes: ${urlPrefixes}`);
            ;
            // Note to readers: This variable will be going away once we have a fix for the location service for
            // customers behind proxies
            let testPrefixes = tl.getVariable("NuGetTasks.ExtraUrlPrefixesForTesting");
            if (testPrefixes) {
                urlPrefixes = urlPrefixes.concat(testPrefixes.split(";"));
                tl.debug(`All URL prefixes: ${urlPrefixes}`);
            }
            let accessToken = auth.getSystemAccessToken();
            let externalAuthArr = commandHelper.GetExternalAuthInfoArray("externalEndpoints");
            const authInfo = new auth.NuGetExtendedAuthInfo(new auth.InternalAuthInfo(urlPrefixes, accessToken, useCredProvider, useCredConfig), externalAuthArr);
            let environmentSettings = {
                credProviderFolder: useCredProvider ? path.dirname(credProviderPath) : null,
                extensionsDisabled: true
            };
            // Setting up sources, either from provided config file or from feed selection
            tl.debug('Setting up sources');
            let nuGetConfigPath = undefined;
            let selectOrConfig = tl.getInput("selectOrConfig");
            // This IF is here in order to provide a value to nuGetConfigPath (if option selected, if user provided it)
            // and then pass it into the config helper
            if (selectOrConfig === "config") {
                nuGetConfigPath = tl.getPathInput("nugetConfigPath", false, true);
                if (!tl.filePathSupplied("nugetConfigPath")) {
                    nuGetConfigPath = undefined;
                }
            }
            // If there was no nuGetConfigPath, NuGetConfigHelper will create a temp one
            let nuGetConfigHelper = new NuGetConfigHelper2_1.NuGetConfigHelper2(nuGetPath, nuGetConfigPath, authInfo, environmentSettings, null);
            let credCleanup = () => { return; };
            // Now that the NuGetConfigHelper was initialized with all the known information we can proceed
            // and check if the user picked the 'select' option to fill out the config file if needed
            if (selectOrConfig === "select") {
                let sources = new Array();
                let feed = tl.getInput("feedRestore");
                if (feed) {
                    let feedUrl = yield nutil.getNuGetFeedRegistryUrl(accessToken, feed, nuGetVersion);
                    sources.push({
                        feedName: feed,
                        feedUri: feedUrl,
                        isInternal: true
                    });
                }
                let includeNuGetOrg = tl.getBoolInput("includeNuGetOrg", false);
                if (includeNuGetOrg) {
                    let nuGetUrl = nuGetVersion.productVersion.a < 3 ? locationHelpers.NUGET_ORG_V2_URL : locationHelpers.NUGET_ORG_V3_URL;
                    sources.push({
                        feedName: "NuGetOrg",
                        feedUri: nuGetUrl,
                        isInternal: false
                    });
                }
                // Creating NuGet.config for the user
                if (sources.length > 0) {
                    tl.debug(`Adding the following sources to the config file: ${sources.map(x => x.feedName).join(';')}`);
                    nuGetConfigHelper.addSourcesToTempNuGetConfig(sources);
                    credCleanup = () => tl.rmRF(nuGetConfigHelper.tempNugetConfigPath);
                    nuGetConfigPath = nuGetConfigHelper.tempNugetConfigPath;
                }
                else {
                    tl.debug('No sources were added to the temp NuGet.config file');
                }
            }
            // Setting creds in the temp NuGet.config if needed
            yield nuGetConfigHelper.setAuthForSourcesInTempNuGetConfigAsync();
            // Use config file if:
            //     - User selected "Select feeds" option
            //     - User selected "NuGet.config" option and the nuGetConfig input has a value
            let useConfigFile = selectOrConfig === "select" || (selectOrConfig === "config" && !!nuGetConfigPath);
            let configFile = useConfigFile ? nuGetConfigHelper.tempNugetConfigPath : undefined;
            try {
                let restoreOptions = new RestoreOptions(nuGetPath, configFile, noCache, verbosity, packagesDirectory, environmentSettings, authInfo);
                for (const solutionFile of filesList) {
                    yield restorePackagesAsync(solutionFile, restoreOptions);
                }
            }
            finally {
                credCleanup();
            }
            tl.setResult(tl.TaskResult.Succeeded, tl.loc("PackagesInstalledSuccessfully"));
        }
        catch (err) {
            tl.error(err);
            if (buildIdentityDisplayName || buildIdentityAccount) {
                tl.warning(tl.loc("BuildIdentityPermissionsHint", buildIdentityDisplayName, buildIdentityAccount));
            }
            tl.setResult(tl.TaskResult.Failed, tl.loc("PackagesFailedToInstall"));
        }
    });
}
exports.run = run;
function restorePackagesAsync(solutionFile, options) {
    let nugetTool = ngToolRunner.createNuGetToolRunner(options.nuGetPath, options.environment, options.authInfo);
    nugetTool.arg("restore");
    nugetTool.arg(solutionFile);
    if (options.packagesDirectory) {
        nugetTool.arg("-PackagesDirectory");
        nugetTool.arg(options.packagesDirectory);
    }
    if (options.noCache) {
        nugetTool.arg("-NoCache");
    }
    if (options.verbosity && options.verbosity !== "-") {
        nugetTool.arg("-Verbosity");
        nugetTool.arg(options.verbosity);
    }
    nugetTool.arg("-NonInteractive");
    if (options.configFile) {
        nugetTool.arg("-ConfigFile");
        nugetTool.arg(options.configFile);
    }
    return nugetTool.exec({ cwd: path.dirname(solutionFile) });
}
