// Polyfill missing ArrayBuffer/SharedArrayBuffer properties for Hermes (Expo Go).
// webidl-conversions reads these via Object.getOwnPropertyDescriptor(...).get
// and crashes if the property doesn't exist on the prototype.

// String.prototype.toWellFormed (ES2024 — not in Hermes)
if (!String.prototype.toWellFormed) {
  String.prototype.toWellFormed = function () {
    var str = String(this);
    var result = '';
    for (var i = 0; i < str.length; i++) {
      var code = str.charCodeAt(i);
      if (code >= 0xD800 && code <= 0xDBFF) {
        var next = i + 1 < str.length ? str.charCodeAt(i + 1) : 0;
        if (next >= 0xDC00 && next <= 0xDFFF) {
          result += str[i] + str[i + 1];
          i++;
        } else {
          result += '\uFFFD';
        }
      } else if (code >= 0xDC00 && code <= 0xDFFF) {
        result += '\uFFFD';
      } else {
        result += str[i];
      }
    }
    return result;
  };
}

// ArrayBuffer.prototype.resizable (ES2024 — not in Hermes)
if (!Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')) {
  Object.defineProperty(ArrayBuffer.prototype, 'resizable', {
    get: function () { return false; },
    configurable: true,
  });
}

// Polyfill SharedArrayBuffer for Hermes engines (Expo Go) that lack native support.
// webidl-conversions reads SharedArrayBuffer.prototype.byteLength and .growable via
// Object.getOwnPropertyDescriptor, so we need a proper prototype with those descriptors.
if (typeof globalThis.SharedArrayBuffer === 'undefined') {
  function SharedArrayBufferPolyfill(length) {
    return new ArrayBuffer(length);
  }
  SharedArrayBufferPolyfill.prototype = Object.create(ArrayBuffer.prototype);
  Object.defineProperty(SharedArrayBufferPolyfill.prototype, 'constructor', {
    value: SharedArrayBufferPolyfill,
  });
  Object.defineProperty(SharedArrayBufferPolyfill.prototype, 'byteLength', {
    get: function () {
      return ArrayBuffer.prototype.slice.call(this, 0).byteLength;
    },
  });
  Object.defineProperty(SharedArrayBufferPolyfill.prototype, 'growable', {
    get: function () {
      return false;
    },
  });
  SharedArrayBufferPolyfill.prototype.grow = function () {
    throw new TypeError('SharedArrayBuffer polyfill does not support grow');
  };
  SharedArrayBufferPolyfill.prototype.slice = function (begin, end) {
    var buf = ArrayBuffer.prototype.slice.call(this, begin, end);
    Object.setPrototypeOf(buf, SharedArrayBufferPolyfill.prototype);
    return buf;
  };
  globalThis.SharedArrayBuffer = SharedArrayBufferPolyfill;
}

if (typeof globalThis.Atomics === 'undefined') {
  globalThis.Atomics = {
    wait: function () { return 'not-equal'; },
    notify: function () { return 0; },
    load: function (ta, i) { return ta[i]; },
    store: function (ta, i, v) { ta[i] = v; return v; },
    add: function (ta, i, v) { var old = ta[i]; ta[i] += v; return old; },
    sub: function (ta, i, v) { var old = ta[i]; ta[i] -= v; return old; },
    and: function (ta, i, v) { var old = ta[i]; ta[i] &= v; return old; },
    or: function (ta, i, v) { var old = ta[i]; ta[i] |= v; return old; },
    xor: function (ta, i, v) { var old = ta[i]; ta[i] ^= v; return old; },
    exchange: function (ta, i, v) { var old = ta[i]; ta[i] = v; return old; },
    compareExchange: function (ta, i, expected, replacement) {
      var old = ta[i];
      if (old === expected) ta[i] = replacement;
      return old;
    },
    isLockFree: function () { return true; },
  };
}
