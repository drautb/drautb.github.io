---
layout: post
title: Keep Moving Forward
---

I’ve been working diligently on Greebles for most of the weekend, I’m happy
with the progress I’ve made. Development seems so easy in Sublime with CMake
under Ubuntu.

So, quick overview of the whole Greebles project. There are three separate
“Programs” I’m writing: 1) The game itself, 2) A “Setup” program, 3) A “Custom
Settings” program. The second two are just GUI forms for configuring the game
settings. I’m going to finish two and three before one, and two before three.

So I should have ordered them like this:

* Setup Program
* Custom Settings Program
* Game

I’ve been cruisin’ on Setup this weekend. I decided to store all game data in a
sqlite database that all three programs could share, so I finished designing
the Setup part of the database, and have been coding up the Setup GUI. Here’s a
quick preview:

![](/assets/img/setup-screenshot.png)

I’m using wxWidgets for the form GUIs, plus wxFormBuilder to help design them
and generate some of the code. Right now only the sound/music/difficulty
settings actually get saved, I’m hoping to finish up the rest in the next week
or two.

One of the challenges I faced this week had to do with the checkboxes next to
each players name, signifying whether or not that player is going to play. In
wxWidgets, checkboxes have to have a label next to them. If you specify an
empty string “” for the label, no text shows up, but clicking the checkbox
still highlights this empty area next to it…kind of ugly. Thankfully, someone
whipped up a wxWidget Checkbox component that doesn’t use a label, problem
solved!
