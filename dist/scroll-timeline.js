!function(){function e(e,t){for(var n=0;n<t.length;n++){var i=t[n];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(e,i.key,i)}}function t(t,n,i){return n&&e(t.prototype,n),i&&e(t,i),t}function n(e,t){e.prototype=Object.create(t.prototype),e.prototype.constructor=e,i(e,t)}function i(e,t){return(i=Object.setPrototypeOf||function(e,t){return e.__proto__=t,e})(e,t)}function r(e,t){(null==t||t>e.length)&&(t=e.length);for(var n=0,i=new Array(t);n<t;n++)i[n]=e[n];return i}function a(e,t){var n="undefined"!=typeof Symbol&&e[Symbol.iterator]||e["@@iterator"];if(n)return(n=n.call(e)).next.bind(n);if(Array.isArray(e)||(n=function(e,t){if(e){if("string"==typeof e)return r(e,t);var n=Object.prototype.toString.call(e).slice(8,-1);return"Object"===n&&e.constructor&&(n=e.constructor.name),"Map"===n||"Set"===n?Array.from(e):"Arguments"===n||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)?r(e,t):void 0}}(e))||t&&e&&"number"==typeof e.length){n&&(e=n);var i=0;return function(){return i>=e.length?{done:!0}:{done:!1,value:e[i++]}}}throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}function o(e,t){if(e instanceof CSSUnitValue||e instanceof CSSMathSum)return e;if(!t)return null;var n=e.trim().match(/^(-?[0-9]*\.?[0-9]*)(px|%)$/);return n?new CSSUnitValue(n[1],"%"==n[2]?"percent":n[2]):null}!function(){var e=new WeakMap;function i(e){for(var t,n=[],i=0;i<e.length;i++)n[i]="number"==typeof(t=e[i])?new CSSUnitValue(t,"number"):t;return n}window.CSSUnitValue||(window.CSSUnitValue=function(){function n(t,n){e.set(this,{value:t,unit:n})}return n.prototype.toString=function(){var t=e.get(this);return""+t.value+function(e){switch(e){case"percent":return"%";case"number":return"";default:return e.toLowerCase()}}(t.unit)},t(n,[{key:"value",get:function(){return e.get(this).value},set:function(t){e.get(this).value=t}},{key:"unit",get:function(){return e.get(this).unit}}]),n}()),window.CSSKeywordValue||(window.CSSKeywordValue=function(){function e(e){this.value=e}return e.prototype.toString=function(){return this.value.toString()},e}());var r=function(){function n(t,n,r,a){e.set(this,{values:i(t),operator:n,name:r||n,delimiter:a||", "})}return n.prototype.toString=function(){var t=e.get(this);return t.name+"("+t.values.join(t.delimiter)+")"},t(n,[{key:"operator",get:function(){return e.get(this).operator}},{key:"values",get:function(){return e.get(this).values}}]),n}();window.CSSMathSum||(window.CSSMathSum=function(e){function t(t){return e.call(this,arguments,"sum","calc"," + ")||this}return n(t,e),t}(r)),window.CSSMathProduct||(window.CSSMathProduct=function(e){function t(t){return e.call(this,arguments,"product","calc"," * ")||this}return n(t,e),t}(r)),window.CSSMathNegate||(window.CSSMathNegate=function(e){function t(t){return e.call(this,[arguments[0]],"negate","-")||this}return n(t,e),t}(r)),window.CSSMathInvert||(window.CSSMathNegate=function(e){function t(t){return e.call(this,[1,arguments[0]],"invert","calc"," / ")||this}return n(t,e),t}(r)),window.CSSMathMax||(window.CSSMathMax=function(e){function t(){return e.call(this,arguments,"max")||this}return n(t,e),t}(r)),window.CSSMathMin||(window.CSSMathMin=function(e){function t(){return e.call(this,arguments,"min")||this}return n(t,e),t}(r)),window.CSS||(window.CSS={}),["number","percent","em","ex","px","cm","mm","in","pt","pc","Q","vw","vh","vmin","vmax","rems","ch","deg","rad","grad","turn","ms","s","Hz","kHz","dppx","dpi","dpcm","fr"].forEach(function(e){CSS[e]||(CSS[e]=function(t){return new CSSUnitValue(t,e)})})}();var l=new CSSKeywordValue("auto"),u=new WeakMap,s=[];function c(e){return e===document.scrollingElement?document:e}function m(e){var t=u.get(e).animations;if(0!==t.length)for(var n=e.currentTime,i=0;i<t.length;i++)t[i].tickAnimation(n)}function f(e,t){var n="horizontal-tb"==getComputedStyle(e).writingMode,i=e.scrollTop;return("horizontal"==t||"inline"==t&&n||"block"==t&&!n)&&(i=Math.abs(e.scrollLeft)),i}function h(e,t){if(e instanceof CSSUnitValue){if("percent"==e.unit)return e.value*t/100;if("px"==e.unit)return e.value;throw TypeError("Unhandled unit type "+e.unit)}if(e instanceof CSSMathSum){for(var n,i=0,r=a(e.values);!(n=r()).done;)i+=h(n.value,t);return i}throw TypeError("Unsupported value type: "+typeof e)}function p(e,t,n,i,r){if(r)return r(t,n,i,0==e.value?"start":"end");"block"===n?n="vertical":"inline"===n&&(n="horizontal");var a="vertical"===n?t.scrollHeight-t.clientHeight:t.scrollWidth-t.clientWidth;return h(o(i===l?e:i),a)}function d(e,t,n,i){var r=[],a=!0;0==n.length?(r.push(p(new CSSUnitValue(0,"percent"),e,t,l)),a=!1,r.push(p(new CSSUnitValue(100,"percent"),e,t,l))):1==n.length&&(r.push(p(new CSSUnitValue(0,"percent"),e,t,l)),a=!1);for(var o=0;o<n.length;o++){var u=p(a?new CSSUnitValue(0,"percent"):new CSSUnitValue(100,"percent"),e,t,n[o],i[o]);if(null===u)return[];r.push(u),a=!1}return r}function g(e,t){for(var n=u.get(e).animations,i=0;i<n.length;i++)n[i].animation==t&&n.splice(i,1)}function v(e,t,n){for(var i=u.get(e).animations,r=0;r<i.length;r++)if(i[r].animation==t)return;i.push({animation:t,tickAnimation:n}),m(e)}var y=function(){function e(e){u.set(this,{scrollSource:null,orientation:"block",scrollOffsets:[],timeRange:l,animations:[],scrollOffsetFns:[]}),this.scrollSource=e&&void 0!==e.scrollSource?e.scrollSource:document.scrollingElement,this.orientation=e&&e.orientation||"block",this.scrollOffsets=e&&void 0!==e.scrollOffsets?e.scrollOffsets:[],this.timeRange=e&&void 0!==e.timeRange?e.timeRange:"auto"}return t(e,[{key:"scrollSource",get:function(){return u.get(this).scrollSource},set:function(e){var t=this;this.scrollSource&&c(this.scrollSource).removeEventListener("scroll",function(){return m(t)}),u.get(this).scrollSource=e,e&&c(e).addEventListener("scroll",function(){return m(t)}),m(this)}},{key:"orientation",get:function(){return u.get(this).orientation},set:function(e){if(-1===["block","inline","horizontal","vertical"].indexOf(e))throw TypeError("Invalid orientation");u.get(this).orientation=e,m(this)}},{key:"scrollOffsets",get:function(){return u.get(this).scrollOffsets},set:function(e){for(var t,n=[],i=[],r=a(e);!(t=r()).done;){var c=t.value,f=null,h=void 0;"auto"==c&&(c=l);for(var p=0;p<s.length;p++){var d=s[p].parse(c);if(void 0!==d){h=d,f=s[p].evaluate;break}}if(!f){if(c!=l){var g=o(c);if(!g||g instanceof CSSUnitValue&&"number"==g.unit)throw TypeError("Invalid scrollOffsets entry.")}h=c}n.push(h),i.push(f)}if(1==n.length&&n[0]==l)throw TypeError("Invalid scrollOffsets value.");var v=u.get(this);v.scrollOffsets=n,v.scrollOffsetFns=i,m(this)}},{key:"timeRange",get:function(){return u.get(this).timeRange},set:function(e){if("auto"!=e&&("number"!=typeof e||!Number.isFinite(e)||e!=e))throw TypeError("Invalid timeRange value");u.get(this).timeRange=e,m(this)}},{key:"duration",get:function(){return CSS.percent(100)}},{key:"phase",get:function(){if(!this.scrollSource)return"inactive";var e=getComputedStyle(this.scrollSource);if("none"==e.display)return"inactive";if(this.scrollSource!=document.scrollingElement&&("visible"==e.overflow||"clip"==e.overflow))return"inactive";var t=d(this.scrollSource,this.orientation,this.scrollOffsets,u.get(this).scrollOffsetFns);if(0==t.length)return"inactive";var n=p(new CSSUnitValue(100,"percent"),this.scrollSource,this.orientation,new CSSUnitValue(100,"percent"),null),i=t[0],r=t[t.length-1],a=f(this.scrollSource,this.orientation);return a<i?"before":a>=r&&r<n?"after":"active"}},{key:"currentTime",get:function(){if(!this.scrollSource)return null;if("inactive"==this.phase)return null;var e=d(this.scrollSource,this.orientation,this.scrollOffsets,u.get(this).scrollOffsetFns),t=e[0],n=e[e.length-1];!function(e){var t=e.timeRange;if(t==l){t=0;for(var n=u.get(e).animations,i=0;i<n.length;i++)t=Math.max(t,n[i].animation.effect.getComputedTiming().activeDuration);Infinity===t&&(t=0)}}(this);var i=f(this.scrollSource,this.orientation);if(i<t)return CSS.percent(0);if(i>=n)return CSS.percent(100);var r=function(e,t){var n;for(n=t.length-2;n>=0&&!(t[n]<=e&&e<t[n+1]);n--);var i=t[n];return(n+(e-i)/(t[n+1]-i))*(1/(t.length-1))}(i,e);return CSS.percent(100*r)}},{key:"__polyfill",get:function(){return!0}}]),e}(),T=window.Element.prototype.animate,S=window.Animation,w=function(){function e(){var e=this;this.state="pending",this.nativeResolve=this.nativeReject=null,this.promise=new Promise(function(t,n){e.nativeResolve=t,e.nativeReject=n})}var t=e.prototype;return t.resolve=function(e){this.state="resolved",this.nativeResolve(e)},t.reject=function(e){this.state="rejected",this.promise.catch(function(){}),this.nativeReject(e)},e}();function k(e){e.readyPromise=new w,requestAnimationFrame(function(){null!==e.timeline.currentTime&&W(e)})}function b(){return new DOMException("The user aborted a request","AbortError")}function P(e){return!!e.timeline&&"number"!=typeof e.timeline.timeRange}function C(e,t){if(null===t)return t;if("number"!=typeof t)throw new DOMException("Unexpected value: "+t+".  Cannot convert to CssNumberish","InvalidStateError");if(e.timeline&&P(e)){var n=V(e);return CSS.percent(n?100*t/n:0)}return t}function R(e,t){if(e.timeline){if(null===t)return t;if(!P(e)&&"number"==typeof t)return t;if(P(e)&&"percent"===t.unit)return t.value*V(e)/100;throw new DOMException("CSSNumericValue must be a percentage for progress based animations.","NotSupportedError")}if(null==t||"number"==typeof t)return t;var n=t.to("ms");if(convertTime)return n.value;throw new DOMException("CSSNumericValue must be either a number or a time value for time based animations.","InvalidStateError")}function x(e){if(e.finishedPromise&&"pending"==e.finishedPromise.state&&"finished"==e.proxy.playState){e.finishedPromise.resolve(e.proxy),e.animation.pause();var t=new AnimationPlaybackEvent("finish",{currentTime:R(e,e.proxy.currentTime),timelineTime:R(e,e.proxy.timeline.currentTime)});requestAnimationFrame(function(){queueMicrotask(function(){e.animation.dispatchEvent(t)})})}}function E(e){return null!==e.pendingPlaybackRate?e.pendingPlaybackRate:e.animation.playbackRate}function M(e){null!==e.pendingPlaybackRate&&(e.animation.playbackRate=e.pendingPlaybackRate,e.pendingPlaybackRate=null)}function O(e){if(!e.timeline)return null;var t=R(e,e.timeline.currentTime);if(null===t)return null;if(null===e.startTime)return null;var n=(t-e.startTime)*e.animation.playbackRate;return-0==n&&(n=0),n}function I(e,t){if(!e.timeline)return null;var n=R(e,e.timeline.currentTime);return null==n?null:n-t/e.animation.playbackRate}function U(e,t,n){if(e.timeline){var i=t?R(e,e.proxy.currentTime):O(e);if(i&&null!=e.startTime&&!e.proxy.pending){var r=E(e),a=V(e),o=e.previousCurrentTime;r>0&&i>=a?((null===o||o<a)&&(o=a),e.holdTime=t?i:o):r<0&&i<=0?((null==o||o>0)&&(o=0),e.holdTime=t?i:o):0!=r&&(t&&null!==e.holdTime&&(e.startTime=I(e,e.holdTime)),e.holdTime=null)}A(e),e.previousCurrentTime=R(e,e.proxy.currentTime),"finished"==e.proxy.playState?(e.finishedPromise||(e.finishedPromise=new w),"pending"==e.finishedPromise.state&&(n?x(e):Promise.resolve().then(function(){x(e)}))):(e.finishedPromise&&"resolved"==e.finishedPromise.state&&(e.finishedPromise=new w),"paused"!=e.animation.playState&&e.animation.pause())}}function V(e){var t=e.proxy.effect.getTiming();return Math.max(0,t.delay+t.endDelay+t.iterations*t.duration)}function A(e){if(e.timeline)if(null!==e.startTime){var t=R(e,e.timeline.currentTime);e.animation.currentTime=(t-e.startTime)*e.animation.playbackRate}else null!==e.holdTime&&(e.animation.currentTime=e.holdTime)}function D(e,t){if(e.timeline){var n="paused"==e.proxy.playState&&e.proxy.pending,i=!1,r=null,a=R(e,e.proxy.currentTime);e.resetCurrentTimeOnResume&&(a=null,e.resetCurrentTimeOnResume=!1);var o=E(e),l=V(e);if(o>0&&t&&(null==a||a<0||a>=l))r=0;else if(o<0&&t&&(null==a||a<=0||a>l)){if(Infinity==l)return void e.animation.play();r=l}else 0==o&&null==a&&(r=0);null!=r&&(e.startTime=r,e.holdTime=null,M(e)),v(e.timeline,e.animation,j.bind(e.proxy)),e.holdTime&&(e.startTime=null),e.pendingTask&&(e.pendingTask=null,i=!0),(null!==e.holdTime||null!==r||n||null!==e.pendingPlaybackRate)&&(e.readyPromise&&!i&&(e.readyPromise=null),A(e),e.readyPromise||k(e),e.pendingTask="play",U(e,!1,!1))}}function j(e){var t=F.get(this);if(null!=e){t.pendingTask&&W(t);var n=this.playState;if("running"==n||"finished"==n){var i=R(t,e);t.animation.currentTime=(i-R(t,this.startTime))*this.playbackRate,"finished"==n&&0!=E(t)&&(t.holdTime=null),U(t,!1,!1)}}else"idle"!=t.animation.playState&&t.animation.cancel()}function W(e){"pause"==e.pendingTask?function(e){var t=R(e,e.timeline.currentTime);null!=e.startTime&&null==e.holdTime&&(e.holdTime=(t-e.startTime)*e.animation.playbackRate),M(e),e.startTime=null,e.readyPromise.resolve(e.proxy),U(e,!1,!1),A(e),e.pendingTask=null}(e):"play"==e.pendingTask&&function(e){var t=R(e,e.timeline.currentTime);if(null!=e.holdTime)M(e),0==e.animation.playbackRate?e.startTime=t:(e.startTime=t-e.holdTime/e.animation.playbackRate,e.holdTime=null);else if(null!==e.startTime&&null!==e.pendingPlaybackRate){var n=(t-e.startTime)*e.animation.playbackRate;M(e);var i=e.animation.playbackRate;0==i?(e.holdTime=null,e.startTime=t):e.startTime=t-n/i}e.readyPromise&&"pending"==e.readyPromise.state&&e.readyPromise.resolve(e.proxy),U(e,!1,!1),A(e),e.pendingTask=null}(e)}var F=new WeakMap,L=function(){function e(e,t){var n=e instanceof S?e:new S(e,r),i=t instanceof y,r=i?void 0:t;F.set(this,{animation:n,timeline:i?t:void 0,playState:i?"idle":null,readyPromise:null,finishedPromise:null,startTime:null,holdTime:null,previousCurrentTime:null,resetCurrentTimeOnResume:!1,pendingPlaybackRate:null,pendingTask:null,specifiedTiming:null,proxy:this})}var n=e.prototype;return n.finish=function(){var e=F.get(this);if(e.timeline){var t=E(e),n=V(e);if(0==t)throw new DOMException("Cannot finish Animation with a playbackRate of 0.","InvalidStateError");if(t>0&&Infinity==n)throw new DOMException("Cannot finish Animation with an infinite target effect end.","InvalidStateError");M(e);var i=t<0?0:n;this.currentTime=C(e,i);var r=R(e,e.timeline.currentTime);null===e.startTime&&null!==r&&(e.startTime=r-i/e.animation.playbackRate),"pause"==e.pendingTask&&null!==e.startTime&&(e.holdTime=null,e.pendingTask=null,e.readyPromise.resolve(this)),"play"==e.pendingTask&&null!==e.startTime&&(e.pendingTask=null,e.readyPromise.resolve(this)),U(e,!0,!0)}else e.animation.finish()},n.play=function(){var e=F.get(this);e.timeline?D(e,!0):e.animation.play()},n.pause=function(){var e=F.get(this);if(e.timeline){if("paused"!=this.playState){var t=null,n=e.animation.playbackRate,i=V(e);if(null===e.animation.currentTime)if(n>=0)t=0;else{if(Infinity==i)return void e.animation.pause();t=i}null!==t&&(e.startTime=t),"play"==e.pendingTask?e.pendingTask=null:e.readyPromise=null,e.readyPromise||k(e),e.pendingTask="pause"}}else e.animation.pause()},n.reverse=function(){var e=F.get(this),t=E(e),n=e.resetCurrentTimeOnResume?null:R(e,this.currentTime),i=Infinity==V(e),r=0!=t&&(t<0||n>0||!i);if(!e.timeline||!r)return r&&(e.pendingPlaybackRate=-E(e)),void e.animation.reverse();if("inactive"==e.timeline.phase)throw new DOMException("Cannot reverse an animation with no active timeline","InvalidStateError");this.updatePlaybackRate(-t),D(e,!0)},n.updatePlaybackRate=function(e){var t=F.get(this);if(t.pendingPlaybackRate=e,t.timeline){if(!t.readyPromise||"pending"!=t.readyPromise.state)switch(this.playState){case"idle":case"paused":M(t);break;case"finished":var n=R(t,t.timeline.currentTime),i=null!==n?(n-t.startTime)*t.animation.playbackRate:null;t.startTime=0==e?n:null!=n&&null!=i?(n-i)/e:null,M(t),U(t,!1,!1),A(t);break;default:D(t,!1)}}else t.animation.updatePlaybackRate(e)},n.persist=function(){F.get(this).animation.persist()},n.cancel=function(){var e=F.get(this);e.timeline?("idle"!=this.playState&&(function(e){e.pendingTask&&(e.pendingTask=null,M(e),e.readyPromise.reject(b()),k(e),e.readyPromise.resolve(e.proxy))}(e),e.finishedPromise&&"pending"==e.finishedPromise.state&&e.finishedPromise.reject(b()),e.finishedPromise=new w,e.animation.cancel()),e.startTime=null,e.holdTime=null,g(e.timeline,e.animation)):e.animation.cancel()},n.addEventListener=function(e,t,n){F.get(this).animation.addEventListener(e,t,n)},n.removeEventListener=function(e,t,n){F.get(this).animation.removeEventListener(e,t,n)},n.dispatchEvent=function(e){F.get(this).animation.dispatchEvent(e)},t(e,[{key:"effect",get:function(){var e=F.get(this);return e.timeline?(e.effect||(e.effect=function(e){var t=e.animation.effect,n={apply:function(n){var i=n.apply(t);return i.localTime=C(e,i.localTime),i.endTime=C(e,i.endTime),i.duration=C(e,i.duration),i.activeDuration=C(e,i.activeDuration),i}},i={apply:function(n){var i=1e5;if(e.specifiedTiming)return e.specifiedTiming;var r,a,o=n.apply(t);return e.specifiedTiming=o,null===o.duration?(o.delay=0,o.endDelay=0,r=o.iterations?i:0,o.duration=o.iterations?r/o.iterations:0,a=1):a=(r=o.delay+o.endDelay+o.iterations*o.duration)>0?i/r:0,t.updateTiming({startDelay:a*o.delay,endDelay:a*o.endDelay,iterationDuration:a*o.duration,totalDuration:a*Math.max(0,r)},!0),o}},r={apply:function(n,i,r){var a=r[0];r[1]?n.apply(t,a):(n.apply(t,e.specifiedTiming),n.apply(t,a),e.specifiedTiming=null,e.effect.getTiming())}};return proxy=new Proxy(t,{get:function(e,n){var i=e[n];return"function"==typeof i?i.bind(t):i},set:function(e,t,n){return e[t]=n,!0}}),proxy.getComputedTiming=new Proxy(t.getComputedTiming,n),proxy.getTiming=new Proxy(t.getTiming,i),proxy.updateTiming=new Proxy(t.updateTiming,r),proxy}(e)),e.effect):e.animation.effect},set:function(e){F.get(this).animation.effect=e,details.proxyEffect=null}},{key:"timeline",get:function(){var e=F.get(this);return e.timeline||e.animation.timeline},set:function(e){var t=this.timeline;if(t!=e){var n=this.playState,i=this.currentTime,r=F.get(this),a=V(r),o=a>0?R(r,i)/a:0,l=t instanceof y,u=e instanceof y;r.resetCurrentTimeOnResume=!1;var s=this.pending;if(l&&g(r.timeline,r.animation),u){r.timeline=e,M(r);var c=r.animation.playbackRate>=0?0:V(r);switch(n){case"running":case"finished":r.startTime=c,v(r.timeline,r.animation,j.bind(this));break;case"paused":r.resetCurrentTimeOnResume=!0,r.startTime=null,r.holdTime=R(r,CSS.percent(100*o));break;default:r.holdTime=null,r.startTime=null}return s&&(r.readyPromise&&"resolved"!=r.readyPromise.state||k(r),r.pendingTask="paused"==n?"pause":"play"),null!==r.startTime&&(r.holdTime=null),void U(r,!1,!1)}if(r.animation.timeline!=e)throw TypeError("Unsupported timeline: "+e);if(g(r.timeline,r.animation),r.timeline=null,l)switch(null!==i&&(r.animation.currentTime=o*V(r)),n){case"paused":r.animation.pause();break;case"running":case"finished":r.animation.play()}}}},{key:"startTime",get:function(){var e=F.get(this);return e.timeline?C(e,e.startTime):e.animation.startTime},set:function(e){var t=F.get(this);if(e=R(t,e),t.timeline){null==R(t,t.timeline.currentTime)&&null!=t.startTime&&(t.holdTime=null,A(t));var n=R(t,this.currentTime);M(t),t.startTime=e,t.resetCurrentTimeOnResume=!1,t.holdTime=null!==t.startTime&&0!=t.animation.playbackRate?null:n,t.pendingTask&&(t.pendingTask=null,t.readyPromise.resolve(this)),U(t,!0,!1),A(t)}else t.animation.startTime=e}},{key:"currentTime",get:function(){var e=F.get(this);return e.timeline?C(e,null!=e.holdTime?e.holdTime:O(e)):e.animation.currentTime},set:function(e){var t=F.get(this);if(e=R(t,e),t.timeline&&null!=e){var n=t.timeline.phase;null!==t.holdTime||null===t.startTime||"inactive"==n||0==t.animation.playbackRate?t.holdTime=e:t.startTime=I(t,e),t.resetCurrentTimeOnResume=!1,"inactive"==n&&(t.startTime=null),t.previousCurrentTime=null,"pause"==t.pendingTask&&(t.holdTime=e,M(t),t.startTime=null,t.pendingTask=null,t.readyPromise.resolve(this)),U(t,!0,!1)}else t.animation.currentTime=e}},{key:"playbackRate",get:function(){return F.get(this).animation.playbackRate},set:function(e){var t=F.get(this);if(t.timeline){t.pendingPlaybackRate=null;var n=this.currentTime;t.animation.playbackRate=e,null!==n&&(this.currentTime=n)}else t.animation.playbackRate=e}},{key:"playState",get:function(){var e=F.get(this);if(!e.timeline)return e.animation.playState;var t=R(e,this.currentTime);if(null===t&&null===e.startTime&&null==e.pendingTask)return"idle";if("pause"==e.pendingTask||null===e.startTime&&"play"!=e.pendingTask)return"paused";if(null!=t){if(e.animation.playbackRate>0&&t>=V(e))return"finished";if(e.animation.playbackRate<0&&t<=0)return"finished"}return"running"}},{key:"replaceState",get:function(){return F.get(this).animation.pending}},{key:"pending",get:function(){var e=F.get(this);return e.timeline?!!e.readyPromise&&"pending"==e.readyPromise.state:e.animation.pending}},{key:"id",get:function(){return F.get(this).animation.id}},{key:"onfinish",get:function(){return F.get(this).animation.onfinish},set:function(e){F.get(this).animation.onfinish=e}},{key:"oncancel",get:function(){return F.get(this).animation.oncancel},set:function(e){F.get(this).animation.oncancel=e}},{key:"onremove",get:function(){return F.get(this).animation.onremove},set:function(e){F.get(this).animation.onremove=e}},{key:"finished",get:function(){var e=F.get(this);return e.timeline?(e.finishedPromise||(e.finishedPromise=new w),e.finishedPromise.promise):e.animation.finished}},{key:"ready",get:function(){var e=F.get(this);return e.timeline?(e.readyPromise||(e.readyPromise=new w,e.readyPromise.resolve(this)),e.readyPromise.promise):e.animation.ready}}]),e}(),z=new WeakMap,N=[[[0,1,2,3]],[[0,2],[1,3]],[[0],[1,3],[2]],[[0],[1],[2],[3]]],H=function(){function e(e){z.set(this,{target:null,edge:"start",threshold:0,rootMargin:[[0,"px"],[0,"px"],[0,"px"],[0,"px"]]}),this.target=e.target,this.edge=e.edge||"start",this.threshold=e.threshold||0,this.rootMargin=e.rootMargin||"0px 0px 0px 0px",this.clamp=e.clamp||!1}return t(e,[{key:"target",get:function(){return z.get(this).target},set:function(e){if(!(e instanceof Element))throw z.get(this).target=null,Error("Intersection target must be an element.");z.get(this).target=e}},{key:"edge",get:function(){return z.get(this).edge},set:function(e){-1!=["start","end"].indexOf(e)&&(z.get(this).edge=e)}},{key:"threshold",get:function(){return z.get(this).threshold},set:function(e){var t=parseFloat(e);if(t!=t)throw TypeError("Invalid threshold.");if(t<0||t>1)throw TypeError("threshold must be in the range [0, 1]");z.get(this).threshold=t}},{key:"rootMargin",get:function(){return z.get(this).rootMargin.map(function(e){return e.join("")}).join(" ")},set:function(e){var t=e.split(/ +/);if(t.length<1||t.length>4)throw TypeError("rootMargin must contain between 1 and 4 length components");for(var n=[[],[],[],[]],i=0;i<t.length;i++){var r=o(t[i],!0);if(!r)throw TypeError("Unrecognized rootMargin length");for(var a=N[t.length-1][i],l=0;l<a.length;l++)n[a[l]]=[parseFloat(r.value),r.unit]}z.get(this).rootMargin=n}},{key:"clamp",set:function(e){z.get(this).clamp=!!e}}]),e}();if(s.push({parse:function(e){if(e.target)return new H(e)},evaluate:function(e,t,n,i){"block"==t?t="vertical":"inline"==t&&(t="horizontal");for(var r,a=e==document.scrollingElement?{left:0,right:e.clientWidth,top:0,bottom:e.clientHeight,width:e.clientWidth,height:e.clientHeight}:e.getBoundingClientRect(),o=z.get(n).rootMargin,l=[],u=0;u<4;u++)l.push("percent"==(r=o[u])[1]?r[0]*(u%2==0?a.height:a.width)/100:r[0]);var s=a.left-l[3],c=a.right-a.left+l[3]+l[1],m=a.top-l[0],f=a.bottom-a.top+l[0]+l[2],h=z.get(n).clamp,p=n.target.getBoundingClientRect(),d=n.threshold;if("start"==n.edge&&(d=1-d),"vertical"==t){var g=p.top+p.height*d-m+e.scrollTop;return h?"end"==n.edge?Math.max(0,g-f):Math.min(g,e.scrollHeight-f):"end"==n.edge?g-f:g}var v=p.left+p.width*d-s+e.scrollLeft;return h?"end"==n.edge?Math.max(0,v-c):Math.min(v,e.scrollWidth-c):"end"==n.edge?v-c:v}}),!Reflect.defineProperty(window,"ScrollTimeline",{value:y}))throw Error("Error installing ScrollTimeline polyfill: could not attach ScrollTimeline to window");if(!Reflect.defineProperty(Element.prototype,"animate",{value:function(e,t){var n=t.timeline;n instanceof y&&delete t.timeline;var i=T.apply(this,[e,t]),r=new L(i,n);return n instanceof y&&(i.pause(),r.play()),r}}))throw Error("Error installing ScrollTimeline polyfill: could not attach WAAPI's animate to DOM Element");if(!Reflect.defineProperty(window,"Animation",{value:L}))throw Error("Error installing Animation constructor.")}();
//# sourceMappingURL=scroll-timeline.js.map
