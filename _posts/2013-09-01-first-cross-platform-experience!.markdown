---
layout: post
title: First Cross-Platform Experience!
tags:
- cross platform
- gamedev
- greebles
- cmake
---

This week, for the first time, I attempted to build the Greebles project on Mac
OS X. I’m happy to say that I didn’t have too many surprises. Here’s what I
learned:

On OS X, every piece of software that runs as anything more than a console
program, must be bundled as an OS X App. Thankfully, CMake makes this really
easy! Here’s all it takes to tell CMake to generate an OS X App for the Setup
Dialog:

<!--more-->

```cmake
set(MACOSX_BUNDLE_NAME setup) 
add_executable(setup MACOSX_BUNDLE ${SETUP_SRCS})
target_link_libraries(setup ${SETUP_LIBS})
set_target_properties(setup PROPERTIES MACOSX_BUNDLE TRUE)
# REST OF CMAKE
```

And with that CMake will compile your executable, and place it in an OS X App
that you may then launch as you would any other.

The other thing I learned, was that OS X Apps are not meant to receive
arguments on the command line. Oops. I had built a couple of the dialogs to
rely on those. Time to refactor. :)
