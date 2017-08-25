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
const webapim = require('vso-node-api/WebApi');
class TestAgent {
    static createAgent(environment, retries) {
        return __awaiter(this, void 0, void 0, function* () {
            var currentRetryCount = retries;
            while (currentRetryCount > 0) {
                currentRetryCount--;
                try {
                    const envUrlRef = { Url: environment.environmentUri };
                    const machineNameRef = { Name: environment.agentName };
                    // TODO : Change any to appropriate types once promiseme package is avialable
                    const testAgent = {
                        Name: environment.agentName,
                        Capabilities: [],
                        DtlEnvironment: envUrlRef,
                        DtlMachine: machineNameRef };
                    const webapi = new webapim.WebApi(environment.tfsCollectionUrl, webapim.getBearerHandler(environment.patToken));
                    const testApi = webapi.getTestApi();
                    const registeredAgent = yield testApi.createAgent(testAgent);
                    tl.debug('created the test agent entry in DTA service, id : ' + registeredAgent.id);
                    return registeredAgent.id;
                }
                catch (error) {
                    tl.error('Error : created the test agent entry in DTA service, so retrying => retries pending  : ' + currentRetryCount
                        + 'error details :' + error);
                    if (currentRetryCount === 0) {
                        throw new Error(tl.loc("configureDtaAgentFailed", retries, error));
                    }
                }
            }
        });
    }
}
exports.TestAgent = TestAgent;
