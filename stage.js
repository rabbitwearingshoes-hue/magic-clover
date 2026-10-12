// 사진과 배너 오버레이를 그리는 공용 모듈 (관객 페이지, 공연자 미리보기에서 함께 사용)
// 오버레이 위치는 사진 2의 파란 배너 윗부분(비어 있는 영역)에 맞춰져 있습니다.
window.Stage = (function () {
  // 위치: 사진 전체 대비 %. 배너는 위쪽이 아래쪽보다 좁아서 폭을 넉넉하지 않게 잡았습니다.
  var BANNER = { left: 57.4, top: 1.6, width: 19.0, height: 20.5 };

  // 흐림 정도: 사진 가로폭에 대한 비율입니다. 0이면 또렷하고, 값이 클수록 번집니다.
  // (실제 배너 글씨의 번짐에 맞춘 값. 1086px 폭 사진 기준 약 1.3px)
  var BLUR = 0.0012;

  function build(container) {
    container.classList.add('stage');
    container.innerHTML =
      '<img class="photo" alt="" draggable="false">' +
      '<div class="banner-text" hidden>' +
      '<div class="bt-name"></div>' +
      '<div class="bt-label">NUMBER</div>' +
      '<div class="bt-num"></div>' +
      '</div>';
    var b = container.querySelector('.banner-text');
    b.style.left = BANNER.left + '%';
    b.style.top = BANNER.top + '%';
    b.style.width = BANNER.width + '%';
    b.style.height = BANNER.height + '%';

    // 화면 크기가 달라도 같은 비율로 번지도록, 폭에 맞춰 흐림 값을 계산해 넣습니다.
    function applyBlur() {
      var w = container.clientWidth;
      if (w > 0) b.style.filter = 'blur(' + (w * BLUR).toFixed(2) + 'px)';
    }
    applyBlur();
    if (window.ResizeObserver) new ResizeObserver(applyBlur).observe(container);
    else window.addEventListener('resize', applyBlur);

    return {
      img: container.querySelector('.photo'),
      box: b,
      name: b.querySelector('.bt-name'),
      num: b.querySelector('.bt-num'),
    };
  }

  // 긴 이름은 배너 폭(92%)에 맞게 글자 크기를 줄입니다. cqw 단위라 화면 크기가 바뀌어도 비율이 유지됩니다.
  function fit(el) {
    el.style.fontSize = '';
    var stage = el.closest('.stage');
    var base = parseFloat(getComputedStyle(stage).getPropertyValue('--name-size')) || 4;
    var avail = el.clientWidth * 0.92;
    var need = el.scrollWidth;
    if (need > avail && avail > 0) {
      el.style.fontSize = (base * avail / need).toFixed(2) + 'cqw';
    }
  }

  function show(parts, state) {
    // state: { revealed, name, number }
    if (state && state.revealed) {
      parts.img.src = '/img2.jpg';
      parts.name.textContent = state.name;
      parts.num.textContent = state.number;
      parts.box.hidden = false;
      fit(parts.name);
    } else {
      parts.img.src = '/img1.jpg';
      parts.box.hidden = true;
    }
  }

  return { build: build, show: show, fit: fit };
})();
