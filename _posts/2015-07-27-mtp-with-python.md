---
layout: post
title: The Perfect Exchange - MTP with Python
tags:
- mtp
- python
- photos
- media
---

Trying to speak MTP in Ruby was giving me enough of a headache that I started looking for other options. (Again) I happened upon [PyMTP][1], which is looking really good right now. It comes with a sample program that displays a bunch of info about the connected device, including the name and a folder listing! (Both of which caused segfaults in the ruby libraries) 

There is also a [python package][2] for communicating with Firebase!

<!--more-->

I just installed PyMTP with `pip`:

```
pip install pymtp
```

Since it appears that speaking MTP is no longer an issue, I'm going to use this post as a study for locating media files on the device.

MTP's view of the world is pretty flat. When querying a device, you can get a list of all the files, or a list of all the folders. You have to reconstruct their hierarchical relationship using parent id numbers. I wrote a simple program to list all the files under the `DCIM` directory on my phone:

```python
from sets import Set
import pymtp

def get_dcim_folder_id(device):
  for folder in device.get_parent_folders():
    if folder.name == "DCIM":
      return folder.folder_id

def get_child_folders(device, parent_folder_id):
  folder_ids = Set([parent_folder_id])

  all_folders = device.get_folder_list()

  current_length = len(folder_ids)
  new_length = None
  while current_length != new_length:
    current_length = len(folder_ids)

    for key in all_folders:
      f = all_folders[key]
      if f.parent_id in folder_ids:
        folder_ids.add(f.folder_id)

    new_length = len(folder_ids)

  return folder_ids

def get_picture_file_list(device, folder_ids):
  picture_files = []
  for f in device.get_filelisting():
    if f.parent_id in folder_ids:
      picture_files.append(f)

  return picture_files

# Connect to device
device = pymtp.MTP()
device.connect()

print "\nConnected to device: %s" % device.get_devicename()

dcim_folder_id = get_dcim_folder_id(device)
print "DCIM folder id: %s" % dcim_folder_id

folder_ids = get_child_folders(device, dcim_folder_id)
print "Folder Ids: %s" % folder_ids

picture_files = get_picture_file_list(device, folder_ids)
for f in picture_files:
  print "Picture: %s - %s" % (f.filename, f.filesize)
```

And here's the output:

```
Device 0 (VID=22b8 and PID=2e82) is a Motorola Moto G (ID2).
PTP_ERROR_IO: failed to open session, trying again after resetting USB interface
LIBMTP libusb: Attempt to reset device
inep: usb_get_endpoint_status(): No such file or directory
outep: usb_get_endpoint_status(): No such file or directory
Android device detected, assigning default bug flags

Connected to device: None
DCIM folder id: 9
Folder Ids: Set([9L, 34L, 203L, 970L])
Picture: IMG_20150727_123625444.jpg - 2911526
Picture: IMG_20150727_123616712.jpg - 3077009
```

There are only a couple pictures on my phone right now, so there's not much in the output. I'm just thrilled that it didn't segfault! :)

[1]: https://pypi.python.org/pypi/PyMTP
[2]: http://ozgur.github.io/python-firebase/