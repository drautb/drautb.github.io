---
layout: post
title: Sometimes, Magic
tags:
- gamedev
- gflw
- gcc
- c++11
- bugs
---

I decided a while back that I was going to use GLFW for Greebles. It’s
lightweight, cross-platform, meets the needs, all that jazz. But, doggone it,
they just had a major release, so I figured I’d better get up to speed with the
changes. As a study in preparation for Greebles, I decided to port a game I’d
written using GLFW 2.8 in Windows, to Linux, and update it to use GLFW 3.0. So
that’s what I’ve been working on lately, and it’s just about done. Just minor
fixes left. (Hopefully) As a sidenote, you can check it out on github.

Here’s the exciting part. After updating the code to use GLFW 3.0, I got this
weird bug. The camera wouldn’t follow Calvin around. I started printing out
some debug data to see what was happening. The camera would correctly adjust
it’s position, but when execution came back around, it was right back where it
started. Da heck?

I decided I’d better brush up on my GDB skills and see what’s really going on,
but when I fired up GDB, it told me it couldn’t locate any debugging symbols.
Oh yeah, I was compiling for Release, better switch that to Debug. Fire it up
aaand….

![](http://media.tumblr.com/0b51b9ac044e062857f4d4a26effca1a/tumblr_inline_mh96lzPhzc1qz4rgp.gif)

The bug is gone. Da heck??

It hit me that I had a big problem. Bugs like this have been nightmares for me.
Typically, you write some piece of code that isn’t really standard, so when you
compile your code for Release and the compiler attempts to optimize it, you get
crazy stuff happening!

So I started doing research, trying to figure out where it could be coming
from. I found this. Apparently, complete support for C++11 doesn’t arrive until
GCC 4.8. I check my version, I have 4.7. Ahhhh, this could be something. Found
this next. I installed GCC 4.8 and rebuilt everything and tried again in both
Debug and Release. And you know what?

![](http://media.tumblr.com/0b51b9ac044e062857f4d4a26effca1a/tumblr_inline_mh96lzPhzc1qz4rgp.gif)

The bug is gone. Da heck? :)
