"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const tl = require('vsts-task-lib/task');
const path = require('path');
var azureRESTUtility = require('webdeployment-common/azurerestutility.js');
var msDeployUtility = require('webdeployment-common/msdeployutility.js');
var zipUtility = require('webdeployment-common/ziputility.js');
var utility = require('webdeployment-common/utility.js');
var msDeploy = require('webdeployment-common/deployusingmsdeploy.js');
var jsonSubstitutionUtility = require('webdeployment-common/jsonvariablesubstitutionutility.js');
var xmlSubstitutionUtility = require('webdeployment-common/xmlvariablesubstitutionutility.js');
var xdtTransformationUtility = require('webdeployment-common/xdttransformationutility.js');
var kuduUtility = require('webdeployment-common/kuduutility.js');
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            tl.setResourcePath(path.join(__dirname, 'task.json'));
            var connectedServiceName = tl.getInput('ConnectedServiceName', true);
            var webAppName = tl.getInput('WebAppName', true);
            var deployToSlotFlag = tl.getBoolInput('DeployToSlotFlag', false);
            var resourceGroupName = tl.getInput('ResourceGroupName', false);
            var slotName = tl.getInput('SlotName', false);
            var webDeployPkg = tl.getPathInput('Package', true);
            var virtualApplication = tl.getInput('VirtualApplication', false);
            var useWebDeploy = tl.getBoolInput('UseWebDeploy', false);
            var setParametersFile = tl.getPathInput('SetParametersFile', false);
            var removeAdditionalFilesFlag = tl.getBoolInput('RemoveAdditionalFilesFlag', false);
            var excludeFilesFromAppDataFlag = tl.getBoolInput('ExcludeFilesFromAppDataFlag', false);
            var takeAppOfflineFlag = tl.getBoolInput('TakeAppOfflineFlag', false);
            var additionalArguments = tl.getInput('AdditionalArguments', false);
            var webAppUri = tl.getInput('WebAppUri', false);
            var xmlTransformsAndVariableSubstitutions = tl.getBoolInput('XmlTransformsAndVariableSubstitutions', false);
            var xmlTransformation = tl.getBoolInput('XdtTransformation', false);
            var jsonVariableSubsFlag = tl.getBoolInput('JSONVariableSubstitutionsFlag', false);
            var jsonVariableSubsFiles = tl.getDelimitedInput('JSONVariableSubstitutions', '\n', false);
            var variableSubstitution = tl.getBoolInput('VariableSubstitution', false);
            var endPointAuthCreds = tl.getEndpointAuthorization(connectedServiceName, true);
            var endPoint = new Array();
            endPoint["servicePrincipalClientID"] = tl.getEndpointAuthorizationParameter(connectedServiceName, "serviceprincipalid", true);
            endPoint["servicePrincipalKey"] = tl.getEndpointAuthorizationParameter(connectedServiceName, "serviceprincipalkey", true);
            endPoint["tenantID"] = tl.getEndpointAuthorizationParameter(connectedServiceName, "tenantid", true);
            endPoint["subscriptionId"] = tl.getEndpointDataParameter(connectedServiceName, 'subscriptionid', true);
            endPoint["url"] = tl.getEndpointUrl(connectedServiceName, true);
            var availableWebPackages = utility.findfiles(webDeployPkg);
            if (availableWebPackages.length == 0) {
                throw new Error(tl.loc('Nopackagefoundwithspecifiedpattern'));
            }
            if (availableWebPackages.length > 1) {
                throw new Error(tl.loc('MorethanonepackagematchedwithspecifiedpatternPleaserestrainthesearchpatern'));
            }
            webDeployPkg = availableWebPackages[0];
            var isFolderBasedDeployment = utility.isInputPkgIsFolder(webDeployPkg);
            var publishingProfile = yield azureRESTUtility.getAzureRMWebAppPublishProfile(endPoint, webAppName, resourceGroupName, deployToSlotFlag, slotName);
            tl._writeLine(tl.loc('GotconnectiondetailsforazureRMWebApp0', webAppName));
            if (jsonVariableSubsFlag || (xmlTransformsAndVariableSubstitutions && (xmlTransformation || variableSubstitution))) {
                var folderPath = path.join(tl.getVariable('System.DefaultWorkingDirectory'), 'temp_web_package_folder');
                if (isFolderBasedDeployment) {
                    tl.cp(path.join(webDeployPkg, '/*'), folderPath, '-rf', false);
                }
                else {
                    yield zipUtility.unzip(webDeployPkg, folderPath);
                }
                if (xmlTransformation) {
                    var environmentName = tl.getVariable('Release.EnvironmentName');
                    if (tl.osType().match(/^Win/)) {
                        var transformConfigs = ["Release.config"];
                        if (environmentName) {
                            transformConfigs.push(environmentName + ".config");
                        }
                        xdtTransformationUtility.basicXdtTransformation(path.join(folderPath, '**', '*.config'), transformConfigs);
                        tl._writeLine("XDT Transformations applied successfully");
                    }
                    else {
                        throw new Error(tl.loc("CannotPerformXdtTransformationOnNonWindowsPlatform"));
                    }
                }
                if (variableSubstitution) {
                    yield xmlSubstitutionUtility.substituteAppSettingsVariables(folderPath);
                }
                if (jsonVariableSubsFlag) {
                    jsonSubstitutionUtility.jsonVariableSubstitution(folderPath, jsonVariableSubsFiles);
                }
                webDeployPkg = (isFolderBasedDeployment) ? folderPath : yield zipUtility.archiveFolder(folderPath, tl.getVariable('System.DefaultWorkingDirectory'), 'temp_web_package.zip');
            }
            if (virtualApplication) {
                publishingProfile.destinationAppUrl += "/" + virtualApplication;
            }
            if (webAppUri) {
                tl.setVariable(webAppUri, publishingProfile.destinationAppUrl);
            }
            if (utility.canUseWebDeploy(useWebDeploy)) {
                if (!tl.osType().match(/^Win/)) {
                    throw Error(tl.loc("PublishusingwebdeployoptionsaresupportedonlywhenusingWindowsagent"));
                }
                tl._writeLine("##vso[task.setvariable variable=websiteUserName;issecret=true;]" + publishingProfile.userName);
                tl._writeLine("##vso[task.setvariable variable=websitePassword;issecret=true;]" + publishingProfile.userPWD);
                yield msDeploy.DeployUsingMSDeploy(webDeployPkg, webAppName, publishingProfile, removeAdditionalFilesFlag, excludeFilesFromAppDataFlag, takeAppOfflineFlag, virtualApplication, setParametersFile, additionalArguments, isFolderBasedDeployment, useWebDeploy);
            }
            else {
                tl.debug(tl.loc("Initiateddeploymentviakuduserviceforwebapppackage", webDeployPkg));
                var azureWebAppDetails = yield azureRESTUtility.getAzureRMWebAppConfigDetails(endPoint, webAppName, resourceGroupName, deployToSlotFlag, slotName);
                yield DeployUsingKuduDeploy(webDeployPkg, azureWebAppDetails, publishingProfile, virtualApplication, isFolderBasedDeployment, takeAppOfflineFlag);
            }
        }
        catch (error) {
            tl.setResult(tl.TaskResult.Failed, error);
        }
    });
}
/**
 * Deploys website using Kudu REST API
 *
 * @param   webDeployPkg                   Web deploy package
 * @param   webAppName                     Web App Name
 * @param   publishingProfile              Azure RM Connection Details
 * @param   virtualApplication             Virtual Application Name
 * @param   isFolderBasedDeployment        Input is folder or not
 *
 */
function DeployUsingKuduDeploy(webDeployPkg, azureWebAppDetails, publishingProfile, virtualApplication, isFolderBasedDeployment, takeAppOfflineFlag) {
    return __awaiter(this, void 0, void 0, function* () {
        var isDeploymentSuccess = true;
        var deploymentError = null;
        try {
            var virtualApplicationMappings = azureWebAppDetails.properties.virtualApplications;
            var webAppZipFile = webDeployPkg;
            if (isFolderBasedDeployment) {
                webAppZipFile = yield zipUtility.archiveFolder(webDeployPkg, tl.getVariable('System.DefaultWorkingDirectory'), 'temp_web_app_package.zip');
                tl.debug(tl.loc("Compressedfolderintozip", webDeployPkg, webAppZipFile));
            }
            else {
                if (yield kuduUtility.containsParamFile(webAppZipFile)) {
                    throw new Error(tl.loc("MSDeploygeneratedpackageareonlysupportedforWindowsplatform"));
                }
            }
            var pathMappings = kuduUtility.getVirtualAndPhysicalPaths(virtualApplication, virtualApplicationMappings);
            yield kuduUtility.deployWebAppPackage(webAppZipFile, publishingProfile, pathMappings[0], pathMappings[1], takeAppOfflineFlag);
            tl._writeLine(tl.loc('WebappsuccessfullypublishedatUrl0', publishingProfile.destinationAppUrl));
        }
        catch (error) {
            tl.error(tl.loc('Failedtodeploywebsite'));
            isDeploymentSuccess = false;
            deploymentError = error;
        }
        try {
            tl._writeLine(yield azureRESTUtility.updateDeploymentStatus(publishingProfile, isDeploymentSuccess));
        }
        catch (error) {
            tl.warning(error);
        }
        if (!isDeploymentSuccess) {
            throw Error(deploymentError);
        }
    });
}
run();
