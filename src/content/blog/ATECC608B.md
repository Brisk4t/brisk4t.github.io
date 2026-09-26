---
title: ATECC608B
description: Programming the ATECC608B CryptoAuth Chip 
longDescription: Programming the ATECC608B CryptoAuth Chip (Microchip hates this one simple trick!) 
pubDate: 2026-09-16T12:30:00Z
heroImage: https://raw.githubusercontent.com/Brisk4t/ToothPaste/main/hardware/ToothPaste_V2_Cover_Annotated_PCBWay.png
tags: [Cryptography, ATECC608B, I2C, Secure Element]
---

# The Cryptographic IC

In working on [ToothPaste V2](https://brisk4t.github.io/blog/toothpaste/) I thought it'd be pretty simple to integrate a cryptographic IC / secure element to move the ECDH keys off the ESP32-S3's flash and into an isolated memory space. 

This would make it impossible to extract private keys, shared secrets and other sensitive information even if you took the whole thing apart. 

The [ATECC608x](https://www.microchip.com/en-us/product/atecc608a) series of crypto ICs is a cute little product that promises to do exactly this.

### Adafruit ATECC608 Breakout
![Adafruit ATECC608 Breakout](https://cdn-learn.adafruit.com/assets/assets/000/080/272/medium800/adafruit_products_ATECC608_Top.jpg?1567193852)

However, what I realized a little too late after my crypto ICs arrived was that Microchip guards their little config utility behind a lot of tedium. But hey, you can't put the keys under the carpet if you're building a fortress. So I signed up for the process that **allows me to sign the NDA**..... and never heard back.



# Cut my losses? HAHAHAHAHAH.... No.

**I wasn't about to let some company change my plans and throw away the ICs that I had already bought.**

So i had to go down the rabbit hole of configuring things the hard way, by spelunking through the I2C commands sent by the open source [CryptoAuthLib](https://github.com/microchiptech/cryptoauthlib) library that Microchip provides. Does this help me configure the IC? No. But its a start to get an understanding of the language that the chip understands.

## But wait, why not just use CryptoAuthLib?

The first answer is that you could use the commands themselves but you have no idea what to do with them, what do the parameters do? What does a config zone look like?

And secondly, **because its fun to do things I'm not supposed to**.

So let's get to it.

## Spelunking CryptoAuthLib
Lets start with each packet that is sent to the chip

```cpp
{
    // used for transmit/send
    uint8_t reserved;   // used by HAL layer as needed (I/O tokens, Word address values)

    //--- start of packet i/o frame----
    uint8_t  txsize;
    uint8_t  opcode;
    uint8_t  param1;                       // often same as mode
    uint16_t param2;
    uint8_t  data[CA_MAX_PACKET_SIZE - 6u];// CA_MAX_PACKET_SIZE must accomodate data + 6bytes + crc(2bytes)
                                           // 6 bytes(1 byte reserved, 1 byte txsize, 1 byte opcode, 1 byte param1, 2 byte param2)
    // used for receive
    uint8_t execTime;                      // execution time of command by opcode

    // structure should be packed since it will be transmitted over the wire
    // this method varies by compiler.  As new compilers are supported, add their structure packing method here

} ATCAPacket;
```