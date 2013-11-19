---
layout: post
title: wxWidgets and proper user of Connect()
---

I recently fixed a painfully subtle bug, and decided to share my experience for
all those who follow hereafter. In the main wxFrame class of the setup program
for Greebles, I have several data members that stored the information
represented on the GUI. Whenever a form component changes, it calls an event
handler that updates the internal data member.

When I started working on adding support to be able to do some drag and drop
stuff, I added a new event handler; but when this event handler tries to access
the relevant data members, suddenly everything was trashed! Pointers were
either null or pointed to garbage, and the program would segfault. I had no
idea why. The only thing I had seen before that may have matched the symptoms
was heap corruption. And I really didn’t want to believe that it was heap
corruption. I was double-checking all my pointers, I couldn’t see any way for
that to happen.

Well, I finally explained my problem on the wxWidgets forums, and got an answer
right off the bat. It turns out that the wxWidgets connect method, which is
used to connect component events to event handlers, needs to know the context
of the call. It needs to know the class that owns the event handler, also known
as the event sink. If you don’t give it one, it just uses the this pointer.

Typically, that works fine because you’re Connect()ing events in the class that
owns the event handler. But I was Connect()ing handlers to member components.
Because of that, Connect() thought that the member component was the one who
owned the event handler, when really it was the parent component. As soon as I
specified the correct event sink, the problem disappeared. Check out my forum
post for the code examples.
