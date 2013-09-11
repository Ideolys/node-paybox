node-paybox
===========

NodeJS library to simply connect to the Paybox platform

Install
-------

Just run in your project folder :

```bash
npm install paybox
```

Create a transaction
--------------------

```javascript
var paybox        = require('paybox');
var transactionId = (new Date()).valueOf();

paybox.createTransaction(
  {
    'offer'   : 'system',
    'isTest'  : true, // Optional
    'key'     : 'MyHEXPrivateKey', // Your private key in HEX format
    'PBX_'    : {
      'SITE'        : '1999888',
      'RANG'        : '32',
      'IDENTIFIANT' : '2',
      'TOTAL'       : '1000', // 10
      'DEVISE'      : '978', // €
      'CMD'         : 'Test Paybox ' + transactionId,
      'PORTEUR'     : 'me@domain.com',
      'RETOUR'      : 'value:M;id:R;auth:A;error:E;sign:K',
      'REPONDRE_A'  : 'http://my-server:8084/paybox-paiment-done/' + transactionId // Optional
    }
  },
  function(error, transaction){
    if(error === null){
      // transaction is ready
    }
  }
);
```

### What does transaction look like ?

```javascript
{
  url     : 'https://preprod-tpeweb.paybox.com/cgi/MYchoix_pagepaiement.cgi',
  method  : 'POST',
  body    : '<input type="hidden" name="PBX_RUF1" value="POST"><input type="hidden" name="PBX_SITE" value="1999888"><input type="hidden" name="PBX_RANG" value="32"><input type="hidden" name="PBX_IDENTIFIANT" value="2"><input type="hidden" name="PBX_TOTAL" value="1000"><input type="hidden" name="PBX_DEVISE" value="978"><input type="hidden" name="PBX_CMD" value="Test Paybox 1378883195766"><input type="hidden" name="PBX_PORTEUR" value="me@domain.com"><input type="hidden" name="PBX_RETOUR" value="value:M;id:R;auth:A;error:E;sign:K"><input type="hidden" name="PBX_REPONDRE_A" value="http://my-server:8084/paybox-paiment-done/1378883195766"><input type="hidden" name="PBX_TIME" value="2013-09-11T07:06:36.066Z"><input type="hidden" name="PBX_HASH" value="SHA512"><input type="hidden" name="PBX_HMAC" value="77035F41B1EAA697B7BDB3F4A1372559D544E4703E1DE2A88F47FE34AD111CFC13039922E0FC06E02AF6A03ACC61F73A52CB5EFEA57BF927BAC94934816292DD">',
  PBX_    : {
    RUF1        : 'POST',
    SITE        : '1999888',
    RANG        : '32',
    IDENTIFIANT : '2',
    TOTAL       : '1000',
    DEVISE      : '978',
    CMD         : 'Test Paybox 1378883195766',
    PORTEUR     : 'me@domain.com',
    RETOUR      : 'value:M;id:R;auth:A;error:E;sign:K',
    REPONDRE_A  : 'http://my-server:8084/paybox-paiment-done/1378883195766',
    TIME        : '2013-09-11T07:06:36.066Z',
    HASH        : 'SHA512',
    HMAC        : '77035F41B1EAA697B7BDB3F4A1372559D544E4703E1DE2A88F47FE34AD111CFC13039922E0FC06E02AF6A03ACC61F73A52CB5EFEA57BF927BAC94934816292DD'
   }
}

```

Send transaction to Paybox
--------------------------

When you have your `transaction` from `paybox.createtransaction()` method you can create a form with `transaction.body`.

Form's fields `action` and `method` have to be set respectively to `url` and `method` fields from `transaction`.

Check identity of the paybox response
-------------------------------------

Whatever you use `ExpressJS` or another Framework you have to intercept request coming from the given `PBX_REPONDER_A` field.

One a request is intercepted you can check if it's a paybox request or not with `paybox.checkIdentity()` method.

```javascript
// ExpressJS example to get datas received in the request
var datas = req.body;

// ExpressJS example to get the param "transactionId" passed in the url
var transactionId = req.query.transactionId;

// Assuming myTransactions is where you store transactions from paybox.createTransaction() method
// You can store it wherever you want but you have to find it to check identity
var transaction = myTransactions[transactionId];

// Following method returns true or false
var _isFromPaybox = paybox.checkIdentity(transaction, datas, '/path/to/pubkey/of/paybox.pem');
```

FAQ
---

### Why this module generates a string `body` for a form ?

This module computes the signature of your transaction. This signature is not the same if fields are not sorted in a different way.

Because Javascript does not specify the order of fields in an objet while enumerating them we have to be sure the order is not changed between signature computing and form generation.

Extract of [ECMAScript Language Specification - 262](http://www.ecma-international.org/publications/files/ECMA-ST/Ecma-262.pdf) section __12.6.4__
>The mechanics and order of enumerating the properties (step 6.a in the first algorithm, step 7.a in the second) is not specified.


Licence
-------

Copyright (c) 2013, Ideolys.
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

  - Redistributions of source code must retain the above copyright notice,
    this list of conditions and the following disclaimer.

  - Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation
    and/or other materials provided with the distribution.

  - Neither the name of node-paybox nor the names of its contributors
    may be used to endorse or promote products derived from this software
    without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
