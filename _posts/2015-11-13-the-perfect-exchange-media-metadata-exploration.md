---
layout: post
title: The Perfect Exchange - Media Metadata Exploration
tags:
- python
- photos
- videos
- metadata
- media
- the perfect exchange
---

I have a little time tonight to work on this some more. When I left it last, I was a little bit stuck on dealing with different media formats, especially determining when they were created/recorded, and how to generate thumbnails. I'm going to do some exploring tonight, and take notes here.

<!--more-->

## Devices

* Moto X (Smartphone)
  - Pictures: `.jpg`
  - Videos: `.mp4`
* Moto G (Smartphone)
  - Pictures: `.jpg`
  - Videos: `.mp4`, and one random `.3gp`?
* Sony Handycam (HDR-CX380)
  - Pictures: ?
  - Videos: `.mts`

I think it's fine to leave photos in `.jpg` format. For videos, I think `.mp4` would be good. It's pretty common, and is also playable by web browsers. (In my experience.)

## Python Libraries

* [ExifRead][1]
* [ExifTool][6]
* [PyExifTool][7] (Python wrapper for `exiftool`)
* [Hachoir Metadata][2]

## Converting `.mts` to `.mp4`

Hachoir can't provide metadata for `.mts` files:

```
➜  From Video Camera  hachoir-metadata 00001.MTS
[err!] Unable to parse file: 00001.MTS
```

I'd like all the videos to be in `.mp4` format, just for consistency and ease of use. After some googling, it appears the easiest way to convert them is to use `ffmpeg`. 

```
ffmpeg -i input.mts -threads 4 -f mp4 output.mp4
```

This worked pretty well. The color was ever so slightly different, but other than that, the integrity to the original was good. It was slightly concerning how long/much juice it took to convert it. I should run a few on the Raspberry Pi and see how it holds up.

[How to install `ffmpeg` on a Raspberry Pi][5].

## Reading Metadata

I already know that I can use ExifRead to get the date taken from a `.jpg`, but it doesn't work for video files. I'm hopeful about Hachoir Metadata though. I tried to do some tests using [this gist][3], but it couldn't parse the `.jpg` files from the Moto X:

```
[warn] Skip parser 'JpegFile': Unknown chunk type: 0xE6 (chunk #2)
Unable to parse file
```

Huh? Hachoir Metadata has a CLI, so I decided it would be faster to sample some different media files that way. When I use that on the same `.jpg` files, I get a similar result:

```
➜  Camera (Moto X)  hachoir-metadata IMG_20150810_220158824.jpg
[err!] Unable to parse file: IMG_20150810_220158824.jpg
```

Sad. Video (`.mp4`) from my phone:

```
➜  Camera (Moto X)  hachoir-metadata VID_20151012_182527784.mp4
Metadata:
- Duration: 1 min 13 sec 920 ms
- Image width: 1920 pixels
- Image height: 1080 pixels
- Creation date: 2015-10-13 00:26:44
- Last modification: 2015-10-13 00:26:44
- Comment: Play speed: 100.0%
- Comment: User volume: 100.0%
- MIME type: video/mp4
- Endianness: Big endian
```

Success! The results were the same for the Moto G. It worked for `.mp4`s and the one `.3gp`, but not `.jpg`s. Interestingly, it _did_ work for `.jpg`s that I took from my previous phone. (Nexus 4)

As I mentioned above, ExifRead _does_ work on those `.jpg` files. It's odd that Hachoir doesn't. I could use both libraries, but I'd prefer to just use one if possible.

I also noticed that when I tried to get the metadata for `.mp4` files that had been converted from `.mts`, that the creation date was incorrect:

```
➜  From Video Camera  hachoir-metadata video.mp4
Metadata:
- Duration: 1 min 29 sec 152 ms
- Image width: 1920 pixels
- Image height: 1080 pixels
- Creation date: 1904-01-01 00:00:00
- Last modification: 1904-01-01 00:00:00
- Comment: Play speed: 100.0%
- Comment: User volume: 100.0%
- MIME type: video/mp4
- Endianness: Big endian
```

Bummer. `hachoir-metadata` doesn't work on the raw `.mts` files either. `exiftool` does however work:

```
➜  From Video Camera  exiftool 00001.MTS
File Name                       : 00001.MTS
File Size                       : 103 MB
File Modification Date/Time     : 2014:04:22 10:42:00-06:00
File Access Date/Time           : 2015:11:16 08:42:22-07:00
File Inode Change Date/Time     : 2015:11:13 23:01:21-07:00
File Type                       : M2TS
File Type Extension             : mts
MIME Type                       : video/m2ts
Video Stream Type               : H.264 Video
Audio Stream Type               : A52/AC-3 Audio
Audio Bitrate                   : 256 kbps
Surround Mode                   : Not indicated
Audio Channels                  : 2
Image Width                     : 1440
Image Height                    : 1080
Date/Time Original              : 2014:04:22 10:40:31-05:00
...
```

So why can't `ffmpeg` see that information? Don't know. I can use `exiftool` to get the origination date, and then manually set that on the converted `.mp4`.

```python
import exiftool

et = exiftool.ExifTool()
et.start

metadata = et.get_metadata('video.mts')
```

The date that exiftool returns looks like this: `YYYY:MM:DD HH:MM:SS`. But for `ffmpeg` it needs to be like `YYYY-MM-DD HH:MM:SS`, plus figuring out timezone stuff.

```
ffmpeg -i video.mts -threads 4 -f mp4 -metadata creation_time="2014-04-22 10:40:31" out.mp4
```

## Generating Video Thumbnails

I found a [Stack Overflow question][4] that had some good responses. This appears to work pretty well:

```python
from ffvideo import VideoStream

pil_image = VideoStream('video.mts').get_frame_at_sec(0).image()
pil_image.save('thumbnail.jpg')
```

The only downside was that it didn't preserve the aspect ratio. The thunmbail was 4:3, while the original video was 16:9. The `ffvideo` homepage shows an example that scales it automatically, it seems to work pretty decently:

```python
from ffvideo import VideoStream

vs = VideoStream('video.mp4',
                 frame_size=(128, None),  # scale to width 128px
                 frame_mode='RGB')

frame = vs.get_frame_at_sec(0)
frame.image().save('thumb.jpg')
```

## Summary

For Images:

* No conversion is necessary. 
* Use `exiftool` to get the date taken.
* Use PIL to generate a thumbnail.

For Videos:

* `.mts`
  - Need to convert to `.mp4`.
  - Use `exiftool` to get the date taken, and manually set in in the metadata in the `ffmpeg` conversion command.
* `.mp4`
  - Use `ffvideo` to extract thumbnail.

So, we need `exiftool`, `PyExifTool`, `ffmpeg`, and `ffvideo`. 


[1]: https://pypi.python.org/pypi/ExifRead
[2]: https://pypi.python.org/pypi/hachoir-metadata
[3]: https://github.com/jgstew/file-meta-data/blob/master/file_meta_data.py
[4]: http://stackoverflow.com/questions/1772599/creating-thumbnails-from-video-files-with-python
[5]: http://www.jeffreythompson.org/blog/2014/11/13/installing-ffmpeg-for-raspberry-pi/
[6]: http://www.sno.phy.queensu.ca/~phil/exiftool/
[7]: https://smarnach.github.io/pyexiftool/