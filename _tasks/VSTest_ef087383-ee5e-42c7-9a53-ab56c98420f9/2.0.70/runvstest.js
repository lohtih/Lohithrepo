"use strict";
const tl = require('vsts-task-lib/task');
const taskInputParser = require('./taskinputparser');
const localTest = require('./vstest');
const path = require('path');
const distributedTest = require('./distributedtest');
const ci = require('./cieventlogger');
//Starting the VsTest execution
const taskProps = { state: 'started', result: '' };
ci.publishEvent(taskProps);
try {
    tl.setResourcePath(path.join(__dirname, 'task.json'));
    const parallelExecution = tl.getVariable('System.ParallelExecutionType');
    tl.debug('Value of ParallelExecutionType :' + parallelExecution);
    const testType = tl.getInput('testSelector');
    tl.debug('Value of Test Selector :' + testType);
    if ((parallelExecution && parallelExecution.toLowerCase() === 'multimachine')
        || testType.toLowerCase() === 'testplan' || testType.toLowerCase() === 'testrun') {
        console.log(tl.loc('distributedTestWorkflow'));
        console.log('======================================================');
        const dtaTestConfig = taskInputParser.getDistributedTestConfigurations();
        console.log('======================================================');
        ci.publishEvent({ runmode: 'distributedtest', parallelism: parallelExecution, testtype: testType });
        const test = new distributedTest.DistributedTest(dtaTestConfig);
        test.runDistributedTest();
    }
    else {
        ci.publishEvent({ runmode: 'vstest' });
        localTest.startTest();
    }
}
catch (error) {
    tl.setResult(tl.TaskResult.Failed, error);
    taskProps.result = error;
}
finally {
    taskProps.state = 'completed';
    ci.publishEvent(taskProps);
}
