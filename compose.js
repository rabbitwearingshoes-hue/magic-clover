// 공연자 폰에서 사진 2의 배너에 "이름"과 "No.숫자"를 사진 속에 굽는 모듈입니다.
// 그냥 글씨를 얹지 않고 다음 세 가지를 맞춰서 합성 티가 나지 않게 합니다.
//  1) 글씨 모양: 첫 사진의 '허은선' 배너 글씨처럼(위치·금색·넓은 자간), 가로줄과 세로획의 기울기를 따로 맞춤
//  2) 흐림: 배너 전체(천과 원래 글씨)를 첫 사진 배너처럼 살짝 흐리고 부옇게 만들고, 새 글씨도 같은 정도로 흐리게
//  3) 천 느낌: 천의 명암·결·잡티를 글씨에 그대로 입힘
// 결과는 한 장의 JPEG이므로 관객 폰에서는 평범한 사진으로만 보입니다.
window.Compose = (function () {
  // ===================== 조정값 =====================
  // 위치: 글씨 덩어리의 중심(사진 가로·세로 대비 비율)과, 글씨가 들어갈 수 있는 배너 폭
  var CX = 0.669, CY = 0.075, BOX_W = 0.19;   // CY를 키우면 글씨가 아래로 내려갑니다
  // 기울기(도). 양수는 시계 방향. 가로줄과 세로획이 다르게 기울어야 글자가 따로 놀지 않습니다.
  var ROT = 6.3;            // 가로줄 기울기 (실제 배너 글씨를 측정한 값)
  var LEAN = 1.5;           // 세로획 기울기 (같은 값으로 두면 글자가 통째로 돌아가 보임)
  var SX = 0.97;            // 가로 폭 비율 (배너가 살짝 옆을 향해 있어 글자가 약간 좁아 보임)
  // 글자 크기(사진 가로폭 대비)와 자간(글자 크기 대비)
  var NAME_SIZE = 0.034, NAME_TRACK = 0.20;   // 이름
  var NUM_SIZE = 0.030, NUM_TRACK = 0.12;     // "No.숫자"
  var LINE_DIST = 0.048;    // 이름 줄과 숫자 줄의 중심 사이 거리
  var NUM_TWO_TONE = false; // true면 "No."는 크림색, 숫자는 금색으로 나뉨
  // 색과 진하기
  var GOLD = '#cf9d68';     // 이름 색 (배너의 '무료 전시회' 금색 계열)
  var CREAM = '#dcd6cc';    // "No.숫자" 색
  var INK_OPACITY = 0.85;   // 글씨 진하기
  // 흐림 (1086px 폭 사진 기준 픽셀 값. 클수록 더 흐려짐)
  var TEXT_BLUR = 1.9;      // 새 글씨의 번짐
  var BANNER_SOFT = 1.5;    // 배너 전체를 흐리게 하는 정도 (0이면 끔)
  var BANNER_CONTRAST = 0.78; // 배너 대비. 1이면 그대로, 작을수록 부옇게 (첫 사진 배너는 많이 부옜음)
  // 천 느낌
  var SHADE = 1.0;          // 천의 명암(주름 그늘)을 글씨에 입히는 정도. 0이면 끔
  var GRAIN = 1.0;          // 천의 결·잡티를 글씨에 입히는 정도. 0이면 끔
  var TINT = 0.12;          // 파란 천 색이 글씨에 비치는 정도
  var JPEG_QUALITY = 0.93;
  var FONT = '"BannerFont","Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif';
  // ==================================================

  function loadImage(url) {
    return new Promise(function (resolve, reject) {
      var i = new Image();
      i.onload = function () { resolve(i); };
      i.onerror = function () { reject(new Error('image load failed: ' + url)); };
      i.src = url;
    });
  }

  // 글꼴이 준비될 때까지 잠깐 기다립니다(최대 2.5초). 안 되면 폰 기본 글꼴로 진행합니다.
  function loadFont(text) {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    var timeout = new Promise(function (r) { setTimeout(r, 2500); });
    return Promise.race([document.fonts.load('500 40px BannerFont', text).catch(function () {}), timeout]);
  }

  // ---------- 가우시안 흐림 (Safari 등에서도 똑같이 동작하도록 직접 계산) ----------
  function kernel(sigma) {
    var r = Math.max(1, Math.ceil(sigma * 3)), k = new Float32Array(2 * r + 1), s = 0;
    for (var i = -r; i <= r; i++) { var v = Math.exp(-(i * i) / (2 * sigma * sigma)); k[i + r] = v; s += v; }
    for (var j = 0; j < k.length; j++) k[j] /= s;
    return k;
  }
  function blur(src, w, h, sigma) {
    var k = kernel(sigma), r = (k.length - 1) / 2, tmp = new Float32Array(w * h), out = new Float32Array(w * h);
    var x, y, i, acc, xx, yy;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      acc = 0;
      for (i = -r; i <= r; i++) { xx = x + i; if (xx >= 0 && xx < w) acc += src[y * w + xx] * k[i + r]; }
      tmp[y * w + x] = acc;
    }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      acc = 0;
      for (i = -r; i <= r; i++) { yy = y + i; if (yy >= 0 && yy < h) acc += tmp[yy * w + x] * k[i + r]; }
      out[y * w + x] = acc;
    }
    return out;
  }
  // 마스크(=1인 부분)만 반영해서 흐리게 만듭니다. 바깥의 나뭇잎 같은 색이 섞이지 않게 하기 위함
  function blurMasked(val, mask, w, h, sigma) {
    var n = w * h, vm = new Float32Array(n), i;
    for (i = 0; i < n; i++) vm[i] = val[i] * mask[i];
    var a = blur(vm, w, h, sigma), b = blur(mask, w, h, sigma), out = new Float32Array(n);
    for (i = 0; i < n; i++) out[i] = b[i] > 0.02 ? a[i] / b[i] : val[i];
    return out;
  }

  // ---------- 배너 안쪽(천 + 그 위의 글씨) 영역 찾기 ----------
  // 줄마다 왼쪽 끝과 오른쪽 끝을 찾아 그 사이를 배너로 봅니다. 원래 글씨 픽셀이 중간에 있어도 상관없습니다.
  function bannerMask(d, RW, RH) {
    var xl = new Float32Array(RH), xr = new Float32Array(RH), y, x;
    function cloth(i) { var r = d[4 * i], g = d[4 * i + 1], b = d[4 * i + 2]; return b > 100 && r < 90 && g < 150; }
    for (y = 0; y < RH; y++) {
      xl[y] = -1; xr[y] = -1;
      for (x = 0; x < RW - 4; x++) { var o = y * RW + x; if (cloth(o) && cloth(o + 1) && cloth(o + 2) && cloth(o + 3)) { xl[y] = x; break; } }
      for (x = RW - 1; x >= 4; x--) { var p = y * RW + x; if (cloth(p) && cloth(p - 1) && cloth(p - 2) && cloth(p - 3)) { xr[y] = x; break; } }
    }
    function med(arr, yy) {
      var v = [], k;
      for (k = -5; k <= 5; k++) { var y2 = yy + k; if (y2 >= 0 && y2 < RH && arr[y2] >= 0) v.push(arr[y2]); }
      if (!v.length) return -1;
      v.sort(function (a, b) { return a - b; });
      return v[v.length >> 1];
    }
    var m = new Float32Array(RW * RH);
    for (y = 0; y < RH; y++) {
      var a = med(xl, y), b = med(xr, y);
      if (a < 0 || b < 0) continue;
      for (x = Math.ceil(a) + 1; x < b - 1; x++) m[y * RW + x] = 1; // 가장자리 1px은 빼서 바깥색이 섞이지 않게
    }
    return m;
  }

  // ---------- 배너 전체를 첫 사진의 배너처럼 흐리고 부옇게 ----------
  function soften(base, RW, RH, sigma, k) {
    var n = RW * RH, d = base.data, inb = bannerMask(d, RW, RH);
    var out = new ImageData(new Uint8ClampedArray(d), RW, RH), c, i, cnt = 0;
    for (i = 0; i < n; i++) if (inb[i] > 0) cnt++;
    for (c = 0; c < 3; c++) {
      var ch = new Float32Array(n);
      for (i = 0; i < n; i++) ch[i] = d[4 * i + c];
      var bl = sigma > 0 ? blurMasked(ch, inb, RW, RH, sigma) : ch, mean = 0;
      for (i = 0; i < n; i++) if (inb[i] > 0) mean += bl[i];
      mean = cnt ? mean / cnt : 0;
      for (i = 0; i < n; i++) if (inb[i] > 0) {
        var v = mean + (bl[i] - mean) * k; // k<1이면 대비가 줄어 부옇게 보임
        out.data[4 * i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
    }
    return out;
  }

  // ---------- 글씨 그리기 (가로줄·세로획 기울기를 따로 적용) ----------
  function trackedWidth(g, text, track) {
    var w = 0, i;
    for (i = 0; i < text.length; i++) w += g.measureText(text[i]).width;
    return w + track * (text.length - 1);
  }
  // 글자 사이를 직접 띄워서 그립니다(폰마다 letterSpacing 지원이 달라서)
  function drawTracked(g, text, cy, track, colorAt) {
    var x = -trackedWidth(g, text, track) / 2, i;
    g.textAlign = 'left';
    for (i = 0; i < text.length; i++) {
      if (colorAt) g.fillStyle = colorAt(i);
      g.fillText(text[i], x, cy);
      x += g.measureText(text[i]).width + track;
    }
  }

  function drawInk(RW, RH, RX, RY, W, H, name, num) {
    var cv = document.createElement('canvas');
    cv.width = RW; cv.height = RH;
    var g = cv.getContext('2d');
    var rot = ROT * Math.PI / 180, lean = LEAN * Math.PI / 180;
    // x축은 ROT만큼, y축은 LEAN만큼 기울어진 좌표계. 둘이 다르면 글자가 한꺼번에 돌아간 느낌이 사라집니다.
    g.setTransform(SX * Math.cos(rot), SX * Math.sin(rot), -Math.sin(lean), Math.cos(lean), CX * W - RX, CY * H - RY);
    g.textBaseline = 'middle';

    var maxW = BOX_W * W * 0.92;
    var nameSize = NAME_SIZE * W, trackN = NAME_TRACK * nameSize;
    g.font = '500 ' + nameSize + 'px ' + FONT;
    var nw = trackedWidth(g, name, trackN);
    if (nw > maxW) { var f = maxW / nw; nameSize *= f; trackN *= f; } // 긴 이름은 배너 폭에 맞게 줄임

    var numSize = NUM_SIZE * W, trackM = NUM_TRACK * numSize, dist = LINE_DIST * W;
    g.font = '500 ' + nameSize + 'px ' + FONT;
    g.fillStyle = GOLD;
    drawTracked(g, name, -dist / 2, trackN);

    g.font = '500 ' + numSize + 'px ' + FONT;
    drawTracked(g, 'No.' + num, dist / 2, trackM, function (i) { return NUM_TWO_TONE && i >= 3 ? GOLD : CREAM; });

    return g.getImageData(0, 0, RW, RH);
  }

  // ---------- 사진과 합성 ----------
  // 원본 사진(흐리게 만든 뒤)만으로 정해지는 값들(천의 바탕색, 명암, 결). 글씨가 바뀌어도 그대로라서 한 번만 계산해 둡니다.
  function prepare(base, RW, RH) {
    var n = RW * RH, d = base.data, i;
    var L = new Float32Array(n), mask = new Float32Array(n);
    var ch = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
    for (i = 0; i < n; i++) {
      var r = d[4 * i], g = d[4 * i + 1], b = d[4 * i + 2];
      ch[0][i] = r; ch[1][i] = g; ch[2][i] = b;
      L[i] = 0.3 * r + 0.59 * g + 0.11 * b;
      mask[i] = (b > 100 && r < 70 && g < 130) ? 1 : 0; // 파란 천인 부분만
    }

    // 천의 바탕색(결을 뺀 부드러운 색)과, 큰 규모의 명암
    var bgS = [blurMasked(ch[0], mask, RW, RH, 2.2), blurMasked(ch[1], mask, RW, RH, 2.2), blurMasked(ch[2], mask, RW, RH, 2.2)];
    var Ls = blurMasked(L, mask, RW, RH, 14);
    var sum = 0, cnt = 0;
    for (i = 0; i < n; i++) if (mask[i]) { sum += Ls[i]; cnt++; }
    return { d: d, n: n, L: L, mask: mask, ch: ch, bgS: bgS, Ls: Ls, Lmean: cnt ? sum / cnt : 1 };
  }

  function composite(prep, ink, RW, RH, W) {
    var n = prep.n, d = prep.d, id = ink.data, i;
    var L = prep.L, mask = prep.mask, ch = prep.ch, bgS = prep.bgS, Ls = prep.Ls, Lmean = prep.Lmean;

    // 글씨 번짐 (투명도를 곱한 값으로 흐리게 해야 가장자리 색이 번지지 않음)
    var sigma = Math.max(0.3, TEXT_BLUR * W / 1086);
    var pm = [new Float32Array(n), new Float32Array(n), new Float32Array(n), new Float32Array(n)];
    for (i = 0; i < n; i++) {
      var a0 = id[4 * i + 3] / 255;
      pm[0][i] = id[4 * i] * a0; pm[1][i] = id[4 * i + 1] * a0; pm[2][i] = id[4 * i + 2] * a0; pm[3][i] = a0;
    }
    var bl = [blur(pm[0], RW, RH, sigma), blur(pm[1], RW, RH, sigma), blur(pm[2], RW, RH, sigma), blur(pm[3], RW, RH, sigma)];

    var out = new ImageData(RW, RH), od = out.data;
    for (i = 0; i < n; i++) {
      var pa = bl[3][i], a = pa * INK_OPACITY;
      if (a < 0.002) { od[4 * i] = d[4 * i]; od[4 * i + 1] = d[4 * i + 1]; od[4 * i + 2] = d[4 * i + 2]; od[4 * i + 3] = 255; continue; }

      var onFabric = mask[i] > 0;
      var shade = 1, thRel = 0;
      if (onFabric) {
        var s = Ls[i] / Lmean;
        shade = 1 + SHADE * (s - 1) * 1.4;
        if (shade < 0.55) shade = 0.55; else if (shade > 1.35) shade = 1.35;
        thRel = GRAIN * (L[i] - Ls[i]) / Math.max(Ls[i], 20);
      }
      for (var c = 0; c < 3; c++) {
        var base_c = onFabric ? bgS[c][i] : ch[c][i];
        var col = bl[c][i] / pa;                                 // 글씨 색
        col = col * shade * (1 - TINT) + base_c * TINT;          // 명암 + 파란 천이 비침
        var detail = ch[c][i] - base_c;                          // 천의 결(원래 사진의 잡티)
        var v = base_c * (1 - a) + col * a * (1 + thRel) + detail * (1 - a);
        od[4 * i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
      od[4 * i + 3] = 255;
    }
    return out;
  }

  // 원본 사진과 그 준비값은 처음 한 번만 만들어 두고 계속 씁니다(미리보기가 빨라짐).
  var cache = null;
  function getBase() {
    if (cache) return Promise.resolve(cache);
    return loadImage('/img2.jpg').then(function (img) {
      var W = img.naturalWidth, H = img.naturalHeight;
      var cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      var ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      // 배너 전체가 들어가는 영역만 다룹니다 (배너를 통째로 흐리게 해야 위아래가 이어짐)
      var RX = Math.round(W * 0.545), RY = 0, RW = Math.round(W * 0.275), RH = Math.round(H * 0.40);
      var base = ctx.getImageData(RX, RY, RW, RH);
      if (BANNER_SOFT > 0 || BANNER_CONTRAST < 1) base = soften(base, RW, RH, BANNER_SOFT * W / 1086, BANNER_CONTRAST);
      cache = { W: W, H: H, cv: cv, ctx: ctx, RX: RX, RY: RY, RW: RW, RH: RH, prep: prepare(base, RW, RH) };
      return cache;
    });
  }

  // 이름과 숫자를 받아 완성된 JPEG(Blob)을 돌려줍니다.
  function render(name, number) {
    name = String(name || '').trim().slice(0, 20);
    return Promise.all([getBase(), loadFont(name + 'No.0123456789')]).then(function (res) {
      var c = res[0];
      var ink = drawInk(c.RW, c.RH, c.RX, c.RY, c.W, c.H, name, number);
      // 배너 영역 전체를 매번 원본 기준으로 새로 계산해 덮어쓰므로, 이전 글씨가 남지 않습니다.
      c.ctx.putImageData(composite(c.prep, ink, c.RW, c.RH, c.W), c.RX, c.RY);
      return new Promise(function (resolve, reject) {
        c.cv.toBlob(function (b) { b ? resolve(b) : reject(new Error('toBlob failed')); }, 'image/jpeg', JPEG_QUALITY);
      });
    });
  }

  function toDataURL(blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(fr.result); };
      fr.onerror = function () { reject(fr.error); };
      fr.readAsDataURL(blob);
    });
  }

  return { render: render, toDataURL: toDataURL };
})();
