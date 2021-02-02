import React, { Component, PropTypes } from 'react';
import {
    supportedInputTypesMapping,
    i18nTranslator,
    ParameterService,
    ParametersRender,
    ParameterApi as parameterApi,
    StringUtil,
    logging,
} from '@jenkins-cd/blueocean-core-js';
import { Alerts } from '@jenkins-cd/design-language';

/**
 * Simple helper to stop stopPropagation
 * @param event the event we want to cancel
 */
const stopProp = event => {
    event.stopPropagation();
};

/**
 * Translate function
 */
const translate = i18nTranslator('blueocean-dashboard');
const logger = logging.logger('io.jenkins.blueocean.dashboard.InputStep');

/**
 * Creating a "<form/>"less form to submit the input parameters requested by the user in pipeline.
 *
 * We keep all form data in state and change them onChange and onToggle (depending of the parameter
 * type). We match the different supported inputTypes with a mapping functions
 * @see supportedInputTypesMapping
 * That mapping delegates to the specific implementation where we further delegate to JDL components.
 * In case you want to register a new mapping you need to edit './parameter/index' to add a new mapping
 * and further in './parameter/commonProptypes' you need to include the new type in the oneOf array.
 */
export default class InputStep extends Component {
    constructor(props) {
        super(props);
        this.parameterService = new ParameterService();
        this.parameterService.init(this.props.step.input.parameters);
    }
    // we start with an empty state
    state = {};
    /**
     * react life cycle mapper to invoke the creation of the form state
     */
    componentWillMount() {
        this.createFormState(this.props);
    }

    /**
     * Create a replica of the input parameters in state. Basically we just dump the whole item.
     * @param props
     */
    createFormState(props) {
        const { step } = props;
        // console.log({ step });
        if (step) {
            const { config = {} } = this.context;
            const {
                input: { id },
                _links: {
                    self: { href },
                },
            } = step;
            this.setState({
                id,
                href: `${config._rootURL}${href}`,
                visible: false,
            });
        }
    }

    /**
     * Submit the form as "cancel" out of the state data id.
     */
    cancelForm() {
        const { href, id } = this.state;
        parameterApi.cancelInputParameter(href, id);
    }

    /**
     * Submit the form as "ok" out of the state data parameters and id.
     */
    okForm() {
        const { href, id } = this.state;
        const parameters = this.parameterService.parametersToSubmitArray();

        parameterApi.submitInputParameter(href, id, parameters).catch(error => {
            if (error.responseBody && error.responseBody.message) {
                this.setState({
                    responseErrorMsg: error.responseBody.message,
                });
            } else if (error) {
                this.setState({
                    responseErrorMsg: error.message,
                });
            }
        });
    }

    render() {
        const { parameters } = this.parameterService;
        const { classicInputUrl } = this.props;

        // Early out
        if (!parameters) {
            return null;
        }

        const sanity = parameters.filter(parameter => supportedInputTypesMapping[parameter.type] !== undefined);
        logger.debug('sanity check', sanity.length, parameters.length, classicInputUrl);
        if (sanity.length !== parameters.length) {
            logger.debug('sanity check failed. Returning Alert instead of the form.');

            const alertCaption = [
                <p>{translate('inputStep.error.message')}</p>,
                <a href={classicInputUrl} target="_blank">
                    {translate('inputStep.error.linktext')}
                </a>,
            ];

            const alertTitle = translate('inputStep.error.title', { defaultValue: 'Error' });
            return (
                <div className="inputStep">
                    <Alerts message={alertCaption} type="Error" title={alertTitle} />
                </div>
            );
        }
        const {
            input: { message, ok },
        } = this.props.step;
        const cancelCaption = translate('rundetail.input.cancel', { defaultValue: 'Cancel' });
        const cancelButton = (
            <button title={cancelCaption} onClick={() => this.cancelForm()} className="btn btn-secondary inputStepCancel">
                <span className="button-label">{cancelCaption}</span>
            </button>
        );

        return (
            <div className="inputStep">
                <div className="inputBody">
                    <h3>{StringUtil.removeMarkupTags(message)}</h3>
                    <ParametersRender parameters={parameters} onChange={(index, newValue) => this.parameterService.changeParameter(index, newValue)} />
                    <div onClick={event => stopProp(event)} className="inputControl">
                        <button title={ok} onClick={() => this.okForm()} className="btn inputStepSubmit">
                            <span className="button-label">{ok}</span>
                        </button>
                        {cancelButton}
                    </div>
                    {this.state.responseErrorMsg && <div className="errorContainer">{this.state.responseErrorMsg}</div>}
                </div>
            </div>
        );
    }
}

const { object, shape, string } = PropTypes;

InputStep.propTypes = {
    step: shape().isRequired,
    classicInputUrl: string,
};

InputStep.contextTypes = {
    config: object.isRequired,
};
