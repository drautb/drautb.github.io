---
layout: post
title: The Perfect Exchange
tags:
- mtp
- raspberry pi
- photos
- media
---

We have two smartphones, a video camera, and countless digital photos from previous devices. Trying to keep them all organized is a mess. I've been thinking about building my own system to handle it all. 

<!--more-->

### User Interface

Ideally, I'd like something like this:

* I plug my phone/video camera/USB stick in at some docking station.
* My pictures and videos on the device are automatically moved to some central storage medium, indexed, and deleted from my device. (Duplicates are also deleted)
* Anytime I want to see my pictures and videos, I just go to a website that is only available on my home network, where I'm presented with a web UI that allows me to quickly browse thumbnails, view images and videos, or download them to whatever device I'm on.

Sounds simple enough to me. Now, how do I build it?

### Architecture

<iframe frameborder="0" style="width:100%;height:403px" src="https://www.draw.io/?chrome=0&gapi=0#DAtlas.html"></iframe>

At a high-level, I think all I'll need is a [Raspberry Pi][3] (perhaps a kit like [this?][5]) and a [1TB External HD][4]. 

The 4 software components will be the Indexer, File Server, REST API, and Web Frontend. 

Both the indexer and the file server will run on the Pi. The indexer is responsible for downloading media from devices to the external HD, and performing all indexing tasks, such as generating thumbnails and removing duplicates. The index itself will be hosted on [Firebase][6].

The file server will just serve static image files from the external drive, and will also run on the Pi. The files will be organized on the disk in a human-understandable fashion.

The REST API will be responsible for providing image metadata, such as date taken, URL, thumbnail URL, MD5 hash, etc. It will have access to the index in order to gather the information, and will be hosted on [Heroku][9].

The web frontend will just be a simple webapp to let me browse or search media. It will rely on the REST API to gather the data it needs, including image URLs. The file server will serve the image files directly, so the website will only work on my home network. There will be no security around the REST API or Frontend. 

### Questions

* [MTP][1] - This is how the indexer will have to communicate with Android phones. There is at least one [C library][2] that looks usable, but the indexer will also need to talk to the index in firebase, which could be painful in C. 
* What if my wife wanted to use her iPod to take pictures? I think I'd have to copy the pictures to a flash drive, and then plug that in to the indexer. Not pretty, but it could work. 
* How will the indexer decide where to look for media files on devices? On Android it should be pretty standard. For a USB drive though, it's not so obvious. I suppose I could just establish a canonical location. (`/to-be-indexed` or something.)

[1]: https://en.wikipedia.org/wiki/Media_Transfer_Protocol
[2]: http://libmtp.sourceforge.net/
[3]: https://www.raspberrypi.org/
[4]: http://www.amazon.com/Passport-Ultra-Portable-External-Drive/dp/B00E83X9P8/ref=sr_1_1?s=pc&ie=UTF8&qid=1435546761&sr=1-1&keywords=1tb+external+hard+drive&pebp=1435546794068&perid=09HNFGVYDR414B55APWF
[5]: http://www.amazon.com/Raspberry-Model-Starter-Case--Power-Supply/dp/B00TFV5QTA/ref=sr_1_8?s=pc&ie=UTF8&qid=1435546771&sr=1-8&keywords=raspberry+pi+2&pebp=1435546880173&perid=059SK3S7APTMNQ6YSJRA
[6]: https://www.firebase.com/
[7]: http://redis.io/
[8]: http://rethinkdb.com/
[9]: https://www.heroku.com/
