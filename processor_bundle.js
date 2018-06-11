var perfetto = (function () {
	'use strict';

	function unwrapExports (x) {
		return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
	}

	function createCommonjsModule(fn, module) {
		return module = { exports: {} }, fn(module, module.exports), module.exports;
	}

	var trace_processor = createCommonjsModule(function (module, exports) {
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
	class TraceProcessorBridge {
	    constructor() {
	        this.wasm_ = undefined;
	        this.file_ = undefined;
	        // @ts-ignore
	        this.fileReader = new FileReaderSync();
	    }
	    get file() {
	        console.assert(this.file_);
	        if (!this.file_)
	            throw "Error!";
	        return this.file_;
	    }
	    set file(f) {
	        console.assert(!this.file_);
	        this.file_ = f;
	        this.maybeInitialize();
	    }
	    onRuntimeInitialized(wasm) {
	        console.assert(!this.wasm_);
	        this.wasm_ = wasm;
	        this.maybeInitialize();
	    }
	    maybeInitialize() {
	        console.log('maybeInitialize', this.wasm_, this.file_);
	        if (!this.wasm_ || !this.file_)
	            return;
	        const readTraceFn = this.wasm_.addFunction(this.readTraceData.bind(this), 'iiii');
	        const replyFn = this.wasm_.addFunction(this.reply.bind(this), 'viiii');
	        this.wasm_.ccall('Initialize', 'void', ['number', 'number'], [readTraceFn, replyFn]);
	    }
	    readTraceData(offset, len, dstPtr) {
	        const slice = this.file.slice(offset, offset + len);
	        const buf = this.fileReader.readAsArrayBuffer(slice);
	        const buf8 = new Uint8Array(buf);
	        this.wasm_.HEAPU8.set(buf8, dstPtr);
	        return buf.byteLength;
	    }
	    reply(reqId, success, heapPtr, size) {
	        const data = this.wasm_.HEAPU8.slice(heapPtr, heapPtr + size);
	        console.log('reply', reqId, success, data);
	    }
	    query() {
	        this.wasm_.ccall('ExecuteQuery', 'void', [], []);
	    }
	}
	function main() {
	    console.log('Hello from processor!');
	    const bridge = new TraceProcessorBridge();
	    self.onmessage = (msg) => {
	        switch (msg.data.topic) {
	            case "load_file":
	                const file = msg.data.file;
	                bridge.file = file;
	                break;
	            case "query":
	                bridge.query();
	                break;
	        }
	    };
	    self.Module = {
	        locateFile: (s) => {
	            const parts = location.pathname.split('/');
	            const base = parts.splice(0, parts.length - 1).join('/');
	            const path = `${base}/${s}`;
	            console.log('locateFile', s, base, path);
	            return path;
	        },
	        onRuntimeInitialized: () => bridge.onRuntimeInitialized(self.Module),
	        print: (s) => console.log(s),
	        printErr: (s) => console.warn(s),
	    };
	    self.importScripts('trace_processor.js');
	}
	exports.main = main;

	});

	unwrapExports(trace_processor);
	var trace_processor_1 = trace_processor.main;

	var processor = createCommonjsModule(function (module, exports) {
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

	trace_processor.main();

	});

	var processor$1 = unwrapExports(processor);

	return processor$1;

}());
//# sourceMappingURL=processor_bundle.js.map
