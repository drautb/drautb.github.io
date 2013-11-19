---
layout: post
title: This has been...Sublime
---

After a chance discussion with a friend of mine, and a positive test-run on my
work computer, I decided this week to reformat my hard drive and install Ubuntu
13.04. No dual-booting, no Windows VMs, just Ubuntu. I’ve been super pleased
with it so far: it’s much faster and less buggy than the last time I tried it,
and I haven’t been able to come up with any need that it can’t meet. Hooray.

Part of the reason I had been hesitant to leave Windows was Visual Studio. I
like it. A lot. (Minus its slothfulness on my machine) I had never been able to
find a comparable editor, IDE or build system for Linux that I was comfortable
with. (I had written makefiles for some school courses, and tried to use them
in personal projects before. No thanks!)

A few weeks ago though, I decided to give Sublime Text a serious go. I had used
it a bit before, and it had some neat features, but I hadn’t really tried to
get into it. After watching some video tutorials though, I was thoroughly
convinced.

I abandoned the behemoth that is Visual Studio. For editing at least. I used
Sublime’s build system to invoke the Visual Studio compiler, and continued on
my merry way, overjoyed by pretty much everything about Sublime. Now if only
there was a way around maintaining makefiles if I switched to Linux...

Enter CMake. It’s a cross-platform meta-build system, and I love it. I give
CMake a pretty simple file describing my project, and it generates build files
for whatever system I’m on. Solutions for Visual Studio, XCode Projects, and of
course, makefiles. Practically zero build system maintenance, more time to
code, I’m a happy camper. It even locates third-party libraries you want to use
automatically. The only downside is that “Getting Started” guides are a bit
sparse, but it’s not too bad.

So here I am on Ubuntu, using Sublime Text and CMake for all my development
needs. No more 5 minute waits for Visual Studio to get going, or intermittent
30 second freezes on Windows. Life is good.
