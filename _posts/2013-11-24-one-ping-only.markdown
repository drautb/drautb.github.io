---
layout: post
title: One Ping Only
tags:
- gamedev
- cs470
- artificial intelligence 
---

I'm taking CS 470 this semester at BYU. It's an introductory course to
artificial intelligence. All of our projects are centered around this game
called bzrflag. It's a game of capture the flag with multiple teams of tanks
that can drive around the world and shoot at each other. 

<!--more-->

For our first project, we created a system for helping our tanks navigate
around the game world. Each tank had access to a list of all the obstacles in
the world, so it was easy for it to just drive around them. In real life
though, this is unrealistic. Unless you're dealing with a controlled
environment, most robots won't just know where obstacles are. Instead, they're
equipped with all kinds of sensors to help them figure out where obstacles are.
This presents a new problem though, because sensors aren't perfect. There is
always some measure of "noise" involved, meaning that the sensor doesn't always
tell the truth. 

It turns out that some smart people have figured our some special probability
models to filter out the noise in such sensors. This is what we had to do in
our latest project. Our tanks had a "sensor" that would give some sort of
feedback about the state of the world, and we had to use a [grid filter][1] to
filter out the noise and create a model of the actual environment. 

The grid filter basically combines multiple sensor readings and eliminates the
noise based on known probabilities about how much noise the sensor reading
contains. Here are some pictures to illustrate:

Here's what the game world actually looks like: 

![](/assets/img/bzrflag-world.png)

You can see each of the four teams bases on each side. The red tanks on the
left are going to explore the world in the demo. 

When the tanks first start exploring, here's what their radar looks like:

![](/assets/img/grid-filter-1.png)

Their radar scans the world pixel-by-pixel, so the color of each pixel tells
you what the tanks believe about that pixel. It's a whole spectrum from white
to black. The whiter the pixel is, the more confident the tanks are that
nothing is there. The blacker the pixel is, the more confident the tanks are
that there IS something there. Gray pixels mean that the tanks have no idea
what is there, so that's why most of the world is gray at first.

Here are a few more scans after some more time.

![](/assets/img/grid-filter-2.png)

![](/assets/img/grid-filter-3.png)

By the time they've explored most of the world, you can see they have a pretty
solid idea of where the obstacles are. Cool, right?

[1]: http://en.wikipedia.org/wiki/Recursive_Bayesian_estimation
