"use strict";
const fs = require('fs');
const tl = require('vsts-task-lib/task');
const path = require('path');
const Q = require('q');
const os = require('os');
const str = require('string');
const uuid = require('uuid');
const xml2js = require('xml2js');
const parser = new xml2js.Parser();
const builder = new xml2js.Builder();
class Constants {
}
Constants.vsTestVersionString = 'version';
Constants.vsTestLocationString = 'location';
exports.Constants = Constants;
class Helper {
    static addToProcessEnvVars(envVars, name, value) {
        if (!this.isNullEmptyOrUndefined(value)) {
            envVars[name] = value;
        }
    }
    static setEnvironmentVariableToString(envVars, name, value) {
        if (!this.isNullEmptyOrUndefined(value)) {
            envVars[name] = value.toString();
        }
    }
    static isNullEmptyOrUndefined(obj) {
        return obj === null || obj === '' || obj === undefined;
    }
    static isNullOrUndefined(obj) {
        return obj === null || obj === '' || obj === undefined;
    }
    static isNullOrWhitespace(input) {
        if (typeof input === 'undefined' || input === null) {
            return true;
        }
        return input.replace(/\s/g, '').length < 1;
    }
    static trimString(input) {
        if (input) {
            return input.replace(/^(?=\n)$|^\s*|\s*$|\n\n+/gm, '');
        }
        return input;
    }
    static pathExistsAsFile(path) {
        return tl.exist(path) && tl.stats(path).isFile();
    }
    static pathExistsAsDirectory(path) {
        return tl.exist(path) && tl.stats(path).isDirectory();
    }
    static getXmlContents(filePath) {
        const defer = Q.defer();
        Helper.readFileContents(filePath, 'utf-8')
            .then(function (xmlContents) {
            parser.parseString(xmlContents, function (err, result) {
                if (err) {
                    defer.resolve(null);
                }
                else {
                    defer.resolve(result);
                }
            });
        })
            .fail(function (err) {
            defer.reject(err);
        });
        return defer.promise;
    }
    static saveToFile(fileContents, extension) {
        const defer = Q.defer();
        const tempFile = path.join(os.tmpdir(), uuid.v1() + extension);
        fs.writeFile(tempFile, fileContents, function (err) {
            if (err) {
                defer.reject(err);
            }
            tl.debug('Temporary file created at ' + tempFile);
            defer.resolve(tempFile);
        });
        return defer.promise;
    }
    static readFileContents(filePath, encoding) {
        const defer = Q.defer();
        fs.readFile(filePath, encoding, (err, data) => {
            if (err) {
                defer.reject(new Error('Could not read file (' + filePath + '): ' + err.message));
            }
            else {
                defer.resolve(data);
            }
        });
        return defer.promise;
    }
    static readFileContentsSync(filePath, encoding) {
        return fs.readFileSync(filePath, encoding);
    }
    static writeXmlFile(result, settingsFile, fileExt) {
        const defer = Q.defer();
        let runSettingsContent = builder.buildObject(result);
        runSettingsContent = str(runSettingsContent).replaceAll('&#xD;', '').s;
        //This is to fix carriage return any other special chars will not be replaced
        Helper.saveToFile(runSettingsContent, fileExt)
            .then(function (fileName) {
            defer.resolve(fileName);
            return defer.promise;
        })
            .fail(function (err) {
            defer.reject(err);
        });
        return defer.promise;
    }
    static getVSVersion(versionNum) {
        switch (versionNum) {
            case 12: return '2013';
            case 14: return '2015';
            case 15: return '2017';
            default: return 'selected';
        }
    }
    static printMultiLineLog(multiLineString, logFunction) {
        const lines = multiLineString.toString().split('\n');
        lines.forEach(function (line) {
            if (line.length === 0) {
                return;
            }
            logFunction(line);
        });
    }
    static modifyVsTestConsoleArgsForResponseFile(argument) {
        if (argument) {
            if (!argument.startsWith('/')) {
                return '\"' + argument + '\"';
            }
            else {
                // we need to add quotes to args we are passing after : as the arg value can have spaces
                // we dont need to changes the guy who is creating the args as toolrunner already takes care of this
                // for response file we need to take care of this ourselves
                // eg: /settings:c:\a b\1.settings should become /settings:"C:\a b\1.settings"
                let indexOfColon = argument.indexOf(':'); // find if args has ':'
                if (indexOfColon > 0 && argument[indexOfColon + 1] !== '\"') {
                    let modifyString = argument.substring(0, indexOfColon + 1); // get string till colon
                    modifyString = modifyString + '\"' + argument.substring(indexOfColon + 1) + '\"'; // append '"' and rest of the string
                    return modifyString;
                }
            }
        }
        return argument;
    }
}
exports.Helper = Helper;
