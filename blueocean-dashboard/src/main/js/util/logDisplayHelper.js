import keymirror from 'keymirror';
import { capable } from '@jenkins-cd/blueocean-core-js';

export const RESULTS = keymirror({
    UNKNOWN: null,
    SUCCESS: null,
    FAILURE: null,
});

export const STATES = keymirror({
    RUNNING: null,
    PAUSED: null,
    FINISHED: null,
});

function isRunningNode(item) {
    return item.state === STATES.RUNNING || item.state === STATES.PAUSED;
}

export const getNodesInformation = nodes => {
    // calculation of information about stages
    // nodes in Running state
    const runningNodes = nodes.filter(item => isRunningNode(item) && (!item.edges || item.edges.length < 2)).map(item => item.id);
    // nodes with error result
    const errorNodes = nodes.filter(item => item.result === RESULTS.FAILURE).map(item => item.id);
    const queuedNodes = nodes.filter(item => item.state === null && item.result === null).map(item => item.id);
    // nodes without information
    const hasResultsForSteps = nodes.filter(item => item.state === null && item.result === null).length !== nodes.length;
    // principal model mapper
    let wasFocused = false; // we only want one node to be focused if any
    let parent;
    // a job that is in queue would be marked as finished since
    // there will be no running nodes yet, that is why we check for that
    const finished = runningNodes.length === 0 && queuedNodes.length !== nodes.length;
    const error = !(errorNodes.length === 0);
    const model = nodes.map((item, index) => {
        const hasFailingNode = item.edges && item.edges.length >= 2 ? item.edges.filter(itemError => errorNodes.indexOf(itemError.id) > -1).length > 0 : false;
        const isFailingNode = errorNodes.indexOf(item.id) > -1;
        const isRunning = runningNodes.indexOf(item.id) > -1;

        const isParallel = item.type === 'PARALLEL';

        const logActions = item.actions ? item.actions.filter(action => capable(action, 'org.jenkinsci.plugins.workflow.actions.LogAction')) : [];
        const hasLogs = logActions.length > 0;
        const isCompleted = item.result !== 'UNKNOWN' && item.result !== null;
        const computedResult = isCompleted ? item.result : item.state;
        const isInputStep = item.input && item.input !== null;
        const key = index + isRunning + computedResult;
        const title = item.displayDescription ? item.displayName + ': ' + item.displayDescription : item.displayName;
        const modelItem = {
            actions: item.actions,
            _links: item._links,
            key: key || undefined,
            id: item.id,
            edges: item.edges,
            type: item.type,
            displayName: item.displayName,
            displayDescription: item.displayDescription,
            title: title || `runId: ${item.id}`,
            durationInMillis: item.durationInMillis || undefined,
            startTime: item.startTime || undefined,
            result: item.result || undefined,
            state: item.state || undefined,
            restartable: item.restartable,
            hasLogs,
            logUrl: hasLogs ? logActions[0]._links.self.href : undefined,
            isParallel,
            parent,
            firstParent: item.firstParent || undefined,
            isRunning,
            isCompleted,
            computedResult,
            isInputStep,
        };
        // do not set the parent node in parallel, since we already have this information
        if (!isParallel) {
            parent = item.id;
        }
        if (item.type === 'WorkflowRun') {
            modelItem.estimatedDurationInMillis = item.estimatedDurationInMillis;
            modelItem.isMultiBranch = true;
        }
        if ((isRunning || (isFailingNode && !hasFailingNode && finished)) && !wasFocused) {
            wasFocused = true;
            modelItem.isFocused = true;
        }
        if (isInputStep) {
            modelItem.input = item.input;
        }
        return modelItem;
    });
    // in case we have all null we will focus the first node since we assume that this would
    // be the next node to be started
    if (queuedNodes.length === nodes.length && !wasFocused && model[0]) {
        model[0].isFocused = true;
    }
    // creating the response object
    const information = {
        isFinished: finished,
        hasResultsForSteps,
        model,
    };
    // on not finished we return null and not a bool since we do not know the result yet
    if (!finished) {
        information.isError = null;
    } else {
        information.isError = error;
    }
    if (!finished) {
        information.runningNodes = runningNodes;
    } else if (error) {
        information.errorNodes = errorNodes;
    }
    return information;
};
