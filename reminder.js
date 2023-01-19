'use strict';

const middy = require('@middy/core');
const ssm = require('@middy/ssm');

const AWS = require('aws-sdk');

const {getParametersForAlarm, sendSESEmail} = require('./lib/aws_email.js');
const {getAlarms} = require('./lib/events.js');

const AWS_REGION = "eu-west-1";
AWS.config.update({ region: AWS_REGION });

module.exports.run = middy(
  async (_event, context) => {
    const alarms = await getAlarms(context.config.spreadsheetId, context.config.apiKey);
    for (const alarm of alarms) {
      const emailParameters = getParametersForAlarm(alarm, context.config.sender, context.config.recipient);
      await sendSESEmail(emailParameters, AWS_REGION);
    }
  }).use(ssm({
    cache: false,
    setToContext: true,
    fetchData: {
      config: `/personal/daily_schedule/config`
    }
  })
);
