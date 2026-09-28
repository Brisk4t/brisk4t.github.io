---
title: FreeBSD I2S
description: Writing a FreeBSD I2S Driver for the Raspberry Pi 
longDescription: Writing a FreeBSD I2S Driver for the Raspberry Pi
pubDate: 2026-09-07T12:30:00Z
heroImage: https://upload.wikimedia.org/wikipedia/commons/0/0e/FreeBSD_13.0_boot_loader_autoboot_screenshot.png
tags: [raspberry pi, FreeBSD, i2s]
links:
  - {label: FreeBSD Phabricator PR, url: https://reviews.freebsd.org/D57484}
---

# TL;DR: https://reviews.freebsd.org/D57484

# So..... Why?

It all started with me applying for Google Summer of Code (GSOC). For those who aren't familiar with it, GSOC is a Google venture to promote open-source contributions to several popular organizations. FreeBSD being one of them. Listed on the FreeBSD org's GSOC project page was this exact requirement - adding I2S audio support for the RPi 4.

Since you're (probably) reading this on a random github blog, suffice to say I didn't get in to GSOC. However, I don't really care. I wanted to write a kernel driver dammit!

![Raspberry Pi 4](https://www.raspberrypi.com/app/uploads/2019/06/HERO-ALT.jpg)

# Where do I even begin?

Very valid question for someone who's never written a kernel driver before (IMO).

Thankfully the GSOC project description did mention that Rockchip and AllWinner I2S drivers already existed and were working. So I thouhght it would be a copy-paste 20 minute adventure. **Boy was I wrong.**

After making a copy of the Rockchip driver and renaming the functions to ```BCM2835_*```, following the naming convention, I had my skeleton code.  

# Device Trees 

While I've never worked on kernel drivers, thankfully Zephyr had familiarized me with a rough idea of device trees, and since the Zephyr team got the idea from the Unix kernel architecture I was just learning in reverse.

For now I just needed to know 2 things:
- Which GPIO pins were used for I2S on the Raspberry Pi
- What the device tree node for I2S is called on the BCM2835


### So guess what... I read the DOCS


![BCM2711 Register Map](/blog/freebsdi2s/BCM2711Regmap.png)


So lets confirm that the kernel can see this register address.

```bash
$: ofwdump -a | grep i2s 
    Node 0x4424: i2s
Node 0x4a34: i2s@7e203000
```

Perfect, there's our i2s register at the exact address that the datasheet showed us.
So lets write a quick device tree to enable allow us to attach to it. 

```ofwdump -pr /soc/i2s@7e203000``` reveals all....

```bash
Node 0x4a34: i2s@7e203000
  interrupts:
    00 00 00 00 00 00 00 77 00 00 00 04 
  compatible:
    62 72 63 6d 2c 62 63 6d 32 38 33 35 2d 69 32 73 00 
    'brcm,bcm2835-i2s'
  reg:
    7e 20 30 00 00 00 00 24 
  clocks:
    00 00 00 08 00 00 00 1f 
  status:
    6f 6b 61 79 00 
    'okay'
  #sound-dai-cells:
    00 00 00 00 
  dmas:
    00 00 00 0c 00 00 00 02 00 00 00 0c 00 00 00 03 
  dma-names:
    74 78 00 72 78 00 
  pinctrl-names:
    64 65 66 61 75 6c 74 00 
    'default'
  pinctrl-0:
    00 00 00 0d 
  phandle:
    00 00 00 33 
```