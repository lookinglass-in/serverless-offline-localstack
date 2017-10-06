export default class AbstractBaseClass {

    constructor(serverless, options) {
        this.serverless = serverless;
        this.options = options;
    }

    log(msg) {
        this.serverless.cli.log.call(this.serverless.cli, msg);
    }

    debug(msg) {
        if (this.config.debug) {
            this.log(msg);
        }
    }
}