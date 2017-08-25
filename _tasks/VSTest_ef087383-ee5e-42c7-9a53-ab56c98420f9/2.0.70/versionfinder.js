"use strict";
const tl = require('vsts-task-lib/task');
const path = require('path');
const version = require('./vstestversion');
const utils = require('./helpers');
const ci = require('./cieventlogger');
const regedit = require('regedit');
const xml2js = require('xml2js');
function getVsTestRunnerDetails(testConfig) {
    const vstestexeLocation = locateVSTestConsole(testConfig);
    const vstestLocationEscaped = vstestexeLocation.replace(/\\/g, '\\\\');
    const wmicTool = tl.tool('wmic');
    const wmicArgs = ['datafile', 'where', 'name=\''.concat(vstestLocationEscaped, '\''), 'get', 'Version', '/Value'];
    wmicTool.arg(wmicArgs);
    const output = wmicTool.execSync();
    tl.debug('VSTest Version information: ' + output.stdout);
    const verSplitArray = output.stdout.split('=');
    if (verSplitArray.length !== 2) {
        tl.error(tl.loc('ErrorReadingVstestVersion'));
        throw new Error(tl.loc('ErrorReadingVstestVersion'));
    }
    const versionArray = verSplitArray[1].split('.');
    if (versionArray.length !== 4) {
        tl.warning(tl.loc('UnexpectedVersionString', output.stdout));
        throw new Error(tl.loc('UnexpectedVersionString', output.stdout));
    }
    const majorVersion = parseInt(versionArray[0]);
    const minorVersion = parseInt(versionArray[1]);
    const patchNumber = parseInt(versionArray[2]);
    ci.publishEvent({ testplatform: `${majorVersion}.${minorVersion}.${patchNumber}` });
    if (isNaN(majorVersion) || isNaN(minorVersion) || isNaN(patchNumber)) {
        tl.warning(tl.loc('UnexpectedVersionNumber', verSplitArray[1]));
        throw new Error(tl.loc('UnexpectedVersionNumber', verSplitArray[1]));
    }
    switch (majorVersion) {
        case 14:
            testConfig.vsTestVersionDetais = new version.Dev14VSTestVersion(vstestexeLocation, minorVersion, patchNumber);
            break;
        case 15:
            testConfig.vsTestVersionDetais = new version.Dev15VSTestVersion(vstestexeLocation, minorVersion, patchNumber);
            break;
        default:
            testConfig.vsTestVersionDetais = new version.VSTestVersion(vstestexeLocation, majorVersion, minorVersion, patchNumber);
            break;
    }
}
exports.getVsTestRunnerDetails = getVsTestRunnerDetails;
function locateVSTestConsole(testConfig) {
    const vstestExeFolder = locateTestWindow(testConfig);
    let vstestExePath = vstestExeFolder;
    if (vstestExeFolder) {
        vstestExePath = path.join(vstestExeFolder, 'vstest.console.exe');
    }
    return vstestExePath;
}
function locateTestWindow(testConfig) {
    if (testConfig.vsTestLocationMethod === utils.Constants.vsTestLocationString) {
        if (utils.Helper.pathExistsAsFile(testConfig.vsTestLocation)) {
            return path.join(testConfig.vsTestLocation, '..');
        }
        if (utils.Helper.pathExistsAsDirectory(testConfig.vsTestLocation) &&
            utils.Helper.pathExistsAsFile(path.join(testConfig.vsTestLocation, 'vstest.console.exe'))) {
            return testConfig.vsTestLocation;
        }
        throw (new Error(tl.loc('VstestLocationDoesNotExist', testConfig.vsTestLocation)));
    }
    if (testConfig.vsTestVersion.toLowerCase() === 'latest') {
        // latest
        tl.debug('Searching for latest Visual Studio');
        const vstestconsole15Path = getVSTestConsole15Path();
        if (vstestconsole15Path) {
            testConfig.vsTestVersion = "15.0";
            return vstestconsole15Path;
        }
        // fallback
        tl.debug('Unable to find an instance of Visual Studio 2017..');
        tl.debug('Searching for Visual Studio 2015..');
        testConfig.vsTestVersion = "14.0";
        return getVSTestLocation(14);
    }
    const vsVersion = parseFloat(testConfig.vsTestVersion);
    if (vsVersion === 15.0) {
        const vstestconsole15Path = getVSTestConsole15Path();
        if (vstestconsole15Path) {
            return vstestconsole15Path;
        }
        throw (new Error(tl.loc('VstestNotFound', utils.Helper.getVSVersion(vsVersion))));
    }
    tl.debug('Searching for Visual Studio ' + vsVersion.toString());
    return getVSTestLocation(vsVersion);
}
function getVSTestConsole15Path() {
    const vswhereTool = tl.tool(path.join(__dirname, 'vswhere.exe'));
    vswhereTool.line('-version [15.0,16.0) -latest -products * -requires Microsoft.VisualStudio.PackageGroup.TestTools.Core -property installationPath');
    let vsPath = vswhereTool.execSync().stdout;
    tl.debug('Visual Studio 15.0 or higher installed path: ' + vsPath);
    vsPath = utils.Helper.trimString(vsPath);
    if (!utils.Helper.isNullOrWhitespace(vsPath)) {
        return path.join(vsPath, 'Common7', 'IDE', 'CommonExtensions', 'Microsoft', 'TestWindow');
    }
    return null;
}
function getVSTestLocation(vsVersion) {
    const vsCommon = tl.getVariable('VS' + vsVersion + '0COMNTools');
    if (!vsCommon) {
        throw (new Error(tl.loc('VstestNotFound', utils.Helper.getVSVersion(vsVersion))));
    }
    return path.join(vsCommon, '..\\IDE\\CommonExtensions\\Microsoft\\TestWindow');
}
function getFloatsFromStringArray(inputArray) {
    const outputArray = [];
    let count;
    if (inputArray) {
        for (count = 0; count < inputArray.length; count++) {
            const floatValue = parseFloat(inputArray[count]);
            if (!isNaN(floatValue)) {
                outputArray.push(floatValue);
            }
        }
    }
    return outputArray;
}
