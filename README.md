# Scroll-timeline Polyfill for Scroll-driven Animations

A polyfill of ScrollTimeline and ViewTimeline as defined by [the CSS WG spec](https://drafts.csswg.org/scroll-animations-1/).

- [View a cool demo showing its usage.](https://flackr.github.io/scroll-timeline/demo/parallax/)
- [Track the browser support for native Scroll-driven Animations.](https://caniuse.com/?search=animation-timeline)

> [!TIP]
> When the scroll-driven animations feature is widely available as a native feature, this polyfill may not be necessary except to support older versions of browsers.

## Installation

Use one of these methods to add the polyfill and it should begin working immediately. If it's not working, see the [_Known Limitations_](#known-limitations) section.

### [NPM package](https://www.npmjs.com/package/scroll-timeline-polyfill)

```sh
npm install scroll-timeline-polyfill
```

You may also use `pnpm` or `yarn`. Once installed, import it:

```js
import "scroll-timeline-polyfill/dist/scroll-timeline.js";
```

### JavaScript import (CDN)

```js
import "https://flackr.github.io/scroll-timeline/dist/scroll-timeline.js";
```

### HTML script tag (CDN)

```html
<script src="https://flackr.github.io/scroll-timeline/dist/scroll-timeline.js"></script>
```

## Usage

To use this polyfill, start creating animations using CSS or JavaScript.

### JavaScript usage

Use a `ScrollTimeline` or `ViewTimeline` instance to define animations.

```js
document.getElementById("parallax").animate(
  { transform: ["translateY(0)", "translateY(100px)"] },
  {
    fill: "both",
    timeline: new ScrollTimeline({
      source: document.documentElement,
    }),
    rangeStart: new CSSUnitValue(0, "px"),
    rangeEnd: new CSSUnitValue(200, "px"),
  }
);
```

### CSS usage

Use `animation-timeline` property with `scroll` or `view` to define animations:

```css
@keyframes parallax-effect {
  to {
    transform: translateY(100px);
  }
}
.parallax {
  animation: parallax-effect linear both;
  animation-timeline: scroll(block root);
  animation-range: 0px 200px;
}
```

> [!CAUTION]
> Please ensure your CSS is hosted on the same domain as your website or included directly on the page within a `<style>` tag.
>
> If you are loading stylesheets from other origins, the polyfill might not be able to fetch and apply them correctly, due to browser security restrictions.

### More details and Use Cases

- [Animate elements on scroll with Scroll-driven animations](https://developer.chrome.com/articles/scroll-driven-animations/)
- [Scroll-driven Animations - Demos and Tools](https://scroll-driven-animations.style/)

## Known Limitations

### Loading Demos or Running Locally

Ensure that the demo project or your project is built and/or served using an HTTP server. For example, you may need to execute `npm run build` and then `npm run dev`. You may also use other methods like a Python3 HTTP server, WAMP server, Nginx or `npx http-server`.

> [!NOTE]
> You won't be able to use the polyfill if you open the `.html` file directly in a file browser. This is because the polyfill needs to be able to fetch the CSS files in order to read them. The browser doesn't allow this from `file:///` origins as that would allow reading other files from your system.

### Safari Feature Flag

In Safari (macOS), a developer feature flag called "Scroll-driven Animations" can be enabled in the Feature Flags panel. (This panel is shown if "Show features for web developers" advanced option is checked.)

This feature flag reports to feature detection that the scroll-driven animations feature is natively available in the browser, effectively disabling the polyfill. However, the developer preview version of the feature doesn't work correctly, causing broken animations.

> [!IMPORTANT]
> If this is your case, disable the feature flag and reload your web page. The polyfill will apply the animations.

### Media Query for Reduced Motion

If you wrap the CSS in a media query block to apply it only when reduced motion is not preferred, the polyfill will not be able to process it:

```css
/* ❌ Don't do this */
@media (prefers-reduced-motion: no-preference) {
  .parallax {
    animation: parallax-effect linear both;
    animation-timeline: scroll(block root);
  }
}
```

Instead, override the `animation` property when reduced motion is preferred:

```css
.parallax {
  animation: parallax-effect linear both;
  animation-timeline: scroll(block root);

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}
```

### Dynamic CSS classes

Using Javascript to dynamically apply CSS classes in order to apply a scroll-driven anmiation will not work with the polyfill. This is because the polyfill needs to read the static classes and the CSS to track the DOM elements that should have the animations.

Instead, dynamically attach overriding classes to disable the statically applied animation:

```css
.no-parallax {
  animation: none !important;
}
```

#### Tailwind utility classes

Tailwind v4 brings the power of [utility classes](https://tailwindcss.com/docs/styling-with-utility-classes). However, the polyfill may not work with them since they are a form of dynamic classes.

Instead, use regular CSS classes. You can use CSS features like variables to apply dynamic configurations to the same animation.

```css
@keyframes parallax-effect {
  to {
    transform: translateY(calc(var(--parallax-multiplier, 1) * 100px));
  }
}

.parallax-2 {
  --parallax-multiplier: 2;
}

.parallax-3 {
  --parallax-multiplier: 3;
}

.parallax,
.parallax-2,
.parallax-3 {
  animation: parallax-effect linear both;
  animation-timeline: scroll(block root);
}
```

## Contributing

Thank you for choosing to contribute fixes and improvements to our project.

Please see our [contribution guidelines](/CONTRIBUTING.md) page to:
- Sign the Contributor License Agreement.
- Understand the code review process.
- Read the open source community guidelines.
- Learn how to develop and test your changes.
