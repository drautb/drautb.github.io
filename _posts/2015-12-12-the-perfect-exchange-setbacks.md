---
layout: post
title: The Perfect Exchange - Setbacks
tags:
- the perfect exchange
- firebase
- haystack
- photos
- media
- ffmpeg
- mtp-tools
---

I've been doing a lot of hands-on testing of the indexer lately. I've been running it on my Raspberry Pi, and starting to work on a simple frontend to browse the media. As I've been doing this, I've hit a few major hiccups.

The first had to do with generating thumbnails for videos. Although it worked flawlessly when I ran the code on my laptop, when I tried to use `ffvideo.VideoStream` to get a video thumbnail on the Raspberry Pi, it segfaulted. :'(

I managed to work around that one by just using `ffmpeg` directly to get a thumbnail:

```
ffmpeg -i input.mp4 -vframes 1 -ss 0 -vf scale="'if(gte(iw,ih),128,-1)':'if(gte(iw,ih),-1,128)'" thumb.jpg
```

That command will get a single frame (`-vframes 1`) at time 0s, and scale it to be no larger than 128x128 while maintaining the aspect ratio.

<!--more-->

That next one is a bit more of a pain. In an earlier post, I described how I was going to use PyMTP to transfer files from MTP devices to the indexer. Well, guess what? Yep, it works just fine on my laptop, but segfaults on the Raspberry Pi. :'( 

The C libraries and CLI tools for MTP work just fine, however. Rather than try to fix PyMTP, I'm leaning towards using the different CLI tools, and then parsing their output to get the data that I want. 

* Device Detection: `mtp-detect`
* Get Folder List: `mtp-folders`
* Get File List: `mtp-files`
* Download File: `mtp-getfile [file id] [destination file]`
* Delete File: `mtp-delfile -n [file id]`

Parsing the output of a couple of the folders/files listings could be a bit hairy, but I honestly think it would be faster than trying to fix PyMTP. We'll see how it goes.



