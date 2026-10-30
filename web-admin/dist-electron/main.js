import { app as je, ipcMain as He, shell as Ln, Notification as ln, BrowserWindow as $n, nativeImage as qn, Tray as Xi, Menu as eo } from "electron";
import Ke from "path";
import Sr, { fileURLToPath as to } from "url";
import nt from "fs";
import ro from "electron-updater";
import Dt from "crypto";
import mt from "buffer";
import Cr from "stream";
import lt from "util";
import Br from "https";
import Un from "net";
import no from "tls";
import io from "assert";
import Kn from "tty";
import oo from "os";
import Hn from "http";
var K = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {};
function so(t) {
  return t && t.__esModule && Object.prototype.hasOwnProperty.call(t, "default") ? t.default : t;
}
var Gn = {}, Ar = { exports: {} };
Ar.exports;
(function(t) {
  (function(e, i) {
    function n(p, r) {
      if (!p) throw new Error(r || "Assertion failed");
    }
    function f(p, r) {
      p.super_ = r;
      var s = function() {
      };
      s.prototype = r.prototype, p.prototype = new s(), p.prototype.constructor = p;
    }
    function a(p, r, s) {
      if (a.isBN(p))
        return p;
      this.negative = 0, this.words = null, this.length = 0, this.red = null, p !== null && ((r === "le" || r === "be") && (s = r, r = 10), this._init(p || 0, r || 10, s || "be"));
    }
    typeof e == "object" ? e.exports = a : i.BN = a, a.BN = a, a.wordSize = 26;
    var v;
    try {
      typeof window < "u" && typeof window.Buffer < "u" ? v = window.Buffer : v = require("buffer").Buffer;
    } catch {
    }
    a.isBN = function(r) {
      return r instanceof a ? !0 : r !== null && typeof r == "object" && r.constructor.wordSize === a.wordSize && Array.isArray(r.words);
    }, a.max = function(r, s) {
      return r.cmp(s) > 0 ? r : s;
    }, a.min = function(r, s) {
      return r.cmp(s) < 0 ? r : s;
    }, a.prototype._init = function(r, s, u) {
      if (typeof r == "number")
        return this._initNumber(r, s, u);
      if (typeof r == "object")
        return this._initArray(r, s, u);
      s === "hex" && (s = 16), n(s === (s | 0) && s >= 2 && s <= 36), r = r.toString().replace(/\s+/g, "");
      var l = 0;
      r[0] === "-" && (l++, this.negative = 1), l < r.length && (s === 16 ? this._parseHex(r, l, u) : (this._parseBase(r, s, l), u === "le" && this._initArray(this.toArray(), s, u)));
    }, a.prototype._initNumber = function(r, s, u) {
      r < 0 && (this.negative = 1, r = -r), r < 67108864 ? (this.words = [r & 67108863], this.length = 1) : r < 4503599627370496 ? (this.words = [
        r & 67108863,
        r / 67108864 & 67108863
      ], this.length = 2) : (n(r < 9007199254740992), this.words = [
        r & 67108863,
        r / 67108864 & 67108863,
        1
      ], this.length = 3), u === "le" && this._initArray(this.toArray(), s, u);
    }, a.prototype._initArray = function(r, s, u) {
      if (n(typeof r.length == "number"), r.length <= 0)
        return this.words = [0], this.length = 1, this;
      this.length = Math.ceil(r.length / 3), this.words = new Array(this.length);
      for (var l = 0; l < this.length; l++)
        this.words[l] = 0;
      var d, m, w = 0;
      if (u === "be")
        for (l = r.length - 1, d = 0; l >= 0; l -= 3)
          m = r[l] | r[l - 1] << 8 | r[l - 2] << 16, this.words[d] |= m << w & 67108863, this.words[d + 1] = m >>> 26 - w & 67108863, w += 24, w >= 26 && (w -= 26, d++);
      else if (u === "le")
        for (l = 0, d = 0; l < r.length; l += 3)
          m = r[l] | r[l + 1] << 8 | r[l + 2] << 16, this.words[d] |= m << w & 67108863, this.words[d + 1] = m >>> 26 - w & 67108863, w += 24, w >= 26 && (w -= 26, d++);
      return this.strip();
    };
    function b(p, r) {
      var s = p.charCodeAt(r);
      return s >= 65 && s <= 70 ? s - 55 : s >= 97 && s <= 102 ? s - 87 : s - 48 & 15;
    }
    function g(p, r, s) {
      var u = b(p, s);
      return s - 1 >= r && (u |= b(p, s - 1) << 4), u;
    }
    a.prototype._parseHex = function(r, s, u) {
      this.length = Math.ceil((r.length - s) / 6), this.words = new Array(this.length);
      for (var l = 0; l < this.length; l++)
        this.words[l] = 0;
      var d = 0, m = 0, w;
      if (u === "be")
        for (l = r.length - 1; l >= s; l -= 2)
          w = g(r, s, l) << d, this.words[m] |= w & 67108863, d >= 18 ? (d -= 18, m += 1, this.words[m] |= w >>> 26) : d += 8;
      else {
        var h = r.length - s;
        for (l = h % 2 === 0 ? s + 1 : s; l < r.length; l += 2)
          w = g(r, s, l) << d, this.words[m] |= w & 67108863, d >= 18 ? (d -= 18, m += 1, this.words[m] |= w >>> 26) : d += 8;
      }
      this.strip();
    };
    function E(p, r, s, u) {
      for (var l = 0, d = Math.min(p.length, s), m = r; m < d; m++) {
        var w = p.charCodeAt(m) - 48;
        l *= u, w >= 49 ? l += w - 49 + 10 : w >= 17 ? l += w - 17 + 10 : l += w;
      }
      return l;
    }
    a.prototype._parseBase = function(r, s, u) {
      this.words = [0], this.length = 1;
      for (var l = 0, d = 1; d <= 67108863; d *= s)
        l++;
      l--, d = d / s | 0;
      for (var m = r.length - u, w = m % l, h = Math.min(m, m - w) + u, o = 0, c = u; c < h; c += l)
        o = E(r, c, c + l, s), this.imuln(d), this.words[0] + o < 67108864 ? this.words[0] += o : this._iaddn(o);
      if (w !== 0) {
        var T = 1;
        for (o = E(r, c, r.length, s), c = 0; c < w; c++)
          T *= s;
        this.imuln(T), this.words[0] + o < 67108864 ? this.words[0] += o : this._iaddn(o);
      }
      this.strip();
    }, a.prototype.copy = function(r) {
      r.words = new Array(this.length);
      for (var s = 0; s < this.length; s++)
        r.words[s] = this.words[s];
      r.length = this.length, r.negative = this.negative, r.red = this.red;
    }, a.prototype.clone = function() {
      var r = new a(null);
      return this.copy(r), r;
    }, a.prototype._expand = function(r) {
      for (; this.length < r; )
        this.words[this.length++] = 0;
      return this;
    }, a.prototype.strip = function() {
      for (; this.length > 1 && this.words[this.length - 1] === 0; )
        this.length--;
      return this._normSign();
    }, a.prototype._normSign = function() {
      return this.length === 1 && this.words[0] === 0 && (this.negative = 0), this;
    }, a.prototype.inspect = function() {
      return (this.red ? "<BN-R: " : "<BN: ") + this.toString(16) + ">";
    };
    var M = [
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
    ], y = [
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
    ], _ = [
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
    a.prototype.toString = function(r, s) {
      r = r || 10, s = s | 0 || 1;
      var u;
      if (r === 16 || r === "hex") {
        u = "";
        for (var l = 0, d = 0, m = 0; m < this.length; m++) {
          var w = this.words[m], h = ((w << l | d) & 16777215).toString(16);
          d = w >>> 24 - l & 16777215, l += 2, l >= 26 && (l -= 26, m--), d !== 0 || m !== this.length - 1 ? u = M[6 - h.length] + h + u : u = h + u;
        }
        for (d !== 0 && (u = d.toString(16) + u); u.length % s !== 0; )
          u = "0" + u;
        return this.negative !== 0 && (u = "-" + u), u;
      }
      if (r === (r | 0) && r >= 2 && r <= 36) {
        var o = y[r], c = _[r];
        u = "";
        var T = this.clone();
        for (T.negative = 0; !T.isZero(); ) {
          var O = T.modn(c).toString(r);
          T = T.idivn(c), T.isZero() ? u = O + u : u = M[o - O.length] + O + u;
        }
        for (this.isZero() && (u = "0" + u); u.length % s !== 0; )
          u = "0" + u;
        return this.negative !== 0 && (u = "-" + u), u;
      }
      n(!1, "Base should be between 2 and 36");
    }, a.prototype.toNumber = function() {
      var r = this.words[0];
      return this.length === 2 ? r += this.words[1] * 67108864 : this.length === 3 && this.words[2] === 1 ? r += 4503599627370496 + this.words[1] * 67108864 : this.length > 2 && n(!1, "Number can only safely store up to 53 bits"), this.negative !== 0 ? -r : r;
    }, a.prototype.toJSON = function() {
      return this.toString(16);
    }, a.prototype.toBuffer = function(r, s) {
      return n(typeof v < "u"), this.toArrayLike(v, r, s);
    }, a.prototype.toArray = function(r, s) {
      return this.toArrayLike(Array, r, s);
    }, a.prototype.toArrayLike = function(r, s, u) {
      var l = this.byteLength(), d = u || Math.max(1, l);
      n(l <= d, "byte array longer than desired length"), n(d > 0, "Requested array length <= 0"), this.strip();
      var m = s === "le", w = new r(d), h, o, c = this.clone();
      if (m) {
        for (o = 0; !c.isZero(); o++)
          h = c.andln(255), c.iushrn(8), w[o] = h;
        for (; o < d; o++)
          w[o] = 0;
      } else {
        for (o = 0; o < d - l; o++)
          w[o] = 0;
        for (o = 0; !c.isZero(); o++)
          h = c.andln(255), c.iushrn(8), w[d - o - 1] = h;
      }
      return w;
    }, Math.clz32 ? a.prototype._countBits = function(r) {
      return 32 - Math.clz32(r);
    } : a.prototype._countBits = function(r) {
      var s = r, u = 0;
      return s >= 4096 && (u += 13, s >>>= 13), s >= 64 && (u += 7, s >>>= 7), s >= 8 && (u += 4, s >>>= 4), s >= 2 && (u += 2, s >>>= 2), u + s;
    }, a.prototype._zeroBits = function(r) {
      if (r === 0) return 26;
      var s = r, u = 0;
      return s & 8191 || (u += 13, s >>>= 13), s & 127 || (u += 7, s >>>= 7), s & 15 || (u += 4, s >>>= 4), s & 3 || (u += 2, s >>>= 2), s & 1 || u++, u;
    }, a.prototype.bitLength = function() {
      var r = this.words[this.length - 1], s = this._countBits(r);
      return (this.length - 1) * 26 + s;
    };
    function x(p) {
      for (var r = new Array(p.bitLength()), s = 0; s < r.length; s++) {
        var u = s / 26 | 0, l = s % 26;
        r[s] = (p.words[u] & 1 << l) >>> l;
      }
      return r;
    }
    a.prototype.zeroBits = function() {
      if (this.isZero()) return 0;
      for (var r = 0, s = 0; s < this.length; s++) {
        var u = this._zeroBits(this.words[s]);
        if (r += u, u !== 26) break;
      }
      return r;
    }, a.prototype.byteLength = function() {
      return Math.ceil(this.bitLength() / 8);
    }, a.prototype.toTwos = function(r) {
      return this.negative !== 0 ? this.abs().inotn(r).iaddn(1) : this.clone();
    }, a.prototype.fromTwos = function(r) {
      return this.testn(r - 1) ? this.notn(r).iaddn(1).ineg() : this.clone();
    }, a.prototype.isNeg = function() {
      return this.negative !== 0;
    }, a.prototype.neg = function() {
      return this.clone().ineg();
    }, a.prototype.ineg = function() {
      return this.isZero() || (this.negative ^= 1), this;
    }, a.prototype.iuor = function(r) {
      for (; this.length < r.length; )
        this.words[this.length++] = 0;
      for (var s = 0; s < r.length; s++)
        this.words[s] = this.words[s] | r.words[s];
      return this.strip();
    }, a.prototype.ior = function(r) {
      return n((this.negative | r.negative) === 0), this.iuor(r);
    }, a.prototype.or = function(r) {
      return this.length > r.length ? this.clone().ior(r) : r.clone().ior(this);
    }, a.prototype.uor = function(r) {
      return this.length > r.length ? this.clone().iuor(r) : r.clone().iuor(this);
    }, a.prototype.iuand = function(r) {
      var s;
      this.length > r.length ? s = r : s = this;
      for (var u = 0; u < s.length; u++)
        this.words[u] = this.words[u] & r.words[u];
      return this.length = s.length, this.strip();
    }, a.prototype.iand = function(r) {
      return n((this.negative | r.negative) === 0), this.iuand(r);
    }, a.prototype.and = function(r) {
      return this.length > r.length ? this.clone().iand(r) : r.clone().iand(this);
    }, a.prototype.uand = function(r) {
      return this.length > r.length ? this.clone().iuand(r) : r.clone().iuand(this);
    }, a.prototype.iuxor = function(r) {
      var s, u;
      this.length > r.length ? (s = this, u = r) : (s = r, u = this);
      for (var l = 0; l < u.length; l++)
        this.words[l] = s.words[l] ^ u.words[l];
      if (this !== s)
        for (; l < s.length; l++)
          this.words[l] = s.words[l];
      return this.length = s.length, this.strip();
    }, a.prototype.ixor = function(r) {
      return n((this.negative | r.negative) === 0), this.iuxor(r);
    }, a.prototype.xor = function(r) {
      return this.length > r.length ? this.clone().ixor(r) : r.clone().ixor(this);
    }, a.prototype.uxor = function(r) {
      return this.length > r.length ? this.clone().iuxor(r) : r.clone().iuxor(this);
    }, a.prototype.inotn = function(r) {
      n(typeof r == "number" && r >= 0);
      var s = Math.ceil(r / 26) | 0, u = r % 26;
      this._expand(s), u > 0 && s--;
      for (var l = 0; l < s; l++)
        this.words[l] = ~this.words[l] & 67108863;
      for (u > 0 && (this.words[l] = ~this.words[l] & 67108863 >> 26 - u, l++); l < this.length; l++)
        this.words[l] = 0;
      return this.strip();
    }, a.prototype.notn = function(r) {
      return this.clone().inotn(r);
    }, a.prototype.setn = function(r, s) {
      n(typeof r == "number" && r >= 0);
      var u = r / 26 | 0, l = r % 26;
      return this._expand(u + 1), s ? this.words[u] = this.words[u] | 1 << l : this.words[u] = this.words[u] & ~(1 << l), this.strip();
    }, a.prototype.iadd = function(r) {
      var s;
      if (this.negative !== 0 && r.negative === 0)
        return this.negative = 0, s = this.isub(r), this.negative ^= 1, this._normSign();
      if (this.negative === 0 && r.negative !== 0)
        return r.negative = 0, s = this.isub(r), r.negative = 1, s._normSign();
      var u, l;
      this.length > r.length ? (u = this, l = r) : (u = r, l = this);
      for (var d = 0, m = 0; m < l.length; m++)
        s = (u.words[m] | 0) + (l.words[m] | 0) + d, this.words[m] = s & 67108863, d = s >>> 26;
      for (; d !== 0 && m < u.length; m++)
        s = (u.words[m] | 0) + d, this.words[m] = s & 67108863, d = s >>> 26;
      if (this.length = u.length, d !== 0)
        this.words[this.length] = d, this.length++;
      else if (u !== this)
        for (; m < u.length; m++)
          this.words[m] = u.words[m];
      return this;
    }, a.prototype.add = function(r) {
      var s;
      return r.negative !== 0 && this.negative === 0 ? (r.negative = 0, s = this.sub(r), r.negative ^= 1, s) : r.negative === 0 && this.negative !== 0 ? (this.negative = 0, s = r.sub(this), this.negative = 1, s) : this.length > r.length ? this.clone().iadd(r) : r.clone().iadd(this);
    }, a.prototype.isub = function(r) {
      if (r.negative !== 0) {
        r.negative = 0;
        var s = this.iadd(r);
        return r.negative = 1, s._normSign();
      } else if (this.negative !== 0)
        return this.negative = 0, this.iadd(r), this.negative = 1, this._normSign();
      var u = this.cmp(r);
      if (u === 0)
        return this.negative = 0, this.length = 1, this.words[0] = 0, this;
      var l, d;
      u > 0 ? (l = this, d = r) : (l = r, d = this);
      for (var m = 0, w = 0; w < d.length; w++)
        s = (l.words[w] | 0) - (d.words[w] | 0) + m, m = s >> 26, this.words[w] = s & 67108863;
      for (; m !== 0 && w < l.length; w++)
        s = (l.words[w] | 0) + m, m = s >> 26, this.words[w] = s & 67108863;
      if (m === 0 && w < l.length && l !== this)
        for (; w < l.length; w++)
          this.words[w] = l.words[w];
      return this.length = Math.max(this.length, w), l !== this && (this.negative = 1), this.strip();
    }, a.prototype.sub = function(r) {
      return this.clone().isub(r);
    };
    function C(p, r, s) {
      s.negative = r.negative ^ p.negative;
      var u = p.length + r.length | 0;
      s.length = u, u = u - 1 | 0;
      var l = p.words[0] | 0, d = r.words[0] | 0, m = l * d, w = m & 67108863, h = m / 67108864 | 0;
      s.words[0] = w;
      for (var o = 1; o < u; o++) {
        for (var c = h >>> 26, T = h & 67108863, O = Math.min(o, r.length - 1), k = Math.max(0, o - p.length + 1); k <= O; k++) {
          var I = o - k | 0;
          l = p.words[I] | 0, d = r.words[k] | 0, m = l * d + T, c += m / 67108864 | 0, T = m & 67108863;
        }
        s.words[o] = T | 0, h = c | 0;
      }
      return h !== 0 ? s.words[o] = h | 0 : s.length--, s.strip();
    }
    var D = function(r, s, u) {
      var l = r.words, d = s.words, m = u.words, w = 0, h, o, c, T = l[0] | 0, O = T & 8191, k = T >>> 13, I = l[1] | 0, F = I & 8191, q = I >>> 13, We = l[2] | 0, U = We & 8191, H = We >>> 13, Vr = l[3] | 0, G = Vr & 8191, V = Vr >>> 13, zr = l[4] | 0, z = zr & 8191, W = zr >>> 13, Wr = l[5] | 0, Z = Wr & 8191, J = Wr >>> 13, Zr = l[6] | 0, Y = Zr & 8191, Q = Zr >>> 13, Jr = l[7] | 0, X = Jr & 8191, ee = Jr >>> 13, Yr = l[8] | 0, te = Yr & 8191, re = Yr >>> 13, Qr = l[9] | 0, ne = Qr & 8191, ie = Qr >>> 13, Xr = d[0] | 0, oe = Xr & 8191, se = Xr >>> 13, en = d[1] | 0, ae = en & 8191, fe = en >>> 13, tn = d[2] | 0, ue = tn & 8191, le = tn >>> 13, rn = d[3] | 0, he = rn & 8191, ce = rn >>> 13, nn = d[4] | 0, de = nn & 8191, pe = nn >>> 13, on = d[5] | 0, ve = on & 8191, ge = on >>> 13, sn = d[6] | 0, me = sn & 8191, ye = sn >>> 13, an = d[7] | 0, we = an & 8191, be = an >>> 13, fn = d[8] | 0, Me = fn & 8191, _e = fn >>> 13, un = d[9] | 0, Ee = un & 8191, xe = un >>> 13;
      u.negative = r.negative ^ s.negative, u.length = 19, h = Math.imul(O, oe), o = Math.imul(O, se), o = o + Math.imul(k, oe) | 0, c = Math.imul(k, se);
      var Gt = (w + h | 0) + ((o & 8191) << 13) | 0;
      w = (c + (o >>> 13) | 0) + (Gt >>> 26) | 0, Gt &= 67108863, h = Math.imul(F, oe), o = Math.imul(F, se), o = o + Math.imul(q, oe) | 0, c = Math.imul(q, se), h = h + Math.imul(O, ae) | 0, o = o + Math.imul(O, fe) | 0, o = o + Math.imul(k, ae) | 0, c = c + Math.imul(k, fe) | 0;
      var Vt = (w + h | 0) + ((o & 8191) << 13) | 0;
      w = (c + (o >>> 13) | 0) + (Vt >>> 26) | 0, Vt &= 67108863, h = Math.imul(U, oe), o = Math.imul(U, se), o = o + Math.imul(H, oe) | 0, c = Math.imul(H, se), h = h + Math.imul(F, ae) | 0, o = o + Math.imul(F, fe) | 0, o = o + Math.imul(q, ae) | 0, c = c + Math.imul(q, fe) | 0, h = h + Math.imul(O, ue) | 0, o = o + Math.imul(O, le) | 0, o = o + Math.imul(k, ue) | 0, c = c + Math.imul(k, le) | 0;
      var zt = (w + h | 0) + ((o & 8191) << 13) | 0;
      w = (c + (o >>> 13) | 0) + (zt >>> 26) | 0, zt &= 67108863, h = Math.imul(G, oe), o = Math.imul(G, se), o = o + Math.imul(V, oe) | 0, c = Math.imul(V, se), h = h + Math.imul(U, ae) | 0, o = o + Math.imul(U, fe) | 0, o = o + Math.imul(H, ae) | 0, c = c + Math.imul(H, fe) | 0, h = h + Math.imul(F, ue) | 0, o = o + Math.imul(F, le) | 0, o = o + Math.imul(q, ue) | 0, c = c + Math.imul(q, le) | 0, h = h + Math.imul(O, he) | 0, o = o + Math.imul(O, ce) | 0, o = o + Math.imul(k, he) | 0, c = c + Math.imul(k, ce) | 0;
      var Wt = (w + h | 0) + ((o & 8191) << 13) | 0;
      w = (c + (o >>> 13) | 0) + (Wt >>> 26) | 0, Wt &= 67108863, h = Math.imul(z, oe), o = Math.imul(z, se), o = o + Math.imul(W, oe) | 0, c = Math.imul(W, se), h = h + Math.imul(G, ae) | 0, o = o + Math.imul(G, fe) | 0, o = o + Math.imul(V, ae) | 0, c = c + Math.imul(V, fe) | 0, h = h + Math.imul(U, ue) | 0, o = o + Math.imul(U, le) | 0, o = o + Math.imul(H, ue) | 0, c = c + Math.imul(H, le) | 0, h = h + Math.imul(F, he) | 0, o = o + Math.imul(F, ce) | 0, o = o + Math.imul(q, he) | 0, c = c + Math.imul(q, ce) | 0, h = h + Math.imul(O, de) | 0, o = o + Math.imul(O, pe) | 0, o = o + Math.imul(k, de) | 0, c = c + Math.imul(k, pe) | 0;
      var Zt = (w + h | 0) + ((o & 8191) << 13) | 0;
      w = (c + (o >>> 13) | 0) + (Zt >>> 26) | 0, Zt &= 67108863, h = Math.imul(Z, oe), o = Math.imul(Z, se), o = o + Math.imul(J, oe) | 0, c = Math.imul(J, se), h = h + Math.imul(z, ae) | 0, o = o + Math.imul(z, fe) | 0, o = o + Math.imul(W, ae) | 0, c = c + Math.imul(W, fe) | 0, h = h + Math.imul(G, ue) | 0, o = o + Math.imul(G, le) | 0, o = o + Math.imul(V, ue) | 0, c = c + Math.imul(V, le) | 0, h = h + Math.imul(U, he) | 0, o = o + Math.imul(U, ce) | 0, o = o + Math.imul(H, he) | 0, c = c + Math.imul(H, ce) | 0, h = h + Math.imul(F, de) | 0, o = o + Math.imul(F, pe) | 0, o = o + Math.imul(q, de) | 0, c = c + Math.imul(q, pe) | 0, h = h + Math.imul(O, ve) | 0, o = o + Math.imul(O, ge) | 0, o = o + Math.imul(k, ve) | 0, c = c + Math.imul(k, ge) | 0;
      var Jt = (w + h | 0) + ((o & 8191) << 13) | 0;
      w = (c + (o >>> 13) | 0) + (Jt >>> 26) | 0, Jt &= 67108863, h = Math.imul(Y, oe), o = Math.imul(Y, se), o = o + Math.imul(Q, oe) | 0, c = Math.imul(Q, se), h = h + Math.imul(Z, ae) | 0, o = o + Math.imul(Z, fe) | 0, o = o + Math.imul(J, ae) | 0, c = c + Math.imul(J, fe) | 0, h = h + Math.imul(z, ue) | 0, o = o + Math.imul(z, le) | 0, o = o + Math.imul(W, ue) | 0, c = c + Math.imul(W, le) | 0, h = h + Math.imul(G, he) | 0, o = o + Math.imul(G, ce) | 0, o = o + Math.imul(V, he) | 0, c = c + Math.imul(V, ce) | 0, h = h + Math.imul(U, de) | 0, o = o + Math.imul(U, pe) | 0, o = o + Math.imul(H, de) | 0, c = c + Math.imul(H, pe) | 0, h = h + Math.imul(F, ve) | 0, o = o + Math.imul(F, ge) | 0, o = o + Math.imul(q, ve) | 0, c = c + Math.imul(q, ge) | 0, h = h + Math.imul(O, me) | 0, o = o + Math.imul(O, ye) | 0, o = o + Math.imul(k, me) | 0, c = c + Math.imul(k, ye) | 0;
      var Yt = (w + h | 0) + ((o & 8191) << 13) | 0;
      w = (c + (o >>> 13) | 0) + (Yt >>> 26) | 0, Yt &= 67108863, h = Math.imul(X, oe), o = Math.imul(X, se), o = o + Math.imul(ee, oe) | 0, c = Math.imul(ee, se), h = h + Math.imul(Y, ae) | 0, o = o + Math.imul(Y, fe) | 0, o = o + Math.imul(Q, ae) | 0, c = c + Math.imul(Q, fe) | 0, h = h + Math.imul(Z, ue) | 0, o = o + Math.imul(Z, le) | 0, o = o + Math.imul(J, ue) | 0, c = c + Math.imul(J, le) | 0, h = h + Math.imul(z, he) | 0, o = o + Math.imul(z, ce) | 0, o = o + Math.imul(W, he) | 0, c = c + Math.imul(W, ce) | 0, h = h + Math.imul(G, de) | 0, o = o + Math.imul(G, pe) | 0, o = o + Math.imul(V, de) | 0, c = c + Math.imul(V, pe) | 0, h = h + Math.imul(U, ve) | 0, o = o + Math.imul(U, ge) | 0, o = o + Math.imul(H, ve) | 0, c = c + Math.imul(H, ge) | 0, h = h + Math.imul(F, me) | 0, o = o + Math.imul(F, ye) | 0, o = o + Math.imul(q, me) | 0, c = c + Math.imul(q, ye) | 0, h = h + Math.imul(O, we) | 0, o = o + Math.imul(O, be) | 0, o = o + Math.imul(k, we) | 0, c = c + Math.imul(k, be) | 0;
      var Qt = (w + h | 0) + ((o & 8191) << 13) | 0;
      w = (c + (o >>> 13) | 0) + (Qt >>> 26) | 0, Qt &= 67108863, h = Math.imul(te, oe), o = Math.imul(te, se), o = o + Math.imul(re, oe) | 0, c = Math.imul(re, se), h = h + Math.imul(X, ae) | 0, o = o + Math.imul(X, fe) | 0, o = o + Math.imul(ee, ae) | 0, c = c + Math.imul(ee, fe) | 0, h = h + Math.imul(Y, ue) | 0, o = o + Math.imul(Y, le) | 0, o = o + Math.imul(Q, ue) | 0, c = c + Math.imul(Q, le) | 0, h = h + Math.imul(Z, he) | 0, o = o + Math.imul(Z, ce) | 0, o = o + Math.imul(J, he) | 0, c = c + Math.imul(J, ce) | 0, h = h + Math.imul(z, de) | 0, o = o + Math.imul(z, pe) | 0, o = o + Math.imul(W, de) | 0, c = c + Math.imul(W, pe) | 0, h = h + Math.imul(G, ve) | 0, o = o + Math.imul(G, ge) | 0, o = o + Math.imul(V, ve) | 0, c = c + Math.imul(V, ge) | 0, h = h + Math.imul(U, me) | 0, o = o + Math.imul(U, ye) | 0, o = o + Math.imul(H, me) | 0, c = c + Math.imul(H, ye) | 0, h = h + Math.imul(F, we) | 0, o = o + Math.imul(F, be) | 0, o = o + Math.imul(q, we) | 0, c = c + Math.imul(q, be) | 0, h = h + Math.imul(O, Me) | 0, o = o + Math.imul(O, _e) | 0, o = o + Math.imul(k, Me) | 0, c = c + Math.imul(k, _e) | 0;
      var Xt = (w + h | 0) + ((o & 8191) << 13) | 0;
      w = (c + (o >>> 13) | 0) + (Xt >>> 26) | 0, Xt &= 67108863, h = Math.imul(ne, oe), o = Math.imul(ne, se), o = o + Math.imul(ie, oe) | 0, c = Math.imul(ie, se), h = h + Math.imul(te, ae) | 0, o = o + Math.imul(te, fe) | 0, o = o + Math.imul(re, ae) | 0, c = c + Math.imul(re, fe) | 0, h = h + Math.imul(X, ue) | 0, o = o + Math.imul(X, le) | 0, o = o + Math.imul(ee, ue) | 0, c = c + Math.imul(ee, le) | 0, h = h + Math.imul(Y, he) | 0, o = o + Math.imul(Y, ce) | 0, o = o + Math.imul(Q, he) | 0, c = c + Math.imul(Q, ce) | 0, h = h + Math.imul(Z, de) | 0, o = o + Math.imul(Z, pe) | 0, o = o + Math.imul(J, de) | 0, c = c + Math.imul(J, pe) | 0, h = h + Math.imul(z, ve) | 0, o = o + Math.imul(z, ge) | 0, o = o + Math.imul(W, ve) | 0, c = c + Math.imul(W, ge) | 0, h = h + Math.imul(G, me) | 0, o = o + Math.imul(G, ye) | 0, o = o + Math.imul(V, me) | 0, c = c + Math.imul(V, ye) | 0, h = h + Math.imul(U, we) | 0, o = o + Math.imul(U, be) | 0, o = o + Math.imul(H, we) | 0, c = c + Math.imul(H, be) | 0, h = h + Math.imul(F, Me) | 0, o = o + Math.imul(F, _e) | 0, o = o + Math.imul(q, Me) | 0, c = c + Math.imul(q, _e) | 0, h = h + Math.imul(O, Ee) | 0, o = o + Math.imul(O, xe) | 0, o = o + Math.imul(k, Ee) | 0, c = c + Math.imul(k, xe) | 0;
      var er = (w + h | 0) + ((o & 8191) << 13) | 0;
      w = (c + (o >>> 13) | 0) + (er >>> 26) | 0, er &= 67108863, h = Math.imul(ne, ae), o = Math.imul(ne, fe), o = o + Math.imul(ie, ae) | 0, c = Math.imul(ie, fe), h = h + Math.imul(te, ue) | 0, o = o + Math.imul(te, le) | 0, o = o + Math.imul(re, ue) | 0, c = c + Math.imul(re, le) | 0, h = h + Math.imul(X, he) | 0, o = o + Math.imul(X, ce) | 0, o = o + Math.imul(ee, he) | 0, c = c + Math.imul(ee, ce) | 0, h = h + Math.imul(Y, de) | 0, o = o + Math.imul(Y, pe) | 0, o = o + Math.imul(Q, de) | 0, c = c + Math.imul(Q, pe) | 0, h = h + Math.imul(Z, ve) | 0, o = o + Math.imul(Z, ge) | 0, o = o + Math.imul(J, ve) | 0, c = c + Math.imul(J, ge) | 0, h = h + Math.imul(z, me) | 0, o = o + Math.imul(z, ye) | 0, o = o + Math.imul(W, me) | 0, c = c + Math.imul(W, ye) | 0, h = h + Math.imul(G, we) | 0, o = o + Math.imul(G, be) | 0, o = o + Math.imul(V, we) | 0, c = c + Math.imul(V, be) | 0, h = h + Math.imul(U, Me) | 0, o = o + Math.imul(U, _e) | 0, o = o + Math.imul(H, Me) | 0, c = c + Math.imul(H, _e) | 0, h = h + Math.imul(F, Ee) | 0, o = o + Math.imul(F, xe) | 0, o = o + Math.imul(q, Ee) | 0, c = c + Math.imul(q, xe) | 0;
      var tr = (w + h | 0) + ((o & 8191) << 13) | 0;
      w = (c + (o >>> 13) | 0) + (tr >>> 26) | 0, tr &= 67108863, h = Math.imul(ne, ue), o = Math.imul(ne, le), o = o + Math.imul(ie, ue) | 0, c = Math.imul(ie, le), h = h + Math.imul(te, he) | 0, o = o + Math.imul(te, ce) | 0, o = o + Math.imul(re, he) | 0, c = c + Math.imul(re, ce) | 0, h = h + Math.imul(X, de) | 0, o = o + Math.imul(X, pe) | 0, o = o + Math.imul(ee, de) | 0, c = c + Math.imul(ee, pe) | 0, h = h + Math.imul(Y, ve) | 0, o = o + Math.imul(Y, ge) | 0, o = o + Math.imul(Q, ve) | 0, c = c + Math.imul(Q, ge) | 0, h = h + Math.imul(Z, me) | 0, o = o + Math.imul(Z, ye) | 0, o = o + Math.imul(J, me) | 0, c = c + Math.imul(J, ye) | 0, h = h + Math.imul(z, we) | 0, o = o + Math.imul(z, be) | 0, o = o + Math.imul(W, we) | 0, c = c + Math.imul(W, be) | 0, h = h + Math.imul(G, Me) | 0, o = o + Math.imul(G, _e) | 0, o = o + Math.imul(V, Me) | 0, c = c + Math.imul(V, _e) | 0, h = h + Math.imul(U, Ee) | 0, o = o + Math.imul(U, xe) | 0, o = o + Math.imul(H, Ee) | 0, c = c + Math.imul(H, xe) | 0;
      var rr = (w + h | 0) + ((o & 8191) << 13) | 0;
      w = (c + (o >>> 13) | 0) + (rr >>> 26) | 0, rr &= 67108863, h = Math.imul(ne, he), o = Math.imul(ne, ce), o = o + Math.imul(ie, he) | 0, c = Math.imul(ie, ce), h = h + Math.imul(te, de) | 0, o = o + Math.imul(te, pe) | 0, o = o + Math.imul(re, de) | 0, c = c + Math.imul(re, pe) | 0, h = h + Math.imul(X, ve) | 0, o = o + Math.imul(X, ge) | 0, o = o + Math.imul(ee, ve) | 0, c = c + Math.imul(ee, ge) | 0, h = h + Math.imul(Y, me) | 0, o = o + Math.imul(Y, ye) | 0, o = o + Math.imul(Q, me) | 0, c = c + Math.imul(Q, ye) | 0, h = h + Math.imul(Z, we) | 0, o = o + Math.imul(Z, be) | 0, o = o + Math.imul(J, we) | 0, c = c + Math.imul(J, be) | 0, h = h + Math.imul(z, Me) | 0, o = o + Math.imul(z, _e) | 0, o = o + Math.imul(W, Me) | 0, c = c + Math.imul(W, _e) | 0, h = h + Math.imul(G, Ee) | 0, o = o + Math.imul(G, xe) | 0, o = o + Math.imul(V, Ee) | 0, c = c + Math.imul(V, xe) | 0;
      var nr = (w + h | 0) + ((o & 8191) << 13) | 0;
      w = (c + (o >>> 13) | 0) + (nr >>> 26) | 0, nr &= 67108863, h = Math.imul(ne, de), o = Math.imul(ne, pe), o = o + Math.imul(ie, de) | 0, c = Math.imul(ie, pe), h = h + Math.imul(te, ve) | 0, o = o + Math.imul(te, ge) | 0, o = o + Math.imul(re, ve) | 0, c = c + Math.imul(re, ge) | 0, h = h + Math.imul(X, me) | 0, o = o + Math.imul(X, ye) | 0, o = o + Math.imul(ee, me) | 0, c = c + Math.imul(ee, ye) | 0, h = h + Math.imul(Y, we) | 0, o = o + Math.imul(Y, be) | 0, o = o + Math.imul(Q, we) | 0, c = c + Math.imul(Q, be) | 0, h = h + Math.imul(Z, Me) | 0, o = o + Math.imul(Z, _e) | 0, o = o + Math.imul(J, Me) | 0, c = c + Math.imul(J, _e) | 0, h = h + Math.imul(z, Ee) | 0, o = o + Math.imul(z, xe) | 0, o = o + Math.imul(W, Ee) | 0, c = c + Math.imul(W, xe) | 0;
      var ir = (w + h | 0) + ((o & 8191) << 13) | 0;
      w = (c + (o >>> 13) | 0) + (ir >>> 26) | 0, ir &= 67108863, h = Math.imul(ne, ve), o = Math.imul(ne, ge), o = o + Math.imul(ie, ve) | 0, c = Math.imul(ie, ge), h = h + Math.imul(te, me) | 0, o = o + Math.imul(te, ye) | 0, o = o + Math.imul(re, me) | 0, c = c + Math.imul(re, ye) | 0, h = h + Math.imul(X, we) | 0, o = o + Math.imul(X, be) | 0, o = o + Math.imul(ee, we) | 0, c = c + Math.imul(ee, be) | 0, h = h + Math.imul(Y, Me) | 0, o = o + Math.imul(Y, _e) | 0, o = o + Math.imul(Q, Me) | 0, c = c + Math.imul(Q, _e) | 0, h = h + Math.imul(Z, Ee) | 0, o = o + Math.imul(Z, xe) | 0, o = o + Math.imul(J, Ee) | 0, c = c + Math.imul(J, xe) | 0;
      var or = (w + h | 0) + ((o & 8191) << 13) | 0;
      w = (c + (o >>> 13) | 0) + (or >>> 26) | 0, or &= 67108863, h = Math.imul(ne, me), o = Math.imul(ne, ye), o = o + Math.imul(ie, me) | 0, c = Math.imul(ie, ye), h = h + Math.imul(te, we) | 0, o = o + Math.imul(te, be) | 0, o = o + Math.imul(re, we) | 0, c = c + Math.imul(re, be) | 0, h = h + Math.imul(X, Me) | 0, o = o + Math.imul(X, _e) | 0, o = o + Math.imul(ee, Me) | 0, c = c + Math.imul(ee, _e) | 0, h = h + Math.imul(Y, Ee) | 0, o = o + Math.imul(Y, xe) | 0, o = o + Math.imul(Q, Ee) | 0, c = c + Math.imul(Q, xe) | 0;
      var sr = (w + h | 0) + ((o & 8191) << 13) | 0;
      w = (c + (o >>> 13) | 0) + (sr >>> 26) | 0, sr &= 67108863, h = Math.imul(ne, we), o = Math.imul(ne, be), o = o + Math.imul(ie, we) | 0, c = Math.imul(ie, be), h = h + Math.imul(te, Me) | 0, o = o + Math.imul(te, _e) | 0, o = o + Math.imul(re, Me) | 0, c = c + Math.imul(re, _e) | 0, h = h + Math.imul(X, Ee) | 0, o = o + Math.imul(X, xe) | 0, o = o + Math.imul(ee, Ee) | 0, c = c + Math.imul(ee, xe) | 0;
      var ar = (w + h | 0) + ((o & 8191) << 13) | 0;
      w = (c + (o >>> 13) | 0) + (ar >>> 26) | 0, ar &= 67108863, h = Math.imul(ne, Me), o = Math.imul(ne, _e), o = o + Math.imul(ie, Me) | 0, c = Math.imul(ie, _e), h = h + Math.imul(te, Ee) | 0, o = o + Math.imul(te, xe) | 0, o = o + Math.imul(re, Ee) | 0, c = c + Math.imul(re, xe) | 0;
      var fr = (w + h | 0) + ((o & 8191) << 13) | 0;
      w = (c + (o >>> 13) | 0) + (fr >>> 26) | 0, fr &= 67108863, h = Math.imul(ne, Ee), o = Math.imul(ne, xe), o = o + Math.imul(ie, Ee) | 0, c = Math.imul(ie, xe);
      var ur = (w + h | 0) + ((o & 8191) << 13) | 0;
      return w = (c + (o >>> 13) | 0) + (ur >>> 26) | 0, ur &= 67108863, m[0] = Gt, m[1] = Vt, m[2] = zt, m[3] = Wt, m[4] = Zt, m[5] = Jt, m[6] = Yt, m[7] = Qt, m[8] = Xt, m[9] = er, m[10] = tr, m[11] = rr, m[12] = nr, m[13] = ir, m[14] = or, m[15] = sr, m[16] = ar, m[17] = fr, m[18] = ur, w !== 0 && (m[19] = w, u.length++), u;
    };
    Math.imul || (D = C);
    function B(p, r, s) {
      s.negative = r.negative ^ p.negative, s.length = p.length + r.length;
      for (var u = 0, l = 0, d = 0; d < s.length - 1; d++) {
        var m = l;
        l = 0;
        for (var w = u & 67108863, h = Math.min(d, r.length - 1), o = Math.max(0, d - p.length + 1); o <= h; o++) {
          var c = d - o, T = p.words[c] | 0, O = r.words[o] | 0, k = T * O, I = k & 67108863;
          m = m + (k / 67108864 | 0) | 0, I = I + w | 0, w = I & 67108863, m = m + (I >>> 26) | 0, l += m >>> 26, m &= 67108863;
        }
        s.words[d] = w, u = m, m = l;
      }
      return u !== 0 ? s.words[d] = u : s.length--, s.strip();
    }
    function S(p, r, s) {
      var u = new A();
      return u.mulp(p, r, s);
    }
    a.prototype.mulTo = function(r, s) {
      var u, l = this.length + r.length;
      return this.length === 10 && r.length === 10 ? u = D(this, r, s) : l < 63 ? u = C(this, r, s) : l < 1024 ? u = B(this, r, s) : u = S(this, r, s), u;
    };
    function A(p, r) {
      this.x = p, this.y = r;
    }
    A.prototype.makeRBT = function(r) {
      for (var s = new Array(r), u = a.prototype._countBits(r) - 1, l = 0; l < r; l++)
        s[l] = this.revBin(l, u, r);
      return s;
    }, A.prototype.revBin = function(r, s, u) {
      if (r === 0 || r === u - 1) return r;
      for (var l = 0, d = 0; d < s; d++)
        l |= (r & 1) << s - d - 1, r >>= 1;
      return l;
    }, A.prototype.permute = function(r, s, u, l, d, m) {
      for (var w = 0; w < m; w++)
        l[w] = s[r[w]], d[w] = u[r[w]];
    }, A.prototype.transform = function(r, s, u, l, d, m) {
      this.permute(m, r, s, u, l, d);
      for (var w = 1; w < d; w <<= 1)
        for (var h = w << 1, o = Math.cos(2 * Math.PI / h), c = Math.sin(2 * Math.PI / h), T = 0; T < d; T += h)
          for (var O = o, k = c, I = 0; I < w; I++) {
            var F = u[T + I], q = l[T + I], We = u[T + I + w], U = l[T + I + w], H = O * We - k * U;
            U = O * U + k * We, We = H, u[T + I] = F + We, l[T + I] = q + U, u[T + I + w] = F - We, l[T + I + w] = q - U, I !== h && (H = o * O - c * k, k = o * k + c * O, O = H);
          }
    }, A.prototype.guessLen13b = function(r, s) {
      var u = Math.max(s, r) | 1, l = u & 1, d = 0;
      for (u = u / 2 | 0; u; u = u >>> 1)
        d++;
      return 1 << d + 1 + l;
    }, A.prototype.conjugate = function(r, s, u) {
      if (!(u <= 1))
        for (var l = 0; l < u / 2; l++) {
          var d = r[l];
          r[l] = r[u - l - 1], r[u - l - 1] = d, d = s[l], s[l] = -s[u - l - 1], s[u - l - 1] = -d;
        }
    }, A.prototype.normalize13b = function(r, s) {
      for (var u = 0, l = 0; l < s / 2; l++) {
        var d = Math.round(r[2 * l + 1] / s) * 8192 + Math.round(r[2 * l] / s) + u;
        r[l] = d & 67108863, d < 67108864 ? u = 0 : u = d / 67108864 | 0;
      }
      return r;
    }, A.prototype.convert13b = function(r, s, u, l) {
      for (var d = 0, m = 0; m < s; m++)
        d = d + (r[m] | 0), u[2 * m] = d & 8191, d = d >>> 13, u[2 * m + 1] = d & 8191, d = d >>> 13;
      for (m = 2 * s; m < l; ++m)
        u[m] = 0;
      n(d === 0), n((d & -8192) === 0);
    }, A.prototype.stub = function(r) {
      for (var s = new Array(r), u = 0; u < r; u++)
        s[u] = 0;
      return s;
    }, A.prototype.mulp = function(r, s, u) {
      var l = 2 * this.guessLen13b(r.length, s.length), d = this.makeRBT(l), m = this.stub(l), w = new Array(l), h = new Array(l), o = new Array(l), c = new Array(l), T = new Array(l), O = new Array(l), k = u.words;
      k.length = l, this.convert13b(r.words, r.length, w, l), this.convert13b(s.words, s.length, c, l), this.transform(w, m, h, o, l, d), this.transform(c, m, T, O, l, d);
      for (var I = 0; I < l; I++) {
        var F = h[I] * T[I] - o[I] * O[I];
        o[I] = h[I] * O[I] + o[I] * T[I], h[I] = F;
      }
      return this.conjugate(h, o, l), this.transform(h, o, k, m, l, d), this.conjugate(k, m, l), this.normalize13b(k, l), u.negative = r.negative ^ s.negative, u.length = r.length + s.length, u.strip();
    }, a.prototype.mul = function(r) {
      var s = new a(null);
      return s.words = new Array(this.length + r.length), this.mulTo(r, s);
    }, a.prototype.mulf = function(r) {
      var s = new a(null);
      return s.words = new Array(this.length + r.length), S(this, r, s);
    }, a.prototype.imul = function(r) {
      return this.clone().mulTo(r, this);
    }, a.prototype.imuln = function(r) {
      n(typeof r == "number"), n(r < 67108864);
      for (var s = 0, u = 0; u < this.length; u++) {
        var l = (this.words[u] | 0) * r, d = (l & 67108863) + (s & 67108863);
        s >>= 26, s += l / 67108864 | 0, s += d >>> 26, this.words[u] = d & 67108863;
      }
      return s !== 0 && (this.words[u] = s, this.length++), r === 0 && (this.length = 1, this._normSign()), this;
    }, a.prototype.muln = function(r) {
      return this.clone().imuln(r);
    }, a.prototype.sqr = function() {
      return this.mul(this);
    }, a.prototype.isqr = function() {
      return this.imul(this.clone());
    }, a.prototype.pow = function(r) {
      var s = x(r);
      if (s.length === 0) return new a(1);
      for (var u = this, l = 0; l < s.length && s[l] === 0; l++, u = u.sqr())
        ;
      if (++l < s.length)
        for (var d = u.sqr(); l < s.length; l++, d = d.sqr())
          s[l] !== 0 && (u = u.mul(d));
      return u;
    }, a.prototype.iushln = function(r) {
      n(typeof r == "number" && r >= 0);
      var s = r % 26, u = (r - s) / 26, l = 67108863 >>> 26 - s << 26 - s, d;
      if (s !== 0) {
        var m = 0;
        for (d = 0; d < this.length; d++) {
          var w = this.words[d] & l, h = (this.words[d] | 0) - w << s;
          this.words[d] = h | m, m = w >>> 26 - s;
        }
        m && (this.words[d] = m, this.length++);
      }
      if (u !== 0) {
        for (d = this.length - 1; d >= 0; d--)
          this.words[d + u] = this.words[d];
        for (d = 0; d < u; d++)
          this.words[d] = 0;
        this.length += u;
      }
      return this.strip();
    }, a.prototype.ishln = function(r) {
      return n(this.negative === 0), this.iushln(r);
    }, a.prototype.iushrn = function(r, s, u) {
      n(typeof r == "number" && r >= 0);
      var l;
      s ? l = (s - s % 26) / 26 : l = 0;
      var d = r % 26, m = Math.min((r - d) / 26, this.length), w = 67108863 ^ 67108863 >>> d << d, h = u;
      if (l -= m, l = Math.max(0, l), h) {
        for (var o = 0; o < m; o++)
          h.words[o] = this.words[o];
        h.length = m;
      }
      if (m !== 0) if (this.length > m)
        for (this.length -= m, o = 0; o < this.length; o++)
          this.words[o] = this.words[o + m];
      else
        this.words[0] = 0, this.length = 1;
      var c = 0;
      for (o = this.length - 1; o >= 0 && (c !== 0 || o >= l); o--) {
        var T = this.words[o] | 0;
        this.words[o] = c << 26 - d | T >>> d, c = T & w;
      }
      return h && c !== 0 && (h.words[h.length++] = c), this.length === 0 && (this.words[0] = 0, this.length = 1), this.strip();
    }, a.prototype.ishrn = function(r, s, u) {
      return n(this.negative === 0), this.iushrn(r, s, u);
    }, a.prototype.shln = function(r) {
      return this.clone().ishln(r);
    }, a.prototype.ushln = function(r) {
      return this.clone().iushln(r);
    }, a.prototype.shrn = function(r) {
      return this.clone().ishrn(r);
    }, a.prototype.ushrn = function(r) {
      return this.clone().iushrn(r);
    }, a.prototype.testn = function(r) {
      n(typeof r == "number" && r >= 0);
      var s = r % 26, u = (r - s) / 26, l = 1 << s;
      if (this.length <= u) return !1;
      var d = this.words[u];
      return !!(d & l);
    }, a.prototype.imaskn = function(r) {
      n(typeof r == "number" && r >= 0);
      var s = r % 26, u = (r - s) / 26;
      if (n(this.negative === 0, "imaskn works only with positive numbers"), this.length <= u)
        return this;
      if (s !== 0 && u++, this.length = Math.min(u, this.length), s !== 0) {
        var l = 67108863 ^ 67108863 >>> s << s;
        this.words[this.length - 1] &= l;
      }
      return this.length === 0 && (this.words[0] = 0, this.length = 1), this.strip();
    }, a.prototype.maskn = function(r) {
      return this.clone().imaskn(r);
    }, a.prototype.iaddn = function(r) {
      return n(typeof r == "number"), n(r < 67108864), r < 0 ? this.isubn(-r) : this.negative !== 0 ? this.length === 1 && (this.words[0] | 0) < r ? (this.words[0] = r - (this.words[0] | 0), this.negative = 0, this) : (this.negative = 0, this.isubn(r), this.negative = 1, this) : this._iaddn(r);
    }, a.prototype._iaddn = function(r) {
      this.words[0] += r;
      for (var s = 0; s < this.length && this.words[s] >= 67108864; s++)
        this.words[s] -= 67108864, s === this.length - 1 ? this.words[s + 1] = 1 : this.words[s + 1]++;
      return this.length = Math.max(this.length, s + 1), this;
    }, a.prototype.isubn = function(r) {
      if (n(typeof r == "number"), n(r < 67108864), r < 0) return this.iaddn(-r);
      if (this.negative !== 0)
        return this.negative = 0, this.iaddn(r), this.negative = 1, this;
      if (this.words[0] -= r, this.length === 1 && this.words[0] < 0)
        this.words[0] = -this.words[0], this.negative = 1;
      else
        for (var s = 0; s < this.length && this.words[s] < 0; s++)
          this.words[s] += 67108864, this.words[s + 1] -= 1;
      return this.strip();
    }, a.prototype.addn = function(r) {
      return this.clone().iaddn(r);
    }, a.prototype.subn = function(r) {
      return this.clone().isubn(r);
    }, a.prototype.iabs = function() {
      return this.negative = 0, this;
    }, a.prototype.abs = function() {
      return this.clone().iabs();
    }, a.prototype._ishlnsubmul = function(r, s, u) {
      var l = r.length + u, d;
      this._expand(l);
      var m, w = 0;
      for (d = 0; d < r.length; d++) {
        m = (this.words[d + u] | 0) + w;
        var h = (r.words[d] | 0) * s;
        m -= h & 67108863, w = (m >> 26) - (h / 67108864 | 0), this.words[d + u] = m & 67108863;
      }
      for (; d < this.length - u; d++)
        m = (this.words[d + u] | 0) + w, w = m >> 26, this.words[d + u] = m & 67108863;
      if (w === 0) return this.strip();
      for (n(w === -1), w = 0, d = 0; d < this.length; d++)
        m = -(this.words[d] | 0) + w, w = m >> 26, this.words[d] = m & 67108863;
      return this.negative = 1, this.strip();
    }, a.prototype._wordDiv = function(r, s) {
      var u = this.length - r.length, l = this.clone(), d = r, m = d.words[d.length - 1] | 0, w = this._countBits(m);
      u = 26 - w, u !== 0 && (d = d.ushln(u), l.iushln(u), m = d.words[d.length - 1] | 0);
      var h = l.length - d.length, o;
      if (s !== "mod") {
        o = new a(null), o.length = h + 1, o.words = new Array(o.length);
        for (var c = 0; c < o.length; c++)
          o.words[c] = 0;
      }
      var T = l.clone()._ishlnsubmul(d, 1, h);
      T.negative === 0 && (l = T, o && (o.words[h] = 1));
      for (var O = h - 1; O >= 0; O--) {
        var k = (l.words[d.length + O] | 0) * 67108864 + (l.words[d.length + O - 1] | 0);
        for (k = Math.min(k / m | 0, 67108863), l._ishlnsubmul(d, k, O); l.negative !== 0; )
          k--, l.negative = 0, l._ishlnsubmul(d, 1, O), l.isZero() || (l.negative ^= 1);
        o && (o.words[O] = k);
      }
      return o && o.strip(), l.strip(), s !== "div" && u !== 0 && l.iushrn(u), {
        div: o || null,
        mod: l
      };
    }, a.prototype.divmod = function(r, s, u) {
      if (n(!r.isZero()), this.isZero())
        return {
          div: new a(0),
          mod: new a(0)
        };
      var l, d, m;
      return this.negative !== 0 && r.negative === 0 ? (m = this.neg().divmod(r, s), s !== "mod" && (l = m.div.neg()), s !== "div" && (d = m.mod.neg(), u && d.negative !== 0 && d.iadd(r)), {
        div: l,
        mod: d
      }) : this.negative === 0 && r.negative !== 0 ? (m = this.divmod(r.neg(), s), s !== "mod" && (l = m.div.neg()), {
        div: l,
        mod: m.mod
      }) : this.negative & r.negative ? (m = this.neg().divmod(r.neg(), s), s !== "div" && (d = m.mod.neg(), u && d.negative !== 0 && d.isub(r)), {
        div: m.div,
        mod: d
      }) : r.length > this.length || this.cmp(r) < 0 ? {
        div: new a(0),
        mod: this
      } : r.length === 1 ? s === "div" ? {
        div: this.divn(r.words[0]),
        mod: null
      } : s === "mod" ? {
        div: null,
        mod: new a(this.modn(r.words[0]))
      } : {
        div: this.divn(r.words[0]),
        mod: new a(this.modn(r.words[0]))
      } : this._wordDiv(r, s);
    }, a.prototype.div = function(r) {
      return this.divmod(r, "div", !1).div;
    }, a.prototype.mod = function(r) {
      return this.divmod(r, "mod", !1).mod;
    }, a.prototype.umod = function(r) {
      return this.divmod(r, "mod", !0).mod;
    }, a.prototype.divRound = function(r) {
      var s = this.divmod(r);
      if (s.mod.isZero()) return s.div;
      var u = s.mod.abs(), l = r.abs().iushrn(1), d = r.words[0] & 1, m = u.cmp(l);
      if (m < 0 || d === 1 && m === 0) return s.div;
      var w = new a(1);
      return w.negative = this.negative ^ r.negative, s.div.iadd(w);
    }, a.prototype.modn = function(r) {
      n(r <= 67108863);
      for (var s = (1 << 26) % r, u = 0, l = this.length - 1; l >= 0; l--)
        u = (s * u + (this.words[l] | 0)) % r;
      return u;
    }, a.prototype.idivn = function(r) {
      n(r <= 67108863);
      for (var s = 0, u = this.length - 1; u >= 0; u--) {
        var l = (this.words[u] | 0) + s * 67108864;
        this.words[u] = l / r | 0, s = l % r;
      }
      return this.strip();
    }, a.prototype.divn = function(r) {
      return this.clone().idivn(r);
    }, a.prototype.egcd = function(r) {
      n(r.negative === 0), n(!r.isZero());
      var s = this, u = r.clone();
      s.negative !== 0 ? s = s.umod(r) : s = s.clone();
      for (var l = new a(1), d = new a(0), m = new a(0), w = new a(1), h = 0; s.isEven() && u.isEven(); )
        s.iushrn(1), u.iushrn(1), ++h;
      for (var o = u.clone(), c = s.clone(); !s.isZero(); ) {
        for (var T = 0, O = 1; !(s.words[0] & O) && T < 26; ++T, O <<= 1) ;
        if (T > 0)
          for (s.iushrn(T); T-- > 0; )
            (l.isOdd() || d.isOdd()) && (l.iadd(o), d.isub(c)), l.iushrn(1), d.iushrn(1);
        for (var k = 0, I = 1; !(u.words[0] & I) && k < 26; ++k, I <<= 1) ;
        if (k > 0)
          for (u.iushrn(k); k-- > 0; )
            (m.isOdd() || w.isOdd()) && (m.iadd(o), w.isub(c)), m.iushrn(1), w.iushrn(1);
        s.cmp(u) >= 0 ? (s.isub(u), l.isub(m), d.isub(w)) : (u.isub(s), m.isub(l), w.isub(d));
      }
      return {
        a: m,
        b: w,
        gcd: u.iushln(h)
      };
    }, a.prototype._invmp = function(r) {
      n(r.negative === 0), n(!r.isZero());
      var s = this, u = r.clone();
      s.negative !== 0 ? s = s.umod(r) : s = s.clone();
      for (var l = new a(1), d = new a(0), m = u.clone(); s.cmpn(1) > 0 && u.cmpn(1) > 0; ) {
        for (var w = 0, h = 1; !(s.words[0] & h) && w < 26; ++w, h <<= 1) ;
        if (w > 0)
          for (s.iushrn(w); w-- > 0; )
            l.isOdd() && l.iadd(m), l.iushrn(1);
        for (var o = 0, c = 1; !(u.words[0] & c) && o < 26; ++o, c <<= 1) ;
        if (o > 0)
          for (u.iushrn(o); o-- > 0; )
            d.isOdd() && d.iadd(m), d.iushrn(1);
        s.cmp(u) >= 0 ? (s.isub(u), l.isub(d)) : (u.isub(s), d.isub(l));
      }
      var T;
      return s.cmpn(1) === 0 ? T = l : T = d, T.cmpn(0) < 0 && T.iadd(r), T;
    }, a.prototype.gcd = function(r) {
      if (this.isZero()) return r.abs();
      if (r.isZero()) return this.abs();
      var s = this.clone(), u = r.clone();
      s.negative = 0, u.negative = 0;
      for (var l = 0; s.isEven() && u.isEven(); l++)
        s.iushrn(1), u.iushrn(1);
      do {
        for (; s.isEven(); )
          s.iushrn(1);
        for (; u.isEven(); )
          u.iushrn(1);
        var d = s.cmp(u);
        if (d < 0) {
          var m = s;
          s = u, u = m;
        } else if (d === 0 || u.cmpn(1) === 0)
          break;
        s.isub(u);
      } while (!0);
      return u.iushln(l);
    }, a.prototype.invm = function(r) {
      return this.egcd(r).a.umod(r);
    }, a.prototype.isEven = function() {
      return (this.words[0] & 1) === 0;
    }, a.prototype.isOdd = function() {
      return (this.words[0] & 1) === 1;
    }, a.prototype.andln = function(r) {
      return this.words[0] & r;
    }, a.prototype.bincn = function(r) {
      n(typeof r == "number");
      var s = r % 26, u = (r - s) / 26, l = 1 << s;
      if (this.length <= u)
        return this._expand(u + 1), this.words[u] |= l, this;
      for (var d = l, m = u; d !== 0 && m < this.length; m++) {
        var w = this.words[m] | 0;
        w += d, d = w >>> 26, w &= 67108863, this.words[m] = w;
      }
      return d !== 0 && (this.words[m] = d, this.length++), this;
    }, a.prototype.isZero = function() {
      return this.length === 1 && this.words[0] === 0;
    }, a.prototype.cmpn = function(r) {
      var s = r < 0;
      if (this.negative !== 0 && !s) return -1;
      if (this.negative === 0 && s) return 1;
      this.strip();
      var u;
      if (this.length > 1)
        u = 1;
      else {
        s && (r = -r), n(r <= 67108863, "Number is too big");
        var l = this.words[0] | 0;
        u = l === r ? 0 : l < r ? -1 : 1;
      }
      return this.negative !== 0 ? -u | 0 : u;
    }, a.prototype.cmp = function(r) {
      if (this.negative !== 0 && r.negative === 0) return -1;
      if (this.negative === 0 && r.negative !== 0) return 1;
      var s = this.ucmp(r);
      return this.negative !== 0 ? -s | 0 : s;
    }, a.prototype.ucmp = function(r) {
      if (this.length > r.length) return 1;
      if (this.length < r.length) return -1;
      for (var s = 0, u = this.length - 1; u >= 0; u--) {
        var l = this.words[u] | 0, d = r.words[u] | 0;
        if (l !== d) {
          l < d ? s = -1 : l > d && (s = 1);
          break;
        }
      }
      return s;
    }, a.prototype.gtn = function(r) {
      return this.cmpn(r) === 1;
    }, a.prototype.gt = function(r) {
      return this.cmp(r) === 1;
    }, a.prototype.gten = function(r) {
      return this.cmpn(r) >= 0;
    }, a.prototype.gte = function(r) {
      return this.cmp(r) >= 0;
    }, a.prototype.ltn = function(r) {
      return this.cmpn(r) === -1;
    }, a.prototype.lt = function(r) {
      return this.cmp(r) === -1;
    }, a.prototype.lten = function(r) {
      return this.cmpn(r) <= 0;
    }, a.prototype.lte = function(r) {
      return this.cmp(r) <= 0;
    }, a.prototype.eqn = function(r) {
      return this.cmpn(r) === 0;
    }, a.prototype.eq = function(r) {
      return this.cmp(r) === 0;
    }, a.red = function(r) {
      return new j(r);
    }, a.prototype.toRed = function(r) {
      return n(!this.red, "Already a number in reduction context"), n(this.negative === 0, "red works only with positives"), r.convertTo(this)._forceRed(r);
    }, a.prototype.fromRed = function() {
      return n(this.red, "fromRed works only with numbers in reduction context"), this.red.convertFrom(this);
    }, a.prototype._forceRed = function(r) {
      return this.red = r, this;
    }, a.prototype.forceRed = function(r) {
      return n(!this.red, "Already a number in reduction context"), this._forceRed(r);
    }, a.prototype.redAdd = function(r) {
      return n(this.red, "redAdd works only with red numbers"), this.red.add(this, r);
    }, a.prototype.redIAdd = function(r) {
      return n(this.red, "redIAdd works only with red numbers"), this.red.iadd(this, r);
    }, a.prototype.redSub = function(r) {
      return n(this.red, "redSub works only with red numbers"), this.red.sub(this, r);
    }, a.prototype.redISub = function(r) {
      return n(this.red, "redISub works only with red numbers"), this.red.isub(this, r);
    }, a.prototype.redShl = function(r) {
      return n(this.red, "redShl works only with red numbers"), this.red.shl(this, r);
    }, a.prototype.redMul = function(r) {
      return n(this.red, "redMul works only with red numbers"), this.red._verify2(this, r), this.red.mul(this, r);
    }, a.prototype.redIMul = function(r) {
      return n(this.red, "redMul works only with red numbers"), this.red._verify2(this, r), this.red.imul(this, r);
    }, a.prototype.redSqr = function() {
      return n(this.red, "redSqr works only with red numbers"), this.red._verify1(this), this.red.sqr(this);
    }, a.prototype.redISqr = function() {
      return n(this.red, "redISqr works only with red numbers"), this.red._verify1(this), this.red.isqr(this);
    }, a.prototype.redSqrt = function() {
      return n(this.red, "redSqrt works only with red numbers"), this.red._verify1(this), this.red.sqrt(this);
    }, a.prototype.redInvm = function() {
      return n(this.red, "redInvm works only with red numbers"), this.red._verify1(this), this.red.invm(this);
    }, a.prototype.redNeg = function() {
      return n(this.red, "redNeg works only with red numbers"), this.red._verify1(this), this.red.neg(this);
    }, a.prototype.redPow = function(r) {
      return n(this.red && !r.red, "redPow(normalNum)"), this.red._verify1(this), this.red.pow(this, r);
    };
    var P = {
      k256: null,
      p224: null,
      p192: null,
      p25519: null
    };
    function R(p, r) {
      this.name = p, this.p = new a(r, 16), this.n = this.p.bitLength(), this.k = new a(1).iushln(this.n).isub(this.p), this.tmp = this._tmp();
    }
    R.prototype._tmp = function() {
      var r = new a(null);
      return r.words = new Array(Math.ceil(this.n / 13)), r;
    }, R.prototype.ireduce = function(r) {
      var s = r, u;
      do
        this.split(s, this.tmp), s = this.imulK(s), s = s.iadd(this.tmp), u = s.bitLength();
      while (u > this.n);
      var l = u < this.n ? -1 : s.ucmp(this.p);
      return l === 0 ? (s.words[0] = 0, s.length = 1) : l > 0 ? s.isub(this.p) : s.strip !== void 0 ? s.strip() : s._strip(), s;
    }, R.prototype.split = function(r, s) {
      r.iushrn(this.n, 0, s);
    }, R.prototype.imulK = function(r) {
      return r.imul(this.k);
    };
    function Se() {
      R.call(
        this,
        "k256",
        "ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe fffffc2f"
      );
    }
    f(Se, R), Se.prototype.split = function(r, s) {
      for (var u = 4194303, l = Math.min(r.length, 9), d = 0; d < l; d++)
        s.words[d] = r.words[d];
      if (s.length = l, r.length <= 9) {
        r.words[0] = 0, r.length = 1;
        return;
      }
      var m = r.words[9];
      for (s.words[s.length++] = m & u, d = 10; d < r.length; d++) {
        var w = r.words[d] | 0;
        r.words[d - 10] = (w & u) << 4 | m >>> 22, m = w;
      }
      m >>>= 22, r.words[d - 10] = m, m === 0 && r.length > 10 ? r.length -= 10 : r.length -= 9;
    }, Se.prototype.imulK = function(r) {
      r.words[r.length] = 0, r.words[r.length + 1] = 0, r.length += 2;
      for (var s = 0, u = 0; u < r.length; u++) {
        var l = r.words[u] | 0;
        s += l * 977, r.words[u] = s & 67108863, s = l * 64 + (s / 67108864 | 0);
      }
      return r.words[r.length - 1] === 0 && (r.length--, r.words[r.length - 1] === 0 && r.length--), r;
    };
    function Pe() {
      R.call(
        this,
        "p224",
        "ffffffff ffffffff ffffffff ffffffff 00000000 00000000 00000001"
      );
    }
    f(Pe, R);
    function Be() {
      R.call(
        this,
        "p192",
        "ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff"
      );
    }
    f(Be, R);
    function $e() {
      R.call(
        this,
        "25519",
        "7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed"
      );
    }
    f($e, R), $e.prototype.imulK = function(r) {
      for (var s = 0, u = 0; u < r.length; u++) {
        var l = (r.words[u] | 0) * 19 + s, d = l & 67108863;
        l >>>= 26, r.words[u] = d, s = l;
      }
      return s !== 0 && (r.words[r.length++] = s), r;
    }, a._prime = function(r) {
      if (P[r]) return P[r];
      var s;
      if (r === "k256")
        s = new Se();
      else if (r === "p224")
        s = new Pe();
      else if (r === "p192")
        s = new Be();
      else if (r === "p25519")
        s = new $e();
      else
        throw new Error("Unknown prime " + r);
      return P[r] = s, s;
    };
    function j(p) {
      if (typeof p == "string") {
        var r = a._prime(p);
        this.m = r.p, this.prime = r;
      } else
        n(p.gtn(1), "modulus must be greater than 1"), this.m = p, this.prime = null;
    }
    j.prototype._verify1 = function(r) {
      n(r.negative === 0, "red works only with positives"), n(r.red, "red works only with red numbers");
    }, j.prototype._verify2 = function(r, s) {
      n((r.negative | s.negative) === 0, "red works only with positives"), n(
        r.red && r.red === s.red,
        "red works only with red numbers"
      );
    }, j.prototype.imod = function(r) {
      return this.prime ? this.prime.ireduce(r)._forceRed(this) : r.umod(this.m)._forceRed(this);
    }, j.prototype.neg = function(r) {
      return r.isZero() ? r.clone() : this.m.sub(r)._forceRed(this);
    }, j.prototype.add = function(r, s) {
      this._verify2(r, s);
      var u = r.add(s);
      return u.cmp(this.m) >= 0 && u.isub(this.m), u._forceRed(this);
    }, j.prototype.iadd = function(r, s) {
      this._verify2(r, s);
      var u = r.iadd(s);
      return u.cmp(this.m) >= 0 && u.isub(this.m), u;
    }, j.prototype.sub = function(r, s) {
      this._verify2(r, s);
      var u = r.sub(s);
      return u.cmpn(0) < 0 && u.iadd(this.m), u._forceRed(this);
    }, j.prototype.isub = function(r, s) {
      this._verify2(r, s);
      var u = r.isub(s);
      return u.cmpn(0) < 0 && u.iadd(this.m), u;
    }, j.prototype.shl = function(r, s) {
      return this._verify1(r), this.imod(r.ushln(s));
    }, j.prototype.imul = function(r, s) {
      return this._verify2(r, s), this.imod(r.imul(s));
    }, j.prototype.mul = function(r, s) {
      return this._verify2(r, s), this.imod(r.mul(s));
    }, j.prototype.isqr = function(r) {
      return this.imul(r, r.clone());
    }, j.prototype.sqr = function(r) {
      return this.mul(r, r);
    }, j.prototype.sqrt = function(r) {
      if (r.isZero()) return r.clone();
      var s = this.m.andln(3);
      if (n(s % 2 === 1), s === 3) {
        var u = this.m.add(new a(1)).iushrn(2);
        return this.pow(r, u);
      }
      for (var l = this.m.subn(1), d = 0; !l.isZero() && l.andln(1) === 0; )
        d++, l.iushrn(1);
      n(!l.isZero());
      var m = new a(1).toRed(this), w = m.redNeg(), h = this.m.subn(1).iushrn(1), o = this.m.bitLength();
      for (o = new a(2 * o * o).toRed(this); this.pow(o, h).cmp(w) !== 0; )
        o.redIAdd(w);
      for (var c = this.pow(o, l), T = this.pow(r, l.addn(1).iushrn(1)), O = this.pow(r, l), k = d; O.cmp(m) !== 0; ) {
        for (var I = O, F = 0; I.cmp(m) !== 0; F++)
          I = I.redSqr();
        n(F < k);
        var q = this.pow(c, new a(1).iushln(k - F - 1));
        T = T.redMul(q), c = q.redSqr(), O = O.redMul(c), k = F;
      }
      return T;
    }, j.prototype.invm = function(r) {
      var s = r._invmp(this.m);
      return s.negative !== 0 ? (s.negative = 0, this.imod(s).redNeg()) : this.imod(s);
    }, j.prototype.pow = function(r, s) {
      if (s.isZero()) return new a(1).toRed(this);
      if (s.cmpn(1) === 0) return r.clone();
      var u = 4, l = new Array(1 << u);
      l[0] = new a(1).toRed(this), l[1] = r;
      for (var d = 2; d < l.length; d++)
        l[d] = this.mul(l[d - 1], r);
      var m = l[0], w = 0, h = 0, o = s.bitLength() % 26;
      for (o === 0 && (o = 26), d = s.length - 1; d >= 0; d--) {
        for (var c = s.words[d], T = o - 1; T >= 0; T--) {
          var O = c >> T & 1;
          if (m !== l[0] && (m = this.sqr(m)), O === 0 && w === 0) {
            h = 0;
            continue;
          }
          w <<= 1, w |= O, h++, !(h !== u && (d !== 0 || T !== 0)) && (m = this.mul(m, l[w]), h = 0, w = 0);
        }
        o = 26;
      }
      return m;
    }, j.prototype.convertTo = function(r) {
      var s = r.umod(this.m);
      return s === r ? s.clone() : s;
    }, j.prototype.convertFrom = function(r) {
      var s = r.clone();
      return s.red = null, s;
    }, a.mont = function(r) {
      return new Ae(r);
    };
    function Ae(p) {
      j.call(this, p), this.shift = this.m.bitLength(), this.shift % 26 !== 0 && (this.shift += 26 - this.shift % 26), this.r = new a(1).iushln(this.shift), this.r2 = this.imod(this.r.sqr()), this.rinv = this.r._invmp(this.m), this.minv = this.rinv.mul(this.r).isubn(1).div(this.m), this.minv = this.minv.umod(this.r), this.minv = this.r.sub(this.minv);
    }
    f(Ae, j), Ae.prototype.convertTo = function(r) {
      return this.imod(r.ushln(this.shift));
    }, Ae.prototype.convertFrom = function(r) {
      var s = this.imod(r.mul(this.rinv));
      return s.red = null, s;
    }, Ae.prototype.imul = function(r, s) {
      if (r.isZero() || s.isZero())
        return r.words[0] = 0, r.length = 1, r;
      var u = r.imul(s), l = u.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m), d = u.isub(l).iushrn(this.shift), m = d;
      return d.cmp(this.m) >= 0 ? m = d.isub(this.m) : d.cmpn(0) < 0 && (m = d.iadd(this.m)), m._forceRed(this);
    }, Ae.prototype.mul = function(r, s) {
      if (r.isZero() || s.isZero()) return new a(0)._forceRed(this);
      var u = r.mul(s), l = u.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m), d = u.isub(l).iushrn(this.shift), m = d;
      return d.cmp(this.m) >= 0 ? m = d.isub(this.m) : d.cmpn(0) < 0 && (m = d.iadd(this.m)), m._forceRed(this);
    }, Ae.prototype.invm = function(r) {
      var s = this.imod(r._invmp(this.m).mul(this.r2));
      return s._forceRed(this);
    };
  })(t, K);
})(Ar);
var Vn = Ar.exports, zn = {}, Tr = {}, wr = { exports: {} }, xt = { exports: {} }, hn;
function ao() {
  return hn || (hn = 1, typeof Object.create == "function" ? xt.exports = function(e, i) {
    i && (e.super_ = i, e.prototype = Object.create(i.prototype, {
      constructor: {
        value: e,
        enumerable: !1,
        writable: !0,
        configurable: !0
      }
    }));
  } : xt.exports = function(e, i) {
    if (i) {
      e.super_ = i;
      var n = function() {
      };
      n.prototype = i.prototype, e.prototype = new n(), e.prototype.constructor = e;
    }
  }), xt.exports;
}
try {
  var cn = require("util");
  if (typeof cn.inherits != "function") throw "";
  wr.exports = cn.inherits;
} catch {
  wr.exports = ao();
}
var Xe = wr.exports, Tt = mt, it = Tt.Buffer, Re = {}, De;
for (De in Tt)
  Tt.hasOwnProperty(De) && (De === "SlowBuffer" || De === "Buffer" || (Re[De] = Tt[De]));
var ot = Re.Buffer = {};
for (De in it)
  it.hasOwnProperty(De) && (De === "allocUnsafe" || De === "allocUnsafeSlow" || (ot[De] = it[De]));
Re.Buffer.prototype = it.prototype;
(!ot.from || ot.from === Uint8Array.from) && (ot.from = function(t, e, i) {
  if (typeof t == "number")
    throw new TypeError('The "value" argument must not be of type number. Received type ' + typeof t);
  if (t && typeof t.length > "u")
    throw new TypeError("The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof t);
  return it(t, e, i);
});
ot.alloc || (ot.alloc = function(t, e, i) {
  if (typeof t != "number")
    throw new TypeError('The "size" argument must be of type number. Received type ' + typeof t);
  if (t < 0 || t >= 2 * (1 << 30))
    throw new RangeError('The value "' + t + '" is invalid for option "size"');
  var n = it(t);
  return !e || e.length === 0 ? n.fill(0) : typeof i == "string" ? n.fill(e, i) : n.fill(e), n;
});
if (!Re.kStringMaxLength)
  try {
    Re.kStringMaxLength = process.binding("buffer").kStringMaxLength;
  } catch {
  }
Re.constants || (Re.constants = {
  MAX_LENGTH: Re.kMaxLength
}, Re.kStringMaxLength && (Re.constants.MAX_STRING_LENGTH = Re.kStringMaxLength));
var Or = Re, Nt = {};
const fo = Xe;
function Le(t) {
  this._reporterState = {
    obj: null,
    path: [],
    options: t || {},
    errors: []
  };
}
Nt.Reporter = Le;
Le.prototype.isError = function(e) {
  return e instanceof st;
};
Le.prototype.save = function() {
  const e = this._reporterState;
  return { obj: e.obj, pathLen: e.path.length };
};
Le.prototype.restore = function(e) {
  const i = this._reporterState;
  i.obj = e.obj, i.path = i.path.slice(0, e.pathLen);
};
Le.prototype.enterKey = function(e) {
  return this._reporterState.path.push(e);
};
Le.prototype.exitKey = function(e) {
  const i = this._reporterState;
  i.path = i.path.slice(0, e - 1);
};
Le.prototype.leaveKey = function(e, i, n) {
  const f = this._reporterState;
  this.exitKey(e), f.obj !== null && (f.obj[i] = n);
};
Le.prototype.path = function() {
  return this._reporterState.path.join("/");
};
Le.prototype.enterObject = function() {
  const e = this._reporterState, i = e.obj;
  return e.obj = {}, i;
};
Le.prototype.leaveObject = function(e) {
  const i = this._reporterState, n = i.obj;
  return i.obj = e, n;
};
Le.prototype.error = function(e) {
  let i;
  const n = this._reporterState, f = e instanceof st;
  if (f ? i = e : i = new st(n.path.map(function(a) {
    return "[" + JSON.stringify(a) + "]";
  }).join(""), e.message || e, e.stack), !n.options.partial)
    throw i;
  return f || n.errors.push(i), i;
};
Le.prototype.wrapResult = function(e) {
  const i = this._reporterState;
  return i.options.partial ? {
    result: this.isError(e) ? null : e,
    errors: i.errors
  } : e;
};
function st(t, e) {
  this.path = t, this.rethrow(e);
}
fo(st, Error);
st.prototype.rethrow = function(e) {
  if (this.message = e + " at: " + (this.path || "(shallow)"), Error.captureStackTrace && Error.captureStackTrace(this, st), !this.stack)
    try {
      throw new Error(this.message);
    } catch (i) {
      this.stack = i.stack;
    }
  return this;
};
var Ye = {};
const uo = Xe, jt = Nt.Reporter, at = Or.Buffer;
function Fe(t, e) {
  if (jt.call(this, e), !at.isBuffer(t)) {
    this.error("Input not Buffer");
    return;
  }
  this.base = t, this.offset = 0, this.length = t.length;
}
uo(Fe, jt);
Ye.DecoderBuffer = Fe;
Fe.isDecoderBuffer = function(e) {
  return e instanceof Fe ? !0 : typeof e == "object" && at.isBuffer(e.base) && e.constructor.name === "DecoderBuffer" && typeof e.offset == "number" && typeof e.length == "number" && typeof e.save == "function" && typeof e.restore == "function" && typeof e.isEmpty == "function" && typeof e.readUInt8 == "function" && typeof e.skip == "function" && typeof e.raw == "function";
};
Fe.prototype.save = function() {
  return { offset: this.offset, reporter: jt.prototype.save.call(this) };
};
Fe.prototype.restore = function(e) {
  const i = new Fe(this.base);
  return i.offset = e.offset, i.length = this.offset, this.offset = e.offset, jt.prototype.restore.call(this, e.reporter), i;
};
Fe.prototype.isEmpty = function() {
  return this.offset === this.length;
};
Fe.prototype.readUInt8 = function(e) {
  return this.offset + 1 <= this.length ? this.base.readUInt8(this.offset++, !0) : this.error(e || "DecoderBuffer overrun");
};
Fe.prototype.skip = function(e, i) {
  if (!(this.offset + e <= this.length))
    return this.error(i || "DecoderBuffer overrun");
  const n = new Fe(this.base);
  return n._reporterState = this._reporterState, n.offset = this.offset, n.length = this.offset + e, this.offset += e, n;
};
Fe.prototype.raw = function(e) {
  return this.base.slice(e ? e.offset : this.offset, this.length);
};
function ft(t, e) {
  if (Array.isArray(t))
    this.length = 0, this.value = t.map(function(i) {
      return ft.isEncoderBuffer(i) || (i = new ft(i, e)), this.length += i.length, i;
    }, this);
  else if (typeof t == "number") {
    if (!(0 <= t && t <= 255))
      return e.error("non-byte EncoderBuffer value");
    this.value = t, this.length = 1;
  } else if (typeof t == "string")
    this.value = t, this.length = at.byteLength(t);
  else if (at.isBuffer(t))
    this.value = t, this.length = t.length;
  else
    return e.error("Unsupported type: " + typeof t);
}
Ye.EncoderBuffer = ft;
ft.isEncoderBuffer = function(e) {
  return e instanceof ft ? !0 : typeof e == "object" && e.constructor.name === "EncoderBuffer" && typeof e.length == "number" && typeof e.join == "function";
};
ft.prototype.join = function(e, i) {
  return e || (e = at.alloc(this.length)), i || (i = 0), this.length === 0 || (Array.isArray(this.value) ? this.value.forEach(function(n) {
    n.join(e, i), i += n.length;
  }) : (typeof this.value == "number" ? e[i] = this.value : typeof this.value == "string" ? e.write(this.value, i) : at.isBuffer(this.value) && this.value.copy(e, i), i += this.length)), e;
};
var lo = Wn;
function Wn(t, e) {
  if (!t)
    throw new Error(e || "Assertion failed");
}
Wn.equal = function(e, i, n) {
  if (e != i)
    throw new Error(n || "Assertion failed: " + e + " != " + i);
};
const ho = Nt.Reporter, co = Ye.EncoderBuffer, po = Ye.DecoderBuffer, Te = lo, Zn = [
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
], vo = [
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
].concat(Zn), go = [
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
function $(t, e, i) {
  const n = {};
  this._baseState = n, n.name = i, n.enc = t, n.parent = e || null, n.children = null, n.tag = null, n.args = null, n.reverseArgs = null, n.choice = null, n.optional = !1, n.any = !1, n.obj = !1, n.use = null, n.useDecoder = null, n.key = null, n.default = null, n.explicit = null, n.implicit = null, n.contains = null, n.parent || (n.children = [], this._wrap());
}
var kr = $;
const mo = [
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
$.prototype.clone = function() {
  const e = this._baseState, i = {};
  mo.forEach(function(f) {
    i[f] = e[f];
  });
  const n = new this.constructor(i.parent);
  return n._baseState = i, n;
};
$.prototype._wrap = function() {
  const e = this._baseState;
  vo.forEach(function(i) {
    this[i] = function() {
      const f = new this.constructor(this);
      return e.children.push(f), f[i].apply(f, arguments);
    };
  }, this);
};
$.prototype._init = function(e) {
  const i = this._baseState;
  Te(i.parent === null), e.call(this), i.children = i.children.filter(function(n) {
    return n._baseState.parent === this;
  }, this), Te.equal(i.children.length, 1, "Root node can have only one child");
};
$.prototype._useArgs = function(e) {
  const i = this._baseState, n = e.filter(function(f) {
    return f instanceof this.constructor;
  }, this);
  e = e.filter(function(f) {
    return !(f instanceof this.constructor);
  }, this), n.length !== 0 && (Te(i.children === null), i.children = n, n.forEach(function(f) {
    f._baseState.parent = this;
  }, this)), e.length !== 0 && (Te(i.args === null), i.args = e, i.reverseArgs = e.map(function(f) {
    if (typeof f != "object" || f.constructor !== Object)
      return f;
    const a = {};
    return Object.keys(f).forEach(function(v) {
      v == (v | 0) && (v |= 0);
      const b = f[v];
      a[b] = v;
    }), a;
  }));
};
go.forEach(function(t) {
  $.prototype[t] = function() {
    const i = this._baseState;
    throw new Error(t + " not implemented for encoding: " + i.enc);
  };
});
Zn.forEach(function(t) {
  $.prototype[t] = function() {
    const i = this._baseState, n = Array.prototype.slice.call(arguments);
    return Te(i.tag === null), i.tag = t, this._useArgs(n), this;
  };
});
$.prototype.use = function(e) {
  Te(e);
  const i = this._baseState;
  return Te(i.use === null), i.use = e, this;
};
$.prototype.optional = function() {
  const e = this._baseState;
  return e.optional = !0, this;
};
$.prototype.def = function(e) {
  const i = this._baseState;
  return Te(i.default === null), i.default = e, i.optional = !0, this;
};
$.prototype.explicit = function(e) {
  const i = this._baseState;
  return Te(i.explicit === null && i.implicit === null), i.explicit = e, this;
};
$.prototype.implicit = function(e) {
  const i = this._baseState;
  return Te(i.explicit === null && i.implicit === null), i.implicit = e, this;
};
$.prototype.obj = function() {
  const e = this._baseState, i = Array.prototype.slice.call(arguments);
  return e.obj = !0, i.length !== 0 && this._useArgs(i), this;
};
$.prototype.key = function(e) {
  const i = this._baseState;
  return Te(i.key === null), i.key = e, this;
};
$.prototype.any = function() {
  const e = this._baseState;
  return e.any = !0, this;
};
$.prototype.choice = function(e) {
  const i = this._baseState;
  return Te(i.choice === null), i.choice = e, this._useArgs(Object.keys(e).map(function(n) {
    return e[n];
  })), this;
};
$.prototype.contains = function(e) {
  const i = this._baseState;
  return Te(i.use === null), i.contains = e, this;
};
$.prototype._decode = function(e, i) {
  const n = this._baseState;
  if (n.parent === null)
    return e.wrapResult(n.children[0]._decode(e, i));
  let f = n.default, a = !0, v = null;
  if (n.key !== null && (v = e.enterKey(n.key)), n.optional) {
    let g = null;
    if (n.explicit !== null ? g = n.explicit : n.implicit !== null ? g = n.implicit : n.tag !== null && (g = n.tag), g === null && !n.any) {
      const E = e.save();
      try {
        n.choice === null ? this._decodeGeneric(n.tag, e, i) : this._decodeChoice(e, i), a = !0;
      } catch {
        a = !1;
      }
      e.restore(E);
    } else if (a = this._peekTag(e, g, n.any), e.isError(a))
      return a;
  }
  let b;
  if (n.obj && a && (b = e.enterObject()), a) {
    if (n.explicit !== null) {
      const E = this._decodeTag(e, n.explicit);
      if (e.isError(E))
        return E;
      e = E;
    }
    const g = e.offset;
    if (n.use === null && n.choice === null) {
      let E;
      n.any && (E = e.save());
      const M = this._decodeTag(
        e,
        n.implicit !== null ? n.implicit : n.tag,
        n.any
      );
      if (e.isError(M))
        return M;
      n.any ? f = e.raw(E) : e = M;
    }
    if (i && i.track && n.tag !== null && i.track(e.path(), g, e.length, "tagged"), i && i.track && n.tag !== null && i.track(e.path(), e.offset, e.length, "content"), n.any || (n.choice === null ? f = this._decodeGeneric(n.tag, e, i) : f = this._decodeChoice(e, i)), e.isError(f))
      return f;
    if (!n.any && n.choice === null && n.children !== null && n.children.forEach(function(M) {
      M._decode(e, i);
    }), n.contains && (n.tag === "octstr" || n.tag === "bitstr")) {
      const E = new po(f);
      f = this._getUse(n.contains, e._reporterState.obj)._decode(E, i);
    }
  }
  return n.obj && a && (f = e.leaveObject(b)), n.key !== null && (f !== null || a === !0) ? e.leaveKey(v, n.key, f) : v !== null && e.exitKey(v), f;
};
$.prototype._decodeGeneric = function(e, i, n) {
  const f = this._baseState;
  return e === "seq" || e === "set" ? null : e === "seqof" || e === "setof" ? this._decodeList(i, e, f.args[0], n) : /str$/.test(e) ? this._decodeStr(i, e, n) : e === "objid" && f.args ? this._decodeObjid(i, f.args[0], f.args[1], n) : e === "objid" ? this._decodeObjid(i, null, null, n) : e === "gentime" || e === "utctime" ? this._decodeTime(i, e, n) : e === "null_" ? this._decodeNull(i, n) : e === "bool" ? this._decodeBool(i, n) : e === "objDesc" ? this._decodeStr(i, e, n) : e === "int" || e === "enum" ? this._decodeInt(i, f.args && f.args[0], n) : f.use !== null ? this._getUse(f.use, i._reporterState.obj)._decode(i, n) : i.error("unknown tag: " + e);
};
$.prototype._getUse = function(e, i) {
  const n = this._baseState;
  return n.useDecoder = this._use(e, i), Te(n.useDecoder._baseState.parent === null), n.useDecoder = n.useDecoder._baseState.children[0], n.implicit !== n.useDecoder._baseState.implicit && (n.useDecoder = n.useDecoder.clone(), n.useDecoder._baseState.implicit = n.implicit), n.useDecoder;
};
$.prototype._decodeChoice = function(e, i) {
  const n = this._baseState;
  let f = null, a = !1;
  return Object.keys(n.choice).some(function(v) {
    const b = e.save(), g = n.choice[v];
    try {
      const E = g._decode(e, i);
      if (e.isError(E))
        return !1;
      f = { type: v, value: E }, a = !0;
    } catch {
      return e.restore(b), !1;
    }
    return !0;
  }, this), a ? f : e.error("Choice not matched");
};
$.prototype._createEncoderBuffer = function(e) {
  return new co(e, this.reporter);
};
$.prototype._encode = function(e, i, n) {
  const f = this._baseState;
  if (f.default !== null && f.default === e)
    return;
  const a = this._encodeValue(e, i, n);
  if (a !== void 0 && !this._skipDefault(a, i, n))
    return a;
};
$.prototype._encodeValue = function(e, i, n) {
  const f = this._baseState;
  if (f.parent === null)
    return f.children[0]._encode(e, i || new ho());
  let a = null;
  if (this.reporter = i, f.optional && e === void 0)
    if (f.default !== null)
      e = f.default;
    else
      return;
  let v = null, b = !1;
  if (f.any)
    a = this._createEncoderBuffer(e);
  else if (f.choice)
    a = this._encodeChoice(e, i);
  else if (f.contains)
    v = this._getUse(f.contains, n)._encode(e, i), b = !0;
  else if (f.children)
    v = f.children.map(function(g) {
      if (g._baseState.tag === "null_")
        return g._encode(null, i, e);
      if (g._baseState.key === null)
        return i.error("Child should have a key");
      const E = i.enterKey(g._baseState.key);
      if (typeof e != "object")
        return i.error("Child expected, but input is not object");
      const M = g._encode(e[g._baseState.key], i, e);
      return i.leaveKey(E), M;
    }, this).filter(function(g) {
      return g;
    }), v = this._createEncoderBuffer(v);
  else if (f.tag === "seqof" || f.tag === "setof") {
    if (!(f.args && f.args.length === 1))
      return i.error("Too many args for : " + f.tag);
    if (!Array.isArray(e))
      return i.error("seqof/setof, but data is not Array");
    const g = this.clone();
    g._baseState.implicit = null, v = this._createEncoderBuffer(e.map(function(E) {
      const M = this._baseState;
      return this._getUse(M.args[0], e)._encode(E, i);
    }, g));
  } else f.use !== null ? a = this._getUse(f.use, n)._encode(e, i) : (v = this._encodePrimitive(f.tag, e), b = !0);
  if (!f.any && f.choice === null) {
    const g = f.implicit !== null ? f.implicit : f.tag, E = f.implicit === null ? "universal" : "context";
    g === null ? f.use === null && i.error("Tag could be omitted only for .use()") : f.use === null && (a = this._encodeComposite(g, b, E, v));
  }
  return f.explicit !== null && (a = this._encodeComposite(f.explicit, !1, "context", a)), a;
};
$.prototype._encodeChoice = function(e, i) {
  const n = this._baseState, f = n.choice[e.type];
  return f || Te(
    !1,
    e.type + " not found in " + JSON.stringify(Object.keys(n.choice))
  ), f._encode(e.value, i);
};
$.prototype._encodePrimitive = function(e, i) {
  const n = this._baseState;
  if (/str$/.test(e))
    return this._encodeStr(i, e);
  if (e === "objid" && n.args)
    return this._encodeObjid(i, n.reverseArgs[0], n.args[1]);
  if (e === "objid")
    return this._encodeObjid(i, null, null);
  if (e === "gentime" || e === "utctime")
    return this._encodeTime(i, e);
  if (e === "null_")
    return this._encodeNull();
  if (e === "int" || e === "enum")
    return this._encodeInt(i, n.args && n.reverseArgs[0]);
  if (e === "bool")
    return this._encodeBool(i);
  if (e === "objDesc")
    return this._encodeStr(i, e);
  throw new Error("Unsupported tag: " + e);
};
$.prototype._isNumstr = function(e) {
  return /^[0-9 ]*$/.test(e);
};
$.prototype._isPrintstr = function(e) {
  return /^[A-Za-z0-9 '()+,-./:=?]*$/.test(e);
};
var Ft = {};
(function(t) {
  function e(i) {
    const n = {};
    return Object.keys(i).forEach(function(f) {
      (f | 0) == f && (f = f | 0);
      const a = i[f];
      n[a] = f;
    }), n;
  }
  t.tagClass = {
    0: "universal",
    1: "application",
    2: "context",
    3: "private"
  }, t.tagClassByName = e(t.tagClass), t.tag = {
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
  }, t.tagByName = e(t.tag);
})(Ft);
const yo = Xe, ze = Or.Buffer, Jn = kr, lr = Ft;
function Yn(t) {
  this.enc = "der", this.name = t.name, this.entity = t, this.tree = new Ue(), this.tree._init(t.body);
}
var Qn = Yn;
Yn.prototype.encode = function(e, i) {
  return this.tree._encode(e, i).join();
};
function Ue(t) {
  Jn.call(this, "der", t);
}
yo(Ue, Jn);
Ue.prototype._encodeComposite = function(e, i, n, f) {
  const a = wo(e, i, n, this.reporter);
  if (f.length < 128) {
    const g = ze.alloc(2);
    return g[0] = a, g[1] = f.length, this._createEncoderBuffer([g, f]);
  }
  let v = 1;
  for (let g = f.length; g >= 256; g >>= 8)
    v++;
  const b = ze.alloc(2 + v);
  b[0] = a, b[1] = 128 | v;
  for (let g = 1 + v, E = f.length; E > 0; g--, E >>= 8)
    b[g] = E & 255;
  return this._createEncoderBuffer([b, f]);
};
Ue.prototype._encodeStr = function(e, i) {
  if (i === "bitstr")
    return this._createEncoderBuffer([e.unused | 0, e.data]);
  if (i === "bmpstr") {
    const n = ze.alloc(e.length * 2);
    for (let f = 0; f < e.length; f++)
      n.writeUInt16BE(e.charCodeAt(f), f * 2);
    return this._createEncoderBuffer(n);
  } else return i === "numstr" ? this._isNumstr(e) ? this._createEncoderBuffer(e) : this.reporter.error("Encoding of string type: numstr supports only digits and space") : i === "printstr" ? this._isPrintstr(e) ? this._createEncoderBuffer(e) : this.reporter.error("Encoding of string type: printstr supports only latin upper and lower case letters, digits, space, apostrophe, left and rigth parenthesis, plus sign, comma, hyphen, dot, slash, colon, equal sign, question mark") : /str$/.test(i) ? this._createEncoderBuffer(e) : i === "objDesc" ? this._createEncoderBuffer(e) : this.reporter.error("Encoding of string type: " + i + " unsupported");
};
Ue.prototype._encodeObjid = function(e, i, n) {
  if (typeof e == "string") {
    if (!i)
      return this.reporter.error("string objid given, but no values map found");
    if (!i.hasOwnProperty(e))
      return this.reporter.error("objid not found in values map");
    e = i[e].split(/[\s.]+/g);
    for (let b = 0; b < e.length; b++)
      e[b] |= 0;
  } else if (Array.isArray(e)) {
    e = e.slice();
    for (let b = 0; b < e.length; b++)
      e[b] |= 0;
  }
  if (!Array.isArray(e))
    return this.reporter.error("objid() should be either array or string, got: " + JSON.stringify(e));
  if (!n) {
    if (e[1] >= 40)
      return this.reporter.error("Second objid identifier OOB");
    e.splice(0, 2, e[0] * 40 + e[1]);
  }
  let f = 0;
  for (let b = 0; b < e.length; b++) {
    let g = e[b];
    for (f++; g >= 128; g >>= 7)
      f++;
  }
  const a = ze.alloc(f);
  let v = a.length - 1;
  for (let b = e.length - 1; b >= 0; b--) {
    let g = e[b];
    for (a[v--] = g & 127; (g >>= 7) > 0; )
      a[v--] = 128 | g & 127;
  }
  return this._createEncoderBuffer(a);
};
function Ie(t) {
  return t < 10 ? "0" + t : t;
}
Ue.prototype._encodeTime = function(e, i) {
  let n;
  const f = new Date(e);
  return i === "gentime" ? n = [
    Ie(f.getUTCFullYear()),
    Ie(f.getUTCMonth() + 1),
    Ie(f.getUTCDate()),
    Ie(f.getUTCHours()),
    Ie(f.getUTCMinutes()),
    Ie(f.getUTCSeconds()),
    "Z"
  ].join("") : i === "utctime" ? n = [
    Ie(f.getUTCFullYear() % 100),
    Ie(f.getUTCMonth() + 1),
    Ie(f.getUTCDate()),
    Ie(f.getUTCHours()),
    Ie(f.getUTCMinutes()),
    Ie(f.getUTCSeconds()),
    "Z"
  ].join("") : this.reporter.error("Encoding " + i + " time is not supported yet"), this._encodeStr(n, "octstr");
};
Ue.prototype._encodeNull = function() {
  return this._createEncoderBuffer("");
};
Ue.prototype._encodeInt = function(e, i) {
  if (typeof e == "string") {
    if (!i)
      return this.reporter.error("String int or enum given, but no values map");
    if (!i.hasOwnProperty(e))
      return this.reporter.error("Values map doesn't contain: " + JSON.stringify(e));
    e = i[e];
  }
  if (typeof e != "number" && !ze.isBuffer(e)) {
    const a = e.toArray();
    !e.sign && a[0] & 128 && a.unshift(0), e = ze.from(a);
  }
  if (ze.isBuffer(e)) {
    let a = e.length;
    e.length === 0 && a++;
    const v = ze.alloc(a);
    return e.copy(v), e.length === 0 && (v[0] = 0), this._createEncoderBuffer(v);
  }
  if (e < 128)
    return this._createEncoderBuffer(e);
  if (e < 256)
    return this._createEncoderBuffer([0, e]);
  let n = 1;
  for (let a = e; a >= 256; a >>= 8)
    n++;
  const f = new Array(n);
  for (let a = f.length - 1; a >= 0; a--)
    f[a] = e & 255, e >>= 8;
  return f[0] & 128 && f.unshift(0), this._createEncoderBuffer(ze.from(f));
};
Ue.prototype._encodeBool = function(e) {
  return this._createEncoderBuffer(e ? 255 : 0);
};
Ue.prototype._use = function(e, i) {
  return typeof e == "function" && (e = e(i)), e._getEncoder("der").tree;
};
Ue.prototype._skipDefault = function(e, i, n) {
  const f = this._baseState;
  let a;
  if (f.default === null)
    return !1;
  const v = e.join();
  if (f.defaultBuffer === void 0 && (f.defaultBuffer = this._encodeValue(f.default, i, n).join()), v.length !== f.defaultBuffer.length)
    return !1;
  for (a = 0; a < v.length; a++)
    if (v[a] !== f.defaultBuffer[a])
      return !1;
  return !0;
};
function wo(t, e, i, n) {
  let f;
  if (t === "seqof" ? t = "seq" : t === "setof" && (t = "set"), lr.tagByName.hasOwnProperty(t))
    f = lr.tagByName[t];
  else if (typeof t == "number" && (t | 0) === t)
    f = t;
  else
    return n.error("Unknown tag: " + t);
  return f >= 31 ? n.error("Multi-octet tag encoding unsupported") : (e || (f |= 32), f |= lr.tagClassByName[i || "universal"] << 6, f);
}
const bo = Xe, Pr = Qn;
function Ir(t) {
  Pr.call(this, t), this.enc = "pem";
}
bo(Ir, Pr);
var Mo = Ir;
Ir.prototype.encode = function(e, i) {
  const f = Pr.prototype.encode.call(this, e).toString("base64"), a = ["-----BEGIN " + i.label + "-----"];
  for (let v = 0; v < f.length; v += 64)
    a.push(f.slice(v, v + 64));
  return a.push("-----END " + i.label + "-----"), a.join(`
`);
};
(function(t) {
  const e = t;
  e.der = Qn, e.pem = Mo;
})(Tr);
var Rr = {};
const _o = Xe, Eo = Vn, dn = Ye.DecoderBuffer, Xn = kr, pn = Ft;
function ei(t) {
  this.enc = "der", this.name = t.name, this.entity = t, this.tree = new ke(), this.tree._init(t.body);
}
var ti = ei;
ei.prototype.decode = function(e, i) {
  return dn.isDecoderBuffer(e) || (e = new dn(e, i)), this.tree._decode(e, i);
};
function ke(t) {
  Xn.call(this, "der", t);
}
_o(ke, Xn);
ke.prototype._peekTag = function(e, i, n) {
  if (e.isEmpty())
    return !1;
  const f = e.save(), a = Dr(e, 'Failed to peek tag: "' + i + '"');
  return e.isError(a) ? a : (e.restore(f), a.tag === i || a.tagStr === i || a.tagStr + "of" === i || n);
};
ke.prototype._decodeTag = function(e, i, n) {
  const f = Dr(
    e,
    'Failed to decode tag of "' + i + '"'
  );
  if (e.isError(f))
    return f;
  let a = ri(
    e,
    f.primitive,
    'Failed to get length of "' + i + '"'
  );
  if (e.isError(a))
    return a;
  if (!n && f.tag !== i && f.tagStr !== i && f.tagStr + "of" !== i)
    return e.error('Failed to match tag: "' + i + '"');
  if (f.primitive || a !== null)
    return e.skip(a, 'Failed to match body of: "' + i + '"');
  const v = e.save(), b = this._skipUntilEnd(
    e,
    'Failed to skip indefinite length body: "' + this.tag + '"'
  );
  return e.isError(b) ? b : (a = e.offset - v.offset, e.restore(v), e.skip(a, 'Failed to match body of: "' + i + '"'));
};
ke.prototype._skipUntilEnd = function(e, i) {
  for (; ; ) {
    const n = Dr(e, i);
    if (e.isError(n))
      return n;
    const f = ri(e, n.primitive, i);
    if (e.isError(f))
      return f;
    let a;
    if (n.primitive || f !== null ? a = e.skip(f) : a = this._skipUntilEnd(e, i), e.isError(a))
      return a;
    if (n.tagStr === "end")
      break;
  }
};
ke.prototype._decodeList = function(e, i, n, f) {
  const a = [];
  for (; !e.isEmpty(); ) {
    const v = this._peekTag(e, "end");
    if (e.isError(v))
      return v;
    const b = n.decode(e, "der", f);
    if (e.isError(b) && v)
      break;
    a.push(b);
  }
  return a;
};
ke.prototype._decodeStr = function(e, i) {
  if (i === "bitstr") {
    const n = e.readUInt8();
    return e.isError(n) ? n : { unused: n, data: e.raw() };
  } else if (i === "bmpstr") {
    const n = e.raw();
    if (n.length % 2 === 1)
      return e.error("Decoding of string type: bmpstr length mismatch");
    let f = "";
    for (let a = 0; a < n.length / 2; a++)
      f += String.fromCharCode(n.readUInt16BE(a * 2));
    return f;
  } else if (i === "numstr") {
    const n = e.raw().toString("ascii");
    return this._isNumstr(n) ? n : e.error("Decoding of string type: numstr unsupported characters");
  } else {
    if (i === "octstr")
      return e.raw();
    if (i === "objDesc")
      return e.raw();
    if (i === "printstr") {
      const n = e.raw().toString("ascii");
      return this._isPrintstr(n) ? n : e.error("Decoding of string type: printstr unsupported characters");
    } else return /str$/.test(i) ? e.raw().toString() : e.error("Decoding of string type: " + i + " unsupported");
  }
};
ke.prototype._decodeObjid = function(e, i, n) {
  let f;
  const a = [];
  let v = 0, b = 0;
  for (; !e.isEmpty(); )
    b = e.readUInt8(), v <<= 7, v |= b & 127, b & 128 || (a.push(v), v = 0);
  b & 128 && a.push(v);
  const g = a[0] / 40 | 0, E = a[0] % 40;
  if (n ? f = a : f = [g, E].concat(a.slice(1)), i) {
    let M = i[f.join(" ")];
    M === void 0 && (M = i[f.join(".")]), M !== void 0 && (f = M);
  }
  return f;
};
ke.prototype._decodeTime = function(e, i) {
  const n = e.raw().toString();
  let f, a, v, b, g, E;
  if (i === "gentime")
    f = n.slice(0, 4) | 0, a = n.slice(4, 6) | 0, v = n.slice(6, 8) | 0, b = n.slice(8, 10) | 0, g = n.slice(10, 12) | 0, E = n.slice(12, 14) | 0;
  else if (i === "utctime")
    f = n.slice(0, 2) | 0, a = n.slice(2, 4) | 0, v = n.slice(4, 6) | 0, b = n.slice(6, 8) | 0, g = n.slice(8, 10) | 0, E = n.slice(10, 12) | 0, f < 70 ? f = 2e3 + f : f = 1900 + f;
  else
    return e.error("Decoding " + i + " time is not supported yet");
  return Date.UTC(f, a - 1, v, b, g, E, 0);
};
ke.prototype._decodeNull = function() {
  return null;
};
ke.prototype._decodeBool = function(e) {
  const i = e.readUInt8();
  return e.isError(i) ? i : i !== 0;
};
ke.prototype._decodeInt = function(e, i) {
  const n = e.raw();
  let f = new Eo(n);
  return i && (f = i[f.toString(10)] || f), f;
};
ke.prototype._use = function(e, i) {
  return typeof e == "function" && (e = e(i)), e._getDecoder("der").tree;
};
function Dr(t, e) {
  let i = t.readUInt8(e);
  if (t.isError(i))
    return i;
  const n = pn.tagClass[i >> 6], f = (i & 32) === 0;
  if ((i & 31) === 31) {
    let v = i;
    for (i = 0; (v & 128) === 128; ) {
      if (v = t.readUInt8(e), t.isError(v))
        return v;
      i <<= 7, i |= v & 127;
    }
  } else
    i &= 31;
  const a = pn.tag[i];
  return {
    cls: n,
    primitive: f,
    tag: i,
    tagStr: a
  };
}
function ri(t, e, i) {
  let n = t.readUInt8(i);
  if (t.isError(n))
    return n;
  if (!e && n === 128)
    return null;
  if (!(n & 128))
    return n;
  const f = n & 127;
  if (f > 4)
    return t.error("length octect is too long");
  n = 0;
  for (let a = 0; a < f; a++) {
    n <<= 8;
    const v = t.readUInt8(i);
    if (t.isError(v))
      return v;
    n |= v;
  }
  return n;
}
const xo = Xe, So = Or.Buffer, Nr = ti;
function jr(t) {
  Nr.call(this, t), this.enc = "pem";
}
xo(jr, Nr);
var Co = jr;
jr.prototype.decode = function(e, i) {
  const n = e.toString().split(/[\r\n]+/g), f = i.label.toUpperCase(), a = /^-----(BEGIN|END) ([^-]+)-----$/;
  let v = -1, b = -1;
  for (let M = 0; M < n.length; M++) {
    const y = n[M].match(a);
    if (y !== null && y[2] === f)
      if (v === -1) {
        if (y[1] !== "BEGIN")
          break;
        v = M;
      } else {
        if (y[1] !== "END")
          break;
        b = M;
        break;
      }
  }
  if (v === -1 || b === -1)
    throw new Error("PEM section not found for: " + f);
  const g = n.slice(v + 1, b).join("");
  g.replace(/[^a-z0-9+/=]+/gi, "");
  const E = So.from(g, "base64");
  return Nr.prototype.decode.call(this, E, i);
};
(function(t) {
  const e = t;
  e.der = ti, e.pem = Co;
})(Rr);
(function(t) {
  const e = Tr, i = Rr, n = Xe, f = t;
  f.define = function(b, g) {
    return new a(b, g);
  };
  function a(v, b) {
    this.name = v, this.body = b, this.decoders = {}, this.encoders = {};
  }
  a.prototype._createNamed = function(b) {
    const g = this.name;
    function E(M) {
      this._initNamed(M, g);
    }
    return n(E, b), E.prototype._initNamed = function(y, _) {
      b.call(this, y, _);
    }, new E(this);
  }, a.prototype._getDecoder = function(b) {
    return b = b || "der", this.decoders.hasOwnProperty(b) || (this.decoders[b] = this._createNamed(i[b])), this.decoders[b];
  }, a.prototype.decode = function(b, g, E) {
    return this._getDecoder(g).decode(b, E);
  }, a.prototype._getEncoder = function(b) {
    return b = b || "der", this.encoders.hasOwnProperty(b) || (this.encoders[b] = this._createNamed(e[b])), this.encoders[b];
  }, a.prototype.encode = function(b, g, E) {
    return this._getEncoder(g).encode(b, E);
  };
})(zn);
var ni = {};
(function(t) {
  const e = t;
  e.Reporter = Nt.Reporter, e.DecoderBuffer = Ye.DecoderBuffer, e.EncoderBuffer = Ye.EncoderBuffer, e.Node = kr;
})(ni);
var ii = {};
(function(t) {
  const e = t;
  e._reverse = function(n) {
    const f = {};
    return Object.keys(n).forEach(function(a) {
      (a | 0) == a && (a = a | 0);
      const v = n[a];
      f[v] = a;
    }), f;
  }, e.der = Ft;
})(ii);
(function(t) {
  const e = t;
  e.bignum = Vn, e.define = zn.define, e.base = ni, e.constants = ii, e.decoders = Rr, e.encoders = Tr;
})(Gn);
var Ze = {}, br = { exports: {} };
(function(t, e) {
  var i = mt, n = i.Buffer;
  function f(v, b) {
    for (var g in v)
      b[g] = v[g];
  }
  n.from && n.alloc && n.allocUnsafe && n.allocUnsafeSlow ? t.exports = i : (f(i, e), e.Buffer = a);
  function a(v, b, g) {
    return n(v, b, g);
  }
  f(n, a), a.from = function(v, b, g) {
    if (typeof v == "number")
      throw new TypeError("Argument must not be a number");
    return n(v, b, g);
  }, a.alloc = function(v, b, g) {
    if (typeof v != "number")
      throw new TypeError("Argument must be a number");
    var E = n(v);
    return b !== void 0 ? typeof g == "string" ? E.fill(b, g) : E.fill(b) : E.fill(0), E;
  }, a.allocUnsafe = function(v) {
    if (typeof v != "number")
      throw new TypeError("Argument must be a number");
    return n(v);
  }, a.allocUnsafeSlow = function(v) {
    if (typeof v != "number")
      throw new TypeError("Argument must be a number");
    return i.SlowBuffer(v);
  };
})(br, br.exports);
var Mt = br.exports, kt = Mt.Buffer, Bo = Cr, Ao = lt;
function Lt(t) {
  if (this.buffer = null, this.writable = !0, this.readable = !0, !t)
    return this.buffer = kt.alloc(0), this;
  if (typeof t.pipe == "function")
    return this.buffer = kt.alloc(0), t.pipe(this), this;
  if (t.length || typeof t == "object")
    return this.buffer = t, this.writable = !1, process.nextTick((function() {
      this.emit("end", t), this.readable = !1, this.emit("close");
    }).bind(this)), this;
  throw new TypeError("Unexpected data type (" + typeof t + ")");
}
Ao.inherits(Lt, Bo);
Lt.prototype.write = function(e) {
  this.buffer = kt.concat([this.buffer, kt.from(e)]), this.emit("data", e);
};
Lt.prototype.end = function(e) {
  e && this.write(e), this.emit("end", e), this.emit("close"), this.writable = !1, this.readable = !1;
};
var oi = Lt;
function hr(t) {
  var e = (t / 8 | 0) + (t % 8 === 0 ? 0 : 1);
  return e;
}
var To = {
  ES256: hr(256),
  ES384: hr(384),
  ES512: hr(521)
};
function Oo(t) {
  var e = To[t];
  if (e)
    return e;
  throw new Error('Unknown algorithm "' + t + '"');
}
var ko = Oo, Pt = Mt.Buffer, si = ko, It = 128, ai = 0, Po = 32, Io = 16, Ro = 2, fi = Io | Po | ai << 6, Rt = Ro | ai << 6;
function Do(t) {
  return t.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function ui(t) {
  if (Pt.isBuffer(t))
    return t;
  if (typeof t == "string")
    return Pt.from(t, "base64");
  throw new TypeError("ECDSA signature must be a Base64 string or a Buffer");
}
function No(t, e) {
  t = ui(t);
  var i = si(e), n = i + 1, f = t.length, a = 0;
  if (t[a++] !== fi)
    throw new Error('Could not find expected "seq"');
  var v = t[a++];
  if (v === (It | 1) && (v = t[a++]), f - a < v)
    throw new Error('"seq" specified length of "' + v + '", only "' + (f - a) + '" remaining');
  if (t[a++] !== Rt)
    throw new Error('Could not find expected "int" for "r"');
  var b = t[a++];
  if (f - a - 2 < b)
    throw new Error('"r" specified length of "' + b + '", only "' + (f - a - 2) + '" available');
  if (n < b)
    throw new Error('"r" specified length of "' + b + '", max of "' + n + '" is acceptable');
  var g = a;
  if (a += b, t[a++] !== Rt)
    throw new Error('Could not find expected "int" for "s"');
  var E = t[a++];
  if (f - a !== E)
    throw new Error('"s" specified length of "' + E + '", expected "' + (f - a) + '"');
  if (n < E)
    throw new Error('"s" specified length of "' + E + '", max of "' + n + '" is acceptable');
  var M = a;
  if (a += E, a !== f)
    throw new Error('Expected to consume entire buffer, but "' + (f - a) + '" bytes remain');
  var y = i - b, _ = i - E, x = Pt.allocUnsafe(y + b + _ + E);
  for (a = 0; a < y; ++a)
    x[a] = 0;
  t.copy(x, a, g + Math.max(-y, 0), g + b), a = i;
  for (var C = a; a < C + _; ++a)
    x[a] = 0;
  return t.copy(x, a, M + Math.max(-_, 0), M + E), x = x.toString("base64"), x = Do(x), x;
}
function vn(t, e, i) {
  for (var n = 0; e + n < i && t[e + n] === 0; )
    ++n;
  var f = t[e + n] >= It;
  return f && --n, n;
}
function jo(t, e) {
  t = ui(t);
  var i = si(e), n = t.length;
  if (n !== i * 2)
    throw new TypeError('"' + e + '" signatures must be "' + i * 2 + '" bytes, saw "' + n + '"');
  var f = vn(t, 0, i), a = vn(t, i, t.length), v = i - f, b = i - a, g = 2 + v + 1 + 1 + b, E = g < It, M = Pt.allocUnsafe((E ? 2 : 3) + g), y = 0;
  return M[y++] = fi, E ? M[y++] = g : (M[y++] = It | 1, M[y++] = g & 255), M[y++] = Rt, M[y++] = v, f < 0 ? (M[y++] = 0, y += t.copy(M, y, 0, i)) : y += t.copy(M, y, f, i), M[y++] = Rt, M[y++] = b, a < 0 ? (M[y++] = 0, t.copy(M, y, i)) : t.copy(M, y, i + a), M;
}
var Fo = {
  derToJose: No,
  joseToDer: jo
}, cr, gn;
function Lo() {
  if (gn) return cr;
  gn = 1;
  var t = mt.Buffer, e = mt.SlowBuffer;
  cr = i;
  function i(a, v) {
    if (!t.isBuffer(a) || !t.isBuffer(v) || a.length !== v.length)
      return !1;
    for (var b = 0, g = 0; g < a.length; g++)
      b |= a[g] ^ v[g];
    return b === 0;
  }
  i.install = function() {
    t.prototype.equal = e.prototype.equal = function(v) {
      return i(this, v);
    };
  };
  var n = t.prototype.equal, f = e.prototype.equal;
  return i.restore = function() {
    t.prototype.equal = n, e.prototype.equal = f;
  }, cr;
}
var ut = Mt.Buffer, Ne = Dt, li = Fo, mn = lt, $o = `"%s" is not a valid algorithm.
  Supported algorithms are:
  "HS256", "HS384", "HS512", "RS256", "RS384", "RS512", "PS256", "PS384", "PS512", "ES256", "ES384", "ES512" and "none".`, vt = "secret must be a string or buffer", et = "key must be a string or a buffer", qo = "key must be a string, a buffer or an object", Fr = typeof Ne.createPublicKey == "function";
Fr && (et += " or a KeyObject", vt += "or a KeyObject");
function hi(t) {
  if (!ut.isBuffer(t) && typeof t != "string" && (!Fr || typeof t != "object" || typeof t.type != "string" || typeof t.asymmetricKeyType != "string" || typeof t.export != "function"))
    throw qe(et);
}
function ci(t) {
  if (!ut.isBuffer(t) && typeof t != "string" && typeof t != "object")
    throw qe(qo);
}
function Uo(t) {
  if (!ut.isBuffer(t)) {
    if (typeof t == "string")
      return t;
    if (!Fr || typeof t != "object" || t.type !== "secret" || typeof t.export != "function")
      throw qe(vt);
  }
}
function Lr(t) {
  return t.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function di(t) {
  t = t.toString();
  var e = 4 - t.length % 4;
  if (e !== 4)
    for (var i = 0; i < e; ++i)
      t += "=";
  return t.replace(/\-/g, "+").replace(/_/g, "/");
}
function qe(t) {
  var e = [].slice.call(arguments, 1), i = mn.format.bind(mn, t).apply(null, e);
  return new TypeError(i);
}
function Ko(t) {
  return ut.isBuffer(t) || typeof t == "string";
}
function _t(t) {
  return Ko(t) || (t = JSON.stringify(t)), t;
}
function pi(t) {
  return function(i, n) {
    Uo(n), i = _t(i);
    var f = Ne.createHmac("sha" + t, n), a = (f.update(i), f.digest("base64"));
    return Lr(a);
  };
}
var dr, Ho = "timingSafeEqual" in Ne ? function(e, i) {
  return e.byteLength !== i.byteLength ? !1 : Ne.timingSafeEqual(e, i);
} : function(e, i) {
  return dr || (dr = Lo()), dr(e, i);
};
function Go(t) {
  return function(i, n, f) {
    var a = pi(t)(i, f);
    return Ho(ut.from(n), ut.from(a));
  };
}
function vi(t) {
  return function(i, n) {
    ci(n), i = _t(i);
    var f = Ne.createSign("RSA-SHA" + t), a = (f.update(i), f.sign(n, "base64"));
    return Lr(a);
  };
}
function gi(t) {
  return function(i, n, f) {
    hi(f), i = _t(i), n = di(n);
    var a = Ne.createVerify("RSA-SHA" + t);
    return a.update(i), a.verify(f, n, "base64");
  };
}
function Vo(t) {
  return function(i, n) {
    ci(n), i = _t(i);
    var f = Ne.createSign("RSA-SHA" + t), a = (f.update(i), f.sign({
      key: n,
      padding: Ne.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: Ne.constants.RSA_PSS_SALTLEN_DIGEST
    }, "base64"));
    return Lr(a);
  };
}
function zo(t) {
  return function(i, n, f) {
    hi(f), i = _t(i), n = di(n);
    var a = Ne.createVerify("RSA-SHA" + t);
    return a.update(i), a.verify({
      key: f,
      padding: Ne.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: Ne.constants.RSA_PSS_SALTLEN_DIGEST
    }, n, "base64");
  };
}
function Wo(t) {
  var e = vi(t);
  return function() {
    var n = e.apply(null, arguments);
    return n = li.derToJose(n, "ES" + t), n;
  };
}
function Zo(t) {
  var e = gi(t);
  return function(n, f, a) {
    f = li.joseToDer(f, "ES" + t).toString("base64");
    var v = e(n, f, a);
    return v;
  };
}
function Jo() {
  return function() {
    return "";
  };
}
function Yo() {
  return function(e, i) {
    return i === "";
  };
}
var mi = function(e) {
  var i = {
    hs: pi,
    rs: vi,
    ps: Vo,
    es: Wo,
    none: Jo
  }, n = {
    hs: Go,
    rs: gi,
    ps: zo,
    es: Zo,
    none: Yo
  }, f = e.match(/^(RS|PS|ES|HS)(256|384|512)$|^(none)$/);
  if (!f)
    throw qe($o, e);
  var a = (f[1] || f[3]).toLowerCase(), v = f[2];
  return {
    sign: i[a](v),
    verify: n[a](v)
  };
}, Qo = mt.Buffer, yi = function(e) {
  return typeof e == "string" ? e : typeof e == "number" || Qo.isBuffer(e) ? e.toString() : JSON.stringify(e);
}, Xo = Mt.Buffer, yn = oi, es = mi, ts = Cr, wn = yi, $r = lt;
function bn(t, e) {
  return Xo.from(t, e).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function rs(t, e, i) {
  i = i || "utf8";
  var n = bn(wn(t), "binary"), f = bn(wn(e), i);
  return $r.format("%s.%s", n, f);
}
function wi(t) {
  var e = t.header, i = t.payload, n = t.secret || t.privateKey, f = t.encoding, a = es(e.alg), v = rs(e, i, f), b = a.sign(v, n);
  return $r.format("%s.%s", v, b);
}
function $t(t) {
  var e = t.secret;
  if (e = e ?? t.privateKey, e = e ?? t.key, /^hs/i.test(t.header.alg) === !0 && e == null)
    throw new TypeError("secret must be a string or buffer or a KeyObject");
  var i = new yn(e);
  this.readable = !0, this.header = t.header, this.encoding = t.encoding, this.secret = this.privateKey = this.key = i, this.payload = new yn(t.payload), this.secret.once("close", (function() {
    !this.payload.writable && this.readable && this.sign();
  }).bind(this)), this.payload.once("close", (function() {
    !this.secret.writable && this.readable && this.sign();
  }).bind(this));
}
$r.inherits($t, ts);
$t.prototype.sign = function() {
  try {
    var e = wi({
      header: this.header,
      payload: this.payload.buffer,
      secret: this.secret.buffer,
      encoding: this.encoding
    });
    return this.emit("done", e), this.emit("data", e), this.emit("end"), this.readable = !1, e;
  } catch (i) {
    this.readable = !1, this.emit("error", i), this.emit("close");
  }
};
$t.sign = wi;
var ns = $t, bi = Mt.Buffer, Mn = oi, is = mi, os = Cr, Mi = yi, ss = lt, as = /^[a-zA-Z0-9\-_]+?\.[a-zA-Z0-9\-_]+?\.([a-zA-Z0-9\-_]+)?$/;
function fs(t) {
  return Object.prototype.toString.call(t) === "[object Object]";
}
function us(t) {
  if (fs(t))
    return t;
  try {
    return JSON.parse(t);
  } catch {
    return;
  }
}
function _i(t) {
  var e = t.split(".", 1)[0];
  return us(bi.from(e, "base64").toString("binary"));
}
function ls(t) {
  return t.split(".", 2).join(".");
}
function Ei(t) {
  return t.split(".")[2];
}
function hs(t, e) {
  e = e || "utf8";
  var i = t.split(".")[1];
  return bi.from(i, "base64").toString(e);
}
function xi(t) {
  return as.test(t) && !!_i(t);
}
function Si(t, e, i) {
  if (!e) {
    var n = new Error("Missing algorithm parameter for jws.verify");
    throw n.code = "MISSING_ALGORITHM", n;
  }
  t = Mi(t);
  var f = Ei(t), a = ls(t), v = is(e);
  return v.verify(a, f, i);
}
function Ci(t, e) {
  if (e = e || {}, t = Mi(t), !xi(t))
    return null;
  var i = _i(t);
  if (!i)
    return null;
  var n = hs(t);
  return (i.typ === "JWT" || e.json) && (n = JSON.parse(n, e.encoding)), {
    header: i,
    payload: n,
    signature: Ei(t)
  };
}
function ht(t) {
  t = t || {};
  var e = t.secret;
  if (e = e ?? t.publicKey, e = e ?? t.key, /^hs/i.test(t.algorithm) === !0 && e == null)
    throw new TypeError("secret must be a string or buffer or a KeyObject");
  var i = new Mn(e);
  this.readable = !0, this.algorithm = t.algorithm, this.encoding = t.encoding, this.secret = this.publicKey = this.key = i, this.signature = new Mn(t.signature), this.secret.once("close", (function() {
    !this.signature.writable && this.readable && this.verify();
  }).bind(this)), this.signature.once("close", (function() {
    !this.secret.writable && this.readable && this.verify();
  }).bind(this));
}
ss.inherits(ht, os);
ht.prototype.verify = function() {
  try {
    var e = Si(this.signature.buffer, this.algorithm, this.key.buffer), i = Ci(this.signature.buffer, this.encoding);
    return this.emit("done", e, i), this.emit("data", e), this.emit("end"), this.readable = !1, e;
  } catch (n) {
    this.readable = !1, this.emit("error", n), this.emit("close");
  }
};
ht.decode = Ci;
ht.isValid = xi;
ht.verify = Si;
var cs = ht, Bi = ns, qt = cs, ds = [
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
Ze.ALGORITHMS = ds;
Ze.sign = Bi.sign;
Ze.verify = qt.verify;
Ze.decode = qt.decode;
Ze.isValid = qt.isValid;
Ze.createSign = function(e) {
  return new Bi(e);
};
Ze.createVerify = function(e) {
  return new qt(e);
};
const qr = {};
qr.supportedContentEncodings = {
  AES_GCM: "aesgcm",
  AES_128_GCM: "aes128gcm"
};
qr.supportedUrgency = {
  VERY_LOW: "very-low",
  LOW: "low",
  NORMAL: "normal",
  HIGH: "high"
};
var Ur = qr;
function ps(t) {
  return /^[A-Za-z0-9\-_]+$/.test(t);
}
var Ai = {
  validate: ps
};
const vs = Dt, gs = Gn, ms = Ze, { URL: Ti } = Sr, _n = Ur, Oi = Ai, ys = 12 * 60 * 60, ws = 24 * 60 * 60, bs = gs.define("ECPrivateKey", function() {
  this.seq().obj(
    this.key("version").int(),
    this.key("privateKey").octstr(),
    this.key("parameters").explicit(0).objid().optional(),
    this.key("publicKey").explicit(1).bitstr().optional()
  );
});
function Ms(t) {
  return bs.encode({
    version: 1,
    privateKey: t,
    parameters: [1, 2, 840, 10045, 3, 1, 7]
    // prime256v1
  }, "pem", {
    label: "EC PRIVATE KEY"
  });
}
function _s() {
  const t = vs.createECDH("prime256v1");
  t.generateKeys();
  let e = t.getPublicKey(), i = t.getPrivateKey();
  if (i.length < 32) {
    const n = Buffer.alloc(32 - i.length);
    n.fill(0), i = Buffer.concat([n, i]);
  }
  if (e.length < 65) {
    const n = Buffer.alloc(65 - e.length);
    n.fill(0), e = Buffer.concat([n, e]);
  }
  return {
    publicKey: e.toString("base64url"),
    privateKey: i.toString("base64url")
  };
}
function ki(t) {
  if (!t)
    throw new Error("No subject set in vapidDetails.subject.");
  if (typeof t != "string" || t.length === 0)
    throw new Error("The subject value must be a string containing an https: URL or mailto: address. " + t);
  let e = null;
  try {
    e = new Ti(t);
  } catch {
    throw new Error("Vapid subject is not a valid URL. " + t);
  }
  if (!["https:", "mailto:"].includes(e.protocol))
    throw new Error("Vapid subject is not an https: or mailto: URL. " + t);
  e.hostname === "localhost" && console.warn("Vapid subject points to a localhost web URI, which is unsupported by Apple's push notification server and will result in a BadJwtToken error when sending notifications.");
}
function Pi(t) {
  if (!t)
    throw new Error("No key set vapidDetails.publicKey");
  if (typeof t != "string")
    throw new Error("Vapid public key is must be a URL safe Base 64 encoded string.");
  if (!Oi.validate(t))
    throw new Error('Vapid public key must be a URL safe Base 64 (without "=")');
  if (t = Buffer.from(t, "base64url"), t.length !== 65)
    throw new Error("Vapid public key should be 65 bytes long when decoded.");
}
function Ii(t) {
  if (!t)
    throw new Error("No key set in vapidDetails.privateKey");
  if (typeof t != "string")
    throw new Error("Vapid private key must be a URL safe Base 64 encoded string.");
  if (!Oi.validate(t))
    throw new Error('Vapid private key must be a URL safe Base 64 (without "=")');
  if (t = Buffer.from(t, "base64url"), t.length !== 32)
    throw new Error("Vapid private key should be 32 bytes long when decoded.");
}
function Kr(t) {
  const e = /* @__PURE__ */ new Date();
  return e.setSeconds(e.getSeconds() + t), Math.floor(e.getTime() / 1e3);
}
function Ri(t) {
  if (!Number.isInteger(t))
    throw new Error("`expiration` value must be a number");
  if (t < 0)
    throw new Error("`expiration` must be a positive integer");
  const e = Kr(ws);
  if (t >= e)
    throw new Error("`expiration` value is greater than maximum of 24 hours");
}
function Es(t, e, i, n, f, a) {
  if (!t)
    throw new Error("No audience could be generated for VAPID.");
  if (typeof t != "string" || t.length === 0)
    throw new Error("The audience value must be a string containing the origin of a push service. " + t);
  try {
    new Ti(t);
  } catch {
    throw new Error("VAPID audience is not a url. " + t);
  }
  ki(e), Pi(i), Ii(n), n = Buffer.from(n, "base64url"), a ? Ri(a) : a = Kr(ys);
  const v = {
    typ: "JWT",
    alg: "ES256"
  }, b = {
    aud: t,
    exp: a,
    sub: e
  }, g = ms.sign({
    header: v,
    payload: b,
    privateKey: Ms(n)
  });
  if (f === _n.supportedContentEncodings.AES_128_GCM)
    return {
      Authorization: "vapid t=" + g + ", k=" + i
    };
  if (f === _n.supportedContentEncodings.AES_GCM)
    return {
      Authorization: "WebPush " + g,
      "Crypto-Key": "p256ecdsa=" + i
    };
  throw new Error("Unsupported encoding type specified.");
}
var Di = {
  generateVAPIDKeys: _s,
  getFutureExpirationTimestamp: Kr,
  getVapidHeaders: Es,
  validateSubject: ki,
  validatePublicKey: Pi,
  validatePrivateKey: Ii,
  validateExpiration: Ri
}, Ut = Dt, Ni = "aes-128-gcm", Kt = { aes128gcm: 1, aesgcm: 2 }, Qe = 16, Ge = 16, xs = 12, ji = 32, yt = "encrypt", wt = "decrypt", L;
process.env.ECE_KEYLOG === "1" ? L = function(t, e) {
  return console.warn(t + " [" + e.length + "]: " + e.toString("base64url")), e;
} : L = function(t, e) {
  return e;
};
function St(t) {
  return typeof t == "string" ? Buffer.from(t, "base64url") : t;
}
function Fi(t, e) {
  var i = Ut.createHmac("sha256", t);
  return i.update(e), i.digest();
}
function Li(t, e) {
  return L("salt", t), L("ikm", e), L("extract", Fi(t, e));
}
function Mr(t, e, i) {
  L("prk", t), L("info", e);
  var n = Buffer.alloc(0), f = Buffer.alloc(0);
  e = Buffer.from(e, "ascii");
  for (var a = 0, v = Buffer.alloc(1); n.length < i; )
    v.writeUIntBE(++a, 0, 1), f = Fi(t, Buffer.concat([f, e, v])), n = Buffer.concat([n, f]);
  return L("expand", n.slice(0, i));
}
function $i(t, e, i, n) {
  return Mr(Li(t, e), i, n);
}
function _r(t, e) {
  var i = Buffer.concat([
    Buffer.from("Content-Encoding: " + t + "\0", "ascii"),
    e
  ]);
  return L("info " + t, i), i;
}
function En(t) {
  var e = Buffer.concat([Buffer.alloc(2), t]);
  return e.writeUIntBE(t.length, 0, 2), e;
}
function Ss(t, e) {
  var i = t.privateKey, n, f;
  if (e === yt)
    n = i.getPublicKey(), f = t.dh;
  else if (e === wt)
    n = t.dh, f = i.getPublicKey();
  else
    throw new Error("Unknown mode only " + yt + " and " + wt + " supported");
  return {
    secret: i.computeSecret(t.dh),
    context: Buffer.concat([
      Buffer.from(t.keylabel, "ascii"),
      Buffer.from([0]),
      En(f),
      // user agent
      En(n)
      // application server
    ])
  };
}
function Cs(t, e) {
  var i = { secret: null, context: Buffer.alloc(0) };
  if (t.key) {
    if (i.secret = t.key, i.secret.length !== Ge)
      throw new Error("An explicit key must be " + Ge + " bytes");
  } else t.dh ? i = Ss(t, e) : typeof t.keyid !== void 0 && (i.secret = t.keymap[t.keyid]);
  if (!i.secret)
    throw new Error("Unable to determine key");
  return L("secret", i.secret), L("context", i.context), t.authSecret && (i.secret = $i(
    t.authSecret,
    i.secret,
    _r("auth", Buffer.alloc(0)),
    ji
  ), L("authsecret", i.secret)), i;
}
function Bs(t, e) {
  if (!t.authSecret)
    throw new Error("No authentication secret for webpush");
  L("authsecret", t.authSecret);
  var i, n, f;
  if (e === yt)
    n = t.privateKey.getPublicKey(), i = f = t.dh;
  else if (e === wt)
    i = n = t.keyid, f = t.privateKey.getPublicKey();
  else
    throw new Error("Unknown mode only " + yt + " and " + wt + " supported");
  return L("remote pubkey", i), L("sender pubkey", n), L("receiver pubkey", f), L(
    "secret dh",
    $i(
      t.authSecret,
      t.privateKey.computeSecret(i),
      Buffer.concat([
        Buffer.from("WebPush: info\0"),
        f,
        n
      ]),
      ji
    )
  );
}
function As(t, e, i) {
  if (i && !js(i))
    throw new Error("Callback is not a function");
  if (t.key) {
    if (t.key.length !== Ge)
      throw new Error("An explicit key must be " + Ge + " bytes");
    return L("secret key", t.key);
  }
  if (!t.privateKey) {
    if (i)
      var n = i(t.keyid);
    else
      var n = t.keymap && t.keymap[t.keyid];
    if (!n)
      throw new Error('No saved key (keyid: "' + t.keyid + '")');
    return n;
  }
  return Bs(t, e);
}
function qi(t, e, i) {
  if (!t.salt)
    throw new Error("must include a salt parameter for " + t.version);
  var n, f, a;
  if (t.version === "aesgcm") {
    var v = Cs(t, e);
    n = _r("aesgcm", v.context), f = _r("nonce", v.context), a = v.secret;
  } else if (t.version === "aes128gcm")
    n = Buffer.from("Content-Encoding: aes128gcm\0"), f = Buffer.from("Content-Encoding: nonce\0"), a = As(t, e, i);
  else
    throw new Error("Unable to set context for mode " + t.version);
  var b = Li(t.salt, a), g = {
    key: Mr(b, n, Ge),
    nonce: Mr(b, f, xs)
  };
  return L("key", g.key), L("nonce base", g.nonce), g;
}
function Ui(t) {
  var e = {};
  e.version = t.version || "aes128gcm", e.rs = parseInt(t.rs, 10), isNaN(e.rs) && (e.rs = 4096);
  var i = Kt[e.version];
  if (e.version === "aes128gcm" && (i += Qe), e.rs <= i)
    throw new Error("The rs parameter has to be greater than " + i);
  if (t.salt && (e.salt = St(t.salt), e.salt.length !== Ge))
    throw new Error("The salt parameter must be " + Ge + " bytes");
  return e.keyid = t.keyid, t.key ? e.key = St(t.key) : (e.privateKey = t.privateKey, e.privateKey || (e.keymap = t.keymap), e.version !== "aes128gcm" && (e.keylabel = t.keylabel || "P-256"), t.dh && (e.dh = St(t.dh))), t.authSecret && (e.authSecret = St(t.authSecret)), e;
}
function Ki(t, e) {
  var i = Buffer.from(t), n = i.readUIntBE(i.length - 6, 6), f = ((n ^ e) & 16777215) + ((n / 16777216 ^ e / 16777216) & 16777215) * 16777216;
  return i.writeUIntBE(f, i.length - 6, 6), L("nonce" + e, i), i;
}
function Ts(t, e) {
  var i = t.readUIntBE(20, 1);
  return e.salt = t.slice(0, Ge), e.rs = t.readUIntBE(Ge, 4), e.keyid = t.slice(21, 21 + i), 21 + i;
}
function Os(t, e) {
  var i = Kt[e], n = t.readUIntBE(0, i);
  if (n + i > t.length)
    throw new Error("padding exceeds block size");
  L("padding", t.slice(0, i + n));
  var f = Buffer.alloc(n);
  if (f.fill(0), f.compare(t.slice(i, i + n)) !== 0)
    throw new Error("invalid padding");
  return t.slice(i + n);
}
function ks(t, e) {
  for (var i = t.length - 1; i >= 0; ) {
    if (t[i]) {
      if (e) {
        if (t[i] !== 2)
          throw new Error("last record needs to start padding with a 2");
      } else if (t[i] !== 1)
        throw new Error("last record needs to start padding with a 2");
      return t.slice(0, i);
    }
    --i;
  }
  throw new Error("all zero plaintext");
}
function Ps(t, e, i, n, f) {
  L("decrypt", i);
  var a = Ki(t.nonce, e), v = Ut.createDecipheriv(Ni, t.key, a);
  v.setAuthTag(i.slice(i.length - Qe));
  var b = v.update(i.slice(0, i.length - Qe));
  return b = Buffer.concat([b, v.final()]), L("decrypted", b), n.version !== "aes128gcm" ? Os(b, n.version) : ks(b, f);
}
function Is(t, e, i) {
  var n = Ui(e);
  if (n.version === "aes128gcm") {
    var f = Ts(t, n);
    t = t.slice(f);
  }
  var a = qi(n, wt, i), v = 0, b = Buffer.alloc(0), g = n.rs;
  n.version !== "aes128gcm" && (g += Qe);
  for (var E = 0; v < t.length; ++E) {
    var M = v + g;
    if (n.version !== "aes128gcm" && M === t.length)
      throw new Error("Truncated payload");
    if (M = Math.min(M, t.length), M - v <= Qe)
      throw new Error("Invalid block: too small at " + E);
    var y = Ps(
      a,
      E,
      t.slice(v, M),
      n,
      M >= t.length
    );
    b = Buffer.concat([b, y]), v = M;
  }
  return b;
}
function Rs(t, e, i, n, f, a) {
  L("encrypt", i), n = n || 0;
  var v = Ki(t.nonce, e), b = Ut.createCipheriv(Ni, t.key, v), g = [], E = Kt[f.version], M = Buffer.alloc(n + E);
  if (M.fill(0), f.version !== "aes128gcm") {
    if (M.writeUIntBE(n, 0, E), L("padding", M), g.push(b.update(M)), g.push(b.update(i)), !a && M.length + i.length < f.rs)
      throw new Error("Unable to pad to record size");
  } else
    g.push(b.update(i)), M.writeUIntBE(a ? 2 : 1, 0, 1), L("padding", M), g.push(b.update(M));
  b.final();
  var y = b.getAuthTag();
  if (y.length !== Qe)
    throw new Error("invalid tag generated");
  return g.push(y), L("encrypted", Buffer.concat(g));
}
function Ds(t) {
  var e = Buffer.alloc(5), i = Buffer.from(t.keyid || []);
  if (i.length > 255)
    throw new Error("keyid is too large");
  return e.writeUIntBE(t.rs, 0, 4), e.writeUIntBE(i.length, 4, 1), Buffer.concat([t.salt, e, i]);
}
function Ns(t, e, i) {
  if (!Buffer.isBuffer(t))
    throw new Error("buffer argument must be a Buffer");
  var n = Ui(e);
  n.salt || (n.salt = Ut.randomBytes(Ge));
  var f;
  n.version === "aes128gcm" ? (n.privateKey && !n.keyid && (n.keyid = n.privateKey.getPublicKey()), f = Ds(n)) : f = Buffer.alloc(0);
  var a = qi(n, yt, i), v = 0, b = Kt[n.version], g = b;
  n.version === "aes128gcm" && (g += Qe);
  for (var E = isNaN(parseInt(e.pad, 10)) ? 0 : parseInt(e.pad, 10), M = 0, y = !1; !y; ) {
    var _ = Math.min(n.rs - g - 1, E);
    n.version !== "aes128gcm" && (_ = Math.min((1 << b * 8) - 1, _)), E > 0 && _ === 0 && ++_, E -= _;
    var x = v + n.rs - g - _;
    n.version !== "aes128gcm" ? y = x > t.length : y = x >= t.length, y = y && E <= 0;
    var C = Rs(
      a,
      M,
      t.slice(v, x),
      _,
      n,
      y
    );
    f = Buffer.concat([f, C]), v = x, ++M;
  }
  return f;
}
function js(t) {
  return typeof t == "function";
}
var Fs = {
  decrypt: Is,
  encrypt: Ns
};
const xn = Dt, Ls = Fs, $s = function(t, e, i, n) {
  if (!t)
    throw new Error("No user public key provided for encryption.");
  if (typeof t != "string")
    throw new Error("The subscription p256dh value must be a string.");
  if (Buffer.from(t, "base64url").length !== 65)
    throw new Error("The subscription p256dh value should be 65 bytes long.");
  if (!e)
    throw new Error("No user auth provided for encryption.");
  if (typeof e != "string")
    throw new Error("The subscription auth key must be a string.");
  if (Buffer.from(e, "base64url").length < 16)
    throw new Error("The subscription auth key should be at least 16 bytes long");
  if (typeof i != "string" && !Buffer.isBuffer(i))
    throw new Error("Payload must be either a string or a Node Buffer.");
  (typeof i == "string" || i instanceof String) && (i = Buffer.from(i));
  const f = xn.createECDH("prime256v1"), a = f.generateKeys(), v = xn.randomBytes(16).toString("base64url"), b = Ls.encrypt(i, {
    version: n,
    dh: t,
    privateKey: f,
    salt: v,
    authSecret: e
  });
  return {
    localPublicKey: a,
    salt: v,
    cipherText: b
  };
};
var Hi = {
  encrypt: $s
};
function Gi(t, e, i, n, f) {
  Error.captureStackTrace(this, this.constructor), this.name = this.constructor.name, this.message = t, this.statusCode = e, this.headers = i, this.body = n, this.endpoint = f;
}
lt.inherits(Gi, Error);
var Vi = Gi, ct = {}, Ct = { exports: {} }, Bt = { exports: {} }, pr, Sn;
function qs() {
  if (Sn) return pr;
  Sn = 1;
  var t = 1e3, e = t * 60, i = e * 60, n = i * 24, f = n * 7, a = n * 365.25;
  pr = function(M, y) {
    y = y || {};
    var _ = typeof M;
    if (_ === "string" && M.length > 0)
      return v(M);
    if (_ === "number" && isFinite(M))
      return y.long ? g(M) : b(M);
    throw new Error(
      "val is not a non-empty string or a valid number. val=" + JSON.stringify(M)
    );
  };
  function v(M) {
    if (M = String(M), !(M.length > 100)) {
      var y = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
        M
      );
      if (y) {
        var _ = parseFloat(y[1]), x = (y[2] || "ms").toLowerCase();
        switch (x) {
          case "years":
          case "year":
          case "yrs":
          case "yr":
          case "y":
            return _ * a;
          case "weeks":
          case "week":
          case "w":
            return _ * f;
          case "days":
          case "day":
          case "d":
            return _ * n;
          case "hours":
          case "hour":
          case "hrs":
          case "hr":
          case "h":
            return _ * i;
          case "minutes":
          case "minute":
          case "mins":
          case "min":
          case "m":
            return _ * e;
          case "seconds":
          case "second":
          case "secs":
          case "sec":
          case "s":
            return _ * t;
          case "milliseconds":
          case "millisecond":
          case "msecs":
          case "msec":
          case "ms":
            return _;
          default:
            return;
        }
      }
    }
  }
  function b(M) {
    var y = Math.abs(M);
    return y >= n ? Math.round(M / n) + "d" : y >= i ? Math.round(M / i) + "h" : y >= e ? Math.round(M / e) + "m" : y >= t ? Math.round(M / t) + "s" : M + "ms";
  }
  function g(M) {
    var y = Math.abs(M);
    return y >= n ? E(M, y, n, "day") : y >= i ? E(M, y, i, "hour") : y >= e ? E(M, y, e, "minute") : y >= t ? E(M, y, t, "second") : M + " ms";
  }
  function E(M, y, _, x) {
    var C = y >= _ * 1.5;
    return Math.round(M / _) + " " + x + (C ? "s" : "");
  }
  return pr;
}
var vr, Cn;
function zi() {
  if (Cn) return vr;
  Cn = 1;
  function t(e) {
    n.debug = n, n.default = n, n.coerce = E, n.disable = b, n.enable = a, n.enabled = g, n.humanize = qs(), n.destroy = M, Object.keys(e).forEach((y) => {
      n[y] = e[y];
    }), n.names = [], n.skips = [], n.formatters = {};
    function i(y) {
      let _ = 0;
      for (let x = 0; x < y.length; x++)
        _ = (_ << 5) - _ + y.charCodeAt(x), _ |= 0;
      return n.colors[Math.abs(_) % n.colors.length];
    }
    n.selectColor = i;
    function n(y) {
      let _, x = null, C, D;
      function B(...S) {
        if (!B.enabled)
          return;
        const A = B, P = Number(/* @__PURE__ */ new Date()), R = P - (_ || P);
        A.diff = R, A.prev = _, A.curr = P, _ = P, S[0] = n.coerce(S[0]), typeof S[0] != "string" && S.unshift("%O");
        let Se = 0;
        S[0] = S[0].replace(/%([a-zA-Z%])/g, (Be, $e) => {
          if (Be === "%%")
            return "%";
          Se++;
          const j = n.formatters[$e];
          if (typeof j == "function") {
            const Ae = S[Se];
            Be = j.call(A, Ae), S.splice(Se, 1), Se--;
          }
          return Be;
        }), n.formatArgs.call(A, S), (A.log || n.log).apply(A, S);
      }
      return B.namespace = y, B.useColors = n.useColors(), B.color = n.selectColor(y), B.extend = f, B.destroy = n.destroy, Object.defineProperty(B, "enabled", {
        enumerable: !0,
        configurable: !1,
        get: () => x !== null ? x : (C !== n.namespaces && (C = n.namespaces, D = n.enabled(y)), D),
        set: (S) => {
          x = S;
        }
      }), typeof n.init == "function" && n.init(B), B;
    }
    function f(y, _) {
      const x = n(this.namespace + (typeof _ > "u" ? ":" : _) + y);
      return x.log = this.log, x;
    }
    function a(y) {
      n.save(y), n.namespaces = y, n.names = [], n.skips = [];
      const _ = (typeof y == "string" ? y : "").trim().replace(/\s+/g, ",").split(",").filter(Boolean);
      for (const x of _)
        x[0] === "-" ? n.skips.push(x.slice(1)) : n.names.push(x);
    }
    function v(y, _) {
      let x = 0, C = 0, D = -1, B = 0;
      for (; x < y.length; )
        if (C < _.length && (_[C] === y[x] || _[C] === "*"))
          _[C] === "*" ? (D = C, B = x, C++) : (x++, C++);
        else if (D !== -1)
          C = D + 1, B++, x = B;
        else
          return !1;
      for (; C < _.length && _[C] === "*"; )
        C++;
      return C === _.length;
    }
    function b() {
      const y = [
        ...n.names,
        ...n.skips.map((_) => "-" + _)
      ].join(",");
      return n.enable(""), y;
    }
    function g(y) {
      for (const _ of n.skips)
        if (v(y, _))
          return !1;
      for (const _ of n.names)
        if (v(y, _))
          return !0;
      return !1;
    }
    function E(y) {
      return y instanceof Error ? y.stack || y.message : y;
    }
    function M() {
      console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
    }
    return n.enable(n.load()), n;
  }
  return vr = t, vr;
}
var Bn;
function Us() {
  return Bn || (Bn = 1, function(t, e) {
    e.formatArgs = n, e.save = f, e.load = a, e.useColors = i, e.storage = v(), e.destroy = /* @__PURE__ */ (() => {
      let g = !1;
      return () => {
        g || (g = !0, console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`."));
      };
    })(), e.colors = [
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
    function i() {
      if (typeof window < "u" && window.process && (window.process.type === "renderer" || window.process.__nwjs))
        return !0;
      if (typeof navigator < "u" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/))
        return !1;
      let g;
      return typeof document < "u" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || // Is firebug? http://stackoverflow.com/a/398120/376773
      typeof window < "u" && window.console && (window.console.firebug || window.console.exception && window.console.table) || // Is firefox >= v31?
      // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
      typeof navigator < "u" && navigator.userAgent && (g = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(g[1], 10) >= 31 || // Double check webkit in userAgent just in case we are in a worker
      typeof navigator < "u" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
    }
    function n(g) {
      if (g[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + g[0] + (this.useColors ? "%c " : " ") + "+" + t.exports.humanize(this.diff), !this.useColors)
        return;
      const E = "color: " + this.color;
      g.splice(1, 0, E, "color: inherit");
      let M = 0, y = 0;
      g[0].replace(/%[a-zA-Z%]/g, (_) => {
        _ !== "%%" && (M++, _ === "%c" && (y = M));
      }), g.splice(y, 0, E);
    }
    e.log = console.debug || console.log || (() => {
    });
    function f(g) {
      try {
        g ? e.storage.setItem("debug", g) : e.storage.removeItem("debug");
      } catch {
      }
    }
    function a() {
      let g;
      try {
        g = e.storage.getItem("debug") || e.storage.getItem("DEBUG");
      } catch {
      }
      return !g && typeof process < "u" && "env" in process && (g = process.env.DEBUG), g;
    }
    function v() {
      try {
        return localStorage;
      } catch {
      }
    }
    t.exports = zi()(e);
    const { formatters: b } = t.exports;
    b.j = function(g) {
      try {
        return JSON.stringify(g);
      } catch (E) {
        return "[UnexpectedJSONParseError]: " + E.message;
      }
    };
  }(Bt, Bt.exports)), Bt.exports;
}
var At = { exports: {} }, gr, An;
function Ks() {
  return An || (An = 1, gr = (t, e = process.argv) => {
    const i = t.startsWith("-") ? "" : t.length === 1 ? "-" : "--", n = e.indexOf(i + t), f = e.indexOf("--");
    return n !== -1 && (f === -1 || n < f);
  }), gr;
}
var mr, Tn;
function Hs() {
  if (Tn) return mr;
  Tn = 1;
  const t = oo, e = Kn, i = Ks(), { env: n } = process;
  let f;
  i("no-color") || i("no-colors") || i("color=false") || i("color=never") ? f = 0 : (i("color") || i("colors") || i("color=true") || i("color=always")) && (f = 1), "FORCE_COLOR" in n && (n.FORCE_COLOR === "true" ? f = 1 : n.FORCE_COLOR === "false" ? f = 0 : f = n.FORCE_COLOR.length === 0 ? 1 : Math.min(parseInt(n.FORCE_COLOR, 10), 3));
  function a(g) {
    return g === 0 ? !1 : {
      level: g,
      hasBasic: !0,
      has256: g >= 2,
      has16m: g >= 3
    };
  }
  function v(g, E) {
    if (f === 0)
      return 0;
    if (i("color=16m") || i("color=full") || i("color=truecolor"))
      return 3;
    if (i("color=256"))
      return 2;
    if (g && !E && f === void 0)
      return 0;
    const M = f || 0;
    if (n.TERM === "dumb")
      return M;
    if (process.platform === "win32") {
      const y = t.release().split(".");
      return Number(y[0]) >= 10 && Number(y[2]) >= 10586 ? Number(y[2]) >= 14931 ? 3 : 2 : 1;
    }
    if ("CI" in n)
      return ["TRAVIS", "CIRCLECI", "APPVEYOR", "GITLAB_CI", "GITHUB_ACTIONS", "BUILDKITE"].some((y) => y in n) || n.CI_NAME === "codeship" ? 1 : M;
    if ("TEAMCITY_VERSION" in n)
      return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(n.TEAMCITY_VERSION) ? 1 : 0;
    if (n.COLORTERM === "truecolor")
      return 3;
    if ("TERM_PROGRAM" in n) {
      const y = parseInt((n.TERM_PROGRAM_VERSION || "").split(".")[0], 10);
      switch (n.TERM_PROGRAM) {
        case "iTerm.app":
          return y >= 3 ? 3 : 2;
        case "Apple_Terminal":
          return 2;
      }
    }
    return /-256(color)?$/i.test(n.TERM) ? 2 : /^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(n.TERM) || "COLORTERM" in n ? 1 : M;
  }
  function b(g) {
    const E = v(g, g && g.isTTY);
    return a(E);
  }
  return mr = {
    supportsColor: b,
    stdout: a(v(!0, e.isatty(1))),
    stderr: a(v(!0, e.isatty(2)))
  }, mr;
}
var On;
function Gs() {
  return On || (On = 1, function(t, e) {
    const i = Kn, n = lt;
    e.init = M, e.log = b, e.formatArgs = a, e.save = g, e.load = E, e.useColors = f, e.destroy = n.deprecate(
      () => {
      },
      "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`."
    ), e.colors = [6, 2, 3, 4, 5, 1];
    try {
      const _ = Hs();
      _ && (_.stderr || _).level >= 2 && (e.colors = [
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
      ]);
    } catch {
    }
    e.inspectOpts = Object.keys(process.env).filter((_) => /^debug_/i.test(_)).reduce((_, x) => {
      const C = x.substring(6).toLowerCase().replace(/_([a-z])/g, (B, S) => S.toUpperCase());
      let D = process.env[x];
      return /^(yes|on|true|enabled)$/i.test(D) ? D = !0 : /^(no|off|false|disabled)$/i.test(D) ? D = !1 : D === "null" ? D = null : D = Number(D), _[C] = D, _;
    }, {});
    function f() {
      return "colors" in e.inspectOpts ? !!e.inspectOpts.colors : i.isatty(process.stderr.fd);
    }
    function a(_) {
      const { namespace: x, useColors: C } = this;
      if (C) {
        const D = this.color, B = "\x1B[3" + (D < 8 ? D : "8;5;" + D), S = `  ${B};1m${x} \x1B[0m`;
        _[0] = S + _[0].split(`
`).join(`
` + S), _.push(B + "m+" + t.exports.humanize(this.diff) + "\x1B[0m");
      } else
        _[0] = v() + x + " " + _[0];
    }
    function v() {
      return e.inspectOpts.hideDate ? "" : (/* @__PURE__ */ new Date()).toISOString() + " ";
    }
    function b(..._) {
      return process.stderr.write(n.formatWithOptions(e.inspectOpts, ..._) + `
`);
    }
    function g(_) {
      _ ? process.env.DEBUG = _ : delete process.env.DEBUG;
    }
    function E() {
      return process.env.DEBUG;
    }
    function M(_) {
      _.inspectOpts = {};
      const x = Object.keys(e.inspectOpts);
      for (let C = 0; C < x.length; C++)
        _.inspectOpts[x[C]] = e.inspectOpts[x[C]];
    }
    t.exports = zi()(e);
    const { formatters: y } = t.exports;
    y.o = function(_) {
      return this.inspectOpts.colors = this.useColors, n.inspect(_, this.inspectOpts).split(`
`).map((x) => x.trim()).join(" ");
    }, y.O = function(_) {
      return this.inspectOpts.colors = this.useColors, n.inspect(_, this.inspectOpts);
    };
  }(At, At.exports)), At.exports;
}
var kn;
function Wi() {
  return kn || (kn = 1, typeof process > "u" || process.type === "renderer" || process.browser === !0 || process.__nwjs ? Ct.exports = Us() : Ct.exports = Gs()), Ct.exports;
}
var yr = {}, Ve = {}, Pn;
function Vs() {
  if (Pn) return Ve;
  Pn = 1;
  var t = K && K.__createBinding || (Object.create ? function(g, E, M, y) {
    y === void 0 && (y = M);
    var _ = Object.getOwnPropertyDescriptor(E, M);
    (!_ || ("get" in _ ? !E.__esModule : _.writable || _.configurable)) && (_ = { enumerable: !0, get: function() {
      return E[M];
    } }), Object.defineProperty(g, y, _);
  } : function(g, E, M, y) {
    y === void 0 && (y = M), g[y] = E[M];
  }), e = K && K.__setModuleDefault || (Object.create ? function(g, E) {
    Object.defineProperty(g, "default", { enumerable: !0, value: E });
  } : function(g, E) {
    g.default = E;
  }), i = K && K.__importStar || function(g) {
    if (g && g.__esModule) return g;
    var E = {};
    if (g != null) for (var M in g) M !== "default" && Object.prototype.hasOwnProperty.call(g, M) && t(E, g, M);
    return e(E, g), E;
  };
  Object.defineProperty(Ve, "__esModule", { value: !0 }), Ve.req = Ve.json = Ve.toBuffer = void 0;
  const n = i(Hn), f = i(Br);
  async function a(g) {
    let E = 0;
    const M = [];
    for await (const y of g)
      E += y.length, M.push(y);
    return Buffer.concat(M, E);
  }
  Ve.toBuffer = a;
  async function v(g) {
    const M = (await a(g)).toString("utf8");
    try {
      return JSON.parse(M);
    } catch (y) {
      const _ = y;
      throw _.message += ` (input: ${M})`, _;
    }
  }
  Ve.json = v;
  function b(g, E = {}) {
    const y = ((typeof g == "string" ? g : g.href).startsWith("https:") ? f : n).request(g, E), _ = new Promise((x, C) => {
      y.once("response", x).once("error", C).end();
    });
    return y.then = _.then.bind(_), y;
  }
  return Ve.req = b, Ve;
}
var In;
function zs() {
  return In || (In = 1, function(t) {
    var e = K && K.__createBinding || (Object.create ? function(M, y, _, x) {
      x === void 0 && (x = _);
      var C = Object.getOwnPropertyDescriptor(y, _);
      (!C || ("get" in C ? !y.__esModule : C.writable || C.configurable)) && (C = { enumerable: !0, get: function() {
        return y[_];
      } }), Object.defineProperty(M, x, C);
    } : function(M, y, _, x) {
      x === void 0 && (x = _), M[x] = y[_];
    }), i = K && K.__setModuleDefault || (Object.create ? function(M, y) {
      Object.defineProperty(M, "default", { enumerable: !0, value: y });
    } : function(M, y) {
      M.default = y;
    }), n = K && K.__importStar || function(M) {
      if (M && M.__esModule) return M;
      var y = {};
      if (M != null) for (var _ in M) _ !== "default" && Object.prototype.hasOwnProperty.call(M, _) && e(y, M, _);
      return i(y, M), y;
    }, f = K && K.__exportStar || function(M, y) {
      for (var _ in M) _ !== "default" && !Object.prototype.hasOwnProperty.call(y, _) && e(y, M, _);
    };
    Object.defineProperty(t, "__esModule", { value: !0 }), t.Agent = void 0;
    const a = n(Un), v = n(Hn), b = Br;
    f(Vs(), t);
    const g = Symbol("AgentBaseInternalState");
    class E extends v.Agent {
      constructor(y) {
        super(y), this[g] = {};
      }
      /**
       * Determine whether this is an `http` or `https` request.
       */
      isSecureEndpoint(y) {
        if (y) {
          if (typeof y.secureEndpoint == "boolean")
            return y.secureEndpoint;
          if (typeof y.protocol == "string")
            return y.protocol === "https:";
        }
        const { stack: _ } = new Error();
        return typeof _ != "string" ? !1 : _.split(`
`).some((x) => x.indexOf("(https.js:") !== -1 || x.indexOf("node:https:") !== -1);
      }
      // In order to support async signatures in `connect()` and Node's native
      // connection pooling in `http.Agent`, the array of sockets for each origin
      // has to be updated synchronously. This is so the length of the array is
      // accurate when `addRequest()` is next called. We achieve this by creating a
      // fake socket and adding it to `sockets[origin]` and incrementing
      // `totalSocketCount`.
      incrementSockets(y) {
        if (this.maxSockets === 1 / 0 && this.maxTotalSockets === 1 / 0)
          return null;
        this.sockets[y] || (this.sockets[y] = []);
        const _ = new a.Socket({ writable: !1 });
        return this.sockets[y].push(_), this.totalSocketCount++, _;
      }
      decrementSockets(y, _) {
        if (!this.sockets[y] || _ === null)
          return;
        const x = this.sockets[y], C = x.indexOf(_);
        C !== -1 && (x.splice(C, 1), this.totalSocketCount--, x.length === 0 && delete this.sockets[y]);
      }
      // In order to properly update the socket pool, we need to call `getName()` on
      // the core `https.Agent` if it is a secureEndpoint.
      getName(y) {
        return this.isSecureEndpoint(y) ? b.Agent.prototype.getName.call(this, y) : super.getName(y);
      }
      createSocket(y, _, x) {
        const C = {
          ..._,
          secureEndpoint: this.isSecureEndpoint(_)
        }, D = this.getName(C), B = this.incrementSockets(D);
        Promise.resolve().then(() => this.connect(y, C)).then((S) => {
          if (this.decrementSockets(D, B), S instanceof v.Agent)
            try {
              return S.addRequest(y, C);
            } catch (A) {
              return x(A);
            }
          this[g].currentSocket = S, super.createSocket(y, _, x);
        }, (S) => {
          this.decrementSockets(D, B), x(S);
        });
      }
      createConnection() {
        const y = this[g].currentSocket;
        if (this[g].currentSocket = void 0, !y)
          throw new Error("No socket was returned in the `connect()` function");
        return y;
      }
      get defaultPort() {
        return this[g].defaultPort ?? (this.protocol === "https:" ? 443 : 80);
      }
      set defaultPort(y) {
        this[g] && (this[g].defaultPort = y);
      }
      get protocol() {
        return this[g].protocol ?? (this.isSecureEndpoint() ? "https:" : "http:");
      }
      set protocol(y) {
        this[g] && (this[g].protocol = y);
      }
    }
    t.Agent = E;
  }(yr)), yr;
}
var dt = {}, Rn;
function Ws() {
  if (Rn) return dt;
  Rn = 1;
  var t = K && K.__importDefault || function(f) {
    return f && f.__esModule ? f : { default: f };
  };
  Object.defineProperty(dt, "__esModule", { value: !0 }), dt.parseProxyResponse = void 0;
  const i = (0, t(Wi()).default)("https-proxy-agent:parse-proxy-response");
  function n(f) {
    return new Promise((a, v) => {
      let b = 0;
      const g = [];
      function E() {
        const C = f.read();
        C ? x(C) : f.once("readable", E);
      }
      function M() {
        f.removeListener("end", y), f.removeListener("error", _), f.removeListener("readable", E);
      }
      function y() {
        M(), i("onend"), v(new Error("Proxy connection ended before receiving CONNECT response"));
      }
      function _(C) {
        M(), i("onerror %o", C), v(C);
      }
      function x(C) {
        g.push(C), b += C.length;
        const D = Buffer.concat(g, b), B = D.indexOf(`\r
\r
`);
        if (B === -1) {
          i("have not received end of HTTP headers yet..."), E();
          return;
        }
        const S = D.slice(0, B).toString("ascii").split(`\r
`), A = S.shift();
        if (!A)
          return f.destroy(), v(new Error("No header received from proxy CONNECT response"));
        const P = A.split(" "), R = +P[1], Se = P.slice(2).join(" "), Pe = {};
        for (const Be of S) {
          if (!Be)
            continue;
          const $e = Be.indexOf(":");
          if ($e === -1)
            return f.destroy(), v(new Error(`Invalid header from proxy CONNECT response: "${Be}"`));
          const j = Be.slice(0, $e).toLowerCase(), Ae = Be.slice($e + 1).trimStart(), p = Pe[j];
          typeof p == "string" ? Pe[j] = [p, Ae] : Array.isArray(p) ? p.push(Ae) : Pe[j] = Ae;
        }
        i("got proxy server response: %o %o", A, Pe), M(), a({
          connect: {
            statusCode: R,
            statusText: Se,
            headers: Pe
          },
          buffered: D
        });
      }
      f.on("error", _), f.on("end", y), E();
    });
  }
  return dt.parseProxyResponse = n, dt;
}
var Dn;
function Zs() {
  if (Dn) return ct;
  Dn = 1;
  var t = K && K.__createBinding || (Object.create ? function(B, S, A, P) {
    P === void 0 && (P = A);
    var R = Object.getOwnPropertyDescriptor(S, A);
    (!R || ("get" in R ? !S.__esModule : R.writable || R.configurable)) && (R = { enumerable: !0, get: function() {
      return S[A];
    } }), Object.defineProperty(B, P, R);
  } : function(B, S, A, P) {
    P === void 0 && (P = A), B[P] = S[A];
  }), e = K && K.__setModuleDefault || (Object.create ? function(B, S) {
    Object.defineProperty(B, "default", { enumerable: !0, value: S });
  } : function(B, S) {
    B.default = S;
  }), i = K && K.__importStar || function(B) {
    if (B && B.__esModule) return B;
    var S = {};
    if (B != null) for (var A in B) A !== "default" && Object.prototype.hasOwnProperty.call(B, A) && t(S, B, A);
    return e(S, B), S;
  }, n = K && K.__importDefault || function(B) {
    return B && B.__esModule ? B : { default: B };
  };
  Object.defineProperty(ct, "__esModule", { value: !0 }), ct.HttpsProxyAgent = void 0;
  const f = i(Un), a = i(no), v = n(io), b = n(Wi()), g = zs(), E = Sr, M = Ws(), y = (0, b.default)("https-proxy-agent"), _ = (B) => B.servername === void 0 && B.host && !f.isIP(B.host) ? {
    ...B,
    servername: B.host
  } : B;
  class x extends g.Agent {
    constructor(S, A) {
      super(A), this.options = { path: void 0 }, this.proxy = typeof S == "string" ? new E.URL(S) : S, this.proxyHeaders = (A == null ? void 0 : A.headers) ?? {}, y("Creating new HttpsProxyAgent instance: %o", this.proxy.href);
      const P = (this.proxy.hostname || this.proxy.host).replace(/^\[|\]$/g, ""), R = this.proxy.port ? parseInt(this.proxy.port, 10) : this.proxy.protocol === "https:" ? 443 : 80;
      this.connectOpts = {
        // Attempt to negotiate http/1.1 for proxy servers that support http/2
        ALPNProtocols: ["http/1.1"],
        ...A ? D(A, "headers") : null,
        host: P,
        port: R
      };
    }
    /**
     * Called when the node-core HTTP client library is creating a
     * new HTTP request.
     */
    async connect(S, A) {
      const { proxy: P } = this;
      if (!A.host)
        throw new TypeError('No "host" provided');
      let R;
      P.protocol === "https:" ? (y("Creating `tls.Socket`: %o", this.connectOpts), R = a.connect(_(this.connectOpts))) : (y("Creating `net.Socket`: %o", this.connectOpts), R = f.connect(this.connectOpts));
      const Se = typeof this.proxyHeaders == "function" ? this.proxyHeaders() : { ...this.proxyHeaders }, Pe = f.isIPv6(A.host) ? `[${A.host}]` : A.host;
      let Be = `CONNECT ${Pe}:${A.port} HTTP/1.1\r
`;
      if (P.username || P.password) {
        const r = `${decodeURIComponent(P.username)}:${decodeURIComponent(P.password)}`;
        Se["Proxy-Authorization"] = `Basic ${Buffer.from(r).toString("base64")}`;
      }
      Se.Host = `${Pe}:${A.port}`, Se["Proxy-Connection"] || (Se["Proxy-Connection"] = this.keepAlive ? "Keep-Alive" : "close");
      for (const r of Object.keys(Se))
        Be += `${r}: ${Se[r]}\r
`;
      const $e = (0, M.parseProxyResponse)(R);
      R.write(`${Be}\r
`);
      const { connect: j, buffered: Ae } = await $e;
      if (S.emit("proxyConnect", j), this.emit("proxyConnect", j, S), j.statusCode === 200)
        return S.once("socket", C), A.secureEndpoint ? (y("Upgrading socket connection to TLS"), a.connect({
          ...D(_(A), "host", "path", "port"),
          socket: R
        })) : R;
      R.destroy();
      const p = new f.Socket({ writable: !1 });
      return p.readable = !0, S.once("socket", (r) => {
        y("Replaying proxy buffer for failed request"), (0, v.default)(r.listenerCount("data") > 0), r.push(Ae), r.push(null);
      }), p;
    }
  }
  x.protocols = ["http", "https"], ct.HttpsProxyAgent = x;
  function C(B) {
    B.resume();
  }
  function D(B, ...S) {
    const A = {};
    let P;
    for (P in B)
      S.includes(P) || (A[P] = B[P]);
    return A;
  }
  return ct;
}
const Zi = Sr, Ji = Br, Js = Vi, Ot = Di, Ys = Hi, Oe = Ur, Qs = Ai, Nn = 2419200;
let Er = "", xr;
function Et() {
}
Et.prototype.setGCMAPIKey = function(t) {
  if (t === null) {
    Er = null;
    return;
  }
  if (typeof t > "u" || typeof t != "string" || t.length === 0)
    throw new Error("The GCM API Key should be a non-empty string or null.");
  Er = t;
};
Et.prototype.setVapidDetails = function(t, e, i) {
  if (arguments.length === 1 && arguments[0] === null) {
    xr = null;
    return;
  }
  Ot.validateSubject(t), Ot.validatePublicKey(e), Ot.validatePrivateKey(i), xr = {
    subject: t,
    publicKey: e,
    privateKey: i
  };
};
Et.prototype.generateRequestDetails = function(t, e, i) {
  if (!t || !t.endpoint)
    throw new Error("You must pass in a subscription with at least an endpoint.");
  if (typeof t.endpoint != "string" || t.endpoint.length === 0)
    throw new Error("The subscription endpoint must be a string with a valid URL.");
  if (e && (typeof t != "object" || !t.keys || !t.keys.p256dh || !t.keys.auth))
    throw new Error("To send a message with a payload, the subscription must have 'auth' and 'p256dh' keys.");
  let n = Er, f = xr, a = Nn, v = {}, b = Oe.supportedContentEncodings.AES_128_GCM, g = Oe.supportedUrgency.NORMAL, E, M, y, _;
  if (i) {
    const S = [
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
    ], A = Object.keys(i);
    for (let P = 0; P < A.length; P += 1) {
      const R = A[P];
      if (!S.includes(R))
        throw new Error("'" + R + "' is an invalid option. The valid options are ['" + S.join("', '") + "'].");
    }
    if (i.headers) {
      v = i.headers;
      let P = Object.keys(v).filter(function(R) {
        return typeof i[R] < "u";
      });
      if (P.length > 0)
        throw new Error("Duplicated headers defined [" + P.join(",") + "]. Please either define the header in thetop level options OR in the 'headers' key.");
    }
    if (i.gcmAPIKey && (n = i.gcmAPIKey), i.vapidDetails !== void 0 && (f = i.vapidDetails), i.TTL !== void 0 && (a = Number(i.TTL), a < 0))
      throw new Error("TTL should be a number and should be at least 0");
    if (i.contentEncoding)
      if (i.contentEncoding === Oe.supportedContentEncodings.AES_128_GCM || i.contentEncoding === Oe.supportedContentEncodings.AES_GCM)
        b = i.contentEncoding;
      else
        throw new Error("Unsupported content encoding specified.");
    if (i.urgency)
      if (i.urgency === Oe.supportedUrgency.VERY_LOW || i.urgency === Oe.supportedUrgency.LOW || i.urgency === Oe.supportedUrgency.NORMAL || i.urgency === Oe.supportedUrgency.HIGH)
        g = i.urgency;
      else
        throw new Error("Unsupported urgency specified.");
    if (i.topic) {
      if (!Qs.validate(i.topic))
        throw new Error("Unsupported characters set use the URL or filename-safe Base64 characters set");
      if (i.topic.length > 32)
        throw new Error("use maximum of 32 characters from the URL or filename-safe Base64 characters set");
      E = i.topic;
    }
    i.proxy && (typeof i.proxy == "string" || typeof i.proxy.host == "string" ? M = i.proxy : console.warn("Attempt to use proxy option, but invalid type it should be a string or proxy options object.")), i.agent && (i.agent instanceof Ji.Agent ? (M && console.warn("Agent option will be ignored because proxy option is defined."), y = i.agent) : console.warn("Wrong type for the agent option, it should be an instance of https.Agent.")), typeof i.timeout == "number" && (_ = i.timeout);
  }
  typeof a > "u" && (a = Nn);
  const x = {
    method: "POST",
    headers: {
      TTL: a
    }
  };
  Object.keys(v).forEach(function(S) {
    x.headers[S] = v[S];
  });
  let C = null;
  if (e) {
    const S = Ys.encrypt(t.keys.p256dh, t.keys.auth, e, b);
    x.headers["Content-Length"] = S.cipherText.length, x.headers["Content-Type"] = "application/octet-stream", b === Oe.supportedContentEncodings.AES_128_GCM ? x.headers["Content-Encoding"] = Oe.supportedContentEncodings.AES_128_GCM : b === Oe.supportedContentEncodings.AES_GCM && (x.headers["Content-Encoding"] = Oe.supportedContentEncodings.AES_GCM, x.headers.Encryption = "salt=" + S.salt, x.headers["Crypto-Key"] = "dh=" + S.localPublicKey.toString("base64url")), C = S.cipherText;
  } else
    x.headers["Content-Length"] = 0;
  const D = t.endpoint.startsWith("https://android.googleapis.com/gcm/send"), B = t.endpoint.startsWith("https://fcm.googleapis.com/fcm/send");
  if (D)
    n ? x.headers.Authorization = "key=" + n : console.warn("Attempt to send push notification to GCM endpoint, but no GCM key is defined. Please use setGCMApiKey() or add 'gcmAPIKey' as an option.");
  else if (f) {
    const S = Zi.parse(t.endpoint), A = S.protocol + "//" + S.host, P = Ot.getVapidHeaders(
      A,
      f.subject,
      f.publicKey,
      f.privateKey,
      b
    );
    x.headers.Authorization = P.Authorization, b === Oe.supportedContentEncodings.AES_GCM && (x.headers["Crypto-Key"] ? x.headers["Crypto-Key"] += ";" + P["Crypto-Key"] : x.headers["Crypto-Key"] = P["Crypto-Key"]);
  } else B && n && (x.headers.Authorization = "key=" + n);
  return x.headers.Urgency = g, E && (x.headers.Topic = E), x.body = C, x.endpoint = t.endpoint, M && (x.proxy = M), y && (x.agent = y), _ && (x.timeout = _), x;
};
Et.prototype.sendNotification = function(t, e, i) {
  let n;
  try {
    n = this.generateRequestDetails(t, e, i);
  } catch (f) {
    return Promise.reject(f);
  }
  return new Promise(function(f, a) {
    const v = {}, b = Zi.parse(n.endpoint);
    if (v.hostname = b.hostname, v.port = b.port, v.path = b.path, v.headers = n.headers, v.method = n.method, n.timeout && (v.timeout = n.timeout), n.agent && (v.agent = n.agent), n.proxy) {
      const { HttpsProxyAgent: E } = Zs();
      v.agent = new E(n.proxy);
    }
    const g = Ji.request(v, function(E) {
      let M = "";
      E.on("data", function(y) {
        M += y;
      }), E.on("end", function() {
        E.statusCode < 200 || E.statusCode > 299 ? a(new Js(
          "Received unexpected response code",
          E.statusCode,
          E.headers,
          M,
          n.endpoint
        )) : f({
          statusCode: E.statusCode,
          body: M,
          headers: E.headers
        });
      });
    });
    n.timeout && g.on("timeout", function() {
      g.destroy(new Error("Socket timeout"));
    }), g.on("error", function(E) {
      a(E);
    }), n.body && g.write(n.body), g.end();
  });
};
var Xs = Et;
const jn = Di, ea = Hi, ta = Xs, ra = Vi, na = Ur, pt = new ta();
var ia = {
  WebPushError: ra,
  supportedContentEncodings: na.supportedContentEncodings,
  encrypt: ea.encrypt,
  getVapidHeaders: jn.getVapidHeaders,
  generateVAPIDKeys: jn.generateVAPIDKeys,
  setGCMAPIKey: pt.setGCMAPIKey,
  setVapidDetails: pt.setVapidDetails,
  generateRequestDetails: pt.generateRequestDetails,
  sendNotification: pt.sendNotification.bind(pt)
};
const Yi = /* @__PURE__ */ so(ia);
try {
  Yi.setVapidDetails(
    "mailto:admin@titsmart.vn",
    "BPAuS3BAVsbHBUEJLS_d0lvmxZqLOj71iPBE7oZSIX-r_mbbosFY4JMBmPs_fDOfhQtWT1mpf-_A9c1cSNPip0c",
    "2eQfYJLlDO7jQpnpSMBiENSXTgvHhC4NAQoQzrsr8O0"
  );
} catch (t) {
  console.debug("Lỗi setVapidDetails trong Electron:", t);
}
const { autoUpdater: Ce } = ro, Qi = je.requestSingleInstanceLock();
Qi || je.quit();
const oa = to(import.meta.url), rt = Ke.dirname(oa);
let N = null, tt = null, Ht = !1;
const Fn = process.env.VITE_DEV_SERVER_URL;
function Hr() {
  const t = [
    Ke.join(rt, "../public/favicon.ico"),
    Ke.join(rt, "../dist/favicon.ico"),
    Ke.join(process.resourcesPath || "", "favicon.ico"),
    Ke.join(rt, "../public/logo.png"),
    Ke.join(rt, "../dist/logo.png")
  ];
  for (const e of t)
    if (nt.existsSync(e))
      return qn.createFromPath(e);
}
function sa() {
  if (tt) return;
  const t = Hr();
  tt = new Xi(t || qn.createEmpty()), tt.setToolTip("TITSMART - Quản lý công việc");
  const e = eo.buildFromTemplate([
    {
      label: "Mở TITSMART",
      click: () => {
        bt();
      }
    },
    {
      type: "separator"
    },
    {
      label: "Kiểm tra cập nhật...",
      click: () => {
        Ce.checkForUpdates().catch(() => {
        });
      }
    },
    {
      type: "separator"
    },
    {
      label: "Thoát hoàn toàn",
      click: () => {
        Ht = !0, N && !N.isDestroyed() && N.destroy(), je.quit();
      }
    }
  ]);
  tt.setContextMenu(e), tt.on("double-click", () => {
    bt();
  });
}
function bt() {
  if (!N || N.isDestroyed()) {
    Gr();
    return;
  }
  N.isMinimized() && N.restore(), N.show(), N.focus();
}
function Gr() {
  const t = Hr();
  N = new $n({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: t,
    autoHideMenuBar: !0,
    show: !1,
    // Tránh nhấp nháy trắng màn hình, chờ sẵn sàng mới hiển thị
    backgroundColor: "#ffffff",
    webPreferences: {
      preload: Ke.join(rt, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0,
      backgroundThrottling: !1
      // KHÔNG ĐÓNG BĂNG/HẠ CHẾ TIẾN TRÌNH KHI ẨN XUỐNG TRAY
    }
  }), N.once("ready-to-show", () => {
    N && !N.isDestroyed() && (N.show(), N.focus());
  }), Fn ? (N.loadURL(Fn), N.webContents.openDevTools()) : N.loadFile(Ke.join(process.env.DIST || Ke.join(rt, "../dist"), "index.html")), N.webContents.setWindowOpenHandler(({ url: e }) => ((e.startsWith("http://") || e.startsWith("https://")) && Ln.openExternal(e), { action: "deny" })), N.on("close", (e) => {
    !Ht && N && !N.isDestroyed() && (e.preventDefault(), N.webContents.send("app:request-close"));
  });
}
je.on("second-instance", () => {
  bt();
});
function Je(t, e) {
  N && !N.isDestroyed() && N.webContents.send(t, e);
}
function aa(t) {
  return Array.isArray(t) ? t.map((e) => typeof e == "string" ? e : (e == null ? void 0 : e.note) ?? "").filter(Boolean).join(`
`) : t ?? "";
}
function fa() {
  je.isPackaged && (Ce.autoDownload = !0, Ce.autoInstallOnAppQuit = !0, Ce.disableDifferentialDownload = !0, Ce.disableWebInstaller = !0, Ce.on("checking-for-update", () => {
    Je("update:status", { status: "checking" });
  }), Ce.on("update-available", (t) => {
    Je("update:status", {
      status: "available",
      version: t.version,
      releaseNotes: aa(t.releaseNotes)
    });
  }), Ce.on("update-not-available", (t) => {
    Je("update:status", { status: "not-available", version: t.version });
  }), Ce.on("download-progress", (t) => {
    Je("update:status", {
      status: "downloading",
      percent: Math.round(t.percent),
      transferred: t.transferred,
      total: t.total,
      bytesPerSecond: t.bytesPerSecond
    });
  }), Ce.on("update-downloaded", (t) => {
    Je("update:status", { status: "downloaded", version: t.version });
  }), Ce.on("error", (t) => {
    Je("update:status", { status: "error", message: (t == null ? void 0 : t.message) ?? String(t) });
  }), He.on("update:check", () => {
    Ce.checkForUpdates();
  }), He.on("update:download", () => {
    Ce.downloadUpdate();
  }), He.on("update:install", () => {
    Ce.quitAndInstall();
  }), setTimeout(() => {
    Ce.checkForUpdates().catch((t) => {
      Je("update:status", { status: "error", message: (t == null ? void 0 : t.message) ?? String(t) });
    });
  }, 3e3), setInterval(() => {
    Ce.checkForUpdates().catch(() => {
    });
  }, 6e4));
}
He.on("open-external", async (t, e) => {
  if (e && typeof e == "string")
    try {
      await Ln.openExternal(e);
    } catch (i) {
      console.error("Failed to open url:", i);
    }
});
He.on("app:minimize-to-tray", () => {
  N && !N.isDestroyed() && N.hide();
});
He.on("app:show-notification", (t, { title: e, body: i, url: n }) => {
  if (ln.isSupported()) {
    const f = Hr(), a = new ln({
      title: e || "TITSMART",
      body: i || "Bạn có thông báo mới.",
      icon: f
    });
    a.on("click", () => {
      bt(), n && N && !N.isDestroyed() && N.webContents.send("navigate:url", n);
    }), a.show();
  }
});
He.on("app:send-web-push", async (t, { subscription: e, payload: i }) => {
  try {
    if (!e || !e.endpoint) return;
    const n = typeof e == "string" ? JSON.parse(e) : e, f = typeof i == "string" ? i : JSON.stringify(i);
    await Yi.sendNotification(n, f), console.log("[Electron APNs] Bắn Web Push tới Apple/Google thành công!");
  } catch (n) {
    console.debug("[Electron APNs] Lỗi gửi Web Push:", (n == null ? void 0 : n.statusCode) || (n == null ? void 0 : n.message) || n);
  }
});
He.on("app:confirm-quit", () => {
  Ht = !0, N && !N.isDestroyed() && N.destroy(), je.quit();
});
const gt = Ke.join(je.getPath("userData"), "auth_session.json");
He.on("session:save", (t, e) => {
  try {
    e ? nt.writeFileSync(gt, JSON.stringify(e), "utf-8") : nt.existsSync(gt) && nt.unlinkSync(gt);
  } catch (i) {
    console.error("Failed to write auth_session.json:", i);
  }
});
He.on("session:load", (t) => {
  try {
    if (nt.existsSync(gt)) {
      const e = nt.readFileSync(gt, "utf-8");
      if (e) {
        t.returnValue = JSON.parse(e);
        return;
      }
    }
  } catch (e) {
    console.error("Failed to read auth_session.json:", e);
  }
  t.returnValue = null;
});
je.on("before-quit", () => {
  Ht = !0;
});
je.on("window-all-closed", () => {
  tt || process.platform !== "darwin" && (je.quit(), N = null);
});
je.on("activate", () => {
  $n.getAllWindows().length === 0 ? Gr() : bt();
});
Qi && je.whenReady().then(() => {
  Gr(), sa(), fa();
});
