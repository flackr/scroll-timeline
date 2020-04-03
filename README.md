# scroll-timeline polyfill.

A polyfill of ScrollTimeline as defined by the [spec](https://wicg.github.io/scroll-animations/).

View a [cool demo showing its usage](https://flackr.github.io/scroll-timeline/demo/parallax/)!

# Usage

To play with ScrollTimeline, simply import the module into your site and you can start creating animations.

```js
import 'https://flackr.github.io/scroll-timeline/scroll-timeline.js';

document.getElementById('parallax').animate(
    { transform: ['translateY(0)', 'translateY(100px)']},
    { duration: 10000, // Totally arbitrary!
      fill: 'both',
      timeline: new ScrollTimeline({
          endScrollOffset: '200px'})
    });
```

# Contributing

Running a dev environment

```shell script
npm i
npm run dev
# go to localhost:5000 
```