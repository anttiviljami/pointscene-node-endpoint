#!/usr/bin/env node

'use strict'

var _ = require('lodash')
var fs = require('fs')
var path = require('path')
var request = require('request')
var async = require('async')
var program = require('commander')
var promptly = require('promptly')

var cookies = request.jar()
request = request.defaults({jar: cookies}) // request with cookie jar (yum!)

var endpoint = 'pointscene.com' // we're connecting to the production server
var session = {} // holds our session variables

/**
 * Entry point / Main function
 */
function main () {
  // define our CLI api
  program
    .version('1.0')
    .usage('<file>')
    .parse(process.argv)

  // we take exactly one file as an argument
  if (program.args.length !== 1) {
    program.help()
    process.exit(1)
  }

  // see if file exists
  try {
    fs.statSync(program.args[0])
  } catch (err) {
    program.help()
    process.exit(1)
  }

  // instructions in order
  async.series([
    auth,
    add,
    upload
  ])
}

/**
 * Login to Pointscene.com
 */
function auth (callback) {
  // TODO: check for existing auth
  promptly.prompt('Pointscene.com account (<account>.pointscene.com):', function (err, account) {
    if (err) {
      console.error(err)
    }
    session.endpoint = 'https://' + account + '.' + endpoint
    promptly.prompt('login:', function (err, username) {
      if (err) {
        console.error(err)
      }
      promptly.password('password:', function (err, password) {
        if (err) {
          console.error(err)
        }
        // get auth token
        request.post(session.endpoint + '/wp-login.php',
          {
            form: {
              log: username,
              pwd: password
            }
          },
          function (err, response) {
            if (err) {
              console.log(err)
            }
            if (response.statusCode === 401) {
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

/**
 * Create a new pointcloud
 */
function add (callback) {
  promptly.prompt('Enter a name for your new pointcloud [New Pointcloud]:', { default: 'New Pointcloud' }, function (err, title) {
    if (err) {
      console.error(err)
    }
    request.post(session.endpoint + '/wp-admin/admin-ajax.php',
      {
        form: {
          action: 'pointscene_new_cloud',
          title: title
        }
      },
      function (err, response, body) {
        if (err) {
          console.log('Unable to create cloud', err)
          process.exit(1)
        }
        if (response.statusCode === 401) {
          // login failed, login again
          console.error('Unable to create cloud ', body)
          return auth(add)
        }
        var res = JSON.parse(body)
        session.key = res.data.auth_key
        session.cloud = res.data.cloud
        session.edit = res.data.edit

        var options = _.keys(res.data.storage)
        var storage = _.values(res.data.storage)

        var optionstring = '\n'
        _.each(options, function (option, key) {
          optionstring += key + ') ' + option + '\n'
        })

        promptly.choose('Please select upload server location [0]: ' + optionstring, _.keys(options), { default: '0' }, function (err, option) {
          if (err) {
            console.error(err)
          }
          session.storage = storage[_.parseInt(option)]
          return callback()
        })
      }
    )
  })
}

/**
 * Upload las/laz files to the Pointscene data server
 */
function upload (callback) {
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

  var uploadEndpoint = session.storage

  console.log('Uploading ' + filename + ' to ' + uploadEndpoint + '...')

  // simple progress indicator
  var progress = setInterval(function () { process.stdout.write('.') }, 1000)

  var body = ''
  request.post({
    url: uploadEndpoint + 'upload.php',
    formData: formData
  })
    .on('error', function (err) {
      return console.error('Upload failed:', err)
    })
    .on('data', function (data) {
      body += data // we need this since we're streaming the request
    })
    .on('end', function () {
      // stop our dumb progress indicator
      clearInterval(progress)
      process.stdout.write('\n')

      var res = JSON.parse(body)
      if (!res.OK) {
        return console.error('Upload failed:', res.error)
      }

      console.log('Upload successful!')
      console.log('View your new pointcloud: ' + session.edit)
      return callback()
    })
}

if (require.main === module) {
  // we're running this as a script
  main()
} else {
  // allow importing this as a module
  module.exports = {
    main: main,
    auth: auth,
    add: add,
    upload: upload
  }
}
