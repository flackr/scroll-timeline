!function(){function e(e,t){for(var i=0;i<t.length;i++){var n=t[i];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(e,n.key,n)}}function t(t,i,n){return i&&e(t.prototype,i),n&&e(t,n),t}function i(e,t){(null==t||t>e.length)&&(t=e.length);for(var i=0,n=new Array(t);i<t;i++)n[i]=e[i];return n}function n(e,t){var n;if("undefined"==typeof Symbol||null==e[Symbol.iterator]){if(Array.isArray(e)||(n=function(e,t){if(e){if("string"==typeof e)return i(e,void 0);var n=Object.prototype.toString.call(e).slice(8,-1);return"Object"===n&&e.constructor&&(n=e.constructor.name),"Map"===n||"Set"===n?Array.from(e):"Arguments"===n||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)?i(e,void 0):void 0}}(e))||t&&e&&"number"==typeof e.length){n&&(e=n);var r=0;return function(){return r>=e.length?{done:!0}:{done:!1,value:e[r++]}}}throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}return(n=e[Symbol.iterator]()).next.bind(n)}function r(e,t){if(e instanceof CSSUnitValue||e instanceof CSSMathSum)return e;if(!t)return null;var i=e.trim().match(/^(-?[0-9]*\.?[0-9]*)(px|%)$/);return i?new CSSUnitValue(i[1],"%"==i[2]?"percent":i[2]):null}var a=new CSSKeywordValue("auto"),l=new WeakMap,o=[];function s(e){return e===document.scrollingElement?document:e}function u(e){var t=l.get(e).animations;if(0!==t.length)for(var i=e.currentTime,n=0;n<t.length;n++)t[n].tickAnimation(i)}function c(e,t,i,l,o){if(o)return o(t,i,l,0==e.value?"start":"end");"block"===i?i="vertical":"inline"===i&&(i="horizontal");var s="vertical"===i?t.scrollHeight-t.clientHeight:t.scrollWidth-t.clientWidth;return function e(t,i){if(t instanceof CSSUnitValue){if("percent"==t.unit)return t.value*i/100;if("px"==t.unit)return t.value;throw TypeError("Unhandled unit type "+t.unit)}if(t instanceof CSSMathSum){for(var r,a=0,l=n(t.values);!(r=l()).done;)a+=e(r.value,i);return a}throw TypeError("Unsupported value type: "+typeof t)}(r(l===a?e:l),s)}function m(e,t){for(var i=l.get(e).animations,n=0;n<i.length;n++)i[n].animation==t&&i.splice(n,1)}function f(e,t,i){for(var n=l.get(e).animations,r=0;r<n.length;r++)if(n[r].animation==t)return;n.push({animation:t,tickAnimation:i}),u(e)}var h=function(){function e(e){l.set(this,{scrollSource:null,orientation:"block",startScrollOffset:a,endScrollOffset:a,scrollOffsets:[],timeRange:a,animations:[],scrollOffsetFns:[]}),this.scrollSource=e&&void 0!==e.scrollSource?e.scrollSource:document.scrollingElement,this.orientation=e&&e.orientation||"block",this.startScrollOffset=e&&e.startScrollOffset||a,this.endScrollOffset=e&&e.endScrollOffset||a,this.scrollOffsets=e&&void 0!==e.scrollOffsets?e.scrollOffsets:[],this.timeRange=e&&void 0!==e.timeRange?e.timeRange:"auto"}return t(e,[{key:"scrollSource",set:function(e){var t=this;this.scrollSource&&s(this.scrollSource).removeEventListener("scroll",function(){return u(t)}),l.get(this).scrollSource=e,e&&s(e).addEventListener("scroll",function(){return u(t)}),u(this)},get:function(){return l.get(this).scrollSource}},{key:"orientation",set:function(e){if(-1===["block","inline","horizontal","vertical"].indexOf(e))throw TypeError("Invalid orientation");l.get(this).orientation=e,u(this)},get:function(){return l.get(this).orientation}},{key:"scrollOffsets",set:function(e){for(var t,i=[],s=[],u=n(e);!(t=u()).done;){var c=t.value,m=null,f=void 0;"auto"==c&&(c=a);for(var h=0;h<o.length;h++){var d=o[h].parse(c);if(void 0!==d){f=d,m=o[h].evaluate;break}}if(!m){if(c!=a){var p=r(c);if(!p||p instanceof CSSUnitValue&&"number"==p.unit)throw TypeError("Invalid scrollOffsets entry.")}f=c}i.push(f),s.push(m)}if(1==i.length&&i[0]==a)throw TypeError("Invalid scrollOffsets value.");var g=l.get(this);g.scrollOffsets=i,g.scrollOffsetFns=s},get:function(){return l.get(this).scrollOffsets}},{key:"startScrollOffset",set:function(e){"auto"==e&&(e=a);var t=l.get(this);t.startScrollOffsetFunction=null;for(var i=0;i<o.length;i++){var n=o[i].parse(e);if(void 0!==n){e=n,t.startScrollOffsetFunction=o[i].evaluate;break}}if(e!=a&&!l.get(this).startScrollOffsetFunction){var s=r(e);if(!s||s instanceof CSSUnitValue&&"number"==s.unit)throw TypeError("Invalid start offset.")}t.startScrollOffset=e,u(this)},get:function(){return l.get(this).startScrollOffset}},{key:"endScrollOffset",set:function(e){"auto"==e&&(e=a),l.get(this).endScrollOffsetFunction=null;for(var t=0;t<o.length;t++){var i=o[t].parse(e);if(void 0!==i){e=i,l.get(this).endScrollOffsetFunction=o[t].evaluate;break}}if(e!=a&&!l.get(this).startScrollOffsetFunction){var n=r(e);if(!n||n instanceof CSSUnitValue&&"number"==n.unit)throw TypeError("Invalid end offset.")}l.get(this).endScrollOffset=e,u(this)},get:function(){return l.get(this).endScrollOffset}},{key:"timeRange",set:function(e){if("auto"!=e&&("number"!=typeof e||!Number.isFinite(e)||e!=e))throw TypeError("Invalid timeRange value");l.get(this).timeRange=e,u(this)},get:function(){return l.get(this).timeRange}},{key:"phase",get:function(){if(!this.scrollSource)return"inactive";var e=getComputedStyle(this.scrollSource);if("none"==e.display)return"inactive";if(this.scrollSource!=document.scrollingElement&&("visible"==e.overflow||"clip"==e.overflow))return"inactive";var t=c(new CSSUnitValue(0,"percent"),this.scrollSource,this.orientation,this.startScrollOffset,l.get(this).startScrollOffsetFunction),i=c(new CSSUnitValue(100,"percent"),this.scrollSource,this.orientation,this.endScrollOffset,l.get(this).endScrollOffsetFunction),n=c(new CSSUnitValue(100,"percent"),this.scrollSource,this.orientation,new CSSUnitValue(100,"percent"),null);if(null===t||null===i)return"inactive";var r=this.scrollSource.scrollTop;return"inline"!==this.orientation&&"horizontal"!==this.orientation||(r=this.scrollSource.scrollLeft),r<t?"before":r>=i&&i<n?"after":"active"}},{key:"currentTime",get:function(){if(!this.scrollSource)return null;if("inactive"==this.phase)return null;var e=c(new CSSUnitValue(0,"percent"),this.scrollSource,this.orientation,this.startScrollOffset,l.get(this).startScrollOffsetFunction),t=c(new CSSUnitValue(100,"percent"),this.scrollSource,this.orientation,this.endScrollOffset,l.get(this).endScrollOffsetFunction),i=function(e){var t=e.timeRange;if(t==a){t=0;for(var i=l.get(e).animations,n=0;n<i.length;n++)t=Math.max(t,i[n].animation.effect.getComputedTiming().activeDuration);Infinity===t&&(t=0)}return t}(this),n=this.scrollSource.scrollTop;return"inline"!==this.orientation&&"horizontal"!==this.orientation||(n=this.scrollSource.scrollLeft),n<e?0:n>=t?i:(n-e)/(t-e)*i}},{key:"__polyfill",get:function(){return!0}}]),e}(),d=window.Element.prototype.animate,p=window.Animation;function g(e){var t=void 0,i=void 0,n=void 0,r=void 0,a="pending",l=new Promise(function(e,n){t=e,i=n});return l.resolve=function(){a="resolved",n=null,r=null,t(e.proxy)},l.reject=function(){a="rejected",n=null,r=null,i(new DOMException("The user aborted a request","AbortError"))},l.cancelTask=function(){n=null},l.queueTask=function(e,t){n=e,r=t},l.state=function(){return a},l.taskName=function(){return r},requestAnimationFrame(function t(){if(n&&null!=e.timeline)return null!==e.timeline.currentTime?(n(e),void(n=null)):void requestAnimationFrame(t)}),e.readyPromise=l,l}function y(e){return!!e.readyPromise&&"play"==e.readyPromise.taskName()}function v(e){return!!e.readyPromise&&"pause"==e.readyPromise.taskName()}function T(e){var t=e.timeline.currentTime;if(null!=e.holdTime)w(e),0==e.animation.playbackRate?e.startTime=t:(e.startTime=t-e.holdTime/e.animation.playbackRate,e.holdTime=null);else if(null!==e.startTime&&null!==e.pendingPlaybackRate){var i=(t-e.startTime)*e.animation.playbackRate;w(e);var n=e.animation.playbackRate;0==n?(e.holdTime=null,e.startTime=t):e.startTime=t-i/n}e.readyPromise&&"pending"==e.readyPromise.state()&&e.readyPromise.resolve(),E(e,!1,!1),C(e)}function S(e){null!=e.startTime&&null==e.holdTime&&(e.holdTime=(e.timeline.currentTime-e.startTime)*e.animation.playbackRate),w(e),e.startTime=null,e.readyPromise.resolve(),E(e,!1,!1),C(e)}function k(e){var t=void 0,i=void 0,n="pending",r=new Promise(function(e,n){t=e,i=n});return r.resolve=function(){n="resolved",t(e.proxy)},r.reject=function(){n="rejected",i(new DOMException("The user aborted a request","AbortError"))},r.state=function(){return n},r.scheduleAsyncFinish=function(){requestAnimationFrame(function(){b(e)})},e.finishedPromise=r,r}function b(e){e.finishedPromise&&"pending"==e.finishedPromise.state()&&"finished"==e.proxy.playState&&(e.finishedPromise.resolve(),e.animation.finish(),e.animation.pause())}function P(e){return null!==e.pendingPlaybackRate?e.pendingPlaybackRate:e.animation.playbackRate}function w(e){null!==e.pendingPlaybackRate&&(e.animation.playbackRate=e.pendingPlaybackRate,e.pendingPlaybackRate=null)}function R(e){if(!e.timeline)return null;var t=e.timeline.currentTime;if(null===t)return null;if(null===e.startTime)return null;var i=(t-e.startTime)*e.animation.playbackRate;return-0==i&&(i=0),i}function O(e,t){if(!e.timeline)return null;var i=e.timeline.currentTime;return null==i?null:i-t/e.animation.playbackRate}function E(e,t,i){if(e.timeline){var n=t?e.proxy.currentTime:R(e);if(n&&null!=e.startTime&&!e.proxy.pending){var r=P(e),a=x(e),l=e.previousCurrentTime;r>0&&n>=a?((null===l||l<a)&&(l=a),e.holdTime=t?n:l):r<0&&n<=0?((null==l||l>0)&&(l=0),e.holdTime=t?n:l):0!=r&&(t&&null!==e.holdTime&&(e.startTime=O(e,e.holdTime)),e.holdTime=null)}C(e),e.previousCurrentTime=e.proxy.currentTime,"finished"==e.proxy.playState?(e.finishedPromise||k(e),"pending"==e.finishedPromise.state()&&(i?b(e):e.finishedPromise.scheduleAsyncFinish())):(e.finishedPromise&&"resolved"==e.finishedPromise.state()&&(e.finishedPromise=null),"paused"!=e.animation.playState&&e.animation.pause())}}function x(e){var t=e.animation.effect.getTiming();return Math.max(0,t.delay+t.endDelay+t.iterations*t.duration)}function C(e){e.timeline&&(null!==e.startTime?e.animation.currentTime=(e.timeline.currentTime-e.startTime)*e.animation.playbackRate:null!==e.holdTime&&(e.animation.currentTime=e.holdTime))}function M(e,t){if(e.timeline){var i="paused"==e.proxy.playState&&e.proxy.pending,n=!1,r=null,a=e.proxy.currentTime;e.resetCurrentTimeOnResume&&(a=null,e.resetCurrentTimeOnResume=!1);var l=P(e),o=x(e);if(l>0&&t&&(null==a||a<0||a>=o))r=0;else if(l<0&&t&&(null==a||a<=0||a>o)){if(Infinity==o)return void e.animation.play();r=o}else 0==l&&null==a&&(r=0);null!=r&&(e.startTime=r,e.holdTime=null,w(e)),f(e.timeline,e.animation,A.bind(e.proxy)),e.holdTime&&(e.startTime=null),e.readyPromise&&e.proxy.pending&&(e.readyPromise.cancelTask(),n=!0),(null!==e.holdTime||null!==r||i||null!==e.pendingPlaybackRate)&&(e.readyPromise&&!n&&(e.readyPromise=null),C(e),e.readyPromise||g(e),e.readyPromise.queueTask(T,"play"),E(e,!1,!1))}}function A(e){var t=F.get(this);if(null!=e){var i=this.playState;"running"!=i&&"finished"!=i||(t.animation.currentTime=(e-this.startTime)*this.playbackRate,"finished"==i&&0!=P(t)&&(t.holdTime=null),E(t,!1,!1))}else"idle"!=t.animation.playState&&t.animation.cancel()}var F=new WeakMap,I=function(){function e(e,t){var i=e instanceof p?e:new p(e,r),n=t instanceof h,r=n?void 0:t;F.set(this,{animation:i,timeline:n?t:void 0,playState:n?"idle":null,readyPromise:null,finishedPromise:null,startTime:null,holdTime:null,previousCurrentTime:null,resetCurrentTimeOnResume:!1,pendingPlaybackRate:null,proxy:this,sequence:0,aborted:new Set})}var i=e.prototype;return i.finish=function(){var e=F.get(this);if(e.timeline){var t=P(e),i=x(e);if(0==t)throw new DOMException("Cannot finish Animation with a playbackRate of 0.","InvalidStateError");if(t>0&&Infinity==i)throw new DOMException("Cannot finish Animation with an infinite target effect end.","InvalidStateError");w(e);var n=t<0?0:i;this.currentTime=n;var r=e.timeline.currentTime;null===e.startTime&&null!==r&&(e.startTime=r-n/e.animation.playbackRate),v(e)&&null!==e.startTime&&(e.holdTime=null,e.readyPromise.cancelTask(),e.readyPromise.resolve()),y(e)&&null!==e.startTime&&(e.readyPromise.cancelTask(),e.readyPromise.resolve()),E(e,!0,!0)}else e.animation.finish()},i.play=function(){var e=F.get(this);e.timeline?M(e,!0):e.animation.play()},i.pause=function(){var e=F.get(this);if(e.timeline){if("paused"!=this.playState){var t=null,i=e.animation.playbackRate,n=x(e);if(null===e.animation.currentTime)if(i>=0)t=0;else{if(Infinity==n)return void e.animation.pause();t=n}null!==t&&(e.startTime=t),y(e)?e.readyPromise.cancelTask():e.readyPromise=null,e.readyPromise||g(e),e.readyPromise.queueTask(S,"pause")}}else e.animation.pause()},i.reverse=function(){var e=F.get(this),t=P(e),i=e.resetCurrentTimeOnResume?null:this.currentTime,n=Infinity==x(e),r=0!=t&&(t<0||i>0||!n);if(!e.timeline||!r)return r&&(e.pendingPlaybackRate=-P(e)),void e.animation.reverse();if("inactive"==e.timeline.phase)throw new DOMException("Cannot reverse an animation with no active timeline","InvalidStateError");this.updatePlaybackRate(-t),M(e,!0)},i.updatePlaybackRate=function(e){var t=F.get(this);if(t.pendingPlaybackRate=e,t.timeline){var i=this.playState;if(!t.readyPromise||"pending"!=t.readyPromise.state())switch(i){case"idle":case"paused":w(t);break;case"finished":var n=t.timeline.currentTime,r=null!==n?(n-t.startTime)*t.animation.playbackRate:null;t.startTime=0==e?n:null!=n&&null!=r?(n-r)/e:null,w(t),E(t,!1,!1),C(t);break;default:M(t,!1)}}else t.animation.updatePlaybackRate(e)},i.persist=function(){F.get(this).animation.persist()},i.cancel=function(){var e=F.get(this);e.timeline?("idle"!=this.playState&&(function(e){e.readyPromise&&"pending"!=!e.readyPromise.state()&&(e.readyPromise.cancelTask(),w(e),e.readyPromise.reject(),e.readyPromise=null)}(e),e.finishedPromise&&"pending"==e.finishedPromise.state()&&e.finishedPromise.reject(),e.finishedPromise=null,e.animation.cancel()),e.startTime=null,e.holdTime=null,m(e.timeline,e.animation)):e.animation.cancel()},i.addEventListener=function(e,t,i){F.get(this).animation.addEventListener(e,t,i)},i.removeEventListener=function(e,t,i){F.get(this).animation.removeEventListener(e,t,i)},i.dispatchEvent=function(e){F.get(this).animation.dispatchEvent(e)},t(e,[{key:"effect",get:function(){return F.get(this).animation.effect},set:function(e){F.get(this).animation.effect=e}},{key:"timeline",get:function(){var e=F.get(this);return e.timeline||e.animation.timeline},set:function(e){var t=this.timeline;if(t!=e){var i=this.playState,n=this.currentTime,r=t instanceof h,a=e instanceof h,l=F.get(this);l.resetCurrentTimeOnResume=!1;var o=this.pending;if(r&&m(l.timeline,l.animation),a){l.timeline=e,w(l);var s=l.animation.playbackRate>=0?0:x(l);switch(i){case"running":case"finished":l.startTime=s,f(l.timeline,l.animation,A.bind(this));break;case"paused":l.resetCurrentTimeOnResume=!0,l.startTime=null,l.holdTime=n;break;default:l.holdTime=null,l.startTime=null}return o&&(l.readyPromise&&"resolved"!=l.readyPromise.state()||g(l),"paused"==i?l.readyPromise.queueTask(S,"pause"):l.readyPromise.queueTask(T,"play")),null!==l.startTime&&(l.holdTime=null),void E(l,!1,!1)}if(l.animation.timeline!=e)throw TypeError("Unsupported timeline: "+e);if(m(l.timeline,l.animation),l.timeline=null,r)switch(null!==n&&(l.animation.currentTime=n),i){case"paused":l.animation.pause();break;case"running":case"finished":l.animation.play()}}}},{key:"startTime",get:function(){var e=F.get(this);return e.timeline?e.startTime:e.animation.startTime},set:function(e){var t=F.get(this);if(t.timeline){null==t.timeline.currentTime&&null!=t.startTime&&(t.holdTime=null,C(t));var i=this.currentTime;w(t),t.startTime=e,t.resetCurrentTimeOnResume=!1,t.holdTime=null!==t.startTime&&0!=t.animation.playbackRate?null:i,(y(t)||v(t))&&(t.readyPromise.cancelTask(),t.readyPromise.resolve()),E(t,!0,!1),C(t)}else t.animation.startTime=e}},{key:"currentTime",get:function(){var e=F.get(this);return e.timeline?null!=e.holdTime?e.holdTime:R(e):e.animation.currentTime},set:function(e){var t=F.get(this);if(t.timeline&&null!=e){var i=t.timeline.phase;null!==t.holdTime||null===t.startTime||"inactive"==i||0==t.animation.playbackRate?t.holdTime=e:t.startTime=O(t,e),t.resetCurrentTimeOnResume=!1,"inactive"==i&&(t.startTime=null),t.previousCurrentTime=null,v(t)&&(t.holdTime=e,w(t),t.startTime=null,t.readyPromise.cancelTask(),t.readyPromise.resolve()),E(t,!0,!1)}else t.animation.currentTime=e}},{key:"playbackRate",get:function(){return F.get(this).animation.playbackRate},set:function(e){var t=F.get(this);if(t.timeline){t.pendingPlaybackRate=null;var i=this.currentTime;t.animation.playbackRate=e,null!==i&&(this.currentTime=i)}else t.animation.playbackRate=e}},{key:"playState",get:function(){if(details=F.get(this),!details.timeline)return details.animation.playState;var e=this.currentTime,t=details.readyPromise?details.readyPromise.taskName():null;if(null===e&&null===details.startTime&&null==t)return"idle";if("pause"==t||null===details.startTime&&"play"!=t)return"paused";if(null!=e){if(details.animation.playbackRate>0&&e>=x(details))return"finished";if(details.animation.playbackRate<0&&e<=0)return"finished"}return"running"}},{key:"replaceState",get:function(){return F.get(this).animation.pending}},{key:"pending",get:function(){var e=F.get(this);return e.timeline?!!e.readyPromise&&"pending"==e.readyPromise.state():e.animation.pending}},{key:"id",get:function(){return F.get(this).animation.id}},{key:"onfinish",get:function(){return F.get(this).animation.onfinish},set:function(e){F.get(this).animation.onfinish=e}},{key:"oncancel",get:function(){return F.get(this).animation.oncancel},set:function(e){F.get(this).animation.oncancel=e}},{key:"onremove",get:function(){return F.get(this).animation.onremove},set:function(e){F.get(this).animation.onremove=e}},{key:"finished",get:function(){var e=F.get(this);return e.timeline?(e.finishedPromise||(k(e),"finished"==this.playState&&e.finishedPromise.scheduleAsyncFinish()),e.finishedPromise):e.animation.finished}},{key:"ready",get:function(){var e=F.get(this);return e.timeline?(e.readyPromise||(g(e),e.readyPromise.resolve()),e.readyPromise):e.animation.ready}}]),e}(),U=new WeakMap,V=[[[0,1,2,3]],[[0,2],[1,3]],[[0],[1,3],[2]],[[0],[1],[2],[3]]],j=function(){function e(e){U.set(this,{target:null,edge:"start",threshold:0,rootMargin:[[0,"px"],[0,"px"],[0,"px"],[0,"px"]]}),this.target=e.target,this.edge=e.edge||"start",this.threshold=e.threshold||0,this.rootMargin=e.rootMargin||"0px 0px 0px 0px",this.clamp=e.clamp||!1}return t(e,[{key:"target",set:function(e){if(!(e instanceof Element))throw U.get(this).target=null,Error("Intersection target must be an element.");U.get(this).target=e},get:function(){return U.get(this).target}},{key:"edge",set:function(e){-1!=["start","end"].indexOf(e)&&(U.get(this).edge=e)},get:function(){return U.get(this).edge}},{key:"threshold",set:function(e){var t=parseFloat(e);if(t!=t)throw TypeError("Invalid threshold.");if(t<0||t>1)throw TypeError("threshold must be in the range [0, 1]");U.get(this).threshold=t},get:function(){return U.get(this).threshold}},{key:"rootMargin",set:function(e){var t=e.split(/ +/);if(t.length<1||t.length>4)throw TypeError("rootMargin must contain between 1 and 4 length components");for(var i=[[],[],[],[]],n=0;n<t.length;n++){var a=r(t[n],!0);if(!a)throw TypeError("Unrecognized rootMargin length");for(var l=V[t.length-1][n],o=0;o<l.length;o++)i[l[o]]=[parseFloat(a.value),a.unit]}U.get(this).rootMargin=i},get:function(){return U.get(this).rootMargin.map(function(e){return e.join("")}).join(" ")}},{key:"clamp",set:function(e){U.get(this).clamp=!!e}}]),e}();if(o.push({parse:function(e){if(e.target)return new j(e)},evaluate:function(e,t,i,n){"block"==t?t="vertical":"inline"==t&&(t="horizontal");for(var r,a=e==document.scrollingElement?{left:0,right:e.clientWidth,top:0,bottom:e.clientHeight,width:e.clientWidth,height:e.clientHeight}:e.getBoundingClientRect(),l=U.get(i).rootMargin,o=[],s=0;s<4;s++)o.push("percent"==(r=l[s])[1]?r[0]*(s%2==0?a.height:a.width)/100:r[0]);var u=a.left-o[3],c=a.right-a.left+o[3]+o[1],m=a.top-o[0],f=a.bottom-a.top+o[0]+o[2],h=U.get(i).clamp,d=i.target.getBoundingClientRect(),p=i.threshold;if("start"==i.edge&&(p=1-p),"vertical"==t){var g=d.top+d.height*p-m+e.scrollTop;return h?"end"==i.edge?Math.max(0,g-f):Math.min(g,e.scrollHeight-f):"end"==i.edge?g-f:g}var y=d.left+d.width*p-u+e.scrollLeft;return h?"end"==i.edge?Math.max(0,y-c):Math.min(y,e.scrollWidth-c):"end"==i.edge?y-c:y}}),!Reflect.defineProperty(window,"ScrollTimeline",{value:h}))throw Error("Error installing ScrollTimeline polyfill: could not attach ScrollTimeline to window");if(!Reflect.defineProperty(Element.prototype,"animate",{value:function(e,t){var i=t.timeline;i instanceof h&&delete t.timeline;var n=d.apply(this,[e,t]),r=new I(n,i);return i instanceof h&&(n.pause(),r.play()),r}}))throw Error("Error installing ScrollTimeline polyfill: could not attach WAAPI's animate to DOM Element");if(!Reflect.defineProperty(window,"Animation",{value:I}))throw Error("Error installing Animation constructor.")}();
//# sourceMappingURL=scroll-timeline.js.map
