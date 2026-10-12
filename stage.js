// 사진과 배너 오버레이를 그리는 공용 모듈 (관객 페이지, 공연자 미리보기에서 함께 사용)
// 오버레이 위치는 사진 2의 파란 배너 윗부분(비어 있는 영역)에 맞춰져 있습니다.
// 위치를 미세조정하려면 BANNER 값을 고치세요. 단위는 사진 전체 대비 %.
window.Stage = (function () {
  // 배너는 위쪽이 아래쪽보다 좁아서(오른쪽 가장자리가 비스듬함) 폭을 넉넉하지 않게 잡았습니다.
  var BANNER = { left: 57.4, top: 1.6, width: 19.0, height: 20.5 };

  function build(container) {
    container.classList.add('stage');
    container.innerHTML =
      '<img class="photo" alt="" draggable="false">' +
      '<div class="banner-text" hidden>' +
      '<div class="bt-name"></div>' +
      '<div class="bt-rule"></div>' +
      '<div class="bt-label">NUMBER</div>' +
      '<div class="bt-num"></div>' +
      '</div>';
    var b = container.querySelector('.banner-text');
    b.style.left = BANNER.left + '%';
    b.style.top = BANNER.top + '%';
    b.style.width = BANNER.width + '%';
    b.style.height = BANNER.height + '%';
    return {
      img: container.querySelector('.photo'),
      box: b,
      name: b.querySelector('.bt-name'),
      num: b.querySelector('.bt-num'),
    };
  }

  // 긴 이름은 배너 폭(92%)에 맞게 글자 크기를 줄입니다. cqw 단위라 화면 크기가 바뀌어도 비율이 유지됩니다.
  var BASE_CQW = 5.6;
  function fit(el) {
    el.style.fontSize = '';
    var avail = el.clientWidth * 0.92;
    var need = el.scrollWidth;
    if (need > avail && avail > 0) {
      el.style.fontSize = (BASE_CQW * avail / need).toFixed(2) + 'cqw';
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
