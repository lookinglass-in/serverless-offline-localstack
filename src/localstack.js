'use strict';

const Promise = require('bluebird');
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

import AbstractBaseClass from './abstractBaseClass';

const configFilePath = 'node_modules/serverless-offline-localstack/serverlessOfflineLocalstack.json';

export default class Localstack extends AbstractBaseClass {

    constructor(serverless, options) {
        super(serverless, options);

        this.log('Configuring serverless offline -> localstack');

        this.config = serverless.service.custom && serverless.service.custom.serverlessOfflineLocalstack || {};
        super.setDebug(this.config.debug);
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
        const host = this.config.host;
        const region = this.config.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
        const accessKeyId = this.config.accessKeyId || process.env.AWS_ACCESS_KEY_ID || 'none';
        const secretAccessKey = this.config.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || 'none';

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

        // set additional required properties
        configChanges['region'] = region;
        configChanges['accessKeyId'] = accessKeyId;
        configChanges['secretAccessKey'] = secretAccessKey;

        this.debug('Final configuration: ' + JSON.stringify(configChanges));
        // configure the serverless aws sdk
        this.awsProvider.sdk.config.update(configChanges);
        this.writeConfigs(configChanges);
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

    static configureAWS(AWSp) {
        const contents = fs.readFileSync(configFilePath);
        let configChanges = JSON.parse(contents);
        AWSp.config.update(configChanges);
    }

    writeConfigs(configChanges) {
        fs.writeFile(configFilePath, JSON.stringify(configChanges), function (err) {
                if (err) {
                    throw err;
                }
            }
        );
    }
}