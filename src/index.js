'use strict';

import * as Promise from "bluebird";

import Localstack from "./localstack";

class ServerlessOfflineLocalstackPlugin {

    constructor(serverless, options) {
        this.serverless = serverless;
        this.options = options;

        const localstack = new Localstack(serverless, options);

        this.commands = {
            deploy: {}
        };

        this.hooks = {
            'before:invoke:local:invoke': () => Promise.bind(localstack)
                .then(localstack.reconfigureAWS),
            'webpack:invoke:invoke': () => Promise.bind(localstack)
                .then(localstack.reconfigureAWS),
            'webpack:compile': () => Promise.bind(localstack)
                .then(localstack.reconfigureAWS)
        };

        localstack.reconfigureAWS();
    }
}

module.exports = ServerlessOfflineLocalstackPlugin;
