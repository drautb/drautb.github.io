---
layout: post
title: The Perfect Exchange - Index Exploration
tags:
- firebase
- haystack
- photos
- media
---

I'm getting ready to actually start building the indexing componenents of Haystack, but I'm still not settled on the Firebase schema. I want to refresh my memory on best practices for the data model, and test a few of the different kinds of queries I want to be able to do.

<!--more-->

## Original Data Model

This was the original data model that I threw out:

```json
{
  "photos": {
    "[unique id]": {
      "pathToArtifact": "media/pictures/[year]/[month]/[day]/[hash].jpg",
      "pathToThumbnail": "media/thumbnails/[year]/[month]/[day]/[hash].jpg",
      "dateTaken": "1438088526",
      "dateIndexed": "1438078510",
      "sourceDeviceId": "4l3kjlsdkj",
      "hash": "[hash]"
    }
  },
  "videos": {
    [Same as photos]
  }
}
```

We'll see if that is stil sufficient.

## Queries

There is basically one query that the UI will need to do:

* Retrieve all media by date/time range, using the date/time the media was taken. (Not necessarily the time it was indexed) 
  - Filter by media type. (photo/video)
  - Filter by device. (Ben's Moto X, Brittney's Moto G, USB, etc?)

Perhaps I won't separate the media in the tree by photo/video. I think I could just do it all in one tree and then have a type attribute on each piece of media.

The index will also need to be able to quickly determine if a given hash already exists in the index:

* Is there a media item in the index with a specified hash?

## Revised Data Model/Security Rules

Sample Entry:

```json
{
  "media": {
    "[unique id]" {
      "pathToMedia": "media/pictures/[year]/[month]/[day]/[hash].jpg",
      "pathToThumbnail": "media/thumbnails/[year]/[month]/[day]/[hash].jpg",
      "dateTaken": "1438088526",
      "dateIndexed": "1438078510",
      "sourceDeviceId": "4l3kjlsdkj",
      "hash": "[hash]",
      "type": "image"
    }
  }
}
```

Security Rules:

```json
{
  "rules": {
    "media": {
      ".indexOn": ["dateTaken", "hash"]
    }
  }
}
```

We don't need to index the `dateIndexed` field, because that information is implicit in the ordering created by `push()`.

## Dummy Dataset

I want to generate a pretty large dataset to test some queries with. This script will generate 10,000 media objects using `push()` with randomly generated timestamps for `dateTaken` that fall in the last 10 years.

```js
var Firebase = require('firebase'),
    md5 = require('md5');

var mediaRef = new Firebase('https://haystack-index-dev.firebaseio.com/media');

var endDate = new Date(),
    startDate = new Date('1/1/05');

var tenYears = endDate - startDate;

for (n = 0; n < 10000; n++) {
  var generatedDate = new Date() - (Math.random() * tenYears);
  var timestampInSeconds = Math.floor(generatedDate / 1000);
  var type = Math.random() > 0.5 ? "image" : "video";

  var obj = {
    "pathToMedia": "original.xxx",
    "pathToThumbnail": "thumbnail.xxx",
    "dateTaken": timestampInSeconds,
    "dateIndexed": "today",
    "sourceDeviceId": "Ben's Laptop",
    "hash": md5(Math.random()),
    "type": type
  };

  mediaRef.push(obj);
}
```

The first dataset I generated _without_ the security rules that create the indicies. I'm curious to see what kind of performance increase they yield, or if it's noticeable with 10,000 items.

I ran some tests against two different firebases. One had `dateTaken` and `hash` indexed, the other didn't. This was the script: 

```js
var async = require('async'),
    microtime = require('microtime'),
    Firebase = require('firebase');

var slowRef = new Firebase('https://haystack-index-dev-s.firebaseio.com/media');
var fastRef = new Firebase('https://haystack-index-dev.firebaseio.com/media');

var start, end;
async.series([
    function(cb) {
        start = microtime.nowDouble();
        slowRef.orderByChild('dateTaken').limitToLast(5).once('value', function(_) {
            end = microtime.nowDouble();
            cb(null, "[NOT INDEXED] Time to get 5 most recent media: ".concat(end - start));
        });
    },
    function(cb) {
        start = microtime.nowDouble();
        fastRef.orderByChild('dateTaken').limitToLast(5).once('value', function(_) {
            end = microtime.nowDouble();
            cb(null, "[    INDEXED] Time to get 5 most recent media: ".concat(end - start));
        });
    },
    function(cb) {
        start = microtime.nowDouble();
        slowRef.orderByChild('hash').equalTo('cd80b489a3c5a12f4958e176414a66d5').once('value', function(data) {
            end = microtime.nowDouble();
            cb(null, "[NOT INDEXED] Time to locate existing hash: ".concat(end - start));
        });
    },
    function(cb) {
        start = microtime.nowDouble();
        fastRef.orderByChild('hash').equalTo('5b9a8175d5906fe1f17e99cd6b67f568').once('value', function(data) {
            end = microtime.nowDouble();
            cb(null, "[    INDEXED] Time to locate existing hash: ".concat(end - start));
        });
    },
    function(cb) {
        start = microtime.nowDouble();
        slowRef.orderByChild('hash').equalTo('bad').once('value', function(data) {
            end = microtime.nowDouble();
            cb(null, "[NOT INDEXED] Time to locate non-existent hash: ".concat(end - start));
        });
    },
    function(cb) {
        start = microtime.nowDouble();
        fastRef.orderByChild('hash').equalTo('bad').once('value', function(data) {
            end = microtime.nowDouble();
            cb(null, "[    INDEXED] Time to locate non-existent hash: ".concat(end - start));
        });
    }
], function(err, results) {
    results.forEach(function(result) {
        console.log(result);
    });
});
```

Here were the results:

```
FIREBASE WARNING: Using an unspecified index. Consider adding ".indexOn": "dateTaken" at /media to your security rules for better performance
FIREBASE WARNING: Using an unspecified index. Consider adding ".indexOn": "hash" at /media to your security rules for better performance
FIREBASE WARNING: Using an unspecified index. Consider adding ".indexOn": "hash" at /media to your security rules for better performance
[NOT INDEXED] Time to get 5 most recent media: 1.5327858924865723
[    INDEXED] Time to get 5 most recent media: 0.03738594055175781
[NOT INDEXED] Time to locate existing hash: 1.065133810043335
[    INDEXED] Time to locate existing hash: 0.03681206703186035
[NOT INDEXED] Time to locate non-existent hash: 1.1100189685821533
[    INDEXED] Time to locate non-existent hash: 0.03774213790893555
```

It looks like using the indexed fields is always at least 3 times faster.

This wasn't in the benchmark, (because keys are already indexed) but if I want to order by the date indexed, I could just order by the key that `push()` put in:

```js
var mediaRef = new Firebase('https://haystack-index-dev.firebaseio.com/media');

mediaRef.orderByKey().limitToLast(5).once('value', function(snapshot) {
    snapshot.forEach(function(data) {
        console.log(data.val());
    });
});
```

That doesn't let me do a range for the date indexed though, so maybe I should still index the `dateIndexed` field.

Also, the indexer is written in Python, not Node. I should have written all this stuff in Python. :P Oh well. It looks like the third-party Python lib is a thin wrapper for the REST API, which is fine. Here's how I would push a new media record in Python:

```python
from firebase import firebase

mediaRef = firebase.FirebaseApplication('https://haystack-index-dev.firebaseio.com', '<auth token>')

mediaData = {
  'pathToMedia': '/some/path/file.jpg',
  'pathToThumbnail': '/some/thumb.jpg',
  'dateTaken': 1449015095,
  'dateIndexed': 1449015095,
  'sourceDeviceId': 'Laptop',
  'hash': 'a2cb14e9bda8e63e8bf992fcc1ebe88d',
  'type': 'image'
}

mediaRef.post('/media', mediaData)
```

And here's how I can check to see if a file with a particular hash already exists:

```python
from firebase import firebase

mediaRef = firebase.FirebaseApplication('https://haystack-index-dev.firebaseio.com', '<auth token>')

parameters = {
    'orderBy': '"hash"',
    'equalTo': '"a2cb14e9bda8e63e8bf992fcc1ebe88d"'
}

result = mediaRef.get('/media', None, params=parameters)
```

Phew. This post is a little messy. Oh well. I like just noting my thoughts as I go and experiment.

