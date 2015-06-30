---
layout: post
title: The Perfect Exchange - MTP
tags:
- mtp
- raspberry pi
- photos
- media
---

I've been learning more about MTP as I start thinking about how I want to implement the indexer. I'm just going to do a brain dump here.

<!--more-->

### Resources

* [MTP 1.1 Spec][5] - Looks like a good resource.
* [`libmtp`][1] - A C library for interacting with MTP devices. I could use this to write the indexer, but talking to the Firebase index would be painful.
* [Ruby LibMTP][3] - A ruby library that wraps libmtp. This is attractive because there is also a [ruby gem][4] for talking to Firebase. The downside is that the libmtp wrapper isn't in Gem form.
* [rubymtp][6] - Supposed to be better to work with than Ruby LibMTP? (This _is_ a gem.)
* [MTP - ArchWiki][2] - ArchWiki's page describing how to get a linux system to automatically recognize MTP devices. I'll need to set this up on the indexer to avoid having to manually intervene.

Something interesting that I found: libmtp only supports connecting to the first device that it finds. (So I can only have one MTP device plugged in at a time.)

### Conclusions

* I'm going to need to do all my testing and development on a linux box. OSX is different enough that it's not going to cut it here.
* The indexer will only be able to handle one MTP device at a time.
* I need to experiment with both Ruby LibMTP and rubymtp to see which one meets my needs, or which I prefer if they both will work.

And just a random final thought I had: it would be slick if the Pi could give some kind of visual feedback to signal that indexing for a device is complete.

[1]: http://libmtp.sourceforge.net/
[2]: https://wiki.archlinux.org/index.php/MTP
[3]: http://libmtp.rubyforge.org/
[4]: https://github.com/oscardelben/firebase-ruby
[5]: http://www.usb.org/developers/docs/devclass_docs/MTPv1_1.zip
[6]: https://rubygems.org/gems/rubymtp/versions/0.1