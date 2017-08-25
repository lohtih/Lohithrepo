"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const path = require('path');
const ps = require('child_process');
const tl = require('vsts-task-lib/task');
const settingsHelper = require('./settingshelper');
const utils = require('./helpers');
const ta = require('./testagent');
const ci = require('./cieventlogger');
const testselectorinvoker_1 = require('./testselectorinvoker');
const testSelector = new testselectorinvoker_1.TestSelectorInvoker();
class DistributedTest {
    constructor(dtaTestConfig) {
        this.dtaPid = -1;
        this.dtaTestConfig = dtaTestConfig;
    }
    runDistributedTest() {
        this.publishCodeChangesIfRequired();
        this.registerAndConfigureAgent();
    }
    publishCodeChangesIfRequired() {
        if (this.dtaTestConfig.tiaConfig.tiaEnabled) {
            const code = testSelector.publishCodeChanges(this.dtaTestConfig.tiaConfig, null); //todo: enable custom engine
            if (code !== 0) {
                tl.warning(tl.loc('ErrorWhilePublishingCodeChanges'));
            }
        }
    }
    registerAndConfigureAgent() {
        return __awaiter(this, void 0, void 0, function* () {
            tl.debug('Configure the Agent with DTA... Invoking the createAgent REST API');
            try {
                const agentId = yield ta.TestAgent.createAgent(this.dtaTestConfig.dtaEnvironment, 3);
                ci.publishEvent({ environmenturi: this.dtaTestConfig.dtaEnvironment.environmentUri, agentid: agentId,
                    agentsize: this.dtaTestConfig.numberOfAgentsInPhase });
                yield this.startDtaExecutionHost(agentId);
                yield this.startDtaTestRun();
                try {
                    if (this.dtaPid !== -1) {
                        tl.debug('Trying to kill the Modules/DTAExecutionHost.exe process with pid :' + this.dtaPid);
                        process.kill(this.dtaPid);
                    }
                }
                catch (error) {
                    tl.warning('Modules/DTAExecutionHost.exe process kill failed, pid: ' + this.dtaPid + ' , error :' + error);
                }
                tl.setResult(tl.TaskResult.Succeeded, 'Task succeeded');
            }
            catch (error) {
                ci.publishEvent({ environmenturi: this.dtaTestConfig.dtaEnvironment.environmentUri, error: error });
                tl.error(error);
                tl.setResult(tl.TaskResult.Failed, error);
            }
        });
    }
    startDtaExecutionHost(agentId) {
        return __awaiter(this, void 0, void 0, function* () {
            const envVars = process.env;
            utils.Helper.addToProcessEnvVars(envVars, 'DTA.AccessToken', this.dtaTestConfig.dtaEnvironment.patToken);
            utils.Helper.addToProcessEnvVars(envVars, 'DTA.AgentId', agentId);
            utils.Helper.addToProcessEnvVars(envVars, 'DTA.AgentName', this.dtaTestConfig.dtaEnvironment.agentName);
            utils.Helper.addToProcessEnvVars(envVars, 'DTA.EnvironmentUri', this.dtaTestConfig.dtaEnvironment.environmentUri);
            utils.Helper.addToProcessEnvVars(envVars, 'DTA.TeamFoundationCollectionUri', this.dtaTestConfig.dtaEnvironment.tfsCollectionUrl);
            utils.Helper.addToProcessEnvVars(envVars, 'DTA.MiniMatchSourceFilter', 'true');
            utils.Helper.addToProcessEnvVars(envVars, 'DTA.LocalTestDropPath', this.dtaTestConfig.testDropLocation);
            utils.Helper.addToProcessEnvVars(envVars, 'DTA.EnableConsoleLogs', 'true');
            utils.Helper.addToProcessEnvVars(envVars, 'DTA.UseVsTestConsole', this.dtaTestConfig.useVsTestConsole);
            utils.Helper.addToProcessEnvVars(envVars, 'DTA.TestPlatformVersion', this.dtaTestConfig.vsTestVersion);
            if (this.dtaTestConfig.pathtoCustomTestAdapters) {
                const testAdapters = tl.findMatch(this.dtaTestConfig.pathtoCustomTestAdapters, '**\\*TestAdapter.dll');
                if (!testAdapters || (testAdapters && testAdapters.length === 0)) {
                    tl.warning(tl.loc('pathToCustomAdaptersContainsNoAdapters', this.dtaTestConfig.pathtoCustomTestAdapters));
                }
                utils.Helper.addToProcessEnvVars(envVars, 'DTA.CustomTestAdapters', this.dtaTestConfig.pathtoCustomTestAdapters);
            }
            // If we are setting the path version is not needed
            const exelocation = path.dirname(this.dtaTestConfig.vsTestVersionDetais.vstestExeLocation);
            tl.debug('Adding env var DTA.TestWindow.Path = ' + exelocation);
            // Split the TestWindow path out of full path - if we can't find it, will assume
            // that this is nuget/xcopyable package where the dlls are present in test window folder
            const testWindowRelativeDir = 'CommonExtensions\\Microsoft\\TestWindow';
            if (exelocation && exelocation.indexOf(testWindowRelativeDir) !== -1) {
                const ideLocation = exelocation.split(testWindowRelativeDir)[0];
                tl.debug('Adding env var DTA.VisualStudio.Path = ' + ideLocation);
                utils.Helper.addToProcessEnvVars(envVars, 'DTA.VisualStudio.Path', ideLocation);
            }
            else {
                utils.Helper.addToProcessEnvVars(envVars, 'DTA.VisualStudio.Path', exelocation);
            }
            utils.Helper.addToProcessEnvVars(envVars, 'DTA.TestWindow.Path', exelocation);
            // We are logging everything to a DTAExecutionHost.exe.log file and reading it at the end and adding to the build task debug logs
            // So we are not redirecting the IO streams from the DTAExecutionHost.exe process
            // We are not using toolrunner here because it doesn't have option to ignore the IO stream, so directly using spawn
            const proc = ps.spawn(path.join(__dirname, 'Modules/DTAExecutionHost.exe'), [], { env: envVars });
            this.dtaPid = proc.pid;
            tl.debug('Modules/DTAExecutionHost.exe is executing with the process id : ' + this.dtaPid);
            proc.stdout.setEncoding('utf8');
            proc.stderr.setEncoding('utf8');
            proc.stdout.on('data', (c) => {
                // this is bit hacky way to fix the web method logging as it's not configurable currently
                // and writes info to stdout directly
                const lines = c.toString().split('\n');
                lines.forEach(function (line) {
                    if (line.length === 0) {
                        return;
                    }
                    if (line.startsWith('Web method')) {
                        console.log('##vso[task.debug]' + line);
                    }
                    else {
                        console.log(line);
                    }
                });
            });
            proc.stderr.on('data', (c) => {
                const lines = c.toString().split('\n');
                lines.forEach(function (line) {
                    console.error(line);
                });
            });
            proc.on('error', (err) => {
                this.dtaPid = -1;
                throw new Error('Failed to start Modules/DTAExecutionHost.exe.');
            });
            proc.on('close', (code) => {
                if (code !== 0) {
                    tl.debug('Modules/DTAExecutionHost.exe process exited with code ' + code);
                }
                else {
                    tl.debug('Modules/DTAExecutionHost.exe exited');
                }
                this.dtaPid = -1;
            });
        });
    }
    startDtaTestRun() {
        return __awaiter(this, void 0, void 0, function* () {
            const runDistributesTestTool = tl.tool(path.join(__dirname, 'modules/TestExecutionHost.exe'));
            const envVars = process.env;
            utils.Helper.addToProcessEnvVars(envVars, 'accesstoken', this.dtaTestConfig.dtaEnvironment.patToken);
            utils.Helper.addToProcessEnvVars(envVars, 'environmenturi', this.dtaTestConfig.dtaEnvironment.environmentUri);
            if (!utils.Helper.isNullOrUndefined(this.dtaTestConfig.sourceFilter)) {
                utils.Helper.addToProcessEnvVars(envVars, 'sourcefilter', this.dtaTestConfig.sourceFilter.join('|'));
            }
            else {
                // TODO : Is this fine? Or we will go for all files and remove this negation as well?
                utils.Helper.addToProcessEnvVars(envVars, 'sourcefilter', '!**\obj\**');
            }
            //Modify settings file to enable configurations and data collectors.
            let settingsFile = this.dtaTestConfig.settingsFile;
            try {
                settingsFile = yield settingsHelper.updateSettingsFileAsRequired(this.dtaTestConfig.settingsFile, this.dtaTestConfig.runInParallel, this.dtaTestConfig.tiaConfig, null, false, this.dtaTestConfig.overrideTestrunParameters, true);
                //Reset override option so that it becomes a no-op in TaskExecutionHost
                this.dtaTestConfig.overrideTestrunParameters = null;
            }
            catch (error) {
                tl.warning(tl.loc('ErrorWhileUpdatingSettings'));
                tl.debug(error);
            }
            utils.Helper.addToProcessEnvVars(envVars, 'testcasefilter', this.dtaTestConfig.testcaseFilter);
            utils.Helper.addToProcessEnvVars(envVars, 'runsettings', settingsFile);
            utils.Helper.addToProcessEnvVars(envVars, 'testdroplocation', this.dtaTestConfig.testDropLocation);
            utils.Helper.addToProcessEnvVars(envVars, 'testrunparams', this.dtaTestConfig.overrideTestrunParameters);
            utils.Helper.addToProcessEnvVars(envVars, 'buildconfig', this.dtaTestConfig.buildConfig);
            utils.Helper.addToProcessEnvVars(envVars, 'buildplatform', this.dtaTestConfig.buildPlatform);
            utils.Helper.addToProcessEnvVars(envVars, 'testconfigurationmapping', this.dtaTestConfig.testConfigurationMapping);
            utils.Helper.addToProcessEnvVars(envVars, 'testruntitle', this.dtaTestConfig.testRunTitle);
            utils.Helper.addToProcessEnvVars(envVars, 'testselection', this.dtaTestConfig.testSelection);
            utils.Helper.addToProcessEnvVars(envVars, 'tcmtestrun', this.dtaTestConfig.onDemandTestRunId);
            if (!utils.Helper.isNullOrUndefined(this.dtaTestConfig.testSuites)) {
                utils.Helper.addToProcessEnvVars(envVars, 'testsuites', this.dtaTestConfig.testSuites.join(','));
            }
            utils.Helper.setEnvironmentVariableToString(envVars, 'codecoverageenabled', this.dtaTestConfig.codeCoverageEnabled);
            utils.Helper.setEnvironmentVariableToString(envVars, 'testplan', this.dtaTestConfig.testplan);
            utils.Helper.setEnvironmentVariableToString(envVars, 'testplanconfigid', this.dtaTestConfig.testPlanConfigId);
            // In the phases world we will distribute based on number of agents
            utils.Helper.setEnvironmentVariableToString(envVars, 'customslicingenabled', 'true');
            utils.Helper.setEnvironmentVariableToString(envVars, 'maxagentphaseslicing', this.dtaTestConfig.numberOfAgentsInPhase.toString());
            yield runDistributesTestTool.exec({ cwd: path.join(__dirname, 'modules'), env: envVars });
            yield this.cleanUp(settingsFile);
            tl.debug('Run Distributed Test finished');
        });
    }
    cleanUp(temporarySettingsFile) {
        return __awaiter(this, void 0, void 0, function* () {
            //cleanup the runsettings file
            if (temporarySettingsFile && this.dtaTestConfig.settingsFile !== temporarySettingsFile) {
                try {
                    tl.rmRF(temporarySettingsFile);
                }
                catch (error) {
                }
            }
        });
    }
}
exports.DistributedTest = DistributedTest;
