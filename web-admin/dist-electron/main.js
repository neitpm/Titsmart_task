import { app, ipcMain, shell, Notification, BrowserWindow, nativeImage, Tray, Menu } from "electron";
import path from "path";
import require$$3$1, { fileURLToPath } from "url";
import fs from "fs";
import updatePkg from "electron-updater";
import require$$0$1 from "crypto";
import require$$0 from "buffer";
import require$$3 from "stream";
import require$$5 from "util";
import require$$1$1 from "https";
import require$$0$4 from "net";
import require$$1$2 from "tls";
import require$$2 from "assert";
import require$$1 from "tty";
import require$$0$2 from "os";
import require$$0$3 from "http";
var commonjsGlobal = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : {};
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var asn1$1 = {};
var bn = { exports: {} };
bn.exports;
(function(module) {
  (function(module2, exports) {
    function assert2(val, msg) {
      if (!val) throw new Error(msg || "Assertion failed");
    }
    function inherits2(ctor, superCtor) {
      ctor.super_ = superCtor;
      var TempCtor = function() {
      };
      TempCtor.prototype = superCtor.prototype;
      ctor.prototype = new TempCtor();
      ctor.prototype.constructor = ctor;
    }
    function BN(number, base2, endian) {
      if (BN.isBN(number)) {
        return number;
      }
      this.negative = 0;
      this.words = null;
      this.length = 0;
      this.red = null;
      if (number !== null) {
        if (base2 === "le" || base2 === "be") {
          endian = base2;
          base2 = 10;
        }
        this._init(number || 0, base2 || 10, endian || "be");
      }
    }
    if (typeof module2 === "object") {
      module2.exports = BN;
    } else {
      exports.BN = BN;
    }
    BN.BN = BN;
    BN.wordSize = 26;
    var Buffer2;
    try {
      if (typeof window !== "undefined" && typeof window.Buffer !== "undefined") {
        Buffer2 = window.Buffer;
      } else {
        Buffer2 = require("buffer").Buffer;
      }
    } catch (e) {
    }
    BN.isBN = function isBN(num) {
      if (num instanceof BN) {
        return true;
      }
      return num !== null && typeof num === "object" && num.constructor.wordSize === BN.wordSize && Array.isArray(num.words);
    };
    BN.max = function max(left, right) {
      if (left.cmp(right) > 0) return left;
      return right;
    };
    BN.min = function min(left, right) {
      if (left.cmp(right) < 0) return left;
      return right;
    };
    BN.prototype._init = function init2(number, base2, endian) {
      if (typeof number === "number") {
        return this._initNumber(number, base2, endian);
      }
      if (typeof number === "object") {
        return this._initArray(number, base2, endian);
      }
      if (base2 === "hex") {
        base2 = 16;
      }
      assert2(base2 === (base2 | 0) && base2 >= 2 && base2 <= 36);
      number = number.toString().replace(/\s+/g, "");
      var start = 0;
      if (number[0] === "-") {
        start++;
        this.negative = 1;
      }
      if (start < number.length) {
        if (base2 === 16) {
          this._parseHex(number, start, endian);
        } else {
          this._parseBase(number, base2, start);
          if (endian === "le") {
            this._initArray(this.toArray(), base2, endian);
          }
        }
      }
    };
    BN.prototype._initNumber = function _initNumber(number, base2, endian) {
      if (number < 0) {
        this.negative = 1;
        number = -number;
      }
      if (number < 67108864) {
        this.words = [number & 67108863];
        this.length = 1;
      } else if (number < 4503599627370496) {
        this.words = [
          number & 67108863,
          number / 67108864 & 67108863
        ];
        this.length = 2;
      } else {
        assert2(number < 9007199254740992);
        this.words = [
          number & 67108863,
          number / 67108864 & 67108863,
          1
        ];
        this.length = 3;
      }
      if (endian !== "le") return;
      this._initArray(this.toArray(), base2, endian);
    };
    BN.prototype._initArray = function _initArray(number, base2, endian) {
      assert2(typeof number.length === "number");
      if (number.length <= 0) {
        this.words = [0];
        this.length = 1;
        return this;
      }
      this.length = Math.ceil(number.length / 3);
      this.words = new Array(this.length);
      for (var i = 0; i < this.length; i++) {
        this.words[i] = 0;
      }
      var j, w;
      var off = 0;
      if (endian === "be") {
        for (i = number.length - 1, j = 0; i >= 0; i -= 3) {
          w = number[i] | number[i - 1] << 8 | number[i - 2] << 16;
          this.words[j] |= w << off & 67108863;
          this.words[j + 1] = w >>> 26 - off & 67108863;
          off += 24;
          if (off >= 26) {
            off -= 26;
            j++;
          }
        }
      } else if (endian === "le") {
        for (i = 0, j = 0; i < number.length; i += 3) {
          w = number[i] | number[i + 1] << 8 | number[i + 2] << 16;
          this.words[j] |= w << off & 67108863;
          this.words[j + 1] = w >>> 26 - off & 67108863;
          off += 24;
          if (off >= 26) {
            off -= 26;
            j++;
          }
        }
      }
      return this.strip();
    };
    function parseHex4Bits(string, index) {
      var c = string.charCodeAt(index);
      if (c >= 65 && c <= 70) {
        return c - 55;
      } else if (c >= 97 && c <= 102) {
        return c - 87;
      } else {
        return c - 48 & 15;
      }
    }
    function parseHexByte(string, lowerBound, index) {
      var r = parseHex4Bits(string, index);
      if (index - 1 >= lowerBound) {
        r |= parseHex4Bits(string, index - 1) << 4;
      }
      return r;
    }
    BN.prototype._parseHex = function _parseHex(number, start, endian) {
      this.length = Math.ceil((number.length - start) / 6);
      this.words = new Array(this.length);
      for (var i = 0; i < this.length; i++) {
        this.words[i] = 0;
      }
      var off = 0;
      var j = 0;
      var w;
      if (endian === "be") {
        for (i = number.length - 1; i >= start; i -= 2) {
          w = parseHexByte(number, start, i) << off;
          this.words[j] |= w & 67108863;
          if (off >= 18) {
            off -= 18;
            j += 1;
            this.words[j] |= w >>> 26;
          } else {
            off += 8;
          }
        }
      } else {
        var parseLength = number.length - start;
        for (i = parseLength % 2 === 0 ? start + 1 : start; i < number.length; i += 2) {
          w = parseHexByte(number, start, i) << off;
          this.words[j] |= w & 67108863;
          if (off >= 18) {
            off -= 18;
            j += 1;
            this.words[j] |= w >>> 26;
          } else {
            off += 8;
          }
        }
      }
      this.strip();
    };
    function parseBase(str, start, end2, mul) {
      var r = 0;
      var len = Math.min(str.length, end2);
      for (var i = start; i < len; i++) {
        var c = str.charCodeAt(i) - 48;
        r *= mul;
        if (c >= 49) {
          r += c - 49 + 10;
        } else if (c >= 17) {
          r += c - 17 + 10;
        } else {
          r += c;
        }
      }
      return r;
    }
    BN.prototype._parseBase = function _parseBase(number, base2, start) {
      this.words = [0];
      this.length = 1;
      for (var limbLen = 0, limbPow = 1; limbPow <= 67108863; limbPow *= base2) {
        limbLen++;
      }
      limbLen--;
      limbPow = limbPow / base2 | 0;
      var total = number.length - start;
      var mod = total % limbLen;
      var end2 = Math.min(total, total - mod) + start;
      var word = 0;
      for (var i = start; i < end2; i += limbLen) {
        word = parseBase(number, i, i + limbLen, base2);
        this.imuln(limbPow);
        if (this.words[0] + word < 67108864) {
          this.words[0] += word;
        } else {
          this._iaddn(word);
        }
      }
      if (mod !== 0) {
        var pow = 1;
        word = parseBase(number, i, number.length, base2);
        for (i = 0; i < mod; i++) {
          pow *= base2;
        }
        this.imuln(pow);
        if (this.words[0] + word < 67108864) {
          this.words[0] += word;
        } else {
          this._iaddn(word);
        }
      }
      this.strip();
    };
    BN.prototype.copy = function copy(dest) {
      dest.words = new Array(this.length);
      for (var i = 0; i < this.length; i++) {
        dest.words[i] = this.words[i];
      }
      dest.length = this.length;
      dest.negative = this.negative;
      dest.red = this.red;
    };
    BN.prototype.clone = function clone2() {
      var r = new BN(null);
      this.copy(r);
      return r;
    };
    BN.prototype._expand = function _expand(size) {
      while (this.length < size) {
        this.words[this.length++] = 0;
      }
      return this;
    };
    BN.prototype.strip = function strip() {
      while (this.length > 1 && this.words[this.length - 1] === 0) {
        this.length--;
      }
      return this._normSign();
    };
    BN.prototype._normSign = function _normSign() {
      if (this.length === 1 && this.words[0] === 0) {
        this.negative = 0;
      }
      return this;
    };
    BN.prototype.inspect = function inspect() {
      return (this.red ? "<BN-R: " : "<BN: ") + this.toString(16) + ">";
    };
    var zeros = [
      "",
      "0",
      "00",
      "000",
      "0000",
      "00000",
      "000000",
      "0000000",
      "00000000",
      "000000000",
      "0000000000",
      "00000000000",
      "000000000000",
      "0000000000000",
      "00000000000000",
      "000000000000000",
      "0000000000000000",
      "00000000000000000",
      "000000000000000000",
      "0000000000000000000",
      "00000000000000000000",
      "000000000000000000000",
      "0000000000000000000000",
      "00000000000000000000000",
      "000000000000000000000000",
      "0000000000000000000000000"
    ];
    var groupSizes = [
      0,
      0,
      25,
      16,
      12,
      11,
      10,
      9,
      8,
      8,
      7,
      7,
      7,
      7,
      6,
      6,
      6,
      6,
      6,
      6,
      6,
      5,
      5,
      5,
      5,
      5,
      5,
      5,
      5,
      5,
      5,
      5,
      5,
      5,
      5,
      5,
      5
    ];
    var groupBases = [
      0,
      0,
      33554432,
      43046721,
      16777216,
      48828125,
      60466176,
      40353607,
      16777216,
      43046721,
      1e7,
      19487171,
      35831808,
      62748517,
      7529536,
      11390625,
      16777216,
      24137569,
      34012224,
      47045881,
      64e6,
      4084101,
      5153632,
      6436343,
      7962624,
      9765625,
      11881376,
      14348907,
      17210368,
      20511149,
      243e5,
      28629151,
      33554432,
      39135393,
      45435424,
      52521875,
      60466176
    ];
    BN.prototype.toString = function toString3(base2, padding) {
      base2 = base2 || 10;
      padding = padding | 0 || 1;
      var out;
      if (base2 === 16 || base2 === "hex") {
        out = "";
        var off = 0;
        var carry = 0;
        for (var i = 0; i < this.length; i++) {
          var w = this.words[i];
          var word = ((w << off | carry) & 16777215).toString(16);
          carry = w >>> 24 - off & 16777215;
          off += 2;
          if (off >= 26) {
            off -= 26;
            i--;
          }
          if (carry !== 0 || i !== this.length - 1) {
            out = zeros[6 - word.length] + word + out;
          } else {
            out = word + out;
          }
        }
        if (carry !== 0) {
          out = carry.toString(16) + out;
        }
        while (out.length % padding !== 0) {
          out = "0" + out;
        }
        if (this.negative !== 0) {
          out = "-" + out;
        }
        return out;
      }
      if (base2 === (base2 | 0) && base2 >= 2 && base2 <= 36) {
        var groupSize = groupSizes[base2];
        var groupBase = groupBases[base2];
        out = "";
        var c = this.clone();
        c.negative = 0;
        while (!c.isZero()) {
          var r = c.modn(groupBase).toString(base2);
          c = c.idivn(groupBase);
          if (!c.isZero()) {
            out = zeros[groupSize - r.length] + r + out;
          } else {
            out = r + out;
          }
        }
        if (this.isZero()) {
          out = "0" + out;
        }
        while (out.length % padding !== 0) {
          out = "0" + out;
        }
        if (this.negative !== 0) {
          out = "-" + out;
        }
        return out;
      }
      assert2(false, "Base should be between 2 and 36");
    };
    BN.prototype.toNumber = function toNumber() {
      var ret = this.words[0];
      if (this.length === 2) {
        ret += this.words[1] * 67108864;
      } else if (this.length === 3 && this.words[2] === 1) {
        ret += 4503599627370496 + this.words[1] * 67108864;
      } else if (this.length > 2) {
        assert2(false, "Number can only safely store up to 53 bits");
      }
      return this.negative !== 0 ? -ret : ret;
    };
    BN.prototype.toJSON = function toJSON() {
      return this.toString(16);
    };
    BN.prototype.toBuffer = function toBuffer(endian, length) {
      assert2(typeof Buffer2 !== "undefined");
      return this.toArrayLike(Buffer2, endian, length);
    };
    BN.prototype.toArray = function toArray(endian, length) {
      return this.toArrayLike(Array, endian, length);
    };
    BN.prototype.toArrayLike = function toArrayLike(ArrayType, endian, length) {
      var byteLength = this.byteLength();
      var reqLength = length || Math.max(1, byteLength);
      assert2(byteLength <= reqLength, "byte array longer than desired length");
      assert2(reqLength > 0, "Requested array length <= 0");
      this.strip();
      var littleEndian = endian === "le";
      var res = new ArrayType(reqLength);
      var b, i;
      var q = this.clone();
      if (!littleEndian) {
        for (i = 0; i < reqLength - byteLength; i++) {
          res[i] = 0;
        }
        for (i = 0; !q.isZero(); i++) {
          b = q.andln(255);
          q.iushrn(8);
          res[reqLength - i - 1] = b;
        }
      } else {
        for (i = 0; !q.isZero(); i++) {
          b = q.andln(255);
          q.iushrn(8);
          res[i] = b;
        }
        for (; i < reqLength; i++) {
          res[i] = 0;
        }
      }
      return res;
    };
    if (Math.clz32) {
      BN.prototype._countBits = function _countBits(w) {
        return 32 - Math.clz32(w);
      };
    } else {
      BN.prototype._countBits = function _countBits(w) {
        var t = w;
        var r = 0;
        if (t >= 4096) {
          r += 13;
          t >>>= 13;
        }
        if (t >= 64) {
          r += 7;
          t >>>= 7;
        }
        if (t >= 8) {
          r += 4;
          t >>>= 4;
        }
        if (t >= 2) {
          r += 2;
          t >>>= 2;
        }
        return r + t;
      };
    }
    BN.prototype._zeroBits = function _zeroBits(w) {
      if (w === 0) return 26;
      var t = w;
      var r = 0;
      if ((t & 8191) === 0) {
        r += 13;
        t >>>= 13;
      }
      if ((t & 127) === 0) {
        r += 7;
        t >>>= 7;
      }
      if ((t & 15) === 0) {
        r += 4;
        t >>>= 4;
      }
      if ((t & 3) === 0) {
        r += 2;
        t >>>= 2;
      }
      if ((t & 1) === 0) {
        r++;
      }
      return r;
    };
    BN.prototype.bitLength = function bitLength() {
      var w = this.words[this.length - 1];
      var hi = this._countBits(w);
      return (this.length - 1) * 26 + hi;
    };
    function toBitArray(num) {
      var w = new Array(num.bitLength());
      for (var bit = 0; bit < w.length; bit++) {
        var off = bit / 26 | 0;
        var wbit = bit % 26;
        w[bit] = (num.words[off] & 1 << wbit) >>> wbit;
      }
      return w;
    }
    BN.prototype.zeroBits = function zeroBits() {
      if (this.isZero()) return 0;
      var r = 0;
      for (var i = 0; i < this.length; i++) {
        var b = this._zeroBits(this.words[i]);
        r += b;
        if (b !== 26) break;
      }
      return r;
    };
    BN.prototype.byteLength = function byteLength() {
      return Math.ceil(this.bitLength() / 8);
    };
    BN.prototype.toTwos = function toTwos(width) {
      if (this.negative !== 0) {
        return this.abs().inotn(width).iaddn(1);
      }
      return this.clone();
    };
    BN.prototype.fromTwos = function fromTwos(width) {
      if (this.testn(width - 1)) {
        return this.notn(width).iaddn(1).ineg();
      }
      return this.clone();
    };
    BN.prototype.isNeg = function isNeg() {
      return this.negative !== 0;
    };
    BN.prototype.neg = function neg() {
      return this.clone().ineg();
    };
    BN.prototype.ineg = function ineg() {
      if (!this.isZero()) {
        this.negative ^= 1;
      }
      return this;
    };
    BN.prototype.iuor = function iuor(num) {
      while (this.length < num.length) {
        this.words[this.length++] = 0;
      }
      for (var i = 0; i < num.length; i++) {
        this.words[i] = this.words[i] | num.words[i];
      }
      return this.strip();
    };
    BN.prototype.ior = function ior(num) {
      assert2((this.negative | num.negative) === 0);
      return this.iuor(num);
    };
    BN.prototype.or = function or(num) {
      if (this.length > num.length) return this.clone().ior(num);
      return num.clone().ior(this);
    };
    BN.prototype.uor = function uor(num) {
      if (this.length > num.length) return this.clone().iuor(num);
      return num.clone().iuor(this);
    };
    BN.prototype.iuand = function iuand(num) {
      var b;
      if (this.length > num.length) {
        b = num;
      } else {
        b = this;
      }
      for (var i = 0; i < b.length; i++) {
        this.words[i] = this.words[i] & num.words[i];
      }
      this.length = b.length;
      return this.strip();
    };
    BN.prototype.iand = function iand(num) {
      assert2((this.negative | num.negative) === 0);
      return this.iuand(num);
    };
    BN.prototype.and = function and(num) {
      if (this.length > num.length) return this.clone().iand(num);
      return num.clone().iand(this);
    };
    BN.prototype.uand = function uand(num) {
      if (this.length > num.length) return this.clone().iuand(num);
      return num.clone().iuand(this);
    };
    BN.prototype.iuxor = function iuxor(num) {
      var a;
      var b;
      if (this.length > num.length) {
        a = this;
        b = num;
      } else {
        a = num;
        b = this;
      }
      for (var i = 0; i < b.length; i++) {
        this.words[i] = a.words[i] ^ b.words[i];
      }
      if (this !== a) {
        for (; i < a.length; i++) {
          this.words[i] = a.words[i];
        }
      }
      this.length = a.length;
      return this.strip();
    };
    BN.prototype.ixor = function ixor(num) {
      assert2((this.negative | num.negative) === 0);
      return this.iuxor(num);
    };
    BN.prototype.xor = function xor(num) {
      if (this.length > num.length) return this.clone().ixor(num);
      return num.clone().ixor(this);
    };
    BN.prototype.uxor = function uxor(num) {
      if (this.length > num.length) return this.clone().iuxor(num);
      return num.clone().iuxor(this);
    };
    BN.prototype.inotn = function inotn(width) {
      assert2(typeof width === "number" && width >= 0);
      var bytesNeeded = Math.ceil(width / 26) | 0;
      var bitsLeft = width % 26;
      this._expand(bytesNeeded);
      if (bitsLeft > 0) {
        bytesNeeded--;
      }
      for (var i = 0; i < bytesNeeded; i++) {
        this.words[i] = ~this.words[i] & 67108863;
      }
      if (bitsLeft > 0) {
        this.words[i] = ~this.words[i] & 67108863 >> 26 - bitsLeft;
        i++;
      }
      for (; i < this.length; i++) {
        this.words[i] = 0;
      }
      return this.strip();
    };
    BN.prototype.notn = function notn(width) {
      return this.clone().inotn(width);
    };
    BN.prototype.setn = function setn(bit, val) {
      assert2(typeof bit === "number" && bit >= 0);
      var off = bit / 26 | 0;
      var wbit = bit % 26;
      this._expand(off + 1);
      if (val) {
        this.words[off] = this.words[off] | 1 << wbit;
      } else {
        this.words[off] = this.words[off] & ~(1 << wbit);
      }
      return this.strip();
    };
    BN.prototype.iadd = function iadd(num) {
      var r;
      if (this.negative !== 0 && num.negative === 0) {
        this.negative = 0;
        r = this.isub(num);
        this.negative ^= 1;
        return this._normSign();
      } else if (this.negative === 0 && num.negative !== 0) {
        num.negative = 0;
        r = this.isub(num);
        num.negative = 1;
        return r._normSign();
      }
      var a, b;
      if (this.length > num.length) {
        a = this;
        b = num;
      } else {
        a = num;
        b = this;
      }
      var carry = 0;
      for (var i = 0; i < b.length; i++) {
        r = (a.words[i] | 0) + (b.words[i] | 0) + carry;
        this.words[i] = r & 67108863;
        carry = r >>> 26;
      }
      for (; carry !== 0 && i < a.length; i++) {
        r = (a.words[i] | 0) + carry;
        this.words[i] = r & 67108863;
        carry = r >>> 26;
      }
      this.length = a.length;
      if (carry !== 0) {
        this.words[this.length] = carry;
        this.length++;
      } else if (a !== this) {
        for (; i < a.length; i++) {
          this.words[i] = a.words[i];
        }
      }
      return this;
    };
    BN.prototype.add = function add(num) {
      var res;
      if (num.negative !== 0 && this.negative === 0) {
        num.negative = 0;
        res = this.sub(num);
        num.negative ^= 1;
        return res;
      } else if (num.negative === 0 && this.negative !== 0) {
        this.negative = 0;
        res = num.sub(this);
        this.negative = 1;
        return res;
      }
      if (this.length > num.length) return this.clone().iadd(num);
      return num.clone().iadd(this);
    };
    BN.prototype.isub = function isub(num) {
      if (num.negative !== 0) {
        num.negative = 0;
        var r = this.iadd(num);
        num.negative = 1;
        return r._normSign();
      } else if (this.negative !== 0) {
        this.negative = 0;
        this.iadd(num);
        this.negative = 1;
        return this._normSign();
      }
      var cmp = this.cmp(num);
      if (cmp === 0) {
        this.negative = 0;
        this.length = 1;
        this.words[0] = 0;
        return this;
      }
      var a, b;
      if (cmp > 0) {
        a = this;
        b = num;
      } else {
        a = num;
        b = this;
      }
      var carry = 0;
      for (var i = 0; i < b.length; i++) {
        r = (a.words[i] | 0) - (b.words[i] | 0) + carry;
        carry = r >> 26;
        this.words[i] = r & 67108863;
      }
      for (; carry !== 0 && i < a.length; i++) {
        r = (a.words[i] | 0) + carry;
        carry = r >> 26;
        this.words[i] = r & 67108863;
      }
      if (carry === 0 && i < a.length && a !== this) {
        for (; i < a.length; i++) {
          this.words[i] = a.words[i];
        }
      }
      this.length = Math.max(this.length, i);
      if (a !== this) {
        this.negative = 1;
      }
      return this.strip();
    };
    BN.prototype.sub = function sub(num) {
      return this.clone().isub(num);
    };
    function smallMulTo(self2, num, out) {
      out.negative = num.negative ^ self2.negative;
      var len = self2.length + num.length | 0;
      out.length = len;
      len = len - 1 | 0;
      var a = self2.words[0] | 0;
      var b = num.words[0] | 0;
      var r = a * b;
      var lo = r & 67108863;
      var carry = r / 67108864 | 0;
      out.words[0] = lo;
      for (var k = 1; k < len; k++) {
        var ncarry = carry >>> 26;
        var rword = carry & 67108863;
        var maxJ = Math.min(k, num.length - 1);
        for (var j = Math.max(0, k - self2.length + 1); j <= maxJ; j++) {
          var i = k - j | 0;
          a = self2.words[i] | 0;
          b = num.words[j] | 0;
          r = a * b + rword;
          ncarry += r / 67108864 | 0;
          rword = r & 67108863;
        }
        out.words[k] = rword | 0;
        carry = ncarry | 0;
      }
      if (carry !== 0) {
        out.words[k] = carry | 0;
      } else {
        out.length--;
      }
      return out.strip();
    }
    var comb10MulTo = function comb10MulTo2(self2, num, out) {
      var a = self2.words;
      var b = num.words;
      var o = out.words;
      var c = 0;
      var lo;
      var mid;
      var hi;
      var a0 = a[0] | 0;
      var al0 = a0 & 8191;
      var ah0 = a0 >>> 13;
      var a1 = a[1] | 0;
      var al1 = a1 & 8191;
      var ah1 = a1 >>> 13;
      var a2 = a[2] | 0;
      var al2 = a2 & 8191;
      var ah2 = a2 >>> 13;
      var a3 = a[3] | 0;
      var al3 = a3 & 8191;
      var ah3 = a3 >>> 13;
      var a4 = a[4] | 0;
      var al4 = a4 & 8191;
      var ah4 = a4 >>> 13;
      var a5 = a[5] | 0;
      var al5 = a5 & 8191;
      var ah5 = a5 >>> 13;
      var a6 = a[6] | 0;
      var al6 = a6 & 8191;
      var ah6 = a6 >>> 13;
      var a7 = a[7] | 0;
      var al7 = a7 & 8191;
      var ah7 = a7 >>> 13;
      var a8 = a[8] | 0;
      var al8 = a8 & 8191;
      var ah8 = a8 >>> 13;
      var a9 = a[9] | 0;
      var al9 = a9 & 8191;
      var ah9 = a9 >>> 13;
      var b0 = b[0] | 0;
      var bl0 = b0 & 8191;
      var bh0 = b0 >>> 13;
      var b1 = b[1] | 0;
      var bl1 = b1 & 8191;
      var bh1 = b1 >>> 13;
      var b2 = b[2] | 0;
      var bl2 = b2 & 8191;
      var bh2 = b2 >>> 13;
      var b3 = b[3] | 0;
      var bl3 = b3 & 8191;
      var bh3 = b3 >>> 13;
      var b4 = b[4] | 0;
      var bl4 = b4 & 8191;
      var bh4 = b4 >>> 13;
      var b5 = b[5] | 0;
      var bl5 = b5 & 8191;
      var bh5 = b5 >>> 13;
      var b6 = b[6] | 0;
      var bl6 = b6 & 8191;
      var bh6 = b6 >>> 13;
      var b7 = b[7] | 0;
      var bl7 = b7 & 8191;
      var bh7 = b7 >>> 13;
      var b8 = b[8] | 0;
      var bl8 = b8 & 8191;
      var bh8 = b8 >>> 13;
      var b9 = b[9] | 0;
      var bl9 = b9 & 8191;
      var bh9 = b9 >>> 13;
      out.negative = self2.negative ^ num.negative;
      out.length = 19;
      lo = Math.imul(al0, bl0);
      mid = Math.imul(al0, bh0);
      mid = mid + Math.imul(ah0, bl0) | 0;
      hi = Math.imul(ah0, bh0);
      var w0 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
      c = (hi + (mid >>> 13) | 0) + (w0 >>> 26) | 0;
      w0 &= 67108863;
      lo = Math.imul(al1, bl0);
      mid = Math.imul(al1, bh0);
      mid = mid + Math.imul(ah1, bl0) | 0;
      hi = Math.imul(ah1, bh0);
      lo = lo + Math.imul(al0, bl1) | 0;
      mid = mid + Math.imul(al0, bh1) | 0;
      mid = mid + Math.imul(ah0, bl1) | 0;
      hi = hi + Math.imul(ah0, bh1) | 0;
      var w1 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
      c = (hi + (mid >>> 13) | 0) + (w1 >>> 26) | 0;
      w1 &= 67108863;
      lo = Math.imul(al2, bl0);
      mid = Math.imul(al2, bh0);
      mid = mid + Math.imul(ah2, bl0) | 0;
      hi = Math.imul(ah2, bh0);
      lo = lo + Math.imul(al1, bl1) | 0;
      mid = mid + Math.imul(al1, bh1) | 0;
      mid = mid + Math.imul(ah1, bl1) | 0;
      hi = hi + Math.imul(ah1, bh1) | 0;
      lo = lo + Math.imul(al0, bl2) | 0;
      mid = mid + Math.imul(al0, bh2) | 0;
      mid = mid + Math.imul(ah0, bl2) | 0;
      hi = hi + Math.imul(ah0, bh2) | 0;
      var w2 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
      c = (hi + (mid >>> 13) | 0) + (w2 >>> 26) | 0;
      w2 &= 67108863;
      lo = Math.imul(al3, bl0);
      mid = Math.imul(al3, bh0);
      mid = mid + Math.imul(ah3, bl0) | 0;
      hi = Math.imul(ah3, bh0);
      lo = lo + Math.imul(al2, bl1) | 0;
      mid = mid + Math.imul(al2, bh1) | 0;
      mid = mid + Math.imul(ah2, bl1) | 0;
      hi = hi + Math.imul(ah2, bh1) | 0;
      lo = lo + Math.imul(al1, bl2) | 0;
      mid = mid + Math.imul(al1, bh2) | 0;
      mid = mid + Math.imul(ah1, bl2) | 0;
      hi = hi + Math.imul(ah1, bh2) | 0;
      lo = lo + Math.imul(al0, bl3) | 0;
      mid = mid + Math.imul(al0, bh3) | 0;
      mid = mid + Math.imul(ah0, bl3) | 0;
      hi = hi + Math.imul(ah0, bh3) | 0;
      var w3 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
      c = (hi + (mid >>> 13) | 0) + (w3 >>> 26) | 0;
      w3 &= 67108863;
      lo = Math.imul(al4, bl0);
      mid = Math.imul(al4, bh0);
      mid = mid + Math.imul(ah4, bl0) | 0;
      hi = Math.imul(ah4, bh0);
      lo = lo + Math.imul(al3, bl1) | 0;
      mid = mid + Math.imul(al3, bh1) | 0;
      mid = mid + Math.imul(ah3, bl1) | 0;
      hi = hi + Math.imul(ah3, bh1) | 0;
      lo = lo + Math.imul(al2, bl2) | 0;
      mid = mid + Math.imul(al2, bh2) | 0;
      mid = mid + Math.imul(ah2, bl2) | 0;
      hi = hi + Math.imul(ah2, bh2) | 0;
      lo = lo + Math.imul(al1, bl3) | 0;
      mid = mid + Math.imul(al1, bh3) | 0;
      mid = mid + Math.imul(ah1, bl3) | 0;
      hi = hi + Math.imul(ah1, bh3) | 0;
      lo = lo + Math.imul(al0, bl4) | 0;
      mid = mid + Math.imul(al0, bh4) | 0;
      mid = mid + Math.imul(ah0, bl4) | 0;
      hi = hi + Math.imul(ah0, bh4) | 0;
      var w4 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
      c = (hi + (mid >>> 13) | 0) + (w4 >>> 26) | 0;
      w4 &= 67108863;
      lo = Math.imul(al5, bl0);
      mid = Math.imul(al5, bh0);
      mid = mid + Math.imul(ah5, bl0) | 0;
      hi = Math.imul(ah5, bh0);
      lo = lo + Math.imul(al4, bl1) | 0;
      mid = mid + Math.imul(al4, bh1) | 0;
      mid = mid + Math.imul(ah4, bl1) | 0;
      hi = hi + Math.imul(ah4, bh1) | 0;
      lo = lo + Math.imul(al3, bl2) | 0;
      mid = mid + Math.imul(al3, bh2) | 0;
      mid = mid + Math.imul(ah3, bl2) | 0;
      hi = hi + Math.imul(ah3, bh2) | 0;
      lo = lo + Math.imul(al2, bl3) | 0;
      mid = mid + Math.imul(al2, bh3) | 0;
      mid = mid + Math.imul(ah2, bl3) | 0;
      hi = hi + Math.imul(ah2, bh3) | 0;
      lo = lo + Math.imul(al1, bl4) | 0;
      mid = mid + Math.imul(al1, bh4) | 0;
      mid = mid + Math.imul(ah1, bl4) | 0;
      hi = hi + Math.imul(ah1, bh4) | 0;
      lo = lo + Math.imul(al0, bl5) | 0;
      mid = mid + Math.imul(al0, bh5) | 0;
      mid = mid + Math.imul(ah0, bl5) | 0;
      hi = hi + Math.imul(ah0, bh5) | 0;
      var w5 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
      c = (hi + (mid >>> 13) | 0) + (w5 >>> 26) | 0;
      w5 &= 67108863;
      lo = Math.imul(al6, bl0);
      mid = Math.imul(al6, bh0);
      mid = mid + Math.imul(ah6, bl0) | 0;
      hi = Math.imul(ah6, bh0);
      lo = lo + Math.imul(al5, bl1) | 0;
      mid = mid + Math.imul(al5, bh1) | 0;
      mid = mid + Math.imul(ah5, bl1) | 0;
      hi = hi + Math.imul(ah5, bh1) | 0;
      lo = lo + Math.imul(al4, bl2) | 0;
      mid = mid + Math.imul(al4, bh2) | 0;
      mid = mid + Math.imul(ah4, bl2) | 0;
      hi = hi + Math.imul(ah4, bh2) | 0;
      lo = lo + Math.imul(al3, bl3) | 0;
      mid = mid + Math.imul(al3, bh3) | 0;
      mid = mid + Math.imul(ah3, bl3) | 0;
      hi = hi + Math.imul(ah3, bh3) | 0;
      lo = lo + Math.imul(al2, bl4) | 0;
      mid = mid + Math.imul(al2, bh4) | 0;
      mid = mid + Math.imul(ah2, bl4) | 0;
      hi = hi + Math.imul(ah2, bh4) | 0;
      lo = lo + Math.imul(al1, bl5) | 0;
      mid = mid + Math.imul(al1, bh5) | 0;
      mid = mid + Math.imul(ah1, bl5) | 0;
      hi = hi + Math.imul(ah1, bh5) | 0;
      lo = lo + Math.imul(al0, bl6) | 0;
      mid = mid + Math.imul(al0, bh6) | 0;
      mid = mid + Math.imul(ah0, bl6) | 0;
      hi = hi + Math.imul(ah0, bh6) | 0;
      var w6 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
      c = (hi + (mid >>> 13) | 0) + (w6 >>> 26) | 0;
      w6 &= 67108863;
      lo = Math.imul(al7, bl0);
      mid = Math.imul(al7, bh0);
      mid = mid + Math.imul(ah7, bl0) | 0;
      hi = Math.imul(ah7, bh0);
      lo = lo + Math.imul(al6, bl1) | 0;
      mid = mid + Math.imul(al6, bh1) | 0;
      mid = mid + Math.imul(ah6, bl1) | 0;
      hi = hi + Math.imul(ah6, bh1) | 0;
      lo = lo + Math.imul(al5, bl2) | 0;
      mid = mid + Math.imul(al5, bh2) | 0;
      mid = mid + Math.imul(ah5, bl2) | 0;
      hi = hi + Math.imul(ah5, bh2) | 0;
      lo = lo + Math.imul(al4, bl3) | 0;
      mid = mid + Math.imul(al4, bh3) | 0;
      mid = mid + Math.imul(ah4, bl3) | 0;
      hi = hi + Math.imul(ah4, bh3) | 0;
      lo = lo + Math.imul(al3, bl4) | 0;
      mid = mid + Math.imul(al3, bh4) | 0;
      mid = mid + Math.imul(ah3, bl4) | 0;
      hi = hi + Math.imul(ah3, bh4) | 0;
      lo = lo + Math.imul(al2, bl5) | 0;
      mid = mid + Math.imul(al2, bh5) | 0;
      mid = mid + Math.imul(ah2, bl5) | 0;
      hi = hi + Math.imul(ah2, bh5) | 0;
      lo = lo + Math.imul(al1, bl6) | 0;
      mid = mid + Math.imul(al1, bh6) | 0;
      mid = mid + Math.imul(ah1, bl6) | 0;
      hi = hi + Math.imul(ah1, bh6) | 0;
      lo = lo + Math.imul(al0, bl7) | 0;
      mid = mid + Math.imul(al0, bh7) | 0;
      mid = mid + Math.imul(ah0, bl7) | 0;
      hi = hi + Math.imul(ah0, bh7) | 0;
      var w7 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
      c = (hi + (mid >>> 13) | 0) + (w7 >>> 26) | 0;
      w7 &= 67108863;
      lo = Math.imul(al8, bl0);
      mid = Math.imul(al8, bh0);
      mid = mid + Math.imul(ah8, bl0) | 0;
      hi = Math.imul(ah8, bh0);
      lo = lo + Math.imul(al7, bl1) | 0;
      mid = mid + Math.imul(al7, bh1) | 0;
      mid = mid + Math.imul(ah7, bl1) | 0;
      hi = hi + Math.imul(ah7, bh1) | 0;
      lo = lo + Math.imul(al6, bl2) | 0;
      mid = mid + Math.imul(al6, bh2) | 0;
      mid = mid + Math.imul(ah6, bl2) | 0;
      hi = hi + Math.imul(ah6, bh2) | 0;
      lo = lo + Math.imul(al5, bl3) | 0;
      mid = mid + Math.imul(al5, bh3) | 0;
      mid = mid + Math.imul(ah5, bl3) | 0;
      hi = hi + Math.imul(ah5, bh3) | 0;
      lo = lo + Math.imul(al4, bl4) | 0;
      mid = mid + Math.imul(al4, bh4) | 0;
      mid = mid + Math.imul(ah4, bl4) | 0;
      hi = hi + Math.imul(ah4, bh4) | 0;
      lo = lo + Math.imul(al3, bl5) | 0;
      mid = mid + Math.imul(al3, bh5) | 0;
      mid = mid + Math.imul(ah3, bl5) | 0;
      hi = hi + Math.imul(ah3, bh5) | 0;
      lo = lo + Math.imul(al2, bl6) | 0;
      mid = mid + Math.imul(al2, bh6) | 0;
      mid = mid + Math.imul(ah2, bl6) | 0;
      hi = hi + Math.imul(ah2, bh6) | 0;
      lo = lo + Math.imul(al1, bl7) | 0;
      mid = mid + Math.imul(al1, bh7) | 0;
      mid = mid + Math.imul(ah1, bl7) | 0;
      hi = hi + Math.imul(ah1, bh7) | 0;
      lo = lo + Math.imul(al0, bl8) | 0;
      mid = mid + Math.imul(al0, bh8) | 0;
      mid = mid + Math.imul(ah0, bl8) | 0;
      hi = hi + Math.imul(ah0, bh8) | 0;
      var w8 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
      c = (hi + (mid >>> 13) | 0) + (w8 >>> 26) | 0;
      w8 &= 67108863;
      lo = Math.imul(al9, bl0);
      mid = Math.imul(al9, bh0);
      mid = mid + Math.imul(ah9, bl0) | 0;
      hi = Math.imul(ah9, bh0);
      lo = lo + Math.imul(al8, bl1) | 0;
      mid = mid + Math.imul(al8, bh1) | 0;
      mid = mid + Math.imul(ah8, bl1) | 0;
      hi = hi + Math.imul(ah8, bh1) | 0;
      lo = lo + Math.imul(al7, bl2) | 0;
      mid = mid + Math.imul(al7, bh2) | 0;
      mid = mid + Math.imul(ah7, bl2) | 0;
      hi = hi + Math.imul(ah7, bh2) | 0;
      lo = lo + Math.imul(al6, bl3) | 0;
      mid = mid + Math.imul(al6, bh3) | 0;
      mid = mid + Math.imul(ah6, bl3) | 0;
      hi = hi + Math.imul(ah6, bh3) | 0;
      lo = lo + Math.imul(al5, bl4) | 0;
      mid = mid + Math.imul(al5, bh4) | 0;
      mid = mid + Math.imul(ah5, bl4) | 0;
      hi = hi + Math.imul(ah5, bh4) | 0;
      lo = lo + Math.imul(al4, bl5) | 0;
      mid = mid + Math.imul(al4, bh5) | 0;
      mid = mid + Math.imul(ah4, bl5) | 0;
      hi = hi + Math.imul(ah4, bh5) | 0;
      lo = lo + Math.imul(al3, bl6) | 0;
      mid = mid + Math.imul(al3, bh6) | 0;
      mid = mid + Math.imul(ah3, bl6) | 0;
      hi = hi + Math.imul(ah3, bh6) | 0;
      lo = lo + Math.imul(al2, bl7) | 0;
      mid = mid + Math.imul(al2, bh7) | 0;
      mid = mid + Math.imul(ah2, bl7) | 0;
      hi = hi + Math.imul(ah2, bh7) | 0;
      lo = lo + Math.imul(al1, bl8) | 0;
      mid = mid + Math.imul(al1, bh8) | 0;
      mid = mid + Math.imul(ah1, bl8) | 0;
      hi = hi + Math.imul(ah1, bh8) | 0;
      lo = lo + Math.imul(al0, bl9) | 0;
      mid = mid + Math.imul(al0, bh9) | 0;
      mid = mid + Math.imul(ah0, bl9) | 0;
      hi = hi + Math.imul(ah0, bh9) | 0;
      var w9 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
      c = (hi + (mid >>> 13) | 0) + (w9 >>> 26) | 0;
      w9 &= 67108863;
      lo = Math.imul(al9, bl1);
      mid = Math.imul(al9, bh1);
      mid = mid + Math.imul(ah9, bl1) | 0;
      hi = Math.imul(ah9, bh1);
      lo = lo + Math.imul(al8, bl2) | 0;
      mid = mid + Math.imul(al8, bh2) | 0;
      mid = mid + Math.imul(ah8, bl2) | 0;
      hi = hi + Math.imul(ah8, bh2) | 0;
      lo = lo + Math.imul(al7, bl3) | 0;
      mid = mid + Math.imul(al7, bh3) | 0;
      mid = mid + Math.imul(ah7, bl3) | 0;
      hi = hi + Math.imul(ah7, bh3) | 0;
      lo = lo + Math.imul(al6, bl4) | 0;
      mid = mid + Math.imul(al6, bh4) | 0;
      mid = mid + Math.imul(ah6, bl4) | 0;
      hi = hi + Math.imul(ah6, bh4) | 0;
      lo = lo + Math.imul(al5, bl5) | 0;
      mid = mid + Math.imul(al5, bh5) | 0;
      mid = mid + Math.imul(ah5, bl5) | 0;
      hi = hi + Math.imul(ah5, bh5) | 0;
      lo = lo + Math.imul(al4, bl6) | 0;
      mid = mid + Math.imul(al4, bh6) | 0;
      mid = mid + Math.imul(ah4, bl6) | 0;
      hi = hi + Math.imul(ah4, bh6) | 0;
      lo = lo + Math.imul(al3, bl7) | 0;
      mid = mid + Math.imul(al3, bh7) | 0;
      mid = mid + Math.imul(ah3, bl7) | 0;
      hi = hi + Math.imul(ah3, bh7) | 0;
      lo = lo + Math.imul(al2, bl8) | 0;
      mid = mid + Math.imul(al2, bh8) | 0;
      mid = mid + Math.imul(ah2, bl8) | 0;
      hi = hi + Math.imul(ah2, bh8) | 0;
      lo = lo + Math.imul(al1, bl9) | 0;
      mid = mid + Math.imul(al1, bh9) | 0;
      mid = mid + Math.imul(ah1, bl9) | 0;
      hi = hi + Math.imul(ah1, bh9) | 0;
      var w10 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
      c = (hi + (mid >>> 13) | 0) + (w10 >>> 26) | 0;
      w10 &= 67108863;
      lo = Math.imul(al9, bl2);
      mid = Math.imul(al9, bh2);
      mid = mid + Math.imul(ah9, bl2) | 0;
      hi = Math.imul(ah9, bh2);
      lo = lo + Math.imul(al8, bl3) | 0;
      mid = mid + Math.imul(al8, bh3) | 0;
      mid = mid + Math.imul(ah8, bl3) | 0;
      hi = hi + Math.imul(ah8, bh3) | 0;
      lo = lo + Math.imul(al7, bl4) | 0;
      mid = mid + Math.imul(al7, bh4) | 0;
      mid = mid + Math.imul(ah7, bl4) | 0;
      hi = hi + Math.imul(ah7, bh4) | 0;
      lo = lo + Math.imul(al6, bl5) | 0;
      mid = mid + Math.imul(al6, bh5) | 0;
      mid = mid + Math.imul(ah6, bl5) | 0;
      hi = hi + Math.imul(ah6, bh5) | 0;
      lo = lo + Math.imul(al5, bl6) | 0;
      mid = mid + Math.imul(al5, bh6) | 0;
      mid = mid + Math.imul(ah5, bl6) | 0;
      hi = hi + Math.imul(ah5, bh6) | 0;
      lo = lo + Math.imul(al4, bl7) | 0;
      mid = mid + Math.imul(al4, bh7) | 0;
      mid = mid + Math.imul(ah4, bl7) | 0;
      hi = hi + Math.imul(ah4, bh7) | 0;
      lo = lo + Math.imul(al3, bl8) | 0;
      mid = mid + Math.imul(al3, bh8) | 0;
      mid = mid + Math.imul(ah3, bl8) | 0;
      hi = hi + Math.imul(ah3, bh8) | 0;
      lo = lo + Math.imul(al2, bl9) | 0;
      mid = mid + Math.imul(al2, bh9) | 0;
      mid = mid + Math.imul(ah2, bl9) | 0;
      hi = hi + Math.imul(ah2, bh9) | 0;
      var w11 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
      c = (hi + (mid >>> 13) | 0) + (w11 >>> 26) | 0;
      w11 &= 67108863;
      lo = Math.imul(al9, bl3);
      mid = Math.imul(al9, bh3);
      mid = mid + Math.imul(ah9, bl3) | 0;
      hi = Math.imul(ah9, bh3);
      lo = lo + Math.imul(al8, bl4) | 0;
      mid = mid + Math.imul(al8, bh4) | 0;
      mid = mid + Math.imul(ah8, bl4) | 0;
      hi = hi + Math.imul(ah8, bh4) | 0;
      lo = lo + Math.imul(al7, bl5) | 0;
      mid = mid + Math.imul(al7, bh5) | 0;
      mid = mid + Math.imul(ah7, bl5) | 0;
      hi = hi + Math.imul(ah7, bh5) | 0;
      lo = lo + Math.imul(al6, bl6) | 0;
      mid = mid + Math.imul(al6, bh6) | 0;
      mid = mid + Math.imul(ah6, bl6) | 0;
      hi = hi + Math.imul(ah6, bh6) | 0;
      lo = lo + Math.imul(al5, bl7) | 0;
      mid = mid + Math.imul(al5, bh7) | 0;
      mid = mid + Math.imul(ah5, bl7) | 0;
      hi = hi + Math.imul(ah5, bh7) | 0;
      lo = lo + Math.imul(al4, bl8) | 0;
      mid = mid + Math.imul(al4, bh8) | 0;
      mid = mid + Math.imul(ah4, bl8) | 0;
      hi = hi + Math.imul(ah4, bh8) | 0;
      lo = lo + Math.imul(al3, bl9) | 0;
      mid = mid + Math.imul(al3, bh9) | 0;
      mid = mid + Math.imul(ah3, bl9) | 0;
      hi = hi + Math.imul(ah3, bh9) | 0;
      var w12 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
      c = (hi + (mid >>> 13) | 0) + (w12 >>> 26) | 0;
      w12 &= 67108863;
      lo = Math.imul(al9, bl4);
      mid = Math.imul(al9, bh4);
      mid = mid + Math.imul(ah9, bl4) | 0;
      hi = Math.imul(ah9, bh4);
      lo = lo + Math.imul(al8, bl5) | 0;
      mid = mid + Math.imul(al8, bh5) | 0;
      mid = mid + Math.imul(ah8, bl5) | 0;
      hi = hi + Math.imul(ah8, bh5) | 0;
      lo = lo + Math.imul(al7, bl6) | 0;
      mid = mid + Math.imul(al7, bh6) | 0;
      mid = mid + Math.imul(ah7, bl6) | 0;
      hi = hi + Math.imul(ah7, bh6) | 0;
      lo = lo + Math.imul(al6, bl7) | 0;
      mid = mid + Math.imul(al6, bh7) | 0;
      mid = mid + Math.imul(ah6, bl7) | 0;
      hi = hi + Math.imul(ah6, bh7) | 0;
      lo = lo + Math.imul(al5, bl8) | 0;
      mid = mid + Math.imul(al5, bh8) | 0;
      mid = mid + Math.imul(ah5, bl8) | 0;
      hi = hi + Math.imul(ah5, bh8) | 0;
      lo = lo + Math.imul(al4, bl9) | 0;
      mid = mid + Math.imul(al4, bh9) | 0;
      mid = mid + Math.imul(ah4, bl9) | 0;
      hi = hi + Math.imul(ah4, bh9) | 0;
      var w13 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
      c = (hi + (mid >>> 13) | 0) + (w13 >>> 26) | 0;
      w13 &= 67108863;
      lo = Math.imul(al9, bl5);
      mid = Math.imul(al9, bh5);
      mid = mid + Math.imul(ah9, bl5) | 0;
      hi = Math.imul(ah9, bh5);
      lo = lo + Math.imul(al8, bl6) | 0;
      mid = mid + Math.imul(al8, bh6) | 0;
      mid = mid + Math.imul(ah8, bl6) | 0;
      hi = hi + Math.imul(ah8, bh6) | 0;
      lo = lo + Math.imul(al7, bl7) | 0;
      mid = mid + Math.imul(al7, bh7) | 0;
      mid = mid + Math.imul(ah7, bl7) | 0;
      hi = hi + Math.imul(ah7, bh7) | 0;
      lo = lo + Math.imul(al6, bl8) | 0;
      mid = mid + Math.imul(al6, bh8) | 0;
      mid = mid + Math.imul(ah6, bl8) | 0;
      hi = hi + Math.imul(ah6, bh8) | 0;
      lo = lo + Math.imul(al5, bl9) | 0;
      mid = mid + Math.imul(al5, bh9) | 0;
      mid = mid + Math.imul(ah5, bl9) | 0;
      hi = hi + Math.imul(ah5, bh9) | 0;
      var w14 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
      c = (hi + (mid >>> 13) | 0) + (w14 >>> 26) | 0;
      w14 &= 67108863;
      lo = Math.imul(al9, bl6);
      mid = Math.imul(al9, bh6);
      mid = mid + Math.imul(ah9, bl6) | 0;
      hi = Math.imul(ah9, bh6);
      lo = lo + Math.imul(al8, bl7) | 0;
      mid = mid + Math.imul(al8, bh7) | 0;
      mid = mid + Math.imul(ah8, bl7) | 0;
      hi = hi + Math.imul(ah8, bh7) | 0;
      lo = lo + Math.imul(al7, bl8) | 0;
      mid = mid + Math.imul(al7, bh8) | 0;
      mid = mid + Math.imul(ah7, bl8) | 0;
      hi = hi + Math.imul(ah7, bh8) | 0;
      lo = lo + Math.imul(al6, bl9) | 0;
      mid = mid + Math.imul(al6, bh9) | 0;
      mid = mid + Math.imul(ah6, bl9) | 0;
      hi = hi + Math.imul(ah6, bh9) | 0;
      var w15 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
      c = (hi + (mid >>> 13) | 0) + (w15 >>> 26) | 0;
      w15 &= 67108863;
      lo = Math.imul(al9, bl7);
      mid = Math.imul(al9, bh7);
      mid = mid + Math.imul(ah9, bl7) | 0;
      hi = Math.imul(ah9, bh7);
      lo = lo + Math.imul(al8, bl8) | 0;
      mid = mid + Math.imul(al8, bh8) | 0;
      mid = mid + Math.imul(ah8, bl8) | 0;
      hi = hi + Math.imul(ah8, bh8) | 0;
      lo = lo + Math.imul(al7, bl9) | 0;
      mid = mid + Math.imul(al7, bh9) | 0;
      mid = mid + Math.imul(ah7, bl9) | 0;
      hi = hi + Math.imul(ah7, bh9) | 0;
      var w16 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
      c = (hi + (mid >>> 13) | 0) + (w16 >>> 26) | 0;
      w16 &= 67108863;
      lo = Math.imul(al9, bl8);
      mid = Math.imul(al9, bh8);
      mid = mid + Math.imul(ah9, bl8) | 0;
      hi = Math.imul(ah9, bh8);
      lo = lo + Math.imul(al8, bl9) | 0;
      mid = mid + Math.imul(al8, bh9) | 0;
      mid = mid + Math.imul(ah8, bl9) | 0;
      hi = hi + Math.imul(ah8, bh9) | 0;
      var w17 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
      c = (hi + (mid >>> 13) | 0) + (w17 >>> 26) | 0;
      w17 &= 67108863;
      lo = Math.imul(al9, bl9);
      mid = Math.imul(al9, bh9);
      mid = mid + Math.imul(ah9, bl9) | 0;
      hi = Math.imul(ah9, bh9);
      var w18 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
      c = (hi + (mid >>> 13) | 0) + (w18 >>> 26) | 0;
      w18 &= 67108863;
      o[0] = w0;
      o[1] = w1;
      o[2] = w2;
      o[3] = w3;
      o[4] = w4;
      o[5] = w5;
      o[6] = w6;
      o[7] = w7;
      o[8] = w8;
      o[9] = w9;
      o[10] = w10;
      o[11] = w11;
      o[12] = w12;
      o[13] = w13;
      o[14] = w14;
      o[15] = w15;
      o[16] = w16;
      o[17] = w17;
      o[18] = w18;
      if (c !== 0) {
        o[19] = c;
        out.length++;
      }
      return out;
    };
    if (!Math.imul) {
      comb10MulTo = smallMulTo;
    }
    function bigMulTo(self2, num, out) {
      out.negative = num.negative ^ self2.negative;
      out.length = self2.length + num.length;
      var carry = 0;
      var hncarry = 0;
      for (var k = 0; k < out.length - 1; k++) {
        var ncarry = hncarry;
        hncarry = 0;
        var rword = carry & 67108863;
        var maxJ = Math.min(k, num.length - 1);
        for (var j = Math.max(0, k - self2.length + 1); j <= maxJ; j++) {
          var i = k - j;
          var a = self2.words[i] | 0;
          var b = num.words[j] | 0;
          var r = a * b;
          var lo = r & 67108863;
          ncarry = ncarry + (r / 67108864 | 0) | 0;
          lo = lo + rword | 0;
          rword = lo & 67108863;
          ncarry = ncarry + (lo >>> 26) | 0;
          hncarry += ncarry >>> 26;
          ncarry &= 67108863;
        }
        out.words[k] = rword;
        carry = ncarry;
        ncarry = hncarry;
      }
      if (carry !== 0) {
        out.words[k] = carry;
      } else {
        out.length--;
      }
      return out.strip();
    }
    function jumboMulTo(self2, num, out) {
      var fftm = new FFTM();
      return fftm.mulp(self2, num, out);
    }
    BN.prototype.mulTo = function mulTo(num, out) {
      var res;
      var len = this.length + num.length;
      if (this.length === 10 && num.length === 10) {
        res = comb10MulTo(this, num, out);
      } else if (len < 63) {
        res = smallMulTo(this, num, out);
      } else if (len < 1024) {
        res = bigMulTo(this, num, out);
      } else {
        res = jumboMulTo(this, num, out);
      }
      return res;
    };
    function FFTM(x, y) {
      this.x = x;
      this.y = y;
    }
    FFTM.prototype.makeRBT = function makeRBT(N) {
      var t = new Array(N);
      var l = BN.prototype._countBits(N) - 1;
      for (var i = 0; i < N; i++) {
        t[i] = this.revBin(i, l, N);
      }
      return t;
    };
    FFTM.prototype.revBin = function revBin(x, l, N) {
      if (x === 0 || x === N - 1) return x;
      var rb = 0;
      for (var i = 0; i < l; i++) {
        rb |= (x & 1) << l - i - 1;
        x >>= 1;
      }
      return rb;
    };
    FFTM.prototype.permute = function permute(rbt, rws, iws, rtws, itws, N) {
      for (var i = 0; i < N; i++) {
        rtws[i] = rws[rbt[i]];
        itws[i] = iws[rbt[i]];
      }
    };
    FFTM.prototype.transform = function transform(rws, iws, rtws, itws, N, rbt) {
      this.permute(rbt, rws, iws, rtws, itws, N);
      for (var s = 1; s < N; s <<= 1) {
        var l = s << 1;
        var rtwdf = Math.cos(2 * Math.PI / l);
        var itwdf = Math.sin(2 * Math.PI / l);
        for (var p = 0; p < N; p += l) {
          var rtwdf_ = rtwdf;
          var itwdf_ = itwdf;
          for (var j = 0; j < s; j++) {
            var re = rtws[p + j];
            var ie = itws[p + j];
            var ro = rtws[p + j + s];
            var io = itws[p + j + s];
            var rx = rtwdf_ * ro - itwdf_ * io;
            io = rtwdf_ * io + itwdf_ * ro;
            ro = rx;
            rtws[p + j] = re + ro;
            itws[p + j] = ie + io;
            rtws[p + j + s] = re - ro;
            itws[p + j + s] = ie - io;
            if (j !== l) {
              rx = rtwdf * rtwdf_ - itwdf * itwdf_;
              itwdf_ = rtwdf * itwdf_ + itwdf * rtwdf_;
              rtwdf_ = rx;
            }
          }
        }
      }
    };
    FFTM.prototype.guessLen13b = function guessLen13b(n, m) {
      var N = Math.max(m, n) | 1;
      var odd = N & 1;
      var i = 0;
      for (N = N / 2 | 0; N; N = N >>> 1) {
        i++;
      }
      return 1 << i + 1 + odd;
    };
    FFTM.prototype.conjugate = function conjugate(rws, iws, N) {
      if (N <= 1) return;
      for (var i = 0; i < N / 2; i++) {
        var t = rws[i];
        rws[i] = rws[N - i - 1];
        rws[N - i - 1] = t;
        t = iws[i];
        iws[i] = -iws[N - i - 1];
        iws[N - i - 1] = -t;
      }
    };
    FFTM.prototype.normalize13b = function normalize13b(ws, N) {
      var carry = 0;
      for (var i = 0; i < N / 2; i++) {
        var w = Math.round(ws[2 * i + 1] / N) * 8192 + Math.round(ws[2 * i] / N) + carry;
        ws[i] = w & 67108863;
        if (w < 67108864) {
          carry = 0;
        } else {
          carry = w / 67108864 | 0;
        }
      }
      return ws;
    };
    FFTM.prototype.convert13b = function convert13b(ws, len, rws, N) {
      var carry = 0;
      for (var i = 0; i < len; i++) {
        carry = carry + (ws[i] | 0);
        rws[2 * i] = carry & 8191;
        carry = carry >>> 13;
        rws[2 * i + 1] = carry & 8191;
        carry = carry >>> 13;
      }
      for (i = 2 * len; i < N; ++i) {
        rws[i] = 0;
      }
      assert2(carry === 0);
      assert2((carry & -8192) === 0);
    };
    FFTM.prototype.stub = function stub(N) {
      var ph = new Array(N);
      for (var i = 0; i < N; i++) {
        ph[i] = 0;
      }
      return ph;
    };
    FFTM.prototype.mulp = function mulp(x, y, out) {
      var N = 2 * this.guessLen13b(x.length, y.length);
      var rbt = this.makeRBT(N);
      var _ = this.stub(N);
      var rws = new Array(N);
      var rwst = new Array(N);
      var iwst = new Array(N);
      var nrws = new Array(N);
      var nrwst = new Array(N);
      var niwst = new Array(N);
      var rmws = out.words;
      rmws.length = N;
      this.convert13b(x.words, x.length, rws, N);
      this.convert13b(y.words, y.length, nrws, N);
      this.transform(rws, _, rwst, iwst, N, rbt);
      this.transform(nrws, _, nrwst, niwst, N, rbt);
      for (var i = 0; i < N; i++) {
        var rx = rwst[i] * nrwst[i] - iwst[i] * niwst[i];
        iwst[i] = rwst[i] * niwst[i] + iwst[i] * nrwst[i];
        rwst[i] = rx;
      }
      this.conjugate(rwst, iwst, N);
      this.transform(rwst, iwst, rmws, _, N, rbt);
      this.conjugate(rmws, _, N);
      this.normalize13b(rmws, N);
      out.negative = x.negative ^ y.negative;
      out.length = x.length + y.length;
      return out.strip();
    };
    BN.prototype.mul = function mul(num) {
      var out = new BN(null);
      out.words = new Array(this.length + num.length);
      return this.mulTo(num, out);
    };
    BN.prototype.mulf = function mulf(num) {
      var out = new BN(null);
      out.words = new Array(this.length + num.length);
      return jumboMulTo(this, num, out);
    };
    BN.prototype.imul = function imul(num) {
      return this.clone().mulTo(num, this);
    };
    BN.prototype.imuln = function imuln(num) {
      assert2(typeof num === "number");
      assert2(num < 67108864);
      var carry = 0;
      for (var i = 0; i < this.length; i++) {
        var w = (this.words[i] | 0) * num;
        var lo = (w & 67108863) + (carry & 67108863);
        carry >>= 26;
        carry += w / 67108864 | 0;
        carry += lo >>> 26;
        this.words[i] = lo & 67108863;
      }
      if (carry !== 0) {
        this.words[i] = carry;
        this.length++;
      }
      if (num === 0) {
        this.length = 1;
        this._normSign();
      }
      return this;
    };
    BN.prototype.muln = function muln(num) {
      return this.clone().imuln(num);
    };
    BN.prototype.sqr = function sqr() {
      return this.mul(this);
    };
    BN.prototype.isqr = function isqr() {
      return this.imul(this.clone());
    };
    BN.prototype.pow = function pow(num) {
      var w = toBitArray(num);
      if (w.length === 0) return new BN(1);
      var res = this;
      for (var i = 0; i < w.length; i++, res = res.sqr()) {
        if (w[i] !== 0) break;
      }
      if (++i < w.length) {
        for (var q = res.sqr(); i < w.length; i++, q = q.sqr()) {
          if (w[i] === 0) continue;
          res = res.mul(q);
        }
      }
      return res;
    };
    BN.prototype.iushln = function iushln(bits) {
      assert2(typeof bits === "number" && bits >= 0);
      var r = bits % 26;
      var s = (bits - r) / 26;
      var carryMask = 67108863 >>> 26 - r << 26 - r;
      var i;
      if (r !== 0) {
        var carry = 0;
        for (i = 0; i < this.length; i++) {
          var newCarry = this.words[i] & carryMask;
          var c = (this.words[i] | 0) - newCarry << r;
          this.words[i] = c | carry;
          carry = newCarry >>> 26 - r;
        }
        if (carry) {
          this.words[i] = carry;
          this.length++;
        }
      }
      if (s !== 0) {
        for (i = this.length - 1; i >= 0; i--) {
          this.words[i + s] = this.words[i];
        }
        for (i = 0; i < s; i++) {
          this.words[i] = 0;
        }
        this.length += s;
      }
      return this.strip();
    };
    BN.prototype.ishln = function ishln(bits) {
      assert2(this.negative === 0);
      return this.iushln(bits);
    };
    BN.prototype.iushrn = function iushrn(bits, hint, extended) {
      assert2(typeof bits === "number" && bits >= 0);
      var h;
      if (hint) {
        h = (hint - hint % 26) / 26;
      } else {
        h = 0;
      }
      var r = bits % 26;
      var s = Math.min((bits - r) / 26, this.length);
      var mask = 67108863 ^ 67108863 >>> r << r;
      var maskedWords = extended;
      h -= s;
      h = Math.max(0, h);
      if (maskedWords) {
        for (var i = 0; i < s; i++) {
          maskedWords.words[i] = this.words[i];
        }
        maskedWords.length = s;
      }
      if (s === 0) ;
      else if (this.length > s) {
        this.length -= s;
        for (i = 0; i < this.length; i++) {
          this.words[i] = this.words[i + s];
        }
      } else {
        this.words[0] = 0;
        this.length = 1;
      }
      var carry = 0;
      for (i = this.length - 1; i >= 0 && (carry !== 0 || i >= h); i--) {
        var word = this.words[i] | 0;
        this.words[i] = carry << 26 - r | word >>> r;
        carry = word & mask;
      }
      if (maskedWords && carry !== 0) {
        maskedWords.words[maskedWords.length++] = carry;
      }
      if (this.length === 0) {
        this.words[0] = 0;
        this.length = 1;
      }
      return this.strip();
    };
    BN.prototype.ishrn = function ishrn(bits, hint, extended) {
      assert2(this.negative === 0);
      return this.iushrn(bits, hint, extended);
    };
    BN.prototype.shln = function shln(bits) {
      return this.clone().ishln(bits);
    };
    BN.prototype.ushln = function ushln(bits) {
      return this.clone().iushln(bits);
    };
    BN.prototype.shrn = function shrn(bits) {
      return this.clone().ishrn(bits);
    };
    BN.prototype.ushrn = function ushrn(bits) {
      return this.clone().iushrn(bits);
    };
    BN.prototype.testn = function testn(bit) {
      assert2(typeof bit === "number" && bit >= 0);
      var r = bit % 26;
      var s = (bit - r) / 26;
      var q = 1 << r;
      if (this.length <= s) return false;
      var w = this.words[s];
      return !!(w & q);
    };
    BN.prototype.imaskn = function imaskn(bits) {
      assert2(typeof bits === "number" && bits >= 0);
      var r = bits % 26;
      var s = (bits - r) / 26;
      assert2(this.negative === 0, "imaskn works only with positive numbers");
      if (this.length <= s) {
        return this;
      }
      if (r !== 0) {
        s++;
      }
      this.length = Math.min(s, this.length);
      if (r !== 0) {
        var mask = 67108863 ^ 67108863 >>> r << r;
        this.words[this.length - 1] &= mask;
      }
      if (this.length === 0) {
        this.words[0] = 0;
        this.length = 1;
      }
      return this.strip();
    };
    BN.prototype.maskn = function maskn(bits) {
      return this.clone().imaskn(bits);
    };
    BN.prototype.iaddn = function iaddn(num) {
      assert2(typeof num === "number");
      assert2(num < 67108864);
      if (num < 0) return this.isubn(-num);
      if (this.negative !== 0) {
        if (this.length === 1 && (this.words[0] | 0) < num) {
          this.words[0] = num - (this.words[0] | 0);
          this.negative = 0;
          return this;
        }
        this.negative = 0;
        this.isubn(num);
        this.negative = 1;
        return this;
      }
      return this._iaddn(num);
    };
    BN.prototype._iaddn = function _iaddn(num) {
      this.words[0] += num;
      for (var i = 0; i < this.length && this.words[i] >= 67108864; i++) {
        this.words[i] -= 67108864;
        if (i === this.length - 1) {
          this.words[i + 1] = 1;
        } else {
          this.words[i + 1]++;
        }
      }
      this.length = Math.max(this.length, i + 1);
      return this;
    };
    BN.prototype.isubn = function isubn(num) {
      assert2(typeof num === "number");
      assert2(num < 67108864);
      if (num < 0) return this.iaddn(-num);
      if (this.negative !== 0) {
        this.negative = 0;
        this.iaddn(num);
        this.negative = 1;
        return this;
      }
      this.words[0] -= num;
      if (this.length === 1 && this.words[0] < 0) {
        this.words[0] = -this.words[0];
        this.negative = 1;
      } else {
        for (var i = 0; i < this.length && this.words[i] < 0; i++) {
          this.words[i] += 67108864;
          this.words[i + 1] -= 1;
        }
      }
      return this.strip();
    };
    BN.prototype.addn = function addn(num) {
      return this.clone().iaddn(num);
    };
    BN.prototype.subn = function subn(num) {
      return this.clone().isubn(num);
    };
    BN.prototype.iabs = function iabs() {
      this.negative = 0;
      return this;
    };
    BN.prototype.abs = function abs() {
      return this.clone().iabs();
    };
    BN.prototype._ishlnsubmul = function _ishlnsubmul(num, mul, shift) {
      var len = num.length + shift;
      var i;
      this._expand(len);
      var w;
      var carry = 0;
      for (i = 0; i < num.length; i++) {
        w = (this.words[i + shift] | 0) + carry;
        var right = (num.words[i] | 0) * mul;
        w -= right & 67108863;
        carry = (w >> 26) - (right / 67108864 | 0);
        this.words[i + shift] = w & 67108863;
      }
      for (; i < this.length - shift; i++) {
        w = (this.words[i + shift] | 0) + carry;
        carry = w >> 26;
        this.words[i + shift] = w & 67108863;
      }
      if (carry === 0) return this.strip();
      assert2(carry === -1);
      carry = 0;
      for (i = 0; i < this.length; i++) {
        w = -(this.words[i] | 0) + carry;
        carry = w >> 26;
        this.words[i] = w & 67108863;
      }
      this.negative = 1;
      return this.strip();
    };
    BN.prototype._wordDiv = function _wordDiv(num, mode) {
      var shift = this.length - num.length;
      var a = this.clone();
      var b = num;
      var bhi = b.words[b.length - 1] | 0;
      var bhiBits = this._countBits(bhi);
      shift = 26 - bhiBits;
      if (shift !== 0) {
        b = b.ushln(shift);
        a.iushln(shift);
        bhi = b.words[b.length - 1] | 0;
      }
      var m = a.length - b.length;
      var q;
      if (mode !== "mod") {
        q = new BN(null);
        q.length = m + 1;
        q.words = new Array(q.length);
        for (var i = 0; i < q.length; i++) {
          q.words[i] = 0;
        }
      }
      var diff = a.clone()._ishlnsubmul(b, 1, m);
      if (diff.negative === 0) {
        a = diff;
        if (q) {
          q.words[m] = 1;
        }
      }
      for (var j = m - 1; j >= 0; j--) {
        var qj = (a.words[b.length + j] | 0) * 67108864 + (a.words[b.length + j - 1] | 0);
        qj = Math.min(qj / bhi | 0, 67108863);
        a._ishlnsubmul(b, qj, j);
        while (a.negative !== 0) {
          qj--;
          a.negative = 0;
          a._ishlnsubmul(b, 1, j);
          if (!a.isZero()) {
            a.negative ^= 1;
          }
        }
        if (q) {
          q.words[j] = qj;
        }
      }
      if (q) {
        q.strip();
      }
      a.strip();
      if (mode !== "div" && shift !== 0) {
        a.iushrn(shift);
      }
      return {
        div: q || null,
        mod: a
      };
    };
    BN.prototype.divmod = function divmod(num, mode, positive) {
      assert2(!num.isZero());
      if (this.isZero()) {
        return {
          div: new BN(0),
          mod: new BN(0)
        };
      }
      var div, mod, res;
      if (this.negative !== 0 && num.negative === 0) {
        res = this.neg().divmod(num, mode);
        if (mode !== "mod") {
          div = res.div.neg();
        }
        if (mode !== "div") {
          mod = res.mod.neg();
          if (positive && mod.negative !== 0) {
            mod.iadd(num);
          }
        }
        return {
          div,
          mod
        };
      }
      if (this.negative === 0 && num.negative !== 0) {
        res = this.divmod(num.neg(), mode);
        if (mode !== "mod") {
          div = res.div.neg();
        }
        return {
          div,
          mod: res.mod
        };
      }
      if ((this.negative & num.negative) !== 0) {
        res = this.neg().divmod(num.neg(), mode);
        if (mode !== "div") {
          mod = res.mod.neg();
          if (positive && mod.negative !== 0) {
            mod.isub(num);
          }
        }
        return {
          div: res.div,
          mod
        };
      }
      if (num.length > this.length || this.cmp(num) < 0) {
        return {
          div: new BN(0),
          mod: this
        };
      }
      if (num.length === 1) {
        if (mode === "div") {
          return {
            div: this.divn(num.words[0]),
            mod: null
          };
        }
        if (mode === "mod") {
          return {
            div: null,
            mod: new BN(this.modn(num.words[0]))
          };
        }
        return {
          div: this.divn(num.words[0]),
          mod: new BN(this.modn(num.words[0]))
        };
      }
      return this._wordDiv(num, mode);
    };
    BN.prototype.div = function div(num) {
      return this.divmod(num, "div", false).div;
    };
    BN.prototype.mod = function mod(num) {
      return this.divmod(num, "mod", false).mod;
    };
    BN.prototype.umod = function umod(num) {
      return this.divmod(num, "mod", true).mod;
    };
    BN.prototype.divRound = function divRound(num) {
      var dm = this.divmod(num);
      if (dm.mod.isZero()) return dm.div;
      var mod = dm.mod.abs();
      var half = num.abs().iushrn(1);
      var r2 = num.words[0] & 1;
      var cmp = mod.cmp(half);
      if (cmp < 0 || r2 === 1 && cmp === 0) return dm.div;
      var up = new BN(1);
      up.negative = this.negative ^ num.negative;
      return dm.div.iadd(up);
    };
    BN.prototype.modn = function modn(num) {
      assert2(num <= 67108863);
      var p = (1 << 26) % num;
      var acc = 0;
      for (var i = this.length - 1; i >= 0; i--) {
        acc = (p * acc + (this.words[i] | 0)) % num;
      }
      return acc;
    };
    BN.prototype.idivn = function idivn(num) {
      assert2(num <= 67108863);
      var carry = 0;
      for (var i = this.length - 1; i >= 0; i--) {
        var w = (this.words[i] | 0) + carry * 67108864;
        this.words[i] = w / num | 0;
        carry = w % num;
      }
      return this.strip();
    };
    BN.prototype.divn = function divn(num) {
      return this.clone().idivn(num);
    };
    BN.prototype.egcd = function egcd(p) {
      assert2(p.negative === 0);
      assert2(!p.isZero());
      var x = this;
      var y = p.clone();
      if (x.negative !== 0) {
        x = x.umod(p);
      } else {
        x = x.clone();
      }
      var A = new BN(1);
      var B = new BN(0);
      var C = new BN(0);
      var D = new BN(1);
      var g = 0;
      while (x.isEven() && y.isEven()) {
        x.iushrn(1);
        y.iushrn(1);
        ++g;
      }
      var yp = y.clone();
      var xp = x.clone();
      while (!x.isZero()) {
        for (var i = 0, im = 1; (x.words[0] & im) === 0 && i < 26; ++i, im <<= 1) ;
        if (i > 0) {
          x.iushrn(i);
          while (i-- > 0) {
            if (A.isOdd() || B.isOdd()) {
              A.iadd(yp);
              B.isub(xp);
            }
            A.iushrn(1);
            B.iushrn(1);
          }
        }
        for (var j = 0, jm = 1; (y.words[0] & jm) === 0 && j < 26; ++j, jm <<= 1) ;
        if (j > 0) {
          y.iushrn(j);
          while (j-- > 0) {
            if (C.isOdd() || D.isOdd()) {
              C.iadd(yp);
              D.isub(xp);
            }
            C.iushrn(1);
            D.iushrn(1);
          }
        }
        if (x.cmp(y) >= 0) {
          x.isub(y);
          A.isub(C);
          B.isub(D);
        } else {
          y.isub(x);
          C.isub(A);
          D.isub(B);
        }
      }
      return {
        a: C,
        b: D,
        gcd: y.iushln(g)
      };
    };
    BN.prototype._invmp = function _invmp(p) {
      assert2(p.negative === 0);
      assert2(!p.isZero());
      var a = this;
      var b = p.clone();
      if (a.negative !== 0) {
        a = a.umod(p);
      } else {
        a = a.clone();
      }
      var x1 = new BN(1);
      var x2 = new BN(0);
      var delta = b.clone();
      while (a.cmpn(1) > 0 && b.cmpn(1) > 0) {
        for (var i = 0, im = 1; (a.words[0] & im) === 0 && i < 26; ++i, im <<= 1) ;
        if (i > 0) {
          a.iushrn(i);
          while (i-- > 0) {
            if (x1.isOdd()) {
              x1.iadd(delta);
            }
            x1.iushrn(1);
          }
        }
        for (var j = 0, jm = 1; (b.words[0] & jm) === 0 && j < 26; ++j, jm <<= 1) ;
        if (j > 0) {
          b.iushrn(j);
          while (j-- > 0) {
            if (x2.isOdd()) {
              x2.iadd(delta);
            }
            x2.iushrn(1);
          }
        }
        if (a.cmp(b) >= 0) {
          a.isub(b);
          x1.isub(x2);
        } else {
          b.isub(a);
          x2.isub(x1);
        }
      }
      var res;
      if (a.cmpn(1) === 0) {
        res = x1;
      } else {
        res = x2;
      }
      if (res.cmpn(0) < 0) {
        res.iadd(p);
      }
      return res;
    };
    BN.prototype.gcd = function gcd(num) {
      if (this.isZero()) return num.abs();
      if (num.isZero()) return this.abs();
      var a = this.clone();
      var b = num.clone();
      a.negative = 0;
      b.negative = 0;
      for (var shift = 0; a.isEven() && b.isEven(); shift++) {
        a.iushrn(1);
        b.iushrn(1);
      }
      do {
        while (a.isEven()) {
          a.iushrn(1);
        }
        while (b.isEven()) {
          b.iushrn(1);
        }
        var r = a.cmp(b);
        if (r < 0) {
          var t = a;
          a = b;
          b = t;
        } else if (r === 0 || b.cmpn(1) === 0) {
          break;
        }
        a.isub(b);
      } while (true);
      return b.iushln(shift);
    };
    BN.prototype.invm = function invm(num) {
      return this.egcd(num).a.umod(num);
    };
    BN.prototype.isEven = function isEven() {
      return (this.words[0] & 1) === 0;
    };
    BN.prototype.isOdd = function isOdd() {
      return (this.words[0] & 1) === 1;
    };
    BN.prototype.andln = function andln(num) {
      return this.words[0] & num;
    };
    BN.prototype.bincn = function bincn(bit) {
      assert2(typeof bit === "number");
      var r = bit % 26;
      var s = (bit - r) / 26;
      var q = 1 << r;
      if (this.length <= s) {
        this._expand(s + 1);
        this.words[s] |= q;
        return this;
      }
      var carry = q;
      for (var i = s; carry !== 0 && i < this.length; i++) {
        var w = this.words[i] | 0;
        w += carry;
        carry = w >>> 26;
        w &= 67108863;
        this.words[i] = w;
      }
      if (carry !== 0) {
        this.words[i] = carry;
        this.length++;
      }
      return this;
    };
    BN.prototype.isZero = function isZero() {
      return this.length === 1 && this.words[0] === 0;
    };
    BN.prototype.cmpn = function cmpn(num) {
      var negative = num < 0;
      if (this.negative !== 0 && !negative) return -1;
      if (this.negative === 0 && negative) return 1;
      this.strip();
      var res;
      if (this.length > 1) {
        res = 1;
      } else {
        if (negative) {
          num = -num;
        }
        assert2(num <= 67108863, "Number is too big");
        var w = this.words[0] | 0;
        res = w === num ? 0 : w < num ? -1 : 1;
      }
      if (this.negative !== 0) return -res | 0;
      return res;
    };
    BN.prototype.cmp = function cmp(num) {
      if (this.negative !== 0 && num.negative === 0) return -1;
      if (this.negative === 0 && num.negative !== 0) return 1;
      var res = this.ucmp(num);
      if (this.negative !== 0) return -res | 0;
      return res;
    };
    BN.prototype.ucmp = function ucmp(num) {
      if (this.length > num.length) return 1;
      if (this.length < num.length) return -1;
      var res = 0;
      for (var i = this.length - 1; i >= 0; i--) {
        var a = this.words[i] | 0;
        var b = num.words[i] | 0;
        if (a === b) continue;
        if (a < b) {
          res = -1;
        } else if (a > b) {
          res = 1;
        }
        break;
      }
      return res;
    };
    BN.prototype.gtn = function gtn(num) {
      return this.cmpn(num) === 1;
    };
    BN.prototype.gt = function gt(num) {
      return this.cmp(num) === 1;
    };
    BN.prototype.gten = function gten(num) {
      return this.cmpn(num) >= 0;
    };
    BN.prototype.gte = function gte(num) {
      return this.cmp(num) >= 0;
    };
    BN.prototype.ltn = function ltn(num) {
      return this.cmpn(num) === -1;
    };
    BN.prototype.lt = function lt(num) {
      return this.cmp(num) === -1;
    };
    BN.prototype.lten = function lten(num) {
      return this.cmpn(num) <= 0;
    };
    BN.prototype.lte = function lte(num) {
      return this.cmp(num) <= 0;
    };
    BN.prototype.eqn = function eqn(num) {
      return this.cmpn(num) === 0;
    };
    BN.prototype.eq = function eq(num) {
      return this.cmp(num) === 0;
    };
    BN.red = function red(num) {
      return new Red(num);
    };
    BN.prototype.toRed = function toRed(ctx) {
      assert2(!this.red, "Already a number in reduction context");
      assert2(this.negative === 0, "red works only with positives");
      return ctx.convertTo(this)._forceRed(ctx);
    };
    BN.prototype.fromRed = function fromRed() {
      assert2(this.red, "fromRed works only with numbers in reduction context");
      return this.red.convertFrom(this);
    };
    BN.prototype._forceRed = function _forceRed(ctx) {
      this.red = ctx;
      return this;
    };
    BN.prototype.forceRed = function forceRed(ctx) {
      assert2(!this.red, "Already a number in reduction context");
      return this._forceRed(ctx);
    };
    BN.prototype.redAdd = function redAdd(num) {
      assert2(this.red, "redAdd works only with red numbers");
      return this.red.add(this, num);
    };
    BN.prototype.redIAdd = function redIAdd(num) {
      assert2(this.red, "redIAdd works only with red numbers");
      return this.red.iadd(this, num);
    };
    BN.prototype.redSub = function redSub(num) {
      assert2(this.red, "redSub works only with red numbers");
      return this.red.sub(this, num);
    };
    BN.prototype.redISub = function redISub(num) {
      assert2(this.red, "redISub works only with red numbers");
      return this.red.isub(this, num);
    };
    BN.prototype.redShl = function redShl(num) {
      assert2(this.red, "redShl works only with red numbers");
      return this.red.shl(this, num);
    };
    BN.prototype.redMul = function redMul(num) {
      assert2(this.red, "redMul works only with red numbers");
      this.red._verify2(this, num);
      return this.red.mul(this, num);
    };
    BN.prototype.redIMul = function redIMul(num) {
      assert2(this.red, "redMul works only with red numbers");
      this.red._verify2(this, num);
      return this.red.imul(this, num);
    };
    BN.prototype.redSqr = function redSqr() {
      assert2(this.red, "redSqr works only with red numbers");
      this.red._verify1(this);
      return this.red.sqr(this);
    };
    BN.prototype.redISqr = function redISqr() {
      assert2(this.red, "redISqr works only with red numbers");
      this.red._verify1(this);
      return this.red.isqr(this);
    };
    BN.prototype.redSqrt = function redSqrt() {
      assert2(this.red, "redSqrt works only with red numbers");
      this.red._verify1(this);
      return this.red.sqrt(this);
    };
    BN.prototype.redInvm = function redInvm() {
      assert2(this.red, "redInvm works only with red numbers");
      this.red._verify1(this);
      return this.red.invm(this);
    };
    BN.prototype.redNeg = function redNeg() {
      assert2(this.red, "redNeg works only with red numbers");
      this.red._verify1(this);
      return this.red.neg(this);
    };
    BN.prototype.redPow = function redPow(num) {
      assert2(this.red && !num.red, "redPow(normalNum)");
      this.red._verify1(this);
      return this.red.pow(this, num);
    };
    var primes = {
      k256: null,
      p224: null,
      p192: null,
      p25519: null
    };
    function MPrime(name, p) {
      this.name = name;
      this.p = new BN(p, 16);
      this.n = this.p.bitLength();
      this.k = new BN(1).iushln(this.n).isub(this.p);
      this.tmp = this._tmp();
    }
    MPrime.prototype._tmp = function _tmp() {
      var tmp = new BN(null);
      tmp.words = new Array(Math.ceil(this.n / 13));
      return tmp;
    };
    MPrime.prototype.ireduce = function ireduce(num) {
      var r = num;
      var rlen;
      do {
        this.split(r, this.tmp);
        r = this.imulK(r);
        r = r.iadd(this.tmp);
        rlen = r.bitLength();
      } while (rlen > this.n);
      var cmp = rlen < this.n ? -1 : r.ucmp(this.p);
      if (cmp === 0) {
        r.words[0] = 0;
        r.length = 1;
      } else if (cmp > 0) {
        r.isub(this.p);
      } else {
        if (r.strip !== void 0) {
          r.strip();
        } else {
          r._strip();
        }
      }
      return r;
    };
    MPrime.prototype.split = function split(input, out) {
      input.iushrn(this.n, 0, out);
    };
    MPrime.prototype.imulK = function imulK(num) {
      return num.imul(this.k);
    };
    function K256() {
      MPrime.call(
        this,
        "k256",
        "ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe fffffc2f"
      );
    }
    inherits2(K256, MPrime);
    K256.prototype.split = function split(input, output) {
      var mask = 4194303;
      var outLen = Math.min(input.length, 9);
      for (var i = 0; i < outLen; i++) {
        output.words[i] = input.words[i];
      }
      output.length = outLen;
      if (input.length <= 9) {
        input.words[0] = 0;
        input.length = 1;
        return;
      }
      var prev = input.words[9];
      output.words[output.length++] = prev & mask;
      for (i = 10; i < input.length; i++) {
        var next = input.words[i] | 0;
        input.words[i - 10] = (next & mask) << 4 | prev >>> 22;
        prev = next;
      }
      prev >>>= 22;
      input.words[i - 10] = prev;
      if (prev === 0 && input.length > 10) {
        input.length -= 10;
      } else {
        input.length -= 9;
      }
    };
    K256.prototype.imulK = function imulK(num) {
      num.words[num.length] = 0;
      num.words[num.length + 1] = 0;
      num.length += 2;
      var lo = 0;
      for (var i = 0; i < num.length; i++) {
        var w = num.words[i] | 0;
        lo += w * 977;
        num.words[i] = lo & 67108863;
        lo = w * 64 + (lo / 67108864 | 0);
      }
      if (num.words[num.length - 1] === 0) {
        num.length--;
        if (num.words[num.length - 1] === 0) {
          num.length--;
        }
      }
      return num;
    };
    function P224() {
      MPrime.call(
        this,
        "p224",
        "ffffffff ffffffff ffffffff ffffffff 00000000 00000000 00000001"
      );
    }
    inherits2(P224, MPrime);
    function P192() {
      MPrime.call(
        this,
        "p192",
        "ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff"
      );
    }
    inherits2(P192, MPrime);
    function P25519() {
      MPrime.call(
        this,
        "25519",
        "7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed"
      );
    }
    inherits2(P25519, MPrime);
    P25519.prototype.imulK = function imulK(num) {
      var carry = 0;
      for (var i = 0; i < num.length; i++) {
        var hi = (num.words[i] | 0) * 19 + carry;
        var lo = hi & 67108863;
        hi >>>= 26;
        num.words[i] = lo;
        carry = hi;
      }
      if (carry !== 0) {
        num.words[num.length++] = carry;
      }
      return num;
    };
    BN._prime = function prime(name) {
      if (primes[name]) return primes[name];
      var prime2;
      if (name === "k256") {
        prime2 = new K256();
      } else if (name === "p224") {
        prime2 = new P224();
      } else if (name === "p192") {
        prime2 = new P192();
      } else if (name === "p25519") {
        prime2 = new P25519();
      } else {
        throw new Error("Unknown prime " + name);
      }
      primes[name] = prime2;
      return prime2;
    };
    function Red(m) {
      if (typeof m === "string") {
        var prime = BN._prime(m);
        this.m = prime.p;
        this.prime = prime;
      } else {
        assert2(m.gtn(1), "modulus must be greater than 1");
        this.m = m;
        this.prime = null;
      }
    }
    Red.prototype._verify1 = function _verify1(a) {
      assert2(a.negative === 0, "red works only with positives");
      assert2(a.red, "red works only with red numbers");
    };
    Red.prototype._verify2 = function _verify2(a, b) {
      assert2((a.negative | b.negative) === 0, "red works only with positives");
      assert2(
        a.red && a.red === b.red,
        "red works only with red numbers"
      );
    };
    Red.prototype.imod = function imod(a) {
      if (this.prime) return this.prime.ireduce(a)._forceRed(this);
      return a.umod(this.m)._forceRed(this);
    };
    Red.prototype.neg = function neg(a) {
      if (a.isZero()) {
        return a.clone();
      }
      return this.m.sub(a)._forceRed(this);
    };
    Red.prototype.add = function add(a, b) {
      this._verify2(a, b);
      var res = a.add(b);
      if (res.cmp(this.m) >= 0) {
        res.isub(this.m);
      }
      return res._forceRed(this);
    };
    Red.prototype.iadd = function iadd(a, b) {
      this._verify2(a, b);
      var res = a.iadd(b);
      if (res.cmp(this.m) >= 0) {
        res.isub(this.m);
      }
      return res;
    };
    Red.prototype.sub = function sub(a, b) {
      this._verify2(a, b);
      var res = a.sub(b);
      if (res.cmpn(0) < 0) {
        res.iadd(this.m);
      }
      return res._forceRed(this);
    };
    Red.prototype.isub = function isub(a, b) {
      this._verify2(a, b);
      var res = a.isub(b);
      if (res.cmpn(0) < 0) {
        res.iadd(this.m);
      }
      return res;
    };
    Red.prototype.shl = function shl(a, num) {
      this._verify1(a);
      return this.imod(a.ushln(num));
    };
    Red.prototype.imul = function imul(a, b) {
      this._verify2(a, b);
      return this.imod(a.imul(b));
    };
    Red.prototype.mul = function mul(a, b) {
      this._verify2(a, b);
      return this.imod(a.mul(b));
    };
    Red.prototype.isqr = function isqr(a) {
      return this.imul(a, a.clone());
    };
    Red.prototype.sqr = function sqr(a) {
      return this.mul(a, a);
    };
    Red.prototype.sqrt = function sqrt(a) {
      if (a.isZero()) return a.clone();
      var mod3 = this.m.andln(3);
      assert2(mod3 % 2 === 1);
      if (mod3 === 3) {
        var pow = this.m.add(new BN(1)).iushrn(2);
        return this.pow(a, pow);
      }
      var q = this.m.subn(1);
      var s = 0;
      while (!q.isZero() && q.andln(1) === 0) {
        s++;
        q.iushrn(1);
      }
      assert2(!q.isZero());
      var one = new BN(1).toRed(this);
      var nOne = one.redNeg();
      var lpow = this.m.subn(1).iushrn(1);
      var z = this.m.bitLength();
      z = new BN(2 * z * z).toRed(this);
      while (this.pow(z, lpow).cmp(nOne) !== 0) {
        z.redIAdd(nOne);
      }
      var c = this.pow(z, q);
      var r = this.pow(a, q.addn(1).iushrn(1));
      var t = this.pow(a, q);
      var m = s;
      while (t.cmp(one) !== 0) {
        var tmp = t;
        for (var i = 0; tmp.cmp(one) !== 0; i++) {
          tmp = tmp.redSqr();
        }
        assert2(i < m);
        var b = this.pow(c, new BN(1).iushln(m - i - 1));
        r = r.redMul(b);
        c = b.redSqr();
        t = t.redMul(c);
        m = i;
      }
      return r;
    };
    Red.prototype.invm = function invm(a) {
      var inv = a._invmp(this.m);
      if (inv.negative !== 0) {
        inv.negative = 0;
        return this.imod(inv).redNeg();
      } else {
        return this.imod(inv);
      }
    };
    Red.prototype.pow = function pow(a, num) {
      if (num.isZero()) return new BN(1).toRed(this);
      if (num.cmpn(1) === 0) return a.clone();
      var windowSize = 4;
      var wnd = new Array(1 << windowSize);
      wnd[0] = new BN(1).toRed(this);
      wnd[1] = a;
      for (var i = 2; i < wnd.length; i++) {
        wnd[i] = this.mul(wnd[i - 1], a);
      }
      var res = wnd[0];
      var current = 0;
      var currentLen = 0;
      var start = num.bitLength() % 26;
      if (start === 0) {
        start = 26;
      }
      for (i = num.length - 1; i >= 0; i--) {
        var word = num.words[i];
        for (var j = start - 1; j >= 0; j--) {
          var bit = word >> j & 1;
          if (res !== wnd[0]) {
            res = this.sqr(res);
          }
          if (bit === 0 && current === 0) {
            currentLen = 0;
            continue;
          }
          current <<= 1;
          current |= bit;
          currentLen++;
          if (currentLen !== windowSize && (i !== 0 || j !== 0)) continue;
          res = this.mul(res, wnd[current]);
          currentLen = 0;
          current = 0;
        }
        start = 26;
      }
      return res;
    };
    Red.prototype.convertTo = function convertTo(num) {
      var r = num.umod(this.m);
      return r === num ? r.clone() : r;
    };
    Red.prototype.convertFrom = function convertFrom(num) {
      var res = num.clone();
      res.red = null;
      return res;
    };
    BN.mont = function mont(num) {
      return new Mont(num);
    };
    function Mont(m) {
      Red.call(this, m);
      this.shift = this.m.bitLength();
      if (this.shift % 26 !== 0) {
        this.shift += 26 - this.shift % 26;
      }
      this.r = new BN(1).iushln(this.shift);
      this.r2 = this.imod(this.r.sqr());
      this.rinv = this.r._invmp(this.m);
      this.minv = this.rinv.mul(this.r).isubn(1).div(this.m);
      this.minv = this.minv.umod(this.r);
      this.minv = this.r.sub(this.minv);
    }
    inherits2(Mont, Red);
    Mont.prototype.convertTo = function convertTo(num) {
      return this.imod(num.ushln(this.shift));
    };
    Mont.prototype.convertFrom = function convertFrom(num) {
      var r = this.imod(num.mul(this.rinv));
      r.red = null;
      return r;
    };
    Mont.prototype.imul = function imul(a, b) {
      if (a.isZero() || b.isZero()) {
        a.words[0] = 0;
        a.length = 1;
        return a;
      }
      var t = a.imul(b);
      var c = t.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m);
      var u = t.isub(c).iushrn(this.shift);
      var res = u;
      if (u.cmp(this.m) >= 0) {
        res = u.isub(this.m);
      } else if (u.cmpn(0) < 0) {
        res = u.iadd(this.m);
      }
      return res._forceRed(this);
    };
    Mont.prototype.mul = function mul(a, b) {
      if (a.isZero() || b.isZero()) return new BN(0)._forceRed(this);
      var t = a.mul(b);
      var c = t.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m);
      var u = t.isub(c).iushrn(this.shift);
      var res = u;
      if (u.cmp(this.m) >= 0) {
        res = u.isub(this.m);
      } else if (u.cmpn(0) < 0) {
        res = u.iadd(this.m);
      }
      return res._forceRed(this);
    };
    Mont.prototype.invm = function invm(a) {
      var res = this.imod(a._invmp(this.m).mul(this.r2));
      return res._forceRed(this);
    };
  })(module, commonjsGlobal);
})(bn);
var bnExports = bn.exports;
var api = {};
var encoders = {};
var inherits$6 = { exports: {} };
var inherits_browser = { exports: {} };
var hasRequiredInherits_browser;
function requireInherits_browser() {
  if (hasRequiredInherits_browser) return inherits_browser.exports;
  hasRequiredInherits_browser = 1;
  if (typeof Object.create === "function") {
    inherits_browser.exports = function inherits2(ctor, superCtor) {
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
    inherits_browser.exports = function inherits2(ctor, superCtor) {
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
  return inherits_browser.exports;
}
try {
  var util$4 = require("util");
  if (typeof util$4.inherits !== "function") throw "";
  inherits$6.exports = util$4.inherits;
} catch (e) {
  inherits$6.exports = requireInherits_browser();
}
var inheritsExports = inherits$6.exports;
var buffer$1 = require$$0;
var Buffer$a = buffer$1.Buffer;
var safer = {};
var key;
for (key in buffer$1) {
  if (!buffer$1.hasOwnProperty(key)) continue;
  if (key === "SlowBuffer" || key === "Buffer") continue;
  safer[key] = buffer$1[key];
}
var Safer = safer.Buffer = {};
for (key in Buffer$a) {
  if (!Buffer$a.hasOwnProperty(key)) continue;
  if (key === "allocUnsafe" || key === "allocUnsafeSlow") continue;
  Safer[key] = Buffer$a[key];
}
safer.Buffer.prototype = Buffer$a.prototype;
if (!Safer.from || Safer.from === Uint8Array.from) {
  Safer.from = function(value, encodingOrOffset, length) {
    if (typeof value === "number") {
      throw new TypeError('The "value" argument must not be of type number. Received type ' + typeof value);
    }
    if (value && typeof value.length === "undefined") {
      throw new TypeError("The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof value);
    }
    return Buffer$a(value, encodingOrOffset, length);
  };
}
if (!Safer.alloc) {
  Safer.alloc = function(size, fill, encoding) {
    if (typeof size !== "number") {
      throw new TypeError('The "size" argument must be of type number. Received type ' + typeof size);
    }
    if (size < 0 || size >= 2 * (1 << 30)) {
      throw new RangeError('The value "' + size + '" is invalid for option "size"');
    }
    var buf = Buffer$a(size);
    if (!fill || fill.length === 0) {
      buf.fill(0);
    } else if (typeof encoding === "string") {
      buf.fill(fill, encoding);
    } else {
      buf.fill(fill);
    }
    return buf;
  };
}
if (!safer.kStringMaxLength) {
  try {
    safer.kStringMaxLength = process.binding("buffer").kStringMaxLength;
  } catch (e) {
  }
}
if (!safer.constants) {
  safer.constants = {
    MAX_LENGTH: safer.kMaxLength
  };
  if (safer.kStringMaxLength) {
    safer.constants.MAX_STRING_LENGTH = safer.kStringMaxLength;
  }
}
var safer_1 = safer;
var reporter = {};
const inherits$5 = inheritsExports;
function Reporter$2(options) {
  this._reporterState = {
    obj: null,
    path: [],
    options: options || {},
    errors: []
  };
}
reporter.Reporter = Reporter$2;
Reporter$2.prototype.isError = function isError(obj2) {
  return obj2 instanceof ReporterError;
};
Reporter$2.prototype.save = function save() {
  const state = this._reporterState;
  return { obj: state.obj, pathLen: state.path.length };
};
Reporter$2.prototype.restore = function restore(data) {
  const state = this._reporterState;
  state.obj = data.obj;
  state.path = state.path.slice(0, data.pathLen);
};
Reporter$2.prototype.enterKey = function enterKey(key3) {
  return this._reporterState.path.push(key3);
};
Reporter$2.prototype.exitKey = function exitKey(index) {
  const state = this._reporterState;
  state.path = state.path.slice(0, index - 1);
};
Reporter$2.prototype.leaveKey = function leaveKey(index, key3, value) {
  const state = this._reporterState;
  this.exitKey(index);
  if (state.obj !== null)
    state.obj[key3] = value;
};
Reporter$2.prototype.path = function path2() {
  return this._reporterState.path.join("/");
};
Reporter$2.prototype.enterObject = function enterObject() {
  const state = this._reporterState;
  const prev = state.obj;
  state.obj = {};
  return prev;
};
Reporter$2.prototype.leaveObject = function leaveObject(prev) {
  const state = this._reporterState;
  const now = state.obj;
  state.obj = prev;
  return now;
};
Reporter$2.prototype.error = function error(msg) {
  let err;
  const state = this._reporterState;
  const inherited = msg instanceof ReporterError;
  if (inherited) {
    err = msg;
  } else {
    err = new ReporterError(state.path.map(function(elem) {
      return "[" + JSON.stringify(elem) + "]";
    }).join(""), msg.message || msg, msg.stack);
  }
  if (!state.options.partial)
    throw err;
  if (!inherited)
    state.errors.push(err);
  return err;
};
Reporter$2.prototype.wrapResult = function wrapResult(result) {
  const state = this._reporterState;
  if (!state.options.partial)
    return result;
  return {
    result: this.isError(result) ? null : result,
    errors: state.errors
  };
};
function ReporterError(path3, msg) {
  this.path = path3;
  this.rethrow(msg);
}
inherits$5(ReporterError, Error);
ReporterError.prototype.rethrow = function rethrow(msg) {
  this.message = msg + " at: " + (this.path || "(shallow)");
  if (Error.captureStackTrace)
    Error.captureStackTrace(this, ReporterError);
  if (!this.stack) {
    try {
      throw new Error(this.message);
    } catch (e) {
      this.stack = e.stack;
    }
  }
  return this;
};
var buffer = {};
const inherits$4 = inheritsExports;
const Reporter$1 = reporter.Reporter;
const Buffer$9 = safer_1.Buffer;
function DecoderBuffer$2(base2, options) {
  Reporter$1.call(this, options);
  if (!Buffer$9.isBuffer(base2)) {
    this.error("Input not Buffer");
    return;
  }
  this.base = base2;
  this.offset = 0;
  this.length = base2.length;
}
inherits$4(DecoderBuffer$2, Reporter$1);
buffer.DecoderBuffer = DecoderBuffer$2;
DecoderBuffer$2.isDecoderBuffer = function isDecoderBuffer(data) {
  if (data instanceof DecoderBuffer$2) {
    return true;
  }
  const isCompatible = typeof data === "object" && Buffer$9.isBuffer(data.base) && data.constructor.name === "DecoderBuffer" && typeof data.offset === "number" && typeof data.length === "number" && typeof data.save === "function" && typeof data.restore === "function" && typeof data.isEmpty === "function" && typeof data.readUInt8 === "function" && typeof data.skip === "function" && typeof data.raw === "function";
  return isCompatible;
};
DecoderBuffer$2.prototype.save = function save2() {
  return { offset: this.offset, reporter: Reporter$1.prototype.save.call(this) };
};
DecoderBuffer$2.prototype.restore = function restore2(save3) {
  const res = new DecoderBuffer$2(this.base);
  res.offset = save3.offset;
  res.length = this.offset;
  this.offset = save3.offset;
  Reporter$1.prototype.restore.call(this, save3.reporter);
  return res;
};
DecoderBuffer$2.prototype.isEmpty = function isEmpty() {
  return this.offset === this.length;
};
DecoderBuffer$2.prototype.readUInt8 = function readUInt8(fail) {
  if (this.offset + 1 <= this.length)
    return this.base.readUInt8(this.offset++, true);
  else
    return this.error(fail || "DecoderBuffer overrun");
};
DecoderBuffer$2.prototype.skip = function skip(bytes, fail) {
  if (!(this.offset + bytes <= this.length))
    return this.error(fail || "DecoderBuffer overrun");
  const res = new DecoderBuffer$2(this.base);
  res._reporterState = this._reporterState;
  res.offset = this.offset;
  res.length = this.offset + bytes;
  this.offset += bytes;
  return res;
};
DecoderBuffer$2.prototype.raw = function raw(save3) {
  return this.base.slice(save3 ? save3.offset : this.offset, this.length);
};
function EncoderBuffer$1(value, reporter2) {
  if (Array.isArray(value)) {
    this.length = 0;
    this.value = value.map(function(item) {
      if (!EncoderBuffer$1.isEncoderBuffer(item))
        item = new EncoderBuffer$1(item, reporter2);
      this.length += item.length;
      return item;
    }, this);
  } else if (typeof value === "number") {
    if (!(0 <= value && value <= 255))
      return reporter2.error("non-byte EncoderBuffer value");
    this.value = value;
    this.length = 1;
  } else if (typeof value === "string") {
    this.value = value;
    this.length = Buffer$9.byteLength(value);
  } else if (Buffer$9.isBuffer(value)) {
    this.value = value;
    this.length = value.length;
  } else {
    return reporter2.error("Unsupported type: " + typeof value);
  }
}
buffer.EncoderBuffer = EncoderBuffer$1;
EncoderBuffer$1.isEncoderBuffer = function isEncoderBuffer(data) {
  if (data instanceof EncoderBuffer$1) {
    return true;
  }
  const isCompatible = typeof data === "object" && data.constructor.name === "EncoderBuffer" && typeof data.length === "number" && typeof data.join === "function";
  return isCompatible;
};
EncoderBuffer$1.prototype.join = function join(out, offset) {
  if (!out)
    out = Buffer$9.alloc(this.length);
  if (!offset)
    offset = 0;
  if (this.length === 0)
    return out;
  if (Array.isArray(this.value)) {
    this.value.forEach(function(item) {
      item.join(out, offset);
      offset += item.length;
    });
  } else {
    if (typeof this.value === "number")
      out[offset] = this.value;
    else if (typeof this.value === "string")
      out.write(this.value, offset);
    else if (Buffer$9.isBuffer(this.value))
      this.value.copy(out, offset);
    offset += this.length;
  }
  return out;
};
var minimalisticAssert = assert$1;
function assert$1(val, msg) {
  if (!val)
    throw new Error(msg || "Assertion failed");
}
assert$1.equal = function assertEqual(l, r, msg) {
  if (l != r)
    throw new Error(msg || "Assertion failed: " + l + " != " + r);
};
const Reporter = reporter.Reporter;
const EncoderBuffer = buffer.EncoderBuffer;
const DecoderBuffer$1 = buffer.DecoderBuffer;
const assert = minimalisticAssert;
const tags = [
  "seq",
  "seqof",
  "set",
  "setof",
  "objid",
  "bool",
  "gentime",
  "utctime",
  "null_",
  "enum",
  "int",
  "objDesc",
  "bitstr",
  "bmpstr",
  "charstr",
  "genstr",
  "graphstr",
  "ia5str",
  "iso646str",
  "numstr",
  "octstr",
  "printstr",
  "t61str",
  "unistr",
  "utf8str",
  "videostr"
];
const methods = [
  "key",
  "obj",
  "use",
  "optional",
  "explicit",
  "implicit",
  "def",
  "choice",
  "any",
  "contains"
].concat(tags);
const overrided = [
  "_peekTag",
  "_decodeTag",
  "_use",
  "_decodeStr",
  "_decodeObjid",
  "_decodeTime",
  "_decodeNull",
  "_decodeInt",
  "_decodeBool",
  "_decodeList",
  "_encodeComposite",
  "_encodeStr",
  "_encodeObjid",
  "_encodeTime",
  "_encodeNull",
  "_encodeInt",
  "_encodeBool"
];
function Node$2(enc, parent, name) {
  const state = {};
  this._baseState = state;
  state.name = name;
  state.enc = enc;
  state.parent = parent || null;
  state.children = null;
  state.tag = null;
  state.args = null;
  state.reverseArgs = null;
  state.choice = null;
  state.optional = false;
  state.any = false;
  state.obj = false;
  state.use = null;
  state.useDecoder = null;
  state.key = null;
  state["default"] = null;
  state.explicit = null;
  state.implicit = null;
  state.contains = null;
  if (!state.parent) {
    state.children = [];
    this._wrap();
  }
}
var node$1 = Node$2;
const stateProps = [
  "enc",
  "parent",
  "children",
  "tag",
  "args",
  "reverseArgs",
  "choice",
  "optional",
  "any",
  "obj",
  "use",
  "alteredUse",
  "key",
  "default",
  "explicit",
  "implicit",
  "contains"
];
Node$2.prototype.clone = function clone() {
  const state = this._baseState;
  const cstate = {};
  stateProps.forEach(function(prop) {
    cstate[prop] = state[prop];
  });
  const res = new this.constructor(cstate.parent);
  res._baseState = cstate;
  return res;
};
Node$2.prototype._wrap = function wrap() {
  const state = this._baseState;
  methods.forEach(function(method) {
    this[method] = function _wrappedMethod() {
      const clone2 = new this.constructor(this);
      state.children.push(clone2);
      return clone2[method].apply(clone2, arguments);
    };
  }, this);
};
Node$2.prototype._init = function init(body) {
  const state = this._baseState;
  assert(state.parent === null);
  body.call(this);
  state.children = state.children.filter(function(child) {
    return child._baseState.parent === this;
  }, this);
  assert.equal(state.children.length, 1, "Root node can have only one child");
};
Node$2.prototype._useArgs = function useArgs(args) {
  const state = this._baseState;
  const children = args.filter(function(arg) {
    return arg instanceof this.constructor;
  }, this);
  args = args.filter(function(arg) {
    return !(arg instanceof this.constructor);
  }, this);
  if (children.length !== 0) {
    assert(state.children === null);
    state.children = children;
    children.forEach(function(child) {
      child._baseState.parent = this;
    }, this);
  }
  if (args.length !== 0) {
    assert(state.args === null);
    state.args = args;
    state.reverseArgs = args.map(function(arg) {
      if (typeof arg !== "object" || arg.constructor !== Object)
        return arg;
      const res = {};
      Object.keys(arg).forEach(function(key3) {
        if (key3 == (key3 | 0))
          key3 |= 0;
        const value = arg[key3];
        res[value] = key3;
      });
      return res;
    });
  }
};
overrided.forEach(function(method) {
  Node$2.prototype[method] = function _overrided() {
    const state = this._baseState;
    throw new Error(method + " not implemented for encoding: " + state.enc);
  };
});
tags.forEach(function(tag) {
  Node$2.prototype[tag] = function _tagMethod() {
    const state = this._baseState;
    const args = Array.prototype.slice.call(arguments);
    assert(state.tag === null);
    state.tag = tag;
    this._useArgs(args);
    return this;
  };
});
Node$2.prototype.use = function use(item) {
  assert(item);
  const state = this._baseState;
  assert(state.use === null);
  state.use = item;
  return this;
};
Node$2.prototype.optional = function optional() {
  const state = this._baseState;
  state.optional = true;
  return this;
};
Node$2.prototype.def = function def(val) {
  const state = this._baseState;
  assert(state["default"] === null);
  state["default"] = val;
  state.optional = true;
  return this;
};
Node$2.prototype.explicit = function explicit(num) {
  const state = this._baseState;
  assert(state.explicit === null && state.implicit === null);
  state.explicit = num;
  return this;
};
Node$2.prototype.implicit = function implicit(num) {
  const state = this._baseState;
  assert(state.explicit === null && state.implicit === null);
  state.implicit = num;
  return this;
};
Node$2.prototype.obj = function obj() {
  const state = this._baseState;
  const args = Array.prototype.slice.call(arguments);
  state.obj = true;
  if (args.length !== 0)
    this._useArgs(args);
  return this;
};
Node$2.prototype.key = function key2(newKey) {
  const state = this._baseState;
  assert(state.key === null);
  state.key = newKey;
  return this;
};
Node$2.prototype.any = function any() {
  const state = this._baseState;
  state.any = true;
  return this;
};
Node$2.prototype.choice = function choice(obj2) {
  const state = this._baseState;
  assert(state.choice === null);
  state.choice = obj2;
  this._useArgs(Object.keys(obj2).map(function(key3) {
    return obj2[key3];
  }));
  return this;
};
Node$2.prototype.contains = function contains(item) {
  const state = this._baseState;
  assert(state.use === null);
  state.contains = item;
  return this;
};
Node$2.prototype._decode = function decode(input, options) {
  const state = this._baseState;
  if (state.parent === null)
    return input.wrapResult(state.children[0]._decode(input, options));
  let result = state["default"];
  let present = true;
  let prevKey = null;
  if (state.key !== null)
    prevKey = input.enterKey(state.key);
  if (state.optional) {
    let tag = null;
    if (state.explicit !== null)
      tag = state.explicit;
    else if (state.implicit !== null)
      tag = state.implicit;
    else if (state.tag !== null)
      tag = state.tag;
    if (tag === null && !state.any) {
      const save3 = input.save();
      try {
        if (state.choice === null)
          this._decodeGeneric(state.tag, input, options);
        else
          this._decodeChoice(input, options);
        present = true;
      } catch (e) {
        present = false;
      }
      input.restore(save3);
    } else {
      present = this._peekTag(input, tag, state.any);
      if (input.isError(present))
        return present;
    }
  }
  let prevObj;
  if (state.obj && present)
    prevObj = input.enterObject();
  if (present) {
    if (state.explicit !== null) {
      const explicit2 = this._decodeTag(input, state.explicit);
      if (input.isError(explicit2))
        return explicit2;
      input = explicit2;
    }
    const start = input.offset;
    if (state.use === null && state.choice === null) {
      let save3;
      if (state.any)
        save3 = input.save();
      const body = this._decodeTag(
        input,
        state.implicit !== null ? state.implicit : state.tag,
        state.any
      );
      if (input.isError(body))
        return body;
      if (state.any)
        result = input.raw(save3);
      else
        input = body;
    }
    if (options && options.track && state.tag !== null)
      options.track(input.path(), start, input.length, "tagged");
    if (options && options.track && state.tag !== null)
      options.track(input.path(), input.offset, input.length, "content");
    if (state.any) ;
    else if (state.choice === null) {
      result = this._decodeGeneric(state.tag, input, options);
    } else {
      result = this._decodeChoice(input, options);
    }
    if (input.isError(result))
      return result;
    if (!state.any && state.choice === null && state.children !== null) {
      state.children.forEach(function decodeChildren(child) {
        child._decode(input, options);
      });
    }
    if (state.contains && (state.tag === "octstr" || state.tag === "bitstr")) {
      const data = new DecoderBuffer$1(result);
      result = this._getUse(state.contains, input._reporterState.obj)._decode(data, options);
    }
  }
  if (state.obj && present)
    result = input.leaveObject(prevObj);
  if (state.key !== null && (result !== null || present === true))
    input.leaveKey(prevKey, state.key, result);
  else if (prevKey !== null)
    input.exitKey(prevKey);
  return result;
};
Node$2.prototype._decodeGeneric = function decodeGeneric(tag, input, options) {
  const state = this._baseState;
  if (tag === "seq" || tag === "set")
    return null;
  if (tag === "seqof" || tag === "setof")
    return this._decodeList(input, tag, state.args[0], options);
  else if (/str$/.test(tag))
    return this._decodeStr(input, tag, options);
  else if (tag === "objid" && state.args)
    return this._decodeObjid(input, state.args[0], state.args[1], options);
  else if (tag === "objid")
    return this._decodeObjid(input, null, null, options);
  else if (tag === "gentime" || tag === "utctime")
    return this._decodeTime(input, tag, options);
  else if (tag === "null_")
    return this._decodeNull(input, options);
  else if (tag === "bool")
    return this._decodeBool(input, options);
  else if (tag === "objDesc")
    return this._decodeStr(input, tag, options);
  else if (tag === "int" || tag === "enum")
    return this._decodeInt(input, state.args && state.args[0], options);
  if (state.use !== null) {
    return this._getUse(state.use, input._reporterState.obj)._decode(input, options);
  } else {
    return input.error("unknown tag: " + tag);
  }
};
Node$2.prototype._getUse = function _getUse(entity, obj2) {
  const state = this._baseState;
  state.useDecoder = this._use(entity, obj2);
  assert(state.useDecoder._baseState.parent === null);
  state.useDecoder = state.useDecoder._baseState.children[0];
  if (state.implicit !== state.useDecoder._baseState.implicit) {
    state.useDecoder = state.useDecoder.clone();
    state.useDecoder._baseState.implicit = state.implicit;
  }
  return state.useDecoder;
};
Node$2.prototype._decodeChoice = function decodeChoice(input, options) {
  const state = this._baseState;
  let result = null;
  let match = false;
  Object.keys(state.choice).some(function(key3) {
    const save3 = input.save();
    const node2 = state.choice[key3];
    try {
      const value = node2._decode(input, options);
      if (input.isError(value))
        return false;
      result = { type: key3, value };
      match = true;
    } catch (e) {
      input.restore(save3);
      return false;
    }
    return true;
  }, this);
  if (!match)
    return input.error("Choice not matched");
  return result;
};
Node$2.prototype._createEncoderBuffer = function createEncoderBuffer(data) {
  return new EncoderBuffer(data, this.reporter);
};
Node$2.prototype._encode = function encode(data, reporter2, parent) {
  const state = this._baseState;
  if (state["default"] !== null && state["default"] === data)
    return;
  const result = this._encodeValue(data, reporter2, parent);
  if (result === void 0)
    return;
  if (this._skipDefault(result, reporter2, parent))
    return;
  return result;
};
Node$2.prototype._encodeValue = function encode2(data, reporter2, parent) {
  const state = this._baseState;
  if (state.parent === null)
    return state.children[0]._encode(data, reporter2 || new Reporter());
  let result = null;
  this.reporter = reporter2;
  if (state.optional && data === void 0) {
    if (state["default"] !== null)
      data = state["default"];
    else
      return;
  }
  let content = null;
  let primitive = false;
  if (state.any) {
    result = this._createEncoderBuffer(data);
  } else if (state.choice) {
    result = this._encodeChoice(data, reporter2);
  } else if (state.contains) {
    content = this._getUse(state.contains, parent)._encode(data, reporter2);
    primitive = true;
  } else if (state.children) {
    content = state.children.map(function(child) {
      if (child._baseState.tag === "null_")
        return child._encode(null, reporter2, data);
      if (child._baseState.key === null)
        return reporter2.error("Child should have a key");
      const prevKey = reporter2.enterKey(child._baseState.key);
      if (typeof data !== "object")
        return reporter2.error("Child expected, but input is not object");
      const res = child._encode(data[child._baseState.key], reporter2, data);
      reporter2.leaveKey(prevKey);
      return res;
    }, this).filter(function(child) {
      return child;
    });
    content = this._createEncoderBuffer(content);
  } else {
    if (state.tag === "seqof" || state.tag === "setof") {
      if (!(state.args && state.args.length === 1))
        return reporter2.error("Too many args for : " + state.tag);
      if (!Array.isArray(data))
        return reporter2.error("seqof/setof, but data is not Array");
      const child = this.clone();
      child._baseState.implicit = null;
      content = this._createEncoderBuffer(data.map(function(item) {
        const state2 = this._baseState;
        return this._getUse(state2.args[0], data)._encode(item, reporter2);
      }, child));
    } else if (state.use !== null) {
      result = this._getUse(state.use, parent)._encode(data, reporter2);
    } else {
      content = this._encodePrimitive(state.tag, data);
      primitive = true;
    }
  }
  if (!state.any && state.choice === null) {
    const tag = state.implicit !== null ? state.implicit : state.tag;
    const cls = state.implicit === null ? "universal" : "context";
    if (tag === null) {
      if (state.use === null)
        reporter2.error("Tag could be omitted only for .use()");
    } else {
      if (state.use === null)
        result = this._encodeComposite(tag, primitive, cls, content);
    }
  }
  if (state.explicit !== null)
    result = this._encodeComposite(state.explicit, false, "context", result);
  return result;
};
Node$2.prototype._encodeChoice = function encodeChoice(data, reporter2) {
  const state = this._baseState;
  const node2 = state.choice[data.type];
  if (!node2) {
    assert(
      false,
      data.type + " not found in " + JSON.stringify(Object.keys(state.choice))
    );
  }
  return node2._encode(data.value, reporter2);
};
Node$2.prototype._encodePrimitive = function encodePrimitive(tag, data) {
  const state = this._baseState;
  if (/str$/.test(tag))
    return this._encodeStr(data, tag);
  else if (tag === "objid" && state.args)
    return this._encodeObjid(data, state.reverseArgs[0], state.args[1]);
  else if (tag === "objid")
    return this._encodeObjid(data, null, null);
  else if (tag === "gentime" || tag === "utctime")
    return this._encodeTime(data, tag);
  else if (tag === "null_")
    return this._encodeNull();
  else if (tag === "int" || tag === "enum")
    return this._encodeInt(data, state.args && state.reverseArgs[0]);
  else if (tag === "bool")
    return this._encodeBool(data);
  else if (tag === "objDesc")
    return this._encodeStr(data, tag);
  else
    throw new Error("Unsupported tag: " + tag);
};
Node$2.prototype._isNumstr = function isNumstr(str) {
  return /^[0-9 ]*$/.test(str);
};
Node$2.prototype._isPrintstr = function isPrintstr(str) {
  return /^[A-Za-z0-9 '()+,-./:=?]*$/.test(str);
};
var der$2 = {};
(function(exports) {
  function reverse(map) {
    const res = {};
    Object.keys(map).forEach(function(key3) {
      if ((key3 | 0) == key3)
        key3 = key3 | 0;
      const value = map[key3];
      res[value] = key3;
    });
    return res;
  }
  exports.tagClass = {
    0: "universal",
    1: "application",
    2: "context",
    3: "private"
  };
  exports.tagClassByName = reverse(exports.tagClass);
  exports.tag = {
    0: "end",
    1: "bool",
    2: "int",
    3: "bitstr",
    4: "octstr",
    5: "null_",
    6: "objid",
    7: "objDesc",
    8: "external",
    9: "real",
    10: "enum",
    11: "embed",
    12: "utf8str",
    13: "relativeOid",
    16: "seq",
    17: "set",
    18: "numstr",
    19: "printstr",
    20: "t61str",
    21: "videostr",
    22: "ia5str",
    23: "utctime",
    24: "gentime",
    25: "graphstr",
    26: "iso646str",
    27: "genstr",
    28: "unistr",
    29: "charstr",
    30: "bmpstr"
  };
  exports.tagByName = reverse(exports.tag);
})(der$2);
const inherits$3 = inheritsExports;
const Buffer$8 = safer_1.Buffer;
const Node$1 = node$1;
const der$1 = der$2;
function DEREncoder$1(entity) {
  this.enc = "der";
  this.name = entity.name;
  this.entity = entity;
  this.tree = new DERNode$1();
  this.tree._init(entity.body);
}
var der_1$1 = DEREncoder$1;
DEREncoder$1.prototype.encode = function encode3(data, reporter2) {
  return this.tree._encode(data, reporter2).join();
};
function DERNode$1(parent) {
  Node$1.call(this, "der", parent);
}
inherits$3(DERNode$1, Node$1);
DERNode$1.prototype._encodeComposite = function encodeComposite(tag, primitive, cls, content) {
  const encodedTag = encodeTag(tag, primitive, cls, this.reporter);
  if (content.length < 128) {
    const header2 = Buffer$8.alloc(2);
    header2[0] = encodedTag;
    header2[1] = content.length;
    return this._createEncoderBuffer([header2, content]);
  }
  let lenOctets = 1;
  for (let i = content.length; i >= 256; i >>= 8)
    lenOctets++;
  const header = Buffer$8.alloc(1 + 1 + lenOctets);
  header[0] = encodedTag;
  header[1] = 128 | lenOctets;
  for (let i = 1 + lenOctets, j = content.length; j > 0; i--, j >>= 8)
    header[i] = j & 255;
  return this._createEncoderBuffer([header, content]);
};
DERNode$1.prototype._encodeStr = function encodeStr(str, tag) {
  if (tag === "bitstr") {
    return this._createEncoderBuffer([str.unused | 0, str.data]);
  } else if (tag === "bmpstr") {
    const buf = Buffer$8.alloc(str.length * 2);
    for (let i = 0; i < str.length; i++) {
      buf.writeUInt16BE(str.charCodeAt(i), i * 2);
    }
    return this._createEncoderBuffer(buf);
  } else if (tag === "numstr") {
    if (!this._isNumstr(str)) {
      return this.reporter.error("Encoding of string type: numstr supports only digits and space");
    }
    return this._createEncoderBuffer(str);
  } else if (tag === "printstr") {
    if (!this._isPrintstr(str)) {
      return this.reporter.error("Encoding of string type: printstr supports only latin upper and lower case letters, digits, space, apostrophe, left and rigth parenthesis, plus sign, comma, hyphen, dot, slash, colon, equal sign, question mark");
    }
    return this._createEncoderBuffer(str);
  } else if (/str$/.test(tag)) {
    return this._createEncoderBuffer(str);
  } else if (tag === "objDesc") {
    return this._createEncoderBuffer(str);
  } else {
    return this.reporter.error("Encoding of string type: " + tag + " unsupported");
  }
};
DERNode$1.prototype._encodeObjid = function encodeObjid(id, values, relative) {
  if (typeof id === "string") {
    if (!values)
      return this.reporter.error("string objid given, but no values map found");
    if (!values.hasOwnProperty(id))
      return this.reporter.error("objid not found in values map");
    id = values[id].split(/[\s.]+/g);
    for (let i = 0; i < id.length; i++)
      id[i] |= 0;
  } else if (Array.isArray(id)) {
    id = id.slice();
    for (let i = 0; i < id.length; i++)
      id[i] |= 0;
  }
  if (!Array.isArray(id)) {
    return this.reporter.error("objid() should be either array or string, got: " + JSON.stringify(id));
  }
  if (!relative) {
    if (id[1] >= 40)
      return this.reporter.error("Second objid identifier OOB");
    id.splice(0, 2, id[0] * 40 + id[1]);
  }
  let size = 0;
  for (let i = 0; i < id.length; i++) {
    let ident = id[i];
    for (size++; ident >= 128; ident >>= 7)
      size++;
  }
  const objid = Buffer$8.alloc(size);
  let offset = objid.length - 1;
  for (let i = id.length - 1; i >= 0; i--) {
    let ident = id[i];
    objid[offset--] = ident & 127;
    while ((ident >>= 7) > 0)
      objid[offset--] = 128 | ident & 127;
  }
  return this._createEncoderBuffer(objid);
};
function two(num) {
  if (num < 10)
    return "0" + num;
  else
    return num;
}
DERNode$1.prototype._encodeTime = function encodeTime(time, tag) {
  let str;
  const date = new Date(time);
  if (tag === "gentime") {
    str = [
      two(date.getUTCFullYear()),
      two(date.getUTCMonth() + 1),
      two(date.getUTCDate()),
      two(date.getUTCHours()),
      two(date.getUTCMinutes()),
      two(date.getUTCSeconds()),
      "Z"
    ].join("");
  } else if (tag === "utctime") {
    str = [
      two(date.getUTCFullYear() % 100),
      two(date.getUTCMonth() + 1),
      two(date.getUTCDate()),
      two(date.getUTCHours()),
      two(date.getUTCMinutes()),
      two(date.getUTCSeconds()),
      "Z"
    ].join("");
  } else {
    this.reporter.error("Encoding " + tag + " time is not supported yet");
  }
  return this._encodeStr(str, "octstr");
};
DERNode$1.prototype._encodeNull = function encodeNull() {
  return this._createEncoderBuffer("");
};
DERNode$1.prototype._encodeInt = function encodeInt(num, values) {
  if (typeof num === "string") {
    if (!values)
      return this.reporter.error("String int or enum given, but no values map");
    if (!values.hasOwnProperty(num)) {
      return this.reporter.error("Values map doesn't contain: " + JSON.stringify(num));
    }
    num = values[num];
  }
  if (typeof num !== "number" && !Buffer$8.isBuffer(num)) {
    const numArray = num.toArray();
    if (!num.sign && numArray[0] & 128) {
      numArray.unshift(0);
    }
    num = Buffer$8.from(numArray);
  }
  if (Buffer$8.isBuffer(num)) {
    let size2 = num.length;
    if (num.length === 0)
      size2++;
    const out2 = Buffer$8.alloc(size2);
    num.copy(out2);
    if (num.length === 0)
      out2[0] = 0;
    return this._createEncoderBuffer(out2);
  }
  if (num < 128)
    return this._createEncoderBuffer(num);
  if (num < 256)
    return this._createEncoderBuffer([0, num]);
  let size = 1;
  for (let i = num; i >= 256; i >>= 8)
    size++;
  const out = new Array(size);
  for (let i = out.length - 1; i >= 0; i--) {
    out[i] = num & 255;
    num >>= 8;
  }
  if (out[0] & 128) {
    out.unshift(0);
  }
  return this._createEncoderBuffer(Buffer$8.from(out));
};
DERNode$1.prototype._encodeBool = function encodeBool(value) {
  return this._createEncoderBuffer(value ? 255 : 0);
};
DERNode$1.prototype._use = function use2(entity, obj2) {
  if (typeof entity === "function")
    entity = entity(obj2);
  return entity._getEncoder("der").tree;
};
DERNode$1.prototype._skipDefault = function skipDefault(dataBuffer, reporter2, parent) {
  const state = this._baseState;
  let i;
  if (state["default"] === null)
    return false;
  const data = dataBuffer.join();
  if (state.defaultBuffer === void 0)
    state.defaultBuffer = this._encodeValue(state["default"], reporter2, parent).join();
  if (data.length !== state.defaultBuffer.length)
    return false;
  for (i = 0; i < data.length; i++)
    if (data[i] !== state.defaultBuffer[i])
      return false;
  return true;
};
function encodeTag(tag, primitive, cls, reporter2) {
  let res;
  if (tag === "seqof")
    tag = "seq";
  else if (tag === "setof")
    tag = "set";
  if (der$1.tagByName.hasOwnProperty(tag))
    res = der$1.tagByName[tag];
  else if (typeof tag === "number" && (tag | 0) === tag)
    res = tag;
  else
    return reporter2.error("Unknown tag: " + tag);
  if (res >= 31)
    return reporter2.error("Multi-octet tag encoding unsupported");
  if (!primitive)
    res |= 32;
  res |= der$1.tagClassByName[cls || "universal"] << 6;
  return res;
}
const inherits$2 = inheritsExports;
const DEREncoder = der_1$1;
function PEMEncoder(entity) {
  DEREncoder.call(this, entity);
  this.enc = "pem";
}
inherits$2(PEMEncoder, DEREncoder);
var pem$1 = PEMEncoder;
PEMEncoder.prototype.encode = function encode4(data, options) {
  const buf = DEREncoder.prototype.encode.call(this, data);
  const p = buf.toString("base64");
  const out = ["-----BEGIN " + options.label + "-----"];
  for (let i = 0; i < p.length; i += 64)
    out.push(p.slice(i, i + 64));
  out.push("-----END " + options.label + "-----");
  return out.join("\n");
};
(function(exports) {
  const encoders2 = exports;
  encoders2.der = der_1$1;
  encoders2.pem = pem$1;
})(encoders);
var decoders = {};
const inherits$1 = inheritsExports;
const bignum = bnExports;
const DecoderBuffer = buffer.DecoderBuffer;
const Node = node$1;
const der = der$2;
function DERDecoder$1(entity) {
  this.enc = "der";
  this.name = entity.name;
  this.entity = entity;
  this.tree = new DERNode();
  this.tree._init(entity.body);
}
var der_1 = DERDecoder$1;
DERDecoder$1.prototype.decode = function decode2(data, options) {
  if (!DecoderBuffer.isDecoderBuffer(data)) {
    data = new DecoderBuffer(data, options);
  }
  return this.tree._decode(data, options);
};
function DERNode(parent) {
  Node.call(this, "der", parent);
}
inherits$1(DERNode, Node);
DERNode.prototype._peekTag = function peekTag(buffer2, tag, any2) {
  if (buffer2.isEmpty())
    return false;
  const state = buffer2.save();
  const decodedTag = derDecodeTag(buffer2, 'Failed to peek tag: "' + tag + '"');
  if (buffer2.isError(decodedTag))
    return decodedTag;
  buffer2.restore(state);
  return decodedTag.tag === tag || decodedTag.tagStr === tag || decodedTag.tagStr + "of" === tag || any2;
};
DERNode.prototype._decodeTag = function decodeTag(buffer2, tag, any2) {
  const decodedTag = derDecodeTag(
    buffer2,
    'Failed to decode tag of "' + tag + '"'
  );
  if (buffer2.isError(decodedTag))
    return decodedTag;
  let len = derDecodeLen(
    buffer2,
    decodedTag.primitive,
    'Failed to get length of "' + tag + '"'
  );
  if (buffer2.isError(len))
    return len;
  if (!any2 && decodedTag.tag !== tag && decodedTag.tagStr !== tag && decodedTag.tagStr + "of" !== tag) {
    return buffer2.error('Failed to match tag: "' + tag + '"');
  }
  if (decodedTag.primitive || len !== null)
    return buffer2.skip(len, 'Failed to match body of: "' + tag + '"');
  const state = buffer2.save();
  const res = this._skipUntilEnd(
    buffer2,
    'Failed to skip indefinite length body: "' + this.tag + '"'
  );
  if (buffer2.isError(res))
    return res;
  len = buffer2.offset - state.offset;
  buffer2.restore(state);
  return buffer2.skip(len, 'Failed to match body of: "' + tag + '"');
};
DERNode.prototype._skipUntilEnd = function skipUntilEnd(buffer2, fail) {
  for (; ; ) {
    const tag = derDecodeTag(buffer2, fail);
    if (buffer2.isError(tag))
      return tag;
    const len = derDecodeLen(buffer2, tag.primitive, fail);
    if (buffer2.isError(len))
      return len;
    let res;
    if (tag.primitive || len !== null)
      res = buffer2.skip(len);
    else
      res = this._skipUntilEnd(buffer2, fail);
    if (buffer2.isError(res))
      return res;
    if (tag.tagStr === "end")
      break;
  }
};
DERNode.prototype._decodeList = function decodeList(buffer2, tag, decoder, options) {
  const result = [];
  while (!buffer2.isEmpty()) {
    const possibleEnd = this._peekTag(buffer2, "end");
    if (buffer2.isError(possibleEnd))
      return possibleEnd;
    const res = decoder.decode(buffer2, "der", options);
    if (buffer2.isError(res) && possibleEnd)
      break;
    result.push(res);
  }
  return result;
};
DERNode.prototype._decodeStr = function decodeStr(buffer2, tag) {
  if (tag === "bitstr") {
    const unused = buffer2.readUInt8();
    if (buffer2.isError(unused))
      return unused;
    return { unused, data: buffer2.raw() };
  } else if (tag === "bmpstr") {
    const raw2 = buffer2.raw();
    if (raw2.length % 2 === 1)
      return buffer2.error("Decoding of string type: bmpstr length mismatch");
    let str = "";
    for (let i = 0; i < raw2.length / 2; i++) {
      str += String.fromCharCode(raw2.readUInt16BE(i * 2));
    }
    return str;
  } else if (tag === "numstr") {
    const numstr = buffer2.raw().toString("ascii");
    if (!this._isNumstr(numstr)) {
      return buffer2.error("Decoding of string type: numstr unsupported characters");
    }
    return numstr;
  } else if (tag === "octstr") {
    return buffer2.raw();
  } else if (tag === "objDesc") {
    return buffer2.raw();
  } else if (tag === "printstr") {
    const printstr = buffer2.raw().toString("ascii");
    if (!this._isPrintstr(printstr)) {
      return buffer2.error("Decoding of string type: printstr unsupported characters");
    }
    return printstr;
  } else if (/str$/.test(tag)) {
    return buffer2.raw().toString();
  } else {
    return buffer2.error("Decoding of string type: " + tag + " unsupported");
  }
};
DERNode.prototype._decodeObjid = function decodeObjid(buffer2, values, relative) {
  let result;
  const identifiers = [];
  let ident = 0;
  let subident = 0;
  while (!buffer2.isEmpty()) {
    subident = buffer2.readUInt8();
    ident <<= 7;
    ident |= subident & 127;
    if ((subident & 128) === 0) {
      identifiers.push(ident);
      ident = 0;
    }
  }
  if (subident & 128)
    identifiers.push(ident);
  const first = identifiers[0] / 40 | 0;
  const second = identifiers[0] % 40;
  if (relative)
    result = identifiers;
  else
    result = [first, second].concat(identifiers.slice(1));
  if (values) {
    let tmp = values[result.join(" ")];
    if (tmp === void 0)
      tmp = values[result.join(".")];
    if (tmp !== void 0)
      result = tmp;
  }
  return result;
};
DERNode.prototype._decodeTime = function decodeTime(buffer2, tag) {
  const str = buffer2.raw().toString();
  let year;
  let mon;
  let day;
  let hour;
  let min;
  let sec;
  if (tag === "gentime") {
    year = str.slice(0, 4) | 0;
    mon = str.slice(4, 6) | 0;
    day = str.slice(6, 8) | 0;
    hour = str.slice(8, 10) | 0;
    min = str.slice(10, 12) | 0;
    sec = str.slice(12, 14) | 0;
  } else if (tag === "utctime") {
    year = str.slice(0, 2) | 0;
    mon = str.slice(2, 4) | 0;
    day = str.slice(4, 6) | 0;
    hour = str.slice(6, 8) | 0;
    min = str.slice(8, 10) | 0;
    sec = str.slice(10, 12) | 0;
    if (year < 70)
      year = 2e3 + year;
    else
      year = 1900 + year;
  } else {
    return buffer2.error("Decoding " + tag + " time is not supported yet");
  }
  return Date.UTC(year, mon - 1, day, hour, min, sec, 0);
};
DERNode.prototype._decodeNull = function decodeNull() {
  return null;
};
DERNode.prototype._decodeBool = function decodeBool(buffer2) {
  const res = buffer2.readUInt8();
  if (buffer2.isError(res))
    return res;
  else
    return res !== 0;
};
DERNode.prototype._decodeInt = function decodeInt(buffer2, values) {
  const raw2 = buffer2.raw();
  let res = new bignum(raw2);
  if (values)
    res = values[res.toString(10)] || res;
  return res;
};
DERNode.prototype._use = function use3(entity, obj2) {
  if (typeof entity === "function")
    entity = entity(obj2);
  return entity._getDecoder("der").tree;
};
function derDecodeTag(buf, fail) {
  let tag = buf.readUInt8(fail);
  if (buf.isError(tag))
    return tag;
  const cls = der.tagClass[tag >> 6];
  const primitive = (tag & 32) === 0;
  if ((tag & 31) === 31) {
    let oct = tag;
    tag = 0;
    while ((oct & 128) === 128) {
      oct = buf.readUInt8(fail);
      if (buf.isError(oct))
        return oct;
      tag <<= 7;
      tag |= oct & 127;
    }
  } else {
    tag &= 31;
  }
  const tagStr = der.tag[tag];
  return {
    cls,
    primitive,
    tag,
    tagStr
  };
}
function derDecodeLen(buf, primitive, fail) {
  let len = buf.readUInt8(fail);
  if (buf.isError(len))
    return len;
  if (!primitive && len === 128)
    return null;
  if ((len & 128) === 0) {
    return len;
  }
  const num = len & 127;
  if (num > 4)
    return buf.error("length octect is too long");
  len = 0;
  for (let i = 0; i < num; i++) {
    len <<= 8;
    const j = buf.readUInt8(fail);
    if (buf.isError(j))
      return j;
    len |= j;
  }
  return len;
}
const inherits = inheritsExports;
const Buffer$7 = safer_1.Buffer;
const DERDecoder = der_1;
function PEMDecoder(entity) {
  DERDecoder.call(this, entity);
  this.enc = "pem";
}
inherits(PEMDecoder, DERDecoder);
var pem = PEMDecoder;
PEMDecoder.prototype.decode = function decode3(data, options) {
  const lines = data.toString().split(/[\r\n]+/g);
  const label = options.label.toUpperCase();
  const re = /^-----(BEGIN|END) ([^-]+)-----$/;
  let start = -1;
  let end2 = -1;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(re);
    if (match === null)
      continue;
    if (match[2] !== label)
      continue;
    if (start === -1) {
      if (match[1] !== "BEGIN")
        break;
      start = i;
    } else {
      if (match[1] !== "END")
        break;
      end2 = i;
      break;
    }
  }
  if (start === -1 || end2 === -1)
    throw new Error("PEM section not found for: " + label);
  const base64 = lines.slice(start + 1, end2).join("");
  base64.replace(/[^a-z0-9+/=]+/gi, "");
  const input = Buffer$7.from(base64, "base64");
  return DERDecoder.prototype.decode.call(this, input, options);
};
(function(exports) {
  const decoders2 = exports;
  decoders2.der = der_1;
  decoders2.pem = pem;
})(decoders);
(function(exports) {
  const encoders$1 = encoders;
  const decoders$1 = decoders;
  const inherits2 = inheritsExports;
  const api2 = exports;
  api2.define = function define(name, body) {
    return new Entity(name, body);
  };
  function Entity(name, body) {
    this.name = name;
    this.body = body;
    this.decoders = {};
    this.encoders = {};
  }
  Entity.prototype._createNamed = function createNamed(Base) {
    const name = this.name;
    function Generated(entity) {
      this._initNamed(entity, name);
    }
    inherits2(Generated, Base);
    Generated.prototype._initNamed = function _initNamed(entity, name2) {
      Base.call(this, entity, name2);
    };
    return new Generated(this);
  };
  Entity.prototype._getDecoder = function _getDecoder(enc) {
    enc = enc || "der";
    if (!this.decoders.hasOwnProperty(enc))
      this.decoders[enc] = this._createNamed(decoders$1[enc]);
    return this.decoders[enc];
  };
  Entity.prototype.decode = function decode5(data, enc, options) {
    return this._getDecoder(enc).decode(data, options);
  };
  Entity.prototype._getEncoder = function _getEncoder(enc) {
    enc = enc || "der";
    if (!this.encoders.hasOwnProperty(enc))
      this.encoders[enc] = this._createNamed(encoders$1[enc]);
    return this.encoders[enc];
  };
  Entity.prototype.encode = function encode5(data, enc, reporter2) {
    return this._getEncoder(enc).encode(data, reporter2);
  };
})(api);
var base = {};
(function(exports) {
  const base2 = exports;
  base2.Reporter = reporter.Reporter;
  base2.DecoderBuffer = buffer.DecoderBuffer;
  base2.EncoderBuffer = buffer.EncoderBuffer;
  base2.Node = node$1;
})(base);
var constants = {};
(function(exports) {
  const constants2 = exports;
  constants2._reverse = function reverse(map) {
    const res = {};
    Object.keys(map).forEach(function(key3) {
      if ((key3 | 0) == key3)
        key3 = key3 | 0;
      const value = map[key3];
      res[value] = key3;
    });
    return res;
  };
  constants2.der = der$2;
})(constants);
(function(exports) {
  const asn12 = exports;
  asn12.bignum = bnExports;
  asn12.define = api.define;
  asn12.base = base;
  asn12.constants = constants;
  asn12.decoders = decoders;
  asn12.encoders = encoders;
})(asn1$1);
var jws$1 = {};
var safeBuffer = { exports: {} };
(function(module, exports) {
  var buffer2 = require$$0;
  var Buffer2 = buffer2.Buffer;
  function copyProps(src2, dst) {
    for (var key3 in src2) {
      dst[key3] = src2[key3];
    }
  }
  if (Buffer2.from && Buffer2.alloc && Buffer2.allocUnsafe && Buffer2.allocUnsafeSlow) {
    module.exports = buffer2;
  } else {
    copyProps(buffer2, exports);
    exports.Buffer = SafeBuffer;
  }
  function SafeBuffer(arg, encodingOrOffset, length) {
    return Buffer2(arg, encodingOrOffset, length);
  }
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
    return buffer2.SlowBuffer(size);
  };
})(safeBuffer, safeBuffer.exports);
var safeBufferExports = safeBuffer.exports;
var Buffer$6 = safeBufferExports.Buffer;
var Stream$2 = require$$3;
var util$3 = require$$5;
function DataStream$2(data) {
  this.buffer = null;
  this.writable = true;
  this.readable = true;
  if (!data) {
    this.buffer = Buffer$6.alloc(0);
    return this;
  }
  if (typeof data.pipe === "function") {
    this.buffer = Buffer$6.alloc(0);
    data.pipe(this);
    return this;
  }
  if (data.length || typeof data === "object") {
    this.buffer = data;
    this.writable = false;
    process.nextTick((function() {
      this.emit("end", data);
      this.readable = false;
      this.emit("close");
    }).bind(this));
    return this;
  }
  throw new TypeError("Unexpected data type (" + typeof data + ")");
}
util$3.inherits(DataStream$2, Stream$2);
DataStream$2.prototype.write = function write(data) {
  this.buffer = Buffer$6.concat([this.buffer, Buffer$6.from(data)]);
  this.emit("data", data);
};
DataStream$2.prototype.end = function end(data) {
  if (data)
    this.write(data);
  this.emit("end", data);
  this.emit("close");
  this.writable = false;
  this.readable = false;
};
var dataStream = DataStream$2;
function getParamSize(keySize) {
  var result = (keySize / 8 | 0) + (keySize % 8 === 0 ? 0 : 1);
  return result;
}
var paramBytesForAlg = {
  ES256: getParamSize(256),
  ES384: getParamSize(384),
  ES512: getParamSize(521)
};
function getParamBytesForAlg$1(alg) {
  var paramBytes = paramBytesForAlg[alg];
  if (paramBytes) {
    return paramBytes;
  }
  throw new Error('Unknown algorithm "' + alg + '"');
}
var paramBytesForAlg_1 = getParamBytesForAlg$1;
var Buffer$5 = safeBufferExports.Buffer;
var getParamBytesForAlg = paramBytesForAlg_1;
var MAX_OCTET = 128, CLASS_UNIVERSAL = 0, PRIMITIVE_BIT = 32, TAG_SEQ = 16, TAG_INT = 2, ENCODED_TAG_SEQ = TAG_SEQ | PRIMITIVE_BIT | CLASS_UNIVERSAL << 6, ENCODED_TAG_INT = TAG_INT | CLASS_UNIVERSAL << 6;
function base64Url(base64) {
  return base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function signatureAsBuffer(signature) {
  if (Buffer$5.isBuffer(signature)) {
    return signature;
  } else if ("string" === typeof signature) {
    return Buffer$5.from(signature, "base64");
  }
  throw new TypeError("ECDSA signature must be a Base64 string or a Buffer");
}
function derToJose(signature, alg) {
  signature = signatureAsBuffer(signature);
  var paramBytes = getParamBytesForAlg(alg);
  var maxEncodedParamLength = paramBytes + 1;
  var inputLength = signature.length;
  var offset = 0;
  if (signature[offset++] !== ENCODED_TAG_SEQ) {
    throw new Error('Could not find expected "seq"');
  }
  var seqLength = signature[offset++];
  if (seqLength === (MAX_OCTET | 1)) {
    seqLength = signature[offset++];
  }
  if (inputLength - offset < seqLength) {
    throw new Error('"seq" specified length of "' + seqLength + '", only "' + (inputLength - offset) + '" remaining');
  }
  if (signature[offset++] !== ENCODED_TAG_INT) {
    throw new Error('Could not find expected "int" for "r"');
  }
  var rLength = signature[offset++];
  if (inputLength - offset - 2 < rLength) {
    throw new Error('"r" specified length of "' + rLength + '", only "' + (inputLength - offset - 2) + '" available');
  }
  if (maxEncodedParamLength < rLength) {
    throw new Error('"r" specified length of "' + rLength + '", max of "' + maxEncodedParamLength + '" is acceptable');
  }
  var rOffset = offset;
  offset += rLength;
  if (signature[offset++] !== ENCODED_TAG_INT) {
    throw new Error('Could not find expected "int" for "s"');
  }
  var sLength = signature[offset++];
  if (inputLength - offset !== sLength) {
    throw new Error('"s" specified length of "' + sLength + '", expected "' + (inputLength - offset) + '"');
  }
  if (maxEncodedParamLength < sLength) {
    throw new Error('"s" specified length of "' + sLength + '", max of "' + maxEncodedParamLength + '" is acceptable');
  }
  var sOffset = offset;
  offset += sLength;
  if (offset !== inputLength) {
    throw new Error('Expected to consume entire buffer, but "' + (inputLength - offset) + '" bytes remain');
  }
  var rPadding = paramBytes - rLength, sPadding = paramBytes - sLength;
  var dst = Buffer$5.allocUnsafe(rPadding + rLength + sPadding + sLength);
  for (offset = 0; offset < rPadding; ++offset) {
    dst[offset] = 0;
  }
  signature.copy(dst, offset, rOffset + Math.max(-rPadding, 0), rOffset + rLength);
  offset = paramBytes;
  for (var o = offset; offset < o + sPadding; ++offset) {
    dst[offset] = 0;
  }
  signature.copy(dst, offset, sOffset + Math.max(-sPadding, 0), sOffset + sLength);
  dst = dst.toString("base64");
  dst = base64Url(dst);
  return dst;
}
function countPadding(buf, start, stop) {
  var padding = 0;
  while (start + padding < stop && buf[start + padding] === 0) {
    ++padding;
  }
  var needsSign = buf[start + padding] >= MAX_OCTET;
  if (needsSign) {
    --padding;
  }
  return padding;
}
function joseToDer(signature, alg) {
  signature = signatureAsBuffer(signature);
  var paramBytes = getParamBytesForAlg(alg);
  var signatureBytes = signature.length;
  if (signatureBytes !== paramBytes * 2) {
    throw new TypeError('"' + alg + '" signatures must be "' + paramBytes * 2 + '" bytes, saw "' + signatureBytes + '"');
  }
  var rPadding = countPadding(signature, 0, paramBytes);
  var sPadding = countPadding(signature, paramBytes, signature.length);
  var rLength = paramBytes - rPadding;
  var sLength = paramBytes - sPadding;
  var rsBytes = 1 + 1 + rLength + 1 + 1 + sLength;
  var shortLength = rsBytes < MAX_OCTET;
  var dst = Buffer$5.allocUnsafe((shortLength ? 2 : 3) + rsBytes);
  var offset = 0;
  dst[offset++] = ENCODED_TAG_SEQ;
  if (shortLength) {
    dst[offset++] = rsBytes;
  } else {
    dst[offset++] = MAX_OCTET | 1;
    dst[offset++] = rsBytes & 255;
  }
  dst[offset++] = ENCODED_TAG_INT;
  dst[offset++] = rLength;
  if (rPadding < 0) {
    dst[offset++] = 0;
    offset += signature.copy(dst, offset, 0, paramBytes);
  } else {
    offset += signature.copy(dst, offset, rPadding, paramBytes);
  }
  dst[offset++] = ENCODED_TAG_INT;
  dst[offset++] = sLength;
  if (sPadding < 0) {
    dst[offset++] = 0;
    signature.copy(dst, offset, paramBytes);
  } else {
    signature.copy(dst, offset, paramBytes + sPadding);
  }
  return dst;
}
var ecdsaSigFormatter = {
  derToJose,
  joseToDer
};
var bufferEqualConstantTime;
var hasRequiredBufferEqualConstantTime;
function requireBufferEqualConstantTime() {
  if (hasRequiredBufferEqualConstantTime) return bufferEqualConstantTime;
  hasRequiredBufferEqualConstantTime = 1;
  var Buffer2 = require$$0.Buffer;
  var SlowBuffer = require$$0.SlowBuffer;
  bufferEqualConstantTime = bufferEq;
  function bufferEq(a, b) {
    if (!Buffer2.isBuffer(a) || !Buffer2.isBuffer(b)) {
      return false;
    }
    if (a.length !== b.length) {
      return false;
    }
    var c = 0;
    for (var i = 0; i < a.length; i++) {
      c |= a[i] ^ b[i];
    }
    return c === 0;
  }
  bufferEq.install = function() {
    Buffer2.prototype.equal = SlowBuffer.prototype.equal = function equal(that) {
      return bufferEq(this, that);
    };
  };
  var origBufEqual = Buffer2.prototype.equal;
  var origSlowBufEqual = SlowBuffer.prototype.equal;
  bufferEq.restore = function() {
    Buffer2.prototype.equal = origBufEqual;
    SlowBuffer.prototype.equal = origSlowBufEqual;
  };
  return bufferEqualConstantTime;
}
var Buffer$4 = safeBufferExports.Buffer;
var crypto$3 = require$$0$1;
var formatEcdsa = ecdsaSigFormatter;
var util$2 = require$$5;
var MSG_INVALID_ALGORITHM = '"%s" is not a valid algorithm.\n  Supported algorithms are:\n  "HS256", "HS384", "HS512", "RS256", "RS384", "RS512", "PS256", "PS384", "PS512", "ES256", "ES384", "ES512" and "none".';
var MSG_INVALID_SECRET = "secret must be a string or buffer";
var MSG_INVALID_VERIFIER_KEY = "key must be a string or a buffer";
var MSG_INVALID_SIGNER_KEY = "key must be a string, a buffer or an object";
var supportsKeyObjects = typeof crypto$3.createPublicKey === "function";
if (supportsKeyObjects) {
  MSG_INVALID_VERIFIER_KEY += " or a KeyObject";
  MSG_INVALID_SECRET += "or a KeyObject";
}
function checkIsPublicKey(key3) {
  if (Buffer$4.isBuffer(key3)) {
    return;
  }
  if (typeof key3 === "string") {
    return;
  }
  if (!supportsKeyObjects) {
    throw typeError(MSG_INVALID_VERIFIER_KEY);
  }
  if (typeof key3 !== "object") {
    throw typeError(MSG_INVALID_VERIFIER_KEY);
  }
  if (typeof key3.type !== "string") {
    throw typeError(MSG_INVALID_VERIFIER_KEY);
  }
  if (typeof key3.asymmetricKeyType !== "string") {
    throw typeError(MSG_INVALID_VERIFIER_KEY);
  }
  if (typeof key3.export !== "function") {
    throw typeError(MSG_INVALID_VERIFIER_KEY);
  }
}
function checkIsPrivateKey(key3) {
  if (Buffer$4.isBuffer(key3)) {
    return;
  }
  if (typeof key3 === "string") {
    return;
  }
  if (typeof key3 === "object") {
    return;
  }
  throw typeError(MSG_INVALID_SIGNER_KEY);
}
function checkIsSecretKey(key3) {
  if (Buffer$4.isBuffer(key3)) {
    return;
  }
  if (typeof key3 === "string") {
    return key3;
  }
  if (!supportsKeyObjects) {
    throw typeError(MSG_INVALID_SECRET);
  }
  if (typeof key3 !== "object") {
    throw typeError(MSG_INVALID_SECRET);
  }
  if (key3.type !== "secret") {
    throw typeError(MSG_INVALID_SECRET);
  }
  if (typeof key3.export !== "function") {
    throw typeError(MSG_INVALID_SECRET);
  }
}
function fromBase64(base64) {
  return base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function toBase64(base64url2) {
  base64url2 = base64url2.toString();
  var padding = 4 - base64url2.length % 4;
  if (padding !== 4) {
    for (var i = 0; i < padding; ++i) {
      base64url2 += "=";
    }
  }
  return base64url2.replace(/\-/g, "+").replace(/_/g, "/");
}
function typeError(template) {
  var args = [].slice.call(arguments, 1);
  var errMsg = util$2.format.bind(util$2, template).apply(null, args);
  return new TypeError(errMsg);
}
function bufferOrString(obj2) {
  return Buffer$4.isBuffer(obj2) || typeof obj2 === "string";
}
function normalizeInput(thing) {
  if (!bufferOrString(thing))
    thing = JSON.stringify(thing);
  return thing;
}
function createHmacSigner(bits) {
  return function sign2(thing, secret) {
    checkIsSecretKey(secret);
    thing = normalizeInput(thing);
    var hmac = crypto$3.createHmac("sha" + bits, secret);
    var sig = (hmac.update(thing), hmac.digest("base64"));
    return fromBase64(sig);
  };
}
var bufferEqual;
var timingSafeEqual = "timingSafeEqual" in crypto$3 ? function timingSafeEqual2(a, b) {
  if (a.byteLength !== b.byteLength) {
    return false;
  }
  return crypto$3.timingSafeEqual(a, b);
} : function timingSafeEqual3(a, b) {
  if (!bufferEqual) {
    bufferEqual = requireBufferEqualConstantTime();
  }
  return bufferEqual(a, b);
};
function createHmacVerifier(bits) {
  return function verify2(thing, signature, secret) {
    var computedSig = createHmacSigner(bits)(thing, secret);
    return timingSafeEqual(Buffer$4.from(signature), Buffer$4.from(computedSig));
  };
}
function createKeySigner(bits) {
  return function sign2(thing, privateKey) {
    checkIsPrivateKey(privateKey);
    thing = normalizeInput(thing);
    var signer = crypto$3.createSign("RSA-SHA" + bits);
    var sig = (signer.update(thing), signer.sign(privateKey, "base64"));
    return fromBase64(sig);
  };
}
function createKeyVerifier(bits) {
  return function verify2(thing, signature, publicKey) {
    checkIsPublicKey(publicKey);
    thing = normalizeInput(thing);
    signature = toBase64(signature);
    var verifier = crypto$3.createVerify("RSA-SHA" + bits);
    verifier.update(thing);
    return verifier.verify(publicKey, signature, "base64");
  };
}
function createPSSKeySigner(bits) {
  return function sign2(thing, privateKey) {
    checkIsPrivateKey(privateKey);
    thing = normalizeInput(thing);
    var signer = crypto$3.createSign("RSA-SHA" + bits);
    var sig = (signer.update(thing), signer.sign({
      key: privateKey,
      padding: crypto$3.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto$3.constants.RSA_PSS_SALTLEN_DIGEST
    }, "base64"));
    return fromBase64(sig);
  };
}
function createPSSKeyVerifier(bits) {
  return function verify2(thing, signature, publicKey) {
    checkIsPublicKey(publicKey);
    thing = normalizeInput(thing);
    signature = toBase64(signature);
    var verifier = crypto$3.createVerify("RSA-SHA" + bits);
    verifier.update(thing);
    return verifier.verify({
      key: publicKey,
      padding: crypto$3.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto$3.constants.RSA_PSS_SALTLEN_DIGEST
    }, signature, "base64");
  };
}
function createECDSASigner(bits) {
  var inner = createKeySigner(bits);
  return function sign2() {
    var signature = inner.apply(null, arguments);
    signature = formatEcdsa.derToJose(signature, "ES" + bits);
    return signature;
  };
}
function createECDSAVerifer(bits) {
  var inner = createKeyVerifier(bits);
  return function verify2(thing, signature, publicKey) {
    signature = formatEcdsa.joseToDer(signature, "ES" + bits).toString("base64");
    var result = inner(thing, signature, publicKey);
    return result;
  };
}
function createNoneSigner() {
  return function sign2() {
    return "";
  };
}
function createNoneVerifier() {
  return function verify2(thing, signature) {
    return signature === "";
  };
}
var jwa$2 = function jwa(algorithm) {
  var signerFactories = {
    hs: createHmacSigner,
    rs: createKeySigner,
    ps: createPSSKeySigner,
    es: createECDSASigner,
    none: createNoneSigner
  };
  var verifierFactories = {
    hs: createHmacVerifier,
    rs: createKeyVerifier,
    ps: createPSSKeyVerifier,
    es: createECDSAVerifer,
    none: createNoneVerifier
  };
  var match = algorithm.match(/^(RS|PS|ES|HS)(256|384|512)$|^(none)$/);
  if (!match)
    throw typeError(MSG_INVALID_ALGORITHM, algorithm);
  var algo = (match[1] || match[3]).toLowerCase();
  var bits = match[2];
  return {
    sign: signerFactories[algo](bits),
    verify: verifierFactories[algo](bits)
  };
};
var Buffer$3 = require$$0.Buffer;
var tostring = function toString(obj2) {
  if (typeof obj2 === "string")
    return obj2;
  if (typeof obj2 === "number" || Buffer$3.isBuffer(obj2))
    return obj2.toString();
  return JSON.stringify(obj2);
};
var Buffer$2 = safeBufferExports.Buffer;
var DataStream$1 = dataStream;
var jwa$1 = jwa$2;
var Stream$1 = require$$3;
var toString$1 = tostring;
var util$1 = require$$5;
function base64url(string, encoding) {
  return Buffer$2.from(string, encoding).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function jwsSecuredInput(header, payload, encoding) {
  encoding = encoding || "utf8";
  var encodedHeader = base64url(toString$1(header), "binary");
  var encodedPayload = base64url(toString$1(payload), encoding);
  return util$1.format("%s.%s", encodedHeader, encodedPayload);
}
function jwsSign(opts) {
  var header = opts.header;
  var payload = opts.payload;
  var secretOrKey = opts.secret || opts.privateKey;
  var encoding = opts.encoding;
  var algo = jwa$1(header.alg);
  var securedInput = jwsSecuredInput(header, payload, encoding);
  var signature = algo.sign(securedInput, secretOrKey);
  return util$1.format("%s.%s", securedInput, signature);
}
function SignStream$1(opts) {
  var secret = opts.secret;
  secret = secret == null ? opts.privateKey : secret;
  secret = secret == null ? opts.key : secret;
  if (/^hs/i.test(opts.header.alg) === true && secret == null) {
    throw new TypeError("secret must be a string or buffer or a KeyObject");
  }
  var secretStream = new DataStream$1(secret);
  this.readable = true;
  this.header = opts.header;
  this.encoding = opts.encoding;
  this.secret = this.privateKey = this.key = secretStream;
  this.payload = new DataStream$1(opts.payload);
  this.secret.once("close", (function() {
    if (!this.payload.writable && this.readable)
      this.sign();
  }).bind(this));
  this.payload.once("close", (function() {
    if (!this.secret.writable && this.readable)
      this.sign();
  }).bind(this));
}
util$1.inherits(SignStream$1, Stream$1);
SignStream$1.prototype.sign = function sign() {
  try {
    var signature = jwsSign({
      header: this.header,
      payload: this.payload.buffer,
      secret: this.secret.buffer,
      encoding: this.encoding
    });
    this.emit("done", signature);
    this.emit("data", signature);
    this.emit("end");
    this.readable = false;
    return signature;
  } catch (e) {
    this.readable = false;
    this.emit("error", e);
    this.emit("close");
  }
};
SignStream$1.sign = jwsSign;
var signStream = SignStream$1;
var Buffer$1 = safeBufferExports.Buffer;
var DataStream = dataStream;
var jwa2 = jwa$2;
var Stream = require$$3;
var toString2 = tostring;
var util = require$$5;
var JWS_REGEX = /^[a-zA-Z0-9\-_]+?\.[a-zA-Z0-9\-_]+?\.([a-zA-Z0-9\-_]+)?$/;
function isObject(thing) {
  return Object.prototype.toString.call(thing) === "[object Object]";
}
function safeJsonParse(thing) {
  if (isObject(thing))
    return thing;
  try {
    return JSON.parse(thing);
  } catch (e) {
    return void 0;
  }
}
function headerFromJWS(jwsSig) {
  var encodedHeader = jwsSig.split(".", 1)[0];
  return safeJsonParse(Buffer$1.from(encodedHeader, "base64").toString("binary"));
}
function securedInputFromJWS(jwsSig) {
  return jwsSig.split(".", 2).join(".");
}
function signatureFromJWS(jwsSig) {
  return jwsSig.split(".")[2];
}
function payloadFromJWS(jwsSig, encoding) {
  encoding = encoding || "utf8";
  var payload = jwsSig.split(".")[1];
  return Buffer$1.from(payload, "base64").toString(encoding);
}
function isValidJws(string) {
  return JWS_REGEX.test(string) && !!headerFromJWS(string);
}
function jwsVerify(jwsSig, algorithm, secretOrKey) {
  if (!algorithm) {
    var err = new Error("Missing algorithm parameter for jws.verify");
    err.code = "MISSING_ALGORITHM";
    throw err;
  }
  jwsSig = toString2(jwsSig);
  var signature = signatureFromJWS(jwsSig);
  var securedInput = securedInputFromJWS(jwsSig);
  var algo = jwa2(algorithm);
  return algo.verify(securedInput, signature, secretOrKey);
}
function jwsDecode(jwsSig, opts) {
  opts = opts || {};
  jwsSig = toString2(jwsSig);
  if (!isValidJws(jwsSig))
    return null;
  var header = headerFromJWS(jwsSig);
  if (!header)
    return null;
  var payload = payloadFromJWS(jwsSig);
  if (header.typ === "JWT" || opts.json)
    payload = JSON.parse(payload, opts.encoding);
  return {
    header,
    payload,
    signature: signatureFromJWS(jwsSig)
  };
}
function VerifyStream$1(opts) {
  opts = opts || {};
  var secretOrKey = opts.secret;
  secretOrKey = secretOrKey == null ? opts.publicKey : secretOrKey;
  secretOrKey = secretOrKey == null ? opts.key : secretOrKey;
  if (/^hs/i.test(opts.algorithm) === true && secretOrKey == null) {
    throw new TypeError("secret must be a string or buffer or a KeyObject");
  }
  var secretStream = new DataStream(secretOrKey);
  this.readable = true;
  this.algorithm = opts.algorithm;
  this.encoding = opts.encoding;
  this.secret = this.publicKey = this.key = secretStream;
  this.signature = new DataStream(opts.signature);
  this.secret.once("close", (function() {
    if (!this.signature.writable && this.readable)
      this.verify();
  }).bind(this));
  this.signature.once("close", (function() {
    if (!this.secret.writable && this.readable)
      this.verify();
  }).bind(this));
}
util.inherits(VerifyStream$1, Stream);
VerifyStream$1.prototype.verify = function verify() {
  try {
    var valid = jwsVerify(this.signature.buffer, this.algorithm, this.key.buffer);
    var obj2 = jwsDecode(this.signature.buffer, this.encoding);
    this.emit("done", valid, obj2);
    this.emit("data", valid);
    this.emit("end");
    this.readable = false;
    return valid;
  } catch (e) {
    this.readable = false;
    this.emit("error", e);
    this.emit("close");
  }
};
VerifyStream$1.decode = jwsDecode;
VerifyStream$1.isValid = isValidJws;
VerifyStream$1.verify = jwsVerify;
var verifyStream = VerifyStream$1;
var SignStream = signStream;
var VerifyStream = verifyStream;
var ALGORITHMS = [
  "HS256",
  "HS384",
  "HS512",
  "RS256",
  "RS384",
  "RS512",
  "PS256",
  "PS384",
  "PS512",
  "ES256",
  "ES384",
  "ES512"
];
jws$1.ALGORITHMS = ALGORITHMS;
jws$1.sign = SignStream.sign;
jws$1.verify = VerifyStream.verify;
jws$1.decode = VerifyStream.decode;
jws$1.isValid = VerifyStream.isValid;
jws$1.createSign = function createSign(opts) {
  return new SignStream(opts);
};
jws$1.createVerify = function createVerify(opts) {
  return new VerifyStream(opts);
};
const WebPushConstants$2 = {};
WebPushConstants$2.supportedContentEncodings = {
  AES_GCM: "aesgcm",
  AES_128_GCM: "aes128gcm"
};
WebPushConstants$2.supportedUrgency = {
  VERY_LOW: "very-low",
  LOW: "low",
  NORMAL: "normal",
  HIGH: "high"
};
var webPushConstants$1 = WebPushConstants$2;
function validate(base64) {
  return /^[A-Za-z0-9\-_]+$/.test(base64);
}
var urlsafeBase64Helper = {
  validate
};
const crypto$2 = require$$0$1;
const asn1 = asn1$1;
const jws = jws$1;
const { URL } = require$$3$1;
const WebPushConstants$1 = webPushConstants$1;
const urlBase64Helper$1 = urlsafeBase64Helper;
const DEFAULT_EXPIRATION_SECONDS = 12 * 60 * 60;
const MAX_EXPIRATION_SECONDS = 24 * 60 * 60;
const ECPrivateKeyASN = asn1.define("ECPrivateKey", function() {
  this.seq().obj(
    this.key("version").int(),
    this.key("privateKey").octstr(),
    this.key("parameters").explicit(0).objid().optional(),
    this.key("publicKey").explicit(1).bitstr().optional()
  );
});
function toPEM(key3) {
  return ECPrivateKeyASN.encode({
    version: 1,
    privateKey: key3,
    parameters: [1, 2, 840, 10045, 3, 1, 7]
    // prime256v1
  }, "pem", {
    label: "EC PRIVATE KEY"
  });
}
function generateVAPIDKeys() {
  const curve = crypto$2.createECDH("prime256v1");
  curve.generateKeys();
  let publicKeyBuffer = curve.getPublicKey();
  let privateKeyBuffer = curve.getPrivateKey();
  if (privateKeyBuffer.length < 32) {
    const padding = Buffer.alloc(32 - privateKeyBuffer.length);
    padding.fill(0);
    privateKeyBuffer = Buffer.concat([padding, privateKeyBuffer]);
  }
  if (publicKeyBuffer.length < 65) {
    const padding = Buffer.alloc(65 - publicKeyBuffer.length);
    padding.fill(0);
    publicKeyBuffer = Buffer.concat([padding, publicKeyBuffer]);
  }
  return {
    publicKey: publicKeyBuffer.toString("base64url"),
    privateKey: privateKeyBuffer.toString("base64url")
  };
}
function validateSubject(subject) {
  if (!subject) {
    throw new Error("No subject set in vapidDetails.subject.");
  }
  if (typeof subject !== "string" || subject.length === 0) {
    throw new Error("The subject value must be a string containing an https: URL or mailto: address. " + subject);
  }
  let subjectParseResult = null;
  try {
    subjectParseResult = new URL(subject);
  } catch (err) {
    throw new Error("Vapid subject is not a valid URL. " + subject);
  }
  if (!["https:", "mailto:"].includes(subjectParseResult.protocol)) {
    throw new Error("Vapid subject is not an https: or mailto: URL. " + subject);
  }
  if (subjectParseResult.hostname === "localhost") {
    console.warn("Vapid subject points to a localhost web URI, which is unsupported by Apple's push notification server and will result in a BadJwtToken error when sending notifications.");
  }
}
function validatePublicKey(publicKey) {
  if (!publicKey) {
    throw new Error("No key set vapidDetails.publicKey");
  }
  if (typeof publicKey !== "string") {
    throw new Error("Vapid public key is must be a URL safe Base 64 encoded string.");
  }
  if (!urlBase64Helper$1.validate(publicKey)) {
    throw new Error('Vapid public key must be a URL safe Base 64 (without "=")');
  }
  publicKey = Buffer.from(publicKey, "base64url");
  if (publicKey.length !== 65) {
    throw new Error("Vapid public key should be 65 bytes long when decoded.");
  }
}
function validatePrivateKey(privateKey) {
  if (!privateKey) {
    throw new Error("No key set in vapidDetails.privateKey");
  }
  if (typeof privateKey !== "string") {
    throw new Error("Vapid private key must be a URL safe Base 64 encoded string.");
  }
  if (!urlBase64Helper$1.validate(privateKey)) {
    throw new Error('Vapid private key must be a URL safe Base 64 (without "=")');
  }
  privateKey = Buffer.from(privateKey, "base64url");
  if (privateKey.length !== 32) {
    throw new Error("Vapid private key should be 32 bytes long when decoded.");
  }
}
function getFutureExpirationTimestamp(numSeconds) {
  const futureExp = /* @__PURE__ */ new Date();
  futureExp.setSeconds(futureExp.getSeconds() + numSeconds);
  return Math.floor(futureExp.getTime() / 1e3);
}
function validateExpiration(expiration) {
  if (!Number.isInteger(expiration)) {
    throw new Error("`expiration` value must be a number");
  }
  if (expiration < 0) {
    throw new Error("`expiration` must be a positive integer");
  }
  const maxExpirationTimestamp = getFutureExpirationTimestamp(MAX_EXPIRATION_SECONDS);
  if (expiration >= maxExpirationTimestamp) {
    throw new Error("`expiration` value is greater than maximum of 24 hours");
  }
}
function getVapidHeaders(audience, subject, publicKey, privateKey, contentEncoding, expiration) {
  if (!audience) {
    throw new Error("No audience could be generated for VAPID.");
  }
  if (typeof audience !== "string" || audience.length === 0) {
    throw new Error("The audience value must be a string containing the origin of a push service. " + audience);
  }
  try {
    new URL(audience);
  } catch (err) {
    throw new Error("VAPID audience is not a url. " + audience);
  }
  validateSubject(subject);
  validatePublicKey(publicKey);
  validatePrivateKey(privateKey);
  privateKey = Buffer.from(privateKey, "base64url");
  if (expiration) {
    validateExpiration(expiration);
  } else {
    expiration = getFutureExpirationTimestamp(DEFAULT_EXPIRATION_SECONDS);
  }
  const header = {
    typ: "JWT",
    alg: "ES256"
  };
  const jwtPayload = {
    aud: audience,
    exp: expiration,
    sub: subject
  };
  const jwt = jws.sign({
    header,
    payload: jwtPayload,
    privateKey: toPEM(privateKey)
  });
  if (contentEncoding === WebPushConstants$1.supportedContentEncodings.AES_128_GCM) {
    return {
      Authorization: "vapid t=" + jwt + ", k=" + publicKey
    };
  }
  if (contentEncoding === WebPushConstants$1.supportedContentEncodings.AES_GCM) {
    return {
      Authorization: "WebPush " + jwt,
      "Crypto-Key": "p256ecdsa=" + publicKey
    };
  }
  throw new Error("Unsupported encoding type specified.");
}
var vapidHelper$2 = {
  generateVAPIDKeys,
  getFutureExpirationTimestamp,
  getVapidHeaders,
  validateSubject,
  validatePublicKey,
  validatePrivateKey,
  validateExpiration
};
var crypto$1 = require$$0$1;
var AES_GCM = "aes-128-gcm";
var PAD_SIZE = { "aes128gcm": 1, "aesgcm": 2 };
var TAG_LENGTH = 16;
var KEY_LENGTH = 16;
var NONCE_LENGTH = 12;
var SHA_256_LENGTH = 32;
var MODE_ENCRYPT = "encrypt";
var MODE_DECRYPT = "decrypt";
var keylog;
if (process.env.ECE_KEYLOG === "1") {
  keylog = function(m, k) {
    console.warn(m + " [" + k.length + "]: " + k.toString("base64url"));
    return k;
  };
} else {
  keylog = function(m, k) {
    return k;
  };
}
function decode4(b) {
  if (typeof b === "string") {
    return Buffer.from(b, "base64url");
  }
  return b;
}
function HMAC_hash(key3, input) {
  var hmac = crypto$1.createHmac("sha256", key3);
  hmac.update(input);
  return hmac.digest();
}
function HKDF_extract(salt, ikm) {
  keylog("salt", salt);
  keylog("ikm", ikm);
  return keylog("extract", HMAC_hash(salt, ikm));
}
function HKDF_expand(prk, info2, l) {
  keylog("prk", prk);
  keylog("info", info2);
  var output = Buffer.alloc(0);
  var T = Buffer.alloc(0);
  info2 = Buffer.from(info2, "ascii");
  var counter = 0;
  var cbuf = Buffer.alloc(1);
  while (output.length < l) {
    cbuf.writeUIntBE(++counter, 0, 1);
    T = HMAC_hash(prk, Buffer.concat([T, info2, cbuf]));
    output = Buffer.concat([output, T]);
  }
  return keylog("expand", output.slice(0, l));
}
function HKDF(salt, ikm, info2, len) {
  return HKDF_expand(HKDF_extract(salt, ikm), info2, len);
}
function info(base2, context) {
  var result = Buffer.concat([
    Buffer.from("Content-Encoding: " + base2 + "\0", "ascii"),
    context
  ]);
  keylog("info " + base2, result);
  return result;
}
function lengthPrefix(buffer2) {
  var b = Buffer.concat([Buffer.alloc(2), buffer2]);
  b.writeUIntBE(buffer2.length, 0, 2);
  return b;
}
function extractDH(header, mode) {
  var key3 = header.privateKey;
  var senderPubKey, receiverPubKey;
  if (mode === MODE_ENCRYPT) {
    senderPubKey = key3.getPublicKey();
    receiverPubKey = header.dh;
  } else if (mode === MODE_DECRYPT) {
    senderPubKey = header.dh;
    receiverPubKey = key3.getPublicKey();
  } else {
    throw new Error("Unknown mode only " + MODE_ENCRYPT + " and " + MODE_DECRYPT + " supported");
  }
  return {
    secret: key3.computeSecret(header.dh),
    context: Buffer.concat([
      Buffer.from(header.keylabel, "ascii"),
      Buffer.from([0]),
      lengthPrefix(receiverPubKey),
      // user agent
      lengthPrefix(senderPubKey)
      // application server
    ])
  };
}
function extractSecretAndContext(header, mode) {
  var result = { secret: null, context: Buffer.alloc(0) };
  if (header.key) {
    result.secret = header.key;
    if (result.secret.length !== KEY_LENGTH) {
      throw new Error("An explicit key must be " + KEY_LENGTH + " bytes");
    }
  } else if (header.dh) {
    result = extractDH(header, mode);
  } else if (typeof header.keyid !== void 0) {
    result.secret = header.keymap[header.keyid];
  }
  if (!result.secret) {
    throw new Error("Unable to determine key");
  }
  keylog("secret", result.secret);
  keylog("context", result.context);
  if (header.authSecret) {
    result.secret = HKDF(
      header.authSecret,
      result.secret,
      info("auth", Buffer.alloc(0)),
      SHA_256_LENGTH
    );
    keylog("authsecret", result.secret);
  }
  return result;
}
function webpushSecret(header, mode) {
  if (!header.authSecret) {
    throw new Error("No authentication secret for webpush");
  }
  keylog("authsecret", header.authSecret);
  var remotePubKey, senderPubKey, receiverPubKey;
  if (mode === MODE_ENCRYPT) {
    senderPubKey = header.privateKey.getPublicKey();
    remotePubKey = receiverPubKey = header.dh;
  } else if (mode === MODE_DECRYPT) {
    remotePubKey = senderPubKey = header.keyid;
    receiverPubKey = header.privateKey.getPublicKey();
  } else {
    throw new Error("Unknown mode only " + MODE_ENCRYPT + " and " + MODE_DECRYPT + " supported");
  }
  keylog("remote pubkey", remotePubKey);
  keylog("sender pubkey", senderPubKey);
  keylog("receiver pubkey", receiverPubKey);
  return keylog(
    "secret dh",
    HKDF(
      header.authSecret,
      header.privateKey.computeSecret(remotePubKey),
      Buffer.concat([
        Buffer.from("WebPush: info\0"),
        receiverPubKey,
        senderPubKey
      ]),
      SHA_256_LENGTH
    )
  );
}
function extractSecret(header, mode, keyLookupCallback) {
  if (keyLookupCallback) {
    if (!isFunction(keyLookupCallback)) {
      throw new Error("Callback is not a function");
    }
  }
  if (header.key) {
    if (header.key.length !== KEY_LENGTH) {
      throw new Error("An explicit key must be " + KEY_LENGTH + " bytes");
    }
    return keylog("secret key", header.key);
  }
  if (!header.privateKey) {
    if (!keyLookupCallback) {
      var key3 = header.keymap && header.keymap[header.keyid];
    } else {
      var key3 = keyLookupCallback(header.keyid);
    }
    if (!key3) {
      throw new Error('No saved key (keyid: "' + header.keyid + '")');
    }
    return key3;
  }
  return webpushSecret(header, mode);
}
function deriveKeyAndNonce(header, mode, lookupKeyCallback) {
  if (!header.salt) {
    throw new Error("must include a salt parameter for " + header.version);
  }
  var keyInfo;
  var nonceInfo;
  var secret;
  if (header.version === "aesgcm") {
    var s = extractSecretAndContext(header, mode);
    keyInfo = info("aesgcm", s.context);
    nonceInfo = info("nonce", s.context);
    secret = s.secret;
  } else if (header.version === "aes128gcm") {
    keyInfo = Buffer.from("Content-Encoding: aes128gcm\0");
    nonceInfo = Buffer.from("Content-Encoding: nonce\0");
    secret = extractSecret(header, mode, lookupKeyCallback);
  } else {
    throw new Error("Unable to set context for mode " + header.version);
  }
  var prk = HKDF_extract(header.salt, secret);
  var result = {
    key: HKDF_expand(prk, keyInfo, KEY_LENGTH),
    nonce: HKDF_expand(prk, nonceInfo, NONCE_LENGTH)
  };
  keylog("key", result.key);
  keylog("nonce base", result.nonce);
  return result;
}
function parseParams(params) {
  var header = {};
  header.version = params.version || "aes128gcm";
  header.rs = parseInt(params.rs, 10);
  if (isNaN(header.rs)) {
    header.rs = 4096;
  }
  var overhead = PAD_SIZE[header.version];
  if (header.version === "aes128gcm") {
    overhead += TAG_LENGTH;
  }
  if (header.rs <= overhead) {
    throw new Error("The rs parameter has to be greater than " + overhead);
  }
  if (params.salt) {
    header.salt = decode4(params.salt);
    if (header.salt.length !== KEY_LENGTH) {
      throw new Error("The salt parameter must be " + KEY_LENGTH + " bytes");
    }
  }
  header.keyid = params.keyid;
  if (params.key) {
    header.key = decode4(params.key);
  } else {
    header.privateKey = params.privateKey;
    if (!header.privateKey) {
      header.keymap = params.keymap;
    }
    if (header.version !== "aes128gcm") {
      header.keylabel = params.keylabel || "P-256";
    }
    if (params.dh) {
      header.dh = decode4(params.dh);
    }
  }
  if (params.authSecret) {
    header.authSecret = decode4(params.authSecret);
  }
  return header;
}
function generateNonce(base2, counter) {
  var nonce = Buffer.from(base2);
  var m = nonce.readUIntBE(nonce.length - 6, 6);
  var x = ((m ^ counter) & 16777215) + ((m / 16777216 ^ counter / 16777216) & 16777215) * 16777216;
  nonce.writeUIntBE(x, nonce.length - 6, 6);
  keylog("nonce" + counter, nonce);
  return nonce;
}
function readHeader(buffer2, header) {
  var idsz = buffer2.readUIntBE(20, 1);
  header.salt = buffer2.slice(0, KEY_LENGTH);
  header.rs = buffer2.readUIntBE(KEY_LENGTH, 4);
  header.keyid = buffer2.slice(21, 21 + idsz);
  return 21 + idsz;
}
function unpadLegacy(data, version) {
  var padSize = PAD_SIZE[version];
  var pad = data.readUIntBE(0, padSize);
  if (pad + padSize > data.length) {
    throw new Error("padding exceeds block size");
  }
  keylog("padding", data.slice(0, padSize + pad));
  var padCheck = Buffer.alloc(pad);
  padCheck.fill(0);
  if (padCheck.compare(data.slice(padSize, padSize + pad)) !== 0) {
    throw new Error("invalid padding");
  }
  return data.slice(padSize + pad);
}
function unpad(data, last) {
  var i = data.length - 1;
  while (i >= 0) {
    if (data[i]) {
      if (last) {
        if (data[i] !== 2) {
          throw new Error("last record needs to start padding with a 2");
        }
      } else {
        if (data[i] !== 1) {
          throw new Error("last record needs to start padding with a 2");
        }
      }
      return data.slice(0, i);
    }
    --i;
  }
  throw new Error("all zero plaintext");
}
function decryptRecord(key3, counter, buffer2, header, last) {
  keylog("decrypt", buffer2);
  var nonce = generateNonce(key3.nonce, counter);
  var gcm = crypto$1.createDecipheriv(AES_GCM, key3.key, nonce);
  gcm.setAuthTag(buffer2.slice(buffer2.length - TAG_LENGTH));
  var data = gcm.update(buffer2.slice(0, buffer2.length - TAG_LENGTH));
  data = Buffer.concat([data, gcm.final()]);
  keylog("decrypted", data);
  if (header.version !== "aes128gcm") {
    return unpadLegacy(data, header.version);
  }
  return unpad(data, last);
}
function decrypt(buffer2, params, keyLookupCallback) {
  var header = parseParams(params);
  if (header.version === "aes128gcm") {
    var headerLength = readHeader(buffer2, header);
    buffer2 = buffer2.slice(headerLength);
  }
  var key3 = deriveKeyAndNonce(header, MODE_DECRYPT, keyLookupCallback);
  var start = 0;
  var result = Buffer.alloc(0);
  var chunkSize = header.rs;
  if (header.version !== "aes128gcm") {
    chunkSize += TAG_LENGTH;
  }
  for (var i = 0; start < buffer2.length; ++i) {
    var end2 = start + chunkSize;
    if (header.version !== "aes128gcm" && end2 === buffer2.length) {
      throw new Error("Truncated payload");
    }
    end2 = Math.min(end2, buffer2.length);
    if (end2 - start <= TAG_LENGTH) {
      throw new Error("Invalid block: too small at " + i);
    }
    var block = decryptRecord(
      key3,
      i,
      buffer2.slice(start, end2),
      header,
      end2 >= buffer2.length
    );
    result = Buffer.concat([result, block]);
    start = end2;
  }
  return result;
}
function encryptRecord(key3, counter, buffer2, pad, header, last) {
  keylog("encrypt", buffer2);
  pad = pad || 0;
  var nonce = generateNonce(key3.nonce, counter);
  var gcm = crypto$1.createCipheriv(AES_GCM, key3.key, nonce);
  var ciphertext = [];
  var padSize = PAD_SIZE[header.version];
  var padding = Buffer.alloc(pad + padSize);
  padding.fill(0);
  if (header.version !== "aes128gcm") {
    padding.writeUIntBE(pad, 0, padSize);
    keylog("padding", padding);
    ciphertext.push(gcm.update(padding));
    ciphertext.push(gcm.update(buffer2));
    if (!last && padding.length + buffer2.length < header.rs) {
      throw new Error("Unable to pad to record size");
    }
  } else {
    ciphertext.push(gcm.update(buffer2));
    padding.writeUIntBE(last ? 2 : 1, 0, 1);
    keylog("padding", padding);
    ciphertext.push(gcm.update(padding));
  }
  gcm.final();
  var tag = gcm.getAuthTag();
  if (tag.length !== TAG_LENGTH) {
    throw new Error("invalid tag generated");
  }
  ciphertext.push(tag);
  return keylog("encrypted", Buffer.concat(ciphertext));
}
function writeHeader(header) {
  var ints = Buffer.alloc(5);
  var keyid = Buffer.from(header.keyid || []);
  if (keyid.length > 255) {
    throw new Error("keyid is too large");
  }
  ints.writeUIntBE(header.rs, 0, 4);
  ints.writeUIntBE(keyid.length, 4, 1);
  return Buffer.concat([header.salt, ints, keyid]);
}
function encrypt$1(buffer2, params, keyLookupCallback) {
  if (!Buffer.isBuffer(buffer2)) {
    throw new Error("buffer argument must be a Buffer");
  }
  var header = parseParams(params);
  if (!header.salt) {
    header.salt = crypto$1.randomBytes(KEY_LENGTH);
  }
  var result;
  if (header.version === "aes128gcm") {
    if (header.privateKey && !header.keyid) {
      header.keyid = header.privateKey.getPublicKey();
    }
    result = writeHeader(header);
  } else {
    result = Buffer.alloc(0);
  }
  var key3 = deriveKeyAndNonce(header, MODE_ENCRYPT, keyLookupCallback);
  var start = 0;
  var padSize = PAD_SIZE[header.version];
  var overhead = padSize;
  if (header.version === "aes128gcm") {
    overhead += TAG_LENGTH;
  }
  var pad = isNaN(parseInt(params.pad, 10)) ? 0 : parseInt(params.pad, 10);
  var counter = 0;
  var last = false;
  while (!last) {
    var recordPad = Math.min(header.rs - overhead - 1, pad);
    if (header.version !== "aes128gcm") {
      recordPad = Math.min((1 << padSize * 8) - 1, recordPad);
    }
    if (pad > 0 && recordPad === 0) {
      ++recordPad;
    }
    pad -= recordPad;
    var end2 = start + header.rs - overhead - recordPad;
    if (header.version !== "aes128gcm") {
      last = end2 > buffer2.length;
    } else {
      last = end2 >= buffer2.length;
    }
    last = last && pad <= 0;
    var block = encryptRecord(
      key3,
      counter,
      buffer2.slice(start, end2),
      recordPad,
      header,
      last
    );
    result = Buffer.concat([result, block]);
    start = end2;
    ++counter;
  }
  return result;
}
function isFunction(object) {
  return typeof object === "function";
}
var ece$1 = {
  decrypt,
  encrypt: encrypt$1
};
const crypto = require$$0$1;
const ece = ece$1;
const encrypt = function(userPublicKey, userAuth, payload, contentEncoding) {
  if (!userPublicKey) {
    throw new Error("No user public key provided for encryption.");
  }
  if (typeof userPublicKey !== "string") {
    throw new Error("The subscription p256dh value must be a string.");
  }
  if (Buffer.from(userPublicKey, "base64url").length !== 65) {
    throw new Error("The subscription p256dh value should be 65 bytes long.");
  }
  if (!userAuth) {
    throw new Error("No user auth provided for encryption.");
  }
  if (typeof userAuth !== "string") {
    throw new Error("The subscription auth key must be a string.");
  }
  if (Buffer.from(userAuth, "base64url").length < 16) {
    throw new Error("The subscription auth key should be at least 16 bytes long");
  }
  if (typeof payload !== "string" && !Buffer.isBuffer(payload)) {
    throw new Error("Payload must be either a string or a Node Buffer.");
  }
  if (typeof payload === "string" || payload instanceof String) {
    payload = Buffer.from(payload);
  }
  const localCurve = crypto.createECDH("prime256v1");
  const localPublicKey = localCurve.generateKeys();
  const salt = crypto.randomBytes(16).toString("base64url");
  const cipherText = ece.encrypt(payload, {
    version: contentEncoding,
    dh: userPublicKey,
    privateKey: localCurve,
    salt,
    authSecret: userAuth
  });
  return {
    localPublicKey,
    salt,
    cipherText
  };
};
var encryptionHelper$2 = {
  encrypt
};
function WebPushError$2(message, statusCode, headers, body, endpoint) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = message;
  this.statusCode = statusCode;
  this.headers = headers;
  this.body = body;
  this.endpoint = endpoint;
}
require$$5.inherits(WebPushError$2, Error);
var webPushError = WebPushError$2;
var dist$1 = {};
var src$1 = { exports: {} };
var browser = { exports: {} };
var ms;
var hasRequiredMs;
function requireMs() {
  if (hasRequiredMs) return ms;
  hasRequiredMs = 1;
  var s = 1e3;
  var m = s * 60;
  var h = m * 60;
  var d = h * 24;
  var w = d * 7;
  var y = d * 365.25;
  ms = function(val, options) {
    options = options || {};
    var type = typeof val;
    if (type === "string" && val.length > 0) {
      return parse(val);
    } else if (type === "number" && isFinite(val)) {
      return options.long ? fmtLong(val) : fmtShort(val);
    }
    throw new Error(
      "val is not a non-empty string or a valid number. val=" + JSON.stringify(val)
    );
  };
  function parse(str) {
    str = String(str);
    if (str.length > 100) {
      return;
    }
    var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
      str
    );
    if (!match) {
      return;
    }
    var n = parseFloat(match[1]);
    var type = (match[2] || "ms").toLowerCase();
    switch (type) {
      case "years":
      case "year":
      case "yrs":
      case "yr":
      case "y":
        return n * y;
      case "weeks":
      case "week":
      case "w":
        return n * w;
      case "days":
      case "day":
      case "d":
        return n * d;
      case "hours":
      case "hour":
      case "hrs":
      case "hr":
      case "h":
        return n * h;
      case "minutes":
      case "minute":
      case "mins":
      case "min":
      case "m":
        return n * m;
      case "seconds":
      case "second":
      case "secs":
      case "sec":
      case "s":
        return n * s;
      case "milliseconds":
      case "millisecond":
      case "msecs":
      case "msec":
      case "ms":
        return n;
      default:
        return void 0;
    }
  }
  function fmtShort(ms2) {
    var msAbs = Math.abs(ms2);
    if (msAbs >= d) {
      return Math.round(ms2 / d) + "d";
    }
    if (msAbs >= h) {
      return Math.round(ms2 / h) + "h";
    }
    if (msAbs >= m) {
      return Math.round(ms2 / m) + "m";
    }
    if (msAbs >= s) {
      return Math.round(ms2 / s) + "s";
    }
    return ms2 + "ms";
  }
  function fmtLong(ms2) {
    var msAbs = Math.abs(ms2);
    if (msAbs >= d) {
      return plural(ms2, msAbs, d, "day");
    }
    if (msAbs >= h) {
      return plural(ms2, msAbs, h, "hour");
    }
    if (msAbs >= m) {
      return plural(ms2, msAbs, m, "minute");
    }
    if (msAbs >= s) {
      return plural(ms2, msAbs, s, "second");
    }
    return ms2 + " ms";
  }
  function plural(ms2, msAbs, n, name) {
    var isPlural = msAbs >= n * 1.5;
    return Math.round(ms2 / n) + " " + name + (isPlural ? "s" : "");
  }
  return ms;
}
var common;
var hasRequiredCommon;
function requireCommon() {
  if (hasRequiredCommon) return common;
  hasRequiredCommon = 1;
  function setup(env) {
    createDebug.debug = createDebug;
    createDebug.default = createDebug;
    createDebug.coerce = coerce;
    createDebug.disable = disable;
    createDebug.enable = enable;
    createDebug.enabled = enabled;
    createDebug.humanize = requireMs();
    createDebug.destroy = destroy;
    Object.keys(env).forEach((key3) => {
      createDebug[key3] = env[key3];
    });
    createDebug.names = [];
    createDebug.skips = [];
    createDebug.formatters = {};
    function selectColor(namespace) {
      let hash = 0;
      for (let i = 0; i < namespace.length; i++) {
        hash = (hash << 5) - hash + namespace.charCodeAt(i);
        hash |= 0;
      }
      return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
    }
    createDebug.selectColor = selectColor;
    function createDebug(namespace) {
      let prevTime;
      let enableOverride = null;
      let namespacesCache;
      let enabledCache;
      function debug(...args) {
        if (!debug.enabled) {
          return;
        }
        const self2 = debug;
        const curr = Number(/* @__PURE__ */ new Date());
        const ms2 = curr - (prevTime || curr);
        self2.diff = ms2;
        self2.prev = prevTime;
        self2.curr = curr;
        prevTime = curr;
        args[0] = createDebug.coerce(args[0]);
        if (typeof args[0] !== "string") {
          args.unshift("%O");
        }
        let index = 0;
        args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
          if (match === "%%") {
            return "%";
          }
          index++;
          const formatter = createDebug.formatters[format];
          if (typeof formatter === "function") {
            const val = args[index];
            match = formatter.call(self2, val);
            args.splice(index, 1);
            index--;
          }
          return match;
        });
        createDebug.formatArgs.call(self2, args);
        const logFn = self2.log || createDebug.log;
        logFn.apply(self2, args);
      }
      debug.namespace = namespace;
      debug.useColors = createDebug.useColors();
      debug.color = createDebug.selectColor(namespace);
      debug.extend = extend;
      debug.destroy = createDebug.destroy;
      Object.defineProperty(debug, "enabled", {
        enumerable: true,
        configurable: false,
        get: () => {
          if (enableOverride !== null) {
            return enableOverride;
          }
          if (namespacesCache !== createDebug.namespaces) {
            namespacesCache = createDebug.namespaces;
            enabledCache = createDebug.enabled(namespace);
          }
          return enabledCache;
        },
        set: (v) => {
          enableOverride = v;
        }
      });
      if (typeof createDebug.init === "function") {
        createDebug.init(debug);
      }
      return debug;
    }
    function extend(namespace, delimiter) {
      const newDebug = createDebug(this.namespace + (typeof delimiter === "undefined" ? ":" : delimiter) + namespace);
      newDebug.log = this.log;
      return newDebug;
    }
    function enable(namespaces) {
      createDebug.save(namespaces);
      createDebug.namespaces = namespaces;
      createDebug.names = [];
      createDebug.skips = [];
      const split = (typeof namespaces === "string" ? namespaces : "").trim().replace(/\s+/g, ",").split(",").filter(Boolean);
      for (const ns of split) {
        if (ns[0] === "-") {
          createDebug.skips.push(ns.slice(1));
        } else {
          createDebug.names.push(ns);
        }
      }
    }
    function matchesTemplate(search, template) {
      let searchIndex = 0;
      let templateIndex = 0;
      let starIndex = -1;
      let matchIndex = 0;
      while (searchIndex < search.length) {
        if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || template[templateIndex] === "*")) {
          if (template[templateIndex] === "*") {
            starIndex = templateIndex;
            matchIndex = searchIndex;
            templateIndex++;
          } else {
            searchIndex++;
            templateIndex++;
          }
        } else if (starIndex !== -1) {
          templateIndex = starIndex + 1;
          matchIndex++;
          searchIndex = matchIndex;
        } else {
          return false;
        }
      }
      while (templateIndex < template.length && template[templateIndex] === "*") {
        templateIndex++;
      }
      return templateIndex === template.length;
    }
    function disable() {
      const namespaces = [
        ...createDebug.names,
        ...createDebug.skips.map((namespace) => "-" + namespace)
      ].join(",");
      createDebug.enable("");
      return namespaces;
    }
    function enabled(name) {
      for (const skip2 of createDebug.skips) {
        if (matchesTemplate(name, skip2)) {
          return false;
        }
      }
      for (const ns of createDebug.names) {
        if (matchesTemplate(name, ns)) {
          return true;
        }
      }
      return false;
    }
    function coerce(val) {
      if (val instanceof Error) {
        return val.stack || val.message;
      }
      return val;
    }
    function destroy() {
      console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
    }
    createDebug.enable(createDebug.load());
    return createDebug;
  }
  common = setup;
  return common;
}
var hasRequiredBrowser;
function requireBrowser() {
  if (hasRequiredBrowser) return browser.exports;
  hasRequiredBrowser = 1;
  (function(module, exports) {
    exports.formatArgs = formatArgs;
    exports.save = save3;
    exports.load = load;
    exports.useColors = useColors;
    exports.storage = localstorage();
    exports.destroy = /* @__PURE__ */ (() => {
      let warned = false;
      return () => {
        if (!warned) {
          warned = true;
          console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
        }
      };
    })();
    exports.colors = [
      "#0000CC",
      "#0000FF",
      "#0033CC",
      "#0033FF",
      "#0066CC",
      "#0066FF",
      "#0099CC",
      "#0099FF",
      "#00CC00",
      "#00CC33",
      "#00CC66",
      "#00CC99",
      "#00CCCC",
      "#00CCFF",
      "#3300CC",
      "#3300FF",
      "#3333CC",
      "#3333FF",
      "#3366CC",
      "#3366FF",
      "#3399CC",
      "#3399FF",
      "#33CC00",
      "#33CC33",
      "#33CC66",
      "#33CC99",
      "#33CCCC",
      "#33CCFF",
      "#6600CC",
      "#6600FF",
      "#6633CC",
      "#6633FF",
      "#66CC00",
      "#66CC33",
      "#9900CC",
      "#9900FF",
      "#9933CC",
      "#9933FF",
      "#99CC00",
      "#99CC33",
      "#CC0000",
      "#CC0033",
      "#CC0066",
      "#CC0099",
      "#CC00CC",
      "#CC00FF",
      "#CC3300",
      "#CC3333",
      "#CC3366",
      "#CC3399",
      "#CC33CC",
      "#CC33FF",
      "#CC6600",
      "#CC6633",
      "#CC9900",
      "#CC9933",
      "#CCCC00",
      "#CCCC33",
      "#FF0000",
      "#FF0033",
      "#FF0066",
      "#FF0099",
      "#FF00CC",
      "#FF00FF",
      "#FF3300",
      "#FF3333",
      "#FF3366",
      "#FF3399",
      "#FF33CC",
      "#FF33FF",
      "#FF6600",
      "#FF6633",
      "#FF9900",
      "#FF9933",
      "#FFCC00",
      "#FFCC33"
    ];
    function useColors() {
      if (typeof window !== "undefined" && window.process && (window.process.type === "renderer" || window.process.__nwjs)) {
        return true;
      }
      if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
        return false;
      }
      let m;
      return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || // Is firebug? http://stackoverflow.com/a/398120/376773
      typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || // Is firefox >= v31?
      // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
      typeof navigator !== "undefined" && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31 || // Double check webkit in userAgent just in case we are in a worker
      typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
    }
    function formatArgs(args) {
      args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + module.exports.humanize(this.diff);
      if (!this.useColors) {
        return;
      }
      const c = "color: " + this.color;
      args.splice(1, 0, c, "color: inherit");
      let index = 0;
      let lastC = 0;
      args[0].replace(/%[a-zA-Z%]/g, (match) => {
        if (match === "%%") {
          return;
        }
        index++;
        if (match === "%c") {
          lastC = index;
        }
      });
      args.splice(lastC, 0, c);
    }
    exports.log = console.debug || console.log || (() => {
    });
    function save3(namespaces) {
      try {
        if (namespaces) {
          exports.storage.setItem("debug", namespaces);
        } else {
          exports.storage.removeItem("debug");
        }
      } catch (error2) {
      }
    }
    function load() {
      let r;
      try {
        r = exports.storage.getItem("debug") || exports.storage.getItem("DEBUG");
      } catch (error2) {
      }
      if (!r && typeof process !== "undefined" && "env" in process) {
        r = process.env.DEBUG;
      }
      return r;
    }
    function localstorage() {
      try {
        return localStorage;
      } catch (error2) {
      }
    }
    module.exports = requireCommon()(exports);
    const { formatters } = module.exports;
    formatters.j = function(v) {
      try {
        return JSON.stringify(v);
      } catch (error2) {
        return "[UnexpectedJSONParseError]: " + error2.message;
      }
    };
  })(browser, browser.exports);
  return browser.exports;
}
var node = { exports: {} };
var hasFlag;
var hasRequiredHasFlag;
function requireHasFlag() {
  if (hasRequiredHasFlag) return hasFlag;
  hasRequiredHasFlag = 1;
  hasFlag = (flag, argv = process.argv) => {
    const prefix = flag.startsWith("-") ? "" : flag.length === 1 ? "-" : "--";
    const position = argv.indexOf(prefix + flag);
    const terminatorPosition = argv.indexOf("--");
    return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
  };
  return hasFlag;
}
var supportsColor_1;
var hasRequiredSupportsColor;
function requireSupportsColor() {
  if (hasRequiredSupportsColor) return supportsColor_1;
  hasRequiredSupportsColor = 1;
  const os = require$$0$2;
  const tty = require$$1;
  const hasFlag2 = requireHasFlag();
  const { env } = process;
  let forceColor;
  if (hasFlag2("no-color") || hasFlag2("no-colors") || hasFlag2("color=false") || hasFlag2("color=never")) {
    forceColor = 0;
  } else if (hasFlag2("color") || hasFlag2("colors") || hasFlag2("color=true") || hasFlag2("color=always")) {
    forceColor = 1;
  }
  if ("FORCE_COLOR" in env) {
    if (env.FORCE_COLOR === "true") {
      forceColor = 1;
    } else if (env.FORCE_COLOR === "false") {
      forceColor = 0;
    } else {
      forceColor = env.FORCE_COLOR.length === 0 ? 1 : Math.min(parseInt(env.FORCE_COLOR, 10), 3);
    }
  }
  function translateLevel(level) {
    if (level === 0) {
      return false;
    }
    return {
      level,
      hasBasic: true,
      has256: level >= 2,
      has16m: level >= 3
    };
  }
  function supportsColor(haveStream, streamIsTTY) {
    if (forceColor === 0) {
      return 0;
    }
    if (hasFlag2("color=16m") || hasFlag2("color=full") || hasFlag2("color=truecolor")) {
      return 3;
    }
    if (hasFlag2("color=256")) {
      return 2;
    }
    if (haveStream && !streamIsTTY && forceColor === void 0) {
      return 0;
    }
    const min = forceColor || 0;
    if (env.TERM === "dumb") {
      return min;
    }
    if (process.platform === "win32") {
      const osRelease = os.release().split(".");
      if (Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10586) {
        return Number(osRelease[2]) >= 14931 ? 3 : 2;
      }
      return 1;
    }
    if ("CI" in env) {
      if (["TRAVIS", "CIRCLECI", "APPVEYOR", "GITLAB_CI", "GITHUB_ACTIONS", "BUILDKITE"].some((sign2) => sign2 in env) || env.CI_NAME === "codeship") {
        return 1;
      }
      return min;
    }
    if ("TEAMCITY_VERSION" in env) {
      return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
    }
    if (env.COLORTERM === "truecolor") {
      return 3;
    }
    if ("TERM_PROGRAM" in env) {
      const version = parseInt((env.TERM_PROGRAM_VERSION || "").split(".")[0], 10);
      switch (env.TERM_PROGRAM) {
        case "iTerm.app":
          return version >= 3 ? 3 : 2;
        case "Apple_Terminal":
          return 2;
      }
    }
    if (/-256(color)?$/i.test(env.TERM)) {
      return 2;
    }
    if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
      return 1;
    }
    if ("COLORTERM" in env) {
      return 1;
    }
    return min;
  }
  function getSupportLevel(stream) {
    const level = supportsColor(stream, stream && stream.isTTY);
    return translateLevel(level);
  }
  supportsColor_1 = {
    supportsColor: getSupportLevel,
    stdout: translateLevel(supportsColor(true, tty.isatty(1))),
    stderr: translateLevel(supportsColor(true, tty.isatty(2)))
  };
  return supportsColor_1;
}
var hasRequiredNode;
function requireNode() {
  if (hasRequiredNode) return node.exports;
  hasRequiredNode = 1;
  (function(module, exports) {
    const tty = require$$1;
    const util2 = require$$5;
    exports.init = init2;
    exports.log = log;
    exports.formatArgs = formatArgs;
    exports.save = save3;
    exports.load = load;
    exports.useColors = useColors;
    exports.destroy = util2.deprecate(
      () => {
      },
      "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`."
    );
    exports.colors = [6, 2, 3, 4, 5, 1];
    try {
      const supportsColor = requireSupportsColor();
      if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
        exports.colors = [
          20,
          21,
          26,
          27,
          32,
          33,
          38,
          39,
          40,
          41,
          42,
          43,
          44,
          45,
          56,
          57,
          62,
          63,
          68,
          69,
          74,
          75,
          76,
          77,
          78,
          79,
          80,
          81,
          92,
          93,
          98,
          99,
          112,
          113,
          128,
          129,
          134,
          135,
          148,
          149,
          160,
          161,
          162,
          163,
          164,
          165,
          166,
          167,
          168,
          169,
          170,
          171,
          172,
          173,
          178,
          179,
          184,
          185,
          196,
          197,
          198,
          199,
          200,
          201,
          202,
          203,
          204,
          205,
          206,
          207,
          208,
          209,
          214,
          215,
          220,
          221
        ];
      }
    } catch (error2) {
    }
    exports.inspectOpts = Object.keys(process.env).filter((key3) => {
      return /^debug_/i.test(key3);
    }).reduce((obj2, key3) => {
      const prop = key3.substring(6).toLowerCase().replace(/_([a-z])/g, (_, k) => {
        return k.toUpperCase();
      });
      let val = process.env[key3];
      if (/^(yes|on|true|enabled)$/i.test(val)) {
        val = true;
      } else if (/^(no|off|false|disabled)$/i.test(val)) {
        val = false;
      } else if (val === "null") {
        val = null;
      } else {
        val = Number(val);
      }
      obj2[prop] = val;
      return obj2;
    }, {});
    function useColors() {
      return "colors" in exports.inspectOpts ? Boolean(exports.inspectOpts.colors) : tty.isatty(process.stderr.fd);
    }
    function formatArgs(args) {
      const { namespace: name, useColors: useColors2 } = this;
      if (useColors2) {
        const c = this.color;
        const colorCode = "\x1B[3" + (c < 8 ? c : "8;5;" + c);
        const prefix = `  ${colorCode};1m${name} \x1B[0m`;
        args[0] = prefix + args[0].split("\n").join("\n" + prefix);
        args.push(colorCode + "m+" + module.exports.humanize(this.diff) + "\x1B[0m");
      } else {
        args[0] = getDate() + name + " " + args[0];
      }
    }
    function getDate() {
      if (exports.inspectOpts.hideDate) {
        return "";
      }
      return (/* @__PURE__ */ new Date()).toISOString() + " ";
    }
    function log(...args) {
      return process.stderr.write(util2.formatWithOptions(exports.inspectOpts, ...args) + "\n");
    }
    function save3(namespaces) {
      if (namespaces) {
        process.env.DEBUG = namespaces;
      } else {
        delete process.env.DEBUG;
      }
    }
    function load() {
      return process.env.DEBUG;
    }
    function init2(debug) {
      debug.inspectOpts = {};
      const keys = Object.keys(exports.inspectOpts);
      for (let i = 0; i < keys.length; i++) {
        debug.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
      }
    }
    module.exports = requireCommon()(exports);
    const { formatters } = module.exports;
    formatters.o = function(v) {
      this.inspectOpts.colors = this.useColors;
      return util2.inspect(v, this.inspectOpts).split("\n").map((str) => str.trim()).join(" ");
    };
    formatters.O = function(v) {
      this.inspectOpts.colors = this.useColors;
      return util2.inspect(v, this.inspectOpts);
    };
  })(node, node.exports);
  return node.exports;
}
var hasRequiredSrc;
function requireSrc() {
  if (hasRequiredSrc) return src$1.exports;
  hasRequiredSrc = 1;
  if (typeof process === "undefined" || process.type === "renderer" || process.browser === true || process.__nwjs) {
    src$1.exports = requireBrowser();
  } else {
    src$1.exports = requireNode();
  }
  return src$1.exports;
}
var dist = {};
var helpers = {};
var hasRequiredHelpers;
function requireHelpers() {
  if (hasRequiredHelpers) return helpers;
  hasRequiredHelpers = 1;
  var __createBinding = commonjsGlobal && commonjsGlobal.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === void 0) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() {
        return m[k];
      } };
    }
    Object.defineProperty(o, k2, desc);
  } : function(o, m, k, k2) {
    if (k2 === void 0) k2 = k;
    o[k2] = m[k];
  });
  var __setModuleDefault = commonjsGlobal && commonjsGlobal.__setModuleDefault || (Object.create ? function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
  } : function(o, v) {
    o["default"] = v;
  });
  var __importStar = commonjsGlobal && commonjsGlobal.__importStar || function(mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) {
      for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    }
    __setModuleDefault(result, mod);
    return result;
  };
  Object.defineProperty(helpers, "__esModule", { value: true });
  helpers.req = helpers.json = helpers.toBuffer = void 0;
  const http = __importStar(require$$0$3);
  const https2 = __importStar(require$$1$1);
  async function toBuffer(stream) {
    let length = 0;
    const chunks = [];
    for await (const chunk of stream) {
      length += chunk.length;
      chunks.push(chunk);
    }
    return Buffer.concat(chunks, length);
  }
  helpers.toBuffer = toBuffer;
  async function json(stream) {
    const buf = await toBuffer(stream);
    const str = buf.toString("utf8");
    try {
      return JSON.parse(str);
    } catch (_err) {
      const err = _err;
      err.message += ` (input: ${str})`;
      throw err;
    }
  }
  helpers.json = json;
  function req(url2, opts = {}) {
    const href = typeof url2 === "string" ? url2 : url2.href;
    const req2 = (href.startsWith("https:") ? https2 : http).request(url2, opts);
    const promise = new Promise((resolve, reject) => {
      req2.once("response", resolve).once("error", reject).end();
    });
    req2.then = promise.then.bind(promise);
    return req2;
  }
  helpers.req = req;
  return helpers;
}
var hasRequiredDist$1;
function requireDist$1() {
  if (hasRequiredDist$1) return dist;
  hasRequiredDist$1 = 1;
  (function(exports) {
    var __createBinding = commonjsGlobal && commonjsGlobal.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __setModuleDefault = commonjsGlobal && commonjsGlobal.__setModuleDefault || (Object.create ? function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    } : function(o, v) {
      o["default"] = v;
    });
    var __importStar = commonjsGlobal && commonjsGlobal.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    var __exportStar = commonjsGlobal && commonjsGlobal.__exportStar || function(m, exports2) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p)) __createBinding(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Agent = void 0;
    const net = __importStar(require$$0$4);
    const http = __importStar(require$$0$3);
    const https_1 = require$$1$1;
    __exportStar(requireHelpers(), exports);
    const INTERNAL = Symbol("AgentBaseInternalState");
    class Agent extends http.Agent {
      constructor(opts) {
        super(opts);
        this[INTERNAL] = {};
      }
      /**
       * Determine whether this is an `http` or `https` request.
       */
      isSecureEndpoint(options) {
        if (options) {
          if (typeof options.secureEndpoint === "boolean") {
            return options.secureEndpoint;
          }
          if (typeof options.protocol === "string") {
            return options.protocol === "https:";
          }
        }
        const { stack } = new Error();
        if (typeof stack !== "string")
          return false;
        return stack.split("\n").some((l) => l.indexOf("(https.js:") !== -1 || l.indexOf("node:https:") !== -1);
      }
      // In order to support async signatures in `connect()` and Node's native
      // connection pooling in `http.Agent`, the array of sockets for each origin
      // has to be updated synchronously. This is so the length of the array is
      // accurate when `addRequest()` is next called. We achieve this by creating a
      // fake socket and adding it to `sockets[origin]` and incrementing
      // `totalSocketCount`.
      incrementSockets(name) {
        if (this.maxSockets === Infinity && this.maxTotalSockets === Infinity) {
          return null;
        }
        if (!this.sockets[name]) {
          this.sockets[name] = [];
        }
        const fakeSocket = new net.Socket({ writable: false });
        this.sockets[name].push(fakeSocket);
        this.totalSocketCount++;
        return fakeSocket;
      }
      decrementSockets(name, socket) {
        if (!this.sockets[name] || socket === null) {
          return;
        }
        const sockets = this.sockets[name];
        const index = sockets.indexOf(socket);
        if (index !== -1) {
          sockets.splice(index, 1);
          this.totalSocketCount--;
          if (sockets.length === 0) {
            delete this.sockets[name];
          }
        }
      }
      // In order to properly update the socket pool, we need to call `getName()` on
      // the core `https.Agent` if it is a secureEndpoint.
      getName(options) {
        const secureEndpoint = this.isSecureEndpoint(options);
        if (secureEndpoint) {
          return https_1.Agent.prototype.getName.call(this, options);
        }
        return super.getName(options);
      }
      createSocket(req, options, cb) {
        const connectOpts = {
          ...options,
          secureEndpoint: this.isSecureEndpoint(options)
        };
        const name = this.getName(connectOpts);
        const fakeSocket = this.incrementSockets(name);
        Promise.resolve().then(() => this.connect(req, connectOpts)).then((socket) => {
          this.decrementSockets(name, fakeSocket);
          if (socket instanceof http.Agent) {
            try {
              return socket.addRequest(req, connectOpts);
            } catch (err) {
              return cb(err);
            }
          }
          this[INTERNAL].currentSocket = socket;
          super.createSocket(req, options, cb);
        }, (err) => {
          this.decrementSockets(name, fakeSocket);
          cb(err);
        });
      }
      createConnection() {
        const socket = this[INTERNAL].currentSocket;
        this[INTERNAL].currentSocket = void 0;
        if (!socket) {
          throw new Error("No socket was returned in the `connect()` function");
        }
        return socket;
      }
      get defaultPort() {
        return this[INTERNAL].defaultPort ?? (this.protocol === "https:" ? 443 : 80);
      }
      set defaultPort(v) {
        if (this[INTERNAL]) {
          this[INTERNAL].defaultPort = v;
        }
      }
      get protocol() {
        return this[INTERNAL].protocol ?? (this.isSecureEndpoint() ? "https:" : "http:");
      }
      set protocol(v) {
        if (this[INTERNAL]) {
          this[INTERNAL].protocol = v;
        }
      }
    }
    exports.Agent = Agent;
  })(dist);
  return dist;
}
var parseProxyResponse = {};
var hasRequiredParseProxyResponse;
function requireParseProxyResponse() {
  if (hasRequiredParseProxyResponse) return parseProxyResponse;
  hasRequiredParseProxyResponse = 1;
  var __importDefault = commonjsGlobal && commonjsGlobal.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : { "default": mod };
  };
  Object.defineProperty(parseProxyResponse, "__esModule", { value: true });
  parseProxyResponse.parseProxyResponse = void 0;
  const debug_1 = __importDefault(requireSrc());
  const debug = (0, debug_1.default)("https-proxy-agent:parse-proxy-response");
  function parseProxyResponse$1(socket) {
    return new Promise((resolve, reject) => {
      let buffersLength = 0;
      const buffers = [];
      function read() {
        const b = socket.read();
        if (b)
          ondata(b);
        else
          socket.once("readable", read);
      }
      function cleanup() {
        socket.removeListener("end", onend);
        socket.removeListener("error", onerror);
        socket.removeListener("readable", read);
      }
      function onend() {
        cleanup();
        debug("onend");
        reject(new Error("Proxy connection ended before receiving CONNECT response"));
      }
      function onerror(err) {
        cleanup();
        debug("onerror %o", err);
        reject(err);
      }
      function ondata(b) {
        buffers.push(b);
        buffersLength += b.length;
        const buffered = Buffer.concat(buffers, buffersLength);
        const endOfHeaders = buffered.indexOf("\r\n\r\n");
        if (endOfHeaders === -1) {
          debug("have not received end of HTTP headers yet...");
          read();
          return;
        }
        const headerParts = buffered.slice(0, endOfHeaders).toString("ascii").split("\r\n");
        const firstLine = headerParts.shift();
        if (!firstLine) {
          socket.destroy();
          return reject(new Error("No header received from proxy CONNECT response"));
        }
        const firstLineParts = firstLine.split(" ");
        const statusCode = +firstLineParts[1];
        const statusText = firstLineParts.slice(2).join(" ");
        const headers = {};
        for (const header of headerParts) {
          if (!header)
            continue;
          const firstColon = header.indexOf(":");
          if (firstColon === -1) {
            socket.destroy();
            return reject(new Error(`Invalid header from proxy CONNECT response: "${header}"`));
          }
          const key3 = header.slice(0, firstColon).toLowerCase();
          const value = header.slice(firstColon + 1).trimStart();
          const current = headers[key3];
          if (typeof current === "string") {
            headers[key3] = [current, value];
          } else if (Array.isArray(current)) {
            current.push(value);
          } else {
            headers[key3] = value;
          }
        }
        debug("got proxy server response: %o %o", firstLine, headers);
        cleanup();
        resolve({
          connect: {
            statusCode,
            statusText,
            headers
          },
          buffered
        });
      }
      socket.on("error", onerror);
      socket.on("end", onend);
      read();
    });
  }
  parseProxyResponse.parseProxyResponse = parseProxyResponse$1;
  return parseProxyResponse;
}
var hasRequiredDist;
function requireDist() {
  if (hasRequiredDist) return dist$1;
  hasRequiredDist = 1;
  var __createBinding = commonjsGlobal && commonjsGlobal.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === void 0) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() {
        return m[k];
      } };
    }
    Object.defineProperty(o, k2, desc);
  } : function(o, m, k, k2) {
    if (k2 === void 0) k2 = k;
    o[k2] = m[k];
  });
  var __setModuleDefault = commonjsGlobal && commonjsGlobal.__setModuleDefault || (Object.create ? function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
  } : function(o, v) {
    o["default"] = v;
  });
  var __importStar = commonjsGlobal && commonjsGlobal.__importStar || function(mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) {
      for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    }
    __setModuleDefault(result, mod);
    return result;
  };
  var __importDefault = commonjsGlobal && commonjsGlobal.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : { "default": mod };
  };
  Object.defineProperty(dist$1, "__esModule", { value: true });
  dist$1.HttpsProxyAgent = void 0;
  const net = __importStar(require$$0$4);
  const tls = __importStar(require$$1$2);
  const assert_1 = __importDefault(require$$2);
  const debug_1 = __importDefault(requireSrc());
  const agent_base_1 = requireDist$1();
  const url_1 = require$$3$1;
  const parse_proxy_response_1 = requireParseProxyResponse();
  const debug = (0, debug_1.default)("https-proxy-agent");
  const setServernameFromNonIpHost = (options) => {
    if (options.servername === void 0 && options.host && !net.isIP(options.host)) {
      return {
        ...options,
        servername: options.host
      };
    }
    return options;
  };
  class HttpsProxyAgent extends agent_base_1.Agent {
    constructor(proxy, opts) {
      super(opts);
      this.options = { path: void 0 };
      this.proxy = typeof proxy === "string" ? new url_1.URL(proxy) : proxy;
      this.proxyHeaders = (opts == null ? void 0 : opts.headers) ?? {};
      debug("Creating new HttpsProxyAgent instance: %o", this.proxy.href);
      const host = (this.proxy.hostname || this.proxy.host).replace(/^\[|\]$/g, "");
      const port = this.proxy.port ? parseInt(this.proxy.port, 10) : this.proxy.protocol === "https:" ? 443 : 80;
      this.connectOpts = {
        // Attempt to negotiate http/1.1 for proxy servers that support http/2
        ALPNProtocols: ["http/1.1"],
        ...opts ? omit(opts, "headers") : null,
        host,
        port
      };
    }
    /**
     * Called when the node-core HTTP client library is creating a
     * new HTTP request.
     */
    async connect(req, opts) {
      const { proxy } = this;
      if (!opts.host) {
        throw new TypeError('No "host" provided');
      }
      let socket;
      if (proxy.protocol === "https:") {
        debug("Creating `tls.Socket`: %o", this.connectOpts);
        socket = tls.connect(setServernameFromNonIpHost(this.connectOpts));
      } else {
        debug("Creating `net.Socket`: %o", this.connectOpts);
        socket = net.connect(this.connectOpts);
      }
      const headers = typeof this.proxyHeaders === "function" ? this.proxyHeaders() : { ...this.proxyHeaders };
      const host = net.isIPv6(opts.host) ? `[${opts.host}]` : opts.host;
      let payload = `CONNECT ${host}:${opts.port} HTTP/1.1\r
`;
      if (proxy.username || proxy.password) {
        const auth = `${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`;
        headers["Proxy-Authorization"] = `Basic ${Buffer.from(auth).toString("base64")}`;
      }
      headers.Host = `${host}:${opts.port}`;
      if (!headers["Proxy-Connection"]) {
        headers["Proxy-Connection"] = this.keepAlive ? "Keep-Alive" : "close";
      }
      for (const name of Object.keys(headers)) {
        payload += `${name}: ${headers[name]}\r
`;
      }
      const proxyResponsePromise = (0, parse_proxy_response_1.parseProxyResponse)(socket);
      socket.write(`${payload}\r
`);
      const { connect, buffered } = await proxyResponsePromise;
      req.emit("proxyConnect", connect);
      this.emit("proxyConnect", connect, req);
      if (connect.statusCode === 200) {
        req.once("socket", resume);
        if (opts.secureEndpoint) {
          debug("Upgrading socket connection to TLS");
          return tls.connect({
            ...omit(setServernameFromNonIpHost(opts), "host", "path", "port"),
            socket
          });
        }
        return socket;
      }
      socket.destroy();
      const fakeSocket = new net.Socket({ writable: false });
      fakeSocket.readable = true;
      req.once("socket", (s) => {
        debug("Replaying proxy buffer for failed request");
        (0, assert_1.default)(s.listenerCount("data") > 0);
        s.push(buffered);
        s.push(null);
      });
      return fakeSocket;
    }
  }
  HttpsProxyAgent.protocols = ["http", "https"];
  dist$1.HttpsProxyAgent = HttpsProxyAgent;
  function resume(socket) {
    socket.resume();
  }
  function omit(obj2, ...keys) {
    const ret = {};
    let key3;
    for (key3 in obj2) {
      if (!keys.includes(key3)) {
        ret[key3] = obj2[key3];
      }
    }
    return ret;
  }
  return dist$1;
}
const url = require$$3$1;
const https = require$$1$1;
const WebPushError$1 = webPushError;
const vapidHelper$1 = vapidHelper$2;
const encryptionHelper$1 = encryptionHelper$2;
const webPushConstants = webPushConstants$1;
const urlBase64Helper = urlsafeBase64Helper;
const DEFAULT_TTL = 2419200;
let gcmAPIKey = "";
let vapidDetails;
function WebPushLib$1() {
}
WebPushLib$1.prototype.setGCMAPIKey = function(apiKey) {
  if (apiKey === null) {
    gcmAPIKey = null;
    return;
  }
  if (typeof apiKey === "undefined" || typeof apiKey !== "string" || apiKey.length === 0) {
    throw new Error("The GCM API Key should be a non-empty string or null.");
  }
  gcmAPIKey = apiKey;
};
WebPushLib$1.prototype.setVapidDetails = function(subject, publicKey, privateKey) {
  if (arguments.length === 1 && arguments[0] === null) {
    vapidDetails = null;
    return;
  }
  vapidHelper$1.validateSubject(subject);
  vapidHelper$1.validatePublicKey(publicKey);
  vapidHelper$1.validatePrivateKey(privateKey);
  vapidDetails = {
    subject,
    publicKey,
    privateKey
  };
};
WebPushLib$1.prototype.generateRequestDetails = function(subscription, payload, options) {
  if (!subscription || !subscription.endpoint) {
    throw new Error("You must pass in a subscription with at least an endpoint.");
  }
  if (typeof subscription.endpoint !== "string" || subscription.endpoint.length === 0) {
    throw new Error("The subscription endpoint must be a string with a valid URL.");
  }
  if (payload) {
    if (typeof subscription !== "object" || !subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
      throw new Error("To send a message with a payload, the subscription must have 'auth' and 'p256dh' keys.");
    }
  }
  let currentGCMAPIKey = gcmAPIKey;
  let currentVapidDetails = vapidDetails;
  let timeToLive = DEFAULT_TTL;
  let extraHeaders = {};
  let contentEncoding = webPushConstants.supportedContentEncodings.AES_128_GCM;
  let urgency = webPushConstants.supportedUrgency.NORMAL;
  let topic;
  let proxy;
  let agent;
  let timeout;
  if (options) {
    const validOptionKeys = [
      "headers",
      "gcmAPIKey",
      "vapidDetails",
      "TTL",
      "contentEncoding",
      "urgency",
      "topic",
      "proxy",
      "agent",
      "timeout"
    ];
    const optionKeys = Object.keys(options);
    for (let i = 0; i < optionKeys.length; i += 1) {
      const optionKey = optionKeys[i];
      if (!validOptionKeys.includes(optionKey)) {
        throw new Error("'" + optionKey + "' is an invalid option. The valid options are ['" + validOptionKeys.join("', '") + "'].");
      }
    }
    if (options.headers) {
      extraHeaders = options.headers;
      let duplicates = Object.keys(extraHeaders).filter(function(header) {
        return typeof options[header] !== "undefined";
      });
      if (duplicates.length > 0) {
        throw new Error("Duplicated headers defined [" + duplicates.join(",") + "]. Please either define the header in thetop level options OR in the 'headers' key.");
      }
    }
    if (options.gcmAPIKey) {
      currentGCMAPIKey = options.gcmAPIKey;
    }
    if (options.vapidDetails !== void 0) {
      currentVapidDetails = options.vapidDetails;
    }
    if (options.TTL !== void 0) {
      timeToLive = Number(options.TTL);
      if (timeToLive < 0) {
        throw new Error("TTL should be a number and should be at least 0");
      }
    }
    if (options.contentEncoding) {
      if (options.contentEncoding === webPushConstants.supportedContentEncodings.AES_128_GCM || options.contentEncoding === webPushConstants.supportedContentEncodings.AES_GCM) {
        contentEncoding = options.contentEncoding;
      } else {
        throw new Error("Unsupported content encoding specified.");
      }
    }
    if (options.urgency) {
      if (options.urgency === webPushConstants.supportedUrgency.VERY_LOW || options.urgency === webPushConstants.supportedUrgency.LOW || options.urgency === webPushConstants.supportedUrgency.NORMAL || options.urgency === webPushConstants.supportedUrgency.HIGH) {
        urgency = options.urgency;
      } else {
        throw new Error("Unsupported urgency specified.");
      }
    }
    if (options.topic) {
      if (!urlBase64Helper.validate(options.topic)) {
        throw new Error("Unsupported characters set use the URL or filename-safe Base64 characters set");
      }
      if (options.topic.length > 32) {
        throw new Error("use maximum of 32 characters from the URL or filename-safe Base64 characters set");
      }
      topic = options.topic;
    }
    if (options.proxy) {
      if (typeof options.proxy === "string" || typeof options.proxy.host === "string") {
        proxy = options.proxy;
      } else {
        console.warn("Attempt to use proxy option, but invalid type it should be a string or proxy options object.");
      }
    }
    if (options.agent) {
      if (options.agent instanceof https.Agent) {
        if (proxy) {
          console.warn("Agent option will be ignored because proxy option is defined.");
        }
        agent = options.agent;
      } else {
        console.warn("Wrong type for the agent option, it should be an instance of https.Agent.");
      }
    }
    if (typeof options.timeout === "number") {
      timeout = options.timeout;
    }
  }
  if (typeof timeToLive === "undefined") {
    timeToLive = DEFAULT_TTL;
  }
  const requestDetails = {
    method: "POST",
    headers: {
      TTL: timeToLive
    }
  };
  Object.keys(extraHeaders).forEach(function(header) {
    requestDetails.headers[header] = extraHeaders[header];
  });
  let requestPayload = null;
  if (payload) {
    const encrypted = encryptionHelper$1.encrypt(subscription.keys.p256dh, subscription.keys.auth, payload, contentEncoding);
    requestDetails.headers["Content-Length"] = encrypted.cipherText.length;
    requestDetails.headers["Content-Type"] = "application/octet-stream";
    if (contentEncoding === webPushConstants.supportedContentEncodings.AES_128_GCM) {
      requestDetails.headers["Content-Encoding"] = webPushConstants.supportedContentEncodings.AES_128_GCM;
    } else if (contentEncoding === webPushConstants.supportedContentEncodings.AES_GCM) {
      requestDetails.headers["Content-Encoding"] = webPushConstants.supportedContentEncodings.AES_GCM;
      requestDetails.headers.Encryption = "salt=" + encrypted.salt;
      requestDetails.headers["Crypto-Key"] = "dh=" + encrypted.localPublicKey.toString("base64url");
    }
    requestPayload = encrypted.cipherText;
  } else {
    requestDetails.headers["Content-Length"] = 0;
  }
  const isGCM = subscription.endpoint.startsWith("https://android.googleapis.com/gcm/send");
  const isFCM = subscription.endpoint.startsWith("https://fcm.googleapis.com/fcm/send");
  if (isGCM) {
    if (!currentGCMAPIKey) {
      console.warn("Attempt to send push notification to GCM endpoint, but no GCM key is defined. Please use setGCMApiKey() or add 'gcmAPIKey' as an option.");
    } else {
      requestDetails.headers.Authorization = "key=" + currentGCMAPIKey;
    }
  } else if (currentVapidDetails) {
    const parsedUrl = url.parse(subscription.endpoint);
    const audience = parsedUrl.protocol + "//" + parsedUrl.host;
    const vapidHeaders = vapidHelper$1.getVapidHeaders(
      audience,
      currentVapidDetails.subject,
      currentVapidDetails.publicKey,
      currentVapidDetails.privateKey,
      contentEncoding
    );
    requestDetails.headers.Authorization = vapidHeaders.Authorization;
    if (contentEncoding === webPushConstants.supportedContentEncodings.AES_GCM) {
      if (requestDetails.headers["Crypto-Key"]) {
        requestDetails.headers["Crypto-Key"] += ";" + vapidHeaders["Crypto-Key"];
      } else {
        requestDetails.headers["Crypto-Key"] = vapidHeaders["Crypto-Key"];
      }
    }
  } else if (isFCM && currentGCMAPIKey) {
    requestDetails.headers.Authorization = "key=" + currentGCMAPIKey;
  }
  requestDetails.headers.Urgency = urgency;
  if (topic) {
    requestDetails.headers.Topic = topic;
  }
  requestDetails.body = requestPayload;
  requestDetails.endpoint = subscription.endpoint;
  if (proxy) {
    requestDetails.proxy = proxy;
  }
  if (agent) {
    requestDetails.agent = agent;
  }
  if (timeout) {
    requestDetails.timeout = timeout;
  }
  return requestDetails;
};
WebPushLib$1.prototype.sendNotification = function(subscription, payload, options) {
  let requestDetails;
  try {
    requestDetails = this.generateRequestDetails(subscription, payload, options);
  } catch (err) {
    return Promise.reject(err);
  }
  return new Promise(function(resolve, reject) {
    const httpsOptions = {};
    const urlParts = url.parse(requestDetails.endpoint);
    httpsOptions.hostname = urlParts.hostname;
    httpsOptions.port = urlParts.port;
    httpsOptions.path = urlParts.path;
    httpsOptions.headers = requestDetails.headers;
    httpsOptions.method = requestDetails.method;
    if (requestDetails.timeout) {
      httpsOptions.timeout = requestDetails.timeout;
    }
    if (requestDetails.agent) {
      httpsOptions.agent = requestDetails.agent;
    }
    if (requestDetails.proxy) {
      const { HttpsProxyAgent } = requireDist();
      httpsOptions.agent = new HttpsProxyAgent(requestDetails.proxy);
    }
    const pushRequest = https.request(httpsOptions, function(pushResponse) {
      let responseText = "";
      pushResponse.on("data", function(chunk) {
        responseText += chunk;
      });
      pushResponse.on("end", function() {
        if (pushResponse.statusCode < 200 || pushResponse.statusCode > 299) {
          reject(new WebPushError$1(
            "Received unexpected response code",
            pushResponse.statusCode,
            pushResponse.headers,
            responseText,
            requestDetails.endpoint
          ));
        } else {
          resolve({
            statusCode: pushResponse.statusCode,
            body: responseText,
            headers: pushResponse.headers
          });
        }
      });
    });
    if (requestDetails.timeout) {
      pushRequest.on("timeout", function() {
        pushRequest.destroy(new Error("Socket timeout"));
      });
    }
    pushRequest.on("error", function(e) {
      reject(e);
    });
    if (requestDetails.body) {
      pushRequest.write(requestDetails.body);
    }
    pushRequest.end();
  });
};
var webPushLib = WebPushLib$1;
const vapidHelper = vapidHelper$2;
const encryptionHelper = encryptionHelper$2;
const WebPushLib = webPushLib;
const WebPushError = webPushError;
const WebPushConstants = webPushConstants$1;
const webPush = new WebPushLib();
var src = {
  WebPushError,
  supportedContentEncodings: WebPushConstants.supportedContentEncodings,
  encrypt: encryptionHelper.encrypt,
  getVapidHeaders: vapidHelper.getVapidHeaders,
  generateVAPIDKeys: vapidHelper.generateVAPIDKeys,
  setGCMAPIKey: webPush.setGCMAPIKey,
  setVapidDetails: webPush.setVapidDetails,
  generateRequestDetails: webPush.generateRequestDetails,
  sendNotification: webPush.sendNotification.bind(webPush)
};
const webpush = /* @__PURE__ */ getDefaultExportFromCjs(src);
try {
  webpush.setVapidDetails(
    "mailto:admin@titsmart.vn",
    "BPAuS3BAVsbHBUEJLS_d0lvmxZqLOj71iPBE7oZSIX-r_mbbosFY4JMBmPs_fDOfhQtWT1mpf-_A9c1cSNPip0c",
    "2eQfYJLlDO7jQpnpSMBiENSXTgvHhC4NAQoQzrsr8O0"
  );
} catch (e) {
  console.debug("Lỗi setVapidDetails trong Electron:", e);
}
const { autoUpdater } = updatePkg;
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}
const __filename$1 = fileURLToPath(import.meta.url);
const __dirname$1 = path.dirname(__filename$1);
let mainWindow = null;
let tray = null;
let isForceQuitting = false;
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
function getAppIcon() {
  const iconPaths = [
    path.join(__dirname$1, "../public/favicon.ico"),
    path.join(__dirname$1, "../dist/favicon.ico"),
    path.join(process.resourcesPath || "", "favicon.ico"),
    path.join(__dirname$1, "../public/logo.png"),
    path.join(__dirname$1, "../dist/logo.png")
  ];
  for (const p of iconPaths) {
    if (fs.existsSync(p)) {
      return nativeImage.createFromPath(p);
    }
  }
  return void 0;
}
function createTray() {
  if (tray) return;
  const icon = getAppIcon();
  tray = new Tray(icon || nativeImage.createEmpty());
  tray.setToolTip("TITSMART - Quản lý công việc");
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Mở TITSMART",
      click: () => {
        showMainWindow();
      }
    },
    {
      type: "separator"
    },
    {
      label: "Kiểm tra cập nhật...",
      click: () => {
        autoUpdater.checkForUpdates().catch(() => {
        });
      }
    },
    {
      type: "separator"
    },
    {
      label: "Thoát hoàn toàn",
      click: () => {
        isForceQuitting = true;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.destroy();
        }
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(contextMenu);
  tray.on("double-click", () => {
    showMainWindow();
  });
}
function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}
function createWindow() {
  const icon = getAppIcon();
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon,
    autoHideMenuBar: true,
    show: false,
    // Tránh nhấp nháy trắng màn hình, chờ sẵn sàng mới hiển thị
    backgroundColor: "#ffffff",
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false
      // KHÔNG ĐÓNG BĂNG/HẠ CHẾ TIẾN TRÌNH KHI ẨN XUỐNG TRAY
    }
  });
  mainWindow.once("ready-to-show", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(process.env.DIST || path.join(__dirname$1, "../dist"), "index.html"));
  }
  mainWindow.webContents.setWindowOpenHandler(({ url: url2 }) => {
    if (url2.startsWith("http://") || url2.startsWith("https://")) {
      shell.openExternal(url2);
    }
    return { action: "deny" };
  });
  mainWindow.on("close", (e) => {
    if (!isForceQuitting && mainWindow && !mainWindow.isDestroyed()) {
      e.preventDefault();
      mainWindow.webContents.send("app:request-close");
    }
  });
}
app.on("second-instance", () => {
  showMainWindow();
});
function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}
function normalizeReleaseNotes(notes) {
  if (Array.isArray(notes)) {
    return notes.map((n) => typeof n === "string" ? n : (n == null ? void 0 : n.note) ?? "").filter(Boolean).join("\n");
  }
  return notes ?? "";
}
function setupAutoUpdater() {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.disableDifferentialDownload = true;
  autoUpdater.disableWebInstaller = true;
  autoUpdater.on("checking-for-update", () => {
    sendToRenderer("update:status", { status: "checking" });
  });
  autoUpdater.on("update-available", (info2) => {
    sendToRenderer("update:status", {
      status: "available",
      version: info2.version,
      releaseNotes: normalizeReleaseNotes(info2.releaseNotes)
    });
  });
  autoUpdater.on("update-not-available", (info2) => {
    sendToRenderer("update:status", { status: "not-available", version: info2.version });
  });
  autoUpdater.on("download-progress", (progress) => {
    sendToRenderer("update:status", {
      status: "downloading",
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond
    });
  });
  autoUpdater.on("update-downloaded", (info2) => {
    sendToRenderer("update:status", { status: "downloaded", version: info2.version });
  });
  autoUpdater.on("error", (err) => {
    sendToRenderer("update:status", { status: "error", message: (err == null ? void 0 : err.message) ?? String(err) });
  });
  ipcMain.on("update:check", () => {
    autoUpdater.checkForUpdates();
  });
  ipcMain.on("update:download", () => {
    autoUpdater.downloadUpdate();
  });
  ipcMain.on("update:install", () => {
    autoUpdater.quitAndInstall();
  });
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      sendToRenderer("update:status", { status: "error", message: (err == null ? void 0 : err.message) ?? String(err) });
    });
  }, 3e3);
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {
    });
  }, 6e4);
}
ipcMain.on("open-external", async (_, url2) => {
  if (url2 && typeof url2 === "string") {
    try {
      await shell.openExternal(url2);
    } catch (error2) {
      console.error("Failed to open url:", error2);
    }
  }
});
ipcMain.on("app:minimize-to-tray", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
  }
});
ipcMain.on("app:show-notification", (_, { title, body, url: url2 }) => {
  if (Notification.isSupported()) {
    const icon = getAppIcon();
    const notif = new Notification({
      title: title || "TITSMART",
      body: body || "Bạn có thông báo mới.",
      icon
    });
    notif.on("click", () => {
      showMainWindow();
      if (url2 && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("navigate:url", url2);
      }
    });
    notif.show();
  }
});
ipcMain.on("app:send-web-push", async (_, { subscription, payload }) => {
  try {
    if (!subscription || !subscription.endpoint) return;
    const subObj = typeof subscription === "string" ? JSON.parse(subscription) : subscription;
    const bodyStr = typeof payload === "string" ? payload : JSON.stringify(payload);
    const pushOptions = {
      TTL: 86400,
      urgency: "high",
      headers: {
        "apns-priority": "10",
        "apns-push-type": "alert"
      }
    };
    await webpush.sendNotification(subObj, bodyStr, pushOptions);
    console.log("[Electron APNs] Bắn Web Push tới Apple/Google thành công!");
  } catch (err) {
    console.debug("[Electron APNs] Lỗi gửi Web Push:", (err == null ? void 0 : err.statusCode) || (err == null ? void 0 : err.message) || err);
  }
});
ipcMain.on("app:confirm-quit", () => {
  isForceQuitting = true;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
  }
  app.quit();
});
const sessionFilePath = path.join(app.getPath("userData"), "auth_session.json");
ipcMain.on("session:save", (_, user) => {
  try {
    if (user) {
      fs.writeFileSync(sessionFilePath, JSON.stringify(user), "utf-8");
    } else {
      if (fs.existsSync(sessionFilePath)) fs.unlinkSync(sessionFilePath);
    }
  } catch (err) {
    console.error("Failed to write auth_session.json:", err);
  }
});
ipcMain.on("session:load", (event) => {
  try {
    if (fs.existsSync(sessionFilePath)) {
      const raw2 = fs.readFileSync(sessionFilePath, "utf-8");
      if (raw2) {
        event.returnValue = JSON.parse(raw2);
        return;
      }
    }
  } catch (err) {
    console.error("Failed to read auth_session.json:", err);
  }
  event.returnValue = null;
});
app.on("before-quit", () => {
  isForceQuitting = true;
});
app.on("window-all-closed", () => {
  if (tray) ;
  else if (process.platform !== "darwin") {
    app.quit();
    mainWindow = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    showMainWindow();
  }
});
if (gotTheLock) {
  app.whenReady().then(() => {
    createWindow();
    createTray();
    setupAutoUpdater();
  });
}
