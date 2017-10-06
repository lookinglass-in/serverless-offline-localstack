'use strict';

import * as Promise from 'bluebird';

import Localstack from './localstack';
import KinesisConsumer from './kinesisConsumer';

class ServerlessOfflineLocalstackPlugin {

    constructor(serverless, options) {
        this.serverless = serverless;
        this.options = options;

        this.localstack = new Localstack(serverless, options);
        this.kinesisConsumer = new KinesisConsumer(serverless, options);

        this.commands = {
            deploy: {}
        };

        this.hooks = {
            'before:invoke:local:invoke': () => Promise.bind(this.localstack)
                .then(this.localstack.reconfigureAWS),
            'webpack:invoke:invoke': () => Promise.bind(this.localstack)
                .then(this.localstack.reconfigureAWS),
            'before:offline:start': () => Promise.resolve(
                Promise.bind(this.localstack).then(this.localstack.reconfigureAWS),
            ).then(
                Promise.bind(this.kinesisConsumer).then(this.kinesisConsumer.runWatcher)
            )
        };
    }

    static configureAWS(AWS) {
        Localstack.configureAWS(AWS);
    }
}

module.exports = ServerlessOfflineLocalstackPlugin;
