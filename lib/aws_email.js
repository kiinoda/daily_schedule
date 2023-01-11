const AWS = require('aws-sdk');

const getSESEmailParameters = (events, sender, recipient) => {
  const textMessage = events.join('\n') + '\n';
  const htmlMessage = `<html><pre>${events.join('\n')}\n</pre></html>`;
  const parameters = {
    Destination: { ToAddresses: [recipient] },
    Message: {
      Body: {
        Text: { Data: textMessage },
        Html: { Data: htmlMessage }
      },
      Subject: { Data: 'Today\'s Schedule' }
    },
    Source: `Daily Schedule Bot <${sender}>`
  };
  return parameters
}

const sendSESEmail = async (parameters, region) => {
  AWS.config.update({ region: region });
  const ses = new AWS.SES({ apiVersion: '2010-12-01' });
  try {
    const status = await ses.sendEmail(parameters).promise();
    console.log('Successfully sent email');
    console.log(status);
  } catch (err) {
    console.log('Failed sending email');
    console.log(err);
  }
}

module.exports = { getSESEmailParameters, sendSESEmail };
