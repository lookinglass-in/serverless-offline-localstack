'use strict';

import * as Promise from "bluebird";

import Localstack from "./localstack";

class ServerlessOfflineLocalstackPlugin {

    constructor(serverless, options) {
        this.serverless = serverless;
        this.options = options;

        this.localstack = new Localstack(serverless, options);

        this.commands = {
            deploy: {}
        };

        this.hooks = {
            'before:invoke:local:invoke': () => Promise.bind(this.localstack)
                .then(this.localstack.reconfigureAWS),
            'webpack:invoke:invoke': () => Promise.bind(this.localstack)
                .then(this.localstack.reconfigureAWS),
            'webpack:compile': () => Promise.bind(this.localstack)
                .then(this.localstack.reconfigureAWS),
            'before:offline:start': () => Promise.bind(this.localstack)
                .then(this.localstack.reconfigureAWS)
        };
    }

    static configureAWS(AWS) {
        Localstack.configureAWS(AWS);
    }
}

module.exports = ServerlessOfflineLocalstackPlugin;
