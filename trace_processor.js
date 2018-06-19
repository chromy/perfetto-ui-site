// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module = typeof Module !== 'undefined' ? Module : {};

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)
// {{PRE_JSES}}

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
var key;
for (key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

Module['arguments'] = [];
Module['thisProgram'] = './this.program';
Module['quit'] = function(status, toThrow) {
  throw toThrow;
};
Module['preRun'] = [];
Module['postRun'] = [];

// The environment setup code below is customized to use Module.
// *** Environment setup code ***
var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;

// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() thread proxied to worker. (with Emscripten -s PROXY_TO_WORKER=1) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)

if (Module['ENVIRONMENT']) {
  if (Module['ENVIRONMENT'] === 'WEB') {
    ENVIRONMENT_IS_WEB = true;
  } else if (Module['ENVIRONMENT'] === 'WORKER') {
    ENVIRONMENT_IS_WORKER = true;
  } else if (Module['ENVIRONMENT'] === 'NODE') {
    ENVIRONMENT_IS_NODE = true;
  } else if (Module['ENVIRONMENT'] === 'SHELL') {
    ENVIRONMENT_IS_SHELL = true;
  } else {
    throw new Error('Module[\'ENVIRONMENT\'] value is not valid. must be one of: WEB|WORKER|NODE|SHELL.');
  }
} else {
  ENVIRONMENT_IS_WEB = typeof window === 'object';
  ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
  ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function' && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
  ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
}


if (ENVIRONMENT_IS_NODE) {
  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  var nodeFS;
  var nodePath;

  Module['read'] = function shell_read(filename, binary) {
    var ret;
      if (!nodeFS) nodeFS = require('fs');
      if (!nodePath) nodePath = require('path');
      filename = nodePath['normalize'](filename);
      ret = nodeFS['readFileSync'](filename);
    return binary ? ret : ret.toString();
  };

  Module['readBinary'] = function readBinary(filename) {
    var ret = Module['read'](filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    assert(ret.buffer);
    return ret;
  };

  if (process['argv'].length > 1) {
    Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
  }

  Module['arguments'] = process['argv'].slice(2);

  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });
  // Currently node will swallow unhandled rejections, but this behavior is
  // deprecated, and in the future it will exit with error status.
  process['on']('unhandledRejection', function(reason, p) {
    Module['printErr']('node.js exiting due to unhandled promise rejection');
    process['exit'](1);
  });

  Module['inspect'] = function () { return '[Emscripten Module object]'; };
}
else if (ENVIRONMENT_IS_SHELL) {
  if (typeof read != 'undefined') {
    Module['read'] = function shell_read(f) {
      return read(f);
    };
  }

  Module['readBinary'] = function readBinary(f) {
    var data;
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  if (typeof scriptArgs != 'undefined') {
    Module['arguments'] = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof quit === 'function') {
    Module['quit'] = function(status, toThrow) {
      quit(status);
    }
  }
}
else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  Module['read'] = function shell_read(url) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.send(null);
      return xhr.responseText;
  };

  if (ENVIRONMENT_IS_WORKER) {
    Module['readBinary'] = function readBinary(url) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, false);
        xhr.responseType = 'arraybuffer';
        xhr.send(null);
        return new Uint8Array(xhr.response);
    };
  }

  Module['readAsync'] = function readAsync(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function xhr_onload() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
        onload(xhr.response);
        return;
      }
      onerror();
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };

  Module['setWindowTitle'] = function(title) { document.title = title };
}
else {
  // Unreachable because SHELL is dependent on the others
  throw new Error('unknown runtime environment');
}

// console.log is checked first, as 'print' on the web will open a print dialogue
// printErr is preferable to console.warn (works better in shells)
// bind(console) is necessary to fix IE/Edge closed dev tools panel behavior.
Module['print'] = typeof console !== 'undefined' ? console.log.bind(console) : (typeof print !== 'undefined' ? print : null);
Module['printErr'] = typeof printErr !== 'undefined' ? printErr : ((typeof console !== 'undefined' && console.warn.bind(console)) || Module['print']);

// *** Environment setup code ***

// Closure helpers
Module.print = Module['print'];
Module.printErr = Module['printErr'];

// Merge back in the overrides
for (key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = undefined;



// {{PREAMBLE_ADDITIONS}}

var STACK_ALIGN = 16;

// stack management, and other functionality that is provided by the compiled code,
// should not be used before it is ready
stackSave = stackRestore = stackAlloc = setTempRet0 = getTempRet0 = function() {
  abort('cannot use the stack before compiled code is ready to run, and has provided stack access');
};

function staticAlloc(size) {
  assert(!staticSealed);
  var ret = STATICTOP;
  STATICTOP = (STATICTOP + size + 15) & -16;
  return ret;
}

function dynamicAlloc(size) {
  assert(DYNAMICTOP_PTR);
  var ret = HEAP32[DYNAMICTOP_PTR>>2];
  var end = (ret + size + 15) & -16;
  HEAP32[DYNAMICTOP_PTR>>2] = end;
  if (end >= TOTAL_MEMORY) {
    var success = enlargeMemory();
    if (!success) {
      HEAP32[DYNAMICTOP_PTR>>2] = ret;
      return 0;
    }
  }
  return ret;
}

function alignMemory(size, factor) {
  if (!factor) factor = STACK_ALIGN; // stack alignment (16-byte) by default
  var ret = size = Math.ceil(size / factor) * factor;
  return ret;
}

function getNativeTypeSize(type) {
  switch (type) {
    case 'i1': case 'i8': return 1;
    case 'i16': return 2;
    case 'i32': return 4;
    case 'i64': return 8;
    case 'float': return 4;
    case 'double': return 8;
    default: {
      if (type[type.length-1] === '*') {
        return 4; // A pointer
      } else if (type[0] === 'i') {
        var bits = parseInt(type.substr(1));
        assert(bits % 8 === 0);
        return bits / 8;
      } else {
        return 0;
      }
    }
  }
}

function warnOnce(text) {
  if (!warnOnce.shown) warnOnce.shown = {};
  if (!warnOnce.shown[text]) {
    warnOnce.shown[text] = 1;
    Module.printErr(text);
  }
}



var jsCallStartIndex = 1;
var functionPointers = new Array(32);

// 'sig' parameter is only used on LLVM wasm backend
function addFunction(func, sig) {
  if (typeof sig === 'undefined') {
    Module.printErr('Warning: addFunction: Provide a wasm function signature ' +
                    'string as a second argument');
  }
  var base = 0;
  for (var i = base; i < base + 32; i++) {
    if (!functionPointers[i]) {
      functionPointers[i] = func;
      return jsCallStartIndex + i;
    }
  }
  throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';
}

function removeFunction(index) {
  functionPointers[index-jsCallStartIndex] = null;
}

var funcWrappers = {};

function getFuncWrapper(func, sig) {
  if (!func) return; // on null pointer, return undefined
  assert(sig);
  if (!funcWrappers[sig]) {
    funcWrappers[sig] = {};
  }
  var sigCache = funcWrappers[sig];
  if (!sigCache[func]) {
    // optimize away arguments usage in common cases
    if (sig.length === 1) {
      sigCache[func] = function dynCall_wrapper() {
        return dynCall(sig, func);
      };
    } else if (sig.length === 2) {
      sigCache[func] = function dynCall_wrapper(arg) {
        return dynCall(sig, func, [arg]);
      };
    } else {
      // general case
      sigCache[func] = function dynCall_wrapper() {
        return dynCall(sig, func, Array.prototype.slice.call(arguments));
      };
    }
  }
  return sigCache[func];
}


function makeBigInt(low, high, unsigned) {
  return unsigned ? ((+((low>>>0)))+((+((high>>>0)))*4294967296.0)) : ((+((low>>>0)))+((+((high|0)))*4294967296.0));
}

function dynCall(sig, ptr, args) {
  if (args && args.length) {
    assert(args.length == sig.length-1);
    assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
    return Module['dynCall_' + sig].apply(null, [ptr].concat(args));
  } else {
    assert(sig.length == 1);
    assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
    return Module['dynCall_' + sig].call(null, ptr);
  }
}


function getCompilerSetting(name) {
  throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for getCompilerSetting or emscripten_get_compiler_setting to work';
}

var Runtime = {
  // FIXME backwards compatibility layer for ports. Support some Runtime.*
  //       for now, fix it there, then remove it from here. That way we
  //       can minimize any period of breakage.
  dynCall: dynCall, // for SDL2 port
  // helpful errors
  getTempRet0: function() { abort('getTempRet0() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
  staticAlloc: function() { abort('staticAlloc() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
  stackAlloc: function() { abort('stackAlloc() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
};

// The address globals begin at. Very low in memory, for code size and optimization opportunities.
// Above 0 is static memory, starting with globals.
// Then the stack.
// Then 'dynamic' memory for sbrk.
var GLOBAL_BASE = 1024;



// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html



//========================================
// Runtime essentials
//========================================

var ABORT = 0; // whether we are quitting the application. no code should run after this. set in exit() and abort()
var EXITSTATUS = 0;

/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

var globalScope = this;

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  assert(func, 'Cannot call unknown function ' + ident + ', make sure it is exported');
  return func;
}

var JSfuncs = {
  // Helpers for cwrap -- it can't refer to Runtime directly because it might
  // be renamed by closure, instead it calls JSfuncs['stackSave'].body to find
  // out what the minified function name is.
  'stackSave': function() {
    stackSave()
  },
  'stackRestore': function() {
    stackRestore()
  },
  // type conversion from js to c
  'arrayToC' : function(arr) {
    var ret = stackAlloc(arr.length);
    writeArrayToMemory(arr, ret);
    return ret;
  },
  'stringToC' : function(str) {
    var ret = 0;
    if (str !== null && str !== undefined && str !== 0) { // null string
      // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
      var len = (str.length << 2) + 1;
      ret = stackAlloc(len);
      stringToUTF8(str, ret, len);
    }
    return ret;
  }
};

// For fast lookup of conversion functions
var toC = {
  'string': JSfuncs['stringToC'], 'array': JSfuncs['arrayToC']
};

// C calling interface.
function ccall (ident, returnType, argTypes, args, opts) {
  var func = getCFunc(ident);
  var cArgs = [];
  var stack = 0;
  assert(returnType !== 'array', 'Return type should not be "array".');
  if (args) {
    for (var i = 0; i < args.length; i++) {
      var converter = toC[argTypes[i]];
      if (converter) {
        if (stack === 0) stack = stackSave();
        cArgs[i] = converter(args[i]);
      } else {
        cArgs[i] = args[i];
      }
    }
  }
  var ret = func.apply(null, cArgs);
  if (returnType === 'string') ret = Pointer_stringify(ret);
  else if (returnType === 'boolean') ret = Boolean(ret);
  if (stack !== 0) {
    stackRestore(stack);
  }
  return ret;
}

function cwrap (ident, returnType, argTypes) {
  argTypes = argTypes || [];
  var cfunc = getCFunc(ident);
  // When the function takes numbers and returns a number, we can just return
  // the original function
  var numericArgs = argTypes.every(function(type){ return type === 'number'});
  var numericRet = returnType !== 'string';
  if (numericRet && numericArgs) {
    return cfunc;
  }
  return function() {
    return ccall(ident, returnType, argTypes, arguments);
  }
}

/** @type {function(number, number, string, boolean=)} */
function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[((ptr)>>0)]=value; break;
      case 'i8': HEAP8[((ptr)>>0)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math_min((+(Math_floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}

/** @type {function(number, string, boolean=)} */
function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for getValue: ' + type);
    }
  return null;
}

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed
var ALLOC_DYNAMIC = 3; // Cannot be freed except through sbrk
var ALLOC_NONE = 4; // Do not allocate

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
/** @type {function((TypedArray|Array<number>|number), string, number, number=)} */
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }

  var singleType = typeof types === 'string' ? types : null;

  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [typeof _malloc === 'function' ? _malloc : staticAlloc, stackAlloc, staticAlloc, dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
  }

  if (zeroinit) {
    var stop;
    ptr = ret;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[((ptr)>>2)]=0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[((ptr++)>>0)]=0;
    }
    return ret;
  }

  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(/** @type {!Uint8Array} */ (slab), ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }

  var i = 0, type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];

    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }
    assert(type, 'Must know what type to store in allocate!');

    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

    setValue(ret+i, curr, type);

    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }

  return ret;
}

// Allocate memory during any stage of startup - static memory early on, dynamic memory later, malloc when ready
function getMemory(size) {
  if (!staticSealed) return staticAlloc(size);
  if (!runtimeInitialized) return dynamicAlloc(size);
  return _malloc(size);
}

/** @type {function(number, number=)} */
function Pointer_stringify(ptr, length) {
  if (length === 0 || !ptr) return '';
  // TODO: use TextDecoder
  // Find the length, and check for UTF while doing so
  var hasUtf = 0;
  var t;
  var i = 0;
  while (1) {
    assert(ptr + i < TOTAL_MEMORY);
    t = HEAPU8[(((ptr)+(i))>>0)];
    hasUtf |= t;
    if (t == 0 && !length) break;
    i++;
    if (length && i == length) break;
  }
  if (!length) length = i;

  var ret = '';

  if (hasUtf < 128) {
    var MAX_CHUNK = 1024; // split up into chunks, because .apply on a huge string can overflow the stack
    var curr;
    while (length > 0) {
      curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
      ret = ret ? ret + curr : curr;
      ptr += MAX_CHUNK;
      length -= MAX_CHUNK;
    }
    return ret;
  }
  return UTF8ToString(ptr);
}

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAP8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

var UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;
function UTF8ArrayToString(u8Array, idx) {
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  while (u8Array[endPtr]) ++endPtr;

  if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
  } else {
    var u0, u1, u2, u3, u4, u5;

    var str = '';
    while (1) {
      // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
      u0 = u8Array[idx++];
      if (!u0) return str;
      if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
      u1 = u8Array[idx++] & 63;
      if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
      u2 = u8Array[idx++] & 63;
      if ((u0 & 0xF0) == 0xE0) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        u3 = u8Array[idx++] & 63;
        if ((u0 & 0xF8) == 0xF0) {
          u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | u3;
        } else {
          u4 = u8Array[idx++] & 63;
          if ((u0 & 0xFC) == 0xF8) {
            u0 = ((u0 & 3) << 24) | (u1 << 18) | (u2 << 12) | (u3 << 6) | u4;
          } else {
            u5 = u8Array[idx++] & 63;
            u0 = ((u0 & 1) << 30) | (u1 << 24) | (u2 << 18) | (u3 << 12) | (u4 << 6) | u5;
          }
        }
      }
      if (u0 < 0x10000) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 0x10000;
        str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
      }
    }
  }
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF8ToString(ptr) {
  return UTF8ArrayToString(HEAPU8,ptr);
}

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 0xC0 | (u >> 6);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 0xE0 | (u >> 12);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x1FFFFF) {
      if (outIdx + 3 >= endIdx) break;
      outU8Array[outIdx++] = 0xF0 | (u >> 18);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x3FFFFFF) {
      if (outIdx + 4 >= endIdx) break;
      outU8Array[outIdx++] = 0xF8 | (u >> 24);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 5 >= endIdx) break;
      outU8Array[outIdx++] = 0xFC | (u >> 30);
      outU8Array[outIdx++] = 0x80 | ((u >> 24) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      ++len;
    } else if (u <= 0x7FF) {
      len += 2;
    } else if (u <= 0xFFFF) {
      len += 3;
    } else if (u <= 0x1FFFFF) {
      len += 4;
    } else if (u <= 0x3FFFFFF) {
      len += 5;
    } else {
      len += 6;
    }
  }
  return len;
}

// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

var UTF16Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;
function UTF16ToString(ptr) {
  assert(ptr % 2 == 0, 'Pointer passed to UTF16ToString must be aligned to two bytes!');
  var endPtr = ptr;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  var idx = endPtr >> 1;
  while (HEAP16[idx]) ++idx;
  endPtr = idx << 1;

  if (endPtr - ptr > 32 && UTF16Decoder) {
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  } else {
    var i = 0;

    var str = '';
    while (1) {
      var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
      if (codeUnit == 0) return str;
      ++i;
      // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
      str += String.fromCharCode(codeUnit);
    }
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 2 == 0, 'Pointer passed to stringToUTF16 must be aligned to two bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)]=codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)]=0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}

function UTF32ToString(ptr) {
  assert(ptr % 4 == 0, 'Pointer passed to UTF32ToString must be aligned to four bytes!');
  var i = 0;

  var str = '';
  while (1) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0)
      return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 4 == 0, 'Pointer passed to stringToUTF32 must be aligned to four bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)]=codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)]=0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}

// Allocate heap space for a JS string, and write it there.
// It is the responsibility of the caller to free() that memory.
function allocateUTF8(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = _malloc(size);
  if (ret) stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

// Allocate stack space for a JS string, and write it there.
function allocateUTF8OnStack(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = stackAlloc(size);
  stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

function demangle(func) {
  warnOnce('warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
  return func;
}

function demangleAll(text) {
  var regex =
    /__Z[\w\d_]+/g;
  return text.replace(regex,
    function(x) {
      var y = demangle(x);
      return x === y ? x : (x + ' [' + y + ']');
    });
}

function jsStackTrace() {
  var err = new Error();
  if (!err.stack) {
    // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
    // so try that as a special-case.
    try {
      throw new Error(0);
    } catch(e) {
      err = e;
    }
    if (!err.stack) {
      return '(no stack trace available)';
    }
  }
  return err.stack.toString();
}

function stackTrace() {
  var js = jsStackTrace();
  if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
  return demangleAll(js);
}

// Memory management

var PAGE_SIZE = 16384;
var WASM_PAGE_SIZE = 65536;
var ASMJS_PAGE_SIZE = 16777216;
var MIN_TOTAL_MEMORY = 16777216;

function alignUp(x, multiple) {
  if (x % multiple > 0) {
    x += multiple - (x % multiple);
  }
  return x;
}

var HEAP,
/** @type {ArrayBuffer} */
  buffer,
/** @type {Int8Array} */
  HEAP8,
/** @type {Uint8Array} */
  HEAPU8,
/** @type {Int16Array} */
  HEAP16,
/** @type {Uint16Array} */
  HEAPU16,
/** @type {Int32Array} */
  HEAP32,
/** @type {Uint32Array} */
  HEAPU32,
/** @type {Float32Array} */
  HEAPF32,
/** @type {Float64Array} */
  HEAPF64;

function updateGlobalBuffer(buf) {
  Module['buffer'] = buffer = buf;
}

function updateGlobalBufferViews() {
  Module['HEAP8'] = HEAP8 = new Int8Array(buffer);
  Module['HEAP16'] = HEAP16 = new Int16Array(buffer);
  Module['HEAP32'] = HEAP32 = new Int32Array(buffer);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buffer);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer);
}

var STATIC_BASE, STATICTOP, staticSealed; // static area
var STACK_BASE, STACKTOP, STACK_MAX; // stack area
var DYNAMIC_BASE, DYNAMICTOP_PTR; // dynamic area handled by sbrk

  STATIC_BASE = STATICTOP = STACK_BASE = STACKTOP = STACK_MAX = DYNAMIC_BASE = DYNAMICTOP_PTR = 0;
  staticSealed = false;


// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie() {
  assert((STACK_MAX & 3) == 0);
  HEAPU32[(STACK_MAX >> 2)-1] = 0x02135467;
  HEAPU32[(STACK_MAX >> 2)-2] = 0x89BACDFE;
}

function checkStackCookie() {
  if (HEAPU32[(STACK_MAX >> 2)-1] != 0x02135467 || HEAPU32[(STACK_MAX >> 2)-2] != 0x89BACDFE) {
    abort('Stack overflow! Stack cookie has been overwritten, expected hex dwords 0x89BACDFE and 0x02135467, but received 0x' + HEAPU32[(STACK_MAX >> 2)-2].toString(16) + ' ' + HEAPU32[(STACK_MAX >> 2)-1].toString(16));
  }
  // Also test the global address 0 for integrity. This check is not compatible with SAFE_SPLIT_MEMORY though, since that mode already tests all address 0 accesses on its own.
  if (HEAP32[0] !== 0x63736d65 /* 'emsc' */) throw 'Runtime error: The application has corrupted its heap memory area (address zero)!';
}

function abortStackOverflow(allocSize) {
  abort('Stack overflow! Attempted to allocate ' + allocSize + ' bytes on the stack, but stack has only ' + (STACK_MAX - stackSave() + allocSize) + ' bytes available!');
}

function abortOnCannotGrowMemory() {
  abort('Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + TOTAL_MEMORY + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime, or (3) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
}


function enlargeMemory() {
  abortOnCannotGrowMemory();
}


var TOTAL_STACK = Module['TOTAL_STACK'] || 5242880;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 536870912;
if (TOTAL_MEMORY < TOTAL_STACK) Module.printErr('TOTAL_MEMORY should be larger than TOTAL_STACK, was ' + TOTAL_MEMORY + '! (TOTAL_STACK=' + TOTAL_STACK + ')');

// Initialize the runtime's memory
// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
assert(typeof Int32Array !== 'undefined' && typeof Float64Array !== 'undefined' && Int32Array.prototype.subarray !== undefined && Int32Array.prototype.set !== undefined,
       'JS engine does not provide full typed array support');



// Use a provided buffer, if there is one, or else allocate a new one
if (Module['buffer']) {
  buffer = Module['buffer'];
  assert(buffer.byteLength === TOTAL_MEMORY, 'provided buffer should be ' + TOTAL_MEMORY + ' bytes, but it is ' + buffer.byteLength);
} else {
  // Use a WebAssembly memory where available
  if (typeof WebAssembly === 'object' && typeof WebAssembly.Memory === 'function') {
    assert(TOTAL_MEMORY % WASM_PAGE_SIZE === 0);
    Module['wasmMemory'] = new WebAssembly.Memory({ 'initial': TOTAL_MEMORY / WASM_PAGE_SIZE, 'maximum': TOTAL_MEMORY / WASM_PAGE_SIZE });
    buffer = Module['wasmMemory'].buffer;
  } else
  {
    buffer = new ArrayBuffer(TOTAL_MEMORY);
  }
  assert(buffer.byteLength === TOTAL_MEMORY);
  Module['buffer'] = buffer;
}
updateGlobalBufferViews();


function getTotalMemory() {
  return TOTAL_MEMORY;
}

// Endianness check (note: assumes compiler arch was little-endian)
  HEAP32[0] = 0x63736d65; /* 'emsc' */
HEAP16[1] = 0x6373;
if (HEAPU8[2] !== 0x73 || HEAPU8[3] !== 0x63) throw 'Runtime error: expected the system to be little-endian!';

function callRuntimeCallbacks(callbacks) {
  while(callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Module['dynCall_v'](func);
      } else {
        Module['dynCall_vi'](func, callback.arg);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}

var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the runtime has exited

var runtimeInitialized = false;
var runtimeExited = false;


function preRun() {
  // compatibility - merge in anything from Module['preRun'] at this time
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function ensureInitRuntime() {
  checkStackCookie();
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  checkStackCookie();
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  checkStackCookie();
  callRuntimeCallbacks(__ATEXIT__);
  runtimeExited = true;
}

function postRun() {
  checkStackCookie();
  // compatibility - merge in anything from Module['postRun'] at this time
  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}

function addOnExit(cb) {
  __ATEXIT__.unshift(cb);
}

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}

// Deprecated: This function should not be called because it is unsafe and does not provide
// a maximum length limit of how many bytes it is allowed to write. Prefer calling the
// function stringToUTF8Array() instead, which takes in a maximum length that can be used
// to be secure from out of bounds writes.
/** @deprecated */
function writeStringToMemory(string, buffer, dontAddNull) {
  warnOnce('writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!');

  var /** @type {number} */ lastChar, /** @type {number} */ end;
  if (dontAddNull) {
    // stringToUTF8Array always appends null. If we don't want to do that, remember the
    // character that existed at the location where the null will be placed, and restore
    // that after the write (below).
    end = buffer + lengthBytesUTF8(string);
    lastChar = HEAP8[end];
  }
  stringToUTF8(string, buffer, Infinity);
  if (dontAddNull) HEAP8[end] = lastChar; // Restore the value under the null character.
}

function writeArrayToMemory(array, buffer) {
  assert(array.length >= 0, 'writeArrayToMemory array must have a length (should be an array or typed array)')
  HEAP8.set(array, buffer);
}

function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    assert(str.charCodeAt(i) === str.charCodeAt(i)&0xff);
    HEAP8[((buffer++)>>0)]=str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)]=0;
}

function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
                                                       // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
                                                       // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}

assert(Math['imul'] && Math['fround'] && Math['clz32'] && Math['trunc'], 'this is a legacy browser, build with LEGACY_VM_SUPPORT');

var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_round = Math.round;
var Math_min = Math.min;
var Math_max = Math.max;
var Math_clz32 = Math.clz32;
var Math_trunc = Math.trunc;

// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// PRE_RUN_ADDITIONS (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled
var runDependencyTracking = {};

function getUniqueRunDependency(id) {
  var orig = id;
  while (1) {
    if (!runDependencyTracking[id]) return id;
    id = orig + Math.random();
  }
  return id;
}

function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval !== 'undefined') {
      // Check for missing dependencies every few seconds
      runDependencyWatcher = setInterval(function() {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            Module.printErr('still waiting on run dependencies:');
          }
          Module.printErr('dependency: ' + dep);
        }
        if (shown) {
          Module.printErr('(end of list)');
        }
      }, 10000);
    }
  } else {
    Module.printErr('warning: run dependency added without ID');
  }
}

function removeRunDependency(id) {
  runDependencies--;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    Module.printErr('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data



var memoryInitializer = null;



var /* show errors on likely calls to FS when it was not included */ FS = {
  error: function() {
    abort('Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with  -s FORCE_FILESYSTEM=1');
  },
  init: function() { FS.error() },
  createDataFile: function() { FS.error() },
  createPreloadedFile: function() { FS.error() },
  createLazyFile: function() { FS.error() },
  open: function() { FS.error() },
  mkdev: function() { FS.error() },
  registerDevice: function() { FS.error() },
  analyzePath: function() { FS.error() },
  loadFilesFromDB: function() { FS.error() },

  ErrnoError: function ErrnoError() { FS.error() },
};
Module['FS_createDataFile'] = FS.createDataFile;
Module['FS_createPreloadedFile'] = FS.createPreloadedFile;



// Prefix of data URIs emitted by SINGLE_FILE and related options.
var dataURIPrefix = 'data:application/octet-stream;base64,';

// Indicates whether filename is a base64 data URI.
function isDataURI(filename) {
  return String.prototype.startsWith ?
      filename.startsWith(dataURIPrefix) :
      filename.indexOf(dataURIPrefix) === 0;
}




function integrateWasmJS() {
  // wasm.js has several methods for creating the compiled code module here:
  //  * 'native-wasm' : use native WebAssembly support in the browser
  //  * 'interpret-s-expr': load s-expression code from a .wast and interpret
  //  * 'interpret-binary': load binary wasm and interpret
  //  * 'interpret-asm2wasm': load asm.js code, translate to wasm, and interpret
  //  * 'asmjs': no wasm, just load the asm.js code and use that (good for testing)
  // The method is set at compile time (BINARYEN_METHOD)
  // The method can be a comma-separated list, in which case, we will try the
  // options one by one. Some of them can fail gracefully, and then we can try
  // the next.

  // inputs

  var method = 'native-wasm';

  var wasmTextFile = 'trace_processor.wast';
  var wasmBinaryFile = 'trace_processor.wasm';
  var asmjsCodeFile = 'trace_processor.temp.asm.js';

  if (typeof Module['locateFile'] === 'function') {
    if (!isDataURI(wasmTextFile)) {
      wasmTextFile = Module['locateFile'](wasmTextFile);
    }
    if (!isDataURI(wasmBinaryFile)) {
      wasmBinaryFile = Module['locateFile'](wasmBinaryFile);
    }
    if (!isDataURI(asmjsCodeFile)) {
      asmjsCodeFile = Module['locateFile'](asmjsCodeFile);
    }
  }

  // utilities

  var wasmPageSize = 64*1024;

  var info = {
    'global': null,
    'env': null,
    'asm2wasm': { // special asm2wasm imports
      "f64-rem": function(x, y) {
        return x % y;
      },
      "debugger": function() {
        debugger;
      }
    },
    'parent': Module // Module inside wasm-js.cpp refers to wasm-js.cpp; this allows access to the outside program.
  };

  var exports = null;


  function mergeMemory(newBuffer) {
    // The wasm instance creates its memory. But static init code might have written to
    // buffer already, including the mem init file, and we must copy it over in a proper merge.
    // TODO: avoid this copy, by avoiding such static init writes
    // TODO: in shorter term, just copy up to the last static init write
    var oldBuffer = Module['buffer'];
    if (newBuffer.byteLength < oldBuffer.byteLength) {
      Module['printErr']('the new buffer in mergeMemory is smaller than the previous one. in native wasm, we should grow memory here');
    }
    var oldView = new Int8Array(oldBuffer);
    var newView = new Int8Array(newBuffer);


    newView.set(oldView);
    updateGlobalBuffer(newBuffer);
    updateGlobalBufferViews();
  }

  function fixImports(imports) {
    return imports;
  }

  function getBinary() {
    try {
      if (Module['wasmBinary']) {
        return new Uint8Array(Module['wasmBinary']);
      }
      if (Module['readBinary']) {
        return Module['readBinary'](wasmBinaryFile);
      } else {
        throw "on the web, we need the wasm binary to be preloaded and set on Module['wasmBinary']. emcc.py will do that for you when generating HTML (but not JS)";
      }
    }
    catch (err) {
      abort(err);
    }
  }

  function getBinaryPromise() {
    // if we don't have the binary yet, and have the Fetch api, use that
    // in some environments, like Electron's render process, Fetch api may be present, but have a different context than expected, let's only use it on the Web
    if (!Module['wasmBinary'] && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && typeof fetch === 'function') {
      return fetch(wasmBinaryFile, { credentials: 'same-origin' }).then(function(response) {
        if (!response['ok']) {
          throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
        }
        return response['arrayBuffer']();
      }).catch(function () {
        return getBinary();
      });
    }
    // Otherwise, getBinary should be able to get it synchronously
    return new Promise(function(resolve, reject) {
      resolve(getBinary());
    });
  }

  // do-method functions


  function doNativeWasm(global, env, providedBuffer) {
    if (typeof WebAssembly !== 'object') {
      Module['printErr']('no native wasm support detected');
      return false;
    }
    // prepare memory import
    if (!(Module['wasmMemory'] instanceof WebAssembly.Memory)) {
      Module['printErr']('no native wasm Memory in use');
      return false;
    }
    env['memory'] = Module['wasmMemory'];
    // Load the wasm module and create an instance of using native support in the JS engine.
    info['global'] = {
      'NaN': NaN,
      'Infinity': Infinity
    };
    info['global.Math'] = Math;
    info['env'] = env;
    // handle a generated wasm instance, receiving its exports and
    // performing other necessary setup
    function receiveInstance(instance, module) {
      exports = instance.exports;
      if (exports.memory) mergeMemory(exports.memory);
      Module['asm'] = exports;
      Module["usingWasm"] = true;
      removeRunDependency('wasm-instantiate');
    }
    addRunDependency('wasm-instantiate');

    // User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
    // to manually instantiate the Wasm module themselves. This allows pages to run the instantiation parallel
    // to any other async startup actions they are performing.
    if (Module['instantiateWasm']) {
      try {
        return Module['instantiateWasm'](info, receiveInstance);
      } catch(e) {
        Module['printErr']('Module.instantiateWasm callback failed with error: ' + e);
        return false;
      }
    }

    // Async compilation can be confusing when an error on the page overwrites Module
    // (for example, if the order of elements is wrong, and the one defining Module is
    // later), so we save Module and check it later.
    var trueModule = Module;
    function receiveInstantiatedSource(output) {
      // 'output' is a WebAssemblyInstantiatedSource object which has both the module and instance.
      // receiveInstance() will swap in the exports (to Module.asm) so they can be called
      assert(Module === trueModule, 'the Module object should not be replaced during async compilation - perhaps the order of HTML elements is wrong?');
      trueModule = null;
      receiveInstance(output['instance'], output['module']);
    }
    function instantiateArrayBuffer(receiver) {
      getBinaryPromise().then(function(binary) {
        return WebAssembly.instantiate(binary, info);
      }).then(receiver).catch(function(reason) {
        Module['printErr']('failed to asynchronously prepare wasm: ' + reason);
        abort(reason);
      });
    }
    // Prefer streaming instantiation if available.
    if (!Module['wasmBinary'] &&
        typeof WebAssembly.instantiateStreaming === 'function' &&
        !isDataURI(wasmBinaryFile) &&
        typeof fetch === 'function') {
      WebAssembly.instantiateStreaming(fetch(wasmBinaryFile, { credentials: 'same-origin' }), info)
        .then(receiveInstantiatedSource)
        .catch(function(reason) {
          // We expect the most common failure cause to be a bad MIME type for the binary,
          // in which case falling back to ArrayBuffer instantiation should work.
          Module['printErr']('wasm streaming compile failed: ' + reason);
          Module['printErr']('falling back to ArrayBuffer instantiation');
          instantiateArrayBuffer(receiveInstantiatedSource);
        });
    } else {
      instantiateArrayBuffer(receiveInstantiatedSource);
    }
    return {}; // no exports yet; we'll fill them in later
  }


  // We may have a preloaded value in Module.asm, save it
  Module['asmPreload'] = Module['asm'];

  // Memory growth integration code

  var asmjsReallocBuffer = Module['reallocBuffer'];

  var wasmReallocBuffer = function(size) {
    var PAGE_MULTIPLE = Module["usingWasm"] ? WASM_PAGE_SIZE : ASMJS_PAGE_SIZE; // In wasm, heap size must be a multiple of 64KB. In asm.js, they need to be multiples of 16MB.
    size = alignUp(size, PAGE_MULTIPLE); // round up to wasm page size
    var old = Module['buffer'];
    var oldSize = old.byteLength;
    if (Module["usingWasm"]) {
      // native wasm support
      try {
        var result = Module['wasmMemory'].grow((size - oldSize) / wasmPageSize); // .grow() takes a delta compared to the previous size
        if (result !== (-1 | 0)) {
          // success in native wasm memory growth, get the buffer from the memory
          return Module['buffer'] = Module['wasmMemory'].buffer;
        } else {
          return null;
        }
      } catch(e) {
        console.error('Module.reallocBuffer: Attempted to grow from ' + oldSize  + ' bytes to ' + size + ' bytes, but got error: ' + e);
        return null;
      }
    }
  };

  Module['reallocBuffer'] = function(size) {
    if (finalMethod === 'asmjs') {
      return asmjsReallocBuffer(size);
    } else {
      return wasmReallocBuffer(size);
    }
  };

  // we may try more than one; this is the final one, that worked and we are using
  var finalMethod = '';

  // Provide an "asm.js function" for the application, called to "link" the asm.js module. We instantiate
  // the wasm module at that time, and it receives imports and provides exports and so forth, the app
  // doesn't need to care that it is wasm or olyfilled wasm or asm.js.

  Module['asm'] = function(global, env, providedBuffer) {
    env = fixImports(env);

    // import table
    if (!env['table']) {
      var TABLE_SIZE = Module['wasmTableSize'];
      if (TABLE_SIZE === undefined) TABLE_SIZE = 1024; // works in binaryen interpreter at least
      var MAX_TABLE_SIZE = Module['wasmMaxTableSize'];
      if (typeof WebAssembly === 'object' && typeof WebAssembly.Table === 'function') {
        if (MAX_TABLE_SIZE !== undefined) {
          env['table'] = new WebAssembly.Table({ 'initial': TABLE_SIZE, 'maximum': MAX_TABLE_SIZE, 'element': 'anyfunc' });
        } else {
          env['table'] = new WebAssembly.Table({ 'initial': TABLE_SIZE, element: 'anyfunc' });
        }
      } else {
        env['table'] = new Array(TABLE_SIZE); // works in binaryen interpreter at least
      }
      Module['wasmTable'] = env['table'];
    }

    if (!env['memoryBase']) {
      env['memoryBase'] = Module['STATIC_BASE']; // tell the memory segments where to place themselves
    }
    if (!env['tableBase']) {
      env['tableBase'] = 0; // table starts at 0 by default, in dynamic linking this will change
    }

    // try the methods. each should return the exports if it succeeded

    var exports;
    exports = doNativeWasm(global, env, providedBuffer);

    if (!exports) abort('no binaryen method succeeded. consider enabling more options, like interpreting, if you want that: https://github.com/kripken/emscripten/wiki/WebAssembly#binaryen-methods');


    return exports;
  };

  var methodHandler = Module['asm']; // note our method handler, as we may modify Module['asm'] later
}

integrateWasmJS();

// === Body ===

var ASM_CONSTS = [];





STATIC_BASE = GLOBAL_BASE;

STATICTOP = STATIC_BASE + 52864;
/* global initializers */  __ATINIT__.push({ func: function() { __GLOBAL__sub_I_status_cc() } });







var STATIC_BUMP = 52864;
Module["STATIC_BASE"] = STATIC_BASE;
Module["STATIC_BUMP"] = STATIC_BUMP;

/* no memory initializer */
var tempDoublePtr = STATICTOP; STATICTOP += 16;

assert(tempDoublePtr % 8 == 0);

function copyTempFloat(ptr) { // functions, because inlining this code increases code size too much

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

}

function copyTempDouble(ptr) {

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

  HEAP8[tempDoublePtr+4] = HEAP8[ptr+4];

  HEAP8[tempDoublePtr+5] = HEAP8[ptr+5];

  HEAP8[tempDoublePtr+6] = HEAP8[ptr+6];

  HEAP8[tempDoublePtr+7] = HEAP8[ptr+7];

}

// {{PRE_LIBRARY}}


  function ___assert_fail(condition, filename, line, func) {
      abort('Assertion failed: ' + Pointer_stringify(condition) + ', at: ' + [filename ? Pointer_stringify(filename) : 'unknown filename', line, func ? Pointer_stringify(func) : 'unknown function']);
    }

  function ___cxa_pure_virtual() {
      ABORT = true;
      throw 'Pure virtual function called!';
    }

  function ___lock() {}

  
  var SYSCALLS={varargs:0,get:function(varargs) {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[(((SYSCALLS.varargs)-(4))>>2)];
        return ret;
      },getStr:function() {
        var ret = Pointer_stringify(SYSCALLS.get());
        return ret;
      },get64:function() {
        var low = SYSCALLS.get(), high = SYSCALLS.get();
        if (low >= 0) assert(high === 0);
        else assert(high === -1);
        return low;
      },getZero:function() {
        assert(SYSCALLS.get() === 0);
      }};function ___syscall10(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // unlink
      var path = SYSCALLS.getStr();
      FS.unlink(path);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall118(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // fsync
      var stream = SYSCALLS.getStreamFromFD();
      return 0; // we can't do anything synchronously; the in-memory FS is already synced to
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall140(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // llseek
      var stream = SYSCALLS.getStreamFromFD(), offset_high = SYSCALLS.get(), offset_low = SYSCALLS.get(), result = SYSCALLS.get(), whence = SYSCALLS.get();
      // NOTE: offset_high is unused - Emscripten's off_t is 32-bit
      var offset = offset_low;
      FS.llseek(stream, offset, whence);
      HEAP32[((result)>>2)]=stream.position;
      if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null; // reset readdir state
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  
  function flush_NO_FILESYSTEM() {
      // flush anything remaining in the buffers during shutdown
      var fflush = Module["_fflush"];
      if (fflush) fflush(0);
      var printChar = ___syscall146.printChar;
      if (!printChar) return;
      var buffers = ___syscall146.buffers;
      if (buffers[1].length) printChar(1, 10);
      if (buffers[2].length) printChar(2, 10);
    }function ___syscall146(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // writev
      // hack to support printf in NO_FILESYSTEM
      var stream = SYSCALLS.get(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
      var ret = 0;
      if (!___syscall146.buffers) {
        ___syscall146.buffers = [null, [], []]; // 1 => stdout, 2 => stderr
        ___syscall146.printChar = function(stream, curr) {
          var buffer = ___syscall146.buffers[stream];
          assert(buffer);
          if (curr === 0 || curr === 10) {
            (stream === 1 ? Module['print'] : Module['printErr'])(UTF8ArrayToString(buffer, 0));
            buffer.length = 0;
          } else {
            buffer.push(curr);
          }
        };
      }
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAP32[(((iov)+(i*8))>>2)];
        var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
        for (var j = 0; j < len; j++) {
          ___syscall146.printChar(stream, HEAPU8[ptr+j]);
        }
        ret += len;
      }
      return ret;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall15(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // chmod
      var path = SYSCALLS.getStr(), mode = SYSCALLS.get();
      FS.chmod(path, mode);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall183(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // getcwd
      var buf = SYSCALLS.get(), size = SYSCALLS.get();
      if (size === 0) return -ERRNO_CODES.EINVAL;
      var cwd = FS.cwd();
      var cwdLengthInBytes = lengthBytesUTF8(cwd);
      if (size < cwdLengthInBytes + 1) return -ERRNO_CODES.ERANGE;
      stringToUTF8(cwd, buf, size);
      return buf;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall192(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // mmap2
      var addr = SYSCALLS.get(), len = SYSCALLS.get(), prot = SYSCALLS.get(), flags = SYSCALLS.get(), fd = SYSCALLS.get(), off = SYSCALLS.get()
      off <<= 12; // undo pgoffset
      var ptr;
      var allocated = false;
      if (fd === -1) {
        ptr = _memalign(PAGE_SIZE, len);
        if (!ptr) return -ERRNO_CODES.ENOMEM;
        _memset(ptr, 0, len);
        allocated = true;
      } else {
        var info = FS.getStream(fd);
        if (!info) return -ERRNO_CODES.EBADF;
        var res = FS.mmap(info, HEAPU8, addr, len, off, prot, flags);
        ptr = res.ptr;
        allocated = res.allocated;
      }
      SYSCALLS.mappings[ptr] = { malloc: ptr, len: len, allocated: allocated, fd: fd, flags: flags };
      return ptr;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall194(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // ftruncate64
      var fd = SYSCALLS.get(), zero = SYSCALLS.getZero(), length = SYSCALLS.get64();
      FS.ftruncate(fd, length);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall195(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // SYS_stat64
      var path = SYSCALLS.getStr(), buf = SYSCALLS.get();
      return SYSCALLS.doStat(FS.stat, path, buf);
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall196(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // SYS_lstat64
      var path = SYSCALLS.getStr(), buf = SYSCALLS.get();
      return SYSCALLS.doStat(FS.lstat, path, buf);
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall197(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // SYS_fstat64
      var stream = SYSCALLS.getStreamFromFD(), buf = SYSCALLS.get();
      return SYSCALLS.doStat(FS.stat, stream.path, buf);
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  
  var PROCINFO={ppid:1,pid:42,sid:42,pgid:42};function ___syscall20(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // getpid
      return PROCINFO.pid;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  
  function ___syscall202(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // getgid32
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }function ___syscall201(
  ) {
  return ___syscall202.apply(null, arguments)
  }

  function ___syscall207(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // fchown32
      var fd = SYSCALLS.get(), owner = SYSCALLS.get(), group = SYSCALLS.get();
      FS.fchown(fd, owner, group);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall212(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // chown32
      var path = SYSCALLS.getStr(), owner = SYSCALLS.get(), group = SYSCALLS.get();
      FS.chown(path, owner, group);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  
  function ___setErrNo(value) {
      if (Module['___errno_location']) HEAP32[((Module['___errno_location']())>>2)]=value;
      else Module.printErr('failed to set errno from JS');
      return value;
    }function ___syscall221(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // fcntl64
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall3(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // read
      var stream = SYSCALLS.getStreamFromFD(), buf = SYSCALLS.get(), count = SYSCALLS.get();
      return FS.read(stream, HEAP8,buf, count);
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall33(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // access
      var path = SYSCALLS.getStr(), amode = SYSCALLS.get();
      return SYSCALLS.doAccess(path, amode);
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall39(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // mkdir
      var path = SYSCALLS.getStr(), mode = SYSCALLS.get();
      return SYSCALLS.doMkdir(path, mode);
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall4(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // write
      var stream = SYSCALLS.getStreamFromFD(), buf = SYSCALLS.get(), count = SYSCALLS.get();
      return FS.write(stream, HEAP8,buf, count);
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall40(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // rmdir
      var path = SYSCALLS.getStr();
      FS.rmdir(path);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall5(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // open
      var pathname = SYSCALLS.getStr(), flags = SYSCALLS.get(), mode = SYSCALLS.get() // optional TODO
      var stream = FS.open(pathname, flags, mode);
      return stream.fd;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall54(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // ioctl
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall6(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // close
      var stream = SYSCALLS.getStreamFromFD();
      FS.close(stream);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall85(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // readlink
      var path = SYSCALLS.getStr(), buf = SYSCALLS.get(), bufsize = SYSCALLS.get();
      return SYSCALLS.doReadlink(path, buf, bufsize);
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall91(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // munmap
      var addr = SYSCALLS.get(), len = SYSCALLS.get();
      // TODO: support unmmap'ing parts of allocations
      var info = SYSCALLS.mappings[addr];
      if (!info) return 0;
      if (len === info.len) {
        var stream = FS.getStream(info.fd);
        SYSCALLS.doMsync(addr, stream, len, info.flags)
        FS.munmap(stream);
        SYSCALLS.mappings[addr] = null;
        if (info.allocated) {
          _free(info.malloc);
        }
      }
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall94(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // fchmod
      var fd = SYSCALLS.get(), mode = SYSCALLS.get();
      FS.fchmod(fd, mode);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___unlock() {}

  function _abort() {
      Module['abort']();
    }

  
  var DLFCN={error:null,errorMsg:null,loadedLibs:{},loadedLibNames:{}};function _dlclose(handle) {
      // int dlclose(void *handle);
      // http://pubs.opengroup.org/onlinepubs/009695399/functions/dlclose.html
      if (!DLFCN.loadedLibs[handle]) {
        DLFCN.errorMsg = 'Tried to dlclose() unopened handle: ' + handle;
        return 1;
      } else {
        var lib_record = DLFCN.loadedLibs[handle];
        if (--lib_record.refcount == 0) {
          if (lib_record.module.cleanups) {
            lib_record.module.cleanups.forEach(function(cleanup) { cleanup() });
          }
          delete DLFCN.loadedLibNames[lib_record.name];
          delete DLFCN.loadedLibs[handle];
        }
        return 0;
      }
    }

  function _dlerror() {
      // char *dlerror(void);
      // http://pubs.opengroup.org/onlinepubs/009695399/functions/dlerror.html
      if (DLFCN.errorMsg === null) {
        return 0;
      } else {
        if (DLFCN.error) _free(DLFCN.error);
        var msgArr = intArrayFromString(DLFCN.errorMsg);
        DLFCN.error = allocate(msgArr, 'i8', ALLOC_NORMAL);
        DLFCN.errorMsg = null;
        return DLFCN.error;
      }
    }

  
  var FS=undefined;
  
  
  
  
  var _environ=STATICTOP; STATICTOP += 16;;var ___environ=_environ;function ___buildEnvironment(env) {
      // WARNING: Arbitrary limit!
      var MAX_ENV_VALUES = 64;
      var TOTAL_ENV_SIZE = 1024;
  
      // Statically allocate memory for the environment.
      var poolPtr;
      var envPtr;
      if (!___buildEnvironment.called) {
        ___buildEnvironment.called = true;
        // Set default values. Use string keys for Closure Compiler compatibility.
        ENV['USER'] = ENV['LOGNAME'] = 'web_user';
        ENV['PATH'] = '/';
        ENV['PWD'] = '/';
        ENV['HOME'] = '/home/web_user';
        ENV['LANG'] = 'C.UTF-8';
        ENV['_'] = Module['thisProgram'];
        // Allocate memory.
        poolPtr = staticAlloc(TOTAL_ENV_SIZE);
        envPtr = staticAlloc(MAX_ENV_VALUES * 4);
        HEAP32[((envPtr)>>2)]=poolPtr;
        HEAP32[((_environ)>>2)]=envPtr;
      } else {
        envPtr = HEAP32[((_environ)>>2)];
        poolPtr = HEAP32[((envPtr)>>2)];
      }
  
      // Collect key=value lines.
      var strings = [];
      var totalSize = 0;
      for (var key in env) {
        if (typeof env[key] === 'string') {
          var line = key + '=' + env[key];
          strings.push(line);
          totalSize += line.length;
        }
      }
      if (totalSize > TOTAL_ENV_SIZE) {
        throw new Error('Environment size exceeded TOTAL_ENV_SIZE!');
      }
  
      // Make new.
      var ptrSize = 4;
      for (var i = 0; i < strings.length; i++) {
        var line = strings[i];
        writeAsciiToMemory(line, poolPtr);
        HEAP32[(((envPtr)+(i * ptrSize))>>2)]=poolPtr;
        poolPtr += line.length + 1;
      }
      HEAP32[(((envPtr)+(strings.length * ptrSize))>>2)]=0;
    }var ENV={};function _dlopen(filename, flag) {
      abort("To use dlopen, you need to use Emscripten's linking support, see https://github.com/kripken/emscripten/wiki/Linking");
      // void *dlopen(const char *file, int mode);
      // http://pubs.opengroup.org/onlinepubs/009695399/functions/dlopen.html
      var searchpaths = [];
      if (filename === 0) {
        filename = '__self__';
      } else {
        var strfilename = Pointer_stringify(filename);
        var isValidFile = function (filename) {
          var target = FS.findObject(filename);
          return target && !target.isFolder && !target.isDevice;
        };
  
        if (isValidFile(strfilename)) {
          filename = strfilename;
        } else {
          if (ENV['LD_LIBRARY_PATH']) {
            searchpaths = ENV['LD_LIBRARY_PATH'].split(':');
          }
  
          for (var ident in searchpaths) {
            var searchfile = PATH.join2(searchpaths[ident],strfilename);
            if (isValidFile(searchfile)) {
              filename = searchfile;
              break;
            }
          }
        }
      }
  
      if (DLFCN.loadedLibNames[filename]) {
        // Already loaded; increment ref count and return.
        var handle = DLFCN.loadedLibNames[filename];
        DLFCN.loadedLibs[handle].refcount++;
        return handle;
      }
  
      if (filename === '__self__') {
        var handle = -1;
        var lib_module = Module;
      } else {
        var target = FS.findObject(filename);
        if (!target || target.isFolder || target.isDevice) {
          DLFCN.errorMsg = 'Could not find dynamic lib: ' + filename;
          return 0;
        }
        FS.forceLoadFile(target);
  
        var lib_module;
        try {
          // the shared library is a shared wasm library (see tools/shared.py WebAssembly.make_shared_library)
          var lib_data = FS.readFile(filename, { encoding: 'binary' });
          if (!(lib_data instanceof Uint8Array)) lib_data = new Uint8Array(lib_data);
          //Module.printErr('libfile ' + filename + ' size: ' + lib_data.length);
          lib_module = loadWebAssemblyModule(lib_data);
        } catch (e) {
          Module.printErr('Error in loading dynamic library: ' + e);
          DLFCN.errorMsg = 'Could not evaluate dynamic lib: ' + filename + '\n' + e;
          return 0;
        }
  
        // Not all browsers support Object.keys().
        var handle = 1;
        for (var key in DLFCN.loadedLibs) {
          if (DLFCN.loadedLibs.hasOwnProperty(key)) handle++;
        }
  
        // We don't care about RTLD_NOW and RTLD_LAZY.
        if (flag & 256) { // RTLD_GLOBAL
          for (var ident in lib_module) {
            if (lib_module.hasOwnProperty(ident)) {
              // When RTLD_GLOBAL is enable, the symbols defined by this shared object will be made
              // available for symbol resolution of subsequently loaded shared objects.
              //
              // We should copy the symbols (which include methods and variables) from SIDE_MODULE to MAIN_MODULE.
              //
              // Module of SIDE_MODULE has not only the symbols (which should be copied)
              // but also others (print*, asmGlobal*, FUNCTION_TABLE_**, NAMED_GLOBALS, and so on).
              //
              // When the symbol (which should be copied) is method, Module._* 's type becomes function.
              // When the symbol (which should be copied) is variable, Module._* 's type becomes number.
              //
              // Except for the symbol prefix (_), there is no difference in the symbols (which should be copied) and others.
              // So this just copies over compiled symbols (which start with _).
              if (ident[0] == '_') {
                Module[ident] = lib_module[ident];
              }
            }
          }
        }
      }
      DLFCN.loadedLibs[handle] = {
        refcount: 1,
        name: filename,
        module: lib_module
      };
      DLFCN.loadedLibNames[filename] = handle;
  
      return handle;
    }

  function _dlsym(handle, symbol) {
      // void *dlsym(void *restrict handle, const char *restrict name);
      // http://pubs.opengroup.org/onlinepubs/009695399/functions/dlsym.html
      symbol = Pointer_stringify(symbol);
  
      if (!DLFCN.loadedLibs[handle]) {
        DLFCN.errorMsg = 'Tried to dlsym() from an unopened handle: ' + handle;
        return 0;
      } else {
        var lib = DLFCN.loadedLibs[handle];
        symbol = '_' + symbol;
        if (!lib.module.hasOwnProperty(symbol)) {
          DLFCN.errorMsg = ('Tried to lookup unknown symbol "' + symbol +
                                 '" in dynamic lib: ' + lib.name);
          return 0;
        } else {
          var result = lib.module[symbol];
          if (typeof result === 'function') {
            // convert the exported function into a function pointer using our generic
            // JS mechanism.
            return addFunction(result);
          }
          return result;
        }
      }
    }

  
  
  
  function _emscripten_set_main_loop_timing(mode, value) {
      Browser.mainLoop.timingMode = mode;
      Browser.mainLoop.timingValue = value;
  
      if (!Browser.mainLoop.func) {
        console.error('emscripten_set_main_loop_timing: Cannot set timing mode for main loop since a main loop does not exist! Call emscripten_set_main_loop first to set one up.');
        return 1; // Return non-zero on failure, can't set timing mode when there is no main loop.
      }
  
      if (mode == 0 /*EM_TIMING_SETTIMEOUT*/) {
        Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setTimeout() {
          var timeUntilNextTick = Math.max(0, Browser.mainLoop.tickStartTime + value - _emscripten_get_now())|0;
          setTimeout(Browser.mainLoop.runner, timeUntilNextTick); // doing this each time means that on exception, we stop
        };
        Browser.mainLoop.method = 'timeout';
      } else if (mode == 1 /*EM_TIMING_RAF*/) {
        Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_rAF() {
          Browser.requestAnimationFrame(Browser.mainLoop.runner);
        };
        Browser.mainLoop.method = 'rAF';
      } else if (mode == 2 /*EM_TIMING_SETIMMEDIATE*/) {
        if (typeof setImmediate === 'undefined') {
          // Emulate setImmediate. (note: not a complete polyfill, we don't emulate clearImmediate() to keep code size to minimum, since not needed)
          var setImmediates = [];
          var emscriptenMainLoopMessageId = 'setimmediate';
          function Browser_setImmediate_messageHandler(event) {
            // When called in current thread or Worker, the main loop ID is structured slightly different to accommodate for --proxy-to-worker runtime listening to Worker events,
            // so check for both cases.
            if (event.data === emscriptenMainLoopMessageId || event.data.target === emscriptenMainLoopMessageId) {
              event.stopPropagation();
              setImmediates.shift()();
            }
          }
          addEventListener("message", Browser_setImmediate_messageHandler, true);
          setImmediate = function Browser_emulated_setImmediate(func) {
            setImmediates.push(func);
            if (ENVIRONMENT_IS_WORKER) {
              if (Module['setImmediates'] === undefined) Module['setImmediates'] = [];
              Module['setImmediates'].push(func);
              postMessage({target: emscriptenMainLoopMessageId}); // In --proxy-to-worker, route the message via proxyClient.js
            } else postMessage(emscriptenMainLoopMessageId, "*"); // On the main thread, can just send the message to itself.
          }
        }
        Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setImmediate() {
          setImmediate(Browser.mainLoop.runner);
        };
        Browser.mainLoop.method = 'immediate';
      }
      return 0;
    }
  
  function _emscripten_get_now() { abort() }function _emscripten_set_main_loop(func, fps, simulateInfiniteLoop, arg, noSetTiming) {
      Module['noExitRuntime'] = true;
  
      assert(!Browser.mainLoop.func, 'emscripten_set_main_loop: there can only be one main loop function at once: call emscripten_cancel_main_loop to cancel the previous one before setting a new one with different parameters.');
  
      Browser.mainLoop.func = func;
      Browser.mainLoop.arg = arg;
  
      var browserIterationFunc;
      if (typeof arg !== 'undefined') {
        browserIterationFunc = function() {
          Module['dynCall_vi'](func, arg);
        };
      } else {
        browserIterationFunc = function() {
          Module['dynCall_v'](func);
        };
      }
  
      var thisMainLoopId = Browser.mainLoop.currentlyRunningMainloop;
  
      Browser.mainLoop.runner = function Browser_mainLoop_runner() {
        if (ABORT) return;
        if (Browser.mainLoop.queue.length > 0) {
          var start = Date.now();
          var blocker = Browser.mainLoop.queue.shift();
          blocker.func(blocker.arg);
          if (Browser.mainLoop.remainingBlockers) {
            var remaining = Browser.mainLoop.remainingBlockers;
            var next = remaining%1 == 0 ? remaining-1 : Math.floor(remaining);
            if (blocker.counted) {
              Browser.mainLoop.remainingBlockers = next;
            } else {
              // not counted, but move the progress along a tiny bit
              next = next + 0.5; // do not steal all the next one's progress
              Browser.mainLoop.remainingBlockers = (8*remaining + next)/9;
            }
          }
          console.log('main loop blocker "' + blocker.name + '" took ' + (Date.now() - start) + ' ms'); //, left: ' + Browser.mainLoop.remainingBlockers);
          Browser.mainLoop.updateStatus();
          
          // catches pause/resume main loop from blocker execution
          if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
          
          setTimeout(Browser.mainLoop.runner, 0);
          return;
        }
  
        // catch pauses from non-main loop sources
        if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
  
        // Implement very basic swap interval control
        Browser.mainLoop.currentFrameNumber = Browser.mainLoop.currentFrameNumber + 1 | 0;
        if (Browser.mainLoop.timingMode == 1/*EM_TIMING_RAF*/ && Browser.mainLoop.timingValue > 1 && Browser.mainLoop.currentFrameNumber % Browser.mainLoop.timingValue != 0) {
          // Not the scheduled time to render this frame - skip.
          Browser.mainLoop.scheduler();
          return;
        } else if (Browser.mainLoop.timingMode == 0/*EM_TIMING_SETTIMEOUT*/) {
          Browser.mainLoop.tickStartTime = _emscripten_get_now();
        }
  
        // Signal GL rendering layer that processing of a new frame is about to start. This helps it optimize
        // VBO double-buffering and reduce GPU stalls.
  
  
        if (Browser.mainLoop.method === 'timeout' && Module.ctx) {
          Module.printErr('Looks like you are rendering without using requestAnimationFrame for the main loop. You should use 0 for the frame rate in emscripten_set_main_loop in order to use requestAnimationFrame, as that can greatly improve your frame rates!');
          Browser.mainLoop.method = ''; // just warn once per call to set main loop
        }
  
        Browser.mainLoop.runIter(browserIterationFunc);
  
        checkStackCookie();
  
        // catch pauses from the main loop itself
        if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
  
        // Queue new audio data. This is important to be right after the main loop invocation, so that we will immediately be able
        // to queue the newest produced audio samples.
        // TODO: Consider adding pre- and post- rAF callbacks so that GL.newRenderingFrameStarted() and SDL.audio.queueNewAudioData()
        //       do not need to be hardcoded into this function, but can be more generic.
        if (typeof SDL === 'object' && SDL.audio && SDL.audio.queueNewAudioData) SDL.audio.queueNewAudioData();
  
        Browser.mainLoop.scheduler();
      }
  
      if (!noSetTiming) {
        if (fps && fps > 0) _emscripten_set_main_loop_timing(0/*EM_TIMING_SETTIMEOUT*/, 1000.0 / fps);
        else _emscripten_set_main_loop_timing(1/*EM_TIMING_RAF*/, 1); // Do rAF by rendering each frame (no decimating)
  
        Browser.mainLoop.scheduler();
      }
  
      if (simulateInfiniteLoop) {
        throw 'SimulateInfiniteLoop';
      }
    }var Browser={mainLoop:{scheduler:null,method:"",currentlyRunningMainloop:0,func:null,arg:0,timingMode:0,timingValue:0,currentFrameNumber:0,queue:[],pause:function() {
          Browser.mainLoop.scheduler = null;
          Browser.mainLoop.currentlyRunningMainloop++; // Incrementing this signals the previous main loop that it's now become old, and it must return.
        },resume:function() {
          Browser.mainLoop.currentlyRunningMainloop++;
          var timingMode = Browser.mainLoop.timingMode;
          var timingValue = Browser.mainLoop.timingValue;
          var func = Browser.mainLoop.func;
          Browser.mainLoop.func = null;
          _emscripten_set_main_loop(func, 0, false, Browser.mainLoop.arg, true /* do not set timing and call scheduler, we will do it on the next lines */);
          _emscripten_set_main_loop_timing(timingMode, timingValue);
          Browser.mainLoop.scheduler();
        },updateStatus:function() {
          if (Module['setStatus']) {
            var message = Module['statusMessage'] || 'Please wait...';
            var remaining = Browser.mainLoop.remainingBlockers;
            var expected = Browser.mainLoop.expectedBlockers;
            if (remaining) {
              if (remaining < expected) {
                Module['setStatus'](message + ' (' + (expected - remaining) + '/' + expected + ')');
              } else {
                Module['setStatus'](message);
              }
            } else {
              Module['setStatus']('');
            }
          }
        },runIter:function(func) {
          if (ABORT) return;
          if (Module['preMainLoop']) {
            var preRet = Module['preMainLoop']();
            if (preRet === false) {
              return; // |return false| skips a frame
            }
          }
          try {
            func();
          } catch (e) {
            if (e instanceof ExitStatus) {
              return;
            } else {
              if (e && typeof e === 'object' && e.stack) Module.printErr('exception thrown: ' + [e, e.stack]);
              throw e;
            }
          }
          if (Module['postMainLoop']) Module['postMainLoop']();
        }},isFullscreen:false,pointerLock:false,moduleContextCreatedCallbacks:[],workers:[],init:function() {
        if (!Module["preloadPlugins"]) Module["preloadPlugins"] = []; // needs to exist even in workers
  
        if (Browser.initted) return;
        Browser.initted = true;
  
        try {
          new Blob();
          Browser.hasBlobConstructor = true;
        } catch(e) {
          Browser.hasBlobConstructor = false;
          console.log("warning: no blob constructor, cannot create blobs with mimetypes");
        }
        Browser.BlobBuilder = typeof MozBlobBuilder != "undefined" ? MozBlobBuilder : (typeof WebKitBlobBuilder != "undefined" ? WebKitBlobBuilder : (!Browser.hasBlobConstructor ? console.log("warning: no BlobBuilder") : null));
        Browser.URLObject = typeof window != "undefined" ? (window.URL ? window.URL : window.webkitURL) : undefined;
        if (!Module.noImageDecoding && typeof Browser.URLObject === 'undefined') {
          console.log("warning: Browser does not support creating object URLs. Built-in browser image decoding will not be available.");
          Module.noImageDecoding = true;
        }
  
        // Support for plugins that can process preloaded files. You can add more of these to
        // your app by creating and appending to Module.preloadPlugins.
        //
        // Each plugin is asked if it can handle a file based on the file's name. If it can,
        // it is given the file's raw data. When it is done, it calls a callback with the file's
        // (possibly modified) data. For example, a plugin might decompress a file, or it
        // might create some side data structure for use later (like an Image element, etc.).
  
        var imagePlugin = {};
        imagePlugin['canHandle'] = function imagePlugin_canHandle(name) {
          return !Module.noImageDecoding && /\.(jpg|jpeg|png|bmp)$/i.test(name);
        };
        imagePlugin['handle'] = function imagePlugin_handle(byteArray, name, onload, onerror) {
          var b = null;
          if (Browser.hasBlobConstructor) {
            try {
              b = new Blob([byteArray], { type: Browser.getMimetype(name) });
              if (b.size !== byteArray.length) { // Safari bug #118630
                // Safari's Blob can only take an ArrayBuffer
                b = new Blob([(new Uint8Array(byteArray)).buffer], { type: Browser.getMimetype(name) });
              }
            } catch(e) {
              warnOnce('Blob constructor present but fails: ' + e + '; falling back to blob builder');
            }
          }
          if (!b) {
            var bb = new Browser.BlobBuilder();
            bb.append((new Uint8Array(byteArray)).buffer); // we need to pass a buffer, and must copy the array to get the right data range
            b = bb.getBlob();
          }
          var url = Browser.URLObject.createObjectURL(b);
          assert(typeof url == 'string', 'createObjectURL must return a url as a string');
          var img = new Image();
          img.onload = function img_onload() {
            assert(img.complete, 'Image ' + name + ' could not be decoded');
            var canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            Module["preloadedImages"][name] = canvas;
            Browser.URLObject.revokeObjectURL(url);
            if (onload) onload(byteArray);
          };
          img.onerror = function img_onerror(event) {
            console.log('Image ' + url + ' could not be decoded');
            if (onerror) onerror();
          };
          img.src = url;
        };
        Module['preloadPlugins'].push(imagePlugin);
  
        var audioPlugin = {};
        audioPlugin['canHandle'] = function audioPlugin_canHandle(name) {
          return !Module.noAudioDecoding && name.substr(-4) in { '.ogg': 1, '.wav': 1, '.mp3': 1 };
        };
        audioPlugin['handle'] = function audioPlugin_handle(byteArray, name, onload, onerror) {
          var done = false;
          function finish(audio) {
            if (done) return;
            done = true;
            Module["preloadedAudios"][name] = audio;
            if (onload) onload(byteArray);
          }
          function fail() {
            if (done) return;
            done = true;
            Module["preloadedAudios"][name] = new Audio(); // empty shim
            if (onerror) onerror();
          }
          if (Browser.hasBlobConstructor) {
            try {
              var b = new Blob([byteArray], { type: Browser.getMimetype(name) });
            } catch(e) {
              return fail();
            }
            var url = Browser.URLObject.createObjectURL(b); // XXX we never revoke this!
            assert(typeof url == 'string', 'createObjectURL must return a url as a string');
            var audio = new Audio();
            audio.addEventListener('canplaythrough', function() { finish(audio) }, false); // use addEventListener due to chromium bug 124926
            audio.onerror = function audio_onerror(event) {
              if (done) return;
              console.log('warning: browser could not fully decode audio ' + name + ', trying slower base64 approach');
              function encode64(data) {
                var BASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
                var PAD = '=';
                var ret = '';
                var leftchar = 0;
                var leftbits = 0;
                for (var i = 0; i < data.length; i++) {
                  leftchar = (leftchar << 8) | data[i];
                  leftbits += 8;
                  while (leftbits >= 6) {
                    var curr = (leftchar >> (leftbits-6)) & 0x3f;
                    leftbits -= 6;
                    ret += BASE[curr];
                  }
                }
                if (leftbits == 2) {
                  ret += BASE[(leftchar&3) << 4];
                  ret += PAD + PAD;
                } else if (leftbits == 4) {
                  ret += BASE[(leftchar&0xf) << 2];
                  ret += PAD;
                }
                return ret;
              }
              audio.src = 'data:audio/x-' + name.substr(-3) + ';base64,' + encode64(byteArray);
              finish(audio); // we don't wait for confirmation this worked - but it's worth trying
            };
            audio.src = url;
            // workaround for chrome bug 124926 - we do not always get oncanplaythrough or onerror
            Browser.safeSetTimeout(function() {
              finish(audio); // try to use it even though it is not necessarily ready to play
            }, 10000);
          } else {
            return fail();
          }
        };
        Module['preloadPlugins'].push(audioPlugin);
  
        // Canvas event setup
  
        function pointerLockChange() {
          Browser.pointerLock = document['pointerLockElement'] === Module['canvas'] ||
                                document['mozPointerLockElement'] === Module['canvas'] ||
                                document['webkitPointerLockElement'] === Module['canvas'] ||
                                document['msPointerLockElement'] === Module['canvas'];
        }
        var canvas = Module['canvas'];
        if (canvas) {
          // forced aspect ratio can be enabled by defining 'forcedAspectRatio' on Module
          // Module['forcedAspectRatio'] = 4 / 3;
          
          canvas.requestPointerLock = canvas['requestPointerLock'] ||
                                      canvas['mozRequestPointerLock'] ||
                                      canvas['webkitRequestPointerLock'] ||
                                      canvas['msRequestPointerLock'] ||
                                      function(){};
          canvas.exitPointerLock = document['exitPointerLock'] ||
                                   document['mozExitPointerLock'] ||
                                   document['webkitExitPointerLock'] ||
                                   document['msExitPointerLock'] ||
                                   function(){}; // no-op if function does not exist
          canvas.exitPointerLock = canvas.exitPointerLock.bind(document);
  
          document.addEventListener('pointerlockchange', pointerLockChange, false);
          document.addEventListener('mozpointerlockchange', pointerLockChange, false);
          document.addEventListener('webkitpointerlockchange', pointerLockChange, false);
          document.addEventListener('mspointerlockchange', pointerLockChange, false);
  
          if (Module['elementPointerLock']) {
            canvas.addEventListener("click", function(ev) {
              if (!Browser.pointerLock && Module['canvas'].requestPointerLock) {
                Module['canvas'].requestPointerLock();
                ev.preventDefault();
              }
            }, false);
          }
        }
      },createContext:function(canvas, useWebGL, setInModule, webGLContextAttributes) {
        if (useWebGL && Module.ctx && canvas == Module.canvas) return Module.ctx; // no need to recreate GL context if it's already been created for this canvas.
  
        var ctx;
        var contextHandle;
        if (useWebGL) {
          // For GLES2/desktop GL compatibility, adjust a few defaults to be different to WebGL defaults, so that they align better with the desktop defaults.
          var contextAttributes = {
            antialias: false,
            alpha: false
          };
  
          if (webGLContextAttributes) {
            for (var attribute in webGLContextAttributes) {
              contextAttributes[attribute] = webGLContextAttributes[attribute];
            }
          }
  
          contextHandle = GL.createContext(canvas, contextAttributes);
          if (contextHandle) {
            ctx = GL.getContext(contextHandle).GLctx;
          }
        } else {
          ctx = canvas.getContext('2d');
        }
  
        if (!ctx) return null;
  
        if (setInModule) {
          if (!useWebGL) assert(typeof GLctx === 'undefined', 'cannot set in module if GLctx is used, but we are a non-GL context that would replace it');
  
          Module.ctx = ctx;
          if (useWebGL) GL.makeContextCurrent(contextHandle);
          Module.useWebGL = useWebGL;
          Browser.moduleContextCreatedCallbacks.forEach(function(callback) { callback() });
          Browser.init();
        }
        return ctx;
      },destroyContext:function(canvas, useWebGL, setInModule) {},fullscreenHandlersInstalled:false,lockPointer:undefined,resizeCanvas:undefined,requestFullscreen:function(lockPointer, resizeCanvas, vrDevice) {
        Browser.lockPointer = lockPointer;
        Browser.resizeCanvas = resizeCanvas;
        Browser.vrDevice = vrDevice;
        if (typeof Browser.lockPointer === 'undefined') Browser.lockPointer = true;
        if (typeof Browser.resizeCanvas === 'undefined') Browser.resizeCanvas = false;
        if (typeof Browser.vrDevice === 'undefined') Browser.vrDevice = null;
  
        var canvas = Module['canvas'];
        function fullscreenChange() {
          Browser.isFullscreen = false;
          var canvasContainer = canvas.parentNode;
          if ((document['fullscreenElement'] || document['mozFullScreenElement'] ||
               document['msFullscreenElement'] || document['webkitFullscreenElement'] ||
               document['webkitCurrentFullScreenElement']) === canvasContainer) {
            canvas.exitFullscreen = document['exitFullscreen'] ||
                                    document['cancelFullScreen'] ||
                                    document['mozCancelFullScreen'] ||
                                    document['msExitFullscreen'] ||
                                    document['webkitCancelFullScreen'] ||
                                    function() {};
            canvas.exitFullscreen = canvas.exitFullscreen.bind(document);
            if (Browser.lockPointer) canvas.requestPointerLock();
            Browser.isFullscreen = true;
            if (Browser.resizeCanvas) Browser.setFullscreenCanvasSize();
          } else {
            
            // remove the full screen specific parent of the canvas again to restore the HTML structure from before going full screen
            canvasContainer.parentNode.insertBefore(canvas, canvasContainer);
            canvasContainer.parentNode.removeChild(canvasContainer);
            
            if (Browser.resizeCanvas) Browser.setWindowedCanvasSize();
          }
          if (Module['onFullScreen']) Module['onFullScreen'](Browser.isFullscreen);
          if (Module['onFullscreen']) Module['onFullscreen'](Browser.isFullscreen);
          Browser.updateCanvasDimensions(canvas);
        }
  
        if (!Browser.fullscreenHandlersInstalled) {
          Browser.fullscreenHandlersInstalled = true;
          document.addEventListener('fullscreenchange', fullscreenChange, false);
          document.addEventListener('mozfullscreenchange', fullscreenChange, false);
          document.addEventListener('webkitfullscreenchange', fullscreenChange, false);
          document.addEventListener('MSFullscreenChange', fullscreenChange, false);
        }
  
        // create a new parent to ensure the canvas has no siblings. this allows browsers to optimize full screen performance when its parent is the full screen root
        var canvasContainer = document.createElement("div");
        canvas.parentNode.insertBefore(canvasContainer, canvas);
        canvasContainer.appendChild(canvas);
  
        // use parent of canvas as full screen root to allow aspect ratio correction (Firefox stretches the root to screen size)
        canvasContainer.requestFullscreen = canvasContainer['requestFullscreen'] ||
                                            canvasContainer['mozRequestFullScreen'] ||
                                            canvasContainer['msRequestFullscreen'] ||
                                           (canvasContainer['webkitRequestFullscreen'] ? function() { canvasContainer['webkitRequestFullscreen'](Element['ALLOW_KEYBOARD_INPUT']) } : null) ||
                                           (canvasContainer['webkitRequestFullScreen'] ? function() { canvasContainer['webkitRequestFullScreen'](Element['ALLOW_KEYBOARD_INPUT']) } : null);
  
        if (vrDevice) {
          canvasContainer.requestFullscreen({ vrDisplay: vrDevice });
        } else {
          canvasContainer.requestFullscreen();
        }
      },requestFullScreen:function(lockPointer, resizeCanvas, vrDevice) {
          Module.printErr('Browser.requestFullScreen() is deprecated. Please call Browser.requestFullscreen instead.');
          Browser.requestFullScreen = function(lockPointer, resizeCanvas, vrDevice) {
            return Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice);
          }
          return Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice);
      },nextRAF:0,fakeRequestAnimationFrame:function(func) {
        // try to keep 60fps between calls to here
        var now = Date.now();
        if (Browser.nextRAF === 0) {
          Browser.nextRAF = now + 1000/60;
        } else {
          while (now + 2 >= Browser.nextRAF) { // fudge a little, to avoid timer jitter causing us to do lots of delay:0
            Browser.nextRAF += 1000/60;
          }
        }
        var delay = Math.max(Browser.nextRAF - now, 0);
        setTimeout(func, delay);
      },requestAnimationFrame:function requestAnimationFrame(func) {
        if (typeof window === 'undefined') { // Provide fallback to setTimeout if window is undefined (e.g. in Node.js)
          Browser.fakeRequestAnimationFrame(func);
        } else {
          if (!window.requestAnimationFrame) {
            window.requestAnimationFrame = window['requestAnimationFrame'] ||
                                           window['mozRequestAnimationFrame'] ||
                                           window['webkitRequestAnimationFrame'] ||
                                           window['msRequestAnimationFrame'] ||
                                           window['oRequestAnimationFrame'] ||
                                           Browser.fakeRequestAnimationFrame;
          }
          window.requestAnimationFrame(func);
        }
      },safeCallback:function(func) {
        return function() {
          if (!ABORT) return func.apply(null, arguments);
        };
      },allowAsyncCallbacks:true,queuedAsyncCallbacks:[],pauseAsyncCallbacks:function() {
        Browser.allowAsyncCallbacks = false;
      },resumeAsyncCallbacks:function() { // marks future callbacks as ok to execute, and synchronously runs any remaining ones right now
        Browser.allowAsyncCallbacks = true;
        if (Browser.queuedAsyncCallbacks.length > 0) {
          var callbacks = Browser.queuedAsyncCallbacks;
          Browser.queuedAsyncCallbacks = [];
          callbacks.forEach(function(func) {
            func();
          });
        }
      },safeRequestAnimationFrame:function(func) {
        return Browser.requestAnimationFrame(function() {
          if (ABORT) return;
          if (Browser.allowAsyncCallbacks) {
            func();
          } else {
            Browser.queuedAsyncCallbacks.push(func);
          }
        });
      },safeSetTimeout:function(func, timeout) {
        Module['noExitRuntime'] = true;
        return setTimeout(function() {
          if (ABORT) return;
          if (Browser.allowAsyncCallbacks) {
            func();
          } else {
            Browser.queuedAsyncCallbacks.push(func);
          }
        }, timeout);
      },safeSetInterval:function(func, timeout) {
        Module['noExitRuntime'] = true;
        return setInterval(function() {
          if (ABORT) return;
          if (Browser.allowAsyncCallbacks) {
            func();
          } // drop it on the floor otherwise, next interval will kick in
        }, timeout);
      },getMimetype:function(name) {
        return {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'bmp': 'image/bmp',
          'ogg': 'audio/ogg',
          'wav': 'audio/wav',
          'mp3': 'audio/mpeg'
        }[name.substr(name.lastIndexOf('.')+1)];
      },getUserMedia:function(func) {
        if(!window.getUserMedia) {
          window.getUserMedia = navigator['getUserMedia'] ||
                                navigator['mozGetUserMedia'];
        }
        window.getUserMedia(func);
      },getMovementX:function(event) {
        return event['movementX'] ||
               event['mozMovementX'] ||
               event['webkitMovementX'] ||
               0;
      },getMovementY:function(event) {
        return event['movementY'] ||
               event['mozMovementY'] ||
               event['webkitMovementY'] ||
               0;
      },getMouseWheelDelta:function(event) {
        var delta = 0;
        switch (event.type) {
          case 'DOMMouseScroll': 
            delta = event.detail;
            break;
          case 'mousewheel': 
            delta = event.wheelDelta;
            break;
          case 'wheel': 
            delta = event['deltaY'];
            break;
          default:
            throw 'unrecognized mouse wheel event: ' + event.type;
        }
        return delta;
      },mouseX:0,mouseY:0,mouseMovementX:0,mouseMovementY:0,touches:{},lastTouches:{},calculateMouseEvent:function(event) { // event should be mousemove, mousedown or mouseup
        if (Browser.pointerLock) {
          // When the pointer is locked, calculate the coordinates
          // based on the movement of the mouse.
          // Workaround for Firefox bug 764498
          if (event.type != 'mousemove' &&
              ('mozMovementX' in event)) {
            Browser.mouseMovementX = Browser.mouseMovementY = 0;
          } else {
            Browser.mouseMovementX = Browser.getMovementX(event);
            Browser.mouseMovementY = Browser.getMovementY(event);
          }
          
          // check if SDL is available
          if (typeof SDL != "undefined") {
            Browser.mouseX = SDL.mouseX + Browser.mouseMovementX;
            Browser.mouseY = SDL.mouseY + Browser.mouseMovementY;
          } else {
            // just add the mouse delta to the current absolut mouse position
            // FIXME: ideally this should be clamped against the canvas size and zero
            Browser.mouseX += Browser.mouseMovementX;
            Browser.mouseY += Browser.mouseMovementY;
          }        
        } else {
          // Otherwise, calculate the movement based on the changes
          // in the coordinates.
          var rect = Module["canvas"].getBoundingClientRect();
          var cw = Module["canvas"].width;
          var ch = Module["canvas"].height;
  
          // Neither .scrollX or .pageXOffset are defined in a spec, but
          // we prefer .scrollX because it is currently in a spec draft.
          // (see: http://www.w3.org/TR/2013/WD-cssom-view-20131217/)
          var scrollX = ((typeof window.scrollX !== 'undefined') ? window.scrollX : window.pageXOffset);
          var scrollY = ((typeof window.scrollY !== 'undefined') ? window.scrollY : window.pageYOffset);
          // If this assert lands, it's likely because the browser doesn't support scrollX or pageXOffset
          // and we have no viable fallback.
          assert((typeof scrollX !== 'undefined') && (typeof scrollY !== 'undefined'), 'Unable to retrieve scroll position, mouse positions likely broken.');
  
          if (event.type === 'touchstart' || event.type === 'touchend' || event.type === 'touchmove') {
            var touch = event.touch;
            if (touch === undefined) {
              return; // the "touch" property is only defined in SDL
  
            }
            var adjustedX = touch.pageX - (scrollX + rect.left);
            var adjustedY = touch.pageY - (scrollY + rect.top);
  
            adjustedX = adjustedX * (cw / rect.width);
            adjustedY = adjustedY * (ch / rect.height);
  
            var coords = { x: adjustedX, y: adjustedY };
            
            if (event.type === 'touchstart') {
              Browser.lastTouches[touch.identifier] = coords;
              Browser.touches[touch.identifier] = coords;
            } else if (event.type === 'touchend' || event.type === 'touchmove') {
              var last = Browser.touches[touch.identifier];
              if (!last) last = coords;
              Browser.lastTouches[touch.identifier] = last;
              Browser.touches[touch.identifier] = coords;
            } 
            return;
          }
  
          var x = event.pageX - (scrollX + rect.left);
          var y = event.pageY - (scrollY + rect.top);
  
          // the canvas might be CSS-scaled compared to its backbuffer;
          // SDL-using content will want mouse coordinates in terms
          // of backbuffer units.
          x = x * (cw / rect.width);
          y = y * (ch / rect.height);
  
          Browser.mouseMovementX = x - Browser.mouseX;
          Browser.mouseMovementY = y - Browser.mouseY;
          Browser.mouseX = x;
          Browser.mouseY = y;
        }
      },asyncLoad:function(url, onload, onerror, noRunDep) {
        var dep = !noRunDep ? getUniqueRunDependency('al ' + url) : '';
        Module['readAsync'](url, function(arrayBuffer) {
          assert(arrayBuffer, 'Loading data file "' + url + '" failed (no arrayBuffer).');
          onload(new Uint8Array(arrayBuffer));
          if (dep) removeRunDependency(dep);
        }, function(event) {
          if (onerror) {
            onerror();
          } else {
            throw 'Loading data file "' + url + '" failed.';
          }
        });
        if (dep) addRunDependency(dep);
      },resizeListeners:[],updateResizeListeners:function() {
        var canvas = Module['canvas'];
        Browser.resizeListeners.forEach(function(listener) {
          listener(canvas.width, canvas.height);
        });
      },setCanvasSize:function(width, height, noUpdates) {
        var canvas = Module['canvas'];
        Browser.updateCanvasDimensions(canvas, width, height);
        if (!noUpdates) Browser.updateResizeListeners();
      },windowedWidth:0,windowedHeight:0,setFullscreenCanvasSize:function() {
        // check if SDL is available   
        if (typeof SDL != "undefined") {
          var flags = HEAPU32[((SDL.screen)>>2)];
          flags = flags | 0x00800000; // set SDL_FULLSCREEN flag
          HEAP32[((SDL.screen)>>2)]=flags
        }
        Browser.updateResizeListeners();
      },setWindowedCanvasSize:function() {
        // check if SDL is available       
        if (typeof SDL != "undefined") {
          var flags = HEAPU32[((SDL.screen)>>2)];
          flags = flags & ~0x00800000; // clear SDL_FULLSCREEN flag
          HEAP32[((SDL.screen)>>2)]=flags
        }
        Browser.updateResizeListeners();
      },updateCanvasDimensions:function(canvas, wNative, hNative) {
        if (wNative && hNative) {
          canvas.widthNative = wNative;
          canvas.heightNative = hNative;
        } else {
          wNative = canvas.widthNative;
          hNative = canvas.heightNative;
        }
        var w = wNative;
        var h = hNative;
        if (Module['forcedAspectRatio'] && Module['forcedAspectRatio'] > 0) {
          if (w/h < Module['forcedAspectRatio']) {
            w = Math.round(h * Module['forcedAspectRatio']);
          } else {
            h = Math.round(w / Module['forcedAspectRatio']);
          }
        }
        if (((document['fullscreenElement'] || document['mozFullScreenElement'] ||
             document['msFullscreenElement'] || document['webkitFullscreenElement'] ||
             document['webkitCurrentFullScreenElement']) === canvas.parentNode) && (typeof screen != 'undefined')) {
           var factor = Math.min(screen.width / w, screen.height / h);
           w = Math.round(w * factor);
           h = Math.round(h * factor);
        }
        if (Browser.resizeCanvas) {
          if (canvas.width  != w) canvas.width  = w;
          if (canvas.height != h) canvas.height = h;
          if (typeof canvas.style != 'undefined') {
            canvas.style.removeProperty( "width");
            canvas.style.removeProperty("height");
          }
        } else {
          if (canvas.width  != wNative) canvas.width  = wNative;
          if (canvas.height != hNative) canvas.height = hNative;
          if (typeof canvas.style != 'undefined') {
            if (w != wNative || h != hNative) {
              canvas.style.setProperty( "width", w + "px", "important");
              canvas.style.setProperty("height", h + "px", "important");
            } else {
              canvas.style.removeProperty( "width");
              canvas.style.removeProperty("height");
            }
          }
        }
      },wgetRequests:{},nextWgetRequestHandle:0,getNextWgetRequestHandle:function() {
        var handle = Browser.nextWgetRequestHandle;
        Browser.nextWgetRequestHandle++;
        return handle;
      }};function _emscripten_async_call(func, arg, millis) {
      Module['noExitRuntime'] = true;
  
      function wrapper() {
        getFuncWrapper(func, 'vi')(arg);
      }
  
      if (millis >= 0) {
        Browser.safeSetTimeout(wrapper, millis);
      } else {
        Browser.safeRequestAnimationFrame(wrapper);
      }
    }

  function _getenv(name) {
      // char *getenv(const char *name);
      // http://pubs.opengroup.org/onlinepubs/009695399/functions/getenv.html
      if (name === 0) return 0;
      name = Pointer_stringify(name);
      if (!ENV.hasOwnProperty(name)) return 0;
  
      if (_getenv.ret) _free(_getenv.ret);
      _getenv.ret = allocateUTF8(ENV[name]);
      return _getenv.ret;
    }

  function _gettimeofday(ptr) {
      var now = Date.now();
      HEAP32[((ptr)>>2)]=(now/1000)|0; // seconds
      HEAP32[(((ptr)+(4))>>2)]=((now % 1000)*1000)|0; // microseconds
      return 0;
    }

   

  var _llvm_ctlz_i32=true;

  var _llvm_nacl_atomic_cmpxchg_i32=undefined;

  function _llvm_trap() {
      abort('trap!');
    }

  
  var ___tm_current=STATICTOP; STATICTOP += 48;;
  
  
  var ___tm_timezone=allocate(intArrayFromString("GMT"), "i8", ALLOC_STATIC);
  
  
  var _tzname=STATICTOP; STATICTOP += 16;;
  
  var _daylight=STATICTOP; STATICTOP += 16;;
  
  var _timezone=STATICTOP; STATICTOP += 16;;function _tzset() {
      // TODO: Use (malleable) environment variables instead of system settings.
      if (_tzset.called) return;
      _tzset.called = true;
  
      // timezone is specified as seconds west of UTC ("The external variable
      // `timezone` shall be set to the difference, in seconds, between
      // Coordinated Universal Time (UTC) and local standard time."), the same
      // as returned by getTimezoneOffset().
      // See http://pubs.opengroup.org/onlinepubs/009695399/functions/tzset.html
      HEAP32[((_timezone)>>2)]=(new Date()).getTimezoneOffset() * 60;
  
      var winter = new Date(2000, 0, 1);
      var summer = new Date(2000, 6, 1);
      HEAP32[((_daylight)>>2)]=Number(winter.getTimezoneOffset() != summer.getTimezoneOffset());
  
      function extractZone(date) {
        var match = date.toTimeString().match(/\(([A-Za-z ]+)\)$/);
        return match ? match[1] : "GMT";
      };
      var winterName = extractZone(winter);
      var summerName = extractZone(summer);
      var winterNamePtr = allocate(intArrayFromString(winterName), 'i8', ALLOC_NORMAL);
      var summerNamePtr = allocate(intArrayFromString(summerName), 'i8', ALLOC_NORMAL);
      if (summer.getTimezoneOffset() < winter.getTimezoneOffset()) {
        // Northern hemisphere
        HEAP32[((_tzname)>>2)]=winterNamePtr;
        HEAP32[(((_tzname)+(4))>>2)]=summerNamePtr;
      } else {
        HEAP32[((_tzname)>>2)]=summerNamePtr;
        HEAP32[(((_tzname)+(4))>>2)]=winterNamePtr;
      }
    }function _localtime_r(time, tmPtr) {
      _tzset();
      var date = new Date(HEAP32[((time)>>2)]*1000);
      HEAP32[((tmPtr)>>2)]=date.getSeconds();
      HEAP32[(((tmPtr)+(4))>>2)]=date.getMinutes();
      HEAP32[(((tmPtr)+(8))>>2)]=date.getHours();
      HEAP32[(((tmPtr)+(12))>>2)]=date.getDate();
      HEAP32[(((tmPtr)+(16))>>2)]=date.getMonth();
      HEAP32[(((tmPtr)+(20))>>2)]=date.getFullYear()-1900;
      HEAP32[(((tmPtr)+(24))>>2)]=date.getDay();
  
      var start = new Date(date.getFullYear(), 0, 1);
      var yday = ((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))|0;
      HEAP32[(((tmPtr)+(28))>>2)]=yday;
      HEAP32[(((tmPtr)+(36))>>2)]=-(date.getTimezoneOffset() * 60);
  
      // Attention: DST is in December in South, and some regions don't have DST at all.
      var summerOffset = new Date(2000, 6, 1).getTimezoneOffset();
      var winterOffset = start.getTimezoneOffset();
      var dst = (summerOffset != winterOffset && date.getTimezoneOffset() == Math.min(winterOffset, summerOffset))|0;
      HEAP32[(((tmPtr)+(32))>>2)]=dst;
  
      var zonePtr = HEAP32[(((_tzname)+(dst ? 4 : 0))>>2)];
      HEAP32[(((tmPtr)+(40))>>2)]=zonePtr;
  
      return tmPtr;
    }function _localtime(time) {
      return _localtime_r(time, ___tm_current);
    }

  
  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
      return dest;
    } 

   

   

  function _pthread_mutex_destroy() {}

  function _pthread_mutex_init() {}

   

   

   

  function _sched_yield() {
      return 0;
    }

  
  var ERRNO_CODES={EPERM:1,ENOENT:2,ESRCH:3,EINTR:4,EIO:5,ENXIO:6,E2BIG:7,ENOEXEC:8,EBADF:9,ECHILD:10,EAGAIN:11,EWOULDBLOCK:11,ENOMEM:12,EACCES:13,EFAULT:14,ENOTBLK:15,EBUSY:16,EEXIST:17,EXDEV:18,ENODEV:19,ENOTDIR:20,EISDIR:21,EINVAL:22,ENFILE:23,EMFILE:24,ENOTTY:25,ETXTBSY:26,EFBIG:27,ENOSPC:28,ESPIPE:29,EROFS:30,EMLINK:31,EPIPE:32,EDOM:33,ERANGE:34,ENOMSG:42,EIDRM:43,ECHRNG:44,EL2NSYNC:45,EL3HLT:46,EL3RST:47,ELNRNG:48,EUNATCH:49,ENOCSI:50,EL2HLT:51,EDEADLK:35,ENOLCK:37,EBADE:52,EBADR:53,EXFULL:54,ENOANO:55,EBADRQC:56,EBADSLT:57,EDEADLOCK:35,EBFONT:59,ENOSTR:60,ENODATA:61,ETIME:62,ENOSR:63,ENONET:64,ENOPKG:65,EREMOTE:66,ENOLINK:67,EADV:68,ESRMNT:69,ECOMM:70,EPROTO:71,EMULTIHOP:72,EDOTDOT:73,EBADMSG:74,ENOTUNIQ:76,EBADFD:77,EREMCHG:78,ELIBACC:79,ELIBBAD:80,ELIBSCN:81,ELIBMAX:82,ELIBEXEC:83,ENOSYS:38,ENOTEMPTY:39,ENAMETOOLONG:36,ELOOP:40,EOPNOTSUPP:95,EPFNOSUPPORT:96,ECONNRESET:104,ENOBUFS:105,EAFNOSUPPORT:97,EPROTOTYPE:91,ENOTSOCK:88,ENOPROTOOPT:92,ESHUTDOWN:108,ECONNREFUSED:111,EADDRINUSE:98,ECONNABORTED:103,ENETUNREACH:101,ENETDOWN:100,ETIMEDOUT:110,EHOSTDOWN:112,EHOSTUNREACH:113,EINPROGRESS:115,EALREADY:114,EDESTADDRREQ:89,EMSGSIZE:90,EPROTONOSUPPORT:93,ESOCKTNOSUPPORT:94,EADDRNOTAVAIL:99,ENETRESET:102,EISCONN:106,ENOTCONN:107,ETOOMANYREFS:109,EUSERS:87,EDQUOT:122,ESTALE:116,ENOTSUP:95,ENOMEDIUM:123,EILSEQ:84,EOVERFLOW:75,ECANCELED:125,ENOTRECOVERABLE:131,EOWNERDEAD:130,ESTRPIPE:86};function _sysconf(name) {
      // long sysconf(int name);
      // http://pubs.opengroup.org/onlinepubs/009695399/functions/sysconf.html
      switch(name) {
        case 30: return PAGE_SIZE;
        case 85:
          var maxHeapSize = 2*1024*1024*1024 - 65536;
          maxHeapSize = HEAPU8.length;
          return maxHeapSize / PAGE_SIZE;
        case 132:
        case 133:
        case 12:
        case 137:
        case 138:
        case 15:
        case 235:
        case 16:
        case 17:
        case 18:
        case 19:
        case 20:
        case 149:
        case 13:
        case 10:
        case 236:
        case 153:
        case 9:
        case 21:
        case 22:
        case 159:
        case 154:
        case 14:
        case 77:
        case 78:
        case 139:
        case 80:
        case 81:
        case 82:
        case 68:
        case 67:
        case 164:
        case 11:
        case 29:
        case 47:
        case 48:
        case 95:
        case 52:
        case 51:
        case 46:
          return 200809;
        case 79:
          return 0;
        case 27:
        case 246:
        case 127:
        case 128:
        case 23:
        case 24:
        case 160:
        case 161:
        case 181:
        case 182:
        case 242:
        case 183:
        case 184:
        case 243:
        case 244:
        case 245:
        case 165:
        case 178:
        case 179:
        case 49:
        case 50:
        case 168:
        case 169:
        case 175:
        case 170:
        case 171:
        case 172:
        case 97:
        case 76:
        case 32:
        case 173:
        case 35:
          return -1;
        case 176:
        case 177:
        case 7:
        case 155:
        case 8:
        case 157:
        case 125:
        case 126:
        case 92:
        case 93:
        case 129:
        case 130:
        case 131:
        case 94:
        case 91:
          return 1;
        case 74:
        case 60:
        case 69:
        case 70:
        case 4:
          return 1024;
        case 31:
        case 42:
        case 72:
          return 32;
        case 87:
        case 26:
        case 33:
          return 2147483647;
        case 34:
        case 1:
          return 47839;
        case 38:
        case 36:
          return 99;
        case 43:
        case 37:
          return 2048;
        case 0: return 2097152;
        case 3: return 65536;
        case 28: return 32768;
        case 44: return 32767;
        case 75: return 16384;
        case 39: return 1000;
        case 89: return 700;
        case 71: return 256;
        case 40: return 255;
        case 2: return 100;
        case 180: return 64;
        case 25: return 20;
        case 5: return 16;
        case 6: return 6;
        case 73: return 4;
        case 84: {
          if (typeof navigator === 'object') return navigator['hardwareConcurrency'] || 1;
          return 1;
        }
      }
      ___setErrNo(ERRNO_CODES.EINVAL);
      return -1;
    }

  function _time(ptr) {
      var ret = (Date.now()/1000)|0;
      if (ptr) {
        HEAP32[((ptr)>>2)]=ret;
      }
      return ret;
    }

  function _usleep(useconds) {
      // int usleep(useconds_t useconds);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/usleep.html
      // We're single-threaded, so use a busy loop. Super-ugly.
      var msec = useconds / 1000;
      if ((ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && self['performance'] && self['performance']['now']) {
        var start = self['performance']['now']();
        while (self['performance']['now']() - start < msec) {
          // Do nothing.
        }
      } else {
        var start = Date.now();
        while (Date.now() - start < msec) {
          // Do nothing.
        }
      }
      return 0;
    }

  function _utime(path, times) {
      // int utime(const char *path, const struct utimbuf *times);
      // http://pubs.opengroup.org/onlinepubs/009695399/basedefs/utime.h.html
      var time;
      if (times) {
        // NOTE: We don't keep track of access timestamps.
        var offset = 4;
        time = HEAP32[(((times)+(offset))>>2)];
        time *= 1000;
      } else {
        time = Date.now();
      }
      path = Pointer_stringify(path);
      try {
        FS.utime(path, time, time);
        return 0;
      } catch (e) {
        FS.handleFSError(e);
        return -1;
      }
    }
___buildEnvironment(ENV);;
Module["requestFullScreen"] = function Module_requestFullScreen(lockPointer, resizeCanvas, vrDevice) { Module.printErr("Module.requestFullScreen is deprecated. Please call Module.requestFullscreen instead."); Module["requestFullScreen"] = Module["requestFullscreen"]; Browser.requestFullScreen(lockPointer, resizeCanvas, vrDevice) };
  Module["requestFullscreen"] = function Module_requestFullscreen(lockPointer, resizeCanvas, vrDevice) { Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice) };
  Module["requestAnimationFrame"] = function Module_requestAnimationFrame(func) { Browser.requestAnimationFrame(func) };
  Module["setCanvasSize"] = function Module_setCanvasSize(width, height, noUpdates) { Browser.setCanvasSize(width, height, noUpdates) };
  Module["pauseMainLoop"] = function Module_pauseMainLoop() { Browser.mainLoop.pause() };
  Module["resumeMainLoop"] = function Module_resumeMainLoop() { Browser.mainLoop.resume() };
  Module["getUserMedia"] = function Module_getUserMedia() { Browser.getUserMedia() }
  Module["createContext"] = function Module_createContext(canvas, useWebGL, setInModule, webGLContextAttributes) { return Browser.createContext(canvas, useWebGL, setInModule, webGLContextAttributes) };
if (ENVIRONMENT_IS_NODE) {
    _emscripten_get_now = function _emscripten_get_now_actual() {
      var t = process['hrtime']();
      return t[0] * 1e3 + t[1] / 1e6;
    };
  } else if (typeof dateNow !== 'undefined') {
    _emscripten_get_now = dateNow;
  } else if (typeof self === 'object' && self['performance'] && typeof self['performance']['now'] === 'function') {
    _emscripten_get_now = function() { return self['performance']['now'](); };
  } else if (typeof performance === 'object' && typeof performance['now'] === 'function') {
    _emscripten_get_now = function() { return performance['now'](); };
  } else {
    _emscripten_get_now = Date.now;
  };
DYNAMICTOP_PTR = staticAlloc(4);

STACK_BASE = STACKTOP = alignMemory(STATICTOP);

STACK_MAX = STACK_BASE + TOTAL_STACK;

DYNAMIC_BASE = alignMemory(STACK_MAX);

HEAP32[DYNAMICTOP_PTR>>2] = DYNAMIC_BASE;

staticSealed = true; // seal the static portion of memory

assert(DYNAMIC_BASE < TOTAL_MEMORY, "TOTAL_MEMORY not big enough for stack");

var ASSERTIONS = true;

/** @type {function(string, boolean=, number=)} */
function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      if (ASSERTIONS) {
        assert(false, 'Character code ' + chr + ' (' + String.fromCharCode(chr) + ')  at offset ' + i + ' not in 0x00-0xFF.');
      }
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}



function nullFunc_di(x) { Module["printErr"]("Invalid function pointer called with signature 'di'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_dii(x) { Module["printErr"]("Invalid function pointer called with signature 'dii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_i(x) { Module["printErr"]("Invalid function pointer called with signature 'i'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_ii(x) { Module["printErr"]("Invalid function pointer called with signature 'ii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iii(x) { Module["printErr"]("Invalid function pointer called with signature 'iii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiid(x) { Module["printErr"]("Invalid function pointer called with signature 'iiid'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiii(x) { Module["printErr"]("Invalid function pointer called with signature 'iiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiiii(x) { Module["printErr"]("Invalid function pointer called with signature 'iiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiiiii(x) { Module["printErr"]("Invalid function pointer called with signature 'iiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiiiiii(x) { Module["printErr"]("Invalid function pointer called with signature 'iiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiiiiiiii(x) { Module["printErr"]("Invalid function pointer called with signature 'iiiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiiiiiiiii(x) { Module["printErr"]("Invalid function pointer called with signature 'iiiiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiiiijii(x) { Module["printErr"]("Invalid function pointer called with signature 'iiiiijii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiiij(x) { Module["printErr"]("Invalid function pointer called with signature 'iiiij'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiiiji(x) { Module["printErr"]("Invalid function pointer called with signature 'iiiiji'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiiijii(x) { Module["printErr"]("Invalid function pointer called with signature 'iiiijii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiij(x) { Module["printErr"]("Invalid function pointer called with signature 'iiij'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iij(x) { Module["printErr"]("Invalid function pointer called with signature 'iij'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiji(x) { Module["printErr"]("Invalid function pointer called with signature 'iiji'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iijii(x) { Module["printErr"]("Invalid function pointer called with signature 'iijii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_ij(x) { Module["printErr"]("Invalid function pointer called with signature 'ij'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_j(x) { Module["printErr"]("Invalid function pointer called with signature 'j'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_ji(x) { Module["printErr"]("Invalid function pointer called with signature 'ji'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_jii(x) { Module["printErr"]("Invalid function pointer called with signature 'jii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_jiij(x) { Module["printErr"]("Invalid function pointer called with signature 'jiij'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_jj(x) { Module["printErr"]("Invalid function pointer called with signature 'jj'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_v(x) { Module["printErr"]("Invalid function pointer called with signature 'v'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_vi(x) { Module["printErr"]("Invalid function pointer called with signature 'vi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_vid(x) { Module["printErr"]("Invalid function pointer called with signature 'vid'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_vii(x) { Module["printErr"]("Invalid function pointer called with signature 'vii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viii(x) { Module["printErr"]("Invalid function pointer called with signature 'viii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viiii(x) { Module["printErr"]("Invalid function pointer called with signature 'viiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viiiii(x) { Module["printErr"]("Invalid function pointer called with signature 'viiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viiiiii(x) { Module["printErr"]("Invalid function pointer called with signature 'viiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viiiij(x) { Module["printErr"]("Invalid function pointer called with signature 'viiiij'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viij(x) { Module["printErr"]("Invalid function pointer called with signature 'viij'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viiji(x) { Module["printErr"]("Invalid function pointer called with signature 'viiji'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viijii(x) { Module["printErr"]("Invalid function pointer called with signature 'viijii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viijiiiii(x) { Module["printErr"]("Invalid function pointer called with signature 'viijiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_vij(x) { Module["printErr"]("Invalid function pointer called with signature 'vij'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viji(x) { Module["printErr"]("Invalid function pointer called with signature 'viji'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

Module['wasmTableSize'] = 24640;

Module['wasmMaxTableSize'] = 24640;

function invoke_di(index,a1) {
  try {
    return Module["dynCall_di"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_di(index,a1) {
    return functionPointers[index](a1);
}

function invoke_dii(index,a1,a2) {
  try {
    return Module["dynCall_dii"](index,a1,a2);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_dii(index,a1,a2) {
    return functionPointers[index](a1,a2);
}

function invoke_i(index) {
  try {
    return Module["dynCall_i"](index);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_i(index) {
    return functionPointers[index]();
}

function invoke_ii(index,a1) {
  try {
    return Module["dynCall_ii"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_ii(index,a1) {
    return functionPointers[index](a1);
}

function invoke_iii(index,a1,a2) {
  try {
    return Module["dynCall_iii"](index,a1,a2);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_iii(index,a1,a2) {
    return functionPointers[index](a1,a2);
}

function invoke_iiid(index,a1,a2,a3) {
  try {
    return Module["dynCall_iiid"](index,a1,a2,a3);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_iiid(index,a1,a2,a3) {
    return functionPointers[index](a1,a2,a3);
}

function invoke_iiii(index,a1,a2,a3) {
  try {
    return Module["dynCall_iiii"](index,a1,a2,a3);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_iiii(index,a1,a2,a3) {
    return functionPointers[index](a1,a2,a3);
}

function invoke_iiiii(index,a1,a2,a3,a4) {
  try {
    return Module["dynCall_iiiii"](index,a1,a2,a3,a4);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_iiiii(index,a1,a2,a3,a4) {
    return functionPointers[index](a1,a2,a3,a4);
}

function invoke_iiiiii(index,a1,a2,a3,a4,a5) {
  try {
    return Module["dynCall_iiiiii"](index,a1,a2,a3,a4,a5);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_iiiiii(index,a1,a2,a3,a4,a5) {
    return functionPointers[index](a1,a2,a3,a4,a5);
}

function invoke_iiiiiii(index,a1,a2,a3,a4,a5,a6) {
  try {
    return Module["dynCall_iiiiiii"](index,a1,a2,a3,a4,a5,a6);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_iiiiiii(index,a1,a2,a3,a4,a5,a6) {
    return functionPointers[index](a1,a2,a3,a4,a5,a6);
}

function invoke_iiiiiiiii(index,a1,a2,a3,a4,a5,a6,a7,a8) {
  try {
    return Module["dynCall_iiiiiiiii"](index,a1,a2,a3,a4,a5,a6,a7,a8);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_iiiiiiiii(index,a1,a2,a3,a4,a5,a6,a7,a8) {
    return functionPointers[index](a1,a2,a3,a4,a5,a6,a7,a8);
}

function invoke_iiiiiiiiii(index,a1,a2,a3,a4,a5,a6,a7,a8,a9) {
  try {
    return Module["dynCall_iiiiiiiiii"](index,a1,a2,a3,a4,a5,a6,a7,a8,a9);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_iiiiiiiiii(index,a1,a2,a3,a4,a5,a6,a7,a8,a9) {
    return functionPointers[index](a1,a2,a3,a4,a5,a6,a7,a8,a9);
}

function invoke_iiiiijii(index,a1,a2,a3,a4,a5,a6,a7,a8) {
  try {
    return Module["dynCall_iiiiijii"](index,a1,a2,a3,a4,a5,a6,a7,a8);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_iiiiijii(index,a1,a2,a3,a4,a5,a6,a7) {
    return functionPointers[index](a1,a2,a3,a4,a5,a6,a7);
}

function invoke_iiiij(index,a1,a2,a3,a4,a5) {
  try {
    return Module["dynCall_iiiij"](index,a1,a2,a3,a4,a5);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_iiiij(index,a1,a2,a3,a4) {
    return functionPointers[index](a1,a2,a3,a4);
}

function invoke_iiiiji(index,a1,a2,a3,a4,a5,a6) {
  try {
    return Module["dynCall_iiiiji"](index,a1,a2,a3,a4,a5,a6);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_iiiiji(index,a1,a2,a3,a4,a5) {
    return functionPointers[index](a1,a2,a3,a4,a5);
}

function invoke_iiiijii(index,a1,a2,a3,a4,a5,a6,a7) {
  try {
    return Module["dynCall_iiiijii"](index,a1,a2,a3,a4,a5,a6,a7);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_iiiijii(index,a1,a2,a3,a4,a5,a6) {
    return functionPointers[index](a1,a2,a3,a4,a5,a6);
}

function invoke_iiij(index,a1,a2,a3,a4) {
  try {
    return Module["dynCall_iiij"](index,a1,a2,a3,a4);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_iiij(index,a1,a2,a3) {
    return functionPointers[index](a1,a2,a3);
}

function invoke_iij(index,a1,a2,a3) {
  try {
    return Module["dynCall_iij"](index,a1,a2,a3);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_iij(index,a1,a2) {
    return functionPointers[index](a1,a2);
}

function invoke_iiji(index,a1,a2,a3,a4) {
  try {
    return Module["dynCall_iiji"](index,a1,a2,a3,a4);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_iiji(index,a1,a2,a3) {
    return functionPointers[index](a1,a2,a3);
}

function invoke_iijii(index,a1,a2,a3,a4,a5) {
  try {
    return Module["dynCall_iijii"](index,a1,a2,a3,a4,a5);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_iijii(index,a1,a2,a3,a4) {
    return functionPointers[index](a1,a2,a3,a4);
}

function invoke_ij(index,a1,a2) {
  try {
    return Module["dynCall_ij"](index,a1,a2);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_ij(index,a1) {
    return functionPointers[index](a1);
}

function invoke_j(index) {
  try {
    return Module["dynCall_j"](index);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_j(index) {
    return functionPointers[index]();
}

function invoke_ji(index,a1) {
  try {
    return Module["dynCall_ji"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_ji(index,a1) {
    return functionPointers[index](a1);
}

function invoke_jii(index,a1,a2) {
  try {
    return Module["dynCall_jii"](index,a1,a2);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_jii(index,a1,a2) {
    return functionPointers[index](a1,a2);
}

function invoke_jiij(index,a1,a2,a3,a4) {
  try {
    return Module["dynCall_jiij"](index,a1,a2,a3,a4);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_jiij(index,a1,a2,a3) {
    return functionPointers[index](a1,a2,a3);
}

function invoke_jj(index,a1,a2) {
  try {
    return Module["dynCall_jj"](index,a1,a2);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_jj(index,a1) {
    return functionPointers[index](a1);
}

function invoke_v(index) {
  try {
    Module["dynCall_v"](index);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_v(index) {
    functionPointers[index]();
}

function invoke_vi(index,a1) {
  try {
    Module["dynCall_vi"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_vi(index,a1) {
    functionPointers[index](a1);
}

function invoke_vid(index,a1,a2) {
  try {
    Module["dynCall_vid"](index,a1,a2);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_vid(index,a1,a2) {
    functionPointers[index](a1,a2);
}

function invoke_vii(index,a1,a2) {
  try {
    Module["dynCall_vii"](index,a1,a2);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_vii(index,a1,a2) {
    functionPointers[index](a1,a2);
}

function invoke_viii(index,a1,a2,a3) {
  try {
    Module["dynCall_viii"](index,a1,a2,a3);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_viii(index,a1,a2,a3) {
    functionPointers[index](a1,a2,a3);
}

function invoke_viiii(index,a1,a2,a3,a4) {
  try {
    Module["dynCall_viiii"](index,a1,a2,a3,a4);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_viiii(index,a1,a2,a3,a4) {
    functionPointers[index](a1,a2,a3,a4);
}

function invoke_viiiii(index,a1,a2,a3,a4,a5) {
  try {
    Module["dynCall_viiiii"](index,a1,a2,a3,a4,a5);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_viiiii(index,a1,a2,a3,a4,a5) {
    functionPointers[index](a1,a2,a3,a4,a5);
}

function invoke_viiiiii(index,a1,a2,a3,a4,a5,a6) {
  try {
    Module["dynCall_viiiiii"](index,a1,a2,a3,a4,a5,a6);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_viiiiii(index,a1,a2,a3,a4,a5,a6) {
    functionPointers[index](a1,a2,a3,a4,a5,a6);
}

function invoke_viiiij(index,a1,a2,a3,a4,a5,a6) {
  try {
    Module["dynCall_viiiij"](index,a1,a2,a3,a4,a5,a6);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_viiiij(index,a1,a2,a3,a4,a5) {
    functionPointers[index](a1,a2,a3,a4,a5);
}

function invoke_viij(index,a1,a2,a3,a4) {
  try {
    Module["dynCall_viij"](index,a1,a2,a3,a4);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_viij(index,a1,a2,a3) {
    functionPointers[index](a1,a2,a3);
}

function invoke_viiji(index,a1,a2,a3,a4,a5) {
  try {
    Module["dynCall_viiji"](index,a1,a2,a3,a4,a5);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_viiji(index,a1,a2,a3,a4) {
    functionPointers[index](a1,a2,a3,a4);
}

function invoke_viijii(index,a1,a2,a3,a4,a5,a6) {
  try {
    Module["dynCall_viijii"](index,a1,a2,a3,a4,a5,a6);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_viijii(index,a1,a2,a3,a4,a5) {
    functionPointers[index](a1,a2,a3,a4,a5);
}

function invoke_viijiiiii(index,a1,a2,a3,a4,a5,a6,a7,a8,a9) {
  try {
    Module["dynCall_viijiiiii"](index,a1,a2,a3,a4,a5,a6,a7,a8,a9);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_viijiiiii(index,a1,a2,a3,a4,a5,a6,a7,a8) {
    functionPointers[index](a1,a2,a3,a4,a5,a6,a7,a8);
}

function invoke_vij(index,a1,a2,a3) {
  try {
    Module["dynCall_vij"](index,a1,a2,a3);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_vij(index,a1,a2) {
    functionPointers[index](a1,a2);
}

function invoke_viji(index,a1,a2,a3,a4) {
  try {
    Module["dynCall_viji"](index,a1,a2,a3,a4);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function jsCall_viji(index,a1,a2,a3) {
    functionPointers[index](a1,a2,a3);
}

Module.asmGlobalArg = {};

Module.asmLibraryArg = { "abort": abort, "assert": assert, "enlargeMemory": enlargeMemory, "getTotalMemory": getTotalMemory, "abortOnCannotGrowMemory": abortOnCannotGrowMemory, "abortStackOverflow": abortStackOverflow, "nullFunc_di": nullFunc_di, "nullFunc_dii": nullFunc_dii, "nullFunc_i": nullFunc_i, "nullFunc_ii": nullFunc_ii, "nullFunc_iii": nullFunc_iii, "nullFunc_iiid": nullFunc_iiid, "nullFunc_iiii": nullFunc_iiii, "nullFunc_iiiii": nullFunc_iiiii, "nullFunc_iiiiii": nullFunc_iiiiii, "nullFunc_iiiiiii": nullFunc_iiiiiii, "nullFunc_iiiiiiiii": nullFunc_iiiiiiiii, "nullFunc_iiiiiiiiii": nullFunc_iiiiiiiiii, "nullFunc_iiiiijii": nullFunc_iiiiijii, "nullFunc_iiiij": nullFunc_iiiij, "nullFunc_iiiiji": nullFunc_iiiiji, "nullFunc_iiiijii": nullFunc_iiiijii, "nullFunc_iiij": nullFunc_iiij, "nullFunc_iij": nullFunc_iij, "nullFunc_iiji": nullFunc_iiji, "nullFunc_iijii": nullFunc_iijii, "nullFunc_ij": nullFunc_ij, "nullFunc_j": nullFunc_j, "nullFunc_ji": nullFunc_ji, "nullFunc_jii": nullFunc_jii, "nullFunc_jiij": nullFunc_jiij, "nullFunc_jj": nullFunc_jj, "nullFunc_v": nullFunc_v, "nullFunc_vi": nullFunc_vi, "nullFunc_vid": nullFunc_vid, "nullFunc_vii": nullFunc_vii, "nullFunc_viii": nullFunc_viii, "nullFunc_viiii": nullFunc_viiii, "nullFunc_viiiii": nullFunc_viiiii, "nullFunc_viiiiii": nullFunc_viiiiii, "nullFunc_viiiij": nullFunc_viiiij, "nullFunc_viij": nullFunc_viij, "nullFunc_viiji": nullFunc_viiji, "nullFunc_viijii": nullFunc_viijii, "nullFunc_viijiiiii": nullFunc_viijiiiii, "nullFunc_vij": nullFunc_vij, "nullFunc_viji": nullFunc_viji, "invoke_di": invoke_di, "jsCall_di": jsCall_di, "invoke_dii": invoke_dii, "jsCall_dii": jsCall_dii, "invoke_i": invoke_i, "jsCall_i": jsCall_i, "invoke_ii": invoke_ii, "jsCall_ii": jsCall_ii, "invoke_iii": invoke_iii, "jsCall_iii": jsCall_iii, "invoke_iiid": invoke_iiid, "jsCall_iiid": jsCall_iiid, "invoke_iiii": invoke_iiii, "jsCall_iiii": jsCall_iiii, "invoke_iiiii": invoke_iiiii, "jsCall_iiiii": jsCall_iiiii, "invoke_iiiiii": invoke_iiiiii, "jsCall_iiiiii": jsCall_iiiiii, "invoke_iiiiiii": invoke_iiiiiii, "jsCall_iiiiiii": jsCall_iiiiiii, "invoke_iiiiiiiii": invoke_iiiiiiiii, "jsCall_iiiiiiiii": jsCall_iiiiiiiii, "invoke_iiiiiiiiii": invoke_iiiiiiiiii, "jsCall_iiiiiiiiii": jsCall_iiiiiiiiii, "invoke_iiiiijii": invoke_iiiiijii, "jsCall_iiiiijii": jsCall_iiiiijii, "invoke_iiiij": invoke_iiiij, "jsCall_iiiij": jsCall_iiiij, "invoke_iiiiji": invoke_iiiiji, "jsCall_iiiiji": jsCall_iiiiji, "invoke_iiiijii": invoke_iiiijii, "jsCall_iiiijii": jsCall_iiiijii, "invoke_iiij": invoke_iiij, "jsCall_iiij": jsCall_iiij, "invoke_iij": invoke_iij, "jsCall_iij": jsCall_iij, "invoke_iiji": invoke_iiji, "jsCall_iiji": jsCall_iiji, "invoke_iijii": invoke_iijii, "jsCall_iijii": jsCall_iijii, "invoke_ij": invoke_ij, "jsCall_ij": jsCall_ij, "invoke_j": invoke_j, "jsCall_j": jsCall_j, "invoke_ji": invoke_ji, "jsCall_ji": jsCall_ji, "invoke_jii": invoke_jii, "jsCall_jii": jsCall_jii, "invoke_jiij": invoke_jiij, "jsCall_jiij": jsCall_jiij, "invoke_jj": invoke_jj, "jsCall_jj": jsCall_jj, "invoke_v": invoke_v, "jsCall_v": jsCall_v, "invoke_vi": invoke_vi, "jsCall_vi": jsCall_vi, "invoke_vid": invoke_vid, "jsCall_vid": jsCall_vid, "invoke_vii": invoke_vii, "jsCall_vii": jsCall_vii, "invoke_viii": invoke_viii, "jsCall_viii": jsCall_viii, "invoke_viiii": invoke_viiii, "jsCall_viiii": jsCall_viiii, "invoke_viiiii": invoke_viiiii, "jsCall_viiiii": jsCall_viiiii, "invoke_viiiiii": invoke_viiiiii, "jsCall_viiiiii": jsCall_viiiiii, "invoke_viiiij": invoke_viiiij, "jsCall_viiiij": jsCall_viiiij, "invoke_viij": invoke_viij, "jsCall_viij": jsCall_viij, "invoke_viiji": invoke_viiji, "jsCall_viiji": jsCall_viiji, "invoke_viijii": invoke_viijii, "jsCall_viijii": jsCall_viijii, "invoke_viijiiiii": invoke_viijiiiii, "jsCall_viijiiiii": jsCall_viijiiiii, "invoke_vij": invoke_vij, "jsCall_vij": jsCall_vij, "invoke_viji": invoke_viji, "jsCall_viji": jsCall_viji, "___assert_fail": ___assert_fail, "___buildEnvironment": ___buildEnvironment, "___cxa_pure_virtual": ___cxa_pure_virtual, "___lock": ___lock, "___setErrNo": ___setErrNo, "___syscall10": ___syscall10, "___syscall118": ___syscall118, "___syscall140": ___syscall140, "___syscall146": ___syscall146, "___syscall15": ___syscall15, "___syscall183": ___syscall183, "___syscall192": ___syscall192, "___syscall194": ___syscall194, "___syscall195": ___syscall195, "___syscall196": ___syscall196, "___syscall197": ___syscall197, "___syscall20": ___syscall20, "___syscall201": ___syscall201, "___syscall202": ___syscall202, "___syscall207": ___syscall207, "___syscall212": ___syscall212, "___syscall221": ___syscall221, "___syscall3": ___syscall3, "___syscall33": ___syscall33, "___syscall39": ___syscall39, "___syscall4": ___syscall4, "___syscall40": ___syscall40, "___syscall5": ___syscall5, "___syscall54": ___syscall54, "___syscall6": ___syscall6, "___syscall85": ___syscall85, "___syscall91": ___syscall91, "___syscall94": ___syscall94, "___unlock": ___unlock, "_abort": _abort, "_dlclose": _dlclose, "_dlerror": _dlerror, "_dlopen": _dlopen, "_dlsym": _dlsym, "_emscripten_async_call": _emscripten_async_call, "_emscripten_get_now": _emscripten_get_now, "_emscripten_memcpy_big": _emscripten_memcpy_big, "_emscripten_set_main_loop": _emscripten_set_main_loop, "_emscripten_set_main_loop_timing": _emscripten_set_main_loop_timing, "_getenv": _getenv, "_gettimeofday": _gettimeofday, "_llvm_trap": _llvm_trap, "_localtime": _localtime, "_localtime_r": _localtime_r, "_pthread_mutex_destroy": _pthread_mutex_destroy, "_pthread_mutex_init": _pthread_mutex_init, "_sched_yield": _sched_yield, "_sysconf": _sysconf, "_time": _time, "_tzset": _tzset, "_usleep": _usleep, "_utime": _utime, "flush_NO_FILESYSTEM": flush_NO_FILESYSTEM, "DYNAMICTOP_PTR": DYNAMICTOP_PTR, "tempDoublePtr": tempDoublePtr, "ABORT": ABORT, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX };
// EMSCRIPTEN_START_ASM
var asm =Module["asm"]// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg, Module.asmLibraryArg, buffer);

var real__ExecuteQuery = asm["_ExecuteQuery"]; asm["_ExecuteQuery"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__ExecuteQuery.apply(null, arguments);
};

var real__Initialize = asm["_Initialize"]; asm["_Initialize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__Initialize.apply(null, arguments);
};

var real___GLOBAL__sub_I_status_cc = asm["__GLOBAL__sub_I_status_cc"]; asm["__GLOBAL__sub_I_status_cc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___GLOBAL__sub_I_status_cc.apply(null, arguments);
};

var real___ZN10__cxxabiv116__shim_type_infoD2Ev = asm["__ZN10__cxxabiv116__shim_type_infoD2Ev"]; asm["__ZN10__cxxabiv116__shim_type_infoD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN10__cxxabiv116__shim_type_infoD2Ev.apply(null, arguments);
};

var real___ZN10__cxxabiv117__class_type_infoD0Ev = asm["__ZN10__cxxabiv117__class_type_infoD0Ev"]; asm["__ZN10__cxxabiv117__class_type_infoD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN10__cxxabiv117__class_type_infoD0Ev.apply(null, arguments);
};

var real___ZN10__cxxabiv120__si_class_type_infoD0Ev = asm["__ZN10__cxxabiv120__si_class_type_infoD0Ev"]; asm["__ZN10__cxxabiv120__si_class_type_infoD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN10__cxxabiv120__si_class_type_infoD0Ev.apply(null, arguments);
};

var real___ZN10__cxxabiv121__vmi_class_type_infoD0Ev = asm["__ZN10__cxxabiv121__vmi_class_type_infoD0Ev"]; asm["__ZN10__cxxabiv121__vmi_class_type_infoD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN10__cxxabiv121__vmi_class_type_infoD0Ev.apply(null, arguments);
};

var real___ZN6google8protobuf11MessageLiteD0Ev = asm["__ZN6google8protobuf11MessageLiteD0Ev"]; asm["__ZN6google8protobuf11MessageLiteD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf11MessageLiteD0Ev.apply(null, arguments);
};

var real___ZN6google8protobuf11MessageLiteD2Ev = asm["__ZN6google8protobuf11MessageLiteD2Ev"]; asm["__ZN6google8protobuf11MessageLiteD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf11MessageLiteD2Ev.apply(null, arguments);
};

var real___ZN6google8protobuf14ResultCallbackIPNSt3__212basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEED0Ev = asm["__ZN6google8protobuf14ResultCallbackIPNSt3__212basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEED0Ev"]; asm["__ZN6google8protobuf14ResultCallbackIPNSt3__212basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEED0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf14ResultCallbackIPNSt3__212basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEED0Ev.apply(null, arguments);
};

var real___ZN6google8protobuf14ResultCallbackIPNSt3__212basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEED2Ev = asm["__ZN6google8protobuf14ResultCallbackIPNSt3__212basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEED2Ev"]; asm["__ZN6google8protobuf14ResultCallbackIPNSt3__212basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEED2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf14ResultCallbackIPNSt3__212basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEED2Ev.apply(null, arguments);
};

var real___ZN6google8protobuf2io17ArrayOutputStream4NextEPPvPi = asm["__ZN6google8protobuf2io17ArrayOutputStream4NextEPPvPi"]; asm["__ZN6google8protobuf2io17ArrayOutputStream4NextEPPvPi"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf2io17ArrayOutputStream4NextEPPvPi.apply(null, arguments);
};

var real___ZN6google8protobuf2io17ArrayOutputStream6BackUpEi = asm["__ZN6google8protobuf2io17ArrayOutputStream6BackUpEi"]; asm["__ZN6google8protobuf2io17ArrayOutputStream6BackUpEi"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf2io17ArrayOutputStream6BackUpEi.apply(null, arguments);
};

var real___ZN6google8protobuf2io17ArrayOutputStreamD0Ev = asm["__ZN6google8protobuf2io17ArrayOutputStreamD0Ev"]; asm["__ZN6google8protobuf2io17ArrayOutputStreamD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf2io17ArrayOutputStreamD0Ev.apply(null, arguments);
};

var real___ZN6google8protobuf2io17ArrayOutputStreamD2Ev = asm["__ZN6google8protobuf2io17ArrayOutputStreamD2Ev"]; asm["__ZN6google8protobuf2io17ArrayOutputStreamD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf2io17ArrayOutputStreamD2Ev.apply(null, arguments);
};

var real___ZN6google8protobuf2io18StringOutputStream4NextEPPvPi = asm["__ZN6google8protobuf2io18StringOutputStream4NextEPPvPi"]; asm["__ZN6google8protobuf2io18StringOutputStream4NextEPPvPi"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf2io18StringOutputStream4NextEPPvPi.apply(null, arguments);
};

var real___ZN6google8protobuf2io18StringOutputStream6BackUpEi = asm["__ZN6google8protobuf2io18StringOutputStream6BackUpEi"]; asm["__ZN6google8protobuf2io18StringOutputStream6BackUpEi"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf2io18StringOutputStream6BackUpEi.apply(null, arguments);
};

var real___ZN6google8protobuf2io18StringOutputStreamD0Ev = asm["__ZN6google8protobuf2io18StringOutputStreamD0Ev"]; asm["__ZN6google8protobuf2io18StringOutputStreamD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf2io18StringOutputStreamD0Ev.apply(null, arguments);
};

var real___ZN6google8protobuf2io18StringOutputStreamD2Ev = asm["__ZN6google8protobuf2io18StringOutputStreamD2Ev"]; asm["__ZN6google8protobuf2io18StringOutputStreamD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf2io18StringOutputStreamD2Ev.apply(null, arguments);
};

var real___ZN6google8protobuf2io20ZeroCopyOutputStream15WriteAliasedRawEPKvi = asm["__ZN6google8protobuf2io20ZeroCopyOutputStream15WriteAliasedRawEPKvi"]; asm["__ZN6google8protobuf2io20ZeroCopyOutputStream15WriteAliasedRawEPKvi"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf2io20ZeroCopyOutputStream15WriteAliasedRawEPKvi.apply(null, arguments);
};

var real___ZN6google8protobuf2io20ZeroCopyOutputStreamD0Ev = asm["__ZN6google8protobuf2io20ZeroCopyOutputStreamD0Ev"]; asm["__ZN6google8protobuf2io20ZeroCopyOutputStreamD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf2io20ZeroCopyOutputStreamD0Ev.apply(null, arguments);
};

var real___ZN6google8protobuf2io20ZeroCopyOutputStreamD2Ev = asm["__ZN6google8protobuf2io20ZeroCopyOutputStreamD2Ev"]; asm["__ZN6google8protobuf2io20ZeroCopyOutputStreamD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf2io20ZeroCopyOutputStreamD2Ev.apply(null, arguments);
};

var real___ZN6google8protobuf2io22LazyStringOutputStream4NextEPPvPi = asm["__ZN6google8protobuf2io22LazyStringOutputStream4NextEPPvPi"]; asm["__ZN6google8protobuf2io22LazyStringOutputStream4NextEPPvPi"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf2io22LazyStringOutputStream4NextEPPvPi.apply(null, arguments);
};

var real___ZN6google8protobuf2io22LazyStringOutputStreamD0Ev = asm["__ZN6google8protobuf2io22LazyStringOutputStreamD0Ev"]; asm["__ZN6google8protobuf2io22LazyStringOutputStreamD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf2io22LazyStringOutputStreamD0Ev.apply(null, arguments);
};

var real___ZN6google8protobuf2io22LazyStringOutputStreamD2Ev = asm["__ZN6google8protobuf2io22LazyStringOutputStreamD2Ev"]; asm["__ZN6google8protobuf2io22LazyStringOutputStreamD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf2io22LazyStringOutputStreamD2Ev.apply(null, arguments);
};

var real___ZN6google8protobuf7ClosureD0Ev = asm["__ZN6google8protobuf7ClosureD0Ev"]; asm["__ZN6google8protobuf7ClosureD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf7ClosureD0Ev.apply(null, arguments);
};

var real___ZN6google8protobuf7ClosureD2Ev = asm["__ZN6google8protobuf7ClosureD2Ev"]; asm["__ZN6google8protobuf7ClosureD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf7ClosureD2Ev.apply(null, arguments);
};

var real___ZN6google8protobuf8internal15InitEmptyStringEv = asm["__ZN6google8protobuf8internal15InitEmptyStringEv"]; asm["__ZN6google8protobuf8internal15InitEmptyStringEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf8internal15InitEmptyStringEv.apply(null, arguments);
};

var real___ZN6google8protobuf8internal16FunctionClosure03RunEv = asm["__ZN6google8protobuf8internal16FunctionClosure03RunEv"]; asm["__ZN6google8protobuf8internal16FunctionClosure03RunEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf8internal16FunctionClosure03RunEv.apply(null, arguments);
};

var real___ZN6google8protobuf8internal16FunctionClosure0D0Ev = asm["__ZN6google8protobuf8internal16FunctionClosure0D0Ev"]; asm["__ZN6google8protobuf8internal16FunctionClosure0D0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf8internal16FunctionClosure0D0Ev.apply(null, arguments);
};

var real___ZN6google8protobuf8internal16FunctionClosure0D2Ev = asm["__ZN6google8protobuf8internal16FunctionClosure0D2Ev"]; asm["__ZN6google8protobuf8internal16FunctionClosure0D2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf8internal16FunctionClosure0D2Ev.apply(null, arguments);
};

var real___ZN6google8protobuf8internal17DeleteEmptyStringEv = asm["__ZN6google8protobuf8internal17DeleteEmptyStringEv"]; asm["__ZN6google8protobuf8internal17DeleteEmptyStringEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf8internal17DeleteEmptyStringEv.apply(null, arguments);
};

var real___ZN6google8protobuf8internal19arena_delete_objectIN8perfetto6protos12RawQueryArgsEEEvPv = asm["__ZN6google8protobuf8internal19arena_delete_objectIN8perfetto6protos12RawQueryArgsEEEvPv"]; asm["__ZN6google8protobuf8internal19arena_delete_objectIN8perfetto6protos12RawQueryArgsEEEvPv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf8internal19arena_delete_objectIN8perfetto6protos12RawQueryArgsEEEvPv.apply(null, arguments);
};

var real___ZN6google8protobuf8internal19arena_delete_objectIN8perfetto6protos14RawQueryResultEEEvPv = asm["__ZN6google8protobuf8internal19arena_delete_objectIN8perfetto6protos14RawQueryResultEEEvPv"]; asm["__ZN6google8protobuf8internal19arena_delete_objectIN8perfetto6protos14RawQueryResultEEEvPv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf8internal19arena_delete_objectIN8perfetto6protos14RawQueryResultEEEvPv.apply(null, arguments);
};

var real___ZN6google8protobuf8internal19arena_delete_objectIN8perfetto6protos25RawQueryResult_ColumnDescEEEvPv = asm["__ZN6google8protobuf8internal19arena_delete_objectIN8perfetto6protos25RawQueryResult_ColumnDescEEEvPv"]; asm["__ZN6google8protobuf8internal19arena_delete_objectIN8perfetto6protos25RawQueryResult_ColumnDescEEEvPv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf8internal19arena_delete_objectIN8perfetto6protos25RawQueryResult_ColumnDescEEEvPv.apply(null, arguments);
};

var real___ZN6google8protobuf8internal19arena_delete_objectIN8perfetto6protos27RawQueryResult_ColumnValuesEEEvPv = asm["__ZN6google8protobuf8internal19arena_delete_objectIN8perfetto6protos27RawQueryResult_ColumnValuesEEEvPv"]; asm["__ZN6google8protobuf8internal19arena_delete_objectIN8perfetto6protos27RawQueryResult_ColumnValuesEEEvPv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf8internal19arena_delete_objectIN8perfetto6protos27RawQueryResult_ColumnValuesEEEvPv.apply(null, arguments);
};

var real___ZN6google8protobuf8internal19arena_delete_objectINS0_11MessageLiteEEEvPv = asm["__ZN6google8protobuf8internal19arena_delete_objectINS0_11MessageLiteEEEvPv"]; asm["__ZN6google8protobuf8internal19arena_delete_objectINS0_11MessageLiteEEEvPv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf8internal19arena_delete_objectINS0_11MessageLiteEEEvPv.apply(null, arguments);
};

var real___ZN6google8protobuf8internal20InitLogSilencerCountEv = asm["__ZN6google8protobuf8internal20InitLogSilencerCountEv"]; asm["__ZN6google8protobuf8internal20InitLogSilencerCountEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf8internal20InitLogSilencerCountEv.apply(null, arguments);
};

var real___ZN6google8protobuf8internal20RepeatedPtrFieldBase18MergeFromInnerLoopINS0_16RepeatedPtrFieldIN8perfetto6protos25RawQueryResult_ColumnDescEE11TypeHandlerEEEvPPvSB_ii = asm["__ZN6google8protobuf8internal20RepeatedPtrFieldBase18MergeFromInnerLoopINS0_16RepeatedPtrFieldIN8perfetto6protos25RawQueryResult_ColumnDescEE11TypeHandlerEEEvPPvSB_ii"]; asm["__ZN6google8protobuf8internal20RepeatedPtrFieldBase18MergeFromInnerLoopINS0_16RepeatedPtrFieldIN8perfetto6protos25RawQueryResult_ColumnDescEE11TypeHandlerEEEvPPvSB_ii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf8internal20RepeatedPtrFieldBase18MergeFromInnerLoopINS0_16RepeatedPtrFieldIN8perfetto6protos25RawQueryResult_ColumnDescEE11TypeHandlerEEEvPPvSB_ii.apply(null, arguments);
};

var real___ZN6google8protobuf8internal20RepeatedPtrFieldBase18MergeFromInnerLoopINS0_16RepeatedPtrFieldIN8perfetto6protos27RawQueryResult_ColumnValuesEE11TypeHandlerEEEvPPvSB_ii = asm["__ZN6google8protobuf8internal20RepeatedPtrFieldBase18MergeFromInnerLoopINS0_16RepeatedPtrFieldIN8perfetto6protos27RawQueryResult_ColumnValuesEE11TypeHandlerEEEvPPvSB_ii"]; asm["__ZN6google8protobuf8internal20RepeatedPtrFieldBase18MergeFromInnerLoopINS0_16RepeatedPtrFieldIN8perfetto6protos27RawQueryResult_ColumnValuesEE11TypeHandlerEEEvPPvSB_ii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf8internal20RepeatedPtrFieldBase18MergeFromInnerLoopINS0_16RepeatedPtrFieldIN8perfetto6protos27RawQueryResult_ColumnValuesEE11TypeHandlerEEEvPPvSB_ii.apply(null, arguments);
};

var real___ZN6google8protobuf8internal21InitShutdownFunctionsEv = asm["__ZN6google8protobuf8internal21InitShutdownFunctionsEv"]; asm["__ZN6google8protobuf8internal21InitShutdownFunctionsEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf8internal21InitShutdownFunctionsEv.apply(null, arguments);
};

var real___ZN6google8protobuf8internal21arena_destruct_objectIN8perfetto6protos25RawQueryResult_ColumnDescEEEvPv = asm["__ZN6google8protobuf8internal21arena_destruct_objectIN8perfetto6protos25RawQueryResult_ColumnDescEEEvPv"]; asm["__ZN6google8protobuf8internal21arena_destruct_objectIN8perfetto6protos25RawQueryResult_ColumnDescEEEvPv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf8internal21arena_destruct_objectIN8perfetto6protos25RawQueryResult_ColumnDescEEEvPv.apply(null, arguments);
};

var real___ZN6google8protobuf8internal21arena_destruct_objectIN8perfetto6protos27RawQueryResult_ColumnValuesEEEvPv = asm["__ZN6google8protobuf8internal21arena_destruct_objectIN8perfetto6protos27RawQueryResult_ColumnValuesEEEvPv"]; asm["__ZN6google8protobuf8internal21arena_destruct_objectIN8perfetto6protos27RawQueryResult_ColumnValuesEEEvPv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf8internal21arena_destruct_objectIN8perfetto6protos27RawQueryResult_ColumnValuesEEEvPv.apply(null, arguments);
};

var real___ZN6google8protobuf8internal22DeleteLogSilencerCountEv = asm["__ZN6google8protobuf8internal22DeleteLogSilencerCountEv"]; asm["__ZN6google8protobuf8internal22DeleteLogSilencerCountEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf8internal22DeleteLogSilencerCountEv.apply(null, arguments);
};

var real___ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos12RawQueryArgsEE3RunEv = asm["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos12RawQueryArgsEE3RunEv"]; asm["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos12RawQueryArgsEE3RunEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos12RawQueryArgsEE3RunEv.apply(null, arguments);
};

var real___ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos12RawQueryArgsEED0Ev = asm["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos12RawQueryArgsEED0Ev"]; asm["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos12RawQueryArgsEED0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos12RawQueryArgsEED0Ev.apply(null, arguments);
};

var real___ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos12RawQueryArgsEED2Ev = asm["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos12RawQueryArgsEED2Ev"]; asm["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos12RawQueryArgsEED2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos12RawQueryArgsEED2Ev.apply(null, arguments);
};

var real___ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos14RawQueryResultEE3RunEv = asm["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos14RawQueryResultEE3RunEv"]; asm["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos14RawQueryResultEE3RunEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos14RawQueryResultEE3RunEv.apply(null, arguments);
};

var real___ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos14RawQueryResultEED0Ev = asm["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos14RawQueryResultEED0Ev"]; asm["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos14RawQueryResultEED0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos14RawQueryResultEED0Ev.apply(null, arguments);
};

var real___ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos14RawQueryResultEED2Ev = asm["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos14RawQueryResultEED2Ev"]; asm["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos14RawQueryResultEED2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos14RawQueryResultEED2Ev.apply(null, arguments);
};

var real___ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos25RawQueryResult_ColumnDescEE3RunEv = asm["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos25RawQueryResult_ColumnDescEE3RunEv"]; asm["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos25RawQueryResult_ColumnDescEE3RunEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos25RawQueryResult_ColumnDescEE3RunEv.apply(null, arguments);
};

var real___ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos25RawQueryResult_ColumnDescEED0Ev = asm["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos25RawQueryResult_ColumnDescEED0Ev"]; asm["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos25RawQueryResult_ColumnDescEED0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos25RawQueryResult_ColumnDescEED0Ev.apply(null, arguments);
};

var real___ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos25RawQueryResult_ColumnDescEED2Ev = asm["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos25RawQueryResult_ColumnDescEED2Ev"]; asm["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos25RawQueryResult_ColumnDescEED2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos25RawQueryResult_ColumnDescEED2Ev.apply(null, arguments);
};

var real___ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos27RawQueryResult_ColumnValuesEE3RunEv = asm["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos27RawQueryResult_ColumnValuesEE3RunEv"]; asm["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos27RawQueryResult_ColumnValuesEE3RunEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos27RawQueryResult_ColumnValuesEE3RunEv.apply(null, arguments);
};

var real___ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos27RawQueryResult_ColumnValuesEED0Ev = asm["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos27RawQueryResult_ColumnValuesEED0Ev"]; asm["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos27RawQueryResult_ColumnValuesEED0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos27RawQueryResult_ColumnValuesEED0Ev.apply(null, arguments);
};

var real___ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos27RawQueryResult_ColumnValuesEED2Ev = asm["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos27RawQueryResult_ColumnValuesEED2Ev"]; asm["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos27RawQueryResult_ColumnValuesEED2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos27RawQueryResult_ColumnValuesEED2Ev.apply(null, arguments);
};

var real___ZN8perfetto15trace_processor10BlobReaderD0Ev = asm["__ZN8perfetto15trace_processor10BlobReaderD0Ev"]; asm["__ZN8perfetto15trace_processor10BlobReaderD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto15trace_processor10BlobReaderD0Ev.apply(null, arguments);
};

var real___ZN8perfetto15trace_processor10BlobReaderD2Ev = asm["__ZN8perfetto15trace_processor10BlobReaderD2Ev"]; asm["__ZN8perfetto15trace_processor10BlobReaderD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto15trace_processor10BlobReaderD2Ev.apply(null, arguments);
};

var real___ZN8perfetto15trace_processor12TraceStorage15PushSchedSwitchEjyjjPKcjj = asm["__ZN8perfetto15trace_processor12TraceStorage15PushSchedSwitchEjyjjPKcjj"]; asm["__ZN8perfetto15trace_processor12TraceStorage15PushSchedSwitchEjyjjPKcjj"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto15trace_processor12TraceStorage15PushSchedSwitchEjyjjPKcjj.apply(null, arguments);
};

var real___ZN8perfetto15trace_processor12TraceStorageD0Ev = asm["__ZN8perfetto15trace_processor12TraceStorageD0Ev"]; asm["__ZN8perfetto15trace_processor12TraceStorageD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto15trace_processor12TraceStorageD0Ev.apply(null, arguments);
};

var real___ZN8perfetto15trace_processor12TraceStorageD2Ev = asm["__ZN8perfetto15trace_processor12TraceStorageD2Ev"]; asm["__ZN8perfetto15trace_processor12TraceStorageD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto15trace_processor12TraceStorageD2Ev.apply(null, arguments);
};

var real___ZN8perfetto15trace_processor12_GLOBAL__N_113DoRunNextTaskEPv = asm["__ZN8perfetto15trace_processor12_GLOBAL__N_113DoRunNextTaskEPv"]; asm["__ZN8perfetto15trace_processor12_GLOBAL__N_113DoRunNextTaskEPv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto15trace_processor12_GLOBAL__N_113DoRunNextTaskEPv.apply(null, arguments);
};

var real___ZN8perfetto15trace_processor12_GLOBAL__N_114BlobReaderImpl4ReadEyjPh = asm["__ZN8perfetto15trace_processor12_GLOBAL__N_114BlobReaderImpl4ReadEyjPh"]; asm["__ZN8perfetto15trace_processor12_GLOBAL__N_114BlobReaderImpl4ReadEyjPh"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto15trace_processor12_GLOBAL__N_114BlobReaderImpl4ReadEyjPh.apply(null, arguments);
};

var real___ZN8perfetto15trace_processor12_GLOBAL__N_114BlobReaderImplD0Ev = asm["__ZN8perfetto15trace_processor12_GLOBAL__N_114BlobReaderImplD0Ev"]; asm["__ZN8perfetto15trace_processor12_GLOBAL__N_114BlobReaderImplD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto15trace_processor12_GLOBAL__N_114BlobReaderImplD0Ev.apply(null, arguments);
};

var real___ZN8perfetto15trace_processor12_GLOBAL__N_114BlobReaderImplD2Ev = asm["__ZN8perfetto15trace_processor12_GLOBAL__N_114BlobReaderImplD2Ev"]; asm["__ZN8perfetto15trace_processor12_GLOBAL__N_114BlobReaderImplD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto15trace_processor12_GLOBAL__N_114BlobReaderImplD2Ev.apply(null, arguments);
};

var real___ZN8perfetto15trace_processor12_GLOBAL__N_120DoRunNextDelayedTaskEPv = asm["__ZN8perfetto15trace_processor12_GLOBAL__N_120DoRunNextDelayedTaskEPv"]; asm["__ZN8perfetto15trace_processor12_GLOBAL__N_120DoRunNextDelayedTaskEPv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto15trace_processor12_GLOBAL__N_120DoRunNextDelayedTaskEPv.apply(null, arguments);
};

var real___ZN8perfetto15trace_processor20EmscriptenTaskRunner15PostDelayedTaskENSt3__28functionIFvvEEEj = asm["__ZN8perfetto15trace_processor20EmscriptenTaskRunner15PostDelayedTaskENSt3__28functionIFvvEEEj"]; asm["__ZN8perfetto15trace_processor20EmscriptenTaskRunner15PostDelayedTaskENSt3__28functionIFvvEEEj"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto15trace_processor20EmscriptenTaskRunner15PostDelayedTaskENSt3__28functionIFvvEEEj.apply(null, arguments);
};

var real___ZN8perfetto15trace_processor20EmscriptenTaskRunner22AddFileDescriptorWatchEiNSt3__28functionIFvvEEE = asm["__ZN8perfetto15trace_processor20EmscriptenTaskRunner22AddFileDescriptorWatchEiNSt3__28functionIFvvEEE"]; asm["__ZN8perfetto15trace_processor20EmscriptenTaskRunner22AddFileDescriptorWatchEiNSt3__28functionIFvvEEE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto15trace_processor20EmscriptenTaskRunner22AddFileDescriptorWatchEiNSt3__28functionIFvvEEE.apply(null, arguments);
};

var real___ZN8perfetto15trace_processor20EmscriptenTaskRunner25RemoveFileDescriptorWatchEi = asm["__ZN8perfetto15trace_processor20EmscriptenTaskRunner25RemoveFileDescriptorWatchEi"]; asm["__ZN8perfetto15trace_processor20EmscriptenTaskRunner25RemoveFileDescriptorWatchEi"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto15trace_processor20EmscriptenTaskRunner25RemoveFileDescriptorWatchEi.apply(null, arguments);
};

var real___ZN8perfetto15trace_processor20EmscriptenTaskRunner8PostTaskENSt3__28functionIFvvEEE = asm["__ZN8perfetto15trace_processor20EmscriptenTaskRunner8PostTaskENSt3__28functionIFvvEEE"]; asm["__ZN8perfetto15trace_processor20EmscriptenTaskRunner8PostTaskENSt3__28functionIFvvEEE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto15trace_processor20EmscriptenTaskRunner8PostTaskENSt3__28functionIFvvEEE.apply(null, arguments);
};

var real___ZN8perfetto15trace_processor20EmscriptenTaskRunnerD0Ev = asm["__ZN8perfetto15trace_processor20EmscriptenTaskRunnerD0Ev"]; asm["__ZN8perfetto15trace_processor20EmscriptenTaskRunnerD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto15trace_processor20EmscriptenTaskRunnerD0Ev.apply(null, arguments);
};

var real___ZN8perfetto15trace_processor20EmscriptenTaskRunnerD2Ev = asm["__ZN8perfetto15trace_processor20EmscriptenTaskRunnerD2Ev"]; asm["__ZN8perfetto15trace_processor20EmscriptenTaskRunnerD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto15trace_processor20EmscriptenTaskRunnerD2Ev.apply(null, arguments);
};

var real___ZN8perfetto4base10TaskRunnerD0Ev = asm["__ZN8perfetto4base10TaskRunnerD0Ev"]; asm["__ZN8perfetto4base10TaskRunnerD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto4base10TaskRunnerD0Ev.apply(null, arguments);
};

var real___ZN8perfetto4base10TaskRunnerD2Ev = asm["__ZN8perfetto4base10TaskRunnerD2Ev"]; asm["__ZN8perfetto4base10TaskRunnerD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto4base10TaskRunnerD2Ev.apply(null, arguments);
};

var real___ZN8perfetto6protos12RawQueryArgs21CheckTypeAndMergeFromERKN6google8protobuf11MessageLiteE = asm["__ZN8perfetto6protos12RawQueryArgs21CheckTypeAndMergeFromERKN6google8protobuf11MessageLiteE"]; asm["__ZN8perfetto6protos12RawQueryArgs21CheckTypeAndMergeFromERKN6google8protobuf11MessageLiteE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto6protos12RawQueryArgs21CheckTypeAndMergeFromERKN6google8protobuf11MessageLiteE.apply(null, arguments);
};

var real___ZN8perfetto6protos12RawQueryArgs27MergePartialFromCodedStreamEPN6google8protobuf2io16CodedInputStreamE = asm["__ZN8perfetto6protos12RawQueryArgs27MergePartialFromCodedStreamEPN6google8protobuf2io16CodedInputStreamE"]; asm["__ZN8perfetto6protos12RawQueryArgs27MergePartialFromCodedStreamEPN6google8protobuf2io16CodedInputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto6protos12RawQueryArgs27MergePartialFromCodedStreamEPN6google8protobuf2io16CodedInputStreamE.apply(null, arguments);
};

var real___ZN8perfetto6protos12RawQueryArgs5ClearEv = asm["__ZN8perfetto6protos12RawQueryArgs5ClearEv"]; asm["__ZN8perfetto6protos12RawQueryArgs5ClearEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto6protos12RawQueryArgs5ClearEv.apply(null, arguments);
};

var real___ZN8perfetto6protos12RawQueryArgsD0Ev = asm["__ZN8perfetto6protos12RawQueryArgsD0Ev"]; asm["__ZN8perfetto6protos12RawQueryArgsD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto6protos12RawQueryArgsD0Ev.apply(null, arguments);
};

var real___ZN8perfetto6protos12RawQueryArgsD2Ev = asm["__ZN8perfetto6protos12RawQueryArgsD2Ev"]; asm["__ZN8perfetto6protos12RawQueryArgsD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto6protos12RawQueryArgsD2Ev.apply(null, arguments);
};

var real___ZN8perfetto6protos14RawQueryResult21CheckTypeAndMergeFromERKN6google8protobuf11MessageLiteE = asm["__ZN8perfetto6protos14RawQueryResult21CheckTypeAndMergeFromERKN6google8protobuf11MessageLiteE"]; asm["__ZN8perfetto6protos14RawQueryResult21CheckTypeAndMergeFromERKN6google8protobuf11MessageLiteE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto6protos14RawQueryResult21CheckTypeAndMergeFromERKN6google8protobuf11MessageLiteE.apply(null, arguments);
};

var real___ZN8perfetto6protos14RawQueryResult27MergePartialFromCodedStreamEPN6google8protobuf2io16CodedInputStreamE = asm["__ZN8perfetto6protos14RawQueryResult27MergePartialFromCodedStreamEPN6google8protobuf2io16CodedInputStreamE"]; asm["__ZN8perfetto6protos14RawQueryResult27MergePartialFromCodedStreamEPN6google8protobuf2io16CodedInputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto6protos14RawQueryResult27MergePartialFromCodedStreamEPN6google8protobuf2io16CodedInputStreamE.apply(null, arguments);
};

var real___ZN8perfetto6protos14RawQueryResult5ClearEv = asm["__ZN8perfetto6protos14RawQueryResult5ClearEv"]; asm["__ZN8perfetto6protos14RawQueryResult5ClearEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto6protos14RawQueryResult5ClearEv.apply(null, arguments);
};

var real___ZN8perfetto6protos14RawQueryResultD0Ev = asm["__ZN8perfetto6protos14RawQueryResultD0Ev"]; asm["__ZN8perfetto6protos14RawQueryResultD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto6protos14RawQueryResultD0Ev.apply(null, arguments);
};

var real___ZN8perfetto6protos14RawQueryResultD2Ev = asm["__ZN8perfetto6protos14RawQueryResultD2Ev"]; asm["__ZN8perfetto6protos14RawQueryResultD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto6protos14RawQueryResultD2Ev.apply(null, arguments);
};

var real___ZN8perfetto6protos25RawQueryResult_ColumnDesc21CheckTypeAndMergeFromERKN6google8protobuf11MessageLiteE = asm["__ZN8perfetto6protos25RawQueryResult_ColumnDesc21CheckTypeAndMergeFromERKN6google8protobuf11MessageLiteE"]; asm["__ZN8perfetto6protos25RawQueryResult_ColumnDesc21CheckTypeAndMergeFromERKN6google8protobuf11MessageLiteE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto6protos25RawQueryResult_ColumnDesc21CheckTypeAndMergeFromERKN6google8protobuf11MessageLiteE.apply(null, arguments);
};

var real___ZN8perfetto6protos25RawQueryResult_ColumnDesc27MergePartialFromCodedStreamEPN6google8protobuf2io16CodedInputStreamE = asm["__ZN8perfetto6protos25RawQueryResult_ColumnDesc27MergePartialFromCodedStreamEPN6google8protobuf2io16CodedInputStreamE"]; asm["__ZN8perfetto6protos25RawQueryResult_ColumnDesc27MergePartialFromCodedStreamEPN6google8protobuf2io16CodedInputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto6protos25RawQueryResult_ColumnDesc27MergePartialFromCodedStreamEPN6google8protobuf2io16CodedInputStreamE.apply(null, arguments);
};

var real___ZN8perfetto6protos25RawQueryResult_ColumnDesc5ClearEv = asm["__ZN8perfetto6protos25RawQueryResult_ColumnDesc5ClearEv"]; asm["__ZN8perfetto6protos25RawQueryResult_ColumnDesc5ClearEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto6protos25RawQueryResult_ColumnDesc5ClearEv.apply(null, arguments);
};

var real___ZN8perfetto6protos25RawQueryResult_ColumnDescD0Ev = asm["__ZN8perfetto6protos25RawQueryResult_ColumnDescD0Ev"]; asm["__ZN8perfetto6protos25RawQueryResult_ColumnDescD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto6protos25RawQueryResult_ColumnDescD0Ev.apply(null, arguments);
};

var real___ZN8perfetto6protos25RawQueryResult_ColumnDescD2Ev = asm["__ZN8perfetto6protos25RawQueryResult_ColumnDescD2Ev"]; asm["__ZN8perfetto6protos25RawQueryResult_ColumnDescD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto6protos25RawQueryResult_ColumnDescD2Ev.apply(null, arguments);
};

var real___ZN8perfetto6protos27RawQueryResult_ColumnValues21CheckTypeAndMergeFromERKN6google8protobuf11MessageLiteE = asm["__ZN8perfetto6protos27RawQueryResult_ColumnValues21CheckTypeAndMergeFromERKN6google8protobuf11MessageLiteE"]; asm["__ZN8perfetto6protos27RawQueryResult_ColumnValues21CheckTypeAndMergeFromERKN6google8protobuf11MessageLiteE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto6protos27RawQueryResult_ColumnValues21CheckTypeAndMergeFromERKN6google8protobuf11MessageLiteE.apply(null, arguments);
};

var real___ZN8perfetto6protos27RawQueryResult_ColumnValues27MergePartialFromCodedStreamEPN6google8protobuf2io16CodedInputStreamE = asm["__ZN8perfetto6protos27RawQueryResult_ColumnValues27MergePartialFromCodedStreamEPN6google8protobuf2io16CodedInputStreamE"]; asm["__ZN8perfetto6protos27RawQueryResult_ColumnValues27MergePartialFromCodedStreamEPN6google8protobuf2io16CodedInputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto6protos27RawQueryResult_ColumnValues27MergePartialFromCodedStreamEPN6google8protobuf2io16CodedInputStreamE.apply(null, arguments);
};

var real___ZN8perfetto6protos27RawQueryResult_ColumnValues5ClearEv = asm["__ZN8perfetto6protos27RawQueryResult_ColumnValues5ClearEv"]; asm["__ZN8perfetto6protos27RawQueryResult_ColumnValues5ClearEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto6protos27RawQueryResult_ColumnValues5ClearEv.apply(null, arguments);
};

var real___ZN8perfetto6protos27RawQueryResult_ColumnValuesD0Ev = asm["__ZN8perfetto6protos27RawQueryResult_ColumnValuesD0Ev"]; asm["__ZN8perfetto6protos27RawQueryResult_ColumnValuesD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto6protos27RawQueryResult_ColumnValuesD0Ev.apply(null, arguments);
};

var real___ZN8perfetto6protos27RawQueryResult_ColumnValuesD2Ev = asm["__ZN8perfetto6protos27RawQueryResult_ColumnValuesD2Ev"]; asm["__ZN8perfetto6protos27RawQueryResult_ColumnValuesD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto6protos27RawQueryResult_ColumnValuesD2Ev.apply(null, arguments);
};

var real___ZN8perfetto6protos72protobuf_AddDesc_perfetto_2ftrace_5fprocessor_2fraw_5fquery_2eproto_implEv = asm["__ZN8perfetto6protos72protobuf_AddDesc_perfetto_2ftrace_5fprocessor_2fraw_5fquery_2eproto_implEv"]; asm["__ZN8perfetto6protos72protobuf_AddDesc_perfetto_2ftrace_5fprocessor_2fraw_5fquery_2eproto_implEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto6protos72protobuf_AddDesc_perfetto_2ftrace_5fprocessor_2fraw_5fquery_2eproto_implEv.apply(null, arguments);
};

var real___ZN8perfetto6protos72protobuf_ShutdownFile_perfetto_2ftrace_5fprocessor_2fraw_5fquery_2eprotoEv = asm["__ZN8perfetto6protos72protobuf_ShutdownFile_perfetto_2ftrace_5fprocessor_2fraw_5fquery_2eprotoEv"]; asm["__ZN8perfetto6protos72protobuf_ShutdownFile_perfetto_2ftrace_5fprocessor_2fraw_5fquery_2eprotoEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto6protos72protobuf_ShutdownFile_perfetto_2ftrace_5fprocessor_2fraw_5fquery_2eprotoEv.apply(null, arguments);
};

var real___ZN8perfetto6protosL35MutableUnknownFieldsForRawQueryArgsEPNS0_12RawQueryArgsE = asm["__ZN8perfetto6protosL35MutableUnknownFieldsForRawQueryArgsEPNS0_12RawQueryArgsE"]; asm["__ZN8perfetto6protosL35MutableUnknownFieldsForRawQueryArgsEPNS0_12RawQueryArgsE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto6protosL35MutableUnknownFieldsForRawQueryArgsEPNS0_12RawQueryArgsE.apply(null, arguments);
};

var real___ZN8perfetto6protosL37MutableUnknownFieldsForRawQueryResultEPNS0_14RawQueryResultE = asm["__ZN8perfetto6protosL37MutableUnknownFieldsForRawQueryResultEPNS0_14RawQueryResultE"]; asm["__ZN8perfetto6protosL37MutableUnknownFieldsForRawQueryResultEPNS0_14RawQueryResultE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto6protosL37MutableUnknownFieldsForRawQueryResultEPNS0_14RawQueryResultE.apply(null, arguments);
};

var real___ZN8perfetto6protosL48MutableUnknownFieldsForRawQueryResult_ColumnDescEPNS0_25RawQueryResult_ColumnDescE = asm["__ZN8perfetto6protosL48MutableUnknownFieldsForRawQueryResult_ColumnDescEPNS0_25RawQueryResult_ColumnDescE"]; asm["__ZN8perfetto6protosL48MutableUnknownFieldsForRawQueryResult_ColumnDescEPNS0_25RawQueryResult_ColumnDescE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto6protosL48MutableUnknownFieldsForRawQueryResult_ColumnDescEPNS0_25RawQueryResult_ColumnDescE.apply(null, arguments);
};

var real___ZN8perfetto6protosL50MutableUnknownFieldsForRawQueryResult_ColumnValuesEPNS0_27RawQueryResult_ColumnValuesE = asm["__ZN8perfetto6protosL50MutableUnknownFieldsForRawQueryResult_ColumnValuesEPNS0_27RawQueryResult_ColumnValuesE"]; asm["__ZN8perfetto6protosL50MutableUnknownFieldsForRawQueryResult_ColumnValuesEPNS0_27RawQueryResult_ColumnValuesE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZN8perfetto6protosL50MutableUnknownFieldsForRawQueryResult_ColumnValuesEPNS0_27RawQueryResult_ColumnValuesE.apply(null, arguments);
};

var real___ZNK10__cxxabiv116__shim_type_info5noop1Ev = asm["__ZNK10__cxxabiv116__shim_type_info5noop1Ev"]; asm["__ZNK10__cxxabiv116__shim_type_info5noop1Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK10__cxxabiv116__shim_type_info5noop1Ev.apply(null, arguments);
};

var real___ZNK10__cxxabiv116__shim_type_info5noop2Ev = asm["__ZNK10__cxxabiv116__shim_type_info5noop2Ev"]; asm["__ZNK10__cxxabiv116__shim_type_info5noop2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK10__cxxabiv116__shim_type_info5noop2Ev.apply(null, arguments);
};

var real___ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib = asm["__ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib"]; asm["__ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib.apply(null, arguments);
};

var real___ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib = asm["__ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib"]; asm["__ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib.apply(null, arguments);
};

var real___ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi = asm["__ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi"]; asm["__ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi.apply(null, arguments);
};

var real___ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv = asm["__ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv"]; asm["__ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv.apply(null, arguments);
};

var real___ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib = asm["__ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib"]; asm["__ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib.apply(null, arguments);
};

var real___ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib = asm["__ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib"]; asm["__ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib.apply(null, arguments);
};

var real___ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi = asm["__ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi"]; asm["__ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi.apply(null, arguments);
};

var real___ZNK10__cxxabiv121__vmi_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib = asm["__ZNK10__cxxabiv121__vmi_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib"]; asm["__ZNK10__cxxabiv121__vmi_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK10__cxxabiv121__vmi_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib.apply(null, arguments);
};

var real___ZNK10__cxxabiv121__vmi_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib = asm["__ZNK10__cxxabiv121__vmi_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib"]; asm["__ZNK10__cxxabiv121__vmi_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK10__cxxabiv121__vmi_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib.apply(null, arguments);
};

var real___ZNK10__cxxabiv121__vmi_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi = asm["__ZNK10__cxxabiv121__vmi_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi"]; asm["__ZNK10__cxxabiv121__vmi_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK10__cxxabiv121__vmi_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi.apply(null, arguments);
};

var real___ZNK6google8protobuf11MessageLite20GetMaybeArenaPointerEv = asm["__ZNK6google8protobuf11MessageLite20GetMaybeArenaPointerEv"]; asm["__ZNK6google8protobuf11MessageLite20GetMaybeArenaPointerEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK6google8protobuf11MessageLite20GetMaybeArenaPointerEv.apply(null, arguments);
};

var real___ZNK6google8protobuf11MessageLite25InitializationErrorStringEv = asm["__ZNK6google8protobuf11MessageLite25InitializationErrorStringEv"]; asm["__ZNK6google8protobuf11MessageLite25InitializationErrorStringEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK6google8protobuf11MessageLite25InitializationErrorStringEv.apply(null, arguments);
};

var real___ZNK6google8protobuf11MessageLite31SerializeWithCachedSizesToArrayEPh = asm["__ZNK6google8protobuf11MessageLite31SerializeWithCachedSizesToArrayEPh"]; asm["__ZNK6google8protobuf11MessageLite31SerializeWithCachedSizesToArrayEPh"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK6google8protobuf11MessageLite31SerializeWithCachedSizesToArrayEPh.apply(null, arguments);
};

var real___ZNK6google8protobuf11MessageLite3NewEPNS0_5ArenaE = asm["__ZNK6google8protobuf11MessageLite3NewEPNS0_5ArenaE"]; asm["__ZNK6google8protobuf11MessageLite3NewEPNS0_5ArenaE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK6google8protobuf11MessageLite3NewEPNS0_5ArenaE.apply(null, arguments);
};

var real___ZNK6google8protobuf11MessageLite8GetArenaEv = asm["__ZNK6google8protobuf11MessageLite8GetArenaEv"]; asm["__ZNK6google8protobuf11MessageLite8GetArenaEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK6google8protobuf11MessageLite8GetArenaEv.apply(null, arguments);
};

var real___ZNK6google8protobuf2io17ArrayOutputStream9ByteCountEv = asm["__ZNK6google8protobuf2io17ArrayOutputStream9ByteCountEv"]; asm["__ZNK6google8protobuf2io17ArrayOutputStream9ByteCountEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK6google8protobuf2io17ArrayOutputStream9ByteCountEv.apply(null, arguments);
};

var real___ZNK6google8protobuf2io18StringOutputStream9ByteCountEv = asm["__ZNK6google8protobuf2io18StringOutputStream9ByteCountEv"]; asm["__ZNK6google8protobuf2io18StringOutputStream9ByteCountEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK6google8protobuf2io18StringOutputStream9ByteCountEv.apply(null, arguments);
};

var real___ZNK6google8protobuf2io20ZeroCopyOutputStream14AllowsAliasingEv = asm["__ZNK6google8protobuf2io20ZeroCopyOutputStream14AllowsAliasingEv"]; asm["__ZNK6google8protobuf2io20ZeroCopyOutputStream14AllowsAliasingEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK6google8protobuf2io20ZeroCopyOutputStream14AllowsAliasingEv.apply(null, arguments);
};

var real___ZNK6google8protobuf2io22LazyStringOutputStream9ByteCountEv = asm["__ZNK6google8protobuf2io22LazyStringOutputStream9ByteCountEv"]; asm["__ZNK6google8protobuf2io22LazyStringOutputStream9ByteCountEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK6google8protobuf2io22LazyStringOutputStream9ByteCountEv.apply(null, arguments);
};

var real___ZNK8perfetto6protos12RawQueryArgs11GetTypeNameEv = asm["__ZNK8perfetto6protos12RawQueryArgs11GetTypeNameEv"]; asm["__ZNK8perfetto6protos12RawQueryArgs11GetTypeNameEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK8perfetto6protos12RawQueryArgs11GetTypeNameEv.apply(null, arguments);
};

var real___ZNK8perfetto6protos12RawQueryArgs13GetCachedSizeEv = asm["__ZNK8perfetto6protos12RawQueryArgs13GetCachedSizeEv"]; asm["__ZNK8perfetto6protos12RawQueryArgs13GetCachedSizeEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK8perfetto6protos12RawQueryArgs13GetCachedSizeEv.apply(null, arguments);
};

var real___ZNK8perfetto6protos12RawQueryArgs13IsInitializedEv = asm["__ZNK8perfetto6protos12RawQueryArgs13IsInitializedEv"]; asm["__ZNK8perfetto6protos12RawQueryArgs13IsInitializedEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK8perfetto6protos12RawQueryArgs13IsInitializedEv.apply(null, arguments);
};

var real___ZNK8perfetto6protos12RawQueryArgs24SerializeWithCachedSizesEPN6google8protobuf2io17CodedOutputStreamE = asm["__ZNK8perfetto6protos12RawQueryArgs24SerializeWithCachedSizesEPN6google8protobuf2io17CodedOutputStreamE"]; asm["__ZNK8perfetto6protos12RawQueryArgs24SerializeWithCachedSizesEPN6google8protobuf2io17CodedOutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK8perfetto6protos12RawQueryArgs24SerializeWithCachedSizesEPN6google8protobuf2io17CodedOutputStreamE.apply(null, arguments);
};

var real___ZNK8perfetto6protos12RawQueryArgs3NewEPN6google8protobuf5ArenaE = asm["__ZNK8perfetto6protos12RawQueryArgs3NewEPN6google8protobuf5ArenaE"]; asm["__ZNK8perfetto6protos12RawQueryArgs3NewEPN6google8protobuf5ArenaE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK8perfetto6protos12RawQueryArgs3NewEPN6google8protobuf5ArenaE.apply(null, arguments);
};

var real___ZNK8perfetto6protos12RawQueryArgs3NewEv = asm["__ZNK8perfetto6protos12RawQueryArgs3NewEv"]; asm["__ZNK8perfetto6protos12RawQueryArgs3NewEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK8perfetto6protos12RawQueryArgs3NewEv.apply(null, arguments);
};

var real___ZNK8perfetto6protos12RawQueryArgs8ByteSizeEv = asm["__ZNK8perfetto6protos12RawQueryArgs8ByteSizeEv"]; asm["__ZNK8perfetto6protos12RawQueryArgs8ByteSizeEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK8perfetto6protos12RawQueryArgs8ByteSizeEv.apply(null, arguments);
};

var real___ZNK8perfetto6protos14RawQueryResult11GetTypeNameEv = asm["__ZNK8perfetto6protos14RawQueryResult11GetTypeNameEv"]; asm["__ZNK8perfetto6protos14RawQueryResult11GetTypeNameEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK8perfetto6protos14RawQueryResult11GetTypeNameEv.apply(null, arguments);
};

var real___ZNK8perfetto6protos14RawQueryResult13GetCachedSizeEv = asm["__ZNK8perfetto6protos14RawQueryResult13GetCachedSizeEv"]; asm["__ZNK8perfetto6protos14RawQueryResult13GetCachedSizeEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK8perfetto6protos14RawQueryResult13GetCachedSizeEv.apply(null, arguments);
};

var real___ZNK8perfetto6protos14RawQueryResult13IsInitializedEv = asm["__ZNK8perfetto6protos14RawQueryResult13IsInitializedEv"]; asm["__ZNK8perfetto6protos14RawQueryResult13IsInitializedEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK8perfetto6protos14RawQueryResult13IsInitializedEv.apply(null, arguments);
};

var real___ZNK8perfetto6protos14RawQueryResult24SerializeWithCachedSizesEPN6google8protobuf2io17CodedOutputStreamE = asm["__ZNK8perfetto6protos14RawQueryResult24SerializeWithCachedSizesEPN6google8protobuf2io17CodedOutputStreamE"]; asm["__ZNK8perfetto6protos14RawQueryResult24SerializeWithCachedSizesEPN6google8protobuf2io17CodedOutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK8perfetto6protos14RawQueryResult24SerializeWithCachedSizesEPN6google8protobuf2io17CodedOutputStreamE.apply(null, arguments);
};

var real___ZNK8perfetto6protos14RawQueryResult3NewEPN6google8protobuf5ArenaE = asm["__ZNK8perfetto6protos14RawQueryResult3NewEPN6google8protobuf5ArenaE"]; asm["__ZNK8perfetto6protos14RawQueryResult3NewEPN6google8protobuf5ArenaE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK8perfetto6protos14RawQueryResult3NewEPN6google8protobuf5ArenaE.apply(null, arguments);
};

var real___ZNK8perfetto6protos14RawQueryResult3NewEv = asm["__ZNK8perfetto6protos14RawQueryResult3NewEv"]; asm["__ZNK8perfetto6protos14RawQueryResult3NewEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK8perfetto6protos14RawQueryResult3NewEv.apply(null, arguments);
};

var real___ZNK8perfetto6protos14RawQueryResult8ByteSizeEv = asm["__ZNK8perfetto6protos14RawQueryResult8ByteSizeEv"]; asm["__ZNK8perfetto6protos14RawQueryResult8ByteSizeEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK8perfetto6protos14RawQueryResult8ByteSizeEv.apply(null, arguments);
};

var real___ZNK8perfetto6protos25RawQueryResult_ColumnDesc11GetTypeNameEv = asm["__ZNK8perfetto6protos25RawQueryResult_ColumnDesc11GetTypeNameEv"]; asm["__ZNK8perfetto6protos25RawQueryResult_ColumnDesc11GetTypeNameEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK8perfetto6protos25RawQueryResult_ColumnDesc11GetTypeNameEv.apply(null, arguments);
};

var real___ZNK8perfetto6protos25RawQueryResult_ColumnDesc13GetCachedSizeEv = asm["__ZNK8perfetto6protos25RawQueryResult_ColumnDesc13GetCachedSizeEv"]; asm["__ZNK8perfetto6protos25RawQueryResult_ColumnDesc13GetCachedSizeEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK8perfetto6protos25RawQueryResult_ColumnDesc13GetCachedSizeEv.apply(null, arguments);
};

var real___ZNK8perfetto6protos25RawQueryResult_ColumnDesc13IsInitializedEv = asm["__ZNK8perfetto6protos25RawQueryResult_ColumnDesc13IsInitializedEv"]; asm["__ZNK8perfetto6protos25RawQueryResult_ColumnDesc13IsInitializedEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK8perfetto6protos25RawQueryResult_ColumnDesc13IsInitializedEv.apply(null, arguments);
};

var real___ZNK8perfetto6protos25RawQueryResult_ColumnDesc24SerializeWithCachedSizesEPN6google8protobuf2io17CodedOutputStreamE = asm["__ZNK8perfetto6protos25RawQueryResult_ColumnDesc24SerializeWithCachedSizesEPN6google8protobuf2io17CodedOutputStreamE"]; asm["__ZNK8perfetto6protos25RawQueryResult_ColumnDesc24SerializeWithCachedSizesEPN6google8protobuf2io17CodedOutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK8perfetto6protos25RawQueryResult_ColumnDesc24SerializeWithCachedSizesEPN6google8protobuf2io17CodedOutputStreamE.apply(null, arguments);
};

var real___ZNK8perfetto6protos25RawQueryResult_ColumnDesc3NewEPN6google8protobuf5ArenaE = asm["__ZNK8perfetto6protos25RawQueryResult_ColumnDesc3NewEPN6google8protobuf5ArenaE"]; asm["__ZNK8perfetto6protos25RawQueryResult_ColumnDesc3NewEPN6google8protobuf5ArenaE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK8perfetto6protos25RawQueryResult_ColumnDesc3NewEPN6google8protobuf5ArenaE.apply(null, arguments);
};

var real___ZNK8perfetto6protos25RawQueryResult_ColumnDesc3NewEv = asm["__ZNK8perfetto6protos25RawQueryResult_ColumnDesc3NewEv"]; asm["__ZNK8perfetto6protos25RawQueryResult_ColumnDesc3NewEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK8perfetto6protos25RawQueryResult_ColumnDesc3NewEv.apply(null, arguments);
};

var real___ZNK8perfetto6protos25RawQueryResult_ColumnDesc8ByteSizeEv = asm["__ZNK8perfetto6protos25RawQueryResult_ColumnDesc8ByteSizeEv"]; asm["__ZNK8perfetto6protos25RawQueryResult_ColumnDesc8ByteSizeEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK8perfetto6protos25RawQueryResult_ColumnDesc8ByteSizeEv.apply(null, arguments);
};

var real___ZNK8perfetto6protos27RawQueryResult_ColumnValues11GetTypeNameEv = asm["__ZNK8perfetto6protos27RawQueryResult_ColumnValues11GetTypeNameEv"]; asm["__ZNK8perfetto6protos27RawQueryResult_ColumnValues11GetTypeNameEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK8perfetto6protos27RawQueryResult_ColumnValues11GetTypeNameEv.apply(null, arguments);
};

var real___ZNK8perfetto6protos27RawQueryResult_ColumnValues13GetCachedSizeEv = asm["__ZNK8perfetto6protos27RawQueryResult_ColumnValues13GetCachedSizeEv"]; asm["__ZNK8perfetto6protos27RawQueryResult_ColumnValues13GetCachedSizeEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK8perfetto6protos27RawQueryResult_ColumnValues13GetCachedSizeEv.apply(null, arguments);
};

var real___ZNK8perfetto6protos27RawQueryResult_ColumnValues13IsInitializedEv = asm["__ZNK8perfetto6protos27RawQueryResult_ColumnValues13IsInitializedEv"]; asm["__ZNK8perfetto6protos27RawQueryResult_ColumnValues13IsInitializedEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK8perfetto6protos27RawQueryResult_ColumnValues13IsInitializedEv.apply(null, arguments);
};

var real___ZNK8perfetto6protos27RawQueryResult_ColumnValues24SerializeWithCachedSizesEPN6google8protobuf2io17CodedOutputStreamE = asm["__ZNK8perfetto6protos27RawQueryResult_ColumnValues24SerializeWithCachedSizesEPN6google8protobuf2io17CodedOutputStreamE"]; asm["__ZNK8perfetto6protos27RawQueryResult_ColumnValues24SerializeWithCachedSizesEPN6google8protobuf2io17CodedOutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK8perfetto6protos27RawQueryResult_ColumnValues24SerializeWithCachedSizesEPN6google8protobuf2io17CodedOutputStreamE.apply(null, arguments);
};

var real___ZNK8perfetto6protos27RawQueryResult_ColumnValues3NewEPN6google8protobuf5ArenaE = asm["__ZNK8perfetto6protos27RawQueryResult_ColumnValues3NewEPN6google8protobuf5ArenaE"]; asm["__ZNK8perfetto6protos27RawQueryResult_ColumnValues3NewEPN6google8protobuf5ArenaE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK8perfetto6protos27RawQueryResult_ColumnValues3NewEPN6google8protobuf5ArenaE.apply(null, arguments);
};

var real___ZNK8perfetto6protos27RawQueryResult_ColumnValues3NewEv = asm["__ZNK8perfetto6protos27RawQueryResult_ColumnValues3NewEv"]; asm["__ZNK8perfetto6protos27RawQueryResult_ColumnValues3NewEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK8perfetto6protos27RawQueryResult_ColumnValues3NewEv.apply(null, arguments);
};

var real___ZNK8perfetto6protos27RawQueryResult_ColumnValues8ByteSizeEv = asm["__ZNK8perfetto6protos27RawQueryResult_ColumnValues8ByteSizeEv"]; asm["__ZNK8perfetto6protos27RawQueryResult_ColumnValues8ByteSizeEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNK8perfetto6protos27RawQueryResult_ColumnValues8ByteSizeEv.apply(null, arguments);
};

var real___ZNKSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEE7__cloneEPNS0_6__baseIS5_EE = asm["__ZNKSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEE7__cloneEPNS0_6__baseIS5_EE"]; asm["__ZNKSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEE7__cloneEPNS0_6__baseIS5_EE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNKSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEE7__cloneEPNS0_6__baseIS5_EE.apply(null, arguments);
};

var real___ZNKSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEE7__cloneEv = asm["__ZNKSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEE7__cloneEv"]; asm["__ZNKSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEE7__cloneEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNKSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEE7__cloneEv.apply(null, arguments);
};

var real___ZNKSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEE7__cloneEPNS0_6__baseIS8_EE = asm["__ZNKSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEE7__cloneEPNS0_6__baseIS8_EE"]; asm["__ZNKSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEE7__cloneEPNS0_6__baseIS8_EE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNKSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEE7__cloneEPNS0_6__baseIS8_EE.apply(null, arguments);
};

var real___ZNKSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEE7__cloneEv = asm["__ZNKSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEE7__cloneEv"]; asm["__ZNKSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEE7__cloneEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNKSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEE7__cloneEv.apply(null, arguments);
};

var real___ZNKSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_E7__cloneEPNS0_6__baseIS6_EE = asm["__ZNKSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_E7__cloneEPNS0_6__baseIS6_EE"]; asm["__ZNKSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_E7__cloneEPNS0_6__baseIS6_EE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNKSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_E7__cloneEPNS0_6__baseIS6_EE.apply(null, arguments);
};

var real___ZNKSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_E7__cloneEv = asm["__ZNKSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_E7__cloneEv"]; asm["__ZNKSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_E7__cloneEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNKSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_E7__cloneEv.apply(null, arguments);
};

var real___ZNKSt3__219__shared_weak_count13__get_deleterERKSt9type_info = asm["__ZNKSt3__219__shared_weak_count13__get_deleterERKSt9type_info"]; asm["__ZNKSt3__219__shared_weak_count13__get_deleterERKSt9type_info"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNKSt3__219__shared_weak_count13__get_deleterERKSt9type_info.apply(null, arguments);
};

var real___ZNSt3__210__function6__baseIFvN8perfetto6protos14RawQueryResultEEED0Ev = asm["__ZNSt3__210__function6__baseIFvN8perfetto6protos14RawQueryResultEEED0Ev"]; asm["__ZNSt3__210__function6__baseIFvN8perfetto6protos14RawQueryResultEEED0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNSt3__210__function6__baseIFvN8perfetto6protos14RawQueryResultEEED0Ev.apply(null, arguments);
};

var real___ZNSt3__210__function6__baseIFvN8perfetto6protos14RawQueryResultEEED2Ev = asm["__ZNSt3__210__function6__baseIFvN8perfetto6protos14RawQueryResultEEED2Ev"]; asm["__ZNSt3__210__function6__baseIFvN8perfetto6protos14RawQueryResultEEED2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNSt3__210__function6__baseIFvN8perfetto6protos14RawQueryResultEEED2Ev.apply(null, arguments);
};

var real___ZNSt3__210__function6__baseIFvvEED0Ev = asm["__ZNSt3__210__function6__baseIFvvEED0Ev"]; asm["__ZNSt3__210__function6__baseIFvvEED0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNSt3__210__function6__baseIFvvEED0Ev.apply(null, arguments);
};

var real___ZNSt3__210__function6__baseIFvvEED2Ev = asm["__ZNSt3__210__function6__baseIFvvEED2Ev"]; asm["__ZNSt3__210__function6__baseIFvvEED2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNSt3__210__function6__baseIFvvEED2Ev.apply(null, arguments);
};

var real___ZNSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEE18destroy_deallocateEv = asm["__ZNSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEE18destroy_deallocateEv"]; asm["__ZNSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEE18destroy_deallocateEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEE18destroy_deallocateEv.apply(null, arguments);
};

var real___ZNSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEE7destroyEv = asm["__ZNSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEE7destroyEv"]; asm["__ZNSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEE7destroyEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEE7destroyEv.apply(null, arguments);
};

var real___ZNSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEED0Ev = asm["__ZNSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEED0Ev"]; asm["__ZNSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEED0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEED0Ev.apply(null, arguments);
};

var real___ZNSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEED2Ev = asm["__ZNSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEED2Ev"]; asm["__ZNSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEED2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEED2Ev.apply(null, arguments);
};

var real___ZNSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEEclEv = asm["__ZNSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEEclEv"]; asm["__ZNSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEEclEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEEclEv.apply(null, arguments);
};

var real___ZNSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEE18destroy_deallocateEv = asm["__ZNSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEE18destroy_deallocateEv"]; asm["__ZNSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEE18destroy_deallocateEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEE18destroy_deallocateEv.apply(null, arguments);
};

var real___ZNSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEE7destroyEv = asm["__ZNSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEE7destroyEv"]; asm["__ZNSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEE7destroyEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEE7destroyEv.apply(null, arguments);
};

var real___ZNSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEED0Ev = asm["__ZNSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEED0Ev"]; asm["__ZNSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEED0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEED0Ev.apply(null, arguments);
};

var real___ZNSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEED2Ev = asm["__ZNSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEED2Ev"]; asm["__ZNSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEED2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEED2Ev.apply(null, arguments);
};

var real___ZNSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEEclEOS7_ = asm["__ZNSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEEclEOS7_"]; asm["__ZNSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEEclEOS7_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEEclEOS7_.apply(null, arguments);
};

var real___ZNSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_E18destroy_deallocateEv = asm["__ZNSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_E18destroy_deallocateEv"]; asm["__ZNSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_E18destroy_deallocateEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_E18destroy_deallocateEv.apply(null, arguments);
};

var real___ZNSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_E7destroyEv = asm["__ZNSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_E7destroyEv"]; asm["__ZNSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_E7destroyEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_E7destroyEv.apply(null, arguments);
};

var real___ZNSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_ED0Ev = asm["__ZNSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_ED0Ev"]; asm["__ZNSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_ED0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_ED0Ev.apply(null, arguments);
};

var real___ZNSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_ED2Ev = asm["__ZNSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_ED2Ev"]; asm["__ZNSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_ED2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_ED2Ev.apply(null, arguments);
};

var real___ZNSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_EclEv = asm["__ZNSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_EclEv"]; asm["__ZNSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_EclEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_EclEv.apply(null, arguments);
};

var real___ZNSt3__214__shared_countD0Ev = asm["__ZNSt3__214__shared_countD0Ev"]; asm["__ZNSt3__214__shared_countD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNSt3__214__shared_countD0Ev.apply(null, arguments);
};

var real___ZNSt3__214__shared_countD2Ev = asm["__ZNSt3__214__shared_countD2Ev"]; asm["__ZNSt3__214__shared_countD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNSt3__214__shared_countD2Ev.apply(null, arguments);
};

var real___ZNSt3__219__shared_weak_countD0Ev = asm["__ZNSt3__219__shared_weak_countD0Ev"]; asm["__ZNSt3__219__shared_weak_countD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNSt3__219__shared_weak_countD0Ev.apply(null, arguments);
};

var real___ZNSt3__220__shared_ptr_pointerIPPN8perfetto15trace_processor13TraceDatabaseENS_14default_deleteIS4_EENS_9allocatorIS4_EEE16__on_zero_sharedEv = asm["__ZNSt3__220__shared_ptr_pointerIPPN8perfetto15trace_processor13TraceDatabaseENS_14default_deleteIS4_EENS_9allocatorIS4_EEE16__on_zero_sharedEv"]; asm["__ZNSt3__220__shared_ptr_pointerIPPN8perfetto15trace_processor13TraceDatabaseENS_14default_deleteIS4_EENS_9allocatorIS4_EEE16__on_zero_sharedEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNSt3__220__shared_ptr_pointerIPPN8perfetto15trace_processor13TraceDatabaseENS_14default_deleteIS4_EENS_9allocatorIS4_EEE16__on_zero_sharedEv.apply(null, arguments);
};

var real___ZNSt3__220__shared_ptr_pointerIPPN8perfetto15trace_processor13TraceDatabaseENS_14default_deleteIS4_EENS_9allocatorIS4_EEE21__on_zero_shared_weakEv = asm["__ZNSt3__220__shared_ptr_pointerIPPN8perfetto15trace_processor13TraceDatabaseENS_14default_deleteIS4_EENS_9allocatorIS4_EEE21__on_zero_shared_weakEv"]; asm["__ZNSt3__220__shared_ptr_pointerIPPN8perfetto15trace_processor13TraceDatabaseENS_14default_deleteIS4_EENS_9allocatorIS4_EEE21__on_zero_shared_weakEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNSt3__220__shared_ptr_pointerIPPN8perfetto15trace_processor13TraceDatabaseENS_14default_deleteIS4_EENS_9allocatorIS4_EEE21__on_zero_shared_weakEv.apply(null, arguments);
};

var real___ZNSt3__220__shared_ptr_pointerIPPN8perfetto15trace_processor13TraceDatabaseENS_14default_deleteIS4_EENS_9allocatorIS4_EEED0Ev = asm["__ZNSt3__220__shared_ptr_pointerIPPN8perfetto15trace_processor13TraceDatabaseENS_14default_deleteIS4_EENS_9allocatorIS4_EEED0Ev"]; asm["__ZNSt3__220__shared_ptr_pointerIPPN8perfetto15trace_processor13TraceDatabaseENS_14default_deleteIS4_EENS_9allocatorIS4_EEED0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNSt3__220__shared_ptr_pointerIPPN8perfetto15trace_processor13TraceDatabaseENS_14default_deleteIS4_EENS_9allocatorIS4_EEED0Ev.apply(null, arguments);
};

var real___ZNSt3__220__shared_ptr_pointerIPPN8perfetto15trace_processor13TraceDatabaseENS_14default_deleteIS4_EENS_9allocatorIS4_EEED2Ev = asm["__ZNSt3__220__shared_ptr_pointerIPPN8perfetto15trace_processor13TraceDatabaseENS_14default_deleteIS4_EENS_9allocatorIS4_EEED2Ev"]; asm["__ZNSt3__220__shared_ptr_pointerIPPN8perfetto15trace_processor13TraceDatabaseENS_14default_deleteIS4_EENS_9allocatorIS4_EEED2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZNSt3__220__shared_ptr_pointerIPPN8perfetto15trace_processor13TraceDatabaseENS_14default_deleteIS4_EENS_9allocatorIS4_EEED2Ev.apply(null, arguments);
};

var real___ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__08__invokeEP7sqlite3PviPKPKcPP12sqlite3_vtabPPc = asm["__ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__08__invokeEP7sqlite3PviPKPKcPP12sqlite3_vtabPPc"]; asm["__ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__08__invokeEP7sqlite3PviPKPKcPP12sqlite3_vtabPPc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__08__invokeEP7sqlite3PviPKPKcPP12sqlite3_vtabPPc.apply(null, arguments);
};

var real___ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__18__invokeEP12sqlite3_vtabP18sqlite3_index_info = asm["__ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__18__invokeEP12sqlite3_vtabP18sqlite3_index_info"]; asm["__ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__18__invokeEP12sqlite3_vtabP18sqlite3_index_info"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__18__invokeEP12sqlite3_vtabP18sqlite3_index_info.apply(null, arguments);
};

var real___ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__28__invokeEP12sqlite3_vtab = asm["__ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__28__invokeEP12sqlite3_vtab"]; asm["__ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__28__invokeEP12sqlite3_vtab"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__28__invokeEP12sqlite3_vtab.apply(null, arguments);
};

var real___ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__38__invokeEP12sqlite3_vtabPP19sqlite3_vtab_cursor = asm["__ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__38__invokeEP12sqlite3_vtabPP19sqlite3_vtab_cursor"]; asm["__ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__38__invokeEP12sqlite3_vtabPP19sqlite3_vtab_cursor"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__38__invokeEP12sqlite3_vtabPP19sqlite3_vtab_cursor.apply(null, arguments);
};

var real___ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__48__invokeEP19sqlite3_vtab_cursor = asm["__ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__48__invokeEP19sqlite3_vtab_cursor"]; asm["__ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__48__invokeEP19sqlite3_vtab_cursor"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__48__invokeEP19sqlite3_vtab_cursor.apply(null, arguments);
};

var real___ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__58__invokeEP19sqlite3_vtab_cursoriPKciPP13sqlite3_value = asm["__ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__58__invokeEP19sqlite3_vtab_cursoriPKciPP13sqlite3_value"]; asm["__ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__58__invokeEP19sqlite3_vtab_cursoriPKciPP13sqlite3_value"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__58__invokeEP19sqlite3_vtab_cursoriPKciPP13sqlite3_value.apply(null, arguments);
};

var real___ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__68__invokeEP19sqlite3_vtab_cursor = asm["__ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__68__invokeEP19sqlite3_vtab_cursor"]; asm["__ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__68__invokeEP19sqlite3_vtab_cursor"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__68__invokeEP19sqlite3_vtab_cursor.apply(null, arguments);
};

var real___ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__78__invokeEP19sqlite3_vtab_cursor = asm["__ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__78__invokeEP19sqlite3_vtab_cursor"]; asm["__ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__78__invokeEP19sqlite3_vtab_cursor"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__78__invokeEP19sqlite3_vtab_cursor.apply(null, arguments);
};

var real___ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__88__invokeEP19sqlite3_vtab_cursorP15sqlite3_contexti = asm["__ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__88__invokeEP19sqlite3_vtab_cursorP15sqlite3_contexti"]; asm["__ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__88__invokeEP19sqlite3_vtab_cursorP15sqlite3_contexti"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__88__invokeEP19sqlite3_vtab_cursorP15sqlite3_contexti.apply(null, arguments);
};

var real____mmap = asm["___mmap"]; asm["___mmap"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____mmap.apply(null, arguments);
};

var real____munmap = asm["___munmap"]; asm["___munmap"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____munmap.apply(null, arguments);
};

var real____stdio_close = asm["___stdio_close"]; asm["___stdio_close"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____stdio_close.apply(null, arguments);
};

var real____stdio_seek = asm["___stdio_seek"]; asm["___stdio_seek"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____stdio_seek.apply(null, arguments);
};

var real____stdio_write = asm["___stdio_write"]; asm["___stdio_write"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____stdio_write.apply(null, arguments);
};

var real____stdout_write = asm["___stdout_write"]; asm["___stdout_write"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____stdout_write.apply(null, arguments);
};

var real__absFunc = asm["_absFunc"]; asm["_absFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__absFunc.apply(null, arguments);
};

var real__access = asm["_access"]; asm["_access"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__access.apply(null, arguments);
};

var real__analysisLoader = asm["_analysisLoader"]; asm["_analysisLoader"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__analysisLoader.apply(null, arguments);
};

var real__analyzeAggregate = asm["_analyzeAggregate"]; asm["_analyzeAggregate"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__analyzeAggregate.apply(null, arguments);
};

var real__analyzeAggregatesInSelect = asm["_analyzeAggregatesInSelect"]; asm["_analyzeAggregatesInSelect"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__analyzeAggregatesInSelect.apply(null, arguments);
};

var real__analyzeAggregatesInSelectEnd = asm["_analyzeAggregatesInSelectEnd"]; asm["_analyzeAggregatesInSelectEnd"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__analyzeAggregatesInSelectEnd.apply(null, arguments);
};

var real__attachFunc = asm["_attachFunc"]; asm["_attachFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__attachFunc.apply(null, arguments);
};

var real__avgFinalize = asm["_avgFinalize"]; asm["_avgFinalize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__avgFinalize.apply(null, arguments);
};

var real__binCollFunc = asm["_binCollFunc"]; asm["_binCollFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__binCollFunc.apply(null, arguments);
};

var real__btreeInvokeBusyHandler = asm["_btreeInvokeBusyHandler"]; asm["_btreeInvokeBusyHandler"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__btreeInvokeBusyHandler.apply(null, arguments);
};

var real__btreeParseCellPtr = asm["_btreeParseCellPtr"]; asm["_btreeParseCellPtr"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__btreeParseCellPtr.apply(null, arguments);
};

var real__btreeParseCellPtrIndex = asm["_btreeParseCellPtrIndex"]; asm["_btreeParseCellPtrIndex"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__btreeParseCellPtrIndex.apply(null, arguments);
};

var real__btreeParseCellPtrNoPayload = asm["_btreeParseCellPtrNoPayload"]; asm["_btreeParseCellPtrNoPayload"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__btreeParseCellPtrNoPayload.apply(null, arguments);
};

var real__cdateFunc = asm["_cdateFunc"]; asm["_cdateFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__cdateFunc.apply(null, arguments);
};

var real__cellSizePtr = asm["_cellSizePtr"]; asm["_cellSizePtr"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__cellSizePtr.apply(null, arguments);
};

var real__cellSizePtrNoPayload = asm["_cellSizePtrNoPayload"]; asm["_cellSizePtrNoPayload"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__cellSizePtrNoPayload.apply(null, arguments);
};

var real__changes = asm["_changes"]; asm["_changes"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__changes.apply(null, arguments);
};

var real__charFunc = asm["_charFunc"]; asm["_charFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__charFunc.apply(null, arguments);
};

var real__checkConstraintExprNode = asm["_checkConstraintExprNode"]; asm["_checkConstraintExprNode"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__checkConstraintExprNode.apply(null, arguments);
};

var real__close = asm["_close"]; asm["_close"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__close.apply(null, arguments);
};

var real__compileoptiongetFunc = asm["_compileoptiongetFunc"]; asm["_compileoptiongetFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__compileoptiongetFunc.apply(null, arguments);
};

var real__compileoptionusedFunc = asm["_compileoptionusedFunc"]; asm["_compileoptionusedFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__compileoptionusedFunc.apply(null, arguments);
};

var real__convertCompoundSelectToSubquery = asm["_convertCompoundSelectToSubquery"]; asm["_convertCompoundSelectToSubquery"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__convertCompoundSelectToSubquery.apply(null, arguments);
};

var real__countFinalize = asm["_countFinalize"]; asm["_countFinalize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__countFinalize.apply(null, arguments);
};

var real__countStep = asm["_countStep"]; asm["_countStep"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__countStep.apply(null, arguments);
};

var real__ctimeFunc = asm["_ctimeFunc"]; asm["_ctimeFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__ctimeFunc.apply(null, arguments);
};

var real__ctimestampFunc = asm["_ctimestampFunc"]; asm["_ctimestampFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__ctimestampFunc.apply(null, arguments);
};

var real__dateFunc = asm["_dateFunc"]; asm["_dateFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__dateFunc.apply(null, arguments);
};

var real__datetimeFunc = asm["_datetimeFunc"]; asm["_datetimeFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__datetimeFunc.apply(null, arguments);
};

var real__detachFunc = asm["_detachFunc"]; asm["_detachFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__detachFunc.apply(null, arguments);
};

var real__dotlockCheckReservedLock = asm["_dotlockCheckReservedLock"]; asm["_dotlockCheckReservedLock"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__dotlockCheckReservedLock.apply(null, arguments);
};

var real__dotlockClose = asm["_dotlockClose"]; asm["_dotlockClose"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__dotlockClose.apply(null, arguments);
};

var real__dotlockIoFinderImpl = asm["_dotlockIoFinderImpl"]; asm["_dotlockIoFinderImpl"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__dotlockIoFinderImpl.apply(null, arguments);
};

var real__dotlockLock = asm["_dotlockLock"]; asm["_dotlockLock"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__dotlockLock.apply(null, arguments);
};

var real__dotlockUnlock = asm["_dotlockUnlock"]; asm["_dotlockUnlock"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__dotlockUnlock.apply(null, arguments);
};

var real__errlogFunc = asm["_errlogFunc"]; asm["_errlogFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__errlogFunc.apply(null, arguments);
};

var real__exprIdxCover = asm["_exprIdxCover"]; asm["_exprIdxCover"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__exprIdxCover.apply(null, arguments);
};

var real__exprNodeIsConstant = asm["_exprNodeIsConstant"]; asm["_exprNodeIsConstant"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__exprNodeIsConstant.apply(null, arguments);
};

var real__exprNodeIsConstantOrGroupBy = asm["_exprNodeIsConstantOrGroupBy"]; asm["_exprNodeIsConstantOrGroupBy"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__exprNodeIsConstantOrGroupBy.apply(null, arguments);
};

var real__exprNodeIsDeterministic = asm["_exprNodeIsDeterministic"]; asm["_exprNodeIsDeterministic"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__exprNodeIsDeterministic.apply(null, arguments);
};

var real__exprSrcCount = asm["_exprSrcCount"]; asm["_exprSrcCount"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__exprSrcCount.apply(null, arguments);
};

var real__fchmod = asm["_fchmod"]; asm["_fchmod"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__fchmod.apply(null, arguments);
};

var real__fchown = asm["_fchown"]; asm["_fchown"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__fchown.apply(null, arguments);
};

var real__fcntl = asm["_fcntl"]; asm["_fcntl"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__fcntl.apply(null, arguments);
};

var real__free = asm["_free"]; asm["_free"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__free.apply(null, arguments);
};

var real__fstat = asm["_fstat"]; asm["_fstat"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__fstat.apply(null, arguments);
};

var real__ftruncate = asm["_ftruncate"]; asm["_ftruncate"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__ftruncate.apply(null, arguments);
};

var real__getPageError = asm["_getPageError"]; asm["_getPageError"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__getPageError.apply(null, arguments);
};

var real__getPageNormal = asm["_getPageNormal"]; asm["_getPageNormal"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__getPageNormal.apply(null, arguments);
};

var real__getcwd = asm["_getcwd"]; asm["_getcwd"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__getcwd.apply(null, arguments);
};

var real__geteuid = asm["_geteuid"]; asm["_geteuid"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__geteuid.apply(null, arguments);
};

var real__groupConcatFinalize = asm["_groupConcatFinalize"]; asm["_groupConcatFinalize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__groupConcatFinalize.apply(null, arguments);
};

var real__groupConcatStep = asm["_groupConcatStep"]; asm["_groupConcatStep"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__groupConcatStep.apply(null, arguments);
};

var real__havingToWhereExprCb = asm["_havingToWhereExprCb"]; asm["_havingToWhereExprCb"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__havingToWhereExprCb.apply(null, arguments);
};

var real__hexFunc = asm["_hexFunc"]; asm["_hexFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__hexFunc.apply(null, arguments);
};

var real__impliesNotNullRow = asm["_impliesNotNullRow"]; asm["_impliesNotNullRow"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__impliesNotNullRow.apply(null, arguments);
};

var real__incrAggDepth = asm["_incrAggDepth"]; asm["_incrAggDepth"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__incrAggDepth.apply(null, arguments);
};

var real__instrFunc = asm["_instrFunc"]; asm["_instrFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__instrFunc.apply(null, arguments);
};

var real__juliandayFunc = asm["_juliandayFunc"]; asm["_juliandayFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__juliandayFunc.apply(null, arguments);
};

var real__last_insert_rowid = asm["_last_insert_rowid"]; asm["_last_insert_rowid"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__last_insert_rowid.apply(null, arguments);
};

var real__lengthFunc = asm["_lengthFunc"]; asm["_lengthFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__lengthFunc.apply(null, arguments);
};

var real__likeFunc = asm["_likeFunc"]; asm["_likeFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__likeFunc.apply(null, arguments);
};

var real__llvm_bswap_i32 = asm["_llvm_bswap_i32"]; asm["_llvm_bswap_i32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__llvm_bswap_i32.apply(null, arguments);
};

var real__loadExt = asm["_loadExt"]; asm["_loadExt"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__loadExt.apply(null, arguments);
};

var real__lowerFunc = asm["_lowerFunc"]; asm["_lowerFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__lowerFunc.apply(null, arguments);
};

var real__lstat = asm["_lstat"]; asm["_lstat"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__lstat.apply(null, arguments);
};

var real__malloc = asm["_malloc"]; asm["_malloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__malloc.apply(null, arguments);
};

var real__memalign = asm["_memalign"]; asm["_memalign"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__memalign.apply(null, arguments);
};

var real__memjrnlClose = asm["_memjrnlClose"]; asm["_memjrnlClose"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__memjrnlClose.apply(null, arguments);
};

var real__memjrnlFileSize = asm["_memjrnlFileSize"]; asm["_memjrnlFileSize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__memjrnlFileSize.apply(null, arguments);
};

var real__memjrnlRead = asm["_memjrnlRead"]; asm["_memjrnlRead"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__memjrnlRead.apply(null, arguments);
};

var real__memjrnlSync = asm["_memjrnlSync"]; asm["_memjrnlSync"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__memjrnlSync.apply(null, arguments);
};

var real__memjrnlTruncate = asm["_memjrnlTruncate"]; asm["_memjrnlTruncate"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__memjrnlTruncate.apply(null, arguments);
};

var real__memjrnlWrite = asm["_memjrnlWrite"]; asm["_memjrnlWrite"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__memjrnlWrite.apply(null, arguments);
};

var real__memmove = asm["_memmove"]; asm["_memmove"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__memmove.apply(null, arguments);
};

var real__minMaxFinalize = asm["_minMaxFinalize"]; asm["_minMaxFinalize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__minMaxFinalize.apply(null, arguments);
};

var real__minmaxFunc = asm["_minmaxFunc"]; asm["_minmaxFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__minmaxFunc.apply(null, arguments);
};

var real__minmaxStep = asm["_minmaxStep"]; asm["_minmaxStep"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__minmaxStep.apply(null, arguments);
};

var real__mkdir = asm["_mkdir"]; asm["_mkdir"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__mkdir.apply(null, arguments);
};

var real__nocaseCollatingFunc = asm["_nocaseCollatingFunc"]; asm["_nocaseCollatingFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__nocaseCollatingFunc.apply(null, arguments);
};

var real__nolockCheckReservedLock = asm["_nolockCheckReservedLock"]; asm["_nolockCheckReservedLock"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__nolockCheckReservedLock.apply(null, arguments);
};

var real__nolockClose = asm["_nolockClose"]; asm["_nolockClose"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__nolockClose.apply(null, arguments);
};

var real__nolockIoFinderImpl = asm["_nolockIoFinderImpl"]; asm["_nolockIoFinderImpl"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__nolockIoFinderImpl.apply(null, arguments);
};

var real__nolockLock = asm["_nolockLock"]; asm["_nolockLock"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__nolockLock.apply(null, arguments);
};

var real__nolockUnlock = asm["_nolockUnlock"]; asm["_nolockUnlock"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__nolockUnlock.apply(null, arguments);
};

var real__nullifFunc = asm["_nullifFunc"]; asm["_nullifFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__nullifFunc.apply(null, arguments);
};

var real__openDirectory = asm["_openDirectory"]; asm["_openDirectory"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__openDirectory.apply(null, arguments);
};

var real__pageReinit = asm["_pageReinit"]; asm["_pageReinit"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__pageReinit.apply(null, arguments);
};

var real__pagerStress = asm["_pagerStress"]; asm["_pagerStress"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__pagerStress.apply(null, arguments);
};

var real__pagerUndoCallback = asm["_pagerUndoCallback"]; asm["_pagerUndoCallback"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__pagerUndoCallback.apply(null, arguments);
};

var real__pcache1Cachesize = asm["_pcache1Cachesize"]; asm["_pcache1Cachesize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__pcache1Cachesize.apply(null, arguments);
};

var real__pcache1Create = asm["_pcache1Create"]; asm["_pcache1Create"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__pcache1Create.apply(null, arguments);
};

var real__pcache1Destroy = asm["_pcache1Destroy"]; asm["_pcache1Destroy"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__pcache1Destroy.apply(null, arguments);
};

var real__pcache1Fetch = asm["_pcache1Fetch"]; asm["_pcache1Fetch"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__pcache1Fetch.apply(null, arguments);
};

var real__pcache1Init = asm["_pcache1Init"]; asm["_pcache1Init"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__pcache1Init.apply(null, arguments);
};

var real__pcache1Pagecount = asm["_pcache1Pagecount"]; asm["_pcache1Pagecount"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__pcache1Pagecount.apply(null, arguments);
};

var real__pcache1Rekey = asm["_pcache1Rekey"]; asm["_pcache1Rekey"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__pcache1Rekey.apply(null, arguments);
};

var real__pcache1Shrink = asm["_pcache1Shrink"]; asm["_pcache1Shrink"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__pcache1Shrink.apply(null, arguments);
};

var real__pcache1Shutdown = asm["_pcache1Shutdown"]; asm["_pcache1Shutdown"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__pcache1Shutdown.apply(null, arguments);
};

var real__pcache1Truncate = asm["_pcache1Truncate"]; asm["_pcache1Truncate"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__pcache1Truncate.apply(null, arguments);
};

var real__pcache1Unpin = asm["_pcache1Unpin"]; asm["_pcache1Unpin"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__pcache1Unpin.apply(null, arguments);
};

var real__posixIoFinderImpl = asm["_posixIoFinderImpl"]; asm["_posixIoFinderImpl"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__posixIoFinderImpl.apply(null, arguments);
};

var real__posixOpen = asm["_posixOpen"]; asm["_posixOpen"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__posixOpen.apply(null, arguments);
};

var real__pragmaVtabBestIndex = asm["_pragmaVtabBestIndex"]; asm["_pragmaVtabBestIndex"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__pragmaVtabBestIndex.apply(null, arguments);
};

var real__pragmaVtabClose = asm["_pragmaVtabClose"]; asm["_pragmaVtabClose"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__pragmaVtabClose.apply(null, arguments);
};

var real__pragmaVtabColumn = asm["_pragmaVtabColumn"]; asm["_pragmaVtabColumn"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__pragmaVtabColumn.apply(null, arguments);
};

var real__pragmaVtabConnect = asm["_pragmaVtabConnect"]; asm["_pragmaVtabConnect"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__pragmaVtabConnect.apply(null, arguments);
};

var real__pragmaVtabDisconnect = asm["_pragmaVtabDisconnect"]; asm["_pragmaVtabDisconnect"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__pragmaVtabDisconnect.apply(null, arguments);
};

var real__pragmaVtabEof = asm["_pragmaVtabEof"]; asm["_pragmaVtabEof"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__pragmaVtabEof.apply(null, arguments);
};

var real__pragmaVtabFilter = asm["_pragmaVtabFilter"]; asm["_pragmaVtabFilter"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__pragmaVtabFilter.apply(null, arguments);
};

var real__pragmaVtabNext = asm["_pragmaVtabNext"]; asm["_pragmaVtabNext"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__pragmaVtabNext.apply(null, arguments);
};

var real__pragmaVtabOpen = asm["_pragmaVtabOpen"]; asm["_pragmaVtabOpen"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__pragmaVtabOpen.apply(null, arguments);
};

var real__pragmaVtabRowid = asm["_pragmaVtabRowid"]; asm["_pragmaVtabRowid"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__pragmaVtabRowid.apply(null, arguments);
};

var real__printfFunc = asm["_printfFunc"]; asm["_printfFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__printfFunc.apply(null, arguments);
};

var real__pthread_mutex_lock = asm["_pthread_mutex_lock"]; asm["_pthread_mutex_lock"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__pthread_mutex_lock.apply(null, arguments);
};

var real__pthread_mutex_unlock = asm["_pthread_mutex_unlock"]; asm["_pthread_mutex_unlock"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__pthread_mutex_unlock.apply(null, arguments);
};

var real__quoteFunc = asm["_quoteFunc"]; asm["_quoteFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__quoteFunc.apply(null, arguments);
};

var real__randomBlob = asm["_randomBlob"]; asm["_randomBlob"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__randomBlob.apply(null, arguments);
};

var real__randomFunc = asm["_randomFunc"]; asm["_randomFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__randomFunc.apply(null, arguments);
};

var real__read = asm["_read"]; asm["_read"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__read.apply(null, arguments);
};

var real__readlink = asm["_readlink"]; asm["_readlink"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__readlink.apply(null, arguments);
};

var real__renameParentFunc = asm["_renameParentFunc"]; asm["_renameParentFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__renameParentFunc.apply(null, arguments);
};

var real__renameTableFunc = asm["_renameTableFunc"]; asm["_renameTableFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__renameTableFunc.apply(null, arguments);
};

var real__renameTriggerFunc = asm["_renameTriggerFunc"]; asm["_renameTriggerFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__renameTriggerFunc.apply(null, arguments);
};

var real__replaceFunc = asm["_replaceFunc"]; asm["_replaceFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__replaceFunc.apply(null, arguments);
};

var real__resolveExprStep = asm["_resolveExprStep"]; asm["_resolveExprStep"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__resolveExprStep.apply(null, arguments);
};

var real__resolveSelectStep = asm["_resolveSelectStep"]; asm["_resolveSelectStep"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__resolveSelectStep.apply(null, arguments);
};

var real__rmdir = asm["_rmdir"]; asm["_rmdir"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__rmdir.apply(null, arguments);
};

var real__roundFunc = asm["_roundFunc"]; asm["_roundFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__roundFunc.apply(null, arguments);
};

var real__sbrk = asm["_sbrk"]; asm["_sbrk"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sbrk.apply(null, arguments);
};

var real__selectAddSubqueryTypeInfo = asm["_selectAddSubqueryTypeInfo"]; asm["_selectAddSubqueryTypeInfo"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__selectAddSubqueryTypeInfo.apply(null, arguments);
};

var real__selectExpander = asm["_selectExpander"]; asm["_selectExpander"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__selectExpander.apply(null, arguments);
};

var real__selectPopWith = asm["_selectPopWith"]; asm["_selectPopWith"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__selectPopWith.apply(null, arguments);
};

var real__sn_write = asm["_sn_write"]; asm["_sn_write"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sn_write.apply(null, arguments);
};

var real__sourceidFunc = asm["_sourceidFunc"]; asm["_sourceidFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sourceidFunc.apply(null, arguments);
};

var real__sqlite3BtreeNext = asm["_sqlite3BtreeNext"]; asm["_sqlite3BtreeNext"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3BtreeNext.apply(null, arguments);
};

var real__sqlite3BtreePayloadChecked = asm["_sqlite3BtreePayloadChecked"]; asm["_sqlite3BtreePayloadChecked"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3BtreePayloadChecked.apply(null, arguments);
};

var real__sqlite3BtreePrevious = asm["_sqlite3BtreePrevious"]; asm["_sqlite3BtreePrevious"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3BtreePrevious.apply(null, arguments);
};

var real__sqlite3BtreePutData = asm["_sqlite3BtreePutData"]; asm["_sqlite3BtreePutData"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3BtreePutData.apply(null, arguments);
};

var real__sqlite3ExprIfFalse = asm["_sqlite3ExprIfFalse"]; asm["_sqlite3ExprIfFalse"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3ExprIfFalse.apply(null, arguments);
};

var real__sqlite3ExprIfTrue = asm["_sqlite3ExprIfTrue"]; asm["_sqlite3ExprIfTrue"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3ExprIfTrue.apply(null, arguments);
};

var real__sqlite3ExprWalkNoop = asm["_sqlite3ExprWalkNoop"]; asm["_sqlite3ExprWalkNoop"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3ExprWalkNoop.apply(null, arguments);
};

var real__sqlite3InitCallback = asm["_sqlite3InitCallback"]; asm["_sqlite3InitCallback"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3InitCallback.apply(null, arguments);
};

var real__sqlite3InvalidFunction = asm["_sqlite3InvalidFunction"]; asm["_sqlite3InvalidFunction"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3InvalidFunction.apply(null, arguments);
};

var real__sqlite3MallocSize = asm["_sqlite3MallocSize"]; asm["_sqlite3MallocSize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3MallocSize.apply(null, arguments);
};

var real__sqlite3MemFree = asm["_sqlite3MemFree"]; asm["_sqlite3MemFree"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3MemFree.apply(null, arguments);
};

var real__sqlite3MemInit = asm["_sqlite3MemInit"]; asm["_sqlite3MemInit"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3MemInit.apply(null, arguments);
};

var real__sqlite3MemMalloc = asm["_sqlite3MemMalloc"]; asm["_sqlite3MemMalloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3MemMalloc.apply(null, arguments);
};

var real__sqlite3MemRealloc = asm["_sqlite3MemRealloc"]; asm["_sqlite3MemRealloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3MemRealloc.apply(null, arguments);
};

var real__sqlite3MemRoundup = asm["_sqlite3MemRoundup"]; asm["_sqlite3MemRoundup"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3MemRoundup.apply(null, arguments);
};

var real__sqlite3MemShutdown = asm["_sqlite3MemShutdown"]; asm["_sqlite3MemShutdown"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3MemShutdown.apply(null, arguments);
};

var real__sqlite3MemSize = asm["_sqlite3MemSize"]; asm["_sqlite3MemSize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3MemSize.apply(null, arguments);
};

var real__sqlite3NoopDestructor = asm["_sqlite3NoopDestructor"]; asm["_sqlite3NoopDestructor"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3NoopDestructor.apply(null, arguments);
};

var real__sqlite3SchemaClear = asm["_sqlite3SchemaClear"]; asm["_sqlite3SchemaClear"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3SchemaClear.apply(null, arguments);
};

var real__sqlite3SelectWalkFail = asm["_sqlite3SelectWalkFail"]; asm["_sqlite3SelectWalkFail"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3SelectWalkFail.apply(null, arguments);
};

var real__sqlite3SelectWalkNoop = asm["_sqlite3SelectWalkNoop"]; asm["_sqlite3SelectWalkNoop"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3SelectWalkNoop.apply(null, arguments);
};

var real__sqlite3VdbeRecordCompare = asm["_sqlite3VdbeRecordCompare"]; asm["_sqlite3VdbeRecordCompare"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3VdbeRecordCompare.apply(null, arguments);
};

var real__sqlite3WalDefaultHook = asm["_sqlite3WalDefaultHook"]; asm["_sqlite3WalDefaultHook"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3WalDefaultHook.apply(null, arguments);
};

var real__sqlite3_aggregate_context = asm["_sqlite3_aggregate_context"]; asm["_sqlite3_aggregate_context"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_aggregate_context.apply(null, arguments);
};

var real__sqlite3_auto_extension = asm["_sqlite3_auto_extension"]; asm["_sqlite3_auto_extension"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_auto_extension.apply(null, arguments);
};

var real__sqlite3_backup_finish = asm["_sqlite3_backup_finish"]; asm["_sqlite3_backup_finish"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_backup_finish.apply(null, arguments);
};

var real__sqlite3_backup_init = asm["_sqlite3_backup_init"]; asm["_sqlite3_backup_init"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_backup_init.apply(null, arguments);
};

var real__sqlite3_backup_pagecount = asm["_sqlite3_backup_pagecount"]; asm["_sqlite3_backup_pagecount"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_backup_pagecount.apply(null, arguments);
};

var real__sqlite3_backup_remaining = asm["_sqlite3_backup_remaining"]; asm["_sqlite3_backup_remaining"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_backup_remaining.apply(null, arguments);
};

var real__sqlite3_backup_step = asm["_sqlite3_backup_step"]; asm["_sqlite3_backup_step"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_backup_step.apply(null, arguments);
};

var real__sqlite3_bind_blob = asm["_sqlite3_bind_blob"]; asm["_sqlite3_bind_blob"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_bind_blob.apply(null, arguments);
};

var real__sqlite3_bind_blob64 = asm["_sqlite3_bind_blob64"]; asm["_sqlite3_bind_blob64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_bind_blob64.apply(null, arguments);
};

var real__sqlite3_bind_double = asm["_sqlite3_bind_double"]; asm["_sqlite3_bind_double"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_bind_double.apply(null, arguments);
};

var real__sqlite3_bind_int = asm["_sqlite3_bind_int"]; asm["_sqlite3_bind_int"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_bind_int.apply(null, arguments);
};

var real__sqlite3_bind_int64 = asm["_sqlite3_bind_int64"]; asm["_sqlite3_bind_int64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_bind_int64.apply(null, arguments);
};

var real__sqlite3_bind_null = asm["_sqlite3_bind_null"]; asm["_sqlite3_bind_null"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_bind_null.apply(null, arguments);
};

var real__sqlite3_bind_parameter_count = asm["_sqlite3_bind_parameter_count"]; asm["_sqlite3_bind_parameter_count"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_bind_parameter_count.apply(null, arguments);
};

var real__sqlite3_bind_parameter_index = asm["_sqlite3_bind_parameter_index"]; asm["_sqlite3_bind_parameter_index"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_bind_parameter_index.apply(null, arguments);
};

var real__sqlite3_bind_parameter_name = asm["_sqlite3_bind_parameter_name"]; asm["_sqlite3_bind_parameter_name"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_bind_parameter_name.apply(null, arguments);
};

var real__sqlite3_bind_pointer = asm["_sqlite3_bind_pointer"]; asm["_sqlite3_bind_pointer"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_bind_pointer.apply(null, arguments);
};

var real__sqlite3_bind_text = asm["_sqlite3_bind_text"]; asm["_sqlite3_bind_text"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_bind_text.apply(null, arguments);
};

var real__sqlite3_bind_text16 = asm["_sqlite3_bind_text16"]; asm["_sqlite3_bind_text16"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_bind_text16.apply(null, arguments);
};

var real__sqlite3_bind_text64 = asm["_sqlite3_bind_text64"]; asm["_sqlite3_bind_text64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_bind_text64.apply(null, arguments);
};

var real__sqlite3_bind_value = asm["_sqlite3_bind_value"]; asm["_sqlite3_bind_value"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_bind_value.apply(null, arguments);
};

var real__sqlite3_bind_zeroblob = asm["_sqlite3_bind_zeroblob"]; asm["_sqlite3_bind_zeroblob"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_bind_zeroblob.apply(null, arguments);
};

var real__sqlite3_bind_zeroblob64 = asm["_sqlite3_bind_zeroblob64"]; asm["_sqlite3_bind_zeroblob64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_bind_zeroblob64.apply(null, arguments);
};

var real__sqlite3_blob_bytes = asm["_sqlite3_blob_bytes"]; asm["_sqlite3_blob_bytes"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_blob_bytes.apply(null, arguments);
};

var real__sqlite3_blob_close = asm["_sqlite3_blob_close"]; asm["_sqlite3_blob_close"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_blob_close.apply(null, arguments);
};

var real__sqlite3_blob_open = asm["_sqlite3_blob_open"]; asm["_sqlite3_blob_open"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_blob_open.apply(null, arguments);
};

var real__sqlite3_blob_read = asm["_sqlite3_blob_read"]; asm["_sqlite3_blob_read"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_blob_read.apply(null, arguments);
};

var real__sqlite3_blob_reopen = asm["_sqlite3_blob_reopen"]; asm["_sqlite3_blob_reopen"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_blob_reopen.apply(null, arguments);
};

var real__sqlite3_blob_write = asm["_sqlite3_blob_write"]; asm["_sqlite3_blob_write"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_blob_write.apply(null, arguments);
};

var real__sqlite3_busy_handler = asm["_sqlite3_busy_handler"]; asm["_sqlite3_busy_handler"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_busy_handler.apply(null, arguments);
};

var real__sqlite3_busy_timeout = asm["_sqlite3_busy_timeout"]; asm["_sqlite3_busy_timeout"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_busy_timeout.apply(null, arguments);
};

var real__sqlite3_cancel_auto_extension = asm["_sqlite3_cancel_auto_extension"]; asm["_sqlite3_cancel_auto_extension"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_cancel_auto_extension.apply(null, arguments);
};

var real__sqlite3_changes = asm["_sqlite3_changes"]; asm["_sqlite3_changes"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_changes.apply(null, arguments);
};

var real__sqlite3_clear_bindings = asm["_sqlite3_clear_bindings"]; asm["_sqlite3_clear_bindings"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_clear_bindings.apply(null, arguments);
};

var real__sqlite3_close = asm["_sqlite3_close"]; asm["_sqlite3_close"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_close.apply(null, arguments);
};

var real__sqlite3_close_v2 = asm["_sqlite3_close_v2"]; asm["_sqlite3_close_v2"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_close_v2.apply(null, arguments);
};

var real__sqlite3_collation_needed = asm["_sqlite3_collation_needed"]; asm["_sqlite3_collation_needed"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_collation_needed.apply(null, arguments);
};

var real__sqlite3_collation_needed16 = asm["_sqlite3_collation_needed16"]; asm["_sqlite3_collation_needed16"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_collation_needed16.apply(null, arguments);
};

var real__sqlite3_column_blob = asm["_sqlite3_column_blob"]; asm["_sqlite3_column_blob"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_column_blob.apply(null, arguments);
};

var real__sqlite3_column_bytes = asm["_sqlite3_column_bytes"]; asm["_sqlite3_column_bytes"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_column_bytes.apply(null, arguments);
};

var real__sqlite3_column_bytes16 = asm["_sqlite3_column_bytes16"]; asm["_sqlite3_column_bytes16"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_column_bytes16.apply(null, arguments);
};

var real__sqlite3_column_count = asm["_sqlite3_column_count"]; asm["_sqlite3_column_count"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_column_count.apply(null, arguments);
};

var real__sqlite3_column_decltype = asm["_sqlite3_column_decltype"]; asm["_sqlite3_column_decltype"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_column_decltype.apply(null, arguments);
};

var real__sqlite3_column_decltype16 = asm["_sqlite3_column_decltype16"]; asm["_sqlite3_column_decltype16"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_column_decltype16.apply(null, arguments);
};

var real__sqlite3_column_double = asm["_sqlite3_column_double"]; asm["_sqlite3_column_double"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_column_double.apply(null, arguments);
};

var real__sqlite3_column_int = asm["_sqlite3_column_int"]; asm["_sqlite3_column_int"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_column_int.apply(null, arguments);
};

var real__sqlite3_column_int64 = asm["_sqlite3_column_int64"]; asm["_sqlite3_column_int64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_column_int64.apply(null, arguments);
};

var real__sqlite3_column_name = asm["_sqlite3_column_name"]; asm["_sqlite3_column_name"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_column_name.apply(null, arguments);
};

var real__sqlite3_column_name16 = asm["_sqlite3_column_name16"]; asm["_sqlite3_column_name16"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_column_name16.apply(null, arguments);
};

var real__sqlite3_column_text = asm["_sqlite3_column_text"]; asm["_sqlite3_column_text"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_column_text.apply(null, arguments);
};

var real__sqlite3_column_text16 = asm["_sqlite3_column_text16"]; asm["_sqlite3_column_text16"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_column_text16.apply(null, arguments);
};

var real__sqlite3_column_type = asm["_sqlite3_column_type"]; asm["_sqlite3_column_type"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_column_type.apply(null, arguments);
};

var real__sqlite3_column_value = asm["_sqlite3_column_value"]; asm["_sqlite3_column_value"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_column_value.apply(null, arguments);
};

var real__sqlite3_commit_hook = asm["_sqlite3_commit_hook"]; asm["_sqlite3_commit_hook"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_commit_hook.apply(null, arguments);
};

var real__sqlite3_compileoption_get = asm["_sqlite3_compileoption_get"]; asm["_sqlite3_compileoption_get"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_compileoption_get.apply(null, arguments);
};

var real__sqlite3_compileoption_used = asm["_sqlite3_compileoption_used"]; asm["_sqlite3_compileoption_used"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_compileoption_used.apply(null, arguments);
};

var real__sqlite3_complete = asm["_sqlite3_complete"]; asm["_sqlite3_complete"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_complete.apply(null, arguments);
};

var real__sqlite3_complete16 = asm["_sqlite3_complete16"]; asm["_sqlite3_complete16"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_complete16.apply(null, arguments);
};

var real__sqlite3_context_db_handle = asm["_sqlite3_context_db_handle"]; asm["_sqlite3_context_db_handle"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_context_db_handle.apply(null, arguments);
};

var real__sqlite3_create_collation = asm["_sqlite3_create_collation"]; asm["_sqlite3_create_collation"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_create_collation.apply(null, arguments);
};

var real__sqlite3_create_collation16 = asm["_sqlite3_create_collation16"]; asm["_sqlite3_create_collation16"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_create_collation16.apply(null, arguments);
};

var real__sqlite3_create_collation_v2 = asm["_sqlite3_create_collation_v2"]; asm["_sqlite3_create_collation_v2"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_create_collation_v2.apply(null, arguments);
};

var real__sqlite3_create_function = asm["_sqlite3_create_function"]; asm["_sqlite3_create_function"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_create_function.apply(null, arguments);
};

var real__sqlite3_create_function16 = asm["_sqlite3_create_function16"]; asm["_sqlite3_create_function16"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_create_function16.apply(null, arguments);
};

var real__sqlite3_create_function_v2 = asm["_sqlite3_create_function_v2"]; asm["_sqlite3_create_function_v2"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_create_function_v2.apply(null, arguments);
};

var real__sqlite3_create_module = asm["_sqlite3_create_module"]; asm["_sqlite3_create_module"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_create_module.apply(null, arguments);
};

var real__sqlite3_create_module_v2 = asm["_sqlite3_create_module_v2"]; asm["_sqlite3_create_module_v2"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_create_module_v2.apply(null, arguments);
};

var real__sqlite3_data_count = asm["_sqlite3_data_count"]; asm["_sqlite3_data_count"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_data_count.apply(null, arguments);
};

var real__sqlite3_db_cacheflush = asm["_sqlite3_db_cacheflush"]; asm["_sqlite3_db_cacheflush"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_db_cacheflush.apply(null, arguments);
};

var real__sqlite3_db_config = asm["_sqlite3_db_config"]; asm["_sqlite3_db_config"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_db_config.apply(null, arguments);
};

var real__sqlite3_db_filename = asm["_sqlite3_db_filename"]; asm["_sqlite3_db_filename"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_db_filename.apply(null, arguments);
};

var real__sqlite3_db_handle = asm["_sqlite3_db_handle"]; asm["_sqlite3_db_handle"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_db_handle.apply(null, arguments);
};

var real__sqlite3_db_mutex = asm["_sqlite3_db_mutex"]; asm["_sqlite3_db_mutex"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_db_mutex.apply(null, arguments);
};

var real__sqlite3_db_readonly = asm["_sqlite3_db_readonly"]; asm["_sqlite3_db_readonly"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_db_readonly.apply(null, arguments);
};

var real__sqlite3_db_release_memory = asm["_sqlite3_db_release_memory"]; asm["_sqlite3_db_release_memory"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_db_release_memory.apply(null, arguments);
};

var real__sqlite3_db_status = asm["_sqlite3_db_status"]; asm["_sqlite3_db_status"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_db_status.apply(null, arguments);
};

var real__sqlite3_declare_vtab = asm["_sqlite3_declare_vtab"]; asm["_sqlite3_declare_vtab"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_declare_vtab.apply(null, arguments);
};

var real__sqlite3_errcode = asm["_sqlite3_errcode"]; asm["_sqlite3_errcode"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_errcode.apply(null, arguments);
};

var real__sqlite3_errmsg = asm["_sqlite3_errmsg"]; asm["_sqlite3_errmsg"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_errmsg.apply(null, arguments);
};

var real__sqlite3_errmsg16 = asm["_sqlite3_errmsg16"]; asm["_sqlite3_errmsg16"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_errmsg16.apply(null, arguments);
};

var real__sqlite3_errstr = asm["_sqlite3_errstr"]; asm["_sqlite3_errstr"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_errstr.apply(null, arguments);
};

var real__sqlite3_exec = asm["_sqlite3_exec"]; asm["_sqlite3_exec"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_exec.apply(null, arguments);
};

var real__sqlite3_expanded_sql = asm["_sqlite3_expanded_sql"]; asm["_sqlite3_expanded_sql"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_expanded_sql.apply(null, arguments);
};

var real__sqlite3_extended_errcode = asm["_sqlite3_extended_errcode"]; asm["_sqlite3_extended_errcode"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_extended_errcode.apply(null, arguments);
};

var real__sqlite3_extended_result_codes = asm["_sqlite3_extended_result_codes"]; asm["_sqlite3_extended_result_codes"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_extended_result_codes.apply(null, arguments);
};

var real__sqlite3_file_control = asm["_sqlite3_file_control"]; asm["_sqlite3_file_control"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_file_control.apply(null, arguments);
};

var real__sqlite3_finalize = asm["_sqlite3_finalize"]; asm["_sqlite3_finalize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_finalize.apply(null, arguments);
};

var real__sqlite3_free = asm["_sqlite3_free"]; asm["_sqlite3_free"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_free.apply(null, arguments);
};

var real__sqlite3_free_table = asm["_sqlite3_free_table"]; asm["_sqlite3_free_table"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_free_table.apply(null, arguments);
};

var real__sqlite3_get_autocommit = asm["_sqlite3_get_autocommit"]; asm["_sqlite3_get_autocommit"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_get_autocommit.apply(null, arguments);
};

var real__sqlite3_get_auxdata = asm["_sqlite3_get_auxdata"]; asm["_sqlite3_get_auxdata"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_get_auxdata.apply(null, arguments);
};

var real__sqlite3_get_table = asm["_sqlite3_get_table"]; asm["_sqlite3_get_table"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_get_table.apply(null, arguments);
};

var real__sqlite3_get_table_cb = asm["_sqlite3_get_table_cb"]; asm["_sqlite3_get_table_cb"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_get_table_cb.apply(null, arguments);
};

var real__sqlite3_interrupt = asm["_sqlite3_interrupt"]; asm["_sqlite3_interrupt"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_interrupt.apply(null, arguments);
};

var real__sqlite3_last_insert_rowid = asm["_sqlite3_last_insert_rowid"]; asm["_sqlite3_last_insert_rowid"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_last_insert_rowid.apply(null, arguments);
};

var real__sqlite3_libversion = asm["_sqlite3_libversion"]; asm["_sqlite3_libversion"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_libversion.apply(null, arguments);
};

var real__sqlite3_libversion_number = asm["_sqlite3_libversion_number"]; asm["_sqlite3_libversion_number"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_libversion_number.apply(null, arguments);
};

var real__sqlite3_limit = asm["_sqlite3_limit"]; asm["_sqlite3_limit"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_limit.apply(null, arguments);
};

var real__sqlite3_load_extension = asm["_sqlite3_load_extension"]; asm["_sqlite3_load_extension"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_load_extension.apply(null, arguments);
};

var real__sqlite3_log = asm["_sqlite3_log"]; asm["_sqlite3_log"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_log.apply(null, arguments);
};

var real__sqlite3_malloc = asm["_sqlite3_malloc"]; asm["_sqlite3_malloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_malloc.apply(null, arguments);
};

var real__sqlite3_malloc64 = asm["_sqlite3_malloc64"]; asm["_sqlite3_malloc64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_malloc64.apply(null, arguments);
};

var real__sqlite3_memory_highwater = asm["_sqlite3_memory_highwater"]; asm["_sqlite3_memory_highwater"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_memory_highwater.apply(null, arguments);
};

var real__sqlite3_memory_used = asm["_sqlite3_memory_used"]; asm["_sqlite3_memory_used"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_memory_used.apply(null, arguments);
};

var real__sqlite3_mprintf = asm["_sqlite3_mprintf"]; asm["_sqlite3_mprintf"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_mprintf.apply(null, arguments);
};

var real__sqlite3_msize = asm["_sqlite3_msize"]; asm["_sqlite3_msize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_msize.apply(null, arguments);
};

var real__sqlite3_next_stmt = asm["_sqlite3_next_stmt"]; asm["_sqlite3_next_stmt"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_next_stmt.apply(null, arguments);
};

var real__sqlite3_open = asm["_sqlite3_open"]; asm["_sqlite3_open"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_open.apply(null, arguments);
};

var real__sqlite3_open16 = asm["_sqlite3_open16"]; asm["_sqlite3_open16"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_open16.apply(null, arguments);
};

var real__sqlite3_open_v2 = asm["_sqlite3_open_v2"]; asm["_sqlite3_open_v2"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_open_v2.apply(null, arguments);
};

var real__sqlite3_overload_function = asm["_sqlite3_overload_function"]; asm["_sqlite3_overload_function"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_overload_function.apply(null, arguments);
};

var real__sqlite3_prepare = asm["_sqlite3_prepare"]; asm["_sqlite3_prepare"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_prepare.apply(null, arguments);
};

var real__sqlite3_prepare16 = asm["_sqlite3_prepare16"]; asm["_sqlite3_prepare16"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_prepare16.apply(null, arguments);
};

var real__sqlite3_prepare16_v2 = asm["_sqlite3_prepare16_v2"]; asm["_sqlite3_prepare16_v2"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_prepare16_v2.apply(null, arguments);
};

var real__sqlite3_prepare16_v3 = asm["_sqlite3_prepare16_v3"]; asm["_sqlite3_prepare16_v3"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_prepare16_v3.apply(null, arguments);
};

var real__sqlite3_prepare_v2 = asm["_sqlite3_prepare_v2"]; asm["_sqlite3_prepare_v2"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_prepare_v2.apply(null, arguments);
};

var real__sqlite3_prepare_v3 = asm["_sqlite3_prepare_v3"]; asm["_sqlite3_prepare_v3"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_prepare_v3.apply(null, arguments);
};

var real__sqlite3_progress_handler = asm["_sqlite3_progress_handler"]; asm["_sqlite3_progress_handler"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_progress_handler.apply(null, arguments);
};

var real__sqlite3_randomness = asm["_sqlite3_randomness"]; asm["_sqlite3_randomness"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_randomness.apply(null, arguments);
};

var real__sqlite3_realloc = asm["_sqlite3_realloc"]; asm["_sqlite3_realloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_realloc.apply(null, arguments);
};

var real__sqlite3_realloc64 = asm["_sqlite3_realloc64"]; asm["_sqlite3_realloc64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_realloc64.apply(null, arguments);
};

var real__sqlite3_release_memory = asm["_sqlite3_release_memory"]; asm["_sqlite3_release_memory"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_release_memory.apply(null, arguments);
};

var real__sqlite3_reset = asm["_sqlite3_reset"]; asm["_sqlite3_reset"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_reset.apply(null, arguments);
};

var real__sqlite3_reset_auto_extension = asm["_sqlite3_reset_auto_extension"]; asm["_sqlite3_reset_auto_extension"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_reset_auto_extension.apply(null, arguments);
};

var real__sqlite3_result_blob = asm["_sqlite3_result_blob"]; asm["_sqlite3_result_blob"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_result_blob.apply(null, arguments);
};

var real__sqlite3_result_blob64 = asm["_sqlite3_result_blob64"]; asm["_sqlite3_result_blob64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_result_blob64.apply(null, arguments);
};

var real__sqlite3_result_double = asm["_sqlite3_result_double"]; asm["_sqlite3_result_double"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_result_double.apply(null, arguments);
};

var real__sqlite3_result_error = asm["_sqlite3_result_error"]; asm["_sqlite3_result_error"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_result_error.apply(null, arguments);
};

var real__sqlite3_result_error16 = asm["_sqlite3_result_error16"]; asm["_sqlite3_result_error16"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_result_error16.apply(null, arguments);
};

var real__sqlite3_result_error_code = asm["_sqlite3_result_error_code"]; asm["_sqlite3_result_error_code"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_result_error_code.apply(null, arguments);
};

var real__sqlite3_result_error_nomem = asm["_sqlite3_result_error_nomem"]; asm["_sqlite3_result_error_nomem"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_result_error_nomem.apply(null, arguments);
};

var real__sqlite3_result_error_toobig = asm["_sqlite3_result_error_toobig"]; asm["_sqlite3_result_error_toobig"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_result_error_toobig.apply(null, arguments);
};

var real__sqlite3_result_int = asm["_sqlite3_result_int"]; asm["_sqlite3_result_int"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_result_int.apply(null, arguments);
};

var real__sqlite3_result_int64 = asm["_sqlite3_result_int64"]; asm["_sqlite3_result_int64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_result_int64.apply(null, arguments);
};

var real__sqlite3_result_null = asm["_sqlite3_result_null"]; asm["_sqlite3_result_null"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_result_null.apply(null, arguments);
};

var real__sqlite3_result_pointer = asm["_sqlite3_result_pointer"]; asm["_sqlite3_result_pointer"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_result_pointer.apply(null, arguments);
};

var real__sqlite3_result_subtype = asm["_sqlite3_result_subtype"]; asm["_sqlite3_result_subtype"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_result_subtype.apply(null, arguments);
};

var real__sqlite3_result_text = asm["_sqlite3_result_text"]; asm["_sqlite3_result_text"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_result_text.apply(null, arguments);
};

var real__sqlite3_result_text16 = asm["_sqlite3_result_text16"]; asm["_sqlite3_result_text16"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_result_text16.apply(null, arguments);
};

var real__sqlite3_result_text16be = asm["_sqlite3_result_text16be"]; asm["_sqlite3_result_text16be"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_result_text16be.apply(null, arguments);
};

var real__sqlite3_result_text16le = asm["_sqlite3_result_text16le"]; asm["_sqlite3_result_text16le"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_result_text16le.apply(null, arguments);
};

var real__sqlite3_result_text64 = asm["_sqlite3_result_text64"]; asm["_sqlite3_result_text64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_result_text64.apply(null, arguments);
};

var real__sqlite3_result_value = asm["_sqlite3_result_value"]; asm["_sqlite3_result_value"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_result_value.apply(null, arguments);
};

var real__sqlite3_result_zeroblob = asm["_sqlite3_result_zeroblob"]; asm["_sqlite3_result_zeroblob"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_result_zeroblob.apply(null, arguments);
};

var real__sqlite3_result_zeroblob64 = asm["_sqlite3_result_zeroblob64"]; asm["_sqlite3_result_zeroblob64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_result_zeroblob64.apply(null, arguments);
};

var real__sqlite3_rollback_hook = asm["_sqlite3_rollback_hook"]; asm["_sqlite3_rollback_hook"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_rollback_hook.apply(null, arguments);
};

var real__sqlite3_set_authorizer = asm["_sqlite3_set_authorizer"]; asm["_sqlite3_set_authorizer"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_set_authorizer.apply(null, arguments);
};

var real__sqlite3_set_auxdata = asm["_sqlite3_set_auxdata"]; asm["_sqlite3_set_auxdata"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_set_auxdata.apply(null, arguments);
};

var real__sqlite3_set_last_insert_rowid = asm["_sqlite3_set_last_insert_rowid"]; asm["_sqlite3_set_last_insert_rowid"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_set_last_insert_rowid.apply(null, arguments);
};

var real__sqlite3_sleep = asm["_sqlite3_sleep"]; asm["_sqlite3_sleep"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_sleep.apply(null, arguments);
};

var real__sqlite3_snprintf = asm["_sqlite3_snprintf"]; asm["_sqlite3_snprintf"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_snprintf.apply(null, arguments);
};

var real__sqlite3_soft_heap_limit = asm["_sqlite3_soft_heap_limit"]; asm["_sqlite3_soft_heap_limit"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_soft_heap_limit.apply(null, arguments);
};

var real__sqlite3_soft_heap_limit64 = asm["_sqlite3_soft_heap_limit64"]; asm["_sqlite3_soft_heap_limit64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_soft_heap_limit64.apply(null, arguments);
};

var real__sqlite3_sourceid = asm["_sqlite3_sourceid"]; asm["_sqlite3_sourceid"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_sourceid.apply(null, arguments);
};

var real__sqlite3_sql = asm["_sqlite3_sql"]; asm["_sqlite3_sql"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_sql.apply(null, arguments);
};

var real__sqlite3_status = asm["_sqlite3_status"]; asm["_sqlite3_status"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_status.apply(null, arguments);
};

var real__sqlite3_status64 = asm["_sqlite3_status64"]; asm["_sqlite3_status64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_status64.apply(null, arguments);
};

var real__sqlite3_step = asm["_sqlite3_step"]; asm["_sqlite3_step"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_step.apply(null, arguments);
};

var real__sqlite3_stmt_busy = asm["_sqlite3_stmt_busy"]; asm["_sqlite3_stmt_busy"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_stmt_busy.apply(null, arguments);
};

var real__sqlite3_stmt_readonly = asm["_sqlite3_stmt_readonly"]; asm["_sqlite3_stmt_readonly"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_stmt_readonly.apply(null, arguments);
};

var real__sqlite3_stmt_status = asm["_sqlite3_stmt_status"]; asm["_sqlite3_stmt_status"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_stmt_status.apply(null, arguments);
};

var real__sqlite3_strglob = asm["_sqlite3_strglob"]; asm["_sqlite3_strglob"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_strglob.apply(null, arguments);
};

var real__sqlite3_stricmp = asm["_sqlite3_stricmp"]; asm["_sqlite3_stricmp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_stricmp.apply(null, arguments);
};

var real__sqlite3_strlike = asm["_sqlite3_strlike"]; asm["_sqlite3_strlike"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_strlike.apply(null, arguments);
};

var real__sqlite3_strnicmp = asm["_sqlite3_strnicmp"]; asm["_sqlite3_strnicmp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_strnicmp.apply(null, arguments);
};

var real__sqlite3_system_errno = asm["_sqlite3_system_errno"]; asm["_sqlite3_system_errno"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_system_errno.apply(null, arguments);
};

var real__sqlite3_table_column_metadata = asm["_sqlite3_table_column_metadata"]; asm["_sqlite3_table_column_metadata"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_table_column_metadata.apply(null, arguments);
};

var real__sqlite3_test_control = asm["_sqlite3_test_control"]; asm["_sqlite3_test_control"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_test_control.apply(null, arguments);
};

var real__sqlite3_threadsafe = asm["_sqlite3_threadsafe"]; asm["_sqlite3_threadsafe"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_threadsafe.apply(null, arguments);
};

var real__sqlite3_total_changes = asm["_sqlite3_total_changes"]; asm["_sqlite3_total_changes"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_total_changes.apply(null, arguments);
};

var real__sqlite3_trace_v2 = asm["_sqlite3_trace_v2"]; asm["_sqlite3_trace_v2"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_trace_v2.apply(null, arguments);
};

var real__sqlite3_update_hook = asm["_sqlite3_update_hook"]; asm["_sqlite3_update_hook"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_update_hook.apply(null, arguments);
};

var real__sqlite3_uri_boolean = asm["_sqlite3_uri_boolean"]; asm["_sqlite3_uri_boolean"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_uri_boolean.apply(null, arguments);
};

var real__sqlite3_uri_int64 = asm["_sqlite3_uri_int64"]; asm["_sqlite3_uri_int64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_uri_int64.apply(null, arguments);
};

var real__sqlite3_uri_parameter = asm["_sqlite3_uri_parameter"]; asm["_sqlite3_uri_parameter"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_uri_parameter.apply(null, arguments);
};

var real__sqlite3_user_data = asm["_sqlite3_user_data"]; asm["_sqlite3_user_data"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_user_data.apply(null, arguments);
};

var real__sqlite3_value_blob = asm["_sqlite3_value_blob"]; asm["_sqlite3_value_blob"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_value_blob.apply(null, arguments);
};

var real__sqlite3_value_bytes = asm["_sqlite3_value_bytes"]; asm["_sqlite3_value_bytes"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_value_bytes.apply(null, arguments);
};

var real__sqlite3_value_bytes16 = asm["_sqlite3_value_bytes16"]; asm["_sqlite3_value_bytes16"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_value_bytes16.apply(null, arguments);
};

var real__sqlite3_value_double = asm["_sqlite3_value_double"]; asm["_sqlite3_value_double"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_value_double.apply(null, arguments);
};

var real__sqlite3_value_dup = asm["_sqlite3_value_dup"]; asm["_sqlite3_value_dup"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_value_dup.apply(null, arguments);
};

var real__sqlite3_value_free = asm["_sqlite3_value_free"]; asm["_sqlite3_value_free"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_value_free.apply(null, arguments);
};

var real__sqlite3_value_int = asm["_sqlite3_value_int"]; asm["_sqlite3_value_int"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_value_int.apply(null, arguments);
};

var real__sqlite3_value_int64 = asm["_sqlite3_value_int64"]; asm["_sqlite3_value_int64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_value_int64.apply(null, arguments);
};

var real__sqlite3_value_nochange = asm["_sqlite3_value_nochange"]; asm["_sqlite3_value_nochange"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_value_nochange.apply(null, arguments);
};

var real__sqlite3_value_numeric_type = asm["_sqlite3_value_numeric_type"]; asm["_sqlite3_value_numeric_type"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_value_numeric_type.apply(null, arguments);
};

var real__sqlite3_value_pointer = asm["_sqlite3_value_pointer"]; asm["_sqlite3_value_pointer"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_value_pointer.apply(null, arguments);
};

var real__sqlite3_value_subtype = asm["_sqlite3_value_subtype"]; asm["_sqlite3_value_subtype"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_value_subtype.apply(null, arguments);
};

var real__sqlite3_value_text = asm["_sqlite3_value_text"]; asm["_sqlite3_value_text"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_value_text.apply(null, arguments);
};

var real__sqlite3_value_text16 = asm["_sqlite3_value_text16"]; asm["_sqlite3_value_text16"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_value_text16.apply(null, arguments);
};

var real__sqlite3_value_text16be = asm["_sqlite3_value_text16be"]; asm["_sqlite3_value_text16be"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_value_text16be.apply(null, arguments);
};

var real__sqlite3_value_text16le = asm["_sqlite3_value_text16le"]; asm["_sqlite3_value_text16le"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_value_text16le.apply(null, arguments);
};

var real__sqlite3_value_type = asm["_sqlite3_value_type"]; asm["_sqlite3_value_type"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_value_type.apply(null, arguments);
};

var real__sqlite3_vfs_find = asm["_sqlite3_vfs_find"]; asm["_sqlite3_vfs_find"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_vfs_find.apply(null, arguments);
};

var real__sqlite3_vfs_register = asm["_sqlite3_vfs_register"]; asm["_sqlite3_vfs_register"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_vfs_register.apply(null, arguments);
};

var real__sqlite3_vfs_unregister = asm["_sqlite3_vfs_unregister"]; asm["_sqlite3_vfs_unregister"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_vfs_unregister.apply(null, arguments);
};

var real__sqlite3_vmprintf = asm["_sqlite3_vmprintf"]; asm["_sqlite3_vmprintf"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_vmprintf.apply(null, arguments);
};

var real__sqlite3_vsnprintf = asm["_sqlite3_vsnprintf"]; asm["_sqlite3_vsnprintf"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_vsnprintf.apply(null, arguments);
};

var real__sqlite3_vtab_collation = asm["_sqlite3_vtab_collation"]; asm["_sqlite3_vtab_collation"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_vtab_collation.apply(null, arguments);
};

var real__sqlite3_vtab_config = asm["_sqlite3_vtab_config"]; asm["_sqlite3_vtab_config"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_vtab_config.apply(null, arguments);
};

var real__sqlite3_vtab_nochange = asm["_sqlite3_vtab_nochange"]; asm["_sqlite3_vtab_nochange"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_vtab_nochange.apply(null, arguments);
};

var real__sqlite3_vtab_on_conflict = asm["_sqlite3_vtab_on_conflict"]; asm["_sqlite3_vtab_on_conflict"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_vtab_on_conflict.apply(null, arguments);
};

var real__sqlite3_wal_autocheckpoint = asm["_sqlite3_wal_autocheckpoint"]; asm["_sqlite3_wal_autocheckpoint"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_wal_autocheckpoint.apply(null, arguments);
};

var real__sqlite3_wal_checkpoint = asm["_sqlite3_wal_checkpoint"]; asm["_sqlite3_wal_checkpoint"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_wal_checkpoint.apply(null, arguments);
};

var real__sqlite3_wal_checkpoint_v2 = asm["_sqlite3_wal_checkpoint_v2"]; asm["_sqlite3_wal_checkpoint_v2"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_wal_checkpoint_v2.apply(null, arguments);
};

var real__sqlite3_wal_hook = asm["_sqlite3_wal_hook"]; asm["_sqlite3_wal_hook"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqlite3_wal_hook.apply(null, arguments);
};

var real__sqliteDefaultBusyCallback = asm["_sqliteDefaultBusyCallback"]; asm["_sqliteDefaultBusyCallback"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sqliteDefaultBusyCallback.apply(null, arguments);
};

var real__stat = asm["_stat"]; asm["_stat"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__stat.apply(null, arguments);
};

var real__stat4Destructor = asm["_stat4Destructor"]; asm["_stat4Destructor"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__stat4Destructor.apply(null, arguments);
};

var real__statGet = asm["_statGet"]; asm["_statGet"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__statGet.apply(null, arguments);
};

var real__statInit = asm["_statInit"]; asm["_statInit"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__statInit.apply(null, arguments);
};

var real__statPush = asm["_statPush"]; asm["_statPush"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__statPush.apply(null, arguments);
};

var real__strftimeFunc = asm["_strftimeFunc"]; asm["_strftimeFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__strftimeFunc.apply(null, arguments);
};

var real__substrFunc = asm["_substrFunc"]; asm["_substrFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__substrFunc.apply(null, arguments);
};

var real__sumFinalize = asm["_sumFinalize"]; asm["_sumFinalize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sumFinalize.apply(null, arguments);
};

var real__sumStep = asm["_sumStep"]; asm["_sumStep"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sumStep.apply(null, arguments);
};

var real__timeFunc = asm["_timeFunc"]; asm["_timeFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__timeFunc.apply(null, arguments);
};

var real__totalFinalize = asm["_totalFinalize"]; asm["_totalFinalize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__totalFinalize.apply(null, arguments);
};

var real__total_changes = asm["_total_changes"]; asm["_total_changes"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__total_changes.apply(null, arguments);
};

var real__trimFunc = asm["_trimFunc"]; asm["_trimFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__trimFunc.apply(null, arguments);
};

var real__typeofFunc = asm["_typeofFunc"]; asm["_typeofFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__typeofFunc.apply(null, arguments);
};

var real__unicodeFunc = asm["_unicodeFunc"]; asm["_unicodeFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__unicodeFunc.apply(null, arguments);
};

var real__unixAccess = asm["_unixAccess"]; asm["_unixAccess"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__unixAccess.apply(null, arguments);
};

var real__unixCheckReservedLock = asm["_unixCheckReservedLock"]; asm["_unixCheckReservedLock"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__unixCheckReservedLock.apply(null, arguments);
};

var real__unixClose = asm["_unixClose"]; asm["_unixClose"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__unixClose.apply(null, arguments);
};

var real__unixCurrentTimeInt64 = asm["_unixCurrentTimeInt64"]; asm["_unixCurrentTimeInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__unixCurrentTimeInt64.apply(null, arguments);
};

var real__unixDelete = asm["_unixDelete"]; asm["_unixDelete"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__unixDelete.apply(null, arguments);
};

var real__unixDeviceCharacteristics = asm["_unixDeviceCharacteristics"]; asm["_unixDeviceCharacteristics"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__unixDeviceCharacteristics.apply(null, arguments);
};

var real__unixDlClose = asm["_unixDlClose"]; asm["_unixDlClose"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__unixDlClose.apply(null, arguments);
};

var real__unixDlError = asm["_unixDlError"]; asm["_unixDlError"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__unixDlError.apply(null, arguments);
};

var real__unixDlOpen = asm["_unixDlOpen"]; asm["_unixDlOpen"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__unixDlOpen.apply(null, arguments);
};

var real__unixDlSym = asm["_unixDlSym"]; asm["_unixDlSym"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__unixDlSym.apply(null, arguments);
};

var real__unixFetch = asm["_unixFetch"]; asm["_unixFetch"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__unixFetch.apply(null, arguments);
};

var real__unixFileControl = asm["_unixFileControl"]; asm["_unixFileControl"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__unixFileControl.apply(null, arguments);
};

var real__unixFileSize = asm["_unixFileSize"]; asm["_unixFileSize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__unixFileSize.apply(null, arguments);
};

var real__unixFullPathname = asm["_unixFullPathname"]; asm["_unixFullPathname"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__unixFullPathname.apply(null, arguments);
};

var real__unixGetLastError = asm["_unixGetLastError"]; asm["_unixGetLastError"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__unixGetLastError.apply(null, arguments);
};

var real__unixGetSystemCall = asm["_unixGetSystemCall"]; asm["_unixGetSystemCall"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__unixGetSystemCall.apply(null, arguments);
};

var real__unixGetpagesize = asm["_unixGetpagesize"]; asm["_unixGetpagesize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__unixGetpagesize.apply(null, arguments);
};

var real__unixLock = asm["_unixLock"]; asm["_unixLock"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__unixLock.apply(null, arguments);
};

var real__unixNextSystemCall = asm["_unixNextSystemCall"]; asm["_unixNextSystemCall"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__unixNextSystemCall.apply(null, arguments);
};

var real__unixOpen = asm["_unixOpen"]; asm["_unixOpen"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__unixOpen.apply(null, arguments);
};

var real__unixRandomness = asm["_unixRandomness"]; asm["_unixRandomness"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__unixRandomness.apply(null, arguments);
};

var real__unixRead = asm["_unixRead"]; asm["_unixRead"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__unixRead.apply(null, arguments);
};

var real__unixSectorSize = asm["_unixSectorSize"]; asm["_unixSectorSize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__unixSectorSize.apply(null, arguments);
};

var real__unixSetSystemCall = asm["_unixSetSystemCall"]; asm["_unixSetSystemCall"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__unixSetSystemCall.apply(null, arguments);
};

var real__unixShmBarrier = asm["_unixShmBarrier"]; asm["_unixShmBarrier"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__unixShmBarrier.apply(null, arguments);
};

var real__unixShmLock = asm["_unixShmLock"]; asm["_unixShmLock"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__unixShmLock.apply(null, arguments);
};

var real__unixShmMap = asm["_unixShmMap"]; asm["_unixShmMap"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__unixShmMap.apply(null, arguments);
};

var real__unixShmUnmap = asm["_unixShmUnmap"]; asm["_unixShmUnmap"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__unixShmUnmap.apply(null, arguments);
};

var real__unixSleep = asm["_unixSleep"]; asm["_unixSleep"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__unixSleep.apply(null, arguments);
};

var real__unixSync = asm["_unixSync"]; asm["_unixSync"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__unixSync.apply(null, arguments);
};

var real__unixTruncate = asm["_unixTruncate"]; asm["_unixTruncate"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__unixTruncate.apply(null, arguments);
};

var real__unixUnfetch = asm["_unixUnfetch"]; asm["_unixUnfetch"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__unixUnfetch.apply(null, arguments);
};

var real__unixUnlock = asm["_unixUnlock"]; asm["_unixUnlock"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__unixUnlock.apply(null, arguments);
};

var real__unixWrite = asm["_unixWrite"]; asm["_unixWrite"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__unixWrite.apply(null, arguments);
};

var real__unlink = asm["_unlink"]; asm["_unlink"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__unlink.apply(null, arguments);
};

var real__upperFunc = asm["_upperFunc"]; asm["_upperFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__upperFunc.apply(null, arguments);
};

var real__vdbeRecordCompareInt = asm["_vdbeRecordCompareInt"]; asm["_vdbeRecordCompareInt"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__vdbeRecordCompareInt.apply(null, arguments);
};

var real__vdbeRecordCompareString = asm["_vdbeRecordCompareString"]; asm["_vdbeRecordCompareString"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__vdbeRecordCompareString.apply(null, arguments);
};

var real__vdbeSorterCompare = asm["_vdbeSorterCompare"]; asm["_vdbeSorterCompare"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__vdbeSorterCompare.apply(null, arguments);
};

var real__vdbeSorterCompareInt = asm["_vdbeSorterCompareInt"]; asm["_vdbeSorterCompareInt"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__vdbeSorterCompareInt.apply(null, arguments);
};

var real__vdbeSorterCompareText = asm["_vdbeSorterCompareText"]; asm["_vdbeSorterCompareText"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__vdbeSorterCompareText.apply(null, arguments);
};

var real__versionFunc = asm["_versionFunc"]; asm["_versionFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__versionFunc.apply(null, arguments);
};

var real__whereIndexExprTransNode = asm["_whereIndexExprTransNode"]; asm["_whereIndexExprTransNode"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__whereIndexExprTransNode.apply(null, arguments);
};

var real__write = asm["_write"]; asm["_write"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__write.apply(null, arguments);
};

var real__zeroblobFunc = asm["_zeroblobFunc"]; asm["_zeroblobFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__zeroblobFunc.apply(null, arguments);
};

var real_establishStackSpace = asm["establishStackSpace"]; asm["establishStackSpace"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_establishStackSpace.apply(null, arguments);
};

var real_getTempRet0 = asm["getTempRet0"]; asm["getTempRet0"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_getTempRet0.apply(null, arguments);
};

var real_setTempRet0 = asm["setTempRet0"]; asm["setTempRet0"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_setTempRet0.apply(null, arguments);
};

var real_setThrew = asm["setThrew"]; asm["setThrew"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_setThrew.apply(null, arguments);
};

var real_stackAlloc = asm["stackAlloc"]; asm["stackAlloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackAlloc.apply(null, arguments);
};

var real_stackRestore = asm["stackRestore"]; asm["stackRestore"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackRestore.apply(null, arguments);
};

var real_stackSave = asm["stackSave"]; asm["stackSave"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackSave.apply(null, arguments);
};
Module["asm"] = asm;
var _ExecuteQuery = Module["_ExecuteQuery"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_ExecuteQuery"].apply(null, arguments) };
var _Initialize = Module["_Initialize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_Initialize"].apply(null, arguments) };
var __GLOBAL__sub_I_status_cc = Module["__GLOBAL__sub_I_status_cc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__GLOBAL__sub_I_status_cc"].apply(null, arguments) };
var __ZN10__cxxabiv116__shim_type_infoD2Ev = Module["__ZN10__cxxabiv116__shim_type_infoD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10__cxxabiv116__shim_type_infoD2Ev"].apply(null, arguments) };
var __ZN10__cxxabiv117__class_type_infoD0Ev = Module["__ZN10__cxxabiv117__class_type_infoD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10__cxxabiv117__class_type_infoD0Ev"].apply(null, arguments) };
var __ZN10__cxxabiv120__si_class_type_infoD0Ev = Module["__ZN10__cxxabiv120__si_class_type_infoD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10__cxxabiv120__si_class_type_infoD0Ev"].apply(null, arguments) };
var __ZN10__cxxabiv121__vmi_class_type_infoD0Ev = Module["__ZN10__cxxabiv121__vmi_class_type_infoD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10__cxxabiv121__vmi_class_type_infoD0Ev"].apply(null, arguments) };
var __ZN6google8protobuf11MessageLiteD0Ev = Module["__ZN6google8protobuf11MessageLiteD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf11MessageLiteD0Ev"].apply(null, arguments) };
var __ZN6google8protobuf11MessageLiteD2Ev = Module["__ZN6google8protobuf11MessageLiteD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf11MessageLiteD2Ev"].apply(null, arguments) };
var __ZN6google8protobuf14ResultCallbackIPNSt3__212basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEED0Ev = Module["__ZN6google8protobuf14ResultCallbackIPNSt3__212basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEED0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf14ResultCallbackIPNSt3__212basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEED0Ev"].apply(null, arguments) };
var __ZN6google8protobuf14ResultCallbackIPNSt3__212basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEED2Ev = Module["__ZN6google8protobuf14ResultCallbackIPNSt3__212basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEED2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf14ResultCallbackIPNSt3__212basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEED2Ev"].apply(null, arguments) };
var __ZN6google8protobuf2io17ArrayOutputStream4NextEPPvPi = Module["__ZN6google8protobuf2io17ArrayOutputStream4NextEPPvPi"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf2io17ArrayOutputStream4NextEPPvPi"].apply(null, arguments) };
var __ZN6google8protobuf2io17ArrayOutputStream6BackUpEi = Module["__ZN6google8protobuf2io17ArrayOutputStream6BackUpEi"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf2io17ArrayOutputStream6BackUpEi"].apply(null, arguments) };
var __ZN6google8protobuf2io17ArrayOutputStreamD0Ev = Module["__ZN6google8protobuf2io17ArrayOutputStreamD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf2io17ArrayOutputStreamD0Ev"].apply(null, arguments) };
var __ZN6google8protobuf2io17ArrayOutputStreamD2Ev = Module["__ZN6google8protobuf2io17ArrayOutputStreamD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf2io17ArrayOutputStreamD2Ev"].apply(null, arguments) };
var __ZN6google8protobuf2io18StringOutputStream4NextEPPvPi = Module["__ZN6google8protobuf2io18StringOutputStream4NextEPPvPi"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf2io18StringOutputStream4NextEPPvPi"].apply(null, arguments) };
var __ZN6google8protobuf2io18StringOutputStream6BackUpEi = Module["__ZN6google8protobuf2io18StringOutputStream6BackUpEi"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf2io18StringOutputStream6BackUpEi"].apply(null, arguments) };
var __ZN6google8protobuf2io18StringOutputStreamD0Ev = Module["__ZN6google8protobuf2io18StringOutputStreamD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf2io18StringOutputStreamD0Ev"].apply(null, arguments) };
var __ZN6google8protobuf2io18StringOutputStreamD2Ev = Module["__ZN6google8protobuf2io18StringOutputStreamD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf2io18StringOutputStreamD2Ev"].apply(null, arguments) };
var __ZN6google8protobuf2io20ZeroCopyOutputStream15WriteAliasedRawEPKvi = Module["__ZN6google8protobuf2io20ZeroCopyOutputStream15WriteAliasedRawEPKvi"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf2io20ZeroCopyOutputStream15WriteAliasedRawEPKvi"].apply(null, arguments) };
var __ZN6google8protobuf2io20ZeroCopyOutputStreamD0Ev = Module["__ZN6google8protobuf2io20ZeroCopyOutputStreamD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf2io20ZeroCopyOutputStreamD0Ev"].apply(null, arguments) };
var __ZN6google8protobuf2io20ZeroCopyOutputStreamD2Ev = Module["__ZN6google8protobuf2io20ZeroCopyOutputStreamD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf2io20ZeroCopyOutputStreamD2Ev"].apply(null, arguments) };
var __ZN6google8protobuf2io22LazyStringOutputStream4NextEPPvPi = Module["__ZN6google8protobuf2io22LazyStringOutputStream4NextEPPvPi"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf2io22LazyStringOutputStream4NextEPPvPi"].apply(null, arguments) };
var __ZN6google8protobuf2io22LazyStringOutputStreamD0Ev = Module["__ZN6google8protobuf2io22LazyStringOutputStreamD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf2io22LazyStringOutputStreamD0Ev"].apply(null, arguments) };
var __ZN6google8protobuf2io22LazyStringOutputStreamD2Ev = Module["__ZN6google8protobuf2io22LazyStringOutputStreamD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf2io22LazyStringOutputStreamD2Ev"].apply(null, arguments) };
var __ZN6google8protobuf7ClosureD0Ev = Module["__ZN6google8protobuf7ClosureD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf7ClosureD0Ev"].apply(null, arguments) };
var __ZN6google8protobuf7ClosureD2Ev = Module["__ZN6google8protobuf7ClosureD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf7ClosureD2Ev"].apply(null, arguments) };
var __ZN6google8protobuf8internal15InitEmptyStringEv = Module["__ZN6google8protobuf8internal15InitEmptyStringEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf8internal15InitEmptyStringEv"].apply(null, arguments) };
var __ZN6google8protobuf8internal16FunctionClosure03RunEv = Module["__ZN6google8protobuf8internal16FunctionClosure03RunEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf8internal16FunctionClosure03RunEv"].apply(null, arguments) };
var __ZN6google8protobuf8internal16FunctionClosure0D0Ev = Module["__ZN6google8protobuf8internal16FunctionClosure0D0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf8internal16FunctionClosure0D0Ev"].apply(null, arguments) };
var __ZN6google8protobuf8internal16FunctionClosure0D2Ev = Module["__ZN6google8protobuf8internal16FunctionClosure0D2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf8internal16FunctionClosure0D2Ev"].apply(null, arguments) };
var __ZN6google8protobuf8internal17DeleteEmptyStringEv = Module["__ZN6google8protobuf8internal17DeleteEmptyStringEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf8internal17DeleteEmptyStringEv"].apply(null, arguments) };
var __ZN6google8protobuf8internal19arena_delete_objectIN8perfetto6protos12RawQueryArgsEEEvPv = Module["__ZN6google8protobuf8internal19arena_delete_objectIN8perfetto6protos12RawQueryArgsEEEvPv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf8internal19arena_delete_objectIN8perfetto6protos12RawQueryArgsEEEvPv"].apply(null, arguments) };
var __ZN6google8protobuf8internal19arena_delete_objectIN8perfetto6protos14RawQueryResultEEEvPv = Module["__ZN6google8protobuf8internal19arena_delete_objectIN8perfetto6protos14RawQueryResultEEEvPv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf8internal19arena_delete_objectIN8perfetto6protos14RawQueryResultEEEvPv"].apply(null, arguments) };
var __ZN6google8protobuf8internal19arena_delete_objectIN8perfetto6protos25RawQueryResult_ColumnDescEEEvPv = Module["__ZN6google8protobuf8internal19arena_delete_objectIN8perfetto6protos25RawQueryResult_ColumnDescEEEvPv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf8internal19arena_delete_objectIN8perfetto6protos25RawQueryResult_ColumnDescEEEvPv"].apply(null, arguments) };
var __ZN6google8protobuf8internal19arena_delete_objectIN8perfetto6protos27RawQueryResult_ColumnValuesEEEvPv = Module["__ZN6google8protobuf8internal19arena_delete_objectIN8perfetto6protos27RawQueryResult_ColumnValuesEEEvPv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf8internal19arena_delete_objectIN8perfetto6protos27RawQueryResult_ColumnValuesEEEvPv"].apply(null, arguments) };
var __ZN6google8protobuf8internal19arena_delete_objectINS0_11MessageLiteEEEvPv = Module["__ZN6google8protobuf8internal19arena_delete_objectINS0_11MessageLiteEEEvPv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf8internal19arena_delete_objectINS0_11MessageLiteEEEvPv"].apply(null, arguments) };
var __ZN6google8protobuf8internal20InitLogSilencerCountEv = Module["__ZN6google8protobuf8internal20InitLogSilencerCountEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf8internal20InitLogSilencerCountEv"].apply(null, arguments) };
var __ZN6google8protobuf8internal20RepeatedPtrFieldBase18MergeFromInnerLoopINS0_16RepeatedPtrFieldIN8perfetto6protos25RawQueryResult_ColumnDescEE11TypeHandlerEEEvPPvSB_ii = Module["__ZN6google8protobuf8internal20RepeatedPtrFieldBase18MergeFromInnerLoopINS0_16RepeatedPtrFieldIN8perfetto6protos25RawQueryResult_ColumnDescEE11TypeHandlerEEEvPPvSB_ii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf8internal20RepeatedPtrFieldBase18MergeFromInnerLoopINS0_16RepeatedPtrFieldIN8perfetto6protos25RawQueryResult_ColumnDescEE11TypeHandlerEEEvPPvSB_ii"].apply(null, arguments) };
var __ZN6google8protobuf8internal20RepeatedPtrFieldBase18MergeFromInnerLoopINS0_16RepeatedPtrFieldIN8perfetto6protos27RawQueryResult_ColumnValuesEE11TypeHandlerEEEvPPvSB_ii = Module["__ZN6google8protobuf8internal20RepeatedPtrFieldBase18MergeFromInnerLoopINS0_16RepeatedPtrFieldIN8perfetto6protos27RawQueryResult_ColumnValuesEE11TypeHandlerEEEvPPvSB_ii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf8internal20RepeatedPtrFieldBase18MergeFromInnerLoopINS0_16RepeatedPtrFieldIN8perfetto6protos27RawQueryResult_ColumnValuesEE11TypeHandlerEEEvPPvSB_ii"].apply(null, arguments) };
var __ZN6google8protobuf8internal21InitShutdownFunctionsEv = Module["__ZN6google8protobuf8internal21InitShutdownFunctionsEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf8internal21InitShutdownFunctionsEv"].apply(null, arguments) };
var __ZN6google8protobuf8internal21arena_destruct_objectIN8perfetto6protos25RawQueryResult_ColumnDescEEEvPv = Module["__ZN6google8protobuf8internal21arena_destruct_objectIN8perfetto6protos25RawQueryResult_ColumnDescEEEvPv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf8internal21arena_destruct_objectIN8perfetto6protos25RawQueryResult_ColumnDescEEEvPv"].apply(null, arguments) };
var __ZN6google8protobuf8internal21arena_destruct_objectIN8perfetto6protos27RawQueryResult_ColumnValuesEEEvPv = Module["__ZN6google8protobuf8internal21arena_destruct_objectIN8perfetto6protos27RawQueryResult_ColumnValuesEEEvPv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf8internal21arena_destruct_objectIN8perfetto6protos27RawQueryResult_ColumnValuesEEEvPv"].apply(null, arguments) };
var __ZN6google8protobuf8internal22DeleteLogSilencerCountEv = Module["__ZN6google8protobuf8internal22DeleteLogSilencerCountEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf8internal22DeleteLogSilencerCountEv"].apply(null, arguments) };
var __ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos12RawQueryArgsEE3RunEv = Module["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos12RawQueryArgsEE3RunEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos12RawQueryArgsEE3RunEv"].apply(null, arguments) };
var __ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos12RawQueryArgsEED0Ev = Module["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos12RawQueryArgsEED0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos12RawQueryArgsEED0Ev"].apply(null, arguments) };
var __ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos12RawQueryArgsEED2Ev = Module["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos12RawQueryArgsEED2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos12RawQueryArgsEED2Ev"].apply(null, arguments) };
var __ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos14RawQueryResultEE3RunEv = Module["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos14RawQueryResultEE3RunEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos14RawQueryResultEE3RunEv"].apply(null, arguments) };
var __ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos14RawQueryResultEED0Ev = Module["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos14RawQueryResultEED0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos14RawQueryResultEED0Ev"].apply(null, arguments) };
var __ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos14RawQueryResultEED2Ev = Module["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos14RawQueryResultEED2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos14RawQueryResultEED2Ev"].apply(null, arguments) };
var __ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos25RawQueryResult_ColumnDescEE3RunEv = Module["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos25RawQueryResult_ColumnDescEE3RunEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos25RawQueryResult_ColumnDescEE3RunEv"].apply(null, arguments) };
var __ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos25RawQueryResult_ColumnDescEED0Ev = Module["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos25RawQueryResult_ColumnDescEED0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos25RawQueryResult_ColumnDescEED0Ev"].apply(null, arguments) };
var __ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos25RawQueryResult_ColumnDescEED2Ev = Module["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos25RawQueryResult_ColumnDescEED2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos25RawQueryResult_ColumnDescEED2Ev"].apply(null, arguments) };
var __ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos27RawQueryResult_ColumnValuesEE3RunEv = Module["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos27RawQueryResult_ColumnValuesEE3RunEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos27RawQueryResult_ColumnValuesEE3RunEv"].apply(null, arguments) };
var __ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos27RawQueryResult_ColumnValuesEED0Ev = Module["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos27RawQueryResult_ColumnValuesEED0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos27RawQueryResult_ColumnValuesEED0Ev"].apply(null, arguments) };
var __ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos27RawQueryResult_ColumnValuesEED2Ev = Module["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos27RawQueryResult_ColumnValuesEED2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN6google8protobuf8internal26FunctionResultCallback_1_0IPNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEPN8perfetto6protos27RawQueryResult_ColumnValuesEED2Ev"].apply(null, arguments) };
var __ZN8perfetto15trace_processor10BlobReaderD0Ev = Module["__ZN8perfetto15trace_processor10BlobReaderD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto15trace_processor10BlobReaderD0Ev"].apply(null, arguments) };
var __ZN8perfetto15trace_processor10BlobReaderD2Ev = Module["__ZN8perfetto15trace_processor10BlobReaderD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto15trace_processor10BlobReaderD2Ev"].apply(null, arguments) };
var __ZN8perfetto15trace_processor12TraceStorage15PushSchedSwitchEjyjjPKcjj = Module["__ZN8perfetto15trace_processor12TraceStorage15PushSchedSwitchEjyjjPKcjj"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto15trace_processor12TraceStorage15PushSchedSwitchEjyjjPKcjj"].apply(null, arguments) };
var __ZN8perfetto15trace_processor12TraceStorageD0Ev = Module["__ZN8perfetto15trace_processor12TraceStorageD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto15trace_processor12TraceStorageD0Ev"].apply(null, arguments) };
var __ZN8perfetto15trace_processor12TraceStorageD2Ev = Module["__ZN8perfetto15trace_processor12TraceStorageD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto15trace_processor12TraceStorageD2Ev"].apply(null, arguments) };
var __ZN8perfetto15trace_processor12_GLOBAL__N_113DoRunNextTaskEPv = Module["__ZN8perfetto15trace_processor12_GLOBAL__N_113DoRunNextTaskEPv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto15trace_processor12_GLOBAL__N_113DoRunNextTaskEPv"].apply(null, arguments) };
var __ZN8perfetto15trace_processor12_GLOBAL__N_114BlobReaderImpl4ReadEyjPh = Module["__ZN8perfetto15trace_processor12_GLOBAL__N_114BlobReaderImpl4ReadEyjPh"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto15trace_processor12_GLOBAL__N_114BlobReaderImpl4ReadEyjPh"].apply(null, arguments) };
var __ZN8perfetto15trace_processor12_GLOBAL__N_114BlobReaderImplD0Ev = Module["__ZN8perfetto15trace_processor12_GLOBAL__N_114BlobReaderImplD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto15trace_processor12_GLOBAL__N_114BlobReaderImplD0Ev"].apply(null, arguments) };
var __ZN8perfetto15trace_processor12_GLOBAL__N_114BlobReaderImplD2Ev = Module["__ZN8perfetto15trace_processor12_GLOBAL__N_114BlobReaderImplD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto15trace_processor12_GLOBAL__N_114BlobReaderImplD2Ev"].apply(null, arguments) };
var __ZN8perfetto15trace_processor12_GLOBAL__N_120DoRunNextDelayedTaskEPv = Module["__ZN8perfetto15trace_processor12_GLOBAL__N_120DoRunNextDelayedTaskEPv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto15trace_processor12_GLOBAL__N_120DoRunNextDelayedTaskEPv"].apply(null, arguments) };
var __ZN8perfetto15trace_processor20EmscriptenTaskRunner15PostDelayedTaskENSt3__28functionIFvvEEEj = Module["__ZN8perfetto15trace_processor20EmscriptenTaskRunner15PostDelayedTaskENSt3__28functionIFvvEEEj"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto15trace_processor20EmscriptenTaskRunner15PostDelayedTaskENSt3__28functionIFvvEEEj"].apply(null, arguments) };
var __ZN8perfetto15trace_processor20EmscriptenTaskRunner22AddFileDescriptorWatchEiNSt3__28functionIFvvEEE = Module["__ZN8perfetto15trace_processor20EmscriptenTaskRunner22AddFileDescriptorWatchEiNSt3__28functionIFvvEEE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto15trace_processor20EmscriptenTaskRunner22AddFileDescriptorWatchEiNSt3__28functionIFvvEEE"].apply(null, arguments) };
var __ZN8perfetto15trace_processor20EmscriptenTaskRunner25RemoveFileDescriptorWatchEi = Module["__ZN8perfetto15trace_processor20EmscriptenTaskRunner25RemoveFileDescriptorWatchEi"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto15trace_processor20EmscriptenTaskRunner25RemoveFileDescriptorWatchEi"].apply(null, arguments) };
var __ZN8perfetto15trace_processor20EmscriptenTaskRunner8PostTaskENSt3__28functionIFvvEEE = Module["__ZN8perfetto15trace_processor20EmscriptenTaskRunner8PostTaskENSt3__28functionIFvvEEE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto15trace_processor20EmscriptenTaskRunner8PostTaskENSt3__28functionIFvvEEE"].apply(null, arguments) };
var __ZN8perfetto15trace_processor20EmscriptenTaskRunnerD0Ev = Module["__ZN8perfetto15trace_processor20EmscriptenTaskRunnerD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto15trace_processor20EmscriptenTaskRunnerD0Ev"].apply(null, arguments) };
var __ZN8perfetto15trace_processor20EmscriptenTaskRunnerD2Ev = Module["__ZN8perfetto15trace_processor20EmscriptenTaskRunnerD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto15trace_processor20EmscriptenTaskRunnerD2Ev"].apply(null, arguments) };
var __ZN8perfetto4base10TaskRunnerD0Ev = Module["__ZN8perfetto4base10TaskRunnerD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto4base10TaskRunnerD0Ev"].apply(null, arguments) };
var __ZN8perfetto4base10TaskRunnerD2Ev = Module["__ZN8perfetto4base10TaskRunnerD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto4base10TaskRunnerD2Ev"].apply(null, arguments) };
var __ZN8perfetto6protos12RawQueryArgs21CheckTypeAndMergeFromERKN6google8protobuf11MessageLiteE = Module["__ZN8perfetto6protos12RawQueryArgs21CheckTypeAndMergeFromERKN6google8protobuf11MessageLiteE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto6protos12RawQueryArgs21CheckTypeAndMergeFromERKN6google8protobuf11MessageLiteE"].apply(null, arguments) };
var __ZN8perfetto6protos12RawQueryArgs27MergePartialFromCodedStreamEPN6google8protobuf2io16CodedInputStreamE = Module["__ZN8perfetto6protos12RawQueryArgs27MergePartialFromCodedStreamEPN6google8protobuf2io16CodedInputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto6protos12RawQueryArgs27MergePartialFromCodedStreamEPN6google8protobuf2io16CodedInputStreamE"].apply(null, arguments) };
var __ZN8perfetto6protos12RawQueryArgs5ClearEv = Module["__ZN8perfetto6protos12RawQueryArgs5ClearEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto6protos12RawQueryArgs5ClearEv"].apply(null, arguments) };
var __ZN8perfetto6protos12RawQueryArgsD0Ev = Module["__ZN8perfetto6protos12RawQueryArgsD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto6protos12RawQueryArgsD0Ev"].apply(null, arguments) };
var __ZN8perfetto6protos12RawQueryArgsD2Ev = Module["__ZN8perfetto6protos12RawQueryArgsD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto6protos12RawQueryArgsD2Ev"].apply(null, arguments) };
var __ZN8perfetto6protos14RawQueryResult21CheckTypeAndMergeFromERKN6google8protobuf11MessageLiteE = Module["__ZN8perfetto6protos14RawQueryResult21CheckTypeAndMergeFromERKN6google8protobuf11MessageLiteE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto6protos14RawQueryResult21CheckTypeAndMergeFromERKN6google8protobuf11MessageLiteE"].apply(null, arguments) };
var __ZN8perfetto6protos14RawQueryResult27MergePartialFromCodedStreamEPN6google8protobuf2io16CodedInputStreamE = Module["__ZN8perfetto6protos14RawQueryResult27MergePartialFromCodedStreamEPN6google8protobuf2io16CodedInputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto6protos14RawQueryResult27MergePartialFromCodedStreamEPN6google8protobuf2io16CodedInputStreamE"].apply(null, arguments) };
var __ZN8perfetto6protos14RawQueryResult5ClearEv = Module["__ZN8perfetto6protos14RawQueryResult5ClearEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto6protos14RawQueryResult5ClearEv"].apply(null, arguments) };
var __ZN8perfetto6protos14RawQueryResultD0Ev = Module["__ZN8perfetto6protos14RawQueryResultD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto6protos14RawQueryResultD0Ev"].apply(null, arguments) };
var __ZN8perfetto6protos14RawQueryResultD2Ev = Module["__ZN8perfetto6protos14RawQueryResultD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto6protos14RawQueryResultD2Ev"].apply(null, arguments) };
var __ZN8perfetto6protos25RawQueryResult_ColumnDesc21CheckTypeAndMergeFromERKN6google8protobuf11MessageLiteE = Module["__ZN8perfetto6protos25RawQueryResult_ColumnDesc21CheckTypeAndMergeFromERKN6google8protobuf11MessageLiteE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto6protos25RawQueryResult_ColumnDesc21CheckTypeAndMergeFromERKN6google8protobuf11MessageLiteE"].apply(null, arguments) };
var __ZN8perfetto6protos25RawQueryResult_ColumnDesc27MergePartialFromCodedStreamEPN6google8protobuf2io16CodedInputStreamE = Module["__ZN8perfetto6protos25RawQueryResult_ColumnDesc27MergePartialFromCodedStreamEPN6google8protobuf2io16CodedInputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto6protos25RawQueryResult_ColumnDesc27MergePartialFromCodedStreamEPN6google8protobuf2io16CodedInputStreamE"].apply(null, arguments) };
var __ZN8perfetto6protos25RawQueryResult_ColumnDesc5ClearEv = Module["__ZN8perfetto6protos25RawQueryResult_ColumnDesc5ClearEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto6protos25RawQueryResult_ColumnDesc5ClearEv"].apply(null, arguments) };
var __ZN8perfetto6protos25RawQueryResult_ColumnDescD0Ev = Module["__ZN8perfetto6protos25RawQueryResult_ColumnDescD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto6protos25RawQueryResult_ColumnDescD0Ev"].apply(null, arguments) };
var __ZN8perfetto6protos25RawQueryResult_ColumnDescD2Ev = Module["__ZN8perfetto6protos25RawQueryResult_ColumnDescD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto6protos25RawQueryResult_ColumnDescD2Ev"].apply(null, arguments) };
var __ZN8perfetto6protos27RawQueryResult_ColumnValues21CheckTypeAndMergeFromERKN6google8protobuf11MessageLiteE = Module["__ZN8perfetto6protos27RawQueryResult_ColumnValues21CheckTypeAndMergeFromERKN6google8protobuf11MessageLiteE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto6protos27RawQueryResult_ColumnValues21CheckTypeAndMergeFromERKN6google8protobuf11MessageLiteE"].apply(null, arguments) };
var __ZN8perfetto6protos27RawQueryResult_ColumnValues27MergePartialFromCodedStreamEPN6google8protobuf2io16CodedInputStreamE = Module["__ZN8perfetto6protos27RawQueryResult_ColumnValues27MergePartialFromCodedStreamEPN6google8protobuf2io16CodedInputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto6protos27RawQueryResult_ColumnValues27MergePartialFromCodedStreamEPN6google8protobuf2io16CodedInputStreamE"].apply(null, arguments) };
var __ZN8perfetto6protos27RawQueryResult_ColumnValues5ClearEv = Module["__ZN8perfetto6protos27RawQueryResult_ColumnValues5ClearEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto6protos27RawQueryResult_ColumnValues5ClearEv"].apply(null, arguments) };
var __ZN8perfetto6protos27RawQueryResult_ColumnValuesD0Ev = Module["__ZN8perfetto6protos27RawQueryResult_ColumnValuesD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto6protos27RawQueryResult_ColumnValuesD0Ev"].apply(null, arguments) };
var __ZN8perfetto6protos27RawQueryResult_ColumnValuesD2Ev = Module["__ZN8perfetto6protos27RawQueryResult_ColumnValuesD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto6protos27RawQueryResult_ColumnValuesD2Ev"].apply(null, arguments) };
var __ZN8perfetto6protos72protobuf_AddDesc_perfetto_2ftrace_5fprocessor_2fraw_5fquery_2eproto_implEv = Module["__ZN8perfetto6protos72protobuf_AddDesc_perfetto_2ftrace_5fprocessor_2fraw_5fquery_2eproto_implEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto6protos72protobuf_AddDesc_perfetto_2ftrace_5fprocessor_2fraw_5fquery_2eproto_implEv"].apply(null, arguments) };
var __ZN8perfetto6protos72protobuf_ShutdownFile_perfetto_2ftrace_5fprocessor_2fraw_5fquery_2eprotoEv = Module["__ZN8perfetto6protos72protobuf_ShutdownFile_perfetto_2ftrace_5fprocessor_2fraw_5fquery_2eprotoEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto6protos72protobuf_ShutdownFile_perfetto_2ftrace_5fprocessor_2fraw_5fquery_2eprotoEv"].apply(null, arguments) };
var __ZN8perfetto6protosL35MutableUnknownFieldsForRawQueryArgsEPNS0_12RawQueryArgsE = Module["__ZN8perfetto6protosL35MutableUnknownFieldsForRawQueryArgsEPNS0_12RawQueryArgsE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto6protosL35MutableUnknownFieldsForRawQueryArgsEPNS0_12RawQueryArgsE"].apply(null, arguments) };
var __ZN8perfetto6protosL37MutableUnknownFieldsForRawQueryResultEPNS0_14RawQueryResultE = Module["__ZN8perfetto6protosL37MutableUnknownFieldsForRawQueryResultEPNS0_14RawQueryResultE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto6protosL37MutableUnknownFieldsForRawQueryResultEPNS0_14RawQueryResultE"].apply(null, arguments) };
var __ZN8perfetto6protosL48MutableUnknownFieldsForRawQueryResult_ColumnDescEPNS0_25RawQueryResult_ColumnDescE = Module["__ZN8perfetto6protosL48MutableUnknownFieldsForRawQueryResult_ColumnDescEPNS0_25RawQueryResult_ColumnDescE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto6protosL48MutableUnknownFieldsForRawQueryResult_ColumnDescEPNS0_25RawQueryResult_ColumnDescE"].apply(null, arguments) };
var __ZN8perfetto6protosL50MutableUnknownFieldsForRawQueryResult_ColumnValuesEPNS0_27RawQueryResult_ColumnValuesE = Module["__ZN8perfetto6protosL50MutableUnknownFieldsForRawQueryResult_ColumnValuesEPNS0_27RawQueryResult_ColumnValuesE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN8perfetto6protosL50MutableUnknownFieldsForRawQueryResult_ColumnValuesEPNS0_27RawQueryResult_ColumnValuesE"].apply(null, arguments) };
var __ZNK10__cxxabiv116__shim_type_info5noop1Ev = Module["__ZNK10__cxxabiv116__shim_type_info5noop1Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK10__cxxabiv116__shim_type_info5noop1Ev"].apply(null, arguments) };
var __ZNK10__cxxabiv116__shim_type_info5noop2Ev = Module["__ZNK10__cxxabiv116__shim_type_info5noop2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK10__cxxabiv116__shim_type_info5noop2Ev"].apply(null, arguments) };
var __ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib = Module["__ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib"].apply(null, arguments) };
var __ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib = Module["__ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib"].apply(null, arguments) };
var __ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi = Module["__ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi"].apply(null, arguments) };
var __ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv = Module["__ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv"].apply(null, arguments) };
var __ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib = Module["__ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib"].apply(null, arguments) };
var __ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib = Module["__ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib"].apply(null, arguments) };
var __ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi = Module["__ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi"].apply(null, arguments) };
var __ZNK10__cxxabiv121__vmi_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib = Module["__ZNK10__cxxabiv121__vmi_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK10__cxxabiv121__vmi_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib"].apply(null, arguments) };
var __ZNK10__cxxabiv121__vmi_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib = Module["__ZNK10__cxxabiv121__vmi_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK10__cxxabiv121__vmi_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib"].apply(null, arguments) };
var __ZNK10__cxxabiv121__vmi_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi = Module["__ZNK10__cxxabiv121__vmi_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK10__cxxabiv121__vmi_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi"].apply(null, arguments) };
var __ZNK6google8protobuf11MessageLite20GetMaybeArenaPointerEv = Module["__ZNK6google8protobuf11MessageLite20GetMaybeArenaPointerEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK6google8protobuf11MessageLite20GetMaybeArenaPointerEv"].apply(null, arguments) };
var __ZNK6google8protobuf11MessageLite25InitializationErrorStringEv = Module["__ZNK6google8protobuf11MessageLite25InitializationErrorStringEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK6google8protobuf11MessageLite25InitializationErrorStringEv"].apply(null, arguments) };
var __ZNK6google8protobuf11MessageLite31SerializeWithCachedSizesToArrayEPh = Module["__ZNK6google8protobuf11MessageLite31SerializeWithCachedSizesToArrayEPh"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK6google8protobuf11MessageLite31SerializeWithCachedSizesToArrayEPh"].apply(null, arguments) };
var __ZNK6google8protobuf11MessageLite3NewEPNS0_5ArenaE = Module["__ZNK6google8protobuf11MessageLite3NewEPNS0_5ArenaE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK6google8protobuf11MessageLite3NewEPNS0_5ArenaE"].apply(null, arguments) };
var __ZNK6google8protobuf11MessageLite8GetArenaEv = Module["__ZNK6google8protobuf11MessageLite8GetArenaEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK6google8protobuf11MessageLite8GetArenaEv"].apply(null, arguments) };
var __ZNK6google8protobuf2io17ArrayOutputStream9ByteCountEv = Module["__ZNK6google8protobuf2io17ArrayOutputStream9ByteCountEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK6google8protobuf2io17ArrayOutputStream9ByteCountEv"].apply(null, arguments) };
var __ZNK6google8protobuf2io18StringOutputStream9ByteCountEv = Module["__ZNK6google8protobuf2io18StringOutputStream9ByteCountEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK6google8protobuf2io18StringOutputStream9ByteCountEv"].apply(null, arguments) };
var __ZNK6google8protobuf2io20ZeroCopyOutputStream14AllowsAliasingEv = Module["__ZNK6google8protobuf2io20ZeroCopyOutputStream14AllowsAliasingEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK6google8protobuf2io20ZeroCopyOutputStream14AllowsAliasingEv"].apply(null, arguments) };
var __ZNK6google8protobuf2io22LazyStringOutputStream9ByteCountEv = Module["__ZNK6google8protobuf2io22LazyStringOutputStream9ByteCountEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK6google8protobuf2io22LazyStringOutputStream9ByteCountEv"].apply(null, arguments) };
var __ZNK8perfetto6protos12RawQueryArgs11GetTypeNameEv = Module["__ZNK8perfetto6protos12RawQueryArgs11GetTypeNameEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK8perfetto6protos12RawQueryArgs11GetTypeNameEv"].apply(null, arguments) };
var __ZNK8perfetto6protos12RawQueryArgs13GetCachedSizeEv = Module["__ZNK8perfetto6protos12RawQueryArgs13GetCachedSizeEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK8perfetto6protos12RawQueryArgs13GetCachedSizeEv"].apply(null, arguments) };
var __ZNK8perfetto6protos12RawQueryArgs13IsInitializedEv = Module["__ZNK8perfetto6protos12RawQueryArgs13IsInitializedEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK8perfetto6protos12RawQueryArgs13IsInitializedEv"].apply(null, arguments) };
var __ZNK8perfetto6protos12RawQueryArgs24SerializeWithCachedSizesEPN6google8protobuf2io17CodedOutputStreamE = Module["__ZNK8perfetto6protos12RawQueryArgs24SerializeWithCachedSizesEPN6google8protobuf2io17CodedOutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK8perfetto6protos12RawQueryArgs24SerializeWithCachedSizesEPN6google8protobuf2io17CodedOutputStreamE"].apply(null, arguments) };
var __ZNK8perfetto6protos12RawQueryArgs3NewEPN6google8protobuf5ArenaE = Module["__ZNK8perfetto6protos12RawQueryArgs3NewEPN6google8protobuf5ArenaE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK8perfetto6protos12RawQueryArgs3NewEPN6google8protobuf5ArenaE"].apply(null, arguments) };
var __ZNK8perfetto6protos12RawQueryArgs3NewEv = Module["__ZNK8perfetto6protos12RawQueryArgs3NewEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK8perfetto6protos12RawQueryArgs3NewEv"].apply(null, arguments) };
var __ZNK8perfetto6protos12RawQueryArgs8ByteSizeEv = Module["__ZNK8perfetto6protos12RawQueryArgs8ByteSizeEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK8perfetto6protos12RawQueryArgs8ByteSizeEv"].apply(null, arguments) };
var __ZNK8perfetto6protos14RawQueryResult11GetTypeNameEv = Module["__ZNK8perfetto6protos14RawQueryResult11GetTypeNameEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK8perfetto6protos14RawQueryResult11GetTypeNameEv"].apply(null, arguments) };
var __ZNK8perfetto6protos14RawQueryResult13GetCachedSizeEv = Module["__ZNK8perfetto6protos14RawQueryResult13GetCachedSizeEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK8perfetto6protos14RawQueryResult13GetCachedSizeEv"].apply(null, arguments) };
var __ZNK8perfetto6protos14RawQueryResult13IsInitializedEv = Module["__ZNK8perfetto6protos14RawQueryResult13IsInitializedEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK8perfetto6protos14RawQueryResult13IsInitializedEv"].apply(null, arguments) };
var __ZNK8perfetto6protos14RawQueryResult24SerializeWithCachedSizesEPN6google8protobuf2io17CodedOutputStreamE = Module["__ZNK8perfetto6protos14RawQueryResult24SerializeWithCachedSizesEPN6google8protobuf2io17CodedOutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK8perfetto6protos14RawQueryResult24SerializeWithCachedSizesEPN6google8protobuf2io17CodedOutputStreamE"].apply(null, arguments) };
var __ZNK8perfetto6protos14RawQueryResult3NewEPN6google8protobuf5ArenaE = Module["__ZNK8perfetto6protos14RawQueryResult3NewEPN6google8protobuf5ArenaE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK8perfetto6protos14RawQueryResult3NewEPN6google8protobuf5ArenaE"].apply(null, arguments) };
var __ZNK8perfetto6protos14RawQueryResult3NewEv = Module["__ZNK8perfetto6protos14RawQueryResult3NewEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK8perfetto6protos14RawQueryResult3NewEv"].apply(null, arguments) };
var __ZNK8perfetto6protos14RawQueryResult8ByteSizeEv = Module["__ZNK8perfetto6protos14RawQueryResult8ByteSizeEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK8perfetto6protos14RawQueryResult8ByteSizeEv"].apply(null, arguments) };
var __ZNK8perfetto6protos25RawQueryResult_ColumnDesc11GetTypeNameEv = Module["__ZNK8perfetto6protos25RawQueryResult_ColumnDesc11GetTypeNameEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK8perfetto6protos25RawQueryResult_ColumnDesc11GetTypeNameEv"].apply(null, arguments) };
var __ZNK8perfetto6protos25RawQueryResult_ColumnDesc13GetCachedSizeEv = Module["__ZNK8perfetto6protos25RawQueryResult_ColumnDesc13GetCachedSizeEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK8perfetto6protos25RawQueryResult_ColumnDesc13GetCachedSizeEv"].apply(null, arguments) };
var __ZNK8perfetto6protos25RawQueryResult_ColumnDesc13IsInitializedEv = Module["__ZNK8perfetto6protos25RawQueryResult_ColumnDesc13IsInitializedEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK8perfetto6protos25RawQueryResult_ColumnDesc13IsInitializedEv"].apply(null, arguments) };
var __ZNK8perfetto6protos25RawQueryResult_ColumnDesc24SerializeWithCachedSizesEPN6google8protobuf2io17CodedOutputStreamE = Module["__ZNK8perfetto6protos25RawQueryResult_ColumnDesc24SerializeWithCachedSizesEPN6google8protobuf2io17CodedOutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK8perfetto6protos25RawQueryResult_ColumnDesc24SerializeWithCachedSizesEPN6google8protobuf2io17CodedOutputStreamE"].apply(null, arguments) };
var __ZNK8perfetto6protos25RawQueryResult_ColumnDesc3NewEPN6google8protobuf5ArenaE = Module["__ZNK8perfetto6protos25RawQueryResult_ColumnDesc3NewEPN6google8protobuf5ArenaE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK8perfetto6protos25RawQueryResult_ColumnDesc3NewEPN6google8protobuf5ArenaE"].apply(null, arguments) };
var __ZNK8perfetto6protos25RawQueryResult_ColumnDesc3NewEv = Module["__ZNK8perfetto6protos25RawQueryResult_ColumnDesc3NewEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK8perfetto6protos25RawQueryResult_ColumnDesc3NewEv"].apply(null, arguments) };
var __ZNK8perfetto6protos25RawQueryResult_ColumnDesc8ByteSizeEv = Module["__ZNK8perfetto6protos25RawQueryResult_ColumnDesc8ByteSizeEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK8perfetto6protos25RawQueryResult_ColumnDesc8ByteSizeEv"].apply(null, arguments) };
var __ZNK8perfetto6protos27RawQueryResult_ColumnValues11GetTypeNameEv = Module["__ZNK8perfetto6protos27RawQueryResult_ColumnValues11GetTypeNameEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK8perfetto6protos27RawQueryResult_ColumnValues11GetTypeNameEv"].apply(null, arguments) };
var __ZNK8perfetto6protos27RawQueryResult_ColumnValues13GetCachedSizeEv = Module["__ZNK8perfetto6protos27RawQueryResult_ColumnValues13GetCachedSizeEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK8perfetto6protos27RawQueryResult_ColumnValues13GetCachedSizeEv"].apply(null, arguments) };
var __ZNK8perfetto6protos27RawQueryResult_ColumnValues13IsInitializedEv = Module["__ZNK8perfetto6protos27RawQueryResult_ColumnValues13IsInitializedEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK8perfetto6protos27RawQueryResult_ColumnValues13IsInitializedEv"].apply(null, arguments) };
var __ZNK8perfetto6protos27RawQueryResult_ColumnValues24SerializeWithCachedSizesEPN6google8protobuf2io17CodedOutputStreamE = Module["__ZNK8perfetto6protos27RawQueryResult_ColumnValues24SerializeWithCachedSizesEPN6google8protobuf2io17CodedOutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK8perfetto6protos27RawQueryResult_ColumnValues24SerializeWithCachedSizesEPN6google8protobuf2io17CodedOutputStreamE"].apply(null, arguments) };
var __ZNK8perfetto6protos27RawQueryResult_ColumnValues3NewEPN6google8protobuf5ArenaE = Module["__ZNK8perfetto6protos27RawQueryResult_ColumnValues3NewEPN6google8protobuf5ArenaE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK8perfetto6protos27RawQueryResult_ColumnValues3NewEPN6google8protobuf5ArenaE"].apply(null, arguments) };
var __ZNK8perfetto6protos27RawQueryResult_ColumnValues3NewEv = Module["__ZNK8perfetto6protos27RawQueryResult_ColumnValues3NewEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK8perfetto6protos27RawQueryResult_ColumnValues3NewEv"].apply(null, arguments) };
var __ZNK8perfetto6protos27RawQueryResult_ColumnValues8ByteSizeEv = Module["__ZNK8perfetto6protos27RawQueryResult_ColumnValues8ByteSizeEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK8perfetto6protos27RawQueryResult_ColumnValues8ByteSizeEv"].apply(null, arguments) };
var __ZNKSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEE7__cloneEPNS0_6__baseIS5_EE = Module["__ZNKSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEE7__cloneEPNS0_6__baseIS5_EE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNKSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEE7__cloneEPNS0_6__baseIS5_EE"].apply(null, arguments) };
var __ZNKSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEE7__cloneEv = Module["__ZNKSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEE7__cloneEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNKSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEE7__cloneEv"].apply(null, arguments) };
var __ZNKSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEE7__cloneEPNS0_6__baseIS8_EE = Module["__ZNKSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEE7__cloneEPNS0_6__baseIS8_EE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNKSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEE7__cloneEPNS0_6__baseIS8_EE"].apply(null, arguments) };
var __ZNKSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEE7__cloneEv = Module["__ZNKSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEE7__cloneEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNKSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEE7__cloneEv"].apply(null, arguments) };
var __ZNKSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_E7__cloneEPNS0_6__baseIS6_EE = Module["__ZNKSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_E7__cloneEPNS0_6__baseIS6_EE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNKSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_E7__cloneEPNS0_6__baseIS6_EE"].apply(null, arguments) };
var __ZNKSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_E7__cloneEv = Module["__ZNKSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_E7__cloneEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNKSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_E7__cloneEv"].apply(null, arguments) };
var __ZNKSt3__219__shared_weak_count13__get_deleterERKSt9type_info = Module["__ZNKSt3__219__shared_weak_count13__get_deleterERKSt9type_info"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNKSt3__219__shared_weak_count13__get_deleterERKSt9type_info"].apply(null, arguments) };
var __ZNSt3__210__function6__baseIFvN8perfetto6protos14RawQueryResultEEED0Ev = Module["__ZNSt3__210__function6__baseIFvN8perfetto6protos14RawQueryResultEEED0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt3__210__function6__baseIFvN8perfetto6protos14RawQueryResultEEED0Ev"].apply(null, arguments) };
var __ZNSt3__210__function6__baseIFvN8perfetto6protos14RawQueryResultEEED2Ev = Module["__ZNSt3__210__function6__baseIFvN8perfetto6protos14RawQueryResultEEED2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt3__210__function6__baseIFvN8perfetto6protos14RawQueryResultEEED2Ev"].apply(null, arguments) };
var __ZNSt3__210__function6__baseIFvvEED0Ev = Module["__ZNSt3__210__function6__baseIFvvEED0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt3__210__function6__baseIFvvEED0Ev"].apply(null, arguments) };
var __ZNSt3__210__function6__baseIFvvEED2Ev = Module["__ZNSt3__210__function6__baseIFvvEED2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt3__210__function6__baseIFvvEED2Ev"].apply(null, arguments) };
var __ZNSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEE18destroy_deallocateEv = Module["__ZNSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEE18destroy_deallocateEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEE18destroy_deallocateEv"].apply(null, arguments) };
var __ZNSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEE7destroyEv = Module["__ZNSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEE7destroyEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEE7destroyEv"].apply(null, arguments) };
var __ZNSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEED0Ev = Module["__ZNSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEED0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEED0Ev"].apply(null, arguments) };
var __ZNSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEED2Ev = Module["__ZNSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEED2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEED2Ev"].apply(null, arguments) };
var __ZNSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEEclEv = Module["__ZNSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEEclEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt3__210__function6__funcIZ10InitializeE3__0NS_9allocatorIS2_EEFvvEEclEv"].apply(null, arguments) };
var __ZNSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEE18destroy_deallocateEv = Module["__ZNSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEE18destroy_deallocateEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEE18destroy_deallocateEv"].apply(null, arguments) };
var __ZNSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEE7destroyEv = Module["__ZNSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEE7destroyEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEE7destroyEv"].apply(null, arguments) };
var __ZNSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEED0Ev = Module["__ZNSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEED0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEED0Ev"].apply(null, arguments) };
var __ZNSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEED2Ev = Module["__ZNSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEED2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEED2Ev"].apply(null, arguments) };
var __ZNSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEEclEOS7_ = Module["__ZNSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEEclEOS7_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt3__210__function6__funcIZ12ExecuteQueryE3__1NS_9allocatorIS2_EEFvN8perfetto6protos14RawQueryResultEEEclEOS7_"].apply(null, arguments) };
var __ZNSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_E18destroy_deallocateEv = Module["__ZNSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_E18destroy_deallocateEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_E18destroy_deallocateEv"].apply(null, arguments) };
var __ZNSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_E7destroyEv = Module["__ZNSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_E7destroyEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_E7destroyEv"].apply(null, arguments) };
var __ZNSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_ED0Ev = Module["__ZNSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_ED0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_ED0Ev"].apply(null, arguments) };
var __ZNSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_ED2Ev = Module["__ZNSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_ED2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_ED2Ev"].apply(null, arguments) };
var __ZNSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_EclEv = Module["__ZNSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_EclEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt3__210__function6__funcIZN8perfetto15trace_processor13TraceDatabase14LoadTraceChunkENS_8functionIFvvEEEE3__0NS_9allocatorIS8_EES6_EclEv"].apply(null, arguments) };
var __ZNSt3__214__shared_countD0Ev = Module["__ZNSt3__214__shared_countD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt3__214__shared_countD0Ev"].apply(null, arguments) };
var __ZNSt3__214__shared_countD2Ev = Module["__ZNSt3__214__shared_countD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt3__214__shared_countD2Ev"].apply(null, arguments) };
var __ZNSt3__219__shared_weak_countD0Ev = Module["__ZNSt3__219__shared_weak_countD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt3__219__shared_weak_countD0Ev"].apply(null, arguments) };
var __ZNSt3__220__shared_ptr_pointerIPPN8perfetto15trace_processor13TraceDatabaseENS_14default_deleteIS4_EENS_9allocatorIS4_EEE16__on_zero_sharedEv = Module["__ZNSt3__220__shared_ptr_pointerIPPN8perfetto15trace_processor13TraceDatabaseENS_14default_deleteIS4_EENS_9allocatorIS4_EEE16__on_zero_sharedEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt3__220__shared_ptr_pointerIPPN8perfetto15trace_processor13TraceDatabaseENS_14default_deleteIS4_EENS_9allocatorIS4_EEE16__on_zero_sharedEv"].apply(null, arguments) };
var __ZNSt3__220__shared_ptr_pointerIPPN8perfetto15trace_processor13TraceDatabaseENS_14default_deleteIS4_EENS_9allocatorIS4_EEE21__on_zero_shared_weakEv = Module["__ZNSt3__220__shared_ptr_pointerIPPN8perfetto15trace_processor13TraceDatabaseENS_14default_deleteIS4_EENS_9allocatorIS4_EEE21__on_zero_shared_weakEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt3__220__shared_ptr_pointerIPPN8perfetto15trace_processor13TraceDatabaseENS_14default_deleteIS4_EENS_9allocatorIS4_EEE21__on_zero_shared_weakEv"].apply(null, arguments) };
var __ZNSt3__220__shared_ptr_pointerIPPN8perfetto15trace_processor13TraceDatabaseENS_14default_deleteIS4_EENS_9allocatorIS4_EEED0Ev = Module["__ZNSt3__220__shared_ptr_pointerIPPN8perfetto15trace_processor13TraceDatabaseENS_14default_deleteIS4_EENS_9allocatorIS4_EEED0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt3__220__shared_ptr_pointerIPPN8perfetto15trace_processor13TraceDatabaseENS_14default_deleteIS4_EENS_9allocatorIS4_EEED0Ev"].apply(null, arguments) };
var __ZNSt3__220__shared_ptr_pointerIPPN8perfetto15trace_processor13TraceDatabaseENS_14default_deleteIS4_EENS_9allocatorIS4_EEED2Ev = Module["__ZNSt3__220__shared_ptr_pointerIPPN8perfetto15trace_processor13TraceDatabaseENS_14default_deleteIS4_EENS_9allocatorIS4_EEED2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt3__220__shared_ptr_pointerIPPN8perfetto15trace_processor13TraceDatabaseENS_14default_deleteIS4_EENS_9allocatorIS4_EEED2Ev"].apply(null, arguments) };
var __ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__08__invokeEP7sqlite3PviPKPKcPP12sqlite3_vtabPPc = Module["__ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__08__invokeEP7sqlite3PviPKPKcPP12sqlite3_vtabPPc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__08__invokeEP7sqlite3PviPKPKcPP12sqlite3_vtabPPc"].apply(null, arguments) };
var __ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__18__invokeEP12sqlite3_vtabP18sqlite3_index_info = Module["__ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__18__invokeEP12sqlite3_vtabP18sqlite3_index_info"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__18__invokeEP12sqlite3_vtabP18sqlite3_index_info"].apply(null, arguments) };
var __ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__28__invokeEP12sqlite3_vtab = Module["__ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__28__invokeEP12sqlite3_vtab"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__28__invokeEP12sqlite3_vtab"].apply(null, arguments) };
var __ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__38__invokeEP12sqlite3_vtabPP19sqlite3_vtab_cursor = Module["__ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__38__invokeEP12sqlite3_vtabPP19sqlite3_vtab_cursor"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__38__invokeEP12sqlite3_vtabPP19sqlite3_vtab_cursor"].apply(null, arguments) };
var __ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__48__invokeEP19sqlite3_vtab_cursor = Module["__ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__48__invokeEP19sqlite3_vtab_cursor"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__48__invokeEP19sqlite3_vtab_cursor"].apply(null, arguments) };
var __ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__58__invokeEP19sqlite3_vtab_cursoriPKciPP13sqlite3_value = Module["__ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__58__invokeEP19sqlite3_vtab_cursoriPKciPP13sqlite3_value"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__58__invokeEP19sqlite3_vtab_cursoriPKciPP13sqlite3_value"].apply(null, arguments) };
var __ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__68__invokeEP19sqlite3_vtab_cursor = Module["__ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__68__invokeEP19sqlite3_vtab_cursor"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__68__invokeEP19sqlite3_vtab_cursor"].apply(null, arguments) };
var __ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__78__invokeEP19sqlite3_vtab_cursor = Module["__ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__78__invokeEP19sqlite3_vtab_cursor"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__78__invokeEP19sqlite3_vtab_cursor"].apply(null, arguments) };
var __ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__88__invokeEP19sqlite3_vtab_cursorP15sqlite3_contexti = Module["__ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__88__invokeEP19sqlite3_vtab_cursorP15sqlite3_contexti"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZZN8perfetto15trace_processor15SchedSliceTable12CreateModuleEvEN3__88__invokeEP19sqlite3_vtab_cursorP15sqlite3_contexti"].apply(null, arguments) };
var ___mmap = Module["___mmap"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___mmap"].apply(null, arguments) };
var ___munmap = Module["___munmap"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___munmap"].apply(null, arguments) };
var ___stdio_close = Module["___stdio_close"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___stdio_close"].apply(null, arguments) };
var ___stdio_seek = Module["___stdio_seek"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___stdio_seek"].apply(null, arguments) };
var ___stdio_write = Module["___stdio_write"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___stdio_write"].apply(null, arguments) };
var ___stdout_write = Module["___stdout_write"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___stdout_write"].apply(null, arguments) };
var _absFunc = Module["_absFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_absFunc"].apply(null, arguments) };
var _access = Module["_access"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_access"].apply(null, arguments) };
var _analysisLoader = Module["_analysisLoader"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_analysisLoader"].apply(null, arguments) };
var _analyzeAggregate = Module["_analyzeAggregate"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_analyzeAggregate"].apply(null, arguments) };
var _analyzeAggregatesInSelect = Module["_analyzeAggregatesInSelect"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_analyzeAggregatesInSelect"].apply(null, arguments) };
var _analyzeAggregatesInSelectEnd = Module["_analyzeAggregatesInSelectEnd"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_analyzeAggregatesInSelectEnd"].apply(null, arguments) };
var _attachFunc = Module["_attachFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_attachFunc"].apply(null, arguments) };
var _avgFinalize = Module["_avgFinalize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_avgFinalize"].apply(null, arguments) };
var _binCollFunc = Module["_binCollFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_binCollFunc"].apply(null, arguments) };
var _btreeInvokeBusyHandler = Module["_btreeInvokeBusyHandler"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_btreeInvokeBusyHandler"].apply(null, arguments) };
var _btreeParseCellPtr = Module["_btreeParseCellPtr"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_btreeParseCellPtr"].apply(null, arguments) };
var _btreeParseCellPtrIndex = Module["_btreeParseCellPtrIndex"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_btreeParseCellPtrIndex"].apply(null, arguments) };
var _btreeParseCellPtrNoPayload = Module["_btreeParseCellPtrNoPayload"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_btreeParseCellPtrNoPayload"].apply(null, arguments) };
var _cdateFunc = Module["_cdateFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_cdateFunc"].apply(null, arguments) };
var _cellSizePtr = Module["_cellSizePtr"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_cellSizePtr"].apply(null, arguments) };
var _cellSizePtrNoPayload = Module["_cellSizePtrNoPayload"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_cellSizePtrNoPayload"].apply(null, arguments) };
var _changes = Module["_changes"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_changes"].apply(null, arguments) };
var _charFunc = Module["_charFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_charFunc"].apply(null, arguments) };
var _checkConstraintExprNode = Module["_checkConstraintExprNode"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_checkConstraintExprNode"].apply(null, arguments) };
var _close = Module["_close"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_close"].apply(null, arguments) };
var _compileoptiongetFunc = Module["_compileoptiongetFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_compileoptiongetFunc"].apply(null, arguments) };
var _compileoptionusedFunc = Module["_compileoptionusedFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_compileoptionusedFunc"].apply(null, arguments) };
var _convertCompoundSelectToSubquery = Module["_convertCompoundSelectToSubquery"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_convertCompoundSelectToSubquery"].apply(null, arguments) };
var _countFinalize = Module["_countFinalize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_countFinalize"].apply(null, arguments) };
var _countStep = Module["_countStep"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_countStep"].apply(null, arguments) };
var _ctimeFunc = Module["_ctimeFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_ctimeFunc"].apply(null, arguments) };
var _ctimestampFunc = Module["_ctimestampFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_ctimestampFunc"].apply(null, arguments) };
var _dateFunc = Module["_dateFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_dateFunc"].apply(null, arguments) };
var _datetimeFunc = Module["_datetimeFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_datetimeFunc"].apply(null, arguments) };
var _detachFunc = Module["_detachFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_detachFunc"].apply(null, arguments) };
var _dotlockCheckReservedLock = Module["_dotlockCheckReservedLock"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_dotlockCheckReservedLock"].apply(null, arguments) };
var _dotlockClose = Module["_dotlockClose"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_dotlockClose"].apply(null, arguments) };
var _dotlockIoFinderImpl = Module["_dotlockIoFinderImpl"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_dotlockIoFinderImpl"].apply(null, arguments) };
var _dotlockLock = Module["_dotlockLock"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_dotlockLock"].apply(null, arguments) };
var _dotlockUnlock = Module["_dotlockUnlock"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_dotlockUnlock"].apply(null, arguments) };
var _errlogFunc = Module["_errlogFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_errlogFunc"].apply(null, arguments) };
var _exprIdxCover = Module["_exprIdxCover"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_exprIdxCover"].apply(null, arguments) };
var _exprNodeIsConstant = Module["_exprNodeIsConstant"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_exprNodeIsConstant"].apply(null, arguments) };
var _exprNodeIsConstantOrGroupBy = Module["_exprNodeIsConstantOrGroupBy"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_exprNodeIsConstantOrGroupBy"].apply(null, arguments) };
var _exprNodeIsDeterministic = Module["_exprNodeIsDeterministic"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_exprNodeIsDeterministic"].apply(null, arguments) };
var _exprSrcCount = Module["_exprSrcCount"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_exprSrcCount"].apply(null, arguments) };
var _fchmod = Module["_fchmod"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_fchmod"].apply(null, arguments) };
var _fchown = Module["_fchown"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_fchown"].apply(null, arguments) };
var _fcntl = Module["_fcntl"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_fcntl"].apply(null, arguments) };
var _free = Module["_free"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_free"].apply(null, arguments) };
var _fstat = Module["_fstat"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_fstat"].apply(null, arguments) };
var _ftruncate = Module["_ftruncate"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_ftruncate"].apply(null, arguments) };
var _getPageError = Module["_getPageError"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_getPageError"].apply(null, arguments) };
var _getPageNormal = Module["_getPageNormal"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_getPageNormal"].apply(null, arguments) };
var _getcwd = Module["_getcwd"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_getcwd"].apply(null, arguments) };
var _geteuid = Module["_geteuid"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_geteuid"].apply(null, arguments) };
var _groupConcatFinalize = Module["_groupConcatFinalize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_groupConcatFinalize"].apply(null, arguments) };
var _groupConcatStep = Module["_groupConcatStep"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_groupConcatStep"].apply(null, arguments) };
var _havingToWhereExprCb = Module["_havingToWhereExprCb"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_havingToWhereExprCb"].apply(null, arguments) };
var _hexFunc = Module["_hexFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_hexFunc"].apply(null, arguments) };
var _impliesNotNullRow = Module["_impliesNotNullRow"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_impliesNotNullRow"].apply(null, arguments) };
var _incrAggDepth = Module["_incrAggDepth"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_incrAggDepth"].apply(null, arguments) };
var _instrFunc = Module["_instrFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_instrFunc"].apply(null, arguments) };
var _juliandayFunc = Module["_juliandayFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_juliandayFunc"].apply(null, arguments) };
var _last_insert_rowid = Module["_last_insert_rowid"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_last_insert_rowid"].apply(null, arguments) };
var _lengthFunc = Module["_lengthFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_lengthFunc"].apply(null, arguments) };
var _likeFunc = Module["_likeFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_likeFunc"].apply(null, arguments) };
var _llvm_bswap_i32 = Module["_llvm_bswap_i32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_llvm_bswap_i32"].apply(null, arguments) };
var _loadExt = Module["_loadExt"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_loadExt"].apply(null, arguments) };
var _lowerFunc = Module["_lowerFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_lowerFunc"].apply(null, arguments) };
var _lstat = Module["_lstat"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_lstat"].apply(null, arguments) };
var _malloc = Module["_malloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_malloc"].apply(null, arguments) };
var _memalign = Module["_memalign"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_memalign"].apply(null, arguments) };
var _memcpy = Module["_memcpy"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_memcpy"].apply(null, arguments) };
var _memjrnlClose = Module["_memjrnlClose"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_memjrnlClose"].apply(null, arguments) };
var _memjrnlFileSize = Module["_memjrnlFileSize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_memjrnlFileSize"].apply(null, arguments) };
var _memjrnlRead = Module["_memjrnlRead"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_memjrnlRead"].apply(null, arguments) };
var _memjrnlSync = Module["_memjrnlSync"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_memjrnlSync"].apply(null, arguments) };
var _memjrnlTruncate = Module["_memjrnlTruncate"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_memjrnlTruncate"].apply(null, arguments) };
var _memjrnlWrite = Module["_memjrnlWrite"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_memjrnlWrite"].apply(null, arguments) };
var _memmove = Module["_memmove"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_memmove"].apply(null, arguments) };
var _memset = Module["_memset"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_memset"].apply(null, arguments) };
var _minMaxFinalize = Module["_minMaxFinalize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_minMaxFinalize"].apply(null, arguments) };
var _minmaxFunc = Module["_minmaxFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_minmaxFunc"].apply(null, arguments) };
var _minmaxStep = Module["_minmaxStep"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_minmaxStep"].apply(null, arguments) };
var _mkdir = Module["_mkdir"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_mkdir"].apply(null, arguments) };
var _nocaseCollatingFunc = Module["_nocaseCollatingFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_nocaseCollatingFunc"].apply(null, arguments) };
var _nolockCheckReservedLock = Module["_nolockCheckReservedLock"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_nolockCheckReservedLock"].apply(null, arguments) };
var _nolockClose = Module["_nolockClose"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_nolockClose"].apply(null, arguments) };
var _nolockIoFinderImpl = Module["_nolockIoFinderImpl"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_nolockIoFinderImpl"].apply(null, arguments) };
var _nolockLock = Module["_nolockLock"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_nolockLock"].apply(null, arguments) };
var _nolockUnlock = Module["_nolockUnlock"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_nolockUnlock"].apply(null, arguments) };
var _nullifFunc = Module["_nullifFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_nullifFunc"].apply(null, arguments) };
var _openDirectory = Module["_openDirectory"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_openDirectory"].apply(null, arguments) };
var _pageReinit = Module["_pageReinit"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_pageReinit"].apply(null, arguments) };
var _pagerStress = Module["_pagerStress"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_pagerStress"].apply(null, arguments) };
var _pagerUndoCallback = Module["_pagerUndoCallback"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_pagerUndoCallback"].apply(null, arguments) };
var _pcache1Cachesize = Module["_pcache1Cachesize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_pcache1Cachesize"].apply(null, arguments) };
var _pcache1Create = Module["_pcache1Create"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_pcache1Create"].apply(null, arguments) };
var _pcache1Destroy = Module["_pcache1Destroy"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_pcache1Destroy"].apply(null, arguments) };
var _pcache1Fetch = Module["_pcache1Fetch"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_pcache1Fetch"].apply(null, arguments) };
var _pcache1Init = Module["_pcache1Init"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_pcache1Init"].apply(null, arguments) };
var _pcache1Pagecount = Module["_pcache1Pagecount"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_pcache1Pagecount"].apply(null, arguments) };
var _pcache1Rekey = Module["_pcache1Rekey"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_pcache1Rekey"].apply(null, arguments) };
var _pcache1Shrink = Module["_pcache1Shrink"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_pcache1Shrink"].apply(null, arguments) };
var _pcache1Shutdown = Module["_pcache1Shutdown"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_pcache1Shutdown"].apply(null, arguments) };
var _pcache1Truncate = Module["_pcache1Truncate"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_pcache1Truncate"].apply(null, arguments) };
var _pcache1Unpin = Module["_pcache1Unpin"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_pcache1Unpin"].apply(null, arguments) };
var _posixIoFinderImpl = Module["_posixIoFinderImpl"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_posixIoFinderImpl"].apply(null, arguments) };
var _posixOpen = Module["_posixOpen"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_posixOpen"].apply(null, arguments) };
var _pragmaVtabBestIndex = Module["_pragmaVtabBestIndex"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_pragmaVtabBestIndex"].apply(null, arguments) };
var _pragmaVtabClose = Module["_pragmaVtabClose"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_pragmaVtabClose"].apply(null, arguments) };
var _pragmaVtabColumn = Module["_pragmaVtabColumn"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_pragmaVtabColumn"].apply(null, arguments) };
var _pragmaVtabConnect = Module["_pragmaVtabConnect"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_pragmaVtabConnect"].apply(null, arguments) };
var _pragmaVtabDisconnect = Module["_pragmaVtabDisconnect"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_pragmaVtabDisconnect"].apply(null, arguments) };
var _pragmaVtabEof = Module["_pragmaVtabEof"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_pragmaVtabEof"].apply(null, arguments) };
var _pragmaVtabFilter = Module["_pragmaVtabFilter"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_pragmaVtabFilter"].apply(null, arguments) };
var _pragmaVtabNext = Module["_pragmaVtabNext"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_pragmaVtabNext"].apply(null, arguments) };
var _pragmaVtabOpen = Module["_pragmaVtabOpen"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_pragmaVtabOpen"].apply(null, arguments) };
var _pragmaVtabRowid = Module["_pragmaVtabRowid"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_pragmaVtabRowid"].apply(null, arguments) };
var _printfFunc = Module["_printfFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_printfFunc"].apply(null, arguments) };
var _pthread_mutex_lock = Module["_pthread_mutex_lock"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_pthread_mutex_lock"].apply(null, arguments) };
var _pthread_mutex_unlock = Module["_pthread_mutex_unlock"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_pthread_mutex_unlock"].apply(null, arguments) };
var _quoteFunc = Module["_quoteFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_quoteFunc"].apply(null, arguments) };
var _randomBlob = Module["_randomBlob"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_randomBlob"].apply(null, arguments) };
var _randomFunc = Module["_randomFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_randomFunc"].apply(null, arguments) };
var _read = Module["_read"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_read"].apply(null, arguments) };
var _readlink = Module["_readlink"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_readlink"].apply(null, arguments) };
var _renameParentFunc = Module["_renameParentFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_renameParentFunc"].apply(null, arguments) };
var _renameTableFunc = Module["_renameTableFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_renameTableFunc"].apply(null, arguments) };
var _renameTriggerFunc = Module["_renameTriggerFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_renameTriggerFunc"].apply(null, arguments) };
var _replaceFunc = Module["_replaceFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_replaceFunc"].apply(null, arguments) };
var _resolveExprStep = Module["_resolveExprStep"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_resolveExprStep"].apply(null, arguments) };
var _resolveSelectStep = Module["_resolveSelectStep"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_resolveSelectStep"].apply(null, arguments) };
var _rmdir = Module["_rmdir"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_rmdir"].apply(null, arguments) };
var _roundFunc = Module["_roundFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_roundFunc"].apply(null, arguments) };
var _sbrk = Module["_sbrk"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sbrk"].apply(null, arguments) };
var _selectAddSubqueryTypeInfo = Module["_selectAddSubqueryTypeInfo"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_selectAddSubqueryTypeInfo"].apply(null, arguments) };
var _selectExpander = Module["_selectExpander"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_selectExpander"].apply(null, arguments) };
var _selectPopWith = Module["_selectPopWith"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_selectPopWith"].apply(null, arguments) };
var _sn_write = Module["_sn_write"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sn_write"].apply(null, arguments) };
var _sourceidFunc = Module["_sourceidFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sourceidFunc"].apply(null, arguments) };
var _sqlite3BtreeNext = Module["_sqlite3BtreeNext"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3BtreeNext"].apply(null, arguments) };
var _sqlite3BtreePayloadChecked = Module["_sqlite3BtreePayloadChecked"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3BtreePayloadChecked"].apply(null, arguments) };
var _sqlite3BtreePrevious = Module["_sqlite3BtreePrevious"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3BtreePrevious"].apply(null, arguments) };
var _sqlite3BtreePutData = Module["_sqlite3BtreePutData"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3BtreePutData"].apply(null, arguments) };
var _sqlite3ExprIfFalse = Module["_sqlite3ExprIfFalse"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3ExprIfFalse"].apply(null, arguments) };
var _sqlite3ExprIfTrue = Module["_sqlite3ExprIfTrue"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3ExprIfTrue"].apply(null, arguments) };
var _sqlite3ExprWalkNoop = Module["_sqlite3ExprWalkNoop"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3ExprWalkNoop"].apply(null, arguments) };
var _sqlite3InitCallback = Module["_sqlite3InitCallback"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3InitCallback"].apply(null, arguments) };
var _sqlite3InvalidFunction = Module["_sqlite3InvalidFunction"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3InvalidFunction"].apply(null, arguments) };
var _sqlite3MallocSize = Module["_sqlite3MallocSize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3MallocSize"].apply(null, arguments) };
var _sqlite3MemFree = Module["_sqlite3MemFree"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3MemFree"].apply(null, arguments) };
var _sqlite3MemInit = Module["_sqlite3MemInit"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3MemInit"].apply(null, arguments) };
var _sqlite3MemMalloc = Module["_sqlite3MemMalloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3MemMalloc"].apply(null, arguments) };
var _sqlite3MemRealloc = Module["_sqlite3MemRealloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3MemRealloc"].apply(null, arguments) };
var _sqlite3MemRoundup = Module["_sqlite3MemRoundup"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3MemRoundup"].apply(null, arguments) };
var _sqlite3MemShutdown = Module["_sqlite3MemShutdown"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3MemShutdown"].apply(null, arguments) };
var _sqlite3MemSize = Module["_sqlite3MemSize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3MemSize"].apply(null, arguments) };
var _sqlite3NoopDestructor = Module["_sqlite3NoopDestructor"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3NoopDestructor"].apply(null, arguments) };
var _sqlite3SchemaClear = Module["_sqlite3SchemaClear"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3SchemaClear"].apply(null, arguments) };
var _sqlite3SelectWalkFail = Module["_sqlite3SelectWalkFail"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3SelectWalkFail"].apply(null, arguments) };
var _sqlite3SelectWalkNoop = Module["_sqlite3SelectWalkNoop"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3SelectWalkNoop"].apply(null, arguments) };
var _sqlite3VdbeRecordCompare = Module["_sqlite3VdbeRecordCompare"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3VdbeRecordCompare"].apply(null, arguments) };
var _sqlite3WalDefaultHook = Module["_sqlite3WalDefaultHook"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3WalDefaultHook"].apply(null, arguments) };
var _sqlite3_aggregate_context = Module["_sqlite3_aggregate_context"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_aggregate_context"].apply(null, arguments) };
var _sqlite3_auto_extension = Module["_sqlite3_auto_extension"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_auto_extension"].apply(null, arguments) };
var _sqlite3_backup_finish = Module["_sqlite3_backup_finish"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_backup_finish"].apply(null, arguments) };
var _sqlite3_backup_init = Module["_sqlite3_backup_init"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_backup_init"].apply(null, arguments) };
var _sqlite3_backup_pagecount = Module["_sqlite3_backup_pagecount"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_backup_pagecount"].apply(null, arguments) };
var _sqlite3_backup_remaining = Module["_sqlite3_backup_remaining"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_backup_remaining"].apply(null, arguments) };
var _sqlite3_backup_step = Module["_sqlite3_backup_step"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_backup_step"].apply(null, arguments) };
var _sqlite3_bind_blob = Module["_sqlite3_bind_blob"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_bind_blob"].apply(null, arguments) };
var _sqlite3_bind_blob64 = Module["_sqlite3_bind_blob64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_bind_blob64"].apply(null, arguments) };
var _sqlite3_bind_double = Module["_sqlite3_bind_double"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_bind_double"].apply(null, arguments) };
var _sqlite3_bind_int = Module["_sqlite3_bind_int"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_bind_int"].apply(null, arguments) };
var _sqlite3_bind_int64 = Module["_sqlite3_bind_int64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_bind_int64"].apply(null, arguments) };
var _sqlite3_bind_null = Module["_sqlite3_bind_null"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_bind_null"].apply(null, arguments) };
var _sqlite3_bind_parameter_count = Module["_sqlite3_bind_parameter_count"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_bind_parameter_count"].apply(null, arguments) };
var _sqlite3_bind_parameter_index = Module["_sqlite3_bind_parameter_index"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_bind_parameter_index"].apply(null, arguments) };
var _sqlite3_bind_parameter_name = Module["_sqlite3_bind_parameter_name"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_bind_parameter_name"].apply(null, arguments) };
var _sqlite3_bind_pointer = Module["_sqlite3_bind_pointer"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_bind_pointer"].apply(null, arguments) };
var _sqlite3_bind_text = Module["_sqlite3_bind_text"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_bind_text"].apply(null, arguments) };
var _sqlite3_bind_text16 = Module["_sqlite3_bind_text16"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_bind_text16"].apply(null, arguments) };
var _sqlite3_bind_text64 = Module["_sqlite3_bind_text64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_bind_text64"].apply(null, arguments) };
var _sqlite3_bind_value = Module["_sqlite3_bind_value"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_bind_value"].apply(null, arguments) };
var _sqlite3_bind_zeroblob = Module["_sqlite3_bind_zeroblob"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_bind_zeroblob"].apply(null, arguments) };
var _sqlite3_bind_zeroblob64 = Module["_sqlite3_bind_zeroblob64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_bind_zeroblob64"].apply(null, arguments) };
var _sqlite3_blob_bytes = Module["_sqlite3_blob_bytes"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_blob_bytes"].apply(null, arguments) };
var _sqlite3_blob_close = Module["_sqlite3_blob_close"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_blob_close"].apply(null, arguments) };
var _sqlite3_blob_open = Module["_sqlite3_blob_open"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_blob_open"].apply(null, arguments) };
var _sqlite3_blob_read = Module["_sqlite3_blob_read"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_blob_read"].apply(null, arguments) };
var _sqlite3_blob_reopen = Module["_sqlite3_blob_reopen"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_blob_reopen"].apply(null, arguments) };
var _sqlite3_blob_write = Module["_sqlite3_blob_write"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_blob_write"].apply(null, arguments) };
var _sqlite3_busy_handler = Module["_sqlite3_busy_handler"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_busy_handler"].apply(null, arguments) };
var _sqlite3_busy_timeout = Module["_sqlite3_busy_timeout"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_busy_timeout"].apply(null, arguments) };
var _sqlite3_cancel_auto_extension = Module["_sqlite3_cancel_auto_extension"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_cancel_auto_extension"].apply(null, arguments) };
var _sqlite3_changes = Module["_sqlite3_changes"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_changes"].apply(null, arguments) };
var _sqlite3_clear_bindings = Module["_sqlite3_clear_bindings"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_clear_bindings"].apply(null, arguments) };
var _sqlite3_close = Module["_sqlite3_close"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_close"].apply(null, arguments) };
var _sqlite3_close_v2 = Module["_sqlite3_close_v2"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_close_v2"].apply(null, arguments) };
var _sqlite3_collation_needed = Module["_sqlite3_collation_needed"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_collation_needed"].apply(null, arguments) };
var _sqlite3_collation_needed16 = Module["_sqlite3_collation_needed16"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_collation_needed16"].apply(null, arguments) };
var _sqlite3_column_blob = Module["_sqlite3_column_blob"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_column_blob"].apply(null, arguments) };
var _sqlite3_column_bytes = Module["_sqlite3_column_bytes"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_column_bytes"].apply(null, arguments) };
var _sqlite3_column_bytes16 = Module["_sqlite3_column_bytes16"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_column_bytes16"].apply(null, arguments) };
var _sqlite3_column_count = Module["_sqlite3_column_count"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_column_count"].apply(null, arguments) };
var _sqlite3_column_decltype = Module["_sqlite3_column_decltype"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_column_decltype"].apply(null, arguments) };
var _sqlite3_column_decltype16 = Module["_sqlite3_column_decltype16"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_column_decltype16"].apply(null, arguments) };
var _sqlite3_column_double = Module["_sqlite3_column_double"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_column_double"].apply(null, arguments) };
var _sqlite3_column_int = Module["_sqlite3_column_int"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_column_int"].apply(null, arguments) };
var _sqlite3_column_int64 = Module["_sqlite3_column_int64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_column_int64"].apply(null, arguments) };
var _sqlite3_column_name = Module["_sqlite3_column_name"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_column_name"].apply(null, arguments) };
var _sqlite3_column_name16 = Module["_sqlite3_column_name16"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_column_name16"].apply(null, arguments) };
var _sqlite3_column_text = Module["_sqlite3_column_text"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_column_text"].apply(null, arguments) };
var _sqlite3_column_text16 = Module["_sqlite3_column_text16"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_column_text16"].apply(null, arguments) };
var _sqlite3_column_type = Module["_sqlite3_column_type"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_column_type"].apply(null, arguments) };
var _sqlite3_column_value = Module["_sqlite3_column_value"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_column_value"].apply(null, arguments) };
var _sqlite3_commit_hook = Module["_sqlite3_commit_hook"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_commit_hook"].apply(null, arguments) };
var _sqlite3_compileoption_get = Module["_sqlite3_compileoption_get"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_compileoption_get"].apply(null, arguments) };
var _sqlite3_compileoption_used = Module["_sqlite3_compileoption_used"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_compileoption_used"].apply(null, arguments) };
var _sqlite3_complete = Module["_sqlite3_complete"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_complete"].apply(null, arguments) };
var _sqlite3_complete16 = Module["_sqlite3_complete16"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_complete16"].apply(null, arguments) };
var _sqlite3_context_db_handle = Module["_sqlite3_context_db_handle"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_context_db_handle"].apply(null, arguments) };
var _sqlite3_create_collation = Module["_sqlite3_create_collation"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_create_collation"].apply(null, arguments) };
var _sqlite3_create_collation16 = Module["_sqlite3_create_collation16"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_create_collation16"].apply(null, arguments) };
var _sqlite3_create_collation_v2 = Module["_sqlite3_create_collation_v2"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_create_collation_v2"].apply(null, arguments) };
var _sqlite3_create_function = Module["_sqlite3_create_function"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_create_function"].apply(null, arguments) };
var _sqlite3_create_function16 = Module["_sqlite3_create_function16"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_create_function16"].apply(null, arguments) };
var _sqlite3_create_function_v2 = Module["_sqlite3_create_function_v2"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_create_function_v2"].apply(null, arguments) };
var _sqlite3_create_module = Module["_sqlite3_create_module"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_create_module"].apply(null, arguments) };
var _sqlite3_create_module_v2 = Module["_sqlite3_create_module_v2"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_create_module_v2"].apply(null, arguments) };
var _sqlite3_data_count = Module["_sqlite3_data_count"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_data_count"].apply(null, arguments) };
var _sqlite3_db_cacheflush = Module["_sqlite3_db_cacheflush"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_db_cacheflush"].apply(null, arguments) };
var _sqlite3_db_config = Module["_sqlite3_db_config"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_db_config"].apply(null, arguments) };
var _sqlite3_db_filename = Module["_sqlite3_db_filename"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_db_filename"].apply(null, arguments) };
var _sqlite3_db_handle = Module["_sqlite3_db_handle"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_db_handle"].apply(null, arguments) };
var _sqlite3_db_mutex = Module["_sqlite3_db_mutex"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_db_mutex"].apply(null, arguments) };
var _sqlite3_db_readonly = Module["_sqlite3_db_readonly"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_db_readonly"].apply(null, arguments) };
var _sqlite3_db_release_memory = Module["_sqlite3_db_release_memory"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_db_release_memory"].apply(null, arguments) };
var _sqlite3_db_status = Module["_sqlite3_db_status"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_db_status"].apply(null, arguments) };
var _sqlite3_declare_vtab = Module["_sqlite3_declare_vtab"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_declare_vtab"].apply(null, arguments) };
var _sqlite3_errcode = Module["_sqlite3_errcode"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_errcode"].apply(null, arguments) };
var _sqlite3_errmsg = Module["_sqlite3_errmsg"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_errmsg"].apply(null, arguments) };
var _sqlite3_errmsg16 = Module["_sqlite3_errmsg16"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_errmsg16"].apply(null, arguments) };
var _sqlite3_errstr = Module["_sqlite3_errstr"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_errstr"].apply(null, arguments) };
var _sqlite3_exec = Module["_sqlite3_exec"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_exec"].apply(null, arguments) };
var _sqlite3_expanded_sql = Module["_sqlite3_expanded_sql"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_expanded_sql"].apply(null, arguments) };
var _sqlite3_extended_errcode = Module["_sqlite3_extended_errcode"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_extended_errcode"].apply(null, arguments) };
var _sqlite3_extended_result_codes = Module["_sqlite3_extended_result_codes"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_extended_result_codes"].apply(null, arguments) };
var _sqlite3_file_control = Module["_sqlite3_file_control"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_file_control"].apply(null, arguments) };
var _sqlite3_finalize = Module["_sqlite3_finalize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_finalize"].apply(null, arguments) };
var _sqlite3_free = Module["_sqlite3_free"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_free"].apply(null, arguments) };
var _sqlite3_free_table = Module["_sqlite3_free_table"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_free_table"].apply(null, arguments) };
var _sqlite3_get_autocommit = Module["_sqlite3_get_autocommit"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_get_autocommit"].apply(null, arguments) };
var _sqlite3_get_auxdata = Module["_sqlite3_get_auxdata"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_get_auxdata"].apply(null, arguments) };
var _sqlite3_get_table = Module["_sqlite3_get_table"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_get_table"].apply(null, arguments) };
var _sqlite3_get_table_cb = Module["_sqlite3_get_table_cb"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_get_table_cb"].apply(null, arguments) };
var _sqlite3_interrupt = Module["_sqlite3_interrupt"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_interrupt"].apply(null, arguments) };
var _sqlite3_last_insert_rowid = Module["_sqlite3_last_insert_rowid"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_last_insert_rowid"].apply(null, arguments) };
var _sqlite3_libversion = Module["_sqlite3_libversion"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_libversion"].apply(null, arguments) };
var _sqlite3_libversion_number = Module["_sqlite3_libversion_number"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_libversion_number"].apply(null, arguments) };
var _sqlite3_limit = Module["_sqlite3_limit"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_limit"].apply(null, arguments) };
var _sqlite3_load_extension = Module["_sqlite3_load_extension"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_load_extension"].apply(null, arguments) };
var _sqlite3_log = Module["_sqlite3_log"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_log"].apply(null, arguments) };
var _sqlite3_malloc = Module["_sqlite3_malloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_malloc"].apply(null, arguments) };
var _sqlite3_malloc64 = Module["_sqlite3_malloc64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_malloc64"].apply(null, arguments) };
var _sqlite3_memory_highwater = Module["_sqlite3_memory_highwater"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_memory_highwater"].apply(null, arguments) };
var _sqlite3_memory_used = Module["_sqlite3_memory_used"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_memory_used"].apply(null, arguments) };
var _sqlite3_mprintf = Module["_sqlite3_mprintf"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_mprintf"].apply(null, arguments) };
var _sqlite3_msize = Module["_sqlite3_msize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_msize"].apply(null, arguments) };
var _sqlite3_next_stmt = Module["_sqlite3_next_stmt"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_next_stmt"].apply(null, arguments) };
var _sqlite3_open = Module["_sqlite3_open"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_open"].apply(null, arguments) };
var _sqlite3_open16 = Module["_sqlite3_open16"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_open16"].apply(null, arguments) };
var _sqlite3_open_v2 = Module["_sqlite3_open_v2"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_open_v2"].apply(null, arguments) };
var _sqlite3_overload_function = Module["_sqlite3_overload_function"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_overload_function"].apply(null, arguments) };
var _sqlite3_prepare = Module["_sqlite3_prepare"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_prepare"].apply(null, arguments) };
var _sqlite3_prepare16 = Module["_sqlite3_prepare16"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_prepare16"].apply(null, arguments) };
var _sqlite3_prepare16_v2 = Module["_sqlite3_prepare16_v2"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_prepare16_v2"].apply(null, arguments) };
var _sqlite3_prepare16_v3 = Module["_sqlite3_prepare16_v3"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_prepare16_v3"].apply(null, arguments) };
var _sqlite3_prepare_v2 = Module["_sqlite3_prepare_v2"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_prepare_v2"].apply(null, arguments) };
var _sqlite3_prepare_v3 = Module["_sqlite3_prepare_v3"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_prepare_v3"].apply(null, arguments) };
var _sqlite3_progress_handler = Module["_sqlite3_progress_handler"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_progress_handler"].apply(null, arguments) };
var _sqlite3_randomness = Module["_sqlite3_randomness"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_randomness"].apply(null, arguments) };
var _sqlite3_realloc = Module["_sqlite3_realloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_realloc"].apply(null, arguments) };
var _sqlite3_realloc64 = Module["_sqlite3_realloc64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_realloc64"].apply(null, arguments) };
var _sqlite3_release_memory = Module["_sqlite3_release_memory"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_release_memory"].apply(null, arguments) };
var _sqlite3_reset = Module["_sqlite3_reset"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_reset"].apply(null, arguments) };
var _sqlite3_reset_auto_extension = Module["_sqlite3_reset_auto_extension"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_reset_auto_extension"].apply(null, arguments) };
var _sqlite3_result_blob = Module["_sqlite3_result_blob"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_result_blob"].apply(null, arguments) };
var _sqlite3_result_blob64 = Module["_sqlite3_result_blob64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_result_blob64"].apply(null, arguments) };
var _sqlite3_result_double = Module["_sqlite3_result_double"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_result_double"].apply(null, arguments) };
var _sqlite3_result_error = Module["_sqlite3_result_error"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_result_error"].apply(null, arguments) };
var _sqlite3_result_error16 = Module["_sqlite3_result_error16"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_result_error16"].apply(null, arguments) };
var _sqlite3_result_error_code = Module["_sqlite3_result_error_code"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_result_error_code"].apply(null, arguments) };
var _sqlite3_result_error_nomem = Module["_sqlite3_result_error_nomem"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_result_error_nomem"].apply(null, arguments) };
var _sqlite3_result_error_toobig = Module["_sqlite3_result_error_toobig"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_result_error_toobig"].apply(null, arguments) };
var _sqlite3_result_int = Module["_sqlite3_result_int"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_result_int"].apply(null, arguments) };
var _sqlite3_result_int64 = Module["_sqlite3_result_int64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_result_int64"].apply(null, arguments) };
var _sqlite3_result_null = Module["_sqlite3_result_null"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_result_null"].apply(null, arguments) };
var _sqlite3_result_pointer = Module["_sqlite3_result_pointer"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_result_pointer"].apply(null, arguments) };
var _sqlite3_result_subtype = Module["_sqlite3_result_subtype"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_result_subtype"].apply(null, arguments) };
var _sqlite3_result_text = Module["_sqlite3_result_text"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_result_text"].apply(null, arguments) };
var _sqlite3_result_text16 = Module["_sqlite3_result_text16"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_result_text16"].apply(null, arguments) };
var _sqlite3_result_text16be = Module["_sqlite3_result_text16be"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_result_text16be"].apply(null, arguments) };
var _sqlite3_result_text16le = Module["_sqlite3_result_text16le"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_result_text16le"].apply(null, arguments) };
var _sqlite3_result_text64 = Module["_sqlite3_result_text64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_result_text64"].apply(null, arguments) };
var _sqlite3_result_value = Module["_sqlite3_result_value"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_result_value"].apply(null, arguments) };
var _sqlite3_result_zeroblob = Module["_sqlite3_result_zeroblob"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_result_zeroblob"].apply(null, arguments) };
var _sqlite3_result_zeroblob64 = Module["_sqlite3_result_zeroblob64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_result_zeroblob64"].apply(null, arguments) };
var _sqlite3_rollback_hook = Module["_sqlite3_rollback_hook"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_rollback_hook"].apply(null, arguments) };
var _sqlite3_set_authorizer = Module["_sqlite3_set_authorizer"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_set_authorizer"].apply(null, arguments) };
var _sqlite3_set_auxdata = Module["_sqlite3_set_auxdata"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_set_auxdata"].apply(null, arguments) };
var _sqlite3_set_last_insert_rowid = Module["_sqlite3_set_last_insert_rowid"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_set_last_insert_rowid"].apply(null, arguments) };
var _sqlite3_sleep = Module["_sqlite3_sleep"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_sleep"].apply(null, arguments) };
var _sqlite3_snprintf = Module["_sqlite3_snprintf"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_snprintf"].apply(null, arguments) };
var _sqlite3_soft_heap_limit = Module["_sqlite3_soft_heap_limit"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_soft_heap_limit"].apply(null, arguments) };
var _sqlite3_soft_heap_limit64 = Module["_sqlite3_soft_heap_limit64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_soft_heap_limit64"].apply(null, arguments) };
var _sqlite3_sourceid = Module["_sqlite3_sourceid"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_sourceid"].apply(null, arguments) };
var _sqlite3_sql = Module["_sqlite3_sql"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_sql"].apply(null, arguments) };
var _sqlite3_status = Module["_sqlite3_status"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_status"].apply(null, arguments) };
var _sqlite3_status64 = Module["_sqlite3_status64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_status64"].apply(null, arguments) };
var _sqlite3_step = Module["_sqlite3_step"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_step"].apply(null, arguments) };
var _sqlite3_stmt_busy = Module["_sqlite3_stmt_busy"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_stmt_busy"].apply(null, arguments) };
var _sqlite3_stmt_readonly = Module["_sqlite3_stmt_readonly"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_stmt_readonly"].apply(null, arguments) };
var _sqlite3_stmt_status = Module["_sqlite3_stmt_status"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_stmt_status"].apply(null, arguments) };
var _sqlite3_strglob = Module["_sqlite3_strglob"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_strglob"].apply(null, arguments) };
var _sqlite3_stricmp = Module["_sqlite3_stricmp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_stricmp"].apply(null, arguments) };
var _sqlite3_strlike = Module["_sqlite3_strlike"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_strlike"].apply(null, arguments) };
var _sqlite3_strnicmp = Module["_sqlite3_strnicmp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_strnicmp"].apply(null, arguments) };
var _sqlite3_system_errno = Module["_sqlite3_system_errno"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_system_errno"].apply(null, arguments) };
var _sqlite3_table_column_metadata = Module["_sqlite3_table_column_metadata"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_table_column_metadata"].apply(null, arguments) };
var _sqlite3_test_control = Module["_sqlite3_test_control"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_test_control"].apply(null, arguments) };
var _sqlite3_threadsafe = Module["_sqlite3_threadsafe"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_threadsafe"].apply(null, arguments) };
var _sqlite3_total_changes = Module["_sqlite3_total_changes"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_total_changes"].apply(null, arguments) };
var _sqlite3_trace_v2 = Module["_sqlite3_trace_v2"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_trace_v2"].apply(null, arguments) };
var _sqlite3_update_hook = Module["_sqlite3_update_hook"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_update_hook"].apply(null, arguments) };
var _sqlite3_uri_boolean = Module["_sqlite3_uri_boolean"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_uri_boolean"].apply(null, arguments) };
var _sqlite3_uri_int64 = Module["_sqlite3_uri_int64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_uri_int64"].apply(null, arguments) };
var _sqlite3_uri_parameter = Module["_sqlite3_uri_parameter"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_uri_parameter"].apply(null, arguments) };
var _sqlite3_user_data = Module["_sqlite3_user_data"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_user_data"].apply(null, arguments) };
var _sqlite3_value_blob = Module["_sqlite3_value_blob"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_value_blob"].apply(null, arguments) };
var _sqlite3_value_bytes = Module["_sqlite3_value_bytes"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_value_bytes"].apply(null, arguments) };
var _sqlite3_value_bytes16 = Module["_sqlite3_value_bytes16"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_value_bytes16"].apply(null, arguments) };
var _sqlite3_value_double = Module["_sqlite3_value_double"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_value_double"].apply(null, arguments) };
var _sqlite3_value_dup = Module["_sqlite3_value_dup"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_value_dup"].apply(null, arguments) };
var _sqlite3_value_free = Module["_sqlite3_value_free"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_value_free"].apply(null, arguments) };
var _sqlite3_value_int = Module["_sqlite3_value_int"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_value_int"].apply(null, arguments) };
var _sqlite3_value_int64 = Module["_sqlite3_value_int64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_value_int64"].apply(null, arguments) };
var _sqlite3_value_nochange = Module["_sqlite3_value_nochange"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_value_nochange"].apply(null, arguments) };
var _sqlite3_value_numeric_type = Module["_sqlite3_value_numeric_type"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_value_numeric_type"].apply(null, arguments) };
var _sqlite3_value_pointer = Module["_sqlite3_value_pointer"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_value_pointer"].apply(null, arguments) };
var _sqlite3_value_subtype = Module["_sqlite3_value_subtype"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_value_subtype"].apply(null, arguments) };
var _sqlite3_value_text = Module["_sqlite3_value_text"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_value_text"].apply(null, arguments) };
var _sqlite3_value_text16 = Module["_sqlite3_value_text16"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_value_text16"].apply(null, arguments) };
var _sqlite3_value_text16be = Module["_sqlite3_value_text16be"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_value_text16be"].apply(null, arguments) };
var _sqlite3_value_text16le = Module["_sqlite3_value_text16le"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_value_text16le"].apply(null, arguments) };
var _sqlite3_value_type = Module["_sqlite3_value_type"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_value_type"].apply(null, arguments) };
var _sqlite3_vfs_find = Module["_sqlite3_vfs_find"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_vfs_find"].apply(null, arguments) };
var _sqlite3_vfs_register = Module["_sqlite3_vfs_register"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_vfs_register"].apply(null, arguments) };
var _sqlite3_vfs_unregister = Module["_sqlite3_vfs_unregister"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_vfs_unregister"].apply(null, arguments) };
var _sqlite3_vmprintf = Module["_sqlite3_vmprintf"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_vmprintf"].apply(null, arguments) };
var _sqlite3_vsnprintf = Module["_sqlite3_vsnprintf"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_vsnprintf"].apply(null, arguments) };
var _sqlite3_vtab_collation = Module["_sqlite3_vtab_collation"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_vtab_collation"].apply(null, arguments) };
var _sqlite3_vtab_config = Module["_sqlite3_vtab_config"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_vtab_config"].apply(null, arguments) };
var _sqlite3_vtab_nochange = Module["_sqlite3_vtab_nochange"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_vtab_nochange"].apply(null, arguments) };
var _sqlite3_vtab_on_conflict = Module["_sqlite3_vtab_on_conflict"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_vtab_on_conflict"].apply(null, arguments) };
var _sqlite3_wal_autocheckpoint = Module["_sqlite3_wal_autocheckpoint"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_wal_autocheckpoint"].apply(null, arguments) };
var _sqlite3_wal_checkpoint = Module["_sqlite3_wal_checkpoint"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_wal_checkpoint"].apply(null, arguments) };
var _sqlite3_wal_checkpoint_v2 = Module["_sqlite3_wal_checkpoint_v2"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_wal_checkpoint_v2"].apply(null, arguments) };
var _sqlite3_wal_hook = Module["_sqlite3_wal_hook"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqlite3_wal_hook"].apply(null, arguments) };
var _sqliteDefaultBusyCallback = Module["_sqliteDefaultBusyCallback"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sqliteDefaultBusyCallback"].apply(null, arguments) };
var _stat = Module["_stat"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_stat"].apply(null, arguments) };
var _stat4Destructor = Module["_stat4Destructor"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_stat4Destructor"].apply(null, arguments) };
var _statGet = Module["_statGet"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_statGet"].apply(null, arguments) };
var _statInit = Module["_statInit"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_statInit"].apply(null, arguments) };
var _statPush = Module["_statPush"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_statPush"].apply(null, arguments) };
var _strftimeFunc = Module["_strftimeFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_strftimeFunc"].apply(null, arguments) };
var _substrFunc = Module["_substrFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_substrFunc"].apply(null, arguments) };
var _sumFinalize = Module["_sumFinalize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sumFinalize"].apply(null, arguments) };
var _sumStep = Module["_sumStep"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sumStep"].apply(null, arguments) };
var _timeFunc = Module["_timeFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_timeFunc"].apply(null, arguments) };
var _totalFinalize = Module["_totalFinalize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_totalFinalize"].apply(null, arguments) };
var _total_changes = Module["_total_changes"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_total_changes"].apply(null, arguments) };
var _trimFunc = Module["_trimFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_trimFunc"].apply(null, arguments) };
var _typeofFunc = Module["_typeofFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_typeofFunc"].apply(null, arguments) };
var _unicodeFunc = Module["_unicodeFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_unicodeFunc"].apply(null, arguments) };
var _unixAccess = Module["_unixAccess"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_unixAccess"].apply(null, arguments) };
var _unixCheckReservedLock = Module["_unixCheckReservedLock"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_unixCheckReservedLock"].apply(null, arguments) };
var _unixClose = Module["_unixClose"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_unixClose"].apply(null, arguments) };
var _unixCurrentTimeInt64 = Module["_unixCurrentTimeInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_unixCurrentTimeInt64"].apply(null, arguments) };
var _unixDelete = Module["_unixDelete"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_unixDelete"].apply(null, arguments) };
var _unixDeviceCharacteristics = Module["_unixDeviceCharacteristics"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_unixDeviceCharacteristics"].apply(null, arguments) };
var _unixDlClose = Module["_unixDlClose"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_unixDlClose"].apply(null, arguments) };
var _unixDlError = Module["_unixDlError"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_unixDlError"].apply(null, arguments) };
var _unixDlOpen = Module["_unixDlOpen"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_unixDlOpen"].apply(null, arguments) };
var _unixDlSym = Module["_unixDlSym"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_unixDlSym"].apply(null, arguments) };
var _unixFetch = Module["_unixFetch"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_unixFetch"].apply(null, arguments) };
var _unixFileControl = Module["_unixFileControl"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_unixFileControl"].apply(null, arguments) };
var _unixFileSize = Module["_unixFileSize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_unixFileSize"].apply(null, arguments) };
var _unixFullPathname = Module["_unixFullPathname"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_unixFullPathname"].apply(null, arguments) };
var _unixGetLastError = Module["_unixGetLastError"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_unixGetLastError"].apply(null, arguments) };
var _unixGetSystemCall = Module["_unixGetSystemCall"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_unixGetSystemCall"].apply(null, arguments) };
var _unixGetpagesize = Module["_unixGetpagesize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_unixGetpagesize"].apply(null, arguments) };
var _unixLock = Module["_unixLock"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_unixLock"].apply(null, arguments) };
var _unixNextSystemCall = Module["_unixNextSystemCall"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_unixNextSystemCall"].apply(null, arguments) };
var _unixOpen = Module["_unixOpen"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_unixOpen"].apply(null, arguments) };
var _unixRandomness = Module["_unixRandomness"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_unixRandomness"].apply(null, arguments) };
var _unixRead = Module["_unixRead"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_unixRead"].apply(null, arguments) };
var _unixSectorSize = Module["_unixSectorSize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_unixSectorSize"].apply(null, arguments) };
var _unixSetSystemCall = Module["_unixSetSystemCall"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_unixSetSystemCall"].apply(null, arguments) };
var _unixShmBarrier = Module["_unixShmBarrier"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_unixShmBarrier"].apply(null, arguments) };
var _unixShmLock = Module["_unixShmLock"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_unixShmLock"].apply(null, arguments) };
var _unixShmMap = Module["_unixShmMap"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_unixShmMap"].apply(null, arguments) };
var _unixShmUnmap = Module["_unixShmUnmap"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_unixShmUnmap"].apply(null, arguments) };
var _unixSleep = Module["_unixSleep"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_unixSleep"].apply(null, arguments) };
var _unixSync = Module["_unixSync"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_unixSync"].apply(null, arguments) };
var _unixTruncate = Module["_unixTruncate"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_unixTruncate"].apply(null, arguments) };
var _unixUnfetch = Module["_unixUnfetch"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_unixUnfetch"].apply(null, arguments) };
var _unixUnlock = Module["_unixUnlock"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_unixUnlock"].apply(null, arguments) };
var _unixWrite = Module["_unixWrite"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_unixWrite"].apply(null, arguments) };
var _unlink = Module["_unlink"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_unlink"].apply(null, arguments) };
var _upperFunc = Module["_upperFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_upperFunc"].apply(null, arguments) };
var _vdbeRecordCompareInt = Module["_vdbeRecordCompareInt"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_vdbeRecordCompareInt"].apply(null, arguments) };
var _vdbeRecordCompareString = Module["_vdbeRecordCompareString"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_vdbeRecordCompareString"].apply(null, arguments) };
var _vdbeSorterCompare = Module["_vdbeSorterCompare"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_vdbeSorterCompare"].apply(null, arguments) };
var _vdbeSorterCompareInt = Module["_vdbeSorterCompareInt"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_vdbeSorterCompareInt"].apply(null, arguments) };
var _vdbeSorterCompareText = Module["_vdbeSorterCompareText"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_vdbeSorterCompareText"].apply(null, arguments) };
var _versionFunc = Module["_versionFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_versionFunc"].apply(null, arguments) };
var _whereIndexExprTransNode = Module["_whereIndexExprTransNode"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_whereIndexExprTransNode"].apply(null, arguments) };
var _write = Module["_write"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_write"].apply(null, arguments) };
var _zeroblobFunc = Module["_zeroblobFunc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_zeroblobFunc"].apply(null, arguments) };
var establishStackSpace = Module["establishStackSpace"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["establishStackSpace"].apply(null, arguments) };
var getTempRet0 = Module["getTempRet0"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["getTempRet0"].apply(null, arguments) };
var runPostSets = Module["runPostSets"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["runPostSets"].apply(null, arguments) };
var setTempRet0 = Module["setTempRet0"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["setTempRet0"].apply(null, arguments) };
var setThrew = Module["setThrew"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["setThrew"].apply(null, arguments) };
var stackAlloc = Module["stackAlloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["stackAlloc"].apply(null, arguments) };
var stackRestore = Module["stackRestore"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["stackRestore"].apply(null, arguments) };
var stackSave = Module["stackSave"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["stackSave"].apply(null, arguments) };
var dynCall_di = Module["dynCall_di"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_di"].apply(null, arguments) };
var dynCall_dii = Module["dynCall_dii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_dii"].apply(null, arguments) };
var dynCall_i = Module["dynCall_i"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_i"].apply(null, arguments) };
var dynCall_ii = Module["dynCall_ii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_ii"].apply(null, arguments) };
var dynCall_iii = Module["dynCall_iii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iii"].apply(null, arguments) };
var dynCall_iiid = Module["dynCall_iiid"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iiid"].apply(null, arguments) };
var dynCall_iiii = Module["dynCall_iiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iiii"].apply(null, arguments) };
var dynCall_iiiii = Module["dynCall_iiiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iiiii"].apply(null, arguments) };
var dynCall_iiiiii = Module["dynCall_iiiiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iiiiii"].apply(null, arguments) };
var dynCall_iiiiiii = Module["dynCall_iiiiiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iiiiiii"].apply(null, arguments) };
var dynCall_iiiiiiiii = Module["dynCall_iiiiiiiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iiiiiiiii"].apply(null, arguments) };
var dynCall_iiiiiiiiii = Module["dynCall_iiiiiiiiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iiiiiiiiii"].apply(null, arguments) };
var dynCall_iiiiijii = Module["dynCall_iiiiijii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iiiiijii"].apply(null, arguments) };
var dynCall_iiiij = Module["dynCall_iiiij"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iiiij"].apply(null, arguments) };
var dynCall_iiiiji = Module["dynCall_iiiiji"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iiiiji"].apply(null, arguments) };
var dynCall_iiiijii = Module["dynCall_iiiijii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iiiijii"].apply(null, arguments) };
var dynCall_iiij = Module["dynCall_iiij"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iiij"].apply(null, arguments) };
var dynCall_iij = Module["dynCall_iij"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iij"].apply(null, arguments) };
var dynCall_iiji = Module["dynCall_iiji"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iiji"].apply(null, arguments) };
var dynCall_iijii = Module["dynCall_iijii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iijii"].apply(null, arguments) };
var dynCall_ij = Module["dynCall_ij"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_ij"].apply(null, arguments) };
var dynCall_j = Module["dynCall_j"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_j"].apply(null, arguments) };
var dynCall_ji = Module["dynCall_ji"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_ji"].apply(null, arguments) };
var dynCall_jii = Module["dynCall_jii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_jii"].apply(null, arguments) };
var dynCall_jiij = Module["dynCall_jiij"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_jiij"].apply(null, arguments) };
var dynCall_jj = Module["dynCall_jj"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_jj"].apply(null, arguments) };
var dynCall_v = Module["dynCall_v"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_v"].apply(null, arguments) };
var dynCall_vi = Module["dynCall_vi"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_vi"].apply(null, arguments) };
var dynCall_vid = Module["dynCall_vid"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_vid"].apply(null, arguments) };
var dynCall_vii = Module["dynCall_vii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_vii"].apply(null, arguments) };
var dynCall_viii = Module["dynCall_viii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_viii"].apply(null, arguments) };
var dynCall_viiii = Module["dynCall_viiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_viiii"].apply(null, arguments) };
var dynCall_viiiii = Module["dynCall_viiiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_viiiii"].apply(null, arguments) };
var dynCall_viiiiii = Module["dynCall_viiiiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_viiiiii"].apply(null, arguments) };
var dynCall_viiiij = Module["dynCall_viiiij"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_viiiij"].apply(null, arguments) };
var dynCall_viij = Module["dynCall_viij"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_viij"].apply(null, arguments) };
var dynCall_viiji = Module["dynCall_viiji"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_viiji"].apply(null, arguments) };
var dynCall_viijii = Module["dynCall_viijii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_viijii"].apply(null, arguments) };
var dynCall_viijiiiii = Module["dynCall_viijiiiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_viijiiiii"].apply(null, arguments) };
var dynCall_vij = Module["dynCall_vij"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_vij"].apply(null, arguments) };
var dynCall_viji = Module["dynCall_viji"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_viji"].apply(null, arguments) };
;



// === Auto-generated postamble setup entry stuff ===

Module['asm'] = asm;

if (!Module["intArrayFromString"]) Module["intArrayFromString"] = function() { abort("'intArrayFromString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["intArrayToString"]) Module["intArrayToString"] = function() { abort("'intArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
Module["ccall"] = ccall;
Module["cwrap"] = cwrap;
if (!Module["setValue"]) Module["setValue"] = function() { abort("'setValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getValue"]) Module["getValue"] = function() { abort("'getValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["allocate"]) Module["allocate"] = function() { abort("'allocate' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getMemory"]) Module["getMemory"] = function() { abort("'getMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["Pointer_stringify"]) Module["Pointer_stringify"] = function() { abort("'Pointer_stringify' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["AsciiToString"]) Module["AsciiToString"] = function() { abort("'AsciiToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToAscii"]) Module["stringToAscii"] = function() { abort("'stringToAscii' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF8ArrayToString"]) Module["UTF8ArrayToString"] = function() { abort("'UTF8ArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF8ToString"]) Module["UTF8ToString"] = function() { abort("'UTF8ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF8Array"]) Module["stringToUTF8Array"] = function() { abort("'stringToUTF8Array' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF8"]) Module["stringToUTF8"] = function() { abort("'stringToUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["lengthBytesUTF8"]) Module["lengthBytesUTF8"] = function() { abort("'lengthBytesUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF16ToString"]) Module["UTF16ToString"] = function() { abort("'UTF16ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF16"]) Module["stringToUTF16"] = function() { abort("'stringToUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["lengthBytesUTF16"]) Module["lengthBytesUTF16"] = function() { abort("'lengthBytesUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF32ToString"]) Module["UTF32ToString"] = function() { abort("'UTF32ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF32"]) Module["stringToUTF32"] = function() { abort("'stringToUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["lengthBytesUTF32"]) Module["lengthBytesUTF32"] = function() { abort("'lengthBytesUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["allocateUTF8"]) Module["allocateUTF8"] = function() { abort("'allocateUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackTrace"]) Module["stackTrace"] = function() { abort("'stackTrace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnPreRun"]) Module["addOnPreRun"] = function() { abort("'addOnPreRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnInit"]) Module["addOnInit"] = function() { abort("'addOnInit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnPreMain"]) Module["addOnPreMain"] = function() { abort("'addOnPreMain' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnExit"]) Module["addOnExit"] = function() { abort("'addOnExit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnPostRun"]) Module["addOnPostRun"] = function() { abort("'addOnPostRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["writeStringToMemory"]) Module["writeStringToMemory"] = function() { abort("'writeStringToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["writeArrayToMemory"]) Module["writeArrayToMemory"] = function() { abort("'writeArrayToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["writeAsciiToMemory"]) Module["writeAsciiToMemory"] = function() { abort("'writeAsciiToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addRunDependency"]) Module["addRunDependency"] = function() { abort("'addRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["removeRunDependency"]) Module["removeRunDependency"] = function() { abort("'removeRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS"]) Module["FS"] = function() { abort("'FS' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["FS_createFolder"]) Module["FS_createFolder"] = function() { abort("'FS_createFolder' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createPath"]) Module["FS_createPath"] = function() { abort("'FS_createPath' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createDataFile"]) Module["FS_createDataFile"] = function() { abort("'FS_createDataFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createPreloadedFile"]) Module["FS_createPreloadedFile"] = function() { abort("'FS_createPreloadedFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createLazyFile"]) Module["FS_createLazyFile"] = function() { abort("'FS_createLazyFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createLink"]) Module["FS_createLink"] = function() { abort("'FS_createLink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createDevice"]) Module["FS_createDevice"] = function() { abort("'FS_createDevice' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_unlink"]) Module["FS_unlink"] = function() { abort("'FS_unlink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["GL"]) Module["GL"] = function() { abort("'GL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["staticAlloc"]) Module["staticAlloc"] = function() { abort("'staticAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["dynamicAlloc"]) Module["dynamicAlloc"] = function() { abort("'dynamicAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["warnOnce"]) Module["warnOnce"] = function() { abort("'warnOnce' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["loadDynamicLibrary"]) Module["loadDynamicLibrary"] = function() { abort("'loadDynamicLibrary' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["loadWebAssemblyModule"]) Module["loadWebAssemblyModule"] = function() { abort("'loadWebAssemblyModule' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getLEB"]) Module["getLEB"] = function() { abort("'getLEB' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getFunctionTables"]) Module["getFunctionTables"] = function() { abort("'getFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["alignFunctionTables"]) Module["alignFunctionTables"] = function() { abort("'alignFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["registerFunctions"]) Module["registerFunctions"] = function() { abort("'registerFunctions' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
Module["addFunction"] = addFunction;
if (!Module["removeFunction"]) Module["removeFunction"] = function() { abort("'removeFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getFuncWrapper"]) Module["getFuncWrapper"] = function() { abort("'getFuncWrapper' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["prettyPrint"]) Module["prettyPrint"] = function() { abort("'prettyPrint' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["makeBigInt"]) Module["makeBigInt"] = function() { abort("'makeBigInt' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["dynCall"]) Module["dynCall"] = function() { abort("'dynCall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getCompilerSetting"]) Module["getCompilerSetting"] = function() { abort("'getCompilerSetting' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackSave"]) Module["stackSave"] = function() { abort("'stackSave' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackRestore"]) Module["stackRestore"] = function() { abort("'stackRestore' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackAlloc"]) Module["stackAlloc"] = function() { abort("'stackAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };if (!Module["ALLOC_NORMAL"]) Object.defineProperty(Module, "ALLOC_NORMAL", { get: function() { abort("'ALLOC_NORMAL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_STACK"]) Object.defineProperty(Module, "ALLOC_STACK", { get: function() { abort("'ALLOC_STACK' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_STATIC"]) Object.defineProperty(Module, "ALLOC_STATIC", { get: function() { abort("'ALLOC_STATIC' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_DYNAMIC"]) Object.defineProperty(Module, "ALLOC_DYNAMIC", { get: function() { abort("'ALLOC_DYNAMIC' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_NONE"]) Object.defineProperty(Module, "ALLOC_NONE", { get: function() { abort("'ALLOC_NONE' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });




/**
 * @constructor
 * @extends {Error}
 * @this {ExitStatus}
 */
function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
};
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;

var initialStackTop;
var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!Module['calledRun']) run();
  if (!Module['calledRun']) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
}





/** @type {function(Array=)} */
function run(args) {
  args = args || Module['arguments'];

  if (runDependencies > 0) {
    return;
  }

  writeStackCookie();

  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later
  if (Module['calledRun']) return; // run may have just been called through dependencies being fulfilled just in this very frame

  function doRun() {
    if (Module['calledRun']) return; // run may have just been called while the async setStatus time below was happening
    Module['calledRun'] = true;

    if (ABORT) return;

    ensureInitRuntime();

    preMain();

    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    assert(!Module['_main'], 'compiled without a main, but one is present. if you added it from JS, use Module["onRuntimeInitialized"]');

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
  checkStackCookie();
}
Module['run'] = run;

function checkUnflushedContent() {
  // Compiler settings do not allow exiting the runtime, so flushing
  // the streams is not possible. but in ASSERTIONS mode we check
  // if there was something to flush, and if so tell the user they
  // should request that the runtime be exitable.
  // Normally we would not even include flush() at all, but in ASSERTIONS
  // builds we do so just for this check, and here we see if there is any
  // content to flush, that is, we check if there would have been
  // something a non-ASSERTIONS build would have not seen.
  // How we flush the streams depends on whether we are in NO_FILESYSTEM
  // mode (which has its own special function for this; otherwise, all
  // the code is inside libc)
  var print = Module['print'];
  var printErr = Module['printErr'];
  var has = false;
  Module['print'] = Module['printErr'] = function(x) {
    has = true;
  }
  try { // it doesn't matter if it fails
    var flush = flush_NO_FILESYSTEM;
    if (flush) flush(0);
  } catch(e) {}
  Module['print'] = print;
  Module['printErr'] = printErr;
  if (has) {
    warnOnce('stdio streams had content in them that was not flushed. you should set NO_EXIT_RUNTIME to 0 (see the FAQ), or make sure to emit a newline when you printf etc.');
  }
}

function exit(status, implicit) {
  checkUnflushedContent();

  // if this is just main exit-ing implicitly, and the status is 0, then we
  // don't need to do anything here and can just leave. if the status is
  // non-zero, though, then we need to report it.
  // (we may have warned about this earlier, if a situation justifies doing so)
  if (implicit && Module['noExitRuntime'] && status === 0) {
    return;
  }

  if (Module['noExitRuntime']) {
    // if exit() was called, we may warn the user if the runtime isn't actually being shut down
    if (!implicit) {
      Module.printErr('exit(' + status + ') called, but NO_EXIT_RUNTIME is set, so halting execution but not exiting the runtime or preventing further async execution (build with NO_EXIT_RUNTIME=0, if you want a true shutdown)');
    }
  } else {

    ABORT = true;
    EXITSTATUS = status;
    STACKTOP = initialStackTop;

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);
  }

  if (ENVIRONMENT_IS_NODE) {
    process['exit'](status);
  }
  Module['quit'](status, new ExitStatus(status));
}
Module['exit'] = exit;

var abortDecorators = [];

function abort(what) {
  if (Module['onAbort']) {
    Module['onAbort'](what);
  }

  if (what !== undefined) {
    Module.print(what);
    Module.printErr(what);
    what = JSON.stringify(what)
  } else {
    what = '';
  }

  ABORT = true;
  EXITSTATUS = 1;

  var extra = '';
  var output = 'abort(' + what + ') at ' + stackTrace() + extra;
  if (abortDecorators) {
    abortDecorators.forEach(function(decorator) {
      output = decorator(output, what);
    });
  }
  throw output;
}
Module['abort'] = abort;

// {{PRE_RUN_ADDITIONS}}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}


Module["noExitRuntime"] = true;

run();

// {{POST_RUN_ADDITIONS}}





// {{MODULE_ADDITIONS}}



