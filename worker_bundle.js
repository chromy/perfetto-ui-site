var perfetto = (function () {
	'use strict';

	var commonjsGlobal = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

	function unwrapExports (x) {
		return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
	}

	function createCommonjsModule(fn, module) {
		return module = { exports: {} }, fn(module, module.exports), module.exports;
	}

	var state = createCommonjsModule(function (module, exports) {
	/*
	 * Copyright (C) 2018 The Android Open Source Project
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *      http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	Object.defineProperty(exports, "__esModule", { value: true });
	function createZeroState() {
	    return {
	        fragment: "/home",
	        config_editor: {
	            stream_to_host: false,
	            buffer_size_kb: null,
	            trace_duration_ms: null,
	            atrace_categories: {},
	        },
	        fragment_params: {},
	        traces: [],
	        backends: {},
	        config_commandline: "echo 'Create a config above'",
	    };
	}
	exports.createZeroState = createZeroState;

	});

	unwrapExports(state);
	var state_1 = state.createZeroState;

	var aspromise = asPromise;

	/**
	 * Callback as used by {@link util.asPromise}.
	 * @typedef asPromiseCallback
	 * @type {function}
	 * @param {Error|null} error Error, if any
	 * @param {...*} params Additional arguments
	 * @returns {undefined}
	 */

	/**
	 * Returns a promise from a node-style callback function.
	 * @memberof util
	 * @param {asPromiseCallback} fn Function to call
	 * @param {*} ctx Function context
	 * @param {...*} params Function arguments
	 * @returns {Promise<*>} Promisified function
	 */
	function asPromise(fn, ctx/*, varargs */) {
	    var params  = new Array(arguments.length - 1),
	        offset  = 0,
	        index   = 2,
	        pending = true;
	    while (index < arguments.length)
	        params[offset++] = arguments[index++];
	    return new Promise(function executor(resolve, reject) {
	        params[offset] = function callback(err/*, varargs */) {
	            if (pending) {
	                pending = false;
	                if (err)
	                    reject(err);
	                else {
	                    var params = new Array(arguments.length - 1),
	                        offset = 0;
	                    while (offset < params.length)
	                        params[offset++] = arguments[offset];
	                    resolve.apply(null, params);
	                }
	            }
	        };
	        try {
	            fn.apply(ctx || null, params);
	        } catch (err) {
	            if (pending) {
	                pending = false;
	                reject(err);
	            }
	        }
	    });
	}

	var base64_1 = createCommonjsModule(function (module, exports) {

	/**
	 * A minimal base64 implementation for number arrays.
	 * @memberof util
	 * @namespace
	 */
	var base64 = exports;

	/**
	 * Calculates the byte length of a base64 encoded string.
	 * @param {string} string Base64 encoded string
	 * @returns {number} Byte length
	 */
	base64.length = function length(string) {
	    var p = string.length;
	    if (!p)
	        return 0;
	    var n = 0;
	    while (--p % 4 > 1 && string.charAt(p) === "=")
	        ++n;
	    return Math.ceil(string.length * 3) / 4 - n;
	};

	// Base64 encoding table
	var b64 = new Array(64);

	// Base64 decoding table
	var s64 = new Array(123);

	// 65..90, 97..122, 48..57, 43, 47
	for (var i = 0; i < 64;)
	    s64[b64[i] = i < 26 ? i + 65 : i < 52 ? i + 71 : i < 62 ? i - 4 : i - 59 | 43] = i++;

	/**
	 * Encodes a buffer to a base64 encoded string.
	 * @param {Uint8Array} buffer Source buffer
	 * @param {number} start Source start
	 * @param {number} end Source end
	 * @returns {string} Base64 encoded string
	 */
	base64.encode = function encode(buffer, start, end) {
	    var parts = null,
	        chunk = [];
	    var i = 0, // output index
	        j = 0, // goto index
	        t;     // temporary
	    while (start < end) {
	        var b = buffer[start++];
	        switch (j) {
	            case 0:
	                chunk[i++] = b64[b >> 2];
	                t = (b & 3) << 4;
	                j = 1;
	                break;
	            case 1:
	                chunk[i++] = b64[t | b >> 4];
	                t = (b & 15) << 2;
	                j = 2;
	                break;
	            case 2:
	                chunk[i++] = b64[t | b >> 6];
	                chunk[i++] = b64[b & 63];
	                j = 0;
	                break;
	        }
	        if (i > 8191) {
	            (parts || (parts = [])).push(String.fromCharCode.apply(String, chunk));
	            i = 0;
	        }
	    }
	    if (j) {
	        chunk[i++] = b64[t];
	        chunk[i++] = 61;
	        if (j === 1)
	            chunk[i++] = 61;
	    }
	    if (parts) {
	        if (i)
	            parts.push(String.fromCharCode.apply(String, chunk.slice(0, i)));
	        return parts.join("");
	    }
	    return String.fromCharCode.apply(String, chunk.slice(0, i));
	};

	var invalidEncoding = "invalid encoding";

	/**
	 * Decodes a base64 encoded string to a buffer.
	 * @param {string} string Source string
	 * @param {Uint8Array} buffer Destination buffer
	 * @param {number} offset Destination offset
	 * @returns {number} Number of bytes written
	 * @throws {Error} If encoding is invalid
	 */
	base64.decode = function decode(string, buffer, offset) {
	    var start = offset;
	    var j = 0, // goto index
	        t;     // temporary
	    for (var i = 0; i < string.length;) {
	        var c = string.charCodeAt(i++);
	        if (c === 61 && j > 1)
	            break;
	        if ((c = s64[c]) === undefined)
	            throw Error(invalidEncoding);
	        switch (j) {
	            case 0:
	                t = c;
	                j = 1;
	                break;
	            case 1:
	                buffer[offset++] = t << 2 | (c & 48) >> 4;
	                t = c;
	                j = 2;
	                break;
	            case 2:
	                buffer[offset++] = (t & 15) << 4 | (c & 60) >> 2;
	                t = c;
	                j = 3;
	                break;
	            case 3:
	                buffer[offset++] = (t & 3) << 6 | c;
	                j = 0;
	                break;
	        }
	    }
	    if (j === 1)
	        throw Error(invalidEncoding);
	    return offset - start;
	};

	/**
	 * Tests if the specified string appears to be base64 encoded.
	 * @param {string} string String to test
	 * @returns {boolean} `true` if probably base64 encoded, otherwise false
	 */
	base64.test = function test(string) {
	    return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(string);
	};
	});

	var eventemitter = EventEmitter;

	/**
	 * Constructs a new event emitter instance.
	 * @classdesc A minimal event emitter.
	 * @memberof util
	 * @constructor
	 */
	function EventEmitter() {

	    /**
	     * Registered listeners.
	     * @type {Object.<string,*>}
	     * @private
	     */
	    this._listeners = {};
	}

	/**
	 * Registers an event listener.
	 * @param {string} evt Event name
	 * @param {function} fn Listener
	 * @param {*} [ctx] Listener context
	 * @returns {util.EventEmitter} `this`
	 */
	EventEmitter.prototype.on = function on(evt, fn, ctx) {
	    (this._listeners[evt] || (this._listeners[evt] = [])).push({
	        fn  : fn,
	        ctx : ctx || this
	    });
	    return this;
	};

	/**
	 * Removes an event listener or any matching listeners if arguments are omitted.
	 * @param {string} [evt] Event name. Removes all listeners if omitted.
	 * @param {function} [fn] Listener to remove. Removes all listeners of `evt` if omitted.
	 * @returns {util.EventEmitter} `this`
	 */
	EventEmitter.prototype.off = function off(evt, fn) {
	    if (evt === undefined)
	        this._listeners = {};
	    else {
	        if (fn === undefined)
	            this._listeners[evt] = [];
	        else {
	            var listeners = this._listeners[evt];
	            for (var i = 0; i < listeners.length;)
	                if (listeners[i].fn === fn)
	                    listeners.splice(i, 1);
	                else
	                    ++i;
	        }
	    }
	    return this;
	};

	/**
	 * Emits an event by calling its listeners with the specified arguments.
	 * @param {string} evt Event name
	 * @param {...*} args Arguments
	 * @returns {util.EventEmitter} `this`
	 */
	EventEmitter.prototype.emit = function emit(evt) {
	    var listeners = this._listeners[evt];
	    if (listeners) {
	        var args = [],
	            i = 1;
	        for (; i < arguments.length;)
	            args.push(arguments[i++]);
	        for (i = 0; i < listeners.length;)
	            listeners[i].fn.apply(listeners[i++].ctx, args);
	    }
	    return this;
	};

	var float_1 = factory(factory);

	/**
	 * Reads / writes floats / doubles from / to buffers.
	 * @name util.float
	 * @namespace
	 */

	/**
	 * Writes a 32 bit float to a buffer using little endian byte order.
	 * @name util.float.writeFloatLE
	 * @function
	 * @param {number} val Value to write
	 * @param {Uint8Array} buf Target buffer
	 * @param {number} pos Target buffer offset
	 * @returns {undefined}
	 */

	/**
	 * Writes a 32 bit float to a buffer using big endian byte order.
	 * @name util.float.writeFloatBE
	 * @function
	 * @param {number} val Value to write
	 * @param {Uint8Array} buf Target buffer
	 * @param {number} pos Target buffer offset
	 * @returns {undefined}
	 */

	/**
	 * Reads a 32 bit float from a buffer using little endian byte order.
	 * @name util.float.readFloatLE
	 * @function
	 * @param {Uint8Array} buf Source buffer
	 * @param {number} pos Source buffer offset
	 * @returns {number} Value read
	 */

	/**
	 * Reads a 32 bit float from a buffer using big endian byte order.
	 * @name util.float.readFloatBE
	 * @function
	 * @param {Uint8Array} buf Source buffer
	 * @param {number} pos Source buffer offset
	 * @returns {number} Value read
	 */

	/**
	 * Writes a 64 bit double to a buffer using little endian byte order.
	 * @name util.float.writeDoubleLE
	 * @function
	 * @param {number} val Value to write
	 * @param {Uint8Array} buf Target buffer
	 * @param {number} pos Target buffer offset
	 * @returns {undefined}
	 */

	/**
	 * Writes a 64 bit double to a buffer using big endian byte order.
	 * @name util.float.writeDoubleBE
	 * @function
	 * @param {number} val Value to write
	 * @param {Uint8Array} buf Target buffer
	 * @param {number} pos Target buffer offset
	 * @returns {undefined}
	 */

	/**
	 * Reads a 64 bit double from a buffer using little endian byte order.
	 * @name util.float.readDoubleLE
	 * @function
	 * @param {Uint8Array} buf Source buffer
	 * @param {number} pos Source buffer offset
	 * @returns {number} Value read
	 */

	/**
	 * Reads a 64 bit double from a buffer using big endian byte order.
	 * @name util.float.readDoubleBE
	 * @function
	 * @param {Uint8Array} buf Source buffer
	 * @param {number} pos Source buffer offset
	 * @returns {number} Value read
	 */

	// Factory function for the purpose of node-based testing in modified global environments
	function factory(exports) {

	    // float: typed array
	    if (typeof Float32Array !== "undefined") (function() {

	        var f32 = new Float32Array([ -0 ]),
	            f8b = new Uint8Array(f32.buffer),
	            le  = f8b[3] === 128;

	        function writeFloat_f32_cpy(val, buf, pos) {
	            f32[0] = val;
	            buf[pos    ] = f8b[0];
	            buf[pos + 1] = f8b[1];
	            buf[pos + 2] = f8b[2];
	            buf[pos + 3] = f8b[3];
	        }

	        function writeFloat_f32_rev(val, buf, pos) {
	            f32[0] = val;
	            buf[pos    ] = f8b[3];
	            buf[pos + 1] = f8b[2];
	            buf[pos + 2] = f8b[1];
	            buf[pos + 3] = f8b[0];
	        }

	        /* istanbul ignore next */
	        exports.writeFloatLE = le ? writeFloat_f32_cpy : writeFloat_f32_rev;
	        /* istanbul ignore next */
	        exports.writeFloatBE = le ? writeFloat_f32_rev : writeFloat_f32_cpy;

	        function readFloat_f32_cpy(buf, pos) {
	            f8b[0] = buf[pos    ];
	            f8b[1] = buf[pos + 1];
	            f8b[2] = buf[pos + 2];
	            f8b[3] = buf[pos + 3];
	            return f32[0];
	        }

	        function readFloat_f32_rev(buf, pos) {
	            f8b[3] = buf[pos    ];
	            f8b[2] = buf[pos + 1];
	            f8b[1] = buf[pos + 2];
	            f8b[0] = buf[pos + 3];
	            return f32[0];
	        }

	        /* istanbul ignore next */
	        exports.readFloatLE = le ? readFloat_f32_cpy : readFloat_f32_rev;
	        /* istanbul ignore next */
	        exports.readFloatBE = le ? readFloat_f32_rev : readFloat_f32_cpy;

	    // float: ieee754
	    })(); else (function() {

	        function writeFloat_ieee754(writeUint, val, buf, pos) {
	            var sign = val < 0 ? 1 : 0;
	            if (sign)
	                val = -val;
	            if (val === 0)
	                writeUint(1 / val > 0 ? /* positive */ 0 : /* negative 0 */ 2147483648, buf, pos);
	            else if (isNaN(val))
	                writeUint(2143289344, buf, pos);
	            else if (val > 3.4028234663852886e+38) // +-Infinity
	                writeUint((sign << 31 | 2139095040) >>> 0, buf, pos);
	            else if (val < 1.1754943508222875e-38) // denormal
	                writeUint((sign << 31 | Math.round(val / 1.401298464324817e-45)) >>> 0, buf, pos);
	            else {
	                var exponent = Math.floor(Math.log(val) / Math.LN2),
	                    mantissa = Math.round(val * Math.pow(2, -exponent) * 8388608) & 8388607;
	                writeUint((sign << 31 | exponent + 127 << 23 | mantissa) >>> 0, buf, pos);
	            }
	        }

	        exports.writeFloatLE = writeFloat_ieee754.bind(null, writeUintLE);
	        exports.writeFloatBE = writeFloat_ieee754.bind(null, writeUintBE);

	        function readFloat_ieee754(readUint, buf, pos) {
	            var uint = readUint(buf, pos),
	                sign = (uint >> 31) * 2 + 1,
	                exponent = uint >>> 23 & 255,
	                mantissa = uint & 8388607;
	            return exponent === 255
	                ? mantissa
	                ? NaN
	                : sign * Infinity
	                : exponent === 0 // denormal
	                ? sign * 1.401298464324817e-45 * mantissa
	                : sign * Math.pow(2, exponent - 150) * (mantissa + 8388608);
	        }

	        exports.readFloatLE = readFloat_ieee754.bind(null, readUintLE);
	        exports.readFloatBE = readFloat_ieee754.bind(null, readUintBE);

	    })();

	    // double: typed array
	    if (typeof Float64Array !== "undefined") (function() {

	        var f64 = new Float64Array([-0]),
	            f8b = new Uint8Array(f64.buffer),
	            le  = f8b[7] === 128;

	        function writeDouble_f64_cpy(val, buf, pos) {
	            f64[0] = val;
	            buf[pos    ] = f8b[0];
	            buf[pos + 1] = f8b[1];
	            buf[pos + 2] = f8b[2];
	            buf[pos + 3] = f8b[3];
	            buf[pos + 4] = f8b[4];
	            buf[pos + 5] = f8b[5];
	            buf[pos + 6] = f8b[6];
	            buf[pos + 7] = f8b[7];
	        }

	        function writeDouble_f64_rev(val, buf, pos) {
	            f64[0] = val;
	            buf[pos    ] = f8b[7];
	            buf[pos + 1] = f8b[6];
	            buf[pos + 2] = f8b[5];
	            buf[pos + 3] = f8b[4];
	            buf[pos + 4] = f8b[3];
	            buf[pos + 5] = f8b[2];
	            buf[pos + 6] = f8b[1];
	            buf[pos + 7] = f8b[0];
	        }

	        /* istanbul ignore next */
	        exports.writeDoubleLE = le ? writeDouble_f64_cpy : writeDouble_f64_rev;
	        /* istanbul ignore next */
	        exports.writeDoubleBE = le ? writeDouble_f64_rev : writeDouble_f64_cpy;

	        function readDouble_f64_cpy(buf, pos) {
	            f8b[0] = buf[pos    ];
	            f8b[1] = buf[pos + 1];
	            f8b[2] = buf[pos + 2];
	            f8b[3] = buf[pos + 3];
	            f8b[4] = buf[pos + 4];
	            f8b[5] = buf[pos + 5];
	            f8b[6] = buf[pos + 6];
	            f8b[7] = buf[pos + 7];
	            return f64[0];
	        }

	        function readDouble_f64_rev(buf, pos) {
	            f8b[7] = buf[pos    ];
	            f8b[6] = buf[pos + 1];
	            f8b[5] = buf[pos + 2];
	            f8b[4] = buf[pos + 3];
	            f8b[3] = buf[pos + 4];
	            f8b[2] = buf[pos + 5];
	            f8b[1] = buf[pos + 6];
	            f8b[0] = buf[pos + 7];
	            return f64[0];
	        }

	        /* istanbul ignore next */
	        exports.readDoubleLE = le ? readDouble_f64_cpy : readDouble_f64_rev;
	        /* istanbul ignore next */
	        exports.readDoubleBE = le ? readDouble_f64_rev : readDouble_f64_cpy;

	    // double: ieee754
	    })(); else (function() {

	        function writeDouble_ieee754(writeUint, off0, off1, val, buf, pos) {
	            var sign = val < 0 ? 1 : 0;
	            if (sign)
	                val = -val;
	            if (val === 0) {
	                writeUint(0, buf, pos + off0);
	                writeUint(1 / val > 0 ? /* positive */ 0 : /* negative 0 */ 2147483648, buf, pos + off1);
	            } else if (isNaN(val)) {
	                writeUint(0, buf, pos + off0);
	                writeUint(2146959360, buf, pos + off1);
	            } else if (val > 1.7976931348623157e+308) { // +-Infinity
	                writeUint(0, buf, pos + off0);
	                writeUint((sign << 31 | 2146435072) >>> 0, buf, pos + off1);
	            } else {
	                var mantissa;
	                if (val < 2.2250738585072014e-308) { // denormal
	                    mantissa = val / 5e-324;
	                    writeUint(mantissa >>> 0, buf, pos + off0);
	                    writeUint((sign << 31 | mantissa / 4294967296) >>> 0, buf, pos + off1);
	                } else {
	                    var exponent = Math.floor(Math.log(val) / Math.LN2);
	                    if (exponent === 1024)
	                        exponent = 1023;
	                    mantissa = val * Math.pow(2, -exponent);
	                    writeUint(mantissa * 4503599627370496 >>> 0, buf, pos + off0);
	                    writeUint((sign << 31 | exponent + 1023 << 20 | mantissa * 1048576 & 1048575) >>> 0, buf, pos + off1);
	                }
	            }
	        }

	        exports.writeDoubleLE = writeDouble_ieee754.bind(null, writeUintLE, 0, 4);
	        exports.writeDoubleBE = writeDouble_ieee754.bind(null, writeUintBE, 4, 0);

	        function readDouble_ieee754(readUint, off0, off1, buf, pos) {
	            var lo = readUint(buf, pos + off0),
	                hi = readUint(buf, pos + off1);
	            var sign = (hi >> 31) * 2 + 1,
	                exponent = hi >>> 20 & 2047,
	                mantissa = 4294967296 * (hi & 1048575) + lo;
	            return exponent === 2047
	                ? mantissa
	                ? NaN
	                : sign * Infinity
	                : exponent === 0 // denormal
	                ? sign * 5e-324 * mantissa
	                : sign * Math.pow(2, exponent - 1075) * (mantissa + 4503599627370496);
	        }

	        exports.readDoubleLE = readDouble_ieee754.bind(null, readUintLE, 0, 4);
	        exports.readDoubleBE = readDouble_ieee754.bind(null, readUintBE, 4, 0);

	    })();

	    return exports;
	}

	// uint helpers

	function writeUintLE(val, buf, pos) {
	    buf[pos    ] =  val        & 255;
	    buf[pos + 1] =  val >>> 8  & 255;
	    buf[pos + 2] =  val >>> 16 & 255;
	    buf[pos + 3] =  val >>> 24;
	}

	function writeUintBE(val, buf, pos) {
	    buf[pos    ] =  val >>> 24;
	    buf[pos + 1] =  val >>> 16 & 255;
	    buf[pos + 2] =  val >>> 8  & 255;
	    buf[pos + 3] =  val        & 255;
	}

	function readUintLE(buf, pos) {
	    return (buf[pos    ]
	          | buf[pos + 1] << 8
	          | buf[pos + 2] << 16
	          | buf[pos + 3] << 24) >>> 0;
	}

	function readUintBE(buf, pos) {
	    return (buf[pos    ] << 24
	          | buf[pos + 1] << 16
	          | buf[pos + 2] << 8
	          | buf[pos + 3]) >>> 0;
	}

	var inquire_1 = inquire;

	/**
	 * Requires a module only if available.
	 * @memberof util
	 * @param {string} moduleName Module to require
	 * @returns {?Object} Required module if available and not empty, otherwise `null`
	 */
	function inquire(moduleName) {
	    try {
	        var mod = eval("quire".replace(/^/,"re"))(moduleName); // eslint-disable-line no-eval
	        if (mod && (mod.length || Object.keys(mod).length))
	            return mod;
	    } catch (e) {} // eslint-disable-line no-empty
	    return null;
	}

	var utf8_1 = createCommonjsModule(function (module, exports) {

	/**
	 * A minimal UTF8 implementation for number arrays.
	 * @memberof util
	 * @namespace
	 */
	var utf8 = exports;

	/**
	 * Calculates the UTF8 byte length of a string.
	 * @param {string} string String
	 * @returns {number} Byte length
	 */
	utf8.length = function utf8_length(string) {
	    var len = 0,
	        c = 0;
	    for (var i = 0; i < string.length; ++i) {
	        c = string.charCodeAt(i);
	        if (c < 128)
	            len += 1;
	        else if (c < 2048)
	            len += 2;
	        else if ((c & 0xFC00) === 0xD800 && (string.charCodeAt(i + 1) & 0xFC00) === 0xDC00) {
	            ++i;
	            len += 4;
	        } else
	            len += 3;
	    }
	    return len;
	};

	/**
	 * Reads UTF8 bytes as a string.
	 * @param {Uint8Array} buffer Source buffer
	 * @param {number} start Source start
	 * @param {number} end Source end
	 * @returns {string} String read
	 */
	utf8.read = function utf8_read(buffer, start, end) {
	    var len = end - start;
	    if (len < 1)
	        return "";
	    var parts = null,
	        chunk = [],
	        i = 0, // char offset
	        t;     // temporary
	    while (start < end) {
	        t = buffer[start++];
	        if (t < 128)
	            chunk[i++] = t;
	        else if (t > 191 && t < 224)
	            chunk[i++] = (t & 31) << 6 | buffer[start++] & 63;
	        else if (t > 239 && t < 365) {
	            t = ((t & 7) << 18 | (buffer[start++] & 63) << 12 | (buffer[start++] & 63) << 6 | buffer[start++] & 63) - 0x10000;
	            chunk[i++] = 0xD800 + (t >> 10);
	            chunk[i++] = 0xDC00 + (t & 1023);
	        } else
	            chunk[i++] = (t & 15) << 12 | (buffer[start++] & 63) << 6 | buffer[start++] & 63;
	        if (i > 8191) {
	            (parts || (parts = [])).push(String.fromCharCode.apply(String, chunk));
	            i = 0;
	        }
	    }
	    if (parts) {
	        if (i)
	            parts.push(String.fromCharCode.apply(String, chunk.slice(0, i)));
	        return parts.join("");
	    }
	    return String.fromCharCode.apply(String, chunk.slice(0, i));
	};

	/**
	 * Writes a string as UTF8 bytes.
	 * @param {string} string Source string
	 * @param {Uint8Array} buffer Destination buffer
	 * @param {number} offset Destination offset
	 * @returns {number} Bytes written
	 */
	utf8.write = function utf8_write(string, buffer, offset) {
	    var start = offset,
	        c1, // character 1
	        c2; // character 2
	    for (var i = 0; i < string.length; ++i) {
	        c1 = string.charCodeAt(i);
	        if (c1 < 128) {
	            buffer[offset++] = c1;
	        } else if (c1 < 2048) {
	            buffer[offset++] = c1 >> 6       | 192;
	            buffer[offset++] = c1       & 63 | 128;
	        } else if ((c1 & 0xFC00) === 0xD800 && ((c2 = string.charCodeAt(i + 1)) & 0xFC00) === 0xDC00) {
	            c1 = 0x10000 + ((c1 & 0x03FF) << 10) + (c2 & 0x03FF);
	            ++i;
	            buffer[offset++] = c1 >> 18      | 240;
	            buffer[offset++] = c1 >> 12 & 63 | 128;
	            buffer[offset++] = c1 >> 6  & 63 | 128;
	            buffer[offset++] = c1       & 63 | 128;
	        } else {
	            buffer[offset++] = c1 >> 12      | 224;
	            buffer[offset++] = c1 >> 6  & 63 | 128;
	            buffer[offset++] = c1       & 63 | 128;
	        }
	    }
	    return offset - start;
	};
	});

	var pool_1 = pool;

	/**
	 * An allocator as used by {@link util.pool}.
	 * @typedef PoolAllocator
	 * @type {function}
	 * @param {number} size Buffer size
	 * @returns {Uint8Array} Buffer
	 */

	/**
	 * A slicer as used by {@link util.pool}.
	 * @typedef PoolSlicer
	 * @type {function}
	 * @param {number} start Start offset
	 * @param {number} end End offset
	 * @returns {Uint8Array} Buffer slice
	 * @this {Uint8Array}
	 */

	/**
	 * A general purpose buffer pool.
	 * @memberof util
	 * @function
	 * @param {PoolAllocator} alloc Allocator
	 * @param {PoolSlicer} slice Slicer
	 * @param {number} [size=8192] Slab size
	 * @returns {PoolAllocator} Pooled allocator
	 */
	function pool(alloc, slice, size) {
	    var SIZE   = size || 8192;
	    var MAX    = SIZE >>> 1;
	    var slab   = null;
	    var offset = SIZE;
	    return function pool_alloc(size) {
	        if (size < 1 || size > MAX)
	            return alloc(size);
	        if (offset + size > SIZE) {
	            slab = alloc(SIZE);
	            offset = 0;
	        }
	        var buf = slice.call(slab, offset, offset += size);
	        if (offset & 7) // align to 32 bit
	            offset = (offset | 7) + 1;
	        return buf;
	    };
	}

	var longbits = LongBits;



	/**
	 * Constructs new long bits.
	 * @classdesc Helper class for working with the low and high bits of a 64 bit value.
	 * @memberof util
	 * @constructor
	 * @param {number} lo Low 32 bits, unsigned
	 * @param {number} hi High 32 bits, unsigned
	 */
	function LongBits(lo, hi) {

	    // note that the casts below are theoretically unnecessary as of today, but older statically
	    // generated converter code might still call the ctor with signed 32bits. kept for compat.

	    /**
	     * Low bits.
	     * @type {number}
	     */
	    this.lo = lo >>> 0;

	    /**
	     * High bits.
	     * @type {number}
	     */
	    this.hi = hi >>> 0;
	}

	/**
	 * Zero bits.
	 * @memberof util.LongBits
	 * @type {util.LongBits}
	 */
	var zero = LongBits.zero = new LongBits(0, 0);

	zero.toNumber = function() { return 0; };
	zero.zzEncode = zero.zzDecode = function() { return this; };
	zero.length = function() { return 1; };

	/**
	 * Zero hash.
	 * @memberof util.LongBits
	 * @type {string}
	 */
	var zeroHash = LongBits.zeroHash = "\0\0\0\0\0\0\0\0";

	/**
	 * Constructs new long bits from the specified number.
	 * @param {number} value Value
	 * @returns {util.LongBits} Instance
	 */
	LongBits.fromNumber = function fromNumber(value) {
	    if (value === 0)
	        return zero;
	    var sign = value < 0;
	    if (sign)
	        value = -value;
	    var lo = value >>> 0,
	        hi = (value - lo) / 4294967296 >>> 0;
	    if (sign) {
	        hi = ~hi >>> 0;
	        lo = ~lo >>> 0;
	        if (++lo > 4294967295) {
	            lo = 0;
	            if (++hi > 4294967295)
	                hi = 0;
	        }
	    }
	    return new LongBits(lo, hi);
	};

	/**
	 * Constructs new long bits from a number, long or string.
	 * @param {Long|number|string} value Value
	 * @returns {util.LongBits} Instance
	 */
	LongBits.from = function from(value) {
	    if (typeof value === "number")
	        return LongBits.fromNumber(value);
	    if (minimal.isString(value)) {
	        /* istanbul ignore else */
	        if (minimal.Long)
	            value = minimal.Long.fromString(value);
	        else
	            return LongBits.fromNumber(parseInt(value, 10));
	    }
	    return value.low || value.high ? new LongBits(value.low >>> 0, value.high >>> 0) : zero;
	};

	/**
	 * Converts this long bits to a possibly unsafe JavaScript number.
	 * @param {boolean} [unsigned=false] Whether unsigned or not
	 * @returns {number} Possibly unsafe number
	 */
	LongBits.prototype.toNumber = function toNumber(unsigned) {
	    if (!unsigned && this.hi >>> 31) {
	        var lo = ~this.lo + 1 >>> 0,
	            hi = ~this.hi     >>> 0;
	        if (!lo)
	            hi = hi + 1 >>> 0;
	        return -(lo + hi * 4294967296);
	    }
	    return this.lo + this.hi * 4294967296;
	};

	/**
	 * Converts this long bits to a long.
	 * @param {boolean} [unsigned=false] Whether unsigned or not
	 * @returns {Long} Long
	 */
	LongBits.prototype.toLong = function toLong(unsigned) {
	    return minimal.Long
	        ? new minimal.Long(this.lo | 0, this.hi | 0, Boolean(unsigned))
	        /* istanbul ignore next */
	        : { low: this.lo | 0, high: this.hi | 0, unsigned: Boolean(unsigned) };
	};

	var charCodeAt = String.prototype.charCodeAt;

	/**
	 * Constructs new long bits from the specified 8 characters long hash.
	 * @param {string} hash Hash
	 * @returns {util.LongBits} Bits
	 */
	LongBits.fromHash = function fromHash(hash) {
	    if (hash === zeroHash)
	        return zero;
	    return new LongBits(
	        ( charCodeAt.call(hash, 0)
	        | charCodeAt.call(hash, 1) << 8
	        | charCodeAt.call(hash, 2) << 16
	        | charCodeAt.call(hash, 3) << 24) >>> 0
	    ,
	        ( charCodeAt.call(hash, 4)
	        | charCodeAt.call(hash, 5) << 8
	        | charCodeAt.call(hash, 6) << 16
	        | charCodeAt.call(hash, 7) << 24) >>> 0
	    );
	};

	/**
	 * Converts this long bits to a 8 characters long hash.
	 * @returns {string} Hash
	 */
	LongBits.prototype.toHash = function toHash() {
	    return String.fromCharCode(
	        this.lo        & 255,
	        this.lo >>> 8  & 255,
	        this.lo >>> 16 & 255,
	        this.lo >>> 24      ,
	        this.hi        & 255,
	        this.hi >>> 8  & 255,
	        this.hi >>> 16 & 255,
	        this.hi >>> 24
	    );
	};

	/**
	 * Zig-zag encodes this long bits.
	 * @returns {util.LongBits} `this`
	 */
	LongBits.prototype.zzEncode = function zzEncode() {
	    var mask =   this.hi >> 31;
	    this.hi  = ((this.hi << 1 | this.lo >>> 31) ^ mask) >>> 0;
	    this.lo  = ( this.lo << 1                   ^ mask) >>> 0;
	    return this;
	};

	/**
	 * Zig-zag decodes this long bits.
	 * @returns {util.LongBits} `this`
	 */
	LongBits.prototype.zzDecode = function zzDecode() {
	    var mask = -(this.lo & 1);
	    this.lo  = ((this.lo >>> 1 | this.hi << 31) ^ mask) >>> 0;
	    this.hi  = ( this.hi >>> 1                  ^ mask) >>> 0;
	    return this;
	};

	/**
	 * Calculates the length of this longbits when encoded as a varint.
	 * @returns {number} Length
	 */
	LongBits.prototype.length = function length() {
	    var part0 =  this.lo,
	        part1 = (this.lo >>> 28 | this.hi << 4) >>> 0,
	        part2 =  this.hi >>> 24;
	    return part2 === 0
	         ? part1 === 0
	           ? part0 < 16384
	             ? part0 < 128 ? 1 : 2
	             : part0 < 2097152 ? 3 : 4
	           : part1 < 16384
	             ? part1 < 128 ? 5 : 6
	             : part1 < 2097152 ? 7 : 8
	         : part2 < 128 ? 9 : 10;
	};

	var minimal = createCommonjsModule(function (module, exports) {
	var util = exports;

	// used to return a Promise where callback is omitted
	util.asPromise = aspromise;

	// converts to / from base64 encoded strings
	util.base64 = base64_1;

	// base class of rpc.Service
	util.EventEmitter = eventemitter;

	// float handling accross browsers
	util.float = float_1;

	// requires modules optionally and hides the call from bundlers
	util.inquire = inquire_1;

	// converts to / from utf8 encoded strings
	util.utf8 = utf8_1;

	// provides a node-like buffer pool in the browser
	util.pool = pool_1;

	// utility to work with the low and high bits of a 64 bit value
	util.LongBits = longbits;

	/**
	 * An immuable empty array.
	 * @memberof util
	 * @type {Array.<*>}
	 * @const
	 */
	util.emptyArray = Object.freeze ? Object.freeze([]) : /* istanbul ignore next */ []; // used on prototypes

	/**
	 * An immutable empty object.
	 * @type {Object}
	 * @const
	 */
	util.emptyObject = Object.freeze ? Object.freeze({}) : /* istanbul ignore next */ {}; // used on prototypes

	/**
	 * Whether running within node or not.
	 * @memberof util
	 * @type {boolean}
	 * @const
	 */
	util.isNode = Boolean(commonjsGlobal.process && commonjsGlobal.process.versions && commonjsGlobal.process.versions.node);

	/**
	 * Tests if the specified value is an integer.
	 * @function
	 * @param {*} value Value to test
	 * @returns {boolean} `true` if the value is an integer
	 */
	util.isInteger = Number.isInteger || /* istanbul ignore next */ function isInteger(value) {
	    return typeof value === "number" && isFinite(value) && Math.floor(value) === value;
	};

	/**
	 * Tests if the specified value is a string.
	 * @param {*} value Value to test
	 * @returns {boolean} `true` if the value is a string
	 */
	util.isString = function isString(value) {
	    return typeof value === "string" || value instanceof String;
	};

	/**
	 * Tests if the specified value is a non-null object.
	 * @param {*} value Value to test
	 * @returns {boolean} `true` if the value is a non-null object
	 */
	util.isObject = function isObject(value) {
	    return value && typeof value === "object";
	};

	/**
	 * Checks if a property on a message is considered to be present.
	 * This is an alias of {@link util.isSet}.
	 * @function
	 * @param {Object} obj Plain object or message instance
	 * @param {string} prop Property name
	 * @returns {boolean} `true` if considered to be present, otherwise `false`
	 */
	util.isset =

	/**
	 * Checks if a property on a message is considered to be present.
	 * @param {Object} obj Plain object or message instance
	 * @param {string} prop Property name
	 * @returns {boolean} `true` if considered to be present, otherwise `false`
	 */
	util.isSet = function isSet(obj, prop) {
	    var value = obj[prop];
	    if (value != null && obj.hasOwnProperty(prop)) // eslint-disable-line eqeqeq, no-prototype-builtins
	        return typeof value !== "object" || (Array.isArray(value) ? value.length : Object.keys(value).length) > 0;
	    return false;
	};

	/**
	 * Any compatible Buffer instance.
	 * This is a minimal stand-alone definition of a Buffer instance. The actual type is that exported by node's typings.
	 * @interface Buffer
	 * @extends Uint8Array
	 */

	/**
	 * Node's Buffer class if available.
	 * @type {Constructor<Buffer>}
	 */
	util.Buffer = (function() {
	    try {
	        var Buffer = util.inquire("buffer").Buffer;
	        // refuse to use non-node buffers if not explicitly assigned (perf reasons):
	        return Buffer.prototype.utf8Write ? Buffer : /* istanbul ignore next */ null;
	    } catch (e) {
	        /* istanbul ignore next */
	        return null;
	    }
	})();

	// Internal alias of or polyfull for Buffer.from.
	util._Buffer_from = null;

	// Internal alias of or polyfill for Buffer.allocUnsafe.
	util._Buffer_allocUnsafe = null;

	/**
	 * Creates a new buffer of whatever type supported by the environment.
	 * @param {number|number[]} [sizeOrArray=0] Buffer size or number array
	 * @returns {Uint8Array|Buffer} Buffer
	 */
	util.newBuffer = function newBuffer(sizeOrArray) {
	    /* istanbul ignore next */
	    return typeof sizeOrArray === "number"
	        ? util.Buffer
	            ? util._Buffer_allocUnsafe(sizeOrArray)
	            : new util.Array(sizeOrArray)
	        : util.Buffer
	            ? util._Buffer_from(sizeOrArray)
	            : typeof Uint8Array === "undefined"
	                ? sizeOrArray
	                : new Uint8Array(sizeOrArray);
	};

	/**
	 * Array implementation used in the browser. `Uint8Array` if supported, otherwise `Array`.
	 * @type {Constructor<Uint8Array>}
	 */
	util.Array = typeof Uint8Array !== "undefined" ? Uint8Array /* istanbul ignore next */ : Array;

	/**
	 * Any compatible Long instance.
	 * This is a minimal stand-alone definition of a Long instance. The actual type is that exported by long.js.
	 * @interface Long
	 * @property {number} low Low bits
	 * @property {number} high High bits
	 * @property {boolean} unsigned Whether unsigned or not
	 */

	/**
	 * Long.js's Long class if available.
	 * @type {Constructor<Long>}
	 */
	util.Long = /* istanbul ignore next */ commonjsGlobal.dcodeIO && /* istanbul ignore next */ commonjsGlobal.dcodeIO.Long || util.inquire("long");

	/**
	 * Regular expression used to verify 2 bit (`bool`) map keys.
	 * @type {RegExp}
	 * @const
	 */
	util.key2Re = /^true|false|0|1$/;

	/**
	 * Regular expression used to verify 32 bit (`int32` etc.) map keys.
	 * @type {RegExp}
	 * @const
	 */
	util.key32Re = /^-?(?:0|[1-9][0-9]*)$/;

	/**
	 * Regular expression used to verify 64 bit (`int64` etc.) map keys.
	 * @type {RegExp}
	 * @const
	 */
	util.key64Re = /^(?:[\\x00-\\xff]{8}|-?(?:0|[1-9][0-9]*))$/;

	/**
	 * Converts a number or long to an 8 characters long hash string.
	 * @param {Long|number} value Value to convert
	 * @returns {string} Hash
	 */
	util.longToHash = function longToHash(value) {
	    return value
	        ? util.LongBits.from(value).toHash()
	        : util.LongBits.zeroHash;
	};

	/**
	 * Converts an 8 characters long hash string to a long or number.
	 * @param {string} hash Hash
	 * @param {boolean} [unsigned=false] Whether unsigned or not
	 * @returns {Long|number} Original value
	 */
	util.longFromHash = function longFromHash(hash, unsigned) {
	    var bits = util.LongBits.fromHash(hash);
	    if (util.Long)
	        return util.Long.fromBits(bits.lo, bits.hi, unsigned);
	    return bits.toNumber(Boolean(unsigned));
	};

	/**
	 * Merges the properties of the source object into the destination object.
	 * @memberof util
	 * @param {Object.<string,*>} dst Destination object
	 * @param {Object.<string,*>} src Source object
	 * @param {boolean} [ifNotSet=false] Merges only if the key is not already set
	 * @returns {Object.<string,*>} Destination object
	 */
	function merge(dst, src, ifNotSet) { // used by converters
	    for (var keys = Object.keys(src), i = 0; i < keys.length; ++i)
	        if (dst[keys[i]] === undefined || !ifNotSet)
	            dst[keys[i]] = src[keys[i]];
	    return dst;
	}

	util.merge = merge;

	/**
	 * Converts the first character of a string to lower case.
	 * @param {string} str String to convert
	 * @returns {string} Converted string
	 */
	util.lcFirst = function lcFirst(str) {
	    return str.charAt(0).toLowerCase() + str.substring(1);
	};

	/**
	 * Creates a custom error constructor.
	 * @memberof util
	 * @param {string} name Error name
	 * @returns {Constructor<Error>} Custom error constructor
	 */
	function newError(name) {

	    function CustomError(message, properties) {

	        if (!(this instanceof CustomError))
	            return new CustomError(message, properties);

	        // Error.call(this, message);
	        // ^ just returns a new error instance because the ctor can be called as a function

	        Object.defineProperty(this, "message", { get: function() { return message; } });

	        /* istanbul ignore next */
	        if (Error.captureStackTrace) // node
	            Error.captureStackTrace(this, CustomError);
	        else
	            Object.defineProperty(this, "stack", { value: (new Error()).stack || "" });

	        if (properties)
	            merge(this, properties);
	    }

	    (CustomError.prototype = Object.create(Error.prototype)).constructor = CustomError;

	    Object.defineProperty(CustomError.prototype, "name", { get: function() { return name; } });

	    CustomError.prototype.toString = function toString() {
	        return this.name + ": " + this.message;
	    };

	    return CustomError;
	}

	util.newError = newError;

	/**
	 * Constructs a new protocol error.
	 * @classdesc Error subclass indicating a protocol specifc error.
	 * @memberof util
	 * @extends Error
	 * @template T extends Message<T>
	 * @constructor
	 * @param {string} message Error message
	 * @param {Object.<string,*>} [properties] Additional properties
	 * @example
	 * try {
	 *     MyMessage.decode(someBuffer); // throws if required fields are missing
	 * } catch (e) {
	 *     if (e instanceof ProtocolError && e.instance)
	 *         console.log("decoded so far: " + JSON.stringify(e.instance));
	 * }
	 */
	util.ProtocolError = newError("ProtocolError");

	/**
	 * So far decoded message instance.
	 * @name util.ProtocolError#instance
	 * @type {Message<T>}
	 */

	/**
	 * A OneOf getter as returned by {@link util.oneOfGetter}.
	 * @typedef OneOfGetter
	 * @type {function}
	 * @returns {string|undefined} Set field name, if any
	 */

	/**
	 * Builds a getter for a oneof's present field name.
	 * @param {string[]} fieldNames Field names
	 * @returns {OneOfGetter} Unbound getter
	 */
	util.oneOfGetter = function getOneOf(fieldNames) {
	    var fieldMap = {};
	    for (var i = 0; i < fieldNames.length; ++i)
	        fieldMap[fieldNames[i]] = 1;

	    /**
	     * @returns {string|undefined} Set field name, if any
	     * @this Object
	     * @ignore
	     */
	    return function() { // eslint-disable-line consistent-return
	        for (var keys = Object.keys(this), i = keys.length - 1; i > -1; --i)
	            if (fieldMap[keys[i]] === 1 && this[keys[i]] !== undefined && this[keys[i]] !== null)
	                return keys[i];
	    };
	};

	/**
	 * A OneOf setter as returned by {@link util.oneOfSetter}.
	 * @typedef OneOfSetter
	 * @type {function}
	 * @param {string|undefined} value Field name
	 * @returns {undefined}
	 */

	/**
	 * Builds a setter for a oneof's present field name.
	 * @param {string[]} fieldNames Field names
	 * @returns {OneOfSetter} Unbound setter
	 */
	util.oneOfSetter = function setOneOf(fieldNames) {

	    /**
	     * @param {string} name Field name
	     * @returns {undefined}
	     * @this Object
	     * @ignore
	     */
	    return function(name) {
	        for (var i = 0; i < fieldNames.length; ++i)
	            if (fieldNames[i] !== name)
	                delete this[fieldNames[i]];
	    };
	};

	/**
	 * Default conversion options used for {@link Message#toJSON} implementations.
	 *
	 * These options are close to proto3's JSON mapping with the exception that internal types like Any are handled just like messages. More precisely:
	 *
	 * - Longs become strings
	 * - Enums become string keys
	 * - Bytes become base64 encoded strings
	 * - (Sub-)Messages become plain objects
	 * - Maps become plain objects with all string keys
	 * - Repeated fields become arrays
	 * - NaN and Infinity for float and double fields become strings
	 *
	 * @type {IConversionOptions}
	 * @see https://developers.google.com/protocol-buffers/docs/proto3?hl=en#json
	 */
	util.toJSONOptions = {
	    longs: String,
	    enums: String,
	    bytes: String,
	    json: true
	};

	util._configure = function() {
	    var Buffer = util.Buffer;
	    /* istanbul ignore if */
	    if (!Buffer) {
	        util._Buffer_from = util._Buffer_allocUnsafe = null;
	        return;
	    }
	    // because node 4.x buffers are incompatible & immutable
	    // see: https://github.com/dcodeIO/protobuf.js/pull/665
	    util._Buffer_from = Buffer.from !== Uint8Array.from && Buffer.from ||
	        /* istanbul ignore next */
	        function Buffer_from(value, encoding) {
	            return new Buffer(value, encoding);
	        };
	    util._Buffer_allocUnsafe = Buffer.allocUnsafe ||
	        /* istanbul ignore next */
	        function Buffer_allocUnsafe(size) {
	            return new Buffer(size);
	        };
	};
	});

	var writer = Writer;



	var BufferWriter; // cyclic

	var LongBits$1  = minimal.LongBits,
	    base64    = minimal.base64,
	    utf8      = minimal.utf8;

	/**
	 * Constructs a new writer operation instance.
	 * @classdesc Scheduled writer operation.
	 * @constructor
	 * @param {function(*, Uint8Array, number)} fn Function to call
	 * @param {number} len Value byte length
	 * @param {*} val Value to write
	 * @ignore
	 */
	function Op(fn, len, val) {

	    /**
	     * Function to call.
	     * @type {function(Uint8Array, number, *)}
	     */
	    this.fn = fn;

	    /**
	     * Value byte length.
	     * @type {number}
	     */
	    this.len = len;

	    /**
	     * Next operation.
	     * @type {Writer.Op|undefined}
	     */
	    this.next = undefined;

	    /**
	     * Value to write.
	     * @type {*}
	     */
	    this.val = val; // type varies
	}

	/* istanbul ignore next */
	function noop() {} // eslint-disable-line no-empty-function

	/**
	 * Constructs a new writer state instance.
	 * @classdesc Copied writer state.
	 * @memberof Writer
	 * @constructor
	 * @param {Writer} writer Writer to copy state from
	 * @ignore
	 */
	function State(writer) {

	    /**
	     * Current head.
	     * @type {Writer.Op}
	     */
	    this.head = writer.head;

	    /**
	     * Current tail.
	     * @type {Writer.Op}
	     */
	    this.tail = writer.tail;

	    /**
	     * Current buffer length.
	     * @type {number}
	     */
	    this.len = writer.len;

	    /**
	     * Next state.
	     * @type {State|null}
	     */
	    this.next = writer.states;
	}

	/**
	 * Constructs a new writer instance.
	 * @classdesc Wire format writer using `Uint8Array` if available, otherwise `Array`.
	 * @constructor
	 */
	function Writer() {

	    /**
	     * Current length.
	     * @type {number}
	     */
	    this.len = 0;

	    /**
	     * Operations head.
	     * @type {Object}
	     */
	    this.head = new Op(noop, 0, 0);

	    /**
	     * Operations tail
	     * @type {Object}
	     */
	    this.tail = this.head;

	    /**
	     * Linked forked states.
	     * @type {Object|null}
	     */
	    this.states = null;

	    // When a value is written, the writer calculates its byte length and puts it into a linked
	    // list of operations to perform when finish() is called. This both allows us to allocate
	    // buffers of the exact required size and reduces the amount of work we have to do compared
	    // to first calculating over objects and then encoding over objects. In our case, the encoding
	    // part is just a linked list walk calling operations with already prepared values.
	}

	/**
	 * Creates a new writer.
	 * @function
	 * @returns {BufferWriter|Writer} A {@link BufferWriter} when Buffers are supported, otherwise a {@link Writer}
	 */
	Writer.create = minimal.Buffer
	    ? function create_buffer_setup() {
	        return (Writer.create = function create_buffer() {
	            return new BufferWriter();
	        })();
	    }
	    /* istanbul ignore next */
	    : function create_array() {
	        return new Writer();
	    };

	/**
	 * Allocates a buffer of the specified size.
	 * @param {number} size Buffer size
	 * @returns {Uint8Array} Buffer
	 */
	Writer.alloc = function alloc(size) {
	    return new minimal.Array(size);
	};

	// Use Uint8Array buffer pool in the browser, just like node does with buffers
	/* istanbul ignore else */
	if (minimal.Array !== Array)
	    Writer.alloc = minimal.pool(Writer.alloc, minimal.Array.prototype.subarray);

	/**
	 * Pushes a new operation to the queue.
	 * @param {function(Uint8Array, number, *)} fn Function to call
	 * @param {number} len Value byte length
	 * @param {number} val Value to write
	 * @returns {Writer} `this`
	 * @private
	 */
	Writer.prototype._push = function push(fn, len, val) {
	    this.tail = this.tail.next = new Op(fn, len, val);
	    this.len += len;
	    return this;
	};

	function writeByte(val, buf, pos) {
	    buf[pos] = val & 255;
	}

	function writeVarint32(val, buf, pos) {
	    while (val > 127) {
	        buf[pos++] = val & 127 | 128;
	        val >>>= 7;
	    }
	    buf[pos] = val;
	}

	/**
	 * Constructs a new varint writer operation instance.
	 * @classdesc Scheduled varint writer operation.
	 * @extends Op
	 * @constructor
	 * @param {number} len Value byte length
	 * @param {number} val Value to write
	 * @ignore
	 */
	function VarintOp(len, val) {
	    this.len = len;
	    this.next = undefined;
	    this.val = val;
	}

	VarintOp.prototype = Object.create(Op.prototype);
	VarintOp.prototype.fn = writeVarint32;

	/**
	 * Writes an unsigned 32 bit value as a varint.
	 * @param {number} value Value to write
	 * @returns {Writer} `this`
	 */
	Writer.prototype.uint32 = function write_uint32(value) {
	    // here, the call to this.push has been inlined and a varint specific Op subclass is used.
	    // uint32 is by far the most frequently used operation and benefits significantly from this.
	    this.len += (this.tail = this.tail.next = new VarintOp(
	        (value = value >>> 0)
	                < 128       ? 1
	        : value < 16384     ? 2
	        : value < 2097152   ? 3
	        : value < 268435456 ? 4
	        :                     5,
	    value)).len;
	    return this;
	};

	/**
	 * Writes a signed 32 bit value as a varint.
	 * @function
	 * @param {number} value Value to write
	 * @returns {Writer} `this`
	 */
	Writer.prototype.int32 = function write_int32(value) {
	    return value < 0
	        ? this._push(writeVarint64, 10, LongBits$1.fromNumber(value)) // 10 bytes per spec
	        : this.uint32(value);
	};

	/**
	 * Writes a 32 bit value as a varint, zig-zag encoded.
	 * @param {number} value Value to write
	 * @returns {Writer} `this`
	 */
	Writer.prototype.sint32 = function write_sint32(value) {
	    return this.uint32((value << 1 ^ value >> 31) >>> 0);
	};

	function writeVarint64(val, buf, pos) {
	    while (val.hi) {
	        buf[pos++] = val.lo & 127 | 128;
	        val.lo = (val.lo >>> 7 | val.hi << 25) >>> 0;
	        val.hi >>>= 7;
	    }
	    while (val.lo > 127) {
	        buf[pos++] = val.lo & 127 | 128;
	        val.lo = val.lo >>> 7;
	    }
	    buf[pos++] = val.lo;
	}

	/**
	 * Writes an unsigned 64 bit value as a varint.
	 * @param {Long|number|string} value Value to write
	 * @returns {Writer} `this`
	 * @throws {TypeError} If `value` is a string and no long library is present.
	 */
	Writer.prototype.uint64 = function write_uint64(value) {
	    var bits = LongBits$1.from(value);
	    return this._push(writeVarint64, bits.length(), bits);
	};

	/**
	 * Writes a signed 64 bit value as a varint.
	 * @function
	 * @param {Long|number|string} value Value to write
	 * @returns {Writer} `this`
	 * @throws {TypeError} If `value` is a string and no long library is present.
	 */
	Writer.prototype.int64 = Writer.prototype.uint64;

	/**
	 * Writes a signed 64 bit value as a varint, zig-zag encoded.
	 * @param {Long|number|string} value Value to write
	 * @returns {Writer} `this`
	 * @throws {TypeError} If `value` is a string and no long library is present.
	 */
	Writer.prototype.sint64 = function write_sint64(value) {
	    var bits = LongBits$1.from(value).zzEncode();
	    return this._push(writeVarint64, bits.length(), bits);
	};

	/**
	 * Writes a boolish value as a varint.
	 * @param {boolean} value Value to write
	 * @returns {Writer} `this`
	 */
	Writer.prototype.bool = function write_bool(value) {
	    return this._push(writeByte, 1, value ? 1 : 0);
	};

	function writeFixed32(val, buf, pos) {
	    buf[pos    ] =  val         & 255;
	    buf[pos + 1] =  val >>> 8   & 255;
	    buf[pos + 2] =  val >>> 16  & 255;
	    buf[pos + 3] =  val >>> 24;
	}

	/**
	 * Writes an unsigned 32 bit value as fixed 32 bits.
	 * @param {number} value Value to write
	 * @returns {Writer} `this`
	 */
	Writer.prototype.fixed32 = function write_fixed32(value) {
	    return this._push(writeFixed32, 4, value >>> 0);
	};

	/**
	 * Writes a signed 32 bit value as fixed 32 bits.
	 * @function
	 * @param {number} value Value to write
	 * @returns {Writer} `this`
	 */
	Writer.prototype.sfixed32 = Writer.prototype.fixed32;

	/**
	 * Writes an unsigned 64 bit value as fixed 64 bits.
	 * @param {Long|number|string} value Value to write
	 * @returns {Writer} `this`
	 * @throws {TypeError} If `value` is a string and no long library is present.
	 */
	Writer.prototype.fixed64 = function write_fixed64(value) {
	    var bits = LongBits$1.from(value);
	    return this._push(writeFixed32, 4, bits.lo)._push(writeFixed32, 4, bits.hi);
	};

	/**
	 * Writes a signed 64 bit value as fixed 64 bits.
	 * @function
	 * @param {Long|number|string} value Value to write
	 * @returns {Writer} `this`
	 * @throws {TypeError} If `value` is a string and no long library is present.
	 */
	Writer.prototype.sfixed64 = Writer.prototype.fixed64;

	/**
	 * Writes a float (32 bit).
	 * @function
	 * @param {number} value Value to write
	 * @returns {Writer} `this`
	 */
	Writer.prototype.float = function write_float(value) {
	    return this._push(minimal.float.writeFloatLE, 4, value);
	};

	/**
	 * Writes a double (64 bit float).
	 * @function
	 * @param {number} value Value to write
	 * @returns {Writer} `this`
	 */
	Writer.prototype.double = function write_double(value) {
	    return this._push(minimal.float.writeDoubleLE, 8, value);
	};

	var writeBytes = minimal.Array.prototype.set
	    ? function writeBytes_set(val, buf, pos) {
	        buf.set(val, pos); // also works for plain array values
	    }
	    /* istanbul ignore next */
	    : function writeBytes_for(val, buf, pos) {
	        for (var i = 0; i < val.length; ++i)
	            buf[pos + i] = val[i];
	    };

	/**
	 * Writes a sequence of bytes.
	 * @param {Uint8Array|string} value Buffer or base64 encoded string to write
	 * @returns {Writer} `this`
	 */
	Writer.prototype.bytes = function write_bytes(value) {
	    var len = value.length >>> 0;
	    if (!len)
	        return this._push(writeByte, 1, 0);
	    if (minimal.isString(value)) {
	        var buf = Writer.alloc(len = base64.length(value));
	        base64.decode(value, buf, 0);
	        value = buf;
	    }
	    return this.uint32(len)._push(writeBytes, len, value);
	};

	/**
	 * Writes a string.
	 * @param {string} value Value to write
	 * @returns {Writer} `this`
	 */
	Writer.prototype.string = function write_string(value) {
	    var len = utf8.length(value);
	    return len
	        ? this.uint32(len)._push(utf8.write, len, value)
	        : this._push(writeByte, 1, 0);
	};

	/**
	 * Forks this writer's state by pushing it to a stack.
	 * Calling {@link Writer#reset|reset} or {@link Writer#ldelim|ldelim} resets the writer to the previous state.
	 * @returns {Writer} `this`
	 */
	Writer.prototype.fork = function fork() {
	    this.states = new State(this);
	    this.head = this.tail = new Op(noop, 0, 0);
	    this.len = 0;
	    return this;
	};

	/**
	 * Resets this instance to the last state.
	 * @returns {Writer} `this`
	 */
	Writer.prototype.reset = function reset() {
	    if (this.states) {
	        this.head   = this.states.head;
	        this.tail   = this.states.tail;
	        this.len    = this.states.len;
	        this.states = this.states.next;
	    } else {
	        this.head = this.tail = new Op(noop, 0, 0);
	        this.len  = 0;
	    }
	    return this;
	};

	/**
	 * Resets to the last state and appends the fork state's current write length as a varint followed by its operations.
	 * @returns {Writer} `this`
	 */
	Writer.prototype.ldelim = function ldelim() {
	    var head = this.head,
	        tail = this.tail,
	        len  = this.len;
	    this.reset().uint32(len);
	    if (len) {
	        this.tail.next = head.next; // skip noop
	        this.tail = tail;
	        this.len += len;
	    }
	    return this;
	};

	/**
	 * Finishes the write operation.
	 * @returns {Uint8Array} Finished buffer
	 */
	Writer.prototype.finish = function finish() {
	    var head = this.head.next, // skip noop
	        buf  = this.constructor.alloc(this.len),
	        pos  = 0;
	    while (head) {
	        head.fn(head.val, buf, pos);
	        pos += head.len;
	        head = head.next;
	    }
	    // this.head = this.tail = null;
	    return buf;
	};

	Writer._configure = function(BufferWriter_) {
	    BufferWriter = BufferWriter_;
	};

	var writer_buffer = BufferWriter$1;

	// extends Writer

	(BufferWriter$1.prototype = Object.create(writer.prototype)).constructor = BufferWriter$1;



	var Buffer = minimal.Buffer;

	/**
	 * Constructs a new buffer writer instance.
	 * @classdesc Wire format writer using node buffers.
	 * @extends Writer
	 * @constructor
	 */
	function BufferWriter$1() {
	    writer.call(this);
	}

	/**
	 * Allocates a buffer of the specified size.
	 * @param {number} size Buffer size
	 * @returns {Buffer} Buffer
	 */
	BufferWriter$1.alloc = function alloc_buffer(size) {
	    return (BufferWriter$1.alloc = minimal._Buffer_allocUnsafe)(size);
	};

	var writeBytesBuffer = Buffer && Buffer.prototype instanceof Uint8Array && Buffer.prototype.set.name === "set"
	    ? function writeBytesBuffer_set(val, buf, pos) {
	        buf.set(val, pos); // faster than copy (requires node >= 4 where Buffers extend Uint8Array and set is properly inherited)
	                           // also works for plain array values
	    }
	    /* istanbul ignore next */
	    : function writeBytesBuffer_copy(val, buf, pos) {
	        if (val.copy) // Buffer values
	            val.copy(buf, pos, 0, val.length);
	        else for (var i = 0; i < val.length;) // plain array values
	            buf[pos++] = val[i++];
	    };

	/**
	 * @override
	 */
	BufferWriter$1.prototype.bytes = function write_bytes_buffer(value) {
	    if (minimal.isString(value))
	        value = minimal._Buffer_from(value, "base64");
	    var len = value.length >>> 0;
	    this.uint32(len);
	    if (len)
	        this._push(writeBytesBuffer, len, value);
	    return this;
	};

	function writeStringBuffer(val, buf, pos) {
	    if (val.length < 40) // plain js is faster for short strings (probably due to redundant assertions)
	        minimal.utf8.write(val, buf, pos);
	    else
	        buf.utf8Write(val, pos);
	}

	/**
	 * @override
	 */
	BufferWriter$1.prototype.string = function write_string_buffer(value) {
	    var len = Buffer.byteLength(value);
	    this.uint32(len);
	    if (len)
	        this._push(writeStringBuffer, len, value);
	    return this;
	};

	var reader = Reader;



	var BufferReader; // cyclic

	var LongBits$2  = minimal.LongBits,
	    utf8$1      = minimal.utf8;

	/* istanbul ignore next */
	function indexOutOfRange(reader, writeLength) {
	    return RangeError("index out of range: " + reader.pos + " + " + (writeLength || 1) + " > " + reader.len);
	}

	/**
	 * Constructs a new reader instance using the specified buffer.
	 * @classdesc Wire format reader using `Uint8Array` if available, otherwise `Array`.
	 * @constructor
	 * @param {Uint8Array} buffer Buffer to read from
	 */
	function Reader(buffer) {

	    /**
	     * Read buffer.
	     * @type {Uint8Array}
	     */
	    this.buf = buffer;

	    /**
	     * Read buffer position.
	     * @type {number}
	     */
	    this.pos = 0;

	    /**
	     * Read buffer length.
	     * @type {number}
	     */
	    this.len = buffer.length;
	}

	var create_array = typeof Uint8Array !== "undefined"
	    ? function create_typed_array(buffer) {
	        if (buffer instanceof Uint8Array || Array.isArray(buffer))
	            return new Reader(buffer);
	        throw Error("illegal buffer");
	    }
	    /* istanbul ignore next */
	    : function create_array(buffer) {
	        if (Array.isArray(buffer))
	            return new Reader(buffer);
	        throw Error("illegal buffer");
	    };

	/**
	 * Creates a new reader using the specified buffer.
	 * @function
	 * @param {Uint8Array|Buffer} buffer Buffer to read from
	 * @returns {Reader|BufferReader} A {@link BufferReader} if `buffer` is a Buffer, otherwise a {@link Reader}
	 * @throws {Error} If `buffer` is not a valid buffer
	 */
	Reader.create = minimal.Buffer
	    ? function create_buffer_setup(buffer) {
	        return (Reader.create = function create_buffer(buffer) {
	            return minimal.Buffer.isBuffer(buffer)
	                ? new BufferReader(buffer)
	                /* istanbul ignore next */
	                : create_array(buffer);
	        })(buffer);
	    }
	    /* istanbul ignore next */
	    : create_array;

	Reader.prototype._slice = minimal.Array.prototype.subarray || /* istanbul ignore next */ minimal.Array.prototype.slice;

	/**
	 * Reads a varint as an unsigned 32 bit value.
	 * @function
	 * @returns {number} Value read
	 */
	Reader.prototype.uint32 = (function read_uint32_setup() {
	    var value = 4294967295; // optimizer type-hint, tends to deopt otherwise (?!)
	    return function read_uint32() {
	        value = (         this.buf[this.pos] & 127       ) >>> 0; if (this.buf[this.pos++] < 128) return value;
	        value = (value | (this.buf[this.pos] & 127) <<  7) >>> 0; if (this.buf[this.pos++] < 128) return value;
	        value = (value | (this.buf[this.pos] & 127) << 14) >>> 0; if (this.buf[this.pos++] < 128) return value;
	        value = (value | (this.buf[this.pos] & 127) << 21) >>> 0; if (this.buf[this.pos++] < 128) return value;
	        value = (value | (this.buf[this.pos] &  15) << 28) >>> 0; if (this.buf[this.pos++] < 128) return value;

	        /* istanbul ignore if */
	        if ((this.pos += 5) > this.len) {
	            this.pos = this.len;
	            throw indexOutOfRange(this, 10);
	        }
	        return value;
	    };
	})();

	/**
	 * Reads a varint as a signed 32 bit value.
	 * @returns {number} Value read
	 */
	Reader.prototype.int32 = function read_int32() {
	    return this.uint32() | 0;
	};

	/**
	 * Reads a zig-zag encoded varint as a signed 32 bit value.
	 * @returns {number} Value read
	 */
	Reader.prototype.sint32 = function read_sint32() {
	    var value = this.uint32();
	    return value >>> 1 ^ -(value & 1) | 0;
	};

	/* eslint-disable no-invalid-this */

	function readLongVarint() {
	    // tends to deopt with local vars for octet etc.
	    var bits = new LongBits$2(0, 0);
	    var i = 0;
	    if (this.len - this.pos > 4) { // fast route (lo)
	        for (; i < 4; ++i) {
	            // 1st..4th
	            bits.lo = (bits.lo | (this.buf[this.pos] & 127) << i * 7) >>> 0;
	            if (this.buf[this.pos++] < 128)
	                return bits;
	        }
	        // 5th
	        bits.lo = (bits.lo | (this.buf[this.pos] & 127) << 28) >>> 0;
	        bits.hi = (bits.hi | (this.buf[this.pos] & 127) >>  4) >>> 0;
	        if (this.buf[this.pos++] < 128)
	            return bits;
	        i = 0;
	    } else {
	        for (; i < 3; ++i) {
	            /* istanbul ignore if */
	            if (this.pos >= this.len)
	                throw indexOutOfRange(this);
	            // 1st..3th
	            bits.lo = (bits.lo | (this.buf[this.pos] & 127) << i * 7) >>> 0;
	            if (this.buf[this.pos++] < 128)
	                return bits;
	        }
	        // 4th
	        bits.lo = (bits.lo | (this.buf[this.pos++] & 127) << i * 7) >>> 0;
	        return bits;
	    }
	    if (this.len - this.pos > 4) { // fast route (hi)
	        for (; i < 5; ++i) {
	            // 6th..10th
	            bits.hi = (bits.hi | (this.buf[this.pos] & 127) << i * 7 + 3) >>> 0;
	            if (this.buf[this.pos++] < 128)
	                return bits;
	        }
	    } else {
	        for (; i < 5; ++i) {
	            /* istanbul ignore if */
	            if (this.pos >= this.len)
	                throw indexOutOfRange(this);
	            // 6th..10th
	            bits.hi = (bits.hi | (this.buf[this.pos] & 127) << i * 7 + 3) >>> 0;
	            if (this.buf[this.pos++] < 128)
	                return bits;
	        }
	    }
	    /* istanbul ignore next */
	    throw Error("invalid varint encoding");
	}

	/* eslint-enable no-invalid-this */

	/**
	 * Reads a varint as a signed 64 bit value.
	 * @name Reader#int64
	 * @function
	 * @returns {Long} Value read
	 */

	/**
	 * Reads a varint as an unsigned 64 bit value.
	 * @name Reader#uint64
	 * @function
	 * @returns {Long} Value read
	 */

	/**
	 * Reads a zig-zag encoded varint as a signed 64 bit value.
	 * @name Reader#sint64
	 * @function
	 * @returns {Long} Value read
	 */

	/**
	 * Reads a varint as a boolean.
	 * @returns {boolean} Value read
	 */
	Reader.prototype.bool = function read_bool() {
	    return this.uint32() !== 0;
	};

	function readFixed32_end(buf, end) { // note that this uses `end`, not `pos`
	    return (buf[end - 4]
	          | buf[end - 3] << 8
	          | buf[end - 2] << 16
	          | buf[end - 1] << 24) >>> 0;
	}

	/**
	 * Reads fixed 32 bits as an unsigned 32 bit integer.
	 * @returns {number} Value read
	 */
	Reader.prototype.fixed32 = function read_fixed32() {

	    /* istanbul ignore if */
	    if (this.pos + 4 > this.len)
	        throw indexOutOfRange(this, 4);

	    return readFixed32_end(this.buf, this.pos += 4);
	};

	/**
	 * Reads fixed 32 bits as a signed 32 bit integer.
	 * @returns {number} Value read
	 */
	Reader.prototype.sfixed32 = function read_sfixed32() {

	    /* istanbul ignore if */
	    if (this.pos + 4 > this.len)
	        throw indexOutOfRange(this, 4);

	    return readFixed32_end(this.buf, this.pos += 4) | 0;
	};

	/* eslint-disable no-invalid-this */

	function readFixed64(/* this: Reader */) {

	    /* istanbul ignore if */
	    if (this.pos + 8 > this.len)
	        throw indexOutOfRange(this, 8);

	    return new LongBits$2(readFixed32_end(this.buf, this.pos += 4), readFixed32_end(this.buf, this.pos += 4));
	}

	/* eslint-enable no-invalid-this */

	/**
	 * Reads fixed 64 bits.
	 * @name Reader#fixed64
	 * @function
	 * @returns {Long} Value read
	 */

	/**
	 * Reads zig-zag encoded fixed 64 bits.
	 * @name Reader#sfixed64
	 * @function
	 * @returns {Long} Value read
	 */

	/**
	 * Reads a float (32 bit) as a number.
	 * @function
	 * @returns {number} Value read
	 */
	Reader.prototype.float = function read_float() {

	    /* istanbul ignore if */
	    if (this.pos + 4 > this.len)
	        throw indexOutOfRange(this, 4);

	    var value = minimal.float.readFloatLE(this.buf, this.pos);
	    this.pos += 4;
	    return value;
	};

	/**
	 * Reads a double (64 bit float) as a number.
	 * @function
	 * @returns {number} Value read
	 */
	Reader.prototype.double = function read_double() {

	    /* istanbul ignore if */
	    if (this.pos + 8 > this.len)
	        throw indexOutOfRange(this, 4);

	    var value = minimal.float.readDoubleLE(this.buf, this.pos);
	    this.pos += 8;
	    return value;
	};

	/**
	 * Reads a sequence of bytes preceeded by its length as a varint.
	 * @returns {Uint8Array} Value read
	 */
	Reader.prototype.bytes = function read_bytes() {
	    var length = this.uint32(),
	        start  = this.pos,
	        end    = this.pos + length;

	    /* istanbul ignore if */
	    if (end > this.len)
	        throw indexOutOfRange(this, length);

	    this.pos += length;
	    if (Array.isArray(this.buf)) // plain array
	        return this.buf.slice(start, end);
	    return start === end // fix for IE 10/Win8 and others' subarray returning array of size 1
	        ? new this.buf.constructor(0)
	        : this._slice.call(this.buf, start, end);
	};

	/**
	 * Reads a string preceeded by its byte length as a varint.
	 * @returns {string} Value read
	 */
	Reader.prototype.string = function read_string() {
	    var bytes = this.bytes();
	    return utf8$1.read(bytes, 0, bytes.length);
	};

	/**
	 * Skips the specified number of bytes if specified, otherwise skips a varint.
	 * @param {number} [length] Length if known, otherwise a varint is assumed
	 * @returns {Reader} `this`
	 */
	Reader.prototype.skip = function skip(length) {
	    if (typeof length === "number") {
	        /* istanbul ignore if */
	        if (this.pos + length > this.len)
	            throw indexOutOfRange(this, length);
	        this.pos += length;
	    } else {
	        do {
	            /* istanbul ignore if */
	            if (this.pos >= this.len)
	                throw indexOutOfRange(this);
	        } while (this.buf[this.pos++] & 128);
	    }
	    return this;
	};

	/**
	 * Skips the next element of the specified wire type.
	 * @param {number} wireType Wire type received
	 * @returns {Reader} `this`
	 */
	Reader.prototype.skipType = function(wireType) {
	    switch (wireType) {
	        case 0:
	            this.skip();
	            break;
	        case 1:
	            this.skip(8);
	            break;
	        case 2:
	            this.skip(this.uint32());
	            break;
	        case 3:
	            do { // eslint-disable-line no-constant-condition
	                if ((wireType = this.uint32() & 7) === 4)
	                    break;
	                this.skipType(wireType);
	            } while (true);
	            break;
	        case 5:
	            this.skip(4);
	            break;

	        /* istanbul ignore next */
	        default:
	            throw Error("invalid wire type " + wireType + " at offset " + this.pos);
	    }
	    return this;
	};

	Reader._configure = function(BufferReader_) {
	    BufferReader = BufferReader_;

	    var fn = minimal.Long ? "toLong" : /* istanbul ignore next */ "toNumber";
	    minimal.merge(Reader.prototype, {

	        int64: function read_int64() {
	            return readLongVarint.call(this)[fn](false);
	        },

	        uint64: function read_uint64() {
	            return readLongVarint.call(this)[fn](true);
	        },

	        sint64: function read_sint64() {
	            return readLongVarint.call(this).zzDecode()[fn](false);
	        },

	        fixed64: function read_fixed64() {
	            return readFixed64.call(this)[fn](true);
	        },

	        sfixed64: function read_sfixed64() {
	            return readFixed64.call(this)[fn](false);
	        }

	    });
	};

	var reader_buffer = BufferReader$1;

	// extends Reader

	(BufferReader$1.prototype = Object.create(reader.prototype)).constructor = BufferReader$1;



	/**
	 * Constructs a new buffer reader instance.
	 * @classdesc Wire format reader using node buffers.
	 * @extends Reader
	 * @constructor
	 * @param {Buffer} buffer Buffer to read from
	 */
	function BufferReader$1(buffer) {
	    reader.call(this, buffer);

	    /**
	     * Read buffer.
	     * @name BufferReader#buf
	     * @type {Buffer}
	     */
	}

	/* istanbul ignore else */
	if (minimal.Buffer)
	    BufferReader$1.prototype._slice = minimal.Buffer.prototype.slice;

	/**
	 * @override
	 */
	BufferReader$1.prototype.string = function read_string_buffer() {
	    var len = this.uint32(); // modifies pos
	    return this.buf.utf8Slice(this.pos, this.pos = Math.min(this.pos + len, this.len));
	};

	var service = Service;



	// Extends EventEmitter
	(Service.prototype = Object.create(minimal.EventEmitter.prototype)).constructor = Service;

	/**
	 * A service method callback as used by {@link rpc.ServiceMethod|ServiceMethod}.
	 *
	 * Differs from {@link RPCImplCallback} in that it is an actual callback of a service method which may not return `response = null`.
	 * @typedef rpc.ServiceMethodCallback
	 * @template TRes extends Message<TRes>
	 * @type {function}
	 * @param {Error|null} error Error, if any
	 * @param {TRes} [response] Response message
	 * @returns {undefined}
	 */

	/**
	 * A service method part of a {@link rpc.Service} as created by {@link Service.create}.
	 * @typedef rpc.ServiceMethod
	 * @template TReq extends Message<TReq>
	 * @template TRes extends Message<TRes>
	 * @type {function}
	 * @param {TReq|Properties<TReq>} request Request message or plain object
	 * @param {rpc.ServiceMethodCallback<TRes>} [callback] Node-style callback called with the error, if any, and the response message
	 * @returns {Promise<Message<TRes>>} Promise if `callback` has been omitted, otherwise `undefined`
	 */

	/**
	 * Constructs a new RPC service instance.
	 * @classdesc An RPC service as returned by {@link Service#create}.
	 * @exports rpc.Service
	 * @extends util.EventEmitter
	 * @constructor
	 * @param {RPCImpl} rpcImpl RPC implementation
	 * @param {boolean} [requestDelimited=false] Whether requests are length-delimited
	 * @param {boolean} [responseDelimited=false] Whether responses are length-delimited
	 */
	function Service(rpcImpl, requestDelimited, responseDelimited) {

	    if (typeof rpcImpl !== "function")
	        throw TypeError("rpcImpl must be a function");

	    minimal.EventEmitter.call(this);

	    /**
	     * RPC implementation. Becomes `null` once the service is ended.
	     * @type {RPCImpl|null}
	     */
	    this.rpcImpl = rpcImpl;

	    /**
	     * Whether requests are length-delimited.
	     * @type {boolean}
	     */
	    this.requestDelimited = Boolean(requestDelimited);

	    /**
	     * Whether responses are length-delimited.
	     * @type {boolean}
	     */
	    this.responseDelimited = Boolean(responseDelimited);
	}

	/**
	 * Calls a service method through {@link rpc.Service#rpcImpl|rpcImpl}.
	 * @param {Method|rpc.ServiceMethod<TReq,TRes>} method Reflected or static method
	 * @param {Constructor<TReq>} requestCtor Request constructor
	 * @param {Constructor<TRes>} responseCtor Response constructor
	 * @param {TReq|Properties<TReq>} request Request message or plain object
	 * @param {rpc.ServiceMethodCallback<TRes>} callback Service callback
	 * @returns {undefined}
	 * @template TReq extends Message<TReq>
	 * @template TRes extends Message<TRes>
	 */
	Service.prototype.rpcCall = function rpcCall(method, requestCtor, responseCtor, request, callback) {

	    if (!request)
	        throw TypeError("request must be specified");

	    var self = this;
	    if (!callback)
	        return minimal.asPromise(rpcCall, self, method, requestCtor, responseCtor, request);

	    if (!self.rpcImpl) {
	        setTimeout(function() { callback(Error("already ended")); }, 0);
	        return undefined;
	    }

	    try {
	        return self.rpcImpl(
	            method,
	            requestCtor[self.requestDelimited ? "encodeDelimited" : "encode"](request).finish(),
	            function rpcCallback(err, response) {

	                if (err) {
	                    self.emit("error", err, method);
	                    return callback(err);
	                }

	                if (response === null) {
	                    self.end(/* endedByRPC */ true);
	                    return undefined;
	                }

	                if (!(response instanceof responseCtor)) {
	                    try {
	                        response = responseCtor[self.responseDelimited ? "decodeDelimited" : "decode"](response);
	                    } catch (err) {
	                        self.emit("error", err, method);
	                        return callback(err);
	                    }
	                }

	                self.emit("data", response, method);
	                return callback(null, response);
	            }
	        );
	    } catch (err) {
	        self.emit("error", err, method);
	        setTimeout(function() { callback(err); }, 0);
	        return undefined;
	    }
	};

	/**
	 * Ends this service and emits the `end` event.
	 * @param {boolean} [endedByRPC=false] Whether the service has been ended by the RPC implementation.
	 * @returns {rpc.Service} `this`
	 */
	Service.prototype.end = function end(endedByRPC) {
	    if (this.rpcImpl) {
	        if (!endedByRPC) // signal end to rpcImpl
	            this.rpcImpl(null, null, null);
	        this.rpcImpl = null;
	        this.emit("end").off();
	    }
	    return this;
	};

	var rpc_1 = createCommonjsModule(function (module, exports) {

	/**
	 * Streaming RPC helpers.
	 * @namespace
	 */
	var rpc = exports;

	/**
	 * RPC implementation passed to {@link Service#create} performing a service request on network level, i.e. by utilizing http requests or websockets.
	 * @typedef RPCImpl
	 * @type {function}
	 * @param {Method|rpc.ServiceMethod<Message<{}>,Message<{}>>} method Reflected or static method being called
	 * @param {Uint8Array} requestData Request data
	 * @param {RPCImplCallback} callback Callback function
	 * @returns {undefined}
	 * @example
	 * function rpcImpl(method, requestData, callback) {
	 *     if (protobuf.util.lcFirst(method.name) !== "myMethod") // compatible with static code
	 *         throw Error("no such method");
	 *     asynchronouslyObtainAResponse(requestData, function(err, responseData) {
	 *         callback(err, responseData);
	 *     });
	 * }
	 */

	/**
	 * Node-style callback as used by {@link RPCImpl}.
	 * @typedef RPCImplCallback
	 * @type {function}
	 * @param {Error|null} error Error, if any, otherwise `null`
	 * @param {Uint8Array|null} [response] Response data or `null` to signal end of stream, if there hasn't been an error
	 * @returns {undefined}
	 */

	rpc.Service = service;
	});

	var roots = {};

	var indexMinimal = createCommonjsModule(function (module, exports) {
	var protobuf = exports;

	/**
	 * Build type, one of `"full"`, `"light"` or `"minimal"`.
	 * @name build
	 * @type {string}
	 * @const
	 */
	protobuf.build = "minimal";

	// Serialization
	protobuf.Writer       = writer;
	protobuf.BufferWriter = writer_buffer;
	protobuf.Reader       = reader;
	protobuf.BufferReader = reader_buffer;

	// Utility
	protobuf.util         = minimal;
	protobuf.rpc          = rpc_1;
	protobuf.roots        = roots;
	protobuf.configure    = configure;

	/* istanbul ignore next */
	/**
	 * Reconfigures the library according to the environment.
	 * @returns {undefined}
	 */
	function configure() {
	    protobuf.Reader._configure(protobuf.BufferReader);
	    protobuf.util._configure();
	}

	// Configure serialization
	protobuf.Writer._configure(protobuf.BufferWriter);
	configure();
	});

	var minimal$1 = indexMinimal;

	// Common aliases
	var $Reader = minimal$1.Reader, $Writer = minimal$1.Writer, $util = minimal$1.util;

	// Exported root namespace
	var $root = minimal$1.roots["default"] || (minimal$1.roots["default"] = {});

	$root.perfetto = (function() {

	    /**
	     * Namespace perfetto.
	     * @exports perfetto
	     * @namespace
	     */
	    var perfetto = {};

	    perfetto.protos = (function() {

	        /**
	         * Namespace protos.
	         * @memberof perfetto
	         * @namespace
	         */
	        var protos = {};

	        protos.Sched = (function() {

	            /**
	             * Properties of a Sched.
	             * @memberof perfetto.protos
	             * @interface ISched
	             * @property {string|null} [test] Sched test
	             */

	            /**
	             * Constructs a new Sched.
	             * @memberof perfetto.protos
	             * @classdesc Represents a Sched.
	             * @implements ISched
	             * @constructor
	             * @param {perfetto.protos.ISched=} [properties] Properties to set
	             */
	            function Sched(properties) {
	                if (properties)
	                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
	                        if (properties[keys[i]] != null)
	                            this[keys[i]] = properties[keys[i]];
	            }

	            /**
	             * Sched test.
	             * @member {string} test
	             * @memberof perfetto.protos.Sched
	             * @instance
	             */
	            Sched.prototype.test = "";

	            /**
	             * Creates a new Sched instance using the specified properties.
	             * @function create
	             * @memberof perfetto.protos.Sched
	             * @static
	             * @param {perfetto.protos.ISched=} [properties] Properties to set
	             * @returns {perfetto.protos.Sched} Sched instance
	             */
	            Sched.create = function create(properties) {
	                return new Sched(properties);
	            };

	            /**
	             * Encodes the specified Sched message. Does not implicitly {@link perfetto.protos.Sched.verify|verify} messages.
	             * @function encode
	             * @memberof perfetto.protos.Sched
	             * @static
	             * @param {perfetto.protos.ISched} message Sched message or plain object to encode
	             * @param {$protobuf.Writer} [writer] Writer to encode to
	             * @returns {$protobuf.Writer} Writer
	             */
	            Sched.encode = function encode(message, writer) {
	                if (!writer)
	                    writer = $Writer.create();
	                if (message.test != null && message.hasOwnProperty("test"))
	                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.test);
	                return writer;
	            };

	            /**
	             * Encodes the specified Sched message, length delimited. Does not implicitly {@link perfetto.protos.Sched.verify|verify} messages.
	             * @function encodeDelimited
	             * @memberof perfetto.protos.Sched
	             * @static
	             * @param {perfetto.protos.ISched} message Sched message or plain object to encode
	             * @param {$protobuf.Writer} [writer] Writer to encode to
	             * @returns {$protobuf.Writer} Writer
	             */
	            Sched.encodeDelimited = function encodeDelimited(message, writer) {
	                return this.encode(message, writer).ldelim();
	            };

	            /**
	             * Decodes a Sched message from the specified reader or buffer.
	             * @function decode
	             * @memberof perfetto.protos.Sched
	             * @static
	             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
	             * @param {number} [length] Message length if known beforehand
	             * @returns {perfetto.protos.Sched} Sched
	             * @throws {Error} If the payload is not a reader or valid buffer
	             * @throws {$protobuf.util.ProtocolError} If required fields are missing
	             */
	            Sched.decode = function decode(reader, length) {
	                if (!(reader instanceof $Reader))
	                    reader = $Reader.create(reader);
	                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.perfetto.protos.Sched();
	                while (reader.pos < end) {
	                    var tag = reader.uint32();
	                    switch (tag >>> 3) {
	                    case 1:
	                        message.test = reader.string();
	                        break;
	                    default:
	                        reader.skipType(tag & 7);
	                        break;
	                    }
	                }
	                return message;
	            };

	            /**
	             * Decodes a Sched message from the specified reader or buffer, length delimited.
	             * @function decodeDelimited
	             * @memberof perfetto.protos.Sched
	             * @static
	             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
	             * @returns {perfetto.protos.Sched} Sched
	             * @throws {Error} If the payload is not a reader or valid buffer
	             * @throws {$protobuf.util.ProtocolError} If required fields are missing
	             */
	            Sched.decodeDelimited = function decodeDelimited(reader) {
	                if (!(reader instanceof $Reader))
	                    reader = new $Reader(reader);
	                return this.decode(reader, reader.uint32());
	            };

	            /**
	             * Verifies a Sched message.
	             * @function verify
	             * @memberof perfetto.protos.Sched
	             * @static
	             * @param {Object.<string,*>} message Plain object to verify
	             * @returns {string|null} `null` if valid, otherwise the reason why it is not
	             */
	            Sched.verify = function verify(message) {
	                if (typeof message !== "object" || message === null)
	                    return "object expected";
	                if (message.test != null && message.hasOwnProperty("test"))
	                    if (!$util.isString(message.test))
	                        return "test: string expected";
	                return null;
	            };

	            /**
	             * Creates a Sched message from a plain object. Also converts values to their respective internal types.
	             * @function fromObject
	             * @memberof perfetto.protos.Sched
	             * @static
	             * @param {Object.<string,*>} object Plain object
	             * @returns {perfetto.protos.Sched} Sched
	             */
	            Sched.fromObject = function fromObject(object) {
	                if (object instanceof $root.perfetto.protos.Sched)
	                    return object;
	                var message = new $root.perfetto.protos.Sched();
	                if (object.test != null)
	                    message.test = String(object.test);
	                return message;
	            };

	            /**
	             * Creates a plain object from a Sched message. Also converts values to other types if specified.
	             * @function toObject
	             * @memberof perfetto.protos.Sched
	             * @static
	             * @param {perfetto.protos.Sched} message Sched
	             * @param {$protobuf.IConversionOptions} [options] Conversion options
	             * @returns {Object.<string,*>} Plain object
	             */
	            Sched.toObject = function toObject(message, options) {
	                if (!options)
	                    options = {};
	                var object = {};
	                if (options.defaults)
	                    object.test = "";
	                if (message.test != null && message.hasOwnProperty("test"))
	                    object.test = message.test;
	                return object;
	            };

	            /**
	             * Converts this Sched to JSON.
	             * @function toJSON
	             * @memberof perfetto.protos.Sched
	             * @instance
	             * @returns {Object.<string,*>} JSON object
	             */
	            Sched.prototype.toJSON = function toJSON() {
	                return this.constructor.toObject(this, minimal$1.util.toJSONOptions);
	            };

	            return Sched;
	        })();

	        protos.ChromeConfig = (function() {

	            /**
	             * Properties of a ChromeConfig.
	             * @memberof perfetto.protos
	             * @interface IChromeConfig
	             * @property {string|null} [traceConfig] ChromeConfig traceConfig
	             */

	            /**
	             * Constructs a new ChromeConfig.
	             * @memberof perfetto.protos
	             * @classdesc Represents a ChromeConfig.
	             * @implements IChromeConfig
	             * @constructor
	             * @param {perfetto.protos.IChromeConfig=} [properties] Properties to set
	             */
	            function ChromeConfig(properties) {
	                if (properties)
	                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
	                        if (properties[keys[i]] != null)
	                            this[keys[i]] = properties[keys[i]];
	            }

	            /**
	             * ChromeConfig traceConfig.
	             * @member {string} traceConfig
	             * @memberof perfetto.protos.ChromeConfig
	             * @instance
	             */
	            ChromeConfig.prototype.traceConfig = "";

	            /**
	             * Creates a new ChromeConfig instance using the specified properties.
	             * @function create
	             * @memberof perfetto.protos.ChromeConfig
	             * @static
	             * @param {perfetto.protos.IChromeConfig=} [properties] Properties to set
	             * @returns {perfetto.protos.ChromeConfig} ChromeConfig instance
	             */
	            ChromeConfig.create = function create(properties) {
	                return new ChromeConfig(properties);
	            };

	            /**
	             * Encodes the specified ChromeConfig message. Does not implicitly {@link perfetto.protos.ChromeConfig.verify|verify} messages.
	             * @function encode
	             * @memberof perfetto.protos.ChromeConfig
	             * @static
	             * @param {perfetto.protos.IChromeConfig} message ChromeConfig message or plain object to encode
	             * @param {$protobuf.Writer} [writer] Writer to encode to
	             * @returns {$protobuf.Writer} Writer
	             */
	            ChromeConfig.encode = function encode(message, writer) {
	                if (!writer)
	                    writer = $Writer.create();
	                if (message.traceConfig != null && message.hasOwnProperty("traceConfig"))
	                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.traceConfig);
	                return writer;
	            };

	            /**
	             * Encodes the specified ChromeConfig message, length delimited. Does not implicitly {@link perfetto.protos.ChromeConfig.verify|verify} messages.
	             * @function encodeDelimited
	             * @memberof perfetto.protos.ChromeConfig
	             * @static
	             * @param {perfetto.protos.IChromeConfig} message ChromeConfig message or plain object to encode
	             * @param {$protobuf.Writer} [writer] Writer to encode to
	             * @returns {$protobuf.Writer} Writer
	             */
	            ChromeConfig.encodeDelimited = function encodeDelimited(message, writer) {
	                return this.encode(message, writer).ldelim();
	            };

	            /**
	             * Decodes a ChromeConfig message from the specified reader or buffer.
	             * @function decode
	             * @memberof perfetto.protos.ChromeConfig
	             * @static
	             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
	             * @param {number} [length] Message length if known beforehand
	             * @returns {perfetto.protos.ChromeConfig} ChromeConfig
	             * @throws {Error} If the payload is not a reader or valid buffer
	             * @throws {$protobuf.util.ProtocolError} If required fields are missing
	             */
	            ChromeConfig.decode = function decode(reader, length) {
	                if (!(reader instanceof $Reader))
	                    reader = $Reader.create(reader);
	                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.perfetto.protos.ChromeConfig();
	                while (reader.pos < end) {
	                    var tag = reader.uint32();
	                    switch (tag >>> 3) {
	                    case 1:
	                        message.traceConfig = reader.string();
	                        break;
	                    default:
	                        reader.skipType(tag & 7);
	                        break;
	                    }
	                }
	                return message;
	            };

	            /**
	             * Decodes a ChromeConfig message from the specified reader or buffer, length delimited.
	             * @function decodeDelimited
	             * @memberof perfetto.protos.ChromeConfig
	             * @static
	             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
	             * @returns {perfetto.protos.ChromeConfig} ChromeConfig
	             * @throws {Error} If the payload is not a reader or valid buffer
	             * @throws {$protobuf.util.ProtocolError} If required fields are missing
	             */
	            ChromeConfig.decodeDelimited = function decodeDelimited(reader) {
	                if (!(reader instanceof $Reader))
	                    reader = new $Reader(reader);
	                return this.decode(reader, reader.uint32());
	            };

	            /**
	             * Verifies a ChromeConfig message.
	             * @function verify
	             * @memberof perfetto.protos.ChromeConfig
	             * @static
	             * @param {Object.<string,*>} message Plain object to verify
	             * @returns {string|null} `null` if valid, otherwise the reason why it is not
	             */
	            ChromeConfig.verify = function verify(message) {
	                if (typeof message !== "object" || message === null)
	                    return "object expected";
	                if (message.traceConfig != null && message.hasOwnProperty("traceConfig"))
	                    if (!$util.isString(message.traceConfig))
	                        return "traceConfig: string expected";
	                return null;
	            };

	            /**
	             * Creates a ChromeConfig message from a plain object. Also converts values to their respective internal types.
	             * @function fromObject
	             * @memberof perfetto.protos.ChromeConfig
	             * @static
	             * @param {Object.<string,*>} object Plain object
	             * @returns {perfetto.protos.ChromeConfig} ChromeConfig
	             */
	            ChromeConfig.fromObject = function fromObject(object) {
	                if (object instanceof $root.perfetto.protos.ChromeConfig)
	                    return object;
	                var message = new $root.perfetto.protos.ChromeConfig();
	                if (object.traceConfig != null)
	                    message.traceConfig = String(object.traceConfig);
	                return message;
	            };

	            /**
	             * Creates a plain object from a ChromeConfig message. Also converts values to other types if specified.
	             * @function toObject
	             * @memberof perfetto.protos.ChromeConfig
	             * @static
	             * @param {perfetto.protos.ChromeConfig} message ChromeConfig
	             * @param {$protobuf.IConversionOptions} [options] Conversion options
	             * @returns {Object.<string,*>} Plain object
	             */
	            ChromeConfig.toObject = function toObject(message, options) {
	                if (!options)
	                    options = {};
	                var object = {};
	                if (options.defaults)
	                    object.traceConfig = "";
	                if (message.traceConfig != null && message.hasOwnProperty("traceConfig"))
	                    object.traceConfig = message.traceConfig;
	                return object;
	            };

	            /**
	             * Converts this ChromeConfig to JSON.
	             * @function toJSON
	             * @memberof perfetto.protos.ChromeConfig
	             * @instance
	             * @returns {Object.<string,*>} JSON object
	             */
	            ChromeConfig.prototype.toJSON = function toJSON() {
	                return this.constructor.toObject(this, minimal$1.util.toJSONOptions);
	            };

	            return ChromeConfig;
	        })();

	        protos.InodeFileConfig = (function() {

	            /**
	             * Properties of an InodeFileConfig.
	             * @memberof perfetto.protos
	             * @interface IInodeFileConfig
	             * @property {number|null} [scanIntervalMs] InodeFileConfig scanIntervalMs
	             * @property {number|null} [scanDelayMs] InodeFileConfig scanDelayMs
	             * @property {number|null} [scanBatchSize] InodeFileConfig scanBatchSize
	             * @property {boolean|null} [doNotScan] InodeFileConfig doNotScan
	             * @property {Array.<string>|null} [scanMountPoints] InodeFileConfig scanMountPoints
	             * @property {Array.<perfetto.protos.InodeFileConfig.IMountPointMappingEntry>|null} [mountPointMapping] InodeFileConfig mountPointMapping
	             */

	            /**
	             * Constructs a new InodeFileConfig.
	             * @memberof perfetto.protos
	             * @classdesc Represents an InodeFileConfig.
	             * @implements IInodeFileConfig
	             * @constructor
	             * @param {perfetto.protos.IInodeFileConfig=} [properties] Properties to set
	             */
	            function InodeFileConfig(properties) {
	                this.scanMountPoints = [];
	                this.mountPointMapping = [];
	                if (properties)
	                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
	                        if (properties[keys[i]] != null)
	                            this[keys[i]] = properties[keys[i]];
	            }

	            /**
	             * InodeFileConfig scanIntervalMs.
	             * @member {number} scanIntervalMs
	             * @memberof perfetto.protos.InodeFileConfig
	             * @instance
	             */
	            InodeFileConfig.prototype.scanIntervalMs = 0;

	            /**
	             * InodeFileConfig scanDelayMs.
	             * @member {number} scanDelayMs
	             * @memberof perfetto.protos.InodeFileConfig
	             * @instance
	             */
	            InodeFileConfig.prototype.scanDelayMs = 0;

	            /**
	             * InodeFileConfig scanBatchSize.
	             * @member {number} scanBatchSize
	             * @memberof perfetto.protos.InodeFileConfig
	             * @instance
	             */
	            InodeFileConfig.prototype.scanBatchSize = 0;

	            /**
	             * InodeFileConfig doNotScan.
	             * @member {boolean} doNotScan
	             * @memberof perfetto.protos.InodeFileConfig
	             * @instance
	             */
	            InodeFileConfig.prototype.doNotScan = false;

	            /**
	             * InodeFileConfig scanMountPoints.
	             * @member {Array.<string>} scanMountPoints
	             * @memberof perfetto.protos.InodeFileConfig
	             * @instance
	             */
	            InodeFileConfig.prototype.scanMountPoints = $util.emptyArray;

	            /**
	             * InodeFileConfig mountPointMapping.
	             * @member {Array.<perfetto.protos.InodeFileConfig.IMountPointMappingEntry>} mountPointMapping
	             * @memberof perfetto.protos.InodeFileConfig
	             * @instance
	             */
	            InodeFileConfig.prototype.mountPointMapping = $util.emptyArray;

	            /**
	             * Creates a new InodeFileConfig instance using the specified properties.
	             * @function create
	             * @memberof perfetto.protos.InodeFileConfig
	             * @static
	             * @param {perfetto.protos.IInodeFileConfig=} [properties] Properties to set
	             * @returns {perfetto.protos.InodeFileConfig} InodeFileConfig instance
	             */
	            InodeFileConfig.create = function create(properties) {
	                return new InodeFileConfig(properties);
	            };

	            /**
	             * Encodes the specified InodeFileConfig message. Does not implicitly {@link perfetto.protos.InodeFileConfig.verify|verify} messages.
	             * @function encode
	             * @memberof perfetto.protos.InodeFileConfig
	             * @static
	             * @param {perfetto.protos.IInodeFileConfig} message InodeFileConfig message or plain object to encode
	             * @param {$protobuf.Writer} [writer] Writer to encode to
	             * @returns {$protobuf.Writer} Writer
	             */
	            InodeFileConfig.encode = function encode(message, writer) {
	                if (!writer)
	                    writer = $Writer.create();
	                if (message.scanIntervalMs != null && message.hasOwnProperty("scanIntervalMs"))
	                    writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.scanIntervalMs);
	                if (message.scanDelayMs != null && message.hasOwnProperty("scanDelayMs"))
	                    writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.scanDelayMs);
	                if (message.scanBatchSize != null && message.hasOwnProperty("scanBatchSize"))
	                    writer.uint32(/* id 3, wireType 0 =*/24).uint32(message.scanBatchSize);
	                if (message.doNotScan != null && message.hasOwnProperty("doNotScan"))
	                    writer.uint32(/* id 4, wireType 0 =*/32).bool(message.doNotScan);
	                if (message.scanMountPoints != null && message.scanMountPoints.length)
	                    for (var i = 0; i < message.scanMountPoints.length; ++i)
	                        writer.uint32(/* id 5, wireType 2 =*/42).string(message.scanMountPoints[i]);
	                if (message.mountPointMapping != null && message.mountPointMapping.length)
	                    for (var i = 0; i < message.mountPointMapping.length; ++i)
	                        $root.perfetto.protos.InodeFileConfig.MountPointMappingEntry.encode(message.mountPointMapping[i], writer.uint32(/* id 6, wireType 2 =*/50).fork()).ldelim();
	                return writer;
	            };

	            /**
	             * Encodes the specified InodeFileConfig message, length delimited. Does not implicitly {@link perfetto.protos.InodeFileConfig.verify|verify} messages.
	             * @function encodeDelimited
	             * @memberof perfetto.protos.InodeFileConfig
	             * @static
	             * @param {perfetto.protos.IInodeFileConfig} message InodeFileConfig message or plain object to encode
	             * @param {$protobuf.Writer} [writer] Writer to encode to
	             * @returns {$protobuf.Writer} Writer
	             */
	            InodeFileConfig.encodeDelimited = function encodeDelimited(message, writer) {
	                return this.encode(message, writer).ldelim();
	            };

	            /**
	             * Decodes an InodeFileConfig message from the specified reader or buffer.
	             * @function decode
	             * @memberof perfetto.protos.InodeFileConfig
	             * @static
	             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
	             * @param {number} [length] Message length if known beforehand
	             * @returns {perfetto.protos.InodeFileConfig} InodeFileConfig
	             * @throws {Error} If the payload is not a reader or valid buffer
	             * @throws {$protobuf.util.ProtocolError} If required fields are missing
	             */
	            InodeFileConfig.decode = function decode(reader, length) {
	                if (!(reader instanceof $Reader))
	                    reader = $Reader.create(reader);
	                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.perfetto.protos.InodeFileConfig();
	                while (reader.pos < end) {
	                    var tag = reader.uint32();
	                    switch (tag >>> 3) {
	                    case 1:
	                        message.scanIntervalMs = reader.uint32();
	                        break;
	                    case 2:
	                        message.scanDelayMs = reader.uint32();
	                        break;
	                    case 3:
	                        message.scanBatchSize = reader.uint32();
	                        break;
	                    case 4:
	                        message.doNotScan = reader.bool();
	                        break;
	                    case 5:
	                        if (!(message.scanMountPoints && message.scanMountPoints.length))
	                            message.scanMountPoints = [];
	                        message.scanMountPoints.push(reader.string());
	                        break;
	                    case 6:
	                        if (!(message.mountPointMapping && message.mountPointMapping.length))
	                            message.mountPointMapping = [];
	                        message.mountPointMapping.push($root.perfetto.protos.InodeFileConfig.MountPointMappingEntry.decode(reader, reader.uint32()));
	                        break;
	                    default:
	                        reader.skipType(tag & 7);
	                        break;
	                    }
	                }
	                return message;
	            };

	            /**
	             * Decodes an InodeFileConfig message from the specified reader or buffer, length delimited.
	             * @function decodeDelimited
	             * @memberof perfetto.protos.InodeFileConfig
	             * @static
	             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
	             * @returns {perfetto.protos.InodeFileConfig} InodeFileConfig
	             * @throws {Error} If the payload is not a reader or valid buffer
	             * @throws {$protobuf.util.ProtocolError} If required fields are missing
	             */
	            InodeFileConfig.decodeDelimited = function decodeDelimited(reader) {
	                if (!(reader instanceof $Reader))
	                    reader = new $Reader(reader);
	                return this.decode(reader, reader.uint32());
	            };

	            /**
	             * Verifies an InodeFileConfig message.
	             * @function verify
	             * @memberof perfetto.protos.InodeFileConfig
	             * @static
	             * @param {Object.<string,*>} message Plain object to verify
	             * @returns {string|null} `null` if valid, otherwise the reason why it is not
	             */
	            InodeFileConfig.verify = function verify(message) {
	                if (typeof message !== "object" || message === null)
	                    return "object expected";
	                if (message.scanIntervalMs != null && message.hasOwnProperty("scanIntervalMs"))
	                    if (!$util.isInteger(message.scanIntervalMs))
	                        return "scanIntervalMs: integer expected";
	                if (message.scanDelayMs != null && message.hasOwnProperty("scanDelayMs"))
	                    if (!$util.isInteger(message.scanDelayMs))
	                        return "scanDelayMs: integer expected";
	                if (message.scanBatchSize != null && message.hasOwnProperty("scanBatchSize"))
	                    if (!$util.isInteger(message.scanBatchSize))
	                        return "scanBatchSize: integer expected";
	                if (message.doNotScan != null && message.hasOwnProperty("doNotScan"))
	                    if (typeof message.doNotScan !== "boolean")
	                        return "doNotScan: boolean expected";
	                if (message.scanMountPoints != null && message.hasOwnProperty("scanMountPoints")) {
	                    if (!Array.isArray(message.scanMountPoints))
	                        return "scanMountPoints: array expected";
	                    for (var i = 0; i < message.scanMountPoints.length; ++i)
	                        if (!$util.isString(message.scanMountPoints[i]))
	                            return "scanMountPoints: string[] expected";
	                }
	                if (message.mountPointMapping != null && message.hasOwnProperty("mountPointMapping")) {
	                    if (!Array.isArray(message.mountPointMapping))
	                        return "mountPointMapping: array expected";
	                    for (var i = 0; i < message.mountPointMapping.length; ++i) {
	                        var error = $root.perfetto.protos.InodeFileConfig.MountPointMappingEntry.verify(message.mountPointMapping[i]);
	                        if (error)
	                            return "mountPointMapping." + error;
	                    }
	                }
	                return null;
	            };

	            /**
	             * Creates an InodeFileConfig message from a plain object. Also converts values to their respective internal types.
	             * @function fromObject
	             * @memberof perfetto.protos.InodeFileConfig
	             * @static
	             * @param {Object.<string,*>} object Plain object
	             * @returns {perfetto.protos.InodeFileConfig} InodeFileConfig
	             */
	            InodeFileConfig.fromObject = function fromObject(object) {
	                if (object instanceof $root.perfetto.protos.InodeFileConfig)
	                    return object;
	                var message = new $root.perfetto.protos.InodeFileConfig();
	                if (object.scanIntervalMs != null)
	                    message.scanIntervalMs = object.scanIntervalMs >>> 0;
	                if (object.scanDelayMs != null)
	                    message.scanDelayMs = object.scanDelayMs >>> 0;
	                if (object.scanBatchSize != null)
	                    message.scanBatchSize = object.scanBatchSize >>> 0;
	                if (object.doNotScan != null)
	                    message.doNotScan = Boolean(object.doNotScan);
	                if (object.scanMountPoints) {
	                    if (!Array.isArray(object.scanMountPoints))
	                        throw TypeError(".perfetto.protos.InodeFileConfig.scanMountPoints: array expected");
	                    message.scanMountPoints = [];
	                    for (var i = 0; i < object.scanMountPoints.length; ++i)
	                        message.scanMountPoints[i] = String(object.scanMountPoints[i]);
	                }
	                if (object.mountPointMapping) {
	                    if (!Array.isArray(object.mountPointMapping))
	                        throw TypeError(".perfetto.protos.InodeFileConfig.mountPointMapping: array expected");
	                    message.mountPointMapping = [];
	                    for (var i = 0; i < object.mountPointMapping.length; ++i) {
	                        if (typeof object.mountPointMapping[i] !== "object")
	                            throw TypeError(".perfetto.protos.InodeFileConfig.mountPointMapping: object expected");
	                        message.mountPointMapping[i] = $root.perfetto.protos.InodeFileConfig.MountPointMappingEntry.fromObject(object.mountPointMapping[i]);
	                    }
	                }
	                return message;
	            };

	            /**
	             * Creates a plain object from an InodeFileConfig message. Also converts values to other types if specified.
	             * @function toObject
	             * @memberof perfetto.protos.InodeFileConfig
	             * @static
	             * @param {perfetto.protos.InodeFileConfig} message InodeFileConfig
	             * @param {$protobuf.IConversionOptions} [options] Conversion options
	             * @returns {Object.<string,*>} Plain object
	             */
	            InodeFileConfig.toObject = function toObject(message, options) {
	                if (!options)
	                    options = {};
	                var object = {};
	                if (options.arrays || options.defaults) {
	                    object.scanMountPoints = [];
	                    object.mountPointMapping = [];
	                }
	                if (options.defaults) {
	                    object.scanIntervalMs = 0;
	                    object.scanDelayMs = 0;
	                    object.scanBatchSize = 0;
	                    object.doNotScan = false;
	                }
	                if (message.scanIntervalMs != null && message.hasOwnProperty("scanIntervalMs"))
	                    object.scanIntervalMs = message.scanIntervalMs;
	                if (message.scanDelayMs != null && message.hasOwnProperty("scanDelayMs"))
	                    object.scanDelayMs = message.scanDelayMs;
	                if (message.scanBatchSize != null && message.hasOwnProperty("scanBatchSize"))
	                    object.scanBatchSize = message.scanBatchSize;
	                if (message.doNotScan != null && message.hasOwnProperty("doNotScan"))
	                    object.doNotScan = message.doNotScan;
	                if (message.scanMountPoints && message.scanMountPoints.length) {
	                    object.scanMountPoints = [];
	                    for (var j = 0; j < message.scanMountPoints.length; ++j)
	                        object.scanMountPoints[j] = message.scanMountPoints[j];
	                }
	                if (message.mountPointMapping && message.mountPointMapping.length) {
	                    object.mountPointMapping = [];
	                    for (var j = 0; j < message.mountPointMapping.length; ++j)
	                        object.mountPointMapping[j] = $root.perfetto.protos.InodeFileConfig.MountPointMappingEntry.toObject(message.mountPointMapping[j], options);
	                }
	                return object;
	            };

	            /**
	             * Converts this InodeFileConfig to JSON.
	             * @function toJSON
	             * @memberof perfetto.protos.InodeFileConfig
	             * @instance
	             * @returns {Object.<string,*>} JSON object
	             */
	            InodeFileConfig.prototype.toJSON = function toJSON() {
	                return this.constructor.toObject(this, minimal$1.util.toJSONOptions);
	            };

	            InodeFileConfig.MountPointMappingEntry = (function() {

	                /**
	                 * Properties of a MountPointMappingEntry.
	                 * @memberof perfetto.protos.InodeFileConfig
	                 * @interface IMountPointMappingEntry
	                 * @property {string|null} [mountpoint] MountPointMappingEntry mountpoint
	                 * @property {Array.<string>|null} [scanRoots] MountPointMappingEntry scanRoots
	                 */

	                /**
	                 * Constructs a new MountPointMappingEntry.
	                 * @memberof perfetto.protos.InodeFileConfig
	                 * @classdesc Represents a MountPointMappingEntry.
	                 * @implements IMountPointMappingEntry
	                 * @constructor
	                 * @param {perfetto.protos.InodeFileConfig.IMountPointMappingEntry=} [properties] Properties to set
	                 */
	                function MountPointMappingEntry(properties) {
	                    this.scanRoots = [];
	                    if (properties)
	                        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
	                            if (properties[keys[i]] != null)
	                                this[keys[i]] = properties[keys[i]];
	                }

	                /**
	                 * MountPointMappingEntry mountpoint.
	                 * @member {string} mountpoint
	                 * @memberof perfetto.protos.InodeFileConfig.MountPointMappingEntry
	                 * @instance
	                 */
	                MountPointMappingEntry.prototype.mountpoint = "";

	                /**
	                 * MountPointMappingEntry scanRoots.
	                 * @member {Array.<string>} scanRoots
	                 * @memberof perfetto.protos.InodeFileConfig.MountPointMappingEntry
	                 * @instance
	                 */
	                MountPointMappingEntry.prototype.scanRoots = $util.emptyArray;

	                /**
	                 * Creates a new MountPointMappingEntry instance using the specified properties.
	                 * @function create
	                 * @memberof perfetto.protos.InodeFileConfig.MountPointMappingEntry
	                 * @static
	                 * @param {perfetto.protos.InodeFileConfig.IMountPointMappingEntry=} [properties] Properties to set
	                 * @returns {perfetto.protos.InodeFileConfig.MountPointMappingEntry} MountPointMappingEntry instance
	                 */
	                MountPointMappingEntry.create = function create(properties) {
	                    return new MountPointMappingEntry(properties);
	                };

	                /**
	                 * Encodes the specified MountPointMappingEntry message. Does not implicitly {@link perfetto.protos.InodeFileConfig.MountPointMappingEntry.verify|verify} messages.
	                 * @function encode
	                 * @memberof perfetto.protos.InodeFileConfig.MountPointMappingEntry
	                 * @static
	                 * @param {perfetto.protos.InodeFileConfig.IMountPointMappingEntry} message MountPointMappingEntry message or plain object to encode
	                 * @param {$protobuf.Writer} [writer] Writer to encode to
	                 * @returns {$protobuf.Writer} Writer
	                 */
	                MountPointMappingEntry.encode = function encode(message, writer) {
	                    if (!writer)
	                        writer = $Writer.create();
	                    if (message.mountpoint != null && message.hasOwnProperty("mountpoint"))
	                        writer.uint32(/* id 1, wireType 2 =*/10).string(message.mountpoint);
	                    if (message.scanRoots != null && message.scanRoots.length)
	                        for (var i = 0; i < message.scanRoots.length; ++i)
	                            writer.uint32(/* id 2, wireType 2 =*/18).string(message.scanRoots[i]);
	                    return writer;
	                };

	                /**
	                 * Encodes the specified MountPointMappingEntry message, length delimited. Does not implicitly {@link perfetto.protos.InodeFileConfig.MountPointMappingEntry.verify|verify} messages.
	                 * @function encodeDelimited
	                 * @memberof perfetto.protos.InodeFileConfig.MountPointMappingEntry
	                 * @static
	                 * @param {perfetto.protos.InodeFileConfig.IMountPointMappingEntry} message MountPointMappingEntry message or plain object to encode
	                 * @param {$protobuf.Writer} [writer] Writer to encode to
	                 * @returns {$protobuf.Writer} Writer
	                 */
	                MountPointMappingEntry.encodeDelimited = function encodeDelimited(message, writer) {
	                    return this.encode(message, writer).ldelim();
	                };

	                /**
	                 * Decodes a MountPointMappingEntry message from the specified reader or buffer.
	                 * @function decode
	                 * @memberof perfetto.protos.InodeFileConfig.MountPointMappingEntry
	                 * @static
	                 * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
	                 * @param {number} [length] Message length if known beforehand
	                 * @returns {perfetto.protos.InodeFileConfig.MountPointMappingEntry} MountPointMappingEntry
	                 * @throws {Error} If the payload is not a reader or valid buffer
	                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
	                 */
	                MountPointMappingEntry.decode = function decode(reader, length) {
	                    if (!(reader instanceof $Reader))
	                        reader = $Reader.create(reader);
	                    var end = length === undefined ? reader.len : reader.pos + length, message = new $root.perfetto.protos.InodeFileConfig.MountPointMappingEntry();
	                    while (reader.pos < end) {
	                        var tag = reader.uint32();
	                        switch (tag >>> 3) {
	                        case 1:
	                            message.mountpoint = reader.string();
	                            break;
	                        case 2:
	                            if (!(message.scanRoots && message.scanRoots.length))
	                                message.scanRoots = [];
	                            message.scanRoots.push(reader.string());
	                            break;
	                        default:
	                            reader.skipType(tag & 7);
	                            break;
	                        }
	                    }
	                    return message;
	                };

	                /**
	                 * Decodes a MountPointMappingEntry message from the specified reader or buffer, length delimited.
	                 * @function decodeDelimited
	                 * @memberof perfetto.protos.InodeFileConfig.MountPointMappingEntry
	                 * @static
	                 * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
	                 * @returns {perfetto.protos.InodeFileConfig.MountPointMappingEntry} MountPointMappingEntry
	                 * @throws {Error} If the payload is not a reader or valid buffer
	                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
	                 */
	                MountPointMappingEntry.decodeDelimited = function decodeDelimited(reader) {
	                    if (!(reader instanceof $Reader))
	                        reader = new $Reader(reader);
	                    return this.decode(reader, reader.uint32());
	                };

	                /**
	                 * Verifies a MountPointMappingEntry message.
	                 * @function verify
	                 * @memberof perfetto.protos.InodeFileConfig.MountPointMappingEntry
	                 * @static
	                 * @param {Object.<string,*>} message Plain object to verify
	                 * @returns {string|null} `null` if valid, otherwise the reason why it is not
	                 */
	                MountPointMappingEntry.verify = function verify(message) {
	                    if (typeof message !== "object" || message === null)
	                        return "object expected";
	                    if (message.mountpoint != null && message.hasOwnProperty("mountpoint"))
	                        if (!$util.isString(message.mountpoint))
	                            return "mountpoint: string expected";
	                    if (message.scanRoots != null && message.hasOwnProperty("scanRoots")) {
	                        if (!Array.isArray(message.scanRoots))
	                            return "scanRoots: array expected";
	                        for (var i = 0; i < message.scanRoots.length; ++i)
	                            if (!$util.isString(message.scanRoots[i]))
	                                return "scanRoots: string[] expected";
	                    }
	                    return null;
	                };

	                /**
	                 * Creates a MountPointMappingEntry message from a plain object. Also converts values to their respective internal types.
	                 * @function fromObject
	                 * @memberof perfetto.protos.InodeFileConfig.MountPointMappingEntry
	                 * @static
	                 * @param {Object.<string,*>} object Plain object
	                 * @returns {perfetto.protos.InodeFileConfig.MountPointMappingEntry} MountPointMappingEntry
	                 */
	                MountPointMappingEntry.fromObject = function fromObject(object) {
	                    if (object instanceof $root.perfetto.protos.InodeFileConfig.MountPointMappingEntry)
	                        return object;
	                    var message = new $root.perfetto.protos.InodeFileConfig.MountPointMappingEntry();
	                    if (object.mountpoint != null)
	                        message.mountpoint = String(object.mountpoint);
	                    if (object.scanRoots) {
	                        if (!Array.isArray(object.scanRoots))
	                            throw TypeError(".perfetto.protos.InodeFileConfig.MountPointMappingEntry.scanRoots: array expected");
	                        message.scanRoots = [];
	                        for (var i = 0; i < object.scanRoots.length; ++i)
	                            message.scanRoots[i] = String(object.scanRoots[i]);
	                    }
	                    return message;
	                };

	                /**
	                 * Creates a plain object from a MountPointMappingEntry message. Also converts values to other types if specified.
	                 * @function toObject
	                 * @memberof perfetto.protos.InodeFileConfig.MountPointMappingEntry
	                 * @static
	                 * @param {perfetto.protos.InodeFileConfig.MountPointMappingEntry} message MountPointMappingEntry
	                 * @param {$protobuf.IConversionOptions} [options] Conversion options
	                 * @returns {Object.<string,*>} Plain object
	                 */
	                MountPointMappingEntry.toObject = function toObject(message, options) {
	                    if (!options)
	                        options = {};
	                    var object = {};
	                    if (options.arrays || options.defaults)
	                        object.scanRoots = [];
	                    if (options.defaults)
	                        object.mountpoint = "";
	                    if (message.mountpoint != null && message.hasOwnProperty("mountpoint"))
	                        object.mountpoint = message.mountpoint;
	                    if (message.scanRoots && message.scanRoots.length) {
	                        object.scanRoots = [];
	                        for (var j = 0; j < message.scanRoots.length; ++j)
	                            object.scanRoots[j] = message.scanRoots[j];
	                    }
	                    return object;
	                };

	                /**
	                 * Converts this MountPointMappingEntry to JSON.
	                 * @function toJSON
	                 * @memberof perfetto.protos.InodeFileConfig.MountPointMappingEntry
	                 * @instance
	                 * @returns {Object.<string,*>} JSON object
	                 */
	                MountPointMappingEntry.prototype.toJSON = function toJSON() {
	                    return this.constructor.toObject(this, minimal$1.util.toJSONOptions);
	                };

	                return MountPointMappingEntry;
	            })();

	            return InodeFileConfig;
	        })();

	        protos.ProcessStatsConfig = (function() {

	            /**
	             * Properties of a ProcessStatsConfig.
	             * @memberof perfetto.protos
	             * @interface IProcessStatsConfig
	             * @property {Array.<perfetto.protos.ProcessStatsConfig.Quirks>|null} [quirks] ProcessStatsConfig quirks
	             * @property {boolean|null} [scanAllProcessesOnStart] ProcessStatsConfig scanAllProcessesOnStart
	             * @property {boolean|null} [recordThreadNames] ProcessStatsConfig recordThreadNames
	             */

	            /**
	             * Constructs a new ProcessStatsConfig.
	             * @memberof perfetto.protos
	             * @classdesc Represents a ProcessStatsConfig.
	             * @implements IProcessStatsConfig
	             * @constructor
	             * @param {perfetto.protos.IProcessStatsConfig=} [properties] Properties to set
	             */
	            function ProcessStatsConfig(properties) {
	                this.quirks = [];
	                if (properties)
	                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
	                        if (properties[keys[i]] != null)
	                            this[keys[i]] = properties[keys[i]];
	            }

	            /**
	             * ProcessStatsConfig quirks.
	             * @member {Array.<perfetto.protos.ProcessStatsConfig.Quirks>} quirks
	             * @memberof perfetto.protos.ProcessStatsConfig
	             * @instance
	             */
	            ProcessStatsConfig.prototype.quirks = $util.emptyArray;

	            /**
	             * ProcessStatsConfig scanAllProcessesOnStart.
	             * @member {boolean} scanAllProcessesOnStart
	             * @memberof perfetto.protos.ProcessStatsConfig
	             * @instance
	             */
	            ProcessStatsConfig.prototype.scanAllProcessesOnStart = false;

	            /**
	             * ProcessStatsConfig recordThreadNames.
	             * @member {boolean} recordThreadNames
	             * @memberof perfetto.protos.ProcessStatsConfig
	             * @instance
	             */
	            ProcessStatsConfig.prototype.recordThreadNames = false;

	            /**
	             * Creates a new ProcessStatsConfig instance using the specified properties.
	             * @function create
	             * @memberof perfetto.protos.ProcessStatsConfig
	             * @static
	             * @param {perfetto.protos.IProcessStatsConfig=} [properties] Properties to set
	             * @returns {perfetto.protos.ProcessStatsConfig} ProcessStatsConfig instance
	             */
	            ProcessStatsConfig.create = function create(properties) {
	                return new ProcessStatsConfig(properties);
	            };

	            /**
	             * Encodes the specified ProcessStatsConfig message. Does not implicitly {@link perfetto.protos.ProcessStatsConfig.verify|verify} messages.
	             * @function encode
	             * @memberof perfetto.protos.ProcessStatsConfig
	             * @static
	             * @param {perfetto.protos.IProcessStatsConfig} message ProcessStatsConfig message or plain object to encode
	             * @param {$protobuf.Writer} [writer] Writer to encode to
	             * @returns {$protobuf.Writer} Writer
	             */
	            ProcessStatsConfig.encode = function encode(message, writer) {
	                if (!writer)
	                    writer = $Writer.create();
	                if (message.quirks != null && message.quirks.length)
	                    for (var i = 0; i < message.quirks.length; ++i)
	                        writer.uint32(/* id 1, wireType 0 =*/8).int32(message.quirks[i]);
	                if (message.scanAllProcessesOnStart != null && message.hasOwnProperty("scanAllProcessesOnStart"))
	                    writer.uint32(/* id 2, wireType 0 =*/16).bool(message.scanAllProcessesOnStart);
	                if (message.recordThreadNames != null && message.hasOwnProperty("recordThreadNames"))
	                    writer.uint32(/* id 3, wireType 0 =*/24).bool(message.recordThreadNames);
	                return writer;
	            };

	            /**
	             * Encodes the specified ProcessStatsConfig message, length delimited. Does not implicitly {@link perfetto.protos.ProcessStatsConfig.verify|verify} messages.
	             * @function encodeDelimited
	             * @memberof perfetto.protos.ProcessStatsConfig
	             * @static
	             * @param {perfetto.protos.IProcessStatsConfig} message ProcessStatsConfig message or plain object to encode
	             * @param {$protobuf.Writer} [writer] Writer to encode to
	             * @returns {$protobuf.Writer} Writer
	             */
	            ProcessStatsConfig.encodeDelimited = function encodeDelimited(message, writer) {
	                return this.encode(message, writer).ldelim();
	            };

	            /**
	             * Decodes a ProcessStatsConfig message from the specified reader or buffer.
	             * @function decode
	             * @memberof perfetto.protos.ProcessStatsConfig
	             * @static
	             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
	             * @param {number} [length] Message length if known beforehand
	             * @returns {perfetto.protos.ProcessStatsConfig} ProcessStatsConfig
	             * @throws {Error} If the payload is not a reader or valid buffer
	             * @throws {$protobuf.util.ProtocolError} If required fields are missing
	             */
	            ProcessStatsConfig.decode = function decode(reader, length) {
	                if (!(reader instanceof $Reader))
	                    reader = $Reader.create(reader);
	                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.perfetto.protos.ProcessStatsConfig();
	                while (reader.pos < end) {
	                    var tag = reader.uint32();
	                    switch (tag >>> 3) {
	                    case 1:
	                        if (!(message.quirks && message.quirks.length))
	                            message.quirks = [];
	                        if ((tag & 7) === 2) {
	                            var end2 = reader.uint32() + reader.pos;
	                            while (reader.pos < end2)
	                                message.quirks.push(reader.int32());
	                        } else
	                            message.quirks.push(reader.int32());
	                        break;
	                    case 2:
	                        message.scanAllProcessesOnStart = reader.bool();
	                        break;
	                    case 3:
	                        message.recordThreadNames = reader.bool();
	                        break;
	                    default:
	                        reader.skipType(tag & 7);
	                        break;
	                    }
	                }
	                return message;
	            };

	            /**
	             * Decodes a ProcessStatsConfig message from the specified reader or buffer, length delimited.
	             * @function decodeDelimited
	             * @memberof perfetto.protos.ProcessStatsConfig
	             * @static
	             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
	             * @returns {perfetto.protos.ProcessStatsConfig} ProcessStatsConfig
	             * @throws {Error} If the payload is not a reader or valid buffer
	             * @throws {$protobuf.util.ProtocolError} If required fields are missing
	             */
	            ProcessStatsConfig.decodeDelimited = function decodeDelimited(reader) {
	                if (!(reader instanceof $Reader))
	                    reader = new $Reader(reader);
	                return this.decode(reader, reader.uint32());
	            };

	            /**
	             * Verifies a ProcessStatsConfig message.
	             * @function verify
	             * @memberof perfetto.protos.ProcessStatsConfig
	             * @static
	             * @param {Object.<string,*>} message Plain object to verify
	             * @returns {string|null} `null` if valid, otherwise the reason why it is not
	             */
	            ProcessStatsConfig.verify = function verify(message) {
	                if (typeof message !== "object" || message === null)
	                    return "object expected";
	                if (message.quirks != null && message.hasOwnProperty("quirks")) {
	                    if (!Array.isArray(message.quirks))
	                        return "quirks: array expected";
	                    for (var i = 0; i < message.quirks.length; ++i)
	                        switch (message.quirks[i]) {
	                        default:
	                            return "quirks: enum value[] expected";
	                        case 0:
	                        case 1:
	                        case 2:
	                            break;
	                        }
	                }
	                if (message.scanAllProcessesOnStart != null && message.hasOwnProperty("scanAllProcessesOnStart"))
	                    if (typeof message.scanAllProcessesOnStart !== "boolean")
	                        return "scanAllProcessesOnStart: boolean expected";
	                if (message.recordThreadNames != null && message.hasOwnProperty("recordThreadNames"))
	                    if (typeof message.recordThreadNames !== "boolean")
	                        return "recordThreadNames: boolean expected";
	                return null;
	            };

	            /**
	             * Creates a ProcessStatsConfig message from a plain object. Also converts values to their respective internal types.
	             * @function fromObject
	             * @memberof perfetto.protos.ProcessStatsConfig
	             * @static
	             * @param {Object.<string,*>} object Plain object
	             * @returns {perfetto.protos.ProcessStatsConfig} ProcessStatsConfig
	             */
	            ProcessStatsConfig.fromObject = function fromObject(object) {
	                if (object instanceof $root.perfetto.protos.ProcessStatsConfig)
	                    return object;
	                var message = new $root.perfetto.protos.ProcessStatsConfig();
	                if (object.quirks) {
	                    if (!Array.isArray(object.quirks))
	                        throw TypeError(".perfetto.protos.ProcessStatsConfig.quirks: array expected");
	                    message.quirks = [];
	                    for (var i = 0; i < object.quirks.length; ++i)
	                        switch (object.quirks[i]) {
	                        default:
	                        case "QUIRKS_UNSPECIFIED":
	                        case 0:
	                            message.quirks[i] = 0;
	                            break;
	                        case "DISABLE_INITIAL_DUMP":
	                        case 1:
	                            message.quirks[i] = 1;
	                            break;
	                        case "DISABLE_ON_DEMAND":
	                        case 2:
	                            message.quirks[i] = 2;
	                            break;
	                        }
	                }
	                if (object.scanAllProcessesOnStart != null)
	                    message.scanAllProcessesOnStart = Boolean(object.scanAllProcessesOnStart);
	                if (object.recordThreadNames != null)
	                    message.recordThreadNames = Boolean(object.recordThreadNames);
	                return message;
	            };

	            /**
	             * Creates a plain object from a ProcessStatsConfig message. Also converts values to other types if specified.
	             * @function toObject
	             * @memberof perfetto.protos.ProcessStatsConfig
	             * @static
	             * @param {perfetto.protos.ProcessStatsConfig} message ProcessStatsConfig
	             * @param {$protobuf.IConversionOptions} [options] Conversion options
	             * @returns {Object.<string,*>} Plain object
	             */
	            ProcessStatsConfig.toObject = function toObject(message, options) {
	                if (!options)
	                    options = {};
	                var object = {};
	                if (options.arrays || options.defaults)
	                    object.quirks = [];
	                if (options.defaults) {
	                    object.scanAllProcessesOnStart = false;
	                    object.recordThreadNames = false;
	                }
	                if (message.quirks && message.quirks.length) {
	                    object.quirks = [];
	                    for (var j = 0; j < message.quirks.length; ++j)
	                        object.quirks[j] = options.enums === String ? $root.perfetto.protos.ProcessStatsConfig.Quirks[message.quirks[j]] : message.quirks[j];
	                }
	                if (message.scanAllProcessesOnStart != null && message.hasOwnProperty("scanAllProcessesOnStart"))
	                    object.scanAllProcessesOnStart = message.scanAllProcessesOnStart;
	                if (message.recordThreadNames != null && message.hasOwnProperty("recordThreadNames"))
	                    object.recordThreadNames = message.recordThreadNames;
	                return object;
	            };

	            /**
	             * Converts this ProcessStatsConfig to JSON.
	             * @function toJSON
	             * @memberof perfetto.protos.ProcessStatsConfig
	             * @instance
	             * @returns {Object.<string,*>} JSON object
	             */
	            ProcessStatsConfig.prototype.toJSON = function toJSON() {
	                return this.constructor.toObject(this, minimal$1.util.toJSONOptions);
	            };

	            /**
	             * Quirks enum.
	             * @name perfetto.protos.ProcessStatsConfig.Quirks
	             * @enum {string}
	             * @property {number} QUIRKS_UNSPECIFIED=0 QUIRKS_UNSPECIFIED value
	             * @property {number} DISABLE_INITIAL_DUMP=1 DISABLE_INITIAL_DUMP value
	             * @property {number} DISABLE_ON_DEMAND=2 DISABLE_ON_DEMAND value
	             */
	            ProcessStatsConfig.Quirks = (function() {
	                var valuesById = {}, values = Object.create(valuesById);
	                values[valuesById[0] = "QUIRKS_UNSPECIFIED"] = 0;
	                values[valuesById[1] = "DISABLE_INITIAL_DUMP"] = 1;
	                values[valuesById[2] = "DISABLE_ON_DEMAND"] = 2;
	                return values;
	            })();

	            return ProcessStatsConfig;
	        })();

	        protos.DataSourceConfig = (function() {

	            /**
	             * Properties of a DataSourceConfig.
	             * @memberof perfetto.protos
	             * @interface IDataSourceConfig
	             * @property {string|null} [name] DataSourceConfig name
	             * @property {number|null} [targetBuffer] DataSourceConfig targetBuffer
	             * @property {number|null} [traceDurationMs] DataSourceConfig traceDurationMs
	             * @property {perfetto.protos.IFtraceConfig|null} [ftraceConfig] DataSourceConfig ftraceConfig
	             * @property {perfetto.protos.IChromeConfig|null} [chromeConfig] DataSourceConfig chromeConfig
	             * @property {perfetto.protos.IInodeFileConfig|null} [inodeFileConfig] DataSourceConfig inodeFileConfig
	             * @property {perfetto.protos.IProcessStatsConfig|null} [processStatsConfig] DataSourceConfig processStatsConfig
	             * @property {string|null} [legacyConfig] DataSourceConfig legacyConfig
	             * @property {perfetto.protos.ITestConfig|null} [forTesting] DataSourceConfig forTesting
	             */

	            /**
	             * Constructs a new DataSourceConfig.
	             * @memberof perfetto.protos
	             * @classdesc Represents a DataSourceConfig.
	             * @implements IDataSourceConfig
	             * @constructor
	             * @param {perfetto.protos.IDataSourceConfig=} [properties] Properties to set
	             */
	            function DataSourceConfig(properties) {
	                if (properties)
	                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
	                        if (properties[keys[i]] != null)
	                            this[keys[i]] = properties[keys[i]];
	            }

	            /**
	             * DataSourceConfig name.
	             * @member {string} name
	             * @memberof perfetto.protos.DataSourceConfig
	             * @instance
	             */
	            DataSourceConfig.prototype.name = "";

	            /**
	             * DataSourceConfig targetBuffer.
	             * @member {number} targetBuffer
	             * @memberof perfetto.protos.DataSourceConfig
	             * @instance
	             */
	            DataSourceConfig.prototype.targetBuffer = 0;

	            /**
	             * DataSourceConfig traceDurationMs.
	             * @member {number} traceDurationMs
	             * @memberof perfetto.protos.DataSourceConfig
	             * @instance
	             */
	            DataSourceConfig.prototype.traceDurationMs = 0;

	            /**
	             * DataSourceConfig ftraceConfig.
	             * @member {perfetto.protos.IFtraceConfig|null|undefined} ftraceConfig
	             * @memberof perfetto.protos.DataSourceConfig
	             * @instance
	             */
	            DataSourceConfig.prototype.ftraceConfig = null;

	            /**
	             * DataSourceConfig chromeConfig.
	             * @member {perfetto.protos.IChromeConfig|null|undefined} chromeConfig
	             * @memberof perfetto.protos.DataSourceConfig
	             * @instance
	             */
	            DataSourceConfig.prototype.chromeConfig = null;

	            /**
	             * DataSourceConfig inodeFileConfig.
	             * @member {perfetto.protos.IInodeFileConfig|null|undefined} inodeFileConfig
	             * @memberof perfetto.protos.DataSourceConfig
	             * @instance
	             */
	            DataSourceConfig.prototype.inodeFileConfig = null;

	            /**
	             * DataSourceConfig processStatsConfig.
	             * @member {perfetto.protos.IProcessStatsConfig|null|undefined} processStatsConfig
	             * @memberof perfetto.protos.DataSourceConfig
	             * @instance
	             */
	            DataSourceConfig.prototype.processStatsConfig = null;

	            /**
	             * DataSourceConfig legacyConfig.
	             * @member {string} legacyConfig
	             * @memberof perfetto.protos.DataSourceConfig
	             * @instance
	             */
	            DataSourceConfig.prototype.legacyConfig = "";

	            /**
	             * DataSourceConfig forTesting.
	             * @member {perfetto.protos.ITestConfig|null|undefined} forTesting
	             * @memberof perfetto.protos.DataSourceConfig
	             * @instance
	             */
	            DataSourceConfig.prototype.forTesting = null;

	            /**
	             * Creates a new DataSourceConfig instance using the specified properties.
	             * @function create
	             * @memberof perfetto.protos.DataSourceConfig
	             * @static
	             * @param {perfetto.protos.IDataSourceConfig=} [properties] Properties to set
	             * @returns {perfetto.protos.DataSourceConfig} DataSourceConfig instance
	             */
	            DataSourceConfig.create = function create(properties) {
	                return new DataSourceConfig(properties);
	            };

	            /**
	             * Encodes the specified DataSourceConfig message. Does not implicitly {@link perfetto.protos.DataSourceConfig.verify|verify} messages.
	             * @function encode
	             * @memberof perfetto.protos.DataSourceConfig
	             * @static
	             * @param {perfetto.protos.IDataSourceConfig} message DataSourceConfig message or plain object to encode
	             * @param {$protobuf.Writer} [writer] Writer to encode to
	             * @returns {$protobuf.Writer} Writer
	             */
	            DataSourceConfig.encode = function encode(message, writer) {
	                if (!writer)
	                    writer = $Writer.create();
	                if (message.name != null && message.hasOwnProperty("name"))
	                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.name);
	                if (message.targetBuffer != null && message.hasOwnProperty("targetBuffer"))
	                    writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.targetBuffer);
	                if (message.traceDurationMs != null && message.hasOwnProperty("traceDurationMs"))
	                    writer.uint32(/* id 3, wireType 0 =*/24).uint32(message.traceDurationMs);
	                if (message.ftraceConfig != null && message.hasOwnProperty("ftraceConfig"))
	                    $root.perfetto.protos.FtraceConfig.encode(message.ftraceConfig, writer.uint32(/* id 100, wireType 2 =*/802).fork()).ldelim();
	                if (message.chromeConfig != null && message.hasOwnProperty("chromeConfig"))
	                    $root.perfetto.protos.ChromeConfig.encode(message.chromeConfig, writer.uint32(/* id 101, wireType 2 =*/810).fork()).ldelim();
	                if (message.inodeFileConfig != null && message.hasOwnProperty("inodeFileConfig"))
	                    $root.perfetto.protos.InodeFileConfig.encode(message.inodeFileConfig, writer.uint32(/* id 102, wireType 2 =*/818).fork()).ldelim();
	                if (message.processStatsConfig != null && message.hasOwnProperty("processStatsConfig"))
	                    $root.perfetto.protos.ProcessStatsConfig.encode(message.processStatsConfig, writer.uint32(/* id 103, wireType 2 =*/826).fork()).ldelim();
	                if (message.legacyConfig != null && message.hasOwnProperty("legacyConfig"))
	                    writer.uint32(/* id 1000, wireType 2 =*/8002).string(message.legacyConfig);
	                if (message.forTesting != null && message.hasOwnProperty("forTesting"))
	                    $root.perfetto.protos.TestConfig.encode(message.forTesting, writer.uint32(/* id 536870911, wireType 2 =*/4294967290).fork()).ldelim();
	                return writer;
	            };

	            /**
	             * Encodes the specified DataSourceConfig message, length delimited. Does not implicitly {@link perfetto.protos.DataSourceConfig.verify|verify} messages.
	             * @function encodeDelimited
	             * @memberof perfetto.protos.DataSourceConfig
	             * @static
	             * @param {perfetto.protos.IDataSourceConfig} message DataSourceConfig message or plain object to encode
	             * @param {$protobuf.Writer} [writer] Writer to encode to
	             * @returns {$protobuf.Writer} Writer
	             */
	            DataSourceConfig.encodeDelimited = function encodeDelimited(message, writer) {
	                return this.encode(message, writer).ldelim();
	            };

	            /**
	             * Decodes a DataSourceConfig message from the specified reader or buffer.
	             * @function decode
	             * @memberof perfetto.protos.DataSourceConfig
	             * @static
	             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
	             * @param {number} [length] Message length if known beforehand
	             * @returns {perfetto.protos.DataSourceConfig} DataSourceConfig
	             * @throws {Error} If the payload is not a reader or valid buffer
	             * @throws {$protobuf.util.ProtocolError} If required fields are missing
	             */
	            DataSourceConfig.decode = function decode(reader, length) {
	                if (!(reader instanceof $Reader))
	                    reader = $Reader.create(reader);
	                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.perfetto.protos.DataSourceConfig();
	                while (reader.pos < end) {
	                    var tag = reader.uint32();
	                    switch (tag >>> 3) {
	                    case 1:
	                        message.name = reader.string();
	                        break;
	                    case 2:
	                        message.targetBuffer = reader.uint32();
	                        break;
	                    case 3:
	                        message.traceDurationMs = reader.uint32();
	                        break;
	                    case 100:
	                        message.ftraceConfig = $root.perfetto.protos.FtraceConfig.decode(reader, reader.uint32());
	                        break;
	                    case 101:
	                        message.chromeConfig = $root.perfetto.protos.ChromeConfig.decode(reader, reader.uint32());
	                        break;
	                    case 102:
	                        message.inodeFileConfig = $root.perfetto.protos.InodeFileConfig.decode(reader, reader.uint32());
	                        break;
	                    case 103:
	                        message.processStatsConfig = $root.perfetto.protos.ProcessStatsConfig.decode(reader, reader.uint32());
	                        break;
	                    case 1000:
	                        message.legacyConfig = reader.string();
	                        break;
	                    case 536870911:
	                        message.forTesting = $root.perfetto.protos.TestConfig.decode(reader, reader.uint32());
	                        break;
	                    default:
	                        reader.skipType(tag & 7);
	                        break;
	                    }
	                }
	                return message;
	            };

	            /**
	             * Decodes a DataSourceConfig message from the specified reader or buffer, length delimited.
	             * @function decodeDelimited
	             * @memberof perfetto.protos.DataSourceConfig
	             * @static
	             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
	             * @returns {perfetto.protos.DataSourceConfig} DataSourceConfig
	             * @throws {Error} If the payload is not a reader or valid buffer
	             * @throws {$protobuf.util.ProtocolError} If required fields are missing
	             */
	            DataSourceConfig.decodeDelimited = function decodeDelimited(reader) {
	                if (!(reader instanceof $Reader))
	                    reader = new $Reader(reader);
	                return this.decode(reader, reader.uint32());
	            };

	            /**
	             * Verifies a DataSourceConfig message.
	             * @function verify
	             * @memberof perfetto.protos.DataSourceConfig
	             * @static
	             * @param {Object.<string,*>} message Plain object to verify
	             * @returns {string|null} `null` if valid, otherwise the reason why it is not
	             */
	            DataSourceConfig.verify = function verify(message) {
	                if (typeof message !== "object" || message === null)
	                    return "object expected";
	                if (message.name != null && message.hasOwnProperty("name"))
	                    if (!$util.isString(message.name))
	                        return "name: string expected";
	                if (message.targetBuffer != null && message.hasOwnProperty("targetBuffer"))
	                    if (!$util.isInteger(message.targetBuffer))
	                        return "targetBuffer: integer expected";
	                if (message.traceDurationMs != null && message.hasOwnProperty("traceDurationMs"))
	                    if (!$util.isInteger(message.traceDurationMs))
	                        return "traceDurationMs: integer expected";
	                if (message.ftraceConfig != null && message.hasOwnProperty("ftraceConfig")) {
	                    var error = $root.perfetto.protos.FtraceConfig.verify(message.ftraceConfig);
	                    if (error)
	                        return "ftraceConfig." + error;
	                }
	                if (message.chromeConfig != null && message.hasOwnProperty("chromeConfig")) {
	                    var error = $root.perfetto.protos.ChromeConfig.verify(message.chromeConfig);
	                    if (error)
	                        return "chromeConfig." + error;
	                }
	                if (message.inodeFileConfig != null && message.hasOwnProperty("inodeFileConfig")) {
	                    var error = $root.perfetto.protos.InodeFileConfig.verify(message.inodeFileConfig);
	                    if (error)
	                        return "inodeFileConfig." + error;
	                }
	                if (message.processStatsConfig != null && message.hasOwnProperty("processStatsConfig")) {
	                    var error = $root.perfetto.protos.ProcessStatsConfig.verify(message.processStatsConfig);
	                    if (error)
	                        return "processStatsConfig." + error;
	                }
	                if (message.legacyConfig != null && message.hasOwnProperty("legacyConfig"))
	                    if (!$util.isString(message.legacyConfig))
	                        return "legacyConfig: string expected";
	                if (message.forTesting != null && message.hasOwnProperty("forTesting")) {
	                    var error = $root.perfetto.protos.TestConfig.verify(message.forTesting);
	                    if (error)
	                        return "forTesting." + error;
	                }
	                return null;
	            };

	            /**
	             * Creates a DataSourceConfig message from a plain object. Also converts values to their respective internal types.
	             * @function fromObject
	             * @memberof perfetto.protos.DataSourceConfig
	             * @static
	             * @param {Object.<string,*>} object Plain object
	             * @returns {perfetto.protos.DataSourceConfig} DataSourceConfig
	             */
	            DataSourceConfig.fromObject = function fromObject(object) {
	                if (object instanceof $root.perfetto.protos.DataSourceConfig)
	                    return object;
	                var message = new $root.perfetto.protos.DataSourceConfig();
	                if (object.name != null)
	                    message.name = String(object.name);
	                if (object.targetBuffer != null)
	                    message.targetBuffer = object.targetBuffer >>> 0;
	                if (object.traceDurationMs != null)
	                    message.traceDurationMs = object.traceDurationMs >>> 0;
	                if (object.ftraceConfig != null) {
	                    if (typeof object.ftraceConfig !== "object")
	                        throw TypeError(".perfetto.protos.DataSourceConfig.ftraceConfig: object expected");
	                    message.ftraceConfig = $root.perfetto.protos.FtraceConfig.fromObject(object.ftraceConfig);
	                }
	                if (object.chromeConfig != null) {
	                    if (typeof object.chromeConfig !== "object")
	                        throw TypeError(".perfetto.protos.DataSourceConfig.chromeConfig: object expected");
	                    message.chromeConfig = $root.perfetto.protos.ChromeConfig.fromObject(object.chromeConfig);
	                }
	                if (object.inodeFileConfig != null) {
	                    if (typeof object.inodeFileConfig !== "object")
	                        throw TypeError(".perfetto.protos.DataSourceConfig.inodeFileConfig: object expected");
	                    message.inodeFileConfig = $root.perfetto.protos.InodeFileConfig.fromObject(object.inodeFileConfig);
	                }
	                if (object.processStatsConfig != null) {
	                    if (typeof object.processStatsConfig !== "object")
	                        throw TypeError(".perfetto.protos.DataSourceConfig.processStatsConfig: object expected");
	                    message.processStatsConfig = $root.perfetto.protos.ProcessStatsConfig.fromObject(object.processStatsConfig);
	                }
	                if (object.legacyConfig != null)
	                    message.legacyConfig = String(object.legacyConfig);
	                if (object.forTesting != null) {
	                    if (typeof object.forTesting !== "object")
	                        throw TypeError(".perfetto.protos.DataSourceConfig.forTesting: object expected");
	                    message.forTesting = $root.perfetto.protos.TestConfig.fromObject(object.forTesting);
	                }
	                return message;
	            };

	            /**
	             * Creates a plain object from a DataSourceConfig message. Also converts values to other types if specified.
	             * @function toObject
	             * @memberof perfetto.protos.DataSourceConfig
	             * @static
	             * @param {perfetto.protos.DataSourceConfig} message DataSourceConfig
	             * @param {$protobuf.IConversionOptions} [options] Conversion options
	             * @returns {Object.<string,*>} Plain object
	             */
	            DataSourceConfig.toObject = function toObject(message, options) {
	                if (!options)
	                    options = {};
	                var object = {};
	                if (options.defaults) {
	                    object.name = "";
	                    object.targetBuffer = 0;
	                    object.traceDurationMs = 0;
	                    object.ftraceConfig = null;
	                    object.chromeConfig = null;
	                    object.inodeFileConfig = null;
	                    object.processStatsConfig = null;
	                    object.legacyConfig = "";
	                    object.forTesting = null;
	                }
	                if (message.name != null && message.hasOwnProperty("name"))
	                    object.name = message.name;
	                if (message.targetBuffer != null && message.hasOwnProperty("targetBuffer"))
	                    object.targetBuffer = message.targetBuffer;
	                if (message.traceDurationMs != null && message.hasOwnProperty("traceDurationMs"))
	                    object.traceDurationMs = message.traceDurationMs;
	                if (message.ftraceConfig != null && message.hasOwnProperty("ftraceConfig"))
	                    object.ftraceConfig = $root.perfetto.protos.FtraceConfig.toObject(message.ftraceConfig, options);
	                if (message.chromeConfig != null && message.hasOwnProperty("chromeConfig"))
	                    object.chromeConfig = $root.perfetto.protos.ChromeConfig.toObject(message.chromeConfig, options);
	                if (message.inodeFileConfig != null && message.hasOwnProperty("inodeFileConfig"))
	                    object.inodeFileConfig = $root.perfetto.protos.InodeFileConfig.toObject(message.inodeFileConfig, options);
	                if (message.processStatsConfig != null && message.hasOwnProperty("processStatsConfig"))
	                    object.processStatsConfig = $root.perfetto.protos.ProcessStatsConfig.toObject(message.processStatsConfig, options);
	                if (message.legacyConfig != null && message.hasOwnProperty("legacyConfig"))
	                    object.legacyConfig = message.legacyConfig;
	                if (message.forTesting != null && message.hasOwnProperty("forTesting"))
	                    object.forTesting = $root.perfetto.protos.TestConfig.toObject(message.forTesting, options);
	                return object;
	            };

	            /**
	             * Converts this DataSourceConfig to JSON.
	             * @function toJSON
	             * @memberof perfetto.protos.DataSourceConfig
	             * @instance
	             * @returns {Object.<string,*>} JSON object
	             */
	            DataSourceConfig.prototype.toJSON = function toJSON() {
	                return this.constructor.toObject(this, minimal$1.util.toJSONOptions);
	            };

	            return DataSourceConfig;
	        })();

	        protos.FtraceConfig = (function() {

	            /**
	             * Properties of a FtraceConfig.
	             * @memberof perfetto.protos
	             * @interface IFtraceConfig
	             * @property {Array.<string>|null} [ftraceEvents] FtraceConfig ftraceEvents
	             * @property {Array.<string>|null} [atraceCategories] FtraceConfig atraceCategories
	             * @property {Array.<string>|null} [atraceApps] FtraceConfig atraceApps
	             * @property {number|null} [bufferSizeKb] FtraceConfig bufferSizeKb
	             * @property {number|null} [drainPeriodMs] FtraceConfig drainPeriodMs
	             */

	            /**
	             * Constructs a new FtraceConfig.
	             * @memberof perfetto.protos
	             * @classdesc Represents a FtraceConfig.
	             * @implements IFtraceConfig
	             * @constructor
	             * @param {perfetto.protos.IFtraceConfig=} [properties] Properties to set
	             */
	            function FtraceConfig(properties) {
	                this.ftraceEvents = [];
	                this.atraceCategories = [];
	                this.atraceApps = [];
	                if (properties)
	                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
	                        if (properties[keys[i]] != null)
	                            this[keys[i]] = properties[keys[i]];
	            }

	            /**
	             * FtraceConfig ftraceEvents.
	             * @member {Array.<string>} ftraceEvents
	             * @memberof perfetto.protos.FtraceConfig
	             * @instance
	             */
	            FtraceConfig.prototype.ftraceEvents = $util.emptyArray;

	            /**
	             * FtraceConfig atraceCategories.
	             * @member {Array.<string>} atraceCategories
	             * @memberof perfetto.protos.FtraceConfig
	             * @instance
	             */
	            FtraceConfig.prototype.atraceCategories = $util.emptyArray;

	            /**
	             * FtraceConfig atraceApps.
	             * @member {Array.<string>} atraceApps
	             * @memberof perfetto.protos.FtraceConfig
	             * @instance
	             */
	            FtraceConfig.prototype.atraceApps = $util.emptyArray;

	            /**
	             * FtraceConfig bufferSizeKb.
	             * @member {number} bufferSizeKb
	             * @memberof perfetto.protos.FtraceConfig
	             * @instance
	             */
	            FtraceConfig.prototype.bufferSizeKb = 0;

	            /**
	             * FtraceConfig drainPeriodMs.
	             * @member {number} drainPeriodMs
	             * @memberof perfetto.protos.FtraceConfig
	             * @instance
	             */
	            FtraceConfig.prototype.drainPeriodMs = 0;

	            /**
	             * Creates a new FtraceConfig instance using the specified properties.
	             * @function create
	             * @memberof perfetto.protos.FtraceConfig
	             * @static
	             * @param {perfetto.protos.IFtraceConfig=} [properties] Properties to set
	             * @returns {perfetto.protos.FtraceConfig} FtraceConfig instance
	             */
	            FtraceConfig.create = function create(properties) {
	                return new FtraceConfig(properties);
	            };

	            /**
	             * Encodes the specified FtraceConfig message. Does not implicitly {@link perfetto.protos.FtraceConfig.verify|verify} messages.
	             * @function encode
	             * @memberof perfetto.protos.FtraceConfig
	             * @static
	             * @param {perfetto.protos.IFtraceConfig} message FtraceConfig message or plain object to encode
	             * @param {$protobuf.Writer} [writer] Writer to encode to
	             * @returns {$protobuf.Writer} Writer
	             */
	            FtraceConfig.encode = function encode(message, writer) {
	                if (!writer)
	                    writer = $Writer.create();
	                if (message.ftraceEvents != null && message.ftraceEvents.length)
	                    for (var i = 0; i < message.ftraceEvents.length; ++i)
	                        writer.uint32(/* id 1, wireType 2 =*/10).string(message.ftraceEvents[i]);
	                if (message.atraceCategories != null && message.atraceCategories.length)
	                    for (var i = 0; i < message.atraceCategories.length; ++i)
	                        writer.uint32(/* id 2, wireType 2 =*/18).string(message.atraceCategories[i]);
	                if (message.atraceApps != null && message.atraceApps.length)
	                    for (var i = 0; i < message.atraceApps.length; ++i)
	                        writer.uint32(/* id 3, wireType 2 =*/26).string(message.atraceApps[i]);
	                if (message.bufferSizeKb != null && message.hasOwnProperty("bufferSizeKb"))
	                    writer.uint32(/* id 10, wireType 0 =*/80).uint32(message.bufferSizeKb);
	                if (message.drainPeriodMs != null && message.hasOwnProperty("drainPeriodMs"))
	                    writer.uint32(/* id 11, wireType 0 =*/88).uint32(message.drainPeriodMs);
	                return writer;
	            };

	            /**
	             * Encodes the specified FtraceConfig message, length delimited. Does not implicitly {@link perfetto.protos.FtraceConfig.verify|verify} messages.
	             * @function encodeDelimited
	             * @memberof perfetto.protos.FtraceConfig
	             * @static
	             * @param {perfetto.protos.IFtraceConfig} message FtraceConfig message or plain object to encode
	             * @param {$protobuf.Writer} [writer] Writer to encode to
	             * @returns {$protobuf.Writer} Writer
	             */
	            FtraceConfig.encodeDelimited = function encodeDelimited(message, writer) {
	                return this.encode(message, writer).ldelim();
	            };

	            /**
	             * Decodes a FtraceConfig message from the specified reader or buffer.
	             * @function decode
	             * @memberof perfetto.protos.FtraceConfig
	             * @static
	             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
	             * @param {number} [length] Message length if known beforehand
	             * @returns {perfetto.protos.FtraceConfig} FtraceConfig
	             * @throws {Error} If the payload is not a reader or valid buffer
	             * @throws {$protobuf.util.ProtocolError} If required fields are missing
	             */
	            FtraceConfig.decode = function decode(reader, length) {
	                if (!(reader instanceof $Reader))
	                    reader = $Reader.create(reader);
	                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.perfetto.protos.FtraceConfig();
	                while (reader.pos < end) {
	                    var tag = reader.uint32();
	                    switch (tag >>> 3) {
	                    case 1:
	                        if (!(message.ftraceEvents && message.ftraceEvents.length))
	                            message.ftraceEvents = [];
	                        message.ftraceEvents.push(reader.string());
	                        break;
	                    case 2:
	                        if (!(message.atraceCategories && message.atraceCategories.length))
	                            message.atraceCategories = [];
	                        message.atraceCategories.push(reader.string());
	                        break;
	                    case 3:
	                        if (!(message.atraceApps && message.atraceApps.length))
	                            message.atraceApps = [];
	                        message.atraceApps.push(reader.string());
	                        break;
	                    case 10:
	                        message.bufferSizeKb = reader.uint32();
	                        break;
	                    case 11:
	                        message.drainPeriodMs = reader.uint32();
	                        break;
	                    default:
	                        reader.skipType(tag & 7);
	                        break;
	                    }
	                }
	                return message;
	            };

	            /**
	             * Decodes a FtraceConfig message from the specified reader or buffer, length delimited.
	             * @function decodeDelimited
	             * @memberof perfetto.protos.FtraceConfig
	             * @static
	             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
	             * @returns {perfetto.protos.FtraceConfig} FtraceConfig
	             * @throws {Error} If the payload is not a reader or valid buffer
	             * @throws {$protobuf.util.ProtocolError} If required fields are missing
	             */
	            FtraceConfig.decodeDelimited = function decodeDelimited(reader) {
	                if (!(reader instanceof $Reader))
	                    reader = new $Reader(reader);
	                return this.decode(reader, reader.uint32());
	            };

	            /**
	             * Verifies a FtraceConfig message.
	             * @function verify
	             * @memberof perfetto.protos.FtraceConfig
	             * @static
	             * @param {Object.<string,*>} message Plain object to verify
	             * @returns {string|null} `null` if valid, otherwise the reason why it is not
	             */
	            FtraceConfig.verify = function verify(message) {
	                if (typeof message !== "object" || message === null)
	                    return "object expected";
	                if (message.ftraceEvents != null && message.hasOwnProperty("ftraceEvents")) {
	                    if (!Array.isArray(message.ftraceEvents))
	                        return "ftraceEvents: array expected";
	                    for (var i = 0; i < message.ftraceEvents.length; ++i)
	                        if (!$util.isString(message.ftraceEvents[i]))
	                            return "ftraceEvents: string[] expected";
	                }
	                if (message.atraceCategories != null && message.hasOwnProperty("atraceCategories")) {
	                    if (!Array.isArray(message.atraceCategories))
	                        return "atraceCategories: array expected";
	                    for (var i = 0; i < message.atraceCategories.length; ++i)
	                        if (!$util.isString(message.atraceCategories[i]))
	                            return "atraceCategories: string[] expected";
	                }
	                if (message.atraceApps != null && message.hasOwnProperty("atraceApps")) {
	                    if (!Array.isArray(message.atraceApps))
	                        return "atraceApps: array expected";
	                    for (var i = 0; i < message.atraceApps.length; ++i)
	                        if (!$util.isString(message.atraceApps[i]))
	                            return "atraceApps: string[] expected";
	                }
	                if (message.bufferSizeKb != null && message.hasOwnProperty("bufferSizeKb"))
	                    if (!$util.isInteger(message.bufferSizeKb))
	                        return "bufferSizeKb: integer expected";
	                if (message.drainPeriodMs != null && message.hasOwnProperty("drainPeriodMs"))
	                    if (!$util.isInteger(message.drainPeriodMs))
	                        return "drainPeriodMs: integer expected";
	                return null;
	            };

	            /**
	             * Creates a FtraceConfig message from a plain object. Also converts values to their respective internal types.
	             * @function fromObject
	             * @memberof perfetto.protos.FtraceConfig
	             * @static
	             * @param {Object.<string,*>} object Plain object
	             * @returns {perfetto.protos.FtraceConfig} FtraceConfig
	             */
	            FtraceConfig.fromObject = function fromObject(object) {
	                if (object instanceof $root.perfetto.protos.FtraceConfig)
	                    return object;
	                var message = new $root.perfetto.protos.FtraceConfig();
	                if (object.ftraceEvents) {
	                    if (!Array.isArray(object.ftraceEvents))
	                        throw TypeError(".perfetto.protos.FtraceConfig.ftraceEvents: array expected");
	                    message.ftraceEvents = [];
	                    for (var i = 0; i < object.ftraceEvents.length; ++i)
	                        message.ftraceEvents[i] = String(object.ftraceEvents[i]);
	                }
	                if (object.atraceCategories) {
	                    if (!Array.isArray(object.atraceCategories))
	                        throw TypeError(".perfetto.protos.FtraceConfig.atraceCategories: array expected");
	                    message.atraceCategories = [];
	                    for (var i = 0; i < object.atraceCategories.length; ++i)
	                        message.atraceCategories[i] = String(object.atraceCategories[i]);
	                }
	                if (object.atraceApps) {
	                    if (!Array.isArray(object.atraceApps))
	                        throw TypeError(".perfetto.protos.FtraceConfig.atraceApps: array expected");
	                    message.atraceApps = [];
	                    for (var i = 0; i < object.atraceApps.length; ++i)
	                        message.atraceApps[i] = String(object.atraceApps[i]);
	                }
	                if (object.bufferSizeKb != null)
	                    message.bufferSizeKb = object.bufferSizeKb >>> 0;
	                if (object.drainPeriodMs != null)
	                    message.drainPeriodMs = object.drainPeriodMs >>> 0;
	                return message;
	            };

	            /**
	             * Creates a plain object from a FtraceConfig message. Also converts values to other types if specified.
	             * @function toObject
	             * @memberof perfetto.protos.FtraceConfig
	             * @static
	             * @param {perfetto.protos.FtraceConfig} message FtraceConfig
	             * @param {$protobuf.IConversionOptions} [options] Conversion options
	             * @returns {Object.<string,*>} Plain object
	             */
	            FtraceConfig.toObject = function toObject(message, options) {
	                if (!options)
	                    options = {};
	                var object = {};
	                if (options.arrays || options.defaults) {
	                    object.ftraceEvents = [];
	                    object.atraceCategories = [];
	                    object.atraceApps = [];
	                }
	                if (options.defaults) {
	                    object.bufferSizeKb = 0;
	                    object.drainPeriodMs = 0;
	                }
	                if (message.ftraceEvents && message.ftraceEvents.length) {
	                    object.ftraceEvents = [];
	                    for (var j = 0; j < message.ftraceEvents.length; ++j)
	                        object.ftraceEvents[j] = message.ftraceEvents[j];
	                }
	                if (message.atraceCategories && message.atraceCategories.length) {
	                    object.atraceCategories = [];
	                    for (var j = 0; j < message.atraceCategories.length; ++j)
	                        object.atraceCategories[j] = message.atraceCategories[j];
	                }
	                if (message.atraceApps && message.atraceApps.length) {
	                    object.atraceApps = [];
	                    for (var j = 0; j < message.atraceApps.length; ++j)
	                        object.atraceApps[j] = message.atraceApps[j];
	                }
	                if (message.bufferSizeKb != null && message.hasOwnProperty("bufferSizeKb"))
	                    object.bufferSizeKb = message.bufferSizeKb;
	                if (message.drainPeriodMs != null && message.hasOwnProperty("drainPeriodMs"))
	                    object.drainPeriodMs = message.drainPeriodMs;
	                return object;
	            };

	            /**
	             * Converts this FtraceConfig to JSON.
	             * @function toJSON
	             * @memberof perfetto.protos.FtraceConfig
	             * @instance
	             * @returns {Object.<string,*>} JSON object
	             */
	            FtraceConfig.prototype.toJSON = function toJSON() {
	                return this.constructor.toObject(this, minimal$1.util.toJSONOptions);
	            };

	            return FtraceConfig;
	        })();

	        protos.TestConfig = (function() {

	            /**
	             * Properties of a TestConfig.
	             * @memberof perfetto.protos
	             * @interface ITestConfig
	             * @property {number|null} [messageCount] TestConfig messageCount
	             * @property {number|null} [maxMessagesPerSecond] TestConfig maxMessagesPerSecond
	             * @property {number|null} [seed] TestConfig seed
	             * @property {number|null} [messageSize] TestConfig messageSize
	             * @property {boolean|null} [sendBatchOnRegister] TestConfig sendBatchOnRegister
	             */

	            /**
	             * Constructs a new TestConfig.
	             * @memberof perfetto.protos
	             * @classdesc Represents a TestConfig.
	             * @implements ITestConfig
	             * @constructor
	             * @param {perfetto.protos.ITestConfig=} [properties] Properties to set
	             */
	            function TestConfig(properties) {
	                if (properties)
	                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
	                        if (properties[keys[i]] != null)
	                            this[keys[i]] = properties[keys[i]];
	            }

	            /**
	             * TestConfig messageCount.
	             * @member {number} messageCount
	             * @memberof perfetto.protos.TestConfig
	             * @instance
	             */
	            TestConfig.prototype.messageCount = 0;

	            /**
	             * TestConfig maxMessagesPerSecond.
	             * @member {number} maxMessagesPerSecond
	             * @memberof perfetto.protos.TestConfig
	             * @instance
	             */
	            TestConfig.prototype.maxMessagesPerSecond = 0;

	            /**
	             * TestConfig seed.
	             * @member {number} seed
	             * @memberof perfetto.protos.TestConfig
	             * @instance
	             */
	            TestConfig.prototype.seed = 0;

	            /**
	             * TestConfig messageSize.
	             * @member {number} messageSize
	             * @memberof perfetto.protos.TestConfig
	             * @instance
	             */
	            TestConfig.prototype.messageSize = 0;

	            /**
	             * TestConfig sendBatchOnRegister.
	             * @member {boolean} sendBatchOnRegister
	             * @memberof perfetto.protos.TestConfig
	             * @instance
	             */
	            TestConfig.prototype.sendBatchOnRegister = false;

	            /**
	             * Creates a new TestConfig instance using the specified properties.
	             * @function create
	             * @memberof perfetto.protos.TestConfig
	             * @static
	             * @param {perfetto.protos.ITestConfig=} [properties] Properties to set
	             * @returns {perfetto.protos.TestConfig} TestConfig instance
	             */
	            TestConfig.create = function create(properties) {
	                return new TestConfig(properties);
	            };

	            /**
	             * Encodes the specified TestConfig message. Does not implicitly {@link perfetto.protos.TestConfig.verify|verify} messages.
	             * @function encode
	             * @memberof perfetto.protos.TestConfig
	             * @static
	             * @param {perfetto.protos.ITestConfig} message TestConfig message or plain object to encode
	             * @param {$protobuf.Writer} [writer] Writer to encode to
	             * @returns {$protobuf.Writer} Writer
	             */
	            TestConfig.encode = function encode(message, writer) {
	                if (!writer)
	                    writer = $Writer.create();
	                if (message.messageCount != null && message.hasOwnProperty("messageCount"))
	                    writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.messageCount);
	                if (message.maxMessagesPerSecond != null && message.hasOwnProperty("maxMessagesPerSecond"))
	                    writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.maxMessagesPerSecond);
	                if (message.seed != null && message.hasOwnProperty("seed"))
	                    writer.uint32(/* id 3, wireType 0 =*/24).uint32(message.seed);
	                if (message.messageSize != null && message.hasOwnProperty("messageSize"))
	                    writer.uint32(/* id 4, wireType 0 =*/32).uint32(message.messageSize);
	                if (message.sendBatchOnRegister != null && message.hasOwnProperty("sendBatchOnRegister"))
	                    writer.uint32(/* id 5, wireType 0 =*/40).bool(message.sendBatchOnRegister);
	                return writer;
	            };

	            /**
	             * Encodes the specified TestConfig message, length delimited. Does not implicitly {@link perfetto.protos.TestConfig.verify|verify} messages.
	             * @function encodeDelimited
	             * @memberof perfetto.protos.TestConfig
	             * @static
	             * @param {perfetto.protos.ITestConfig} message TestConfig message or plain object to encode
	             * @param {$protobuf.Writer} [writer] Writer to encode to
	             * @returns {$protobuf.Writer} Writer
	             */
	            TestConfig.encodeDelimited = function encodeDelimited(message, writer) {
	                return this.encode(message, writer).ldelim();
	            };

	            /**
	             * Decodes a TestConfig message from the specified reader or buffer.
	             * @function decode
	             * @memberof perfetto.protos.TestConfig
	             * @static
	             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
	             * @param {number} [length] Message length if known beforehand
	             * @returns {perfetto.protos.TestConfig} TestConfig
	             * @throws {Error} If the payload is not a reader or valid buffer
	             * @throws {$protobuf.util.ProtocolError} If required fields are missing
	             */
	            TestConfig.decode = function decode(reader, length) {
	                if (!(reader instanceof $Reader))
	                    reader = $Reader.create(reader);
	                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.perfetto.protos.TestConfig();
	                while (reader.pos < end) {
	                    var tag = reader.uint32();
	                    switch (tag >>> 3) {
	                    case 1:
	                        message.messageCount = reader.uint32();
	                        break;
	                    case 2:
	                        message.maxMessagesPerSecond = reader.uint32();
	                        break;
	                    case 3:
	                        message.seed = reader.uint32();
	                        break;
	                    case 4:
	                        message.messageSize = reader.uint32();
	                        break;
	                    case 5:
	                        message.sendBatchOnRegister = reader.bool();
	                        break;
	                    default:
	                        reader.skipType(tag & 7);
	                        break;
	                    }
	                }
	                return message;
	            };

	            /**
	             * Decodes a TestConfig message from the specified reader or buffer, length delimited.
	             * @function decodeDelimited
	             * @memberof perfetto.protos.TestConfig
	             * @static
	             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
	             * @returns {perfetto.protos.TestConfig} TestConfig
	             * @throws {Error} If the payload is not a reader or valid buffer
	             * @throws {$protobuf.util.ProtocolError} If required fields are missing
	             */
	            TestConfig.decodeDelimited = function decodeDelimited(reader) {
	                if (!(reader instanceof $Reader))
	                    reader = new $Reader(reader);
	                return this.decode(reader, reader.uint32());
	            };

	            /**
	             * Verifies a TestConfig message.
	             * @function verify
	             * @memberof perfetto.protos.TestConfig
	             * @static
	             * @param {Object.<string,*>} message Plain object to verify
	             * @returns {string|null} `null` if valid, otherwise the reason why it is not
	             */
	            TestConfig.verify = function verify(message) {
	                if (typeof message !== "object" || message === null)
	                    return "object expected";
	                if (message.messageCount != null && message.hasOwnProperty("messageCount"))
	                    if (!$util.isInteger(message.messageCount))
	                        return "messageCount: integer expected";
	                if (message.maxMessagesPerSecond != null && message.hasOwnProperty("maxMessagesPerSecond"))
	                    if (!$util.isInteger(message.maxMessagesPerSecond))
	                        return "maxMessagesPerSecond: integer expected";
	                if (message.seed != null && message.hasOwnProperty("seed"))
	                    if (!$util.isInteger(message.seed))
	                        return "seed: integer expected";
	                if (message.messageSize != null && message.hasOwnProperty("messageSize"))
	                    if (!$util.isInteger(message.messageSize))
	                        return "messageSize: integer expected";
	                if (message.sendBatchOnRegister != null && message.hasOwnProperty("sendBatchOnRegister"))
	                    if (typeof message.sendBatchOnRegister !== "boolean")
	                        return "sendBatchOnRegister: boolean expected";
	                return null;
	            };

	            /**
	             * Creates a TestConfig message from a plain object. Also converts values to their respective internal types.
	             * @function fromObject
	             * @memberof perfetto.protos.TestConfig
	             * @static
	             * @param {Object.<string,*>} object Plain object
	             * @returns {perfetto.protos.TestConfig} TestConfig
	             */
	            TestConfig.fromObject = function fromObject(object) {
	                if (object instanceof $root.perfetto.protos.TestConfig)
	                    return object;
	                var message = new $root.perfetto.protos.TestConfig();
	                if (object.messageCount != null)
	                    message.messageCount = object.messageCount >>> 0;
	                if (object.maxMessagesPerSecond != null)
	                    message.maxMessagesPerSecond = object.maxMessagesPerSecond >>> 0;
	                if (object.seed != null)
	                    message.seed = object.seed >>> 0;
	                if (object.messageSize != null)
	                    message.messageSize = object.messageSize >>> 0;
	                if (object.sendBatchOnRegister != null)
	                    message.sendBatchOnRegister = Boolean(object.sendBatchOnRegister);
	                return message;
	            };

	            /**
	             * Creates a plain object from a TestConfig message. Also converts values to other types if specified.
	             * @function toObject
	             * @memberof perfetto.protos.TestConfig
	             * @static
	             * @param {perfetto.protos.TestConfig} message TestConfig
	             * @param {$protobuf.IConversionOptions} [options] Conversion options
	             * @returns {Object.<string,*>} Plain object
	             */
	            TestConfig.toObject = function toObject(message, options) {
	                if (!options)
	                    options = {};
	                var object = {};
	                if (options.defaults) {
	                    object.messageCount = 0;
	                    object.maxMessagesPerSecond = 0;
	                    object.seed = 0;
	                    object.messageSize = 0;
	                    object.sendBatchOnRegister = false;
	                }
	                if (message.messageCount != null && message.hasOwnProperty("messageCount"))
	                    object.messageCount = message.messageCount;
	                if (message.maxMessagesPerSecond != null && message.hasOwnProperty("maxMessagesPerSecond"))
	                    object.maxMessagesPerSecond = message.maxMessagesPerSecond;
	                if (message.seed != null && message.hasOwnProperty("seed"))
	                    object.seed = message.seed;
	                if (message.messageSize != null && message.hasOwnProperty("messageSize"))
	                    object.messageSize = message.messageSize;
	                if (message.sendBatchOnRegister != null && message.hasOwnProperty("sendBatchOnRegister"))
	                    object.sendBatchOnRegister = message.sendBatchOnRegister;
	                return object;
	            };

	            /**
	             * Converts this TestConfig to JSON.
	             * @function toJSON
	             * @memberof perfetto.protos.TestConfig
	             * @instance
	             * @returns {Object.<string,*>} JSON object
	             */
	            TestConfig.prototype.toJSON = function toJSON() {
	                return this.constructor.toObject(this, minimal$1.util.toJSONOptions);
	            };

	            return TestConfig;
	        })();

	        protos.TraceConfig = (function() {

	            /**
	             * Properties of a TraceConfig.
	             * @memberof perfetto.protos
	             * @interface ITraceConfig
	             * @property {Array.<perfetto.protos.TraceConfig.IBufferConfig>|null} [buffers] TraceConfig buffers
	             * @property {Array.<perfetto.protos.TraceConfig.IDataSource>|null} [dataSources] TraceConfig dataSources
	             * @property {number|null} [durationMs] TraceConfig durationMs
	             * @property {boolean|null} [enableExtraGuardrails] TraceConfig enableExtraGuardrails
	             * @property {perfetto.protos.TraceConfig.LockdownModeOperation|null} [lockdownMode] TraceConfig lockdownMode
	             * @property {Array.<perfetto.protos.TraceConfig.IProducerConfig>|null} [producers] TraceConfig producers
	             * @property {perfetto.protos.TraceConfig.IStatsdMetadata|null} [statsdMetadata] TraceConfig statsdMetadata
	             * @property {boolean|null} [writeIntoFile] TraceConfig writeIntoFile
	             * @property {number|null} [fileWritePeriodMs] TraceConfig fileWritePeriodMs
	             * @property {number|Long|null} [maxFileSizeBytes] TraceConfig maxFileSizeBytes
	             * @property {perfetto.protos.TraceConfig.IGuardrailOverrides|null} [guardrailOverrides] TraceConfig guardrailOverrides
	             */

	            /**
	             * Constructs a new TraceConfig.
	             * @memberof perfetto.protos
	             * @classdesc Represents a TraceConfig.
	             * @implements ITraceConfig
	             * @constructor
	             * @param {perfetto.protos.ITraceConfig=} [properties] Properties to set
	             */
	            function TraceConfig(properties) {
	                this.buffers = [];
	                this.dataSources = [];
	                this.producers = [];
	                if (properties)
	                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
	                        if (properties[keys[i]] != null)
	                            this[keys[i]] = properties[keys[i]];
	            }

	            /**
	             * TraceConfig buffers.
	             * @member {Array.<perfetto.protos.TraceConfig.IBufferConfig>} buffers
	             * @memberof perfetto.protos.TraceConfig
	             * @instance
	             */
	            TraceConfig.prototype.buffers = $util.emptyArray;

	            /**
	             * TraceConfig dataSources.
	             * @member {Array.<perfetto.protos.TraceConfig.IDataSource>} dataSources
	             * @memberof perfetto.protos.TraceConfig
	             * @instance
	             */
	            TraceConfig.prototype.dataSources = $util.emptyArray;

	            /**
	             * TraceConfig durationMs.
	             * @member {number} durationMs
	             * @memberof perfetto.protos.TraceConfig
	             * @instance
	             */
	            TraceConfig.prototype.durationMs = 0;

	            /**
	             * TraceConfig enableExtraGuardrails.
	             * @member {boolean} enableExtraGuardrails
	             * @memberof perfetto.protos.TraceConfig
	             * @instance
	             */
	            TraceConfig.prototype.enableExtraGuardrails = false;

	            /**
	             * TraceConfig lockdownMode.
	             * @member {perfetto.protos.TraceConfig.LockdownModeOperation} lockdownMode
	             * @memberof perfetto.protos.TraceConfig
	             * @instance
	             */
	            TraceConfig.prototype.lockdownMode = 0;

	            /**
	             * TraceConfig producers.
	             * @member {Array.<perfetto.protos.TraceConfig.IProducerConfig>} producers
	             * @memberof perfetto.protos.TraceConfig
	             * @instance
	             */
	            TraceConfig.prototype.producers = $util.emptyArray;

	            /**
	             * TraceConfig statsdMetadata.
	             * @member {perfetto.protos.TraceConfig.IStatsdMetadata|null|undefined} statsdMetadata
	             * @memberof perfetto.protos.TraceConfig
	             * @instance
	             */
	            TraceConfig.prototype.statsdMetadata = null;

	            /**
	             * TraceConfig writeIntoFile.
	             * @member {boolean} writeIntoFile
	             * @memberof perfetto.protos.TraceConfig
	             * @instance
	             */
	            TraceConfig.prototype.writeIntoFile = false;

	            /**
	             * TraceConfig fileWritePeriodMs.
	             * @member {number} fileWritePeriodMs
	             * @memberof perfetto.protos.TraceConfig
	             * @instance
	             */
	            TraceConfig.prototype.fileWritePeriodMs = 0;

	            /**
	             * TraceConfig maxFileSizeBytes.
	             * @member {number|Long} maxFileSizeBytes
	             * @memberof perfetto.protos.TraceConfig
	             * @instance
	             */
	            TraceConfig.prototype.maxFileSizeBytes = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

	            /**
	             * TraceConfig guardrailOverrides.
	             * @member {perfetto.protos.TraceConfig.IGuardrailOverrides|null|undefined} guardrailOverrides
	             * @memberof perfetto.protos.TraceConfig
	             * @instance
	             */
	            TraceConfig.prototype.guardrailOverrides = null;

	            /**
	             * Creates a new TraceConfig instance using the specified properties.
	             * @function create
	             * @memberof perfetto.protos.TraceConfig
	             * @static
	             * @param {perfetto.protos.ITraceConfig=} [properties] Properties to set
	             * @returns {perfetto.protos.TraceConfig} TraceConfig instance
	             */
	            TraceConfig.create = function create(properties) {
	                return new TraceConfig(properties);
	            };

	            /**
	             * Encodes the specified TraceConfig message. Does not implicitly {@link perfetto.protos.TraceConfig.verify|verify} messages.
	             * @function encode
	             * @memberof perfetto.protos.TraceConfig
	             * @static
	             * @param {perfetto.protos.ITraceConfig} message TraceConfig message or plain object to encode
	             * @param {$protobuf.Writer} [writer] Writer to encode to
	             * @returns {$protobuf.Writer} Writer
	             */
	            TraceConfig.encode = function encode(message, writer) {
	                if (!writer)
	                    writer = $Writer.create();
	                if (message.buffers != null && message.buffers.length)
	                    for (var i = 0; i < message.buffers.length; ++i)
	                        $root.perfetto.protos.TraceConfig.BufferConfig.encode(message.buffers[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
	                if (message.dataSources != null && message.dataSources.length)
	                    for (var i = 0; i < message.dataSources.length; ++i)
	                        $root.perfetto.protos.TraceConfig.DataSource.encode(message.dataSources[i], writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
	                if (message.durationMs != null && message.hasOwnProperty("durationMs"))
	                    writer.uint32(/* id 3, wireType 0 =*/24).uint32(message.durationMs);
	                if (message.enableExtraGuardrails != null && message.hasOwnProperty("enableExtraGuardrails"))
	                    writer.uint32(/* id 4, wireType 0 =*/32).bool(message.enableExtraGuardrails);
	                if (message.lockdownMode != null && message.hasOwnProperty("lockdownMode"))
	                    writer.uint32(/* id 5, wireType 0 =*/40).int32(message.lockdownMode);
	                if (message.producers != null && message.producers.length)
	                    for (var i = 0; i < message.producers.length; ++i)
	                        $root.perfetto.protos.TraceConfig.ProducerConfig.encode(message.producers[i], writer.uint32(/* id 6, wireType 2 =*/50).fork()).ldelim();
	                if (message.statsdMetadata != null && message.hasOwnProperty("statsdMetadata"))
	                    $root.perfetto.protos.TraceConfig.StatsdMetadata.encode(message.statsdMetadata, writer.uint32(/* id 7, wireType 2 =*/58).fork()).ldelim();
	                if (message.writeIntoFile != null && message.hasOwnProperty("writeIntoFile"))
	                    writer.uint32(/* id 8, wireType 0 =*/64).bool(message.writeIntoFile);
	                if (message.fileWritePeriodMs != null && message.hasOwnProperty("fileWritePeriodMs"))
	                    writer.uint32(/* id 9, wireType 0 =*/72).uint32(message.fileWritePeriodMs);
	                if (message.maxFileSizeBytes != null && message.hasOwnProperty("maxFileSizeBytes"))
	                    writer.uint32(/* id 10, wireType 0 =*/80).uint64(message.maxFileSizeBytes);
	                if (message.guardrailOverrides != null && message.hasOwnProperty("guardrailOverrides"))
	                    $root.perfetto.protos.TraceConfig.GuardrailOverrides.encode(message.guardrailOverrides, writer.uint32(/* id 11, wireType 2 =*/90).fork()).ldelim();
	                return writer;
	            };

	            /**
	             * Encodes the specified TraceConfig message, length delimited. Does not implicitly {@link perfetto.protos.TraceConfig.verify|verify} messages.
	             * @function encodeDelimited
	             * @memberof perfetto.protos.TraceConfig
	             * @static
	             * @param {perfetto.protos.ITraceConfig} message TraceConfig message or plain object to encode
	             * @param {$protobuf.Writer} [writer] Writer to encode to
	             * @returns {$protobuf.Writer} Writer
	             */
	            TraceConfig.encodeDelimited = function encodeDelimited(message, writer) {
	                return this.encode(message, writer).ldelim();
	            };

	            /**
	             * Decodes a TraceConfig message from the specified reader or buffer.
	             * @function decode
	             * @memberof perfetto.protos.TraceConfig
	             * @static
	             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
	             * @param {number} [length] Message length if known beforehand
	             * @returns {perfetto.protos.TraceConfig} TraceConfig
	             * @throws {Error} If the payload is not a reader or valid buffer
	             * @throws {$protobuf.util.ProtocolError} If required fields are missing
	             */
	            TraceConfig.decode = function decode(reader, length) {
	                if (!(reader instanceof $Reader))
	                    reader = $Reader.create(reader);
	                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.perfetto.protos.TraceConfig();
	                while (reader.pos < end) {
	                    var tag = reader.uint32();
	                    switch (tag >>> 3) {
	                    case 1:
	                        if (!(message.buffers && message.buffers.length))
	                            message.buffers = [];
	                        message.buffers.push($root.perfetto.protos.TraceConfig.BufferConfig.decode(reader, reader.uint32()));
	                        break;
	                    case 2:
	                        if (!(message.dataSources && message.dataSources.length))
	                            message.dataSources = [];
	                        message.dataSources.push($root.perfetto.protos.TraceConfig.DataSource.decode(reader, reader.uint32()));
	                        break;
	                    case 3:
	                        message.durationMs = reader.uint32();
	                        break;
	                    case 4:
	                        message.enableExtraGuardrails = reader.bool();
	                        break;
	                    case 5:
	                        message.lockdownMode = reader.int32();
	                        break;
	                    case 6:
	                        if (!(message.producers && message.producers.length))
	                            message.producers = [];
	                        message.producers.push($root.perfetto.protos.TraceConfig.ProducerConfig.decode(reader, reader.uint32()));
	                        break;
	                    case 7:
	                        message.statsdMetadata = $root.perfetto.protos.TraceConfig.StatsdMetadata.decode(reader, reader.uint32());
	                        break;
	                    case 8:
	                        message.writeIntoFile = reader.bool();
	                        break;
	                    case 9:
	                        message.fileWritePeriodMs = reader.uint32();
	                        break;
	                    case 10:
	                        message.maxFileSizeBytes = reader.uint64();
	                        break;
	                    case 11:
	                        message.guardrailOverrides = $root.perfetto.protos.TraceConfig.GuardrailOverrides.decode(reader, reader.uint32());
	                        break;
	                    default:
	                        reader.skipType(tag & 7);
	                        break;
	                    }
	                }
	                return message;
	            };

	            /**
	             * Decodes a TraceConfig message from the specified reader or buffer, length delimited.
	             * @function decodeDelimited
	             * @memberof perfetto.protos.TraceConfig
	             * @static
	             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
	             * @returns {perfetto.protos.TraceConfig} TraceConfig
	             * @throws {Error} If the payload is not a reader or valid buffer
	             * @throws {$protobuf.util.ProtocolError} If required fields are missing
	             */
	            TraceConfig.decodeDelimited = function decodeDelimited(reader) {
	                if (!(reader instanceof $Reader))
	                    reader = new $Reader(reader);
	                return this.decode(reader, reader.uint32());
	            };

	            /**
	             * Verifies a TraceConfig message.
	             * @function verify
	             * @memberof perfetto.protos.TraceConfig
	             * @static
	             * @param {Object.<string,*>} message Plain object to verify
	             * @returns {string|null} `null` if valid, otherwise the reason why it is not
	             */
	            TraceConfig.verify = function verify(message) {
	                if (typeof message !== "object" || message === null)
	                    return "object expected";
	                if (message.buffers != null && message.hasOwnProperty("buffers")) {
	                    if (!Array.isArray(message.buffers))
	                        return "buffers: array expected";
	                    for (var i = 0; i < message.buffers.length; ++i) {
	                        var error = $root.perfetto.protos.TraceConfig.BufferConfig.verify(message.buffers[i]);
	                        if (error)
	                            return "buffers." + error;
	                    }
	                }
	                if (message.dataSources != null && message.hasOwnProperty("dataSources")) {
	                    if (!Array.isArray(message.dataSources))
	                        return "dataSources: array expected";
	                    for (var i = 0; i < message.dataSources.length; ++i) {
	                        var error = $root.perfetto.protos.TraceConfig.DataSource.verify(message.dataSources[i]);
	                        if (error)
	                            return "dataSources." + error;
	                    }
	                }
	                if (message.durationMs != null && message.hasOwnProperty("durationMs"))
	                    if (!$util.isInteger(message.durationMs))
	                        return "durationMs: integer expected";
	                if (message.enableExtraGuardrails != null && message.hasOwnProperty("enableExtraGuardrails"))
	                    if (typeof message.enableExtraGuardrails !== "boolean")
	                        return "enableExtraGuardrails: boolean expected";
	                if (message.lockdownMode != null && message.hasOwnProperty("lockdownMode"))
	                    switch (message.lockdownMode) {
	                    default:
	                        return "lockdownMode: enum value expected";
	                    case 0:
	                    case 1:
	                    case 2:
	                        break;
	                    }
	                if (message.producers != null && message.hasOwnProperty("producers")) {
	                    if (!Array.isArray(message.producers))
	                        return "producers: array expected";
	                    for (var i = 0; i < message.producers.length; ++i) {
	                        var error = $root.perfetto.protos.TraceConfig.ProducerConfig.verify(message.producers[i]);
	                        if (error)
	                            return "producers." + error;
	                    }
	                }
	                if (message.statsdMetadata != null && message.hasOwnProperty("statsdMetadata")) {
	                    var error = $root.perfetto.protos.TraceConfig.StatsdMetadata.verify(message.statsdMetadata);
	                    if (error)
	                        return "statsdMetadata." + error;
	                }
	                if (message.writeIntoFile != null && message.hasOwnProperty("writeIntoFile"))
	                    if (typeof message.writeIntoFile !== "boolean")
	                        return "writeIntoFile: boolean expected";
	                if (message.fileWritePeriodMs != null && message.hasOwnProperty("fileWritePeriodMs"))
	                    if (!$util.isInteger(message.fileWritePeriodMs))
	                        return "fileWritePeriodMs: integer expected";
	                if (message.maxFileSizeBytes != null && message.hasOwnProperty("maxFileSizeBytes"))
	                    if (!$util.isInteger(message.maxFileSizeBytes) && !(message.maxFileSizeBytes && $util.isInteger(message.maxFileSizeBytes.low) && $util.isInteger(message.maxFileSizeBytes.high)))
	                        return "maxFileSizeBytes: integer|Long expected";
	                if (message.guardrailOverrides != null && message.hasOwnProperty("guardrailOverrides")) {
	                    var error = $root.perfetto.protos.TraceConfig.GuardrailOverrides.verify(message.guardrailOverrides);
	                    if (error)
	                        return "guardrailOverrides." + error;
	                }
	                return null;
	            };

	            /**
	             * Creates a TraceConfig message from a plain object. Also converts values to their respective internal types.
	             * @function fromObject
	             * @memberof perfetto.protos.TraceConfig
	             * @static
	             * @param {Object.<string,*>} object Plain object
	             * @returns {perfetto.protos.TraceConfig} TraceConfig
	             */
	            TraceConfig.fromObject = function fromObject(object) {
	                if (object instanceof $root.perfetto.protos.TraceConfig)
	                    return object;
	                var message = new $root.perfetto.protos.TraceConfig();
	                if (object.buffers) {
	                    if (!Array.isArray(object.buffers))
	                        throw TypeError(".perfetto.protos.TraceConfig.buffers: array expected");
	                    message.buffers = [];
	                    for (var i = 0; i < object.buffers.length; ++i) {
	                        if (typeof object.buffers[i] !== "object")
	                            throw TypeError(".perfetto.protos.TraceConfig.buffers: object expected");
	                        message.buffers[i] = $root.perfetto.protos.TraceConfig.BufferConfig.fromObject(object.buffers[i]);
	                    }
	                }
	                if (object.dataSources) {
	                    if (!Array.isArray(object.dataSources))
	                        throw TypeError(".perfetto.protos.TraceConfig.dataSources: array expected");
	                    message.dataSources = [];
	                    for (var i = 0; i < object.dataSources.length; ++i) {
	                        if (typeof object.dataSources[i] !== "object")
	                            throw TypeError(".perfetto.protos.TraceConfig.dataSources: object expected");
	                        message.dataSources[i] = $root.perfetto.protos.TraceConfig.DataSource.fromObject(object.dataSources[i]);
	                    }
	                }
	                if (object.durationMs != null)
	                    message.durationMs = object.durationMs >>> 0;
	                if (object.enableExtraGuardrails != null)
	                    message.enableExtraGuardrails = Boolean(object.enableExtraGuardrails);
	                switch (object.lockdownMode) {
	                case "LOCKDOWN_UNCHANGED":
	                case 0:
	                    message.lockdownMode = 0;
	                    break;
	                case "LOCKDOWN_CLEAR":
	                case 1:
	                    message.lockdownMode = 1;
	                    break;
	                case "LOCKDOWN_SET":
	                case 2:
	                    message.lockdownMode = 2;
	                    break;
	                }
	                if (object.producers) {
	                    if (!Array.isArray(object.producers))
	                        throw TypeError(".perfetto.protos.TraceConfig.producers: array expected");
	                    message.producers = [];
	                    for (var i = 0; i < object.producers.length; ++i) {
	                        if (typeof object.producers[i] !== "object")
	                            throw TypeError(".perfetto.protos.TraceConfig.producers: object expected");
	                        message.producers[i] = $root.perfetto.protos.TraceConfig.ProducerConfig.fromObject(object.producers[i]);
	                    }
	                }
	                if (object.statsdMetadata != null) {
	                    if (typeof object.statsdMetadata !== "object")
	                        throw TypeError(".perfetto.protos.TraceConfig.statsdMetadata: object expected");
	                    message.statsdMetadata = $root.perfetto.protos.TraceConfig.StatsdMetadata.fromObject(object.statsdMetadata);
	                }
	                if (object.writeIntoFile != null)
	                    message.writeIntoFile = Boolean(object.writeIntoFile);
	                if (object.fileWritePeriodMs != null)
	                    message.fileWritePeriodMs = object.fileWritePeriodMs >>> 0;
	                if (object.maxFileSizeBytes != null)
	                    if ($util.Long)
	                        (message.maxFileSizeBytes = $util.Long.fromValue(object.maxFileSizeBytes)).unsigned = true;
	                    else if (typeof object.maxFileSizeBytes === "string")
	                        message.maxFileSizeBytes = parseInt(object.maxFileSizeBytes, 10);
	                    else if (typeof object.maxFileSizeBytes === "number")
	                        message.maxFileSizeBytes = object.maxFileSizeBytes;
	                    else if (typeof object.maxFileSizeBytes === "object")
	                        message.maxFileSizeBytes = new $util.LongBits(object.maxFileSizeBytes.low >>> 0, object.maxFileSizeBytes.high >>> 0).toNumber(true);
	                if (object.guardrailOverrides != null) {
	                    if (typeof object.guardrailOverrides !== "object")
	                        throw TypeError(".perfetto.protos.TraceConfig.guardrailOverrides: object expected");
	                    message.guardrailOverrides = $root.perfetto.protos.TraceConfig.GuardrailOverrides.fromObject(object.guardrailOverrides);
	                }
	                return message;
	            };

	            /**
	             * Creates a plain object from a TraceConfig message. Also converts values to other types if specified.
	             * @function toObject
	             * @memberof perfetto.protos.TraceConfig
	             * @static
	             * @param {perfetto.protos.TraceConfig} message TraceConfig
	             * @param {$protobuf.IConversionOptions} [options] Conversion options
	             * @returns {Object.<string,*>} Plain object
	             */
	            TraceConfig.toObject = function toObject(message, options) {
	                if (!options)
	                    options = {};
	                var object = {};
	                if (options.arrays || options.defaults) {
	                    object.buffers = [];
	                    object.dataSources = [];
	                    object.producers = [];
	                }
	                if (options.defaults) {
	                    object.durationMs = 0;
	                    object.enableExtraGuardrails = false;
	                    object.lockdownMode = options.enums === String ? "LOCKDOWN_UNCHANGED" : 0;
	                    object.statsdMetadata = null;
	                    object.writeIntoFile = false;
	                    object.fileWritePeriodMs = 0;
	                    if ($util.Long) {
	                        var long = new $util.Long(0, 0, true);
	                        object.maxFileSizeBytes = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
	                    } else
	                        object.maxFileSizeBytes = options.longs === String ? "0" : 0;
	                    object.guardrailOverrides = null;
	                }
	                if (message.buffers && message.buffers.length) {
	                    object.buffers = [];
	                    for (var j = 0; j < message.buffers.length; ++j)
	                        object.buffers[j] = $root.perfetto.protos.TraceConfig.BufferConfig.toObject(message.buffers[j], options);
	                }
	                if (message.dataSources && message.dataSources.length) {
	                    object.dataSources = [];
	                    for (var j = 0; j < message.dataSources.length; ++j)
	                        object.dataSources[j] = $root.perfetto.protos.TraceConfig.DataSource.toObject(message.dataSources[j], options);
	                }
	                if (message.durationMs != null && message.hasOwnProperty("durationMs"))
	                    object.durationMs = message.durationMs;
	                if (message.enableExtraGuardrails != null && message.hasOwnProperty("enableExtraGuardrails"))
	                    object.enableExtraGuardrails = message.enableExtraGuardrails;
	                if (message.lockdownMode != null && message.hasOwnProperty("lockdownMode"))
	                    object.lockdownMode = options.enums === String ? $root.perfetto.protos.TraceConfig.LockdownModeOperation[message.lockdownMode] : message.lockdownMode;
	                if (message.producers && message.producers.length) {
	                    object.producers = [];
	                    for (var j = 0; j < message.producers.length; ++j)
	                        object.producers[j] = $root.perfetto.protos.TraceConfig.ProducerConfig.toObject(message.producers[j], options);
	                }
	                if (message.statsdMetadata != null && message.hasOwnProperty("statsdMetadata"))
	                    object.statsdMetadata = $root.perfetto.protos.TraceConfig.StatsdMetadata.toObject(message.statsdMetadata, options);
	                if (message.writeIntoFile != null && message.hasOwnProperty("writeIntoFile"))
	                    object.writeIntoFile = message.writeIntoFile;
	                if (message.fileWritePeriodMs != null && message.hasOwnProperty("fileWritePeriodMs"))
	                    object.fileWritePeriodMs = message.fileWritePeriodMs;
	                if (message.maxFileSizeBytes != null && message.hasOwnProperty("maxFileSizeBytes"))
	                    if (typeof message.maxFileSizeBytes === "number")
	                        object.maxFileSizeBytes = options.longs === String ? String(message.maxFileSizeBytes) : message.maxFileSizeBytes;
	                    else
	                        object.maxFileSizeBytes = options.longs === String ? $util.Long.prototype.toString.call(message.maxFileSizeBytes) : options.longs === Number ? new $util.LongBits(message.maxFileSizeBytes.low >>> 0, message.maxFileSizeBytes.high >>> 0).toNumber(true) : message.maxFileSizeBytes;
	                if (message.guardrailOverrides != null && message.hasOwnProperty("guardrailOverrides"))
	                    object.guardrailOverrides = $root.perfetto.protos.TraceConfig.GuardrailOverrides.toObject(message.guardrailOverrides, options);
	                return object;
	            };

	            /**
	             * Converts this TraceConfig to JSON.
	             * @function toJSON
	             * @memberof perfetto.protos.TraceConfig
	             * @instance
	             * @returns {Object.<string,*>} JSON object
	             */
	            TraceConfig.prototype.toJSON = function toJSON() {
	                return this.constructor.toObject(this, minimal$1.util.toJSONOptions);
	            };

	            TraceConfig.BufferConfig = (function() {

	                /**
	                 * Properties of a BufferConfig.
	                 * @memberof perfetto.protos.TraceConfig
	                 * @interface IBufferConfig
	                 * @property {number|null} [sizeKb] BufferConfig sizeKb
	                 * @property {perfetto.protos.TraceConfig.BufferConfig.FillPolicy|null} [fillPolicy] BufferConfig fillPolicy
	                 */

	                /**
	                 * Constructs a new BufferConfig.
	                 * @memberof perfetto.protos.TraceConfig
	                 * @classdesc Represents a BufferConfig.
	                 * @implements IBufferConfig
	                 * @constructor
	                 * @param {perfetto.protos.TraceConfig.IBufferConfig=} [properties] Properties to set
	                 */
	                function BufferConfig(properties) {
	                    if (properties)
	                        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
	                            if (properties[keys[i]] != null)
	                                this[keys[i]] = properties[keys[i]];
	                }

	                /**
	                 * BufferConfig sizeKb.
	                 * @member {number} sizeKb
	                 * @memberof perfetto.protos.TraceConfig.BufferConfig
	                 * @instance
	                 */
	                BufferConfig.prototype.sizeKb = 0;

	                /**
	                 * BufferConfig fillPolicy.
	                 * @member {perfetto.protos.TraceConfig.BufferConfig.FillPolicy} fillPolicy
	                 * @memberof perfetto.protos.TraceConfig.BufferConfig
	                 * @instance
	                 */
	                BufferConfig.prototype.fillPolicy = 0;

	                /**
	                 * Creates a new BufferConfig instance using the specified properties.
	                 * @function create
	                 * @memberof perfetto.protos.TraceConfig.BufferConfig
	                 * @static
	                 * @param {perfetto.protos.TraceConfig.IBufferConfig=} [properties] Properties to set
	                 * @returns {perfetto.protos.TraceConfig.BufferConfig} BufferConfig instance
	                 */
	                BufferConfig.create = function create(properties) {
	                    return new BufferConfig(properties);
	                };

	                /**
	                 * Encodes the specified BufferConfig message. Does not implicitly {@link perfetto.protos.TraceConfig.BufferConfig.verify|verify} messages.
	                 * @function encode
	                 * @memberof perfetto.protos.TraceConfig.BufferConfig
	                 * @static
	                 * @param {perfetto.protos.TraceConfig.IBufferConfig} message BufferConfig message or plain object to encode
	                 * @param {$protobuf.Writer} [writer] Writer to encode to
	                 * @returns {$protobuf.Writer} Writer
	                 */
	                BufferConfig.encode = function encode(message, writer) {
	                    if (!writer)
	                        writer = $Writer.create();
	                    if (message.sizeKb != null && message.hasOwnProperty("sizeKb"))
	                        writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.sizeKb);
	                    if (message.fillPolicy != null && message.hasOwnProperty("fillPolicy"))
	                        writer.uint32(/* id 4, wireType 0 =*/32).int32(message.fillPolicy);
	                    return writer;
	                };

	                /**
	                 * Encodes the specified BufferConfig message, length delimited. Does not implicitly {@link perfetto.protos.TraceConfig.BufferConfig.verify|verify} messages.
	                 * @function encodeDelimited
	                 * @memberof perfetto.protos.TraceConfig.BufferConfig
	                 * @static
	                 * @param {perfetto.protos.TraceConfig.IBufferConfig} message BufferConfig message or plain object to encode
	                 * @param {$protobuf.Writer} [writer] Writer to encode to
	                 * @returns {$protobuf.Writer} Writer
	                 */
	                BufferConfig.encodeDelimited = function encodeDelimited(message, writer) {
	                    return this.encode(message, writer).ldelim();
	                };

	                /**
	                 * Decodes a BufferConfig message from the specified reader or buffer.
	                 * @function decode
	                 * @memberof perfetto.protos.TraceConfig.BufferConfig
	                 * @static
	                 * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
	                 * @param {number} [length] Message length if known beforehand
	                 * @returns {perfetto.protos.TraceConfig.BufferConfig} BufferConfig
	                 * @throws {Error} If the payload is not a reader or valid buffer
	                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
	                 */
	                BufferConfig.decode = function decode(reader, length) {
	                    if (!(reader instanceof $Reader))
	                        reader = $Reader.create(reader);
	                    var end = length === undefined ? reader.len : reader.pos + length, message = new $root.perfetto.protos.TraceConfig.BufferConfig();
	                    while (reader.pos < end) {
	                        var tag = reader.uint32();
	                        switch (tag >>> 3) {
	                        case 1:
	                            message.sizeKb = reader.uint32();
	                            break;
	                        case 4:
	                            message.fillPolicy = reader.int32();
	                            break;
	                        default:
	                            reader.skipType(tag & 7);
	                            break;
	                        }
	                    }
	                    return message;
	                };

	                /**
	                 * Decodes a BufferConfig message from the specified reader or buffer, length delimited.
	                 * @function decodeDelimited
	                 * @memberof perfetto.protos.TraceConfig.BufferConfig
	                 * @static
	                 * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
	                 * @returns {perfetto.protos.TraceConfig.BufferConfig} BufferConfig
	                 * @throws {Error} If the payload is not a reader or valid buffer
	                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
	                 */
	                BufferConfig.decodeDelimited = function decodeDelimited(reader) {
	                    if (!(reader instanceof $Reader))
	                        reader = new $Reader(reader);
	                    return this.decode(reader, reader.uint32());
	                };

	                /**
	                 * Verifies a BufferConfig message.
	                 * @function verify
	                 * @memberof perfetto.protos.TraceConfig.BufferConfig
	                 * @static
	                 * @param {Object.<string,*>} message Plain object to verify
	                 * @returns {string|null} `null` if valid, otherwise the reason why it is not
	                 */
	                BufferConfig.verify = function verify(message) {
	                    if (typeof message !== "object" || message === null)
	                        return "object expected";
	                    if (message.sizeKb != null && message.hasOwnProperty("sizeKb"))
	                        if (!$util.isInteger(message.sizeKb))
	                            return "sizeKb: integer expected";
	                    if (message.fillPolicy != null && message.hasOwnProperty("fillPolicy"))
	                        switch (message.fillPolicy) {
	                        default:
	                            return "fillPolicy: enum value expected";
	                        case 0:
	                        case 1:
	                            break;
	                        }
	                    return null;
	                };

	                /**
	                 * Creates a BufferConfig message from a plain object. Also converts values to their respective internal types.
	                 * @function fromObject
	                 * @memberof perfetto.protos.TraceConfig.BufferConfig
	                 * @static
	                 * @param {Object.<string,*>} object Plain object
	                 * @returns {perfetto.protos.TraceConfig.BufferConfig} BufferConfig
	                 */
	                BufferConfig.fromObject = function fromObject(object) {
	                    if (object instanceof $root.perfetto.protos.TraceConfig.BufferConfig)
	                        return object;
	                    var message = new $root.perfetto.protos.TraceConfig.BufferConfig();
	                    if (object.sizeKb != null)
	                        message.sizeKb = object.sizeKb >>> 0;
	                    switch (object.fillPolicy) {
	                    case "UNSPECIFIED":
	                    case 0:
	                        message.fillPolicy = 0;
	                        break;
	                    case "RING_BUFFER":
	                    case 1:
	                        message.fillPolicy = 1;
	                        break;
	                    }
	                    return message;
	                };

	                /**
	                 * Creates a plain object from a BufferConfig message. Also converts values to other types if specified.
	                 * @function toObject
	                 * @memberof perfetto.protos.TraceConfig.BufferConfig
	                 * @static
	                 * @param {perfetto.protos.TraceConfig.BufferConfig} message BufferConfig
	                 * @param {$protobuf.IConversionOptions} [options] Conversion options
	                 * @returns {Object.<string,*>} Plain object
	                 */
	                BufferConfig.toObject = function toObject(message, options) {
	                    if (!options)
	                        options = {};
	                    var object = {};
	                    if (options.defaults) {
	                        object.sizeKb = 0;
	                        object.fillPolicy = options.enums === String ? "UNSPECIFIED" : 0;
	                    }
	                    if (message.sizeKb != null && message.hasOwnProperty("sizeKb"))
	                        object.sizeKb = message.sizeKb;
	                    if (message.fillPolicy != null && message.hasOwnProperty("fillPolicy"))
	                        object.fillPolicy = options.enums === String ? $root.perfetto.protos.TraceConfig.BufferConfig.FillPolicy[message.fillPolicy] : message.fillPolicy;
	                    return object;
	                };

	                /**
	                 * Converts this BufferConfig to JSON.
	                 * @function toJSON
	                 * @memberof perfetto.protos.TraceConfig.BufferConfig
	                 * @instance
	                 * @returns {Object.<string,*>} JSON object
	                 */
	                BufferConfig.prototype.toJSON = function toJSON() {
	                    return this.constructor.toObject(this, minimal$1.util.toJSONOptions);
	                };

	                /**
	                 * FillPolicy enum.
	                 * @name perfetto.protos.TraceConfig.BufferConfig.FillPolicy
	                 * @enum {string}
	                 * @property {number} UNSPECIFIED=0 UNSPECIFIED value
	                 * @property {number} RING_BUFFER=1 RING_BUFFER value
	                 */
	                BufferConfig.FillPolicy = (function() {
	                    var valuesById = {}, values = Object.create(valuesById);
	                    values[valuesById[0] = "UNSPECIFIED"] = 0;
	                    values[valuesById[1] = "RING_BUFFER"] = 1;
	                    return values;
	                })();

	                return BufferConfig;
	            })();

	            TraceConfig.DataSource = (function() {

	                /**
	                 * Properties of a DataSource.
	                 * @memberof perfetto.protos.TraceConfig
	                 * @interface IDataSource
	                 * @property {perfetto.protos.IDataSourceConfig|null} [config] DataSource config
	                 * @property {Array.<string>|null} [producerNameFilter] DataSource producerNameFilter
	                 */

	                /**
	                 * Constructs a new DataSource.
	                 * @memberof perfetto.protos.TraceConfig
	                 * @classdesc Represents a DataSource.
	                 * @implements IDataSource
	                 * @constructor
	                 * @param {perfetto.protos.TraceConfig.IDataSource=} [properties] Properties to set
	                 */
	                function DataSource(properties) {
	                    this.producerNameFilter = [];
	                    if (properties)
	                        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
	                            if (properties[keys[i]] != null)
	                                this[keys[i]] = properties[keys[i]];
	                }

	                /**
	                 * DataSource config.
	                 * @member {perfetto.protos.IDataSourceConfig|null|undefined} config
	                 * @memberof perfetto.protos.TraceConfig.DataSource
	                 * @instance
	                 */
	                DataSource.prototype.config = null;

	                /**
	                 * DataSource producerNameFilter.
	                 * @member {Array.<string>} producerNameFilter
	                 * @memberof perfetto.protos.TraceConfig.DataSource
	                 * @instance
	                 */
	                DataSource.prototype.producerNameFilter = $util.emptyArray;

	                /**
	                 * Creates a new DataSource instance using the specified properties.
	                 * @function create
	                 * @memberof perfetto.protos.TraceConfig.DataSource
	                 * @static
	                 * @param {perfetto.protos.TraceConfig.IDataSource=} [properties] Properties to set
	                 * @returns {perfetto.protos.TraceConfig.DataSource} DataSource instance
	                 */
	                DataSource.create = function create(properties) {
	                    return new DataSource(properties);
	                };

	                /**
	                 * Encodes the specified DataSource message. Does not implicitly {@link perfetto.protos.TraceConfig.DataSource.verify|verify} messages.
	                 * @function encode
	                 * @memberof perfetto.protos.TraceConfig.DataSource
	                 * @static
	                 * @param {perfetto.protos.TraceConfig.IDataSource} message DataSource message or plain object to encode
	                 * @param {$protobuf.Writer} [writer] Writer to encode to
	                 * @returns {$protobuf.Writer} Writer
	                 */
	                DataSource.encode = function encode(message, writer) {
	                    if (!writer)
	                        writer = $Writer.create();
	                    if (message.config != null && message.hasOwnProperty("config"))
	                        $root.perfetto.protos.DataSourceConfig.encode(message.config, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
	                    if (message.producerNameFilter != null && message.producerNameFilter.length)
	                        for (var i = 0; i < message.producerNameFilter.length; ++i)
	                            writer.uint32(/* id 2, wireType 2 =*/18).string(message.producerNameFilter[i]);
	                    return writer;
	                };

	                /**
	                 * Encodes the specified DataSource message, length delimited. Does not implicitly {@link perfetto.protos.TraceConfig.DataSource.verify|verify} messages.
	                 * @function encodeDelimited
	                 * @memberof perfetto.protos.TraceConfig.DataSource
	                 * @static
	                 * @param {perfetto.protos.TraceConfig.IDataSource} message DataSource message or plain object to encode
	                 * @param {$protobuf.Writer} [writer] Writer to encode to
	                 * @returns {$protobuf.Writer} Writer
	                 */
	                DataSource.encodeDelimited = function encodeDelimited(message, writer) {
	                    return this.encode(message, writer).ldelim();
	                };

	                /**
	                 * Decodes a DataSource message from the specified reader or buffer.
	                 * @function decode
	                 * @memberof perfetto.protos.TraceConfig.DataSource
	                 * @static
	                 * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
	                 * @param {number} [length] Message length if known beforehand
	                 * @returns {perfetto.protos.TraceConfig.DataSource} DataSource
	                 * @throws {Error} If the payload is not a reader or valid buffer
	                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
	                 */
	                DataSource.decode = function decode(reader, length) {
	                    if (!(reader instanceof $Reader))
	                        reader = $Reader.create(reader);
	                    var end = length === undefined ? reader.len : reader.pos + length, message = new $root.perfetto.protos.TraceConfig.DataSource();
	                    while (reader.pos < end) {
	                        var tag = reader.uint32();
	                        switch (tag >>> 3) {
	                        case 1:
	                            message.config = $root.perfetto.protos.DataSourceConfig.decode(reader, reader.uint32());
	                            break;
	                        case 2:
	                            if (!(message.producerNameFilter && message.producerNameFilter.length))
	                                message.producerNameFilter = [];
	                            message.producerNameFilter.push(reader.string());
	                            break;
	                        default:
	                            reader.skipType(tag & 7);
	                            break;
	                        }
	                    }
	                    return message;
	                };

	                /**
	                 * Decodes a DataSource message from the specified reader or buffer, length delimited.
	                 * @function decodeDelimited
	                 * @memberof perfetto.protos.TraceConfig.DataSource
	                 * @static
	                 * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
	                 * @returns {perfetto.protos.TraceConfig.DataSource} DataSource
	                 * @throws {Error} If the payload is not a reader or valid buffer
	                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
	                 */
	                DataSource.decodeDelimited = function decodeDelimited(reader) {
	                    if (!(reader instanceof $Reader))
	                        reader = new $Reader(reader);
	                    return this.decode(reader, reader.uint32());
	                };

	                /**
	                 * Verifies a DataSource message.
	                 * @function verify
	                 * @memberof perfetto.protos.TraceConfig.DataSource
	                 * @static
	                 * @param {Object.<string,*>} message Plain object to verify
	                 * @returns {string|null} `null` if valid, otherwise the reason why it is not
	                 */
	                DataSource.verify = function verify(message) {
	                    if (typeof message !== "object" || message === null)
	                        return "object expected";
	                    if (message.config != null && message.hasOwnProperty("config")) {
	                        var error = $root.perfetto.protos.DataSourceConfig.verify(message.config);
	                        if (error)
	                            return "config." + error;
	                    }
	                    if (message.producerNameFilter != null && message.hasOwnProperty("producerNameFilter")) {
	                        if (!Array.isArray(message.producerNameFilter))
	                            return "producerNameFilter: array expected";
	                        for (var i = 0; i < message.producerNameFilter.length; ++i)
	                            if (!$util.isString(message.producerNameFilter[i]))
	                                return "producerNameFilter: string[] expected";
	                    }
	                    return null;
	                };

	                /**
	                 * Creates a DataSource message from a plain object. Also converts values to their respective internal types.
	                 * @function fromObject
	                 * @memberof perfetto.protos.TraceConfig.DataSource
	                 * @static
	                 * @param {Object.<string,*>} object Plain object
	                 * @returns {perfetto.protos.TraceConfig.DataSource} DataSource
	                 */
	                DataSource.fromObject = function fromObject(object) {
	                    if (object instanceof $root.perfetto.protos.TraceConfig.DataSource)
	                        return object;
	                    var message = new $root.perfetto.protos.TraceConfig.DataSource();
	                    if (object.config != null) {
	                        if (typeof object.config !== "object")
	                            throw TypeError(".perfetto.protos.TraceConfig.DataSource.config: object expected");
	                        message.config = $root.perfetto.protos.DataSourceConfig.fromObject(object.config);
	                    }
	                    if (object.producerNameFilter) {
	                        if (!Array.isArray(object.producerNameFilter))
	                            throw TypeError(".perfetto.protos.TraceConfig.DataSource.producerNameFilter: array expected");
	                        message.producerNameFilter = [];
	                        for (var i = 0; i < object.producerNameFilter.length; ++i)
	                            message.producerNameFilter[i] = String(object.producerNameFilter[i]);
	                    }
	                    return message;
	                };

	                /**
	                 * Creates a plain object from a DataSource message. Also converts values to other types if specified.
	                 * @function toObject
	                 * @memberof perfetto.protos.TraceConfig.DataSource
	                 * @static
	                 * @param {perfetto.protos.TraceConfig.DataSource} message DataSource
	                 * @param {$protobuf.IConversionOptions} [options] Conversion options
	                 * @returns {Object.<string,*>} Plain object
	                 */
	                DataSource.toObject = function toObject(message, options) {
	                    if (!options)
	                        options = {};
	                    var object = {};
	                    if (options.arrays || options.defaults)
	                        object.producerNameFilter = [];
	                    if (options.defaults)
	                        object.config = null;
	                    if (message.config != null && message.hasOwnProperty("config"))
	                        object.config = $root.perfetto.protos.DataSourceConfig.toObject(message.config, options);
	                    if (message.producerNameFilter && message.producerNameFilter.length) {
	                        object.producerNameFilter = [];
	                        for (var j = 0; j < message.producerNameFilter.length; ++j)
	                            object.producerNameFilter[j] = message.producerNameFilter[j];
	                    }
	                    return object;
	                };

	                /**
	                 * Converts this DataSource to JSON.
	                 * @function toJSON
	                 * @memberof perfetto.protos.TraceConfig.DataSource
	                 * @instance
	                 * @returns {Object.<string,*>} JSON object
	                 */
	                DataSource.prototype.toJSON = function toJSON() {
	                    return this.constructor.toObject(this, minimal$1.util.toJSONOptions);
	                };

	                return DataSource;
	            })();

	            /**
	             * LockdownModeOperation enum.
	             * @name perfetto.protos.TraceConfig.LockdownModeOperation
	             * @enum {string}
	             * @property {number} LOCKDOWN_UNCHANGED=0 LOCKDOWN_UNCHANGED value
	             * @property {number} LOCKDOWN_CLEAR=1 LOCKDOWN_CLEAR value
	             * @property {number} LOCKDOWN_SET=2 LOCKDOWN_SET value
	             */
	            TraceConfig.LockdownModeOperation = (function() {
	                var valuesById = {}, values = Object.create(valuesById);
	                values[valuesById[0] = "LOCKDOWN_UNCHANGED"] = 0;
	                values[valuesById[1] = "LOCKDOWN_CLEAR"] = 1;
	                values[valuesById[2] = "LOCKDOWN_SET"] = 2;
	                return values;
	            })();

	            TraceConfig.ProducerConfig = (function() {

	                /**
	                 * Properties of a ProducerConfig.
	                 * @memberof perfetto.protos.TraceConfig
	                 * @interface IProducerConfig
	                 * @property {string|null} [producerName] ProducerConfig producerName
	                 * @property {number|null} [shmSizeKb] ProducerConfig shmSizeKb
	                 * @property {number|null} [pageSizeKb] ProducerConfig pageSizeKb
	                 */

	                /**
	                 * Constructs a new ProducerConfig.
	                 * @memberof perfetto.protos.TraceConfig
	                 * @classdesc Represents a ProducerConfig.
	                 * @implements IProducerConfig
	                 * @constructor
	                 * @param {perfetto.protos.TraceConfig.IProducerConfig=} [properties] Properties to set
	                 */
	                function ProducerConfig(properties) {
	                    if (properties)
	                        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
	                            if (properties[keys[i]] != null)
	                                this[keys[i]] = properties[keys[i]];
	                }

	                /**
	                 * ProducerConfig producerName.
	                 * @member {string} producerName
	                 * @memberof perfetto.protos.TraceConfig.ProducerConfig
	                 * @instance
	                 */
	                ProducerConfig.prototype.producerName = "";

	                /**
	                 * ProducerConfig shmSizeKb.
	                 * @member {number} shmSizeKb
	                 * @memberof perfetto.protos.TraceConfig.ProducerConfig
	                 * @instance
	                 */
	                ProducerConfig.prototype.shmSizeKb = 0;

	                /**
	                 * ProducerConfig pageSizeKb.
	                 * @member {number} pageSizeKb
	                 * @memberof perfetto.protos.TraceConfig.ProducerConfig
	                 * @instance
	                 */
	                ProducerConfig.prototype.pageSizeKb = 0;

	                /**
	                 * Creates a new ProducerConfig instance using the specified properties.
	                 * @function create
	                 * @memberof perfetto.protos.TraceConfig.ProducerConfig
	                 * @static
	                 * @param {perfetto.protos.TraceConfig.IProducerConfig=} [properties] Properties to set
	                 * @returns {perfetto.protos.TraceConfig.ProducerConfig} ProducerConfig instance
	                 */
	                ProducerConfig.create = function create(properties) {
	                    return new ProducerConfig(properties);
	                };

	                /**
	                 * Encodes the specified ProducerConfig message. Does not implicitly {@link perfetto.protos.TraceConfig.ProducerConfig.verify|verify} messages.
	                 * @function encode
	                 * @memberof perfetto.protos.TraceConfig.ProducerConfig
	                 * @static
	                 * @param {perfetto.protos.TraceConfig.IProducerConfig} message ProducerConfig message or plain object to encode
	                 * @param {$protobuf.Writer} [writer] Writer to encode to
	                 * @returns {$protobuf.Writer} Writer
	                 */
	                ProducerConfig.encode = function encode(message, writer) {
	                    if (!writer)
	                        writer = $Writer.create();
	                    if (message.producerName != null && message.hasOwnProperty("producerName"))
	                        writer.uint32(/* id 1, wireType 2 =*/10).string(message.producerName);
	                    if (message.shmSizeKb != null && message.hasOwnProperty("shmSizeKb"))
	                        writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.shmSizeKb);
	                    if (message.pageSizeKb != null && message.hasOwnProperty("pageSizeKb"))
	                        writer.uint32(/* id 3, wireType 0 =*/24).uint32(message.pageSizeKb);
	                    return writer;
	                };

	                /**
	                 * Encodes the specified ProducerConfig message, length delimited. Does not implicitly {@link perfetto.protos.TraceConfig.ProducerConfig.verify|verify} messages.
	                 * @function encodeDelimited
	                 * @memberof perfetto.protos.TraceConfig.ProducerConfig
	                 * @static
	                 * @param {perfetto.protos.TraceConfig.IProducerConfig} message ProducerConfig message or plain object to encode
	                 * @param {$protobuf.Writer} [writer] Writer to encode to
	                 * @returns {$protobuf.Writer} Writer
	                 */
	                ProducerConfig.encodeDelimited = function encodeDelimited(message, writer) {
	                    return this.encode(message, writer).ldelim();
	                };

	                /**
	                 * Decodes a ProducerConfig message from the specified reader or buffer.
	                 * @function decode
	                 * @memberof perfetto.protos.TraceConfig.ProducerConfig
	                 * @static
	                 * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
	                 * @param {number} [length] Message length if known beforehand
	                 * @returns {perfetto.protos.TraceConfig.ProducerConfig} ProducerConfig
	                 * @throws {Error} If the payload is not a reader or valid buffer
	                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
	                 */
	                ProducerConfig.decode = function decode(reader, length) {
	                    if (!(reader instanceof $Reader))
	                        reader = $Reader.create(reader);
	                    var end = length === undefined ? reader.len : reader.pos + length, message = new $root.perfetto.protos.TraceConfig.ProducerConfig();
	                    while (reader.pos < end) {
	                        var tag = reader.uint32();
	                        switch (tag >>> 3) {
	                        case 1:
	                            message.producerName = reader.string();
	                            break;
	                        case 2:
	                            message.shmSizeKb = reader.uint32();
	                            break;
	                        case 3:
	                            message.pageSizeKb = reader.uint32();
	                            break;
	                        default:
	                            reader.skipType(tag & 7);
	                            break;
	                        }
	                    }
	                    return message;
	                };

	                /**
	                 * Decodes a ProducerConfig message from the specified reader or buffer, length delimited.
	                 * @function decodeDelimited
	                 * @memberof perfetto.protos.TraceConfig.ProducerConfig
	                 * @static
	                 * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
	                 * @returns {perfetto.protos.TraceConfig.ProducerConfig} ProducerConfig
	                 * @throws {Error} If the payload is not a reader or valid buffer
	                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
	                 */
	                ProducerConfig.decodeDelimited = function decodeDelimited(reader) {
	                    if (!(reader instanceof $Reader))
	                        reader = new $Reader(reader);
	                    return this.decode(reader, reader.uint32());
	                };

	                /**
	                 * Verifies a ProducerConfig message.
	                 * @function verify
	                 * @memberof perfetto.protos.TraceConfig.ProducerConfig
	                 * @static
	                 * @param {Object.<string,*>} message Plain object to verify
	                 * @returns {string|null} `null` if valid, otherwise the reason why it is not
	                 */
	                ProducerConfig.verify = function verify(message) {
	                    if (typeof message !== "object" || message === null)
	                        return "object expected";
	                    if (message.producerName != null && message.hasOwnProperty("producerName"))
	                        if (!$util.isString(message.producerName))
	                            return "producerName: string expected";
	                    if (message.shmSizeKb != null && message.hasOwnProperty("shmSizeKb"))
	                        if (!$util.isInteger(message.shmSizeKb))
	                            return "shmSizeKb: integer expected";
	                    if (message.pageSizeKb != null && message.hasOwnProperty("pageSizeKb"))
	                        if (!$util.isInteger(message.pageSizeKb))
	                            return "pageSizeKb: integer expected";
	                    return null;
	                };

	                /**
	                 * Creates a ProducerConfig message from a plain object. Also converts values to their respective internal types.
	                 * @function fromObject
	                 * @memberof perfetto.protos.TraceConfig.ProducerConfig
	                 * @static
	                 * @param {Object.<string,*>} object Plain object
	                 * @returns {perfetto.protos.TraceConfig.ProducerConfig} ProducerConfig
	                 */
	                ProducerConfig.fromObject = function fromObject(object) {
	                    if (object instanceof $root.perfetto.protos.TraceConfig.ProducerConfig)
	                        return object;
	                    var message = new $root.perfetto.protos.TraceConfig.ProducerConfig();
	                    if (object.producerName != null)
	                        message.producerName = String(object.producerName);
	                    if (object.shmSizeKb != null)
	                        message.shmSizeKb = object.shmSizeKb >>> 0;
	                    if (object.pageSizeKb != null)
	                        message.pageSizeKb = object.pageSizeKb >>> 0;
	                    return message;
	                };

	                /**
	                 * Creates a plain object from a ProducerConfig message. Also converts values to other types if specified.
	                 * @function toObject
	                 * @memberof perfetto.protos.TraceConfig.ProducerConfig
	                 * @static
	                 * @param {perfetto.protos.TraceConfig.ProducerConfig} message ProducerConfig
	                 * @param {$protobuf.IConversionOptions} [options] Conversion options
	                 * @returns {Object.<string,*>} Plain object
	                 */
	                ProducerConfig.toObject = function toObject(message, options) {
	                    if (!options)
	                        options = {};
	                    var object = {};
	                    if (options.defaults) {
	                        object.producerName = "";
	                        object.shmSizeKb = 0;
	                        object.pageSizeKb = 0;
	                    }
	                    if (message.producerName != null && message.hasOwnProperty("producerName"))
	                        object.producerName = message.producerName;
	                    if (message.shmSizeKb != null && message.hasOwnProperty("shmSizeKb"))
	                        object.shmSizeKb = message.shmSizeKb;
	                    if (message.pageSizeKb != null && message.hasOwnProperty("pageSizeKb"))
	                        object.pageSizeKb = message.pageSizeKb;
	                    return object;
	                };

	                /**
	                 * Converts this ProducerConfig to JSON.
	                 * @function toJSON
	                 * @memberof perfetto.protos.TraceConfig.ProducerConfig
	                 * @instance
	                 * @returns {Object.<string,*>} JSON object
	                 */
	                ProducerConfig.prototype.toJSON = function toJSON() {
	                    return this.constructor.toObject(this, minimal$1.util.toJSONOptions);
	                };

	                return ProducerConfig;
	            })();

	            TraceConfig.StatsdMetadata = (function() {

	                /**
	                 * Properties of a StatsdMetadata.
	                 * @memberof perfetto.protos.TraceConfig
	                 * @interface IStatsdMetadata
	                 * @property {number|Long|null} [triggeringAlertId] StatsdMetadata triggeringAlertId
	                 * @property {number|null} [triggeringConfigUid] StatsdMetadata triggeringConfigUid
	                 * @property {number|Long|null} [triggeringConfigId] StatsdMetadata triggeringConfigId
	                 */

	                /**
	                 * Constructs a new StatsdMetadata.
	                 * @memberof perfetto.protos.TraceConfig
	                 * @classdesc Represents a StatsdMetadata.
	                 * @implements IStatsdMetadata
	                 * @constructor
	                 * @param {perfetto.protos.TraceConfig.IStatsdMetadata=} [properties] Properties to set
	                 */
	                function StatsdMetadata(properties) {
	                    if (properties)
	                        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
	                            if (properties[keys[i]] != null)
	                                this[keys[i]] = properties[keys[i]];
	                }

	                /**
	                 * StatsdMetadata triggeringAlertId.
	                 * @member {number|Long} triggeringAlertId
	                 * @memberof perfetto.protos.TraceConfig.StatsdMetadata
	                 * @instance
	                 */
	                StatsdMetadata.prototype.triggeringAlertId = $util.Long ? $util.Long.fromBits(0,0,false) : 0;

	                /**
	                 * StatsdMetadata triggeringConfigUid.
	                 * @member {number} triggeringConfigUid
	                 * @memberof perfetto.protos.TraceConfig.StatsdMetadata
	                 * @instance
	                 */
	                StatsdMetadata.prototype.triggeringConfigUid = 0;

	                /**
	                 * StatsdMetadata triggeringConfigId.
	                 * @member {number|Long} triggeringConfigId
	                 * @memberof perfetto.protos.TraceConfig.StatsdMetadata
	                 * @instance
	                 */
	                StatsdMetadata.prototype.triggeringConfigId = $util.Long ? $util.Long.fromBits(0,0,false) : 0;

	                /**
	                 * Creates a new StatsdMetadata instance using the specified properties.
	                 * @function create
	                 * @memberof perfetto.protos.TraceConfig.StatsdMetadata
	                 * @static
	                 * @param {perfetto.protos.TraceConfig.IStatsdMetadata=} [properties] Properties to set
	                 * @returns {perfetto.protos.TraceConfig.StatsdMetadata} StatsdMetadata instance
	                 */
	                StatsdMetadata.create = function create(properties) {
	                    return new StatsdMetadata(properties);
	                };

	                /**
	                 * Encodes the specified StatsdMetadata message. Does not implicitly {@link perfetto.protos.TraceConfig.StatsdMetadata.verify|verify} messages.
	                 * @function encode
	                 * @memberof perfetto.protos.TraceConfig.StatsdMetadata
	                 * @static
	                 * @param {perfetto.protos.TraceConfig.IStatsdMetadata} message StatsdMetadata message or plain object to encode
	                 * @param {$protobuf.Writer} [writer] Writer to encode to
	                 * @returns {$protobuf.Writer} Writer
	                 */
	                StatsdMetadata.encode = function encode(message, writer) {
	                    if (!writer)
	                        writer = $Writer.create();
	                    if (message.triggeringAlertId != null && message.hasOwnProperty("triggeringAlertId"))
	                        writer.uint32(/* id 1, wireType 0 =*/8).int64(message.triggeringAlertId);
	                    if (message.triggeringConfigUid != null && message.hasOwnProperty("triggeringConfigUid"))
	                        writer.uint32(/* id 2, wireType 0 =*/16).int32(message.triggeringConfigUid);
	                    if (message.triggeringConfigId != null && message.hasOwnProperty("triggeringConfigId"))
	                        writer.uint32(/* id 3, wireType 0 =*/24).int64(message.triggeringConfigId);
	                    return writer;
	                };

	                /**
	                 * Encodes the specified StatsdMetadata message, length delimited. Does not implicitly {@link perfetto.protos.TraceConfig.StatsdMetadata.verify|verify} messages.
	                 * @function encodeDelimited
	                 * @memberof perfetto.protos.TraceConfig.StatsdMetadata
	                 * @static
	                 * @param {perfetto.protos.TraceConfig.IStatsdMetadata} message StatsdMetadata message or plain object to encode
	                 * @param {$protobuf.Writer} [writer] Writer to encode to
	                 * @returns {$protobuf.Writer} Writer
	                 */
	                StatsdMetadata.encodeDelimited = function encodeDelimited(message, writer) {
	                    return this.encode(message, writer).ldelim();
	                };

	                /**
	                 * Decodes a StatsdMetadata message from the specified reader or buffer.
	                 * @function decode
	                 * @memberof perfetto.protos.TraceConfig.StatsdMetadata
	                 * @static
	                 * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
	                 * @param {number} [length] Message length if known beforehand
	                 * @returns {perfetto.protos.TraceConfig.StatsdMetadata} StatsdMetadata
	                 * @throws {Error} If the payload is not a reader or valid buffer
	                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
	                 */
	                StatsdMetadata.decode = function decode(reader, length) {
	                    if (!(reader instanceof $Reader))
	                        reader = $Reader.create(reader);
	                    var end = length === undefined ? reader.len : reader.pos + length, message = new $root.perfetto.protos.TraceConfig.StatsdMetadata();
	                    while (reader.pos < end) {
	                        var tag = reader.uint32();
	                        switch (tag >>> 3) {
	                        case 1:
	                            message.triggeringAlertId = reader.int64();
	                            break;
	                        case 2:
	                            message.triggeringConfigUid = reader.int32();
	                            break;
	                        case 3:
	                            message.triggeringConfigId = reader.int64();
	                            break;
	                        default:
	                            reader.skipType(tag & 7);
	                            break;
	                        }
	                    }
	                    return message;
	                };

	                /**
	                 * Decodes a StatsdMetadata message from the specified reader or buffer, length delimited.
	                 * @function decodeDelimited
	                 * @memberof perfetto.protos.TraceConfig.StatsdMetadata
	                 * @static
	                 * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
	                 * @returns {perfetto.protos.TraceConfig.StatsdMetadata} StatsdMetadata
	                 * @throws {Error} If the payload is not a reader or valid buffer
	                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
	                 */
	                StatsdMetadata.decodeDelimited = function decodeDelimited(reader) {
	                    if (!(reader instanceof $Reader))
	                        reader = new $Reader(reader);
	                    return this.decode(reader, reader.uint32());
	                };

	                /**
	                 * Verifies a StatsdMetadata message.
	                 * @function verify
	                 * @memberof perfetto.protos.TraceConfig.StatsdMetadata
	                 * @static
	                 * @param {Object.<string,*>} message Plain object to verify
	                 * @returns {string|null} `null` if valid, otherwise the reason why it is not
	                 */
	                StatsdMetadata.verify = function verify(message) {
	                    if (typeof message !== "object" || message === null)
	                        return "object expected";
	                    if (message.triggeringAlertId != null && message.hasOwnProperty("triggeringAlertId"))
	                        if (!$util.isInteger(message.triggeringAlertId) && !(message.triggeringAlertId && $util.isInteger(message.triggeringAlertId.low) && $util.isInteger(message.triggeringAlertId.high)))
	                            return "triggeringAlertId: integer|Long expected";
	                    if (message.triggeringConfigUid != null && message.hasOwnProperty("triggeringConfigUid"))
	                        if (!$util.isInteger(message.triggeringConfigUid))
	                            return "triggeringConfigUid: integer expected";
	                    if (message.triggeringConfigId != null && message.hasOwnProperty("triggeringConfigId"))
	                        if (!$util.isInteger(message.triggeringConfigId) && !(message.triggeringConfigId && $util.isInteger(message.triggeringConfigId.low) && $util.isInteger(message.triggeringConfigId.high)))
	                            return "triggeringConfigId: integer|Long expected";
	                    return null;
	                };

	                /**
	                 * Creates a StatsdMetadata message from a plain object. Also converts values to their respective internal types.
	                 * @function fromObject
	                 * @memberof perfetto.protos.TraceConfig.StatsdMetadata
	                 * @static
	                 * @param {Object.<string,*>} object Plain object
	                 * @returns {perfetto.protos.TraceConfig.StatsdMetadata} StatsdMetadata
	                 */
	                StatsdMetadata.fromObject = function fromObject(object) {
	                    if (object instanceof $root.perfetto.protos.TraceConfig.StatsdMetadata)
	                        return object;
	                    var message = new $root.perfetto.protos.TraceConfig.StatsdMetadata();
	                    if (object.triggeringAlertId != null)
	                        if ($util.Long)
	                            (message.triggeringAlertId = $util.Long.fromValue(object.triggeringAlertId)).unsigned = false;
	                        else if (typeof object.triggeringAlertId === "string")
	                            message.triggeringAlertId = parseInt(object.triggeringAlertId, 10);
	                        else if (typeof object.triggeringAlertId === "number")
	                            message.triggeringAlertId = object.triggeringAlertId;
	                        else if (typeof object.triggeringAlertId === "object")
	                            message.triggeringAlertId = new $util.LongBits(object.triggeringAlertId.low >>> 0, object.triggeringAlertId.high >>> 0).toNumber();
	                    if (object.triggeringConfigUid != null)
	                        message.triggeringConfigUid = object.triggeringConfigUid | 0;
	                    if (object.triggeringConfigId != null)
	                        if ($util.Long)
	                            (message.triggeringConfigId = $util.Long.fromValue(object.triggeringConfigId)).unsigned = false;
	                        else if (typeof object.triggeringConfigId === "string")
	                            message.triggeringConfigId = parseInt(object.triggeringConfigId, 10);
	                        else if (typeof object.triggeringConfigId === "number")
	                            message.triggeringConfigId = object.triggeringConfigId;
	                        else if (typeof object.triggeringConfigId === "object")
	                            message.triggeringConfigId = new $util.LongBits(object.triggeringConfigId.low >>> 0, object.triggeringConfigId.high >>> 0).toNumber();
	                    return message;
	                };

	                /**
	                 * Creates a plain object from a StatsdMetadata message. Also converts values to other types if specified.
	                 * @function toObject
	                 * @memberof perfetto.protos.TraceConfig.StatsdMetadata
	                 * @static
	                 * @param {perfetto.protos.TraceConfig.StatsdMetadata} message StatsdMetadata
	                 * @param {$protobuf.IConversionOptions} [options] Conversion options
	                 * @returns {Object.<string,*>} Plain object
	                 */
	                StatsdMetadata.toObject = function toObject(message, options) {
	                    if (!options)
	                        options = {};
	                    var object = {};
	                    if (options.defaults) {
	                        if ($util.Long) {
	                            var long = new $util.Long(0, 0, false);
	                            object.triggeringAlertId = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
	                        } else
	                            object.triggeringAlertId = options.longs === String ? "0" : 0;
	                        object.triggeringConfigUid = 0;
	                        if ($util.Long) {
	                            var long = new $util.Long(0, 0, false);
	                            object.triggeringConfigId = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
	                        } else
	                            object.triggeringConfigId = options.longs === String ? "0" : 0;
	                    }
	                    if (message.triggeringAlertId != null && message.hasOwnProperty("triggeringAlertId"))
	                        if (typeof message.triggeringAlertId === "number")
	                            object.triggeringAlertId = options.longs === String ? String(message.triggeringAlertId) : message.triggeringAlertId;
	                        else
	                            object.triggeringAlertId = options.longs === String ? $util.Long.prototype.toString.call(message.triggeringAlertId) : options.longs === Number ? new $util.LongBits(message.triggeringAlertId.low >>> 0, message.triggeringAlertId.high >>> 0).toNumber() : message.triggeringAlertId;
	                    if (message.triggeringConfigUid != null && message.hasOwnProperty("triggeringConfigUid"))
	                        object.triggeringConfigUid = message.triggeringConfigUid;
	                    if (message.triggeringConfigId != null && message.hasOwnProperty("triggeringConfigId"))
	                        if (typeof message.triggeringConfigId === "number")
	                            object.triggeringConfigId = options.longs === String ? String(message.triggeringConfigId) : message.triggeringConfigId;
	                        else
	                            object.triggeringConfigId = options.longs === String ? $util.Long.prototype.toString.call(message.triggeringConfigId) : options.longs === Number ? new $util.LongBits(message.triggeringConfigId.low >>> 0, message.triggeringConfigId.high >>> 0).toNumber() : message.triggeringConfigId;
	                    return object;
	                };

	                /**
	                 * Converts this StatsdMetadata to JSON.
	                 * @function toJSON
	                 * @memberof perfetto.protos.TraceConfig.StatsdMetadata
	                 * @instance
	                 * @returns {Object.<string,*>} JSON object
	                 */
	                StatsdMetadata.prototype.toJSON = function toJSON() {
	                    return this.constructor.toObject(this, minimal$1.util.toJSONOptions);
	                };

	                return StatsdMetadata;
	            })();

	            TraceConfig.GuardrailOverrides = (function() {

	                /**
	                 * Properties of a GuardrailOverrides.
	                 * @memberof perfetto.protos.TraceConfig
	                 * @interface IGuardrailOverrides
	                 * @property {number|Long|null} [maxUploadPerDayBytes] GuardrailOverrides maxUploadPerDayBytes
	                 */

	                /**
	                 * Constructs a new GuardrailOverrides.
	                 * @memberof perfetto.protos.TraceConfig
	                 * @classdesc Represents a GuardrailOverrides.
	                 * @implements IGuardrailOverrides
	                 * @constructor
	                 * @param {perfetto.protos.TraceConfig.IGuardrailOverrides=} [properties] Properties to set
	                 */
	                function GuardrailOverrides(properties) {
	                    if (properties)
	                        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
	                            if (properties[keys[i]] != null)
	                                this[keys[i]] = properties[keys[i]];
	                }

	                /**
	                 * GuardrailOverrides maxUploadPerDayBytes.
	                 * @member {number|Long} maxUploadPerDayBytes
	                 * @memberof perfetto.protos.TraceConfig.GuardrailOverrides
	                 * @instance
	                 */
	                GuardrailOverrides.prototype.maxUploadPerDayBytes = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

	                /**
	                 * Creates a new GuardrailOverrides instance using the specified properties.
	                 * @function create
	                 * @memberof perfetto.protos.TraceConfig.GuardrailOverrides
	                 * @static
	                 * @param {perfetto.protos.TraceConfig.IGuardrailOverrides=} [properties] Properties to set
	                 * @returns {perfetto.protos.TraceConfig.GuardrailOverrides} GuardrailOverrides instance
	                 */
	                GuardrailOverrides.create = function create(properties) {
	                    return new GuardrailOverrides(properties);
	                };

	                /**
	                 * Encodes the specified GuardrailOverrides message. Does not implicitly {@link perfetto.protos.TraceConfig.GuardrailOverrides.verify|verify} messages.
	                 * @function encode
	                 * @memberof perfetto.protos.TraceConfig.GuardrailOverrides
	                 * @static
	                 * @param {perfetto.protos.TraceConfig.IGuardrailOverrides} message GuardrailOverrides message or plain object to encode
	                 * @param {$protobuf.Writer} [writer] Writer to encode to
	                 * @returns {$protobuf.Writer} Writer
	                 */
	                GuardrailOverrides.encode = function encode(message, writer) {
	                    if (!writer)
	                        writer = $Writer.create();
	                    if (message.maxUploadPerDayBytes != null && message.hasOwnProperty("maxUploadPerDayBytes"))
	                        writer.uint32(/* id 1, wireType 0 =*/8).uint64(message.maxUploadPerDayBytes);
	                    return writer;
	                };

	                /**
	                 * Encodes the specified GuardrailOverrides message, length delimited. Does not implicitly {@link perfetto.protos.TraceConfig.GuardrailOverrides.verify|verify} messages.
	                 * @function encodeDelimited
	                 * @memberof perfetto.protos.TraceConfig.GuardrailOverrides
	                 * @static
	                 * @param {perfetto.protos.TraceConfig.IGuardrailOverrides} message GuardrailOverrides message or plain object to encode
	                 * @param {$protobuf.Writer} [writer] Writer to encode to
	                 * @returns {$protobuf.Writer} Writer
	                 */
	                GuardrailOverrides.encodeDelimited = function encodeDelimited(message, writer) {
	                    return this.encode(message, writer).ldelim();
	                };

	                /**
	                 * Decodes a GuardrailOverrides message from the specified reader or buffer.
	                 * @function decode
	                 * @memberof perfetto.protos.TraceConfig.GuardrailOverrides
	                 * @static
	                 * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
	                 * @param {number} [length] Message length if known beforehand
	                 * @returns {perfetto.protos.TraceConfig.GuardrailOverrides} GuardrailOverrides
	                 * @throws {Error} If the payload is not a reader or valid buffer
	                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
	                 */
	                GuardrailOverrides.decode = function decode(reader, length) {
	                    if (!(reader instanceof $Reader))
	                        reader = $Reader.create(reader);
	                    var end = length === undefined ? reader.len : reader.pos + length, message = new $root.perfetto.protos.TraceConfig.GuardrailOverrides();
	                    while (reader.pos < end) {
	                        var tag = reader.uint32();
	                        switch (tag >>> 3) {
	                        case 1:
	                            message.maxUploadPerDayBytes = reader.uint64();
	                            break;
	                        default:
	                            reader.skipType(tag & 7);
	                            break;
	                        }
	                    }
	                    return message;
	                };

	                /**
	                 * Decodes a GuardrailOverrides message from the specified reader or buffer, length delimited.
	                 * @function decodeDelimited
	                 * @memberof perfetto.protos.TraceConfig.GuardrailOverrides
	                 * @static
	                 * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
	                 * @returns {perfetto.protos.TraceConfig.GuardrailOverrides} GuardrailOverrides
	                 * @throws {Error} If the payload is not a reader or valid buffer
	                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
	                 */
	                GuardrailOverrides.decodeDelimited = function decodeDelimited(reader) {
	                    if (!(reader instanceof $Reader))
	                        reader = new $Reader(reader);
	                    return this.decode(reader, reader.uint32());
	                };

	                /**
	                 * Verifies a GuardrailOverrides message.
	                 * @function verify
	                 * @memberof perfetto.protos.TraceConfig.GuardrailOverrides
	                 * @static
	                 * @param {Object.<string,*>} message Plain object to verify
	                 * @returns {string|null} `null` if valid, otherwise the reason why it is not
	                 */
	                GuardrailOverrides.verify = function verify(message) {
	                    if (typeof message !== "object" || message === null)
	                        return "object expected";
	                    if (message.maxUploadPerDayBytes != null && message.hasOwnProperty("maxUploadPerDayBytes"))
	                        if (!$util.isInteger(message.maxUploadPerDayBytes) && !(message.maxUploadPerDayBytes && $util.isInteger(message.maxUploadPerDayBytes.low) && $util.isInteger(message.maxUploadPerDayBytes.high)))
	                            return "maxUploadPerDayBytes: integer|Long expected";
	                    return null;
	                };

	                /**
	                 * Creates a GuardrailOverrides message from a plain object. Also converts values to their respective internal types.
	                 * @function fromObject
	                 * @memberof perfetto.protos.TraceConfig.GuardrailOverrides
	                 * @static
	                 * @param {Object.<string,*>} object Plain object
	                 * @returns {perfetto.protos.TraceConfig.GuardrailOverrides} GuardrailOverrides
	                 */
	                GuardrailOverrides.fromObject = function fromObject(object) {
	                    if (object instanceof $root.perfetto.protos.TraceConfig.GuardrailOverrides)
	                        return object;
	                    var message = new $root.perfetto.protos.TraceConfig.GuardrailOverrides();
	                    if (object.maxUploadPerDayBytes != null)
	                        if ($util.Long)
	                            (message.maxUploadPerDayBytes = $util.Long.fromValue(object.maxUploadPerDayBytes)).unsigned = true;
	                        else if (typeof object.maxUploadPerDayBytes === "string")
	                            message.maxUploadPerDayBytes = parseInt(object.maxUploadPerDayBytes, 10);
	                        else if (typeof object.maxUploadPerDayBytes === "number")
	                            message.maxUploadPerDayBytes = object.maxUploadPerDayBytes;
	                        else if (typeof object.maxUploadPerDayBytes === "object")
	                            message.maxUploadPerDayBytes = new $util.LongBits(object.maxUploadPerDayBytes.low >>> 0, object.maxUploadPerDayBytes.high >>> 0).toNumber(true);
	                    return message;
	                };

	                /**
	                 * Creates a plain object from a GuardrailOverrides message. Also converts values to other types if specified.
	                 * @function toObject
	                 * @memberof perfetto.protos.TraceConfig.GuardrailOverrides
	                 * @static
	                 * @param {perfetto.protos.TraceConfig.GuardrailOverrides} message GuardrailOverrides
	                 * @param {$protobuf.IConversionOptions} [options] Conversion options
	                 * @returns {Object.<string,*>} Plain object
	                 */
	                GuardrailOverrides.toObject = function toObject(message, options) {
	                    if (!options)
	                        options = {};
	                    var object = {};
	                    if (options.defaults)
	                        if ($util.Long) {
	                            var long = new $util.Long(0, 0, true);
	                            object.maxUploadPerDayBytes = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
	                        } else
	                            object.maxUploadPerDayBytes = options.longs === String ? "0" : 0;
	                    if (message.maxUploadPerDayBytes != null && message.hasOwnProperty("maxUploadPerDayBytes"))
	                        if (typeof message.maxUploadPerDayBytes === "number")
	                            object.maxUploadPerDayBytes = options.longs === String ? String(message.maxUploadPerDayBytes) : message.maxUploadPerDayBytes;
	                        else
	                            object.maxUploadPerDayBytes = options.longs === String ? $util.Long.prototype.toString.call(message.maxUploadPerDayBytes) : options.longs === Number ? new $util.LongBits(message.maxUploadPerDayBytes.low >>> 0, message.maxUploadPerDayBytes.high >>> 0).toNumber(true) : message.maxUploadPerDayBytes;
	                    return object;
	                };

	                /**
	                 * Converts this GuardrailOverrides to JSON.
	                 * @function toJSON
	                 * @memberof perfetto.protos.TraceConfig.GuardrailOverrides
	                 * @instance
	                 * @returns {Object.<string,*>} JSON object
	                 */
	                GuardrailOverrides.prototype.toJSON = function toJSON() {
	                    return this.constructor.toObject(this, minimal$1.util.toJSONOptions);
	                };

	                return GuardrailOverrides;
	            })();

	            return TraceConfig;
	        })();

	        return protos;
	    })();

	    return perfetto;
	})();

	var protos = $root;

	var protos$1 = createCommonjsModule(function (module, exports) {
	Object.defineProperty(exports, "__esModule", { value: true });

	const TraceConfig = protos.perfetto.protos.TraceConfig;
	exports.TraceConfig = TraceConfig;

	});

	unwrapExports(protos$1);
	var protos_1 = protos$1.TraceConfig;

	var backend = createCommonjsModule(function (module, exports) {
	/*
	 * Copyright (C) 2018 The Android Open Source Project
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *      http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	Object.defineProperty(exports, "__esModule", { value: true });


	let gState = state.createZeroState();
	let gTracesController = null;
	let gLargestKnownId = 0;
	function createConfig(state$$1) {
	    const ftraceEvents = [];
	    const atraceCategories = Object.keys(state$$1.atrace_categories);
	    const sizeKb = state$$1.buffer_size_kb ? state$$1.buffer_size_kb : 1024;
	    const durationMs = state$$1.trace_duration_ms ? state$$1.trace_duration_ms : 1000;
	    const writeIntoFile = !!state$$1.stream_to_host;
	    const fileWritePeriodMs = writeIntoFile ? 1000 : 0;
	    return protos$1.TraceConfig.encode({
	        buffers: [
	            {
	                sizeKb,
	                fillPolicy: protos$1.TraceConfig.BufferConfig.FillPolicy.RING_BUFFER,
	            },
	        ],
	        dataSources: [
	            {
	                config: {
	                    name: 'linux.ftrace',
	                    targetBuffer: 0,
	                    ftraceConfig: {
	                        ftraceEvents,
	                        atraceCategories,
	                    },
	                },
	            }
	        ],
	        producers: [
	            {
	                producerName: 'perfetto.traced_probes',
	                shmSizeKb: 4096,
	                pageSizeKb: 4,
	            },
	        ],
	        durationMs,
	        writeIntoFile,
	        fileWritePeriodMs,
	    }).finish();
	}
	function base64Encode(buffer) {
	    const s = [...buffer].map(c => {
	        return String.fromCharCode(c);
	    }).join('');
	    return btoa(s);
	}
	function configToCommandline(config) {
	    const s = base64Encode(createConfig(config));
	    if (config.stream_to_host) {
	        return `echo ${s} | base64 --decode > /tmp/config && \
  adb push /tmp/config /data/local/tmp/config && \
  ./buildtools/android_sdk/platform-tools/adb shell -t "cat /data/local/tmp/config | perfetto -n -c - -o /dev/tty 2>/dev/null" > /tmp/trace`;
	    }
	    else {
	        return `echo ${s} | base64 --decode | adb shell "perfetto -c - -o /data/misc/perfetto-traces/trace" && adb pull /data/misc/perfetto-traces/trace /tmp/trace`;
	    }
	}
	function computeFragmentParams(state$$1) {
	    if (state$$1.fragment === '/config') {
	        let params = {};
	        if (state$$1.config_editor.stream_to_host)
	            params['stream_to_host'] = '';
	        if (state$$1.config_editor.buffer_size_kb)
	            params['buffer_size_kb'] = state$$1.config_editor.buffer_size_kb;
	        if (state$$1.config_editor.trace_duration_ms)
	            params['trace_duration_ms'] = state$$1.config_editor.trace_duration_ms;
	        params['atrace_categories'] = Object.keys(state$$1.config_editor.atrace_categories);
	        return params;
	    }
	    return {};
	}
	function publishBackend(info) {
	    return {
	        topic: 'publish_backend',
	        info,
	    };
	}
	class TraceController {
	    constructor(id) {
	        this.id = id;
	        this.state = 'LOADING';
	        this.name = '';
	    }
	    details() {
	        return {
	            id: this.id,
	            state: this.state,
	            name: this.name,
	        };
	    }
	    setup(trace) {
	        console.log('setup');
	        this.name = trace.name || '';
	        this.state = 'LOADING';
	        gState.backends[this.id] = this.details();
	        setTimeout(() => {
	            this.state = 'READY';
	            dispatch(publishBackend(this.details()));
	        }, 1000);
	    }
	    update(state$$1) {
	        console.log('update', state$$1);
	    }
	    teardown() {
	        console.log('teardown');
	        delete gState.backends[this.id];
	    }
	}
	class TracesController {
	    constructor() {
	        this.controllers = new Map();
	    }
	    update(state$$1) {
	        for (const trace of state$$1.traces) {
	            if (this.controllers.has(trace.id))
	                continue;
	            const controller = new TraceController(trace.id);
	            this.controllers.set(trace.id, controller);
	            controller.setup(trace);
	        }
	        for (const trace of state$$1.traces) {
	            const controller = this.controllers.get(trace.id);
	            if (!controller)
	                throw 'Missing id';
	            controller.update(state$$1);
	        }
	        const ids = new Set(state$$1.traces.map(t => t.id));
	        for (const controller of this.controllers.values()) {
	            if (ids.has(controller.id))
	                continue;
	            controller.teardown();
	            this.controllers.delete(controller.id);
	        }
	    }
	}
	function dispatch(action) {
	    const any_self = self;
	    switch (action.topic) {
	        case 'init': {
	            gState = action.initial_state;
	            break;
	        }
	        case 'navigate':
	            gState.fragment = action.fragment;
	            break;
	        case 'set_buffer_size': {
	            const config = gState.config_editor;
	            const buffer_size_kb = action.buffer_size_mb * 1024;
	            config.buffer_size_kb = buffer_size_kb;
	            break;
	        }
	        case 'set_trace_duration': {
	            const config = gState.config_editor;
	            const duration_ms = action.duration_s * 1000;
	            config.trace_duration_ms = duration_ms;
	            break;
	        }
	        case 'set_stream_to_host': {
	            const config = gState.config_editor;
	            const enabled = action.enabled;
	            config.stream_to_host = enabled;
	            break;
	        }
	        case 'publish_backend': {
	            gState.backends[action.info.id] = action.info;
	            break;
	        }
	        case 'set_category': {
	            const config = gState.config_editor;
	            const category = action.category;
	            const enabled = action.enabled;
	            if (enabled) {
	                config.atrace_categories[category] = true;
	            }
	            else {
	                delete config.atrace_categories[category];
	            }
	            break;
	        }
	        case 'load_trace_file': {
	            const file = action.file;
	            console.log('load_trace_file', file);
	            gState.traces.push({
	                name: file.name,
	                id: '' + gLargestKnownId++,
	            });
	            break;
	        }
	        default:
	            break;
	    }
	    const config = gState.config_editor;
	    gState.config_commandline = configToCommandline(config);
	    gState.fragment_params = computeFragmentParams(gState);
	    if (gTracesController)
	        gTracesController.update(gState);
	    any_self.postMessage({
	        topic: 'new_state',
	        new_state: gState,
	    });
	}
	function main() {
	    console.log('Hello from the worker!');
	    gTracesController = new TracesController();
	    const any_self = self;
	    any_self.onmessage = (m) => dispatch(m.data);
	}
	exports.main = main;

	});

	unwrapExports(backend);
	var backend_1 = backend.main;

	var worker = createCommonjsModule(function (module, exports) {
	/*
	 * Copyright (C) 2018 The Android Open Source Project
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *      http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	Object.defineProperty(exports, "__esModule", { value: true });

	backend.main();

	});

	var worker$1 = unwrapExports(worker);

	return worker$1;

}());
//# sourceMappingURL=worker_bundle.js.map
