# serverless-offline-localstack

[Serverless](https://serverless.com/) Plugin to support running against [Localstack](https://github.com/localstack/localstack).

This plugin allows any requests to AWS to be redirected to a running Localstack instance.

WARNING: This plugin is very much WIP

Pre-requisites:
* [Localstack](https://github.com/localstack/localstack)
* [Serverless Offline > 3.0.0](https://github.com/dherault/serverless-offline)
* [Serverless Webpack > 3.0.0](https://github.com/serverless-heaven/serverless-webpack)

## Installation

The easiest way to get started is to install via npm.

    npm install --save-dev serverless-offline-localstack

## Configuring Serverless

There are two ways to configure the plugin, via a JSON file or via serverless.yml. There are two supported methods for
configuring the endpoints, globally via the "host" property, or individually. These properties may be mixed, allowing for
global override support while also override specific endpoints.

A "host" or individual endpoints must be configured or this plugin will be deactivated.

#### Configuring endpoints via serverless.yml 

```
service: myService

plugins:
  - serverless-offline-localstack

custom:
  serverlessOfflineLocalstack:
    host: http://localhost
    kinesis:
      enabled: true
      intervalMillis: 5000
    endpoints:
      S3: http://localhost:4572
      DynamoDB: http://localhost:4570
      CloudFormation: http://localhost:4581
      Elasticsearch: http://localhost:4571
      ES: http://localhost:4578
      SNS: http://localhost:4575
      SQS: http://localhost:4576
      Lambda: http://localhost:4574
      Kinesis: http://localhost:4568
```

#### Configuring endpoints via JSON

```
service: myService

plugins:
  - serverless-offline-localstack

custom:
  serverlessOfflineLocalstack:
    kinesis:
      enabled: true
      intervalMillis: 5000
    endpointFile: path/to/file.json
```

## Configuring the AWS SDK

To configure the AWS SDK with these endpoints, use the following as soon as possible in your entry point

```
const AWS = require('aws-sdk');
const ServerlessOfflineLocalstack = require('serverless-offline-localstack');
ServerlessOfflineLocalstack.configureAWS(AWS);
```

## Localstack

For full documentation, see https://bitbucket.org/atlassian/localstack

#### Installing via PIP

The easiest way to get started with Localstack is to install it via Python's pip.

```
pip install localstack
```

### Running Localstack

There are multiple ways to run Localstack.

#### Starting Localstack via Docker
  
If Localstack is installed via pip

```
localstack start --docker
```

#### Starting Localstack without Docker

If Localstack is installed via pip

```
localstack start
```

### Optional Debug Flag

An optional debug flag is supported via serverless.yml that will enable additional debug logs.

```
custom:
  serverlessOfflineLocalstack:
    debug: true
```