"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const os = require('os');
const path = require('path');
var process = require('process');
const tl = require('vsts-task-lib/task');
const tr = require('vsts-task-lib/toolrunner');
// used for escaping the path to the Invoke-Robocopy.ps1 script that is passed to the powershell command
let pathToScriptPSString = (filePath) => {
    // remove double quotes
    let result = filePath.replace(/"/g, '');
    // double-up single quotes and enclose in single quotes. this is to create a single-quoted string in powershell.
    result = result.replace(/'/g, "''");
    return `'${result}'`;
};
// used for escaping file paths that are ultimately passed to robocopy (via the powershell command)
let pathToRobocopyPSString = (filePath) => {
    // the path needs to be fixed-up due to a robocopy quirk handling trailing backslashes.
    //
    // according to http://ss64.com/nt/robocopy.html:
    //   If either the source or desination are a "quoted long foldername" do not include a
    //   trailing backslash as this will be treated as an escape character, i.e. "C:\some path\"
    //   will fail but "C:\some path\\" or "C:\some path\." or "C:\some path" will work.
    //
    // furthermore, PowerShell implicitly double-quotes arguments to external commands when the
    // argument contains unquoted spaces.
    //
    // note, details on PowerShell quoting rules for external commands can be found in the
    // source code here:
    // https://github.com/PowerShell/PowerShell/blob/v0.6.0/src/System.Management.Automation/engine/NativeCommandParameterBinder.cs
    // remove double quotes
    let result = filePath.replace(/"/g, '');
    // append a "." if the path ends with a backslash. e.g. "C:\some path\" -> "C:\some path\."
    if (result.endsWith('\\')) {
        result += '.';
    }
    // double-up single quotes and enclose in single quotes. this is to create a single-quoted string in powershell.
    result = result.replace(/'/g, "''");
    return `'${result}'`;
};
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            tl.setResourcePath(path.join(__dirname, 'task.json'));
            // PathtoPublish is a folder that contains the files
            let pathtoPublish = tl.getPathInput('PathtoPublish', true, true);
            let artifactName = tl.getInput('ArtifactName', true);
            let artifactType = tl.getInput('ArtifactType', true);
            let hostType = tl.getVariable('system.hostType');
            if ((hostType && hostType.toUpperCase() != 'BUILD') && (artifactType.toUpperCase() !== "FILEPATH")) {
                tl.setResult(tl.TaskResult.Failed, tl.loc('ErrorHostTypeNotSupported'));
                return;
            }
            artifactType = artifactType.toLowerCase();
            let data = {
                artifacttype: artifactType,
                artifactname: artifactName
            };
            // upload or copy
            if (artifactType === "container") {
                data["containerfolder"] = artifactName;
                // add localpath to ##vso command's properties for back compat of old Xplat agent
                data["localpath"] = pathtoPublish;
                tl.command("artifact.upload", data, pathtoPublish);
            }
            else if (artifactType === "filepath") {
                let targetPath = tl.getInput('TargetPath', true);
                let artifactPath = path.join(targetPath, artifactName);
                data['artifactlocation'] = targetPath; // artifactlocation for back compat with old xplat agent
                if (os.platform() == 'win32') {
                    tl.mkdirP(artifactPath);
                    // create the artifact. at this point, mkdirP already succeeded so the path is good.
                    // the artifact should get cleaned up during retention even if the copy fails in the
                    // middle
                    tl.command("artifact.associate", data, targetPath);
                    let parallel = tl.getBoolInput('Parallel', false);
                    let parallelCount = 1;
                    if (parallel) {
                        parallelCount = getParallelCount();
                    }
                    // copy the files
                    let script = path.join(__dirname, 'Invoke-Robocopy.ps1');
                    let command = `& ${pathToScriptPSString(script)} -Source ${pathToRobocopyPSString(pathtoPublish)} -Target ${pathToRobocopyPSString(artifactPath)} -ParallelCount ${parallelCount}`;
                    let powershell = new tr.ToolRunner('powershell.exe');
                    powershell.arg('-NoLogo');
                    powershell.arg('-Sta');
                    powershell.arg('-NoProfile');
                    powershell.arg('-NonInteractive');
                    powershell.arg('-ExecutionPolicy');
                    powershell.arg('Unrestricted');
                    powershell.arg('-Command');
                    powershell.arg(command);
                    powershell.on('stdout', (buffer) => {
                        process.stdout.write(buffer);
                    });
                    powershell.on('stderr', (buffer) => {
                        process.stderr.write(buffer);
                    });
                    let execOptions = { silent: true };
                    yield powershell.exec(execOptions);
                }
                else {
                    // file share artifacts are not currently supported on OSX/Linux.
                    tl.setResult(tl.TaskResult.Failed, tl.loc('ErrorFileShareLinux'));
                    return;
                }
            }
        }
        catch (err) {
            tl.setResult(tl.TaskResult.Failed, tl.loc('PublishBuildArtifactsFailed', err.message));
        }
    });
}
function getParallelCount() {
    let result = 8;
    let inputValue = tl.getInput('ParallelCount', false);
    if (Number.isNaN(Number(inputValue))) {
        tl.warning(tl.loc('UnexpectedParallelCount', inputValue));
    }
    else {
        let parsedInput = parseInt(inputValue);
        if (parsedInput < 1) {
            tl.warning(tl.loc('UnexpectedParallelCount', parsedInput));
            result = 1;
        }
        else if (parsedInput > 128) {
            tl.warning(tl.loc('UnexpectedParallelCount', parsedInput));
            result = 128;
        }
        else {
            result = parsedInput;
        }
    }
    return result;
}
run();
