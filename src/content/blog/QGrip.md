---
title: QGrip - AI Bionic Arm
description: Developing a myoelectric controlled AI bionic hand.
longDescription: Developing a myoelectric controlled AI bionic hand for advanced bionics research.
pubDate: 2026-09-28T12:30:00Z
heroImage: https://hackster.imgix.net/uploads/attachments/1990991/qgripcompressed_A2wWmnzTvg.gif
tags: [CNN, AI, Bionics, Arduino UNO Q, RTOS]
links:
    - { label: QGrip Github, url: https://github.com/ShriramRaghu-UofA/QGrip}
    - { label: Uno Q USB, url: https://github.com/Brisk4t/Uno-Q-USB}
    - { label: Shri's Blog, url: https://stpr-dev.github.io/}
---


>"Any sufficiently advanced technology is indistinguishable from magic" - Arthur C Clarke.
>
>Yeah but magic is expensive. 💰

Spend any amount of time in the field of modern prosthetics and bionics development and one thing becomes very clear - the technology to make a Johnny Silverhand / Winter Soldier esque bionic arm doesn't exist yet but not for the reasons the you'd expect. One of the biggest problems simply is that not enough people can get their hands (no pun intended) on the foundational components to ever iterate far enough or long enough for many breakthroughs.

![Winter Solder Arm](https://hackster.imgix.net/uploads/attachments/1991767/image_WwLm3RaCvQ.png)

There have been several successful attempts to create a smarter species of bionics that incorporate AI/ML in one way or another. Some of them are even relatively affordable. However they are very bespoke. Recreating them for any general environment / participant population would be quite the ordeal involving a LOT of people, over and over again.

- [Real-time Bionic Arm Control Via CNN-based EMG Recognition](https://www.hackster.io/emgarm/real-time-bionic-arm-control-via-cnn-based-emg-recognition-b013d3)
- [Machine-Learning-Based Muscle Control of a 3D-Printed Bionic Arm](https://www.mdpi.com/1424-8220/20/11/3144)
- [Using Deep Learning and Mobile Offloading to Control a 3D-printed Prosthetic Hand](https://dl.acm.org/doi/abs/10.1145/3351260)

Biomedical Engineering is a unique synthesis of several scientific disciplines where even the smallest teams often resemble a diversity of expertise that is more expected in a large organization.

- Engineers: Mechanical, Electrical, Biomedical
- Researchers: Machine Learning, Qualitative, Medical
- Clinical teams: Surgeons, Prosthetists, Occupational Therapists

And not to mention the bureaucratic overhead that comes with any medical R&D. So if any one of these people wants to test their own hypotheses, they need to recruit the others to even get started.

Yet as is often the case in tech, some of the best ideas come from hobbyists and tinkerers not massive teams. While I don't want any hobbyist doctors rushing to their nearest home depot, I believe we're at a point where we can at least help the tech nerds out.

**QGrip is a venture in trying to develop a "development arm"**, an accessible development platform for anyone try out their ideas without the friction of reinventing the wheel of prosthetics every single time while maintaining real-world constraints like low-power inference and <1ms response time.

# The Basics of Myoelectric Control 💪

### If you have an amputation, how do you tell what "hand open" means?

Regardless of if you're going ultra modern or old-school, the core principal in controlling any commercial digital prosthetic device has been myoelectric signals. These are the electrical signals generated when a muscle in your body contracts.

For a healthy natural hand, each finger or wrist movement is directly "wired" to a specific set of signals in the body via nerves that control varying sizes of muscles. There is no confusion between trying to move your pinky finger and rotating your wrist, you just do it. However, for amputees, these nerves might be inaccessible, the muscles lost, or a whole plethora of other medical complications so we must infer the action from predictable patterns in myoelectric activity from the healthy muscles that correspond to certain discrete gestures.

This is also why more fine-grained gestures like pointing with 2 fingers or a thumbs-up are **not used in prosthetics-adjacent research.** Its entirely possible to capture these on a healthy biological hand because the muscles are intact, but after an amputation **there are no muscles to read signals from**.

![Arm muscles](https://hackster.imgix.net/uploads/attachments/1990912/image_Wt9Pxf46qZ.png?auto=compress%2Cformat&w=740&h=555&fit=max)

Thankfully it doesn't take much to capture these signals, if you're really going scrapping, taping a wire to your arm is what we in the business would call minimum viable product. However, this isn't a very reproducible modality and is also known in the same business as janky and questionable. So we're going to go with some more trusted and "batteries-included" solutions, because of the BLINC Lab's history we were able to experiment with two polar opposite solutions:

### Myo Armband (Deprecated but easily acquired and reverse-engineered)
![Myo Armband](https://hackster.imgix.net/uploads/attachments/1990577/image_H4TypfzIKz.png)

### SiFi Labs: SiFi Band (Cutting edge, Research grade, currently under development)
![SiFi Band](https://hackster.imgix.net/uploads/attachments/1990576/image_Lq6smAZ6zJ.png)

Because of the complexity and variance in data from person-to-person, and even factors within a person, it would be impossible to manually distinguish between these patterns if not for the power of machine learning.

# Using AI / ML to Classify Myoelectric Signals 🤖

The core algorithmic challenge of classifying myoelectric signals into distinct poses has been well-documented and is an active field of research. Many of these papers have investigated and even implemented state-of-the-art algorithms and models with incredible rigor that I can't even begin to replicate:

- [A Review on lectromyography Decoding and Pattern Recognition for Human-Machine Interaction](https://ieeexplore.ieee.org/abstract/document/8672131)

- [Self-supervised representation learning with continuous training data improves the feel and performance of myoelectric control](https://www.sciencedirect.com/science/article/pii/S0010482525013812)

- [(Un)supervised (Co)adaptation via Incremental Learning for Myoelectric Control: Motivation, Review, and Future Directions](https://ieeexplore.ieee.org/abstract/document/11137388)

Many of these investigations focus on creating novel approaches to solving problems such as the **limb position effect, electrode shift, transition errors**, etc. all of which result in distribution shift in the data stream, ultimately resulting in the degradation of performance of the ML models. At this stage, the focus is on proving that each one of these problems can be solved in the first place before considering a holistic solution.

Since the goal is to allow research to iteratively build on a strong foundational development environment it is extremely important for us to not rely on one specific type of AI model for the sake of optimal performance. A researcher should be able to push a model without messing with the motor-control layer and a developer should be able to work on the RTOS layer without needing new data or retraining all while working within a real-world adjacent environment.

# And doing it on a budget 👛
What do I mean by on a budget? There are actually 3 distinct "budgets" we must strictly adhere to.

- Cost (obviously).
- Power.
- Speed/Latency.

Cost is self explanatory, we can't have a $/token cost associated with closing our hand, that would be **dystopian**. And it isn't sufficient to shove an RTX 3090 in our back pocket just for the sake of living the cyberpunk dream.

Even something like a gaming laptop or more realistically a Jetson Nano has a power ceiling that would burn through the average bionic arm's battery in a handful of hours, **before even accounting for the power consumed by the part of the circuit that must control the precise timings of the servos and the servos themselves.**

**And then there is the final but most important metric - Latency.** If you've ever played an online game, you're familiar with the accursed term lag. The delay between you making a move that surely crowns you as the pinnacle of human achievement in that game, and the time that move actually executes thus landing you squarely on the peak of the normal distribution mountain.

### Now imagine if your hand had lag.

Our brains can adjust to about 100ms of delay between a decision to take an action and the action being executed, however this adjustment is already uncomfortable and if we aim for an average delay of 100ms we will end up with several samples that easily push 200ms+ which is unusable for something that is supposed to seamlessly integrate with and substitute for a biological human body.

# A Tangent about Timing (RTOS) 🕑
Before we start solving all of those problems, its important to distinguish between the parts of this system and how much of a lag each of them contributes to the whole and why that matters. And how we get around it.

1. BLE - Variable lag from 10ms to 100ms based on signal quality and transmitter hardware. However this stems from using commercial hardware and can be eliminated entirely by using the STM32 to read analog electrode inputs. 
[Charles' Labs - OpenEMG Arduino Sensor](https://charleslabs.fr/en/project-OpenEMG+Arduino+Sensor) has a great demo of this exact idea but I'm sure there are more.

2. Inference - The core stage of the pipeline that research is concerned with. Variance in this should be a direct predictor of total round trip performance. **But there's a catch......**

3. Motor Control - The confounding variable in many implementations that let a single processor handle the control and inference together.

### RTOS Explained with Claude Hieroglyphs
![RTOS vs Not Diagram](https://hackster.imgix.net/uploads/attachments/1991444/image_TA4yrDnxzH.png)

We often take the importance of timing in robotics and motor control for granted. But for a motor that encodes each degree of movement as a difference of **microseconds**, its crucial that we're always on time. Otherwise you might drop your coffee mug or even let go off the steering wheel without intending to. **Yikes.**

This is where an RTOS (Real-Time Operating System) comes into play. Its an operating system frequently used in embedded applications to guarantee a very very precise order of operations for any given action. And we need it to always be on time so it **CANNOT** afford to be interrupted, not even by our AI model itself.

# The Arduino Uno Q 💻
Finally we come to the star of the show.

Based on all the stringent requirements we've placed on ourselves we need a controller that is

- Cheap.

- Low-power.

- Fast enough for on-device AI inference for different families of models.

- Capable of maintaining real-time guarantees for motor control.

Its easy to now see why the Arduino Uno Q 4GB is such a natural choice for this task.

Its main MPU - the **Qualcomm Dragonwing QRB2210** can run our multi-headed CNN and Transformer variants with <1ms mean inference time without any platform-specific optimization using the ONNX CPU runtime.

All this while its **MCU co-processor the STM32U585** can keep running a completely independent Zephyr RTOS loop that controls each digit of the hand without any drift in the motor position (which as I mentioned could be catastrophic).

![Uno Q Architecture](https://hackster.imgix.net/uploads/attachments/1990551/image_tHdXpV62Qz.png)

The onboard network + BLE card also eliminates the need for another dedicated BLE co-processor like an ESP32.

**All of this for a sustained power draw of <7W.**

# I Needed a Hand 🖖
All of this software stuff is cool but to have a real-world research environment we still need a bionic hand with individually controllable fingers that can also be iterated on by adding sensors and changing parameters to suit the researcher's needs.

A quick search surfaces anything from $1000 to $100, 000.........

**We need something DIY. And open-source.**

Thankfully there are perks to working at a prosthetics research lab. So I could build a fully 3D-printed arm with off-the-shelf servos.

[The Handi Hand – BLINC Lab](https://blinclab.ca/research/device-development/the-handi-hand/)

[The Handi Hand V2](https://www.researchsquare.com/article/rs-10529839/v1)

The tips of this specific Handi Hand are placeholders for force-sensors that can easily be wired into the same STM32 that controls the motors to provide another mode of feedback and an input parameter for further model training.

![The Handi Hand](https://hackster.imgix.net/uploads/attachments/1990553/pxl_20260824_191157387_portrait_T9EHyWOO9r.jpg)

# Putting It All Together 🛠️

**Finally! We're ready to put together the QGrip.**

Since the original **Handi-Hand** used DYNAMIXEL XL330-M288-T smart servos which can be daisy-chained, the basic configuration is quite underwhelming.

![Wiring Diagram](https://hackster.imgix.net/uploads/attachments/1991426/qgrip2schematic_bgnmzhbh6r_X8U9bRqKAr.png)

The Arduino sketch can use any combination of Dynamixel and standard hobby PWM servos. However since the Dynamixels are more niche, the average reader is most likely to use the hobby ones. In comparison to how the smart servos are handled the sketch handles the state for each hobby servo itself making the RTOS MCU earn its keep.

Standard bionics don't have an LED grid but since the UNO does, it gives us a net way of visualizing our current grip configuration.

![LED Matrix](https://hackster.imgix.net/uploads/attachments/1990555/image_zaE2Jrfyxt.png)

![LED Matrix Demo](https://hackster.imgix.net/uploads/attachments/1990948/led_matrix_dsI5b070PU.gif)

# The Training Arc 🧠
The [QGrip repository](https://github.com/ShriramRaghu-UofA/QGrip) is a generalist repository made to be modular in way that any component can be swapped out or remade entirely without affecting the rest of the system.

This does mean that there's a lot of code that no single person will end up using and different use-cases might skip some parts entirely. I will demonstrate the out-of-the box training wizard that was used throughout the build process.

1. **Capturing** 8 channels of myoelectric data at 200Hz / 1600Hz (Myo vs SiFi). First we set up our user name and check connectivity to the device (in this case a myo armband sampling at 200Hz).

![QGrip Setup Screen](https://hackster.imgix.net/uploads/attachments/1990556/screenshot_2026-08-24_134102_vaqXwYeLfv.png)

2. **Labeling** the data during the capture process into 5 distinct "classes" that represent 5 common actions that commercial trans-radial (below elbow) and trans-humeral (above elbow) amputees frequently employ in their lives. The classes are rest, palm open, palm close, wrist flexion (palm toward inner-forearm), wrist extension (palm away from inner-forearm). 

    We also capture the strength of each action as a muscle activation percentage. This determines the speed and fine control with which we can control the prosthesis.

![Training](https://hackster.imgix.net/uploads/attachments/1990557/recording_2026-08-24_134330_tMtGPUY4mT.gif)

3. **Training a 2 headed CNN** (Convolutional Neural Network) and a **Transformer AI model** using the 8 channel data + labels + activation strength to an **extremely high accuracy** (98%+, biasing toward rest in cases of low confidence).

*The high accuracy is crucial if we are ever to get past a mere proof-of-concept. Most people never have to worry about their hand opening when they don't want it to, or their wrist spinning uncontrollably like some kind of cyberpunk drill. Yet these are real experiences of the amputees that we are aiming to help and we cannot settle for "good enough".*

**Now lets test it in the WebUI itself as a sanity check.**

![Benchmark](https://hackster.imgix.net/uploads/attachments/1992048/image_TrvDe1PotS.png)

# Results 📈

![Demo 2](https://hackster.imgix.net/uploads/attachments/1990998/qgripsolocompressed_qP6Uw7sGNc.gif)

Benchmark results over different models and devices all show a **worst case mean inference latency of <5ms on the Arduino UNO Q.**

### Using a CNN its possible to achieve a mean latency of <1ms consistently.

![Benchmarks 2](https://hackster.imgix.net/uploads/attachments/1990938/image_5FpFcDiRcS.png)

![Benchmark Table](https://hackster.imgix.net/uploads/attachments/1990943/image_ZE7gcQawac.png)

These results show that the QGrip can handily (pun definitely intended) run multiple types of AI models while maintaining the responsiveness required to maintain immersion and improve habituation to prostheses.

# BONUS : Implementing USB HID on the UNO Q ➕

In the process of building out the QGrip, I was working on another project that needed the same classifier-driven approach but for rehabilitation of amputees in VR. One option was to implement it natively but I thought it would be neat to make a simple plug-and-play device that doesn't need the host computer / phone running the VR game to also run the model itself.

I decided to use the **USB HID (Human Interface Device)** standard to map the QGrip model's classes to different axes of an analog joystick device.

This meant I needed to add **HID gadget** functionality to the Arduino UNO Q myself since, while the hardware supports it, there is no official documentation about this.

For the curious, the guide on doing that is documented on my Github: [Brisk4t/Uno-Q-USB: Enable USB Gadget Mode on the Arduino UNO Q](https://github.com/Brisk4t/Uno-Q-USB)

![Qgrip Joystick](https://hackster.imgix.net/uploads/attachments/1992039/unoqhid_XXfG0r2E4L.gif)


This lets researchers and hobbyists without the need for the physical QGrip hand still use the low-latency on-device inference of the Arduino to test in experiments and games.

It also allows any sensors / input sources connected to the MCU to talk to a host computer for whatever other projects you can come up with.

# What's Next? (and some nitpicks) ❓
One of the current cutting-edge areas of research in the space of bionics research, and one that I've been recently exposed to, are models that learn as we use them.

However, as it stands the UNO Q with its ultra low power generalist processor has no special AI accelerator. While this isn't really a problem for simple classifier inference like what we're using here, it simply cannot handle training workloads that even a simple NPU (like what the Ventuno Q advertises) could do far better.


*This means while new data can be collected by the UNO Q, for the data to be integrated into the model, the training must be delegated to a stronger system.**

Having a dedicated NPU also allows running more complex pipelines such as a vision-assisted classifier running cooperatively with the myoelectric one to decide which grip an object needs along with tactile feedback from the force sensors that can be added to the Handi Hand. Currently the two-headed classifier pushes the UNO Q to its limits so even though it has dedicated video decoders, image inference would be awfully sluggish.

![Ventuno Q](https://hackster.imgix.net/uploads/attachments/1991423/image_IwJh1XXbGW.png)


A few other gotchas that are likely just a 'brand new device tax' but worth mentioning nonetheless were:

- Edge Impulse's ONNX model converter failed to work regardless of how many operator substitutions we applied. For reference while trying to port the models to ESP32P4s and S3s, while they couldn't achieve the performance the workload needed, the ESP-DL quantizer was at least able to successfully convert the models to the custom format.

- Without any inference framework capable of leveraging the albeit weak Adreno GPU, the models that can be used are limited. While this tradeoff is theoretically worth it for the lower power consumption especially for sparse models like the CNN, not having the option at all is a bit frustrating and the transformer stats are practically unusable. For the research -> test -> research loop that we have our mind set on, the need to massage models into UNO-friendly forms adds a level of friction that might be better suited to an implementation phase once the theoretical proof is done.