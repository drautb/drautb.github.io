---
layout: post
title: The Perfect Exchange - Architecture Evaluation
tags:
- the perfect exchange
- firebase
- haystack
- photos
- media
---

I've been working on the indexer a lot lately, I think it's almost ready to start using! I ran a couple of dry runs over the weekend just for images, and it did its job just fine. 

I've been working a little more on video support. I had to get [`ffmpeg` compiled for the Raspberry Pi][1], and work through a few more issues, but I'm getting close. My goal is to be able to start using it for real by mid-December.

<!--more-->

Since the indexer is nearing completion, I've been thinking a little more about the next component to start on. In my [original architecture][2], there were four software components:

* The Indexer
* File Server
* REST API
* Web Frontend

The Indexer is almost done. The file server is dead simple. (`python -m SimpleHTTPServer`) That leaves the REST API and the Web Frontend. 

Originally, I didn't want to have to worry at all about security at all. Security was controlled by access to my home network. Hence, the REST API would have a secret key that allowed it to access the Index, and then it would basically provide RO access to all of the information.

Looking at the design again, that seems a little odd. I think I was just excited because I wanted to write the REST API in [`Racket`][3]. Why not just write the web frontend to read directly from the index? Firebase is designed for that kind of interaction. 

Additionally, my wife would like the ability to 'star' pictures, or otherwise mark them. (She'd like to print her favorite pictures from each year and put them in a physical album.) That means the web frontend now needs write access to the index, which means that an anonymous public API is no longer an option.

My working plan right now is to ditch the REST API, and have the frontend talk to the Index directly. I can implement some coarse grained security rules on the index to only allow access from our Gmail accounts. Then again, I don't really want to create a Google app just for this, especially when my family is the only user.

Perhaps I'll just generate a JWT and think of a clever way to make it transparent to my wife. :)

[1]: https://www.bitpi.co/2015/08/19/how-to-compile-ffmpeg-on-a-raspberry-pi/
[2]: /2015/06/28/the-perfect-exchange/
[3]: http://racket-lang.org/


