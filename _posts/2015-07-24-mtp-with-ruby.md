---
layout: post
title: The Perfect Exchange - MTP with Ruby
tags:
- mtp
- ruby
- photos
- media
---

I've been playing around with the two different ruby options for speaking MTP. I'm documenting my process/learnings in this post so that I don't forget them. (Since it will likely be another month or two before I come back to this.)

<!--more-->

### Options

* [Ruby LibMTP][1] - A ruby library that wraps libmtp. (Not in gem form, requires non-standard installation.)
* [rubymtp][2] - Similar to Ruby LibMTP, but _is_ in gem form.

Ruby LibMTP appears to follow the C library very closely, which I like. rubymtp deviates a little more and establishes its own conventions. I'd prefer to use Ruby LibMTP just because it's closer to the C library.

Ruby LibMTP's rubyforge page has lots of broken links. :( After a while, I was able to find what appears to be a [GitHub mirror][3] of the project.

### Installation

1. Install necessary dependencies: `libmtp`, `libusb`, `libusb-compat`.

```bash
brew install libmtp libusb libusb-compat
```

2. Clone the code:

```bash
git clone https://github.com/dejitaiza/rubyMTP
```

3. Install

```bash
cd rubyMTP
ruby setup.rb
```

It only works with ruby 1.9.3 for me. I was able to install it on OS X a month ago or so, but now I can't get it to install again. (shrug)

### Testing

I've tried a few different sample programs with Ruby LibMTP on linux and OS X with varying degrees of success. Some really simple programs cause segfaults on both OSes. :(

For example, attempting to run this program on OS X:

```ruby
require 'device/LibMTP'

$stdout.sync = true

LibMTP::connect do |device|
  puts "\n\nFolders:"
  device.folder_list do |folder|
    puts folder['name']
  end
end
```

Produces this output:

```
➜  ruby git:(master) ✗ ruby ruby-libmtp-sandbox.rb
Device 0 (VID=22b8 and PID=2e82) is a Motorola Moto G (ID2).
libusb_get_active_config_descriptor(1) failed: No such file or directory
no active configuration, trying to set configuration
Android device detected, assigning default bug flags


Folders:
ruby(9685,0x7fff7103b300) malloc: *** error for object 0x7ff8aa5701e5: pointer being freed was not allocated
*** set a breakpoint in malloc_error_break to debug
[1]    9685 abort      ruby ruby-libmtp-sandbox.rb
```

Looks like something is being double-`free()`'d. Just as a sanity check, I ran a C program to perform the same function:

```c
/**
 * Simple C program to connect to an MTP device and list the folders that it
 * contains.
 *
 * Compile on OS X:
 *
 * gcc -o folder-listing `pkg-config --cflags --libs libmtp` folder-listing.c
 *
 */

#include <libmtp.h>
#include <stdlib.h>

LIBMTP_mtpdevice_t *device;
LIBMTP_folder_t *folders;

void dump_folder_list(LIBMTP_folder_t *folderlist, int level) {
  int i;
  if(folderlist==NULL) {
    return;
  }

  printf("%u\t", folderlist->folder_id);
  for(i=0;i<level;i++) printf("  ");

  printf("%s\n", folderlist->name);

  dump_folder_list(folderlist->child, level+1);
  dump_folder_list(folderlist->sibling, level);
}

int main(int argc, char* argv[]) {

  printf("Initializing LIBMTP...\n");
  LIBMTP_Init();

  device = LIBMTP_Get_First_Device();
  if (device == NULL) {
    printf("No devices.\n");
    return 0;
  }

  folders = LIBMTP_Get_Folder_List(device);

  dump_folder_list(folders, 0);

  LIBMTP_Release_Device(device);
}
```

When I run this program, I get the expected folder listing for my device:

```
➜  libmtp git:(master) ✗ ./folder-listing
Initializing LIBMTP...
Device 0 (VID=22b8 and PID=2e82) is a Motorola Moto G (ID2).
libusb_get_active_config_descriptor(1) failed: Undefined error: 0
no active configuration, trying to set configuration
Android device detected, assigning default bug flags
1   Music
45    Frozen (Original Motion Picture Soundtrack)
2   Podcasts
3   Ringtones
4   Alarms
...
```

Ruby LibMTP is using the same `LIBMTP_Get_Folder_List` function to implement `device.folder_list`, so this just gives me more confidence that the bug isn't in libmtp itself. Additionally, I've found lots of evidence online of issues like this that tend to happen frequently in Ruby C extensions. The most helpful/in-depth of these is [here][4].

### Conclusion

It appears that the fault lies in one of two places:

1. The Ruby LibMTP project itself isn't being a good citizen. It's C code is written in such a way that the Ruby garbage collector is cleaning things up before they should be. (Or doing it more often than it should be.) If this is indeed the issue, I may be in for some seriou debugging work.

2. The Ruby interpreter itself has a bug. If this is the case, then hopefully it would be fixed by updating Ruby LibMTP to run under ruby 2.2.0. I'm not sure how difficult that would be, but perhaps it's an option.

Right now, I think I need to learn more about how Ruby C extensions are built. What kind of rules are they supposed to follow? (And does Ruby LibMTP conform?) How difficult would it be to bring it up to date with Ruby 2.2.0?

[1]: http://libmtp.rubyforge.org/
[2]: https://rubygems.org/gems/rubymtp/versions/0.1
[3]: https://github.com/dejitaiza/rubyMTP
[4]: http://blog.packagecloud.io/eng/2014/11/17/debugging-ruby-gem-segfault/