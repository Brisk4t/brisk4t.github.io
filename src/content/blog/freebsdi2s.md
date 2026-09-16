---
title: FreeBSD I2S
description: Writing a FreeBSD I2S Driver for the Raspberry Pi 
longDescription: Writing a FreeBSD I2S Driver for the Raspberry Pi
pubDate: 2026-09-07T12:30:00Z
heroImage: https://upload.wikimedia.org/wikipedia/commons/0/0e/FreeBSD_13.0_boot_loader_autoboot_screenshot.png
tags: [raspberry pi, FreeBSD, i2s]
---


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

```ofwdump -pr /soc/i2s@7e203000``` reveals all....
