export default class AbstractBaseClass {

    constructor(serverless, options) {
        this.serverless = serverless;
        this.options = options;
        this.isDebug = false;
    }

    setDebug(debug) {
        this.isDebug = debug;
    }

    log(msg) {
        this.serverless.cli.log.call(this.serverless.cli, msg);
    }

    debug(msg) {
        if (this.isDebug) {
            this.log(msg);
        }
    }
}