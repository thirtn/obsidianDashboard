var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/async-lock/lib/index.js
var require_lib = __commonJS({
  "node_modules/async-lock/lib/index.js"(exports, module2) {
    "use strict";
    var AsyncLock2 = function(opts) {
      opts = opts || {};
      this.Promise = opts.Promise || Promise;
      this.queues = /* @__PURE__ */ Object.create(null);
      this.domainReentrant = opts.domainReentrant || false;
      if (this.domainReentrant) {
        if (typeof process === "undefined" || typeof process.domain === "undefined") {
          throw new Error(
            "Domain-reentrant locks require `process.domain` to exist. Please flip `opts.domainReentrant = false`, use a NodeJS version that still implements Domain, or install a browser polyfill."
          );
        }
        this.domains = /* @__PURE__ */ Object.create(null);
      }
      this.timeout = opts.timeout || AsyncLock2.DEFAULT_TIMEOUT;
      this.maxOccupationTime = opts.maxOccupationTime || AsyncLock2.DEFAULT_MAX_OCCUPATION_TIME;
      this.maxExecutionTime = opts.maxExecutionTime || AsyncLock2.DEFAULT_MAX_EXECUTION_TIME;
      if (opts.maxPending === Infinity || Number.isInteger(opts.maxPending) && opts.maxPending >= 0) {
        this.maxPending = opts.maxPending;
      } else {
        this.maxPending = AsyncLock2.DEFAULT_MAX_PENDING;
      }
    };
    AsyncLock2.DEFAULT_TIMEOUT = 0;
    AsyncLock2.DEFAULT_MAX_OCCUPATION_TIME = 0;
    AsyncLock2.DEFAULT_MAX_EXECUTION_TIME = 0;
    AsyncLock2.DEFAULT_MAX_PENDING = 1e3;
    AsyncLock2.prototype.acquire = function(key, fn, cb, opts) {
      if (Array.isArray(key)) {
        return this._acquireBatch(key, fn, cb, opts);
      }
      if (typeof fn !== "function") {
        throw new Error("You must pass a function to execute");
      }
      var deferredResolve = null;
      var deferredReject = null;
      var deferred = null;
      if (typeof cb !== "function") {
        opts = cb;
        cb = null;
        deferred = new this.Promise(function(resolve, reject) {
          deferredResolve = resolve;
          deferredReject = reject;
        });
      }
      opts = opts || {};
      var resolved = false;
      var timer = null;
      var occupationTimer = null;
      var executionTimer = null;
      var self = this;
      var done = function(locked, err, ret) {
        if (occupationTimer) {
          clearTimeout(occupationTimer);
          occupationTimer = null;
        }
        if (executionTimer) {
          clearTimeout(executionTimer);
          executionTimer = null;
        }
        if (locked) {
          if (!!self.queues[key] && self.queues[key].length === 0) {
            delete self.queues[key];
          }
          if (self.domainReentrant) {
            delete self.domains[key];
          }
        }
        if (!resolved) {
          if (!deferred) {
            if (typeof cb === "function") {
              cb(err, ret);
            }
          } else {
            if (err) {
              deferredReject(err);
            } else {
              deferredResolve(ret);
            }
          }
          resolved = true;
        }
        if (locked) {
          if (!!self.queues[key] && self.queues[key].length > 0) {
            self.queues[key].shift()();
          }
        }
      };
      var exec = function(locked) {
        if (resolved) {
          return done(locked);
        }
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        if (self.domainReentrant && locked) {
          self.domains[key] = process.domain;
        }
        var maxExecutionTime = opts.maxExecutionTime || self.maxExecutionTime;
        if (maxExecutionTime) {
          executionTimer = setTimeout(function() {
            if (!!self.queues[key]) {
              done(locked, new Error("Maximum execution time is exceeded " + key));
            }
          }, maxExecutionTime);
        }
        if (fn.length === 1) {
          var called = false;
          try {
            fn(function(err, ret) {
              if (!called) {
                called = true;
                done(locked, err, ret);
              }
            });
          } catch (err) {
            if (!called) {
              called = true;
              done(locked, err);
            }
          }
        } else {
          self._promiseTry(function() {
            return fn();
          }).then(function(ret) {
            done(locked, void 0, ret);
          }, function(error) {
            done(locked, error);
          });
        }
      };
      if (self.domainReentrant && !!process.domain) {
        exec = process.domain.bind(exec);
      }
      var maxPending = opts.maxPending || self.maxPending;
      if (!self.queues[key]) {
        self.queues[key] = [];
        exec(true);
      } else if (self.domainReentrant && !!process.domain && process.domain === self.domains[key]) {
        exec(false);
      } else if (self.queues[key].length >= maxPending) {
        done(false, new Error("Too many pending tasks in queue " + key));
      } else {
        var taskFn = function() {
          exec(true);
        };
        if (opts.skipQueue) {
          self.queues[key].unshift(taskFn);
        } else {
          self.queues[key].push(taskFn);
        }
        var timeout = opts.timeout || self.timeout;
        if (timeout) {
          timer = setTimeout(function() {
            timer = null;
            done(false, new Error("async-lock timed out in queue " + key));
          }, timeout);
        }
      }
      var maxOccupationTime = opts.maxOccupationTime || self.maxOccupationTime;
      if (maxOccupationTime) {
        occupationTimer = setTimeout(function() {
          if (!!self.queues[key]) {
            done(false, new Error("Maximum occupation time is exceeded in queue " + key));
          }
        }, maxOccupationTime);
      }
      if (deferred) {
        return deferred;
      }
    };
    AsyncLock2.prototype._acquireBatch = function(keys, fn, cb, opts) {
      if (typeof cb !== "function") {
        opts = cb;
        cb = null;
      }
      var self = this;
      var getFn = function(key, fn2) {
        return function(cb2) {
          self.acquire(key, fn2, cb2, opts);
        };
      };
      var fnx = keys.reduceRight(function(prev, key) {
        return getFn(key, prev);
      }, fn);
      if (typeof cb === "function") {
        fnx(cb);
      } else {
        return new this.Promise(function(resolve, reject) {
          if (fnx.length === 1) {
            fnx(function(err, ret) {
              if (err) {
                reject(err);
              } else {
                resolve(ret);
              }
            });
          } else {
            resolve(fnx());
          }
        });
      }
    };
    AsyncLock2.prototype.isBusy = function(key) {
      if (!key) {
        return Object.keys(this.queues).length > 0;
      } else {
        return !!this.queues[key];
      }
    };
    AsyncLock2.prototype._promiseTry = function(fn) {
      try {
        return this.Promise.resolve(fn());
      } catch (e) {
        return this.Promise.reject(e);
      }
    };
    module2.exports = AsyncLock2;
  }
});

// node_modules/async-lock/index.js
var require_async_lock = __commonJS({
  "node_modules/async-lock/index.js"(exports, module2) {
    "use strict";
    module2.exports = require_lib();
  }
});

// node_modules/inherits/inherits_browser.js
var require_inherits_browser = __commonJS({
  "node_modules/inherits/inherits_browser.js"(exports, module2) {
    if (typeof Object.create === "function") {
      module2.exports = function inherits(ctor, superCtor) {
        if (superCtor) {
          ctor.super_ = superCtor;
          ctor.prototype = Object.create(superCtor.prototype, {
            constructor: {
              value: ctor,
              enumerable: false,
              writable: true,
              configurable: true
            }
          });
        }
      };
    } else {
      module2.exports = function inherits(ctor, superCtor) {
        if (superCtor) {
          ctor.super_ = superCtor;
          var TempCtor = function() {
          };
          TempCtor.prototype = superCtor.prototype;
          ctor.prototype = new TempCtor();
          ctor.prototype.constructor = ctor;
        }
      };
    }
  }
});

// node_modules/safe-buffer/index.js
var require_safe_buffer = __commonJS({
  "node_modules/safe-buffer/index.js"(exports, module2) {
    var buffer = require("buffer");
    var Buffer2 = buffer.Buffer;
    function copyProps(src, dst) {
      for (var key in src) {
        dst[key] = src[key];
      }
    }
    if (Buffer2.from && Buffer2.alloc && Buffer2.allocUnsafe && Buffer2.allocUnsafeSlow) {
      module2.exports = buffer;
    } else {
      copyProps(buffer, exports);
      exports.Buffer = SafeBuffer;
    }
    function SafeBuffer(arg, encodingOrOffset, length) {
      return Buffer2(arg, encodingOrOffset, length);
    }
    SafeBuffer.prototype = Object.create(Buffer2.prototype);
    copyProps(Buffer2, SafeBuffer);
    SafeBuffer.from = function(arg, encodingOrOffset, length) {
      if (typeof arg === "number") {
        throw new TypeError("Argument must not be a number");
      }
      return Buffer2(arg, encodingOrOffset, length);
    };
    SafeBuffer.alloc = function(size, fill, encoding) {
      if (typeof size !== "number") {
        throw new TypeError("Argument must be a number");
      }
      var buf = Buffer2(size);
      if (fill !== void 0) {
        if (typeof encoding === "string") {
          buf.fill(fill, encoding);
        } else {
          buf.fill(fill);
        }
      } else {
        buf.fill(0);
      }
      return buf;
    };
    SafeBuffer.allocUnsafe = function(size) {
      if (typeof size !== "number") {
        throw new TypeError("Argument must be a number");
      }
      return Buffer2(size);
    };
    SafeBuffer.allocUnsafeSlow = function(size) {
      if (typeof size !== "number") {
        throw new TypeError("Argument must be a number");
      }
      return buffer.SlowBuffer(size);
    };
  }
});

// node_modules/isarray/index.js
var require_isarray = __commonJS({
  "node_modules/isarray/index.js"(exports, module2) {
    var toString = {}.toString;
    module2.exports = Array.isArray || function(arr) {
      return toString.call(arr) == "[object Array]";
    };
  }
});

// node_modules/es-errors/type.js
var require_type = __commonJS({
  "node_modules/es-errors/type.js"(exports, module2) {
    "use strict";
    module2.exports = TypeError;
  }
});

// node_modules/es-object-atoms/index.js
var require_es_object_atoms = __commonJS({
  "node_modules/es-object-atoms/index.js"(exports, module2) {
    "use strict";
    module2.exports = Object;
  }
});

// node_modules/es-errors/index.js
var require_es_errors = __commonJS({
  "node_modules/es-errors/index.js"(exports, module2) {
    "use strict";
    module2.exports = Error;
  }
});

// node_modules/es-errors/eval.js
var require_eval = __commonJS({
  "node_modules/es-errors/eval.js"(exports, module2) {
    "use strict";
    module2.exports = EvalError;
  }
});

// node_modules/es-errors/range.js
var require_range = __commonJS({
  "node_modules/es-errors/range.js"(exports, module2) {
    "use strict";
    module2.exports = RangeError;
  }
});

// node_modules/es-errors/ref.js
var require_ref = __commonJS({
  "node_modules/es-errors/ref.js"(exports, module2) {
    "use strict";
    module2.exports = ReferenceError;
  }
});

// node_modules/es-errors/syntax.js
var require_syntax = __commonJS({
  "node_modules/es-errors/syntax.js"(exports, module2) {
    "use strict";
    module2.exports = SyntaxError;
  }
});

// node_modules/es-errors/uri.js
var require_uri = __commonJS({
  "node_modules/es-errors/uri.js"(exports, module2) {
    "use strict";
    module2.exports = URIError;
  }
});

// node_modules/math-intrinsics/abs.js
var require_abs = __commonJS({
  "node_modules/math-intrinsics/abs.js"(exports, module2) {
    "use strict";
    module2.exports = Math.abs;
  }
});

// node_modules/math-intrinsics/floor.js
var require_floor = __commonJS({
  "node_modules/math-intrinsics/floor.js"(exports, module2) {
    "use strict";
    module2.exports = Math.floor;
  }
});

// node_modules/math-intrinsics/max.js
var require_max = __commonJS({
  "node_modules/math-intrinsics/max.js"(exports, module2) {
    "use strict";
    module2.exports = Math.max;
  }
});

// node_modules/math-intrinsics/min.js
var require_min = __commonJS({
  "node_modules/math-intrinsics/min.js"(exports, module2) {
    "use strict";
    module2.exports = Math.min;
  }
});

// node_modules/math-intrinsics/pow.js
var require_pow = __commonJS({
  "node_modules/math-intrinsics/pow.js"(exports, module2) {
    "use strict";
    module2.exports = Math.pow;
  }
});

// node_modules/math-intrinsics/round.js
var require_round = __commonJS({
  "node_modules/math-intrinsics/round.js"(exports, module2) {
    "use strict";
    module2.exports = Math.round;
  }
});

// node_modules/math-intrinsics/isNaN.js
var require_isNaN = __commonJS({
  "node_modules/math-intrinsics/isNaN.js"(exports, module2) {
    "use strict";
    module2.exports = Number.isNaN || function isNaN2(a) {
      return a !== a;
    };
  }
});

// node_modules/math-intrinsics/sign.js
var require_sign = __commonJS({
  "node_modules/math-intrinsics/sign.js"(exports, module2) {
    "use strict";
    var $isNaN = require_isNaN();
    module2.exports = function sign(number) {
      if ($isNaN(number) || number === 0) {
        return number;
      }
      return number < 0 ? -1 : 1;
    };
  }
});

// node_modules/gopd/gOPD.js
var require_gOPD = __commonJS({
  "node_modules/gopd/gOPD.js"(exports, module2) {
    "use strict";
    module2.exports = Object.getOwnPropertyDescriptor;
  }
});

// node_modules/gopd/index.js
var require_gopd = __commonJS({
  "node_modules/gopd/index.js"(exports, module2) {
    "use strict";
    var $gOPD = require_gOPD();
    if ($gOPD) {
      try {
        $gOPD([], "length");
      } catch (e) {
        $gOPD = null;
      }
    }
    module2.exports = $gOPD;
  }
});

// node_modules/es-define-property/index.js
var require_es_define_property = __commonJS({
  "node_modules/es-define-property/index.js"(exports, module2) {
    "use strict";
    var $defineProperty = Object.defineProperty || false;
    if ($defineProperty) {
      try {
        $defineProperty({}, "a", { value: 1 });
      } catch (e) {
        $defineProperty = false;
      }
    }
    module2.exports = $defineProperty;
  }
});

// node_modules/has-symbols/shams.js
var require_shams = __commonJS({
  "node_modules/has-symbols/shams.js"(exports, module2) {
    "use strict";
    module2.exports = function hasSymbols() {
      if (typeof Symbol !== "function" || typeof Object.getOwnPropertySymbols !== "function") {
        return false;
      }
      if (typeof Symbol.iterator === "symbol") {
        return true;
      }
      var obj = {};
      var sym = Symbol("test");
      var symObj = Object(sym);
      if (typeof sym === "string") {
        return false;
      }
      if (Object.prototype.toString.call(sym) !== "[object Symbol]") {
        return false;
      }
      if (Object.prototype.toString.call(symObj) !== "[object Symbol]") {
        return false;
      }
      var symVal = 42;
      obj[sym] = symVal;
      for (var _ in obj) {
        return false;
      }
      if (typeof Object.keys === "function" && Object.keys(obj).length !== 0) {
        return false;
      }
      if (typeof Object.getOwnPropertyNames === "function" && Object.getOwnPropertyNames(obj).length !== 0) {
        return false;
      }
      var syms = Object.getOwnPropertySymbols(obj);
      if (syms.length !== 1 || syms[0] !== sym) {
        return false;
      }
      if (!Object.prototype.propertyIsEnumerable.call(obj, sym)) {
        return false;
      }
      if (typeof Object.getOwnPropertyDescriptor === "function") {
        var descriptor = (
          /** @type {PropertyDescriptor} */
          Object.getOwnPropertyDescriptor(obj, sym)
        );
        if (descriptor.value !== symVal || descriptor.enumerable !== true) {
          return false;
        }
      }
      return true;
    };
  }
});

// node_modules/has-symbols/index.js
var require_has_symbols = __commonJS({
  "node_modules/has-symbols/index.js"(exports, module2) {
    "use strict";
    var origSymbol = typeof Symbol !== "undefined" && Symbol;
    var hasSymbolSham = require_shams();
    module2.exports = function hasNativeSymbols() {
      if (typeof origSymbol !== "function") {
        return false;
      }
      if (typeof Symbol !== "function") {
        return false;
      }
      if (typeof origSymbol("foo") !== "symbol") {
        return false;
      }
      if (typeof Symbol("bar") !== "symbol") {
        return false;
      }
      return hasSymbolSham();
    };
  }
});

// node_modules/get-proto/Reflect.getPrototypeOf.js
var require_Reflect_getPrototypeOf = __commonJS({
  "node_modules/get-proto/Reflect.getPrototypeOf.js"(exports, module2) {
    "use strict";
    module2.exports = typeof Reflect !== "undefined" && Reflect.getPrototypeOf || null;
  }
});

// node_modules/get-proto/Object.getPrototypeOf.js
var require_Object_getPrototypeOf = __commonJS({
  "node_modules/get-proto/Object.getPrototypeOf.js"(exports, module2) {
    "use strict";
    var $Object = require_es_object_atoms();
    module2.exports = $Object.getPrototypeOf || null;
  }
});

// node_modules/function-bind/implementation.js
var require_implementation = __commonJS({
  "node_modules/function-bind/implementation.js"(exports, module2) {
    "use strict";
    var ERROR_MESSAGE = "Function.prototype.bind called on incompatible ";
    var toStr = Object.prototype.toString;
    var max = Math.max;
    var funcType = "[object Function]";
    var concatty = function concatty2(a, b) {
      var arr = [];
      for (var i = 0; i < a.length; i += 1) {
        arr[i] = a[i];
      }
      for (var j = 0; j < b.length; j += 1) {
        arr[j + a.length] = b[j];
      }
      return arr;
    };
    var slicy = function slicy2(arrLike, offset) {
      var arr = [];
      for (var i = offset || 0, j = 0; i < arrLike.length; i += 1, j += 1) {
        arr[j] = arrLike[i];
      }
      return arr;
    };
    var joiny = function(arr, joiner) {
      var str = "";
      for (var i = 0; i < arr.length; i += 1) {
        str += arr[i];
        if (i + 1 < arr.length) {
          str += joiner;
        }
      }
      return str;
    };
    module2.exports = function bind(that) {
      var target = this;
      if (typeof target !== "function" || toStr.apply(target) !== funcType) {
        throw new TypeError(ERROR_MESSAGE + target);
      }
      var args = slicy(arguments, 1);
      var bound;
      var binder = function() {
        if (this instanceof bound) {
          var result = target.apply(
            this,
            concatty(args, arguments)
          );
          if (Object(result) === result) {
            return result;
          }
          return this;
        }
        return target.apply(
          that,
          concatty(args, arguments)
        );
      };
      var boundLength = max(0, target.length - args.length);
      var boundArgs = [];
      for (var i = 0; i < boundLength; i++) {
        boundArgs[i] = "$" + i;
      }
      bound = Function("binder", "return function (" + joiny(boundArgs, ",") + "){ return binder.apply(this,arguments); }")(binder);
      if (target.prototype) {
        var Empty = function Empty2() {
        };
        Empty.prototype = target.prototype;
        bound.prototype = new Empty();
        Empty.prototype = null;
      }
      return bound;
    };
  }
});

// node_modules/function-bind/index.js
var require_function_bind = __commonJS({
  "node_modules/function-bind/index.js"(exports, module2) {
    "use strict";
    var implementation = require_implementation();
    module2.exports = Function.prototype.bind || implementation;
  }
});

// node_modules/call-bind-apply-helpers/functionCall.js
var require_functionCall = __commonJS({
  "node_modules/call-bind-apply-helpers/functionCall.js"(exports, module2) {
    "use strict";
    module2.exports = Function.prototype.call;
  }
});

// node_modules/call-bind-apply-helpers/functionApply.js
var require_functionApply = __commonJS({
  "node_modules/call-bind-apply-helpers/functionApply.js"(exports, module2) {
    "use strict";
    module2.exports = Function.prototype.apply;
  }
});

// node_modules/call-bind-apply-helpers/reflectApply.js
var require_reflectApply = __commonJS({
  "node_modules/call-bind-apply-helpers/reflectApply.js"(exports, module2) {
    "use strict";
    module2.exports = typeof Reflect !== "undefined" && Reflect && Reflect.apply;
  }
});

// node_modules/call-bind-apply-helpers/actualApply.js
var require_actualApply = __commonJS({
  "node_modules/call-bind-apply-helpers/actualApply.js"(exports, module2) {
    "use strict";
    var bind = require_function_bind();
    var $apply = require_functionApply();
    var $call = require_functionCall();
    var $reflectApply = require_reflectApply();
    module2.exports = $reflectApply || bind.call($call, $apply);
  }
});

// node_modules/call-bind-apply-helpers/index.js
var require_call_bind_apply_helpers = __commonJS({
  "node_modules/call-bind-apply-helpers/index.js"(exports, module2) {
    "use strict";
    var bind = require_function_bind();
    var $TypeError = require_type();
    var $call = require_functionCall();
    var $actualApply = require_actualApply();
    module2.exports = function callBindBasic(args) {
      if (args.length < 1 || typeof args[0] !== "function") {
        throw new $TypeError("a function is required");
      }
      return $actualApply(bind, $call, args);
    };
  }
});

// node_modules/dunder-proto/get.js
var require_get = __commonJS({
  "node_modules/dunder-proto/get.js"(exports, module2) {
    "use strict";
    var callBind = require_call_bind_apply_helpers();
    var gOPD = require_gopd();
    var hasProtoAccessor;
    try {
      hasProtoAccessor = /** @type {{ __proto__?: typeof Array.prototype }} */
      [].__proto__ === Array.prototype;
    } catch (e) {
      if (!e || typeof e !== "object" || !("code" in e) || e.code !== "ERR_PROTO_ACCESS") {
        throw e;
      }
    }
    var desc = !!hasProtoAccessor && gOPD && gOPD(
      Object.prototype,
      /** @type {keyof typeof Object.prototype} */
      "__proto__"
    );
    var $Object = Object;
    var $getPrototypeOf = $Object.getPrototypeOf;
    module2.exports = desc && typeof desc.get === "function" ? callBind([desc.get]) : typeof $getPrototypeOf === "function" ? (
      /** @type {import('./get')} */
      function getDunder(value) {
        return $getPrototypeOf(value == null ? value : $Object(value));
      }
    ) : false;
  }
});

// node_modules/get-proto/index.js
var require_get_proto = __commonJS({
  "node_modules/get-proto/index.js"(exports, module2) {
    "use strict";
    var reflectGetProto = require_Reflect_getPrototypeOf();
    var originalGetProto = require_Object_getPrototypeOf();
    var getDunderProto = require_get();
    module2.exports = reflectGetProto ? function getProto(O) {
      return reflectGetProto(O);
    } : originalGetProto ? function getProto(O) {
      if (!O || typeof O !== "object" && typeof O !== "function") {
        throw new TypeError("getProto: not an object");
      }
      return originalGetProto(O);
    } : getDunderProto ? function getProto(O) {
      return getDunderProto(O);
    } : null;
  }
});

// node_modules/hasown/index.js
var require_hasown = __commonJS({
  "node_modules/hasown/index.js"(exports, module2) {
    "use strict";
    var call = Function.prototype.call;
    var $hasOwn = Object.prototype.hasOwnProperty;
    var bind = require_function_bind();
    module2.exports = bind.call(call, $hasOwn);
  }
});

// node_modules/get-intrinsic/index.js
var require_get_intrinsic = __commonJS({
  "node_modules/get-intrinsic/index.js"(exports, module2) {
    "use strict";
    var undefined2;
    var $Object = require_es_object_atoms();
    var $Error = require_es_errors();
    var $EvalError = require_eval();
    var $RangeError = require_range();
    var $ReferenceError = require_ref();
    var $SyntaxError = require_syntax();
    var $TypeError = require_type();
    var $URIError = require_uri();
    var abs = require_abs();
    var floor = require_floor();
    var max = require_max();
    var min = require_min();
    var pow = require_pow();
    var round = require_round();
    var sign = require_sign();
    var $Function = Function;
    var getEvalledConstructor = function(expressionSyntax) {
      try {
        return $Function('"use strict"; return (' + expressionSyntax + ").constructor;")();
      } catch (e) {
      }
    };
    var $gOPD = require_gopd();
    var $defineProperty = require_es_define_property();
    var throwTypeError = function() {
      throw new $TypeError();
    };
    var ThrowTypeError = $gOPD ? function() {
      try {
        arguments.callee;
        return throwTypeError;
      } catch (calleeThrows) {
        try {
          return $gOPD(arguments, "callee").get;
        } catch (gOPDthrows) {
          return throwTypeError;
        }
      }
    }() : throwTypeError;
    var hasSymbols = require_has_symbols()();
    var getProto = require_get_proto();
    var $ObjectGPO = require_Object_getPrototypeOf();
    var $ReflectGPO = require_Reflect_getPrototypeOf();
    var $apply = require_functionApply();
    var $call = require_functionCall();
    var needsEval = {};
    var TypedArray = typeof Uint8Array === "undefined" || !getProto ? undefined2 : getProto(Uint8Array);
    var INTRINSICS = {
      __proto__: null,
      "%AggregateError%": typeof AggregateError === "undefined" ? undefined2 : AggregateError,
      "%Array%": Array,
      "%ArrayBuffer%": typeof ArrayBuffer === "undefined" ? undefined2 : ArrayBuffer,
      "%ArrayIteratorPrototype%": hasSymbols && getProto ? getProto([][Symbol.iterator]()) : undefined2,
      "%AsyncFromSyncIteratorPrototype%": undefined2,
      "%AsyncFunction%": needsEval,
      "%AsyncGenerator%": needsEval,
      "%AsyncGeneratorFunction%": needsEval,
      "%AsyncIteratorPrototype%": needsEval,
      "%Atomics%": typeof Atomics === "undefined" ? undefined2 : Atomics,
      "%BigInt%": typeof BigInt === "undefined" ? undefined2 : BigInt,
      "%BigInt64Array%": typeof BigInt64Array === "undefined" ? undefined2 : BigInt64Array,
      "%BigUint64Array%": typeof BigUint64Array === "undefined" ? undefined2 : BigUint64Array,
      "%Boolean%": Boolean,
      "%DataView%": typeof DataView === "undefined" ? undefined2 : DataView,
      "%Date%": Date,
      "%decodeURI%": decodeURI,
      "%decodeURIComponent%": decodeURIComponent,
      "%encodeURI%": encodeURI,
      "%encodeURIComponent%": encodeURIComponent,
      "%Error%": $Error,
      "%eval%": eval,
      // eslint-disable-line no-eval
      "%EvalError%": $EvalError,
      "%Float16Array%": typeof Float16Array === "undefined" ? undefined2 : Float16Array,
      "%Float32Array%": typeof Float32Array === "undefined" ? undefined2 : Float32Array,
      "%Float64Array%": typeof Float64Array === "undefined" ? undefined2 : Float64Array,
      "%FinalizationRegistry%": typeof FinalizationRegistry === "undefined" ? undefined2 : FinalizationRegistry,
      "%Function%": $Function,
      "%GeneratorFunction%": needsEval,
      "%Int8Array%": typeof Int8Array === "undefined" ? undefined2 : Int8Array,
      "%Int16Array%": typeof Int16Array === "undefined" ? undefined2 : Int16Array,
      "%Int32Array%": typeof Int32Array === "undefined" ? undefined2 : Int32Array,
      "%isFinite%": isFinite,
      "%isNaN%": isNaN,
      "%IteratorPrototype%": hasSymbols && getProto ? getProto(getProto([][Symbol.iterator]())) : undefined2,
      "%JSON%": typeof JSON === "object" ? JSON : undefined2,
      "%Map%": typeof Map === "undefined" ? undefined2 : Map,
      "%MapIteratorPrototype%": typeof Map === "undefined" || !hasSymbols || !getProto ? undefined2 : getProto((/* @__PURE__ */ new Map())[Symbol.iterator]()),
      "%Math%": Math,
      "%Number%": Number,
      "%Object%": $Object,
      "%Object.getOwnPropertyDescriptor%": $gOPD,
      "%parseFloat%": parseFloat,
      "%parseInt%": parseInt,
      "%Promise%": typeof Promise === "undefined" ? undefined2 : Promise,
      "%Proxy%": typeof Proxy === "undefined" ? undefined2 : Proxy,
      "%RangeError%": $RangeError,
      "%ReferenceError%": $ReferenceError,
      "%Reflect%": typeof Reflect === "undefined" ? undefined2 : Reflect,
      "%RegExp%": RegExp,
      "%Set%": typeof Set === "undefined" ? undefined2 : Set,
      "%SetIteratorPrototype%": typeof Set === "undefined" || !hasSymbols || !getProto ? undefined2 : getProto((/* @__PURE__ */ new Set())[Symbol.iterator]()),
      "%SharedArrayBuffer%": typeof SharedArrayBuffer === "undefined" ? undefined2 : SharedArrayBuffer,
      "%String%": String,
      "%StringIteratorPrototype%": hasSymbols && getProto ? getProto(""[Symbol.iterator]()) : undefined2,
      "%Symbol%": hasSymbols ? Symbol : undefined2,
      "%SyntaxError%": $SyntaxError,
      "%ThrowTypeError%": ThrowTypeError,
      "%TypedArray%": TypedArray,
      "%TypeError%": $TypeError,
      "%Uint8Array%": typeof Uint8Array === "undefined" ? undefined2 : Uint8Array,
      "%Uint8ClampedArray%": typeof Uint8ClampedArray === "undefined" ? undefined2 : Uint8ClampedArray,
      "%Uint16Array%": typeof Uint16Array === "undefined" ? undefined2 : Uint16Array,
      "%Uint32Array%": typeof Uint32Array === "undefined" ? undefined2 : Uint32Array,
      "%URIError%": $URIError,
      "%WeakMap%": typeof WeakMap === "undefined" ? undefined2 : WeakMap,
      "%WeakRef%": typeof WeakRef === "undefined" ? undefined2 : WeakRef,
      "%WeakSet%": typeof WeakSet === "undefined" ? undefined2 : WeakSet,
      "%Function.prototype.call%": $call,
      "%Function.prototype.apply%": $apply,
      "%Object.defineProperty%": $defineProperty,
      "%Object.getPrototypeOf%": $ObjectGPO,
      "%Math.abs%": abs,
      "%Math.floor%": floor,
      "%Math.max%": max,
      "%Math.min%": min,
      "%Math.pow%": pow,
      "%Math.round%": round,
      "%Math.sign%": sign,
      "%Reflect.getPrototypeOf%": $ReflectGPO
    };
    if (getProto) {
      try {
        null.error;
      } catch (e) {
        errorProto = getProto(getProto(e));
        INTRINSICS["%Error.prototype%"] = errorProto;
      }
    }
    var errorProto;
    var doEval = function doEval2(name2) {
      var value;
      if (name2 === "%AsyncFunction%") {
        value = getEvalledConstructor("async function () {}");
      } else if (name2 === "%GeneratorFunction%") {
        value = getEvalledConstructor("function* () {}");
      } else if (name2 === "%AsyncGeneratorFunction%") {
        value = getEvalledConstructor("async function* () {}");
      } else if (name2 === "%AsyncGenerator%") {
        var fn = doEval2("%AsyncGeneratorFunction%");
        if (fn) {
          value = fn.prototype;
        }
      } else if (name2 === "%AsyncIteratorPrototype%") {
        var gen = doEval2("%AsyncGenerator%");
        if (gen && getProto) {
          value = getProto(gen.prototype);
        }
      }
      INTRINSICS[name2] = value;
      return value;
    };
    var LEGACY_ALIASES = {
      __proto__: null,
      "%ArrayBufferPrototype%": ["ArrayBuffer", "prototype"],
      "%ArrayPrototype%": ["Array", "prototype"],
      "%ArrayProto_entries%": ["Array", "prototype", "entries"],
      "%ArrayProto_forEach%": ["Array", "prototype", "forEach"],
      "%ArrayProto_keys%": ["Array", "prototype", "keys"],
      "%ArrayProto_values%": ["Array", "prototype", "values"],
      "%AsyncFunctionPrototype%": ["AsyncFunction", "prototype"],
      "%AsyncGenerator%": ["AsyncGeneratorFunction", "prototype"],
      "%AsyncGeneratorPrototype%": ["AsyncGeneratorFunction", "prototype", "prototype"],
      "%BooleanPrototype%": ["Boolean", "prototype"],
      "%DataViewPrototype%": ["DataView", "prototype"],
      "%DatePrototype%": ["Date", "prototype"],
      "%ErrorPrototype%": ["Error", "prototype"],
      "%EvalErrorPrototype%": ["EvalError", "prototype"],
      "%Float32ArrayPrototype%": ["Float32Array", "prototype"],
      "%Float64ArrayPrototype%": ["Float64Array", "prototype"],
      "%FunctionPrototype%": ["Function", "prototype"],
      "%Generator%": ["GeneratorFunction", "prototype"],
      "%GeneratorPrototype%": ["GeneratorFunction", "prototype", "prototype"],
      "%Int8ArrayPrototype%": ["Int8Array", "prototype"],
      "%Int16ArrayPrototype%": ["Int16Array", "prototype"],
      "%Int32ArrayPrototype%": ["Int32Array", "prototype"],
      "%JSONParse%": ["JSON", "parse"],
      "%JSONStringify%": ["JSON", "stringify"],
      "%MapPrototype%": ["Map", "prototype"],
      "%NumberPrototype%": ["Number", "prototype"],
      "%ObjectPrototype%": ["Object", "prototype"],
      "%ObjProto_toString%": ["Object", "prototype", "toString"],
      "%ObjProto_valueOf%": ["Object", "prototype", "valueOf"],
      "%PromisePrototype%": ["Promise", "prototype"],
      "%PromiseProto_then%": ["Promise", "prototype", "then"],
      "%Promise_all%": ["Promise", "all"],
      "%Promise_reject%": ["Promise", "reject"],
      "%Promise_resolve%": ["Promise", "resolve"],
      "%RangeErrorPrototype%": ["RangeError", "prototype"],
      "%ReferenceErrorPrototype%": ["ReferenceError", "prototype"],
      "%RegExpPrototype%": ["RegExp", "prototype"],
      "%SetPrototype%": ["Set", "prototype"],
      "%SharedArrayBufferPrototype%": ["SharedArrayBuffer", "prototype"],
      "%StringPrototype%": ["String", "prototype"],
      "%SymbolPrototype%": ["Symbol", "prototype"],
      "%SyntaxErrorPrototype%": ["SyntaxError", "prototype"],
      "%TypedArrayPrototype%": ["TypedArray", "prototype"],
      "%TypeErrorPrototype%": ["TypeError", "prototype"],
      "%Uint8ArrayPrototype%": ["Uint8Array", "prototype"],
      "%Uint8ClampedArrayPrototype%": ["Uint8ClampedArray", "prototype"],
      "%Uint16ArrayPrototype%": ["Uint16Array", "prototype"],
      "%Uint32ArrayPrototype%": ["Uint32Array", "prototype"],
      "%URIErrorPrototype%": ["URIError", "prototype"],
      "%WeakMapPrototype%": ["WeakMap", "prototype"],
      "%WeakSetPrototype%": ["WeakSet", "prototype"]
    };
    var bind = require_function_bind();
    var hasOwn = require_hasown();
    var $concat = bind.call($call, Array.prototype.concat);
    var $spliceApply = bind.call($apply, Array.prototype.splice);
    var $replace = bind.call($call, String.prototype.replace);
    var $strSlice = bind.call($call, String.prototype.slice);
    var $exec = bind.call($call, RegExp.prototype.exec);
    var rePropName = /[^%.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|%$))/g;
    var reEscapeChar = /\\(\\)?/g;
    var stringToPath = function stringToPath2(string) {
      var first = $strSlice(string, 0, 1);
      var last = $strSlice(string, -1);
      if (first === "%" && last !== "%") {
        throw new $SyntaxError("invalid intrinsic syntax, expected closing `%`");
      } else if (last === "%" && first !== "%") {
        throw new $SyntaxError("invalid intrinsic syntax, expected opening `%`");
      }
      var result = [];
      $replace(string, rePropName, function(match, number, quote, subString) {
        result[result.length] = quote ? $replace(subString, reEscapeChar, "$1") : number || match;
      });
      return result;
    };
    var getBaseIntrinsic = function getBaseIntrinsic2(name2, allowMissing) {
      var intrinsicName = name2;
      var alias;
      if (hasOwn(LEGACY_ALIASES, intrinsicName)) {
        alias = LEGACY_ALIASES[intrinsicName];
        intrinsicName = "%" + alias[0] + "%";
      }
      if (hasOwn(INTRINSICS, intrinsicName)) {
        var value = INTRINSICS[intrinsicName];
        if (value === needsEval) {
          value = doEval(intrinsicName);
        }
        if (typeof value === "undefined" && !allowMissing) {
          throw new $TypeError("intrinsic " + name2 + " exists, but is not available. Please file an issue!");
        }
        return {
          alias,
          name: intrinsicName,
          value
        };
      }
      throw new $SyntaxError("intrinsic " + name2 + " does not exist!");
    };
    module2.exports = function GetIntrinsic(name2, allowMissing) {
      if (typeof name2 !== "string" || name2.length === 0) {
        throw new $TypeError("intrinsic name must be a non-empty string");
      }
      if (arguments.length > 1 && typeof allowMissing !== "boolean") {
        throw new $TypeError('"allowMissing" argument must be a boolean');
      }
      if ($exec(/^%?[^%]*%?$/, name2) === null) {
        throw new $SyntaxError("`%` may not be present anywhere but at the beginning and end of the intrinsic name");
      }
      var parts = stringToPath(name2);
      var intrinsicBaseName = parts.length > 0 ? parts[0] : "";
      var intrinsic = getBaseIntrinsic("%" + intrinsicBaseName + "%", allowMissing);
      var intrinsicRealName = intrinsic.name;
      var value = intrinsic.value;
      var skipFurtherCaching = false;
      var alias = intrinsic.alias;
      if (alias) {
        intrinsicBaseName = alias[0];
        $spliceApply(parts, $concat([0, 1], alias));
      }
      for (var i = 1, isOwn = true; i < parts.length; i += 1) {
        var part = parts[i];
        var first = $strSlice(part, 0, 1);
        var last = $strSlice(part, -1);
        if ((first === '"' || first === "'" || first === "`" || (last === '"' || last === "'" || last === "`")) && first !== last) {
          throw new $SyntaxError("property names with quotes must have matching quotes");
        }
        if (part === "constructor" || !isOwn) {
          skipFurtherCaching = true;
        }
        intrinsicBaseName += "." + part;
        intrinsicRealName = "%" + intrinsicBaseName + "%";
        if (hasOwn(INTRINSICS, intrinsicRealName)) {
          value = INTRINSICS[intrinsicRealName];
        } else if (value != null) {
          if (!(part in value)) {
            if (!allowMissing) {
              throw new $TypeError("base intrinsic for " + name2 + " exists, but the property is not available.");
            }
            return void 0;
          }
          if ($gOPD && i + 1 >= parts.length) {
            var desc = $gOPD(value, part);
            isOwn = !!desc;
            if (isOwn && "get" in desc && !("originalValue" in desc.get)) {
              value = desc.get;
            } else {
              value = value[part];
            }
          } else {
            isOwn = hasOwn(value, part);
            value = value[part];
          }
          if (isOwn && !skipFurtherCaching) {
            INTRINSICS[intrinsicRealName] = value;
          }
        }
      }
      return value;
    };
  }
});

// node_modules/call-bound/index.js
var require_call_bound = __commonJS({
  "node_modules/call-bound/index.js"(exports, module2) {
    "use strict";
    var GetIntrinsic = require_get_intrinsic();
    var callBindBasic = require_call_bind_apply_helpers();
    var $indexOf = callBindBasic([GetIntrinsic("%String.prototype.indexOf%")]);
    module2.exports = function callBoundIntrinsic(name2, allowMissing) {
      var intrinsic = (
        /** @type {(this: unknown, ...args: unknown[]) => unknown} */
        GetIntrinsic(name2, !!allowMissing)
      );
      if (typeof intrinsic === "function" && $indexOf(name2, ".prototype.") > -1) {
        return callBindBasic(
          /** @type {const} */
          [intrinsic]
        );
      }
      return intrinsic;
    };
  }
});

// node_modules/is-callable/index.js
var require_is_callable = __commonJS({
  "node_modules/is-callable/index.js"(exports, module2) {
    "use strict";
    var fnToStr = Function.prototype.toString;
    var reflectApply = typeof Reflect === "object" && Reflect !== null && Reflect.apply;
    var badArrayLike;
    var isCallableMarker;
    if (typeof reflectApply === "function" && typeof Object.defineProperty === "function") {
      try {
        badArrayLike = Object.defineProperty({}, "length", {
          get: function() {
            throw isCallableMarker;
          }
        });
        isCallableMarker = {};
        reflectApply(function() {
          throw 42;
        }, null, badArrayLike);
      } catch (_) {
        if (_ !== isCallableMarker) {
          reflectApply = null;
        }
      }
    } else {
      reflectApply = null;
    }
    var constructorRegex = /^\s*class\b/;
    var isES6ClassFn = function isES6ClassFunction(value) {
      try {
        var fnStr = fnToStr.call(value);
        return constructorRegex.test(fnStr);
      } catch (e) {
        return false;
      }
    };
    var tryFunctionObject = function tryFunctionToStr(value) {
      try {
        if (isES6ClassFn(value)) {
          return false;
        }
        fnToStr.call(value);
        return true;
      } catch (e) {
        return false;
      }
    };
    var toStr = Object.prototype.toString;
    var objectClass = "[object Object]";
    var fnClass = "[object Function]";
    var genClass = "[object GeneratorFunction]";
    var ddaClass = "[object HTMLAllCollection]";
    var ddaClass2 = "[object HTML document.all class]";
    var ddaClass3 = "[object HTMLCollection]";
    var hasToStringTag = typeof Symbol === "function" && !!Symbol.toStringTag;
    var isIE68 = !(0 in [,]);
    var isDDA = function isDocumentDotAll() {
      return false;
    };
    if (typeof document === "object") {
      all = document.all;
      if (toStr.call(all) === toStr.call(document.all)) {
        isDDA = function isDocumentDotAll(value) {
          if ((isIE68 || !value) && (typeof value === "undefined" || typeof value === "object")) {
            try {
              var str = toStr.call(value);
              return (str === ddaClass || str === ddaClass2 || str === ddaClass3 || str === objectClass) && value("") == null;
            } catch (e) {
            }
          }
          return false;
        };
      }
    }
    var all;
    module2.exports = reflectApply ? function isCallable(value) {
      if (isDDA(value)) {
        return true;
      }
      if (!value) {
        return false;
      }
      if (typeof value !== "function" && typeof value !== "object") {
        return false;
      }
      try {
        reflectApply(value, null, badArrayLike);
      } catch (e) {
        if (e !== isCallableMarker) {
          return false;
        }
      }
      return !isES6ClassFn(value) && tryFunctionObject(value);
    } : function isCallable(value) {
      if (isDDA(value)) {
        return true;
      }
      if (!value) {
        return false;
      }
      if (typeof value !== "function" && typeof value !== "object") {
        return false;
      }
      if (hasToStringTag) {
        return tryFunctionObject(value);
      }
      if (isES6ClassFn(value)) {
        return false;
      }
      var strClass = toStr.call(value);
      if (strClass !== fnClass && strClass !== genClass && !/^\[object HTML/.test(strClass)) {
        return false;
      }
      return tryFunctionObject(value);
    };
  }
});

// node_modules/for-each/index.js
var require_for_each = __commonJS({
  "node_modules/for-each/index.js"(exports, module2) {
    "use strict";
    var isCallable = require_is_callable();
    var toStr = Object.prototype.toString;
    var hasOwnProperty = Object.prototype.hasOwnProperty;
    var forEachArray = function forEachArray2(array, iterator, receiver) {
      for (var i = 0, len = array.length; i < len; i++) {
        if (hasOwnProperty.call(array, i)) {
          if (receiver == null) {
            iterator(array[i], i, array);
          } else {
            iterator.call(receiver, array[i], i, array);
          }
        }
      }
    };
    var forEachString = function forEachString2(string, iterator, receiver) {
      for (var i = 0, len = string.length; i < len; i++) {
        if (receiver == null) {
          iterator(string.charAt(i), i, string);
        } else {
          iterator.call(receiver, string.charAt(i), i, string);
        }
      }
    };
    var forEachObject = function forEachObject2(object, iterator, receiver) {
      for (var k in object) {
        if (hasOwnProperty.call(object, k)) {
          if (receiver == null) {
            iterator(object[k], k, object);
          } else {
            iterator.call(receiver, object[k], k, object);
          }
        }
      }
    };
    function isArray(x) {
      return toStr.call(x) === "[object Array]";
    }
    module2.exports = function forEach(list, iterator, thisArg) {
      if (!isCallable(iterator)) {
        throw new TypeError("iterator must be a function");
      }
      var receiver;
      if (arguments.length >= 3) {
        receiver = thisArg;
      }
      if (isArray(list)) {
        forEachArray(list, iterator, receiver);
      } else if (typeof list === "string") {
        forEachString(list, iterator, receiver);
      } else {
        forEachObject(list, iterator, receiver);
      }
    };
  }
});

// node_modules/possible-typed-array-names/index.js
var require_possible_typed_array_names = __commonJS({
  "node_modules/possible-typed-array-names/index.js"(exports, module2) {
    "use strict";
    module2.exports = [
      "Float16Array",
      "Float32Array",
      "Float64Array",
      "Int8Array",
      "Int16Array",
      "Int32Array",
      "Uint8Array",
      "Uint8ClampedArray",
      "Uint16Array",
      "Uint32Array",
      "BigInt64Array",
      "BigUint64Array"
    ];
  }
});

// node_modules/available-typed-arrays/index.js
var require_available_typed_arrays = __commonJS({
  "node_modules/available-typed-arrays/index.js"(exports, module2) {
    "use strict";
    var possibleNames = require_possible_typed_array_names();
    var g = typeof globalThis === "undefined" ? global : globalThis;
    module2.exports = function availableTypedArrays() {
      var out = [];
      for (var i = 0; i < possibleNames.length; i++) {
        if (typeof g[possibleNames[i]] === "function") {
          out[out.length] = possibleNames[i];
        }
      }
      return out;
    };
  }
});

// node_modules/define-data-property/index.js
var require_define_data_property = __commonJS({
  "node_modules/define-data-property/index.js"(exports, module2) {
    "use strict";
    var $defineProperty = require_es_define_property();
    var $SyntaxError = require_syntax();
    var $TypeError = require_type();
    var gopd = require_gopd();
    module2.exports = function defineDataProperty(obj, property, value) {
      if (!obj || typeof obj !== "object" && typeof obj !== "function") {
        throw new $TypeError("`obj` must be an object or a function`");
      }
      if (typeof property !== "string" && typeof property !== "symbol") {
        throw new $TypeError("`property` must be a string or a symbol`");
      }
      if (arguments.length > 3 && typeof arguments[3] !== "boolean" && arguments[3] !== null) {
        throw new $TypeError("`nonEnumerable`, if provided, must be a boolean or null");
      }
      if (arguments.length > 4 && typeof arguments[4] !== "boolean" && arguments[4] !== null) {
        throw new $TypeError("`nonWritable`, if provided, must be a boolean or null");
      }
      if (arguments.length > 5 && typeof arguments[5] !== "boolean" && arguments[5] !== null) {
        throw new $TypeError("`nonConfigurable`, if provided, must be a boolean or null");
      }
      if (arguments.length > 6 && typeof arguments[6] !== "boolean") {
        throw new $TypeError("`loose`, if provided, must be a boolean");
      }
      var nonEnumerable = arguments.length > 3 ? arguments[3] : null;
      var nonWritable = arguments.length > 4 ? arguments[4] : null;
      var nonConfigurable = arguments.length > 5 ? arguments[5] : null;
      var loose = arguments.length > 6 ? arguments[6] : false;
      var desc = !!gopd && gopd(obj, property);
      if ($defineProperty) {
        $defineProperty(obj, property, {
          configurable: nonConfigurable === null && desc ? desc.configurable : !nonConfigurable,
          enumerable: nonEnumerable === null && desc ? desc.enumerable : !nonEnumerable,
          value,
          writable: nonWritable === null && desc ? desc.writable : !nonWritable
        });
      } else if (loose || !nonEnumerable && !nonWritable && !nonConfigurable) {
        obj[property] = value;
      } else {
        throw new $SyntaxError("This environment does not support defining a property as non-configurable, non-writable, or non-enumerable.");
      }
    };
  }
});

// node_modules/has-property-descriptors/index.js
var require_has_property_descriptors = __commonJS({
  "node_modules/has-property-descriptors/index.js"(exports, module2) {
    "use strict";
    var $defineProperty = require_es_define_property();
    var hasPropertyDescriptors = function hasPropertyDescriptors2() {
      return !!$defineProperty;
    };
    hasPropertyDescriptors.hasArrayLengthDefineBug = function hasArrayLengthDefineBug() {
      if (!$defineProperty) {
        return null;
      }
      try {
        return $defineProperty([], "length", { value: 1 }).length !== 1;
      } catch (e) {
        return true;
      }
    };
    module2.exports = hasPropertyDescriptors;
  }
});

// node_modules/set-function-length/index.js
var require_set_function_length = __commonJS({
  "node_modules/set-function-length/index.js"(exports, module2) {
    "use strict";
    var GetIntrinsic = require_get_intrinsic();
    var define2 = require_define_data_property();
    var hasDescriptors = require_has_property_descriptors()();
    var gOPD = require_gopd();
    var $TypeError = require_type();
    var $floor = GetIntrinsic("%Math.floor%");
    module2.exports = function setFunctionLength(fn, length) {
      if (typeof fn !== "function") {
        throw new $TypeError("`fn` is not a function");
      }
      if (typeof length !== "number" || length < 0 || length > 4294967295 || $floor(length) !== length) {
        throw new $TypeError("`length` must be a positive 32-bit integer");
      }
      var loose = arguments.length > 2 && !!arguments[2];
      var functionLengthIsConfigurable = true;
      var functionLengthIsWritable = true;
      if ("length" in fn && gOPD) {
        var desc = gOPD(fn, "length");
        if (desc && !desc.configurable) {
          functionLengthIsConfigurable = false;
        }
        if (desc && !desc.writable) {
          functionLengthIsWritable = false;
        }
      }
      if (functionLengthIsConfigurable || functionLengthIsWritable || !loose) {
        if (hasDescriptors) {
          define2(
            /** @type {Parameters<define>[0]} */
            fn,
            "length",
            length,
            true,
            true
          );
        } else {
          define2(
            /** @type {Parameters<define>[0]} */
            fn,
            "length",
            length
          );
        }
      }
      return fn;
    };
  }
});

// node_modules/call-bind-apply-helpers/applyBind.js
var require_applyBind = __commonJS({
  "node_modules/call-bind-apply-helpers/applyBind.js"(exports, module2) {
    "use strict";
    var bind = require_function_bind();
    var $apply = require_functionApply();
    var actualApply = require_actualApply();
    module2.exports = function applyBind() {
      return actualApply(bind, $apply, arguments);
    };
  }
});

// node_modules/call-bind/index.js
var require_call_bind = __commonJS({
  "node_modules/call-bind/index.js"(exports, module2) {
    "use strict";
    var setFunctionLength = require_set_function_length();
    var $defineProperty = require_es_define_property();
    var callBindBasic = require_call_bind_apply_helpers();
    var applyBind = require_applyBind();
    module2.exports = function callBind(originalFunction) {
      var func = callBindBasic(arguments);
      var adjustedLength = 1 + originalFunction.length - (arguments.length - 1);
      return setFunctionLength(
        func,
        adjustedLength > 0 ? adjustedLength : 0,
        true
      );
    };
    if ($defineProperty) {
      $defineProperty(module2.exports, "apply", { value: applyBind });
    } else {
      module2.exports.apply = applyBind;
    }
  }
});

// node_modules/has-tostringtag/shams.js
var require_shams2 = __commonJS({
  "node_modules/has-tostringtag/shams.js"(exports, module2) {
    "use strict";
    var hasSymbols = require_shams();
    module2.exports = function hasToStringTagShams() {
      return hasSymbols() && !!Symbol.toStringTag;
    };
  }
});

// node_modules/which-typed-array/index.js
var require_which_typed_array = __commonJS({
  "node_modules/which-typed-array/index.js"(exports, module2) {
    "use strict";
    var forEach = require_for_each();
    var availableTypedArrays = require_available_typed_arrays();
    var callBind = require_call_bind();
    var callBound = require_call_bound();
    var gOPD = require_gopd();
    var getProto = require_get_proto();
    var $toString = callBound("Object.prototype.toString");
    var hasToStringTag = require_shams2()();
    var g = typeof globalThis === "undefined" ? global : globalThis;
    var typedArrays = availableTypedArrays();
    var $slice = callBound("String.prototype.slice");
    var $indexOf = callBound("Array.prototype.indexOf", true) || function indexOf(array, value) {
      for (var i = 0; i < array.length; i += 1) {
        if (array[i] === value) {
          return i;
        }
      }
      return -1;
    };
    var cache = { __proto__: null };
    if (hasToStringTag && gOPD && getProto) {
      forEach(typedArrays, function(typedArray) {
        var arr = new g[typedArray]();
        if (Symbol.toStringTag in arr && getProto) {
          var proto = getProto(arr);
          var descriptor = gOPD(proto, Symbol.toStringTag);
          if (!descriptor && proto) {
            var superProto = getProto(proto);
            descriptor = gOPD(superProto, Symbol.toStringTag);
          }
          if (descriptor && descriptor.get) {
            var bound = callBind(descriptor.get);
            cache[
              /** @type {`$${TypedArrayName}`} */
              "$" + typedArray
            ] = bound;
          }
        }
      });
    } else {
      forEach(typedArrays, function(typedArray) {
        var arr = new g[typedArray]();
        var fn = arr.slice || arr.set;
        if (fn) {
          var bound = (
            /** @type {BoundSlice | BoundSet} */
            // @ts-expect-error TODO FIXME
            callBind(fn)
          );
          cache[
            /** @type {`$${TypedArrayName}`} */
            "$" + typedArray
          ] = bound;
        }
      });
    }
    function tryTypedArrays(value) {
      var found = false;
      forEach(
        /** @type {Record<`$${TypedArrayName}`, Getter>} */
        cache,
        /** @param {Getter} getter @param {`$${TypedArrayName}`} typedArray */
        function(getter, typedArray) {
          if (!found) {
            try {
              if ("$" + getter(value) === typedArray) {
                found = /** @type {TypedArrayName} */
                $slice(typedArray, 1);
              }
            } catch (e) {
            }
          }
        }
      );
      return found;
    }
    function trySlices(value) {
      var found = false;
      forEach(
        /** @type {Record<`$${TypedArrayName}`, Getter>} */
        cache,
        /** @param {Getter} getter @param {`$${TypedArrayName}`} name */
        function(getter, name2) {
          if (!found) {
            try {
              getter(value);
              found = /** @type {TypedArrayName} */
              $slice(name2, 1);
            } catch (e) {
            }
          }
        }
      );
      return found;
    }
    function isTATag(tag) {
      return $indexOf(typedArrays, tag) > -1;
    }
    module2.exports = function whichTypedArray(value) {
      if (!value || typeof value !== "object") {
        return false;
      }
      if (!hasToStringTag) {
        var tag = $slice($toString(value), 8, -1);
        if (isTATag(tag)) {
          return tag;
        }
        if (tag !== "Object") {
          return false;
        }
        return trySlices(value);
      }
      if (!gOPD) {
        return null;
      }
      return tryTypedArrays(value);
    };
  }
});

// node_modules/is-typed-array/index.js
var require_is_typed_array = __commonJS({
  "node_modules/is-typed-array/index.js"(exports, module2) {
    "use strict";
    var whichTypedArray = require_which_typed_array();
    module2.exports = function isTypedArray(value) {
      return !!whichTypedArray(value);
    };
  }
});

// node_modules/typed-array-buffer/index.js
var require_typed_array_buffer = __commonJS({
  "node_modules/typed-array-buffer/index.js"(exports, module2) {
    "use strict";
    var $TypeError = require_type();
    var callBound = require_call_bound();
    var $typedArrayBuffer = callBound("TypedArray.prototype.buffer", true);
    var isTypedArray = require_is_typed_array();
    module2.exports = $typedArrayBuffer || function typedArrayBuffer(x) {
      if (!isTypedArray(x)) {
        throw new $TypeError("Not a Typed Array");
      }
      return x.buffer;
    };
  }
});

// node_modules/to-buffer/index.js
var require_to_buffer = __commonJS({
  "node_modules/to-buffer/index.js"(exports, module2) {
    "use strict";
    var Buffer2 = require_safe_buffer().Buffer;
    var isArray = require_isarray();
    var typedArrayBuffer = require_typed_array_buffer();
    var isView = ArrayBuffer.isView || function isView2(obj) {
      try {
        typedArrayBuffer(obj);
        return true;
      } catch (e) {
        return false;
      }
    };
    var useUint8Array = typeof Uint8Array !== "undefined";
    var useArrayBuffer = typeof ArrayBuffer !== "undefined" && typeof Uint8Array !== "undefined";
    var useFromArrayBuffer = useArrayBuffer && (Buffer2.prototype instanceof Uint8Array || Buffer2.TYPED_ARRAY_SUPPORT);
    module2.exports = function toBuffer(data, encoding) {
      if (Buffer2.isBuffer(data)) {
        if (data.constructor && !("isBuffer" in data)) {
          return Buffer2.from(data);
        }
        return data;
      }
      if (typeof data === "string") {
        return Buffer2.from(data, encoding);
      }
      if (useArrayBuffer && isView(data)) {
        if (data.byteLength === 0) {
          return Buffer2.alloc(0);
        }
        if (useFromArrayBuffer) {
          var res = Buffer2.from(data.buffer, data.byteOffset, data.byteLength);
          if (res.byteLength === data.byteLength) {
            return res;
          }
        }
        var uint8 = data instanceof Uint8Array ? data : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        var result = Buffer2.from(uint8);
        if (result.length === data.byteLength) {
          return result;
        }
      }
      if (useUint8Array && data instanceof Uint8Array) {
        return Buffer2.from(data);
      }
      var isArr = isArray(data);
      if (isArr) {
        for (var i = 0; i < data.length; i += 1) {
          var x = data[i];
          if (typeof x !== "number" || x < 0 || x > 255 || ~~x !== x) {
            throw new RangeError("Array items must be numbers in the range 0-255.");
          }
        }
      }
      if (isArr || Buffer2.isBuffer(data) && data.constructor && typeof data.constructor.isBuffer === "function" && data.constructor.isBuffer(data)) {
        return Buffer2.from(data);
      }
      throw new TypeError('The "data" argument must be a string, an Array, a Buffer, a Uint8Array, or a DataView.');
    };
  }
});

// node_modules/sha.js/hash.js
var require_hash = __commonJS({
  "node_modules/sha.js/hash.js"(exports, module2) {
    "use strict";
    var Buffer2 = require_safe_buffer().Buffer;
    var toBuffer = require_to_buffer();
    function Hash2(blockSize, finalSize) {
      this._block = Buffer2.alloc(blockSize);
      this._finalSize = finalSize;
      this._blockSize = blockSize;
      this._len = 0;
    }
    Hash2.prototype.update = function(data, enc) {
      data = toBuffer(data, enc || "utf8");
      var block = this._block;
      var blockSize = this._blockSize;
      var length = data.length;
      var accum = this._len;
      for (var offset = 0; offset < length; ) {
        var assigned = accum % blockSize;
        var remainder = Math.min(length - offset, blockSize - assigned);
        for (var i = 0; i < remainder; i++) {
          block[assigned + i] = data[offset + i];
        }
        accum += remainder;
        offset += remainder;
        if (accum % blockSize === 0) {
          this._update(block);
        }
      }
      this._len += length;
      return this;
    };
    Hash2.prototype.digest = function(enc) {
      var rem = this._len % this._blockSize;
      this._block[rem] = 128;
      this._block.fill(0, rem + 1);
      if (rem >= this._finalSize) {
        this._update(this._block);
        this._block.fill(0);
      }
      var bits = this._len * 8;
      if (bits <= 4294967295) {
        this._block.writeUInt32BE(bits, this._blockSize - 4);
      } else {
        var lowBits = (bits & 4294967295) >>> 0;
        var highBits = (bits - lowBits) / 4294967296;
        this._block.writeUInt32BE(highBits, this._blockSize - 8);
        this._block.writeUInt32BE(lowBits, this._blockSize - 4);
      }
      this._update(this._block);
      var hash = this._hash();
      return enc ? hash.toString(enc) : hash;
    };
    Hash2.prototype._update = function() {
      throw new Error("_update must be implemented by subclass");
    };
    module2.exports = Hash2;
  }
});

// node_modules/sha.js/sha1.js
var require_sha1 = __commonJS({
  "node_modules/sha.js/sha1.js"(exports, module2) {
    "use strict";
    var inherits = require_inherits_browser();
    var Hash2 = require_hash();
    var Buffer2 = require_safe_buffer().Buffer;
    var K = [
      1518500249,
      1859775393,
      2400959708 | 0,
      3395469782 | 0
    ];
    var W = new Array(80);
    function Sha1() {
      this.init();
      this._w = W;
      Hash2.call(this, 64, 56);
    }
    inherits(Sha1, Hash2);
    Sha1.prototype.init = function() {
      this._a = 1732584193;
      this._b = 4023233417;
      this._c = 2562383102;
      this._d = 271733878;
      this._e = 3285377520;
      return this;
    };
    function rotl1(num2) {
      return num2 << 1 | num2 >>> 31;
    }
    function rotl5(num2) {
      return num2 << 5 | num2 >>> 27;
    }
    function rotl30(num2) {
      return num2 << 30 | num2 >>> 2;
    }
    function ft(s, b, c, d) {
      if (s === 0) {
        return b & c | ~b & d;
      }
      if (s === 2) {
        return b & c | b & d | c & d;
      }
      return b ^ c ^ d;
    }
    Sha1.prototype._update = function(M) {
      var w = this._w;
      var a = this._a | 0;
      var b = this._b | 0;
      var c = this._c | 0;
      var d = this._d | 0;
      var e = this._e | 0;
      for (var i = 0; i < 16; ++i) {
        w[i] = M.readInt32BE(i * 4);
      }
      for (; i < 80; ++i) {
        w[i] = rotl1(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]);
      }
      for (var j = 0; j < 80; ++j) {
        var s = ~~(j / 20);
        var t = rotl5(a) + ft(s, b, c, d) + e + w[j] + K[s] | 0;
        e = d;
        d = c;
        c = rotl30(b);
        b = a;
        a = t;
      }
      this._a = a + this._a | 0;
      this._b = b + this._b | 0;
      this._c = c + this._c | 0;
      this._d = d + this._d | 0;
      this._e = e + this._e | 0;
    };
    Sha1.prototype._hash = function() {
      var H = Buffer2.allocUnsafe(20);
      H.writeInt32BE(this._a | 0, 0);
      H.writeInt32BE(this._b | 0, 4);
      H.writeInt32BE(this._c | 0, 8);
      H.writeInt32BE(this._d | 0, 12);
      H.writeInt32BE(this._e | 0, 16);
      return H;
    };
    module2.exports = Sha1;
  }
});

// node_modules/crc-32/crc32.js
var require_crc32 = __commonJS({
  "node_modules/crc-32/crc32.js"(exports) {
    var CRC32;
    (function(factory) {
      if (typeof DO_NOT_EXPORT_CRC === "undefined") {
        if ("object" === typeof exports) {
          factory(exports);
        } else if ("function" === typeof define && define.amd) {
          define(function() {
            var module3 = {};
            factory(module3);
            return module3;
          });
        } else {
          factory(CRC32 = {});
        }
      } else {
        factory(CRC32 = {});
      }
    })(function(CRC322) {
      CRC322.version = "1.2.2";
      function signed_crc_table() {
        var c = 0, table = new Array(256);
        for (var n = 0; n != 256; ++n) {
          c = n;
          c = c & 1 ? -306674912 ^ c >>> 1 : c >>> 1;
          c = c & 1 ? -306674912 ^ c >>> 1 : c >>> 1;
          c = c & 1 ? -306674912 ^ c >>> 1 : c >>> 1;
          c = c & 1 ? -306674912 ^ c >>> 1 : c >>> 1;
          c = c & 1 ? -306674912 ^ c >>> 1 : c >>> 1;
          c = c & 1 ? -306674912 ^ c >>> 1 : c >>> 1;
          c = c & 1 ? -306674912 ^ c >>> 1 : c >>> 1;
          c = c & 1 ? -306674912 ^ c >>> 1 : c >>> 1;
          table[n] = c;
        }
        return typeof Int32Array !== "undefined" ? new Int32Array(table) : table;
      }
      var T0 = signed_crc_table();
      function slice_by_16_tables(T) {
        var c = 0, v = 0, n = 0, table = typeof Int32Array !== "undefined" ? new Int32Array(4096) : new Array(4096);
        for (n = 0; n != 256; ++n)
          table[n] = T[n];
        for (n = 0; n != 256; ++n) {
          v = T[n];
          for (c = 256 + n; c < 4096; c += 256)
            v = table[c] = v >>> 8 ^ T[v & 255];
        }
        var out = [];
        for (n = 1; n != 16; ++n)
          out[n - 1] = typeof Int32Array !== "undefined" ? table.subarray(n * 256, n * 256 + 256) : table.slice(n * 256, n * 256 + 256);
        return out;
      }
      var TT = slice_by_16_tables(T0);
      var T1 = TT[0], T2 = TT[1], T3 = TT[2], T4 = TT[3], T5 = TT[4];
      var T6 = TT[5], T7 = TT[6], T8 = TT[7], T9 = TT[8], Ta = TT[9];
      var Tb = TT[10], Tc = TT[11], Td = TT[12], Te = TT[13], Tf = TT[14];
      function crc32_bstr(bstr, seed) {
        var C = seed ^ -1;
        for (var i = 0, L = bstr.length; i < L; )
          C = C >>> 8 ^ T0[(C ^ bstr.charCodeAt(i++)) & 255];
        return ~C;
      }
      function crc32_buf(B, seed) {
        var C = seed ^ -1, L = B.length - 15, i = 0;
        for (; i < L; )
          C = Tf[B[i++] ^ C & 255] ^ Te[B[i++] ^ C >> 8 & 255] ^ Td[B[i++] ^ C >> 16 & 255] ^ Tc[B[i++] ^ C >>> 24] ^ Tb[B[i++]] ^ Ta[B[i++]] ^ T9[B[i++]] ^ T8[B[i++]] ^ T7[B[i++]] ^ T6[B[i++]] ^ T5[B[i++]] ^ T4[B[i++]] ^ T3[B[i++]] ^ T2[B[i++]] ^ T1[B[i++]] ^ T0[B[i++]];
        L += 15;
        while (i < L)
          C = C >>> 8 ^ T0[(C ^ B[i++]) & 255];
        return ~C;
      }
      function crc32_str(str, seed) {
        var C = seed ^ -1;
        for (var i = 0, L = str.length, c = 0, d = 0; i < L; ) {
          c = str.charCodeAt(i++);
          if (c < 128) {
            C = C >>> 8 ^ T0[(C ^ c) & 255];
          } else if (c < 2048) {
            C = C >>> 8 ^ T0[(C ^ (192 | c >> 6 & 31)) & 255];
            C = C >>> 8 ^ T0[(C ^ (128 | c & 63)) & 255];
          } else if (c >= 55296 && c < 57344) {
            c = (c & 1023) + 64;
            d = str.charCodeAt(i++) & 1023;
            C = C >>> 8 ^ T0[(C ^ (240 | c >> 8 & 7)) & 255];
            C = C >>> 8 ^ T0[(C ^ (128 | c >> 2 & 63)) & 255];
            C = C >>> 8 ^ T0[(C ^ (128 | d >> 6 & 15 | (c & 3) << 4)) & 255];
            C = C >>> 8 ^ T0[(C ^ (128 | d & 63)) & 255];
          } else {
            C = C >>> 8 ^ T0[(C ^ (224 | c >> 12 & 15)) & 255];
            C = C >>> 8 ^ T0[(C ^ (128 | c >> 6 & 63)) & 255];
            C = C >>> 8 ^ T0[(C ^ (128 | c & 63)) & 255];
          }
        }
        return ~C;
      }
      CRC322.table = T0;
      CRC322.bstr = crc32_bstr;
      CRC322.buf = crc32_buf;
      CRC322.str = crc32_str;
    });
  }
});

// node_modules/pako/lib/utils/common.js
var require_common = __commonJS({
  "node_modules/pako/lib/utils/common.js"(exports) {
    "use strict";
    var TYPED_OK = typeof Uint8Array !== "undefined" && typeof Uint16Array !== "undefined" && typeof Int32Array !== "undefined";
    function _has(obj, key) {
      return Object.prototype.hasOwnProperty.call(obj, key);
    }
    exports.assign = function(obj) {
      var sources = Array.prototype.slice.call(arguments, 1);
      while (sources.length) {
        var source = sources.shift();
        if (!source) {
          continue;
        }
        if (typeof source !== "object") {
          throw new TypeError(source + "must be non-object");
        }
        for (var p in source) {
          if (_has(source, p)) {
            obj[p] = source[p];
          }
        }
      }
      return obj;
    };
    exports.shrinkBuf = function(buf, size) {
      if (buf.length === size) {
        return buf;
      }
      if (buf.subarray) {
        return buf.subarray(0, size);
      }
      buf.length = size;
      return buf;
    };
    var fnTyped = {
      arraySet: function(dest, src, src_offs, len, dest_offs) {
        if (src.subarray && dest.subarray) {
          dest.set(src.subarray(src_offs, src_offs + len), dest_offs);
          return;
        }
        for (var i = 0; i < len; i++) {
          dest[dest_offs + i] = src[src_offs + i];
        }
      },
      // Join array of chunks to single array.
      flattenChunks: function(chunks) {
        var i, l, len, pos, chunk, result;
        len = 0;
        for (i = 0, l = chunks.length; i < l; i++) {
          len += chunks[i].length;
        }
        result = new Uint8Array(len);
        pos = 0;
        for (i = 0, l = chunks.length; i < l; i++) {
          chunk = chunks[i];
          result.set(chunk, pos);
          pos += chunk.length;
        }
        return result;
      }
    };
    var fnUntyped = {
      arraySet: function(dest, src, src_offs, len, dest_offs) {
        for (var i = 0; i < len; i++) {
          dest[dest_offs + i] = src[src_offs + i];
        }
      },
      // Join array of chunks to single array.
      flattenChunks: function(chunks) {
        return [].concat.apply([], chunks);
      }
    };
    exports.setTyped = function(on) {
      if (on) {
        exports.Buf8 = Uint8Array;
        exports.Buf16 = Uint16Array;
        exports.Buf32 = Int32Array;
        exports.assign(exports, fnTyped);
      } else {
        exports.Buf8 = Array;
        exports.Buf16 = Array;
        exports.Buf32 = Array;
        exports.assign(exports, fnUntyped);
      }
    };
    exports.setTyped(TYPED_OK);
  }
});

// node_modules/pako/lib/zlib/trees.js
var require_trees = __commonJS({
  "node_modules/pako/lib/zlib/trees.js"(exports) {
    "use strict";
    var utils = require_common();
    var Z_FIXED = 4;
    var Z_BINARY = 0;
    var Z_TEXT = 1;
    var Z_UNKNOWN = 2;
    function zero(buf) {
      var len = buf.length;
      while (--len >= 0) {
        buf[len] = 0;
      }
    }
    var STORED_BLOCK = 0;
    var STATIC_TREES = 1;
    var DYN_TREES = 2;
    var MIN_MATCH = 3;
    var MAX_MATCH = 258;
    var LENGTH_CODES = 29;
    var LITERALS = 256;
    var L_CODES = LITERALS + 1 + LENGTH_CODES;
    var D_CODES = 30;
    var BL_CODES = 19;
    var HEAP_SIZE = 2 * L_CODES + 1;
    var MAX_BITS = 15;
    var Buf_size = 16;
    var MAX_BL_BITS = 7;
    var END_BLOCK = 256;
    var REP_3_6 = 16;
    var REPZ_3_10 = 17;
    var REPZ_11_138 = 18;
    var extra_lbits = (
      /* extra bits for each length code */
      [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0]
    );
    var extra_dbits = (
      /* extra bits for each distance code */
      [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13]
    );
    var extra_blbits = (
      /* extra bits for each bit length code */
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7]
    );
    var bl_order = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
    var DIST_CODE_LEN = 512;
    var static_ltree = new Array((L_CODES + 2) * 2);
    zero(static_ltree);
    var static_dtree = new Array(D_CODES * 2);
    zero(static_dtree);
    var _dist_code = new Array(DIST_CODE_LEN);
    zero(_dist_code);
    var _length_code = new Array(MAX_MATCH - MIN_MATCH + 1);
    zero(_length_code);
    var base_length = new Array(LENGTH_CODES);
    zero(base_length);
    var base_dist = new Array(D_CODES);
    zero(base_dist);
    function StaticTreeDesc(static_tree, extra_bits, extra_base, elems, max_length) {
      this.static_tree = static_tree;
      this.extra_bits = extra_bits;
      this.extra_base = extra_base;
      this.elems = elems;
      this.max_length = max_length;
      this.has_stree = static_tree && static_tree.length;
    }
    var static_l_desc;
    var static_d_desc;
    var static_bl_desc;
    function TreeDesc(dyn_tree, stat_desc) {
      this.dyn_tree = dyn_tree;
      this.max_code = 0;
      this.stat_desc = stat_desc;
    }
    function d_code(dist) {
      return dist < 256 ? _dist_code[dist] : _dist_code[256 + (dist >>> 7)];
    }
    function put_short(s, w) {
      s.pending_buf[s.pending++] = w & 255;
      s.pending_buf[s.pending++] = w >>> 8 & 255;
    }
    function send_bits(s, value, length) {
      if (s.bi_valid > Buf_size - length) {
        s.bi_buf |= value << s.bi_valid & 65535;
        put_short(s, s.bi_buf);
        s.bi_buf = value >> Buf_size - s.bi_valid;
        s.bi_valid += length - Buf_size;
      } else {
        s.bi_buf |= value << s.bi_valid & 65535;
        s.bi_valid += length;
      }
    }
    function send_code(s, c, tree) {
      send_bits(
        s,
        tree[c * 2],
        tree[c * 2 + 1]
        /*.Len*/
      );
    }
    function bi_reverse(code, len) {
      var res = 0;
      do {
        res |= code & 1;
        code >>>= 1;
        res <<= 1;
      } while (--len > 0);
      return res >>> 1;
    }
    function bi_flush(s) {
      if (s.bi_valid === 16) {
        put_short(s, s.bi_buf);
        s.bi_buf = 0;
        s.bi_valid = 0;
      } else if (s.bi_valid >= 8) {
        s.pending_buf[s.pending++] = s.bi_buf & 255;
        s.bi_buf >>= 8;
        s.bi_valid -= 8;
      }
    }
    function gen_bitlen(s, desc) {
      var tree = desc.dyn_tree;
      var max_code = desc.max_code;
      var stree = desc.stat_desc.static_tree;
      var has_stree = desc.stat_desc.has_stree;
      var extra = desc.stat_desc.extra_bits;
      var base = desc.stat_desc.extra_base;
      var max_length = desc.stat_desc.max_length;
      var h;
      var n, m;
      var bits;
      var xbits;
      var f;
      var overflow = 0;
      for (bits = 0; bits <= MAX_BITS; bits++) {
        s.bl_count[bits] = 0;
      }
      tree[s.heap[s.heap_max] * 2 + 1] = 0;
      for (h = s.heap_max + 1; h < HEAP_SIZE; h++) {
        n = s.heap[h];
        bits = tree[tree[n * 2 + 1] * 2 + 1] + 1;
        if (bits > max_length) {
          bits = max_length;
          overflow++;
        }
        tree[n * 2 + 1] = bits;
        if (n > max_code) {
          continue;
        }
        s.bl_count[bits]++;
        xbits = 0;
        if (n >= base) {
          xbits = extra[n - base];
        }
        f = tree[n * 2];
        s.opt_len += f * (bits + xbits);
        if (has_stree) {
          s.static_len += f * (stree[n * 2 + 1] + xbits);
        }
      }
      if (overflow === 0) {
        return;
      }
      do {
        bits = max_length - 1;
        while (s.bl_count[bits] === 0) {
          bits--;
        }
        s.bl_count[bits]--;
        s.bl_count[bits + 1] += 2;
        s.bl_count[max_length]--;
        overflow -= 2;
      } while (overflow > 0);
      for (bits = max_length; bits !== 0; bits--) {
        n = s.bl_count[bits];
        while (n !== 0) {
          m = s.heap[--h];
          if (m > max_code) {
            continue;
          }
          if (tree[m * 2 + 1] !== bits) {
            s.opt_len += (bits - tree[m * 2 + 1]) * tree[m * 2];
            tree[m * 2 + 1] = bits;
          }
          n--;
        }
      }
    }
    function gen_codes(tree, max_code, bl_count) {
      var next_code = new Array(MAX_BITS + 1);
      var code = 0;
      var bits;
      var n;
      for (bits = 1; bits <= MAX_BITS; bits++) {
        next_code[bits] = code = code + bl_count[bits - 1] << 1;
      }
      for (n = 0; n <= max_code; n++) {
        var len = tree[n * 2 + 1];
        if (len === 0) {
          continue;
        }
        tree[n * 2] = bi_reverse(next_code[len]++, len);
      }
    }
    function tr_static_init() {
      var n;
      var bits;
      var length;
      var code;
      var dist;
      var bl_count = new Array(MAX_BITS + 1);
      length = 0;
      for (code = 0; code < LENGTH_CODES - 1; code++) {
        base_length[code] = length;
        for (n = 0; n < 1 << extra_lbits[code]; n++) {
          _length_code[length++] = code;
        }
      }
      _length_code[length - 1] = code;
      dist = 0;
      for (code = 0; code < 16; code++) {
        base_dist[code] = dist;
        for (n = 0; n < 1 << extra_dbits[code]; n++) {
          _dist_code[dist++] = code;
        }
      }
      dist >>= 7;
      for (; code < D_CODES; code++) {
        base_dist[code] = dist << 7;
        for (n = 0; n < 1 << extra_dbits[code] - 7; n++) {
          _dist_code[256 + dist++] = code;
        }
      }
      for (bits = 0; bits <= MAX_BITS; bits++) {
        bl_count[bits] = 0;
      }
      n = 0;
      while (n <= 143) {
        static_ltree[n * 2 + 1] = 8;
        n++;
        bl_count[8]++;
      }
      while (n <= 255) {
        static_ltree[n * 2 + 1] = 9;
        n++;
        bl_count[9]++;
      }
      while (n <= 279) {
        static_ltree[n * 2 + 1] = 7;
        n++;
        bl_count[7]++;
      }
      while (n <= 287) {
        static_ltree[n * 2 + 1] = 8;
        n++;
        bl_count[8]++;
      }
      gen_codes(static_ltree, L_CODES + 1, bl_count);
      for (n = 0; n < D_CODES; n++) {
        static_dtree[n * 2 + 1] = 5;
        static_dtree[n * 2] = bi_reverse(n, 5);
      }
      static_l_desc = new StaticTreeDesc(static_ltree, extra_lbits, LITERALS + 1, L_CODES, MAX_BITS);
      static_d_desc = new StaticTreeDesc(static_dtree, extra_dbits, 0, D_CODES, MAX_BITS);
      static_bl_desc = new StaticTreeDesc(new Array(0), extra_blbits, 0, BL_CODES, MAX_BL_BITS);
    }
    function init_block(s) {
      var n;
      for (n = 0; n < L_CODES; n++) {
        s.dyn_ltree[n * 2] = 0;
      }
      for (n = 0; n < D_CODES; n++) {
        s.dyn_dtree[n * 2] = 0;
      }
      for (n = 0; n < BL_CODES; n++) {
        s.bl_tree[n * 2] = 0;
      }
      s.dyn_ltree[END_BLOCK * 2] = 1;
      s.opt_len = s.static_len = 0;
      s.last_lit = s.matches = 0;
    }
    function bi_windup(s) {
      if (s.bi_valid > 8) {
        put_short(s, s.bi_buf);
      } else if (s.bi_valid > 0) {
        s.pending_buf[s.pending++] = s.bi_buf;
      }
      s.bi_buf = 0;
      s.bi_valid = 0;
    }
    function copy_block(s, buf, len, header) {
      bi_windup(s);
      if (header) {
        put_short(s, len);
        put_short(s, ~len);
      }
      utils.arraySet(s.pending_buf, s.window, buf, len, s.pending);
      s.pending += len;
    }
    function smaller(tree, n, m, depth) {
      var _n2 = n * 2;
      var _m2 = m * 2;
      return tree[_n2] < tree[_m2] || tree[_n2] === tree[_m2] && depth[n] <= depth[m];
    }
    function pqdownheap(s, tree, k) {
      var v = s.heap[k];
      var j = k << 1;
      while (j <= s.heap_len) {
        if (j < s.heap_len && smaller(tree, s.heap[j + 1], s.heap[j], s.depth)) {
          j++;
        }
        if (smaller(tree, v, s.heap[j], s.depth)) {
          break;
        }
        s.heap[k] = s.heap[j];
        k = j;
        j <<= 1;
      }
      s.heap[k] = v;
    }
    function compress_block(s, ltree, dtree) {
      var dist;
      var lc;
      var lx = 0;
      var code;
      var extra;
      if (s.last_lit !== 0) {
        do {
          dist = s.pending_buf[s.d_buf + lx * 2] << 8 | s.pending_buf[s.d_buf + lx * 2 + 1];
          lc = s.pending_buf[s.l_buf + lx];
          lx++;
          if (dist === 0) {
            send_code(s, lc, ltree);
          } else {
            code = _length_code[lc];
            send_code(s, code + LITERALS + 1, ltree);
            extra = extra_lbits[code];
            if (extra !== 0) {
              lc -= base_length[code];
              send_bits(s, lc, extra);
            }
            dist--;
            code = d_code(dist);
            send_code(s, code, dtree);
            extra = extra_dbits[code];
            if (extra !== 0) {
              dist -= base_dist[code];
              send_bits(s, dist, extra);
            }
          }
        } while (lx < s.last_lit);
      }
      send_code(s, END_BLOCK, ltree);
    }
    function build_tree(s, desc) {
      var tree = desc.dyn_tree;
      var stree = desc.stat_desc.static_tree;
      var has_stree = desc.stat_desc.has_stree;
      var elems = desc.stat_desc.elems;
      var n, m;
      var max_code = -1;
      var node;
      s.heap_len = 0;
      s.heap_max = HEAP_SIZE;
      for (n = 0; n < elems; n++) {
        if (tree[n * 2] !== 0) {
          s.heap[++s.heap_len] = max_code = n;
          s.depth[n] = 0;
        } else {
          tree[n * 2 + 1] = 0;
        }
      }
      while (s.heap_len < 2) {
        node = s.heap[++s.heap_len] = max_code < 2 ? ++max_code : 0;
        tree[node * 2] = 1;
        s.depth[node] = 0;
        s.opt_len--;
        if (has_stree) {
          s.static_len -= stree[node * 2 + 1];
        }
      }
      desc.max_code = max_code;
      for (n = s.heap_len >> 1; n >= 1; n--) {
        pqdownheap(s, tree, n);
      }
      node = elems;
      do {
        n = s.heap[
          1
          /*SMALLEST*/
        ];
        s.heap[
          1
          /*SMALLEST*/
        ] = s.heap[s.heap_len--];
        pqdownheap(
          s,
          tree,
          1
          /*SMALLEST*/
        );
        m = s.heap[
          1
          /*SMALLEST*/
        ];
        s.heap[--s.heap_max] = n;
        s.heap[--s.heap_max] = m;
        tree[node * 2] = tree[n * 2] + tree[m * 2];
        s.depth[node] = (s.depth[n] >= s.depth[m] ? s.depth[n] : s.depth[m]) + 1;
        tree[n * 2 + 1] = tree[m * 2 + 1] = node;
        s.heap[
          1
          /*SMALLEST*/
        ] = node++;
        pqdownheap(
          s,
          tree,
          1
          /*SMALLEST*/
        );
      } while (s.heap_len >= 2);
      s.heap[--s.heap_max] = s.heap[
        1
        /*SMALLEST*/
      ];
      gen_bitlen(s, desc);
      gen_codes(tree, max_code, s.bl_count);
    }
    function scan_tree(s, tree, max_code) {
      var n;
      var prevlen = -1;
      var curlen;
      var nextlen = tree[0 * 2 + 1];
      var count = 0;
      var max_count = 7;
      var min_count = 4;
      if (nextlen === 0) {
        max_count = 138;
        min_count = 3;
      }
      tree[(max_code + 1) * 2 + 1] = 65535;
      for (n = 0; n <= max_code; n++) {
        curlen = nextlen;
        nextlen = tree[(n + 1) * 2 + 1];
        if (++count < max_count && curlen === nextlen) {
          continue;
        } else if (count < min_count) {
          s.bl_tree[curlen * 2] += count;
        } else if (curlen !== 0) {
          if (curlen !== prevlen) {
            s.bl_tree[curlen * 2]++;
          }
          s.bl_tree[REP_3_6 * 2]++;
        } else if (count <= 10) {
          s.bl_tree[REPZ_3_10 * 2]++;
        } else {
          s.bl_tree[REPZ_11_138 * 2]++;
        }
        count = 0;
        prevlen = curlen;
        if (nextlen === 0) {
          max_count = 138;
          min_count = 3;
        } else if (curlen === nextlen) {
          max_count = 6;
          min_count = 3;
        } else {
          max_count = 7;
          min_count = 4;
        }
      }
    }
    function send_tree(s, tree, max_code) {
      var n;
      var prevlen = -1;
      var curlen;
      var nextlen = tree[0 * 2 + 1];
      var count = 0;
      var max_count = 7;
      var min_count = 4;
      if (nextlen === 0) {
        max_count = 138;
        min_count = 3;
      }
      for (n = 0; n <= max_code; n++) {
        curlen = nextlen;
        nextlen = tree[(n + 1) * 2 + 1];
        if (++count < max_count && curlen === nextlen) {
          continue;
        } else if (count < min_count) {
          do {
            send_code(s, curlen, s.bl_tree);
          } while (--count !== 0);
        } else if (curlen !== 0) {
          if (curlen !== prevlen) {
            send_code(s, curlen, s.bl_tree);
            count--;
          }
          send_code(s, REP_3_6, s.bl_tree);
          send_bits(s, count - 3, 2);
        } else if (count <= 10) {
          send_code(s, REPZ_3_10, s.bl_tree);
          send_bits(s, count - 3, 3);
        } else {
          send_code(s, REPZ_11_138, s.bl_tree);
          send_bits(s, count - 11, 7);
        }
        count = 0;
        prevlen = curlen;
        if (nextlen === 0) {
          max_count = 138;
          min_count = 3;
        } else if (curlen === nextlen) {
          max_count = 6;
          min_count = 3;
        } else {
          max_count = 7;
          min_count = 4;
        }
      }
    }
    function build_bl_tree(s) {
      var max_blindex;
      scan_tree(s, s.dyn_ltree, s.l_desc.max_code);
      scan_tree(s, s.dyn_dtree, s.d_desc.max_code);
      build_tree(s, s.bl_desc);
      for (max_blindex = BL_CODES - 1; max_blindex >= 3; max_blindex--) {
        if (s.bl_tree[bl_order[max_blindex] * 2 + 1] !== 0) {
          break;
        }
      }
      s.opt_len += 3 * (max_blindex + 1) + 5 + 5 + 4;
      return max_blindex;
    }
    function send_all_trees(s, lcodes, dcodes, blcodes) {
      var rank;
      send_bits(s, lcodes - 257, 5);
      send_bits(s, dcodes - 1, 5);
      send_bits(s, blcodes - 4, 4);
      for (rank = 0; rank < blcodes; rank++) {
        send_bits(s, s.bl_tree[bl_order[rank] * 2 + 1], 3);
      }
      send_tree(s, s.dyn_ltree, lcodes - 1);
      send_tree(s, s.dyn_dtree, dcodes - 1);
    }
    function detect_data_type(s) {
      var black_mask = 4093624447;
      var n;
      for (n = 0; n <= 31; n++, black_mask >>>= 1) {
        if (black_mask & 1 && s.dyn_ltree[n * 2] !== 0) {
          return Z_BINARY;
        }
      }
      if (s.dyn_ltree[9 * 2] !== 0 || s.dyn_ltree[10 * 2] !== 0 || s.dyn_ltree[13 * 2] !== 0) {
        return Z_TEXT;
      }
      for (n = 32; n < LITERALS; n++) {
        if (s.dyn_ltree[n * 2] !== 0) {
          return Z_TEXT;
        }
      }
      return Z_BINARY;
    }
    var static_init_done = false;
    function _tr_init(s) {
      if (!static_init_done) {
        tr_static_init();
        static_init_done = true;
      }
      s.l_desc = new TreeDesc(s.dyn_ltree, static_l_desc);
      s.d_desc = new TreeDesc(s.dyn_dtree, static_d_desc);
      s.bl_desc = new TreeDesc(s.bl_tree, static_bl_desc);
      s.bi_buf = 0;
      s.bi_valid = 0;
      init_block(s);
    }
    function _tr_stored_block(s, buf, stored_len, last) {
      send_bits(s, (STORED_BLOCK << 1) + (last ? 1 : 0), 3);
      copy_block(s, buf, stored_len, true);
    }
    function _tr_align(s) {
      send_bits(s, STATIC_TREES << 1, 3);
      send_code(s, END_BLOCK, static_ltree);
      bi_flush(s);
    }
    function _tr_flush_block(s, buf, stored_len, last) {
      var opt_lenb, static_lenb;
      var max_blindex = 0;
      if (s.level > 0) {
        if (s.strm.data_type === Z_UNKNOWN) {
          s.strm.data_type = detect_data_type(s);
        }
        build_tree(s, s.l_desc);
        build_tree(s, s.d_desc);
        max_blindex = build_bl_tree(s);
        opt_lenb = s.opt_len + 3 + 7 >>> 3;
        static_lenb = s.static_len + 3 + 7 >>> 3;
        if (static_lenb <= opt_lenb) {
          opt_lenb = static_lenb;
        }
      } else {
        opt_lenb = static_lenb = stored_len + 5;
      }
      if (stored_len + 4 <= opt_lenb && buf !== -1) {
        _tr_stored_block(s, buf, stored_len, last);
      } else if (s.strategy === Z_FIXED || static_lenb === opt_lenb) {
        send_bits(s, (STATIC_TREES << 1) + (last ? 1 : 0), 3);
        compress_block(s, static_ltree, static_dtree);
      } else {
        send_bits(s, (DYN_TREES << 1) + (last ? 1 : 0), 3);
        send_all_trees(s, s.l_desc.max_code + 1, s.d_desc.max_code + 1, max_blindex + 1);
        compress_block(s, s.dyn_ltree, s.dyn_dtree);
      }
      init_block(s);
      if (last) {
        bi_windup(s);
      }
    }
    function _tr_tally(s, dist, lc) {
      s.pending_buf[s.d_buf + s.last_lit * 2] = dist >>> 8 & 255;
      s.pending_buf[s.d_buf + s.last_lit * 2 + 1] = dist & 255;
      s.pending_buf[s.l_buf + s.last_lit] = lc & 255;
      s.last_lit++;
      if (dist === 0) {
        s.dyn_ltree[lc * 2]++;
      } else {
        s.matches++;
        dist--;
        s.dyn_ltree[(_length_code[lc] + LITERALS + 1) * 2]++;
        s.dyn_dtree[d_code(dist) * 2]++;
      }
      return s.last_lit === s.lit_bufsize - 1;
    }
    exports._tr_init = _tr_init;
    exports._tr_stored_block = _tr_stored_block;
    exports._tr_flush_block = _tr_flush_block;
    exports._tr_tally = _tr_tally;
    exports._tr_align = _tr_align;
  }
});

// node_modules/pako/lib/zlib/adler32.js
var require_adler32 = __commonJS({
  "node_modules/pako/lib/zlib/adler32.js"(exports, module2) {
    "use strict";
    function adler32(adler, buf, len, pos) {
      var s1 = adler & 65535 | 0, s2 = adler >>> 16 & 65535 | 0, n = 0;
      while (len !== 0) {
        n = len > 2e3 ? 2e3 : len;
        len -= n;
        do {
          s1 = s1 + buf[pos++] | 0;
          s2 = s2 + s1 | 0;
        } while (--n);
        s1 %= 65521;
        s2 %= 65521;
      }
      return s1 | s2 << 16 | 0;
    }
    module2.exports = adler32;
  }
});

// node_modules/pako/lib/zlib/crc32.js
var require_crc322 = __commonJS({
  "node_modules/pako/lib/zlib/crc32.js"(exports, module2) {
    "use strict";
    function makeTable() {
      var c, table = [];
      for (var n = 0; n < 256; n++) {
        c = n;
        for (var k = 0; k < 8; k++) {
          c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
        }
        table[n] = c;
      }
      return table;
    }
    var crcTable = makeTable();
    function crc322(crc, buf, len, pos) {
      var t = crcTable, end = pos + len;
      crc ^= -1;
      for (var i = pos; i < end; i++) {
        crc = crc >>> 8 ^ t[(crc ^ buf[i]) & 255];
      }
      return crc ^ -1;
    }
    module2.exports = crc322;
  }
});

// node_modules/pako/lib/zlib/messages.js
var require_messages = __commonJS({
  "node_modules/pako/lib/zlib/messages.js"(exports, module2) {
    "use strict";
    module2.exports = {
      2: "need dictionary",
      /* Z_NEED_DICT       2  */
      1: "stream end",
      /* Z_STREAM_END      1  */
      0: "",
      /* Z_OK              0  */
      "-1": "file error",
      /* Z_ERRNO         (-1) */
      "-2": "stream error",
      /* Z_STREAM_ERROR  (-2) */
      "-3": "data error",
      /* Z_DATA_ERROR    (-3) */
      "-4": "insufficient memory",
      /* Z_MEM_ERROR     (-4) */
      "-5": "buffer error",
      /* Z_BUF_ERROR     (-5) */
      "-6": "incompatible version"
      /* Z_VERSION_ERROR (-6) */
    };
  }
});

// node_modules/pako/lib/zlib/deflate.js
var require_deflate = __commonJS({
  "node_modules/pako/lib/zlib/deflate.js"(exports) {
    "use strict";
    var utils = require_common();
    var trees = require_trees();
    var adler32 = require_adler32();
    var crc322 = require_crc322();
    var msg = require_messages();
    var Z_NO_FLUSH = 0;
    var Z_PARTIAL_FLUSH = 1;
    var Z_FULL_FLUSH = 3;
    var Z_FINISH = 4;
    var Z_BLOCK = 5;
    var Z_OK = 0;
    var Z_STREAM_END = 1;
    var Z_STREAM_ERROR = -2;
    var Z_DATA_ERROR = -3;
    var Z_BUF_ERROR = -5;
    var Z_DEFAULT_COMPRESSION = -1;
    var Z_FILTERED = 1;
    var Z_HUFFMAN_ONLY = 2;
    var Z_RLE = 3;
    var Z_FIXED = 4;
    var Z_DEFAULT_STRATEGY = 0;
    var Z_UNKNOWN = 2;
    var Z_DEFLATED = 8;
    var MAX_MEM_LEVEL = 9;
    var MAX_WBITS = 15;
    var DEF_MEM_LEVEL = 8;
    var LENGTH_CODES = 29;
    var LITERALS = 256;
    var L_CODES = LITERALS + 1 + LENGTH_CODES;
    var D_CODES = 30;
    var BL_CODES = 19;
    var HEAP_SIZE = 2 * L_CODES + 1;
    var MAX_BITS = 15;
    var MIN_MATCH = 3;
    var MAX_MATCH = 258;
    var MIN_LOOKAHEAD = MAX_MATCH + MIN_MATCH + 1;
    var PRESET_DICT = 32;
    var INIT_STATE = 42;
    var EXTRA_STATE = 69;
    var NAME_STATE = 73;
    var COMMENT_STATE = 91;
    var HCRC_STATE = 103;
    var BUSY_STATE = 113;
    var FINISH_STATE = 666;
    var BS_NEED_MORE = 1;
    var BS_BLOCK_DONE = 2;
    var BS_FINISH_STARTED = 3;
    var BS_FINISH_DONE = 4;
    var OS_CODE = 3;
    function err(strm, errorCode) {
      strm.msg = msg[errorCode];
      return errorCode;
    }
    function rank(f) {
      return (f << 1) - (f > 4 ? 9 : 0);
    }
    function zero(buf) {
      var len = buf.length;
      while (--len >= 0) {
        buf[len] = 0;
      }
    }
    function flush_pending(strm) {
      var s = strm.state;
      var len = s.pending;
      if (len > strm.avail_out) {
        len = strm.avail_out;
      }
      if (len === 0) {
        return;
      }
      utils.arraySet(strm.output, s.pending_buf, s.pending_out, len, strm.next_out);
      strm.next_out += len;
      s.pending_out += len;
      strm.total_out += len;
      strm.avail_out -= len;
      s.pending -= len;
      if (s.pending === 0) {
        s.pending_out = 0;
      }
    }
    function flush_block_only(s, last) {
      trees._tr_flush_block(s, s.block_start >= 0 ? s.block_start : -1, s.strstart - s.block_start, last);
      s.block_start = s.strstart;
      flush_pending(s.strm);
    }
    function put_byte(s, b) {
      s.pending_buf[s.pending++] = b;
    }
    function putShortMSB(s, b) {
      s.pending_buf[s.pending++] = b >>> 8 & 255;
      s.pending_buf[s.pending++] = b & 255;
    }
    function read_buf(strm, buf, start, size) {
      var len = strm.avail_in;
      if (len > size) {
        len = size;
      }
      if (len === 0) {
        return 0;
      }
      strm.avail_in -= len;
      utils.arraySet(buf, strm.input, strm.next_in, len, start);
      if (strm.state.wrap === 1) {
        strm.adler = adler32(strm.adler, buf, len, start);
      } else if (strm.state.wrap === 2) {
        strm.adler = crc322(strm.adler, buf, len, start);
      }
      strm.next_in += len;
      strm.total_in += len;
      return len;
    }
    function longest_match(s, cur_match) {
      var chain_length = s.max_chain_length;
      var scan = s.strstart;
      var match;
      var len;
      var best_len = s.prev_length;
      var nice_match = s.nice_match;
      var limit = s.strstart > s.w_size - MIN_LOOKAHEAD ? s.strstart - (s.w_size - MIN_LOOKAHEAD) : 0;
      var _win = s.window;
      var wmask = s.w_mask;
      var prev = s.prev;
      var strend = s.strstart + MAX_MATCH;
      var scan_end1 = _win[scan + best_len - 1];
      var scan_end = _win[scan + best_len];
      if (s.prev_length >= s.good_match) {
        chain_length >>= 2;
      }
      if (nice_match > s.lookahead) {
        nice_match = s.lookahead;
      }
      do {
        match = cur_match;
        if (_win[match + best_len] !== scan_end || _win[match + best_len - 1] !== scan_end1 || _win[match] !== _win[scan] || _win[++match] !== _win[scan + 1]) {
          continue;
        }
        scan += 2;
        match++;
        do {
        } while (_win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && scan < strend);
        len = MAX_MATCH - (strend - scan);
        scan = strend - MAX_MATCH;
        if (len > best_len) {
          s.match_start = cur_match;
          best_len = len;
          if (len >= nice_match) {
            break;
          }
          scan_end1 = _win[scan + best_len - 1];
          scan_end = _win[scan + best_len];
        }
      } while ((cur_match = prev[cur_match & wmask]) > limit && --chain_length !== 0);
      if (best_len <= s.lookahead) {
        return best_len;
      }
      return s.lookahead;
    }
    function fill_window(s) {
      var _w_size = s.w_size;
      var p, n, m, more, str;
      do {
        more = s.window_size - s.lookahead - s.strstart;
        if (s.strstart >= _w_size + (_w_size - MIN_LOOKAHEAD)) {
          utils.arraySet(s.window, s.window, _w_size, _w_size, 0);
          s.match_start -= _w_size;
          s.strstart -= _w_size;
          s.block_start -= _w_size;
          n = s.hash_size;
          p = n;
          do {
            m = s.head[--p];
            s.head[p] = m >= _w_size ? m - _w_size : 0;
          } while (--n);
          n = _w_size;
          p = n;
          do {
            m = s.prev[--p];
            s.prev[p] = m >= _w_size ? m - _w_size : 0;
          } while (--n);
          more += _w_size;
        }
        if (s.strm.avail_in === 0) {
          break;
        }
        n = read_buf(s.strm, s.window, s.strstart + s.lookahead, more);
        s.lookahead += n;
        if (s.lookahead + s.insert >= MIN_MATCH) {
          str = s.strstart - s.insert;
          s.ins_h = s.window[str];
          s.ins_h = (s.ins_h << s.hash_shift ^ s.window[str + 1]) & s.hash_mask;
          while (s.insert) {
            s.ins_h = (s.ins_h << s.hash_shift ^ s.window[str + MIN_MATCH - 1]) & s.hash_mask;
            s.prev[str & s.w_mask] = s.head[s.ins_h];
            s.head[s.ins_h] = str;
            str++;
            s.insert--;
            if (s.lookahead + s.insert < MIN_MATCH) {
              break;
            }
          }
        }
      } while (s.lookahead < MIN_LOOKAHEAD && s.strm.avail_in !== 0);
    }
    function deflate_stored(s, flush) {
      var max_block_size = 65535;
      if (max_block_size > s.pending_buf_size - 5) {
        max_block_size = s.pending_buf_size - 5;
      }
      for (; ; ) {
        if (s.lookahead <= 1) {
          fill_window(s);
          if (s.lookahead === 0 && flush === Z_NO_FLUSH) {
            return BS_NEED_MORE;
          }
          if (s.lookahead === 0) {
            break;
          }
        }
        s.strstart += s.lookahead;
        s.lookahead = 0;
        var max_start = s.block_start + max_block_size;
        if (s.strstart === 0 || s.strstart >= max_start) {
          s.lookahead = s.strstart - max_start;
          s.strstart = max_start;
          flush_block_only(s, false);
          if (s.strm.avail_out === 0) {
            return BS_NEED_MORE;
          }
        }
        if (s.strstart - s.block_start >= s.w_size - MIN_LOOKAHEAD) {
          flush_block_only(s, false);
          if (s.strm.avail_out === 0) {
            return BS_NEED_MORE;
          }
        }
      }
      s.insert = 0;
      if (flush === Z_FINISH) {
        flush_block_only(s, true);
        if (s.strm.avail_out === 0) {
          return BS_FINISH_STARTED;
        }
        return BS_FINISH_DONE;
      }
      if (s.strstart > s.block_start) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      }
      return BS_NEED_MORE;
    }
    function deflate_fast(s, flush) {
      var hash_head;
      var bflush;
      for (; ; ) {
        if (s.lookahead < MIN_LOOKAHEAD) {
          fill_window(s);
          if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH) {
            return BS_NEED_MORE;
          }
          if (s.lookahead === 0) {
            break;
          }
        }
        hash_head = 0;
        if (s.lookahead >= MIN_MATCH) {
          s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
          hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
          s.head[s.ins_h] = s.strstart;
        }
        if (hash_head !== 0 && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD) {
          s.match_length = longest_match(s, hash_head);
        }
        if (s.match_length >= MIN_MATCH) {
          bflush = trees._tr_tally(s, s.strstart - s.match_start, s.match_length - MIN_MATCH);
          s.lookahead -= s.match_length;
          if (s.match_length <= s.max_lazy_match && s.lookahead >= MIN_MATCH) {
            s.match_length--;
            do {
              s.strstart++;
              s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
              hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
              s.head[s.ins_h] = s.strstart;
            } while (--s.match_length !== 0);
            s.strstart++;
          } else {
            s.strstart += s.match_length;
            s.match_length = 0;
            s.ins_h = s.window[s.strstart];
            s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + 1]) & s.hash_mask;
          }
        } else {
          bflush = trees._tr_tally(s, 0, s.window[s.strstart]);
          s.lookahead--;
          s.strstart++;
        }
        if (bflush) {
          flush_block_only(s, false);
          if (s.strm.avail_out === 0) {
            return BS_NEED_MORE;
          }
        }
      }
      s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
      if (flush === Z_FINISH) {
        flush_block_only(s, true);
        if (s.strm.avail_out === 0) {
          return BS_FINISH_STARTED;
        }
        return BS_FINISH_DONE;
      }
      if (s.last_lit) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      }
      return BS_BLOCK_DONE;
    }
    function deflate_slow(s, flush) {
      var hash_head;
      var bflush;
      var max_insert;
      for (; ; ) {
        if (s.lookahead < MIN_LOOKAHEAD) {
          fill_window(s);
          if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH) {
            return BS_NEED_MORE;
          }
          if (s.lookahead === 0) {
            break;
          }
        }
        hash_head = 0;
        if (s.lookahead >= MIN_MATCH) {
          s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
          hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
          s.head[s.ins_h] = s.strstart;
        }
        s.prev_length = s.match_length;
        s.prev_match = s.match_start;
        s.match_length = MIN_MATCH - 1;
        if (hash_head !== 0 && s.prev_length < s.max_lazy_match && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD) {
          s.match_length = longest_match(s, hash_head);
          if (s.match_length <= 5 && (s.strategy === Z_FILTERED || s.match_length === MIN_MATCH && s.strstart - s.match_start > 4096)) {
            s.match_length = MIN_MATCH - 1;
          }
        }
        if (s.prev_length >= MIN_MATCH && s.match_length <= s.prev_length) {
          max_insert = s.strstart + s.lookahead - MIN_MATCH;
          bflush = trees._tr_tally(s, s.strstart - 1 - s.prev_match, s.prev_length - MIN_MATCH);
          s.lookahead -= s.prev_length - 1;
          s.prev_length -= 2;
          do {
            if (++s.strstart <= max_insert) {
              s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
              hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
              s.head[s.ins_h] = s.strstart;
            }
          } while (--s.prev_length !== 0);
          s.match_available = 0;
          s.match_length = MIN_MATCH - 1;
          s.strstart++;
          if (bflush) {
            flush_block_only(s, false);
            if (s.strm.avail_out === 0) {
              return BS_NEED_MORE;
            }
          }
        } else if (s.match_available) {
          bflush = trees._tr_tally(s, 0, s.window[s.strstart - 1]);
          if (bflush) {
            flush_block_only(s, false);
          }
          s.strstart++;
          s.lookahead--;
          if (s.strm.avail_out === 0) {
            return BS_NEED_MORE;
          }
        } else {
          s.match_available = 1;
          s.strstart++;
          s.lookahead--;
        }
      }
      if (s.match_available) {
        bflush = trees._tr_tally(s, 0, s.window[s.strstart - 1]);
        s.match_available = 0;
      }
      s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
      if (flush === Z_FINISH) {
        flush_block_only(s, true);
        if (s.strm.avail_out === 0) {
          return BS_FINISH_STARTED;
        }
        return BS_FINISH_DONE;
      }
      if (s.last_lit) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      }
      return BS_BLOCK_DONE;
    }
    function deflate_rle(s, flush) {
      var bflush;
      var prev;
      var scan, strend;
      var _win = s.window;
      for (; ; ) {
        if (s.lookahead <= MAX_MATCH) {
          fill_window(s);
          if (s.lookahead <= MAX_MATCH && flush === Z_NO_FLUSH) {
            return BS_NEED_MORE;
          }
          if (s.lookahead === 0) {
            break;
          }
        }
        s.match_length = 0;
        if (s.lookahead >= MIN_MATCH && s.strstart > 0) {
          scan = s.strstart - 1;
          prev = _win[scan];
          if (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan]) {
            strend = s.strstart + MAX_MATCH;
            do {
            } while (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && scan < strend);
            s.match_length = MAX_MATCH - (strend - scan);
            if (s.match_length > s.lookahead) {
              s.match_length = s.lookahead;
            }
          }
        }
        if (s.match_length >= MIN_MATCH) {
          bflush = trees._tr_tally(s, 1, s.match_length - MIN_MATCH);
          s.lookahead -= s.match_length;
          s.strstart += s.match_length;
          s.match_length = 0;
        } else {
          bflush = trees._tr_tally(s, 0, s.window[s.strstart]);
          s.lookahead--;
          s.strstart++;
        }
        if (bflush) {
          flush_block_only(s, false);
          if (s.strm.avail_out === 0) {
            return BS_NEED_MORE;
          }
        }
      }
      s.insert = 0;
      if (flush === Z_FINISH) {
        flush_block_only(s, true);
        if (s.strm.avail_out === 0) {
          return BS_FINISH_STARTED;
        }
        return BS_FINISH_DONE;
      }
      if (s.last_lit) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      }
      return BS_BLOCK_DONE;
    }
    function deflate_huff(s, flush) {
      var bflush;
      for (; ; ) {
        if (s.lookahead === 0) {
          fill_window(s);
          if (s.lookahead === 0) {
            if (flush === Z_NO_FLUSH) {
              return BS_NEED_MORE;
            }
            break;
          }
        }
        s.match_length = 0;
        bflush = trees._tr_tally(s, 0, s.window[s.strstart]);
        s.lookahead--;
        s.strstart++;
        if (bflush) {
          flush_block_only(s, false);
          if (s.strm.avail_out === 0) {
            return BS_NEED_MORE;
          }
        }
      }
      s.insert = 0;
      if (flush === Z_FINISH) {
        flush_block_only(s, true);
        if (s.strm.avail_out === 0) {
          return BS_FINISH_STARTED;
        }
        return BS_FINISH_DONE;
      }
      if (s.last_lit) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      }
      return BS_BLOCK_DONE;
    }
    function Config(good_length, max_lazy, nice_length, max_chain, func) {
      this.good_length = good_length;
      this.max_lazy = max_lazy;
      this.nice_length = nice_length;
      this.max_chain = max_chain;
      this.func = func;
    }
    var configuration_table;
    configuration_table = [
      /*      good lazy nice chain */
      new Config(0, 0, 0, 0, deflate_stored),
      /* 0 store only */
      new Config(4, 4, 8, 4, deflate_fast),
      /* 1 max speed, no lazy matches */
      new Config(4, 5, 16, 8, deflate_fast),
      /* 2 */
      new Config(4, 6, 32, 32, deflate_fast),
      /* 3 */
      new Config(4, 4, 16, 16, deflate_slow),
      /* 4 lazy matches */
      new Config(8, 16, 32, 32, deflate_slow),
      /* 5 */
      new Config(8, 16, 128, 128, deflate_slow),
      /* 6 */
      new Config(8, 32, 128, 256, deflate_slow),
      /* 7 */
      new Config(32, 128, 258, 1024, deflate_slow),
      /* 8 */
      new Config(32, 258, 258, 4096, deflate_slow)
      /* 9 max compression */
    ];
    function lm_init(s) {
      s.window_size = 2 * s.w_size;
      zero(s.head);
      s.max_lazy_match = configuration_table[s.level].max_lazy;
      s.good_match = configuration_table[s.level].good_length;
      s.nice_match = configuration_table[s.level].nice_length;
      s.max_chain_length = configuration_table[s.level].max_chain;
      s.strstart = 0;
      s.block_start = 0;
      s.lookahead = 0;
      s.insert = 0;
      s.match_length = s.prev_length = MIN_MATCH - 1;
      s.match_available = 0;
      s.ins_h = 0;
    }
    function DeflateState() {
      this.strm = null;
      this.status = 0;
      this.pending_buf = null;
      this.pending_buf_size = 0;
      this.pending_out = 0;
      this.pending = 0;
      this.wrap = 0;
      this.gzhead = null;
      this.gzindex = 0;
      this.method = Z_DEFLATED;
      this.last_flush = -1;
      this.w_size = 0;
      this.w_bits = 0;
      this.w_mask = 0;
      this.window = null;
      this.window_size = 0;
      this.prev = null;
      this.head = null;
      this.ins_h = 0;
      this.hash_size = 0;
      this.hash_bits = 0;
      this.hash_mask = 0;
      this.hash_shift = 0;
      this.block_start = 0;
      this.match_length = 0;
      this.prev_match = 0;
      this.match_available = 0;
      this.strstart = 0;
      this.match_start = 0;
      this.lookahead = 0;
      this.prev_length = 0;
      this.max_chain_length = 0;
      this.max_lazy_match = 0;
      this.level = 0;
      this.strategy = 0;
      this.good_match = 0;
      this.nice_match = 0;
      this.dyn_ltree = new utils.Buf16(HEAP_SIZE * 2);
      this.dyn_dtree = new utils.Buf16((2 * D_CODES + 1) * 2);
      this.bl_tree = new utils.Buf16((2 * BL_CODES + 1) * 2);
      zero(this.dyn_ltree);
      zero(this.dyn_dtree);
      zero(this.bl_tree);
      this.l_desc = null;
      this.d_desc = null;
      this.bl_desc = null;
      this.bl_count = new utils.Buf16(MAX_BITS + 1);
      this.heap = new utils.Buf16(2 * L_CODES + 1);
      zero(this.heap);
      this.heap_len = 0;
      this.heap_max = 0;
      this.depth = new utils.Buf16(2 * L_CODES + 1);
      zero(this.depth);
      this.l_buf = 0;
      this.lit_bufsize = 0;
      this.last_lit = 0;
      this.d_buf = 0;
      this.opt_len = 0;
      this.static_len = 0;
      this.matches = 0;
      this.insert = 0;
      this.bi_buf = 0;
      this.bi_valid = 0;
    }
    function deflateResetKeep(strm) {
      var s;
      if (!strm || !strm.state) {
        return err(strm, Z_STREAM_ERROR);
      }
      strm.total_in = strm.total_out = 0;
      strm.data_type = Z_UNKNOWN;
      s = strm.state;
      s.pending = 0;
      s.pending_out = 0;
      if (s.wrap < 0) {
        s.wrap = -s.wrap;
      }
      s.status = s.wrap ? INIT_STATE : BUSY_STATE;
      strm.adler = s.wrap === 2 ? 0 : 1;
      s.last_flush = Z_NO_FLUSH;
      trees._tr_init(s);
      return Z_OK;
    }
    function deflateReset(strm) {
      var ret = deflateResetKeep(strm);
      if (ret === Z_OK) {
        lm_init(strm.state);
      }
      return ret;
    }
    function deflateSetHeader(strm, head) {
      if (!strm || !strm.state) {
        return Z_STREAM_ERROR;
      }
      if (strm.state.wrap !== 2) {
        return Z_STREAM_ERROR;
      }
      strm.state.gzhead = head;
      return Z_OK;
    }
    function deflateInit2(strm, level, method, windowBits, memLevel, strategy) {
      if (!strm) {
        return Z_STREAM_ERROR;
      }
      var wrap = 1;
      if (level === Z_DEFAULT_COMPRESSION) {
        level = 6;
      }
      if (windowBits < 0) {
        wrap = 0;
        windowBits = -windowBits;
      } else if (windowBits > 15) {
        wrap = 2;
        windowBits -= 16;
      }
      if (memLevel < 1 || memLevel > MAX_MEM_LEVEL || method !== Z_DEFLATED || windowBits < 8 || windowBits > 15 || level < 0 || level > 9 || strategy < 0 || strategy > Z_FIXED) {
        return err(strm, Z_STREAM_ERROR);
      }
      if (windowBits === 8) {
        windowBits = 9;
      }
      var s = new DeflateState();
      strm.state = s;
      s.strm = strm;
      s.wrap = wrap;
      s.gzhead = null;
      s.w_bits = windowBits;
      s.w_size = 1 << s.w_bits;
      s.w_mask = s.w_size - 1;
      s.hash_bits = memLevel + 7;
      s.hash_size = 1 << s.hash_bits;
      s.hash_mask = s.hash_size - 1;
      s.hash_shift = ~~((s.hash_bits + MIN_MATCH - 1) / MIN_MATCH);
      s.window = new utils.Buf8(s.w_size * 2);
      s.head = new utils.Buf16(s.hash_size);
      s.prev = new utils.Buf16(s.w_size);
      s.lit_bufsize = 1 << memLevel + 6;
      s.pending_buf_size = s.lit_bufsize * 4;
      s.pending_buf = new utils.Buf8(s.pending_buf_size);
      s.d_buf = 1 * s.lit_bufsize;
      s.l_buf = (1 + 2) * s.lit_bufsize;
      s.level = level;
      s.strategy = strategy;
      s.method = method;
      return deflateReset(strm);
    }
    function deflateInit(strm, level) {
      return deflateInit2(strm, level, Z_DEFLATED, MAX_WBITS, DEF_MEM_LEVEL, Z_DEFAULT_STRATEGY);
    }
    function deflate2(strm, flush) {
      var old_flush, s;
      var beg, val;
      if (!strm || !strm.state || flush > Z_BLOCK || flush < 0) {
        return strm ? err(strm, Z_STREAM_ERROR) : Z_STREAM_ERROR;
      }
      s = strm.state;
      if (!strm.output || !strm.input && strm.avail_in !== 0 || s.status === FINISH_STATE && flush !== Z_FINISH) {
        return err(strm, strm.avail_out === 0 ? Z_BUF_ERROR : Z_STREAM_ERROR);
      }
      s.strm = strm;
      old_flush = s.last_flush;
      s.last_flush = flush;
      if (s.status === INIT_STATE) {
        if (s.wrap === 2) {
          strm.adler = 0;
          put_byte(s, 31);
          put_byte(s, 139);
          put_byte(s, 8);
          if (!s.gzhead) {
            put_byte(s, 0);
            put_byte(s, 0);
            put_byte(s, 0);
            put_byte(s, 0);
            put_byte(s, 0);
            put_byte(s, s.level === 9 ? 2 : s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ? 4 : 0);
            put_byte(s, OS_CODE);
            s.status = BUSY_STATE;
          } else {
            put_byte(
              s,
              (s.gzhead.text ? 1 : 0) + (s.gzhead.hcrc ? 2 : 0) + (!s.gzhead.extra ? 0 : 4) + (!s.gzhead.name ? 0 : 8) + (!s.gzhead.comment ? 0 : 16)
            );
            put_byte(s, s.gzhead.time & 255);
            put_byte(s, s.gzhead.time >> 8 & 255);
            put_byte(s, s.gzhead.time >> 16 & 255);
            put_byte(s, s.gzhead.time >> 24 & 255);
            put_byte(s, s.level === 9 ? 2 : s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ? 4 : 0);
            put_byte(s, s.gzhead.os & 255);
            if (s.gzhead.extra && s.gzhead.extra.length) {
              put_byte(s, s.gzhead.extra.length & 255);
              put_byte(s, s.gzhead.extra.length >> 8 & 255);
            }
            if (s.gzhead.hcrc) {
              strm.adler = crc322(strm.adler, s.pending_buf, s.pending, 0);
            }
            s.gzindex = 0;
            s.status = EXTRA_STATE;
          }
        } else {
          var header = Z_DEFLATED + (s.w_bits - 8 << 4) << 8;
          var level_flags = -1;
          if (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2) {
            level_flags = 0;
          } else if (s.level < 6) {
            level_flags = 1;
          } else if (s.level === 6) {
            level_flags = 2;
          } else {
            level_flags = 3;
          }
          header |= level_flags << 6;
          if (s.strstart !== 0) {
            header |= PRESET_DICT;
          }
          header += 31 - header % 31;
          s.status = BUSY_STATE;
          putShortMSB(s, header);
          if (s.strstart !== 0) {
            putShortMSB(s, strm.adler >>> 16);
            putShortMSB(s, strm.adler & 65535);
          }
          strm.adler = 1;
        }
      }
      if (s.status === EXTRA_STATE) {
        if (s.gzhead.extra) {
          beg = s.pending;
          while (s.gzindex < (s.gzhead.extra.length & 65535)) {
            if (s.pending === s.pending_buf_size) {
              if (s.gzhead.hcrc && s.pending > beg) {
                strm.adler = crc322(strm.adler, s.pending_buf, s.pending - beg, beg);
              }
              flush_pending(strm);
              beg = s.pending;
              if (s.pending === s.pending_buf_size) {
                break;
              }
            }
            put_byte(s, s.gzhead.extra[s.gzindex] & 255);
            s.gzindex++;
          }
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc322(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          if (s.gzindex === s.gzhead.extra.length) {
            s.gzindex = 0;
            s.status = NAME_STATE;
          }
        } else {
          s.status = NAME_STATE;
        }
      }
      if (s.status === NAME_STATE) {
        if (s.gzhead.name) {
          beg = s.pending;
          do {
            if (s.pending === s.pending_buf_size) {
              if (s.gzhead.hcrc && s.pending > beg) {
                strm.adler = crc322(strm.adler, s.pending_buf, s.pending - beg, beg);
              }
              flush_pending(strm);
              beg = s.pending;
              if (s.pending === s.pending_buf_size) {
                val = 1;
                break;
              }
            }
            if (s.gzindex < s.gzhead.name.length) {
              val = s.gzhead.name.charCodeAt(s.gzindex++) & 255;
            } else {
              val = 0;
            }
            put_byte(s, val);
          } while (val !== 0);
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc322(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          if (val === 0) {
            s.gzindex = 0;
            s.status = COMMENT_STATE;
          }
        } else {
          s.status = COMMENT_STATE;
        }
      }
      if (s.status === COMMENT_STATE) {
        if (s.gzhead.comment) {
          beg = s.pending;
          do {
            if (s.pending === s.pending_buf_size) {
              if (s.gzhead.hcrc && s.pending > beg) {
                strm.adler = crc322(strm.adler, s.pending_buf, s.pending - beg, beg);
              }
              flush_pending(strm);
              beg = s.pending;
              if (s.pending === s.pending_buf_size) {
                val = 1;
                break;
              }
            }
            if (s.gzindex < s.gzhead.comment.length) {
              val = s.gzhead.comment.charCodeAt(s.gzindex++) & 255;
            } else {
              val = 0;
            }
            put_byte(s, val);
          } while (val !== 0);
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc322(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          if (val === 0) {
            s.status = HCRC_STATE;
          }
        } else {
          s.status = HCRC_STATE;
        }
      }
      if (s.status === HCRC_STATE) {
        if (s.gzhead.hcrc) {
          if (s.pending + 2 > s.pending_buf_size) {
            flush_pending(strm);
          }
          if (s.pending + 2 <= s.pending_buf_size) {
            put_byte(s, strm.adler & 255);
            put_byte(s, strm.adler >> 8 & 255);
            strm.adler = 0;
            s.status = BUSY_STATE;
          }
        } else {
          s.status = BUSY_STATE;
        }
      }
      if (s.pending !== 0) {
        flush_pending(strm);
        if (strm.avail_out === 0) {
          s.last_flush = -1;
          return Z_OK;
        }
      } else if (strm.avail_in === 0 && rank(flush) <= rank(old_flush) && flush !== Z_FINISH) {
        return err(strm, Z_BUF_ERROR);
      }
      if (s.status === FINISH_STATE && strm.avail_in !== 0) {
        return err(strm, Z_BUF_ERROR);
      }
      if (strm.avail_in !== 0 || s.lookahead !== 0 || flush !== Z_NO_FLUSH && s.status !== FINISH_STATE) {
        var bstate = s.strategy === Z_HUFFMAN_ONLY ? deflate_huff(s, flush) : s.strategy === Z_RLE ? deflate_rle(s, flush) : configuration_table[s.level].func(s, flush);
        if (bstate === BS_FINISH_STARTED || bstate === BS_FINISH_DONE) {
          s.status = FINISH_STATE;
        }
        if (bstate === BS_NEED_MORE || bstate === BS_FINISH_STARTED) {
          if (strm.avail_out === 0) {
            s.last_flush = -1;
          }
          return Z_OK;
        }
        if (bstate === BS_BLOCK_DONE) {
          if (flush === Z_PARTIAL_FLUSH) {
            trees._tr_align(s);
          } else if (flush !== Z_BLOCK) {
            trees._tr_stored_block(s, 0, 0, false);
            if (flush === Z_FULL_FLUSH) {
              zero(s.head);
              if (s.lookahead === 0) {
                s.strstart = 0;
                s.block_start = 0;
                s.insert = 0;
              }
            }
          }
          flush_pending(strm);
          if (strm.avail_out === 0) {
            s.last_flush = -1;
            return Z_OK;
          }
        }
      }
      if (flush !== Z_FINISH) {
        return Z_OK;
      }
      if (s.wrap <= 0) {
        return Z_STREAM_END;
      }
      if (s.wrap === 2) {
        put_byte(s, strm.adler & 255);
        put_byte(s, strm.adler >> 8 & 255);
        put_byte(s, strm.adler >> 16 & 255);
        put_byte(s, strm.adler >> 24 & 255);
        put_byte(s, strm.total_in & 255);
        put_byte(s, strm.total_in >> 8 & 255);
        put_byte(s, strm.total_in >> 16 & 255);
        put_byte(s, strm.total_in >> 24 & 255);
      } else {
        putShortMSB(s, strm.adler >>> 16);
        putShortMSB(s, strm.adler & 65535);
      }
      flush_pending(strm);
      if (s.wrap > 0) {
        s.wrap = -s.wrap;
      }
      return s.pending !== 0 ? Z_OK : Z_STREAM_END;
    }
    function deflateEnd(strm) {
      var status;
      if (!strm || !strm.state) {
        return Z_STREAM_ERROR;
      }
      status = strm.state.status;
      if (status !== INIT_STATE && status !== EXTRA_STATE && status !== NAME_STATE && status !== COMMENT_STATE && status !== HCRC_STATE && status !== BUSY_STATE && status !== FINISH_STATE) {
        return err(strm, Z_STREAM_ERROR);
      }
      strm.state = null;
      return status === BUSY_STATE ? err(strm, Z_DATA_ERROR) : Z_OK;
    }
    function deflateSetDictionary(strm, dictionary) {
      var dictLength = dictionary.length;
      var s;
      var str, n;
      var wrap;
      var avail;
      var next;
      var input;
      var tmpDict;
      if (!strm || !strm.state) {
        return Z_STREAM_ERROR;
      }
      s = strm.state;
      wrap = s.wrap;
      if (wrap === 2 || wrap === 1 && s.status !== INIT_STATE || s.lookahead) {
        return Z_STREAM_ERROR;
      }
      if (wrap === 1) {
        strm.adler = adler32(strm.adler, dictionary, dictLength, 0);
      }
      s.wrap = 0;
      if (dictLength >= s.w_size) {
        if (wrap === 0) {
          zero(s.head);
          s.strstart = 0;
          s.block_start = 0;
          s.insert = 0;
        }
        tmpDict = new utils.Buf8(s.w_size);
        utils.arraySet(tmpDict, dictionary, dictLength - s.w_size, s.w_size, 0);
        dictionary = tmpDict;
        dictLength = s.w_size;
      }
      avail = strm.avail_in;
      next = strm.next_in;
      input = strm.input;
      strm.avail_in = dictLength;
      strm.next_in = 0;
      strm.input = dictionary;
      fill_window(s);
      while (s.lookahead >= MIN_MATCH) {
        str = s.strstart;
        n = s.lookahead - (MIN_MATCH - 1);
        do {
          s.ins_h = (s.ins_h << s.hash_shift ^ s.window[str + MIN_MATCH - 1]) & s.hash_mask;
          s.prev[str & s.w_mask] = s.head[s.ins_h];
          s.head[s.ins_h] = str;
          str++;
        } while (--n);
        s.strstart = str;
        s.lookahead = MIN_MATCH - 1;
        fill_window(s);
      }
      s.strstart += s.lookahead;
      s.block_start = s.strstart;
      s.insert = s.lookahead;
      s.lookahead = 0;
      s.match_length = s.prev_length = MIN_MATCH - 1;
      s.match_available = 0;
      strm.next_in = next;
      strm.input = input;
      strm.avail_in = avail;
      s.wrap = wrap;
      return Z_OK;
    }
    exports.deflateInit = deflateInit;
    exports.deflateInit2 = deflateInit2;
    exports.deflateReset = deflateReset;
    exports.deflateResetKeep = deflateResetKeep;
    exports.deflateSetHeader = deflateSetHeader;
    exports.deflate = deflate2;
    exports.deflateEnd = deflateEnd;
    exports.deflateSetDictionary = deflateSetDictionary;
    exports.deflateInfo = "pako deflate (from Nodeca project)";
  }
});

// node_modules/pako/lib/utils/strings.js
var require_strings = __commonJS({
  "node_modules/pako/lib/utils/strings.js"(exports) {
    "use strict";
    var utils = require_common();
    var STR_APPLY_OK = true;
    var STR_APPLY_UIA_OK = true;
    try {
      String.fromCharCode.apply(null, [0]);
    } catch (__) {
      STR_APPLY_OK = false;
    }
    try {
      String.fromCharCode.apply(null, new Uint8Array(1));
    } catch (__) {
      STR_APPLY_UIA_OK = false;
    }
    var _utf8len = new utils.Buf8(256);
    for (q = 0; q < 256; q++) {
      _utf8len[q] = q >= 252 ? 6 : q >= 248 ? 5 : q >= 240 ? 4 : q >= 224 ? 3 : q >= 192 ? 2 : 1;
    }
    var q;
    _utf8len[254] = _utf8len[254] = 1;
    exports.string2buf = function(str) {
      var buf, c, c2, m_pos, i, str_len = str.length, buf_len = 0;
      for (m_pos = 0; m_pos < str_len; m_pos++) {
        c = str.charCodeAt(m_pos);
        if ((c & 64512) === 55296 && m_pos + 1 < str_len) {
          c2 = str.charCodeAt(m_pos + 1);
          if ((c2 & 64512) === 56320) {
            c = 65536 + (c - 55296 << 10) + (c2 - 56320);
            m_pos++;
          }
        }
        buf_len += c < 128 ? 1 : c < 2048 ? 2 : c < 65536 ? 3 : 4;
      }
      buf = new utils.Buf8(buf_len);
      for (i = 0, m_pos = 0; i < buf_len; m_pos++) {
        c = str.charCodeAt(m_pos);
        if ((c & 64512) === 55296 && m_pos + 1 < str_len) {
          c2 = str.charCodeAt(m_pos + 1);
          if ((c2 & 64512) === 56320) {
            c = 65536 + (c - 55296 << 10) + (c2 - 56320);
            m_pos++;
          }
        }
        if (c < 128) {
          buf[i++] = c;
        } else if (c < 2048) {
          buf[i++] = 192 | c >>> 6;
          buf[i++] = 128 | c & 63;
        } else if (c < 65536) {
          buf[i++] = 224 | c >>> 12;
          buf[i++] = 128 | c >>> 6 & 63;
          buf[i++] = 128 | c & 63;
        } else {
          buf[i++] = 240 | c >>> 18;
          buf[i++] = 128 | c >>> 12 & 63;
          buf[i++] = 128 | c >>> 6 & 63;
          buf[i++] = 128 | c & 63;
        }
      }
      return buf;
    };
    function buf2binstring(buf, len) {
      if (len < 65534) {
        if (buf.subarray && STR_APPLY_UIA_OK || !buf.subarray && STR_APPLY_OK) {
          return String.fromCharCode.apply(null, utils.shrinkBuf(buf, len));
        }
      }
      var result = "";
      for (var i = 0; i < len; i++) {
        result += String.fromCharCode(buf[i]);
      }
      return result;
    }
    exports.buf2binstring = function(buf) {
      return buf2binstring(buf, buf.length);
    };
    exports.binstring2buf = function(str) {
      var buf = new utils.Buf8(str.length);
      for (var i = 0, len = buf.length; i < len; i++) {
        buf[i] = str.charCodeAt(i);
      }
      return buf;
    };
    exports.buf2string = function(buf, max) {
      var i, out, c, c_len;
      var len = max || buf.length;
      var utf16buf = new Array(len * 2);
      for (out = 0, i = 0; i < len; ) {
        c = buf[i++];
        if (c < 128) {
          utf16buf[out++] = c;
          continue;
        }
        c_len = _utf8len[c];
        if (c_len > 4) {
          utf16buf[out++] = 65533;
          i += c_len - 1;
          continue;
        }
        c &= c_len === 2 ? 31 : c_len === 3 ? 15 : 7;
        while (c_len > 1 && i < len) {
          c = c << 6 | buf[i++] & 63;
          c_len--;
        }
        if (c_len > 1) {
          utf16buf[out++] = 65533;
          continue;
        }
        if (c < 65536) {
          utf16buf[out++] = c;
        } else {
          c -= 65536;
          utf16buf[out++] = 55296 | c >> 10 & 1023;
          utf16buf[out++] = 56320 | c & 1023;
        }
      }
      return buf2binstring(utf16buf, out);
    };
    exports.utf8border = function(buf, max) {
      var pos;
      max = max || buf.length;
      if (max > buf.length) {
        max = buf.length;
      }
      pos = max - 1;
      while (pos >= 0 && (buf[pos] & 192) === 128) {
        pos--;
      }
      if (pos < 0) {
        return max;
      }
      if (pos === 0) {
        return max;
      }
      return pos + _utf8len[buf[pos]] > max ? pos : max;
    };
  }
});

// node_modules/pako/lib/zlib/zstream.js
var require_zstream = __commonJS({
  "node_modules/pako/lib/zlib/zstream.js"(exports, module2) {
    "use strict";
    function ZStream() {
      this.input = null;
      this.next_in = 0;
      this.avail_in = 0;
      this.total_in = 0;
      this.output = null;
      this.next_out = 0;
      this.avail_out = 0;
      this.total_out = 0;
      this.msg = "";
      this.state = null;
      this.data_type = 2;
      this.adler = 0;
    }
    module2.exports = ZStream;
  }
});

// node_modules/pako/lib/deflate.js
var require_deflate2 = __commonJS({
  "node_modules/pako/lib/deflate.js"(exports) {
    "use strict";
    var zlib_deflate = require_deflate();
    var utils = require_common();
    var strings = require_strings();
    var msg = require_messages();
    var ZStream = require_zstream();
    var toString = Object.prototype.toString;
    var Z_NO_FLUSH = 0;
    var Z_FINISH = 4;
    var Z_OK = 0;
    var Z_STREAM_END = 1;
    var Z_SYNC_FLUSH = 2;
    var Z_DEFAULT_COMPRESSION = -1;
    var Z_DEFAULT_STRATEGY = 0;
    var Z_DEFLATED = 8;
    function Deflate(options) {
      if (!(this instanceof Deflate))
        return new Deflate(options);
      this.options = utils.assign({
        level: Z_DEFAULT_COMPRESSION,
        method: Z_DEFLATED,
        chunkSize: 16384,
        windowBits: 15,
        memLevel: 8,
        strategy: Z_DEFAULT_STRATEGY,
        to: ""
      }, options || {});
      var opt = this.options;
      if (opt.raw && opt.windowBits > 0) {
        opt.windowBits = -opt.windowBits;
      } else if (opt.gzip && opt.windowBits > 0 && opt.windowBits < 16) {
        opt.windowBits += 16;
      }
      this.err = 0;
      this.msg = "";
      this.ended = false;
      this.chunks = [];
      this.strm = new ZStream();
      this.strm.avail_out = 0;
      var status = zlib_deflate.deflateInit2(
        this.strm,
        opt.level,
        opt.method,
        opt.windowBits,
        opt.memLevel,
        opt.strategy
      );
      if (status !== Z_OK) {
        throw new Error(msg[status]);
      }
      if (opt.header) {
        zlib_deflate.deflateSetHeader(this.strm, opt.header);
      }
      if (opt.dictionary) {
        var dict;
        if (typeof opt.dictionary === "string") {
          dict = strings.string2buf(opt.dictionary);
        } else if (toString.call(opt.dictionary) === "[object ArrayBuffer]") {
          dict = new Uint8Array(opt.dictionary);
        } else {
          dict = opt.dictionary;
        }
        status = zlib_deflate.deflateSetDictionary(this.strm, dict);
        if (status !== Z_OK) {
          throw new Error(msg[status]);
        }
        this._dict_set = true;
      }
    }
    Deflate.prototype.push = function(data, mode) {
      var strm = this.strm;
      var chunkSize = this.options.chunkSize;
      var status, _mode;
      if (this.ended) {
        return false;
      }
      _mode = mode === ~~mode ? mode : mode === true ? Z_FINISH : Z_NO_FLUSH;
      if (typeof data === "string") {
        strm.input = strings.string2buf(data);
      } else if (toString.call(data) === "[object ArrayBuffer]") {
        strm.input = new Uint8Array(data);
      } else {
        strm.input = data;
      }
      strm.next_in = 0;
      strm.avail_in = strm.input.length;
      do {
        if (strm.avail_out === 0) {
          strm.output = new utils.Buf8(chunkSize);
          strm.next_out = 0;
          strm.avail_out = chunkSize;
        }
        status = zlib_deflate.deflate(strm, _mode);
        if (status !== Z_STREAM_END && status !== Z_OK) {
          this.onEnd(status);
          this.ended = true;
          return false;
        }
        if (strm.avail_out === 0 || strm.avail_in === 0 && (_mode === Z_FINISH || _mode === Z_SYNC_FLUSH)) {
          if (this.options.to === "string") {
            this.onData(strings.buf2binstring(utils.shrinkBuf(strm.output, strm.next_out)));
          } else {
            this.onData(utils.shrinkBuf(strm.output, strm.next_out));
          }
        }
      } while ((strm.avail_in > 0 || strm.avail_out === 0) && status !== Z_STREAM_END);
      if (_mode === Z_FINISH) {
        status = zlib_deflate.deflateEnd(this.strm);
        this.onEnd(status);
        this.ended = true;
        return status === Z_OK;
      }
      if (_mode === Z_SYNC_FLUSH) {
        this.onEnd(Z_OK);
        strm.avail_out = 0;
        return true;
      }
      return true;
    };
    Deflate.prototype.onData = function(chunk) {
      this.chunks.push(chunk);
    };
    Deflate.prototype.onEnd = function(status) {
      if (status === Z_OK) {
        if (this.options.to === "string") {
          this.result = this.chunks.join("");
        } else {
          this.result = utils.flattenChunks(this.chunks);
        }
      }
      this.chunks = [];
      this.err = status;
      this.msg = this.strm.msg;
    };
    function deflate2(input, options) {
      var deflator = new Deflate(options);
      deflator.push(input, true);
      if (deflator.err) {
        throw deflator.msg || msg[deflator.err];
      }
      return deflator.result;
    }
    function deflateRaw(input, options) {
      options = options || {};
      options.raw = true;
      return deflate2(input, options);
    }
    function gzip(input, options) {
      options = options || {};
      options.gzip = true;
      return deflate2(input, options);
    }
    exports.Deflate = Deflate;
    exports.deflate = deflate2;
    exports.deflateRaw = deflateRaw;
    exports.gzip = gzip;
  }
});

// node_modules/pako/lib/zlib/inffast.js
var require_inffast = __commonJS({
  "node_modules/pako/lib/zlib/inffast.js"(exports, module2) {
    "use strict";
    var BAD = 30;
    var TYPE = 12;
    module2.exports = function inflate_fast(strm, start) {
      var state;
      var _in;
      var last;
      var _out;
      var beg;
      var end;
      var dmax;
      var wsize;
      var whave;
      var wnext;
      var s_window;
      var hold;
      var bits;
      var lcode;
      var dcode;
      var lmask;
      var dmask;
      var here;
      var op;
      var len;
      var dist;
      var from;
      var from_source;
      var input, output;
      state = strm.state;
      _in = strm.next_in;
      input = strm.input;
      last = _in + (strm.avail_in - 5);
      _out = strm.next_out;
      output = strm.output;
      beg = _out - (start - strm.avail_out);
      end = _out + (strm.avail_out - 257);
      dmax = state.dmax;
      wsize = state.wsize;
      whave = state.whave;
      wnext = state.wnext;
      s_window = state.window;
      hold = state.hold;
      bits = state.bits;
      lcode = state.lencode;
      dcode = state.distcode;
      lmask = (1 << state.lenbits) - 1;
      dmask = (1 << state.distbits) - 1;
      top:
        do {
          if (bits < 15) {
            hold += input[_in++] << bits;
            bits += 8;
            hold += input[_in++] << bits;
            bits += 8;
          }
          here = lcode[hold & lmask];
          dolen:
            for (; ; ) {
              op = here >>> 24;
              hold >>>= op;
              bits -= op;
              op = here >>> 16 & 255;
              if (op === 0) {
                output[_out++] = here & 65535;
              } else if (op & 16) {
                len = here & 65535;
                op &= 15;
                if (op) {
                  if (bits < op) {
                    hold += input[_in++] << bits;
                    bits += 8;
                  }
                  len += hold & (1 << op) - 1;
                  hold >>>= op;
                  bits -= op;
                }
                if (bits < 15) {
                  hold += input[_in++] << bits;
                  bits += 8;
                  hold += input[_in++] << bits;
                  bits += 8;
                }
                here = dcode[hold & dmask];
                dodist:
                  for (; ; ) {
                    op = here >>> 24;
                    hold >>>= op;
                    bits -= op;
                    op = here >>> 16 & 255;
                    if (op & 16) {
                      dist = here & 65535;
                      op &= 15;
                      if (bits < op) {
                        hold += input[_in++] << bits;
                        bits += 8;
                        if (bits < op) {
                          hold += input[_in++] << bits;
                          bits += 8;
                        }
                      }
                      dist += hold & (1 << op) - 1;
                      if (dist > dmax) {
                        strm.msg = "invalid distance too far back";
                        state.mode = BAD;
                        break top;
                      }
                      hold >>>= op;
                      bits -= op;
                      op = _out - beg;
                      if (dist > op) {
                        op = dist - op;
                        if (op > whave) {
                          if (state.sane) {
                            strm.msg = "invalid distance too far back";
                            state.mode = BAD;
                            break top;
                          }
                        }
                        from = 0;
                        from_source = s_window;
                        if (wnext === 0) {
                          from += wsize - op;
                          if (op < len) {
                            len -= op;
                            do {
                              output[_out++] = s_window[from++];
                            } while (--op);
                            from = _out - dist;
                            from_source = output;
                          }
                        } else if (wnext < op) {
                          from += wsize + wnext - op;
                          op -= wnext;
                          if (op < len) {
                            len -= op;
                            do {
                              output[_out++] = s_window[from++];
                            } while (--op);
                            from = 0;
                            if (wnext < len) {
                              op = wnext;
                              len -= op;
                              do {
                                output[_out++] = s_window[from++];
                              } while (--op);
                              from = _out - dist;
                              from_source = output;
                            }
                          }
                        } else {
                          from += wnext - op;
                          if (op < len) {
                            len -= op;
                            do {
                              output[_out++] = s_window[from++];
                            } while (--op);
                            from = _out - dist;
                            from_source = output;
                          }
                        }
                        while (len > 2) {
                          output[_out++] = from_source[from++];
                          output[_out++] = from_source[from++];
                          output[_out++] = from_source[from++];
                          len -= 3;
                        }
                        if (len) {
                          output[_out++] = from_source[from++];
                          if (len > 1) {
                            output[_out++] = from_source[from++];
                          }
                        }
                      } else {
                        from = _out - dist;
                        do {
                          output[_out++] = output[from++];
                          output[_out++] = output[from++];
                          output[_out++] = output[from++];
                          len -= 3;
                        } while (len > 2);
                        if (len) {
                          output[_out++] = output[from++];
                          if (len > 1) {
                            output[_out++] = output[from++];
                          }
                        }
                      }
                    } else if ((op & 64) === 0) {
                      here = dcode[(here & 65535) + (hold & (1 << op) - 1)];
                      continue dodist;
                    } else {
                      strm.msg = "invalid distance code";
                      state.mode = BAD;
                      break top;
                    }
                    break;
                  }
              } else if ((op & 64) === 0) {
                here = lcode[(here & 65535) + (hold & (1 << op) - 1)];
                continue dolen;
              } else if (op & 32) {
                state.mode = TYPE;
                break top;
              } else {
                strm.msg = "invalid literal/length code";
                state.mode = BAD;
                break top;
              }
              break;
            }
        } while (_in < last && _out < end);
      len = bits >> 3;
      _in -= len;
      bits -= len << 3;
      hold &= (1 << bits) - 1;
      strm.next_in = _in;
      strm.next_out = _out;
      strm.avail_in = _in < last ? 5 + (last - _in) : 5 - (_in - last);
      strm.avail_out = _out < end ? 257 + (end - _out) : 257 - (_out - end);
      state.hold = hold;
      state.bits = bits;
      return;
    };
  }
});

// node_modules/pako/lib/zlib/inftrees.js
var require_inftrees = __commonJS({
  "node_modules/pako/lib/zlib/inftrees.js"(exports, module2) {
    "use strict";
    var utils = require_common();
    var MAXBITS = 15;
    var ENOUGH_LENS = 852;
    var ENOUGH_DISTS = 592;
    var CODES = 0;
    var LENS = 1;
    var DISTS = 2;
    var lbase = [
      /* Length codes 257..285 base */
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      13,
      15,
      17,
      19,
      23,
      27,
      31,
      35,
      43,
      51,
      59,
      67,
      83,
      99,
      115,
      131,
      163,
      195,
      227,
      258,
      0,
      0
    ];
    var lext = [
      /* Length codes 257..285 extra */
      16,
      16,
      16,
      16,
      16,
      16,
      16,
      16,
      17,
      17,
      17,
      17,
      18,
      18,
      18,
      18,
      19,
      19,
      19,
      19,
      20,
      20,
      20,
      20,
      21,
      21,
      21,
      21,
      16,
      72,
      78
    ];
    var dbase = [
      /* Distance codes 0..29 base */
      1,
      2,
      3,
      4,
      5,
      7,
      9,
      13,
      17,
      25,
      33,
      49,
      65,
      97,
      129,
      193,
      257,
      385,
      513,
      769,
      1025,
      1537,
      2049,
      3073,
      4097,
      6145,
      8193,
      12289,
      16385,
      24577,
      0,
      0
    ];
    var dext = [
      /* Distance codes 0..29 extra */
      16,
      16,
      16,
      16,
      17,
      17,
      18,
      18,
      19,
      19,
      20,
      20,
      21,
      21,
      22,
      22,
      23,
      23,
      24,
      24,
      25,
      25,
      26,
      26,
      27,
      27,
      28,
      28,
      29,
      29,
      64,
      64
    ];
    module2.exports = function inflate_table(type, lens, lens_index, codes, table, table_index, work, opts) {
      var bits = opts.bits;
      var len = 0;
      var sym = 0;
      var min = 0, max = 0;
      var root = 0;
      var curr = 0;
      var drop = 0;
      var left = 0;
      var used = 0;
      var huff = 0;
      var incr;
      var fill;
      var low;
      var mask;
      var next;
      var base = null;
      var base_index = 0;
      var end;
      var count = new utils.Buf16(MAXBITS + 1);
      var offs = new utils.Buf16(MAXBITS + 1);
      var extra = null;
      var extra_index = 0;
      var here_bits, here_op, here_val;
      for (len = 0; len <= MAXBITS; len++) {
        count[len] = 0;
      }
      for (sym = 0; sym < codes; sym++) {
        count[lens[lens_index + sym]]++;
      }
      root = bits;
      for (max = MAXBITS; max >= 1; max--) {
        if (count[max] !== 0) {
          break;
        }
      }
      if (root > max) {
        root = max;
      }
      if (max === 0) {
        table[table_index++] = 1 << 24 | 64 << 16 | 0;
        table[table_index++] = 1 << 24 | 64 << 16 | 0;
        opts.bits = 1;
        return 0;
      }
      for (min = 1; min < max; min++) {
        if (count[min] !== 0) {
          break;
        }
      }
      if (root < min) {
        root = min;
      }
      left = 1;
      for (len = 1; len <= MAXBITS; len++) {
        left <<= 1;
        left -= count[len];
        if (left < 0) {
          return -1;
        }
      }
      if (left > 0 && (type === CODES || max !== 1)) {
        return -1;
      }
      offs[1] = 0;
      for (len = 1; len < MAXBITS; len++) {
        offs[len + 1] = offs[len] + count[len];
      }
      for (sym = 0; sym < codes; sym++) {
        if (lens[lens_index + sym] !== 0) {
          work[offs[lens[lens_index + sym]]++] = sym;
        }
      }
      if (type === CODES) {
        base = extra = work;
        end = 19;
      } else if (type === LENS) {
        base = lbase;
        base_index -= 257;
        extra = lext;
        extra_index -= 257;
        end = 256;
      } else {
        base = dbase;
        extra = dext;
        end = -1;
      }
      huff = 0;
      sym = 0;
      len = min;
      next = table_index;
      curr = root;
      drop = 0;
      low = -1;
      used = 1 << root;
      mask = used - 1;
      if (type === LENS && used > ENOUGH_LENS || type === DISTS && used > ENOUGH_DISTS) {
        return 1;
      }
      for (; ; ) {
        here_bits = len - drop;
        if (work[sym] < end) {
          here_op = 0;
          here_val = work[sym];
        } else if (work[sym] > end) {
          here_op = extra[extra_index + work[sym]];
          here_val = base[base_index + work[sym]];
        } else {
          here_op = 32 + 64;
          here_val = 0;
        }
        incr = 1 << len - drop;
        fill = 1 << curr;
        min = fill;
        do {
          fill -= incr;
          table[next + (huff >> drop) + fill] = here_bits << 24 | here_op << 16 | here_val | 0;
        } while (fill !== 0);
        incr = 1 << len - 1;
        while (huff & incr) {
          incr >>= 1;
        }
        if (incr !== 0) {
          huff &= incr - 1;
          huff += incr;
        } else {
          huff = 0;
        }
        sym++;
        if (--count[len] === 0) {
          if (len === max) {
            break;
          }
          len = lens[lens_index + work[sym]];
        }
        if (len > root && (huff & mask) !== low) {
          if (drop === 0) {
            drop = root;
          }
          next += min;
          curr = len - drop;
          left = 1 << curr;
          while (curr + drop < max) {
            left -= count[curr + drop];
            if (left <= 0) {
              break;
            }
            curr++;
            left <<= 1;
          }
          used += 1 << curr;
          if (type === LENS && used > ENOUGH_LENS || type === DISTS && used > ENOUGH_DISTS) {
            return 1;
          }
          low = huff & mask;
          table[low] = root << 24 | curr << 16 | next - table_index | 0;
        }
      }
      if (huff !== 0) {
        table[next + huff] = len - drop << 24 | 64 << 16 | 0;
      }
      opts.bits = root;
      return 0;
    };
  }
});

// node_modules/pako/lib/zlib/inflate.js
var require_inflate = __commonJS({
  "node_modules/pako/lib/zlib/inflate.js"(exports) {
    "use strict";
    var utils = require_common();
    var adler32 = require_adler32();
    var crc322 = require_crc322();
    var inflate_fast = require_inffast();
    var inflate_table = require_inftrees();
    var CODES = 0;
    var LENS = 1;
    var DISTS = 2;
    var Z_FINISH = 4;
    var Z_BLOCK = 5;
    var Z_TREES = 6;
    var Z_OK = 0;
    var Z_STREAM_END = 1;
    var Z_NEED_DICT = 2;
    var Z_STREAM_ERROR = -2;
    var Z_DATA_ERROR = -3;
    var Z_MEM_ERROR = -4;
    var Z_BUF_ERROR = -5;
    var Z_DEFLATED = 8;
    var HEAD = 1;
    var FLAGS = 2;
    var TIME = 3;
    var OS = 4;
    var EXLEN = 5;
    var EXTRA = 6;
    var NAME = 7;
    var COMMENT = 8;
    var HCRC = 9;
    var DICTID = 10;
    var DICT = 11;
    var TYPE = 12;
    var TYPEDO = 13;
    var STORED = 14;
    var COPY_ = 15;
    var COPY = 16;
    var TABLE = 17;
    var LENLENS = 18;
    var CODELENS = 19;
    var LEN_ = 20;
    var LEN = 21;
    var LENEXT = 22;
    var DIST = 23;
    var DISTEXT = 24;
    var MATCH = 25;
    var LIT = 26;
    var CHECK = 27;
    var LENGTH = 28;
    var DONE = 29;
    var BAD = 30;
    var MEM = 31;
    var SYNC = 32;
    var ENOUGH_LENS = 852;
    var ENOUGH_DISTS = 592;
    var MAX_WBITS = 15;
    var DEF_WBITS = MAX_WBITS;
    function zswap32(q) {
      return (q >>> 24 & 255) + (q >>> 8 & 65280) + ((q & 65280) << 8) + ((q & 255) << 24);
    }
    function InflateState() {
      this.mode = 0;
      this.last = false;
      this.wrap = 0;
      this.havedict = false;
      this.flags = 0;
      this.dmax = 0;
      this.check = 0;
      this.total = 0;
      this.head = null;
      this.wbits = 0;
      this.wsize = 0;
      this.whave = 0;
      this.wnext = 0;
      this.window = null;
      this.hold = 0;
      this.bits = 0;
      this.length = 0;
      this.offset = 0;
      this.extra = 0;
      this.lencode = null;
      this.distcode = null;
      this.lenbits = 0;
      this.distbits = 0;
      this.ncode = 0;
      this.nlen = 0;
      this.ndist = 0;
      this.have = 0;
      this.next = null;
      this.lens = new utils.Buf16(320);
      this.work = new utils.Buf16(288);
      this.lendyn = null;
      this.distdyn = null;
      this.sane = 0;
      this.back = 0;
      this.was = 0;
    }
    function inflateResetKeep(strm) {
      var state;
      if (!strm || !strm.state) {
        return Z_STREAM_ERROR;
      }
      state = strm.state;
      strm.total_in = strm.total_out = state.total = 0;
      strm.msg = "";
      if (state.wrap) {
        strm.adler = state.wrap & 1;
      }
      state.mode = HEAD;
      state.last = 0;
      state.havedict = 0;
      state.dmax = 32768;
      state.head = null;
      state.hold = 0;
      state.bits = 0;
      state.lencode = state.lendyn = new utils.Buf32(ENOUGH_LENS);
      state.distcode = state.distdyn = new utils.Buf32(ENOUGH_DISTS);
      state.sane = 1;
      state.back = -1;
      return Z_OK;
    }
    function inflateReset(strm) {
      var state;
      if (!strm || !strm.state) {
        return Z_STREAM_ERROR;
      }
      state = strm.state;
      state.wsize = 0;
      state.whave = 0;
      state.wnext = 0;
      return inflateResetKeep(strm);
    }
    function inflateReset2(strm, windowBits) {
      var wrap;
      var state;
      if (!strm || !strm.state) {
        return Z_STREAM_ERROR;
      }
      state = strm.state;
      if (windowBits < 0) {
        wrap = 0;
        windowBits = -windowBits;
      } else {
        wrap = (windowBits >> 4) + 1;
        if (windowBits < 48) {
          windowBits &= 15;
        }
      }
      if (windowBits && (windowBits < 8 || windowBits > 15)) {
        return Z_STREAM_ERROR;
      }
      if (state.window !== null && state.wbits !== windowBits) {
        state.window = null;
      }
      state.wrap = wrap;
      state.wbits = windowBits;
      return inflateReset(strm);
    }
    function inflateInit2(strm, windowBits) {
      var ret;
      var state;
      if (!strm) {
        return Z_STREAM_ERROR;
      }
      state = new InflateState();
      strm.state = state;
      state.window = null;
      ret = inflateReset2(strm, windowBits);
      if (ret !== Z_OK) {
        strm.state = null;
      }
      return ret;
    }
    function inflateInit(strm) {
      return inflateInit2(strm, DEF_WBITS);
    }
    var virgin = true;
    var lenfix;
    var distfix;
    function fixedtables(state) {
      if (virgin) {
        var sym;
        lenfix = new utils.Buf32(512);
        distfix = new utils.Buf32(32);
        sym = 0;
        while (sym < 144) {
          state.lens[sym++] = 8;
        }
        while (sym < 256) {
          state.lens[sym++] = 9;
        }
        while (sym < 280) {
          state.lens[sym++] = 7;
        }
        while (sym < 288) {
          state.lens[sym++] = 8;
        }
        inflate_table(LENS, state.lens, 0, 288, lenfix, 0, state.work, { bits: 9 });
        sym = 0;
        while (sym < 32) {
          state.lens[sym++] = 5;
        }
        inflate_table(DISTS, state.lens, 0, 32, distfix, 0, state.work, { bits: 5 });
        virgin = false;
      }
      state.lencode = lenfix;
      state.lenbits = 9;
      state.distcode = distfix;
      state.distbits = 5;
    }
    function updatewindow(strm, src, end, copy) {
      var dist;
      var state = strm.state;
      if (state.window === null) {
        state.wsize = 1 << state.wbits;
        state.wnext = 0;
        state.whave = 0;
        state.window = new utils.Buf8(state.wsize);
      }
      if (copy >= state.wsize) {
        utils.arraySet(state.window, src, end - state.wsize, state.wsize, 0);
        state.wnext = 0;
        state.whave = state.wsize;
      } else {
        dist = state.wsize - state.wnext;
        if (dist > copy) {
          dist = copy;
        }
        utils.arraySet(state.window, src, end - copy, dist, state.wnext);
        copy -= dist;
        if (copy) {
          utils.arraySet(state.window, src, end - copy, copy, 0);
          state.wnext = copy;
          state.whave = state.wsize;
        } else {
          state.wnext += dist;
          if (state.wnext === state.wsize) {
            state.wnext = 0;
          }
          if (state.whave < state.wsize) {
            state.whave += dist;
          }
        }
      }
      return 0;
    }
    function inflate2(strm, flush) {
      var state;
      var input, output;
      var next;
      var put;
      var have, left;
      var hold;
      var bits;
      var _in, _out;
      var copy;
      var from;
      var from_source;
      var here = 0;
      var here_bits, here_op, here_val;
      var last_bits, last_op, last_val;
      var len;
      var ret;
      var hbuf = new utils.Buf8(4);
      var opts;
      var n;
      var order = (
        /* permutation of code lengths */
        [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]
      );
      if (!strm || !strm.state || !strm.output || !strm.input && strm.avail_in !== 0) {
        return Z_STREAM_ERROR;
      }
      state = strm.state;
      if (state.mode === TYPE) {
        state.mode = TYPEDO;
      }
      put = strm.next_out;
      output = strm.output;
      left = strm.avail_out;
      next = strm.next_in;
      input = strm.input;
      have = strm.avail_in;
      hold = state.hold;
      bits = state.bits;
      _in = have;
      _out = left;
      ret = Z_OK;
      inf_leave:
        for (; ; ) {
          switch (state.mode) {
            case HEAD:
              if (state.wrap === 0) {
                state.mode = TYPEDO;
                break;
              }
              while (bits < 16) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              if (state.wrap & 2 && hold === 35615) {
                state.check = 0;
                hbuf[0] = hold & 255;
                hbuf[1] = hold >>> 8 & 255;
                state.check = crc322(state.check, hbuf, 2, 0);
                hold = 0;
                bits = 0;
                state.mode = FLAGS;
                break;
              }
              state.flags = 0;
              if (state.head) {
                state.head.done = false;
              }
              if (!(state.wrap & 1) || /* check if zlib header allowed */
              (((hold & 255) << 8) + (hold >> 8)) % 31) {
                strm.msg = "incorrect header check";
                state.mode = BAD;
                break;
              }
              if ((hold & 15) !== Z_DEFLATED) {
                strm.msg = "unknown compression method";
                state.mode = BAD;
                break;
              }
              hold >>>= 4;
              bits -= 4;
              len = (hold & 15) + 8;
              if (state.wbits === 0) {
                state.wbits = len;
              } else if (len > state.wbits) {
                strm.msg = "invalid window size";
                state.mode = BAD;
                break;
              }
              state.dmax = 1 << len;
              strm.adler = state.check = 1;
              state.mode = hold & 512 ? DICTID : TYPE;
              hold = 0;
              bits = 0;
              break;
            case FLAGS:
              while (bits < 16) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              state.flags = hold;
              if ((state.flags & 255) !== Z_DEFLATED) {
                strm.msg = "unknown compression method";
                state.mode = BAD;
                break;
              }
              if (state.flags & 57344) {
                strm.msg = "unknown header flags set";
                state.mode = BAD;
                break;
              }
              if (state.head) {
                state.head.text = hold >> 8 & 1;
              }
              if (state.flags & 512) {
                hbuf[0] = hold & 255;
                hbuf[1] = hold >>> 8 & 255;
                state.check = crc322(state.check, hbuf, 2, 0);
              }
              hold = 0;
              bits = 0;
              state.mode = TIME;
            case TIME:
              while (bits < 32) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              if (state.head) {
                state.head.time = hold;
              }
              if (state.flags & 512) {
                hbuf[0] = hold & 255;
                hbuf[1] = hold >>> 8 & 255;
                hbuf[2] = hold >>> 16 & 255;
                hbuf[3] = hold >>> 24 & 255;
                state.check = crc322(state.check, hbuf, 4, 0);
              }
              hold = 0;
              bits = 0;
              state.mode = OS;
            case OS:
              while (bits < 16) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              if (state.head) {
                state.head.xflags = hold & 255;
                state.head.os = hold >> 8;
              }
              if (state.flags & 512) {
                hbuf[0] = hold & 255;
                hbuf[1] = hold >>> 8 & 255;
                state.check = crc322(state.check, hbuf, 2, 0);
              }
              hold = 0;
              bits = 0;
              state.mode = EXLEN;
            case EXLEN:
              if (state.flags & 1024) {
                while (bits < 16) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                state.length = hold;
                if (state.head) {
                  state.head.extra_len = hold;
                }
                if (state.flags & 512) {
                  hbuf[0] = hold & 255;
                  hbuf[1] = hold >>> 8 & 255;
                  state.check = crc322(state.check, hbuf, 2, 0);
                }
                hold = 0;
                bits = 0;
              } else if (state.head) {
                state.head.extra = null;
              }
              state.mode = EXTRA;
            case EXTRA:
              if (state.flags & 1024) {
                copy = state.length;
                if (copy > have) {
                  copy = have;
                }
                if (copy) {
                  if (state.head) {
                    len = state.head.extra_len - state.length;
                    if (!state.head.extra) {
                      state.head.extra = new Array(state.head.extra_len);
                    }
                    utils.arraySet(
                      state.head.extra,
                      input,
                      next,
                      // extra field is limited to 65536 bytes
                      // - no need for additional size check
                      copy,
                      /*len + copy > state.head.extra_max - len ? state.head.extra_max : copy,*/
                      len
                    );
                  }
                  if (state.flags & 512) {
                    state.check = crc322(state.check, input, copy, next);
                  }
                  have -= copy;
                  next += copy;
                  state.length -= copy;
                }
                if (state.length) {
                  break inf_leave;
                }
              }
              state.length = 0;
              state.mode = NAME;
            case NAME:
              if (state.flags & 2048) {
                if (have === 0) {
                  break inf_leave;
                }
                copy = 0;
                do {
                  len = input[next + copy++];
                  if (state.head && len && state.length < 65536) {
                    state.head.name += String.fromCharCode(len);
                  }
                } while (len && copy < have);
                if (state.flags & 512) {
                  state.check = crc322(state.check, input, copy, next);
                }
                have -= copy;
                next += copy;
                if (len) {
                  break inf_leave;
                }
              } else if (state.head) {
                state.head.name = null;
              }
              state.length = 0;
              state.mode = COMMENT;
            case COMMENT:
              if (state.flags & 4096) {
                if (have === 0) {
                  break inf_leave;
                }
                copy = 0;
                do {
                  len = input[next + copy++];
                  if (state.head && len && state.length < 65536) {
                    state.head.comment += String.fromCharCode(len);
                  }
                } while (len && copy < have);
                if (state.flags & 512) {
                  state.check = crc322(state.check, input, copy, next);
                }
                have -= copy;
                next += copy;
                if (len) {
                  break inf_leave;
                }
              } else if (state.head) {
                state.head.comment = null;
              }
              state.mode = HCRC;
            case HCRC:
              if (state.flags & 512) {
                while (bits < 16) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                if (hold !== (state.check & 65535)) {
                  strm.msg = "header crc mismatch";
                  state.mode = BAD;
                  break;
                }
                hold = 0;
                bits = 0;
              }
              if (state.head) {
                state.head.hcrc = state.flags >> 9 & 1;
                state.head.done = true;
              }
              strm.adler = state.check = 0;
              state.mode = TYPE;
              break;
            case DICTID:
              while (bits < 32) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              strm.adler = state.check = zswap32(hold);
              hold = 0;
              bits = 0;
              state.mode = DICT;
            case DICT:
              if (state.havedict === 0) {
                strm.next_out = put;
                strm.avail_out = left;
                strm.next_in = next;
                strm.avail_in = have;
                state.hold = hold;
                state.bits = bits;
                return Z_NEED_DICT;
              }
              strm.adler = state.check = 1;
              state.mode = TYPE;
            case TYPE:
              if (flush === Z_BLOCK || flush === Z_TREES) {
                break inf_leave;
              }
            case TYPEDO:
              if (state.last) {
                hold >>>= bits & 7;
                bits -= bits & 7;
                state.mode = CHECK;
                break;
              }
              while (bits < 3) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              state.last = hold & 1;
              hold >>>= 1;
              bits -= 1;
              switch (hold & 3) {
                case 0:
                  state.mode = STORED;
                  break;
                case 1:
                  fixedtables(state);
                  state.mode = LEN_;
                  if (flush === Z_TREES) {
                    hold >>>= 2;
                    bits -= 2;
                    break inf_leave;
                  }
                  break;
                case 2:
                  state.mode = TABLE;
                  break;
                case 3:
                  strm.msg = "invalid block type";
                  state.mode = BAD;
              }
              hold >>>= 2;
              bits -= 2;
              break;
            case STORED:
              hold >>>= bits & 7;
              bits -= bits & 7;
              while (bits < 32) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              if ((hold & 65535) !== (hold >>> 16 ^ 65535)) {
                strm.msg = "invalid stored block lengths";
                state.mode = BAD;
                break;
              }
              state.length = hold & 65535;
              hold = 0;
              bits = 0;
              state.mode = COPY_;
              if (flush === Z_TREES) {
                break inf_leave;
              }
            case COPY_:
              state.mode = COPY;
            case COPY:
              copy = state.length;
              if (copy) {
                if (copy > have) {
                  copy = have;
                }
                if (copy > left) {
                  copy = left;
                }
                if (copy === 0) {
                  break inf_leave;
                }
                utils.arraySet(output, input, next, copy, put);
                have -= copy;
                next += copy;
                left -= copy;
                put += copy;
                state.length -= copy;
                break;
              }
              state.mode = TYPE;
              break;
            case TABLE:
              while (bits < 14) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              state.nlen = (hold & 31) + 257;
              hold >>>= 5;
              bits -= 5;
              state.ndist = (hold & 31) + 1;
              hold >>>= 5;
              bits -= 5;
              state.ncode = (hold & 15) + 4;
              hold >>>= 4;
              bits -= 4;
              if (state.nlen > 286 || state.ndist > 30) {
                strm.msg = "too many length or distance symbols";
                state.mode = BAD;
                break;
              }
              state.have = 0;
              state.mode = LENLENS;
            case LENLENS:
              while (state.have < state.ncode) {
                while (bits < 3) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                state.lens[order[state.have++]] = hold & 7;
                hold >>>= 3;
                bits -= 3;
              }
              while (state.have < 19) {
                state.lens[order[state.have++]] = 0;
              }
              state.lencode = state.lendyn;
              state.lenbits = 7;
              opts = { bits: state.lenbits };
              ret = inflate_table(CODES, state.lens, 0, 19, state.lencode, 0, state.work, opts);
              state.lenbits = opts.bits;
              if (ret) {
                strm.msg = "invalid code lengths set";
                state.mode = BAD;
                break;
              }
              state.have = 0;
              state.mode = CODELENS;
            case CODELENS:
              while (state.have < state.nlen + state.ndist) {
                for (; ; ) {
                  here = state.lencode[hold & (1 << state.lenbits) - 1];
                  here_bits = here >>> 24;
                  here_op = here >>> 16 & 255;
                  here_val = here & 65535;
                  if (here_bits <= bits) {
                    break;
                  }
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                if (here_val < 16) {
                  hold >>>= here_bits;
                  bits -= here_bits;
                  state.lens[state.have++] = here_val;
                } else {
                  if (here_val === 16) {
                    n = here_bits + 2;
                    while (bits < n) {
                      if (have === 0) {
                        break inf_leave;
                      }
                      have--;
                      hold += input[next++] << bits;
                      bits += 8;
                    }
                    hold >>>= here_bits;
                    bits -= here_bits;
                    if (state.have === 0) {
                      strm.msg = "invalid bit length repeat";
                      state.mode = BAD;
                      break;
                    }
                    len = state.lens[state.have - 1];
                    copy = 3 + (hold & 3);
                    hold >>>= 2;
                    bits -= 2;
                  } else if (here_val === 17) {
                    n = here_bits + 3;
                    while (bits < n) {
                      if (have === 0) {
                        break inf_leave;
                      }
                      have--;
                      hold += input[next++] << bits;
                      bits += 8;
                    }
                    hold >>>= here_bits;
                    bits -= here_bits;
                    len = 0;
                    copy = 3 + (hold & 7);
                    hold >>>= 3;
                    bits -= 3;
                  } else {
                    n = here_bits + 7;
                    while (bits < n) {
                      if (have === 0) {
                        break inf_leave;
                      }
                      have--;
                      hold += input[next++] << bits;
                      bits += 8;
                    }
                    hold >>>= here_bits;
                    bits -= here_bits;
                    len = 0;
                    copy = 11 + (hold & 127);
                    hold >>>= 7;
                    bits -= 7;
                  }
                  if (state.have + copy > state.nlen + state.ndist) {
                    strm.msg = "invalid bit length repeat";
                    state.mode = BAD;
                    break;
                  }
                  while (copy--) {
                    state.lens[state.have++] = len;
                  }
                }
              }
              if (state.mode === BAD) {
                break;
              }
              if (state.lens[256] === 0) {
                strm.msg = "invalid code -- missing end-of-block";
                state.mode = BAD;
                break;
              }
              state.lenbits = 9;
              opts = { bits: state.lenbits };
              ret = inflate_table(LENS, state.lens, 0, state.nlen, state.lencode, 0, state.work, opts);
              state.lenbits = opts.bits;
              if (ret) {
                strm.msg = "invalid literal/lengths set";
                state.mode = BAD;
                break;
              }
              state.distbits = 6;
              state.distcode = state.distdyn;
              opts = { bits: state.distbits };
              ret = inflate_table(DISTS, state.lens, state.nlen, state.ndist, state.distcode, 0, state.work, opts);
              state.distbits = opts.bits;
              if (ret) {
                strm.msg = "invalid distances set";
                state.mode = BAD;
                break;
              }
              state.mode = LEN_;
              if (flush === Z_TREES) {
                break inf_leave;
              }
            case LEN_:
              state.mode = LEN;
            case LEN:
              if (have >= 6 && left >= 258) {
                strm.next_out = put;
                strm.avail_out = left;
                strm.next_in = next;
                strm.avail_in = have;
                state.hold = hold;
                state.bits = bits;
                inflate_fast(strm, _out);
                put = strm.next_out;
                output = strm.output;
                left = strm.avail_out;
                next = strm.next_in;
                input = strm.input;
                have = strm.avail_in;
                hold = state.hold;
                bits = state.bits;
                if (state.mode === TYPE) {
                  state.back = -1;
                }
                break;
              }
              state.back = 0;
              for (; ; ) {
                here = state.lencode[hold & (1 << state.lenbits) - 1];
                here_bits = here >>> 24;
                here_op = here >>> 16 & 255;
                here_val = here & 65535;
                if (here_bits <= bits) {
                  break;
                }
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              if (here_op && (here_op & 240) === 0) {
                last_bits = here_bits;
                last_op = here_op;
                last_val = here_val;
                for (; ; ) {
                  here = state.lencode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> last_bits)];
                  here_bits = here >>> 24;
                  here_op = here >>> 16 & 255;
                  here_val = here & 65535;
                  if (last_bits + here_bits <= bits) {
                    break;
                  }
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                hold >>>= last_bits;
                bits -= last_bits;
                state.back += last_bits;
              }
              hold >>>= here_bits;
              bits -= here_bits;
              state.back += here_bits;
              state.length = here_val;
              if (here_op === 0) {
                state.mode = LIT;
                break;
              }
              if (here_op & 32) {
                state.back = -1;
                state.mode = TYPE;
                break;
              }
              if (here_op & 64) {
                strm.msg = "invalid literal/length code";
                state.mode = BAD;
                break;
              }
              state.extra = here_op & 15;
              state.mode = LENEXT;
            case LENEXT:
              if (state.extra) {
                n = state.extra;
                while (bits < n) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                state.length += hold & (1 << state.extra) - 1;
                hold >>>= state.extra;
                bits -= state.extra;
                state.back += state.extra;
              }
              state.was = state.length;
              state.mode = DIST;
            case DIST:
              for (; ; ) {
                here = state.distcode[hold & (1 << state.distbits) - 1];
                here_bits = here >>> 24;
                here_op = here >>> 16 & 255;
                here_val = here & 65535;
                if (here_bits <= bits) {
                  break;
                }
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              if ((here_op & 240) === 0) {
                last_bits = here_bits;
                last_op = here_op;
                last_val = here_val;
                for (; ; ) {
                  here = state.distcode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> last_bits)];
                  here_bits = here >>> 24;
                  here_op = here >>> 16 & 255;
                  here_val = here & 65535;
                  if (last_bits + here_bits <= bits) {
                    break;
                  }
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                hold >>>= last_bits;
                bits -= last_bits;
                state.back += last_bits;
              }
              hold >>>= here_bits;
              bits -= here_bits;
              state.back += here_bits;
              if (here_op & 64) {
                strm.msg = "invalid distance code";
                state.mode = BAD;
                break;
              }
              state.offset = here_val;
              state.extra = here_op & 15;
              state.mode = DISTEXT;
            case DISTEXT:
              if (state.extra) {
                n = state.extra;
                while (bits < n) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                state.offset += hold & (1 << state.extra) - 1;
                hold >>>= state.extra;
                bits -= state.extra;
                state.back += state.extra;
              }
              if (state.offset > state.dmax) {
                strm.msg = "invalid distance too far back";
                state.mode = BAD;
                break;
              }
              state.mode = MATCH;
            case MATCH:
              if (left === 0) {
                break inf_leave;
              }
              copy = _out - left;
              if (state.offset > copy) {
                copy = state.offset - copy;
                if (copy > state.whave) {
                  if (state.sane) {
                    strm.msg = "invalid distance too far back";
                    state.mode = BAD;
                    break;
                  }
                }
                if (copy > state.wnext) {
                  copy -= state.wnext;
                  from = state.wsize - copy;
                } else {
                  from = state.wnext - copy;
                }
                if (copy > state.length) {
                  copy = state.length;
                }
                from_source = state.window;
              } else {
                from_source = output;
                from = put - state.offset;
                copy = state.length;
              }
              if (copy > left) {
                copy = left;
              }
              left -= copy;
              state.length -= copy;
              do {
                output[put++] = from_source[from++];
              } while (--copy);
              if (state.length === 0) {
                state.mode = LEN;
              }
              break;
            case LIT:
              if (left === 0) {
                break inf_leave;
              }
              output[put++] = state.length;
              left--;
              state.mode = LEN;
              break;
            case CHECK:
              if (state.wrap) {
                while (bits < 32) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold |= input[next++] << bits;
                  bits += 8;
                }
                _out -= left;
                strm.total_out += _out;
                state.total += _out;
                if (_out) {
                  strm.adler = state.check = /*UPDATE(state.check, put - _out, _out);*/
                  state.flags ? crc322(state.check, output, _out, put - _out) : adler32(state.check, output, _out, put - _out);
                }
                _out = left;
                if ((state.flags ? hold : zswap32(hold)) !== state.check) {
                  strm.msg = "incorrect data check";
                  state.mode = BAD;
                  break;
                }
                hold = 0;
                bits = 0;
              }
              state.mode = LENGTH;
            case LENGTH:
              if (state.wrap && state.flags) {
                while (bits < 32) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                if (hold !== (state.total & 4294967295)) {
                  strm.msg = "incorrect length check";
                  state.mode = BAD;
                  break;
                }
                hold = 0;
                bits = 0;
              }
              state.mode = DONE;
            case DONE:
              ret = Z_STREAM_END;
              break inf_leave;
            case BAD:
              ret = Z_DATA_ERROR;
              break inf_leave;
            case MEM:
              return Z_MEM_ERROR;
            case SYNC:
            default:
              return Z_STREAM_ERROR;
          }
        }
      strm.next_out = put;
      strm.avail_out = left;
      strm.next_in = next;
      strm.avail_in = have;
      state.hold = hold;
      state.bits = bits;
      if (state.wsize || _out !== strm.avail_out && state.mode < BAD && (state.mode < CHECK || flush !== Z_FINISH)) {
        if (updatewindow(strm, strm.output, strm.next_out, _out - strm.avail_out)) {
          state.mode = MEM;
          return Z_MEM_ERROR;
        }
      }
      _in -= strm.avail_in;
      _out -= strm.avail_out;
      strm.total_in += _in;
      strm.total_out += _out;
      state.total += _out;
      if (state.wrap && _out) {
        strm.adler = state.check = /*UPDATE(state.check, strm.next_out - _out, _out);*/
        state.flags ? crc322(state.check, output, _out, strm.next_out - _out) : adler32(state.check, output, _out, strm.next_out - _out);
      }
      strm.data_type = state.bits + (state.last ? 64 : 0) + (state.mode === TYPE ? 128 : 0) + (state.mode === LEN_ || state.mode === COPY_ ? 256 : 0);
      if ((_in === 0 && _out === 0 || flush === Z_FINISH) && ret === Z_OK) {
        ret = Z_BUF_ERROR;
      }
      return ret;
    }
    function inflateEnd(strm) {
      if (!strm || !strm.state) {
        return Z_STREAM_ERROR;
      }
      var state = strm.state;
      if (state.window) {
        state.window = null;
      }
      strm.state = null;
      return Z_OK;
    }
    function inflateGetHeader(strm, head) {
      var state;
      if (!strm || !strm.state) {
        return Z_STREAM_ERROR;
      }
      state = strm.state;
      if ((state.wrap & 2) === 0) {
        return Z_STREAM_ERROR;
      }
      state.head = head;
      head.done = false;
      return Z_OK;
    }
    function inflateSetDictionary(strm, dictionary) {
      var dictLength = dictionary.length;
      var state;
      var dictid;
      var ret;
      if (!strm || !strm.state) {
        return Z_STREAM_ERROR;
      }
      state = strm.state;
      if (state.wrap !== 0 && state.mode !== DICT) {
        return Z_STREAM_ERROR;
      }
      if (state.mode === DICT) {
        dictid = 1;
        dictid = adler32(dictid, dictionary, dictLength, 0);
        if (dictid !== state.check) {
          return Z_DATA_ERROR;
        }
      }
      ret = updatewindow(strm, dictionary, dictLength, dictLength);
      if (ret) {
        state.mode = MEM;
        return Z_MEM_ERROR;
      }
      state.havedict = 1;
      return Z_OK;
    }
    exports.inflateReset = inflateReset;
    exports.inflateReset2 = inflateReset2;
    exports.inflateResetKeep = inflateResetKeep;
    exports.inflateInit = inflateInit;
    exports.inflateInit2 = inflateInit2;
    exports.inflate = inflate2;
    exports.inflateEnd = inflateEnd;
    exports.inflateGetHeader = inflateGetHeader;
    exports.inflateSetDictionary = inflateSetDictionary;
    exports.inflateInfo = "pako inflate (from Nodeca project)";
  }
});

// node_modules/pako/lib/zlib/constants.js
var require_constants = __commonJS({
  "node_modules/pako/lib/zlib/constants.js"(exports, module2) {
    "use strict";
    module2.exports = {
      /* Allowed flush values; see deflate() and inflate() below for details */
      Z_NO_FLUSH: 0,
      Z_PARTIAL_FLUSH: 1,
      Z_SYNC_FLUSH: 2,
      Z_FULL_FLUSH: 3,
      Z_FINISH: 4,
      Z_BLOCK: 5,
      Z_TREES: 6,
      /* Return codes for the compression/decompression functions. Negative values
      * are errors, positive values are used for special but normal events.
      */
      Z_OK: 0,
      Z_STREAM_END: 1,
      Z_NEED_DICT: 2,
      Z_ERRNO: -1,
      Z_STREAM_ERROR: -2,
      Z_DATA_ERROR: -3,
      //Z_MEM_ERROR:     -4,
      Z_BUF_ERROR: -5,
      //Z_VERSION_ERROR: -6,
      /* compression levels */
      Z_NO_COMPRESSION: 0,
      Z_BEST_SPEED: 1,
      Z_BEST_COMPRESSION: 9,
      Z_DEFAULT_COMPRESSION: -1,
      Z_FILTERED: 1,
      Z_HUFFMAN_ONLY: 2,
      Z_RLE: 3,
      Z_FIXED: 4,
      Z_DEFAULT_STRATEGY: 0,
      /* Possible values of the data_type field (though see inflate()) */
      Z_BINARY: 0,
      Z_TEXT: 1,
      //Z_ASCII:                1, // = Z_TEXT (deprecated)
      Z_UNKNOWN: 2,
      /* The deflate compression method */
      Z_DEFLATED: 8
      //Z_NULL:                 null // Use -1 or null inline, depending on var type
    };
  }
});

// node_modules/pako/lib/zlib/gzheader.js
var require_gzheader = __commonJS({
  "node_modules/pako/lib/zlib/gzheader.js"(exports, module2) {
    "use strict";
    function GZheader() {
      this.text = 0;
      this.time = 0;
      this.xflags = 0;
      this.os = 0;
      this.extra = null;
      this.extra_len = 0;
      this.name = "";
      this.comment = "";
      this.hcrc = 0;
      this.done = false;
    }
    module2.exports = GZheader;
  }
});

// node_modules/pako/lib/inflate.js
var require_inflate2 = __commonJS({
  "node_modules/pako/lib/inflate.js"(exports) {
    "use strict";
    var zlib_inflate = require_inflate();
    var utils = require_common();
    var strings = require_strings();
    var c = require_constants();
    var msg = require_messages();
    var ZStream = require_zstream();
    var GZheader = require_gzheader();
    var toString = Object.prototype.toString;
    function Inflate(options) {
      if (!(this instanceof Inflate))
        return new Inflate(options);
      this.options = utils.assign({
        chunkSize: 16384,
        windowBits: 0,
        to: ""
      }, options || {});
      var opt = this.options;
      if (opt.raw && opt.windowBits >= 0 && opt.windowBits < 16) {
        opt.windowBits = -opt.windowBits;
        if (opt.windowBits === 0) {
          opt.windowBits = -15;
        }
      }
      if (opt.windowBits >= 0 && opt.windowBits < 16 && !(options && options.windowBits)) {
        opt.windowBits += 32;
      }
      if (opt.windowBits > 15 && opt.windowBits < 48) {
        if ((opt.windowBits & 15) === 0) {
          opt.windowBits |= 15;
        }
      }
      this.err = 0;
      this.msg = "";
      this.ended = false;
      this.chunks = [];
      this.strm = new ZStream();
      this.strm.avail_out = 0;
      var status = zlib_inflate.inflateInit2(
        this.strm,
        opt.windowBits
      );
      if (status !== c.Z_OK) {
        throw new Error(msg[status]);
      }
      this.header = new GZheader();
      zlib_inflate.inflateGetHeader(this.strm, this.header);
      if (opt.dictionary) {
        if (typeof opt.dictionary === "string") {
          opt.dictionary = strings.string2buf(opt.dictionary);
        } else if (toString.call(opt.dictionary) === "[object ArrayBuffer]") {
          opt.dictionary = new Uint8Array(opt.dictionary);
        }
        if (opt.raw) {
          status = zlib_inflate.inflateSetDictionary(this.strm, opt.dictionary);
          if (status !== c.Z_OK) {
            throw new Error(msg[status]);
          }
        }
      }
    }
    Inflate.prototype.push = function(data, mode) {
      var strm = this.strm;
      var chunkSize = this.options.chunkSize;
      var dictionary = this.options.dictionary;
      var status, _mode;
      var next_out_utf8, tail, utf8str;
      var allowBufError = false;
      if (this.ended) {
        return false;
      }
      _mode = mode === ~~mode ? mode : mode === true ? c.Z_FINISH : c.Z_NO_FLUSH;
      if (typeof data === "string") {
        strm.input = strings.binstring2buf(data);
      } else if (toString.call(data) === "[object ArrayBuffer]") {
        strm.input = new Uint8Array(data);
      } else {
        strm.input = data;
      }
      strm.next_in = 0;
      strm.avail_in = strm.input.length;
      do {
        if (strm.avail_out === 0) {
          strm.output = new utils.Buf8(chunkSize);
          strm.next_out = 0;
          strm.avail_out = chunkSize;
        }
        status = zlib_inflate.inflate(strm, c.Z_NO_FLUSH);
        if (status === c.Z_NEED_DICT && dictionary) {
          status = zlib_inflate.inflateSetDictionary(this.strm, dictionary);
        }
        if (status === c.Z_BUF_ERROR && allowBufError === true) {
          status = c.Z_OK;
          allowBufError = false;
        }
        if (status !== c.Z_STREAM_END && status !== c.Z_OK) {
          this.onEnd(status);
          this.ended = true;
          return false;
        }
        if (strm.next_out) {
          if (strm.avail_out === 0 || status === c.Z_STREAM_END || strm.avail_in === 0 && (_mode === c.Z_FINISH || _mode === c.Z_SYNC_FLUSH)) {
            if (this.options.to === "string") {
              next_out_utf8 = strings.utf8border(strm.output, strm.next_out);
              tail = strm.next_out - next_out_utf8;
              utf8str = strings.buf2string(strm.output, next_out_utf8);
              strm.next_out = tail;
              strm.avail_out = chunkSize - tail;
              if (tail) {
                utils.arraySet(strm.output, strm.output, next_out_utf8, tail, 0);
              }
              this.onData(utf8str);
            } else {
              this.onData(utils.shrinkBuf(strm.output, strm.next_out));
            }
          }
        }
        if (strm.avail_in === 0 && strm.avail_out === 0) {
          allowBufError = true;
        }
      } while ((strm.avail_in > 0 || strm.avail_out === 0) && status !== c.Z_STREAM_END);
      if (status === c.Z_STREAM_END) {
        _mode = c.Z_FINISH;
      }
      if (_mode === c.Z_FINISH) {
        status = zlib_inflate.inflateEnd(this.strm);
        this.onEnd(status);
        this.ended = true;
        return status === c.Z_OK;
      }
      if (_mode === c.Z_SYNC_FLUSH) {
        this.onEnd(c.Z_OK);
        strm.avail_out = 0;
        return true;
      }
      return true;
    };
    Inflate.prototype.onData = function(chunk) {
      this.chunks.push(chunk);
    };
    Inflate.prototype.onEnd = function(status) {
      if (status === c.Z_OK) {
        if (this.options.to === "string") {
          this.result = this.chunks.join("");
        } else {
          this.result = utils.flattenChunks(this.chunks);
        }
      }
      this.chunks = [];
      this.err = status;
      this.msg = this.strm.msg;
    };
    function inflate2(input, options) {
      var inflator = new Inflate(options);
      inflator.push(input, true);
      if (inflator.err) {
        throw inflator.msg || msg[inflator.err];
      }
      return inflator.result;
    }
    function inflateRaw(input, options) {
      options = options || {};
      options.raw = true;
      return inflate2(input, options);
    }
    exports.Inflate = Inflate;
    exports.inflate = inflate2;
    exports.inflateRaw = inflateRaw;
    exports.ungzip = inflate2;
  }
});

// node_modules/pako/index.js
var require_pako = __commonJS({
  "node_modules/pako/index.js"(exports, module2) {
    "use strict";
    var assign = require_common().assign;
    var deflate2 = require_deflate2();
    var inflate2 = require_inflate2();
    var constants = require_constants();
    var pako2 = {};
    assign(pako2, deflate2, inflate2, constants);
    module2.exports = pako2;
  }
});

// node_modules/pify/index.js
var require_pify = __commonJS({
  "node_modules/pify/index.js"(exports, module2) {
    "use strict";
    var processFn = (fn, options) => function(...args) {
      const P = options.promiseModule;
      return new P((resolve, reject) => {
        if (options.multiArgs) {
          args.push((...result) => {
            if (options.errorFirst) {
              if (result[0]) {
                reject(result);
              } else {
                result.shift();
                resolve(result);
              }
            } else {
              resolve(result);
            }
          });
        } else if (options.errorFirst) {
          args.push((error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          });
        } else {
          args.push(resolve);
        }
        fn.apply(this, args);
      });
    };
    module2.exports = (input, options) => {
      options = Object.assign({
        exclude: [/.+(Sync|Stream)$/],
        errorFirst: true,
        promiseModule: Promise
      }, options);
      const objType = typeof input;
      if (!(input !== null && (objType === "object" || objType === "function"))) {
        throw new TypeError(`Expected \`input\` to be a \`Function\` or \`Object\`, got \`${input === null ? "null" : objType}\``);
      }
      const filter = (key) => {
        const match = (pattern) => typeof pattern === "string" ? key === pattern : pattern.test(key);
        return options.include ? options.include.some(match) : !options.exclude.some(match);
      };
      let ret;
      if (objType === "function") {
        ret = function(...args) {
          return options.excludeMain ? input(...args) : processFn(input, options).apply(this, args);
        };
      } else {
        ret = Object.create(Object.getPrototypeOf(input));
      }
      for (const key in input) {
        const property = input[key];
        ret[key] = typeof property === "function" && filter(key) ? processFn(property, options) : property;
      }
      return ret;
    };
  }
});

// node_modules/ignore/index.js
var require_ignore = __commonJS({
  "node_modules/ignore/index.js"(exports, module2) {
    function makeArray(subject) {
      return Array.isArray(subject) ? subject : [subject];
    }
    var EMPTY = "";
    var SPACE = " ";
    var ESCAPE = "\\";
    var REGEX_TEST_BLANK_LINE = /^\s+$/;
    var REGEX_INVALID_TRAILING_BACKSLASH = /(?:[^\\]|^)\\$/;
    var REGEX_REPLACE_LEADING_EXCAPED_EXCLAMATION = /^\\!/;
    var REGEX_REPLACE_LEADING_EXCAPED_HASH = /^\\#/;
    var REGEX_SPLITALL_CRLF = /\r?\n/g;
    var REGEX_TEST_INVALID_PATH = /^\.*\/|^\.+$/;
    var SLASH = "/";
    var TMP_KEY_IGNORE = "node-ignore";
    if (typeof Symbol !== "undefined") {
      TMP_KEY_IGNORE = Symbol.for("node-ignore");
    }
    var KEY_IGNORE = TMP_KEY_IGNORE;
    var define2 = (object, key, value) => Object.defineProperty(object, key, { value });
    var REGEX_REGEXP_RANGE = /([0-z])-([0-z])/g;
    var RETURN_FALSE = () => false;
    var sanitizeRange = (range) => range.replace(
      REGEX_REGEXP_RANGE,
      (match, from, to) => from.charCodeAt(0) <= to.charCodeAt(0) ? match : EMPTY
    );
    var cleanRangeBackSlash = (slashes) => {
      const { length } = slashes;
      return slashes.slice(0, length - length % 2);
    };
    var REPLACERS = [
      [
        // remove BOM
        // TODO:
        // Other similar zero-width characters?
        /^\uFEFF/,
        () => EMPTY
      ],
      // > Trailing spaces are ignored unless they are quoted with backslash ("\")
      [
        // (a\ ) -> (a )
        // (a  ) -> (a)
        // (a ) -> (a)
        // (a \ ) -> (a  )
        /((?:\\\\)*?)(\\?\s+)$/,
        (_, m1, m2) => m1 + (m2.indexOf("\\") === 0 ? SPACE : EMPTY)
      ],
      // replace (\ ) with ' '
      // (\ ) -> ' '
      // (\\ ) -> '\\ '
      // (\\\ ) -> '\\ '
      [
        /(\\+?)\s/g,
        (_, m1) => {
          const { length } = m1;
          return m1.slice(0, length - length % 2) + SPACE;
        }
      ],
      // Escape metacharacters
      // which is written down by users but means special for regular expressions.
      // > There are 12 characters with special meanings:
      // > - the backslash \,
      // > - the caret ^,
      // > - the dollar sign $,
      // > - the period or dot .,
      // > - the vertical bar or pipe symbol |,
      // > - the question mark ?,
      // > - the asterisk or star *,
      // > - the plus sign +,
      // > - the opening parenthesis (,
      // > - the closing parenthesis ),
      // > - and the opening square bracket [,
      // > - the opening curly brace {,
      // > These special characters are often called "metacharacters".
      [
        /[\\$.|*+(){^]/g,
        (match) => `\\${match}`
      ],
      [
        // > a question mark (?) matches a single character
        /(?!\\)\?/g,
        () => "[^/]"
      ],
      // leading slash
      [
        // > A leading slash matches the beginning of the pathname.
        // > For example, "/*.c" matches "cat-file.c" but not "mozilla-sha1/sha1.c".
        // A leading slash matches the beginning of the pathname
        /^\//,
        () => "^"
      ],
      // replace special metacharacter slash after the leading slash
      [
        /\//g,
        () => "\\/"
      ],
      [
        // > A leading "**" followed by a slash means match in all directories.
        // > For example, "**/foo" matches file or directory "foo" anywhere,
        // > the same as pattern "foo".
        // > "**/foo/bar" matches file or directory "bar" anywhere that is directly
        // >   under directory "foo".
        // Notice that the '*'s have been replaced as '\\*'
        /^\^*\\\*\\\*\\\//,
        // '**/foo' <-> 'foo'
        () => "^(?:.*\\/)?"
      ],
      // starting
      [
        // there will be no leading '/'
        //   (which has been replaced by section "leading slash")
        // If starts with '**', adding a '^' to the regular expression also works
        /^(?=[^^])/,
        function startingReplacer() {
          return !/\/(?!$)/.test(this) ? "(?:^|\\/)" : "^";
        }
      ],
      // two globstars
      [
        // Use lookahead assertions so that we could match more than one `'/**'`
        /\\\/\\\*\\\*(?=\\\/|$)/g,
        // Zero, one or several directories
        // should not use '*', or it will be replaced by the next replacer
        // Check if it is not the last `'/**'`
        (_, index, str) => index + 6 < str.length ? "(?:\\/[^\\/]+)*" : "\\/.+"
      ],
      // normal intermediate wildcards
      [
        // Never replace escaped '*'
        // ignore rule '\*' will match the path '*'
        // 'abc.*/' -> go
        // 'abc.*'  -> skip this rule,
        //    coz trailing single wildcard will be handed by [trailing wildcard]
        /(^|[^\\]+)(\\\*)+(?=.+)/g,
        // '*.js' matches '.js'
        // '*.js' doesn't match 'abc'
        (_, p1, p2) => {
          const unescaped = p2.replace(/\\\*/g, "[^\\/]*");
          return p1 + unescaped;
        }
      ],
      [
        // unescape, revert step 3 except for back slash
        // For example, if a user escape a '\\*',
        // after step 3, the result will be '\\\\\\*'
        /\\\\\\(?=[$.|*+(){^])/g,
        () => ESCAPE
      ],
      [
        // '\\\\' -> '\\'
        /\\\\/g,
        () => ESCAPE
      ],
      [
        // > The range notation, e.g. [a-zA-Z],
        // > can be used to match one of the characters in a range.
        // `\` is escaped by step 3
        /(\\)?\[([^\]/]*?)(\\*)($|\])/g,
        (match, leadEscape, range, endEscape, close) => leadEscape === ESCAPE ? `\\[${range}${cleanRangeBackSlash(endEscape)}${close}` : close === "]" ? endEscape.length % 2 === 0 ? `[${sanitizeRange(range)}${endEscape}]` : "[]" : "[]"
      ],
      // ending
      [
        // 'js' will not match 'js.'
        // 'ab' will not match 'abc'
        /(?:[^*])$/,
        // WTF!
        // https://git-scm.com/docs/gitignore
        // changes in [2.22.1](https://git-scm.com/docs/gitignore/2.22.1)
        // which re-fixes #24, #38
        // > If there is a separator at the end of the pattern then the pattern
        // > will only match directories, otherwise the pattern can match both
        // > files and directories.
        // 'js*' will not match 'a.js'
        // 'js/' will not match 'a.js'
        // 'js' will match 'a.js' and 'a.js/'
        (match) => /\/$/.test(match) ? `${match}$` : `${match}(?=$|\\/$)`
      ],
      // trailing wildcard
      [
        /(\^|\\\/)?\\\*$/,
        (_, p1) => {
          const prefix = p1 ? `${p1}[^/]+` : "[^/]*";
          return `${prefix}(?=$|\\/$)`;
        }
      ]
    ];
    var regexCache = /* @__PURE__ */ Object.create(null);
    var makeRegex = (pattern, ignoreCase) => {
      let source = regexCache[pattern];
      if (!source) {
        source = REPLACERS.reduce(
          (prev, [matcher, replacer]) => prev.replace(matcher, replacer.bind(pattern)),
          pattern
        );
        regexCache[pattern] = source;
      }
      return ignoreCase ? new RegExp(source, "i") : new RegExp(source);
    };
    var isString = (subject) => typeof subject === "string";
    var checkPattern = (pattern) => pattern && isString(pattern) && !REGEX_TEST_BLANK_LINE.test(pattern) && !REGEX_INVALID_TRAILING_BACKSLASH.test(pattern) && pattern.indexOf("#") !== 0;
    var splitPattern = (pattern) => pattern.split(REGEX_SPLITALL_CRLF);
    var IgnoreRule = class {
      constructor(origin, pattern, negative, regex) {
        this.origin = origin;
        this.pattern = pattern;
        this.negative = negative;
        this.regex = regex;
      }
    };
    var createRule = (pattern, ignoreCase) => {
      const origin = pattern;
      let negative = false;
      if (pattern.indexOf("!") === 0) {
        negative = true;
        pattern = pattern.substr(1);
      }
      pattern = pattern.replace(REGEX_REPLACE_LEADING_EXCAPED_EXCLAMATION, "!").replace(REGEX_REPLACE_LEADING_EXCAPED_HASH, "#");
      const regex = makeRegex(pattern, ignoreCase);
      return new IgnoreRule(
        origin,
        pattern,
        negative,
        regex
      );
    };
    var throwError = (message, Ctor) => {
      throw new Ctor(message);
    };
    var checkPath = (path, originalPath, doThrow) => {
      if (!isString(path)) {
        return doThrow(
          `path must be a string, but got \`${originalPath}\``,
          TypeError
        );
      }
      if (!path) {
        return doThrow(`path must not be empty`, TypeError);
      }
      if (checkPath.isNotRelative(path)) {
        const r = "`path.relative()`d";
        return doThrow(
          `path should be a ${r} string, but got "${originalPath}"`,
          RangeError
        );
      }
      return true;
    };
    var isNotRelative = (path) => REGEX_TEST_INVALID_PATH.test(path);
    checkPath.isNotRelative = isNotRelative;
    checkPath.convert = (p) => p;
    var Ignore = class {
      constructor({
        ignorecase = true,
        ignoreCase = ignorecase,
        allowRelativePaths = false
      } = {}) {
        define2(this, KEY_IGNORE, true);
        this._rules = [];
        this._ignoreCase = ignoreCase;
        this._allowRelativePaths = allowRelativePaths;
        this._initCache();
      }
      _initCache() {
        this._ignoreCache = /* @__PURE__ */ Object.create(null);
        this._testCache = /* @__PURE__ */ Object.create(null);
      }
      _addPattern(pattern) {
        if (pattern && pattern[KEY_IGNORE]) {
          this._rules = this._rules.concat(pattern._rules);
          this._added = true;
          return;
        }
        if (checkPattern(pattern)) {
          const rule = createRule(pattern, this._ignoreCase);
          this._added = true;
          this._rules.push(rule);
        }
      }
      // @param {Array<string> | string | Ignore} pattern
      add(pattern) {
        this._added = false;
        makeArray(
          isString(pattern) ? splitPattern(pattern) : pattern
        ).forEach(this._addPattern, this);
        if (this._added) {
          this._initCache();
        }
        return this;
      }
      // legacy
      addPattern(pattern) {
        return this.add(pattern);
      }
      //          |           ignored : unignored
      // negative |   0:0   |   0:1   |   1:0   |   1:1
      // -------- | ------- | ------- | ------- | --------
      //     0    |  TEST   |  TEST   |  SKIP   |    X
      //     1    |  TESTIF |  SKIP   |  TEST   |    X
      // - SKIP: always skip
      // - TEST: always test
      // - TESTIF: only test if checkUnignored
      // - X: that never happen
      // @param {boolean} whether should check if the path is unignored,
      //   setting `checkUnignored` to `false` could reduce additional
      //   path matching.
      // @returns {TestResult} true if a file is ignored
      _testOne(path, checkUnignored) {
        let ignored = false;
        let unignored = false;
        this._rules.forEach((rule) => {
          const { negative } = rule;
          if (unignored === negative && ignored !== unignored || negative && !ignored && !unignored && !checkUnignored) {
            return;
          }
          const matched = rule.regex.test(path);
          if (matched) {
            ignored = !negative;
            unignored = negative;
          }
        });
        return {
          ignored,
          unignored
        };
      }
      // @returns {TestResult}
      _test(originalPath, cache, checkUnignored, slices) {
        const path = originalPath && checkPath.convert(originalPath);
        checkPath(
          path,
          originalPath,
          this._allowRelativePaths ? RETURN_FALSE : throwError
        );
        return this._t(path, cache, checkUnignored, slices);
      }
      _t(path, cache, checkUnignored, slices) {
        if (path in cache) {
          return cache[path];
        }
        if (!slices) {
          slices = path.split(SLASH);
        }
        slices.pop();
        if (!slices.length) {
          return cache[path] = this._testOne(path, checkUnignored);
        }
        const parent = this._t(
          slices.join(SLASH) + SLASH,
          cache,
          checkUnignored,
          slices
        );
        return cache[path] = parent.ignored ? parent : this._testOne(path, checkUnignored);
      }
      ignores(path) {
        return this._test(path, this._ignoreCache, false).ignored;
      }
      createFilter() {
        return (path) => !this.ignores(path);
      }
      filter(paths) {
        return makeArray(paths).filter(this.createFilter());
      }
      // @returns {TestResult}
      test(path) {
        return this._test(path, this._testCache, true);
      }
    };
    var factory = (options) => new Ignore(options);
    var isPathValid = (path) => checkPath(path && checkPath.convert(path), path, RETURN_FALSE);
    factory.isPathValid = isPathValid;
    factory.default = factory;
    module2.exports = factory;
    if (
      // Detect `process` so that it can run in browsers.
      typeof process !== "undefined" && (process.env && process.env.IGNORE_TEST_WIN32 || process.platform === "win32")
    ) {
      const makePosix = (str) => /^\\\\\?\\/.test(str) || /["<>|\u0000-\u001F]+/u.test(str) ? str : str.replace(/\\/g, "/");
      checkPath.convert = makePosix;
      const REGIX_IS_WINDOWS_PATH_ABSOLUTE = /^[a-z]:\//i;
      checkPath.isNotRelative = (path) => REGIX_IS_WINDOWS_PATH_ABSOLUTE.test(path) || isNotRelative(path);
    }
  }
});

// node_modules/clean-git-ref/lib/index.js
var require_lib2 = __commonJS({
  "node_modules/clean-git-ref/lib/index.js"(exports, module2) {
    "use strict";
    function escapeRegExp(string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    function replaceAll(str, search, replacement) {
      search = search instanceof RegExp ? search : new RegExp(escapeRegExp(search), "g");
      return str.replace(search, replacement);
    }
    var CleanGitRef = {
      clean: function clean(value) {
        if (typeof value !== "string") {
          throw new Error("Expected a string, received: " + value);
        }
        value = replaceAll(value, "./", "/");
        value = replaceAll(value, "..", ".");
        value = replaceAll(value, " ", "-");
        value = replaceAll(value, /^[~^:?*\\\-]/g, "");
        value = replaceAll(value, /[~^:?*\\]/g, "-");
        value = replaceAll(value, /[~^:?*\\\-]$/g, "");
        value = replaceAll(value, "@{", "-");
        value = replaceAll(value, /\.$/g, "");
        value = replaceAll(value, /\/$/g, "");
        value = replaceAll(value, /\.lock$/g, "");
        return value;
      }
    };
    module2.exports = CleanGitRef;
  }
});

// node_modules/diff3/onp.js
var require_onp = __commonJS({
  "node_modules/diff3/onp.js"(exports, module2) {
    module2.exports = function(a_, b_) {
      var a = a_, b = b_, m = a.length, n = b.length, reverse = false, ed = null, offset = m + 1, path = [], pathposi = [], ses = [], lcs = "", SES_DELETE = -1, SES_COMMON = 0, SES_ADD = 1;
      var tmp1, tmp2;
      var init2 = function() {
        if (m >= n) {
          tmp1 = a;
          tmp2 = m;
          a = b;
          b = tmp1;
          m = n;
          n = tmp2;
          reverse = true;
          offset = m + 1;
        }
      };
      var P = function(x, y, k) {
        return {
          "x": x,
          "y": y,
          "k": k
        };
      };
      var seselem = function(elem, t) {
        return {
          "elem": elem,
          "t": t
        };
      };
      var snake = function(k, p, pp) {
        var r, x, y;
        if (p > pp) {
          r = path[k - 1 + offset];
        } else {
          r = path[k + 1 + offset];
        }
        y = Math.max(p, pp);
        x = y - k;
        while (x < m && y < n && a[x] === b[y]) {
          ++x;
          ++y;
        }
        path[k + offset] = pathposi.length;
        pathposi[pathposi.length] = new P(x, y, r);
        return y;
      };
      var recordseq = function(epc) {
        var x_idx, y_idx, px_idx, py_idx, i;
        x_idx = y_idx = 1;
        px_idx = py_idx = 0;
        for (i = epc.length - 1; i >= 0; --i) {
          while (px_idx < epc[i].x || py_idx < epc[i].y) {
            if (epc[i].y - epc[i].x > py_idx - px_idx) {
              if (reverse) {
                ses[ses.length] = new seselem(b[py_idx], SES_DELETE);
              } else {
                ses[ses.length] = new seselem(b[py_idx], SES_ADD);
              }
              ++y_idx;
              ++py_idx;
            } else if (epc[i].y - epc[i].x < py_idx - px_idx) {
              if (reverse) {
                ses[ses.length] = new seselem(a[px_idx], SES_ADD);
              } else {
                ses[ses.length] = new seselem(a[px_idx], SES_DELETE);
              }
              ++x_idx;
              ++px_idx;
            } else {
              ses[ses.length] = new seselem(a[px_idx], SES_COMMON);
              lcs += a[px_idx];
              ++x_idx;
              ++y_idx;
              ++px_idx;
              ++py_idx;
            }
          }
        }
      };
      init2();
      return {
        SES_DELETE: -1,
        SES_COMMON: 0,
        SES_ADD: 1,
        editdistance: function() {
          return ed;
        },
        getlcs: function() {
          return lcs;
        },
        getses: function() {
          return ses;
        },
        compose: function() {
          var delta, size, fp, p, r, epc, i, k;
          delta = n - m;
          size = m + n + 3;
          fp = {};
          for (i = 0; i < size; ++i) {
            fp[i] = -1;
            path[i] = -1;
          }
          p = -1;
          do {
            ++p;
            for (k = -p; k <= delta - 1; ++k) {
              fp[k + offset] = snake(k, fp[k - 1 + offset] + 1, fp[k + 1 + offset]);
            }
            for (k = delta + p; k >= delta + 1; --k) {
              fp[k + offset] = snake(k, fp[k - 1 + offset] + 1, fp[k + 1 + offset]);
            }
            fp[delta + offset] = snake(delta, fp[delta - 1 + offset] + 1, fp[delta + 1 + offset]);
          } while (fp[delta + offset] !== n);
          ed = delta + 2 * p;
          r = path[delta + offset];
          epc = [];
          while (r !== -1) {
            epc[epc.length] = new P(pathposi[r].x, pathposi[r].y, null);
            r = pathposi[r].k;
          }
          recordseq(epc);
        }
      };
    };
  }
});

// node_modules/diff3/diff3.js
var require_diff3 = __commonJS({
  "node_modules/diff3/diff3.js"(exports, module2) {
    var onp = require_onp();
    function longestCommonSubsequence(file1, file2) {
      var diff = new onp(file1, file2);
      diff.compose();
      var ses = diff.getses();
      var root;
      var prev;
      var file1RevIdx = file1.length - 1, file2RevIdx = file2.length - 1;
      for (var i = ses.length - 1; i >= 0; --i) {
        if (ses[i].t === diff.SES_COMMON) {
          if (prev) {
            prev.chain = {
              file1index: file1RevIdx,
              file2index: file2RevIdx,
              chain: null
            };
            prev = prev.chain;
          } else {
            root = {
              file1index: file1RevIdx,
              file2index: file2RevIdx,
              chain: null
            };
            prev = root;
          }
          file1RevIdx--;
          file2RevIdx--;
        } else if (ses[i].t === diff.SES_DELETE) {
          file1RevIdx--;
        } else if (ses[i].t === diff.SES_ADD) {
          file2RevIdx--;
        }
      }
      var tail = {
        file1index: -1,
        file2index: -1,
        chain: null
      };
      if (!prev) {
        return tail;
      }
      prev.chain = tail;
      return root;
    }
    function diffIndices(file1, file2) {
      var result = [];
      var tail1 = file1.length;
      var tail2 = file2.length;
      for (var candidate = longestCommonSubsequence(file1, file2); candidate !== null; candidate = candidate.chain) {
        var mismatchLength1 = tail1 - candidate.file1index - 1;
        var mismatchLength2 = tail2 - candidate.file2index - 1;
        tail1 = candidate.file1index;
        tail2 = candidate.file2index;
        if (mismatchLength1 || mismatchLength2) {
          result.push({
            file1: [tail1 + 1, mismatchLength1],
            file2: [tail2 + 1, mismatchLength2]
          });
        }
      }
      result.reverse();
      return result;
    }
    function diff3MergeIndices(a, o, b) {
      var i;
      var m1 = diffIndices(o, a);
      var m2 = diffIndices(o, b);
      var hunks = [];
      function addHunk(h, side2) {
        hunks.push([h.file1[0], side2, h.file1[1], h.file2[0], h.file2[1]]);
      }
      for (i = 0; i < m1.length; i++) {
        addHunk(m1[i], 0);
      }
      for (i = 0; i < m2.length; i++) {
        addHunk(m2[i], 2);
      }
      hunks.sort(function(x, y) {
        return x[0] - y[0];
      });
      var result = [];
      var commonOffset = 0;
      function copyCommon(targetOffset) {
        if (targetOffset > commonOffset) {
          result.push([1, commonOffset, targetOffset - commonOffset]);
          commonOffset = targetOffset;
        }
      }
      for (var hunkIndex = 0; hunkIndex < hunks.length; hunkIndex++) {
        var firstHunkIndex = hunkIndex;
        var hunk = hunks[hunkIndex];
        var regionLhs = hunk[0];
        var regionRhs = regionLhs + hunk[2];
        while (hunkIndex < hunks.length - 1) {
          var maybeOverlapping = hunks[hunkIndex + 1];
          var maybeLhs = maybeOverlapping[0];
          if (maybeLhs > regionRhs)
            break;
          regionRhs = Math.max(regionRhs, maybeLhs + maybeOverlapping[2]);
          hunkIndex++;
        }
        copyCommon(regionLhs);
        if (firstHunkIndex == hunkIndex) {
          if (hunk[4] > 0) {
            result.push([hunk[1], hunk[3], hunk[4]]);
          }
        } else {
          var regions = {
            0: [a.length, -1, o.length, -1],
            2: [b.length, -1, o.length, -1]
          };
          for (i = firstHunkIndex; i <= hunkIndex; i++) {
            hunk = hunks[i];
            var side = hunk[1];
            var r = regions[side];
            var oLhs = hunk[0];
            var oRhs = oLhs + hunk[2];
            var abLhs = hunk[3];
            var abRhs = abLhs + hunk[4];
            r[0] = Math.min(abLhs, r[0]);
            r[1] = Math.max(abRhs, r[1]);
            r[2] = Math.min(oLhs, r[2]);
            r[3] = Math.max(oRhs, r[3]);
          }
          var aLhs = regions[0][0] + (regionLhs - regions[0][2]);
          var aRhs = regions[0][1] + (regionRhs - regions[0][3]);
          var bLhs = regions[2][0] + (regionLhs - regions[2][2]);
          var bRhs = regions[2][1] + (regionRhs - regions[2][3]);
          result.push([
            -1,
            aLhs,
            aRhs - aLhs,
            regionLhs,
            regionRhs - regionLhs,
            bLhs,
            bRhs - bLhs
          ]);
        }
        commonOffset = regionRhs;
      }
      copyCommon(o.length);
      return result;
    }
    function diff3Merge2(a, o, b) {
      var result = [];
      var files = [a, o, b];
      var indices = diff3MergeIndices(a, o, b);
      var okLines = [];
      function flushOk() {
        if (okLines.length) {
          result.push({
            ok: okLines
          });
        }
        okLines = [];
      }
      function pushOk(xs) {
        for (var j = 0; j < xs.length; j++) {
          okLines.push(xs[j]);
        }
      }
      function isTrueConflict(rec) {
        if (rec[2] != rec[6])
          return true;
        var aoff = rec[1];
        var boff = rec[5];
        for (var j = 0; j < rec[2]; j++) {
          if (a[j + aoff] != b[j + boff])
            return true;
        }
        return false;
      }
      for (var i = 0; i < indices.length; i++) {
        var x = indices[i];
        var side = x[0];
        if (side == -1) {
          if (!isTrueConflict(x)) {
            pushOk(files[0].slice(x[1], x[1] + x[2]));
          } else {
            flushOk();
            result.push({
              conflict: {
                a: a.slice(x[1], x[1] + x[2]),
                aIndex: x[1],
                o: o.slice(x[3], x[3] + x[4]),
                oIndex: x[3],
                b: b.slice(x[5], x[5] + x[6]),
                bIndex: x[5]
              }
            });
          }
        } else {
          pushOk(files[side].slice(x[1], x[1] + x[2]));
        }
      }
      flushOk();
      return result;
    }
    module2.exports = diff3Merge2;
  }
});

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => LLMWikiDashboardPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian31 = require("obsidian");

// src/modules/heatmap/types.ts
var REPORT_LABELS = {
  daily: "\u65E5\u62A5",
  weekly: "\u5468\u62A5",
  monthly: "\u6708\u62A5",
  quarterly: "\u5B63\u62A5",
  yearly: "\u5E74\u62A5"
};

// src/modules/task-quickadd/types.ts
var DEFAULT_TASK_DEFAULTS = {
  urgent: "",
  normal: "",
  low: "",
  ongoing: "",
  ongoingPercent: "0"
};

// src/types.ts
var MODULE_IDS = [
  "file-stats",
  "heatmap",
  "llm-command",
  "operation-log",
  "git-sync",
  "remotely-save",
  "task-quickadd",
  "plugin-manage",
  "voice-transcription",
  "large-files"
];
var MODULE_LABELS = {
  "file-stats": "\u6587\u4EF6\u7EDF\u8BA1",
  heatmap: "\u5DE5\u4F5C\u70ED\u529B\u56FE",
  "llm-command": "LLM \u6307\u4EE4\u6267\u884C",
  "operation-log": "\u64CD\u4F5C\u65E5\u5FD7",
  "git-sync": "Git \u540C\u6B65",
  "remotely-save": "\u4E91\u540C\u6B65\u8BB0\u5F55",
  "task-quickadd": "\u5FEB\u901F\u6DFB\u52A0\u4EFB\u52A1",
  "plugin-manage": "\u63D2\u4EF6\u7BA1\u7406",
  "voice-transcription": "\u8BED\u97F3\u8F6C\u6587\u5B57",
  "large-files": "\u5927\u6587\u4EF6"
};
function defaultModuleVisibility() {
  const all = Object.fromEntries(MODULE_IDS.map((id) => [id, true]));
  all["voice-transcription"] = false;
  return all;
}
var defaultReportConfigs = {
  daily: { enabled: true, confirmBeforeCreate: true, directory: "raw/dayReport", filenameFormat: "YYYY/MM/YYYY-MM-DD", templatePath: "raw/dayReport/template" },
  weekly: { enabled: false, confirmBeforeCreate: true, directory: "raw/weekReport", filenameFormat: "YYYY/MM/YYYY-[W]ww", templatePath: "raw/weekReport/template" },
  monthly: { enabled: false, confirmBeforeCreate: true, directory: "raw/monthReport", filenameFormat: "YYYY/MM/YYYY-MM", templatePath: "raw/monthReport/template" },
  quarterly: { enabled: false, confirmBeforeCreate: true, directory: "raw/quarterReport", filenameFormat: "YYYY/MM/YYYY-[Q]Q", templatePath: "raw/quarterReport/template" },
  yearly: { enabled: false, confirmBeforeCreate: true, directory: "raw/yearReport", filenameFormat: "YYYY/YYYY", templatePath: "raw/yearReport/template" }
};
var DEFAULT_SETTINGS = {
  apiBaseUrl: "https://api.openai.com/v1",
  apiKey: "",
  modelName: "gpt-4o",
  temperature: 0.7,
  maxTokens: 2048,
  tokenUsageApiUrl: "",
  tokenBalanceApiUrl: "",
  trackedFolders: ["raw", "wiki", "outputs", "concepts", "entities"],
  lastConnectionStatus: "untested",
  lastConnectionTime: "",
  reportConfigs: defaultReportConfigs,
  taskDefaults: DEFAULT_TASK_DEFAULTS,
  dashboardTitle: "Dashboard",
  dashboardDesc: "\u79B9\u601D\u5929\u4E0B\u6709\u6EBA\u8005\uFF0C\u7531\u5DF1\u6EBA\u4E4B\u4E5F\uFF1B\u7A37\u601D\u5929\u4E0B\u6709\u9965\u8005\uFF0C\u7531\u5DF1\u9965\u4E4B\u4E5F\u3002",
  gitEnabled: false,
  gitRemoteURL: "",
  gitRemoteName: "origin",
  gitBranchName: "main",
  gitUsername: "",
  gitPassword: "",
  gitAutoPushEnabled: false,
  gitAutoPushInterval: 30,
  gitPollInterval: 30,
  gitPushTimeout: 5,
  gitCommitTemplate: "auto: {{date}} {{time}}",
  moduleOrder: [
    "file-stats",
    "heatmap",
    "llm-command",
    "operation-log",
    "git-sync",
    "remotely-save",
    "task-quickadd",
    "plugin-manage",
    "large-files"
  ],
  moduleVisibility: defaultModuleVisibility(),
  moduleDeviceVisibility: {
    "file-stats": "both",
    "heatmap": "both",
    "llm-command": "both",
    "operation-log": "both",
    "git-sync": "both",
    "remotely-save": "both",
    "task-quickadd": "both",
    "plugin-manage": "both",
    "voice-transcription": "both",
    "large-files": "both"
  },
  openOnStartup: false,
  heatmapDataPath: ".dashboard/heatmap.json",
  tokenUsageDataPath: ".dashboard/token-usage.json",
  whisperModelName: "whisper-1",
  whisperApiBaseUrl: "",
  largeFilesMinSizeKB: 0,
  largeFilesMaxCount: 20
};

// src/ui/DashboardView.ts
var import_obsidian26 = require("obsidian");

// src/services/FileService.ts
var import_obsidian = require("obsidian");
var FileService = class {
  constructor(app) {
    this.app = app;
  }
  async getStats(trackedFolders) {
    var _a, _b;
    const allFiles = this.app.vault.getFiles();
    const total = allFiles.length;
    const folderStats = trackedFolders.map((folderPath) => {
      const count = this.countFilesInFolder(folderPath, allFiles);
      return { name: folderPath, count };
    });
    const mdFiles = allFiles.filter((f) => f.extension === "md");
    const linkedFiles = /* @__PURE__ */ new Set();
    const filesWithSource = /* @__PURE__ */ new Set();
    for (const file of mdFiles) {
      const cache = this.app.metadataCache.getFileCache(file);
      const links = (_a = cache == null ? void 0 : cache.links) != null ? _a : [];
      const embeds = (_b = cache == null ? void 0 : cache.embeds) != null ? _b : [];
      for (const link of [...links, ...embeds]) {
        const resolved = this.app.metadataCache.getFirstLinkpathDest(link.link, file.path);
        if (resolved)
          linkedFiles.add(resolved.path);
      }
      const fm = cache == null ? void 0 : cache.frontmatter;
      if (fm && (fm["source"] || fm["sources"] || fm["origin"])) {
        filesWithSource.add(file.path);
      }
    }
    const orphanFilesArr = mdFiles.filter((f) => !linkedFiles.has(f.path));
    const nosourceFilesArr = mdFiles.filter((f) => !filesWithSource.has(f.path));
    const orphanCount = orphanFilesArr.length;
    const nosourceCount = nosourceFilesArr.length;
    const emptyFilesArr = [];
    const maybeEmpty = mdFiles.filter((f) => f.stat.size === 0);
    for (const f of maybeEmpty)
      emptyFilesArr.push(f.path);
    const smallFiles = mdFiles.filter(
      (f) => f.stat.size > 0 && f.stat.size <= 256 && !emptyFilesArr.includes(f.path)
    );
    if (smallFiles.length > 0) {
      const checks = await Promise.all(
        smallFiles.map(async (f) => {
          const content = await this.app.vault.cachedRead(f);
          return content.trim().length === 0 ? f.path : null;
        })
      );
      for (const p of checks) {
        if (p)
          emptyFilesArr.push(p);
      }
    }
    const emptyCount = emptyFilesArr.length;
    const healthScore = this.calcHealthScore(mdFiles.length, orphanCount, nosourceCount, emptyCount);
    return {
      total,
      folderStats,
      orphanCount,
      nosourceCount,
      emptyCount,
      healthScore,
      orphanFiles: orphanFilesArr.map((f) => f.path),
      nosourceFiles: nosourceFilesArr.map((f) => f.path),
      emptyFilesList: emptyFilesArr
    };
  }
  countFilesInFolder(folderPath, allFiles) {
    const folder = this.findFolder(folderPath);
    if (folder) {
      const prefix = folder.path + "/";
      return allFiles.filter((f) => f.path.startsWith(prefix)).length;
    }
    return allFiles.filter((f) => f.path.startsWith(folderPath + "/")).length;
  }
  findFolder(path) {
    const pathLower = path.toLowerCase();
    let found = null;
    this.app.vault.getAllLoadedFiles().forEach((f) => {
      if (f instanceof import_obsidian.TFolder && f.path.toLowerCase() === pathLower) {
        found = f;
      }
    });
    return found;
  }
  calcHealthScore(total, orphan, nosource, empty) {
    if (total === 0)
      return 100;
    const score = 100 - orphan / total * 40 - nosource / total * 30 - empty / total * 30;
    return Math.max(0, Math.round(score));
  }
  getFolderPaths() {
    const paths = [];
    this.app.vault.getAllLoadedFiles().forEach((f) => {
      if (f instanceof import_obsidian.TFolder && f.path !== "/") {
        paths.push(f.path);
      }
    });
    return [...new Set(paths)].sort();
  }
  async openFile(path) {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof import_obsidian.TFile) {
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file);
    }
  }
  // ─── Recently modified files ──────────────────────────────────────────
  getRecentlyModified(limit = 5) {
    const mdFiles = this.app.vault.getFiles().filter((f) => f.extension === "md");
    return mdFiles.sort((a, b) => b.stat.mtime - a.stat.mtime).slice(0, limit).map((f) => ({ path: f.path, mtime: f.stat.mtime }));
  }
  getLatestInFolder(folderPrefix) {
    const prefix = folderPrefix.replace(/^\/+|\/+$/g, "") + "/";
    const files = this.app.vault.getFiles().filter((f2) => f2.path.startsWith(prefix)).sort((a, b) => b.stat.mtime - a.stat.mtime);
    if (files.length === 0)
      return null;
    const f = files[0];
    return { path: f.path, mtime: f.stat.mtime };
  }
  async toggleFolderInExplorer(name2) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
    let leaves = this.app.workspace.getLeavesOfType("file-explorer");
    if (leaves.length === 0) {
      const leaf = this.app.workspace.getLeftLeaf(false);
      if (leaf)
        await leaf.setViewState({ type: "file-explorer" });
      leaves = this.app.workspace.getLeavesOfType("file-explorer");
    }
    if (leaves.length === 0)
      return;
    const view = leaves[0].view;
    const fileItems = view.fileItems;
    if (!fileItems)
      return;
    const isMap = fileItems instanceof Map;
    const findKey = (target) => {
      if (isMap ? fileItems.has(target) : target in fileItems)
        return target;
      const lower2 = target.toLowerCase();
      const keys = isMap ? [...fileItems.keys()] : Object.keys(fileItems);
      for (const key of keys) {
        if (key.toLowerCase() === lower2)
          return key;
      }
      return null;
    };
    const matchKey = findKey(name2);
    if (!matchKey)
      return;
    const item = isMap ? fileItems.get(matchKey) : fileItems[matchKey];
    if (!item)
      return;
    const findTreeComponent = (it) => {
      var _a2;
      if (!it)
        return null;
      if (typeof it.setCollapsed === "function")
        return it;
      const vc = it.vChildren;
      if (!vc)
        return null;
      if (typeof vc.setCollapsed === "function")
        return vc;
      for (const kid of (_a2 = vc._children) != null ? _a2 : []) {
        if (typeof kid.setCollapsed === "function")
          return kid;
      }
      return null;
    };
    const parts = matchKey.split("/");
    let ancPath = "";
    for (let i = 0; i < parts.length - 1; i++) {
      ancPath += (ancPath ? "/" : "") + parts[i];
      const ancItem = isMap ? fileItems.get(ancPath) : fileItems[ancPath];
      const anc = findTreeComponent(ancItem);
      if ((ancItem == null ? void 0 : ancItem.collapsed) && typeof (anc == null ? void 0 : anc.setCollapsed) === "function") {
        anc.setCollapsed(false);
        await new Promise((r) => setTimeout(r, 50));
        const nextPart = parts[i + 1].toLowerCase();
        const siblings = (_b = (_a = anc.vChildren) == null ? void 0 : _a._children) != null ? _b : [];
        for (const sib of siblings) {
          const sibName = (_e = (_d = (_c = sib == null ? void 0 : sib.file) == null ? void 0 : _c.name) == null ? void 0 : _d.toLowerCase()) != null ? _e : "";
          if (sibName && sibName !== nextPart && typeof sib.setCollapsed === "function") {
            sib.setCollapsed(true);
          }
        }
      }
    }
    const comp = findTreeComponent(item);
    if (comp && typeof comp.setCollapsed === "function") {
      comp.setCollapsed(!((_f = item.collapsed) != null ? _f : true));
    }
    await new Promise((r) => setTimeout(r, 300));
    const folder = this.findFolder(matchKey);
    if (folder) {
      try {
        const fe = (_h = (_g = this.app.internalPlugins) == null ? void 0 : _g.plugins) == null ? void 0 : _h["file-explorer"];
        if (typeof ((_i = fe == null ? void 0 : fe.instance) == null ? void 0 : _i.revealInFolder) === "function") {
          fe.instance.revealInFolder(folder);
          return;
        }
      } catch (e) {
      }
    }
    const explorerEl = (_k = (_j = leaves[0]) == null ? void 0 : _j.view) == null ? void 0 : _k.containerEl;
    if (!explorerEl)
      return;
    const items = explorerEl.querySelectorAll(".tree-item-self");
    for (let i = 0; i < items.length; i++) {
      if (items[i].getAttribute("data-path") === matchKey) {
        items[i].scrollIntoView({ block: "center" });
        return;
      }
    }
  }
};

// src/modules/operation-log/LogService.ts
var import_obsidian2 = require("obsidian");
var LogService = class {
  constructor(app) {
    this.app = app;
  }
  async getRecentLogs(count = 5) {
    const logFolder = this.app.vault.getAbstractFileByPath("wiki/log");
    if (!logFolder)
      return [];
    const logFiles = [];
    this.app.vault.getAllLoadedFiles().forEach((f) => {
      if (f instanceof import_obsidian2.TFile && f.path.startsWith("wiki/log/") && f.extension === "md") {
        logFiles.push(f);
      }
    });
    if (logFiles.length === 0)
      return [];
    logFiles.sort((a, b) => b.stat.mtime - a.stat.mtime);
    const entries = [];
    for (const file of logFiles) {
      if (entries.length >= count)
        break;
      const content = await this.app.vault.cachedRead(file);
      const parsed = this.parseLogFile(content, file.basename);
      entries.push(...parsed);
    }
    return entries.slice(0, count);
  }
  parseLogFile(content, filename) {
    const entries = [];
    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    for (const line of lines) {
      entries.push(this.parseLine(line, filename));
    }
    return entries.reverse();
  }
  parseLine(line, filename) {
    const lower2 = line.toLowerCase();
    let type = "unknown";
    if (lower2.includes("ingest"))
      type = "ingest";
    else if (lower2.includes("query"))
      type = "query";
    else if (lower2.includes("lint"))
      type = "lint";
    const timeMatch = line.match(/\[?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?)\]?/);
    const time = timeMatch ? timeMatch[1] : filename;
    const targetMatch = line.match(/(?:ingest|query|lint)[^\w]*([\w/\-. ]+)/i);
    const target = targetMatch ? targetMatch[1].trim() : line.slice(0, 40);
    return { type, target, time, raw: line };
  }
  async writeLog(type, target) {
    const now = /* @__PURE__ */ new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toISOString().slice(11, 19);
    const line = `[${dateStr} ${timeStr}] ${type} ${target}`;
    const dirPath = "wiki/log";
    const filePath = `${dirPath}/${dateStr}.md`;
    try {
      const dir = this.app.vault.getAbstractFileByPath(dirPath);
      if (!dir) {
        await this.app.vault.createFolder(dirPath);
      }
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (file) {
        await this.app.vault.append(file, `
${line}`);
      } else {
        await this.app.vault.create(filePath, line);
      }
    } catch (e) {
    }
  }
};

// src/modules/llm-command/LLMService.ts
var import_obsidian4 = require("obsidian");

// src/services/VaultPersistenceService.ts
var import_obsidian3 = require("obsidian");
var VaultPersistenceService = class {
  constructor(app) {
    this.app = app;
  }
  async readJSON(path) {
    try {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof import_obsidian3.TFile))
        return null;
      const raw = await this.app.vault.read(file);
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }
  async writeJSON(path, data) {
    try {
      const dir = path.split("/").slice(0, -1).join("/");
      if (dir && !this.app.vault.getAbstractFileByPath(dir)) {
        const segs = dir.split("/");
        let acc = "";
        for (const seg of segs) {
          acc += (acc ? "/" : "") + seg;
          if (!this.app.vault.getAbstractFileByPath(acc)) {
            try {
              await this.app.vault.createFolder(acc);
            } catch (e) {
            }
          }
        }
      }
      const file = this.app.vault.getAbstractFileByPath(path);
      const json = JSON.stringify(data, null, 2);
      if (file instanceof import_obsidian3.TFile) {
        await this.app.vault.modify(file, json);
      } else {
        await this.app.vault.create(path, json);
      }
    } catch (e) {
    }
  }
  getLocalStore(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  setLocalStore(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
    }
  }
};

// src/modules/llm-command/LLMService.ts
var LOCAL_STORAGE_KEY = "llm-wiki-dashboard-token-usage";
var LLMService = class {
  constructor(app, settings, vaultPath) {
    this.settings = settings;
    this.persistence = new VaultPersistenceService(app);
    this.vaultPath = vaultPath || ".dashboard/token-usage.json";
  }
  updateSettings(settings) {
    this.settings = settings;
  }
  async executeCommand(command, input, onChunk, signal) {
    var _a, _b, _c, _d, _e, _f;
    if (onChunk) {
      return this.executeCommandStreaming(command, input, onChunk, signal);
    }
    const body = this.buildRequestBody(command, input, false);
    const resp = await (0, import_obsidian4.requestUrl)({
      url: `${this.settings.apiBaseUrl}/chat/completions`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.settings.apiKey}`
      },
      body: JSON.stringify(body),
      throw: false
    });
    this.throwOnErrorStatus(resp.status, resp.text);
    const data = resp.json;
    const content = (_d = (_c = (_b = (_a = data == null ? void 0 : data.choices) == null ? void 0 : _a[0]) == null ? void 0 : _b.message) == null ? void 0 : _c.content) != null ? _d : "";
    const totalTokens = (_f = (_e = data == null ? void 0 : data.usage) == null ? void 0 : _e.total_tokens) != null ? _f : 0;
    if (totalTokens > 0)
      this.recordLocalTokens(totalTokens);
    return content;
  }
  buildRequestBody(command, input, stream) {
    var _a;
    const systemPrompts = {
      ingest: "You are a knowledge ingestion assistant. Process the following content and extract key information for the wiki.",
      query: "You are a wiki assistant. Answer the following question based on the knowledge base.",
      "lint-wiki": "You are a wiki linter. Review the following content and suggest improvements for clarity, structure, and completeness."
    };
    return {
      model: this.settings.modelName,
      temperature: this.settings.temperature,
      max_tokens: this.settings.maxTokens,
      stream,
      messages: [
        { role: "system", content: (_a = systemPrompts[command]) != null ? _a : "You are a helpful assistant." },
        { role: "user", content: input }
      ]
    };
  }
  throwOnErrorStatus(status, text) {
    if (status === 401)
      throw new Error("401: API Key \u65E0\u6548\uFF0C\u8BF7\u68C0\u67E5\u914D\u7F6E");
    if (status === 429)
      throw new Error("429: \u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5");
    if (status === 408 || status === 504)
      throw new Error("\u8D85\u65F6: \u8BF7\u6C42\u8D85\u65F6\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5");
    if (status >= 500)
      throw new Error(`\u670D\u52A1\u5668\u9519\u8BEF (${status})\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5`);
    if (status !== 200)
      throw new Error(`\u8BF7\u6C42\u5931\u8D25 (${status}): ${text}`);
  }
  async executeCommandStreaming(command, input, onChunk, signal) {
    var _a, _b, _c, _d, _e, _f;
    const url = `${this.settings.apiBaseUrl}/chat/completions`;
    let resp;
    try {
      resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.settings.apiKey}`
        },
        body: JSON.stringify(this.buildRequestBody(command, input, true)),
        signal
      });
    } catch (e) {
      if ((e == null ? void 0 : e.name) === "AbortError")
        throw e;
      throw new Error("\u7F51\u7EDC\u9519\u8BEF: \u65E0\u6CD5\u8FDE\u63A5 API");
    }
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      this.throwOnErrorStatus(resp.status, text);
    }
    if (!resp.body) {
      throw new Error("\u6D41\u5F0F\u54CD\u5E94\u4E0D\u53EF\u7528\uFF0C\u8BF7\u68C0\u67E5 API \u662F\u5426\u652F\u6301 stream");
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";
    let totalTokens = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done)
        break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = (_a = lines.pop()) != null ? _a : "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:"))
          continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]")
          continue;
        try {
          const json = JSON.parse(payload);
          const delta = (_e = (_d = (_c = (_b = json == null ? void 0 : json.choices) == null ? void 0 : _b[0]) == null ? void 0 : _c.delta) == null ? void 0 : _d.content) != null ? _e : "";
          if (delta) {
            full += delta;
            onChunk(delta);
          }
          const usage = (_f = json == null ? void 0 : json.usage) == null ? void 0 : _f.total_tokens;
          if (typeof usage === "number" && usage > 0)
            totalTokens = usage;
        } catch (e) {
        }
      }
    }
    if (totalTokens > 0) {
      this.recordLocalTokens(totalTokens);
    } else if (full.length > 0) {
      this.recordLocalTokens(Math.max(1, Math.ceil(full.length / 4)));
    }
    return full;
  }
  async testConnection() {
    const resp = await (0, import_obsidian4.requestUrl)({
      url: `${this.settings.apiBaseUrl}/models`,
      method: "GET",
      headers: { Authorization: `Bearer ${this.settings.apiKey}` },
      throw: false
    });
    if (resp.status === 401)
      throw new Error("401: API Key \u65E0\u6548");
    if (resp.status === 404)
      throw new Error("404: Base URL \u4E0D\u6B63\u786E");
    if (resp.status >= 400)
      throw new Error(`\u8FDE\u63A5\u5931\u8D25 (${resp.status})`);
  }
  async getTokenUsage() {
    var _a, _b, _c, _d;
    const hasUsageApi = !!this.settings.tokenUsageApiUrl;
    const hasBalanceApi = !!this.settings.tokenBalanceApiUrl;
    const localUsage = await this.getLocalTokenUsage();
    const [apiUsage, balanceInfo] = await Promise.all([
      hasUsageApi ? this.fetchUsageApi() : null,
      hasBalanceApi ? this.fetchBalanceApi() : null
    ]);
    return {
      today: (_a = apiUsage == null ? void 0 : apiUsage.today) != null ? _a : localUsage.today,
      thisMonth: (_b = apiUsage == null ? void 0 : apiUsage.thisMonth) != null ? _b : localUsage.thisMonth,
      remaining: (_c = apiUsage == null ? void 0 : apiUsage.remaining) != null ? _c : null,
      dailyBreakdown: (_d = apiUsage == null ? void 0 : apiUsage.dailyBreakdown) != null ? _d : localUsage.dailyBreakdown,
      balanceInfo
    };
  }
  async getLocalTokenUsage() {
    var _a, _b;
    const vaultData = await this.persistence.readJSON(this.vaultPath);
    const localData = this.loadLocalStoreSync();
    let store = vaultData != null ? vaultData : localData;
    if (!vaultData && Object.keys(localData).length > 0) {
      this.persistence.writeJSON(this.vaultPath, localData).catch(() => {
      });
    } else if (vaultData) {
      let merged = false;
      for (const [date, tokens] of Object.entries(localData)) {
        if (!(date in vaultData) || localData[date] > ((_a = vaultData[date]) != null ? _a : 0)) {
          store[date] = tokens;
          merged = true;
        }
      }
      if (merged) {
        this.persistence.writeJSON(this.vaultPath, store).catch(() => {
        });
      }
    }
    const today = this.todayStr();
    const monthPrefix = today.slice(0, 7);
    const todayTokens = (_b = store[today]) != null ? _b : 0;
    let thisMonth = 0;
    const dailyBreakdown = [];
    for (const [date, tokens] of Object.entries(store)) {
      if (date.startsWith(monthPrefix)) {
        thisMonth += tokens;
        dailyBreakdown.push({ date, tokens });
      }
    }
    dailyBreakdown.sort((a, b) => b.date.localeCompare(a.date));
    return { today: todayTokens, thisMonth, remaining: null, dailyBreakdown: dailyBreakdown.slice(0, 30) };
  }
  async fetchUsageApi() {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    try {
      const resp = await (0, import_obsidian4.requestUrl)({
        url: this.settings.tokenUsageApiUrl,
        method: "GET",
        headers: { Authorization: `Bearer ${this.settings.apiKey}` },
        throw: false
      });
      if (resp.status !== 200)
        return null;
      const data = resp.json;
      const today = (_c = (_b = (_a = data == null ? void 0 : data.daily) == null ? void 0 : _a.today) != null ? _b : data == null ? void 0 : data.today) != null ? _c : 0;
      const thisMonth = (_f = (_e = (_d = data == null ? void 0 : data.monthly) == null ? void 0 : _d.total) != null ? _e : data == null ? void 0 : data.this_month) != null ? _f : 0;
      const remaining = (_h = (_g = data == null ? void 0 : data.remaining) != null ? _g : data == null ? void 0 : data.quota_remaining) != null ? _h : null;
      return { today, thisMonth, remaining, dailyBreakdown: [] };
    } catch (e) {
      return null;
    }
  }
  async fetchBalanceApi() {
    try {
      const resp = await (0, import_obsidian4.requestUrl)({
        url: this.settings.tokenBalanceApiUrl,
        method: "GET",
        headers: { Authorization: `Bearer ${this.settings.apiKey}` },
        throw: false
      });
      if (resp.status !== 200)
        return null;
      const data = resp.json;
      if (data == null ? void 0 : data.balance_infos)
        return data.balance_infos;
      if (data == null ? void 0 : data.currency)
        return [data];
      return null;
    } catch (e) {
      return null;
    }
  }
  recordLocalTokens(tokens) {
    var _a;
    const store = this.loadLocalStoreSync();
    const today = this.todayStr();
    store[today] = ((_a = store[today]) != null ? _a : 0) + tokens;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(store));
    this.persistence.writeJSON(this.vaultPath, store).catch(() => {
    });
  }
  loadLocalStoreSync() {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }
  todayStr() {
    const d = /* @__PURE__ */ new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
};

// src/modules/heatmap/HeatmapService.ts
var HEATMAP_KEY = "llm-wiki-dashboard-heatmap";
var HeatmapService = class {
  constructor(app, vaultPath) {
    this.app = app;
    this.unregister = null;
    this.cache = null;
    this.persistence = new VaultPersistenceService(app);
    this.vaultPath = vaultPath || ".dashboard/heatmap.json";
  }
  startTracking() {
    let pending = null;
    const handler = () => {
      if (pending)
        return;
      pending = setTimeout(() => {
        pending = null;
        this.recordActivity();
      }, 300);
    };
    const vault = this.app.vault;
    vault.on("modify", handler);
    vault.on("create", handler);
    vault.on("rename", handler);
    this.unregister = () => {
      if (pending) {
        clearTimeout(pending);
        pending = null;
      }
      vault.off("modify", handler);
      vault.off("create", handler);
      vault.off("rename", handler);
    };
  }
  stopTracking() {
    var _a;
    (_a = this.unregister) == null ? void 0 : _a.call(this);
    this.unregister = null;
  }
  recordActivity(count = 1) {
    var _a;
    const data = this.loadSync();
    const today = this.todayStr();
    data[today] = ((_a = data[today]) != null ? _a : 0) + count;
    localStorage.setItem(HEATMAP_KEY, JSON.stringify(data));
    this.cache = data;
    this.persistence.writeJSON(this.vaultPath, data).catch(() => {
    });
  }
  async getData() {
    var _a;
    if (this.cache)
      return this.cache;
    const vaultData = await this.persistence.readJSON(this.vaultPath);
    const localData = this.loadSync();
    if (vaultData) {
      this.cache = vaultData;
      let merged = false;
      for (const [date, count] of Object.entries(localData)) {
        if (!(date in vaultData) || localData[date] > ((_a = vaultData[date]) != null ? _a : 0)) {
          vaultData[date] = count;
          merged = true;
        }
      }
      if (merged) {
        this.cache = vaultData;
        localStorage.setItem(HEATMAP_KEY, JSON.stringify(vaultData));
        this.persistence.writeJSON(this.vaultPath, vaultData).catch(() => {
        });
      }
    } else {
      this.cache = localData;
      this.persistence.writeJSON(this.vaultPath, localData).catch(() => {
      });
    }
    return this.cache;
  }
  getDataSync() {
    return this.loadSync();
  }
  getMonthData(year, month) {
    const all = this.loadSync();
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    const result = {};
    for (const [date, count] of Object.entries(all)) {
      if (date.startsWith(prefix))
        result[date] = count;
    }
    return result;
  }
  loadSync() {
    try {
      const raw = localStorage.getItem(HEATMAP_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }
  todayStr() {
    const d = /* @__PURE__ */ new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
};

// src/modules/git-sync/GitService.ts
var import_obsidian5 = require("obsidian");

// src/modules/git-sync/NativeGitBackend.ts
var NativeGitBackend = class {
  constructor(app) {
    var _a, _b, _c;
    this.vaultPath = (_c = (_b = (_a = app.vault.adapter).getBasePath) == null ? void 0 : _b.call(_a)) != null ? _c : "";
  }
  // ── Internal ──
  execArgs(args, opts = {}) {
    var _a, _b, _c;
    const { execFileSync } = require("child_process");
    try {
      const execOpts = {
        cwd: this.vaultPath,
        encoding: opts.encoding === "buffer" ? void 0 : "utf-8",
        maxBuffer: 10 * 1024 * 1024
      };
      const t = (_a = opts.timeout) != null ? _a : 3e4;
      if (t > 0)
        execOpts.timeout = t;
      return execFileSync("git", args, execOpts);
    } catch (e) {
      const msg = (((_c = (_b = e.stderr) == null ? void 0 : _b.toString) == null ? void 0 : _c.call(_b)) || e.message || "Git \u547D\u4EE4\u6267\u884C\u5931\u8D25").trim();
      const err = new Error(msg);
      if (e.signal === "SIGTERM" || /ETIMEDOUT|timed out/i.test(msg)) {
        err.code = "TIMEOUT";
      }
      throw err;
    }
  }
  execArgsAsync(args, opts = {}) {
    const { execFile } = require("child_process");
    return new Promise((resolve, reject) => {
      var _a;
      const execOpts = {
        cwd: this.vaultPath,
        encoding: opts.encoding === "buffer" ? void 0 : "utf-8",
        maxBuffer: 10 * 1024 * 1024
      };
      const t = (_a = opts.timeout) != null ? _a : 3e4;
      if (t > 0)
        execOpts.timeout = t;
      execFile("git", args, execOpts, (error, stdout, stderr) => {
        if (error) {
          const msg = (stderr || error.message || "Git \u547D\u4EE4\u6267\u884C\u5931\u8D25").trim();
          const err = new Error(msg);
          if (error.signal === "SIGTERM" || /ETIMEDOUT|timed out/i.test(msg)) {
            err.code = "TIMEOUT";
          }
          reject(err);
        } else {
          resolve(stdout);
        }
      });
    });
  }
  withAuthArgs(username, password) {
    if (!username || !password)
      return [];
    const basic = Buffer.from(`${username}:${password}`).toString("base64");
    return ["-c", `http.extraHeader=Authorization: Basic ${basic}`];
  }
  async verifyRemoteMatchesLocal(remote, branch, username, password) {
    try {
      const auth = this.withAuthArgs(username, password);
      await this.execArgsAsync([...auth, "fetch", remote, branch], { timeout: 3e4 });
      const localHead = this.execArgs(["rev-parse", "HEAD"]).trim();
      const remoteHead = this.execArgs(["rev-parse", `${remote}/${branch}`]).trim();
      return localHead === remoteHead && localHead.length > 0;
    } catch (e) {
      return false;
    }
  }
  // ── Public API ──
  async isGitRepo() {
    try {
      this.execArgs(["rev-parse", "--is-inside-work-tree"]);
      return true;
    } catch (e) {
      return false;
    }
  }
  async initRepo() {
    this.execArgs(["init"]);
  }
  async ensureRemote(url, name2) {
    try {
      const remotesRaw = this.execArgs(["remote", "-v"]).trim();
      const lines = remotesRaw.split("\n");
      const byUrl = {};
      for (const line of lines) {
        const m = line.match(/^(\S+)\s+(\S+)\s+\(fetch\)/);
        if (m)
          byUrl[m[2]] = m[1];
      }
      if (byUrl[url] && byUrl[url] !== name2) {
        return;
      }
    } catch (e) {
    }
    let isNew = false;
    try {
      const existing = this.execArgs(["remote", "get-url", name2]).trim();
      if (existing !== url) {
        this.execArgs(["remote", "set-url", name2, url]);
      }
    } catch (e) {
      this.execArgs(["remote", "add", name2, url]);
      isNew = true;
    }
    if (isNew) {
      try {
        this.execArgs(["fetch", name2]);
      } catch (e) {
      }
    }
  }
  async hasCommits() {
    try {
      this.execArgs(["rev-parse", "HEAD"]);
      return true;
    } catch (e) {
      return false;
    }
  }
  async getStatus(remoteName, branchName) {
    let clean = true;
    let files = [];
    try {
      const statusFiles = await this.getStatusFiles();
      if (statusFiles.length > 0) {
        clean = false;
        files = statusFiles.map((f) => f.path);
      }
    } catch (e) {
    }
    let ahead = 0;
    let behind = 0;
    try {
      if (remoteName && branchName) {
        try {
          const counts = this.execArgs([
            "rev-list",
            "--left-right",
            "--count",
            `${remoteName}/${branchName}...${branchName}`
          ]);
          const parts = counts.trim().split("	");
          behind = parseInt(parts[0]) || 0;
          ahead = parseInt(parts[1]) || 0;
        } catch (e) {
        }
      } else {
        const branch = this.execArgs(["rev-parse", "--abbrev-ref", "HEAD"]).trim();
        const counts = this.execArgs([
          "rev-list",
          "--left-right",
          "--count",
          `${branch}@{upstream}...${branch}`
        ]);
        const parts = counts.trim().split("	");
        behind = parseInt(parts[0]) || 0;
        ahead = parseInt(parts[1]) || 0;
      }
    } catch (e) {
    }
    return { clean, files, ahead, behind };
  }
  async getStatusFiles() {
    try {
      const buf = this.execArgs(
        ["-c", "core.quotePath=false", "status", "--porcelain=v1", "-z"],
        { encoding: "buffer" }
      );
      if (!buf || buf.length === 0)
        return [];
      const output = buf.toString("utf-8");
      const parts = output.split("\0").filter((p) => p.length > 0);
      const files = [];
      for (let i = 0; i < parts.length; i++) {
        const entry = parts[i];
        if (entry.length < 3)
          continue;
        const status = entry.slice(0, 2);
        const path = entry.slice(3);
        const staged = status[0] !== " " && status[0] !== "?";
        files.push({ status, path, staged });
        if (status[0] === "R" || status[0] === "C")
          i++;
      }
      return files;
    } catch (e) {
      return [];
    }
  }
  async stageFiles(files) {
    const staged = [];
    const skipped = [];
    for (const f of files) {
      if (!f || !f.trim())
        continue;
      try {
        this.execArgs(["add", "--", f]);
        staged.push(f);
        continue;
      } catch (e) {
        try {
          this.execArgs(["rm", "--cached", "--", f]);
          staged.push(f);
          continue;
        } catch (e2) {
        }
        try {
          this.execArgs(["add", "-A", "--", f]);
          staged.push(f);
          continue;
        } catch (e2) {
        }
        try {
          this.execArgs(["add", "-f", "--", f]);
          staged.push(f);
          continue;
        } catch (e2) {
          skipped.push(f);
        }
      }
    }
    if (staged.length === 0 && files.length > 0) {
      throw new Error("\u6CA1\u6709\u6587\u4EF6\u53EF\u4EE5\u6682\u5B58\uFF08\u6240\u6709\u6587\u4EF6\u5747\u5DF2\u4E0D\u5B58\u5728\uFF09");
    }
    return staged;
  }
  async restoreFiles(files) {
    const restored = [];
    for (const f of files) {
      let ok = false;
      try {
        this.execArgs(["restore", "--staged", "--", f]);
      } catch (e) {
      }
      try {
        this.execArgs(["restore", "--", f]);
        ok = true;
      } catch (e) {
      }
      if (!ok) {
        try {
          this.execArgs(["checkout", "HEAD", "--", f]);
          ok = true;
        } catch (e) {
        }
      }
      if (!ok) {
        try {
          this.execArgs(["checkout", "--", f]);
          ok = true;
        } catch (e) {
        }
      }
      if (ok) {
        restored.push(f);
      }
    }
    if (restored.length === 0 && files.length > 0) {
      throw new Error("\u65E0\u6CD5\u56DE\u6EDA\u4EFB\u4F55\u6587\u4EF6");
    }
    return restored;
  }
  async commit(message) {
    try {
      this.execArgs(["diff", "--cached", "--quiet"]);
      return false;
    } catch (e) {
    }
    this.execArgs(["commit", "-m", message]);
    return true;
  }
  async stageAndCommit(message) {
    this.execArgs(["add", "-A"]);
    try {
      this.execArgs(["diff", "--cached", "--quiet"]);
      return false;
    } catch (e) {
    }
    this.execArgs(["commit", "-m", message]);
    return true;
  }
  async push(remote, branch, username, password, timeoutMinutes) {
    const min = timeoutMinutes != null ? timeoutMinutes : 5;
    const timeout = min > 0 ? min * 60 * 1e3 : 0;
    const args = this.withAuthArgs(username, password);
    args.push("push", "--set-upstream", remote, branch);
    try {
      await this.execArgsAsync(args, { timeout });
      try {
        await this.execArgsAsync(["fetch", remote, branch], { timeout: 3e4 });
      } catch (e) {
      }
      return "\u63A8\u9001\u6210\u529F";
    } catch (e) {
      if ((e == null ? void 0 : e.code) === "TIMEOUT") {
        const reconciled = await this.verifyRemoteMatchesLocal(remote, branch, username, password);
        if (reconciled) {
          return "\u63A8\u9001\u6210\u529F\uFF08\u5BA2\u6237\u7AEF\u8D85\u65F6\uFF0C\u4F46\u670D\u52A1\u7AEF\u5DF2\u5B8C\u6210\uFF09";
        }
      }
      throw e;
    }
  }
  async pull(remote, branch, username, password, timeoutMinutes) {
    const min = timeoutMinutes != null ? timeoutMinutes : 5;
    const timeout = min > 0 ? min * 60 * 1e3 : 0;
    const args = this.withAuthArgs(username, password);
    args.push("pull", remote, branch, "--no-edit");
    const output = await this.execArgsAsync(args, { timeout });
    return output.trim() || "\u62C9\u53D6\u5B8C\u6210";
  }
  async pushAll(remote, branch, message, username, password, timeoutMinutes) {
    await this.stageAndCommit(message);
    return this.push(remote, branch, username, password, timeoutMinutes);
  }
  async getRecentCommits(n) {
    try {
      const output = this.execArgs(["log", "--format=%H%x00%an%x00%s%x00%ai", "-n", String(n)]);
      return output.trim().split("\n").filter(Boolean).map((line) => {
        const parts = line.split("\0");
        return { hash: parts[0].slice(0, 7), message: parts[2], date: parts[3], author: parts[1] };
      });
    } catch (e) {
      return [];
    }
  }
  async getCommitFiles(hash) {
    try {
      const output = this.execArgs(["-c", "core.quotePath=false", "diff-tree", "--no-commit-id", "--name-only", "-r", hash]);
      return output.trim().split("\n").filter(Boolean);
    } catch (e) {
      return [];
    }
  }
  buildAuthUrl(remoteUrl, username, password) {
    if (remoteUrl.startsWith("https://")) {
      const withoutProtocol = remoteUrl.slice(8);
      return `https://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${withoutProtocol}`;
    }
    return remoteUrl;
  }
};

// node_modules/isomorphic-git/index.js
var import_async_lock = __toESM(require_async_lock(), 1);
var import_sha1 = __toESM(require_sha1(), 1);
var import_crc_32 = __toESM(require_crc32(), 1);
var import_pako = __toESM(require_pako(), 1);
var import_pify = __toESM(require_pify(), 1);
var import_ignore = __toESM(require_ignore(), 1);
var import_clean_git_ref = __toESM(require_lib2(), 1);
var import_diff3 = __toESM(require_diff3(), 1);
var BaseError = class _BaseError extends Error {
  constructor(message) {
    super(message);
    this.caller = "";
  }
  toJSON() {
    return {
      code: this.code,
      data: this.data,
      caller: this.caller,
      message: this.message,
      stack: this.stack
    };
  }
  fromJSON(json) {
    const e = new _BaseError(json.message);
    e.code = json.code;
    e.data = json.data;
    e.caller = json.caller;
    e.stack = json.stack;
    return e;
  }
  get isIsomorphicGitError() {
    return true;
  }
};
var UnmergedPathsError = class _UnmergedPathsError extends BaseError {
  /**
   * @param {Array<string>} filepaths
   */
  constructor(filepaths) {
    super(
      `Modifying the index is not possible because you have unmerged files: ${filepaths.toString}. Fix them up in the work tree, and then use 'git add/rm as appropriate to mark resolution and make a commit.`
    );
    this.code = this.name = _UnmergedPathsError.code;
    this.data = { filepaths };
  }
};
UnmergedPathsError.code = "UnmergedPathsError";
var InternalError = class _InternalError extends BaseError {
  /**
   * @param {string} message
   */
  constructor(message) {
    super(
      `An internal error caused this command to fail.

If you're using an application that depends on isomorphic-git, please report this error to that application's developers.

If you're a developer and you believe this is a bug in isomorphic-git, please file an issue at https://github.com/isomorphic-git/isomorphic-git/issues with a minimal reproduction, version and environment details, and this error message: ${message}`
    );
    this.code = this.name = _InternalError.code;
    this.data = { message };
  }
};
InternalError.code = "InternalError";
var UnsafeFilepathError = class _UnsafeFilepathError extends BaseError {
  /**
   * @param {string} filepath
   */
  constructor(filepath) {
    super(`The filepath "${filepath}" contains unsafe character sequences`);
    this.code = this.name = _UnsafeFilepathError.code;
    this.data = { filepath };
  }
};
UnsafeFilepathError.code = "UnsafeFilepathError";
var BufferCursor = class {
  constructor(buffer) {
    this.buffer = buffer;
    this._start = 0;
  }
  eof() {
    return this._start >= this.buffer.length;
  }
  tell() {
    return this._start;
  }
  seek(n) {
    this._start = n;
  }
  slice(n) {
    const r = this.buffer.slice(this._start, this._start + n);
    this._start += n;
    return r;
  }
  toString(enc, length) {
    const r = this.buffer.toString(enc, this._start, this._start + length);
    this._start += length;
    return r;
  }
  write(value, length, enc) {
    const r = this.buffer.write(value, this._start, length, enc);
    this._start += length;
    return r;
  }
  copy(source, start, end) {
    const r = source.copy(this.buffer, this._start, start, end);
    this._start += r;
    return r;
  }
  readUInt8() {
    const r = this.buffer.readUInt8(this._start);
    this._start += 1;
    return r;
  }
  writeUInt8(value) {
    const r = this.buffer.writeUInt8(value, this._start);
    this._start += 1;
    return r;
  }
  readUInt16BE() {
    const r = this.buffer.readUInt16BE(this._start);
    this._start += 2;
    return r;
  }
  writeUInt16BE(value) {
    const r = this.buffer.writeUInt16BE(value, this._start);
    this._start += 2;
    return r;
  }
  readUInt32BE() {
    const r = this.buffer.readUInt32BE(this._start);
    this._start += 4;
    return r;
  }
  writeUInt32BE(value) {
    const r = this.buffer.writeUInt32BE(value, this._start);
    this._start += 4;
    return r;
  }
};
function compareStrings(a, b) {
  return -(a < b) || +(a > b);
}
function comparePath(a, b) {
  return compareStrings(a.path, b.path);
}
function normalizeMode(mode) {
  let type = mode > 0 ? mode >> 12 : 0;
  if (type !== 4 && type !== 8 && type !== 10 && type !== 14) {
    type = 8;
  }
  let permissions = mode & 511;
  if (permissions & 73) {
    permissions = 493;
  } else {
    permissions = 420;
  }
  if (type !== 8)
    permissions = 0;
  return (type << 12) + permissions;
}
var MAX_UINT32 = 2 ** 32;
function SecondsNanoseconds(givenSeconds, givenNanoseconds, milliseconds, date) {
  if (givenSeconds !== void 0 && givenNanoseconds !== void 0) {
    return [givenSeconds, givenNanoseconds];
  }
  if (milliseconds === void 0) {
    milliseconds = date.valueOf();
  }
  const seconds = Math.floor(milliseconds / 1e3);
  const nanoseconds = (milliseconds - seconds * 1e3) * 1e6;
  return [seconds, nanoseconds];
}
function normalizeStats(e) {
  const [ctimeSeconds, ctimeNanoseconds] = SecondsNanoseconds(
    e.ctimeSeconds,
    e.ctimeNanoseconds,
    e.ctimeMs,
    e.ctime
  );
  const [mtimeSeconds, mtimeNanoseconds] = SecondsNanoseconds(
    e.mtimeSeconds,
    e.mtimeNanoseconds,
    e.mtimeMs,
    e.mtime
  );
  return {
    ctimeSeconds: ctimeSeconds % MAX_UINT32,
    ctimeNanoseconds: ctimeNanoseconds % MAX_UINT32,
    mtimeSeconds: mtimeSeconds % MAX_UINT32,
    mtimeNanoseconds: mtimeNanoseconds % MAX_UINT32,
    dev: e.dev % MAX_UINT32,
    ino: e.ino % MAX_UINT32,
    mode: normalizeMode(e.mode % MAX_UINT32),
    uid: e.uid % MAX_UINT32,
    gid: e.gid % MAX_UINT32,
    // size of -1 happens over a BrowserFS HTTP Backend that doesn't serve Content-Length headers
    // (like the Karma webserver) because BrowserFS HTTP Backend uses HTTP HEAD requests to do fs.stat
    size: e.size > -1 ? e.size % MAX_UINT32 : 0
  };
}
function toHex(buffer) {
  let hex = "";
  for (const byte of new Uint8Array(buffer)) {
    if (byte < 16)
      hex += "0";
    hex += byte.toString(16);
  }
  return hex;
}
var supportsSubtleSHA1 = null;
async function shasum(buffer) {
  if (supportsSubtleSHA1 === null) {
    supportsSubtleSHA1 = await testSubtleSHA1();
  }
  return supportsSubtleSHA1 ? subtleSHA1(buffer) : shasumSync(buffer);
}
function shasumSync(buffer) {
  return new import_sha1.default().update(buffer).digest("hex");
}
async function subtleSHA1(buffer) {
  const hash = await crypto.subtle.digest("SHA-1", buffer);
  return toHex(hash);
}
async function testSubtleSHA1() {
  try {
    const hash = await subtleSHA1(new Uint8Array([]));
    return hash === "da39a3ee5e6b4b0d3255bfef95601890afd80709";
  } catch (_) {
  }
  return false;
}
function parseCacheEntryFlags(bits) {
  return {
    assumeValid: Boolean(bits & 32768),
    extended: Boolean(bits & 16384),
    stage: (bits & 12288) >> 12,
    nameLength: bits & 4095
  };
}
function renderCacheEntryFlags(entry) {
  const flags = entry.flags;
  flags.extended = false;
  flags.nameLength = Math.min(Buffer.from(entry.path).length, 4095);
  return (flags.assumeValid ? 32768 : 0) + (flags.extended ? 16384 : 0) + ((flags.stage & 3) << 12) + (flags.nameLength & 4095);
}
var GitIndex = class _GitIndex {
  /*::
   _entries: Map<string, CacheEntry>
   _dirty: boolean // Used to determine if index needs to be saved to filesystem
   */
  constructor(entries, unmergedPaths) {
    this._dirty = false;
    this._unmergedPaths = unmergedPaths || /* @__PURE__ */ new Set();
    this._entries = entries || /* @__PURE__ */ new Map();
  }
  _addEntry(entry) {
    if (entry.flags.stage === 0) {
      entry.stages = [entry];
      this._entries.set(entry.path, entry);
      this._unmergedPaths.delete(entry.path);
    } else {
      let existingEntry = this._entries.get(entry.path);
      if (!existingEntry) {
        this._entries.set(entry.path, entry);
        existingEntry = entry;
      }
      existingEntry.stages[entry.flags.stage] = entry;
      this._unmergedPaths.add(entry.path);
    }
  }
  static async from(buffer) {
    if (Buffer.isBuffer(buffer)) {
      return _GitIndex.fromBuffer(buffer);
    } else if (buffer === null) {
      return new _GitIndex(null);
    } else {
      throw new InternalError("invalid type passed to GitIndex.from");
    }
  }
  static async fromBuffer(buffer) {
    if (buffer.length === 0) {
      throw new InternalError("Index file is empty (.git/index)");
    }
    const index = new _GitIndex();
    const reader = new BufferCursor(buffer);
    const magic = reader.toString("utf8", 4);
    if (magic !== "DIRC") {
      throw new InternalError(`Invalid dircache magic file number: ${magic}`);
    }
    const shaComputed = await shasum(buffer.slice(0, -20));
    const shaClaimed = buffer.slice(-20).toString("hex");
    if (shaClaimed !== shaComputed) {
      throw new InternalError(
        `Invalid checksum in GitIndex buffer: expected ${shaClaimed} but saw ${shaComputed}`
      );
    }
    const version = reader.readUInt32BE();
    if (version !== 2) {
      throw new InternalError(`Unsupported dircache version: ${version}`);
    }
    const numEntries = reader.readUInt32BE();
    let i = 0;
    while (!reader.eof() && i < numEntries) {
      const entry = {};
      entry.ctimeSeconds = reader.readUInt32BE();
      entry.ctimeNanoseconds = reader.readUInt32BE();
      entry.mtimeSeconds = reader.readUInt32BE();
      entry.mtimeNanoseconds = reader.readUInt32BE();
      entry.dev = reader.readUInt32BE();
      entry.ino = reader.readUInt32BE();
      entry.mode = reader.readUInt32BE();
      entry.uid = reader.readUInt32BE();
      entry.gid = reader.readUInt32BE();
      entry.size = reader.readUInt32BE();
      entry.oid = reader.slice(20).toString("hex");
      const flags = reader.readUInt16BE();
      entry.flags = parseCacheEntryFlags(flags);
      const pathlength = buffer.indexOf(0, reader.tell() + 1) - reader.tell();
      if (pathlength < 1) {
        throw new InternalError(`Got a path length of: ${pathlength}`);
      }
      entry.path = reader.toString("utf8", pathlength);
      if (entry.path.includes("..\\") || entry.path.includes("../")) {
        throw new UnsafeFilepathError(entry.path);
      }
      let padding = 8 - (reader.tell() - 12) % 8;
      if (padding === 0)
        padding = 8;
      while (padding--) {
        const tmp = reader.readUInt8();
        if (tmp !== 0) {
          throw new InternalError(
            `Expected 1-8 null characters but got '${tmp}' after ${entry.path}`
          );
        } else if (reader.eof()) {
          throw new InternalError("Unexpected end of file");
        }
      }
      entry.stages = [];
      index._addEntry(entry);
      i++;
    }
    return index;
  }
  get unmergedPaths() {
    return [...this._unmergedPaths];
  }
  get entries() {
    return [...this._entries.values()].sort(comparePath);
  }
  get entriesMap() {
    return this._entries;
  }
  get entriesFlat() {
    return [...this.entries].flatMap((entry) => {
      return entry.stages.length > 1 ? entry.stages.filter((x) => x) : entry;
    });
  }
  *[Symbol.iterator]() {
    for (const entry of this.entries) {
      yield entry;
    }
  }
  insert({ filepath, stats, oid, stage = 0 }) {
    if (!stats) {
      stats = {
        ctimeSeconds: 0,
        ctimeNanoseconds: 0,
        mtimeSeconds: 0,
        mtimeNanoseconds: 0,
        dev: 0,
        ino: 0,
        mode: 0,
        uid: 0,
        gid: 0,
        size: 0
      };
    }
    stats = normalizeStats(stats);
    const bfilepath = Buffer.from(filepath);
    const entry = {
      ctimeSeconds: stats.ctimeSeconds,
      ctimeNanoseconds: stats.ctimeNanoseconds,
      mtimeSeconds: stats.mtimeSeconds,
      mtimeNanoseconds: stats.mtimeNanoseconds,
      dev: stats.dev,
      ino: stats.ino,
      // We provide a fallback value for `mode` here because not all fs
      // implementations assign it, but we use it in GitTree.
      // '100644' is for a "regular non-executable file"
      mode: stats.mode || 33188,
      uid: stats.uid,
      gid: stats.gid,
      size: stats.size,
      path: filepath,
      oid,
      flags: {
        assumeValid: false,
        extended: false,
        stage,
        nameLength: bfilepath.length < 4095 ? bfilepath.length : 4095
      },
      stages: []
    };
    this._addEntry(entry);
    this._dirty = true;
  }
  delete({ filepath }) {
    if (this._entries.has(filepath)) {
      this._entries.delete(filepath);
    } else {
      for (const key of this._entries.keys()) {
        if (key.startsWith(filepath + "/")) {
          this._entries.delete(key);
        }
      }
    }
    if (this._unmergedPaths.has(filepath)) {
      this._unmergedPaths.delete(filepath);
    }
    this._dirty = true;
  }
  clear() {
    this._entries.clear();
    this._dirty = true;
  }
  has({ filepath }) {
    return this._entries.has(filepath);
  }
  render() {
    return this.entries.map((entry) => `${entry.mode.toString(8)} ${entry.oid}    ${entry.path}`).join("\n");
  }
  static async _entryToBuffer(entry) {
    const bpath = Buffer.from(entry.path);
    const length = Math.ceil((62 + bpath.length + 1) / 8) * 8;
    const written = Buffer.alloc(length);
    const writer = new BufferCursor(written);
    const stat = normalizeStats(entry);
    writer.writeUInt32BE(stat.ctimeSeconds);
    writer.writeUInt32BE(stat.ctimeNanoseconds);
    writer.writeUInt32BE(stat.mtimeSeconds);
    writer.writeUInt32BE(stat.mtimeNanoseconds);
    writer.writeUInt32BE(stat.dev);
    writer.writeUInt32BE(stat.ino);
    writer.writeUInt32BE(stat.mode);
    writer.writeUInt32BE(stat.uid);
    writer.writeUInt32BE(stat.gid);
    writer.writeUInt32BE(stat.size);
    writer.write(entry.oid, 20, "hex");
    writer.writeUInt16BE(renderCacheEntryFlags(entry));
    writer.write(entry.path, bpath.length, "utf8");
    return written;
  }
  async toObject() {
    const header = Buffer.alloc(12);
    const writer = new BufferCursor(header);
    writer.write("DIRC", 4, "utf8");
    writer.writeUInt32BE(2);
    writer.writeUInt32BE(this.entriesFlat.length);
    let entryBuffers = [];
    for (const entry of this.entries) {
      entryBuffers.push(_GitIndex._entryToBuffer(entry));
      if (entry.stages.length > 1) {
        for (const stage of entry.stages) {
          if (stage && stage !== entry) {
            entryBuffers.push(_GitIndex._entryToBuffer(stage));
          }
        }
      }
    }
    entryBuffers = await Promise.all(entryBuffers);
    const body = Buffer.concat(entryBuffers);
    const main = Buffer.concat([header, body]);
    const sum = await shasum(main);
    return Buffer.concat([main, Buffer.from(sum, "hex")]);
  }
};
function compareStats(entry, stats, filemode = true, trustino = true) {
  const e = normalizeStats(entry);
  const s = normalizeStats(stats);
  const staleness = filemode && e.mode !== s.mode || e.mtimeSeconds !== s.mtimeSeconds || e.ctimeSeconds !== s.ctimeSeconds || e.uid !== s.uid || e.gid !== s.gid || trustino && e.ino !== s.ino || e.size !== s.size;
  return staleness;
}
var lock = null;
var IndexCache = Symbol("IndexCache");
function createCache() {
  return {
    map: /* @__PURE__ */ new Map(),
    stats: /* @__PURE__ */ new Map()
  };
}
async function updateCachedIndexFile(fs, filepath, cache) {
  const [stat, rawIndexFile] = await Promise.all([
    fs.lstat(filepath),
    fs.read(filepath)
  ]);
  const index = await GitIndex.from(rawIndexFile);
  cache.map.set(filepath, index);
  cache.stats.set(filepath, stat);
}
async function isIndexStale(fs, filepath, cache) {
  const savedStats = cache.stats.get(filepath);
  if (savedStats === void 0)
    return true;
  if (savedStats === null)
    return false;
  const currStats = await fs.lstat(filepath);
  if (currStats === null)
    return false;
  return compareStats(savedStats, currStats);
}
var GitIndexManager = class {
  /**
   * Manages access to the Git index file, ensuring thread-safe operations and caching.
   *
   * @param {object} opts - Options for acquiring the Git index.
   * @param {FSClient} opts.fs - A file system implementation.
   * @param {string} opts.gitdir - The path to the `.git` directory.
   * @param {object} opts.cache - A shared cache object for storing index data.
   * @param {boolean} [opts.allowUnmerged=true] - Whether to allow unmerged paths in the index.
   * @param {function(GitIndex): any} closure - A function to execute with the Git index.
   * @returns {Promise<any>} The result of the closure function.
   * @throws {UnmergedPathsError} If unmerged paths exist and `allowUnmerged` is `false`.
   */
  static async acquire({ fs, gitdir, cache, allowUnmerged = true }, closure) {
    if (!cache[IndexCache]) {
      cache[IndexCache] = createCache();
    }
    const filepath = `${gitdir}/index`;
    if (lock === null)
      lock = new import_async_lock.default({ maxPending: Infinity });
    let result;
    let unmergedPaths = [];
    await lock.acquire(filepath, async () => {
      const theIndexCache = cache[IndexCache];
      if (await isIndexStale(fs, filepath, theIndexCache)) {
        await updateCachedIndexFile(fs, filepath, theIndexCache);
      }
      const index = theIndexCache.map.get(filepath);
      unmergedPaths = index.unmergedPaths;
      if (unmergedPaths.length && !allowUnmerged)
        throw new UnmergedPathsError(unmergedPaths);
      result = await closure(index);
      if (index._dirty) {
        const buffer = await index.toObject();
        await fs.write(filepath, buffer);
        theIndexCache.stats.set(filepath, await fs.lstat(filepath));
        index._dirty = false;
      }
    });
    return result;
  }
};
function basename(path) {
  const last = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  if (last > -1) {
    path = path.slice(last + 1);
  }
  return path;
}
function dirname(path) {
  const last = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  if (last === -1)
    return ".";
  if (last === 0)
    return "/";
  return path.slice(0, last);
}
function flatFileListToDirectoryStructure(files) {
  const inodes = /* @__PURE__ */ new Map();
  const mkdir = function(name2) {
    if (!inodes.has(name2)) {
      const dir = {
        type: "tree",
        fullpath: name2,
        basename: basename(name2),
        metadata: {},
        children: []
      };
      inodes.set(name2, dir);
      dir.parent = mkdir(dirname(name2));
      if (dir.parent && dir.parent !== dir)
        dir.parent.children.push(dir);
    }
    return inodes.get(name2);
  };
  const mkfile = function(name2, metadata) {
    if (!inodes.has(name2)) {
      const file = {
        type: "blob",
        fullpath: name2,
        basename: basename(name2),
        metadata,
        // This recursively generates any missing parent folders.
        parent: mkdir(dirname(name2)),
        children: []
      };
      if (file.parent)
        file.parent.children.push(file);
      inodes.set(name2, file);
    }
    return inodes.get(name2);
  };
  mkdir(".");
  for (const file of files) {
    mkfile(file.path, file);
  }
  return inodes;
}
function mode2type(mode) {
  switch (mode) {
    case 16384:
      return "tree";
    case 33188:
      return "blob";
    case 33261:
      return "blob";
    case 40960:
      return "blob";
    case 57344:
      return "commit";
  }
  throw new InternalError(`Unexpected GitTree entry mode: ${mode.toString(8)}`);
}
var GitWalkerIndex = class {
  constructor({ fs, gitdir, cache }) {
    this.treePromise = GitIndexManager.acquire(
      { fs, gitdir, cache },
      async function(index) {
        return flatFileListToDirectoryStructure(index.entries);
      }
    );
    const walker = this;
    this.ConstructEntry = class StageEntry {
      constructor(fullpath) {
        this._fullpath = fullpath;
        this._type = false;
        this._mode = false;
        this._stat = false;
        this._oid = false;
      }
      async type() {
        return walker.type(this);
      }
      async mode() {
        return walker.mode(this);
      }
      async stat() {
        return walker.stat(this);
      }
      async content() {
        return walker.content(this);
      }
      async oid() {
        return walker.oid(this);
      }
    };
  }
  async readdir(entry) {
    const filepath = entry._fullpath;
    const tree = await this.treePromise;
    const inode = tree.get(filepath);
    if (!inode)
      return null;
    if (inode.type === "blob")
      return null;
    if (inode.type !== "tree") {
      throw new Error(`ENOTDIR: not a directory, scandir '${filepath}'`);
    }
    const names = inode.children.map((inode2) => inode2.fullpath);
    names.sort(compareStrings);
    return names;
  }
  async type(entry) {
    if (entry._type === false) {
      await entry.stat();
    }
    return entry._type;
  }
  async mode(entry) {
    if (entry._mode === false) {
      await entry.stat();
    }
    return entry._mode;
  }
  async stat(entry) {
    if (entry._stat === false) {
      const tree = await this.treePromise;
      const inode = tree.get(entry._fullpath);
      if (!inode) {
        throw new Error(
          `ENOENT: no such file or directory, lstat '${entry._fullpath}'`
        );
      }
      const stats = inode.type === "tree" ? {} : normalizeStats(inode.metadata);
      entry._type = inode.type === "tree" ? "tree" : mode2type(stats.mode);
      entry._mode = stats.mode;
      if (inode.type === "tree") {
        entry._stat = void 0;
      } else {
        entry._stat = stats;
      }
    }
    return entry._stat;
  }
  async content(_entry) {
  }
  async oid(entry) {
    if (entry._oid === false) {
      const tree = await this.treePromise;
      const inode = tree.get(entry._fullpath);
      entry._oid = inode.metadata.oid;
    }
    return entry._oid;
  }
};
var GitWalkSymbol = Symbol("GitWalkSymbol");
function STAGE() {
  const o = /* @__PURE__ */ Object.create(null);
  Object.defineProperty(o, GitWalkSymbol, {
    value: function({ fs, gitdir, cache }) {
      return new GitWalkerIndex({ fs, gitdir, cache });
    }
  });
  Object.freeze(o);
  return o;
}
var NotFoundError = class _NotFoundError extends BaseError {
  /**
   * @param {string} what
   */
  constructor(what) {
    super(`Could not find ${what}.`);
    this.code = this.name = _NotFoundError.code;
    this.data = { what };
  }
};
NotFoundError.code = "NotFoundError";
var ObjectTypeError = class _ObjectTypeError extends BaseError {
  /**
   * @param {string} oid
   * @param {'blob'|'commit'|'tag'|'tree'} actual
   * @param {'blob'|'commit'|'tag'|'tree'} expected
   * @param {string} [filepath]
   */
  constructor(oid, actual, expected, filepath) {
    super(
      `Object ${oid} ${filepath ? `at ${filepath}` : ""}was anticipated to be a ${expected} but it is a ${actual}.`
    );
    this.code = this.name = _ObjectTypeError.code;
    this.data = { oid, actual, expected, filepath };
  }
};
ObjectTypeError.code = "ObjectTypeError";
var InvalidOidError = class _InvalidOidError extends BaseError {
  /**
   * @param {string} value
   */
  constructor(value) {
    super(`Expected a 40-char hex object id but saw "${value}".`);
    this.code = this.name = _InvalidOidError.code;
    this.data = { value };
  }
};
InvalidOidError.code = "InvalidOidError";
var NoRefspecError = class _NoRefspecError extends BaseError {
  /**
   * @param {string} remote
   */
  constructor(remote) {
    super(`Could not find a fetch refspec for remote "${remote}". Make sure the config file has an entry like the following:
[remote "${remote}"]
	fetch = +refs/heads/*:refs/remotes/origin/*
`);
    this.code = this.name = _NoRefspecError.code;
    this.data = { remote };
  }
};
NoRefspecError.code = "NoRefspecError";
var GitPackedRefs = class _GitPackedRefs {
  constructor(text) {
    this.refs = /* @__PURE__ */ new Map();
    this.parsedConfig = [];
    if (text) {
      let key = null;
      this.parsedConfig = text.trim().split("\n").map((line) => {
        if (/^\s*#/.test(line)) {
          return { line, comment: true };
        }
        const i = line.indexOf(" ");
        if (line.startsWith("^")) {
          const value = line.slice(1);
          this.refs.set(key + "^{}", value);
          return { line, ref: key, peeled: value };
        } else {
          const value = line.slice(0, i);
          key = line.slice(i + 1);
          this.refs.set(key, value);
          return { line, ref: key, oid: value };
        }
      });
    }
    return this;
  }
  static from(text) {
    return new _GitPackedRefs(text);
  }
  delete(ref) {
    this.parsedConfig = this.parsedConfig.filter((entry) => entry.ref !== ref);
    this.refs.delete(ref);
  }
  toString() {
    return this.parsedConfig.map(({ line }) => line).join("\n") + "\n";
  }
};
var GitRefSpec = class _GitRefSpec {
  constructor({ remotePath, localPath, force, matchPrefix }) {
    Object.assign(this, {
      remotePath,
      localPath,
      force,
      matchPrefix
    });
  }
  static from(refspec) {
    const [forceMatch, remotePath, remoteGlobMatch, localPath, localGlobMatch] = refspec.match(/^(\+?)(.*?)(\*?):(.*?)(\*?)$/).slice(1);
    const force = forceMatch === "+";
    const remoteIsGlob = remoteGlobMatch === "*";
    const localIsGlob = localGlobMatch === "*";
    if (remoteIsGlob !== localIsGlob) {
      throw new InternalError("Invalid refspec");
    }
    return new _GitRefSpec({
      remotePath,
      localPath,
      force,
      matchPrefix: remoteIsGlob
    });
  }
  translate(remoteBranch) {
    if (this.matchPrefix) {
      if (remoteBranch.startsWith(this.remotePath)) {
        return this.localPath + remoteBranch.replace(this.remotePath, "");
      }
    } else {
      if (remoteBranch === this.remotePath)
        return this.localPath;
    }
    return null;
  }
  reverseTranslate(localBranch) {
    if (this.matchPrefix) {
      if (localBranch.startsWith(this.localPath)) {
        return this.remotePath + localBranch.replace(this.localPath, "");
      }
    } else {
      if (localBranch === this.localPath)
        return this.remotePath;
    }
    return null;
  }
};
var GitRefSpecSet = class _GitRefSpecSet {
  constructor(rules = []) {
    this.rules = rules;
  }
  static from(refspecs) {
    const rules = [];
    for (const refspec of refspecs) {
      rules.push(GitRefSpec.from(refspec));
    }
    return new _GitRefSpecSet(rules);
  }
  add(refspec) {
    const rule = GitRefSpec.from(refspec);
    this.rules.push(rule);
  }
  translate(remoteRefs) {
    const result = [];
    for (const rule of this.rules) {
      for (const remoteRef of remoteRefs) {
        const localRef = rule.translate(remoteRef);
        if (localRef) {
          result.push([remoteRef, localRef]);
        }
      }
    }
    return result;
  }
  translateOne(remoteRef) {
    let result = null;
    for (const rule of this.rules) {
      const localRef = rule.translate(remoteRef);
      if (localRef) {
        result = localRef;
      }
    }
    return result;
  }
  localNamespaces() {
    return this.rules.filter((rule) => rule.matchPrefix).map((rule) => rule.localPath.replace(/\/$/, ""));
  }
};
function compareRefNames(a, b) {
  const _a = a.replace(/\^\{\}$/, "");
  const _b = b.replace(/\^\{\}$/, "");
  const tmp = -(_a < _b) || +(_a > _b);
  if (tmp === 0) {
    return a.endsWith("^{}") ? 1 : -1;
  }
  return tmp;
}
function normalizeString(path, aar) {
  let res = "";
  let lastSegmentLength = 0;
  let lastSlash = -1;
  let dots = 0;
  let char = "\0";
  for (let i = 0; i <= path.length; ++i) {
    if (i < path.length)
      char = path[i];
    else if (char === "/")
      break;
    else
      char = "/";
    if (char === "/") {
      if (lastSlash === i - 1 || dots === 1) {
      } else if (dots === 2) {
        if (res.length < 2 || lastSegmentLength !== 2 || res.at(-1) !== "." || res.at(-2) !== ".") {
          if (res.length > 2) {
            const lastSlashIndex = res.lastIndexOf("/");
            if (lastSlashIndex === -1) {
              res = "";
              lastSegmentLength = 0;
            } else {
              res = res.slice(0, lastSlashIndex);
              lastSegmentLength = res.length - 1 - res.lastIndexOf("/");
            }
            lastSlash = i;
            dots = 0;
            continue;
          } else if (res.length !== 0) {
            res = "";
            lastSegmentLength = 0;
            lastSlash = i;
            dots = 0;
            continue;
          }
        }
        if (aar) {
          res += res.length > 0 ? "/.." : "..";
          lastSegmentLength = 2;
        }
      } else {
        if (res.length > 0)
          res += "/" + path.slice(lastSlash + 1, i);
        else
          res = path.slice(lastSlash + 1, i);
        lastSegmentLength = i - lastSlash - 1;
      }
      lastSlash = i;
      dots = 0;
    } else if (char === "." && dots !== -1) {
      ++dots;
    } else {
      dots = -1;
    }
  }
  return res;
}
function getWindowsDrivePrefix(path) {
  if (path.length >= 2 && /^[a-zA-Z]:/.test(path)) {
    return path.slice(0, 2);
  }
  return null;
}
function normalize(path) {
  if (!path.length)
    return ".";
  path = path.replace(/\\/g, "/");
  const drivePrefix = getWindowsDrivePrefix(path);
  const isAbsolute2 = path[0] === "/" || drivePrefix !== null && path[2] === "/";
  const trailingSeparator = path.at(-1) === "/";
  const pathBody = drivePrefix ? path.slice(2) : path;
  let normalized = normalizeString(pathBody, !isAbsolute2);
  if (!normalized.length) {
    const root = drivePrefix ? isAbsolute2 ? drivePrefix + "/" : drivePrefix : isAbsolute2 ? "/" : ".";
    return trailingSeparator && !isAbsolute2 ? root + "/" : root;
  }
  if (trailingSeparator)
    normalized += "/";
  if (drivePrefix) {
    return isAbsolute2 ? `${drivePrefix}/${normalized}` : `${drivePrefix}${normalized}`;
  }
  return isAbsolute2 ? `/${normalized}` : normalized;
}
function join(...args) {
  if (args.length === 0)
    return ".";
  let joined;
  for (let i = 0; i < args.length; ++i) {
    const arg = args[i].replace(/\\/g, "/");
    if (arg.length === 0)
      continue;
    if (/^[a-zA-Z]:\//.test(arg)) {
      joined = arg;
    } else {
      if (joined === void 0)
        joined = arg;
      else
        joined += "/" + arg;
    }
  }
  if (joined === void 0)
    return ".";
  return normalize(joined);
}
var num = (val) => {
  if (typeof val === "number") {
    return val;
  }
  val = val.toLowerCase();
  let n = parseInt(val);
  if (val.endsWith("k"))
    n *= 1024;
  if (val.endsWith("m"))
    n *= 1024 * 1024;
  if (val.endsWith("g"))
    n *= 1024 * 1024 * 1024;
  return n;
};
var bool = (val) => {
  if (typeof val === "boolean") {
    return val;
  }
  val = val.trim().toLowerCase();
  if (val === "true" || val === "yes" || val === "on")
    return true;
  if (val === "false" || val === "no" || val === "off")
    return false;
  throw Error(
    `Expected 'true', 'false', 'yes', 'no', 'on', or 'off', but got ${val}`
  );
};
var schema = {
  core: {
    filemode: bool,
    bare: bool,
    logallrefupdates: bool,
    symlinks: bool,
    ignorecase: bool,
    bigFileThreshold: num
  }
};
var SECTION_LINE_REGEX = /^\[([A-Za-z0-9-.]+)(?: "(.*)")?\]$/;
var SECTION_REGEX = /^[A-Za-z0-9-.]+$/;
var VARIABLE_LINE_REGEX = /^([A-Za-z][A-Za-z-]*)(?: *= *(.*))?$/;
var VARIABLE_NAME_REGEX = /^[A-Za-z][A-Za-z-]*$/;
var VARIABLE_VALUE_COMMENT_REGEX = /^(.*?)( *[#;].*)$/;
var extractSectionLine = (line) => {
  const matches = SECTION_LINE_REGEX.exec(line);
  if (matches != null) {
    const [section, subsection] = matches.slice(1);
    return [section, subsection];
  }
  return null;
};
var extractVariableLine = (line) => {
  const matches = VARIABLE_LINE_REGEX.exec(line);
  if (matches != null) {
    const [name2, rawValue = "true"] = matches.slice(1);
    const valueWithoutComments = removeComments(rawValue);
    const valueWithoutQuotes = removeQuotes(valueWithoutComments);
    return [name2, valueWithoutQuotes];
  }
  return null;
};
var removeComments = (rawValue) => {
  const commentMatches = VARIABLE_VALUE_COMMENT_REGEX.exec(rawValue);
  if (commentMatches == null) {
    return rawValue;
  }
  const [valueWithoutComment, comment] = commentMatches.slice(1);
  if (hasOddNumberOfQuotes(valueWithoutComment) && hasOddNumberOfQuotes(comment)) {
    return `${valueWithoutComment}${comment}`;
  }
  return valueWithoutComment;
};
var hasOddNumberOfQuotes = (text) => {
  const numberOfQuotes = (text.match(/(?:^|[^\\])"/g) || []).length;
  return numberOfQuotes % 2 !== 0;
};
var removeQuotes = (text) => {
  return text.split("").reduce((newText, c, idx, text2) => {
    const isQuote = c === '"' && text2[idx - 1] !== "\\";
    const isEscapeForQuote = c === "\\" && text2[idx + 1] === '"';
    if (isQuote || isEscapeForQuote) {
      return newText;
    }
    return newText + c;
  }, "");
};
var lower = (text) => {
  return text != null ? text.toLowerCase() : null;
};
var getPath = (section, subsection, name2) => {
  return [lower(section), subsection, lower(name2)].filter((a) => a != null).join(".");
};
var normalizePath = (path) => {
  const pathSegments = path.split(".");
  const section = pathSegments.shift();
  const name2 = pathSegments.pop();
  const subsection = pathSegments.length ? pathSegments.join(".") : void 0;
  return {
    section,
    subsection,
    name: name2,
    path: getPath(section, subsection, name2),
    sectionPath: getPath(section, subsection, null),
    isSection: !!section
  };
};
var findLastIndex = (array, callback) => {
  return array.reduce((lastIndex, item, index) => {
    return callback(item) ? index : lastIndex;
  }, -1);
};
var GitConfig = class _GitConfig {
  constructor(text) {
    let section = null;
    let subsection = null;
    this.parsedConfig = text ? text.split("\n").map((line) => {
      let name2 = null;
      let value = null;
      const trimmedLine = line.trim();
      const extractedSection = extractSectionLine(trimmedLine);
      const isSection = extractedSection != null;
      if (isSection) {
        ;
        [section, subsection] = extractedSection;
      } else {
        const extractedVariable = extractVariableLine(trimmedLine);
        const isVariable = extractedVariable != null;
        if (isVariable) {
          ;
          [name2, value] = extractedVariable;
        }
      }
      const path = getPath(section, subsection, name2);
      return { line, isSection, section, subsection, name: name2, value, path };
    }) : [];
  }
  static from(text) {
    return new _GitConfig(text);
  }
  async get(path, getall = false) {
    const normalizedPath = normalizePath(path).path;
    const allValues = this.parsedConfig.filter((config) => config.path === normalizedPath).map(({ section, name: name2, value }) => {
      const fn = schema[section] && schema[section][name2];
      return fn ? fn(value) : value;
    });
    return getall ? allValues : allValues.pop();
  }
  async getall(path) {
    return this.get(path, true);
  }
  async getSubsections(section) {
    return this.parsedConfig.filter((config) => config.isSection && config.section === section).map((config) => config.subsection);
  }
  async deleteSection(section, subsection) {
    this.parsedConfig = this.parsedConfig.filter(
      (config) => !(config.section === section && config.subsection === subsection)
    );
  }
  async append(path, value) {
    return this.set(path, value, true);
  }
  async set(path, value, append = false) {
    const {
      section,
      subsection,
      name: name2,
      path: normalizedPath,
      sectionPath,
      isSection
    } = normalizePath(path);
    const configIndex = findLastIndex(
      this.parsedConfig,
      (config) => config.path === normalizedPath
    );
    if (value == null) {
      if (configIndex !== -1) {
        this.parsedConfig.splice(configIndex, 1);
      }
    } else {
      if (configIndex !== -1) {
        const config = this.parsedConfig[configIndex];
        const modifiedConfig = Object.assign({}, config, {
          name: name2,
          value,
          modified: true
        });
        if (append) {
          this.parsedConfig.splice(configIndex + 1, 0, modifiedConfig);
        } else {
          this.parsedConfig[configIndex] = modifiedConfig;
        }
      } else {
        const sectionIndex = this.parsedConfig.findIndex(
          (config) => config.path === sectionPath
        );
        const newConfig = {
          section,
          subsection,
          name: name2,
          value,
          modified: true,
          path: normalizedPath
        };
        if (SECTION_REGEX.test(section) && VARIABLE_NAME_REGEX.test(name2)) {
          if (sectionIndex >= 0) {
            this.parsedConfig.splice(sectionIndex + 1, 0, newConfig);
          } else {
            const newSection = {
              isSection,
              section,
              subsection,
              modified: true,
              path: sectionPath
            };
            this.parsedConfig.push(newSection, newConfig);
          }
        }
      }
    }
  }
  toString() {
    return this.parsedConfig.map(({ line, section, subsection, name: name2, value, modified: modified2 = false }) => {
      if (!modified2) {
        return line;
      }
      if (name2 != null && value != null) {
        if (typeof value === "string" && /[#;]/.test(value)) {
          return `	${name2} = "${value}"`;
        }
        return `	${name2} = ${value}`;
      }
      if (subsection != null) {
        return `[${section} "${subsection}"]`;
      }
      return `[${section}]`;
    }).join("\n");
  }
};
var GitConfigManager = class {
  /**
   * Reads the Git configuration file from the specified `.git` directory.
   *
   * @param {object} opts - Options for reading the Git configuration.
   * @param {FSClient} opts.fs - A file system implementation.
   * @param {string} opts.gitdir - The path to the `.git` directory.
   * @returns {Promise<GitConfig>} A `GitConfig` object representing the parsed configuration.
   */
  static async get({ fs, gitdir }) {
    const text = await fs.read(`${gitdir}/config`, { encoding: "utf8" });
    return GitConfig.from(text);
  }
  /**
   * Saves the provided Git configuration to the specified `.git` directory.
   *
   * @param {object} opts - Options for saving the Git configuration.
   * @param {FSClient} opts.fs - A file system implementation.
   * @param {string} opts.gitdir - The path to the `.git` directory.
   * @param {GitConfig} opts.config - The `GitConfig` object to save.
   * @returns {Promise<void>} Resolves when the configuration has been successfully saved.
   */
  static async save({ fs, gitdir, config }) {
    await fs.write(`${gitdir}/config`, config.toString(), {
      encoding: "utf8"
    });
  }
};
var refpaths = (ref) => [
  `${ref}`,
  `refs/${ref}`,
  `refs/tags/${ref}`,
  `refs/heads/${ref}`,
  `refs/remotes/${ref}`,
  `refs/remotes/${ref}/HEAD`
];
var GIT_FILES = ["config", "description", "index", "shallow", "commondir"];
var lock$1;
async function acquireLock(ref, callback) {
  if (lock$1 === void 0)
    lock$1 = new import_async_lock.default();
  return lock$1.acquire(ref, callback);
}
var GitRefManager = class _GitRefManager {
  /**
   * Updates remote refs based on the provided refspecs and options.
   *
   * @param {Object} args
   * @param {FSClient} args.fs - A file system implementation.
   * @param {string} [args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
   * @param {string} args.remote - The name of the remote.
   * @param {Map<string, string>} args.refs - A map of refs to their object IDs.
   * @param {Map<string, string>} args.symrefs - A map of symbolic refs.
   * @param {boolean} args.tags - Whether to fetch tags.
   * @param {string[]} [args.refspecs = undefined] - The refspecs to use.
   * @param {boolean} [args.prune = false] - Whether to prune stale refs.
   * @param {boolean} [args.pruneTags = false] - Whether to prune tags.
   * @returns {Promise<Object>} - An object containing pruned refs.
   */
  static async updateRemoteRefs({
    fs,
    gitdir,
    remote,
    refs,
    symrefs,
    tags,
    refspecs = void 0,
    prune = false,
    pruneTags = false
  }) {
    for (const value of refs.values()) {
      if (!value.match(/[0-9a-f]{40}/)) {
        throw new InvalidOidError(value);
      }
    }
    const config = await GitConfigManager.get({ fs, gitdir });
    if (!refspecs) {
      refspecs = await config.getall(`remote.${remote}.fetch`);
      if (refspecs.length === 0) {
        throw new NoRefspecError(remote);
      }
      refspecs.unshift(`+HEAD:refs/remotes/${remote}/HEAD`);
    }
    const refspec = GitRefSpecSet.from(refspecs);
    const actualRefsToWrite = /* @__PURE__ */ new Map();
    if (pruneTags) {
      const tags2 = await _GitRefManager.listRefs({
        fs,
        gitdir,
        filepath: "refs/tags"
      });
      await _GitRefManager.deleteRefs({
        fs,
        gitdir,
        refs: tags2.map((tag) => `refs/tags/${tag}`)
      });
    }
    if (tags) {
      for (const serverRef of refs.keys()) {
        if (serverRef.startsWith("refs/tags") && !serverRef.endsWith("^{}")) {
          if (!await _GitRefManager.exists({ fs, gitdir, ref: serverRef })) {
            const oid = refs.get(serverRef);
            actualRefsToWrite.set(serverRef, oid);
          }
        }
      }
    }
    const refTranslations = refspec.translate([...refs.keys()]);
    for (const [serverRef, translatedRef] of refTranslations) {
      const value = refs.get(serverRef);
      actualRefsToWrite.set(translatedRef, value);
    }
    const symrefTranslations = refspec.translate([...symrefs.keys()]);
    for (const [serverRef, translatedRef] of symrefTranslations) {
      const value = symrefs.get(serverRef);
      const symtarget = refspec.translateOne(value);
      if (symtarget) {
        actualRefsToWrite.set(translatedRef, `ref: ${symtarget}`);
      }
    }
    const pruned = [];
    if (prune) {
      for (const filepath of refspec.localNamespaces()) {
        const refs2 = (await _GitRefManager.listRefs({
          fs,
          gitdir,
          filepath
        })).map((file) => `${filepath}/${file}`);
        for (const ref of refs2) {
          if (!actualRefsToWrite.has(ref)) {
            pruned.push(ref);
          }
        }
      }
      if (pruned.length > 0) {
        await _GitRefManager.deleteRefs({ fs, gitdir, refs: pruned });
      }
    }
    for (const [key, value] of actualRefsToWrite) {
      await acquireLock(
        key,
        async () => fs.write(join(gitdir, key), `${value.trim()}
`, "utf8")
      );
    }
    return { pruned };
  }
  /**
   * Writes a ref to the file system.
   *
   * @param {Object} args
   * @param {FSClient} args.fs - A file system implementation.
   * @param {string} [args.gitdir] - [required] The [git directory](dir-vs-gitdir.md) path
   * @param {string} args.ref - The ref to write.
   * @param {string} args.value - The object ID to write.
   * @returns {Promise<void>}
   */
  // TODO: make this less crude?
  static async writeRef({ fs, gitdir, ref, value }) {
    if (!value.match(/[0-9a-f]{40}/)) {
      throw new InvalidOidError(value);
    }
    await acquireLock(
      ref,
      async () => fs.write(join(gitdir, ref), `${value.trim()}
`, "utf8")
    );
  }
  /**
   * Writes a symbolic ref to the file system.
   *
   * @param {Object} args
   * @param {FSClient} args.fs - A file system implementation.
   * @param {string} [args.gitdir] - [required] The [git directory](dir-vs-gitdir.md) path
   * @param {string} args.ref - The ref to write.
   * @param {string} args.value - The target ref.
   * @returns {Promise<void>}
   */
  static async writeSymbolicRef({ fs, gitdir, ref, value }) {
    await acquireLock(
      ref,
      async () => fs.write(join(gitdir, ref), `ref: ${value.trim()}
`, "utf8")
    );
  }
  /**
   * Deletes a single ref.
   *
   * @param {Object} args
   * @param {FSClient} args.fs - A file system implementation.
   * @param {string} [args.gitdir] - [required] The [git directory](dir-vs-gitdir.md) path
   * @param {string} args.ref - The ref to delete.
   * @returns {Promise<void>}
   */
  static async deleteRef({ fs, gitdir, ref }) {
    return _GitRefManager.deleteRefs({ fs, gitdir, refs: [ref] });
  }
  /**
   * Deletes multiple refs.
   *
   * @param {Object} args
   * @param {FSClient} args.fs - A file system implementation.
   * @param {string} [args.gitdir] - [required] The [git directory](dir-vs-gitdir.md) path
   * @param {string[]} args.refs - The refs to delete.
   * @returns {Promise<void>}
   */
  static async deleteRefs({ fs, gitdir, refs }) {
    await Promise.all(refs.map((ref) => fs.rm(join(gitdir, ref))));
    let text = await acquireLock(
      "packed-refs",
      async () => fs.read(`${gitdir}/packed-refs`, { encoding: "utf8" })
    );
    const packed = GitPackedRefs.from(text);
    const beforeSize = packed.refs.size;
    for (const ref of refs) {
      if (packed.refs.has(ref)) {
        packed.delete(ref);
      }
    }
    if (packed.refs.size < beforeSize) {
      text = packed.toString();
      await acquireLock(
        "packed-refs",
        async () => fs.write(`${gitdir}/packed-refs`, text, { encoding: "utf8" })
      );
    }
  }
  /**
   * Resolves a ref to its object ID.
   *
   * @param {Object} args
   * @param {FSClient} args.fs - A file system implementation.
   * @param {string} [args.gitdir] - [required] The [git directory](dir-vs-gitdir.md) path
   * @param {string} args.ref - The ref to resolve.
   * @param {number} [args.depth = undefined] - The maximum depth to resolve symbolic refs.
   * @returns {Promise<string>} - The resolved object ID.
   */
  static async resolve({
    fs,
    gitdir,
    ref,
    depth = void 0,
    visited = /* @__PURE__ */ new Set()
  }) {
    if (depth !== void 0) {
      depth--;
      if (depth === -1) {
        return ref;
      }
    }
    if (ref.startsWith("ref: ")) {
      ref = ref.slice("ref: ".length);
      return _GitRefManager.resolve({ fs, gitdir, ref, depth, visited });
    }
    if (ref.length === 40 && /[0-9a-f]{40}/.test(ref)) {
      return ref;
    }
    const packedMap = await _GitRefManager.packedRefs({ fs, gitdir });
    const allpaths = refpaths(ref).filter((p) => !GIT_FILES.includes(p));
    for (const ref2 of allpaths) {
      const sha = await acquireLock(
        ref2,
        async () => await fs.read(`${gitdir}/${ref2}`, { encoding: "utf8" }) || packedMap.get(ref2)
      );
      if (sha) {
        if (visited.has(ref2)) {
          throw new InternalError(
            `Circular reference detected while resolving ref "${ref2}"`
          );
        }
        visited.add(ref2);
        return _GitRefManager.resolve({
          fs,
          gitdir,
          ref: sha.trim(),
          depth,
          visited
        });
      }
    }
    throw new NotFoundError(ref);
  }
  /**
   * Checks if a ref exists.
   *
   * @param {Object} args
   * @param {FSClient} args.fs - A file system implementation.
   * @param {string} [args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
   * @param {string} args.ref - The ref to check.
   * @returns {Promise<boolean>} - True if the ref exists, false otherwise.
   */
  static async exists({ fs, gitdir, ref }) {
    try {
      await _GitRefManager.expand({ fs, gitdir, ref });
      return true;
    } catch (err) {
      return false;
    }
  }
  /**
   * Expands a ref to its full name.
   *
   * @param {Object} args
   * @param {FSClient} args.fs - A file system implementation.
   * @param {string} [args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
   * @param {string} args.ref - The ref to expand.
   * @returns {Promise<string>} - The full ref name.
   */
  static async expand({ fs, gitdir, ref }) {
    if (ref.length === 40 && /[0-9a-f]{40}/.test(ref)) {
      return ref;
    }
    const packedMap = await _GitRefManager.packedRefs({ fs, gitdir });
    const allpaths = refpaths(ref);
    for (const ref2 of allpaths) {
      const refExists = await acquireLock(
        ref2,
        async () => fs.exists(`${gitdir}/${ref2}`)
      );
      if (refExists)
        return ref2;
      if (packedMap.has(ref2))
        return ref2;
    }
    throw new NotFoundError(ref);
  }
  /**
   * Expands a ref against a provided map.
   *
   * @param {Object} args
   * @param {string} args.ref - The ref to expand.
   * @param {Map<string, string>} args.map - The map of refs.
   * @returns {Promise<string>} - The expanded ref.
   */
  static async expandAgainstMap({ ref, map }) {
    const allpaths = refpaths(ref);
    for (const ref2 of allpaths) {
      if (await map.has(ref2))
        return ref2;
    }
    throw new NotFoundError(ref);
  }
  /**
   * Resolves a ref against a provided map.
   *
   * @param {Object} args
   * @param {string} args.ref - The ref to resolve.
   * @param {string} [args.fullref = args.ref] - The full ref name.
   * @param {number} [args.depth = undefined] - The maximum depth to resolve symbolic refs.
   * @param {Map<string, string>} args.map - The map of refs.
   * @returns {Object} - An object containing the full ref and its object ID.
   */
  static resolveAgainstMap({ ref, fullref = ref, depth = void 0, map }) {
    if (depth !== void 0) {
      depth--;
      if (depth === -1) {
        return { fullref, oid: ref };
      }
    }
    if (ref.startsWith("ref: ")) {
      ref = ref.slice("ref: ".length);
      return _GitRefManager.resolveAgainstMap({ ref, fullref, depth, map });
    }
    if (ref.length === 40 && /[0-9a-f]{40}/.test(ref)) {
      return { fullref, oid: ref };
    }
    const allpaths = refpaths(ref);
    for (const ref2 of allpaths) {
      const sha = map.get(ref2);
      if (sha) {
        return _GitRefManager.resolveAgainstMap({
          ref: sha.trim(),
          fullref: ref2,
          depth,
          map
        });
      }
    }
    throw new NotFoundError(ref);
  }
  /**
   * Reads the packed refs file and returns a map of refs.
   *
   * @param {Object} args
   * @param {FSClient} args.fs - A file system implementation.
   * @param {string} [args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
   * @returns {Promise<Map<string, string>>} - A map of packed refs.
   */
  static async packedRefs({ fs, gitdir }) {
    const text = await acquireLock(
      "packed-refs",
      async () => fs.read(`${gitdir}/packed-refs`, { encoding: "utf8" })
    );
    const packed = GitPackedRefs.from(text);
    return packed.refs;
  }
  /**
   * Lists all refs matching a given filepath prefix.
   *
   * @param {Object} args
   * @param {FSClient} args.fs - A file system implementation.
   * @param {string} [args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
   * @param {string} args.filepath - The filepath prefix to match.
   * @returns {Promise<string[]>} - A sorted list of refs.
   */
  static async listRefs({ fs, gitdir, filepath }) {
    const packedMap = _GitRefManager.packedRefs({ fs, gitdir });
    let files = null;
    try {
      files = await fs.readdirDeep(`${gitdir}/${filepath}`);
      files = files.map((x) => x.replace(`${gitdir}/${filepath}/`, ""));
    } catch (err) {
      files = [];
    }
    for (let key of (await packedMap).keys()) {
      if (key.startsWith(filepath)) {
        key = key.replace(filepath + "/", "");
        if (!files.includes(key)) {
          files.push(key);
        }
      }
    }
    files.sort(compareRefNames);
    return files;
  }
  /**
   * Lists all branches, optionally filtered by remote.
   *
   * @param {Object} args
   * @param {FSClient} args.fs - A file system implementation.
   * @param {string} [args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
   * @param {string} [args.remote] - The remote to filter branches by.
   * @returns {Promise<string[]>} - A list of branch names.
   */
  static async listBranches({ fs, gitdir, remote }) {
    if (remote) {
      return _GitRefManager.listRefs({
        fs,
        gitdir,
        filepath: `refs/remotes/${remote}`
      });
    } else {
      return _GitRefManager.listRefs({ fs, gitdir, filepath: `refs/heads` });
    }
  }
  /**
   * Lists all tags.
   *
   * @param {Object} args
   * @param {FSClient} args.fs - A file system implementation.
   * @param {string} [args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
   * @returns {Promise<string[]>} - A list of tag names.
   */
  static async listTags({ fs, gitdir }) {
    const tags = await _GitRefManager.listRefs({
      fs,
      gitdir,
      filepath: `refs/tags`
    });
    return tags.filter((x) => !x.endsWith("^{}"));
  }
};
function compareTreeEntryPath(a, b) {
  return compareStrings(appendSlashIfDir(a), appendSlashIfDir(b));
}
function appendSlashIfDir(entry) {
  return entry.mode === "040000" ? entry.path + "/" : entry.path;
}
function mode2type$1(mode) {
  switch (mode) {
    case "040000":
      return "tree";
    case "100644":
      return "blob";
    case "100755":
      return "blob";
    case "120000":
      return "blob";
    case "160000":
      return "commit";
  }
  throw new InternalError(`Unexpected GitTree entry mode: ${mode}`);
}
function parseBuffer(buffer) {
  const _entries = [];
  let cursor = 0;
  while (cursor < buffer.length) {
    const space = buffer.indexOf(32, cursor);
    if (space === -1) {
      throw new InternalError(
        `GitTree: Error parsing buffer at byte location ${cursor}: Could not find the next space character.`
      );
    }
    const nullchar = buffer.indexOf(0, cursor);
    if (nullchar === -1) {
      throw new InternalError(
        `GitTree: Error parsing buffer at byte location ${cursor}: Could not find the next null character.`
      );
    }
    let mode = buffer.slice(cursor, space).toString("utf8");
    if (mode === "40000")
      mode = "040000";
    const type = mode2type$1(mode);
    const path = buffer.slice(space + 1, nullchar).toString("utf8");
    const hfsClean = path.replace(
      /[\u200C-\u200F\u202A-\u202E\u206A-\u206F\uFEFF]/g,
      ""
    );
    const ntfsClean = hfsClean.split(":")[0];
    const normalized = ntfsClean.toLowerCase().replace(/[. ]+$/, "");
    if (path.includes("\\") || path.includes("/") || hfsClean === "." || hfsClean === ".." || normalized === ".git" || /^\.?git~[1-9]$/.test(normalized)) {
      throw new UnsafeFilepathError(path);
    }
    const oid = buffer.slice(nullchar + 1, nullchar + 21).toString("hex");
    cursor = nullchar + 21;
    _entries.push({ mode, path, oid, type });
  }
  return _entries;
}
function limitModeToAllowed(mode) {
  if (typeof mode === "number") {
    mode = mode.toString(8);
  }
  if (mode.match(/^0?4.*/))
    return "040000";
  if (mode.match(/^1006.*/))
    return "100644";
  if (mode.match(/^1007.*/))
    return "100755";
  if (mode.match(/^120.*/))
    return "120000";
  if (mode.match(/^160.*/))
    return "160000";
  throw new InternalError(`Could not understand file mode: ${mode}`);
}
function nudgeIntoShape(entry) {
  if (!entry.oid && entry.sha) {
    entry.oid = entry.sha;
  }
  entry.mode = limitModeToAllowed(entry.mode);
  if (!entry.type) {
    entry.type = mode2type$1(entry.mode);
  }
  return entry;
}
var GitTree = class _GitTree {
  constructor(entries) {
    if (Buffer.isBuffer(entries)) {
      this._entries = parseBuffer(entries);
    } else if (Array.isArray(entries)) {
      this._entries = entries.map(nudgeIntoShape);
    } else {
      throw new InternalError("invalid type passed to GitTree constructor");
    }
    this._entries.sort(comparePath);
  }
  static from(tree) {
    return new _GitTree(tree);
  }
  render() {
    return this._entries.map((entry) => `${entry.mode} ${entry.type} ${entry.oid}    ${entry.path}`).join("\n");
  }
  toObject() {
    const entries = [...this._entries];
    entries.sort(compareTreeEntryPath);
    return Buffer.concat(
      entries.map((entry) => {
        const mode = Buffer.from(entry.mode.replace(/^0/, ""));
        const space = Buffer.from(" ");
        const path = Buffer.from(entry.path, "utf8");
        const nullchar = Buffer.from([0]);
        const oid = Buffer.from(entry.oid, "hex");
        return Buffer.concat([mode, space, path, nullchar, oid]);
      })
    );
  }
  /**
   * @returns {TreeEntry[]}
   */
  entries() {
    return this._entries;
  }
  *[Symbol.iterator]() {
    for (const entry of this._entries) {
      yield entry;
    }
  }
};
var GitObject = class {
  /**
   * Wraps a raw object with a Git header.
   *
   * @param {Object} params - The parameters for wrapping.
   * @param {string} params.type - The type of the Git object (e.g., 'blob', 'tree', 'commit').
   * @param {Uint8Array} params.object - The raw object data to wrap.
   * @returns {Uint8Array} The wrapped Git object as a single buffer.
   */
  static wrap({ type, object }) {
    const header = `${type} ${object.length}\0`;
    const headerLen = header.length;
    const totalLength = headerLen + object.length;
    const wrappedObject = new Uint8Array(totalLength);
    for (let i = 0; i < headerLen; i++) {
      wrappedObject[i] = header.charCodeAt(i);
    }
    wrappedObject.set(object, headerLen);
    return wrappedObject;
  }
  /**
   * Unwraps a Git object buffer into its type and raw object data.
   *
   * @param {Buffer|Uint8Array} buffer - The buffer containing the wrapped Git object.
   * @returns {{ type: string, object: Buffer }} An object containing the type and the raw object data.
   * @throws {InternalError} If the length specified in the header does not match the actual object length.
   */
  static unwrap(buffer) {
    const s = buffer.indexOf(32);
    const i = buffer.indexOf(0);
    const type = buffer.slice(0, s).toString("utf8");
    const length = buffer.slice(s + 1, i).toString("utf8");
    const actualLength = buffer.length - (i + 1);
    if (parseInt(length) !== actualLength) {
      throw new InternalError(
        `Length mismatch: expected ${length} bytes but got ${actualLength} instead.`
      );
    }
    return {
      type,
      object: Buffer.from(buffer.slice(i + 1))
    };
  }
};
async function readObjectLoose({ fs, gitdir, oid }) {
  const source = `objects/${oid.slice(0, 2)}/${oid.slice(2)}`;
  const file = await fs.read(`${gitdir}/${source}`);
  if (!file) {
    return null;
  }
  return { object: file, format: "deflated", source };
}
function applyDelta(delta, source) {
  const reader = new BufferCursor(delta);
  const sourceSize = readVarIntLE(reader);
  if (sourceSize !== source.byteLength) {
    throw new InternalError(
      `applyDelta expected source buffer to be ${sourceSize} bytes but the provided buffer was ${source.length} bytes`
    );
  }
  const targetSize = readVarIntLE(reader);
  let target;
  const firstOp = readOp(reader, source);
  if (firstOp.byteLength === targetSize) {
    target = firstOp;
  } else {
    const chunks = [firstOp];
    let tell = firstOp.byteLength;
    while (!reader.eof()) {
      const op = readOp(reader, source);
      chunks.push(op);
      tell += op.byteLength;
    }
    if (targetSize !== tell) {
      throw new InternalError(
        `applyDelta expected target buffer to be ${targetSize} bytes but the resulting buffer was ${tell} bytes`
      );
    }
    target = Buffer.concat(chunks, targetSize);
  }
  return target;
}
function readVarIntLE(reader) {
  let result = 0;
  let shift = 0;
  let byte = null;
  do {
    byte = reader.readUInt8();
    result |= (byte & 127) << shift;
    shift += 7;
  } while (byte & 128);
  return result;
}
function readCompactLE(reader, flags, size) {
  let result = 0;
  let shift = 0;
  while (size--) {
    if (flags & 1) {
      result |= reader.readUInt8() << shift;
    }
    flags >>= 1;
    shift += 8;
  }
  return result;
}
function readOp(reader, source) {
  const byte = reader.readUInt8();
  const COPY = 128;
  const OFFS = 15;
  const SIZE = 112;
  if (byte & COPY) {
    const offset = readCompactLE(reader, byte & OFFS, 4);
    let size = readCompactLE(reader, (byte & SIZE) >> 4, 3);
    if (size === 0)
      size = 65536;
    return source.slice(offset, offset + size);
  } else {
    return reader.slice(byte);
  }
}
function fromValue(value) {
  let queue = [value];
  return {
    next() {
      return Promise.resolve({ done: queue.length === 0, value: queue.pop() });
    },
    return() {
      queue = [];
      return {};
    },
    [Symbol.asyncIterator]() {
      return this;
    }
  };
}
function getIterator(iterable) {
  if (iterable[Symbol.asyncIterator]) {
    return iterable[Symbol.asyncIterator]();
  }
  if (iterable[Symbol.iterator]) {
    return iterable[Symbol.iterator]();
  }
  if (iterable.next) {
    return iterable;
  }
  return fromValue(iterable);
}
var StreamReader = class {
  constructor(stream) {
    if (typeof Buffer === "undefined") {
      throw new Error("Missing Buffer dependency");
    }
    this.stream = getIterator(stream);
    this.buffer = null;
    this.cursor = 0;
    this.undoCursor = 0;
    this.started = false;
    this._ended = false;
    this._discardedBytes = 0;
  }
  eof() {
    return this._ended && this.cursor === this.buffer.length;
  }
  tell() {
    return this._discardedBytes + this.cursor;
  }
  async byte() {
    if (this.eof())
      return;
    if (!this.started)
      await this._init();
    if (this.cursor === this.buffer.length) {
      await this._loadnext();
      if (this._ended)
        return;
    }
    this._moveCursor(1);
    return this.buffer[this.undoCursor];
  }
  async chunk() {
    if (this.eof())
      return;
    if (!this.started)
      await this._init();
    if (this.cursor === this.buffer.length) {
      await this._loadnext();
      if (this._ended)
        return;
    }
    this._moveCursor(this.buffer.length);
    return this.buffer.slice(this.undoCursor, this.cursor);
  }
  async read(n) {
    if (this.eof())
      return;
    if (!this.started)
      await this._init();
    if (this.cursor + n > this.buffer.length) {
      this._trim();
      await this._accumulate(n);
    }
    this._moveCursor(n);
    return this.buffer.slice(this.undoCursor, this.cursor);
  }
  async skip(n) {
    if (this.eof())
      return;
    if (!this.started)
      await this._init();
    if (this.cursor + n > this.buffer.length) {
      this._trim();
      await this._accumulate(n);
    }
    this._moveCursor(n);
  }
  async undo() {
    this.cursor = this.undoCursor;
  }
  async _next() {
    this.started = true;
    let { done, value } = await this.stream.next();
    if (done) {
      this._ended = true;
      if (!value)
        return Buffer.alloc(0);
    }
    if (value) {
      value = Buffer.from(value);
    }
    return value;
  }
  _trim() {
    this.buffer = this.buffer.slice(this.undoCursor);
    this.cursor -= this.undoCursor;
    this._discardedBytes += this.undoCursor;
    this.undoCursor = 0;
  }
  _moveCursor(n) {
    this.undoCursor = this.cursor;
    this.cursor += n;
    if (this.cursor > this.buffer.length) {
      this.cursor = this.buffer.length;
    }
  }
  async _accumulate(n) {
    if (this._ended)
      return;
    const buffers = [this.buffer];
    while (this.cursor + n > lengthBuffers(buffers)) {
      const nextbuffer = await this._next();
      if (this._ended)
        break;
      buffers.push(nextbuffer);
    }
    this.buffer = Buffer.concat(buffers);
  }
  async _loadnext() {
    this._discardedBytes += this.buffer.length;
    this.undoCursor = 0;
    this.cursor = 0;
    this.buffer = await this._next();
  }
  async _init() {
    this.buffer = await this._next();
  }
};
function lengthBuffers(buffers) {
  return buffers.reduce((acc, buffer) => acc + buffer.length, 0);
}
async function listpack(stream, onData) {
  const reader = new StreamReader(stream);
  let PACK = await reader.read(4);
  PACK = PACK.toString("utf8");
  if (PACK !== "PACK") {
    throw new InternalError(`Invalid PACK header '${PACK}'`);
  }
  let version = await reader.read(4);
  version = version.readUInt32BE(0);
  if (version !== 2) {
    throw new InternalError(`Invalid packfile version: ${version}`);
  }
  let numObjects = await reader.read(4);
  numObjects = numObjects.readUInt32BE(0);
  if (numObjects < 1)
    return;
  while (!reader.eof() && numObjects--) {
    const offset = reader.tell();
    const { type, length, ofs, reference } = await parseHeader(reader);
    const inflator = new import_pako.default.Inflate();
    while (!inflator.result) {
      const chunk = await reader.chunk();
      if (!chunk)
        break;
      inflator.push(chunk, false);
      if (inflator.err) {
        throw new InternalError(`Pako error: ${inflator.msg}`);
      }
      if (inflator.result) {
        if (inflator.result.length !== length) {
          throw new InternalError(
            `Inflated object size is different from that stated in packfile.`
          );
        }
        await reader.undo();
        await reader.read(chunk.length - inflator.strm.avail_in);
        const end = reader.tell();
        await onData({
          data: inflator.result,
          type,
          num: numObjects,
          offset,
          end,
          reference,
          ofs
        });
      }
    }
  }
}
async function parseHeader(reader) {
  let byte = await reader.byte();
  const type = byte >> 4 & 7;
  let length = byte & 15;
  if (byte & 128) {
    let shift = 4;
    do {
      byte = await reader.byte();
      length |= (byte & 127) << shift;
      shift += 7;
    } while (byte & 128);
  }
  let ofs;
  let reference;
  if (type === 6) {
    let shift = 0;
    ofs = 0;
    const bytes = [];
    do {
      byte = await reader.byte();
      ofs |= (byte & 127) << shift;
      shift += 7;
      bytes.push(byte);
    } while (byte & 128);
    reference = Buffer.from(bytes);
  }
  if (type === 7) {
    const buf = await reader.read(20);
    reference = buf;
  }
  return { type, length, ofs, reference };
}
var supportsDecompressionStream = false;
async function inflate(buffer) {
  if (supportsDecompressionStream === null) {
    supportsDecompressionStream = testDecompressionStream();
  }
  return supportsDecompressionStream ? browserInflate(buffer) : import_pako.default.inflate(buffer);
}
async function browserInflate(buffer) {
  const ds = new DecompressionStream("deflate");
  const d = new Blob([buffer]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(d).arrayBuffer());
}
function testDecompressionStream() {
  try {
    const ds = new DecompressionStream("deflate");
    if (ds)
      return true;
  } catch (_) {
  }
  return false;
}
function decodeVarInt(reader) {
  const bytes = [];
  let byte = 0;
  let multibyte = 0;
  do {
    byte = reader.readUInt8();
    const lastSeven = byte & 127;
    bytes.push(lastSeven);
    multibyte = byte & 128;
  } while (multibyte);
  return bytes.reduce((a, b) => a + 1 << 7 | b, -1);
}
function otherVarIntDecode(reader, startWith) {
  let result = startWith;
  let shift = 4;
  let byte = null;
  do {
    byte = reader.readUInt8();
    result |= (byte & 127) << shift;
    shift += 7;
  } while (byte & 128);
  return result;
}
var GitPackIndex = class _GitPackIndex {
  constructor(stuff) {
    Object.assign(this, stuff);
    this.offsetCache = {};
  }
  static async fromIdx({ idx, getExternalRefDelta }) {
    const reader = new BufferCursor(idx);
    const magic = reader.slice(4).toString("hex");
    if (magic !== "ff744f63") {
      return;
    }
    const version = reader.readUInt32BE();
    if (version !== 2) {
      throw new InternalError(
        `Unable to read version ${version} packfile IDX. (Only version 2 supported)`
      );
    }
    if (idx.byteLength > 2048 * 1024 * 1024) {
      throw new InternalError(
        `To keep implementation simple, I haven't implemented the layer 5 feature needed to support packfiles > 2GB in size.`
      );
    }
    reader.seek(reader.tell() + 4 * 255);
    const size = reader.readUInt32BE();
    const hashes = [];
    for (let i = 0; i < size; i++) {
      const hash = reader.slice(20).toString("hex");
      hashes[i] = hash;
    }
    reader.seek(reader.tell() + 4 * size);
    const offsets = /* @__PURE__ */ new Map();
    for (let i = 0; i < size; i++) {
      offsets.set(hashes[i], reader.readUInt32BE());
    }
    const packfileSha = reader.slice(20).toString("hex");
    return new _GitPackIndex({
      hashes,
      crcs: {},
      offsets,
      packfileSha,
      getExternalRefDelta
    });
  }
  static async fromPack({ pack, getExternalRefDelta, onProgress }) {
    const listpackTypes = {
      1: "commit",
      2: "tree",
      3: "blob",
      4: "tag",
      6: "ofs-delta",
      7: "ref-delta"
    };
    const offsetToObject = {};
    const packfileSha = pack.slice(-20).toString("hex");
    const hashes = [];
    const crcs = {};
    const offsets = /* @__PURE__ */ new Map();
    let totalObjectCount = null;
    let lastPercent = null;
    await listpack([pack], async ({ data, type, reference, offset, num: num2 }) => {
      if (totalObjectCount === null)
        totalObjectCount = num2;
      const percent = Math.floor(
        (totalObjectCount - num2) * 100 / totalObjectCount
      );
      if (percent !== lastPercent) {
        if (onProgress) {
          await onProgress({
            phase: "Receiving objects",
            loaded: totalObjectCount - num2,
            total: totalObjectCount
          });
        }
      }
      lastPercent = percent;
      type = listpackTypes[type];
      if (["commit", "tree", "blob", "tag"].includes(type)) {
        offsetToObject[offset] = {
          type,
          offset
        };
      } else if (type === "ofs-delta") {
        offsetToObject[offset] = {
          type,
          offset
        };
      } else if (type === "ref-delta") {
        offsetToObject[offset] = {
          type,
          offset
        };
      }
    });
    const offsetArray = Object.keys(offsetToObject).map(Number);
    for (const [i, start] of offsetArray.entries()) {
      const end = i + 1 === offsetArray.length ? pack.byteLength - 20 : offsetArray[i + 1];
      const o = offsetToObject[start];
      const crc = import_crc_32.default.buf(pack.slice(start, end)) >>> 0;
      o.end = end;
      o.crc = crc;
    }
    const p = new _GitPackIndex({
      pack: Promise.resolve(pack),
      packfileSha,
      crcs,
      hashes,
      offsets,
      getExternalRefDelta
    });
    lastPercent = null;
    let count = 0;
    const objectsByDepth = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let offset in offsetToObject) {
      offset = Number(offset);
      const percent = Math.floor(count * 100 / totalObjectCount);
      if (percent !== lastPercent) {
        if (onProgress) {
          await onProgress({
            phase: "Resolving deltas",
            loaded: count,
            total: totalObjectCount
          });
        }
      }
      count++;
      lastPercent = percent;
      const o = offsetToObject[offset];
      if (o.oid)
        continue;
      try {
        p.readDepth = 0;
        p.externalReadDepth = 0;
        const { type, object } = await p.readSlice({ start: offset });
        objectsByDepth[p.readDepth] += 1;
        const oid = await shasum(GitObject.wrap({ type, object }));
        o.oid = oid;
        hashes.push(oid);
        offsets.set(oid, offset);
        crcs[oid] = o.crc;
      } catch (err) {
        continue;
      }
    }
    hashes.sort();
    return p;
  }
  async toBuffer() {
    const buffers = [];
    const write = (str, encoding) => {
      buffers.push(Buffer.from(str, encoding));
    };
    write("ff744f63", "hex");
    write("00000002", "hex");
    const fanoutBuffer = new BufferCursor(Buffer.alloc(256 * 4));
    for (let i = 0; i < 256; i++) {
      let count = 0;
      for (const hash of this.hashes) {
        if (parseInt(hash.slice(0, 2), 16) <= i)
          count++;
      }
      fanoutBuffer.writeUInt32BE(count);
    }
    buffers.push(fanoutBuffer.buffer);
    for (const hash of this.hashes) {
      write(hash, "hex");
    }
    const crcsBuffer = new BufferCursor(Buffer.alloc(this.hashes.length * 4));
    for (const hash of this.hashes) {
      crcsBuffer.writeUInt32BE(this.crcs[hash]);
    }
    buffers.push(crcsBuffer.buffer);
    const offsetsBuffer = new BufferCursor(Buffer.alloc(this.hashes.length * 4));
    for (const hash of this.hashes) {
      offsetsBuffer.writeUInt32BE(this.offsets.get(hash));
    }
    buffers.push(offsetsBuffer.buffer);
    write(this.packfileSha, "hex");
    const totalBuffer = Buffer.concat(buffers);
    const sha = await shasum(totalBuffer);
    const shaBuffer = Buffer.alloc(20);
    shaBuffer.write(sha, "hex");
    return Buffer.concat([totalBuffer, shaBuffer]);
  }
  async load({ pack }) {
    this.pack = pack;
  }
  async unload() {
    this.pack = null;
  }
  async read({ oid }) {
    if (!this.offsets.get(oid)) {
      if (this.getExternalRefDelta) {
        this.externalReadDepth++;
        return this.getExternalRefDelta(oid);
      } else {
        throw new InternalError(`Could not read object ${oid} from packfile`);
      }
    }
    const start = this.offsets.get(oid);
    return this.readSlice({ start });
  }
  async readSlice({ start }) {
    if (this.offsetCache[start]) {
      return Object.assign({}, this.offsetCache[start]);
    }
    this.readDepth++;
    const types2 = {
      16: "commit",
      32: "tree",
      48: "blob",
      64: "tag",
      96: "ofs_delta",
      112: "ref_delta"
    };
    const pack = await this.pack;
    if (!pack) {
      throw new InternalError(
        "Could not read packfile data. The packfile may be missing, corrupted, or too large to read into memory."
      );
    }
    const raw = pack.slice(start);
    const reader = new BufferCursor(raw);
    const byte = reader.readUInt8();
    const btype = byte & 112;
    let type = types2[btype];
    if (type === void 0) {
      throw new InternalError("Unrecognized type: 0b" + btype.toString(2));
    }
    const lastFour = byte & 15;
    let length = lastFour;
    const multibyte = byte & 128;
    if (multibyte) {
      length = otherVarIntDecode(reader, lastFour);
    }
    let base = null;
    let object = null;
    if (type === "ofs_delta") {
      const offset = decodeVarInt(reader);
      const baseOffset = start - offset;
      ({ object: base, type } = await this.readSlice({ start: baseOffset }));
    }
    if (type === "ref_delta") {
      const oid = reader.slice(20).toString("hex");
      ({ object: base, type } = await this.read({ oid }));
    }
    const buffer = raw.slice(reader.tell());
    object = Buffer.from(await inflate(buffer));
    if (object.byteLength !== length) {
      throw new InternalError(
        `Packfile told us object would have length ${length} but it had length ${object.byteLength}`
      );
    }
    if (base) {
      object = Buffer.from(applyDelta(object, base));
    }
    if (this.readDepth > 3) {
      this.offsetCache[start] = { type, object };
    }
    return { type, format: "content", object };
  }
};
var PackfileCache = Symbol("PackfileCache");
async function loadPackIndex({
  fs,
  filename,
  getExternalRefDelta,
  emitter,
  emitterPrefix
}) {
  const idx = await fs.read(filename);
  return GitPackIndex.fromIdx({ idx, getExternalRefDelta });
}
function readPackIndex({
  fs,
  cache,
  filename,
  getExternalRefDelta,
  emitter,
  emitterPrefix
}) {
  if (!cache[PackfileCache])
    cache[PackfileCache] = /* @__PURE__ */ new Map();
  let p = cache[PackfileCache].get(filename);
  if (!p) {
    p = loadPackIndex({
      fs,
      filename,
      getExternalRefDelta,
      emitter,
      emitterPrefix
    });
    cache[PackfileCache].set(filename, p);
  }
  return p;
}
async function shasumRange(buffer, { start = 0, end = buffer.length } = {}) {
  return shasum(buffer.subarray(start, end));
}
async function readObjectPacked({
  fs,
  cache,
  gitdir,
  oid,
  format = "content",
  getExternalRefDelta
}) {
  let list = await fs.readdir(join(gitdir, "objects/pack"));
  list = list.filter((x) => x.endsWith(".idx"));
  for (const filename of list) {
    const indexFile = `${gitdir}/objects/pack/${filename}`;
    const p = await readPackIndex({
      fs,
      cache,
      filename: indexFile,
      getExternalRefDelta
    });
    if (p.error)
      throw new InternalError(p.error);
    if (p.offsets.has(oid)) {
      const packFile = indexFile.replace(/idx$/, "pack");
      if (!p.pack) {
        p.pack = fs.read(packFile);
      }
      const pack = await p.pack;
      if (!pack) {
        p.pack = null;
        throw new InternalError(
          `Could not read packfile at ${packFile}. The file may be missing, corrupted, or too large to read into memory.`
        );
      }
      if (!p._checksumVerified) {
        const expectedShaFromIndex = p.packfileSha;
        const packTrailer = pack.subarray(-20);
        const packTrailerSha = Array.from(packTrailer).map((b) => b.toString(16).padStart(2, "0")).join("");
        if (packTrailerSha !== expectedShaFromIndex) {
          throw new InternalError(
            `Packfile trailer mismatch: expected ${expectedShaFromIndex}, got ${packTrailerSha}. The packfile may be corrupted.`
          );
        }
        const actualPayloadSha = await shasumRange(pack, {
          start: 0,
          end: pack.length - 20
        });
        if (actualPayloadSha !== expectedShaFromIndex) {
          throw new InternalError(
            `Packfile payload corrupted: calculated ${actualPayloadSha} but expected ${expectedShaFromIndex}. The packfile may have been tampered with.`
          );
        }
        p._checksumVerified = true;
      }
      const result = await p.read({ oid, getExternalRefDelta });
      result.format = "content";
      result.source = `objects/pack/${filename.replace(/idx$/, "pack")}`;
      return result;
    }
  }
  return null;
}
async function _readObject({
  fs,
  cache,
  gitdir,
  oid,
  format = "content"
}) {
  const getExternalRefDelta = (oid2) => _readObject({ fs, cache, gitdir, oid: oid2 });
  let result;
  if (oid === "4b825dc642cb6eb9a060e54bf8d69288fbee4904") {
    result = { format: "wrapped", object: Buffer.from(`tree 0\0`) };
  }
  if (!result) {
    result = await readObjectLoose({ fs, gitdir, oid });
  }
  if (!result) {
    result = await readObjectPacked({
      fs,
      cache,
      gitdir,
      oid,
      getExternalRefDelta
    });
    if (!result) {
      throw new NotFoundError(oid);
    }
    return result;
  }
  if (format === "deflated") {
    return result;
  }
  if (result.format === "deflated") {
    result.object = Buffer.from(await inflate(result.object));
    result.format = "wrapped";
  }
  if (format === "wrapped") {
    return result;
  }
  const sha = await shasum(result.object);
  if (sha !== oid) {
    throw new InternalError(
      `SHA check failed! Expected ${oid}, computed ${sha}`
    );
  }
  const { object, type } = GitObject.unwrap(result.object);
  result.type = type;
  result.object = object;
  result.format = "content";
  if (format === "content") {
    return result;
  }
  throw new InternalError(`invalid requested format "${format}"`);
}
var AlreadyExistsError = class _AlreadyExistsError extends BaseError {
  /**
   * @param {'note'|'remote'|'tag'|'branch'} noun
   * @param {string} where
   * @param {boolean} canForce
   */
  constructor(noun, where, canForce = true) {
    super(
      `Failed to create ${noun} at ${where} because it already exists.${canForce ? ` (Hint: use 'force: true' parameter to overwrite existing ${noun}.)` : ""}`
    );
    this.code = this.name = _AlreadyExistsError.code;
    this.data = { noun, where, canForce };
  }
};
AlreadyExistsError.code = "AlreadyExistsError";
var AmbiguousError = class _AmbiguousError extends BaseError {
  /**
   * @param {'oids'|'refs'} nouns
   * @param {string} short
   * @param {string[]} matches
   */
  constructor(nouns, short, matches) {
    super(
      `Found multiple ${nouns} matching "${short}" (${matches.join(
        ", "
      )}). Use a longer abbreviation length to disambiguate them.`
    );
    this.code = this.name = _AmbiguousError.code;
    this.data = { nouns, short, matches };
  }
};
AmbiguousError.code = "AmbiguousError";
var CheckoutConflictError = class _CheckoutConflictError extends BaseError {
  /**
   * @param {string[]} filepaths
   */
  constructor(filepaths) {
    super(
      `Your local changes to the following files would be overwritten by checkout: ${filepaths.join(
        ", "
      )}`
    );
    this.code = this.name = _CheckoutConflictError.code;
    this.data = { filepaths };
  }
};
CheckoutConflictError.code = "CheckoutConflictError";
var CherryPickMergeCommitError = class _CherryPickMergeCommitError extends BaseError {
  /**
   * @param {string} oid
   * @param {number} parentCount
   */
  constructor(oid, parentCount) {
    super(
      `Cannot cherry-pick merge commit ${oid}. Merge commits have ${parentCount} parents and require specifying which parent to use as the base.`
    );
    this.code = this.name = _CherryPickMergeCommitError.code;
    this.data = { oid, parentCount };
  }
};
CherryPickMergeCommitError.code = "CherryPickMergeCommitError";
var CherryPickRootCommitError = class _CherryPickRootCommitError extends BaseError {
  /**
   * @param {string} oid
   */
  constructor(oid) {
    super(
      `Cannot cherry-pick root commit ${oid}. Root commits have no parents.`
    );
    this.code = this.name = _CherryPickRootCommitError.code;
    this.data = { oid };
  }
};
CherryPickRootCommitError.code = "CherryPickRootCommitError";
var CommitNotFetchedError = class _CommitNotFetchedError extends BaseError {
  /**
   * @param {string} ref
   * @param {string} oid
   */
  constructor(ref, oid) {
    super(
      `Failed to checkout "${ref}" because commit ${oid} is not available locally. Do a git fetch to make the branch available locally.`
    );
    this.code = this.name = _CommitNotFetchedError.code;
    this.data = { ref, oid };
  }
};
CommitNotFetchedError.code = "CommitNotFetchedError";
var EmptyCommitError = class _EmptyCommitError extends BaseError {
  constructor() {
    super("Cannot create an empty commit when disallowEmpty is true.");
    this.code = this.name = _EmptyCommitError.code;
    this.data = {};
  }
};
EmptyCommitError.code = "EmptyCommitError";
var EmptyServerResponseError = class _EmptyServerResponseError extends BaseError {
  constructor() {
    super(`Empty response from git server.`);
    this.code = this.name = _EmptyServerResponseError.code;
    this.data = {};
  }
};
EmptyServerResponseError.code = "EmptyServerResponseError";
var FastForwardError = class _FastForwardError extends BaseError {
  constructor() {
    super(`A simple fast-forward merge was not possible.`);
    this.code = this.name = _FastForwardError.code;
    this.data = {};
  }
};
FastForwardError.code = "FastForwardError";
var GitPushError = class _GitPushError extends BaseError {
  /**
   * @param {string} prettyDetails
   * @param {PushResult} result
   */
  constructor(prettyDetails, result) {
    super(`One or more branches were not updated: ${prettyDetails}`);
    this.code = this.name = _GitPushError.code;
    this.data = { prettyDetails, result };
  }
};
GitPushError.code = "GitPushError";
var HttpError = class _HttpError extends BaseError {
  /**
   * @param {number} statusCode
   * @param {string} statusMessage
   * @param {string} response
   */
  constructor(statusCode, statusMessage, response) {
    super(`HTTP Error: ${statusCode} ${statusMessage}`);
    this.code = this.name = _HttpError.code;
    this.data = { statusCode, statusMessage, response };
  }
};
HttpError.code = "HttpError";
var InvalidFilepathError = class _InvalidFilepathError extends BaseError {
  /**
   * @param {'leading-slash'|'trailing-slash'|'directory'} [reason]
   */
  constructor(reason) {
    let message = "invalid filepath";
    if (reason === "leading-slash" || reason === "trailing-slash") {
      message = `"filepath" parameter should not include leading or trailing directory separators because these can cause problems on some platforms.`;
    } else if (reason === "directory") {
      message = `"filepath" should not be a directory.`;
    }
    super(message);
    this.code = this.name = _InvalidFilepathError.code;
    this.data = { reason };
  }
};
InvalidFilepathError.code = "InvalidFilepathError";
var InvalidRefNameError = class _InvalidRefNameError extends BaseError {
  /**
   * @param {string} ref
   * @param {string} suggestion
   * @param {boolean} canForce
   */
  constructor(ref, suggestion) {
    super(
      `"${ref}" would be an invalid git reference. (Hint: a valid alternative would be "${suggestion}".)`
    );
    this.code = this.name = _InvalidRefNameError.code;
    this.data = { ref, suggestion };
  }
};
InvalidRefNameError.code = "InvalidRefNameError";
var MaxDepthError = class _MaxDepthError extends BaseError {
  /**
   * @param {number} depth
   */
  constructor(depth) {
    super(`Maximum search depth of ${depth} exceeded.`);
    this.code = this.name = _MaxDepthError.code;
    this.data = { depth };
  }
};
MaxDepthError.code = "MaxDepthError";
var MergeNotSupportedError = class _MergeNotSupportedError extends BaseError {
  constructor() {
    super(`Merges with conflicts are not supported yet.`);
    this.code = this.name = _MergeNotSupportedError.code;
    this.data = {};
  }
};
MergeNotSupportedError.code = "MergeNotSupportedError";
var MergeConflictError = class _MergeConflictError extends BaseError {
  /**
   * @param {Array<string>} filepaths
   * @param {Array<string>} bothModified
   * @param {Array<string>} deleteByUs
   * @param {Array<string>} deleteByTheirs
   */
  constructor(filepaths, bothModified, deleteByUs, deleteByTheirs) {
    super(
      `Automatic merge failed with one or more merge conflicts in the following files: ${filepaths.toString()}. Fix conflicts then commit the result.`
    );
    this.code = this.name = _MergeConflictError.code;
    this.data = { filepaths, bothModified, deleteByUs, deleteByTheirs };
  }
};
MergeConflictError.code = "MergeConflictError";
var MissingNameError = class _MissingNameError extends BaseError {
  /**
   * @param {'author'|'committer'|'tagger'} role
   */
  constructor(role) {
    super(
      `No name was provided for ${role} in the argument or in the .git/config file.`
    );
    this.code = this.name = _MissingNameError.code;
    this.data = { role };
  }
};
MissingNameError.code = "MissingNameError";
var MissingParameterError = class _MissingParameterError extends BaseError {
  /**
   * @param {string} parameter
   */
  constructor(parameter) {
    super(
      `The function requires a "${parameter}" parameter but none was provided.`
    );
    this.code = this.name = _MissingParameterError.code;
    this.data = { parameter };
  }
};
MissingParameterError.code = "MissingParameterError";
var MultipleGitError = class _MultipleGitError extends BaseError {
  /**
   * @param {Error[]} errors
   * @param {string} message
   */
  constructor(errors) {
    super(
      `There are multiple errors that were thrown by the method. Please refer to the "errors" property to see more`
    );
    this.code = this.name = _MultipleGitError.code;
    this.data = { errors };
    this.errors = errors;
  }
};
MultipleGitError.code = "MultipleGitError";
var ParseError = class _ParseError extends BaseError {
  /**
   * @param {string} expected
   * @param {string} actual
   */
  constructor(expected, actual) {
    super(`Expected "${expected}" but received "${actual}".`);
    this.code = this.name = _ParseError.code;
    this.data = { expected, actual };
  }
};
ParseError.code = "ParseError";
var PushRejectedError = class _PushRejectedError extends BaseError {
  /**
   * @param {'not-fast-forward'|'tag-exists'} reason
   */
  constructor(reason) {
    let message = "";
    if (reason === "not-fast-forward") {
      message = " because it was not a simple fast-forward";
    } else if (reason === "tag-exists") {
      message = " because tag already exists";
    }
    super(`Push rejected${message}. Use "force: true" to override.`);
    this.code = this.name = _PushRejectedError.code;
    this.data = { reason };
  }
};
PushRejectedError.code = "PushRejectedError";
var RemoteCapabilityError = class _RemoteCapabilityError extends BaseError {
  /**
   * @param {'shallow'|'deepen-since'|'deepen-not'|'deepen-relative'} capability
   * @param {'depth'|'since'|'exclude'|'relative'} parameter
   */
  constructor(capability, parameter) {
    super(
      `Remote does not support the "${capability}" so the "${parameter}" parameter cannot be used.`
    );
    this.code = this.name = _RemoteCapabilityError.code;
    this.data = { capability, parameter };
  }
};
RemoteCapabilityError.code = "RemoteCapabilityError";
var SmartHttpError = class _SmartHttpError extends BaseError {
  /**
   * @param {string} preview
   * @param {string} response
   */
  constructor(preview, response) {
    super(
      `Remote did not reply using the "smart" HTTP protocol. Expected "001e# service=git-upload-pack" but received: ${preview}`
    );
    this.code = this.name = _SmartHttpError.code;
    this.data = { preview, response };
  }
};
SmartHttpError.code = "SmartHttpError";
var UnknownTransportError = class _UnknownTransportError extends BaseError {
  /**
   * @param {string} url
   * @param {string} transport
   * @param {string} [suggestion]
   */
  constructor(url, transport, suggestion) {
    super(
      `Git remote "${url}" uses an unrecognized transport protocol: "${transport}"`
    );
    this.code = this.name = _UnknownTransportError.code;
    this.data = { url, transport, suggestion };
  }
};
UnknownTransportError.code = "UnknownTransportError";
var UrlParseError = class _UrlParseError extends BaseError {
  /**
   * @param {string} url
   */
  constructor(url) {
    super(`Cannot parse remote URL: "${url}"`);
    this.code = this.name = _UrlParseError.code;
    this.data = { url };
  }
};
UrlParseError.code = "UrlParseError";
var UserCanceledError = class _UserCanceledError extends BaseError {
  constructor() {
    super(`The operation was canceled.`);
    this.code = this.name = _UserCanceledError.code;
    this.data = {};
  }
};
UserCanceledError.code = "UserCanceledError";
var IndexResetError = class _IndexResetError extends BaseError {
  /**
   * @param {Array<string>} filepaths
   */
  constructor(filepath) {
    super(
      `Could not merge index: Entry for '${filepath}' is not up to date. Either reset the index entry to HEAD, or stage your unstaged changes.`
    );
    this.code = this.name = _IndexResetError.code;
    this.data = { filepath };
  }
};
IndexResetError.code = "IndexResetError";
var NoCommitError = class _NoCommitError extends BaseError {
  /**
   * @param {string} ref
   */
  constructor(ref) {
    super(
      `"${ref}" does not point to any commit. You're maybe working on a repository with no commits yet. `
    );
    this.code = this.name = _NoCommitError.code;
    this.data = { ref };
  }
};
NoCommitError.code = "NoCommitError";
function formatAuthor({ name: name2, email, timestamp, timezoneOffset }) {
  timezoneOffset = formatTimezoneOffset(timezoneOffset);
  return `${name2} <${email}> ${timestamp} ${timezoneOffset}`;
}
function formatTimezoneOffset(minutes) {
  const sign = simpleSign(negateExceptForZero(minutes));
  minutes = Math.abs(minutes);
  const hours = Math.floor(minutes / 60);
  minutes -= hours * 60;
  let strHours = String(hours);
  let strMinutes = String(minutes);
  if (strHours.length < 2)
    strHours = "0" + strHours;
  if (strMinutes.length < 2)
    strMinutes = "0" + strMinutes;
  return (sign === -1 ? "-" : "+") + strHours + strMinutes;
}
function simpleSign(n) {
  return Math.sign(n) || (Object.is(n, -0) ? -1 : 1);
}
function negateExceptForZero(n) {
  return n === 0 ? n : -n;
}
function normalizeNewlines(str) {
  str = str.replace(/\r/g, "");
  str = str.replace(/^\n+/, "");
  str = str.replace(/\n+$/, "") + "\n";
  return str;
}
function parseAuthor(author) {
  const [, name2, email, timestamp, offset] = author.match(
    /^(.*) <(.*)> (.*) (.*)$/
  );
  return {
    name: name2,
    email,
    timestamp: Number(timestamp),
    timezoneOffset: parseTimezoneOffset(offset)
  };
}
function parseTimezoneOffset(offset) {
  let [, sign, hours, minutes] = offset.match(/(\+|-)(\d\d)(\d\d)/);
  minutes = (sign === "+" ? 1 : -1) * (Number(hours) * 60 + Number(minutes));
  return negateExceptForZero$1(minutes);
}
function negateExceptForZero$1(n) {
  return n === 0 ? n : -n;
}
var GitAnnotatedTag = class _GitAnnotatedTag {
  constructor(tag) {
    if (typeof tag === "string") {
      this._tag = tag;
    } else if (Buffer.isBuffer(tag)) {
      this._tag = tag.toString("utf8");
    } else if (typeof tag === "object") {
      this._tag = _GitAnnotatedTag.render(tag);
    } else {
      throw new InternalError(
        "invalid type passed to GitAnnotatedTag constructor"
      );
    }
  }
  static from(tag) {
    return new _GitAnnotatedTag(tag);
  }
  static render(obj) {
    return `object ${obj.object}
type ${obj.type}
tag ${obj.tag}
tagger ${formatAuthor(obj.tagger)}

${obj.message}
${obj.gpgsig ? obj.gpgsig : ""}`;
  }
  justHeaders() {
    return this._tag.slice(0, this._tag.indexOf("\n\n"));
  }
  message() {
    const tag = this.withoutSignature();
    return tag.slice(tag.indexOf("\n\n") + 2);
  }
  parse() {
    return Object.assign(this.headers(), {
      message: this.message(),
      gpgsig: this.gpgsig()
    });
  }
  render() {
    return this._tag;
  }
  headers() {
    const headers = this.justHeaders().split("\n");
    const hs = [];
    for (const h of headers) {
      if (h[0] === " ") {
        hs[hs.length - 1] += "\n" + h.slice(1);
      } else {
        hs.push(h);
      }
    }
    const obj = {};
    for (const h of hs) {
      const key = h.slice(0, h.indexOf(" "));
      const value = h.slice(h.indexOf(" ") + 1);
      if (Array.isArray(obj[key])) {
        obj[key].push(value);
      } else {
        obj[key] = value;
      }
    }
    if (obj.tagger) {
      obj.tagger = parseAuthor(obj.tagger);
    }
    if (obj.committer) {
      obj.committer = parseAuthor(obj.committer);
    }
    return obj;
  }
  withoutSignature() {
    const tag = normalizeNewlines(this._tag);
    if (tag.indexOf("\n-----BEGIN PGP SIGNATURE-----") === -1)
      return tag;
    return tag.slice(0, tag.lastIndexOf("\n-----BEGIN PGP SIGNATURE-----"));
  }
  gpgsig() {
    if (this._tag.indexOf("\n-----BEGIN PGP SIGNATURE-----") === -1)
      return;
    const signature = this._tag.slice(
      this._tag.indexOf("-----BEGIN PGP SIGNATURE-----"),
      this._tag.indexOf("-----END PGP SIGNATURE-----") + "-----END PGP SIGNATURE-----".length
    );
    return normalizeNewlines(signature);
  }
  payload() {
    return this.withoutSignature() + "\n";
  }
  toObject() {
    return Buffer.from(this._tag, "utf8");
  }
  static async sign(tag, sign, secretKey) {
    const payload = tag.payload();
    let { signature } = await sign({ payload, secretKey });
    signature = normalizeNewlines(signature);
    const signedTag = payload + signature;
    return _GitAnnotatedTag.from(signedTag);
  }
};
function indent(str) {
  return str.trim().split("\n").map((x) => " " + x).join("\n") + "\n";
}
function outdent(str) {
  return str.split("\n").map((x) => x.replace(/^ /, "")).join("\n");
}
var GitCommit = class _GitCommit {
  constructor(commit2) {
    if (typeof commit2 === "string") {
      this._commit = commit2;
    } else if (Buffer.isBuffer(commit2)) {
      this._commit = commit2.toString("utf8");
    } else if (typeof commit2 === "object") {
      this._commit = _GitCommit.render(commit2);
    } else {
      throw new InternalError("invalid type passed to GitCommit constructor");
    }
  }
  static fromPayloadSignature({ payload, signature }) {
    const headers = _GitCommit.justHeaders(payload);
    const message = _GitCommit.justMessage(payload);
    const commit2 = normalizeNewlines(
      headers + "\ngpgsig" + indent(signature) + "\n" + message
    );
    return new _GitCommit(commit2);
  }
  static from(commit2) {
    return new _GitCommit(commit2);
  }
  toObject() {
    return Buffer.from(this._commit, "utf8");
  }
  // Todo: allow setting the headers and message
  headers() {
    return this.parseHeaders();
  }
  // Todo: allow setting the headers and message
  message() {
    return _GitCommit.justMessage(this._commit);
  }
  parse() {
    return Object.assign({ message: this.message() }, this.headers());
  }
  static justMessage(commit2) {
    return normalizeNewlines(commit2.slice(commit2.indexOf("\n\n") + 2));
  }
  static justHeaders(commit2) {
    return commit2.slice(0, commit2.indexOf("\n\n"));
  }
  parseHeaders() {
    const headers = _GitCommit.justHeaders(this._commit).split("\n");
    const hs = [];
    for (const h of headers) {
      if (h[0] === " ") {
        hs[hs.length - 1] += "\n" + h.slice(1);
      } else {
        hs.push(h);
      }
    }
    const obj = {
      parent: []
    };
    for (const h of hs) {
      const key = h.slice(0, h.indexOf(" "));
      const value = h.slice(h.indexOf(" ") + 1);
      if (Array.isArray(obj[key])) {
        obj[key].push(value);
      } else {
        obj[key] = value;
      }
    }
    if (obj.author) {
      obj.author = parseAuthor(obj.author);
    }
    if (obj.committer) {
      obj.committer = parseAuthor(obj.committer);
    }
    return obj;
  }
  static renderHeaders(obj) {
    let headers = "";
    if (obj.tree) {
      headers += `tree ${obj.tree}
`;
    } else {
      headers += `tree 4b825dc642cb6eb9a060e54bf8d69288fbee4904
`;
    }
    if (obj.parent) {
      if (obj.parent.length === void 0) {
        throw new InternalError(`commit 'parent' property should be an array`);
      }
      for (const p of obj.parent) {
        headers += `parent ${p}
`;
      }
    }
    const author = obj.author;
    headers += `author ${formatAuthor(author)}
`;
    const committer = obj.committer || obj.author;
    headers += `committer ${formatAuthor(committer)}
`;
    if (obj.gpgsig) {
      headers += "gpgsig" + indent(obj.gpgsig);
    }
    return headers;
  }
  static render(obj) {
    return _GitCommit.renderHeaders(obj) + "\n" + normalizeNewlines(obj.message);
  }
  render() {
    return this._commit;
  }
  withoutSignature() {
    const commit2 = normalizeNewlines(this._commit);
    if (commit2.indexOf("\ngpgsig") === -1)
      return commit2;
    const headers = commit2.slice(0, commit2.indexOf("\ngpgsig"));
    const message = commit2.slice(
      commit2.indexOf("-----END PGP SIGNATURE-----\n") + "-----END PGP SIGNATURE-----\n".length
    );
    return normalizeNewlines(headers + "\n" + message);
  }
  isolateSignature() {
    const signature = this._commit.slice(
      this._commit.indexOf("-----BEGIN PGP SIGNATURE-----"),
      this._commit.indexOf("-----END PGP SIGNATURE-----") + "-----END PGP SIGNATURE-----".length
    );
    return outdent(signature);
  }
  static async sign(commit2, sign, secretKey) {
    const payload = commit2.withoutSignature();
    const message = _GitCommit.justMessage(commit2._commit);
    let { signature } = await sign({ payload, secretKey });
    signature = normalizeNewlines(signature);
    const headers = _GitCommit.justHeaders(commit2._commit);
    const signedCommit = headers + "\ngpgsig" + indent(signature) + "\n" + message;
    return _GitCommit.from(signedCommit);
  }
};
async function resolveTree({ fs, cache, gitdir, oid }) {
  if (oid === "4b825dc642cb6eb9a060e54bf8d69288fbee4904") {
    return { tree: GitTree.from([]), oid };
  }
  const { type, object } = await _readObject({ fs, cache, gitdir, oid });
  if (type === "tag") {
    oid = GitAnnotatedTag.from(object).parse().object;
    return resolveTree({ fs, cache, gitdir, oid });
  }
  if (type === "commit") {
    oid = GitCommit.from(object).parse().tree;
    return resolveTree({ fs, cache, gitdir, oid });
  }
  if (type !== "tree") {
    throw new ObjectTypeError(oid, type, "tree");
  }
  return { tree: GitTree.from(object), oid };
}
var GitWalkerRepo = class {
  constructor({ fs, gitdir, ref, cache }) {
    this.fs = fs;
    this.cache = cache;
    this.gitdir = gitdir;
    this.mapPromise = (async () => {
      const map = /* @__PURE__ */ new Map();
      let oid;
      try {
        oid = await GitRefManager.resolve({ fs, gitdir, ref });
      } catch (e) {
        if (e instanceof NotFoundError) {
          oid = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
        }
      }
      const tree = await resolveTree({ fs, cache: this.cache, gitdir, oid });
      tree.type = "tree";
      tree.mode = "40000";
      map.set(".", tree);
      return map;
    })();
    const walker = this;
    this.ConstructEntry = class TreeEntry {
      constructor(fullpath) {
        this._fullpath = fullpath;
        this._type = false;
        this._mode = false;
        this._stat = false;
        this._content = false;
        this._oid = false;
      }
      async type() {
        return walker.type(this);
      }
      async mode() {
        return walker.mode(this);
      }
      async stat() {
        return walker.stat(this);
      }
      async content() {
        return walker.content(this);
      }
      async oid() {
        return walker.oid(this);
      }
    };
  }
  async readdir(entry) {
    const filepath = entry._fullpath;
    const { fs, cache, gitdir } = this;
    const map = await this.mapPromise;
    const obj = map.get(filepath);
    if (!obj)
      throw new Error(`No obj for ${filepath}`);
    const oid = obj.oid;
    if (!oid)
      throw new Error(`No oid for obj ${JSON.stringify(obj)}`);
    if (obj.type !== "tree") {
      return null;
    }
    const { type, object } = await _readObject({ fs, cache, gitdir, oid });
    if (type !== obj.type) {
      throw new ObjectTypeError(oid, type, obj.type);
    }
    const tree = GitTree.from(object);
    for (const entry2 of tree) {
      map.set(join(filepath, entry2.path), entry2);
    }
    return tree.entries().map((entry2) => join(filepath, entry2.path));
  }
  async type(entry) {
    if (entry._type === false) {
      const map = await this.mapPromise;
      const { type } = map.get(entry._fullpath);
      entry._type = type;
    }
    return entry._type;
  }
  async mode(entry) {
    if (entry._mode === false) {
      const map = await this.mapPromise;
      const { mode } = map.get(entry._fullpath);
      entry._mode = normalizeMode(parseInt(mode, 8));
    }
    return entry._mode;
  }
  async stat(_entry) {
  }
  async content(entry) {
    if (entry._content === false) {
      const map = await this.mapPromise;
      const { fs, cache, gitdir } = this;
      const obj = map.get(entry._fullpath);
      const oid = obj.oid;
      const { type, object } = await _readObject({ fs, cache, gitdir, oid });
      if (type !== "blob") {
        entry._content = void 0;
      } else {
        entry._content = new Uint8Array(object);
      }
    }
    return entry._content;
  }
  async oid(entry) {
    if (entry._oid === false) {
      const map = await this.mapPromise;
      const obj = map.get(entry._fullpath);
      entry._oid = obj.oid;
    }
    return entry._oid;
  }
};
function TREE({ ref = "HEAD" } = {}) {
  const o = /* @__PURE__ */ Object.create(null);
  Object.defineProperty(o, GitWalkSymbol, {
    value: function({ fs, gitdir, cache }) {
      return new GitWalkerRepo({ fs, gitdir, ref, cache });
    }
  });
  Object.freeze(o);
  return o;
}
var GitWalkerFs = class {
  constructor({ fs, dir, gitdir, cache, refresh = true }) {
    this.fs = fs;
    this.cache = cache;
    this.dir = dir;
    this.gitdir = gitdir;
    this.refresh = refresh;
    this.config = null;
    const walker = this;
    this.ConstructEntry = class WorkdirEntry {
      constructor(fullpath) {
        this._fullpath = fullpath;
        this._type = false;
        this._mode = false;
        this._stat = false;
        this._content = false;
        this._oid = false;
      }
      async type() {
        return walker.type(this);
      }
      async mode() {
        return walker.mode(this);
      }
      async stat() {
        return walker.stat(this);
      }
      async content() {
        return walker.content(this);
      }
      async oid() {
        return walker.oid(this);
      }
    };
  }
  async readdir(entry) {
    if (await entry.type() !== "tree")
      return null;
    const filepath = entry._fullpath;
    const { fs, dir } = this;
    const names = await fs.readdir(join(dir, filepath));
    if (names === null)
      return null;
    return names.map((name2) => join(filepath, name2));
  }
  async type(entry) {
    if (entry._type === false) {
      await entry.stat();
    }
    return entry._type;
  }
  async mode(entry) {
    if (entry._mode === false) {
      await entry.stat();
    }
    return entry._mode;
  }
  async stat(entry) {
    if (entry._stat === false) {
      const { fs, dir } = this;
      let stat = await fs.lstat(`${dir}/${entry._fullpath}`);
      if (!stat) {
        throw new Error(
          `ENOENT: no such file or directory, lstat '${entry._fullpath}'`
        );
      }
      let type = stat.isDirectory() ? "tree" : "blob";
      if (type === "blob" && !stat.isFile() && !stat.isSymbolicLink()) {
        type = "special";
      }
      entry._type = type;
      stat = normalizeStats(stat);
      entry._mode = stat.mode;
      if (stat.size === -1 && entry._actualSize) {
        stat.size = entry._actualSize;
      }
      entry._stat = stat;
    }
    return entry._stat;
  }
  async content(entry) {
    if (entry._content === false) {
      const { fs, dir, gitdir } = this;
      if (await entry.type() === "tree") {
        entry._content = void 0;
      } else {
        let content;
        if (await entry.mode() >> 12 === 10) {
          content = await fs.readlink(`${dir}/${entry._fullpath}`);
        } else {
          const config = await this._getGitConfig(fs, gitdir);
          const autocrlf = await config.get("core.autocrlf");
          content = await fs.read(`${dir}/${entry._fullpath}`, { autocrlf });
        }
        entry._actualSize = content.length;
        if (entry._stat && entry._stat.size === -1) {
          entry._stat.size = entry._actualSize;
        }
        entry._content = new Uint8Array(content);
      }
    }
    return entry._content;
  }
  async oid(entry) {
    if (entry._oid === false) {
      const self = this;
      const { fs, gitdir, cache } = this;
      let oid;
      await GitIndexManager.acquire(
        { fs, gitdir, cache },
        async function(index) {
          const stage = index.entriesMap.get(entry._fullpath);
          const stats = await entry.stat();
          const config = await self._getGitConfig(fs, gitdir);
          const filemode = await config.get("core.filemode");
          const trustino = typeof process !== "undefined" ? !(process.platform === "win32") : true;
          if (!stage || compareStats(stats, stage, filemode, trustino)) {
            const content = await entry.content();
            if (content === void 0) {
              oid = void 0;
            } else {
              oid = await shasum(
                GitObject.wrap({ type: "blob", object: content })
              );
              if (self.refresh && stage && oid === stage.oid && (!filemode || stats.mode === stage.mode) && compareStats(stats, stage, filemode, trustino)) {
                index.insert({
                  filepath: entry._fullpath,
                  stats,
                  oid
                });
              }
            }
          } else {
            oid = stage.oid;
          }
        }
      );
      entry._oid = oid;
    }
    return entry._oid;
  }
  async _getGitConfig(fs, gitdir) {
    if (this.config) {
      return this.config;
    }
    this.config = await GitConfigManager.get({ fs, gitdir });
    return this.config;
  }
};
function WORKDIR({ refresh = true } = {}) {
  const o = /* @__PURE__ */ Object.create(null);
  Object.defineProperty(o, GitWalkSymbol, {
    value: function({ fs, dir, gitdir, cache }) {
      return new GitWalkerFs({ fs, dir, gitdir, cache, refresh });
    }
  });
  Object.freeze(o);
  return o;
}
function arrayRange(start, end) {
  const length = end - start;
  return Array.from({ length }, (_, i) => start + i);
}
var flat = typeof Array.prototype.flat === "undefined" ? (entries) => entries.reduce((acc, x) => acc.concat(x), []) : (entries) => entries.flat();
var RunningMinimum = class {
  constructor() {
    this.value = null;
  }
  consider(value) {
    if (value === null || value === void 0)
      return;
    if (this.value === null) {
      this.value = value;
    } else if (value < this.value) {
      this.value = value;
    }
  }
  reset() {
    this.value = null;
  }
};
function* unionOfIterators(sets) {
  const min = new RunningMinimum();
  let minimum;
  const heads = [];
  const numsets = sets.length;
  for (let i = 0; i < numsets; i++) {
    heads[i] = sets[i].next().value;
    if (heads[i] !== void 0) {
      min.consider(heads[i]);
    }
  }
  if (min.value === null)
    return;
  while (true) {
    const result = [];
    minimum = min.value;
    min.reset();
    for (let i = 0; i < numsets; i++) {
      if (heads[i] !== void 0 && heads[i] === minimum) {
        result[i] = heads[i];
        heads[i] = sets[i].next().value;
      } else {
        result[i] = null;
      }
      if (heads[i] !== void 0) {
        min.consider(heads[i]);
      }
    }
    yield result;
    if (min.value === null)
      return;
  }
}
async function _walk({
  fs,
  cache,
  dir,
  gitdir,
  trees,
  // @ts-ignore
  map = async (_, entry) => entry,
  // The default reducer is a flatmap that filters out undefineds.
  reduce = async (parent, children) => {
    const flatten = flat(children);
    if (parent !== void 0)
      flatten.unshift(parent);
    return flatten;
  },
  // The default iterate function walks all children concurrently
  iterate = (walk2, children) => Promise.all([...children].map(walk2))
}) {
  const walkers = trees.map(
    (proxy) => proxy[GitWalkSymbol]({ fs, dir, gitdir, cache })
  );
  const root = new Array(walkers.length).fill(".");
  const range = arrayRange(0, walkers.length);
  const unionWalkerFromReaddir = async (entries) => {
    range.forEach((i) => {
      const entry = entries[i];
      entries[i] = entry && new walkers[i].ConstructEntry(entry);
    });
    const subdirs = await Promise.all(
      range.map((i) => {
        const entry = entries[i];
        return entry ? walkers[i].readdir(entry) : [];
      })
    );
    const iterators = subdirs.map((array) => {
      return (array === null ? [] : array)[Symbol.iterator]();
    });
    return {
      entries,
      children: unionOfIterators(iterators)
    };
  };
  const walk2 = async (root2) => {
    const { entries, children } = await unionWalkerFromReaddir(root2);
    const fullpath = entries.find((entry) => entry && entry._fullpath)._fullpath;
    const parent = await map(fullpath, entries);
    if (parent !== null) {
      let walkedChildren = await iterate(walk2, children);
      walkedChildren = walkedChildren.filter((x) => x !== void 0);
      return reduce(parent, walkedChildren);
    }
  };
  return walk2(root);
}
async function rmRecursive(fs, filepath) {
  const entries = await fs.readdir(filepath);
  if (entries == null) {
    await fs.rm(filepath);
  } else if (entries.length) {
    await Promise.all(
      entries.map((entry) => {
        const subpath = join(filepath, entry);
        return fs.lstat(subpath).then((stat) => {
          if (!stat)
            return;
          return stat.isDirectory() ? rmRecursive(fs, subpath) : fs.rm(subpath);
        });
      })
    ).then(() => fs.rmdir(filepath));
  } else {
    await fs.rmdir(filepath);
  }
}
function isPromiseLike(obj) {
  return isObject(obj) && isFunction(obj.then) && isFunction(obj.catch);
}
function isObject(obj) {
  return obj && typeof obj === "object";
}
function isFunction(obj) {
  return typeof obj === "function";
}
function isPromiseFs(fs) {
  const test = (targetFs) => {
    try {
      return targetFs.readFile().catch((e) => e);
    } catch (e) {
      return e;
    }
  };
  return isPromiseLike(test(fs));
}
var commands = [
  "readFile",
  "writeFile",
  "mkdir",
  "rmdir",
  "unlink",
  "stat",
  "lstat",
  "readdir",
  "readlink",
  "symlink"
];
function bindFs(target, fs) {
  if (isPromiseFs(fs)) {
    for (const command of commands) {
      target[`_${command}`] = fs[command].bind(fs);
    }
  } else {
    for (const command of commands) {
      target[`_${command}`] = (0, import_pify.default)(fs[command].bind(fs));
    }
  }
  if (isPromiseFs(fs)) {
    if (fs.cp)
      target._cp = fs.cp.bind(fs);
    if (fs.rm)
      target._rm = fs.rm.bind(fs);
    else if (fs.rmdir.length > 1)
      target._rm = fs.rmdir.bind(fs);
    else
      target._rm = rmRecursive.bind(null, target);
  } else {
    if (fs.cp)
      target._cp = (0, import_pify.default)(fs.cp.bind(fs));
    if (fs.rm)
      target._rm = (0, import_pify.default)(fs.rm.bind(fs));
    else if (fs.rmdir.length > 2)
      target._rm = (0, import_pify.default)(fs.rmdir.bind(fs));
    else
      target._rm = rmRecursive.bind(null, target);
  }
}
var FileSystem = class {
  /**
   * Creates an instance of FileSystem.
   *
   * @param {Object} fs - A file system implementation to wrap.
   */
  constructor(fs) {
    if (typeof fs._original_unwrapped_fs !== "undefined")
      return fs;
    const promises = Object.getOwnPropertyDescriptor(fs, "promises");
    if (promises && promises.enumerable) {
      bindFs(this, fs.promises);
    } else {
      bindFs(this, fs);
    }
    this._original_unwrapped_fs = fs;
  }
  /**
   * Return true if a file exists, false if it doesn't exist.
   * Rethrows errors that aren't related to file existence.
   *
   * @param {string} filepath - The path to the file.
   * @param {Object} [options] - Additional options.
   * @returns {Promise<boolean>} - `true` if the file exists, `false` otherwise.
   */
  async exists(filepath, options = {}) {
    try {
      await this._stat(filepath);
      return true;
    } catch (err) {
      if (err.code === "ENOENT" || err.code === "ENOTDIR" || (err.code || "").includes("ENS")) {
        return false;
      } else {
        console.log('Unhandled error in "FileSystem.exists()" function', err);
        throw err;
      }
    }
  }
  /**
   * Return the contents of a file if it exists, otherwise returns null.
   *
   * @param {string} filepath - The path to the file.
   * @param {Object} [options] - Options for reading the file.
   * @returns {Promise<Buffer|string|null>} - The file contents, or `null` if the file doesn't exist.
   */
  async read(filepath, options = {}) {
    try {
      let buffer = await this._readFile(filepath, options);
      if (options.autocrlf === "true") {
        try {
          buffer = new TextDecoder("utf8", { fatal: true }).decode(buffer);
          buffer = buffer.replace(/\r\n/g, "\n");
          buffer = new TextEncoder().encode(buffer);
        } catch (error) {
        }
      }
      if (typeof buffer !== "string") {
        buffer = Buffer.from(buffer);
      }
      return buffer;
    } catch (err) {
      return null;
    }
  }
  /**
   * Write a file (creating missing directories if need be) without throwing errors.
   *
   * @param {string} filepath - The path to the file.
   * @param {Buffer|Uint8Array|string} contents - The data to write.
   * @param {Object|string} [options] - Options for writing the file.
   * @returns {Promise<void>}
   */
  async write(filepath, contents, options = {}) {
    try {
      await this._writeFile(filepath, contents, options);
    } catch (err) {
      await this.mkdir(dirname(filepath));
      await this._writeFile(filepath, contents, options);
    }
  }
  /**
   * Make a directory (or series of nested directories) without throwing an error if it already exists.
   *
   * @param {string} filepath - The path to the directory.
   * @param {boolean} [_selfCall=false] - Internal flag to prevent infinite recursion.
   * @returns {Promise<void>}
   */
  async mkdir(filepath, _selfCall = false) {
    try {
      await this._mkdir(filepath);
    } catch (err) {
      if (err === null)
        return;
      if (err.code === "EEXIST")
        return;
      if (_selfCall)
        throw err;
      if (err.code === "ENOENT") {
        const parent = dirname(filepath);
        if (parent === "." || parent === "/" || parent === filepath)
          throw err;
        await this.mkdir(parent);
        await this.mkdir(filepath, true);
      }
    }
  }
  /**
   * Delete a file without throwing an error if it is already deleted.
   *
   * @param {string} filepath - The path to the file.
   * @returns {Promise<void>}
   */
  async rm(filepath) {
    try {
      await this._unlink(filepath);
    } catch (err) {
      if (err.code !== "ENOENT")
        throw err;
    }
  }
  /**
   * Delete a directory without throwing an error if it is already deleted.
   *
   * @param {string} filepath - The path to the directory.
   * @param {Object} [opts] - Options for deleting the directory.
   * @returns {Promise<void>}
   */
  async rmdir(filepath, opts) {
    try {
      if (opts && opts.recursive) {
        await this._rm(filepath, opts);
      } else {
        await this._rmdir(filepath);
      }
    } catch (err) {
      if (err.code !== "ENOENT")
        throw err;
    }
  }
  /**
   * Read a directory without throwing an error is the directory doesn't exist
   *
   * @param {string} filepath - The path to the directory.
   * @returns {Promise<string[]|null>} - An array of file names, or `null` if the path is not a directory.
   */
  async readdir(filepath) {
    try {
      const names = await this._readdir(filepath);
      names.sort(compareStrings);
      return names;
    } catch (err) {
      if (err.code === "ENOTDIR")
        return null;
      return [];
    }
  }
  /**
   * Return a flat list of all the files nested inside a directory
   *
   * Based on an elegant concurrent recursive solution from SO
   * https://stackoverflow.com/a/45130990/2168416
   *
   * @param {string} dir - The directory to read.
   * @returns {Promise<string[]>} - A flat list of all files in the directory.
   */
  async readdirDeep(dir) {
    const subdirs = await this._readdir(dir);
    const files = await Promise.all(
      subdirs.map(async (subdir) => {
        const res = dir + "/" + subdir;
        return (await this._stat(res)).isDirectory() ? this.readdirDeep(res) : res;
      })
    );
    return files.reduce((a, f) => a.concat(f), []);
  }
  /**
   * Return the Stats of a file/symlink if it exists, otherwise returns null.
   * Rethrows errors that aren't related to file existence.
   *
   * @param {string} filename - The path to the file or symlink.
   * @returns {Promise<Object|null>} - The stats object, or `null` if the file doesn't exist.
   */
  async lstat(filename) {
    try {
      const stats = await this._lstat(filename);
      return stats;
    } catch (err) {
      if (err.code === "ENOENT" || (err.code || "").includes("ENS")) {
        return null;
      }
      throw err;
    }
  }
  /**
   * Reads the contents of a symlink if it exists, otherwise returns null.
   * Rethrows errors that aren't related to file existence.
   *
   * @param {string} filename - The path to the symlink.
   * @param {Object} [opts={ encoding: 'buffer' }] - Options for reading the symlink.
   * @returns {Promise<Buffer|null>} - The symlink target, or `null` if it doesn't exist.
   */
  async readlink(filename, opts = { encoding: "buffer" }) {
    try {
      const link = await this._readlink(filename, opts);
      return Buffer.isBuffer(link) ? link : Buffer.from(link);
    } catch (err) {
      if (err.code === "ENOENT" || (err.code || "").includes("ENS")) {
        return null;
      }
      throw err;
    }
  }
  /**
   * Write the contents of buffer to a symlink.
   *
   * @param {string} filename - The path to the symlink.
   * @param {Buffer} buffer - The symlink target.
   * @returns {Promise<void>}
   */
  async writelink(filename, buffer) {
    return this._symlink(buffer.toString("utf8"), filename);
  }
};
function assertParameter(name2, value) {
  if (value === void 0) {
    throw new MissingParameterError(name2);
  }
}
function isAbsolute(filepath) {
  return filepath.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(filepath);
}
async function discoverGitdir({ fsp, dotgit }) {
  assertParameter("fsp", fsp);
  assertParameter("dotgit", dotgit);
  const dotgitStat = await fsp._stat(dotgit).catch(() => ({ isFile: () => false, isDirectory: () => false }));
  if (dotgitStat.isDirectory()) {
    return dotgit;
  } else if (dotgitStat.isFile()) {
    return fsp._readFile(dotgit, "utf8").then((contents) => contents.trimRight().substr(8)).then((submoduleGitdir) => {
      if (isAbsolute(submoduleGitdir)) {
        return submoduleGitdir;
      }
      const gitdir = join(dirname(dotgit), submoduleGitdir);
      return gitdir;
    });
  } else {
    return dotgit;
  }
}
async function modified(entry, base) {
  if (!entry && !base)
    return false;
  if (entry && !base)
    return true;
  if (!entry && base)
    return true;
  if (await entry.type() === "tree" && await base.type() === "tree") {
    return false;
  }
  if (await entry.type() === await base.type() && await entry.mode() === await base.mode() && await entry.oid() === await base.oid()) {
    return false;
  }
  return true;
}
var GitIgnoreManager = class {
  /**
   * Determines whether a given file is ignored based on `.gitignore` rules and exclusion files.
   *
   * @param {Object} args
   * @param {FSClient} args.fs - A file system implementation.
   * @param {string} args.dir - The working directory.
   * @param {string} [args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
   * @param {string} args.filepath - The path of the file to check.
   * @returns {Promise<boolean>} - `true` if the file is ignored, `false` otherwise.
   */
  static async isIgnored({ fs, dir, gitdir = join(dir, ".git"), filepath }) {
    if (basename(filepath) === ".git")
      return true;
    if (filepath === ".")
      return false;
    let excludes = "";
    const excludesFile = join(gitdir, "info", "exclude");
    if (await fs.exists(excludesFile)) {
      excludes = await fs.read(excludesFile, "utf8");
    }
    const pairs = [
      {
        gitignore: join(dir, ".gitignore"),
        filepath
      }
    ];
    const pieces = filepath.split("/").filter(Boolean);
    for (let i = 1; i < pieces.length; i++) {
      const folder = pieces.slice(0, i).join("/");
      const file = pieces.slice(i).join("/");
      pairs.push({
        gitignore: join(dir, folder, ".gitignore"),
        filepath: file
      });
    }
    let ignoredStatus = false;
    for (const p of pairs) {
      let file;
      try {
        file = await fs.read(p.gitignore, "utf8");
      } catch (err) {
        if (err.code === "NOENT")
          continue;
      }
      const ign = (0, import_ignore.default)().add(excludes);
      ign.add(file);
      const parentdir = dirname(p.filepath);
      if (parentdir !== "." && ign.ignores(parentdir))
        return true;
      if (ignoredStatus) {
        ignoredStatus = !ign.test(p.filepath).unignored;
      } else {
        ignoredStatus = ign.test(p.filepath).ignored;
      }
    }
    return ignoredStatus;
  }
};
async function writeObjectLoose({ fs, gitdir, object, format, oid }) {
  if (format !== "deflated") {
    throw new InternalError(
      "GitObjectStoreLoose expects objects to write to be in deflated format"
    );
  }
  const source = `objects/${oid.slice(0, 2)}/${oid.slice(2)}`;
  const filepath = `${gitdir}/${source}`;
  if (!await fs.exists(filepath))
    await fs.write(filepath, object);
}
var supportsCompressionStream = null;
async function deflate(buffer) {
  if (supportsCompressionStream === null) {
    supportsCompressionStream = testCompressionStream();
  }
  return supportsCompressionStream ? browserDeflate(buffer) : import_pako.default.deflate(buffer);
}
async function browserDeflate(buffer) {
  const cs = new CompressionStream("deflate");
  const c = new Blob([buffer]).stream().pipeThrough(cs);
  return new Uint8Array(await new Response(c).arrayBuffer());
}
function testCompressionStream() {
  try {
    const cs = new CompressionStream("deflate");
    cs.writable.close();
    const stream = new Blob([]).stream();
    stream.cancel();
    return true;
  } catch (_) {
    return false;
  }
}
async function _writeObject({
  fs,
  gitdir,
  type,
  object,
  format = "content",
  oid = void 0,
  dryRun = false
}) {
  if (format !== "deflated") {
    if (format !== "wrapped") {
      object = GitObject.wrap({ type, object });
    }
    oid = await shasum(object);
    object = Buffer.from(await deflate(object));
  }
  if (!dryRun) {
    await writeObjectLoose({ fs, gitdir, object, format: "deflated", oid });
  }
  return oid;
}
function posixifyPathBuffer(buffer) {
  let idx;
  while (~(idx = buffer.indexOf(92)))
    buffer[idx] = 47;
  return buffer;
}
async function add({
  fs: _fs,
  dir,
  gitdir = join(dir, ".git"),
  filepath,
  cache = {},
  force = false,
  parallel = true
}) {
  try {
    assertParameter("fs", _fs);
    assertParameter("dir", dir);
    assertParameter("gitdir", gitdir);
    assertParameter("filepath", filepath);
    const fs = new FileSystem(_fs);
    const updatedGitdir = await discoverGitdir({ fsp: fs, dotgit: gitdir });
    await GitIndexManager.acquire(
      { fs, gitdir: updatedGitdir, cache },
      async (index) => {
        const config = await GitConfigManager.get({ fs, gitdir: updatedGitdir });
        const autocrlf = await config.get("core.autocrlf");
        return addToIndex({
          dir,
          gitdir: updatedGitdir,
          fs,
          filepath,
          index,
          force,
          parallel,
          autocrlf
        });
      }
    );
  } catch (err) {
    err.caller = "git.add";
    throw err;
  }
}
async function addToIndex({
  dir,
  gitdir,
  fs,
  filepath,
  index,
  force,
  parallel,
  autocrlf
}) {
  filepath = Array.isArray(filepath) ? filepath : [filepath];
  const promises = filepath.map(async (currentFilepath) => {
    if (!force) {
      const ignored = await GitIgnoreManager.isIgnored({
        fs,
        dir,
        gitdir,
        filepath: currentFilepath
      });
      if (ignored)
        return;
    }
    const stats = await fs.lstat(join(dir, currentFilepath));
    if (!stats)
      throw new NotFoundError(currentFilepath);
    if (stats.isDirectory()) {
      const children = await fs.readdir(join(dir, currentFilepath));
      if (parallel) {
        const promises2 = children.map(
          (child) => addToIndex({
            dir,
            gitdir,
            fs,
            filepath: [join(currentFilepath, child)],
            index,
            force,
            parallel,
            autocrlf
          })
        );
        await Promise.all(promises2);
      } else {
        for (const child of children) {
          await addToIndex({
            dir,
            gitdir,
            fs,
            filepath: [join(currentFilepath, child)],
            index,
            force,
            parallel,
            autocrlf
          });
        }
      }
    } else {
      const object = stats.isSymbolicLink() ? await fs.readlink(join(dir, currentFilepath)).then(posixifyPathBuffer) : await fs.read(join(dir, currentFilepath), { autocrlf });
      if (object === null)
        throw new NotFoundError(currentFilepath);
      const oid = await _writeObject({ fs, gitdir, type: "blob", object });
      index.insert({ filepath: currentFilepath, stats, oid });
    }
  });
  const settledPromises = await Promise.allSettled(promises);
  const rejectedPromises = settledPromises.filter((settle) => settle.status === "rejected").map((settle) => settle.reason);
  if (rejectedPromises.length > 1) {
    throw new MultipleGitError(rejectedPromises);
  }
  if (rejectedPromises.length === 1) {
    throw rejectedPromises[0];
  }
  const fulfilledPromises = settledPromises.filter((settle) => settle.status === "fulfilled" && settle.value).map((settle) => settle.value);
  return fulfilledPromises;
}
async function _getConfig({ fs, gitdir, path }) {
  const config = await GitConfigManager.get({ fs, gitdir });
  return config.get(path);
}
function assignDefined(target, ...sources) {
  for (const source of sources) {
    if (source) {
      for (const key of Object.keys(source)) {
        const val = source[key];
        if (val !== void 0) {
          target[key] = val;
        }
      }
    }
  }
  return target;
}
async function normalizeAuthorObject({ fs, gitdir, author, commit: commit2 }) {
  const timestamp = Math.floor(Date.now() / 1e3);
  const defaultAuthor = {
    name: await _getConfig({ fs, gitdir, path: "user.name" }),
    email: await _getConfig({ fs, gitdir, path: "user.email" }) || "",
    // author.email is allowed to be empty string
    timestamp,
    timezoneOffset: new Date(timestamp * 1e3).getTimezoneOffset()
  };
  const normalizedAuthor = assignDefined(
    {},
    defaultAuthor,
    commit2 ? commit2.author : void 0,
    author
  );
  if (normalizedAuthor.name === void 0) {
    return void 0;
  }
  return normalizedAuthor;
}
async function normalizeCommitterObject({
  fs,
  gitdir,
  author,
  committer,
  commit: commit2
}) {
  const timestamp = Math.floor(Date.now() / 1e3);
  const defaultCommitter = {
    name: await _getConfig({ fs, gitdir, path: "user.name" }),
    email: await _getConfig({ fs, gitdir, path: "user.email" }) || "",
    // committer.email is allowed to be empty string
    timestamp,
    timezoneOffset: new Date(timestamp * 1e3).getTimezoneOffset()
  };
  const normalizedCommitter = assignDefined(
    {},
    defaultCommitter,
    commit2 ? commit2.committer : void 0,
    author,
    committer
  );
  if (normalizedCommitter.name === void 0) {
    return void 0;
  }
  return normalizedCommitter;
}
async function resolveCommit({ fs, cache, gitdir, oid }) {
  const { type, object } = await _readObject({ fs, cache, gitdir, oid });
  if (type === "tag") {
    oid = GitAnnotatedTag.from(object).parse().object;
    return resolveCommit({ fs, cache, gitdir, oid });
  }
  if (type !== "commit") {
    throw new ObjectTypeError(oid, type, "commit");
  }
  return { commit: GitCommit.from(object), oid };
}
async function _readCommit({ fs, cache, gitdir, oid }) {
  const { commit: commit2, oid: commitOid } = await resolveCommit({
    fs,
    cache,
    gitdir,
    oid
  });
  const result = {
    oid: commitOid,
    commit: commit2.parse(),
    payload: commit2.withoutSignature()
  };
  return result;
}
var EMPTY_TREE_OID = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
async function _commit({
  fs,
  cache,
  onSign,
  gitdir,
  message,
  author: _author,
  committer: _committer,
  signingKey,
  amend = false,
  dryRun = false,
  noUpdateBranch = false,
  disallowEmpty = false,
  ref,
  parent,
  tree
}) {
  let initialCommit = false;
  let detachedHead = false;
  if (!ref) {
    const headContent = await fs.read(`${gitdir}/HEAD`, { encoding: "utf8" });
    detachedHead = !headContent.startsWith("ref:");
    ref = await GitRefManager.resolve({
      fs,
      gitdir,
      ref: "HEAD",
      depth: 2
    });
  }
  let refOid, refCommit;
  try {
    refOid = await GitRefManager.resolve({
      fs,
      gitdir,
      ref
    });
    refCommit = await _readCommit({ fs, gitdir, oid: refOid, cache: {} });
  } catch (e) {
    initialCommit = true;
  }
  if (amend && initialCommit) {
    throw new NoCommitError(ref);
  }
  const author = !amend ? await normalizeAuthorObject({ fs, gitdir, author: _author }) : await normalizeAuthorObject({
    fs,
    gitdir,
    author: _author,
    commit: refCommit.commit
  });
  if (!author)
    throw new MissingNameError("author");
  const committer = !amend ? await normalizeCommitterObject({
    fs,
    gitdir,
    author,
    committer: _committer
  }) : await normalizeCommitterObject({
    fs,
    gitdir,
    author,
    committer: _committer,
    commit: refCommit.commit
  });
  if (!committer)
    throw new MissingNameError("committer");
  return GitIndexManager.acquire(
    { fs, gitdir, cache, allowUnmerged: false },
    async function(index) {
      const inodes = flatFileListToDirectoryStructure(index.entries);
      const inode = inodes.get(".");
      if (!tree) {
        tree = await constructTree({ fs, gitdir, inode, dryRun });
      }
      if (!parent) {
        if (!amend) {
          parent = refOid ? [refOid] : [];
        } else {
          parent = refCommit.commit.parent;
        }
      } else {
        parent = await Promise.all(
          parent.map((p) => {
            return GitRefManager.resolve({ fs, gitdir, ref: p });
          })
        );
      }
      if (disallowEmpty && !amend && (initialCommit && tree === EMPTY_TREE_OID || !initialCommit && tree === refCommit.commit.tree)) {
        throw new EmptyCommitError();
      }
      if (!message) {
        if (!amend) {
          throw new MissingParameterError("message");
        } else {
          message = refCommit.commit.message;
        }
      }
      let comm = GitCommit.from({
        tree,
        parent,
        author,
        committer,
        message
      });
      if (signingKey) {
        comm = await GitCommit.sign(comm, onSign, signingKey);
      }
      const oid = await _writeObject({
        fs,
        gitdir,
        type: "commit",
        object: comm.toObject(),
        dryRun
      });
      if (!noUpdateBranch && !dryRun) {
        await GitRefManager.writeRef({
          fs,
          gitdir,
          ref: detachedHead ? "HEAD" : ref,
          value: oid
        });
      }
      return oid;
    }
  );
}
async function constructTree({ fs, gitdir, inode, dryRun }) {
  const children = inode.children;
  for (const inode2 of children) {
    if (inode2.type === "tree") {
      inode2.metadata.mode = "040000";
      inode2.metadata.oid = await constructTree({ fs, gitdir, inode: inode2, dryRun });
    }
  }
  const entries = children.map((inode2) => ({
    mode: inode2.metadata.mode,
    path: inode2.basename,
    oid: inode2.metadata.oid,
    type: inode2.type
  }));
  const tree = GitTree.from(entries);
  const oid = await _writeObject({
    fs,
    gitdir,
    type: "tree",
    object: tree.toObject(),
    dryRun
  });
  return oid;
}
async function resolveFilepath({ fs, cache, gitdir, oid, filepath }) {
  if (filepath.startsWith("/")) {
    throw new InvalidFilepathError("leading-slash");
  } else if (filepath.endsWith("/")) {
    throw new InvalidFilepathError("trailing-slash");
  }
  const _oid = oid;
  const result = await resolveTree({ fs, cache, gitdir, oid });
  const tree = result.tree;
  if (filepath === "") {
    oid = result.oid;
  } else {
    const pathArray = filepath.split("/");
    oid = await _resolveFilepath({
      fs,
      cache,
      gitdir,
      tree,
      pathArray,
      oid: _oid,
      filepath
    });
  }
  return oid;
}
async function _resolveFilepath({
  fs,
  cache,
  gitdir,
  tree,
  pathArray,
  oid,
  filepath
}) {
  const name2 = pathArray.shift();
  for (const entry of tree) {
    if (entry.path === name2) {
      if (pathArray.length === 0) {
        return entry.oid;
      } else {
        const { type, object } = await _readObject({
          fs,
          cache,
          gitdir,
          oid: entry.oid
        });
        if (type !== "tree") {
          throw new ObjectTypeError(oid, type, "tree", filepath);
        }
        tree = GitTree.from(object);
        return _resolveFilepath({
          fs,
          cache,
          gitdir,
          tree,
          pathArray,
          oid,
          filepath
        });
      }
    }
  }
  throw new NotFoundError(`file or directory found at "${oid}:${filepath}"`);
}
var bad = /(^|[/.])([/.]|$)|^@$|@{|[\x00-\x20\x7f~^:?*[\\]|\.lock(\/|$)/;
function isValidRef(name2, onelevel) {
  if (typeof name2 !== "string")
    throw new TypeError("Reference name must be a string");
  return !bad.test(name2) && (!!onelevel || name2.includes("/"));
}
async function _addRemote({ fs, gitdir, remote, url, force }) {
  if (!isValidRef(remote, true)) {
    throw new InvalidRefNameError(remote, import_clean_git_ref.default.clean(remote));
  }
  const config = await GitConfigManager.get({ fs, gitdir });
  if (!force) {
    const remoteNames = await config.getSubsections("remote");
    if (remoteNames.includes(remote)) {
      if (url !== await config.get(`remote.${remote}.url`)) {
        throw new AlreadyExistsError("remote", remote);
      }
    }
  }
  await config.set(`remote.${remote}.url`, url);
  await config.set(
    `remote.${remote}.fetch`,
    `+refs/heads/*:refs/remotes/${remote}/*`
  );
  await GitConfigManager.save({ fs, gitdir, config });
}
async function addRemote({
  fs,
  dir,
  gitdir = join(dir, ".git"),
  remote,
  url,
  force = false
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("remote", remote);
    assertParameter("url", url);
    const fsp = new FileSystem(fs);
    const updatedGitdir = await discoverGitdir({ fsp, dotgit: gitdir });
    return await _addRemote({
      fs: fsp,
      gitdir: updatedGitdir,
      remote,
      url,
      force
    });
  } catch (err) {
    err.caller = "git.addRemote";
    throw err;
  }
}
async function assertNoSymlinkInLeadingPath(fs, dir, fullpath) {
  const parts = fullpath.split("/");
  parts.pop();
  let current = dir;
  for (const part of parts) {
    if (part === "" || part === ".")
      continue;
    current = `${current}/${part}`;
    const stats = await fs.lstat(current);
    if (stats && stats.isSymbolicLink()) {
      throw new UnsafeFilepathError(fullpath);
    }
  }
}
var worthWalking = (filepath, root) => {
  if (filepath === "." || root == null || root.length === 0 || root === ".") {
    return true;
  }
  if (root.length >= filepath.length) {
    return root.startsWith(filepath);
  } else {
    return filepath.startsWith(root);
  }
};
async function _checkout({
  fs,
  cache,
  onProgress,
  onPostCheckout,
  dir,
  gitdir,
  remote,
  ref,
  filepaths,
  noCheckout,
  noUpdateHead,
  dryRun,
  force,
  track = true,
  nonBlocking = false,
  batchSize = 100
}) {
  let oldOid;
  if (onPostCheckout) {
    try {
      oldOid = await GitRefManager.resolve({ fs, gitdir, ref: "HEAD" });
    } catch (err) {
      oldOid = "0000000000000000000000000000000000000000";
    }
  }
  let oid;
  try {
    oid = await GitRefManager.resolve({ fs, gitdir, ref });
  } catch (err) {
    if (ref === "HEAD")
      throw err;
    const remoteRef = `${remote}/${ref}`;
    oid = await GitRefManager.resolve({
      fs,
      gitdir,
      ref: remoteRef
    });
    if (track) {
      const config = await GitConfigManager.get({ fs, gitdir });
      await config.set(`branch.${ref}.remote`, remote);
      await config.set(`branch.${ref}.merge`, `refs/heads/${ref}`);
      await GitConfigManager.save({ fs, gitdir, config });
    }
    await GitRefManager.writeRef({
      fs,
      gitdir,
      ref: `refs/heads/${ref}`,
      value: oid
    });
  }
  if (!noCheckout) {
    let ops;
    try {
      ops = await analyze({
        fs,
        cache,
        onProgress,
        dir,
        gitdir,
        ref,
        force,
        filepaths
      });
    } catch (err) {
      if (err instanceof NotFoundError && err.data.what === oid) {
        throw new CommitNotFetchedError(ref, oid);
      } else {
        throw err;
      }
    }
    const conflicts = ops.filter(([method]) => method === "conflict").map(([method, fullpath]) => fullpath);
    if (conflicts.length > 0) {
      throw new CheckoutConflictError(conflicts);
    }
    const errors = ops.filter(([method]) => method === "error").map(([method, fullpath]) => fullpath);
    if (errors.length > 0) {
      throw new InternalError(errors.join(", "));
    }
    if (dryRun) {
      if (onPostCheckout) {
        await onPostCheckout({
          previousHead: oldOid,
          newHead: oid,
          type: filepaths != null && filepaths.length > 0 ? "file" : "branch"
        });
      }
      return;
    }
    let count = 0;
    const total = ops.length;
    await GitIndexManager.acquire(
      { fs, gitdir, cache },
      async function(index) {
        await Promise.all(
          ops.filter(
            ([method]) => method === "delete" || method === "delete-index"
          ).map(async function([method, fullpath]) {
            const filepath = `${dir}/${fullpath}`;
            if (method === "delete") {
              await fs.rm(filepath);
            }
            index.delete({ filepath: fullpath });
            if (onProgress) {
              await onProgress({
                phase: "Updating workdir",
                loaded: ++count,
                total
              });
            }
          })
        );
      }
    );
    await GitIndexManager.acquire(
      { fs, gitdir, cache },
      async function(index) {
        for (const [method, fullpath] of ops) {
          if (method === "rmdir" || method === "rmdir-index") {
            const filepath = `${dir}/${fullpath}`;
            try {
              if (method === "rmdir") {
                await fs.rmdir(filepath);
              }
              index.delete({ filepath: fullpath });
              if (onProgress) {
                await onProgress({
                  phase: "Updating workdir",
                  loaded: ++count,
                  total
                });
              }
            } catch (e) {
              if (e.code === "ENOTEMPTY") {
                console.log(
                  `Did not delete ${fullpath} because directory is not empty`
                );
              } else {
                throw e;
              }
            }
          }
        }
      }
    );
    await Promise.all(
      ops.filter(([method]) => method === "mkdir" || method === "mkdir-index").map(async function([_, fullpath]) {
        const filepath = `${dir}/${fullpath}`;
        await assertNoSymlinkInLeadingPath(fs, dir, fullpath);
        await fs.mkdir(filepath);
        if (onProgress) {
          await onProgress({
            phase: "Updating workdir",
            loaded: ++count,
            total
          });
        }
      })
    );
    if (nonBlocking) {
      const eligibleOps = ops.filter(
        ([method]) => method === "create" || method === "create-index" || method === "update" || method === "mkdir-index"
      );
      const updateWorkingDirResults = await batchAllSettled(
        "Update Working Dir",
        eligibleOps.map(
          ([method, fullpath, oid2, mode, chmod]) => () => updateWorkingDir({ fs, cache, gitdir, dir }, [
            method,
            fullpath,
            oid2,
            mode,
            chmod
          ])
        ),
        onProgress,
        batchSize
      );
      await GitIndexManager.acquire(
        { fs, gitdir, cache, allowUnmerged: true },
        async function(index) {
          await batchAllSettled(
            "Update Index",
            updateWorkingDirResults.map(
              ([fullpath, oid2, stats]) => () => updateIndex({ index, fullpath, oid: oid2, stats })
            ),
            onProgress,
            batchSize
          );
        }
      );
    } else {
      await GitIndexManager.acquire(
        { fs, gitdir, cache, allowUnmerged: true },
        async function(index) {
          var _a, _b;
          const settled = await Promise.allSettled(
            ops.filter(
              ([method]) => method === "create" || method === "create-index" || method === "update" || method === "mkdir-index"
            ).map(async function([method, fullpath, oid2, mode, chmod]) {
              const filepath = `${dir}/${fullpath}`;
              if (method !== "create-index" && method !== "mkdir-index") {
                await assertNoSymlinkInLeadingPath(fs, dir, fullpath);
                const { object } = await _readObject({
                  fs,
                  cache,
                  gitdir,
                  oid: oid2
                });
                if (chmod) {
                  await fs.rm(filepath);
                }
                if (mode === 33188) {
                  await fs.write(filepath, object);
                } else if (mode === 33261) {
                  await fs.write(filepath, object, { mode: 511 });
                } else if (mode === 40960) {
                  await fs.writelink(filepath, object);
                } else {
                  throw new InternalError(
                    `Invalid mode 0o${mode.toString(
                      8
                    )} detected in blob ${oid2}`
                  );
                }
              }
              const stats = await fs.lstat(filepath);
              if (mode === 33261) {
                stats.mode = 493;
              }
              if (method === "mkdir-index") {
                stats.mode = 57344;
              }
              index.insert({
                filepath: fullpath,
                stats,
                oid: oid2
              });
              if (onProgress) {
                await onProgress({
                  phase: "Updating workdir",
                  loaded: ++count,
                  total
                });
              }
            })
          );
          const rejections = [];
          for (const result of settled) {
            if (result.status === "rejected") {
              rejections.push(result.reason);
              console.error(
                "[isomorphic-git checkout] task rejected:",
                (_b = (_a = result.reason) == null ? void 0 : _a.stack) != null ? _b : result.reason
              );
            }
          }
          if (rejections.length > 0) {
            throw new MultipleGitError(rejections);
          }
        }
      );
    }
    if (onPostCheckout) {
      await onPostCheckout({
        previousHead: oldOid,
        newHead: oid,
        type: filepaths != null && filepaths.length > 0 ? "file" : "branch"
      });
    }
  }
  if (!noUpdateHead) {
    const fullRef = await GitRefManager.expand({ fs, gitdir, ref });
    if (fullRef.startsWith("refs/heads")) {
      await GitRefManager.writeSymbolicRef({
        fs,
        gitdir,
        ref: "HEAD",
        value: fullRef
      });
    } else {
      await GitRefManager.writeRef({ fs, gitdir, ref: "HEAD", value: oid });
    }
  }
}
async function analyze({
  fs,
  cache,
  onProgress,
  dir,
  gitdir,
  ref,
  force,
  filepaths
}) {
  let count = 0;
  return _walk({
    fs,
    cache,
    dir,
    gitdir,
    trees: [TREE({ ref }), WORKDIR(), STAGE()],
    map: async function(fullpath, [commit2, workdir, stage]) {
      if (fullpath === ".")
        return;
      if (filepaths && !filepaths.some((base) => worthWalking(fullpath, base))) {
        return null;
      }
      if (onProgress) {
        await onProgress({ phase: "Analyzing workdir", loaded: ++count });
      }
      const key = [!!stage, !!commit2, !!workdir].map(Number).join("");
      switch (key) {
        case "000":
          return;
        case "001":
          if (force && filepaths && filepaths.includes(fullpath)) {
            return ["delete", fullpath];
          }
          return;
        case "010": {
          switch (await commit2.type()) {
            case "tree": {
              return ["mkdir", fullpath];
            }
            case "blob": {
              return [
                "create",
                fullpath,
                await commit2.oid(),
                await commit2.mode()
              ];
            }
            case "commit": {
              return [
                "mkdir-index",
                fullpath,
                await commit2.oid(),
                await commit2.mode()
              ];
            }
            default: {
              return [
                "error",
                `new entry Unhandled type ${await commit2.type()}`
              ];
            }
          }
        }
        case "011": {
          switch (`${await commit2.type()}-${await workdir.type()}`) {
            case "tree-tree": {
              return;
            }
            case "tree-blob":
            case "blob-tree": {
              return ["conflict", fullpath];
            }
            case "blob-blob": {
              if (await commit2.oid() !== await workdir.oid()) {
                if (force) {
                  return [
                    "update",
                    fullpath,
                    await commit2.oid(),
                    await commit2.mode(),
                    await commit2.mode() !== await workdir.mode()
                  ];
                } else {
                  return ["conflict", fullpath];
                }
              } else {
                if (await commit2.mode() !== await workdir.mode()) {
                  if (force) {
                    return [
                      "update",
                      fullpath,
                      await commit2.oid(),
                      await commit2.mode(),
                      true
                    ];
                  } else {
                    return ["conflict", fullpath];
                  }
                } else {
                  return [
                    "create-index",
                    fullpath,
                    await commit2.oid(),
                    await commit2.mode()
                  ];
                }
              }
            }
            case "commit-tree": {
              return;
            }
            case "commit-blob": {
              return ["conflict", fullpath];
            }
            default: {
              return ["error", `new entry Unhandled type ${commit2.type}`];
            }
          }
        }
        case "100": {
          return ["delete-index", fullpath];
        }
        case "101": {
          switch (await stage.type()) {
            case "tree": {
              return ["rmdir-index", fullpath];
            }
            case "blob": {
              if (await stage.oid() !== await workdir.oid()) {
                if (force) {
                  return ["delete", fullpath];
                } else {
                  return ["conflict", fullpath];
                }
              } else {
                return ["delete", fullpath];
              }
            }
            case "commit": {
              return ["rmdir-index", fullpath];
            }
            default: {
              return [
                "error",
                `delete entry Unhandled type ${await stage.type()}`
              ];
            }
          }
        }
        case "110":
        case "111": {
          switch (`${await stage.type()}-${await commit2.type()}`) {
            case "tree-tree": {
              return;
            }
            case "blob-blob": {
              if (await stage.oid() === await commit2.oid() && await stage.mode() === await commit2.mode() && !force) {
                return;
              }
              if (workdir) {
                if (await workdir.oid() !== await stage.oid() && await workdir.oid() !== await commit2.oid()) {
                  if (force) {
                    return [
                      "update",
                      fullpath,
                      await commit2.oid(),
                      await commit2.mode(),
                      await commit2.mode() !== await workdir.mode()
                    ];
                  } else {
                    return ["conflict", fullpath];
                  }
                }
              } else if (force) {
                return [
                  "update",
                  fullpath,
                  await commit2.oid(),
                  await commit2.mode(),
                  await commit2.mode() !== await stage.mode()
                ];
              }
              if (await commit2.mode() !== await stage.mode()) {
                return [
                  "update",
                  fullpath,
                  await commit2.oid(),
                  await commit2.mode(),
                  true
                ];
              }
              if (await commit2.oid() !== await stage.oid()) {
                return [
                  "update",
                  fullpath,
                  await commit2.oid(),
                  await commit2.mode(),
                  false
                ];
              } else {
                return;
              }
            }
            case "tree-blob": {
              return ["update-dir-to-blob", fullpath, await commit2.oid()];
            }
            case "blob-tree": {
              return ["update-blob-to-tree", fullpath];
            }
            case "commit-commit": {
              return [
                "mkdir-index",
                fullpath,
                await commit2.oid(),
                await commit2.mode()
              ];
            }
            default: {
              return [
                "error",
                `update entry Unhandled type ${await stage.type()}-${await commit2.type()}`
              ];
            }
          }
        }
      }
    },
    // Modify the default flat mapping
    reduce: async function(parent, children) {
      children = flat(children);
      if (!parent) {
        return children;
      } else if (parent && parent[0] === "rmdir") {
        children.push(parent);
        return children;
      } else {
        children.unshift(parent);
        return children;
      }
    }
  });
}
async function updateIndex({ index, fullpath, stats, oid }) {
  try {
    index.insert({
      filepath: fullpath,
      stats,
      oid
    });
  } catch (e) {
    console.warn(`Error inserting ${fullpath} into index:`, e);
  }
}
async function updateWorkingDir({ fs, cache, gitdir, dir }, [method, fullpath, oid, mode, chmod]) {
  const filepath = `${dir}/${fullpath}`;
  if (method !== "create-index" && method !== "mkdir-index") {
    await assertNoSymlinkInLeadingPath(fs, dir, fullpath);
    const { object } = await _readObject({ fs, cache, gitdir, oid });
    if (chmod) {
      await fs.rm(filepath);
    }
    if (mode === 33188) {
      await fs.write(filepath, object);
    } else if (mode === 33261) {
      await fs.write(filepath, object, { mode: 511 });
    } else if (mode === 40960) {
      await fs.writelink(filepath, object);
    } else {
      throw new InternalError(
        `Invalid mode 0o${mode.toString(8)} detected in blob ${oid}`
      );
    }
  }
  const stats = await fs.lstat(filepath);
  if (mode === 33261) {
    stats.mode = 493;
  }
  if (method === "mkdir-index") {
    stats.mode = 57344;
  }
  return [fullpath, oid, stats];
}
async function batchAllSettled(operationName, tasks, onProgress, batchSize) {
  const results = [];
  const rejections = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize).map((task) => task());
    const batchResults = await Promise.allSettled(batch);
    batchResults.forEach((result) => {
      var _a, _b;
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        rejections.push(result.reason);
        console.error(
          `[isomorphic-git ${operationName}] task rejected:`,
          (_b = (_a = result.reason) == null ? void 0 : _a.stack) != null ? _b : result.reason
        );
      }
    });
    if (onProgress) {
      await onProgress({
        phase: "Updating workdir",
        loaded: i + batch.length,
        total: tasks.length
      });
    }
  }
  if (rejections.length > 0) {
    throw new MultipleGitError(rejections);
  }
  return results;
}
async function checkout({
  fs,
  onProgress,
  onPostCheckout,
  dir,
  gitdir = join(dir, ".git"),
  remote = "origin",
  ref: _ref,
  filepaths,
  noCheckout = false,
  noUpdateHead = _ref === void 0,
  dryRun = false,
  force = false,
  track = true,
  cache = {},
  nonBlocking = false,
  batchSize = 100
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("dir", dir);
    assertParameter("gitdir", gitdir);
    const ref = _ref || "HEAD";
    const fsp = new FileSystem(fs);
    const updatedGitdir = await discoverGitdir({ fsp, dotgit: gitdir });
    return await _checkout({
      fs: fsp,
      cache,
      onProgress,
      onPostCheckout,
      dir,
      gitdir: updatedGitdir,
      remote,
      ref,
      filepaths,
      noCheckout,
      noUpdateHead,
      dryRun,
      force,
      track,
      nonBlocking,
      batchSize
    });
  } catch (err) {
    err.caller = "git.checkout";
    throw err;
  }
}
var LINEBREAKS = /^.*(\r?\n|$)/gm;
function mergeFile({ branches, contents }) {
  const ourName = branches[1];
  const theirName = branches[2];
  const baseContent = contents[0];
  const ourContent = contents[1];
  const theirContent = contents[2];
  const ours = ourContent.match(LINEBREAKS);
  const base = baseContent.match(LINEBREAKS);
  const theirs = theirContent.match(LINEBREAKS);
  const result = (0, import_diff3.default)(ours, base, theirs);
  const markerSize = 7;
  let mergedText = "";
  let cleanMerge = true;
  for (const item of result) {
    if (item.ok) {
      mergedText += item.ok.join("");
    }
    if (item.conflict) {
      cleanMerge = false;
      mergedText += `${"<".repeat(markerSize)} ${ourName}
`;
      mergedText += item.conflict.a.join("");
      mergedText += `${"=".repeat(markerSize)}
`;
      mergedText += item.conflict.b.join("");
      mergedText += `${">".repeat(markerSize)} ${theirName}
`;
    }
  }
  return { cleanMerge, mergedText };
}
async function mergeTree({
  fs,
  cache,
  dir,
  gitdir = join(dir, ".git"),
  index,
  ourOid,
  baseOid,
  theirOid,
  ourName = "ours",
  baseName = "base",
  theirName = "theirs",
  dryRun = false,
  abortOnConflict = true,
  mergeDriver
}) {
  const ourTree = TREE({ ref: ourOid });
  const baseTree = TREE({ ref: baseOid });
  const theirTree = TREE({ ref: theirOid });
  const unmergedFiles = [];
  const bothModified = [];
  const deleteByUs = [];
  const deleteByTheirs = [];
  const results = await _walk({
    fs,
    cache,
    dir,
    gitdir,
    trees: [ourTree, baseTree, theirTree],
    map: async function(filepath, [ours, base, theirs]) {
      const path = basename(filepath);
      const ourChange = await modified(ours, base);
      const theirChange = await modified(theirs, base);
      switch (`${ourChange}-${theirChange}`) {
        case "false-false": {
          return {
            mode: await base.mode(),
            path,
            oid: await base.oid(),
            type: await base.type()
          };
        }
        case "false-true": {
          if (!theirs && await ours.type() === "tree") {
            return {
              mode: await ours.mode(),
              path,
              oid: await ours.oid(),
              type: await ours.type()
            };
          }
          return theirs ? {
            mode: await theirs.mode(),
            path,
            oid: await theirs.oid(),
            type: await theirs.type()
          } : void 0;
        }
        case "true-false": {
          if (!ours && await theirs.type() === "tree") {
            return {
              mode: await theirs.mode(),
              path,
              oid: await theirs.oid(),
              type: await theirs.type()
            };
          }
          return ours ? {
            mode: await ours.mode(),
            path,
            oid: await ours.oid(),
            type: await ours.type()
          } : void 0;
        }
        case "true-true": {
          if (ours && theirs && await ours.type() === "tree" && await theirs.type() === "tree") {
            return {
              mode: await ours.mode(),
              path,
              oid: await ours.oid(),
              type: "tree"
            };
          }
          if (ours && theirs && await ours.type() === "blob" && await theirs.type() === "blob") {
            return mergeBlobs({
              fs,
              gitdir,
              path,
              ours,
              base,
              theirs,
              ourName,
              baseName,
              theirName,
              mergeDriver
            }).then(async (r) => {
              if (!r.cleanMerge) {
                unmergedFiles.push(filepath);
                bothModified.push(filepath);
                if (!abortOnConflict) {
                  let baseOid2 = "";
                  if (base && await base.type() === "blob") {
                    baseOid2 = await base.oid();
                  }
                  const ourOid2 = await ours.oid();
                  const theirOid2 = await theirs.oid();
                  index.delete({ filepath });
                  if (baseOid2) {
                    index.insert({ filepath, oid: baseOid2, stage: 1 });
                  }
                  index.insert({ filepath, oid: ourOid2, stage: 2 });
                  index.insert({ filepath, oid: theirOid2, stage: 3 });
                }
              } else if (!abortOnConflict) {
                index.insert({ filepath, oid: r.mergeResult.oid, stage: 0 });
              }
              return r.mergeResult;
            });
          }
          if (base && !ours && theirs && await base.type() === "blob" && await theirs.type() === "blob") {
            unmergedFiles.push(filepath);
            deleteByUs.push(filepath);
            if (!abortOnConflict) {
              const baseOid2 = await base.oid();
              const theirOid2 = await theirs.oid();
              index.delete({ filepath });
              index.insert({ filepath, oid: baseOid2, stage: 1 });
              index.insert({ filepath, oid: theirOid2, stage: 3 });
            }
            return {
              mode: await theirs.mode(),
              oid: await theirs.oid(),
              type: "blob",
              path
            };
          }
          if (base && ours && !theirs && await base.type() === "blob" && await ours.type() === "blob") {
            unmergedFiles.push(filepath);
            deleteByTheirs.push(filepath);
            if (!abortOnConflict) {
              const baseOid2 = await base.oid();
              const ourOid2 = await ours.oid();
              index.delete({ filepath });
              index.insert({ filepath, oid: baseOid2, stage: 1 });
              index.insert({ filepath, oid: ourOid2, stage: 2 });
            }
            return {
              mode: await ours.mode(),
              oid: await ours.oid(),
              type: "blob",
              path
            };
          }
          if (base && !ours && !theirs && (await base.type() === "blob" || await base.type() === "tree")) {
            return void 0;
          }
          throw new MergeNotSupportedError();
        }
      }
    },
    /**
     * @param {TreeEntry} [parent]
     * @param {Array<TreeEntry>} children
     */
    reduce: unmergedFiles.length !== 0 && (!dir || abortOnConflict) ? void 0 : async (parent, children) => {
      const entries = children.filter(Boolean);
      if (!parent)
        return;
      if (parent && parent.type === "tree" && entries.length === 0 && parent.path !== ".")
        return;
      if (entries.length > 0 || parent.path === "." && entries.length === 0) {
        const tree = new GitTree(entries);
        const object = tree.toObject();
        const oid = await _writeObject({
          fs,
          gitdir,
          type: "tree",
          object,
          dryRun
        });
        parent.oid = oid;
      }
      return parent;
    }
  });
  if (unmergedFiles.length !== 0) {
    if (dir && !abortOnConflict) {
      await _walk({
        fs,
        cache,
        dir,
        gitdir,
        trees: [TREE({ ref: results.oid })],
        map: async function(filepath, [entry]) {
          const path = `${dir}/${filepath}`;
          if (await entry.type() === "blob") {
            const mode = await entry.mode();
            const content = await entry.content();
            await fs.write(path, content, { mode });
          }
          return true;
        }
      });
    }
    return new MergeConflictError(
      unmergedFiles,
      bothModified,
      deleteByUs,
      deleteByTheirs
    );
  }
  return results.oid;
}
async function mergeBlobs({
  fs,
  gitdir,
  path,
  ours,
  base,
  theirs,
  ourName,
  theirName,
  baseName,
  dryRun,
  mergeDriver = mergeFile
}) {
  const type = "blob";
  let baseMode = "100755";
  let baseOid = "";
  let baseContent = "";
  if (base && await base.type() === "blob") {
    baseMode = await base.mode();
    baseOid = await base.oid();
    baseContent = Buffer.from(await base.content()).toString("utf8");
  }
  const mode = baseMode === await ours.mode() ? await theirs.mode() : await ours.mode();
  if (await ours.oid() === await theirs.oid()) {
    return {
      cleanMerge: true,
      mergeResult: { mode, path, oid: await ours.oid(), type }
    };
  }
  if (await ours.oid() === baseOid) {
    return {
      cleanMerge: true,
      mergeResult: { mode, path, oid: await theirs.oid(), type }
    };
  }
  if (await theirs.oid() === baseOid) {
    return {
      cleanMerge: true,
      mergeResult: { mode, path, oid: await ours.oid(), type }
    };
  }
  const ourContent = Buffer.from(await ours.content()).toString("utf8");
  const theirContent = Buffer.from(await theirs.content()).toString("utf8");
  const { mergedText, cleanMerge } = await mergeDriver({
    branches: [baseName, ourName, theirName],
    contents: [baseContent, ourContent, theirContent],
    path
  });
  const oid = await _writeObject({
    fs,
    gitdir,
    type: "blob",
    object: Buffer.from(mergedText, "utf8"),
    dryRun
  });
  return { cleanMerge, mergeResult: { mode, path, oid, type } };
}
var abbreviateRx = /^refs\/(heads\/|tags\/|remotes\/)?(.*)/;
function abbreviateRef(ref) {
  const match = abbreviateRx.exec(ref);
  if (match) {
    if (match[1] === "remotes/" && ref.endsWith("/HEAD")) {
      return match[2].slice(0, -5);
    } else {
      return match[2];
    }
  }
  return ref;
}
async function _currentBranch({
  fs,
  gitdir,
  fullname = false,
  test = false
}) {
  const ref = await GitRefManager.resolve({
    fs,
    gitdir,
    ref: "HEAD",
    depth: 2
  });
  if (test) {
    try {
      await GitRefManager.resolve({ fs, gitdir, ref });
    } catch (_) {
      return;
    }
  }
  if (!ref.startsWith("refs/"))
    return;
  return fullname ? ref : abbreviateRef(ref);
}
function translateSSHtoHTTP(url) {
  url = url.replace(/^git@([^:]+):/, "https://$1/");
  url = url.replace(/^ssh:\/\//, "https://");
  return url;
}
function calculateBasicAuthHeader({ username = "", password = "" }) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}
async function forAwait(iterable, cb) {
  const iter = getIterator(iterable);
  while (true) {
    const { value, done } = await iter.next();
    if (value)
      await cb(value);
    if (done)
      break;
  }
  if (iter.return)
    iter.return();
}
async function collect(iterable) {
  let size = 0;
  const buffers = [];
  await forAwait(iterable, (value) => {
    buffers.push(value);
    size += value.byteLength;
  });
  const result = new Uint8Array(size);
  let nextIndex = 0;
  for (const buffer of buffers) {
    result.set(buffer, nextIndex);
    nextIndex += buffer.byteLength;
  }
  return result;
}
function extractAuthFromUrl(url) {
  let userpass = url.match(/^https?:\/\/([^/]+)@/);
  if (userpass == null)
    return { url, auth: {} };
  userpass = userpass[1];
  const [username, password] = userpass.split(":");
  url = url.replace(`${userpass}@`, "");
  return { url, auth: { username, password } };
}
function padHex(b, n) {
  const s = n.toString(16);
  return "0".repeat(b - s.length) + s;
}
var GitPktLine = class {
  static flush() {
    return Buffer.from("0000", "utf8");
  }
  static delim() {
    return Buffer.from("0001", "utf8");
  }
  static encode(line) {
    if (typeof line === "string") {
      line = Buffer.from(line);
    }
    const length = line.length + 4;
    const hexlength = padHex(4, length);
    return Buffer.concat([Buffer.from(hexlength, "utf8"), line]);
  }
  static streamReader(stream) {
    const reader = new StreamReader(stream);
    return async function read() {
      try {
        let length = await reader.read(4);
        if (length == null)
          return true;
        length = parseInt(length.toString("utf8"), 16);
        if (length === 0)
          return null;
        if (length === 1)
          return null;
        const buffer = await reader.read(length - 4);
        if (buffer == null)
          return true;
        return buffer;
      } catch (err) {
        stream.error = err;
        return true;
      }
    };
  }
};
async function parseCapabilitiesV2(read) {
  const capabilities2 = {};
  let line;
  while (true) {
    line = await read();
    if (line === true)
      break;
    if (line === null)
      continue;
    line = line.toString("utf8").replace(/\n$/, "");
    const i = line.indexOf("=");
    if (i > -1) {
      const key = line.slice(0, i);
      const value = line.slice(i + 1);
      capabilities2[key] = value;
    } else {
      capabilities2[line] = true;
    }
  }
  return { protocolVersion: 2, capabilities2 };
}
async function parseRefsAdResponse(stream, { service }) {
  const capabilities = /* @__PURE__ */ new Set();
  const refs = /* @__PURE__ */ new Map();
  const symrefs = /* @__PURE__ */ new Map();
  const read = GitPktLine.streamReader(stream);
  let lineOne = await read();
  while (lineOne === null)
    lineOne = await read();
  if (lineOne === true)
    throw new EmptyServerResponseError();
  if (lineOne.includes("version 2")) {
    return parseCapabilitiesV2(read);
  }
  if (lineOne.toString("utf8").replace(/\n$/, "") !== `# service=${service}`) {
    throw new ParseError(`# service=${service}\\n`, lineOne.toString("utf8"));
  }
  let lineTwo = await read();
  while (lineTwo === null)
    lineTwo = await read();
  if (lineTwo === true)
    return { capabilities, refs, symrefs };
  lineTwo = lineTwo.toString("utf8");
  if (lineTwo.includes("version 2")) {
    return parseCapabilitiesV2(read);
  }
  const [firstRef, capabilitiesLine] = splitAndAssert(lineTwo, "\0", "\\x00");
  capabilitiesLine.split(" ").map((x) => capabilities.add(x));
  if (firstRef !== "0000000000000000000000000000000000000000 capabilities^{}") {
    const [ref, name2] = splitAndAssert(firstRef, " ", " ");
    refs.set(name2, ref);
    while (true) {
      const line = await read();
      if (line === true)
        break;
      if (line !== null) {
        const [ref2, name3] = splitAndAssert(line.toString("utf8"), " ", " ");
        refs.set(name3, ref2);
      }
    }
  }
  for (const cap of capabilities) {
    if (cap.startsWith("symref=")) {
      const m = cap.match(/symref=([^:]+):(.*)/);
      if (m.length === 3) {
        symrefs.set(m[1], m[2]);
      }
    }
  }
  return { protocolVersion: 1, capabilities, refs, symrefs };
}
function splitAndAssert(line, sep, expected) {
  const split = line.trim().split(sep);
  if (split.length !== 2) {
    throw new ParseError(
      `Two strings separated by '${expected}'`,
      line.toString("utf8")
    );
  }
  return split;
}
var corsProxify = (corsProxy, url) => corsProxy.endsWith("?") ? `${corsProxy}${url}` : `${corsProxy}/${url.replace(/^https?:\/\//, "")}`;
var updateHeaders = (headers, auth) => {
  if (auth.username || auth.password) {
    headers.Authorization = calculateBasicAuthHeader(auth);
  }
  if (auth.headers) {
    Object.assign(headers, auth.headers);
  }
};
var stringifyBody = async (res) => {
  try {
    const data = Buffer.from(await collect(res.body));
    const response = data.toString("utf8");
    const preview = response.length < 256 ? response : response.slice(0, 256) + "...";
    return { preview, response, data };
  } catch (e) {
    return {};
  }
};
var GitRemoteHTTP = class {
  /**
   * Returns the capabilities of the GitRemoteHTTP class.
   *
   * @returns {Promise<string[]>} - An array of supported capabilities.
   */
  static async capabilities() {
    return ["discover", "connect"];
  }
  /**
   * Discovers references from a remote Git repository.
   *
   * @param {Object} args
   * @param {HttpClient} args.http - The HTTP client to use for requests.
   * @param {ProgressCallback} [args.onProgress] - Callback for progress updates.
   * @param {AuthCallback} [args.onAuth] - Callback for providing authentication credentials.
   * @param {AuthFailureCallback} [args.onAuthFailure] - Callback for handling authentication failures.
   * @param {AuthSuccessCallback} [args.onAuthSuccess] - Callback for handling successful authentication.
   * @param {string} [args.corsProxy] - Optional CORS proxy URL.
   * @param {string} args.service - The Git service (e.g., "git-upload-pack").
   * @param {string} args.url - The URL of the remote repository.
   * @param {Object<string, string>} args.headers - HTTP headers to include in the request.
   * @param {1 | 2} args.protocolVersion - The Git protocol version to use.
   * @returns {Promise<Object>} - The parsed response from the remote repository.
   * @throws {HttpError} - If the HTTP request fails.
   * @throws {SmartHttpError} - If the response cannot be parsed.
   * @throws {UserCanceledError} - If the user cancels the operation.
   */
  static async discover({
    http,
    onProgress,
    onAuth,
    onAuthSuccess,
    onAuthFailure,
    corsProxy,
    service,
    url: _origUrl,
    headers,
    protocolVersion
  }) {
    let { url, auth } = extractAuthFromUrl(_origUrl);
    const proxifiedURL = corsProxy ? corsProxify(corsProxy, url) : url;
    if (auth.username || auth.password) {
      headers.Authorization = calculateBasicAuthHeader(auth);
    }
    if (protocolVersion === 2) {
      headers["Git-Protocol"] = "version=2";
    }
    let res;
    let tryAgain;
    let providedAuthBefore = false;
    do {
      res = await http.request({
        onProgress,
        method: "GET",
        url: `${proxifiedURL}/info/refs?service=${service}`,
        headers
      });
      tryAgain = false;
      if (res.statusCode === 401 || res.statusCode === 203) {
        const getAuth = providedAuthBefore ? onAuthFailure : onAuth;
        if (getAuth) {
          auth = await getAuth(url, {
            ...auth,
            headers: { ...headers }
          });
          if (auth && auth.cancel) {
            throw new UserCanceledError();
          } else if (auth) {
            updateHeaders(headers, auth);
            providedAuthBefore = true;
            tryAgain = true;
          }
        }
      } else if (res.statusCode === 200 && providedAuthBefore && onAuthSuccess) {
        await onAuthSuccess(url, auth);
      }
    } while (tryAgain);
    if (res.statusCode !== 200) {
      const { response } = await stringifyBody(res);
      throw new HttpError(res.statusCode, res.statusMessage, response);
    }
    if (res.headers["content-type"] === `application/x-${service}-advertisement`) {
      const remoteHTTP = await parseRefsAdResponse(res.body, { service });
      remoteHTTP.auth = auth;
      return remoteHTTP;
    } else {
      const { preview, response, data } = await stringifyBody(res);
      try {
        const remoteHTTP = await parseRefsAdResponse([data], { service });
        remoteHTTP.auth = auth;
        return remoteHTTP;
      } catch (e) {
        throw new SmartHttpError(preview, response);
      }
    }
  }
  /**
   * Connects to a remote Git repository and sends a request.
   *
   * @param {Object} args
   * @param {HttpClient} args.http - The HTTP client to use for requests.
   * @param {ProgressCallback} [args.onProgress] - Callback for progress updates.
   * @param {string} [args.corsProxy] - Optional CORS proxy URL.
   * @param {string} args.service - The Git service (e.g., "git-upload-pack").
   * @param {string} args.url - The URL of the remote repository.
   * @param {Object<string, string>} [args.headers] - HTTP headers to include in the request.
   * @param {any} args.body - The request body to send.
   * @param {any} args.auth - Authentication credentials.
   * @returns {Promise<GitHttpResponse>} - The HTTP response from the remote repository.
   * @throws {HttpError} - If the HTTP request fails.
   */
  static async connect({
    http,
    onProgress,
    corsProxy,
    service,
    url,
    auth,
    body,
    headers
  }) {
    const urlAuth = extractAuthFromUrl(url);
    if (urlAuth)
      url = urlAuth.url;
    if (corsProxy)
      url = corsProxify(corsProxy, url);
    headers["content-type"] = `application/x-${service}-request`;
    headers.accept = `application/x-${service}-result`;
    updateHeaders(headers, auth);
    const res = await http.request({
      onProgress,
      method: "POST",
      url: `${url}/${service}`,
      body,
      headers
    });
    if (res.statusCode !== 200) {
      const { response } = stringifyBody(res);
      throw new HttpError(res.statusCode, res.statusMessage, response);
    }
    return res;
  }
};
var GitRemoteManager = class {
  /**
   * Determines the appropriate remote helper for the given URL.
   *
   * @param {Object} args
   * @param {string} args.url - The URL of the remote repository.
   * @returns {Object} - The remote helper class for the specified transport.
   * @throws {UrlParseError} - If the URL cannot be parsed.
   * @throws {UnknownTransportError} - If the transport is not supported.
   */
  static getRemoteHelperFor({ url }) {
    const remoteHelpers = /* @__PURE__ */ new Map();
    remoteHelpers.set("http", GitRemoteHTTP);
    remoteHelpers.set("https", GitRemoteHTTP);
    const parts = parseRemoteUrl({ url });
    if (!parts) {
      throw new UrlParseError(url);
    }
    if (remoteHelpers.has(parts.transport)) {
      return remoteHelpers.get(parts.transport);
    }
    throw new UnknownTransportError(
      url,
      parts.transport,
      parts.transport === "ssh" ? translateSSHtoHTTP(url) : void 0
    );
  }
};
function parseRemoteUrl({ url }) {
  if (url.startsWith("git@")) {
    return {
      transport: "ssh",
      address: url
    };
  }
  const matches = url.match(/(\w+)(:\/\/|::)(.*)/);
  if (matches === null)
    return;
  if (matches[2] === "://") {
    return {
      transport: matches[1],
      address: matches[0]
    };
  }
  if (matches[2] === "::") {
    return {
      transport: matches[1],
      address: matches[3]
    };
  }
}
var lock$3 = null;
var GitShallowManager = class {
  /**
   * Reads the `shallow` file in the Git repository and returns a set of object IDs (OIDs).
   *
   * @param {Object} args
   * @param {FSClient} args.fs - A file system implementation.
   * @param {string} [args.gitdir] - [required] The [git directory](dir-vs-gitdir.md) path
   * @returns {Promise<Set<string>>} - A set of shallow object IDs.
   */
  static async read({ fs, gitdir }) {
    if (lock$3 === null)
      lock$3 = new import_async_lock.default();
    const filepath = join(gitdir, "shallow");
    const oids = /* @__PURE__ */ new Set();
    await lock$3.acquire(filepath, async function() {
      const text = await fs.read(filepath, { encoding: "utf8" });
      if (text === null)
        return oids;
      if (text.trim() === "")
        return oids;
      text.trim().split("\n").map((oid) => oids.add(oid));
    });
    return oids;
  }
  /**
   * Writes a set of object IDs (OIDs) to the `shallow` file in the Git repository.
   * If the set is empty, the `shallow` file is removed.
   *
   * @param {Object} args
   * @param {FSClient} args.fs - A file system implementation.
   * @param {string} [args.gitdir] - [required] The [git directory](dir-vs-gitdir.md) path
   * @param {Set<string>} args.oids - A set of shallow object IDs to write.
   * @returns {Promise<void>}
   */
  static async write({ fs, gitdir, oids }) {
    if (lock$3 === null)
      lock$3 = new import_async_lock.default();
    const filepath = join(gitdir, "shallow");
    if (oids.size > 0) {
      const text = [...oids].join("\n") + "\n";
      await lock$3.acquire(filepath, async function() {
        await fs.write(filepath, text, {
          encoding: "utf8"
        });
      });
    } else {
      await lock$3.acquire(filepath, async function() {
        await fs.rm(filepath);
      });
    }
  }
};
async function hasObjectLoose({ fs, gitdir, oid }) {
  const source = `objects/${oid.slice(0, 2)}/${oid.slice(2)}`;
  return fs.exists(`${gitdir}/${source}`);
}
async function hasObjectPacked({
  fs,
  cache,
  gitdir,
  oid,
  getExternalRefDelta
}) {
  let list = await fs.readdir(join(gitdir, "objects/pack"));
  list = list.filter((x) => x.endsWith(".idx"));
  for (const filename of list) {
    const indexFile = `${gitdir}/objects/pack/${filename}`;
    const p = await readPackIndex({
      fs,
      cache,
      filename: indexFile,
      getExternalRefDelta
    });
    if (p.error)
      throw new InternalError(p.error);
    if (p.offsets.has(oid)) {
      return true;
    }
  }
  return false;
}
async function hasObject({
  fs,
  cache,
  gitdir,
  oid,
  format = "content"
}) {
  const getExternalRefDelta = (oid2) => _readObject({ fs, cache, gitdir, oid: oid2 });
  let result = await hasObjectLoose({ fs, gitdir, oid });
  if (!result) {
    result = await hasObjectPacked({
      fs,
      cache,
      gitdir,
      oid,
      getExternalRefDelta
    });
  }
  return result;
}
function addCredentialUsername({ config, onAuth }) {
  if (!onAuth)
    return onAuth;
  return async (url, auth) => {
    const username = auth.username || await config.get(`credential.${url}.username`);
    return onAuth(url, username ? { ...auth, username } : auth);
  };
}
function emptyPackfile(pack) {
  const pheader = "5041434b";
  const version = "00000002";
  const obCount = "00000000";
  const header = pheader + version + obCount;
  return pack.slice(0, 12).toString("hex") === header;
}
function filterCapabilities(server, client) {
  const serverNames = server.map((cap) => cap.split("=", 1)[0]);
  return client.filter((cap) => {
    const name2 = cap.split("=", 1)[0];
    return serverNames.includes(name2);
  });
}
var pkg = {
  name: "isomorphic-git",
  version: "1.40.0",
  agent: "git/isomorphic-git@1.40.0"
};
var FIFO = class {
  constructor() {
    this._queue = [];
  }
  write(chunk) {
    if (this._ended) {
      throw Error("You cannot write to a FIFO that has already been ended!");
    }
    if (this._waiting) {
      const resolve = this._waiting;
      this._waiting = null;
      resolve({ value: chunk });
    } else {
      this._queue.push(chunk);
    }
  }
  end() {
    this._ended = true;
    if (this._waiting) {
      const resolve = this._waiting;
      this._waiting = null;
      resolve({ done: true });
    }
  }
  destroy(err) {
    this.error = err;
    this.end();
  }
  async next() {
    if (this._queue.length > 0) {
      return { value: this._queue.shift() };
    }
    if (this._ended) {
      return { done: true };
    }
    if (this._waiting) {
      throw Error(
        "You cannot call read until the previous call to read has returned!"
      );
    }
    return new Promise((resolve) => {
      this._waiting = resolve;
    });
  }
};
function findSplit(str) {
  const r = str.indexOf("\r");
  const n = str.indexOf("\n");
  if (r === -1 && n === -1)
    return -1;
  if (r === -1)
    return n + 1;
  if (n === -1)
    return r + 1;
  if (n === r + 1)
    return n + 1;
  return Math.min(r, n) + 1;
}
function splitLines(input) {
  const output = new FIFO();
  let tmp = "";
  (async () => {
    await forAwait(input, (chunk) => {
      chunk = chunk.toString("utf8");
      tmp += chunk;
      while (true) {
        const i = findSplit(tmp);
        if (i === -1)
          break;
        output.write(tmp.slice(0, i));
        tmp = tmp.slice(i);
      }
    });
    if (tmp.length > 0) {
      output.write(tmp);
    }
    output.end();
  })();
  return output;
}
var GitSideBand = class {
  static demux(input) {
    const read = GitPktLine.streamReader(input);
    const packetlines = new FIFO();
    const packfile = new FIFO();
    const progress = new FIFO();
    const nextBit = async function() {
      const line = await read();
      if (line === null)
        return nextBit();
      if (line === true) {
        packetlines.end();
        progress.end();
        input.error ? packfile.destroy(input.error) : packfile.end();
        return;
      }
      switch (line[0]) {
        case 1: {
          packfile.write(line.slice(1));
          break;
        }
        case 2: {
          progress.write(line.slice(1));
          break;
        }
        case 3: {
          const error = line.slice(1);
          progress.write(error);
          packetlines.end();
          progress.end();
          packfile.destroy(new Error(error.toString("utf8")));
          return;
        }
        default: {
          packetlines.write(line);
        }
      }
      nextBit();
    };
    nextBit();
    return {
      packetlines,
      packfile,
      progress
    };
  }
  // static mux ({
  //   protocol, // 'side-band' or 'side-band-64k'
  //   packetlines,
  //   packfile,
  //   progress,
  //   error
  // }) {
  //   const MAX_PACKET_LENGTH = protocol === 'side-band-64k' ? 999 : 65519
  //   let output = new PassThrough()
  //   packetlines.on('data', data => {
  //     if (data === null) {
  //       output.write(GitPktLine.flush())
  //     } else {
  //       output.write(GitPktLine.encode(data))
  //     }
  //   })
  //   let packfileWasEmpty = true
  //   let packfileEnded = false
  //   let progressEnded = false
  //   let errorEnded = false
  //   let goodbye = Buffer.concat([
  //     GitPktLine.encode(Buffer.from('010A', 'hex')),
  //     GitPktLine.flush()
  //   ])
  //   packfile
  //     .on('data', data => {
  //       packfileWasEmpty = false
  //       const buffers = splitBuffer(data, MAX_PACKET_LENGTH)
  //       for (const buffer of buffers) {
  //         output.write(
  //           GitPktLine.encode(Buffer.concat([Buffer.from('01', 'hex'), buffer]))
  //         )
  //       }
  //     })
  //     .on('end', () => {
  //       packfileEnded = true
  //       if (!packfileWasEmpty) output.write(goodbye)
  //       if (progressEnded && errorEnded) output.end()
  //     })
  //   progress
  //     .on('data', data => {
  //       const buffers = splitBuffer(data, MAX_PACKET_LENGTH)
  //       for (const buffer of buffers) {
  //         output.write(
  //           GitPktLine.encode(Buffer.concat([Buffer.from('02', 'hex'), buffer]))
  //         )
  //       }
  //     })
  //     .on('end', () => {
  //       progressEnded = true
  //       if (packfileEnded && errorEnded) output.end()
  //     })
  //   error
  //     .on('data', data => {
  //       const buffers = splitBuffer(data, MAX_PACKET_LENGTH)
  //       for (const buffer of buffers) {
  //         output.write(
  //           GitPktLine.encode(Buffer.concat([Buffer.from('03', 'hex'), buffer]))
  //         )
  //       }
  //     })
  //     .on('end', () => {
  //       errorEnded = true
  //       if (progressEnded && packfileEnded) output.end()
  //     })
  //   return output
  // }
};
async function parseUploadPackResponse(stream) {
  const { packetlines, packfile, progress } = GitSideBand.demux(stream);
  const shallows = [];
  const unshallows = [];
  const acks = [];
  let nak = false;
  let done = false;
  return new Promise((resolve, reject) => {
    forAwait(packetlines, (data) => {
      const line = data.toString("utf8").trim();
      if (line.startsWith("shallow")) {
        const oid = line.slice(-41).trim();
        if (oid.length !== 40) {
          reject(new InvalidOidError(oid));
        }
        shallows.push(oid);
      } else if (line.startsWith("unshallow")) {
        const oid = line.slice(-41).trim();
        if (oid.length !== 40) {
          reject(new InvalidOidError(oid));
        }
        unshallows.push(oid);
      } else if (line.startsWith("ACK")) {
        const [, oid, status] = line.split(" ");
        acks.push({ oid, status });
        if (!status)
          done = true;
      } else if (line.startsWith("NAK")) {
        nak = true;
        done = true;
      } else {
        done = true;
        nak = true;
      }
      if (done) {
        stream.error ? reject(stream.error) : resolve({ shallows, unshallows, acks, nak, packfile, progress });
      }
    }).finally(() => {
      if (!done) {
        stream.error ? reject(stream.error) : resolve({ shallows, unshallows, acks, nak, packfile, progress });
      }
    });
  });
}
function writeUploadPackRequest({
  capabilities = [],
  wants = [],
  haves = [],
  shallows = [],
  depth = null,
  since = null,
  exclude = []
}) {
  const packstream = [];
  wants = [...new Set(wants)];
  let firstLineCapabilities = ` ${capabilities.join(" ")}`;
  for (const oid of wants) {
    packstream.push(GitPktLine.encode(`want ${oid}${firstLineCapabilities}
`));
    firstLineCapabilities = "";
  }
  for (const oid of shallows) {
    packstream.push(GitPktLine.encode(`shallow ${oid}
`));
  }
  if (depth !== null) {
    packstream.push(GitPktLine.encode(`deepen ${depth}
`));
  }
  if (since !== null) {
    packstream.push(
      GitPktLine.encode(`deepen-since ${Math.floor(since.valueOf() / 1e3)}
`)
    );
  }
  for (const oid of exclude) {
    packstream.push(GitPktLine.encode(`deepen-not ${oid}
`));
  }
  packstream.push(GitPktLine.flush());
  for (const oid of haves) {
    packstream.push(GitPktLine.encode(`have ${oid}
`));
  }
  packstream.push(GitPktLine.encode(`done
`));
  return packstream;
}
async function _fetch({
  fs,
  cache,
  http,
  onProgress,
  onMessage,
  onAuth,
  onAuthSuccess,
  onAuthFailure,
  gitdir,
  ref: _ref,
  remoteRef: _remoteRef,
  remote: _remote,
  url: _url,
  corsProxy,
  depth = null,
  since = null,
  exclude = [],
  relative = false,
  tags = false,
  singleBranch = false,
  headers = {},
  prune = false,
  pruneTags = false
}) {
  const ref = _ref || await _currentBranch({ fs, gitdir, test: true });
  const config = await GitConfigManager.get({ fs, gitdir });
  const remote = _remote || ref && await config.get(`branch.${ref}.remote`) || "origin";
  const url = _url || await config.get(`remote.${remote}.url`);
  if (typeof url === "undefined") {
    throw new MissingParameterError("remote OR url");
  }
  const remoteRef = _remoteRef || ref && await config.get(`branch.${ref}.merge`) || _ref || "HEAD";
  if (corsProxy === void 0) {
    corsProxy = await config.get("http.corsProxy");
  }
  const GitRemoteHTTP2 = GitRemoteManager.getRemoteHelperFor({ url });
  const remoteHTTP = await GitRemoteHTTP2.discover({
    http,
    onAuth: addCredentialUsername({ config, onAuth }),
    onAuthSuccess,
    onAuthFailure: addCredentialUsername({ config, onAuth: onAuthFailure }),
    corsProxy,
    service: "git-upload-pack",
    url,
    headers,
    protocolVersion: 1
  });
  const auth = remoteHTTP.auth;
  const remoteRefs = remoteHTTP.refs;
  if (remoteRefs.size === 0) {
    return {
      defaultBranch: null,
      fetchHead: null,
      fetchHeadDescription: null
    };
  }
  if (depth !== null && !remoteHTTP.capabilities.has("shallow")) {
    throw new RemoteCapabilityError("shallow", "depth");
  }
  if (since !== null && !remoteHTTP.capabilities.has("deepen-since")) {
    throw new RemoteCapabilityError("deepen-since", "since");
  }
  if (exclude.length > 0 && !remoteHTTP.capabilities.has("deepen-not")) {
    throw new RemoteCapabilityError("deepen-not", "exclude");
  }
  if (relative === true && !remoteHTTP.capabilities.has("deepen-relative")) {
    throw new RemoteCapabilityError("deepen-relative", "relative");
  }
  const { oid, fullref } = GitRefManager.resolveAgainstMap({
    ref: remoteRef,
    map: remoteRefs
  });
  for (const remoteRef2 of remoteRefs.keys()) {
    if (remoteRef2 === fullref || remoteRef2 === "HEAD" || remoteRef2.startsWith("refs/heads/") || tags && remoteRef2.startsWith("refs/tags/")) {
      continue;
    }
    remoteRefs.delete(remoteRef2);
  }
  const capabilities = filterCapabilities(
    [...remoteHTTP.capabilities],
    [
      "multi_ack_detailed",
      "no-done",
      "side-band-64k",
      // Note: I removed 'thin-pack' option since our code doesn't "fatten" packfiles,
      // which is necessary for compatibility with git. It was the cause of mysterious
      // 'fatal: pack has [x] unresolved deltas' errors that plagued us for some time.
      // isomorphic-git is perfectly happy with thin packfiles in .git/objects/pack but
      // canonical git it turns out is NOT.
      "ofs-delta",
      `agent=${pkg.agent}`
    ]
  );
  if (relative)
    capabilities.push("deepen-relative");
  const wants = singleBranch ? [oid] : remoteRefs.values();
  const haveRefs = singleBranch ? [ref] : await GitRefManager.listRefs({
    fs,
    gitdir,
    filepath: `refs`
  });
  let haves = [];
  for (let ref2 of haveRefs) {
    try {
      ref2 = await GitRefManager.expand({ fs, gitdir, ref: ref2 });
      const oid2 = await GitRefManager.resolve({ fs, gitdir, ref: ref2 });
      if (await hasObject({ fs, cache, gitdir, oid: oid2 })) {
        haves.push(oid2);
      }
    } catch (err) {
    }
  }
  haves = [...new Set(haves)];
  const oids = await GitShallowManager.read({ fs, gitdir });
  const shallows = remoteHTTP.capabilities.has("shallow") ? [...oids] : [];
  const packstream = writeUploadPackRequest({
    capabilities,
    wants,
    haves,
    shallows,
    depth,
    since,
    exclude
  });
  const packbuffer = Buffer.from(await collect(packstream));
  const raw = await GitRemoteHTTP2.connect({
    http,
    onProgress,
    corsProxy,
    service: "git-upload-pack",
    url,
    auth,
    body: [packbuffer],
    headers
  });
  const response = await parseUploadPackResponse(raw.body);
  if (raw.headers) {
    response.headers = raw.headers;
  }
  for (const oid2 of response.shallows) {
    if (!oids.has(oid2)) {
      try {
        const { object } = await _readObject({ fs, cache, gitdir, oid: oid2 });
        const commit2 = new GitCommit(object);
        const hasParents = await Promise.all(
          commit2.headers().parent.map((oid3) => hasObject({ fs, cache, gitdir, oid: oid3 }))
        );
        const haveAllParents = hasParents.length === 0 || hasParents.every((has) => has);
        if (!haveAllParents) {
          oids.add(oid2);
        }
      } catch (err) {
        oids.add(oid2);
      }
    }
  }
  for (const oid2 of response.unshallows) {
    oids.delete(oid2);
  }
  await GitShallowManager.write({ fs, gitdir, oids });
  if (singleBranch) {
    const refs = /* @__PURE__ */ new Map([[fullref, oid]]);
    const symrefs = /* @__PURE__ */ new Map();
    let bail = 10;
    let key = fullref;
    while (bail--) {
      const value = remoteHTTP.symrefs.get(key);
      if (value === void 0)
        break;
      symrefs.set(key, value);
      key = value;
    }
    const realRef = remoteRefs.get(key);
    if (realRef) {
      refs.set(key, realRef);
    }
    const { pruned } = await GitRefManager.updateRemoteRefs({
      fs,
      gitdir,
      remote,
      refs,
      symrefs,
      tags,
      prune
    });
    if (prune) {
      response.pruned = pruned;
    }
  } else {
    const { pruned } = await GitRefManager.updateRemoteRefs({
      fs,
      gitdir,
      remote,
      refs: remoteRefs,
      symrefs: remoteHTTP.symrefs,
      tags,
      prune,
      pruneTags
    });
    if (prune) {
      response.pruned = pruned;
    }
  }
  response.HEAD = remoteHTTP.symrefs.get("HEAD");
  if (response.HEAD === void 0) {
    const { oid: oid2 } = GitRefManager.resolveAgainstMap({
      ref: "HEAD",
      map: remoteRefs
    });
    for (const [key, value] of remoteRefs.entries()) {
      if (key !== "HEAD" && value === oid2) {
        response.HEAD = key;
        break;
      }
    }
  }
  const noun = fullref.startsWith("refs/tags") ? "tag" : "branch";
  response.FETCH_HEAD = {
    oid,
    description: `${noun} '${abbreviateRef(fullref)}' of ${url}`
  };
  if (onProgress || onMessage) {
    const lines = splitLines(response.progress);
    forAwait(lines, async (line) => {
      if (onMessage)
        await onMessage(line);
      if (onProgress) {
        const matches = line.match(/([^:]*).*\((\d+?)\/(\d+?)\)/);
        if (matches) {
          await onProgress({
            phase: matches[1].trim(),
            loaded: parseInt(matches[2], 10),
            total: parseInt(matches[3], 10)
          });
        }
      }
    });
  }
  const packfile = Buffer.from(await collect(response.packfile));
  if (raw.body.error)
    throw raw.body.error;
  const packfileSha = packfile.slice(-20).toString("hex");
  const res = {
    defaultBranch: response.HEAD,
    fetchHead: response.FETCH_HEAD.oid,
    fetchHeadDescription: response.FETCH_HEAD.description
  };
  if (response.headers) {
    res.headers = response.headers;
  }
  if (prune) {
    res.pruned = response.pruned;
  }
  if (packfileSha !== "" && !emptyPackfile(packfile)) {
    res.packfile = `objects/pack/pack-${packfileSha}.pack`;
    const fullpath = join(gitdir, res.packfile);
    await fs.write(fullpath, packfile);
    const getExternalRefDelta = (oid2) => _readObject({ fs, cache, gitdir, oid: oid2 });
    const idx = await GitPackIndex.fromPack({
      pack: packfile,
      getExternalRefDelta,
      onProgress
    });
    await fs.write(fullpath.replace(/\.pack$/, ".idx"), await idx.toBuffer());
  }
  return res;
}
async function _init({
  fs,
  bare = false,
  dir,
  gitdir = bare ? dir : join(dir, ".git"),
  defaultBranch = "master"
}) {
  if (await fs.exists(gitdir + "/config"))
    return;
  let folders = [
    "hooks",
    "info",
    "objects/info",
    "objects/pack",
    "refs/heads",
    "refs/tags"
  ];
  folders = folders.map((dir2) => gitdir + "/" + dir2);
  for (const folder of folders) {
    await fs.mkdir(folder);
  }
  await fs.write(
    gitdir + "/config",
    `[core]
	repositoryformatversion = 0
	filemode = false
	bare = ${bare}
` + (bare ? "" : "	logallrefupdates = true\n") + "	symlinks = false\n	ignorecase = true\n"
  );
  await fs.write(gitdir + "/HEAD", `ref: refs/heads/${defaultBranch}
`);
}
async function commit({
  fs: _fs,
  onSign,
  dir,
  gitdir = join(dir, ".git"),
  message,
  author,
  committer,
  signingKey,
  amend = false,
  dryRun = false,
  noUpdateBranch = false,
  disallowEmpty = false,
  ref,
  parent,
  tree,
  cache = {}
}) {
  try {
    assertParameter("fs", _fs);
    if (!amend) {
      assertParameter("message", message);
    }
    if (signingKey) {
      assertParameter("onSign", onSign);
    }
    const fs = new FileSystem(_fs);
    const updatedGitdir = await discoverGitdir({ fsp: fs, dotgit: gitdir });
    return await _commit({
      fs,
      cache,
      onSign,
      gitdir: updatedGitdir,
      message,
      author,
      committer,
      signingKey,
      amend,
      dryRun,
      noUpdateBranch,
      disallowEmpty,
      ref,
      parent,
      tree
    });
  } catch (err) {
    err.caller = "git.commit";
    throw err;
  }
}
async function _deleteRemote({ fs, gitdir, remote }) {
  const config = await GitConfigManager.get({ fs, gitdir });
  await config.deleteSection("remote", remote);
  await GitConfigManager.save({ fs, gitdir, config });
}
async function deleteRemote({
  fs,
  dir,
  gitdir = join(dir, ".git"),
  remote
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("remote", remote);
    const fsp = new FileSystem(fs);
    const updatedGitdir = await discoverGitdir({ fsp, dotgit: gitdir });
    return await _deleteRemote({
      fs: fsp,
      gitdir: updatedGitdir,
      remote
    });
  } catch (err) {
    err.caller = "git.deleteRemote";
    throw err;
  }
}
async function _findMergeBase({ fs, cache, gitdir, oids }) {
  const visits = {};
  const passes = oids.length;
  let heads = oids.map((oid, index) => ({ index, oid }));
  while (heads.length) {
    const result = /* @__PURE__ */ new Set();
    for (const { oid, index } of heads) {
      if (!visits[oid])
        visits[oid] = /* @__PURE__ */ new Set();
      visits[oid].add(index);
      if (visits[oid].size === passes) {
        result.add(oid);
      }
    }
    if (result.size > 0) {
      return [...result];
    }
    const newheads = /* @__PURE__ */ new Map();
    for (const { oid, index } of heads) {
      try {
        const { object } = await _readObject({ fs, cache, gitdir, oid });
        const commit2 = GitCommit.from(object);
        const { parent } = commit2.parseHeaders();
        for (const oid2 of parent) {
          if (!visits[oid2] || !visits[oid2].has(index)) {
            newheads.set(oid2 + ":" + index, { oid: oid2, index });
          }
        }
      } catch (err) {
      }
    }
    heads = Array.from(newheads.values());
  }
  return [];
}
async function _merge({
  fs,
  cache,
  dir,
  gitdir,
  ours,
  theirs,
  fastForward = true,
  fastForwardOnly = false,
  dryRun = false,
  noUpdateBranch = false,
  abortOnConflict = true,
  message,
  author,
  committer,
  signingKey,
  onSign,
  mergeDriver,
  allowUnrelatedHistories = false
}) {
  if (ours === void 0) {
    ours = await _currentBranch({ fs, gitdir, fullname: true });
  }
  ours = await GitRefManager.expand({
    fs,
    gitdir,
    ref: ours
  });
  theirs = await GitRefManager.expand({
    fs,
    gitdir,
    ref: theirs
  });
  const ourOid = await GitRefManager.resolve({
    fs,
    gitdir,
    ref: ours
  });
  const theirOid = await GitRefManager.resolve({
    fs,
    gitdir,
    ref: theirs
  });
  const baseOids = await _findMergeBase({
    fs,
    cache,
    gitdir,
    oids: [ourOid, theirOid]
  });
  if (baseOids.length !== 1) {
    if (baseOids.length === 0 && allowUnrelatedHistories) {
      baseOids.push("4b825dc642cb6eb9a060e54bf8d69288fbee4904");
    } else {
      throw new MergeNotSupportedError();
    }
  }
  const baseOid = baseOids[0];
  if (baseOid === theirOid) {
    return {
      oid: ourOid,
      alreadyMerged: true
    };
  }
  if (fastForward && baseOid === ourOid) {
    if (!dryRun && !noUpdateBranch) {
      await GitRefManager.writeRef({ fs, gitdir, ref: ours, value: theirOid });
    }
    return {
      oid: theirOid,
      fastForward: true
    };
  } else {
    if (fastForwardOnly) {
      throw new FastForwardError();
    }
    const tree = await GitIndexManager.acquire(
      { fs, gitdir, cache, allowUnmerged: false },
      async (index) => {
        return mergeTree({
          fs,
          cache,
          dir,
          gitdir,
          index,
          ourOid,
          theirOid,
          baseOid,
          ourName: abbreviateRef(ours),
          baseName: "base",
          theirName: abbreviateRef(theirs),
          dryRun,
          abortOnConflict,
          mergeDriver
        });
      }
    );
    if (tree instanceof MergeConflictError)
      throw tree;
    if (!message) {
      message = `Merge branch '${abbreviateRef(theirs)}' into ${abbreviateRef(
        ours
      )}`;
    }
    const oid = await _commit({
      fs,
      cache,
      gitdir,
      message,
      ref: ours,
      tree,
      parent: [ourOid, theirOid],
      author,
      committer,
      signingKey,
      onSign,
      dryRun,
      noUpdateBranch
    });
    return {
      oid,
      tree,
      mergeCommit: true
    };
  }
}
async function _pull({
  fs,
  cache,
  http,
  onProgress,
  onMessage,
  onAuth,
  onAuthSuccess,
  onAuthFailure,
  dir,
  gitdir,
  ref,
  url,
  remote,
  remoteRef,
  prune,
  pruneTags,
  fastForward,
  fastForwardOnly,
  corsProxy,
  singleBranch,
  headers,
  author,
  committer,
  signingKey
}) {
  try {
    if (!ref) {
      const head = await _currentBranch({ fs, gitdir });
      if (!head) {
        throw new MissingParameterError("ref");
      }
      ref = head;
    }
    const { fetchHead, fetchHeadDescription } = await _fetch({
      fs,
      cache,
      http,
      onProgress,
      onMessage,
      onAuth,
      onAuthSuccess,
      onAuthFailure,
      gitdir,
      corsProxy,
      ref,
      url,
      remote,
      remoteRef,
      singleBranch,
      headers,
      prune,
      pruneTags
    });
    await _merge({
      fs,
      cache,
      gitdir,
      ours: ref,
      theirs: fetchHead,
      fastForward,
      fastForwardOnly,
      message: `Merge ${fetchHeadDescription}`,
      author,
      committer,
      signingKey,
      dryRun: false,
      noUpdateBranch: false
    });
    await _checkout({
      fs,
      cache,
      onProgress,
      dir,
      gitdir,
      ref,
      remote,
      noCheckout: false
    });
  } catch (err) {
    err.caller = "git.pull";
    throw err;
  }
}
async function fetch2({
  fs,
  http,
  onProgress,
  onMessage,
  onAuth,
  onAuthSuccess,
  onAuthFailure,
  dir,
  gitdir = join(dir, ".git"),
  ref,
  remote,
  remoteRef,
  url,
  corsProxy,
  depth = null,
  since = null,
  exclude = [],
  relative = false,
  tags = false,
  singleBranch = false,
  headers = {},
  prune = false,
  pruneTags = false,
  cache = {}
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("http", http);
    assertParameter("gitdir", gitdir);
    const fsp = new FileSystem(fs);
    const updatedGitdir = await discoverGitdir({ fsp, dotgit: gitdir });
    return await _fetch({
      fs: fsp,
      cache,
      http,
      onProgress,
      onMessage,
      onAuth,
      onAuthSuccess,
      onAuthFailure,
      gitdir: updatedGitdir,
      ref,
      remote,
      remoteRef,
      url,
      corsProxy,
      depth,
      since,
      exclude,
      relative,
      tags,
      singleBranch,
      headers,
      prune,
      pruneTags
    });
  } catch (err) {
    err.caller = "git.fetch";
    throw err;
  }
}
async function _findRoot({ fs, filepath }) {
  if (await fs.exists(join(filepath, ".git"))) {
    return filepath;
  } else {
    const parent = dirname(filepath);
    if (parent === filepath) {
      throw new NotFoundError(`git root for ${filepath}`);
    }
    return _findRoot({ fs, filepath: parent });
  }
}
async function findRoot({ fs, filepath }) {
  try {
    assertParameter("fs", fs);
    assertParameter("filepath", filepath);
    return await _findRoot({ fs: new FileSystem(fs), filepath });
  } catch (err) {
    err.caller = "git.findRoot";
    throw err;
  }
}
async function init({
  fs,
  bare = false,
  dir,
  gitdir = bare ? dir : join(dir, ".git"),
  defaultBranch = "master"
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    if (!bare) {
      assertParameter("dir", dir);
    }
    const fsp = new FileSystem(fs);
    const updatedGitdir = await discoverGitdir({ fsp, dotgit: gitdir });
    return await _init({
      fs: fsp,
      bare,
      dir,
      gitdir: updatedGitdir,
      defaultBranch
    });
  } catch (err) {
    err.caller = "git.init";
    throw err;
  }
}
async function _isDescendent({
  fs,
  cache,
  gitdir,
  oid,
  ancestor,
  depth
}) {
  const shallows = await GitShallowManager.read({ fs, gitdir });
  if (!oid) {
    throw new MissingParameterError("oid");
  }
  if (!ancestor) {
    throw new MissingParameterError("ancestor");
  }
  if (oid === ancestor)
    return false;
  const queue = [oid];
  const visited = /* @__PURE__ */ new Set();
  let searchdepth = 0;
  while (queue.length) {
    if (searchdepth++ === depth) {
      throw new MaxDepthError(depth);
    }
    const oid2 = queue.shift();
    const { type, object } = await _readObject({
      fs,
      cache,
      gitdir,
      oid: oid2
    });
    if (type !== "commit") {
      throw new ObjectTypeError(oid2, type, "commit");
    }
    const commit2 = GitCommit.from(object).parse();
    for (const parent of commit2.parent) {
      if (parent === ancestor)
        return true;
    }
    if (!shallows.has(oid2)) {
      for (const parent of commit2.parent) {
        if (!visited.has(parent)) {
          queue.push(parent);
          visited.add(parent);
        }
      }
    }
  }
  return false;
}
async function _listRemotes({ fs, gitdir }) {
  const config = await GitConfigManager.get({ fs, gitdir });
  const remoteNames = await config.getSubsections("remote");
  const remotes = Promise.all(
    remoteNames.map(async (remote) => {
      const url = await config.get(`remote.${remote}.url`);
      return { remote, url };
    })
  );
  return remotes;
}
async function listRemotes({ fs, dir, gitdir = join(dir, ".git") }) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    const fsp = new FileSystem(fs);
    const updatedGitdir = await discoverGitdir({ fsp, dotgit: gitdir });
    return await _listRemotes({
      fs: fsp,
      gitdir: updatedGitdir
    });
  } catch (err) {
    err.caller = "git.listRemotes";
    throw err;
  }
}
function compareAge(a, b) {
  return a.committer.timestamp - b.committer.timestamp;
}
var EMPTY_OID = "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391";
async function resolveFileIdInTree({ fs, cache, gitdir, oid, fileId }) {
  if (fileId === EMPTY_OID)
    return;
  const _oid = oid;
  let filepath;
  const result = await resolveTree({ fs, cache, gitdir, oid });
  const tree = result.tree;
  if (fileId === result.oid) {
    filepath = result.path;
  } else {
    filepath = await _resolveFileId({
      fs,
      cache,
      gitdir,
      tree,
      fileId,
      oid: _oid
    });
    if (Array.isArray(filepath)) {
      if (filepath.length === 0)
        filepath = void 0;
      else if (filepath.length === 1)
        filepath = filepath[0];
    }
  }
  return filepath;
}
async function _resolveFileId({
  fs,
  cache,
  gitdir,
  tree,
  fileId,
  oid,
  filepaths = [],
  parentPath = ""
}) {
  const walks = tree.entries().map(function(entry) {
    let result;
    if (entry.oid === fileId) {
      result = join(parentPath, entry.path);
      filepaths.push(result);
    } else if (entry.type === "tree") {
      result = _readObject({
        fs,
        cache,
        gitdir,
        oid: entry.oid
      }).then(function({ object }) {
        return _resolveFileId({
          fs,
          cache,
          gitdir,
          tree: GitTree.from(object),
          fileId,
          oid,
          filepaths,
          parentPath: join(parentPath, entry.path)
        });
      });
    }
    return result;
  });
  await Promise.all(walks);
  return filepaths;
}
async function _log({
  fs,
  cache,
  gitdir,
  filepath,
  ref,
  depth,
  since,
  force,
  follow,
  includeChanges
}) {
  const sinceTimestamp = typeof since === "undefined" ? void 0 : Math.floor(since.valueOf() / 1e3);
  const commits = [];
  const shallowCommits = await GitShallowManager.read({ fs, gitdir });
  const oid = await GitRefManager.resolve({ fs, gitdir, ref });
  const tips = [await _readCommit({ fs, cache, gitdir, oid })];
  let lastFileOid;
  let lastCommit;
  let isOk;
  function endCommit(commit2) {
    if (isOk && filepath)
      commits.push(commit2);
  }
  while (tips.length > 0) {
    const commit2 = tips.pop();
    if (sinceTimestamp !== void 0 && commit2.commit.committer.timestamp <= sinceTimestamp) {
      break;
    }
    if (filepath) {
      let vFileOid;
      try {
        vFileOid = await resolveFilepath({
          fs,
          cache,
          gitdir,
          oid: commit2.commit.tree,
          filepath
        });
        if (lastCommit && lastFileOid !== vFileOid) {
          commits.push(lastCommit);
        }
        lastFileOid = vFileOid;
        lastCommit = commit2;
        isOk = true;
      } catch (e) {
        if (e instanceof NotFoundError) {
          let found = follow && lastFileOid;
          if (found) {
            found = await resolveFileIdInTree({
              fs,
              cache,
              gitdir,
              oid: commit2.commit.tree,
              fileId: lastFileOid
            });
            if (found) {
              if (Array.isArray(found)) {
                if (lastCommit) {
                  const lastFound = await resolveFileIdInTree({
                    fs,
                    cache,
                    gitdir,
                    oid: lastCommit.commit.tree,
                    fileId: lastFileOid
                  });
                  if (Array.isArray(lastFound)) {
                    found = found.filter((p) => lastFound.indexOf(p) === -1);
                    if (found.length === 1) {
                      found = found[0];
                      filepath = found;
                      if (lastCommit)
                        commits.push(lastCommit);
                    } else {
                      found = false;
                      if (lastCommit)
                        commits.push(lastCommit);
                      break;
                    }
                  }
                }
              } else {
                filepath = found;
                if (lastCommit)
                  commits.push(lastCommit);
              }
            }
          }
          if (!found) {
            if (isOk && lastFileOid) {
              commits.push(lastCommit);
              if (!force)
                break;
            }
            if (!force && !follow)
              throw e;
          }
          lastCommit = commit2;
          isOk = false;
        } else
          throw e;
      }
    } else {
      commits.push(commit2);
    }
    if (depth !== void 0 && commits.length === depth) {
      endCommit(commit2);
      break;
    }
    if (!shallowCommits.has(commit2.oid)) {
      for (const oid2 of commit2.commit.parent) {
        const commit3 = await _readCommit({ fs, cache, gitdir, oid: oid2 });
        if (!tips.map((commit4) => commit4.oid).includes(commit3.oid)) {
          tips.push(commit3);
        }
      }
    }
    if (tips.length === 0) {
      endCommit(commit2);
    }
    tips.sort((a, b) => compareAge(a.commit, b.commit));
  }
  if (includeChanges) {
    for (const commit2 of commits) {
      commit2.commit.changes = await getChanges({
        fs,
        cache,
        gitdir,
        commit: commit2,
        shallow: shallowCommits.has(commit2.oid)
      });
    }
  }
  return commits;
}
async function getChanges({ fs, cache, gitdir, commit: commit2, shallow }) {
  const parent = shallow || !commit2.commit.parent[0] ? "4b825dc642cb6eb9a060e54bf8d69288fbee4904" : commit2.commit.parent[0];
  return _walk({
    fs,
    cache,
    gitdir,
    trees: [TREE({ ref: commit2.oid }), TREE({ ref: parent })],
    map: async (filepath, [current, previous]) => {
      const [currentType, previousType] = await Promise.all([
        current && current.type(),
        previous && previous.type()
      ]);
      if (currentType === "tree") {
        if (previousType && previousType !== "tree") {
          return [null, await previous.oid(), filepath];
        }
        return;
      }
      if (previousType === "tree") {
        if (currentType) {
          return [await current.oid(), null, filepath];
        }
        return;
      }
      const [newOid, oldOid] = await Promise.all([
        current ? current.oid() : null,
        previous ? previous.oid() : null
      ]);
      if (newOid === oldOid)
        return;
      return [newOid, oldOid, filepath];
    }
  });
}
async function log({
  fs,
  dir,
  gitdir = join(dir, ".git"),
  filepath,
  ref = "HEAD",
  depth,
  since,
  // Date
  force,
  follow,
  includeChanges = false,
  cache = {}
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("ref", ref);
    const fsp = new FileSystem(fs);
    const updatedGitdir = await discoverGitdir({ fsp, dotgit: gitdir });
    return await _log({
      fs: fsp,
      cache,
      gitdir: updatedGitdir,
      filepath,
      ref,
      depth,
      since,
      force,
      follow,
      includeChanges
    });
  } catch (err) {
    err.caller = "git.log";
    throw err;
  }
}
var types = {
  commit: 16,
  tree: 32,
  blob: 48,
  tag: 64,
  ofs_delta: 96,
  ref_delta: 112
};
async function _pack({
  fs,
  cache,
  dir,
  gitdir = join(dir, ".git"),
  oids
}) {
  const hash = new import_sha1.default();
  const outputStream = [];
  function write(chunk, enc) {
    const buff = Buffer.from(chunk, enc);
    outputStream.push(buff);
    hash.update(buff);
  }
  async function writeObject({ stype, object }) {
    const type = types[stype];
    let length = object.length;
    let multibyte = length > 15 ? 128 : 0;
    const lastFour = length & 15;
    length = length >>> 4;
    let byte = (multibyte | type | lastFour).toString(16);
    write(byte, "hex");
    while (multibyte) {
      multibyte = length > 127 ? 128 : 0;
      byte = multibyte | length & 127;
      write(padHex(2, byte), "hex");
      length = length >>> 7;
    }
    write(Buffer.from(await deflate(object)));
  }
  write("PACK");
  write("00000002", "hex");
  write(padHex(8, oids.length), "hex");
  for (const oid of oids) {
    const { type, object } = await _readObject({ fs, cache, gitdir, oid });
    await writeObject({ write, object, stype: type });
  }
  const digest = hash.digest();
  outputStream.push(digest);
  return outputStream;
}
async function pull({
  fs: _fs,
  http,
  onProgress,
  onMessage,
  onAuth,
  onAuthSuccess,
  onAuthFailure,
  dir,
  gitdir = join(dir, ".git"),
  ref,
  url,
  remote,
  remoteRef,
  prune = false,
  pruneTags = false,
  fastForward = true,
  fastForwardOnly = false,
  corsProxy,
  singleBranch,
  headers = {},
  author: _author,
  committer: _committer,
  signingKey,
  cache = {}
}) {
  try {
    assertParameter("fs", _fs);
    assertParameter("gitdir", gitdir);
    const fs = new FileSystem(_fs);
    const updatedGitdir = await discoverGitdir({ fsp: fs, dotgit: gitdir });
    const author = await normalizeAuthorObject({
      fs,
      gitdir: updatedGitdir,
      author: _author
    });
    if (!author)
      throw new MissingNameError("author");
    const committer = await normalizeCommitterObject({
      fs,
      gitdir: updatedGitdir,
      author,
      committer: _committer
    });
    if (!committer)
      throw new MissingNameError("committer");
    return await _pull({
      fs,
      cache,
      http,
      onProgress,
      onMessage,
      onAuth,
      onAuthSuccess,
      onAuthFailure,
      dir,
      gitdir: updatedGitdir,
      ref,
      url,
      remote,
      remoteRef,
      fastForward,
      fastForwardOnly,
      corsProxy,
      singleBranch,
      headers,
      author,
      committer,
      signingKey,
      prune,
      pruneTags
    });
  } catch (err) {
    err.caller = "git.pull";
    throw err;
  }
}
async function listCommitsAndTags({
  fs,
  cache,
  dir,
  gitdir = join(dir, ".git"),
  start,
  finish
}) {
  const shallows = await GitShallowManager.read({ fs, gitdir });
  const startingSet = /* @__PURE__ */ new Set();
  const finishingSet = /* @__PURE__ */ new Set();
  for (const ref of start) {
    startingSet.add(await GitRefManager.resolve({ fs, gitdir, ref }));
  }
  for (const ref of finish) {
    try {
      const oid = await GitRefManager.resolve({ fs, gitdir, ref });
      finishingSet.add(oid);
    } catch (err) {
    }
  }
  const visited = /* @__PURE__ */ new Set();
  async function walk2(oid) {
    visited.add(oid);
    const { type, object } = await _readObject({ fs, cache, gitdir, oid });
    if (type === "tag") {
      const tag = GitAnnotatedTag.from(object);
      const commit2 = tag.headers().object;
      return walk2(commit2);
    }
    if (type !== "commit") {
      throw new ObjectTypeError(oid, type, "commit");
    }
    if (!shallows.has(oid)) {
      const commit2 = GitCommit.from(object);
      const parents = commit2.headers().parent;
      for (oid of parents) {
        if (!finishingSet.has(oid) && !visited.has(oid)) {
          await walk2(oid);
        }
      }
    }
  }
  for (const oid of startingSet) {
    await walk2(oid);
  }
  return visited;
}
async function listObjects({
  fs,
  cache,
  dir,
  gitdir = join(dir, ".git"),
  oids
}) {
  const visited = /* @__PURE__ */ new Set();
  async function walk2(oid) {
    if (visited.has(oid))
      return;
    visited.add(oid);
    const { type, object } = await _readObject({ fs, cache, gitdir, oid });
    if (type === "tag") {
      const tag = GitAnnotatedTag.from(object);
      const obj = tag.headers().object;
      await walk2(obj);
    } else if (type === "commit") {
      const commit2 = GitCommit.from(object);
      const tree = commit2.headers().tree;
      await walk2(tree);
    } else if (type === "tree") {
      const tree = GitTree.from(object);
      for (const entry of tree) {
        if (entry.type === "blob") {
          visited.add(entry.oid);
        }
        if (entry.type === "tree") {
          await walk2(entry.oid);
        }
      }
    }
  }
  for (const oid of oids) {
    await walk2(oid);
  }
  return visited;
}
async function parseReceivePackResponse(packfile) {
  const result = {};
  let response = "";
  const read = GitPktLine.streamReader(packfile);
  let line = await read();
  while (line !== true) {
    if (line !== null)
      response += line.toString("utf8") + "\n";
    line = await read();
  }
  const lines = response.toString("utf8").split("\n");
  line = lines.shift();
  if (!line.startsWith("unpack ")) {
    throw new ParseError('unpack ok" or "unpack [error message]', line);
  }
  result.ok = line === "unpack ok";
  if (!result.ok) {
    result.error = line.slice("unpack ".length);
  }
  result.refs = {};
  for (const line2 of lines) {
    if (line2.trim() === "")
      continue;
    const status = line2.slice(0, 2);
    const refAndMessage = line2.slice(3);
    let space = refAndMessage.indexOf(" ");
    if (space === -1)
      space = refAndMessage.length;
    const ref = refAndMessage.slice(0, space);
    const error = refAndMessage.slice(space + 1);
    result.refs[ref] = {
      ok: status === "ok",
      error
    };
  }
  return result;
}
async function writeReceivePackRequest({
  capabilities = [],
  triplets = []
}) {
  const packstream = [];
  let capsFirstLine = `\0 ${capabilities.join(" ")}`;
  for (const trip of triplets) {
    packstream.push(
      GitPktLine.encode(
        `${trip.oldoid} ${trip.oid} ${trip.fullRef}${capsFirstLine}
`
      )
    );
    capsFirstLine = "";
  }
  packstream.push(GitPktLine.flush());
  return packstream;
}
async function _push({
  fs,
  cache,
  http,
  onProgress,
  onMessage,
  onAuth,
  onAuthSuccess,
  onAuthFailure,
  onPrePush,
  gitdir,
  ref: _ref,
  remoteRef: _remoteRef,
  remote,
  url: _url,
  force = false,
  delete: _delete = false,
  corsProxy,
  headers = {}
}) {
  const ref = _ref || await _currentBranch({ fs, gitdir });
  if (typeof ref === "undefined") {
    throw new MissingParameterError("ref");
  }
  const config = await GitConfigManager.get({ fs, gitdir });
  remote = remote || await config.get(`branch.${ref}.pushRemote`) || await config.get("remote.pushDefault") || await config.get(`branch.${ref}.remote`) || "origin";
  const url = _url || await config.get(`remote.${remote}.pushurl`) || await config.get(`remote.${remote}.url`);
  if (typeof url === "undefined") {
    throw new MissingParameterError("remote OR url");
  }
  const remoteRef = _remoteRef || await config.get(`branch.${ref}.merge`);
  if (typeof url === "undefined") {
    throw new MissingParameterError("remoteRef");
  }
  if (corsProxy === void 0) {
    corsProxy = await config.get("http.corsProxy");
  }
  const fullRef = await GitRefManager.expand({ fs, gitdir, ref });
  const oid = _delete ? "0000000000000000000000000000000000000000" : await GitRefManager.resolve({ fs, gitdir, ref: fullRef });
  const GitRemoteHTTP2 = GitRemoteManager.getRemoteHelperFor({ url });
  const httpRemote = await GitRemoteHTTP2.discover({
    http,
    onAuth: addCredentialUsername({ config, onAuth }),
    onAuthSuccess,
    onAuthFailure: addCredentialUsername({ config, onAuth: onAuthFailure }),
    corsProxy,
    service: "git-receive-pack",
    url,
    headers,
    protocolVersion: 1
  });
  const auth = httpRemote.auth;
  let fullRemoteRef;
  if (!remoteRef) {
    fullRemoteRef = fullRef;
  } else {
    try {
      fullRemoteRef = await GitRefManager.expandAgainstMap({
        ref: remoteRef,
        map: httpRemote.refs
      });
    } catch (err) {
      if (err instanceof NotFoundError) {
        fullRemoteRef = remoteRef.startsWith("refs/") ? remoteRef : `refs/heads/${remoteRef}`;
      } else {
        throw err;
      }
    }
  }
  const oldoid = httpRemote.refs.get(fullRemoteRef) || "0000000000000000000000000000000000000000";
  if (onPrePush) {
    const hookCancel = await onPrePush({
      remote,
      url,
      localRef: { ref: _delete ? "(delete)" : fullRef, oid },
      remoteRef: { ref: fullRemoteRef, oid: oldoid }
    });
    if (!hookCancel)
      throw new UserCanceledError();
  }
  const thinPack = !httpRemote.capabilities.has("no-thin");
  let objects = /* @__PURE__ */ new Set();
  if (!_delete) {
    const finish = [...httpRemote.refs.values()];
    let skipObjects = /* @__PURE__ */ new Set();
    if (oldoid !== "0000000000000000000000000000000000000000") {
      const mergebase = await _findMergeBase({
        fs,
        cache,
        gitdir,
        oids: [oid, oldoid]
      });
      for (const oid2 of mergebase)
        finish.push(oid2);
      if (thinPack) {
        skipObjects = await listObjects({ fs, cache, gitdir, oids: mergebase });
      }
    }
    if (!finish.includes(oid)) {
      const commits = await listCommitsAndTags({
        fs,
        cache,
        gitdir,
        start: [oid],
        finish
      });
      objects = await listObjects({ fs, cache, gitdir, oids: commits });
    }
    if (thinPack) {
      try {
        const ref2 = await GitRefManager.resolve({
          fs,
          gitdir,
          ref: `refs/remotes/${remote}/HEAD`,
          depth: 2
        });
        const { oid: oid2 } = await GitRefManager.resolveAgainstMap({
          ref: ref2.replace(`refs/remotes/${remote}/`, ""),
          fullref: ref2,
          map: httpRemote.refs
        });
        const oids = [oid2];
        for (const oid3 of await listObjects({ fs, cache, gitdir, oids })) {
          skipObjects.add(oid3);
        }
      } catch (e) {
      }
      for (const oid2 of skipObjects) {
        objects.delete(oid2);
      }
    }
    if (oid === oldoid)
      force = true;
    if (!force) {
      if (fullRef.startsWith("refs/tags") && oldoid !== "0000000000000000000000000000000000000000") {
        throw new PushRejectedError("tag-exists");
      }
      if (oid !== "0000000000000000000000000000000000000000" && oldoid !== "0000000000000000000000000000000000000000" && !await _isDescendent({
        fs,
        cache,
        gitdir,
        oid,
        ancestor: oldoid,
        depth: -1
      })) {
        throw new PushRejectedError("not-fast-forward");
      }
    }
  }
  const capabilities = filterCapabilities(
    [...httpRemote.capabilities],
    ["report-status", "side-band-64k", `agent=${pkg.agent}`]
  );
  const packstream1 = await writeReceivePackRequest({
    capabilities,
    triplets: [{ oldoid, oid, fullRef: fullRemoteRef }]
  });
  const packstream2 = _delete ? [] : await _pack({
    fs,
    cache,
    gitdir,
    oids: [...objects]
  });
  const res = await GitRemoteHTTP2.connect({
    http,
    onProgress,
    corsProxy,
    service: "git-receive-pack",
    url,
    auth,
    headers,
    body: [...packstream1, ...packstream2]
  });
  const { packfile, progress } = await GitSideBand.demux(res.body);
  if (onMessage) {
    const lines = splitLines(progress);
    forAwait(lines, async (line) => {
      await onMessage(line);
    });
  }
  const result = await parseReceivePackResponse(packfile);
  if (res.headers) {
    result.headers = res.headers;
  }
  if (remote && result.ok && result.refs[fullRemoteRef].ok && !fullRef.startsWith("refs/tags")) {
    const ref2 = `refs/remotes/${remote}/${fullRemoteRef.replace(
      "refs/heads",
      ""
    )}`;
    if (_delete) {
      await GitRefManager.deleteRef({ fs, gitdir, ref: ref2 });
    } else {
      await GitRefManager.writeRef({ fs, gitdir, ref: ref2, value: oid });
    }
  }
  if (result.ok && Object.values(result.refs).every((result2) => result2.ok)) {
    return result;
  } else {
    const prettyDetails = Object.entries(result.refs).filter(([k, v]) => !v.ok).map(([k, v]) => `
  - ${k}: ${v.error}`).join("");
    throw new GitPushError(prettyDetails, result);
  }
}
async function push({
  fs,
  http,
  onProgress,
  onMessage,
  onAuth,
  onAuthSuccess,
  onAuthFailure,
  onPrePush,
  dir,
  gitdir = join(dir, ".git"),
  ref,
  remoteRef,
  remote = "origin",
  url,
  force = false,
  delete: _delete = false,
  corsProxy,
  headers = {},
  cache = {}
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("http", http);
    assertParameter("gitdir", gitdir);
    const fsp = new FileSystem(fs);
    const updatedGitdir = await discoverGitdir({ fsp, dotgit: gitdir });
    return await _push({
      fs: fsp,
      cache,
      http,
      onProgress,
      onMessage,
      onAuth,
      onAuthSuccess,
      onAuthFailure,
      onPrePush,
      gitdir: updatedGitdir,
      ref,
      remoteRef,
      remote,
      url,
      force,
      delete: _delete,
      corsProxy,
      headers
    });
  } catch (err) {
    err.caller = "git.push";
    throw err;
  }
}
async function readCommit({
  fs,
  dir,
  gitdir = join(dir, ".git"),
  oid,
  cache = {}
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("oid", oid);
    const fsp = new FileSystem(fs);
    const updatedGitdir = await discoverGitdir({ fsp, dotgit: gitdir });
    return await _readCommit({
      fs: fsp,
      cache,
      gitdir: updatedGitdir,
      oid
    });
  } catch (err) {
    err.caller = "git.readCommit";
    throw err;
  }
}
async function remove({
  fs: _fs,
  dir,
  gitdir = join(dir, ".git"),
  filepath,
  cache = {}
}) {
  try {
    assertParameter("fs", _fs);
    assertParameter("gitdir", gitdir);
    assertParameter("filepath", filepath);
    const fsp = new FileSystem(_fs);
    const updatedGitdir = await discoverGitdir({ fsp, dotgit: gitdir });
    await GitIndexManager.acquire(
      { fs: fsp, gitdir: updatedGitdir, cache },
      async function(index) {
        index.delete({ filepath });
      }
    );
  } catch (err) {
    err.caller = "git.remove";
    throw err;
  }
}
async function hashObject$1({ gitdir, type, object }) {
  return shasum(GitObject.wrap({ type, object }));
}
async function resetIndex({
  fs: _fs,
  dir,
  gitdir = join(dir, ".git"),
  filepath,
  ref,
  cache = {}
}) {
  try {
    assertParameter("fs", _fs);
    assertParameter("gitdir", gitdir);
    assertParameter("filepath", filepath);
    const fs = new FileSystem(_fs);
    const updatedGitdir = await discoverGitdir({ fsp: fs, dotgit: gitdir });
    let oid;
    let workdirOid;
    try {
      oid = await GitRefManager.resolve({
        fs,
        gitdir: updatedGitdir,
        ref: ref || "HEAD"
      });
    } catch (e) {
      if (ref) {
        throw e;
      }
    }
    if (oid) {
      try {
        oid = await resolveFilepath({
          fs,
          cache,
          gitdir: updatedGitdir,
          oid,
          filepath
        });
      } catch (e) {
        oid = null;
      }
    }
    let stats = {
      ctime: /* @__PURE__ */ new Date(0),
      mtime: /* @__PURE__ */ new Date(0),
      dev: 0,
      ino: 0,
      mode: 0,
      uid: 0,
      gid: 0,
      size: 0
    };
    const object = dir && await fs.read(join(dir, filepath));
    if (object) {
      workdirOid = await hashObject$1({
        gitdir: updatedGitdir,
        type: "blob",
        object
      });
      if (oid === workdirOid) {
        stats = await fs.lstat(join(dir, filepath));
      }
    }
    await GitIndexManager.acquire(
      { fs, gitdir: updatedGitdir, cache },
      async function(index) {
        index.delete({ filepath });
        if (oid) {
          index.insert({ filepath, stats, oid });
        }
      }
    );
  } catch (err) {
    err.caller = "git.reset";
    throw err;
  }
}
async function resolveRef({
  fs,
  dir,
  gitdir = join(dir, ".git"),
  ref,
  depth
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("ref", ref);
    const fsp = new FileSystem(fs);
    const updatedGitdir = await discoverGitdir({ fsp, dotgit: gitdir });
    const oid = await GitRefManager.resolve({
      fs: fsp,
      gitdir: updatedGitdir,
      ref,
      depth
    });
    return oid;
  } catch (err) {
    err.caller = "git.resolveRef";
    throw err;
  }
}
async function statusMatrix({
  fs: _fs,
  dir,
  gitdir = join(dir, ".git"),
  ref = "HEAD",
  filepaths = ["."],
  filter,
  cache = {},
  ignored: shouldIgnore = false,
  refresh = true
}) {
  try {
    assertParameter("fs", _fs);
    assertParameter("gitdir", gitdir);
    assertParameter("ref", ref);
    const fs = new FileSystem(_fs);
    const updatedGitdir = await discoverGitdir({ fsp: fs, dotgit: gitdir });
    return await _walk({
      fs,
      cache,
      dir,
      gitdir: updatedGitdir,
      trees: [TREE({ ref }), WORKDIR({ refresh }), STAGE()],
      map: async function(filepath, [head, workdir, stage]) {
        if (!head && !stage && workdir) {
          if (!shouldIgnore) {
            const isIgnored = await GitIgnoreManager.isIgnored({
              fs,
              dir,
              filepath
            });
            if (isIgnored) {
              return null;
            }
          }
        }
        if (!filepaths.some((base) => worthWalking(filepath, base))) {
          return null;
        }
        if (filter) {
          if (!filter(filepath))
            return;
        }
        const [headType, workdirType, stageType] = await Promise.all([
          head && head.type(),
          workdir && workdir.type(),
          stage && stage.type()
        ]);
        const isBlob = [headType, workdirType, stageType].includes("blob");
        if ((headType === "tree" || headType === "special") && !isBlob)
          return;
        if (headType === "commit")
          return null;
        if ((workdirType === "tree" || workdirType === "special") && !isBlob)
          return;
        if (stageType === "commit")
          return null;
        if ((stageType === "tree" || stageType === "special") && !isBlob)
          return;
        const headOid = headType === "blob" ? await head.oid() : void 0;
        const stageOid = stageType === "blob" ? await stage.oid() : void 0;
        let workdirOid;
        if (headType !== "blob" && workdirType === "blob" && stageType !== "blob") {
          workdirOid = "42";
        } else if (workdirType === "blob") {
          workdirOid = await workdir.oid();
        }
        const entry = [void 0, headOid, workdirOid, stageOid];
        const result = entry.map((value) => entry.indexOf(value));
        result.shift();
        return [filepath, ...result];
      }
    });
  } catch (err) {
    err.caller = "git.statusMatrix";
    throw err;
  }
}
async function walk({
  fs,
  dir,
  gitdir = join(dir, ".git"),
  trees,
  map,
  reduce,
  iterate,
  cache = {}
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("trees", trees);
    const fsp = new FileSystem(fs);
    const updatedGitdir = await discoverGitdir({ fsp, dotgit: gitdir });
    return await _walk({
      fs: fsp,
      cache,
      dir,
      gitdir: updatedGitdir,
      trees,
      map,
      reduce,
      iterate
    });
  } catch (err) {
    err.caller = "git.walk";
    throw err;
  }
}

// src/modules/git-sync/IsomorphicGitBackend.ts
function normalizePath2(p) {
  let cleaned = p.replace(/^\/+/, "").replace(/\/+/g, "/");
  if (cleaned === "" || cleaned === "/")
    cleaned = ".";
  return cleaned;
}
function createVaultFs(app) {
  const adapter = app.vault.adapter;
  async function statImpl(filepath) {
    var _a;
    const np = normalizePath2(filepath);
    if (np === ".") {
      return { type: "dir", mode: 511, size: 0, mtimeMs: 0, ctimeMs: 0, ino: 0, uid: 0, gid: 0 };
    }
    try {
      const s = await adapter.stat(np);
      if (!s)
        throw new Error(`ENOENT: ${np}`);
      return {
        type: s.type === "folder" ? "dir" : "file",
        mode: s.type === "folder" ? 511 : 438,
        size: (_a = s.size) != null ? _a : 0,
        mtimeMs: s.mtime,
        ctimeMs: s.ctime,
        ino: 0,
        uid: 0,
        gid: 0
      };
    } catch (e) {
      throw e;
    }
  }
  return {
    async readFile(filepath, opts) {
      const np = normalizePath2(filepath);
      const buf = await adapter.readBinary(np);
      const u8 = new Uint8Array(buf);
      if ((opts == null ? void 0 : opts.encoding) === "utf8" || (opts == null ? void 0 : opts.encoding) === "utf-8") {
        return new TextDecoder("utf-8").decode(u8);
      }
      return u8;
    },
    async writeFile(filepath, data, opts) {
      const np = normalizePath2(filepath);
      let u8;
      if (typeof data === "string") {
        u8 = new TextEncoder().encode(data);
      } else {
        u8 = data;
      }
      await adapter.writeBinary(np, u8.buffer);
    },
    async unlink(filepath) {
      const np = normalizePath2(filepath);
      await adapter.remove(np);
    },
    async readdir(filepath) {
      const np = normalizePath2(filepath);
      const list = await adapter.list(np);
      return [...list.folders || [], ...list.files || []];
    },
    async mkdir(filepath) {
      const np = normalizePath2(filepath);
      await adapter.mkdir(np);
    },
    async rmdir(filepath) {
      const np = normalizePath2(filepath);
      await adapter.rmdir(np, true);
    },
    stat: statImpl,
    lstat: statImpl,
    async readlink(_filepath) {
      throw new Error("ENOSYS: symlinks not supported");
    },
    async symlink(_target, _filepath) {
      throw new Error("ENOSYS: symlinks not supported");
    }
  };
}
var httpClient = {
  async request({ url, method, headers, body }) {
    const hdrs = { ...headers || {} };
    let bodyBuf;
    if (body) {
      if (Array.isArray(body)) {
        for (const chunk of body) {
          if (chunk instanceof Uint8Array) {
            bodyBuf = bodyBuf ? new Uint8Array([...bodyBuf, ...chunk]) : chunk;
          }
        }
      } else if (body instanceof Uint8Array) {
        bodyBuf = body;
      }
    }
    const resp = await fetch(url, {
      method,
      headers: hdrs,
      body: bodyBuf
    });
    const respBody = await resp.arrayBuffer();
    const plainHeaders = {};
    resp.headers.forEach((v, k) => {
      plainHeaders[k] = v;
    });
    const bodyIterable = async function* () {
      yield new Uint8Array(respBody);
    }();
    return {
      url: resp.url,
      method,
      statusCode: resp.status,
      statusMessage: resp.statusText,
      headers: plainHeaders,
      body: bodyIterable
    };
  }
};
function matrixToPorcelain(head, workdir, stage) {
  const xy = (x, y) => x + y;
  if (head === 0 && workdir === 0 && stage === 0)
    return "  ";
  if (head === 0 && workdir === 2 && stage === 0)
    return "??";
  if (head === 0 && workdir === 0 && stage === 3)
    return "A ";
  if (head === 0 && workdir === 2 && stage === 3)
    return "AM";
  if (head === 1 && workdir === 0 && stage === 0)
    return " D";
  if (head === 1 && workdir === 0 && stage === 0)
    return "D ";
  if (head === 1 && workdir === 0 && stage === 2)
    return "D ";
  if (head === 1 && workdir === 2 && stage === 1)
    return " M";
  if (head === 1 && workdir === 1 && stage === 2)
    return "M ";
  if (head === 1 && workdir === 2 && stage === 2)
    return "MM";
  if (stage === 3)
    return "A ";
  if (stage === 2 && head === 1 && workdir === 1)
    return "M ";
  if (stage === 2 && head === 1 && workdir === 2)
    return "MM";
  if (stage === 1 && workdir === 2 && head === 1)
    return " M";
  if (head === 1 && workdir === 0 && stage === 0)
    return " D";
  if (head === 1 && workdir === 0 && stage === 2)
    return "D ";
  if (head === 0 && workdir === 2 && stage === 0)
    return "??";
  return "  ";
}
var IsomorphicGitBackend = class {
  constructor(app) {
    this.app = app;
    this.fs = createVaultFs(app);
    this.dir = "/";
  }
  async gitdir() {
    try {
      return await findRoot({ fs: this.fs, filepath: `${this.dir}/.git` });
    } catch (e) {
      return `${this.dir}/.git`;
    }
  }
  // ── Public API ──
  async isGitRepo() {
    try {
      const gd = await this.gitdir();
      await resolveRef({ fs: this.fs, dir: gd, ref: "HEAD" });
      return true;
    } catch (e) {
      return false;
    }
  }
  async initRepo() {
    await init({ fs: this.fs, dir: this.dir });
  }
  async ensureRemote(url, name2) {
    const gd = await this.gitdir();
    const remotes = await listRemotes({ fs: this.fs, dir: gd });
    const byUrl = {};
    for (const r of remotes) {
      if (r.url)
        byUrl[r.url] = r.remote;
    }
    if (byUrl[url] && byUrl[url] !== name2) {
      return;
    }
    const existing = remotes.find((r) => r.remote === name2);
    if (existing) {
      if (existing.url !== url) {
        await deleteRemote({ fs: this.fs, dir: gd, remote: name2 });
        await addRemote({ fs: this.fs, dir: gd, remote: name2, url });
      }
    } else {
      await addRemote({ fs: this.fs, dir: gd, remote: name2, url });
      try {
        await fetch2({
          fs: this.fs,
          http: httpClient,
          dir: gd,
          remote: name2,
          singleBranch: true
        });
      } catch (e) {
      }
    }
  }
  async hasCommits() {
    try {
      const gd = await this.gitdir();
      await resolveRef({ fs: this.fs, dir: gd, ref: "HEAD" });
      return true;
    } catch (e) {
      return false;
    }
  }
  async getStatus(remoteName, branchName) {
    const gd = await this.gitdir();
    let clean = true;
    let files = [];
    try {
      const statusFiles = await this.getStatusFiles();
      if (statusFiles.length > 0) {
        clean = false;
        files = statusFiles.map((f) => f.path);
      }
    } catch (e) {
    }
    let ahead = 0;
    let behind = 0;
    if (remoteName && branchName) {
      try {
        const localRef = `refs/heads/${branchName}`;
        const remoteRef = `refs/remotes/${remoteName}/${branchName}`;
        const localOid = await resolveRef({ fs: this.fs, dir: gd, ref: localRef }).catch(() => null);
        const remoteOid = await resolveRef({ fs: this.fs, dir: gd, ref: remoteRef }).catch(() => null);
        if (localOid && remoteOid && localOid !== remoteOid) {
          const localLog = await log({ fs: this.fs, dir: gd, ref: localRef, depth: 500 });
          const remoteHashes = new Set(
            (await log({ fs: this.fs, dir: gd, ref: remoteRef, depth: 500 })).map((c) => c.oid)
          );
          const localHashes = new Set(localLog.map((c) => c.oid));
          for (const c of localLog) {
            if (remoteHashes.has(c.oid))
              break;
            ahead++;
          }
          const remoteLog = await log({ fs: this.fs, dir: gd, ref: remoteRef, depth: 500 });
          for (const c of remoteLog) {
            if (localHashes.has(c.oid))
              break;
            behind++;
          }
        }
      } catch (e) {
      }
    }
    return { clean, files, ahead, behind };
  }
  async getStatusFiles() {
    try {
      const gd = await this.gitdir();
      const matrix = await statusMatrix({
        fs: this.fs,
        dir: this.dir,
        gitdir: gd
      });
      const results = [];
      for (const [filepath, head, workdir, stage] of matrix) {
        if (head === 1 && workdir === 1 && stage === 1)
          continue;
        const status = matrixToPorcelain(head, workdir, stage);
        if (status === "  ")
          continue;
        const staged = stage !== 1 || status[0] !== " " && status[0] !== "?";
        results.push({ path: filepath, status, staged });
      }
      return results;
    } catch (e) {
      return [];
    }
  }
  async stageFiles(files) {
    const gd = await this.gitdir();
    const staged = [];
    const skipped = [];
    for (const f of files) {
      if (!f || !f.trim())
        continue;
      try {
        await add({ fs: this.fs, dir: this.dir, gitdir: gd, filepath: f });
        staged.push(f);
      } catch (e) {
        try {
          await remove({ fs: this.fs, dir: this.dir, gitdir: gd, filepath: f });
          staged.push(f);
        } catch (e2) {
          skipped.push(f);
        }
      }
    }
    if (staged.length === 0 && files.length > 0) {
      throw new Error("\u6CA1\u6709\u6587\u4EF6\u53EF\u4EE5\u6682\u5B58\uFF08\u6240\u6709\u6587\u4EF6\u5747\u5DF2\u4E0D\u5B58\u5728\uFF09");
    }
    return staged;
  }
  async restoreFiles(files) {
    const gd = await this.gitdir();
    const restored = [];
    for (const f of files) {
      try {
        try {
          await resetIndex({ fs: this.fs, dir: this.dir, gitdir: gd, filepath: f });
        } catch (e) {
        }
        await checkout({
          fs: this.fs,
          dir: this.dir,
          gitdir: gd,
          filepaths: [f],
          force: true
        });
        restored.push(f);
      } catch (e) {
      }
    }
    if (restored.length === 0 && files.length > 0) {
      throw new Error("\u65E0\u6CD5\u56DE\u6EDA\u4EFB\u4F55\u6587\u4EF6");
    }
    return restored;
  }
  async commit(message) {
    const gd = await this.gitdir();
    const matrix = await statusMatrix({
      fs: this.fs,
      dir: this.dir,
      gitdir: gd,
      filter: (f) => f.endsWith("")
    });
    const hasStaged = matrix.some(([_f, _h, _w, stage]) => stage !== 1);
    if (!hasStaged)
      return false;
    const sha = await commit({
      fs: this.fs,
      dir: this.dir,
      gitdir: gd,
      message,
      author: {
        name: "yyObsidianDashboard",
        email: "dashboard@obsidian.local"
      }
    });
    return !!sha;
  }
  async stageAndCommit(message) {
    const gd = await this.gitdir();
    const matrix = await statusMatrix({
      fs: this.fs,
      dir: this.dir,
      gitdir: gd
    });
    const toAdd = [];
    const toRemove = [];
    for (const [filepath, _head, _workdir, _stage] of matrix) {
      const head = _head;
      const workdir = _workdir;
      if (head === 1 && workdir === 0) {
        toRemove.push(filepath);
      } else if (head !== workdir || head === 0 && workdir === 2) {
        toAdd.push(filepath);
      }
    }
    for (const f of toAdd) {
      await add({ fs: this.fs, dir: this.dir, gitdir: gd, filepath: f });
    }
    for (const f of toRemove) {
      await remove({ fs: this.fs, dir: this.dir, gitdir: gd, filepath: f });
    }
    const matrix2 = await statusMatrix({
      fs: this.fs,
      dir: this.dir,
      gitdir: gd
    });
    const hasStaged = matrix2.some(([_f, _h, _w, stage]) => stage === 2 || stage === 3);
    if (!hasStaged)
      return false;
    await commit({
      fs: this.fs,
      dir: this.dir,
      gitdir: gd,
      message,
      author: {
        name: "yyObsidianDashboard",
        email: "dashboard@obsidian.local"
      }
    });
    return true;
  }
  async push(remote, branch, username, password, _timeoutMinutes) {
    const gd = await this.gitdir();
    const onAuth = username && password ? () => ({ username, password }) : void 0;
    const pushResult = await push({
      fs: this.fs,
      http: httpClient,
      dir: gd,
      remote,
      ref: `refs/heads/${branch}`,
      remoteRef: `refs/heads/${branch}`,
      onAuth
    });
    if (pushResult.error) {
      throw new Error(pushResult.error);
    }
    try {
      await fetch2({
        fs: this.fs,
        http: httpClient,
        dir: gd,
        remote,
        ref: `refs/heads/${branch}`,
        singleBranch: true,
        onAuth
      });
    } catch (e) {
    }
    return pushResult.ok ? "\u63A8\u9001\u6210\u529F" : "\u63A8\u9001\u5931\u8D25";
  }
  async pull(remote, branch, username, password, _timeoutMinutes) {
    const gd = await this.gitdir();
    const onAuth = username && password ? () => ({ username, password }) : void 0;
    const pullResult = await pull({
      fs: this.fs,
      http: httpClient,
      dir: this.dir,
      gitdir: gd,
      remote,
      ref: `refs/heads/${branch}`,
      singleBranch: true,
      author: {
        name: "yyObsidianDashboard",
        email: "dashboard@obsidian.local"
      },
      onAuth
    });
    if (pullResult.error) {
      throw new Error(pullResult.error);
    }
    await checkout({
      fs: this.fs,
      dir: this.dir,
      gitdir: gd,
      ref: `refs/heads/${branch}`
    });
    return "\u62C9\u53D6\u5B8C\u6210";
  }
  async pushAll(remote, branch, message, username, password, timeoutMinutes) {
    await this.stageAndCommit(message);
    return this.push(remote, branch, username, password, timeoutMinutes);
  }
  async getRecentCommits(n) {
    try {
      const gd = await this.gitdir();
      const log2 = await log({ fs: this.fs, dir: gd, depth: n });
      return log2.map((entry) => ({
        hash: entry.oid.slice(0, 7),
        message: entry.commit.message,
        date: new Date(entry.commit.committer.timestamp * 1e3).toISOString(),
        author: entry.commit.author.name
      }));
    } catch (e) {
      return [];
    }
  }
  async getCommitFiles(hash) {
    try {
      const gd = await this.gitdir();
      const oid = await resolveRef({ fs: this.fs, dir: gd, ref: hash });
      const { commit: commitObj } = await readCommit({ fs: this.fs, dir: gd, oid });
      if (!commitObj.parent || commitObj.parent.length === 0) {
        const files2 = [];
        await walk({
          fs: this.fs,
          dir: gd,
          trees: [TREE({ ref: oid })],
          map: async (filepath, [node]) => {
            if (node)
              files2.push(filepath);
          }
        });
        return files2;
      }
      const parentOid = commitObj.parent[0];
      const parentTree = (await readCommit({ fs: this.fs, dir: gd, oid: parentOid })).commit.tree;
      const thisTree = commitObj.tree;
      const files = /* @__PURE__ */ new Set();
      await walk({
        fs: this.fs,
        dir: gd,
        trees: [TREE({ ref: thisTree })],
        map: async (filepath, [node]) => {
          if (!node)
            return;
          try {
            const parentEntry = await walk({
              fs: this.fs,
              dir: gd,
              trees: [TREE({ ref: parentTree })],
              map: async (fp, [n]) => {
                if (fp === filepath && n)
                  return n.oid;
              }
            });
            const parentOids = [];
            if (parentEntry)
              parentOids.push(parentEntry);
            if (parentOids.length === 0 || parentOids[0] !== node.oid) {
              files.add(filepath);
            }
          } catch (e) {
            files.add(filepath);
          }
        }
      });
      await walk({
        fs: this.fs,
        dir: gd,
        trees: [TREE({ ref: parentTree })],
        map: async (filepath, [node]) => {
          if (!node)
            return;
          try {
            const entry = await walk({
              fs: this.fs,
              dir: gd,
              trees: [TREE({ ref: thisTree })],
              map: async (fp, [n]) => {
                if (fp === filepath && n)
                  return n.oid;
              }
            });
            if (!entry) {
              files.add(filepath);
            }
          } catch (e) {
            files.add(filepath);
          }
        }
      });
      return [...files];
    } catch (e) {
      return [];
    }
  }
  buildAuthUrl(remoteUrl, username, password) {
    if (remoteUrl.startsWith("https://")) {
      const withoutProtocol = remoteUrl.slice(8);
      return `https://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${withoutProtocol}`;
    }
    return remoteUrl;
  }
};

// src/modules/git-sync/GitService.ts
var GitService = class {
  constructor(app) {
    if (import_obsidian5.Platform.isMobile) {
      this.backend = new IsomorphicGitBackend(app);
    } else {
      this.backend = new NativeGitBackend(app);
    }
  }
  get isMobile() {
    return import_obsidian5.Platform.isMobile;
  }
  async isGitRepo() {
    return this.backend.isGitRepo();
  }
  async initRepo() {
    return this.backend.initRepo();
  }
  async ensureRemote(url, name2) {
    return this.backend.ensureRemote(url, name2);
  }
  async hasCommits() {
    return this.backend.hasCommits();
  }
  async getStatus(remoteName, branchName) {
    return this.backend.getStatus(remoteName, branchName);
  }
  async getStatusFiles() {
    return this.backend.getStatusFiles();
  }
  async stageFiles(files) {
    return this.backend.stageFiles(files);
  }
  async restoreFiles(files) {
    return this.backend.restoreFiles(files);
  }
  async commit(message) {
    return this.backend.commit(message);
  }
  async stageAndCommit(message) {
    return this.backend.stageAndCommit(message);
  }
  async push(remote, branch, username, password, timeoutMinutes) {
    return this.backend.push(remote, branch, username, password, timeoutMinutes);
  }
  async pull(remote, branch, username, password, timeoutMinutes) {
    return this.backend.pull(remote, branch, username, password, timeoutMinutes);
  }
  async pushAll(remote, branch, message, username, password, timeoutMinutes) {
    return this.backend.pushAll(remote, branch, message, username, password, timeoutMinutes);
  }
  async getRecentCommits(n) {
    return this.backend.getRecentCommits(n);
  }
  async getCommitFiles(hash) {
    return this.backend.getCommitFiles(hash);
  }
  buildAuthUrl(remoteUrl, username, password) {
    return this.backend.buildAuthUrl(remoteUrl, username, password);
  }
};

// src/modules/remotely-save/RemotelySaveService.ts
var RemotelySaveService = class {
  constructor() {
    this.dbName = "remotelysavedb";
    this.storeName = "syncplanshistory";
  }
  async openDB() {
    return new Promise((resolve, reject) => {
      try {
        const req = indexedDB.open(this.dbName);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(new Error("\u65E0\u6CD5\u6253\u5F00 Remotely Save \u6570\u636E\u5E93"));
        req.onblocked = () => {
          if (req.result)
            req.result.close();
          reject(new Error("\u6570\u636E\u5E93\u88AB\u963B\u585E\uFF0C\u8BF7\u91CD\u8BD5"));
        };
      } catch (e) {
        reject(new Error("indexedDB not available: " + e.message));
      }
    });
  }
  async getTotalSyncCount() {
    let db = null;
    try {
      db = await this.openDB();
    } catch (e) {
      return 0;
    }
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(this.storeName, "readonly");
        const store = tx.objectStore(this.storeName);
        const countReq = store.count();
        countReq.onsuccess = () => resolve(countReq.result);
        countReq.onerror = () => resolve(0);
        tx.onerror = () => resolve(0);
      } catch (e) {
        resolve(0);
      }
    });
  }
  async getSyncHistory(limit = 10) {
    let db = null;
    try {
      db = await this.openDB();
    } catch (e) {
      return [];
    }
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(this.storeName, "readonly");
        const store = tx.objectStore(this.storeName);
        const sessions = [];
        store.openCursor(null, "prev").onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            const record = cursor.value;
            try {
              const plan = typeof record.syncPlan === "string" ? JSON.parse(record.syncPlan) : record.syncPlan;
              const session = this.parseSyncPlan(record, plan);
              if (session) {
                sessions.push(session);
              }
            } catch (e) {
            }
            if (sessions.length >= limit) {
              resolve(sessions);
              return;
            }
            cursor.continue();
          } else {
            resolve(sessions);
          }
        };
        tx.onerror = () => resolve(sessions);
      } catch (e) {
        resolve([]);
      }
    });
  }
  parseSyncPlan(record, plan) {
    if (!plan || typeof plan !== "object")
      return null;
    const entries = this.extractFileEntries(plan);
    const uploads = [];
    const downloads = [];
    const deletions = [];
    for (const [key, info] of entries) {
      if (info.change !== true)
        continue;
      const decision = String(info.decision || "").toLowerCase();
      const category = this.categorize(decision);
      if (category === "upload")
        uploads.push(key);
      else if (category === "download")
        downloads.push(key);
      else if (category === "delete")
        deletions.push(key);
      else
        uploads.push(key);
    }
    return {
      ts: record.ts || 0,
      tsFmt: record.tsFmt || "",
      remoteType: record.remoteType || "",
      uploads,
      downloads,
      deletions,
      totalCount: uploads.length + downloads.length + deletions.length
    };
  }
  /** Map a Remotely Save `decision` enum value to a coarse operation category. */
  categorize(decision) {
    if (/(^|_)del(_|$)|delete|remove|delhist/.test(decision))
      return "delete";
    if (/push|upload|local_is_modified|local_is_created|keep_local|overwrite_remote/.test(decision))
      return "upload";
    if (/pull|download|remote_is_modified|remote_is_created|keep_remote|overwrite_local/.test(decision))
      return "download";
    return "unknown";
  }
  /** Extract file entries from a sync plan, tolerating multiple Remotely Save formats. */
  extractFileEntries(plan) {
    const results = [];
    const nestedKeys = ["mixedStates", "mixedEntities", "syncPlanEntries", "entries"];
    for (const nk of nestedKeys) {
      const nested = plan[nk];
      if (nested && typeof nested === "object" && !Array.isArray(nested)) {
        for (const [k, v] of Object.entries(nested)) {
          if (v && typeof v === "object" && v.decision !== void 0) {
            results.push([this.entryKey(k, v), v]);
          }
        }
        if (results.length > 0)
          return results;
      }
    }
    for (const [k, v] of Object.entries(plan)) {
      if (!v || typeof v !== "object" || Array.isArray(v))
        continue;
      if (v.decision === void 0 && v.change === void 0)
        continue;
      results.push([this.entryKey(k, v), v]);
    }
    return results;
  }
  entryKey(k, v) {
    if (v && typeof v === "object" && typeof v.key === "string" && v.key)
      return v.key;
    return k;
  }
};

// src/modules/heatmap/ReportService.ts
var import_obsidian6 = require("obsidian");
var ReportService = class _ReportService {
  constructor(app, settings) {
    this.app = app;
    this.settings = settings;
  }
  updateSettings(settings) {
    this.settings = settings;
  }
  static formatMomentDate(date, format) {
    const y = String(date.getFullYear());
    const m = String(date.getMonth() + 1);
    const d = String(date.getDate());
    const temp = new Date(date.getTime());
    temp.setHours(0, 0, 0, 0);
    temp.setDate(temp.getDate() + 3 - (temp.getDay() + 6) % 7);
    const week1 = new Date(temp.getFullYear(), 0, 4);
    const w = String(
      1 + Math.round(
        ((temp.getTime() - week1.getTime()) / 864e5 - 3 + (week1.getDay() + 6) % 7) / 7
      )
    );
    const Q = String(Math.floor(date.getMonth() / 3) + 1);
    let result = format.replace(/\[([^\]]+)\]/g, "$1");
    result = result.replace(/YYYY/g, y).replace(/YY/g, y.slice(2)).replace(/MM/g, m.padStart(2, "0")).replace(/DD/g, d.padStart(2, "0")).replace(/ww/g, w.padStart(2, "0")).replace(/M/g, m).replace(/D/g, d).replace(/w/g, w).replace(/Q/g, Q);
    return result;
  }
  resolveReportPath(type, date) {
    const cfg = this.settings.reportConfigs[type];
    const relPath = _ReportService.formatMomentDate(date, cfg.filenameFormat);
    const dir = cfg.directory.replace(/^\/+|\/+$/g, "");
    return dir ? `${dir}/${relPath}.md` : `${relPath}.md`;
  }
  reportExists(type, date) {
    const path = this.resolveReportPath(type, date);
    const file = this.app.vault.getAbstractFileByPath(path);
    return file instanceof import_obsidian6.TFile;
  }
  /** Reference date for the current reporting period */
  getPeriodDate(type, ref = /* @__PURE__ */ new Date()) {
    switch (type) {
      case "daily":
        return new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
      case "weekly": {
        const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
        d.setDate(d.getDate() - (d.getDay() + 6) % 7);
        return d;
      }
      case "monthly":
        return new Date(ref.getFullYear(), ref.getMonth(), 1);
      case "quarterly":
        return new Date(ref.getFullYear(), Math.floor(ref.getMonth() / 3) * 3, 1);
      case "yearly":
        return new Date(ref.getFullYear(), 0, 1);
    }
  }
  getMissingReports(ref = /* @__PURE__ */ new Date()) {
    const missing = [];
    for (const type of Object.keys(REPORT_LABELS)) {
      const cfg = this.settings.reportConfigs[type];
      if (!cfg.enabled)
        continue;
      const date = this.getPeriodDate(type, ref);
      if (!this.reportExists(type, date)) {
        missing.push({
          type,
          label: REPORT_LABELS[type],
          path: this.resolveReportPath(type, date),
          date
        });
      }
    }
    return missing;
  }
  async openOrCreateReport(type, date) {
    const cfg = this.settings.reportConfigs[type];
    const path = this.resolveReportPath(type, date);
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof import_obsidian6.TFile) {
      await this.app.workspace.getLeaf(false).openFile(file);
      return;
    }
    const doCreate = async () => {
      let content = "";
      if (cfg.templatePath) {
        const tpl = this.app.vault.getAbstractFileByPath(`${cfg.templatePath}.md`);
        if (tpl instanceof import_obsidian6.TFile) {
          content = _ReportService.formatMomentDate(date, await this.app.vault.read(tpl));
        }
      }
      const segs = path.split("/");
      let acc = "";
      for (let i = 0; i < segs.length - 1; i++) {
        acc += (acc ? "/" : "") + segs[i];
        if (!this.app.vault.getAbstractFileByPath(acc)) {
          try {
            await this.app.vault.createFolder(acc);
          } catch (e) {
          }
        }
      }
      const created = await this.app.vault.create(path, content);
      await this.app.workspace.getLeaf(false).openFile(created);
    };
    if (cfg.confirmBeforeCreate) {
      const name2 = REPORT_LABELS[type];
      new class extends import_obsidian6.Modal {
        onOpen() {
          this.contentEl.createEl("p", { text: `${name2}\u4E0D\u5B58\u5728\uFF0C\u662F\u5426\u65B0\u5EFA\uFF1F` });
          this.contentEl.createEl("p", { text: path, cls: "dashboard-field-hint" });
          const btns = this.contentEl.createDiv("dashboard-confirm-btns");
          btns.createEl("button", { text: "\u53D6\u6D88" }).addEventListener("click", () => this.close());
          btns.createEl("button", { text: "\u65B0\u5EFA", cls: "mod-cta" }).addEventListener("click", async () => {
            this.close();
            try {
              await doCreate();
            } catch (e) {
              new import_obsidian6.Notice(`\u521B\u5EFA\u5931\u8D25: ${e.message}`);
            }
          });
        }
        onClose() {
          this.contentEl.empty();
        }
      }(this.app).open();
    } else {
      try {
        await doCreate();
      } catch (e) {
        new import_obsidian6.Notice(`\u521B\u5EFA${REPORT_LABELS[type]}\u5931\u8D25: ${e.message}`);
      }
    }
  }
};

// src/shared/utils.ts
function formatRelativeTime(mtime) {
  const diff = Math.floor((Date.now() - mtime) / 6e4);
  if (diff < 1)
    return "\u521A\u521A";
  if (diff < 60)
    return `${diff}\u5206\u949F\u524D`;
  if (diff < 1440)
    return `${Math.floor(diff / 60)}\u5C0F\u65F6\u524D`;
  return `${Math.floor(diff / 1440)}\u5929\u524D`;
}
function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function attachFileListPopover(trigger, files, title, onFileClick) {
  let popover = null;
  let hideTimer = null;
  const clearTimer = () => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  };
  const remove2 = () => {
    clearTimer();
    if (popover) {
      popover.remove();
      popover = null;
    }
  };
  const show = () => {
    clearTimer();
    remove2();
    popover = document.body.createDiv("dashboard-popover");
    popover.createDiv("dashboard-popover-title").textContent = `${title} (${files.length})`;
    for (const filePath of files) {
      const item = popover.createDiv("dashboard-popover-item");
      item.textContent = `\u2022 ${filePath}`;
      if (onFileClick) {
        item.addEventListener("mousedown", async (e) => {
          e.preventDefault();
          onFileClick(filePath);
          remove2();
        });
      }
    }
    const rect = trigger.getBoundingClientRect();
    popover.style.top = `${rect.bottom + 6}px`;
    popover.style.left = `${Math.min(rect.left, window.innerWidth - 420)}px`;
    popover.addEventListener("mouseenter", clearTimer);
    popover.addEventListener("mouseleave", () => {
      hideTimer = setTimeout(remove2, 200);
    });
  };
  trigger.addEventListener("mouseenter", show);
  trigger.addEventListener("mouseleave", () => {
    hideTimer = setTimeout(remove2, 200);
  });
}
var MODULE_COLLAPSE_KEY = "llm-wiki-dashboard-module-collapsed";
function loadModuleCollapsed() {
  try {
    const raw = localStorage.getItem(MODULE_COLLAPSE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}
function isModuleCollapsed(moduleId) {
  return !!loadModuleCollapsed()[moduleId];
}
function setModuleCollapsed(moduleId, collapsed) {
  const state = loadModuleCollapsed();
  if (collapsed)
    state[moduleId] = true;
  else
    delete state[moduleId];
  localStorage.setItem(MODULE_COLLAPSE_KEY, JSON.stringify(state));
}
var LAST_LLM_OUTPUT_KEY = "llm-wiki-dashboard-last-output";
function loadLastLlmOutput() {
  try {
    const raw = localStorage.getItem(LAST_LLM_OUTPUT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}
function formatRemoteType(remoteType) {
  var _a;
  if (!remoteType)
    return "\u672A\u77E5";
  const map = {
    onedrive: "OneDrive",
    dropbox: "Dropbox",
    webdav: "WebDAV",
    s3: "S3",
    googledrive: "Google Drive",
    box: "Box",
    pcloud: "pCloud",
    yandexdisk: "Yandex Disk",
    koofr: "Koofr",
    azureblobstorage: "Azure Blob"
  };
  const key = remoteType.toLowerCase().replace(/[^a-z0-9]/g, "");
  return (_a = map[key]) != null ? _a : remoteType;
}

// src/modules/header/HeaderComponent.ts
var import_obsidian8 = require("obsidian");

// src/shared/BaseComponent.ts
var BaseComponent = class {
  constructor(app, settings) {
    this.containerEl = null;
    this.lastHash = "";
    this.app = app;
    this.settings = settings;
  }
  /** Incremental update. Called when data may have changed.
   *  Default no-op — override in components that support incrementality. */
  async update(_data) {
  }
  updateSettings(settings) {
    this.settings = settings;
  }
  /** Clean up any timers, listeners, etc. */
  destroy() {
    this.containerEl = null;
  }
  /** Compute a stable hash of data to detect changes.
   *  Subclasses call this in update() to skip re-rendering when data is unchanged. */
  dataHash(data) {
    try {
      return JSON.stringify(data).slice(0, 2e3);
    } catch (e) {
      return "";
    }
  }
  hasChanged(data) {
    const hash = this.dataHash(data);
    if (hash === this.lastHash && this.lastHash !== "")
      return false;
    this.lastHash = hash;
    return true;
  }
};

// src/modules/header/ModelConfigModal.ts
var import_obsidian7 = require("obsidian");
var ModelConfigModal = class extends import_obsidian7.Modal {
  constructor(app, settings, onSave) {
    super(app);
    this.statusEl = null;
    this.modelSelect = null;
    this.settings = { ...settings };
    this.onSave = onSave;
    this.llmService = new LLMService(this.app, this.settings);
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("dashboard-modal");
    contentEl.createEl("h2", { text: "\u8BBE\u7F6E" });
    contentEl.createEl("h3", { text: "\u6807\u7B7E\u8BBE\u7F6E" });
    this.createTextField(contentEl, "\u6807\u7B7E\u9875\u6807\u9898", "dashboardTitle", "text", "Dashboard");
    this.createTextField(contentEl, "\u6807\u7B7E\u9875\u63CF\u8FF0", "dashboardDesc", "text", "\u79B9\u601D\u5929\u4E0B\u6709\u6EBA\u8005\uFF0C\u7531\u5DF1\u6EBA\u4E4B\u4E5F");
    contentEl.createEl("h3", { text: "\u6A21\u578B\u914D\u7F6E" });
    this.createTextField(contentEl, "API Base URL", "apiBaseUrl", "text", "https://api.openai.com/v1");
    this.createTextField(contentEl, "API Key", "apiKey", "password", "sk-...");
    this.createModelField(contentEl);
    this.createNumberField(contentEl, "Temperature", "temperature", 0, 2, 0.1);
    this.createNumberField(contentEl, "Max Tokens", "maxTokens", 256, 32768, 1);
    this.createTextField(contentEl, "\u7528\u91CF\u63A5\u53E3\u5730\u5740\uFF08\u9009\u586B\uFF0C\u672A\u586B\u5219\u7528\u672C\u5730\u7EDF\u8BA1\uFF09", "tokenUsageApiUrl", "text", "https://...");
    this.createTextField(contentEl, "\u4F59\u989D\u63A5\u53E3\u5730\u5740\uFF08\u9009\u586B\uFF0C\u5982 DeepSeek: https://api.deepseek.com/user/balance\uFF09", "tokenBalanceApiUrl", "text", "https://...", "https://api.deepseek.com/user/balance");
    const actionsRow = contentEl.createDiv("dashboard-modal-actions");
    const testBtn = actionsRow.createEl("button", { text: "\u6D4B\u8BD5\u8FDE\u63A5", cls: "mod-cta" });
    this.statusEl = actionsRow.createDiv("dashboard-connection-status");
    testBtn.addEventListener("click", async () => {
      testBtn.disabled = true;
      testBtn.textContent = "\u8FDE\u63A5\u4E2D...";
      if (this.statusEl)
        this.statusEl.textContent = "";
      try {
        this.llmService.updateSettings(this.settings);
        const models = await this.fetchModels();
        if (models.length > 0) {
          this.populateModelSelect(models);
          this.statusEl.textContent = `\u2705 \u8FDE\u63A5\u6B63\u5E38\uFF0C\u83B7\u53D6\u5230 ${models.length} \u4E2A\u6A21\u578B`;
          this.statusEl.className = "dashboard-connection-status ok";
        } else {
          this.statusEl.textContent = "\u2705 \u8FDE\u63A5\u6B63\u5E38";
          this.statusEl.className = "dashboard-connection-status ok";
        }
        this.settings.lastConnectionStatus = "ok";
        this.settings.lastConnectionTime = (/* @__PURE__ */ new Date()).toLocaleTimeString();
      } catch (e) {
        this.statusEl.textContent = `\u274C ${e.message}`;
        this.statusEl.className = "dashboard-connection-status error";
        this.settings.lastConnectionStatus = "error";
      } finally {
        testBtn.disabled = false;
        testBtn.textContent = "\u6D4B\u8BD5\u8FDE\u63A5";
      }
    });
    const saveBtn = contentEl.createEl("button", { text: "\u4FDD\u5B58", cls: "mod-cta" });
    saveBtn.addEventListener("click", () => {
      this.onSave(this.settings);
      this.close();
      new import_obsidian7.Notice("\u6A21\u578B\u914D\u7F6E\u5DF2\u4FDD\u5B58");
    });
    const btnRow = contentEl.createDiv("dashboard-modal-actions");
    btnRow.style.cssText = "justify-content:flex-end;";
    btnRow.createEl("button", { text: "\u53D6\u6D88" }).addEventListener("click", () => this.close());
    btnRow.appendChild(saveBtn);
  }
  createModelField(parent) {
    const row = parent.createDiv("dashboard-field");
    row.createEl("label", { text: "\u6A21\u578B\u540D\u79F0" });
    const wrap = row.createDiv("dashboard-model-select-wrap");
    this.modelSelect = wrap.createEl("select", { cls: "dashboard-model-select" });
    const defaultOpt = this.modelSelect.createEl("option", {
      value: this.settings.modelName,
      text: this.settings.modelName
    });
    defaultOpt.selected = true;
    this.modelSelect.addEventListener("change", () => {
      this.settings.modelName = this.modelSelect.value;
    });
    const hint = wrap.createDiv({ text: "\u70B9\u51FB\u300C\u6D4B\u8BD5\u8FDE\u63A5\u300D\u81EA\u52A8\u83B7\u53D6\u53EF\u7528\u6A21\u578B\u5217\u8868", cls: "dashboard-field-hint" });
  }
  populateModelSelect(models) {
    var _a;
    if (!this.modelSelect)
      return;
    const current = this.settings.modelName;
    this.modelSelect.empty();
    for (const m of models) {
      const opt = this.modelSelect.createEl("option", { value: m, text: m });
      if (m === current)
        opt.selected = true;
    }
    if (!models.includes(current) && models.length > 0) {
      this.modelSelect.options[0].selected = true;
      this.settings.modelName = models[0];
    } else {
      this.settings.modelName = this.modelSelect.value;
    }
    const hint = (_a = this.modelSelect.parentElement) == null ? void 0 : _a.querySelector(".dashboard-field-hint");
    if (hint)
      hint.textContent = `\u5171 ${models.length} \u4E2A\u53EF\u7528\u6A21\u578B`;
  }
  async fetchModels() {
    var _a;
    const resp = await (0, import_obsidian7.requestUrl)({
      url: `${this.settings.apiBaseUrl}/models`,
      method: "GET",
      headers: { Authorization: `Bearer ${this.settings.apiKey}` },
      throw: false
    });
    if (resp.status === 401)
      throw new Error("401: API Key \u65E0\u6548");
    if (resp.status === 404)
      throw new Error("404: Base URL \u4E0D\u6B63\u786E\uFF0CDeepSeek \u8BF7\u586B https://api.deepseek.com/v1\uFF0COpenAI \u8BF7\u586B https://api.openai.com/v1");
    if (resp.status >= 400)
      throw new Error(`\u8FDE\u63A5\u5931\u8D25 (${resp.status})`);
    const data = resp.json;
    const items = (_a = data == null ? void 0 : data.data) != null ? _a : [];
    return items.map((m) => m.id).filter(Boolean).sort();
  }
  createTextField(parent, label, key, type, placeholder, example) {
    var _a;
    const row = parent.createDiv("dashboard-field");
    row.createEl("label", { text: label });
    const inputWrap = row.createDiv("dashboard-input-wrap");
    const input = inputWrap.createEl("input");
    input.type = type;
    input.placeholder = placeholder;
    input.value = String((_a = this.settings[key]) != null ? _a : "");
    input.addEventListener("input", () => {
      this.settings[key] = input.value;
    });
    const exampleVal = example || (placeholder && placeholder !== "https://..." && placeholder !== "sk-..." ? placeholder : "");
    if (exampleVal) {
      const hint = inputWrap.createEl("span", { cls: "dashboard-example-hint", text: "\u{1F4CB}", attr: { "data-tooltip": exampleVal } });
      hint.addEventListener("click", () => {
        input.value = exampleVal;
        input.dispatchEvent(new Event("input"));
      });
    }
    return row;
  }
  createNumberField(parent, label, key, min, max, step, example) {
    var _a;
    const row = parent.createDiv("dashboard-field");
    row.createEl("label", { text: label });
    const inputWrap = row.createDiv("dashboard-input-wrap");
    const input = inputWrap.createEl("input");
    input.type = "number";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String((_a = this.settings[key]) != null ? _a : "");
    input.addEventListener("input", () => {
      this.settings[key] = parseFloat(input.value);
    });
    if (example !== void 0) {
      const hint = inputWrap.createEl("span", { cls: "dashboard-example-hint", text: "\u{1F4CB}", attr: { "data-tooltip": String(example) } });
      hint.addEventListener("click", () => {
        input.value = String(example);
        input.dispatchEvent(new Event("input"));
      });
    }
    return row;
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/utils/lunar.ts
function getLunarInfo(date) {
  const ganzhi = getGanzhiYear(date);
  const zodiac = getZodiac(date);
  const [lm, ld] = getLunarDate(date);
  return {
    ganzhiYear: ganzhi,
    zodiac,
    lunarMonth: lm,
    lunarDay: ld,
    shichen: getShichen(date.getHours())
  };
}
var HEAVENLY_STEMS = ["\u7532", "\u4E59", "\u4E19", "\u4E01", "\u620A", "\u5DF1", "\u5E9A", "\u8F9B", "\u58EC", "\u7678"];
var EARTHLY_BRANCHES = ["\u5B50", "\u4E11", "\u5BC5", "\u536F", "\u8FB0", "\u5DF3", "\u5348", "\u672A", "\u7533", "\u9149", "\u620C", "\u4EA5"];
var ZODIAC = ["\u9F20", "\u725B", "\u864E", "\u5154", "\u9F99", "\u86C7", "\u9A6C", "\u7F8A", "\u7334", "\u9E21", "\u72D7", "\u732A"];
function getGanzhiYear(date) {
  const year = getLunarYear(date);
  const idx = (year - 4) % 60;
  const stem = HEAVENLY_STEMS[idx % 10];
  const branch = EARTHLY_BRANCHES[idx % 12];
  return stem + branch;
}
function getZodiac(date) {
  const year = getLunarYear(date);
  return ZODIAC[(year - 4) % 12];
}
function getShichen(hour) {
  const idx = Math.floor((hour + 1) % 24 / 2);
  return EARTHLY_BRANCHES[idx] + "\u65F6";
}
var CN_NUM = ["\u96F6", "\u4E00", "\u4E8C", "\u4E09", "\u56DB", "\u4E94", "\u516D", "\u4E03", "\u516B", "\u4E5D", "\u5341"];
function lunarDayCn(day) {
  if (day === 10)
    return "\u521D\u5341";
  if (day === 20)
    return "\u4E8C\u5341";
  if (day === 30)
    return "\u4E09\u5341";
  const prefix = day < 10 ? "\u521D" : day < 20 ? "\u5341" : day < 30 ? "\u5EFF" : "\u4E09\u5341";
  const rem = day < 10 ? day : day < 20 ? day - 10 : day < 30 ? day - 20 : day - 30;
  if (rem === 0)
    return prefix;
  return prefix + CN_NUM[rem];
}
function lunarMonthCn(month, leap) {
  const names = ["\u6B63", "\u4E8C", "\u4E09", "\u56DB", "\u4E94", "\u516D", "\u4E03", "\u516B", "\u4E5D", "\u5341", "\u51AC", "\u814A"];
  return (leap ? "\u95F0" : "") + names[month - 1] + "\u6708";
}
var LUNAR_INFO = [
  19416,
  19168,
  42352,
  21717,
  53856,
  55632,
  91476,
  22176,
  39632,
  21970,
  19168,
  42422,
  42192,
  53840,
  119381,
  46400,
  54944,
  44450,
  38320,
  84343,
  18800,
  42160,
  46261,
  27216,
  27968,
  109396,
  11104,
  38256,
  21234,
  18800,
  25958,
  54432,
  59984,
  28309,
  23248,
  11104,
  100067,
  37600,
  116951,
  51536,
  54432,
  120998,
  46416,
  22176,
  107956,
  9680,
  37584,
  53938,
  43344,
  46423,
  27808,
  46416,
  86869,
  19872,
  42416,
  83315,
  21168,
  43432,
  59728,
  27296,
  44710,
  43856,
  19296,
  43748,
  42352,
  21088,
  62051,
  55632,
  23383,
  22176,
  38608,
  19925,
  19152,
  42192,
  54484,
  53840,
  54616,
  46400,
  46752,
  103846,
  38320,
  18864,
  43380,
  42160,
  45690,
  27216,
  27968,
  44870,
  43872,
  38256,
  19189,
  18800,
  25776,
  29859,
  59984,
  27480,
  21952,
  43872,
  38613,
  37600,
  51552,
  55636,
  54432,
  55888,
  30034,
  22176,
  43959,
  9680,
  37584,
  51893,
  43344,
  46240,
  47780,
  44368,
  21977,
  19360,
  42416,
  86390,
  21168,
  43312,
  31060,
  27296,
  44368,
  23378,
  19296,
  42726,
  42208,
  53856,
  60005,
  54576,
  23200,
  30371,
  38608,
  19195,
  19152,
  42192,
  118966,
  53840,
  54560,
  56645,
  46496,
  22224,
  21938,
  18864,
  42359,
  42160,
  43600,
  111189,
  27936,
  44448,
  84835,
  37744,
  18936,
  18800,
  25776,
  92326,
  59984,
  27424,
  108228,
  43744,
  41696,
  53987,
  51552,
  54615,
  54432,
  55888,
  23893,
  22176,
  42704,
  21972,
  21200,
  43448,
  43344,
  46240,
  46758,
  44368,
  21920,
  43940,
  42416,
  21168,
  45683,
  26928,
  29495,
  27296,
  44368,
  84821,
  19296,
  42352,
  21732,
  53600,
  59752,
  54560,
  55968,
  92838,
  22224,
  19168,
  43476,
  41680,
  53584,
  62034,
  54560
];
function daysBetween(y1, m1, d1, y2, m2, d2) {
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((t2 - t1) / 864e5);
}
function lunarYearDays(year) {
  let sum = 348;
  const info = LUNAR_INFO[year - 1900];
  for (let i = 32768; i > 8; i >>= 1) {
    sum += info & i ? 1 : 0;
  }
  return sum + leapDays(year);
}
function leapMonth(year) {
  return LUNAR_INFO[year - 1900] & 15;
}
function leapDays(year) {
  if (leapMonth(year) === 0)
    return 0;
  return LUNAR_INFO[year - 1900] & 65536 ? 30 : 29;
}
function monthDays(year, month) {
  return LUNAR_INFO[year - 1900] & 65536 >> month ? 30 : 29;
}
function solarToLunar(date) {
  let offset = daysBetween(1900, 1, 31, date.getFullYear(), date.getMonth() + 1, date.getDate());
  let year = 1900;
  let temp = 0;
  while (year < 2101 && offset > 0) {
    temp = lunarYearDays(year);
    if (offset < temp)
      break;
    offset -= temp;
    year++;
  }
  const leap = leapMonth(year);
  let isLeap = false;
  let month = 1;
  temp = 0;
  while (month < 13 && offset >= 0) {
    if (leap > 0 && month === leap + 1 && !isLeap) {
      month--;
      isLeap = true;
      temp = leapDays(year);
    } else {
      temp = monthDays(year, month);
    }
    if (isLeap && month === leap + 1)
      isLeap = false;
    offset -= temp;
    if (offset < 0) {
      offset += temp;
      break;
    }
    month++;
  }
  const day = offset + 1;
  return { year, month, day, leap: isLeap };
}
function getLunarYear(date) {
  return solarToLunar(date).year;
}
function getLunarDate(date) {
  const { month, day, leap } = solarToLunar(date);
  return [lunarMonthCn(month, leap), lunarDayCn(day)];
}

// src/modules/header/HeaderComponent.ts
var HeaderComponent = class _HeaderComponent extends BaseComponent {
  constructor(app, settings, llmService, onSettingsChange, onRefresh) {
    super(app, settings);
    this.tokenBarEl = null;
    this.clockEl = null;
    this.lunarEl = null;
    this.clockTimer = null;
    this.llmService = llmService;
    this.onSettingsChange = onSettingsChange;
    this.onRefresh = onRefresh;
  }
  get id() {
    return "header";
  }
  async render(container) {
    const header = container.createDiv("dashboard-header");
    const titleRow = header.createDiv("dashboard-header-title-row");
    titleRow.createEl("h2", { text: this.settings.dashboardTitle || "Dashboard", cls: "dashboard-title" });
    const actions = titleRow.createDiv("dashboard-header-actions");
    if (this.settings.dashboardDesc) {
      header.createDiv({ text: this.settings.dashboardDesc, cls: "dashboard-desc" });
    }
    const refreshBtn = actions.createEl("button", { cls: "dashboard-icon-btn", title: "\u5237\u65B0" });
    refreshBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`;
    refreshBtn.addEventListener("click", () => this.onRefresh());
    const cfgBtn = actions.createEl("button", { cls: "dashboard-icon-btn", title: "\u6A21\u578B\u914D\u7F6E" });
    cfgBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
    cfgBtn.addEventListener("click", () => {
      new ModelConfigModal(this.app, this.settings, async (s) => {
        await this.onSettingsChange(s);
      }).open();
    });
    const metaRow = header.createDiv("dashboard-header-meta");
    metaRow.createEl("span", { text: `\u6700\u540E\u5237\u65B0: ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}`, cls: "dashboard-refresh-time" });
    const obsVersion = _HeaderComponent.getObsidianVersion(this.app);
    if (obsVersion) {
      metaRow.createEl("span", { text: `Obsidian v${obsVersion}`, cls: "dashboard-version-label" });
    }
    this.clockEl = metaRow.createEl("span", {
      text: _HeaderComponent.fmtClock(/* @__PURE__ */ new Date()),
      cls: "dashboard-clock"
    });
    this.lunarEl = metaRow.createEl("span", {
      text: _HeaderComponent.fmtLunar(/* @__PURE__ */ new Date()),
      cls: "dashboard-lunar"
    });
    this.startClock();
    this.renderTokenBar(header);
  }
  startClock() {
    if (this.clockTimer !== null)
      window.clearInterval(this.clockTimer);
    let lastLunarKey = "";
    this.clockTimer = window.setInterval(() => {
      if (!this.clockEl || !this.clockEl.isConnected) {
        if (this.clockTimer !== null) {
          window.clearInterval(this.clockTimer);
          this.clockTimer = null;
        }
        return;
      }
      const now = /* @__PURE__ */ new Date();
      this.clockEl.textContent = _HeaderComponent.fmtClock(now);
      const key = `${now.toDateString()}#${now.getHours()}`;
      if (this.lunarEl && key !== lastLunarKey) {
        this.lunarEl.textContent = _HeaderComponent.fmtLunar(now);
        lastLunarKey = key;
      }
    }, 1e3);
  }
  destroy() {
    if (this.clockTimer !== null) {
      window.clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
    this.clockEl = null;
    this.lunarEl = null;
    super.destroy();
  }
  static fmtLunar(d) {
    const info = getLunarInfo(d);
    return `${info.ganzhiYear}${info.zodiac}\u5E74\xB7\u519C\u5386${info.lunarMonth}${info.lunarDay}\xB7${info.shichen}`;
  }
  static fmtClock(d) {
    const pad = (n) => String(n).padStart(2, "0");
    const y = d.getFullYear();
    const m = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const w = ["\u65E5", "\u4E00", "\u4E8C", "\u4E09", "\u56DB", "\u4E94", "\u516D"][d.getDay()];
    return `${y}-${m}-${day} \u5468${w} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  renderTokenBar(header) {
    var _a;
    const bar = header.createDiv("dashboard-header-token");
    this.tokenBarEl = bar;
    let today = 0, thisMonth = 0;
    try {
      const store = this.loadLocalTokenStore();
      const todayStr = _HeaderComponent.fmtDate(/* @__PURE__ */ new Date());
      const monthPrefix = todayStr.slice(0, 7);
      today = (_a = store[todayStr]) != null ? _a : 0;
      for (const [date, tokens] of Object.entries(store)) {
        if (date.startsWith(monthPrefix))
          thisMonth += tokens;
      }
    } catch (e) {
    }
    const makeChip = (label, value) => {
      const chip = bar.createDiv("dashboard-token-chip");
      chip.createEl("span", { text: label, cls: "dashboard-token-chip-label" });
      chip.createEl("span", { text: value, cls: "dashboard-token-chip-value" });
    };
    makeChip("\u4ECA\u65E5", `${today.toLocaleString()} tokens`);
    makeChip("\u672C\u6708", `${thisMonth.toLocaleString()} tokens`);
    if (this.settings.tokenBalanceApiUrl && this.settings.apiKey) {
      (async () => {
        var _a2;
        try {
          const resp = await (0, import_obsidian8.requestUrl)({
            url: this.settings.tokenBalanceApiUrl,
            method: "GET",
            headers: { Authorization: `Bearer ${this.settings.apiKey}` },
            throw: false
          });
          if (resp.status === 200 && ((_a2 = resp.json) == null ? void 0 : _a2.balance_infos)) {
            for (const item of resp.json.balance_infos) {
              makeChip(`\u4F59\u989D(${item.currency})`, item.total_balance);
            }
          }
        } catch (e) {
        }
      })();
    }
  }
  async refreshTokenBar() {
    var _a;
    const bar = this.tokenBarEl;
    if (!bar || !bar.isConnected)
      return;
    let today = 0, thisMonth = 0;
    try {
      const store = this.loadLocalTokenStore();
      const todayStr = _HeaderComponent.fmtDate(/* @__PURE__ */ new Date());
      const monthPrefix = todayStr.slice(0, 7);
      today = (_a = store[todayStr]) != null ? _a : 0;
      for (const [date, tokens] of Object.entries(store)) {
        if (date.startsWith(monthPrefix))
          thisMonth += tokens;
      }
    } catch (e) {
    }
    const chips = bar.querySelectorAll(".dashboard-token-chip-value");
    if (chips.length >= 2) {
      chips[0].textContent = `${today.toLocaleString()} tokens`;
      chips[1].textContent = `${thisMonth.toLocaleString()} tokens`;
    }
  }
  loadLocalTokenStore() {
    try {
      const raw = localStorage.getItem("llm-wiki-dashboard-token-usage");
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }
  static fmtDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  static getObsidianVersion(app) {
    var _a, _b;
    try {
      const a = app;
      if (typeof a.version === "string")
        return a.version;
      if (typeof a.appVersion === "string")
        return a.appVersion;
      const ua = navigator.userAgent;
      const m = ua.match(/[Oo]bsidian\/([\d.]+)/);
      if (m)
        return m[1];
      const w = window;
      if ((_b = (_a = w.electronRemote) == null ? void 0 : _a.app) == null ? void 0 : _b.getVersion)
        return w.electronRemote.app.getVersion();
      return "";
    } catch (e) {
      return "";
    }
  }
};

// src/modules/search/SearchComponent.ts
var import_obsidian9 = require("obsidian");
var SearchComponent = class extends BaseComponent {
  constructor() {
    super(...arguments);
    this.index = [];
    this.indexDirty = true;
    this.searchInput = null;
    this.resultDropdown = null;
    this.blurTimer = null;
    this.vaultHandler = null;
  }
  get id() {
    return "search";
  }
  async render(container) {
    const searchWrap = container.createDiv("dashboard-search-wrap");
    this.searchInput = searchWrap.createEl("input", {
      cls: "dashboard-search-input",
      placeholder: "\u641C\u7D22\u7B14\u8BB0 (\u652F\u6301\u6807\u7B7E#\u3001\u6807\u9898\u3001\u522B\u540D)..."
    });
    this.resultDropdown = searchWrap.createDiv("dashboard-search-dropdown");
    this.resultDropdown.style.display = "none";
    this.ensureVaultListeners();
    this.ensureIndex();
    this.searchInput.addEventListener("input", () => this.doSearch());
    this.searchInput.addEventListener("focus", () => {
      this.ensureIndex();
      this.doSearch();
    });
    this.searchInput.addEventListener("blur", () => {
      this.blurTimer = setTimeout(() => {
        if (this.resultDropdown)
          this.resultDropdown.style.display = "none";
      }, 200);
    });
    this.searchInput.addEventListener("keydown", (e) => {
      var _a, _b;
      if (e.key === "Escape") {
        if (this.resultDropdown)
          this.resultDropdown.style.display = "none";
        (_a = this.searchInput) == null ? void 0 : _a.blur();
      } else if (e.key === "Enter") {
        const firstItem = (_b = this.resultDropdown) == null ? void 0 : _b.querySelector(".dashboard-search-item");
        if (firstItem)
          firstItem.click();
      }
    });
  }
  async update(_data) {
    this.indexDirty = true;
  }
  destroy() {
    if (this.vaultHandler) {
      this.app.vault.off("create", this.vaultHandler);
      this.app.vault.off("delete", this.vaultHandler);
      this.app.vault.off("rename", this.vaultHandler);
      this.app.metadataCache.off("changed", this.vaultHandler);
      this.vaultHandler = null;
    }
    if (this.blurTimer) {
      clearTimeout(this.blurTimer);
      this.blurTimer = null;
    }
    super.destroy();
  }
  ensureVaultListeners() {
    if (this.vaultHandler)
      return;
    this.vaultHandler = () => {
      this.indexDirty = true;
    };
    this.app.vault.on("create", this.vaultHandler);
    this.app.vault.on("delete", this.vaultHandler);
    this.app.vault.on("rename", this.vaultHandler);
    this.app.metadataCache.on("changed", this.vaultHandler);
  }
  ensureIndex() {
    if (!this.indexDirty)
      return;
    this.buildIndex();
    this.indexDirty = false;
  }
  buildIndex() {
    var _a;
    this.index = [];
    const files = this.app.vault.getFiles().filter((f) => f.extension === "md");
    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      const frontmatter = cache == null ? void 0 : cache.frontmatter;
      const title = (_a = frontmatter == null ? void 0 : frontmatter.title) != null ? _a : "";
      const aliases = [];
      if (frontmatter == null ? void 0 : frontmatter.aliases) {
        if (Array.isArray(frontmatter.aliases))
          aliases.push(...frontmatter.aliases.map(String));
        else
          aliases.push(String(frontmatter.aliases));
      }
      const tags = [];
      if (frontmatter == null ? void 0 : frontmatter.tags) {
        const rawTags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [frontmatter.tags];
        for (const t of rawTags) {
          const s = String(t).replace(/^#/, "");
          tags.push(s);
        }
      }
      if (cache == null ? void 0 : cache.tags) {
        for (const t of cache.tags) {
          const s = t.tag.replace(/^#/, "");
          if (!tags.includes(s))
            tags.push(s);
        }
      }
      const searchText = [file.basename, title, ...aliases, ...tags].join(" ").toLowerCase();
      this.index.push({
        path: file.path,
        basename: file.basename,
        title,
        aliases,
        tags,
        searchText
      });
    }
  }
  fuzzyMatch(text, query) {
    const t = text.toLowerCase();
    const q = query.toLowerCase();
    let qi = 0;
    for (let pi = 0; pi < t.length && qi < q.length; pi++) {
      if (t[pi] === q[qi])
        qi++;
    }
    return qi === q.length;
  }
  doSearch() {
    const q = this.searchInput.value.trim();
    if (this.blurTimer) {
      clearTimeout(this.blurTimer);
      this.blurTimer = null;
    }
    if (!this.resultDropdown)
      return;
    if (!q) {
      this.resultDropdown.empty();
      this.resultDropdown.style.display = "none";
      return;
    }
    const isTagSearch = q.startsWith("#");
    const query = isTagSearch ? q.slice(1) : q;
    const lowerQuery = query.toLowerCase();
    const scored = [];
    for (const entry of this.index) {
      let bestScore = 0;
      let matchType = "fuzzy";
      if (isTagSearch) {
        const exactTag = entry.tags.some((t) => t.toLowerCase() === lowerQuery);
        const partialTag = entry.tags.some((t) => t.toLowerCase().includes(lowerQuery));
        if (exactTag) {
          bestScore = 50;
          matchType = "tag";
        } else if (partialTag) {
          bestScore = 40;
          matchType = "tag";
        }
      }
      if (entry.basename.toLowerCase() === lowerQuery) {
        bestScore = Math.max(bestScore, 60);
        matchType = "filename";
      } else if (entry.basename.toLowerCase().startsWith(lowerQuery)) {
        bestScore = Math.max(bestScore, 55);
        matchType = "filename";
      } else if (this.fuzzyMatch(entry.basename, query)) {
        bestScore = Math.max(bestScore, 35);
        matchType = "fuzzy";
      }
      if (entry.title && entry.title.toLowerCase() === lowerQuery) {
        bestScore = Math.max(bestScore, 45);
        matchType = "title";
      } else if (entry.title && entry.title.toLowerCase().includes(lowerQuery)) {
        bestScore = Math.max(bestScore, 30);
        matchType = "title";
      }
      for (const alias of entry.aliases) {
        if (alias.toLowerCase() === lowerQuery) {
          bestScore = Math.max(bestScore, 42);
          matchType = "alias";
        } else if (alias.toLowerCase().includes(lowerQuery)) {
          bestScore = Math.max(bestScore, 28);
          matchType = "alias";
        }
      }
      if (!isTagSearch && this.fuzzyMatch(entry.searchText, query) && bestScore === 0) {
        bestScore = 10;
        matchType = "fuzzy";
      }
      if (bestScore > 0)
        scored.push({ entry, score: bestScore, matchType });
    }
    scored.sort((a, b) => b.score - a.score);
    const results = scored.slice(0, 10);
    this.resultDropdown.empty();
    if (results.length === 0) {
      this.resultDropdown.style.display = "none";
      return;
    }
    for (const { entry, matchType } of results) {
      const item = this.resultDropdown.createDiv("dashboard-search-item");
      const nameEl = item.createEl("span", { text: entry.basename, cls: "dashboard-search-item-name" });
      item.createEl("span", { text: entry.path, cls: "dashboard-search-item-path" });
      const typeLabels = {
        filename: "\u6587\u4EF6",
        title: "\u6807\u9898",
        alias: "\u522B\u540D",
        tag: "\u6807\u7B7E",
        fuzzy: "\u5339\u914D"
      };
      const typeBadge = item.createEl("span", {
        text: typeLabels[matchType],
        cls: `dashboard-search-result-type dashboard-search-type-${matchType}`
      });
      item.addEventListener("mousedown", async (e) => {
        e.preventDefault();
        if (this.resultDropdown)
          this.resultDropdown.style.display = "none";
        if (this.searchInput)
          this.searchInput.value = "";
        const f = this.app.vault.getAbstractFileByPath(entry.path);
        if (f instanceof import_obsidian9.TFile)
          await this.app.workspace.getLeaf(false).openFile(f);
      });
    }
    this.resultDropdown.style.display = "block";
  }
};

// src/modules/workspace-bar/WorkspaceBarComponent.ts
var import_obsidian10 = require("obsidian");
var WorkspaceBarComponent = class extends BaseComponent {
  constructor(app, settings, fileService, reportService) {
    super(app, settings);
    this.fileService = fileService;
    this.reportService = reportService;
  }
  get id() {
    return "workspace-bar";
  }
  updateSettings(settings) {
    super.updateSettings(settings);
    this.reportService.updateSettings(settings);
  }
  async render(container) {
    var _a, _b;
    const bar = container.createDiv("dashboard-workspace-bar");
    const section = (label) => {
      const block = bar.createDiv("dashboard-workspace-section");
      block.createEl("span", { text: label, cls: "dashboard-workspace-label" });
      return block.createDiv("dashboard-workspace-items");
    };
    const reportItems = section("\u4ECA\u65E5");
    const dailyCfg = this.settings.reportConfigs.daily;
    if (dailyCfg.enabled) {
      const today = /* @__PURE__ */ new Date();
      const path = this.reportService.resolveReportPath("daily", today);
      const exists = this.app.vault.getAbstractFileByPath(path) instanceof import_obsidian10.TFile;
      const btn = reportItems.createEl("button", {
        text: exists ? "\u{1F4D3} \u6253\u5F00\u65E5\u62A5" : "\u{1F4D3} \u65B0\u5EFA\u65E5\u62A5",
        cls: "dashboard-workspace-chip"
      });
      btn.addEventListener("click", () => this.reportService.openOrCreateReport("daily", today));
    } else {
      reportItems.createEl("span", { text: "\u65E5\u62A5\u672A\u542F\u7528", cls: "dashboard-workspace-muted" });
    }
    const recentItems = section("\u6700\u8FD1\u4FEE\u6539");
    const recent = this.fileService.getRecentlyModified(3);
    if (recent.length === 0) {
      recentItems.createEl("span", { text: "\u65E0", cls: "dashboard-workspace-muted" });
    } else {
      for (const rf of recent) {
        const chip = recentItems.createEl("button", {
          cls: "dashboard-workspace-chip",
          title: rf.path
        });
        const name2 = (_a = rf.path.split("/").pop()) != null ? _a : rf.path;
        chip.createEl("span", { text: name2, cls: "dashboard-workspace-chip-name" });
        chip.createEl("span", { text: formatRelativeTime(rf.mtime), cls: "dashboard-workspace-chip-time" });
        chip.addEventListener("click", () => this.fileService.openFile(rf.path));
      }
    }
    const llmItems = section("\u4E0A\u6B21 LLM \u8F93\u51FA");
    const lastStored = loadLastLlmOutput();
    const storedRecent = (lastStored == null ? void 0 : lastStored.path) && this.app.vault.getAbstractFileByPath(lastStored.path) instanceof import_obsidian10.TFile ? { path: lastStored.path, mtime: lastStored.time } : null;
    const latestOutput = storedRecent != null ? storedRecent : this.fileService.getLatestInFolder("outputs");
    if (!latestOutput) {
      llmItems.createEl("span", { text: "\u6682\u65E0 outputs \u6587\u4EF6", cls: "dashboard-workspace-muted" });
    } else {
      const chip = llmItems.createEl("button", { cls: "dashboard-workspace-chip", title: latestOutput.path });
      chip.createEl("span", {
        text: (_b = latestOutput.path.split("/").pop()) != null ? _b : latestOutput.path,
        cls: "dashboard-workspace-chip-name"
      });
      chip.createEl("span", {
        text: formatRelativeTime(latestOutput.mtime),
        cls: "dashboard-workspace-chip-time"
      });
      chip.addEventListener("click", () => this.fileService.openFile(latestOutput.path));
    }
  }
};

// src/modules/file-stats/FileStatsComponent.ts
var import_obsidian12 = require("obsidian");

// src/modules/file-stats/FolderConfigModal.ts
var import_obsidian11 = require("obsidian");
var FolderConfigModal = class extends import_obsidian11.Modal {
  constructor(app, settings, fileService, onSave) {
    super(app);
    this.settings = { ...settings };
    this.fileService = fileService;
    this.onSave = onSave;
    this.selected = new Set(settings.trackedFolders);
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("dashboard-modal");
    contentEl.createEl("h2", { text: "\u7EDF\u8BA1\u6587\u4EF6\u5939\u914D\u7F6E" });
    contentEl.createEl("p", {
      text: "\u9009\u62E9\u9700\u8981\u5355\u72EC\u7EDF\u8BA1\u6570\u91CF\u7684\u6587\u4EF6\u5939\u3002\u672A\u9009\u4E2D\u7684\u6587\u4EF6\u5939\u4ECD\u8BA1\u5165 Vault \u603B\u6570\u3002",
      cls: "dashboard-modal-desc"
    });
    const vaultPaths = this.fileService.getFolderPaths();
    const allPaths = [.../* @__PURE__ */ new Set([...vaultPaths, ...this.settings.trackedFolders])].sort();
    const checkboxWrap = contentEl.createDiv("dashboard-checkbox-grid");
    const existingSet = new Set(vaultPaths);
    for (const path of allPaths) {
      const exists = existingSet.has(path);
      const label = checkboxWrap.createEl("label", { cls: "dashboard-checkbox-label" });
      const cb = label.createEl("input", { type: "checkbox" });
      cb.checked = this.selected.has(path);
      label.appendText(path);
      if (!exists) {
        label.createEl("span", { text: " (\u4E0D\u5B58\u5728)", cls: "dashboard-checkbox-missing" });
      }
      cb.addEventListener("change", () => {
        if (cb.checked)
          this.selected.add(path);
        else
          this.selected.delete(path);
      });
    }
    const actions = contentEl.createDiv("dashboard-modal-actions");
    actions.style.cssText = "justify-content:flex-end;";
    actions.createEl("button", { text: "\u53D6\u6D88" }).addEventListener("click", () => this.close());
    const saveBtn = actions.createEl("button", { text: "\u4FDD\u5B58", cls: "mod-cta" });
    saveBtn.addEventListener("click", () => {
      this.settings.trackedFolders = [...this.selected];
      this.onSave(this.settings);
      this.close();
      new import_obsidian11.Notice("\u6587\u4EF6\u5939\u914D\u7F6E\u5DF2\u4FDD\u5B58");
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/modules/file-stats/FileStatsComponent.ts
function formatSize(bytes) {
  if (bytes >= 1e9)
    return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6)
    return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3)
    return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes} B`;
}
var FileStatsComponent = class extends BaseComponent {
  constructor(app, settings, onSettingsChange) {
    super(app, settings);
    this.statsContainer = null;
    this.recentContainer = null;
    this.fileService = new FileService(app);
    this.onSettingsChange = onSettingsChange;
  }
  get id() {
    return "file-stats";
  }
  async render(container) {
    const mod = container.createDiv("dashboard-module");
    const header = mod.createDiv("dashboard-module-header");
    const fsTitleWrap = header.createDiv("dashboard-module-title-wrap");
    fsTitleWrap.createEl("span", { text: "\u{1F4C1}", cls: "dashboard-module-icon" });
    fsTitleWrap.createEl("span", { text: "\u6587\u4EF6\u7EDF\u8BA1", cls: "dashboard-module-title" });
    const totalSize = this.app.vault.getFiles().reduce((sum, f) => sum + f.stat.size, 0);
    fsTitleWrap.createEl("span", { text: `\u5171 ${formatSize(totalSize)}`, cls: "dashboard-module-badge" });
    const addBtn = header.createEl("button", { cls: "dashboard-icon-btn", title: "\u589E\u52A0\u6587\u4EF6\u7EDF\u8BA1" });
    addBtn.style.marginLeft = "auto";
    addBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
    addBtn.addEventListener("click", () => {
      new FolderConfigModal(this.app, this.settings, this.fileService, async (s) => {
        await this.onSettingsChange(s);
      }).open();
    });
    const body = mod.createDiv("dashboard-module-body");
    this.statsContainer = body.createDiv();
    await this.renderFileStats(this.statsContainer);
    this.recentContainer = body.createDiv({ cls: "dashboard-recent-section" });
    this.renderRecentFiles(this.recentContainer);
  }
  async refreshExternal() {
    if (this.statsContainer && this.statsContainer.isConnected) {
      await this.renderFileStats(this.statsContainer);
    }
    if (this.recentContainer && this.recentContainer.isConnected) {
      this.renderRecentFiles(this.recentContainer);
    }
  }
  async renderFileStats(container) {
    container.empty();
    let stats;
    try {
      stats = await this.fileService.getStats(this.settings.trackedFolders);
    } catch (e) {
      container.createDiv({ text: "\u52A0\u8F7D\u5931\u8D25", cls: "dashboard-error" });
      return;
    }
    const totalRow = container.createDiv("dashboard-stat-total");
    totalRow.createEl("span", { text: "Vault \u603B\u6587\u4EF6" });
    totalRow.createEl("strong", { text: String(stats.total) });
    if (stats.folderStats.length > 0) {
      const maxCount = Math.max(...stats.folderStats.map((f) => f.count), 1);
      const list = container.createDiv("dashboard-folder-list");
      for (const fs of stats.folderStats) {
        const row = list.createDiv("dashboard-folder-row");
        const nameEl = row.createEl("span", { text: fs.name, cls: "dashboard-folder-row-name", title: fs.name });
        nameEl.addEventListener("click", () => {
          this.fileService.toggleFolderInExplorer(fs.name);
        });
        const barWrap = row.createDiv("dashboard-folder-row-bar-wrap");
        barWrap.createDiv("dashboard-folder-row-bar-fill").style.width = `${Math.round(fs.count / maxCount * 100)}%`;
        row.createEl("span", { text: String(fs.count), cls: "dashboard-folder-row-count" });
      }
    }
    const anomaly = container.createDiv("dashboard-anomaly-row");
    this.createBadge(anomaly, `\u26A0 \u5B64\u7ACB ${stats.orphanCount}`, stats.orphanCount > 0 ? "warn" : "ok", `\u5B64\u7ACB\u9875\u9762\uFF08${stats.orphanCount}\uFF09`, stats.orphanFiles);
    this.createBadge(anomaly, `\u26A0 \u65E0\u6765\u6E90 ${stats.nosourceCount}`, stats.nosourceCount > 0 ? "warn" : "", `\u65E0\u6765\u6E90\u9875\u9762\uFF08${stats.nosourceCount}\uFF09`, stats.nosourceFiles);
    this.createBadge(anomaly, `\u26A0 \u7A7A\u767D ${stats.emptyCount}`, stats.emptyCount > 0 ? "warn" : "", `\u7A7A\u767D\u9875\u9762\uFF08${stats.emptyCount}\uFF09`, stats.emptyFilesList);
    const health = container.createDiv("dashboard-health");
    const healthLabel = health.createDiv("dashboard-health-label");
    healthLabel.createEl("span", { text: "\u5065\u5EB7\u5EA6" });
    healthLabel.createEl("strong", { text: `${stats.healthScore}\u5206\uFF08\u5B64\u7ACB\u536040% + \u65E0\u6765\u6E90\u536030% + \u7A7A\u767D\u536030%\uFF09` });
    const healthTrack = health.createDiv("dashboard-health-track");
    const healthFill = healthTrack.createDiv("dashboard-health-fill");
    healthFill.style.width = `${stats.healthScore}%`;
    healthFill.style.background = stats.healthScore >= 80 ? "var(--color-green)" : stats.healthScore >= 50 ? "var(--color-yellow)" : "var(--color-red)";
  }
  renderRecentFiles(container) {
    container.empty();
    const recentFiles = this.fileService.getRecentlyModified(5);
    if (recentFiles.length === 0)
      return;
    container.createEl("span", { text: "\u6700\u8FD1\u4FEE\u6539", cls: "dashboard-recent-title" });
    const list = container.createDiv("dashboard-recent-list");
    for (const rf of recentFiles) {
      const row = list.createDiv("dashboard-recent-row");
      const nameEl = row.createEl("span", { text: rf.path, cls: "dashboard-recent-path", title: rf.path });
      nameEl.addEventListener("click", () => {
        const f = this.app.vault.getAbstractFileByPath(rf.path);
        if (f instanceof import_obsidian12.TFile)
          this.app.workspace.getLeaf(false).openFile(f);
      });
      row.createEl("span", { text: formatRelativeTime(rf.mtime), cls: "dashboard-recent-time" });
    }
  }
  createBadge(parent, text, level, tooltip, files) {
    const badge = parent.createEl("span", { text, cls: `dashboard-badge dashboard-badge-${level}` });
    if (!files || files.length === 0)
      return;
    attachFileListPopover(badge, files, tooltip != null ? tooltip : text, (filePath) => {
      const f = this.app.vault.getAbstractFileByPath(filePath);
      if (f instanceof import_obsidian12.TFile)
        this.app.workspace.getLeaf(false).openFile(f);
    });
  }
};

// src/modules/heatmap/HeatmapComponent.ts
var import_obsidian14 = require("obsidian");

// src/modules/heatmap/ReportConfigModal.ts
var import_obsidian13 = require("obsidian");
var REPORT_LABELS2 = {
  daily: "\u65E5\u62A5",
  weekly: "\u5468\u62A5",
  monthly: "\u6708\u62A5",
  quarterly: "\u5B63\u62A5",
  yearly: "\u5E74\u62A5"
};
var TOKEN_HELP = "\u683C\u5F0F\u4EE4\u724C: YYYY(\u5E74) YY(\u5E74\u540E\u4E24\u4F4D) MM(\u6708\u8865\u96F6) M(\u6708) DD(\u65E5\u8865\u96F6) D(\u65E5) ww(\u5468\u8865\u96F6) w(\u5468) Q(\u5B63\u5EA6) [\u6587\u5B57](\u539F\u6587\u8F93\u51FA)";
var EXAMPLE = {
  daily: "YYYY/MM/YYYY-MM-DD",
  weekly: "YYYY/MM/YYYY-[W]ww",
  monthly: "YYYY/MM/YYYY-MM",
  quarterly: "YYYY/MM/YYYY-[Q]Q",
  yearly: "YYYY/YYYY"
};
var ReportConfigModal = class extends import_obsidian13.Modal {
  constructor(app, configs, onSave) {
    super(app);
    this.onSave = onSave;
    this.mdFiles = [];
    this.folders = [];
    this.configs = JSON.parse(JSON.stringify(configs));
    const files = this.app.vault.getMarkdownFiles();
    this.mdFiles = files.map((f) => ({ path: f.path.replace(/\.md$/, ""), name: f.path })).sort((a, b) => a.name.localeCompare(b.name));
    const dirSet = /* @__PURE__ */ new Set();
    dirSet.add("");
    for (const f of this.app.vault.getAllLoadedFiles()) {
      if (f instanceof import_obsidian13.TFolder)
        dirSet.add(f.path);
    }
    this.folders = [...dirSet].sort();
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("dashboard-modal");
    contentEl.createEl("h2", { text: "\u62A5\u8868\u914D\u7F6E" });
    const activeTab = {};
    let currentType = "daily";
    const tabBar = contentEl.createDiv("dashboard-report-tabs");
    const panel = contentEl.createDiv("dashboard-report-panel");
    const showTab = (type) => {
      currentType = type;
      for (const [t, el] of Object.entries(activeTab)) {
        el.classList.toggle("active", t === type);
      }
      this.renderTabContent(panel, type);
    };
    for (const type of Object.keys(REPORT_LABELS2)) {
      const tab = tabBar.createEl("button", {
        text: REPORT_LABELS2[type],
        cls: "dashboard-report-tab"
      });
      tab.addEventListener("click", () => showTab(type));
      activeTab[type] = tab;
    }
    showTab("daily");
    contentEl.createDiv({ text: TOKEN_HELP, cls: "dashboard-field-hint" });
    const actions = contentEl.createDiv("dashboard-modal-actions");
    actions.style.cssText = "justify-content:flex-end;";
    actions.createEl("button", { text: "\u53D6\u6D88" }).addEventListener("click", () => this.close());
    const saveBtn = actions.createEl("button", { text: "\u4FDD\u5B58", cls: "mod-cta" });
    saveBtn.addEventListener("click", () => {
      this.onSave(this.configs);
      this.close();
      new import_obsidian13.Notice("\u62A5\u8868\u914D\u7F6E\u5DF2\u4FDD\u5B58");
    });
  }
  renderTabContent(panel, type) {
    panel.empty();
    const cfg = this.configs[type];
    this.createToggle(panel, "\u542F\u7528", cfg.enabled, (v) => cfg.enabled = v);
    this.createToggle(panel, "\u65B0\u5EFA\u65F6\u5F39\u7A97\u786E\u8BA4", cfg.confirmBeforeCreate, (v) => cfg.confirmBeforeCreate = v);
    this.createDirectorySelect(panel, cfg);
    this.createFormatField(panel, cfg, type);
    this.createTemplateSelect(panel, cfg);
  }
  createToggle(parent, label, value, onChange) {
    const row = parent.createDiv("dashboard-field");
    row.createEl("label", { text: label });
    const toggle = row.createEl("label", { cls: "dashboard-toggle" });
    const cb = toggle.createEl("input");
    cb.type = "checkbox";
    cb.checked = value;
    cb.addEventListener("change", () => onChange(cb.checked));
    toggle.createEl("span", { cls: "dashboard-toggle-slider" });
  }
  createDirectorySelect(parent, cfg) {
    const row = parent.createDiv("dashboard-field");
    row.createEl("label", { text: "\u5B58\u653E\u76EE\u5F55" });
    const wrap = row.createDiv("dashboard-select-wrap");
    const select = wrap.createEl("select");
    for (const f of this.folders) {
      const label = f || "\uFF08vault \u6839\u76EE\u5F55\uFF09";
      const opt = select.createEl("option", { value: f, text: label });
      if (f === cfg.directory)
        opt.selected = true;
    }
    if (cfg.directory && !this.folders.includes(cfg.directory)) {
      const opt = select.createEl("option", { value: cfg.directory, text: `${cfg.directory}\uFF08\u81EA\u5B9A\u4E49\uFF09` });
      opt.selected = true;
    }
    select.addEventListener("change", () => {
      cfg.directory = select.value;
    });
  }
  createFormatField(parent, cfg, type) {
    const row = parent.createDiv("dashboard-field");
    row.createEl("label", { text: "\u6587\u4EF6\u8DEF\u5F84\u683C\u5F0F" });
    const input = row.createEl("input");
    input.type = "text";
    input.placeholder = EXAMPLE[type];
    input.value = cfg.filenameFormat;
    const preview = row.createDiv("dashboard-format-preview");
    const updatePreview = () => {
      try {
        preview.textContent = `\u793A\u4F8B: ${this.formatMomentDate(/* @__PURE__ */ new Date(), input.value || EXAMPLE[type])}`;
      } catch (e) {
        preview.textContent = "\u793A\u4F8B: \uFF08\u683C\u5F0F\u65E0\u6548\uFF09";
      }
    };
    updatePreview();
    input.addEventListener("input", () => {
      cfg.filenameFormat = input.value.trim();
      updatePreview();
    });
  }
  formatMomentDate(date, format) {
    const y = String(date.getFullYear());
    const m = String(date.getMonth() + 1);
    const d = String(date.getDate());
    const temp = new Date(date.getTime());
    temp.setHours(0, 0, 0, 0);
    temp.setDate(temp.getDate() + 3 - (temp.getDay() + 6) % 7);
    const week1 = new Date(temp.getFullYear(), 0, 4);
    const w = String(1 + Math.round(((temp.getTime() - week1.getTime()) / 864e5 - 3 + (week1.getDay() + 6) % 7) / 7));
    const Q = String(Math.floor(date.getMonth() / 3) + 1);
    let result = format.replace(/\[([^\]]+)\]/g, "$1");
    result = result.replace(/YYYY/g, y).replace(/YY/g, y.slice(2)).replace(/MM/g, m.padStart(2, "0")).replace(/DD/g, d.padStart(2, "0")).replace(/ww/g, w.padStart(2, "0")).replace(/M/g, m).replace(/D/g, d).replace(/w/g, w).replace(/Q/g, Q);
    return result;
  }
  createTemplateSelect(parent, cfg) {
    const row = parent.createDiv("dashboard-field");
    row.createEl("label", { text: "\u6A21\u677F\u6587\u4EF6" });
    const wrap = row.createDiv("dashboard-select-wrap");
    const select = wrap.createEl("select");
    const noneOpt = select.createEl("option", { value: "", text: "\uFF08\u4E0D\u4F7F\u7528\u6A21\u677F\uFF09" });
    if (!cfg.templatePath)
      noneOpt.selected = true;
    for (const f of this.mdFiles) {
      const opt = select.createEl("option", { value: f.path, text: f.path });
      if (f.path === cfg.templatePath)
        opt.selected = true;
    }
    select.addEventListener("change", () => {
      cfg.templatePath = select.value;
    });
  }
  createTextField(parent, label, value, onChange, placeholder) {
    const row = parent.createDiv("dashboard-field");
    row.createEl("label", { text: label });
    const input = row.createEl("input");
    input.type = "text";
    input.placeholder = placeholder;
    input.value = value;
    input.addEventListener("input", () => onChange(input.value));
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/modules/heatmap/HeatmapComponent.ts
var HeatmapComponent = class _HeatmapComponent extends BaseComponent {
  constructor(app, settings, heatmapService, onSettingsChange) {
    super(app, settings);
    this.currentYear = (/* @__PURE__ */ new Date()).getFullYear();
    this.bodyEl = null;
    this.yearLabelEl = null;
    this.nextBtnEl = null;
    // ── Report helpers ──
    this.REPORT_NAMES = {
      daily: "\u65E5\u62A5",
      weekly: "\u5468\u62A5",
      monthly: "\u6708\u62A5",
      quarterly: "\u5B63\u62A5",
      yearly: "\u5E74\u62A5"
    };
    this.heatmapService = heatmapService;
    this.onSettingsChange = onSettingsChange;
  }
  get id() {
    return "heatmap";
  }
  async render(container) {
    const mod = container.createDiv("dashboard-module");
    const header = mod.createDiv("dashboard-module-header");
    const hmTitleWrap = header.createDiv("dashboard-module-title-wrap");
    hmTitleWrap.createEl("span", { text: "\u{1F5D3}", cls: "dashboard-module-icon" });
    hmTitleWrap.createEl("span", { text: "\u5DE5\u4F5C\u70ED\u529B\u56FE", cls: "dashboard-module-title" });
    const yearNav = header.createDiv("dashboard-heatmap-year-nav");
    const prevBtn = yearNav.createEl("span", { text: "\u25C0", cls: "dashboard-heatmap-year-arrow" });
    const yearLabel = yearNav.createEl("span", { text: String(this.currentYear), cls: "dashboard-heatmap-year-label clickable" });
    this.yearLabelEl = yearLabel;
    yearLabel.addEventListener("click", () => {
      if (this.settings.reportConfigs.yearly.enabled) {
        this.openOrCreateReport("yearly", new Date(this.currentYear, 0, 1));
      }
    });
    const nextBtn = yearNav.createEl("span", { text: "\u25B6", cls: "dashboard-heatmap-year-arrow" });
    this.nextBtnEl = nextBtn;
    const cfgBtn = yearNav.createEl("button", { cls: "dashboard-heatmap-config-btn", title: "\u65E5\u62A5/\u5468\u62A5\u914D\u7F6E" });
    cfgBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
    cfgBtn.addEventListener("click", () => {
      new ReportConfigModal(this.app, this.settings.reportConfigs, async (configs) => {
        this.settings.reportConfigs = configs;
        await this.onSettingsChange(this.settings);
      }).open();
    });
    const thisYear = (/* @__PURE__ */ new Date()).getFullYear();
    if (this.currentYear >= thisYear)
      nextBtn.addClass("disabled");
    prevBtn.addEventListener("click", () => {
      this.currentYear--;
      this.refreshYear();
    });
    nextBtn.addEventListener("click", () => {
      if (this.currentYear < thisYear) {
        this.currentYear++;
        this.refreshYear();
      }
    });
    const body = mod.createDiv("dashboard-module-body");
    this.bodyEl = body;
    this.renderBody(body);
  }
  refreshYear() {
    if (this.yearLabelEl)
      this.yearLabelEl.textContent = String(this.currentYear);
    if (this.nextBtnEl) {
      const thisYear = (/* @__PURE__ */ new Date()).getFullYear();
      if (this.currentYear >= thisYear)
        this.nextBtnEl.addClass("disabled");
      else
        this.nextBtnEl.removeClass("disabled");
    }
    if (this.bodyEl && this.bodyEl.isConnected) {
      this.bodyEl.empty();
      this.renderBody(this.bodyEl);
    }
  }
  renderBody(body) {
    var _a;
    const now = /* @__PURE__ */ new Date();
    const todayStr = fmtDate(now);
    const data = this.heatmapService.getDataSync();
    const maxVal = Math.max(...Object.values(data), 1);
    const year = this.currentYear;
    const DAYS = ["Mon", "", "Wed", "", "Fri", "", "Sun"];
    const mainWrap = body.createDiv("dashboard-heatmap-main-wrap");
    const dayCol = mainWrap.createDiv("dashboard-heatmap-days");
    dayCol.createDiv({ cls: "dashboard-heatmap-days-spacer" });
    for (const d of DAYS) {
      dayCol.createDiv({ text: d, cls: "dashboard-heatmap-day-label" });
    }
    const monthsWrap = mainWrap.createDiv("dashboard-heatmap-months-wrap");
    for (let m = 0; m < 12; m++) {
      const monthBlock = monthsWrap.createDiv("dashboard-heatmap-month-block");
      const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthLabel = monthBlock.createDiv({ text: MONTHS[m], cls: "dashboard-heatmap-month-label clickable" });
      monthLabel.addEventListener("click", () => {
        if (this.settings.reportConfigs.monthly.enabled) {
          this.openOrCreateReport("monthly", new Date(year, m, 1));
        }
      });
      const firstDay = new Date(year, m, 1);
      const firstDow = firstDay.getDay();
      const startOffset = firstDow === 0 ? 6 : firstDow - 1;
      const daysInMonth = new Date(year, m + 1, 0).getDate();
      const grid = monthBlock.createDiv("dashboard-heatmap-grid");
      for (let p = 0; p < startOffset; p++) {
        grid.createDiv({ cls: "dashboard-heatmap-cell future" });
      }
      for (let day = 1; day <= daysInMonth; day++) {
        const cellDate = new Date(year, m, day);
        const dateStr = fmtDate(cellDate);
        const val = (_a = data[dateStr]) != null ? _a : 0;
        const intensity = val === 0 ? 0 : Math.ceil(val / maxVal * 4);
        const isToday = dateStr === todayStr;
        const isFuture = cellDate > now;
        const cell = grid.createDiv({
          cls: [
            "dashboard-heatmap-cell",
            `level-${intensity}`,
            isToday ? "today" : "",
            isFuture ? "future" : ""
          ].filter(Boolean).join(" ")
        });
        if (!isFuture) {
          cell.style.cursor = "pointer";
          let tip = null;
          cell.addEventListener("mouseenter", () => {
            const rect = cell.getBoundingClientRect();
            tip = document.body.createDiv("dashboard-heatmap-tip");
            tip.textContent = `${dateStr}: ${val} \u6B21\u64CD\u4F5C`;
            tip.style.top = `${rect.top - 28}px`;
            tip.style.left = `${Math.min(rect.left, window.innerWidth - 160)}px`;
          });
          cell.addEventListener("mouseleave", () => {
            tip == null ? void 0 : tip.remove();
            tip = null;
          });
          cell.addEventListener("click", () => this.openOrCreateReport("daily", cellDate));
        }
      }
    }
    const legendRow = body.createDiv("dashboard-heatmap-legend-row");
    const legend = legendRow.createDiv("dashboard-heatmap-legend");
    legend.createEl("span", { text: "\u5C11", cls: "dashboard-heatmap-legend-label" });
    for (let i = 0; i <= 4; i++) {
      legend.createDiv({ cls: `dashboard-heatmap-cell level-${i} legend-cell` });
    }
    legend.createEl("span", { text: "\u591A", cls: "dashboard-heatmap-legend-label" });
    const isCurrentYear = year === (/* @__PURE__ */ new Date()).getFullYear();
    const statsRow = legendRow.createDiv("dashboard-heatmap-stats");
    if (isCurrentYear) {
      const now2 = /* @__PURE__ */ new Date();
      const startOfWeek = new Date(now2);
      startOfWeek.setDate(now2.getDate() - (now2.getDay() + 6) % 7);
      const startOfMonth = new Date(now2.getFullYear(), now2.getMonth(), 1);
      const startOfYear = new Date(year, 0, 1);
      let weekCount = 0, monthCount = 0, yearCount = 0;
      for (const [d, c] of Object.entries(data)) {
        if (d >= fmtDate(startOfWeek))
          weekCount += c;
        if (d >= fmtDate(startOfMonth))
          monthCount += c;
        if (d >= fmtDate(startOfYear))
          yearCount += c;
      }
      statsRow.createEl("span", { text: `\u672C\u5468 ${weekCount} \u6B21` });
      statsRow.createEl("span", { text: `\u672C\u6708 ${monthCount} \u6B21` });
      statsRow.createEl("span", { text: `\u4ECA\u5E74 ${yearCount} \u6B21` });
    } else {
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year + 1, 0, 1);
      const endOfYearStr = fmtDate(endOfYear);
      let yearCount = 0;
      for (const [d, c] of Object.entries(data)) {
        if (d >= fmtDate(startOfYear) && d < endOfYearStr)
          yearCount += c;
      }
      statsRow.createEl("span", { text: `${year} \u5E74 ${yearCount} \u6B21` });
    }
  }
  resolveReportPath(type, date) {
    const cfg = this.settings.reportConfigs[type];
    const relPath = _HeatmapComponent.formatMomentDate(date, cfg.filenameFormat);
    const dir = cfg.directory.replace(/^\/+|\/+$/g, "");
    return dir ? `${dir}/${relPath}.md` : `${relPath}.md`;
  }
  async openOrCreateReport(type, date) {
    const cfg = this.settings.reportConfigs[type];
    const path = this.resolveReportPath(type, date);
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof import_obsidian14.TFile) {
      await this.app.workspace.getLeaf(false).openFile(file);
      return;
    }
    const doCreate = async () => {
      let content = "";
      if (cfg.templatePath) {
        const tpl = this.app.vault.getAbstractFileByPath(`${cfg.templatePath}.md`);
        if (tpl instanceof import_obsidian14.TFile)
          content = _HeatmapComponent.formatMomentDate(date, await this.app.vault.read(tpl));
      }
      const segs = path.split("/");
      let acc = "";
      for (let i = 0; i < segs.length - 1; i++) {
        acc += (acc ? "/" : "") + segs[i];
        if (!this.app.vault.getAbstractFileByPath(acc)) {
          try {
            await this.app.vault.createFolder(acc);
          } catch (e) {
          }
        }
      }
      const created = await this.app.vault.create(path, content);
      await this.app.workspace.getLeaf(false).openFile(created);
    };
    if (cfg.confirmBeforeCreate) {
      const name2 = this.REPORT_NAMES[type];
      new class extends import_obsidian14.Modal {
        onOpen() {
          this.contentEl.createEl("p", { text: `${name2}\u4E0D\u5B58\u5728\uFF0C\u662F\u5426\u65B0\u5EFA\uFF1F` });
          this.contentEl.createEl("p", { text: path, cls: "dashboard-field-hint" });
          const btns = this.contentEl.createDiv("dashboard-confirm-btns");
          btns.createEl("button", { text: "\u53D6\u6D88" }).addEventListener("click", () => this.close());
          btns.createEl("button", { text: "\u65B0\u5EFA", cls: "mod-cta" }).addEventListener("click", async () => {
            this.close();
            try {
              await doCreate();
            } catch (e) {
              new import_obsidian14.Notice(`\u521B\u5EFA\u5931\u8D25: ${e.message}`);
            }
          });
        }
        onClose() {
          this.contentEl.empty();
        }
      }(this.app).open();
    } else {
      try {
        await doCreate();
      } catch (e) {
        new import_obsidian14.Notice(`\u521B\u5EFA${name}\u5931\u8D25: ${e.message}`);
      }
    }
  }
  static formatMomentDate(date, format) {
    const y = String(date.getFullYear());
    const m = String(date.getMonth() + 1);
    const d = String(date.getDate());
    const temp = new Date(date.getTime());
    temp.setHours(0, 0, 0, 0);
    temp.setDate(temp.getDate() + 3 - (temp.getDay() + 6) % 7);
    const week1 = new Date(temp.getFullYear(), 0, 4);
    const w = String(1 + Math.round(((temp.getTime() - week1.getTime()) / 864e5 - 3 + (week1.getDay() + 6) % 7) / 7));
    const Q = String(Math.floor(date.getMonth() / 3) + 1);
    let result = format.replace(/\[([^\]]+)\]/g, "$1");
    result = result.replace(/YYYY/g, y).replace(/YY/g, y.slice(2)).replace(/MM/g, m.padStart(2, "0")).replace(/DD/g, d.padStart(2, "0")).replace(/ww/g, w.padStart(2, "0")).replace(/M/g, m).replace(/D/g, d).replace(/w/g, w).replace(/Q/g, Q);
    return result;
  }
};

// src/modules/llm-command/LLMCommandComponent.ts
var import_obsidian15 = require("obsidian");
var LLMCommandComponent = class extends BaseComponent {
  constructor(app, settings, llmService, onTokenRefresh) {
    super(app, settings);
    this.executing = false;
    this.abortController = null;
    this.modEl = null;
    this.llmService = llmService;
    this.logService = new LogService(app);
    this.onTokenRefresh = onTokenRefresh;
  }
  get id() {
    return "llm-command";
  }
  /** If currently streaming, adopt existing DOM instead of rebuilding. */
  async render(container) {
    if (this.executing && this.modEl && this.modEl.isConnected) {
      container.appendChild(this.modEl);
      return;
    }
    if (this.executing && this.modEl) {
      container.appendChild(this.modEl);
      return;
    }
    const mod = container.createDiv("dashboard-module");
    this.modEl = mod;
    const llmHeader = mod.createDiv("dashboard-module-header");
    const llmTitleWrap = llmHeader.createDiv("dashboard-module-title-wrap");
    llmTitleWrap.createEl("span", { text: "\u26A1", cls: "dashboard-module-icon" });
    llmTitleWrap.createEl("span", { text: "LLM \u6307\u4EE4\u6267\u884C", cls: "dashboard-module-title" });
    const body = mod.createDiv("dashboard-module-body");
    const commandSelect = body.createEl("select", { cls: "dashboard-select" });
    for (const cmd of ["query", "ingest", "lint-wiki"]) {
      commandSelect.createEl("option", { value: cmd, text: cmd });
    }
    const placeholders = {
      query: "\u8BF7\u8F93\u5165\u67E5\u8BE2\u95EE\u9898...",
      ingest: "\u8BF7\u7C98\u8D34\u9700\u8981\u5904\u7406\u7684\u539F\u59CB\u5185\u5BB9...",
      "lint-wiki": "\u8BF7\u7C98\u8D34\u9700\u8981\u68C0\u67E5\u7684 wiki \u5185\u5BB9..."
    };
    const inputArea = body.createEl("textarea", { cls: "dashboard-cmd-input" });
    inputArea.placeholder = placeholders["query"];
    commandSelect.addEventListener("change", () => {
      var _a;
      inputArea.placeholder = (_a = placeholders[commandSelect.value]) != null ? _a : "\u8BF7\u8F93\u5165\u5185\u5BB9...";
    });
    const execBtn = body.createEl("button", { text: "\u25B6 \u6267\u884C", cls: "mod-cta dashboard-exec-btn" });
    const resultEl = body.createEl("pre", { cls: "dashboard-result-pre" });
    resultEl.textContent = "\uFF08\u6267\u884C\u7ED3\u679C\u5C06\u663E\u793A\u5728\u6B64\u5904\uFF09";
    const resultActions = body.createDiv("dashboard-result-actions");
    resultActions.style.display = "none";
    const exportBtn = resultActions.createEl("button", { text: "\u5BFC\u51FA\u5230 outputs", cls: "dashboard-link-btn" });
    const errorEl = body.createDiv("dashboard-exec-error");
    errorEl.style.display = "none";
    const resetButton = () => {
      execBtn.disabled = false;
      execBtn.textContent = "\u25B6 \u6267\u884C";
      execBtn.classList.remove("mod-warning");
      execBtn.classList.add("mod-cta");
    };
    execBtn.addEventListener("click", async () => {
      var _a;
      if (this.executing) {
        (_a = this.abortController) == null ? void 0 : _a.abort();
        return;
      }
      const input = inputArea.value.trim();
      if (!input) {
        new import_obsidian15.Notice("\u8BF7\u8F93\u5165\u5185\u5BB9");
        return;
      }
      if (!this.settings.apiKey) {
        new import_obsidian15.Notice("\u8BF7\u5148\u914D\u7F6E API Key");
        return;
      }
      this.executing = true;
      this.abortController = new AbortController();
      execBtn.classList.remove("mod-cta");
      execBtn.classList.add("mod-warning");
      execBtn.textContent = "\u23F9 \u4E2D\u6B62";
      errorEl.style.display = "none";
      resultEl.textContent = "";
      resultActions.style.display = "none";
      try {
        const cmd = commandSelect.value;
        const result = await this.llmService.executeCommand(
          cmd,
          input,
          (chunk) => {
            resultEl.textContent += chunk;
          },
          this.abortController.signal
        );
        resultEl.textContent = result;
        resultActions.style.display = "";
        const logType = cmd === "lint-wiki" ? "lint" : cmd;
        this.logService.writeLog(logType, input.slice(0, 80));
        exportBtn.onclick = async () => {
          const filename = `outputs/${cmd}-${Date.now()}.md`;
          try {
            if (!await this.app.vault.adapter.exists("outputs")) {
              await this.app.vault.adapter.mkdir("outputs");
            }
            await this.app.vault.create(filename, result);
            new import_obsidian15.Notice(`\u5DF2\u5BFC\u51FA\u5230 ${filename}`);
          } catch (err) {
            new import_obsidian15.Notice(`\u5BFC\u51FA\u5931\u8D25: ${err.message}`);
          }
        };
      } catch (e) {
        if ((e == null ? void 0 : e.name) === "AbortError") {
          errorEl.textContent = "\u5DF2\u4E2D\u6B62";
        } else {
          errorEl.textContent = `\u26A0 ${e.message}`;
        }
        errorEl.style.display = "";
      } finally {
        this.executing = false;
        this.abortController = null;
        resetButton();
        this.onTokenRefresh();
      }
    });
  }
  destroy() {
    var _a;
    (_a = this.abortController) == null ? void 0 : _a.abort();
    this.abortController = null;
    this.executing = false;
    this.modEl = null;
    super.destroy();
  }
};

// src/modules/operation-log/OperationLogComponent.ts
var LOG_TYPE_LABELS = {
  ingest: "\u5165\u5E93",
  query: "\u95EE\u7B54",
  lint: "\u5BA1\u9605",
  unknown: "\u5176\u4ED6"
};
var LOG_TYPE_CLS = {
  ingest: "ingest",
  query: "query",
  lint: "lint",
  unknown: "unknown"
};
var OperationLogComponent = class extends BaseComponent {
  constructor(app, settings, logService) {
    super(app, settings);
    this.logService = logService;
  }
  get id() {
    return "operation-log";
  }
  async render(container) {
    const mod = container.createDiv("dashboard-module");
    const header = mod.createDiv("dashboard-module-header");
    const titleWrap = header.createDiv("dashboard-module-title-wrap");
    titleWrap.createEl("span", { text: "\u{1F4CB}", cls: "dashboard-module-icon" });
    titleWrap.createEl("span", { text: "\u64CD\u4F5C\u65E5\u5FD7", cls: "dashboard-module-title" });
    const body = mod.createDiv("dashboard-module-body");
    const entries = await this.logService.getRecentLogs(8);
    if (entries.length === 0) {
      body.createDiv({ text: "\u6682\u65E0\u64CD\u4F5C\u8BB0\u5F55\uFF08\u6267\u884C LLM \u6307\u4EE4\u540E\u5C06\u81EA\u52A8\u5199\u5165 wiki/log\uFF09", cls: "dashboard-empty" });
      return;
    }
    const list = body.createDiv("dashboard-log-list");
    for (const entry of entries) {
      const row = list.createDiv("dashboard-log-row");
      row.createEl("span", {
        text: LOG_TYPE_LABELS[entry.type],
        cls: `dashboard-log-type dashboard-log-type-${LOG_TYPE_CLS[entry.type]}`
      });
      row.createEl("span", { text: entry.target, cls: "dashboard-log-target", title: entry.raw });
      row.createEl("span", { text: entry.time, cls: "dashboard-log-time" });
    }
  }
};

// src/modules/git-sync/GitSyncComponent.ts
var import_obsidian17 = require("obsidian");

// src/modules/git-sync/GitConfigModal.ts
var import_obsidian16 = require("obsidian");
var GitConfigModal = class extends import_obsidian16.Modal {
  constructor(app, settings, onSave) {
    super(app);
    this.onSave = onSave;
    this.settings = JSON.parse(JSON.stringify(settings));
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("dashboard-modal");
    contentEl.addClass("dashboard-git-config-modal");
    contentEl.createEl("h2", { text: "Git \u540C\u6B65\u914D\u7F6E" });
    this.createToggle(contentEl, "\u542F\u7528 Git \u540C\u6B65", this.settings.gitEnabled, (v) => {
      this.settings.gitEnabled = v;
    });
    this.createTextField(
      contentEl,
      "\u4ED3\u5E93\u5730\u5740",
      this.settings.gitRemoteURL,
      (v) => this.settings.gitRemoteURL = v.trim(),
      "https://github.com/username/repo.git"
    );
    const row1 = contentEl.createDiv("dashboard-git-config-row");
    this.createTextFieldInRow(
      row1,
      "\u8FDC\u7A0B\u540D\u79F0",
      this.settings.gitRemoteName,
      (v) => this.settings.gitRemoteName = v.trim() || "origin",
      "origin"
    );
    this.createTextFieldInRow(
      row1,
      "\u5206\u652F\u540D",
      this.settings.gitBranchName,
      (v) => this.settings.gitBranchName = v.trim() || "main",
      "main"
    );
    const row2 = contentEl.createDiv("dashboard-git-config-row");
    this.createTextFieldInRow(
      row2,
      "GitHub \u7528\u6237\u540D",
      this.settings.gitUsername,
      (v) => this.settings.gitUsername = v.trim(),
      "your-username"
    );
    this.createPasswordFieldInRow(
      row2,
      "GitHub Token",
      this.settings.gitPassword,
      (v) => this.settings.gitPassword = v.trim(),
      "your-token"
    );
    this.createToggle(contentEl, "\u81EA\u52A8 Push", this.settings.gitAutoPushEnabled, (v) => {
      this.settings.gitAutoPushEnabled = v;
    });
    if (this.settings.gitAutoPushEnabled) {
      this.createTextField(
        contentEl,
        "\u81EA\u52A8 Push \u95F4\u9694\uFF08\u5206\u949F\uFF09",
        String(this.settings.gitAutoPushInterval),
        (v) => {
          const n = parseInt(v);
          if (!isNaN(n) && n >= 0)
            this.settings.gitAutoPushInterval = n;
        },
        "0 = \u6BCF\u6B21\u53D8\u66F4\u540E\u63A8\u9001"
      );
    }
    this.createTextField(
      contentEl,
      "\u72B6\u6001\u5237\u65B0\u95F4\u9694\uFF08\u79D2\uFF09",
      String(this.settings.gitPollInterval),
      (v) => {
        const n = parseInt(v);
        if (!isNaN(n) && n >= 0)
          this.settings.gitPollInterval = n;
      },
      "30\uFF080 = \u5173\u95ED\u8F6E\u8BE2\uFF0C\u4EC5\u5728 vault \u53D8\u66F4\u65F6\u5237\u65B0\uFF09"
    );
    this.createTextField(
      contentEl,
      "Push/Pull \u8D85\u65F6\uFF08\u5206\u949F\uFF09",
      String(this.settings.gitPushTimeout),
      (v) => {
        const n = parseInt(v);
        if (!isNaN(n) && n >= 0)
          this.settings.gitPushTimeout = n;
      },
      "5\uFF080 = \u4E0D\u9650\u65F6\uFF1B\u5927\u4ED3\u5E93\u9996\u6B21\u63A8\u9001\u53EF\u8BBE 10 \u6216\u66F4\u5927\uFF09"
    );
    this.createTextFieldWithPreview(
      contentEl,
      "Commit \u6D88\u606F\u6A21\u677F",
      this.settings.gitCommitTemplate,
      (v) => this.settings.gitCommitTemplate = v.trim(),
      "auto: {{date}} {{time}}"
    );
    contentEl.createDiv({
      text: "Token \u83B7\u53D6\u5730\u5740: https://github.com/settings/tokens",
      cls: "dashboard-field-hint"
    });
    const actions = contentEl.createDiv("dashboard-modal-actions");
    actions.style.cssText = "justify-content:flex-end;";
    actions.createEl("button", { text: "\u53D6\u6D88" }).addEventListener("click", () => this.close());
    const saveBtn = actions.createEl("button", { text: "\u4FDD\u5B58", cls: "mod-cta" });
    saveBtn.addEventListener("click", async () => {
      await this.onSave(this.settings);
      this.close();
      new import_obsidian16.Notice("Git \u914D\u7F6E\u5DF2\u4FDD\u5B58");
    });
  }
  createToggle(parent, label, value, onChange) {
    const row = parent.createDiv("dashboard-field");
    row.createEl("label", { text: label });
    const toggle = row.createEl("label", { cls: "dashboard-toggle" });
    const cb = toggle.createEl("input");
    cb.type = "checkbox";
    cb.checked = value;
    cb.addEventListener("change", () => onChange(cb.checked));
    toggle.createEl("span", { cls: "dashboard-toggle-slider" });
  }
  createTextField(parent, label, value, onChange, placeholder, example) {
    const row = parent.createDiv("dashboard-field");
    row.createEl("label", { text: label });
    const wrap = row.createDiv("dashboard-input-wrap");
    const input = wrap.createEl("input");
    input.type = "text";
    input.placeholder = placeholder;
    input.value = value;
    input.addEventListener("input", () => onChange(input.value));
    this.addExampleHint(wrap, input, example != null ? example : placeholder);
  }
  createTextFieldInRow(parent, label, value, onChange, placeholder, example) {
    const field = parent.createDiv("dashboard-git-config-half");
    field.createEl("label", { text: label, cls: "dashboard-git-config-label" });
    const wrap = field.createDiv("dashboard-input-wrap");
    const input = wrap.createEl("input");
    input.type = "text";
    input.placeholder = placeholder;
    input.value = value;
    input.style.width = "100%";
    input.addEventListener("input", () => onChange(input.value));
    this.addExampleHint(wrap, input, example != null ? example : placeholder);
  }
  createPasswordFieldInRow(parent, label, value, onChange, placeholder) {
    const field = parent.createDiv("dashboard-git-config-half");
    field.createEl("label", { text: label, cls: "dashboard-git-config-label" });
    const input = field.createEl("input");
    input.type = "password";
    input.placeholder = placeholder;
    input.value = value;
    input.style.width = "100%";
    input.addEventListener("input", () => onChange(input.value));
  }
  createTextFieldWithPreview(parent, label, value, onChange, placeholder) {
    const row = parent.createDiv("dashboard-field");
    row.createEl("label", { text: label });
    const wrap = row.createDiv("dashboard-input-wrap");
    const input = wrap.createEl("input");
    input.type = "text";
    input.placeholder = placeholder;
    input.value = value;
    const preview = row.createDiv("dashboard-format-preview");
    const updatePreview = () => {
      const now = /* @__PURE__ */ new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const time = now.toTimeString().slice(0, 8);
      const example = (input.value || placeholder).replace(/\{\{date\}\}/g, date).replace(/\{\{time\}\}/g, time);
      preview.textContent = `\u793A\u4F8B: ${example}`;
    };
    input.addEventListener("input", () => {
      onChange(input.value);
      updatePreview();
    });
    updatePreview();
    this.addExampleHint(wrap, input, placeholder);
  }
  addExampleHint(wrap, input, example) {
    if (!example || example === "sk-..." || example === "https://..." || example === "your-token")
      return;
    const hint = wrap.createEl("span", { cls: "dashboard-example-hint", text: "\u{1F4CB}", attr: { "data-tooltip": example } });
    hint.addEventListener("click", () => {
      input.value = example;
      input.dispatchEvent(new Event("input"));
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/modules/git-sync/GitSyncComponent.ts
var GitSyncComponent = class extends BaseComponent {
  constructor(app, settings, gitService, onSettingsChange, onAutoPushSetup) {
    super(app, settings);
    this.pollTimer = null;
    this.autoPushTimer = null;
    this.autoPushDebounceTimer = null;
    this.modEl = null;
    this.gitService = gitService;
    this.onSettingsChange = onSettingsChange;
    this.onAutoPushSetup = onAutoPushSetup;
  }
  get id() {
    return "git-sync";
  }
  updateSettings(settings) {
    const oldPoll = this.settings.gitPollInterval;
    super.updateSettings(settings);
    if (oldPoll !== settings.gitPollInterval && this.pollTimer !== null) {
      this.startPolling();
    }
  }
  async render(container) {
    const mod = container.createDiv("dashboard-module");
    mod.id = "dashboard-git-module";
    this.modEl = mod;
    this.buildHeader(mod);
    const body = mod.createDiv("dashboard-module-body");
    await this.buildBodyContent(body);
  }
  async update() {
    const mod = this.modEl;
    if (!mod || !mod.isConnected)
      return;
    const existingBody = mod.querySelector(".dashboard-module-body");
    if (existingBody)
      existingBody.remove();
    const body = mod.createDiv("dashboard-module-body");
    await this.buildBodyContent(body);
  }
  startPolling() {
    var _a;
    this.stopPolling();
    const seconds = Math.max(0, (_a = this.settings.gitPollInterval) != null ? _a : 30);
    if (seconds === 0)
      return;
    this.pollTimer = setInterval(() => this.update(), seconds * 1e3);
  }
  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
  setupAutoPush() {
    if (this.autoPushTimer) {
      clearInterval(this.autoPushTimer);
      this.autoPushTimer = null;
    }
    if (!this.settings.gitEnabled || !this.settings.gitAutoPushEnabled)
      return;
    if (!this.settings.gitRemoteURL)
      return;
    const interval = this.settings.gitAutoPushInterval;
    if (interval > 0) {
      this.autoPushTimer = setInterval(() => {
        this.doAutoPush();
      }, interval * 60 * 1e3);
    }
  }
  destroy() {
    this.stopPolling();
    if (this.autoPushTimer) {
      clearInterval(this.autoPushTimer);
      this.autoPushTimer = null;
    }
    if (this.autoPushDebounceTimer) {
      clearTimeout(this.autoPushDebounceTimer);
      this.autoPushDebounceTimer = null;
    }
    super.destroy();
  }
  // Called by external vault change handler for auto-push on change (interval === 0)
  triggerAutoPushDebounce() {
    if (this.settings.gitEnabled && this.settings.gitAutoPushEnabled && this.settings.gitAutoPushInterval === 0) {
      if (this.autoPushDebounceTimer)
        clearTimeout(this.autoPushDebounceTimer);
      this.autoPushDebounceTimer = setTimeout(() => {
        this.doAutoPush();
      }, 5e3);
    }
  }
  // ── Internal ──
  buildHeader(mod) {
    const header = mod.createDiv("dashboard-module-header");
    const titleWrap = header.createDiv("dashboard-module-title-wrap");
    titleWrap.createEl("span", { text: "\u{1F517}", cls: "dashboard-module-icon" });
    titleWrap.createEl("span", { text: "Git \u540C\u6B65", cls: "dashboard-module-title" });
    const gearBtn = header.createEl("button", { cls: "dashboard-heatmap-config-btn", title: "Git \u540C\u6B65\u914D\u7F6E" });
    gearBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
    gearBtn.addEventListener("click", () => {
      new GitConfigModal(this.app, this.settings, async (s) => {
        await this.onSettingsChange(s);
        this.settings = s;
        this.setupAutoPush();
        await this.update();
      }).open();
    });
  }
  async buildBodyContent(body) {
    if (!this.settings.gitEnabled) {
      body.createDiv({
        text: "Git \u540C\u6B65\u672A\u542F\u7528\u3002\u8BF7\u5728\u8BBE\u7F6E\u4E2D\u914D\u7F6E GitHub \u4ED3\u5E93\u4FE1\u606F\u5E76\u5F00\u542F\u540C\u6B65\u3002",
        cls: "dashboard-git-mobile-hint"
      });
      const settingsBtn = body.createEl("button", { text: "\u6253\u5F00\u8BBE\u7F6E", cls: "mod-cta" });
      settingsBtn.style.cssText = "width:100%;margin-top:8px;";
      settingsBtn.addEventListener("click", () => {
        const settingTabs = this.app.setting;
        if (settingTabs) {
          settingTabs.open();
          settingTabs.openTabById("yy-obsidian-dashboard");
        }
      });
      return;
    }
    const isRepo = await this.gitService.isGitRepo();
    if (!isRepo) {
      body.createDiv({
        text: "\u5F53\u524D vault \u5C1A\u672A\u521D\u59CB\u5316 Git \u4ED3\u5E93",
        cls: "dashboard-git-notice"
      });
      const initBtn = body.createEl("button", { text: "\u521D\u59CB\u5316 Git \u4ED3\u5E93", cls: "mod-cta dashboard-git-init-btn" });
      initBtn.addEventListener("click", async () => {
        initBtn.disabled = true;
        initBtn.textContent = "\u521D\u59CB\u5316\u4E2D...";
        try {
          await this.gitService.initRepo();
          if (this.settings.gitRemoteURL) {
            await this.gitService.ensureRemote(this.settings.gitRemoteURL, this.settings.gitRemoteName);
          }
          new import_obsidian17.Notice("Git \u4ED3\u5E93\u521D\u59CB\u5316\u6210\u529F");
          await this.update();
        } catch (e) {
          new import_obsidian17.Notice(`\u521D\u59CB\u5316\u5931\u8D25: ${e.message}`);
          initBtn.disabled = false;
          initBtn.textContent = "\u521D\u59CB\u5316 Git \u4ED3\u5E93";
        }
      });
      return;
    }
    let remoteOk = true;
    if (this.settings.gitRemoteURL) {
      try {
        await this.gitService.ensureRemote(this.settings.gitRemoteURL, this.settings.gitRemoteName);
      } catch (e) {
        remoteOk = false;
      }
    }
    let status = { clean: true, files: [], ahead: 0, behind: 0 };
    try {
      status = await this.gitService.getStatus(
        this.settings.gitRemoteName || void 0,
        this.settings.gitBranchName || void 0
      );
    } catch (e) {
    }
    const statusRow = body.createDiv("dashboard-git-status");
    const dot = statusRow.createDiv(`dashboard-git-status-dot ${status.clean ? "clean" : "dirty"}`);
    const statusText = statusRow.createDiv("dashboard-git-status-text");
    if (status.clean && status.ahead === 0 && status.behind === 0) {
      statusText.createEl("span", { text: "\u5DF2\u540C\u6B65\uFF0C\u5DE5\u4F5C\u533A\u5E72\u51C0" });
    } else {
      if (!status.clean) {
        const fileSpan = statusText.createEl("span", {
          text: `${status.files.length} \u4E2A\u6587\u4EF6\u5DF2\u53D8\u66F4`,
          cls: "dashboard-git-files-link"
        });
        this.attachFileListPopover(fileSpan, status.files);
      }
      if (status.ahead > 0) {
        if (!status.clean)
          statusText.createEl("span", { text: " | " });
        statusText.createEl("span", { text: `\u9886\u5148 ${status.ahead} \u4E2A\u63D0\u4EA4` });
      }
      if (status.behind > 0) {
        if (!status.clean || status.ahead > 0)
          statusText.createEl("span", { text: " | " });
        statusText.createEl("span", { text: `\u843D\u540E ${status.behind} \u4E2A\u63D0\u4EA4` });
      }
    }
    if (!remoteOk) {
      statusRow.createDiv({ text: "\u672A\u80FD\u914D\u7F6E\u8FDC\u7A0B\u4ED3\u5E93\uFF0C\u8BF7\u68C0\u67E5\u4ED3\u5E93\u5730\u5740", cls: "dashboard-git-warn" });
    }
    const actions = body.createDiv("dashboard-git-actions");
    const pullBtn = actions.createEl("button", { text: "\u2B07 Pull", cls: "dashboard-git-btn", title: "\u4ECE\u8FDC\u7A0B\u62C9\u53D6\u6700\u65B0\u4EE3\u7801" });
    pullBtn.addEventListener("click", async () => {
      pullBtn.disabled = true;
      pullBtn.textContent = "\u62C9\u53D6\u4E2D...";
      try {
        const result = await this.gitService.pull(
          this.settings.gitRemoteName,
          this.settings.gitBranchName,
          this.settings.gitUsername || void 0,
          this.settings.gitPassword || void 0,
          this.settings.gitPushTimeout
        );
        new import_obsidian17.Notice(result);
        await this.update();
      } catch (e) {
        new import_obsidian17.Notice(`Pull \u5931\u8D25: ${e.message}`);
      } finally {
        pullBtn.disabled = false;
        pullBtn.textContent = "\u2B07 Pull";
      }
    });
    const pushBtn = actions.createEl("button", { text: "\u2B06 Push", cls: "mod-cta dashboard-git-btn", title: "\u63D0\u4EA4\u5E76\u63A8\u9001\u6240\u6709\u53D8\u66F4" });
    pushBtn.addEventListener("click", async () => {
      const files = await this.gitService.getStatusFiles();
      if (files.length === 0) {
        new import_obsidian17.Notice("\u6CA1\u6709\u9700\u8981\u63D0\u4EA4\u7684\u6587\u4EF6");
        return;
      }
      this.showPushConfirmModal(files);
    });
    const rollbackBtn = actions.createEl("button", { text: "\u21A9 Rollback", cls: "dashboard-git-btn", title: "\u56DE\u6EDA\u672A\u6682\u5B58\u7684\u53D8\u66F4" });
    rollbackBtn.addEventListener("click", async () => {
      const files = await this.gitService.getStatusFiles();
      if (files.length === 0) {
        new import_obsidian17.Notice("\u6CA1\u6709\u53EF\u4EE5\u56DE\u6EDA\u7684\u53D8\u66F4");
        return;
      }
      this.showRollbackConfirmModal(files);
    });
    const autoRow = body.createDiv("dashboard-git-auto-row");
    const autoLabel = autoRow.createEl("label", { cls: "dashboard-git-auto-label" });
    autoLabel.createEl("span", { text: "\u81EA\u52A8 Push" });
    const autoToggle = autoLabel.createEl("input");
    autoToggle.type = "checkbox";
    autoToggle.checked = this.settings.gitAutoPushEnabled;
    autoToggle.addEventListener("change", async () => {
      this.settings.gitAutoPushEnabled = autoToggle.checked;
      await this.onSettingsChange(this.settings);
      this.setupAutoPush();
    });
    autoRow.createEl("span", {
      text: this.settings.gitAutoPushInterval === 0 ? "\u6BCF\u6B21\u53D8\u66F4\u540E\u81EA\u52A8\u63A8\u9001" : `\u6BCF ${this.settings.gitAutoPushInterval} \u5206\u949F\u81EA\u52A8\u63A8\u9001`,
      cls: "dashboard-git-auto-hint"
    });
    const commits = await this.gitService.getRecentCommits(5);
    if (commits.length > 0) {
      const commitSection = body.createDiv("dashboard-git-commits");
      commitSection.createEl("span", { text: "\u6700\u8FD1\u63D0\u4EA4", cls: "dashboard-git-commits-title" });
      for (const c of commits) {
        const row = commitSection.createDiv("dashboard-git-commit-row");
        const hashEl = row.createEl("span", { text: c.hash, cls: "dashboard-git-commit-hash" });
        hashEl.style.cursor = "pointer";
        this.attachCommitFilePopover(hashEl, c.hash);
        row.createEl("span", { text: c.author, cls: "dashboard-git-commit-author" });
        row.createEl("span", { text: c.message, cls: "dashboard-git-commit-msg" });
        row.createEl("span", { text: this.formatGitDate(c.date), cls: "dashboard-git-commit-date" });
      }
    }
  }
  // ── Auto push ──
  async doAutoPush() {
    try {
      const isRepo = await this.gitService.isGitRepo();
      if (!isRepo)
        return;
      const msg = this.buildCommitMessage();
      await this.gitService.pushAll(
        this.settings.gitRemoteName,
        this.settings.gitBranchName,
        msg,
        this.settings.gitUsername || void 0,
        this.settings.gitPassword || void 0,
        this.settings.gitPushTimeout
      );
      new import_obsidian17.Notice("\u81EA\u52A8\u63A8\u9001\u6210\u529F");
    } catch (e) {
      new import_obsidian17.Notice(`\u81EA\u52A8\u63A8\u9001\u5931\u8D25: ${e.message}`);
    }
  }
  buildCommitMessage() {
    const now = /* @__PURE__ */ new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const time = now.toTimeString().slice(0, 8);
    return this.settings.gitCommitTemplate.replace(/\{\{date\}\}/g, date).replace(/\{\{time\}\}/g, time);
  }
  formatGitDate(dateStr) {
    try {
      const d = new Date(dateStr);
      const now = /* @__PURE__ */ new Date();
      const diff = Math.floor((now.getTime() - d.getTime()) / 6e4);
      if (diff < 1)
        return "\u521A\u521A";
      if (diff < 60)
        return `${diff} \u5206\u949F\u524D`;
      if (diff < 1440)
        return `${Math.floor(diff / 60)} \u5C0F\u65F6\u524D`;
      if (diff < 43200)
        return `${Math.floor(diff / 1440)} \u5929\u524D`;
      return dateStr.slice(0, 10);
    } catch (e) {
      return dateStr;
    }
  }
  // ── Popovers ──
  attachFileListPopover(trigger, files) {
    let popover = null;
    let hideTimer = null;
    const clearTimer = () => {
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
    };
    const remove2 = () => {
      clearTimer();
      if (popover) {
        popover.remove();
        popover = null;
      }
    };
    const show = () => {
      clearTimer();
      remove2();
      popover = document.body.createDiv("dashboard-popover");
      popover.createDiv("dashboard-popover-title").textContent = `\u53D8\u66F4\u6587\u4EF6 (${files.length})`;
      for (const filePath of files) {
        popover.createDiv("dashboard-popover-item").textContent = filePath;
      }
      const rect = trigger.getBoundingClientRect();
      popover.style.top = `${rect.bottom + 6}px`;
      popover.style.left = `${Math.min(rect.left, window.innerWidth - 420)}px`;
      popover.addEventListener("mouseenter", clearTimer);
      popover.addEventListener("mouseleave", () => {
        hideTimer = setTimeout(remove2, 200);
      });
    };
    trigger.addEventListener("mouseenter", show);
    trigger.addEventListener("mouseleave", () => {
      hideTimer = setTimeout(remove2, 200);
    });
  }
  attachCommitFilePopover(trigger, commitHash) {
    let popover = null;
    let hideTimer = null;
    const clearTimer = () => {
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
    };
    const remove2 = () => {
      clearTimer();
      if (popover) {
        popover.remove();
        popover = null;
      }
    };
    const show = async () => {
      clearTimer();
      remove2();
      popover = document.body.createDiv("dashboard-popover");
      popover.createDiv("dashboard-popover-title").textContent = "\u52A0\u8F7D\u4E2D...";
      const rect = trigger.getBoundingClientRect();
      popover.style.top = `${rect.bottom + 6}px`;
      popover.style.left = `${Math.min(rect.left, window.innerWidth - 420)}px`;
      popover.addEventListener("mouseenter", clearTimer);
      popover.addEventListener("mouseleave", () => {
        hideTimer = setTimeout(remove2, 200);
      });
      const files = await this.gitService.getCommitFiles(commitHash);
      popover.empty();
      popover.createDiv("dashboard-popover-title").textContent = `\u63D0\u4EA4 ${commitHash} (${files.length} \u4E2A\u6587\u4EF6)`;
      if (files.length === 0) {
        popover.createDiv("dashboard-popover-item").textContent = "\u65E0\u6CD5\u83B7\u53D6\u6587\u4EF6\u5217\u8868";
      } else {
        for (const filePath of files) {
          const item = popover.createDiv("dashboard-popover-item");
          item.textContent = filePath;
          item.style.cursor = "pointer";
          item.addEventListener("mousedown", async (e) => {
            e.preventDefault();
            const f = this.app.vault.getAbstractFileByPath(filePath);
            if (f instanceof import_obsidian17.TFile)
              await this.app.workspace.getLeaf(false).openFile(f);
            remove2();
          });
        }
      }
    };
    trigger.addEventListener("mouseenter", show);
    trigger.addEventListener("mouseleave", () => {
      hideTimer = setTimeout(remove2, 200);
    });
  }
  // ── Push confirm modal ──
  showPushConfirmModal(files) {
    const gitService = this.gitService;
    const settings = this.settings;
    const view = this;
    const STATUS_LABELS = {
      " M": "\u5DF2\u4FEE\u6539",
      "??": "\u65B0\u589E",
      " A": "\u65B0\u589E(\u5DF2\u6682\u5B58)",
      "AM": "\u65B0\u589E(\u6709\u51B2\u7A81)",
      " D": "\u5DF2\u5220\u9664",
      "M ": "\u5DF2\u6682\u5B58",
      "A ": "\u5DF2\u6682\u5B58",
      "D ": "\u5DF2\u5220\u9664(\u5DF2\u6682\u5B58)",
      "MM": "\u6709\u51B2\u7A81",
      "R ": "\u5DF2\u91CD\u547D\u540D"
    };
    new class extends import_obsidian17.Modal {
      constructor() {
        super(...arguments);
        this.checkboxes = [];
      }
      onOpen() {
        var _a;
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("dashboard-push-confirm-modal");
        contentEl.createEl("h3", { text: "\u786E\u8BA4\u63A8\u9001" });
        contentEl.createEl("p", { text: `\u5171 ${files.length} \u4E2A\u6587\u4EF6\u53D8\u66F4\uFF0C\u52FE\u9009\u9700\u8981\u63D0\u4EA4\u7684\u6587\u4EF6\uFF1A`, cls: "dashboard-push-confirm-hint" });
        const commitMsg = contentEl.createDiv("dashboard-push-commit-row");
        commitMsg.createEl("label", { text: "Commit \u6D88\u606F\uFF1A" });
        const msgInput = commitMsg.createEl("input", { cls: "dashboard-push-commit-input" });
        msgInput.value = view.buildCommitMessage();
        const list = contentEl.createDiv("dashboard-push-file-list");
        const selectAllRow = list.createDiv("dashboard-push-select-all");
        const selectAllLabel = selectAllRow.createEl("label", { cls: "dashboard-push-check-label" });
        this.allCb = selectAllLabel.createEl("input");
        this.allCb.type = "checkbox";
        this.allCb.checked = true;
        selectAllLabel.createEl("span", { text: "\u5168\u9009 / \u53D6\u6D88\u5168\u9009" });
        this.allCb.addEventListener("change", () => {
          for (const { cb } of this.checkboxes)
            cb.checked = this.allCb.checked;
        });
        for (const f of files) {
          const row = list.createDiv("dashboard-push-file-row");
          const checkLabel = row.createEl("label", { cls: "dashboard-push-check-label" });
          const cb = checkLabel.createEl("input");
          cb.type = "checkbox";
          cb.checked = true;
          this.checkboxes.push({ file: f, cb });
          cb.addEventListener("change", () => {
            const allChecked = this.checkboxes.every((c) => c.cb.checked);
            this.allCb.checked = allChecked;
          });
          row.createEl("span", {
            text: (_a = STATUS_LABELS[f.status]) != null ? _a : f.status,
            cls: `dashboard-push-status dashboard-push-status-${f.staged ? "staged" : "unstaged"}`
          });
          row.createEl("span", { text: f.path, cls: "dashboard-push-file-path" });
        }
        const actions = contentEl.createDiv("dashboard-modal-actions");
        actions.style.cssText = "justify-content:space-between;";
        const cancelBtn = actions.createEl("button", { text: "\u53D6\u6D88" });
        cancelBtn.addEventListener("click", () => this.close());
        const rightBtns = actions.createDiv();
        rightBtns.style.cssText = "display:flex;gap:8px;";
        const commitOnlyBtn = rightBtns.createEl("button", { text: "\u4EC5 Commit" });
        commitOnlyBtn.addEventListener("click", async () => {
          const selected = this.checkboxes.filter((c) => c.cb.checked).map((c) => c.file.path);
          if (selected.length === 0) {
            new import_obsidian17.Notice("\u8BF7\u81F3\u5C11\u9009\u62E9\u4E00\u4E2A\u6587\u4EF6");
            return;
          }
          const message = msgInput.value.trim() || view.buildCommitMessage();
          this.close();
          setTimeout(async () => {
            try {
              const staged = await gitService.stageFiles(selected);
              const committed = await gitService.commit(message);
              if (committed) {
                const stagedInfo = staged.length === selected.length ? `\u5DF2\u6682\u5B58 ${staged.length} \u4E2A\u6587\u4EF6` : `\u5DF2\u6682\u5B58 ${staged.length} \u4E2A\u6587\u4EF6\uFF08${selected.length - staged.length} \u4E2A\u5931\u8D25\uFF09`;
                new import_obsidian17.Notice(`${stagedInfo}\uFF0C\u63D0\u4EA4\u6210\u529F`);
              } else {
                new import_obsidian17.Notice("\u6CA1\u6709\u9700\u8981\u63D0\u4EA4\u7684\u53D8\u66F4");
              }
              await view.update();
            } catch (e) {
              new import_obsidian17.Notice(`Commit \u5931\u8D25: ${e.message}`);
            }
          }, 0);
        });
        const pushBtn = rightBtns.createEl("button", { text: "Commit & Push", cls: "mod-cta" });
        pushBtn.addEventListener("click", async () => {
          const selected = this.checkboxes.filter((c) => c.cb.checked).map((c) => c.file.path);
          if (selected.length === 0) {
            new import_obsidian17.Notice("\u8BF7\u81F3\u5C11\u9009\u62E9\u4E00\u4E2A\u6587\u4EF6");
            return;
          }
          const message = msgInput.value.trim() || view.buildCommitMessage();
          const timeoutMinutes = settings.gitPushTimeout;
          this.close();
          const loadingNotice = new import_obsidian17.Notice(`\u6B63\u5728\u63D0\u4EA4\u5E76\u63A8\u9001...\uFF08\u8D85\u65F6\uFF1A${timeoutMinutes > 0 ? timeoutMinutes + "\u5206\u949F" : "\u65E0\u9650\u5236"}\uFF09`, 0);
          setTimeout(async () => {
            let staged = [];
            let committed = false;
            try {
              staged = await gitService.stageFiles(selected);
              committed = await gitService.commit(message);
              let pushResult;
              if (committed) {
                pushResult = await gitService.push(
                  settings.gitRemoteName,
                  settings.gitBranchName,
                  settings.gitUsername || void 0,
                  settings.gitPassword || void 0,
                  timeoutMinutes
                );
              } else {
                pushResult = "\u6CA1\u6709\u65B0\u7684\u53D8\u66F4\u9700\u8981\u63A8\u9001";
              }
              loadingNotice.hide();
              const stagedInfo = staged.length === selected.length ? `\u5DF2\u6682\u5B58 ${staged.length} \u4E2A\u6587\u4EF6` : `\u5DF2\u6682\u5B58 ${staged.length} \u4E2A\u6587\u4EF6\uFF08${selected.length - staged.length} \u4E2A\u5931\u8D25\uFF09`;
              new import_obsidian17.Notice(`${stagedInfo}\uFF0C${pushResult}`, 5e3);
              await view.update();
            } catch (e) {
              loadingNotice.hide();
              const isTimeout = (e == null ? void 0 : e.code) === "TIMEOUT";
              if (committed && isTimeout) {
                new import_obsidian17.Notice(`\u63A8\u9001\u8D85\u65F6\uFF08${timeoutMinutes}\u5206\u949F\uFF09\uFF0C\u4F46\u5DF2\u672C\u5730\u63D0\u4EA4 ${staged.length} \u4E2A\u6587\u4EF6\uFF1B\u8BF7\u5230\u8FDC\u7A0B\u4ED3\u5E93\u786E\u8BA4`, 8e3);
              } else if (committed) {
                new import_obsidian17.Notice(`\u5DF2\u672C\u5730\u63D0\u4EA4 ${staged.length} \u4E2A\u6587\u4EF6\uFF0C\u4F46\u63A8\u9001\u5931\u8D25: ${e.message}`, 8e3);
              } else if (staged.length > 0) {
                new import_obsidian17.Notice(`\u5DF2\u6682\u5B58 ${staged.length} \u4E2A\u6587\u4EF6\uFF0C\u4F46\u63D0\u4EA4\u5931\u8D25: ${e.message}`, 8e3);
              } else {
                new import_obsidian17.Notice(`\u64CD\u4F5C\u5931\u8D25: ${e.message}`, 8e3);
              }
              await view.update();
            }
          }, 0);
        });
      }
      onClose() {
        this.contentEl.empty();
      }
    }(this.app).open();
  }
  // ── Rollback confirm modal ──
  showRollbackConfirmModal(files) {
    const gitService = this.gitService;
    const view = this;
    const STATUS_LABELS = {
      " M": "\u5DF2\u4FEE\u6539",
      "??": "\u65B0\u589E",
      " D": "\u5DF2\u5220\u9664"
    };
    new class extends import_obsidian17.Modal {
      constructor() {
        super(...arguments);
        this.checkboxes = [];
      }
      onOpen() {
        var _a;
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("dashboard-push-confirm-modal");
        contentEl.createEl("h3", { text: "\u786E\u8BA4\u56DE\u6EDA" });
        contentEl.createEl("p", { text: `\u5171 ${files.length} \u4E2A\u6587\u4EF6\u6709\u53D8\u66F4\uFF0C\u52FE\u9009\u9700\u8981\u56DE\u6EDA\u7684\u6587\u4EF6\uFF1A`, cls: "dashboard-push-confirm-hint" });
        const warn = contentEl.createEl("p", { text: "\u26A0 \u56DE\u6EDA\u5C06\u4E22\u5F03\u6240\u6709\u672A\u63D0\u4EA4\u7684\u53D8\u66F4\uFF0C\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\uFF01", cls: "dashboard-push-confirm-hint" });
        warn.style.cssText = "color:var(--text-error);font-weight:600;";
        const list = contentEl.createDiv("dashboard-push-file-list");
        const selectAllRow = list.createDiv("dashboard-push-select-all");
        const selectAllLabel = selectAllRow.createEl("label", { cls: "dashboard-push-check-label" });
        this.allCb = selectAllLabel.createEl("input");
        this.allCb.type = "checkbox";
        this.allCb.checked = true;
        selectAllLabel.createEl("span", { text: "\u5168\u9009 / \u53D6\u6D88\u5168\u9009" });
        this.allCb.addEventListener("change", () => {
          for (const { cb } of this.checkboxes)
            cb.checked = this.allCb.checked;
        });
        for (const f of files) {
          const row = list.createDiv("dashboard-push-file-row");
          const checkLabel = row.createEl("label", { cls: "dashboard-push-check-label" });
          const cb = checkLabel.createEl("input");
          cb.type = "checkbox";
          cb.checked = true;
          this.checkboxes.push({ file: f, cb });
          cb.addEventListener("change", () => {
            const allChecked = this.checkboxes.every((c) => c.cb.checked);
            this.allCb.checked = allChecked;
          });
          row.createEl("span", { text: (_a = STATUS_LABELS[f.status]) != null ? _a : f.status, cls: "dashboard-push-status dashboard-push-status-unstaged" });
          row.createEl("span", { text: f.path, cls: "dashboard-push-file-path" });
        }
        const actions = contentEl.createDiv("dashboard-modal-actions");
        actions.style.cssText = "justify-content:flex-end;";
        actions.createEl("button", { text: "\u53D6\u6D88" }).addEventListener("click", () => this.close());
        const confirmBtn = actions.createEl("button", { text: "\u786E\u8BA4\u56DE\u6EDA", cls: "mod-cta" });
        confirmBtn.style.cssText = "background-color:var(--text-error);";
        confirmBtn.addEventListener("click", async () => {
          const selected = this.checkboxes.filter((c) => c.cb.checked).map((c) => c.file.path);
          if (selected.length === 0) {
            new import_obsidian17.Notice("\u8BF7\u81F3\u5C11\u9009\u62E9\u4E00\u4E2A\u6587\u4EF6");
            return;
          }
          confirmBtn.disabled = true;
          confirmBtn.textContent = "\u56DE\u6EDA\u4E2D...";
          try {
            const restored = await gitService.restoreFiles(selected);
            new import_obsidian17.Notice(`\u5DF2\u56DE\u6EDA ${restored.length} \u4E2A\u6587\u4EF6`);
            this.close();
            await view.update();
          } catch (e) {
            new import_obsidian17.Notice(`\u56DE\u6EDA\u5931\u8D25: ${e.message}`);
            confirmBtn.disabled = false;
            confirmBtn.textContent = "\u786E\u8BA4\u56DE\u6EDA";
          }
        });
      }
      onClose() {
        this.contentEl.empty();
      }
    }(this.app).open();
  }
};

// src/modules/remotely-save/RemotelySaveComponent.ts
var import_obsidian18 = require("obsidian");
var RemotelySaveComponent = class extends BaseComponent {
  constructor(app, settings) {
    super(app, settings);
    this.remotelySaveService = new RemotelySaveService();
    this.fileService = new FileService(app);
  }
  get id() {
    return "remotely-save";
  }
  isRemotelySaveEnabled() {
    var _a, _b, _c;
    const plugins = this.app.plugins;
    if (!plugins)
      return false;
    const manifests = (_a = plugins.manifests) != null ? _a : {};
    if (!manifests["remotely-save"])
      return false;
    if ((_b = plugins.plugins) == null ? void 0 : _b["remotely-save"])
      return true;
    const enabledSet = (_c = plugins.enabledPlugins) != null ? _c : {};
    if (enabledSet instanceof Set)
      return enabledSet.has("remotely-save");
    return !!enabledSet["remotely-save"];
  }
  async render(container) {
    if (!this.isRemotelySaveEnabled())
      return;
    const mod = container.createDiv("dashboard-module");
    mod.id = "dashboard-remotely-save-module";
    const header = mod.createDiv("dashboard-module-header");
    const rsTitleWrap = header.createDiv("dashboard-module-title-wrap");
    rsTitleWrap.createEl("span", { text: "\u2601\uFE0F", cls: "dashboard-module-icon" });
    rsTitleWrap.createEl("span", { text: "\u4E91\u540C\u6B65\u8BB0\u5F55", cls: "dashboard-module-title" });
    const body = mod.createDiv("dashboard-module-body dashboard-sync-body");
    const days = 7;
    const [sessions, totalCount] = await Promise.all([
      this.remotelySaveService.getSyncHistory(days),
      this.remotelySaveService.getTotalSyncCount()
    ]);
    if (sessions.length === 0) {
      body.createDiv({ text: "\u6682\u65E0\u540C\u6B65\u8BB0\u5F55\uFF08\u4F9D\u8D56 Remotely Save \u63D2\u4EF6\uFF09", cls: "dashboard-git-mobile-hint" });
      return;
    }
    const remoteLabel = formatRemoteType(sessions[0].remoteType);
    if (remoteLabel && remoteLabel !== "\u672A\u77E5") {
      header.createEl("span", { text: remoteLabel, cls: "dashboard-module-badge" });
    }
    header.createEl("span", { text: `\u5171 ${totalCount} \u6B21\u540C\u6B65`, cls: "dashboard-module-badge" });
    const sessionList = body.createDiv("dashboard-sync-session-list");
    for (const session of sessions) {
      const sessionBlock = sessionList.createDiv("dashboard-sync-session");
      const sessionHeader = sessionBlock.createDiv("dashboard-sync-session-header");
      const date = new Date(session.ts);
      const dateStr = date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
      sessionHeader.createEl("span", { text: dateStr, cls: "dashboard-sync-time" });
      const badges = sessionHeader.createDiv("dashboard-sync-badges");
      if (session.uploads.length > 0)
        badges.createEl("span", { text: `\u2191 ${session.uploads.length}`, cls: "dashboard-sync-badge dashboard-sync-badge-upload" });
      if (session.downloads.length > 0)
        badges.createEl("span", { text: `\u2193 ${session.downloads.length}`, cls: "dashboard-sync-badge dashboard-sync-badge-download" });
      if (session.deletions.length > 0)
        badges.createEl("span", { text: `\u2715 ${session.deletions.length}`, cls: "dashboard-sync-badge dashboard-sync-badge-delete" });
      if (session.totalCount === 0)
        badges.createEl("span", { text: "\u65E0\u53D8\u66F4", cls: "dashboard-sync-badge dashboard-sync-badge-none" });
      const toggleBtn = sessionHeader.createEl("button", { cls: "dashboard-sync-toggle" });
      toggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
      const fileList = sessionBlock.createDiv("dashboard-sync-files");
      fileList.style.display = "none";
      const doToggle = () => {
        const isHidden = fileList.style.display === "none";
        fileList.style.display = isHidden ? "block" : "none";
        toggleBtn.classList.toggle("expanded", isHidden);
      };
      toggleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        doToggle();
      });
      sessionHeader.addEventListener("click", doToggle);
      this.renderSyncFileGroup(fileList, "\u5DF2\u4E0A\u4F20", session.uploads, "upload");
      this.renderSyncFileGroup(fileList, "\u5DF2\u4E0B\u8F7D", session.downloads, "download");
      this.renderSyncFileGroup(fileList, "\u5DF2\u5220\u9664", session.deletions, "delete");
    }
  }
  renderSyncFileGroup(parent, label, files, cls) {
    if (files.length === 0)
      return;
    const group = parent.createDiv("dashboard-sync-file-group");
    group.createEl("span", { text: label, cls: `dashboard-sync-file-label dashboard-sync-file-${cls}` });
    for (const f of files) {
      const item = group.createEl("div", { text: f, cls: "dashboard-sync-file-item" });
      item.addEventListener("click", () => {
        const cleanPath = f.replace(/^\/+|\/+$/g, "");
        const abstract = this.app.vault.getAbstractFileByPath(cleanPath);
        if (abstract instanceof import_obsidian18.TFile) {
          this.app.workspace.getLeaf(false).openFile(abstract);
        } else if (abstract instanceof import_obsidian18.TFolder) {
          this.fileService.toggleFolderInExplorer(cleanPath);
        } else {
          const lastSlash = cleanPath.lastIndexOf("/");
          if (lastSlash > 0)
            this.fileService.toggleFolderInExplorer(cleanPath.slice(0, lastSlash));
        }
      });
    }
  }
};

// src/modules/task-quickadd/TaskQuickAddComponent.ts
var import_obsidian20 = require("obsidian");

// src/modules/task-quickadd/TaskDefaultsModal.ts
var import_obsidian19 = require("obsidian");
var TaskDefaultsModal = class extends import_obsidian19.Modal {
  constructor(app, taskDefaults, onSave) {
    super(app);
    this.taskDefaults = { ...taskDefaults };
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    const td = this.taskDefaults;
    contentEl.addClass("dashboard-task-defaults-modal");
    contentEl.createEl("h3", { text: "\u5FEB\u901F\u4EFB\u52A1\u9ED8\u8BA4\u503C" });
    const addRow = (label, value, placeholder, onChange) => {
      const row = contentEl.createDiv("dashboard-task-modal-row");
      row.createEl("label", { text: label, cls: "dashboard-task-modal-label" });
      const input = row.createEl("input", { cls: "dashboard-task-modal-input", placeholder });
      input.value = value;
      input.addEventListener("input", () => onChange(input.value));
    };
    addRow("\u{1F534} \u7D27\u6025", td.urgent, "\u9ED8\u8BA4\u7D27\u6025\u4EFB\u52A1\u5185\u5BB9...", (v) => {
      td.urgent = v;
    });
    addRow("\u{1F7E1} \u4E00\u822C", td.normal, "\u9ED8\u8BA4\u4E00\u822C\u4EFB\u52A1\u5185\u5BB9...", (v) => {
      td.normal = v;
    });
    addRow("\u{1F7E2} \u4F4E\u4F18\u5148\u7EA7", td.low, "\u9ED8\u8BA4\u4F4E\u4F18\u5148\u7EA7\u4EFB\u52A1\u5185\u5BB9...", (v) => {
      td.low = v;
    });
    addRow("\u{1F504} \u6301\u7EED\u4EFB\u52A1", td.ongoing, "\u9ED8\u8BA4\u6301\u7EED\u4EFB\u52A1\u540D\u79F0...", (v) => {
      td.ongoing = v;
    });
    addRow("\u{1F4CA} \u6301\u7EED\u4EFB\u52A1\u8FDB\u5EA6 %", td.ongoingPercent, "\u9ED8\u8BA4\u8FDB\u5EA6\u767E\u5206\u6BD4...", (v) => {
      td.ongoingPercent = v;
    });
    const btns = contentEl.createDiv("dashboard-task-modal-btns");
    btns.createEl("button", { text: "\u53D6\u6D88" }).addEventListener("click", () => this.close());
    btns.createEl("button", { text: "\u4FDD\u5B58", cls: "mod-cta" }).addEventListener("click", async () => {
      this.onSave();
      this.close();
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/modules/task-quickadd/TaskQuickAddComponent.ts
var TASK_SECTIONS = [
  { key: "urgent", label: "\u{1F534} \u7D27\u6025", section: "### \u{1F534} \u7D27\u6025/\u91CD\u8981", placeholder: "\u7D27\u6025\u4EFB\u52A1..." },
  { key: "normal", label: "\u{1F7E1} \u4E00\u822C", section: "### \u{1F7E1} \u4E00\u822C", placeholder: "\u4E00\u822C\u4EFB\u52A1..." },
  { key: "low", label: "\u{1F7E2} \u4F4E\u4F18\u5148\u7EA7", section: "### \u{1F7E2} \u4F4E\u4F18\u5148\u7EA7", placeholder: "\u4F4E\u4F18\u5148\u7EA7\u4EFB\u52A1..." }
];
var TaskQuickAddComponent = class _TaskQuickAddComponent extends BaseComponent {
  constructor(app, settings, onSettingsChange) {
    super(app, settings);
    this.onSettingsChange = onSettingsChange;
  }
  get id() {
    return "task-quickadd";
  }
  async render(container) {
    const td = this.settings.taskDefaults;
    const mod = container.createDiv("dashboard-module");
    const header = mod.createDiv("dashboard-module-header");
    const tqTitleWrap = header.createDiv("dashboard-module-title-wrap");
    tqTitleWrap.createEl("span", { text: "\u{1F4DD}", cls: "dashboard-module-icon" });
    tqTitleWrap.createEl("span", { text: "\u5FEB\u901F\u6DFB\u52A0\u4EFB\u52A1", cls: "dashboard-module-title" });
    const gearBtn = header.createEl("button", { cls: "dashboard-heatmap-config-btn", title: "\u914D\u7F6E\u9ED8\u8BA4\u5185\u5BB9" });
    gearBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
    gearBtn.addEventListener("click", () => this.openTaskDefaultsModal());
    const body = mod.createDiv("dashboard-module-body");
    body.style.cssText = "display:flex;flex-direction:column;gap:6px;";
    for (const cfg of TASK_SECTIONS) {
      const row = body.createDiv("dashboard-task-row");
      row.createEl("span", { text: cfg.label, cls: "dashboard-task-label" });
      const input = row.createEl("input", { cls: "dashboard-task-input", placeholder: cfg.placeholder });
      input.value = td[cfg.key] || "";
      const addBtn = row.createEl("button", { text: "+", cls: "dashboard-task-add-btn", title: "\u6DFB\u52A0\u5230\u65E5\u62A5" });
      const doAdd = async () => {
        const val = input.value.trim();
        if (!val)
          return;
        addBtn.disabled = true;
        addBtn.textContent = "...";
        try {
          await this.appendBulletToReport(cfg.section, val);
          input.value = td[cfg.key] || "";
        } catch (e) {
          new import_obsidian20.Notice(`\u6DFB\u52A0\u5931\u8D25: ${e.message}`);
        } finally {
          addBtn.disabled = false;
          addBtn.textContent = "+";
        }
      };
      addBtn.addEventListener("click", doAdd);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter")
          doAdd();
      });
    }
    const ongoingRow = body.createDiv("dashboard-task-row");
    ongoingRow.createEl("span", { text: "\u{1F504} \u6301\u7EED\u4EFB\u52A1", cls: "dashboard-task-label" });
    const ongoingInput = ongoingRow.createEl("input", { cls: "dashboard-task-input", placeholder: "\u6301\u7EED\u4EFB\u52A1..." });
    ongoingInput.value = td.ongoing || "";
    const pctInput = ongoingRow.createEl("input", { cls: "dashboard-task-pct-input", placeholder: "%" });
    pctInput.value = td.ongoingPercent || "";
    pctInput.style.cssText = "width:48px;flex-shrink:0;";
    const ongoingBtn = ongoingRow.createEl("button", { text: "+", cls: "dashboard-task-add-btn", title: "\u6DFB\u52A0\u5230\u65E5\u62A5" });
    const doAddOngoing = async () => {
      const val = ongoingInput.value.trim();
      if (!val)
        return;
      const pct = pctInput.value.trim();
      const text = pct ? `${val} (${pct}%)` : val;
      ongoingBtn.disabled = true;
      ongoingBtn.textContent = "...";
      try {
        await this.appendBulletToReport("### \u{1F504} \u6301\u7EED\u4EFB\u52A1", text);
        ongoingInput.value = td.ongoing || "";
        pctInput.value = td.ongoingPercent || "";
      } catch (e) {
        new import_obsidian20.Notice(`\u6DFB\u52A0\u5931\u8D25: ${e.message}`);
      } finally {
        ongoingBtn.disabled = false;
        ongoingBtn.textContent = "+";
      }
    };
    ongoingBtn.addEventListener("click", doAddOngoing);
    ongoingInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter")
        doAddOngoing();
    });
    pctInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter")
        doAddOngoing();
    });
  }
  openTaskDefaultsModal() {
    new TaskDefaultsModal(
      this.app,
      this.settings.taskDefaults,
      async () => await this.onSettingsChange(this.settings)
    ).open();
  }
  async appendBulletToReport(sectionMarker, text) {
    const cfg = this.settings.reportConfigs.daily;
    const date = /* @__PURE__ */ new Date();
    const relPath = this.formatDatePath(date, cfg.filenameFormat);
    const dir = cfg.directory.replace(/^\/+|\/+$/g, "");
    const path = dir ? `${dir}/${relPath}.md` : `${relPath}.md`;
    const file = this.app.vault.getAbstractFileByPath(path);
    let content = "";
    if (file instanceof import_obsidian20.TFile) {
      content = await this.app.vault.read(file);
    } else {
      content = _TaskQuickAddComponent.getDefaultReportTemplate();
      const segs = path.split("/");
      let acc = "";
      for (let i = 0; i < segs.length - 1; i++) {
        acc += (acc ? "/" : "") + segs[i];
        if (!this.app.vault.getAbstractFileByPath(acc)) {
          try {
            await this.app.vault.createFolder(acc);
          } catch (e) {
          }
        }
      }
    }
    const lines = content.split("\n");
    const bullet = `- ${text}`;
    let sectionIdx = -1, nextHeadingIdx = lines.length;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === sectionMarker) {
        sectionIdx = i;
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].trim().startsWith("## ") || lines[j].trim().startsWith("### ")) {
            nextHeadingIdx = j;
            break;
          }
        }
        break;
      }
    }
    if (sectionIdx === -1) {
      if (lines.length > 0 && lines[lines.length - 1] !== "")
        lines.push("");
      lines.push(sectionMarker, "", bullet, "");
    } else {
      if (nextHeadingIdx > 0 && lines[nextHeadingIdx - 1] !== "")
        lines.splice(nextHeadingIdx, 0, "");
      let insertAt = sectionIdx + 1;
      while (insertAt < nextHeadingIdx && lines[insertAt].trim() === "")
        insertAt++;
      while (insertAt < nextHeadingIdx && lines[insertAt].trim() !== "")
        insertAt++;
      if (insertAt < lines.length && lines[insertAt] !== "")
        lines.splice(insertAt, 0, "");
      lines.splice(insertAt, 0, bullet);
    }
    const newContent = lines.join("\n");
    if (file instanceof import_obsidian20.TFile) {
      await this.app.vault.modify(file, newContent);
    } else {
      await this.app.vault.create(path, newContent);
    }
  }
  formatDatePath(date, format) {
    const y = String(date.getFullYear());
    const m = String(date.getMonth() + 1);
    const d = String(date.getDate());
    const temp = new Date(date.getTime());
    temp.setHours(0, 0, 0, 0);
    temp.setDate(temp.getDate() + 3 - (temp.getDay() + 6) % 7);
    const week1 = new Date(temp.getFullYear(), 0, 4);
    const w = String(1 + Math.round(((temp.getTime() - week1.getTime()) / 864e5 - 3 + (week1.getDay() + 6) % 7) / 7));
    const Q = String(Math.floor(date.getMonth() / 3) + 1);
    let result = format.replace(/\[([^\]]+)\]/g, "$1");
    result = result.replace(/YYYY/g, y).replace(/YY/g, y.slice(2)).replace(/MM/g, m.padStart(2, "0")).replace(/DD/g, d.padStart(2, "0")).replace(/ww/g, w.padStart(2, "0")).replace(/M/g, m).replace(/D/g, d).replace(/w/g, w).replace(/Q/g, Q);
    return result;
  }
  static getDefaultReportTemplate() {
    return `> **\u4F18\u5148\u7EA7\u56FE\u4F8B**\uFF1A<span style="color:#e53e3e">\u{1F534} \u7D27\u6025/\u91CD\u8981\u2014\u5FC5\u987B\u5F53\u5929\u5B8C\u6210</span> \uFF5C <span style="color:#d69e2e">\u{1F7E1} \u4E00\u822C\u2014\u5C3D\u91CF\u5B8C\u6210</span> \uFF5C <span style="color:#38a169">\u{1F7E2} \u4F4E\u4F18\u5148\u7EA7\u2014\u6709\u7A7A\u518D\u505A</span> \uFF5C <span style="color:#3182ce">\u{1F535} \u5907\u6CE8/\u4FE1\u606F</span>

## \u4ECA\u65E5\u4EFB\u52A1

### \u{1F534} \u7D27\u6025/\u91CD\u8981

-
-

### \u{1F7E1} \u4E00\u822C

-
-

### \u{1F7E2} \u4F4E\u4F18\u5148\u7EA7

-
-

## \u4ECA\u65E5\u5B8C\u6210

-

## \u9047\u5230\u7684\u95EE\u9898

-

## \u660E\u65E5\u8BA1\u5212

-

## \u5907\u6CE8

-
`;
  }
};

// src/modules/plugin-manage/PluginManageComponent.ts
var import_obsidian21 = require("obsidian");

// src/modules/plugin-manage/PluginManageService.ts
var ZH_DESCRIPTIONS = {
  "calendar": "\u5728\u4FA7\u8FB9\u680F\u663E\u793A\u65E5\u5386\u89C6\u56FE\uFF0C\u70B9\u51FB\u65E5\u671F\u5FEB\u901F\u8DF3\u8F6C\u5230\u5BF9\u5E94\u7684\u65E5\u8BB0\u6587\u4EF6",
  "editing-toolbar": "\u5728\u7F16\u8F91\u5668\u9876\u90E8\u6DFB\u52A0\u683C\u5F0F\u5316\u5DE5\u5177\u680F\uFF0C\u652F\u6301\u52A0\u7C97\u3001\u659C\u4F53\u3001\u6807\u9898\u7B49\u5E38\u7528\u6392\u7248\u64CD\u4F5C",
  "ishibashi-web-clipper": "\u4E00\u952E\u5C06\u7F51\u9875\u5185\u5BB9\u88C1\u526A\u4FDD\u5B58\u5230 Vault\uFF0C\u652F\u6301\u6B63\u6587\u63D0\u53D6\u548C Markdown \u8F6C\u6362",
  "karpathywiki": "\u57FA\u4E8E LLM \u7684\u77E5\u8BC6\u5E93\u7BA1\u7406\u5DE5\u5177\uFF0C\u652F\u6301 ingest / query / lint \u7B49 AI \u5DE5\u4F5C\u6D41",
  "notebook-navigator": "\u589E\u5F3A\u578B\u6587\u4EF6\u5939\u5BFC\u822A\u9762\u677F\uFF0C\u4EE5\u7B14\u8BB0\u672C\u5F62\u5F0F\u5C55\u793A Vault \u76EE\u5F55\u7ED3\u6784",
  "obsidian-excalidraw-plugin": "\u5728 Obsidian \u4E2D\u5D4C\u5165 Excalidraw \u767D\u677F\uFF0C\u652F\u6301\u624B\u7ED8\u56FE\u8868\u548C\u601D\u7EF4\u5BFC\u56FE",
  "periodic-notes": "\u7BA1\u7406\u65E5\u8BB0\u3001\u5468\u8BB0\u3001\u6708\u8BB0\u7B49\u5468\u671F\u6027\u7B14\u8BB0\uFF0C\u914D\u5408 Calendar \u63D2\u4EF6\u4F7F\u7528\u6548\u679C\u66F4\u4F73",
  "yy-obsidian-dashboard": "LLM Wiki \u5DE5\u4F5C\u6D41\u4EEA\u8868\u76D8\uFF0C\u96C6\u6210\u6587\u4EF6\u7EDF\u8BA1\u3001Token \u7528\u91CF\u3001\u6307\u4EE4\u6267\u884C\u7B49\u529F\u80FD"
};
var PluginManageService = class {
  constructor(app) {
    this.app = app;
  }
  getInstalledPlugins() {
    var _a, _b, _c;
    const plugins = this.app.plugins;
    if (!plugins)
      return [];
    const manifests = (_a = plugins.manifests) != null ? _a : {};
    const instances = (_b = plugins.plugins) != null ? _b : {};
    const enabledSet = (_c = plugins.enabledPlugins) != null ? _c : {};
    const isEnabled = (id) => {
      if (instances[id])
        return true;
      if (enabledSet instanceof Set)
        return enabledSet.has(id);
      return !!enabledSet[id];
    };
    return Object.entries(manifests).map(([id, manifest]) => {
      var _a2, _b2, _c2, _d;
      return {
        id,
        name: (_a2 = manifest.name) != null ? _a2 : id,
        version: (_b2 = manifest.version) != null ? _b2 : "?",
        enabled: isEnabled(id),
        hasSettings: true,
        description: (_d = (_c2 = ZH_DESCRIPTIONS[id]) != null ? _c2 : manifest.description) != null ? _d : ""
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }
  async togglePlugin(pluginId, enable) {
    const plugins = this.app.plugins;
    if (!plugins)
      throw new Error("\u65E0\u6CD5\u8BBF\u95EE\u63D2\u4EF6\u7BA1\u7406\u5668");
    if (enable) {
      await plugins.enablePluginAndSave(pluginId);
    } else {
      await plugins.disablePluginAndSave(pluginId);
    }
  }
  openPluginSettings() {
    var _a, _b, _c, _d;
    (_b = (_a = this.app.setting) == null ? void 0 : _a.open) == null ? void 0 : _b.call(_a);
    (_d = (_c = this.app.setting) == null ? void 0 : _c.openTabById) == null ? void 0 : _d.call(_c, "community-plugins");
  }
  openSpecificPluginSettings(pluginId) {
    const setting = this.app.setting;
    if (!setting)
      return;
    setting.open();
    setTimeout(() => {
      var _a, _b;
      if (typeof setting.openTabById === "function") {
        setting.openTabById(pluginId);
      }
      const tab = (_a = setting.settingTabs) == null ? void 0 : _a.find(
        (t) => {
          var _a2, _b2;
          return t.id === pluginId || ((_b2 = (_a2 = t.plugin) == null ? void 0 : _a2.manifest) == null ? void 0 : _b2.id) === pluginId;
        }
      );
      (_b = tab == null ? void 0 : tab.navEl) == null ? void 0 : _b.click();
    }, 150);
  }
};

// src/modules/plugin-manage/PluginManageComponent.ts
var PluginManageComponent = class extends BaseComponent {
  constructor(app, settings) {
    super(app, settings);
    this.pluginService = new PluginManageService(app);
  }
  get id() {
    return "plugin-manage";
  }
  async render(container) {
    const mod = container.createDiv("dashboard-module");
    const header = mod.createDiv("dashboard-module-header");
    const pmTitleWrap = header.createDiv("dashboard-module-title-wrap");
    pmTitleWrap.createEl("span", { text: "\u{1F50C}", cls: "dashboard-module-icon" });
    pmTitleWrap.createEl("span", { text: "\u63D2\u4EF6\u7BA1\u7406", cls: "dashboard-module-title" });
    const gearBtn = header.createEl("button", { cls: "dashboard-heatmap-config-btn", title: "Obsidian \u63D2\u4EF6\u8BBE\u7F6E" });
    gearBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
    gearBtn.addEventListener("click", () => this.pluginService.openPluginSettings());
    const body = mod.createDiv("dashboard-module-body");
    const plugins = this.pluginService.getInstalledPlugins();
    if (plugins.length === 0) {
      body.createDiv({ text: "\u672A\u68C0\u6D4B\u5230\u5DF2\u5B89\u88C5\u63D2\u4EF6", cls: "dashboard-empty" });
    } else {
      const table = body.createEl("table", { cls: "dashboard-plugin-table" });
      const hr = table.createEl("thead").createEl("tr");
      for (const h of ["\u63D2\u4EF6\u540D\u79F0", "\u8BF4\u660E", "\u7248\u672C", "\u542F\u7528", "\u8BBE\u7F6E"])
        hr.createEl("th", { text: h });
      const tbody = table.createEl("tbody");
      for (const p of plugins) {
        const tr = tbody.createEl("tr");
        const nameTd = tr.createEl("td");
        if (p.hasSettings) {
          const link = nameTd.createEl("a", { text: p.name, cls: "dashboard-plugin-link" });
          link.addEventListener("click", () => this.pluginService.openSpecificPluginSettings(p.id));
        } else {
          nameTd.textContent = p.name;
        }
        const descTd = tr.createEl("td", { cls: "dashboard-plugin-desc" });
        descTd.textContent = p.description || "\u2014";
        tr.createEl("td", { text: p.version, cls: "dashboard-plugin-version" });
        const toggleTd = tr.createEl("td");
        const toggle = toggleTd.createEl("label", { cls: "dashboard-toggle" });
        const cb = toggle.createEl("input");
        cb.type = "checkbox";
        cb.checked = p.enabled;
        toggle.createEl("span", { cls: "dashboard-toggle-slider" });
        cb.addEventListener("change", async () => {
          cb.disabled = true;
          try {
            await this.pluginService.togglePlugin(p.id, cb.checked);
            new import_obsidian21.Notice(`${p.name} \u5DF2${cb.checked ? "\u542F\u7528" : "\u7981\u7528"}`);
          } catch (e) {
            new import_obsidian21.Notice(`\u64CD\u4F5C\u5931\u8D25: ${e.message}`);
            cb.checked = !cb.checked;
          } finally {
            cb.disabled = false;
          }
        });
        const settingsTd = tr.createEl("td");
        const settingsBtn = settingsTd.createEl("button", { cls: "dashboard-icon-btn", title: `${p.name} \u8BBE\u7F6E` });
        settingsBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
        settingsBtn.addEventListener("click", () => {
          this.pluginService.openSpecificPluginSettings(p.id);
        });
      }
    }
  }
};

// src/modules/voice-transcription/VoiceTranscriptionComponent.ts
var import_obsidian23 = require("obsidian");

// src/modules/voice-transcription/VoiceTranscriptionService.ts
var VoiceTranscriptionService = class {
  constructor() {
    this.mediaRecorder = null;
    this.chunks = [];
    this.stream = null;
  }
  async startRecording() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm"
    });
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0)
        this.chunks.push(e.data);
    };
    this.mediaRecorder.start();
  }
  stopRecording() {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(new Blob());
        return;
      }
      this.mediaRecorder.onstop = () => {
        var _a;
        (_a = this.stream) == null ? void 0 : _a.getTracks().forEach((t) => t.stop());
        this.stream = null;
        const blob = new Blob(this.chunks, { type: "audio/webm" });
        resolve(blob);
      };
      this.mediaRecorder.stop();
    });
  }
  cancelRecording() {
    var _a;
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }
    (_a = this.stream) == null ? void 0 : _a.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.chunks = [];
    this.mediaRecorder = null;
  }
  async transcribe(audioBlob, apiBaseUrl, apiKey, model) {
    var _a;
    const formData = new FormData();
    formData.append("file", audioBlob, "recording.webm");
    formData.append("model", model);
    const response = await fetch(`${apiBaseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData
    });
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(
          "\u5F53\u524D API \u670D\u52A1\u5546\u4E0D\u652F\u6301 Whisper \u8BED\u97F3\u8F6C\u5199\uFF08404\uFF09\u3002\n\u8BF7\u4F7F\u7528 OpenAI \u6216\u517C\u5BB9 Whisper \u7684 API \u5730\u5740"
        );
      }
      const err = await response.json().catch(() => ({
        error: { message: response.statusText }
      }));
      throw new Error(
        ((_a = err.error) == null ? void 0 : _a.message) || `Whisper API error: ${response.status}`
      );
    }
    const data = await response.json();
    return data.text || "";
  }
};

// src/modules/voice-transcription/VoiceConfigModal.ts
var import_obsidian22 = require("obsidian");
var DEFAULT_WHISPER_MODEL = "whisper-1";
var VoiceConfigModal = class extends import_obsidian22.Modal {
  constructor(app, settings, onSave) {
    super(app);
    this.onSave = onSave;
    this.settings = JSON.parse(JSON.stringify(settings));
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("dashboard-modal");
    contentEl.createEl("h2", { text: "\u8BED\u97F3\u8F6C\u6587\u5B57\u914D\u7F6E" });
    this.createTextField(
      contentEl,
      "Whisper API \u5730\u5740",
      "whisperApiBaseUrl",
      "text",
      "https://api.openai.com/v1"
    );
    this.createTextField(
      contentEl,
      "Whisper \u6A21\u578B\u540D\u79F0",
      "whisperModelName",
      "text",
      DEFAULT_WHISPER_MODEL
    );
    contentEl.createDiv({
      text: "\u7559\u7A7A\u5219\u4F7F\u7528 Dashboard \u8BBE\u7F6E\u7684 API Base URL\u3002\u5982\u679C\u670D\u52A1\u5546\u4E0D\u652F\u6301 Whisper\uFF08\u5982 DeepSeek\uFF09\uFF0C\u8BF7\u586B\u5165 OpenAI \u7684\u5730\u5740\u3002",
      cls: "dashboard-field-hint"
    });
    const actions = contentEl.createDiv("dashboard-modal-actions");
    actions.style.cssText = "justify-content:flex-end;";
    actions.createEl("button", { text: "\u53D6\u6D88" }).addEventListener("click", () => this.close());
    const saveBtn = actions.createEl("button", { text: "\u4FDD\u5B58", cls: "mod-cta" });
    saveBtn.addEventListener("click", async () => {
      await this.onSave(this.settings);
      this.close();
      new import_obsidian22.Notice("\u8BED\u97F3\u8F6C\u6587\u5B57\u914D\u7F6E\u5DF2\u4FDD\u5B58");
    });
  }
  createTextField(parent, label, key, type, placeholder) {
    var _a;
    const row = parent.createDiv("dashboard-field");
    row.createEl("label", { text: label });
    const inputWrap = row.createDiv("dashboard-input-wrap");
    const input = inputWrap.createEl("input");
    input.type = type;
    input.placeholder = placeholder;
    input.value = String((_a = this.settings[key]) != null ? _a : "");
    input.addEventListener("input", () => {
      this.settings[key] = input.value;
    });
    const hint = inputWrap.createEl("span", {
      cls: "dashboard-example-hint",
      text: "\u{1F4CB}",
      attr: { "data-tooltip": placeholder }
    });
    hint.addEventListener("click", () => {
      input.value = placeholder;
      input.dispatchEvent(new Event("input"));
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/modules/voice-transcription/VoiceTranscriptionComponent.ts
var VoiceTranscriptionComponent = class extends BaseComponent {
  constructor(app, settings, onSettingsChange) {
    super(app, settings);
    this.modEl = null;
    this.timerInterval = null;
    this.state = "idle";
    this.recordingSeconds = 0;
    this.errorText = "";
    this.resultText = "";
    this.service = new VoiceTranscriptionService();
    this.onSettingsChange = onSettingsChange;
  }
  get id() {
    return "voice-transcription";
  }
  async render(container) {
    const mod = container.createDiv("dashboard-module");
    mod.id = "dashboard-voice-module";
    this.modEl = mod;
    this.buildHeader(mod);
    const body = mod.createDiv("dashboard-module-body");
    body.addClass("dashboard-voice-body");
    await this.buildBodyContent(body);
  }
  async update() {
    const mod = this.modEl;
    if (!mod || !mod.isConnected)
      return;
    const existingBody = mod.querySelector(".dashboard-module-body");
    if (existingBody)
      existingBody.remove();
    const body = mod.createDiv("dashboard-module-body");
    body.addClass("dashboard-voice-body");
    await this.buildBodyContent(body);
  }
  destroy() {
    this.stopTimer();
    this.service.cancelRecording();
    super.destroy();
  }
  // ── Internal ──
  buildHeader(mod) {
    const header = mod.createDiv("dashboard-module-header");
    const titleWrap = header.createDiv("dashboard-module-title-wrap");
    titleWrap.createEl("span", { text: "\u{1F3A4}", cls: "dashboard-module-icon" });
    titleWrap.createEl("span", { text: "\u8BED\u97F3\u8F6C\u6587\u5B57", cls: "dashboard-module-title" });
    const gearBtn = header.createEl("button", {
      cls: "dashboard-heatmap-config-btn",
      title: "\u8BED\u97F3\u8F6C\u6587\u5B57\u914D\u7F6E"
    });
    gearBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
    gearBtn.addEventListener("click", () => {
      new VoiceConfigModal(
        this.app,
        this.settings,
        async (s) => {
          await this.onSettingsChange(s);
          this.settings = s;
        }
      ).open();
    });
  }
  async buildBodyContent(body) {
    var _a;
    if (import_obsidian23.Platform.isMobile) {
      body.createDiv({
        text: "\u8BED\u97F3\u8F6C\u6587\u5B57\u4EC5\u5728\u684C\u9762\u7AEF\u53EF\u7528\uFF0C\u8BF7\u4F7F\u7528\u684C\u9762\u7AEF Obsidian\u3002",
        cls: "dashboard-voice-hint"
      });
      return;
    }
    if (!((_a = navigator.mediaDevices) == null ? void 0 : _a.getUserMedia)) {
      body.createDiv({
        text: "\u5F53\u524D\u73AF\u5883\u4E0D\u652F\u6301\u9EA6\u514B\u98CE\u5F55\u97F3\u3002\u8BF7\u5728\u684C\u9762\u7AEF Obsidian \u4E2D\u4F7F\u7528\u6B64\u529F\u80FD\u3002",
        cls: "dashboard-voice-hint"
      });
      return;
    }
    const content = body.createDiv("dashboard-voice-content");
    const btnWrap = content.createDiv("dashboard-voice-btn-wrap");
    const timerEl = content.createDiv("dashboard-voice-timer");
    const statusEl = content.createDiv("dashboard-voice-status");
    const resultWrap = content.createDiv("dashboard-voice-result-wrap");
    this.buildStateUI(btnWrap, timerEl, statusEl, resultWrap);
  }
  buildStateUI(btnWrap, timerEl, statusEl, resultWrap) {
    btnWrap.empty();
    const recordBtn = btnWrap.createEl("button", {
      cls: "dashboard-voice-record-btn"
    });
    timerEl.empty();
    statusEl.empty();
    resultWrap.empty();
    if (this.state === "idle") {
      recordBtn.textContent = "\u25CF \u5F00\u59CB\u5F55\u97F3";
      recordBtn.addEventListener("click", () => this.handleStart(btnWrap, timerEl, statusEl, resultWrap));
    } else if (this.state === "recording") {
      recordBtn.textContent = "\u25A0 \u505C\u6B62\u5F55\u97F3";
      recordBtn.addClass("recording");
      recordBtn.addEventListener("click", () => this.handleStop(btnWrap, timerEl, statusEl, resultWrap));
      timerEl.textContent = this.formatSeconds(this.recordingSeconds);
      this.startTimer(timerEl);
    } else if (this.state === "transcribing") {
      recordBtn.textContent = "\u25CF \u5F00\u59CB\u5F55\u97F3";
      recordBtn.disabled = true;
      statusEl.createDiv({ text: "\u8F6C\u5199\u4E2D...", cls: "dashboard-voice-transcribing" });
      const spinner = statusEl.createDiv("dashboard-voice-spinner");
      spinner.style.cssText = "width:24px;height:24px;border:3px solid var(--background-modifier-border);border-top-color:var(--interactive-accent);border-radius:50%;margin-top:8px;animation:dashboard-voice-spin 0.8s linear infinite;";
    } else if (this.state === "done") {
      recordBtn.textContent = "\u25CF \u5F00\u59CB\u5F55\u97F3";
      recordBtn.addEventListener("click", () => this.handleStart(btnWrap, timerEl, statusEl, resultWrap));
      if (this.resultText) {
        const textarea = resultWrap.createEl("textarea", {
          cls: "dashboard-voice-result",
          attr: { readonly: "true" }
        });
        textarea.value = this.resultText;
        const actions = resultWrap.createDiv("dashboard-voice-actions");
        const insertBtn = actions.createEl("button", {
          text: "\u63D2\u5165\u5230\u7F16\u8F91\u5668",
          cls: "mod-cta"
        });
        insertBtn.addEventListener("click", () => this.insertToEditor());
        const copyBtn = actions.createEl("button", {
          text: "\u590D\u5236"
        });
        copyBtn.addEventListener("click", () => this.copyToClipboard());
      }
    }
    if (this.errorText) {
      statusEl.createDiv({ text: this.errorText, cls: "dashboard-voice-error" });
    }
  }
  // ── Handlers ──
  async handleStart(btnWrap, timerEl, statusEl, resultWrap) {
    this.errorText = "";
    this.resultText = "";
    this.recordingSeconds = 0;
    try {
      await this.service.startRecording();
      this.state = "recording";
      this.buildStateUI(btnWrap, timerEl, statusEl, resultWrap);
    } catch (e) {
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
        this.errorText = "\u9EA6\u514B\u98CE\u6743\u9650\u88AB\u62D2\u7EDD\uFF0C\u8BF7\u5728\u7CFB\u7EDF\u8BBE\u7F6E\u4E2D\u5141\u8BB8 Obsidian \u8BBF\u95EE\u9EA6\u514B\u98CE\u3002";
      } else {
        this.errorText = `\u65E0\u6CD5\u5F00\u59CB\u5F55\u97F3: ${e.message}`;
      }
      this.state = "idle";
      this.buildStateUI(btnWrap, timerEl, statusEl, resultWrap);
    }
  }
  async handleStop(btnWrap, timerEl, statusEl, resultWrap) {
    this.stopTimer();
    this.state = "transcribing";
    this.buildStateUI(btnWrap, timerEl, statusEl, resultWrap);
    try {
      const blob = await this.service.stopRecording();
      const model = this.settings.whisperModelName || "whisper-1";
      const apiUrl = this.settings.whisperApiBaseUrl || this.settings.apiBaseUrl;
      const text = await this.service.transcribe(
        blob,
        apiUrl,
        this.settings.apiKey,
        model
      );
      this.resultText = text;
      this.state = "done";
    } catch (e) {
      this.errorText = `\u8F6C\u5199\u5931\u8D25: ${e.message}`;
      this.state = "idle";
    }
    this.buildStateUI(btnWrap, timerEl, statusEl, resultWrap);
  }
  insertToEditor() {
    var _a;
    const editor = (_a = this.app.workspace.activeEditor) == null ? void 0 : _a.editor;
    if (editor) {
      editor.replaceSelection(this.resultText);
      new import_obsidian23.Notice("\u5DF2\u63D2\u5165\u5230\u7F16\u8F91\u5668");
    } else {
      new import_obsidian23.Notice("\u6CA1\u6709\u6253\u5F00\u7684\u7F16\u8F91\u5668");
    }
  }
  async copyToClipboard() {
    try {
      await navigator.clipboard.writeText(this.resultText);
      new import_obsidian23.Notice("\u5DF2\u590D\u5236\u5230\u526A\u8D34\u677F");
    } catch (e) {
      new import_obsidian23.Notice("\u590D\u5236\u5931\u8D25");
    }
  }
  // ── Timer ──
  startTimer(displayEl) {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      this.recordingSeconds++;
      displayEl.textContent = this.formatSeconds(this.recordingSeconds);
    }, 1e3);
  }
  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }
  formatSeconds(total) {
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
};

// src/modules/large-files/LargeFilesComponent.ts
var import_obsidian25 = require("obsidian");

// src/modules/large-files/LargeFilesConfigModal.ts
var import_obsidian24 = require("obsidian");
var LargeFilesConfigModal = class extends import_obsidian24.Modal {
  constructor(app, settings, onSave) {
    super(app);
    this.settings = { ...settings };
    this.onSave = onSave;
    this.minSizeKB = settings.largeFilesMinSizeKB;
    this.maxCount = settings.largeFilesMaxCount;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("dashboard-modal");
    contentEl.createEl("h2", { text: "\u5927\u6587\u4EF6\u914D\u7F6E" });
    const field1 = contentEl.createDiv("dashboard-field");
    field1.createEl("label", { text: "\u6700\u5C0F\u6587\u4EF6\u5927\u5C0F\uFF08KB\uFF09\uFF0C\u4F4E\u4E8E\u6B64\u5927\u5C0F\u7684\u6587\u4EF6\u4E0D\u663E\u793A" });
    const input1 = field1.createEl("input", {
      type: "number",
      value: String(this.minSizeKB),
      attr: { min: "0", step: "1" }
    });
    input1.addEventListener("change", () => {
      this.minSizeKB = Math.max(0, parseInt(input1.value) || 0);
    });
    const field2 = contentEl.createDiv("dashboard-field");
    field2.createEl("label", { text: "\u6700\u591A\u663E\u793A\u6761\u6570" });
    const input2 = field2.createEl("input", {
      type: "number",
      value: String(this.maxCount),
      attr: { min: "1", max: "100", step: "1" }
    });
    input2.addEventListener("change", () => {
      this.maxCount = Math.max(1, Math.min(100, parseInt(input2.value) || 20));
    });
    const actions = contentEl.createDiv("dashboard-modal-actions");
    actions.style.cssText = "justify-content:flex-end;";
    actions.createEl("button", { text: "\u53D6\u6D88" }).addEventListener("click", () => this.close());
    const saveBtn = actions.createEl("button", { text: "\u4FDD\u5B58", cls: "mod-cta" });
    saveBtn.addEventListener("click", () => {
      this.settings.largeFilesMinSizeKB = this.minSizeKB;
      this.settings.largeFilesMaxCount = this.maxCount;
      this.onSave(this.settings);
      this.close();
      new import_obsidian24.Notice("\u5927\u6587\u4EF6\u914D\u7F6E\u5DF2\u4FDD\u5B58");
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/modules/large-files/LargeFilesComponent.ts
function formatSize2(bytes) {
  if (bytes >= 1e9)
    return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6)
    return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3)
    return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes} B`;
}
var LargeFilesComponent = class extends BaseComponent {
  constructor(app, settings, onSettingsChange) {
    super(app, settings);
    this.onSettingsChange = onSettingsChange;
  }
  get id() {
    return "large-files";
  }
  async render(container) {
    const mod = container.createDiv("dashboard-module");
    const header = mod.createDiv("dashboard-module-header");
    const titleWrap = header.createDiv("dashboard-module-title-wrap");
    titleWrap.createEl("span", { text: "\u{1F4E6}", cls: "dashboard-module-icon" });
    titleWrap.createEl("span", { text: "\u5927\u6587\u4EF6", cls: "dashboard-module-title" });
    const gearBtn = header.createEl("button", {
      cls: "dashboard-icon-btn",
      title: "\u5927\u6587\u4EF6\u914D\u7F6E"
    });
    gearBtn.style.marginLeft = "auto";
    gearBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
    gearBtn.addEventListener("click", () => {
      new LargeFilesConfigModal(this.app, this.settings, async (s) => {
        await this.onSettingsChange(s);
      }).open();
    });
    const body = mod.createDiv("dashboard-module-body");
    const minSizeBytes = this.settings.largeFilesMinSizeKB * 1e3;
    const maxCount = this.settings.largeFilesMaxCount;
    const allFiles = this.app.vault.getFiles();
    const filtered = allFiles.filter((f) => f.stat.size >= minSizeBytes).sort((a, b) => b.stat.size - a.stat.size).slice(0, maxCount).map((f) => ({ path: f.path, size: f.stat.size }));
    if (filtered.length === 0) {
      body.createDiv({ text: "\u6682\u65E0\u7B26\u5408\u6761\u4EF6\u7684\u5927\u6587\u4EF6", cls: "dashboard-empty" });
      return;
    }
    const list = body.createDiv("dashboard-large-file-list");
    for (const item of filtered) {
      const row = list.createDiv("dashboard-large-file-row");
      const nameEl = row.createEl("span", {
        text: item.path,
        cls: "dashboard-large-file-path",
        title: item.path
      });
      nameEl.addEventListener("click", () => {
        const f = this.app.vault.getAbstractFileByPath(item.path);
        if (f instanceof import_obsidian25.TFile)
          this.app.workspace.getLeaf(false).openFile(f);
      });
      row.createEl("span", {
        text: formatSize2(item.size),
        cls: "dashboard-large-file-size"
      });
    }
  }
};

// src/ui/DashboardView.ts
var DASHBOARD_VIEW_TYPE = "yy-obsidian-dashboard";
var DashboardView = class extends import_obsidian26.ItemView {
  constructor(leaf, settings, onSettingsChange) {
    super(leaf);
    // Component map by ID (for moduleOrder lookup)
    this.components = {};
    // State
    this.rendering = false;
    this.needsRerender = false;
    this.lastRenderTime = 0;
    this.autoRefreshTimer = null;
    this.visibilityTimer = null;
    this.gitRefreshTimer = null;
    this.AUTO_REFRESH_COOLDOWN = 5 * 60 * 1e3;
    this.VISIBILITY_CHECK_INTERVAL = 30 * 60 * 1e3;
    this.settings = settings;
    this.onSettingsChange = onSettingsChange;
    this.fileService = new FileService(this.app);
    this.logService = new LogService(this.app);
    this.llmService = new LLMService(this.app, settings, settings.tokenUsageDataPath);
    this.heatmapService = new HeatmapService(this.app, settings.heatmapDataPath);
    this.gitService = new GitService(this.app);
    this.remotelySaveService = new RemotelySaveService();
    this.reportService = new ReportService(this.app, settings);
    this.headerComponent = new HeaderComponent(
      this.app,
      settings,
      this.llmService,
      async (s) => {
        await this.onSettingsChange(s);
        this.updateSettings(s);
      },
      () => this.render()
    );
    this.searchComponent = new SearchComponent(this.app, settings);
    this.workspaceBarComponent = new WorkspaceBarComponent(this.app, settings, this.fileService, this.reportService);
    this.fileStatsComponent = new FileStatsComponent(
      this.app,
      settings,
      async (s) => {
        await this.onSettingsChange(s);
        this.updateSettings(s);
      }
    );
    this.heatmapComponent = new HeatmapComponent(
      this.app,
      settings,
      this.heatmapService,
      async (s) => {
        await this.onSettingsChange(s);
        this.updateSettings(s);
      }
    );
    this.llmCommandComponent = new LLMCommandComponent(
      this.app,
      settings,
      this.llmService,
      () => this.headerComponent.refreshTokenBar()
    );
    this.operationLogComponent = new OperationLogComponent(this.app, settings, this.logService);
    this.gitSyncComponent = new GitSyncComponent(
      this.app,
      settings,
      this.gitService,
      async (s) => {
        await this.onSettingsChange(s);
        this.updateSettings(s);
      },
      () => this.gitSyncComponent.setupAutoPush()
    );
    this.remotelySaveComponent = new RemotelySaveComponent(this.app, settings);
    this.taskQuickAddComponent = new TaskQuickAddComponent(
      this.app,
      settings,
      async (s) => {
        await this.onSettingsChange(s);
        this.updateSettings(s);
      }
    );
    this.pluginManageComponent = new PluginManageComponent(this.app, settings);
    this.voiceTranscriptionComponent = new VoiceTranscriptionComponent(
      this.app,
      settings,
      async (s) => {
        await this.onSettingsChange(s);
        this.updateSettings(s);
      }
    );
    this.largeFilesComponent = new LargeFilesComponent(
      this.app,
      settings,
      async (s) => {
        await this.onSettingsChange(s);
        this.updateSettings(s);
      }
    );
    this.components = {
      "header": this.headerComponent,
      "search": this.searchComponent,
      "workspace-bar": this.workspaceBarComponent,
      "file-stats": this.fileStatsComponent,
      "heatmap": this.heatmapComponent,
      "llm-command": this.llmCommandComponent,
      "operation-log": this.operationLogComponent,
      "git-sync": this.gitSyncComponent,
      "remotely-save": this.remotelySaveComponent,
      "task-quickadd": this.taskQuickAddComponent,
      "plugin-manage": this.pluginManageComponent,
      "voice-transcription": this.voiceTranscriptionComponent,
      "large-files": this.largeFilesComponent
    };
  }
  getViewType() {
    return DASHBOARD_VIEW_TYPE;
  }
  getDisplayText() {
    return this.settings.dashboardTitle || "Dashboard";
  }
  getIcon() {
    return "layout-dashboard";
  }
  updateSettings(settings) {
    this.settings = settings;
    this.llmService.updateSettings(settings);
    this.reportService.updateSettings(settings);
    for (const comp of Object.values(this.components)) {
      comp.updateSettings(settings);
    }
    this.updateTabTitle();
    this.render();
  }
  updateTabTitle() {
    var _a;
    const title = this.settings.dashboardTitle || "Dashboard";
    const viewHeaderTitle = this.containerEl.querySelector(".view-header-title");
    if (viewHeaderTitle)
      viewHeaderTitle.textContent = title;
    const leafAny = this.leaf;
    const tabTitleEl = (_a = leafAny.tabHeaderEl) == null ? void 0 : _a.querySelector(".workspace-tab-header-inner-title");
    if (tabTitleEl) {
      tabTitleEl.textContent = title;
      return;
    }
    const leafContent = this.containerEl.closest(".workspace-leaf");
    if (!leafContent)
      return;
    const workspaceTabs = leafContent.closest(".workspace-tabs");
    if (!workspaceTabs)
      return;
    const tabContainer = workspaceTabs.querySelector(":scope > .workspace-tab-container");
    const leaves = tabContainer ? Array.from(tabContainer.querySelectorAll(":scope > .workspace-leaf")) : [];
    const leafIndex = leaves.indexOf(leafContent);
    if (leafIndex < 0)
      return;
    const headerInner = workspaceTabs.querySelector(
      ":scope > .workspace-tab-header-container > .workspace-tab-header-container-inner"
    );
    const tabHeaders = headerInner ? Array.from(headerInner.querySelectorAll(":scope > .workspace-tab-header")) : [];
    const targetHeader = tabHeaders[leafIndex];
    if (targetHeader) {
      const innerTitle = targetHeader.querySelector(".workspace-tab-header-inner-title");
      if (innerTitle)
        innerTitle.textContent = title;
    }
  }
  async onOpen() {
    this.heatmapService.startTracking();
    this.onVaultChange = () => {
      if (this.autoRefreshTimer)
        clearTimeout(this.autoRefreshTimer);
      this.autoRefreshTimer = setTimeout(() => {
        this.fileStatsComponent.refreshExternal();
      }, 800);
      if (this.settings.gitEnabled) {
        if (this.gitRefreshTimer)
          clearTimeout(this.gitRefreshTimer);
        this.gitRefreshTimer = setTimeout(() => {
          this.gitSyncComponent.update();
        }, 3e3);
      }
      this.gitSyncComponent.triggerAutoPushDebounce();
    };
    this.app.vault.on("modify", this.onVaultChange);
    this.app.vault.on("create", this.onVaultChange);
    this.app.vault.on("delete", this.onVaultChange);
    this.app.vault.on("rename", this.onVaultChange);
    this.gitSyncComponent.setupAutoPush();
    this.gitSyncComponent.startPolling();
    this.onActiveLeafChange = (leaf) => {
      if (leaf.view === this) {
        this.gitSyncComponent.startPolling();
        const elapsed = Date.now() - this.lastRenderTime;
        if (elapsed > this.AUTO_REFRESH_COOLDOWN) {
          this.render();
        }
      } else {
        this.gitSyncComponent.stopPolling();
      }
    };
    this.app.workspace.on("active-leaf-change", this.onActiveLeafChange);
    this.visibilityTimer = setInterval(() => {
      var _a;
      if (((_a = this.app.workspace.activeLeaf) == null ? void 0 : _a.view) === this) {
        const elapsed = Date.now() - this.lastRenderTime;
        if (elapsed > this.VISIBILITY_CHECK_INTERVAL) {
          this.render();
        }
      }
    }, this.VISIBILITY_CHECK_INTERVAL);
    await this.render();
  }
  async onClose() {
    this.heatmapService.stopTracking();
    if (this.onVaultChange) {
      this.app.vault.off("modify", this.onVaultChange);
      this.app.vault.off("create", this.onVaultChange);
      this.app.vault.off("delete", this.onVaultChange);
      this.app.vault.off("rename", this.onVaultChange);
    }
    if (this.onActiveLeafChange) {
      this.app.workspace.off("active-leaf-change", this.onActiveLeafChange);
    }
    if (this.autoRefreshTimer)
      clearTimeout(this.autoRefreshTimer);
    if (this.gitRefreshTimer)
      clearTimeout(this.gitRefreshTimer);
    if (this.visibilityTimer)
      clearInterval(this.visibilityTimer);
    document.body.querySelectorAll(".dashboard-heatmap-tip, .dashboard-popover").forEach((el) => el.remove());
    for (const comp of Object.values(this.components)) {
      comp.destroy();
    }
  }
  async render() {
    var _a;
    if (this.rendering) {
      this.needsRerender = true;
      return;
    }
    this.rendering = true;
    this.needsRerender = false;
    try {
      document.body.querySelectorAll(".dashboard-heatmap-tip, .dashboard-popover").forEach((el) => el.remove());
      this.lastRenderTime = Date.now();
      const container = this.containerEl.children[1];
      const oldScroll = container.querySelector(".dashboard-scroll");
      const scrollTop = (_a = oldScroll == null ? void 0 : oldScroll.scrollTop) != null ? _a : 0;
      const containerScrollTop = container.scrollTop;
      const offscreen = document.createElement("div");
      offscreen.addClass("dashboard-root");
      await this.headerComponent.render(offscreen);
      await this.searchComponent.render(offscreen);
      await this.workspaceBarComponent.render(offscreen);
      const scroll = offscreen.createDiv("dashboard-scroll");
      const order = this.settings.moduleOrder || [];
      const visibility = this.settings.moduleVisibility || {};
      const deviceVisibility = this.settings.moduleDeviceVisibility || {};
      const isPhone = import_obsidian26.Platform.isPhone;
      const visibleOrder = [];
      for (const moduleId of order) {
        if (visibility[moduleId] === false)
          continue;
        const device = deviceVisibility[moduleId] || "both";
        if (device === "desktop" && isPhone)
          continue;
        if (device === "mobile" && !isPhone)
          continue;
        const comp = this.components[moduleId];
        if (!comp)
          continue;
        visibleOrder.push(moduleId);
        await comp.render(scroll);
      }
      const moduleEls = scroll.querySelectorAll(".dashboard-module");
      moduleEls.forEach((modEl, index) => {
        const moduleId = visibleOrder[index];
        if (!moduleId)
          return;
        modEl.setAttribute("data-module-id", moduleId);
        const header = modEl.querySelector(".dashboard-module-header");
        if (!header)
          return;
        if (isModuleCollapsed(moduleId)) {
          modEl.classList.add("dashboard-module-collapsed");
        }
        const toggle = document.createElement("span");
        toggle.className = "dashboard-module-collapse-toggle";
        toggle.innerHTML = "\u25BE";
        toggle.setAttribute("title", "\u6298\u53E0/\u5C55\u5F00");
        toggle.addEventListener("click", (e) => {
          e.stopPropagation();
          const collapsed = modEl.classList.toggle("dashboard-module-collapsed");
          setModuleCollapsed(moduleId, collapsed);
        });
        header.addEventListener("click", (e) => {
          const target = e.target;
          if (target.closest(".dashboard-module-collapse-toggle") || target.closest(".dashboard-module-drag-handle") || target.closest("button") || target.closest("a") || target.closest("input") || target.closest("select")) {
            return;
          }
          const collapsed = modEl.classList.toggle("dashboard-module-collapsed");
          setModuleCollapsed(moduleId, collapsed);
        });
        const handle = document.createElement("span");
        handle.className = "dashboard-module-drag-handle";
        handle.innerHTML = "\u22EE\u22EE";
        handle.setAttribute("draggable", "true");
        handle.setAttribute("title", "\u62D6\u62FD\u6392\u5E8F");
        handle.addEventListener("dragstart", (e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", moduleId);
          modEl.classList.add("dragging");
        });
        handle.addEventListener("dragend", () => {
          modEl.classList.remove("dragging");
          scroll.querySelectorAll(".dashboard-module").forEach((el) => el.classList.remove("drag-over"));
        });
        header.prepend(toggle);
        header.prepend(handle);
        modEl.addEventListener("dragover", (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          const dragging = scroll.querySelector(".dashboard-module.dragging");
          if (!dragging || dragging === modEl)
            return;
          modEl.classList.add("drag-over");
        });
        modEl.addEventListener("dragleave", (e) => {
          if (!modEl.contains(e.relatedTarget)) {
            modEl.classList.remove("drag-over");
          }
        });
        modEl.addEventListener("drop", async (e) => {
          e.preventDefault();
          modEl.classList.remove("drag-over");
          const fromId = e.dataTransfer.getData("text/plain");
          if (!fromId || fromId === moduleId)
            return;
          const newOrder = [...this.settings.moduleOrder];
          const fromIdx = newOrder.indexOf(fromId);
          const toIdx = newOrder.indexOf(moduleId);
          if (fromIdx === -1 || toIdx === -1)
            return;
          newOrder.splice(fromIdx, 1);
          newOrder.splice(toIdx, 0, fromId);
          this.settings.moduleOrder = newOrder;
          await this.onSettingsChange(this.settings);
        });
      });
      container.replaceChildren(offscreen);
      container.scrollTop = containerScrollTop;
      scroll.scrollTop = scrollTop;
    } finally {
      this.rendering = false;
      if (this.needsRerender) {
        this.needsRerender = false;
        await this.render();
      }
    }
  }
};

// src/modules/llm-command/settings.ts
var import_obsidian27 = require("obsidian");
function addExampleHint(setting, example) {
  const input = setting.controlEl.querySelector("input");
  if (!input)
    return;
  const hint = createSpan({ cls: "dashboard-example-hint", text: "\u{1F4CB}", attr: { "data-tooltip": example } });
  hint.addEventListener("click", () => {
    input.value = example;
    input.dispatchEvent(new Event("input"));
  });
  setting.controlEl.appendChild(hint);
}
function renderLLMSettings(containerEl, ctx) {
  containerEl.createEl("h3", { text: "\u6A21\u578B\u914D\u7F6E" });
  const s1 = new import_obsidian27.Setting(containerEl).setName("API Base URL").setDesc("OpenAI Compatible \u63A5\u53E3\u5730\u5740").addText(
    (text) => text.setPlaceholder("https://api.openai.com/v1").setValue(ctx.settings.apiBaseUrl).onChange(async (value) => {
      ctx.settings.apiBaseUrl = value;
      await ctx.saveSettings();
    })
  );
  addExampleHint(s1, "https://api.openai.com/v1");
  new import_obsidian27.Setting(containerEl).setName("API Key").setDesc("\u4F60\u7684 API \u5BC6\u94A5\u3002\u26A0 \u660E\u6587\u4FDD\u5B58\u5728 data.json\uFF0C\u82E5\u542F\u7528 Git \u540C\u6B65\u8BF7\u786E\u8BA4\u5DF2\u5FFD\u7565\u8BE5\u6587\u4EF6").addText((text) => {
    text.setPlaceholder("sk-...").setValue(ctx.settings.apiKey).onChange(async (value) => {
      ctx.settings.apiKey = value;
      await ctx.saveSettings();
    });
    text.inputEl.type = "password";
  });
  const s2 = new import_obsidian27.Setting(containerEl).setName("\u6A21\u578B\u540D\u79F0").addText(
    (text) => text.setPlaceholder("gpt-4o").setValue(ctx.settings.modelName).onChange(async (value) => {
      ctx.settings.modelName = value;
      await ctx.saveSettings();
    })
  );
  addExampleHint(s2, "gpt-4o");
  new import_obsidian27.Setting(containerEl).setName("Temperature").addSlider(
    (slider) => slider.setLimits(0, 2, 0.1).setValue(ctx.settings.temperature).setDynamicTooltip().onChange(async (value) => {
      ctx.settings.temperature = value;
      await ctx.saveSettings();
    })
  );
  new import_obsidian27.Setting(containerEl).setName("Max Tokens").addText(
    (text) => text.setValue(String(ctx.settings.maxTokens)).onChange(async (value) => {
      const n = parseInt(value);
      if (!isNaN(n)) {
        ctx.settings.maxTokens = n;
        await ctx.saveSettings();
      }
    })
  );
  new import_obsidian27.Setting(containerEl).setName("\u7528\u91CF\u63A5\u53E3\u5730\u5740").setDesc("\u9009\u586B\u3002\u586B\u5199\u540E\u4F18\u5148\u4F7F\u7528\u63A5\u53E3\u6570\u636E\uFF0C\u5426\u5219\u7528\u672C\u5730\u7EDF\u8BA1").addText(
    (text) => text.setPlaceholder("https://...").setValue(ctx.settings.tokenUsageApiUrl).onChange(async (value) => {
      ctx.settings.tokenUsageApiUrl = value;
      await ctx.saveSettings();
    })
  );
  const s3 = new import_obsidian27.Setting(containerEl).setName("\u4F59\u989D\u63A5\u53E3\u5730\u5740").setDesc("\u9009\u586B\u3002\u5982 DeepSeek: https://api.deepseek.com/user/balance").addText(
    (text) => text.setPlaceholder("https://...").setValue(ctx.settings.tokenBalanceApiUrl).onChange(async (value) => {
      ctx.settings.tokenBalanceApiUrl = value;
      await ctx.saveSettings();
    })
  );
  addExampleHint(s3, "https://api.deepseek.com/user/balance");
}

// src/modules/file-stats/settings.ts
var import_obsidian28 = require("obsidian");
function renderFileStatsSettings(containerEl, ctx) {
  containerEl.createEl("h3", { text: "\u6587\u4EF6\u7EDF\u8BA1" });
  new import_obsidian28.Setting(containerEl).setName("\u7EDF\u8BA1\u6587\u4EF6\u5939").setDesc("\u9017\u53F7\u5206\u9694\u7684\u6587\u4EF6\u5939\u8DEF\u5F84\u5217\u8868\uFF0C\u5982 raw, wiki, raw/\u5B50\u76EE\u5F55").addText(
    (text) => text.setValue(ctx.settings.trackedFolders.join(", ")).onChange(async (value) => {
      ctx.settings.trackedFolders = value.split(",").map((s) => s.trim()).filter(Boolean);
      await ctx.saveSettings();
    })
  );
}

// src/modules/heatmap/settings.ts
var import_obsidian29 = require("obsidian");
var reportLabels = {
  daily: "\u65E5\u62A5",
  weekly: "\u5468\u62A5",
  monthly: "\u6708\u62A5",
  quarterly: "\u5B63\u62A5",
  yearly: "\u5E74\u62A5"
};
function renderReportSettings(containerEl, ctx) {
  containerEl.createEl("h3", { text: "\u62A5\u8868\u914D\u7F6E" });
  for (const type of Object.keys(reportLabels)) {
    const cfg = ctx.settings.reportConfigs[type];
    containerEl.createEl("h4", { text: reportLabels[type] });
    new import_obsidian29.Setting(containerEl).setName("\u542F\u7528").addToggle(
      (toggle) => toggle.setValue(cfg.enabled).onChange(async (value) => {
        cfg.enabled = value;
        await ctx.saveSettings();
      })
    );
    new import_obsidian29.Setting(containerEl).setName("\u65B0\u5EFA\u65F6\u5F39\u7A97\u786E\u8BA4").setDesc("\u70B9\u51FB\u6CA1\u6709\u5BF9\u5E94\u62A5\u544A\u7684\u65E5\u671F\u65F6\uFF0C\u662F\u5426\u5148\u5F39\u7A97\u786E\u8BA4\u518D\u65B0\u5EFA").addToggle(
      (toggle) => toggle.setValue(cfg.confirmBeforeCreate).onChange(async (value) => {
        cfg.confirmBeforeCreate = value;
        await ctx.saveSettings();
      })
    );
    new import_obsidian29.Setting(containerEl).setName("\u5B58\u653E\u76EE\u5F55").setDesc("\u6587\u4EF6\u5B58\u50A8\u7684\u6839\u76EE\u5F55").addText(
      (text) => text.setValue(cfg.directory).onChange(async (value) => {
        cfg.directory = value.trim();
        await ctx.saveSettings();
      })
    );
    new import_obsidian29.Setting(containerEl).setName("\u6587\u4EF6\u8DEF\u5F84\u683C\u5F0F").setDesc("\u652F\u6301 YYYY/YY/MM/M/DD/D \u7B49 moment.js \u683C\u5F0F\u4EE4\u724C\u3002\u5982 YYYY/MM/YYYY-MM-DD").addText(
      (text) => text.setValue(cfg.filenameFormat).onChange(async (value) => {
        cfg.filenameFormat = value.trim();
        await ctx.saveSettings();
      })
    );
    new import_obsidian29.Setting(containerEl).setName("\u6A21\u677F\u8DEF\u5F84").setDesc("vault \u4E2D\u7684\u6A21\u677F\u6587\u4EF6\u8DEF\u5F84\uFF08\u4E0D\u542B .md \u540E\u7F00\uFF09\uFF0C\u7559\u7A7A\u5219\u4E0D\u4F7F\u7528\u6A21\u677F").addText(
      (text) => text.setValue(cfg.templatePath).onChange(async (value) => {
        cfg.templatePath = value.trim();
        await ctx.saveSettings();
      })
    );
  }
}

// src/modules/git-sync/settings.ts
var import_obsidian30 = require("obsidian");
function addExampleHint2(setting, example) {
  const input = setting.controlEl.querySelector("input");
  if (!input)
    return;
  const hint = createSpan({ cls: "dashboard-example-hint", text: "\u{1F4CB}", attr: { "data-tooltip": example } });
  hint.addEventListener("click", () => {
    input.value = example;
    input.dispatchEvent(new Event("input"));
  });
  setting.controlEl.appendChild(hint);
}
function addCommitPreview(setting) {
  const input = setting.controlEl.querySelector("input");
  if (!input)
    return;
  const preview = createSpan({ cls: "dashboard-format-preview" });
  const updatePreview = () => {
    const now = /* @__PURE__ */ new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const time = now.toTimeString().slice(0, 8);
    const val = input.value || input.placeholder;
    const example = val.replace(/\{\{date\}\}/g, date).replace(/\{\{time\}\}/g, time);
    preview.textContent = `\u793A\u4F8B: ${example}`;
  };
  updatePreview();
  input.addEventListener("input", updatePreview);
  setting.descEl.appendChild(preview);
}
function renderGitSettings(containerEl, ctx) {
  containerEl.createEl("h3", { text: "Git \u540C\u6B65 (GitHub)" });
  new import_obsidian30.Setting(containerEl).setName("\u542F\u7528 Git \u540C\u6B65").setDesc("\u5F00\u542F\u540E\u53EF\u5728 Dashboard \u4E2D\u8FDB\u884C Push/Pull \u64CD\u4F5C").addToggle(
    (toggle) => toggle.setValue(ctx.settings.gitEnabled).onChange(async (value) => {
      ctx.settings.gitEnabled = value;
      await ctx.saveSettings();
    })
  );
  const s1 = new import_obsidian30.Setting(containerEl).setName("\u4ED3\u5E93\u5730\u5740").setDesc("GitHub \u4ED3\u5E93 HTTPS \u5730\u5740\uFF0C\u5982 https://github.com/username/repo.git").addText(
    (text) => text.setPlaceholder("https://github.com/username/repo.git").setValue(ctx.settings.gitRemoteURL).onChange(async (value) => {
      ctx.settings.gitRemoteURL = value.trim();
      await ctx.saveSettings();
    })
  );
  addExampleHint2(s1, "https://github.com/username/repo.git");
  const s2 = new import_obsidian30.Setting(containerEl).setName("\u8FDC\u7A0B\u540D\u79F0").setDesc("Git remote \u540D\u79F0\uFF0C\u9ED8\u8BA4 origin").addText(
    (text) => text.setPlaceholder("origin").setValue(ctx.settings.gitRemoteName).onChange(async (value) => {
      ctx.settings.gitRemoteName = value.trim() || "origin";
      await ctx.saveSettings();
    })
  );
  addExampleHint2(s2, "origin");
  const s3 = new import_obsidian30.Setting(containerEl).setName("\u5206\u652F\u540D").setDesc("\u9ED8\u8BA4\u5206\u652F\u540D\uFF0C\u5982 main \u6216 master").addText(
    (text) => text.setPlaceholder("main").setValue(ctx.settings.gitBranchName).onChange(async (value) => {
      ctx.settings.gitBranchName = value.trim() || "main";
      await ctx.saveSettings();
    })
  );
  addExampleHint2(s3, "main");
  const s4 = new import_obsidian30.Setting(containerEl).setName("GitHub \u7528\u6237\u540D").setDesc("GitHub \u767B\u5F55\u7528\u6237\u540D\u6216\u90AE\u7BB1").addText(
    (text) => text.setPlaceholder("your-username").setValue(ctx.settings.gitUsername).onChange(async (value) => {
      ctx.settings.gitUsername = value.trim();
      await ctx.saveSettings();
    })
  );
  addExampleHint2(s4, "your-username");
  new import_obsidian30.Setting(containerEl).setName("GitHub Token").setDesc("GitHub \u79C1\u4EBA\u4EE4\u724C\uFF08https://github.com/settings/tokens\uFF09\u3002\u26A0 \u660E\u6587\u4FDD\u5B58\u5728 data.json\uFF0C\u8BF7\u52A1\u5FC5\u5C06\u8BE5\u6587\u4EF6\u52A0\u5165 .gitignore").addText((text) => {
    text.setPlaceholder("your-token").setValue(ctx.settings.gitPassword).onChange(async (value) => {
      ctx.settings.gitPassword = value.trim();
      await ctx.saveSettings();
    });
    text.inputEl.type = "password";
  });
  new import_obsidian30.Setting(containerEl).setName("\u81EA\u52A8 Push").setDesc("\u5F00\u542F\u540E\u6309\u8BBE\u5B9A\u7684\u65F6\u95F4\u95F4\u9694\u81EA\u52A8 push").addToggle(
    (toggle) => toggle.setValue(ctx.settings.gitAutoPushEnabled).onChange(async (value) => {
      ctx.settings.gitAutoPushEnabled = value;
      await ctx.saveSettings();
    })
  );
  const s5 = new import_obsidian30.Setting(containerEl).setName("\u81EA\u52A8 Push \u95F4\u9694\uFF08\u5206\u949F\uFF09").setDesc("\u8BBE\u4E3A 0 \u8868\u793A\u6BCF\u6B21 vault \u53D8\u66F4\u540E\u81EA\u52A8 push").addText(
    (text) => text.setPlaceholder("30").setValue(String(ctx.settings.gitAutoPushInterval)).onChange(async (value) => {
      const n = parseInt(value);
      if (!isNaN(n) && n >= 0) {
        ctx.settings.gitAutoPushInterval = n;
        await ctx.saveSettings();
      }
    })
  );
  addExampleHint2(s5, "30");
  const sPoll = new import_obsidian30.Setting(containerEl).setName("Git \u72B6\u6001\u5237\u65B0\u95F4\u9694\uFF08\u79D2\uFF09").setDesc("Dashboard \u4E2D Git \u6A21\u5757\u81EA\u52A8\u5237\u65B0 status \u7684\u95F4\u9694\u3002\u8BBE\u4E3A 0 \u8868\u793A\u4E0D\u8F6E\u8BE2\uFF08\u4ECD\u4F1A\u5728 vault \u53D8\u66F4\u65F6\u5237\u65B0\uFF09").addText(
    (text) => text.setPlaceholder("30").setValue(String(ctx.settings.gitPollInterval)).onChange(async (value) => {
      const n = parseInt(value);
      if (!isNaN(n) && n >= 0) {
        ctx.settings.gitPollInterval = n;
        await ctx.saveSettings();
      }
    })
  );
  addExampleHint2(sPoll, "30");
  const sTimeout = new import_obsidian30.Setting(containerEl).setName("Push/Pull \u8D85\u65F6\uFF08\u5206\u949F\uFF09").setDesc("\u7F51\u7EDC\u4F20\u8F93\u8D85\u65F6\u65F6\u95F4\u3002\u8BBE\u4E3A 0 \u8868\u793A\u4E0D\u9650\u65F6\uFF1B\u5927\u4ED3\u5E93\u9996\u6B21\u63A8\u9001\u5EFA\u8BAE\u8BBE 10 \u6216\u66F4\u5927").addText(
    (text) => text.setPlaceholder("5").setValue(String(ctx.settings.gitPushTimeout)).onChange(async (value) => {
      const n = parseInt(value);
      if (!isNaN(n) && n >= 0) {
        ctx.settings.gitPushTimeout = n;
        await ctx.saveSettings();
      }
    })
  );
  addExampleHint2(sTimeout, "5");
  const s6 = new import_obsidian30.Setting(containerEl).setName("Commit \u6D88\u606F\u6A21\u677F").setDesc("\u652F\u6301 {{date}} \u548C {{time}} \u5360\u4F4D\u7B26").addText(
    (text) => text.setPlaceholder("auto: {{date}} {{time}}").setValue(ctx.settings.gitCommitTemplate).onChange(async (value) => {
      ctx.settings.gitCommitTemplate = value.trim();
      await ctx.saveSettings();
    })
  );
  addExampleHint2(s6, "auto: {{date}} {{time}}");
  addCommitPreview(s6);
}

// src/main.ts
var LLMWikiDashboardPlugin = class extends import_obsidian31.Plugin {
  async onload() {
    await this.loadSettings();
    this.registerView(
      DASHBOARD_VIEW_TYPE,
      (leaf) => new DashboardView(leaf, this.settings, this.saveSettings.bind(this))
    );
    this.addRibbonIcon("layout-dashboard", "\u6253\u5F00 Dashboard", () => {
      this.activateView();
    });
    this.addCommand({
      id: "open-dashboard",
      name: "\u6253\u5F00 Dashboard",
      callback: () => this.activateView()
    });
    this.addSettingTab(new DashboardSettingTab(this.app, this));
    if (this.settings.openOnStartup) {
      this.app.workspace.onLayoutReady(() => this.activateView());
    }
  }
  async onunload() {
    this.app.workspace.detachLeavesOfType(DASHBOARD_VIEW_TYPE);
  }
  async activateView() {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE);
    if (existing.length > 0) {
      workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = workspace.getLeaf(true);
    await leaf.setViewState({ type: DASHBOARD_VIEW_TYPE, active: true });
    workspace.revealLeaf(leaf);
  }
  async loadSettings() {
    var _a, _b;
    const saved = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
    if (saved == null ? void 0 : saved.reportConfigs) {
      this.settings.reportConfigs = Object.assign({}, DEFAULT_SETTINGS.reportConfigs);
      for (const key of Object.keys(this.settings.reportConfigs)) {
        if (saved.reportConfigs[key]) {
          Object.assign(this.settings.reportConfigs[key], saved.reportConfigs[key]);
        }
      }
    }
    if (saved == null ? void 0 : saved.taskDefaults) {
      this.settings.taskDefaults = Object.assign({}, DEFAULT_SETTINGS.taskDefaults, saved.taskDefaults);
    }
    const known = new Set(MODULE_IDS);
    this.settings.moduleOrder = this.settings.moduleOrder.filter((id) => known.has(id));
    const orderSet = new Set(this.settings.moduleOrder);
    for (const mid of MODULE_IDS) {
      if (!orderSet.has(mid))
        this.settings.moduleOrder.push(mid);
    }
    this.settings.moduleVisibility = Object.assign(
      defaultModuleVisibility(),
      (_a = this.settings.moduleVisibility) != null ? _a : {}
    );
    this.settings.moduleDeviceVisibility = Object.assign(
      {},
      DEFAULT_SETTINGS.moduleDeviceVisibility,
      (_b = this.settings.moduleDeviceVisibility) != null ? _b : {}
    );
  }
  async saveSettings(settings) {
    if (settings)
      this.settings = settings;
    await this.saveData(this.settings);
    this.app.workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE).forEach((leaf) => {
      const view = leaf.view;
      if (view instanceof DashboardView) {
        view.updateSettings(this.settings);
      }
    });
  }
};
var DashboardSettingTab = class extends import_obsidian31.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Dashboard \u8BBE\u7F6E" });
    const ctx = {
      settings: this.plugin.settings,
      saveSettings: () => this.plugin.saveSettings()
    };
    const s1 = new import_obsidian31.Setting(containerEl).setName("\u6807\u7B7E\u9875\u6807\u9898").setDesc("\u81EA\u5B9A\u4E49 Dashboard \u6807\u7B7E\u9875\u663E\u793A\u7684\u540D\u79F0\uFF0C\u53EF\u968F\u65F6\u4FEE\u6539").addText(
      (text) => text.setPlaceholder("Dashboard").setValue(this.plugin.settings.dashboardTitle).onChange(async (value) => {
        this.plugin.settings.dashboardTitle = value.trim() || "Dashboard";
        await this.plugin.saveSettings();
      })
    );
    this.addExampleHint(s1, "Dashboard");
    const s2 = new import_obsidian31.Setting(containerEl).setName("\u6807\u7B7E\u9875\u63CF\u8FF0").setDesc("\u663E\u793A\u5728\u6807\u7B7E\u9875\u6807\u9898\u4E0B\u65B9\u7684\u63CF\u8FF0\u6587\u5B57").addText(
      (text) => text.setPlaceholder("\u79B9\u601D\u5929\u4E0B\u6709\u6EBA\u8005\uFF0C\u7531\u5DF1\u6EBA\u4E4B\u4E5F").setValue(this.plugin.settings.dashboardDesc).onChange(async (value) => {
        this.plugin.settings.dashboardDesc = value.trim();
        await this.plugin.saveSettings();
      })
    );
    this.addExampleHint(s2, "\u79B9\u601D\u5929\u4E0B\u6709\u6EBA\u8005\uFF0C\u7531\u5DF1\u6EBA\u4E4B\u4E5F");
    new import_obsidian31.Setting(containerEl).setName("\u542F\u52A8\u65F6\u81EA\u52A8\u6253\u5F00 Dashboard").setDesc("Obsidian \u542F\u52A8\u3001\u5E03\u5C40\u5C31\u7EEA\u540E\u81EA\u52A8\u6253\u5F00 Dashboard \u9762\u677F").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.openOnStartup).onChange(async (value) => {
        this.plugin.settings.openOnStartup = value;
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "\u6A21\u5757\u663E\u793A" });
    containerEl.createEl("p", {
      text: "\u5173\u95ED\u540E\u8BE5\u6A21\u5757\u4E0D\u5728 Dashboard \u4E2D\u663E\u793A\uFF1B\u53EF\u5728 Dashboard \u4E2D\u62D6\u62FD\u6392\u5E8F\u3001\u70B9\u51FB\u6807\u9898\u6298\u53E0\u3002",
      cls: "dashboard-field-hint"
    });
    for (const mid of MODULE_IDS) {
      new import_obsidian31.Setting(containerEl).setName(MODULE_LABELS[mid]).addToggle(
        (toggle) => {
          var _a;
          return toggle.setValue(((_a = this.plugin.settings.moduleVisibility) == null ? void 0 : _a[mid]) !== false).onChange(async (value) => {
            if (!this.plugin.settings.moduleVisibility) {
              this.plugin.settings.moduleVisibility = {};
            }
            this.plugin.settings.moduleVisibility[mid] = value;
            await this.plugin.saveSettings();
          });
        }
      );
    }
    renderLLMSettings(containerEl, ctx);
    renderFileStatsSettings(containerEl, ctx);
    renderReportSettings(containerEl, ctx);
    renderGitSettings(containerEl, ctx);
  }
  addExampleHint(setting, example) {
    const input = setting.controlEl.querySelector("input");
    if (!input)
      return;
    const hint = createSpan({ cls: "dashboard-example-hint", text: "\u{1F4CB}", attr: { "data-tooltip": example } });
    hint.addEventListener("click", () => {
      input.value = example;
      input.dispatchEvent(new Event("input"));
    });
    setting.controlEl.appendChild(hint);
  }
};
/*! Bundled license information:

safe-buffer/index.js:
  (*! safe-buffer. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> *)

crc-32/crc32.js:
  (*! crc32.js (C) 2014-present SheetJS -- http://sheetjs.com *)

isomorphic-git/index.js:
  (*!
   * This code for `path.join` is directly copied from @zenfs/core/path for bundle size improvements.
   * SPDX-License-Identifier: LGPL-3.0-or-later
   * Copyright (c) James Prevett and other ZenFS contributors.
   *
   * Windows support added:
   *   - Backslashes are normalised to forward slashes before processing.
   *   - Drive-letter prefixes (e.g. "C:") are detected and preserved through
   *     normalisation, so absolute Windows paths are handled correctly.
   *   - An absolute argument passed to join() resets the accumulated path,
   *     matching Node behaviour and handling worktree gitdir paths properly.
   *
   * Limitation: UNC paths (e.g. \\server\share) are not supported. The leading
   *   backslashes are normalised to forward slashes and then collapsed by
   *   normalizeString, losing the UNC root. Git on Windows works with
   *   drive-letter paths, so this is not expected to be a practical issue.
   *)
*/
