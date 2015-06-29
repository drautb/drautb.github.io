---
layout: post
title: References and Values in Javascript
tags:
- javascript
- plt
---

Does Javascript pass things by reference or value? Today, the fact that I did not understand answer to this question caused me a real headache, so I'm going to blog about it with some code samples that are closer to what I was actually doing. [Here's another good response][1]. 

<!--more-->

Let's take this example:

```javascript
var myObject = {
    data: {
        v1: 42,
    },
    
    myFunc: function () {
        var localV1 = this.data.v1;
        console.log(this.data.v1);
        localV1 = 43;
        console.log(this.data.v1);
    }
};

myObject.myFunc();
```

This will print out:

```
42
42
```

The value of `myObject.data.v1` didn't change! (This is where my frustration came from) Here's why: Javascript passes everything by value, but sometimes those values are actually references. This means that if you change the value directly, you're overwriting the reference, which probably isn't what you want.

In the example, `localV1` is a reference to `myObject.data.v1`. When I assign 43 to `localV1` however, that reference is overwritten with the value 43. Its like I had a pointer, and then turned it into a primitive. (As far as I know, there isn't a way to directly dereference `localV1` to actually change the value it references.)

Let's change our example a little bit:

```javascript
var myObject = {
    data: {
        v1: 42,
    },
    
    myFunc: function () {
        var localData = this.data;
        console.log(this.data.v1);
        localData.v1 = 43;
        console.log(this.data.v1);
    }
};

myObject.myFunc();
```

This will print out:

```
42
43
```

Sweet! It worked! `localData` is now a reference to `myObject.data`, so when we do `localData.v1`, it is actually referring to `myObject.data.v1`, not overwriting the reference as before.  

[1]: http://stackoverflow.com/questions/518000/is-javascript-a-pass-by-reference-or-pass-by-value-language