const lodash = require('lodash');
const AWS = require('aws-sdk');
const Promise = require('bluebird');

import AbstractBaseClass from './abstractBaseClass';

/**
 * Based on ServerlessWebpack.run
 * @param slsWebpack
 * @param stats
 * @param functionName
 */
function getRunnableLambda(slsWebpack, stats, functionName) {
    return (event) => {
        const handler = slsWebpack.loadHandler(stats, functionName, true);
        const context = slsWebpack.getContext(functionName);
        return new Promise(
            (resolve, reject) => handler(
                event,
                context,
                (err, res) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(res);
                    }
                }
            ));
    };
}

const MAX_CONSECUTIVE_ERRORS = 10;

export default class KinesisConsumer extends AbstractBaseClass {

    constructor(serverless, options) {
        super(serverless, options);

        this.log('Configuring serverless offline -> kinesis consumer');

        this.config = serverless.service.custom && serverless.service.custom.serverlessOfflineLocalstack || {};
        // Only meaningful for AWS
        this.provider = 'aws';

        // No commands to run
        // TODO(msills): Allow this to be run independently
        this.commands = {};
        // Run automatically as part of the deploy
        this.hooks = {
            'after:offline:start': () => Promise.bind(this).then(this.runWatcher)
        };
    }

    static async createRegistry(serverless) {
        // Get a handle on the compiled functions
        // TODO(msills): Do not rely on this plugin.
        const slsWebpack = _.find(serverless.pluginManager.plugins, p => p.constructor.name === 'ServerlessWebpack');
        const compileStats = await slsWebpack.compile();

        const registry = {};
        for (const functionName of _.keys(serverless.service.functions)) {
            const func = serverless.service.functions[functionName];
            // Get the list of streams for the function
            const streamEvents = _.filter(func.events || [], e => 'stream' in e);
            for (const s of streamEvents) {
                const streamName = s.stream.arn.split('/').slice(-1)[0];
                registry[streamName] = registry[streamName] || [];
                registry[streamName].push(getRunnableLambda(slsWebpack, compileStats, functionName));
            }
        }
        return registry;
    }

    static async _repollStreams(kinesis, streamIterators) {
        winston.debug(`Polling Kinesis streams: ${JSON.stringify(_.keys(streamIterators))}`);
        for (const name of _.keys(streamIterators)) {
            if (streamIterators[name] === null) {
                winston.warn(`Iterator for stream '${name}' + is closed`);
            }
        }
        // Get the new values for each stream
        // name -> [fetch result]
        return Promise.props(
            _.mapValues(
                streamIterators,
                iter => kinesis.getRecords({
                    ShardIterator: iter,
                    Limit: 100
                }).promise()));
    }

    static async _runLambdas(streamResults, registry) {
        // Wait for the functions to execute
        await Promise.all(_.chain(streamResults)
            .entries()
            .flatMap(([name, result]) => {
                winston.debug(`Stream '${name}' returned ${result.Records.length} records`);
                // Parse the records
                const records = _.map(result.Records, r => JSON.parse(r.Data.toString()));
                // Apply the functions that use that stream
                return registry[name].map(f => f({Records: records}));
            })
            .value());
    }

    async runWatcher() {
        // Create the Kinesis client
        const config = this.serverless.service.custom.offlineKinesisEvents;
        const kinesis = new AWS.Kinesis({
            endpoint: `${config.host}:${config.port}`,
            region: config.region,
            apiVersion: '2013-12-02',
            sslEnabled: config.sslEnabled || false
        });

        // Load the registry
        const registry = await ServerlessOfflineKinesisEvents.createRegistry(this.serverless);
        // Get the first shard for every element in the registry
        // Right now, the stream iterators are local to this run. Eventually, we'll persist this somewhere
        let streamIterators = await Promise.props(
            _.chain(registry)
            // Grab keys
                .keys()
                // Map to [name, stream description promise]
                .map(name => [name, kinesis.describeStream({StreamName: name}).promise()])
                // Map to [name, iterator promise]
                .map(([name, descP]) => {
                    const iterP = descP.then(desc => kinesis.getShardIterator({
                        ShardId: desc.StreamDescription.Shards[0].ShardId,
                        ShardIteratorType: 'TRIM_HORIZON',
                        StreamName: name
                    }).promise());
                    return [name, iterP];
                })
                // Back to an object
                .fromPairs()
                // Extract iterators
                .mapValues(iterP => iterP.then(iter => iter.ShardIterator))
                // Grab the value
                .value());

        let consecutiveErrors = 0;
        while (true) { // eslint-disable-line no-constant-condition
            winston.debug(`Polling Kinesis streams: ${JSON.stringify(_.keys(registry))}`);
            // Repoll the streams
            const streamResults = await ServerlessOfflineKinesisEvents._repollStreams(kinesis, streamIterators) // eslint-disable-line
            try {
                await ServerlessOfflineKinesisEvents._runLambdas(streamResults, registry) // eslint-disable-line
            } catch (err) {
                consecutiveErrors += 1;
                if (consecutiveErrors > MAX_CONSECUTIVE_ERRORS) {
                    winston.error(`Exceeded maximum number of consecutive errors (${MAX_CONSECUTIVE_ERRORS})`);
                    throw err;
                }
                winston.error(`Failed to run Lambdas with error ${err.stack}. Continuing`);
            } finally {
                // Update the stream iterators
                streamIterators = _.mapValues(streamResults, result => result.NextShardIterator);
            }

            // Wait a bit
            await Promise.delay(config.intervalMillis); // eslint-disable-line no-await-in-loop
        }
    }
}