
var path    = require('path');
var fs      = require('fs');
var crypto  = require('crypto');
var http    = require('http');
var https   = require('https');

var PAYBOX_SERVERS          = require('./servers.json');
var PAYBOX_RESPONSE_ERRORS  = require('./response-errors.json');

var paybox = {
  /**
   * Checks identity of a response and if paybox returned an error
   * @param  {Object}   transaction   Transaction object returned by paybox.createTransaction()
   * @param  {Object}   datas         Datas received from Paybox
   * @param  {String}   pubkeyPath    The path where Paybox public key is stored on the server
   * @param  {Function} callback      Function to be called when checks are finished. Arguments are (error, transaction)
   * @return {void}
   */
  response          : function(transaction, datas, pubkeyPath, callback){
    var _error = null;
    if(!paybox.checkIdentity(transaction, datas, pubkeyPath)){
      _error = 'This response is not from a paybox server';
    }
    else{
      _error = paybox.getResponseError(transaction, datas);
    }
    callback(_error, transaction);
  },
  /**
   * Checks if there is an error in response datas
   * @param  {Object}   transaction   Transaction object returned by paybox.createTransaction()
   * @param  {Object}   datas         Datas received from Paybox
   * @return {String | NULL}          NULL if there is no error or a string explaining the error
   */
  getResponseError  : function(transaction, datas){
    var _error = null;
    var _errorField = paybox.getErrorField(transaction);
    var _errorCode = datas[_errorField];
    if(_errorCode !== '00000'){
      Object.keys(PAYBOX_RESPONSE_ERRORS).map(function(error){
        var _regExp = new RegExp(error, 'g');
        if(_regExp.test(_errorCode)){
          _error = PAYBOX_RESPONSE_ERRORS[error].replace(/%ERROR_CODE%/g, _errorCode);
        }
      });
      if(_error === null){
        _error = 'Unknown error returned by paybox : ' + _errorCode;
      }
    }
    return _error;
  },
  /**
   * Checks if a query is from Paybox
   * @param  {Object}   transaction   Transaction object returned by paybox.createTransaction()
   * @param  {Object}   datas         Datas received from Paybox
   * @param  {String}   pubkeyPath    The path where Paybox public key is stored on the server
   * @return {Boolean}
   */
  checkIdentity     : function(transaction, datas, pubkeyPath){
    var _pubkey     = fs.readFileSync(path.resolve(pubkeyPath), 'utf8');
    var _signField  = paybox.getSignField(transaction);
    var _check = true;
    if(_signField !== null){
      var _sign = datas[_signField];
      var _message = [];
      Object.keys(datas).map(function(field){
        if(field !== _signField){
          _message.push(field + '=' + encodeURIComponent(datas[field]));
        }
      });
      _message = _message.join('&');
      _check = paybox.checkSignature(_message, _sign, _pubkey);
    }
    return _check;
  },
  /**
   * Checks if a message and its signature match with the given public key
   * @param  {String} message   The message with format "field1=val1&field2=val2..."
   * @param  {String} signature The RSA SHA1 signature of the message
   * @param  {String} pubkey    The public key in UTF8
   * @return {Boolean}          If the message is signed by the owner of the public key
   */
  checkSignature    : function(message, signature, pubkey){
    signature = new Buffer(decodeURIComponent(signature), 'base64');
    var check = crypto.createVerify('SHA1');
    check.update(message);
    return check.verify(pubkey, signature);
  },
  /**
   * Generates a signature and inserts it
   * @param  {Object} transaction The transaction returned by paybox.createTransaction()
   * @param  {String} key         Your private key in HEX format
   * @return {Object}             The transaction signed
   */
  signTransaction   : function(transaction, key, callback){
    var error = null;
    transaction['PBX_'].TIME = (new Date()).toISOString();
    transaction['PBX_'].HASH = 'SHA512';
    var _hmac = paybox.generateHMAC(transaction['PBX_'], key);
    transaction['PBX_'].HMAC = _hmac;
    if(_hmac === null){
      error = 'Bad private key format, unable to generate signature';
    }
    callback(error, transaction);
  },
  /**
   * Generates all inputs of the form to submit to Paybox and inserts them in the transaction
   * @param  {Object} transaction The transaction returned by paybox.createTransaction()
   * @return {Object}             The transaction modified
   */
  generateFormBody  : function(transaction){
    transaction.body = Object.keys(transaction['PBX_']).map(function(field){
      return '<input type="hidden" name="PBX_' + field + '" value="' + transaction['PBX_'][field] + '">';
    }).join('');
    return transaction;
  },
  /**
   * Generate an HMAC signature for given PBX fields
   * @param  {Object} PBXFields Paybox parameters without 'PBX_' prefix
   * @param  {String} key       The HEX format of the private key
   * @return {String}           Uppercase HEX format of the HMAC
   */
  generateHMAC      : function(PBXFields, key){
    var _hmac = null;
    try{
      var _key = (new Buffer(key, 'hex')).toString('binary');
      var _message = Object.keys(PBXFields).map(function(field){
        return 'PBX_' + field + '=' + PBXFields[field];
      }).join('&');
      _hmac = crypto.createHmac('sha512', _key).update(_message).digest('hex').toUpperCase();
    }
    catch(e){}
    return _hmac;
  },
  /**
   * Finds the field name for the signature in the transaction
   * @param  {Ovject}         transaction   The transaction returned by paybox.createTransaction()
   * @return {String | null}                The field name or NULL if the signature was not asked in the transaction
   */
  getSignField      : function(transaction){
    return paybox.getFieldName(transaction, 'K');
  },
  getErrorField     : function(transaction){
    return paybox.getFieldName(transaction, 'E');
  },
  getFieldName      : function(transaction, code){
    var _pbxRetour = transaction['PBX_'].RETOUR;
    var _fieldsRegExp = new RegExp('^.*;([^;]+):' + code.toUpperCase() + '[;]?.*', 'g');
    var _hasField = _fieldsRegExp.test(_pbxRetour);
    return _hasField ? _pbxRetour.replace(_fieldsRegExp, '$1') : null;
  },
  /**
   * Creates a transaction object with all needed informations to query paybox server
   * @param  {Object}   options  Options to create the transaction
   * @param  {Function} callback Function to be called when the transaction will be created. Arguments are (error, transaction)
   * @return {void}
   */
  createTransaction : function(options, callback){
    paybox.getURL(options.offer, options.isTest === true, function(err, url){
      if(err !== null){
        return callback(err, null);
      }
      var _transaction = {
        'url'         : url,
        'expectedIP'  : '',
        'method'      : 'POST',
        'body'        : '',
        'PBX_'      : {
          'RUF1'        : 'POST'
        }
      };

      Object.keys(options['PBX_']).map(function(field){
        _transaction['PBX_'][field.toUpperCase()] = options['PBX_'][field];
      });

      paybox.signTransaction(_transaction, options.key, function(error, transaction){
        if(error === null){
          transaction = paybox.generateFormBody(transaction);
        }
        callback(error, transaction);
      });
    });
  },
  /**
   * Extracts informations from an URL formated in a string
   * @param  {String} serverURL The URL with all informations like port, path, host, protocol (only http or https) (ex : https://domain.com:3021/my/path)
   * @return {Object}           An object with all informations extracted from the string
   */
  extractURLInfos   : function(serverURL){
    var _infos = {
      isSSL : false,
      port  : 80,
      path  : '/load.html',
      host  : ''
    };
    _infos.host = serverURL
      .replace(/^(https?):\/\//g, function(p, protocol){
        _infos.isSSL  = protocol === 'https';
        _infos.port   = 443;
        return '';
      })
      .replace(/([^:|^\/]+)(.*)$/g, function(p, host, portAndPath){
        portAndPath
          .replace(/^:(\d+)/g, function(p, port){
            _infos.port = parseInt(port, 10);
            return '';
          })
          .replace(/^:?(\/.*)/g, function(p, path){
            _infos.path = path;
            return '';
          });
        return host;
      });
    return _infos;
  },
  /**
   * Recursive function to check all servers URL given
   * @param  {Array}    servers  List of URLs to check
   * @param  {Integer}  index    Current server index to check in servers Array
   * @param  {Function} callback Function to be called when checks are finished. 2 arguments : err, serverURL
   * @return {void}
   */
  checkNextServer   : function(servers, index, callback){
    var _serverURL = servers[index];
    paybox.checkServer(_serverURL, function(isAlive){
      if(isAlive){
        callback(null, _serverURL);
      }
      else if(++index < servers.length){
        paybox.checkNextServer(servers, index, callback);
      }
      else{
        callback('No alive server found');
      }
    });
  },
  /**
   * Makes a request to the given URL and check for a div#server_status and its content to be OK
   * @param  {String}   serverURL The URL with all needed parameters like port, path, host, protocol (only http or https)
   * @param  {Function} callback  Function to be called when the check is finished with 1 argument : Boolean isAlive
   * @return {void}
   */
  checkServer       : function(serverURL, callback){
    if(serverURL === undefined){
      return callback(false);
    }
    var _server     = paybox.extractURLInfos(serverURL);
    var reqLibrary  = _server.isSSL ? https : http;
    var req = reqLibrary.request(_server);
    req.on('response', function(res){
      var _isAlive = false;
      res.setEncoding('utf8');
      res.on('data', function(body){
        body = body.replace(/< *br *\/? *>/g, '').replace(/\n| /g, '');
        _isAlive = (/id="server_status"/g).test(body) && (/>OK<\/div>/g).test(body);
      });
      res.on('end', function(){
        callback(_isAlive);
      });
    });
    req.on('error', function(err){
      callback(false);
    });
    req.end();
  },
  /**
   * Checks every server for given offer and return a valid one to the callback
   * @param  {String}             offer     The offer we want server URL
   * @param  {optional Boolean}   isTest    If it has to return a test URL
   * @param  {Function}           callback  Function to be called when checks are finished. 2 arguments : err, serverURL
   * @return {void}
   */
  getURL            : function(offer, isTest, callback){
    if(callback === undefined){
      callback  = isTest;
      isTest    = false;
    }
    var _payboxSystemPath = '/cgi/MYchoix_pagepaiement.cgi';
    var servers = paybox.servers(offer, isTest);
    paybox.checkNextServer(servers, 0, function(err, serverURL){
      if(serverURL !== undefined){
        serverURL += _payboxSystemPath;
      }
      callback(err, serverURL);
    });
  },
  /**
   * Returns array of URLs for given offer
   * @param  {String}             offer   The offer the transaction is for. Eg "system"
   * @param  {optional Boolean}   test    If URLs needed are test servers. Default false.
   * @return {Array}                      List of servers URLs
   */
  servers           : function(offer, test){
    var _serversURLs = [];
    if(PAYBOX_SERVERS[offer] !== undefined){
      _serversURLs = PAYBOX_SERVERS[offer][test ? 'test' : 'prod'];
    }
    return _serversURLs;
  }
};

module.exports = paybox;
