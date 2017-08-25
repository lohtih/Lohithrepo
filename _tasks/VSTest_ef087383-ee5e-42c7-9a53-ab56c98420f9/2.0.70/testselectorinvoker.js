"use strict";
const tl = require('vsts-task-lib/task');
const path = require('path');
let perf = require('performance-now');
class TestSelectorInvoker {
    publishCodeChanges(tiaConfig, testCaseFilterFile) {
        tl.debug('Entered publish code changes');
        const startTime = perf();
        let endTime;
        let elapsedTime;
        let pathFilters;
        let definitionRunId;
        let definitionId;
        let prFlow;
        let rebaseLimit;
        let sourcesDirectory;
        let newprovider = 'true';
        if (this.getTIALevel(tiaConfig) === 'method') {
            newprovider = 'false';
        }
        const selectortool = tl.tool(this.getTestSelectorLocation());
        selectortool.arg('PublishCodeChanges');
        if (tiaConfig.context === 'CD') {
            // Release context. Passing Release Id.
            definitionRunId = tl.getVariable('Release.ReleaseId');
            definitionId = tl.getVariable('release.DefinitionId');
        }
        else {
            // Build context. Passing build id.
            definitionRunId = tl.getVariable('Build.BuildId');
            definitionId = tl.getVariable('System.DefinitionId');
        }
        if (tiaConfig.isPrFlow && tiaConfig.isPrFlow.toUpperCase() === 'TRUE') {
            prFlow = 'true';
        }
        else {
            prFlow = 'false';
        }
        if (tiaConfig.tiaRebaseLimit) {
            rebaseLimit = tiaConfig.tiaRebaseLimit;
        }
        if (typeof tiaConfig.tiaFilterPaths !== 'undefined') {
            pathFilters = tiaConfig.tiaFilterPaths.trim();
        }
        else {
            pathFilters = '';
        }
        if (typeof tiaConfig.sourcesDir !== 'undefined') {
            sourcesDirectory = tiaConfig.sourcesDir.trim();
        }
        else {
            sourcesDirectory = '';
        }
        let output = selectortool.execSync({
            cwd: null,
            env: {
                'collectionurl': tl.getVariable('System.TeamFoundationCollectionUri'),
                'projectid': tl.getVariable('System.TeamProject'),
                'definitionrunid': definitionRunId,
                'definitionid': definitionId,
                'token': tl.getEndpointAuthorizationParameter('SystemVssConnection', 'AccessToken', false),
                'sourcesdir': sourcesDirectory,
                'newprovider': newprovider,
                'prflow': prFlow,
                'rebaselimit': rebaseLimit,
                'baselinefile': tiaConfig.baseLineBuildIdFile,
                'context': tiaConfig.context,
                'filter': pathFilters,
                'userMapFile': tiaConfig.userMapFile ? tiaConfig.userMapFile : '',
                'testCaseFilterResponseFile': testCaseFilterFile ? testCaseFilterFile : ''
            },
            silent: null,
            outStream: null,
            errStream: null,
            windowsVerbatimArguments: null
        });
        endTime = perf();
        elapsedTime = endTime - startTime;
        tl.debug(tl.loc('PublishCodeChangesPerfTime', elapsedTime));
        if (output.code !== 0) {
            tl.warning(output.stderr);
        }
        tl.debug('completed publish code changes');
        return output.code;
    }
    getTIALevel(tiaConfig) {
        if (tiaConfig.fileLevel && tiaConfig.fileLevel.toUpperCase() === 'FALSE') {
            return 'method';
        }
        return 'file';
    }
    getTestSelectorLocation() {
        return path.join(__dirname, 'TestSelector/TestSelector.exe');
    }
}
exports.TestSelectorInvoker = TestSelectorInvoker;
