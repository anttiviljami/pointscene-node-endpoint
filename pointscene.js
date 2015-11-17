#!/usr/bin/env node

'use strict'

var fs = require('fs')
var path = require('path')
var request = require('request')
var cookies = request.jar()
var request = request.defaults({jar: cookies}) // request with cookie jar (yum!)
var async = require('async')
var program = require('commander')
var promptly = require('promptly')

var endpoint = 'pointscene.com'
var wp = {}

var session = {}

function auth(callback) {
  // TODO: check for existing auth
  promptly.prompt('Pointscene.com account (<account>.pointscene.com):', function (err, account) {
    session.endpoint = 'https://' + account + '.' + endpoint
    promptly.prompt('login:', function (err, username) {
      promptly.password('password:', function (err, password) {
        // get auth token
        request.post(session.endpoint + '/wp-login.php',
          {
            form: {
              log: username,
              pwd: password
            }
          },
          function(err, response) {
            if(err) {
              console.log(err)
            }
            if(response.statusCode === 401) {
              // login failed
              console.log('Login incorrect.')
              return auth(callback)
            }
            console.log('Login successful!')
            session.account = account
            session.username = username
            session.password = password
            return callback()
          }
        )
      })
    })
  })
}

function newCloud(callback) {
  promptly.prompt('Enter a name for your new pointcloud:', function (err, title) {
    request.post(session.endpoint + '/wp-admin/admin-ajax.php',
      {
        form: {
          action: 'pointscene_new_cloud',
          title: title
        }
      },
      function(err, response, body) {
        if(err) {
          console.log('Unable to create cloud', err)
          process.exit(1)
        }
        if(response.statusCode === 401) {
          // login failed, login again
          console.error('Unable to create cloud ', body)
          return auth(newCloud)
        }
        var res = JSON.parse(body)
        session.key = res.data.auth_key
        session.cloud = res.data.cloud
        session.edit = res.data.edit
        return callback()
      }
    )
  })
}

function upload(callback) {
  var file = program.args[0]
  var filename = path.basename(file)

  var formData = {
    name: filename, // filename
    account: session.account, // pointscene subdomain
    pointcloud: session.cloud, // pointcloud post ID
    key: session.key,
    file: {
      value: fs.createReadStream(file),
      options: {
        filename: filename,
        contentType: 'text/plain'
      }
    }
  }

  var uploadEndpoint = 'https://data1.pointscene.com'

  console.log('Uploading ' + filename + ' to ' + uploadEndpoint + '...');

  // simple progress indicator
  var progress = setInterval(function() { process.stdout.write('.') }, 1000)

  var body = ""
  request.post({
    url: uploadEndpoint + '/api/upload.php',
    formData: formData,
  })
  .on('error', function(err) {
    return console.error('Upload failed:', err)
  })
  .on('data', function(data) {
    body += data; // we need this since we're streaming the request
  })
  .on('end', function () {

    // stop our dumb progress indicator
    clearInterval(progress)
    process.stdout.write("\n")

    var res = JSON.parse(body)
    if (!res.OK) {
      return console.error('Upload failed:', res.error)
    }

    console.log('Upload successful!')
    console.log('View your new pointcloud: ' + session.edit)
    return callback()
  })

}

;(function main() {

  program
    .version('1.0')
    .usage('<file>')
    .parse(process.argv)

  if(program.args.length != 1) {
    program.help()
    process.exit(1)
  }

  // see if file exists
  try {
    fs.statSync(program.args[0]);
  } catch(err) {
    program.help()
    process.exit(1)
  }

  async.series([
    auth,
    newCloud,
    upload
  ])

})()

