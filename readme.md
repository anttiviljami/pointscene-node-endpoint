# Pointscene Node Client
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)

Upload pointclouds to your [Pointscene.com](https://pointscene.com) account from the command line interactively.

This is an example implementation of a remote cloud import to Pointscene.com

See documentation for more info

## Installation

Clone this repo, run npm install, run gulp install (optional), done !

```
git clone https://github.com/davijo/pointscene-node-client
cd node-pointscene-client
npm install
gulp install
```

## Usage

Run `pointscene` as an executable from the command line. See --help for options.

```
$ pointscene

  Usage: pointscene <file>

  Options:

    -h, --help     output usage information
    -V, --version  output the version number

```

## Documentation / Spec

This is a proof-of-concept for implementing a remote cloud upload from a 3rd party application.

Here's how it works:

### Select a pointcloud file to upload

In this example we take the file as a cli parameter.

```
$ pointscene mypointcloud.laz
```

The file has to be a proper las/laz/zip point file containing real pointcloud data.

### Ask the user for their Pointscene account

We're using cli prompts here.

```
Pointscene.com account (<account>.pointscene.com): dev
```

### Authenticate user with Pointscene.com login

```
login: antti
password:
Login successful!
```

We send a POST request to `<account>.pointscene.com/wp-login.php` containing the following post data

```
log => <login>
pwd => <password>
```

On success, the server responds with the proper auth cookie headers for WordPress. They should look something like this.

```
Set-Cookie:wordpress_logged_in_b4dffb8470e581428ecd9201bb2afc14=antti%7C1447958609%7Ck97nm4ManduZxaEy67kZTTiKdTjrcqhG4dANEy1wwr0%7C1205ab6321e4de4cafbaf8ea013744f1c2ed12f586272f2d55037846b45b6938; domain=.pointscene.com; httponly
Set-Cookie:wordpress_sec_b4dffb8470e581428ecd9201bb2afc14=antti%7C1447958609%7Ck97nm4ManduZxaEy67kZTTiKdTjrcqhG4dANEy0wwr1%7Ccca98eb029556f15930b1862088e5941c935eb5fbfa46b24ede520533147550d; path=/wp-content/plugins; domain=.pointscene.com; secure; httponly
Set-Cookie:wordpress_sec_b4dffb8470e581428ecd9201bb2afc14=antti%7C1447958609%7Ck97nm4ManduZxaEy67kZTTiKdTjrcqhG4dANEy0wwr1%7Ccca98eb029556f15930b1862088e5941c935eb5fbfa46b24ede520533147550d; path=/; domain=.pointscene.com; secure; httponly
```

Store these cookies for the next part

### Create a new pointcloud to your account

We ask the user for a name for their new pointcloud

```
Enter a name for your new pointcloud [New Pointcloud]: My Awesome Pointcloud
```

Using this information, we send a new request using the previously acquired cookies to `https://<account>.pointscene.com/wp-admin/admin-ajax.php`

The request should contain the following inputs as either GET or POST fields

```
action => 'pointscene_new_cloud'
title => <pointcloud_title>
```

On success, the server will respond with JSON data like this (without comments):

```
{
   "success":true,
   "data":{
      "cloud":396, // ID of the cloud that was created
      "storage":{ // options for storage servers
         "London":"https:\/\/data1.pointscene.com\/api\/",
         "Helsinki":"https:\/\/data0.pointscene.com\/api\/"
      },
      "auth_key":"xxxxxxxxxxxxxxxxxxxxxxxx", // auth key for upload
      "edit":"https:\/\/dev.pointscene.com\/wp-admin\/post.php?post=396&action=edit" // edit link to the new pointcloud
   }
}
```

### Upload the pointcloud files to the storage

Based on the storage options given, we then ask the user which storage backend they wish to use.

```
Please select upload server location [0]:
0) London
1) Helsinki
```

The final upload endpoint should be something like: `https://data1.pointscene.com/api/upload.php`

Now we can upload the files via standard HTTP multipart/form-data POST request with the following fields:

```
name => <filename> # the filename of the file to be uploaded (basename only)
account => <account> # as in the account from <account>.pointscene.com
pointcloud => <cloud> # the id of the new cloud
key => <authkey> # upload auth key
```

And of course the file itself in `Content-Type: text/plain`.

The POST body should look something like this:

```
------WebKitFormBoundarylLZcWAy2dlbMpklj

Content-Disposition: form-data; name="name"



mypointcloud.laz

------WebKitFormBoundarylLZcWAy2dlbMpklj

Content-Disposition: form-data; name="account"



dev

------WebKitFormBoundarylLZcWAy2dlbMpklj

Content-Disposition: form-data; name="pointcloud"



396

------WebKitFormBoundarylLZcWAy2dlbMpklj

Content-Disposition: form-data; name="key"



xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

------WebKitFormBoundarylLZcWAy2dlbMpklj

Content-Disposition: form-data; name="file"; filename="mypointcloud.laz"

Content-Type: text/plain



...

------WebKitFormBoundarylLZcWAy2dlbMpklj--
```

On success, the server will respond with JSON like this:

```
{
  "name": "mypointcloud.laz",
  "path": "\/var\/www\/pointscene\/pointclouds\/dev-7d5c05\/cloud-482b13\/upload\/128k.las",
  "size": 131072,
  "OK": 1,
  "debug": [
    "mypointcloud.laz"
  ]
}
```

*Done !* You can now steer the user to edit their pointcloud on the Pointscene.com web interface via the edit link.

### Putting it together

Here's how the entire interaction looks like as an interactive CLI implementation:

```
$ ./pointscene mypointcloud.laz
Pointscene.com account (<account>.pointscene.com): dev
login: antti
password:
Login successful!
Enter a name for your new pointcloud [New Pointcloud]: My Awesome Pointcloud
Please select upload server location [0]:
0) London
1) Helsinki
Uploading mypointcloud.laz to https://data1.pointscene.com/api/...
........
Upload successful!
View your new pointcloud: https://dev.pointscene.com/wp-admin/post.php?post=413&action=edit
```

