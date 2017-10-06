'use strict';

const Promise = require('bluebird');
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

import AbstractBaseClass from './abstractBaseClass';

export default class Localstack extends AbstractBaseClass {

    constructor(serverless, options) {
        super(serverless, options);

        this.log('Configuring serverless offline -> localstack');

        this.config = serverless.service.custom && serverless.service.custom.serverlessOfflineLocalstack || {};
        this.endpoints = this.config.endpoints || {};
        this.endpointFile = this.config.endpointFile;

        this.AWS_SERVICES = {
            'apigateway': 4567,
            'cloudformation': 4581,
            'cloudwatch': 4582,
            'lambda': 4574,
            'dynamodb': 4567,
            's3': 4572,
            'ses': 4579,
            'sns': 4575,
            'sqs': 4576
        };

        if (this.endpointFile) {
            this.loadEndpointsFromDisk(this.endpointFile);
        }

        // Intercept Provider requests
        this.awsProvider = serverless.getProvider('aws');
        this.awsProviderRequest = this.awsProvider.request.bind(this.awsProvider);
        this.awsProvider.request = this.interceptRequest.bind(this);
    }

    reconfigureAWS() {
        console.log('dlkdf')
        const host = this.config.host;
        let configChanges = {};

        // If a host has been configured, override each service
        if (host) {
            for (const service of Object.keys(this.AWS_SERVICES)) {
                const port = this.AWS_SERVICES[service];
                const url = `${host}:${port}`;

                this.debug(`Reconfiguring service ${service} to use ${url}`);
                configChanges[service.toLowerCase()] = {endpoint: url};
            }
        }

        // Override specific endpoints if specified
        if (this.endpoints) {
            for (const service of Object.keys(this.endpoints)) {
                const url = this.endpoints[service];

                this.debug(`Reconfiguring service ${service} to use ${url}`);
                configChanges[service.toLowerCase()] = {endpoint: url};
            }
        }

        this.awsProvider.sdk.config.update(configChanges);
        console.log(this.awsProvider.sdk.config)
    }

    loadEndpointsFromDisk(endpointFile) {
        let endpointJson;

        this.debug('Loading endpointJson from ' + endpointFile);

        try {
            endpointJson = JSON.parse(fs.readFileSync(endpointFile));
        } catch (err) {
            throw new ReferenceError(`Endpoint: "${this.endpointFile}" is invalid: ${err}`);
        }

        for (const key of Object.keys(endpointJson)) {
            this.debug('Intercepting service ' + key);
            this.endpoints[key] = endpointJson[key];
        }
    }

    interceptRequest(service, method, params) {
        // Template validation is not supported in LocalStack
        if (method === 'validateTemplate') {
            this.log('Skipping template validation: Unsupported in Localstack');
            return Promise.resolve('');
        }

        if (AWS.config[service]) {
            this.debug(`Using custom endpoint for ${service}: ${endpoint}`);

            if (AWS.config['s3'] && params.TemplateURL) {
                this.debug(`Overriding S3 templateUrl to ${AWS.config.s3.endpoint}`);
                params.TemplateURL = params.TemplateURL.replace(/https:\/\/s3.amazonaws.com/, AWS.config['s3']);
            }
        }

        return this.awsProviderRequest(service, method, params);
    }
}