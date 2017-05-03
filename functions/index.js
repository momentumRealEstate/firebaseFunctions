const functions = require('firebase-functions');
const admin = require('firebase-admin');
const docusign = require('docusign-esign');
const async = require('async');
// const bodyParser = require('body-parser');
const credentials = require('./config.js');

admin.initializeApp(functions.config().firebase);

// initialize the api client
var apiClient = new docusign.ApiClient();

exports.sendTemplate = functions.https.onRequest((req, res) => {  
  var integratorKey = credentials.integratorKey,
    email = credentials.email,
    password = credentials.password,
    docusignEnv = 'demo',
    fullName = req.query.user,
    recipientEmail = req.query.userEmail,
    templateId = req.query.templateId,
    templateRoleName = req.query.templateName;

    var baseUrl = 'https://' + docusignEnv + '.docusign.net/restapi';

    apiClient.setBasePath(baseUrl);

    var creds = JSON.stringify({
      Username: email,
      Password: password,
      IntegratorKey: integratorKey
    });

  apiClient.addDefaultHeader('X-DocuSign-Authentication', creds);

  docusign.Configuration.default.setDefaultApiClient(apiClient);

  async.waterfall([
function login (next) {
  // login call available off the AuthenticationApi
  var authApi = new docusign.AuthenticationApi();

  // login has some optional parameters we can set
  var loginOps = {};
  loginOps.apiPassword = 'true';
  loginOps.includeAccountIdGuid = 'true';
  authApi.login(loginOps, function (err, loginInfo, response) {
    if (err) {
      return next(err);
    }
    if (loginInfo) {
      // list of user account(s)
      // note that a given user may be a member of multiple accounts
      var loginAccounts = loginInfo.loginAccounts;
      console.log('LoginInformation: ' + JSON.stringify(loginAccounts));
      var loginAccount = loginAccounts[0];
      var accountId = loginAccount.accountId;
      var baseUrl = loginAccount.baseUrl;
      var accountDomain = baseUrl.split("/v2");

      // below code required for production, no effect in demo (same domain)
      apiClient.setBasePath(accountDomain[0]);
      docusign.Configuration.default.setDefaultApiClient(apiClient);
      next(null, loginAccount);
    }
  });
},
function sendTemplate (loginAccount, next) {
  // create a new envelope object that we will manage the signature request through
  var envDef = new docusign.EnvelopeDefinition();
  envDef.emailSubject = 'Please sign this document sent from Momentum Real Estate';
  envDef.templateId = templateId;

  // create a template role with a valid templateId and roleName and assign signer info
  var tRole = new docusign.TemplateRole();
  tRole.roleName = templateRoleName;
  tRole.name = fullName;
  tRole.email = recipientEmail;

  // create a list of template roles and add our newly created role
  var templateRolesList = [];
  templateRolesList.push(tRole);

  // assign template role(s) to the envelope
  envDef.templateRoles = templateRolesList;

  // send the envelope by setting |status| to 'sent'. To save as a draft set to 'created'
  envDef.status = 'sent';

  // use the |accountId| we retrieved through the Login API to create the Envelope
  var accountId = loginAccount.accountId;

  // instantiate a new EnvelopesApi object
  var envelopesApi = new docusign.EnvelopesApi();

  // call the createEnvelope() API
  envelopesApi.createEnvelope(accountId, {'envelopeDefinition': envDef}, function (err, envelopeSummary, response) {
    if (err) {
      return next(err);
    }
    console.log('EnvelopeSummary: ' + JSON.stringify(envelopeSummary));
    next(null);
  });
},
  ], function end (error) {
    if (error) {
      console.log('Error: ', error);
      process.exit(1);
    }
    process.exit();
  });
  res.send("Success");
});
